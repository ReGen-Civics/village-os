/**
 * A PROPOSAL'S FILES ON DISK (Rye, 10 Nov 2026; the contract is
 * shared/proposalAttachments.ts).
 *
 * One folder per proposal, `<root>/<proposal id>/`, each file `<file id>.<kind>`.
 * The root is OUTSIDE the uploads volume, because `/api/uploads/:filename`
 * answers anybody; nothing serves it but the deciders' file door
 * (server/routes/openProposalDecide.ts), as the confidentiality agreement's
 * document is kept (#1088).
 *
 * THE FOLDER FOLLOWS THE ROW. Files are written before the proposal's row, so
 * a row never names a file that is not there, and removed when the row is
 * deleted or anonymised. The tidy job then sweeps every folder whose row is
 * gone or anonymised (`sweepProposalFiles`), so a crash between the two never
 * keeps somebody's file past the proposal's own retention.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import {
  ATTACHMENT_WORDS,
  PROPOSAL_FILES_MAX,
  PROPOSAL_FILE_MAX_BYTES,
  nameFitsKind,
  proposalFileKind,
  safeFileName,
  sniffProposalFile,
  type ProposalFile,
  type ProposalFileKind,
} from "../../shared/proposalAttachments";
import { VOICE_CLIP_MAX_BYTES, VOICE_NOTES_MAX, VOICE_NOTE_ID, VOICE_NOTE_MAX_BYTES, VOICE_WORDS, voiceNoteKind, type SentClip, type VoiceClip, type VoiceNote, type VoiceNoteKind } from "../../shared/voiceNotes";
import { uploadedFilePath } from "./uploadDisk";

/** A proposal id as the intake makes it. Anything else never becomes a path. */
const PROPOSAL_DIR = /^op-[0-9a-f]{20}$/;

/**
 * One uploaded part: its bytes in memory (a suite, or an older caller), or a file on disk that the upload streamed
 * into (server/lib/uploadDisk.ts, the 19 Nov 2026 change). Every check and write below reads either, and a file on
 * disk is read in chunks, never whole.
 */
export type UploadedFile = { originalname: string; buffer: Buffer } | { originalname: string; path: string; size: number };

const onDisk = (f: UploadedFile): f is { originalname: string; path: string; size: number } => typeof (f as { path?: unknown }).path === "string";

/** How many bytes a part holds. */
export function sizeOf(f: UploadedFile): number {
  return onDisk(f) ? f.size : (f.buffer?.length ?? 0);
}

/** A part's first `n` bytes. */
export async function headOf(f: UploadedFile, n: number): Promise<Buffer> {
  if (!onDisk(f)) return f.buffer.subarray(0, n);
  const fh = await fs.promises.open(uploadedFilePath(f.path), "r");
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await fh.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

/** Whether a file on disk holds `needle` anywhere, read in chunks with an overlap so a match across two is found. */
async function fileHasAscii(file: string, needle: string): Promise<boolean> {
  const want = Buffer.from(needle, "latin1");
  let carry = Buffer.alloc(0);
  for await (const chunk of fs.createReadStream(uploadedFilePath(file), { highWaterMark: 256 * 1024 })) {
    const joined = Buffer.concat([carry, chunk as Buffer]);
    if (joined.includes(want)) return true;
    carry = joined.subarray(Math.max(0, joined.length - (want.length - 1)));
  }
  return false;
}

/** A proposal file's kind when its bytes and its name agree, else null, as `proposalFileKind` reads it. */
async function kindOfFile(f: UploadedFile): Promise<ProposalFileKind | null> {
  if (!onDisk(f)) return proposalFileKind(f.originalname, f.buffer);
  const head = await headOf(f, 64);
  // A zip is a .docx only with the Word part in it, which can sit anywhere in the file.
  const zip = head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  const kind = zip ? ((await fileHasAscii(f.path, "word/document.xml")) ? "docx" : null) : sniffProposalFile(head);
  return kind && nameFitsKind(f.originalname, kind) ? kind : null;
}

/** Copy a part to `target` (through a temp name and a rename), returning its size and SHA-256. */
async function keepPart(f: UploadedFile, target: string): Promise<{ size: number; sha256: string }> {
  const temp = `${target}.${crypto.randomBytes(4).toString("hex")}.part`;
  if (!onDisk(f)) {
    await fs.promises.writeFile(temp, f.buffer);
    await fs.promises.rename(temp, target);
    return { size: f.buffer.length, sha256: crypto.createHash("sha256").update(f.buffer).digest("hex") };
  }
  const hash = crypto.createHash("sha256");
  let size = 0;
  try {
    await pipeline(
      fs.createReadStream(uploadedFilePath(f.path)),
      async function* (source) {
        for await (const chunk of source) {
          hash.update(chunk as Buffer);
          size += (chunk as Buffer).length;
          yield chunk;
        }
      },
      fs.createWriteStream(temp, { flags: "wx", mode: 0o600 }),
    );
    await fs.promises.rename(temp, target);
  } catch (e) {
    await fs.promises.rm(temp, { force: true });
    throw e;
  }
  return { size, sha256: hash.digest("hex") };
}

function folderOf(root: string, proposalId: string): string {
  if (!PROPOSAL_DIR.test(proposalId)) throw new Error(`not a proposal id: ${proposalId}`);
  return path.join(root, proposalId);
}

/** Every file checked, before any is written. The first problem is answered. */
export async function checkProposalFiles(files: readonly UploadedFile[]): Promise<{ ok: true; kinds: ProposalFile["kind"][] } | { ok: false; error: string }> {
  if (files.length > PROPOSAL_FILES_MAX) return { ok: false, error: ATTACHMENT_WORDS.tooManyFiles };
  const kinds: ProposalFile["kind"][] = [];
  for (const f of files) {
    const size = sizeOf(f);
    if (!size) return { ok: false, error: ATTACHMENT_WORDS.fileUnreadable };
    if (size > PROPOSAL_FILE_MAX_BYTES) return { ok: false, error: ATTACHMENT_WORDS.fileTooBig };
    const kind = await kindOfFile(f).catch(() => null);
    if (!kind) return { ok: false, error: ATTACHMENT_WORDS.fileWrongType };
    kinds.push(kind);
  }
  return { ok: true, kinds };
}

/** Write a proposal's files into its own folder. Call `checkProposalFiles` first. */
export async function writeProposalFiles(root: string, proposalId: string, files: readonly UploadedFile[]): Promise<ProposalFile[]> {
  const checked = await checkProposalFiles(files);
  if (!checked.ok) throw new Error(checked.error);
  if (!files.length) return [];
  const dir = folderOf(root, proposalId);
  await fs.promises.mkdir(dir, { recursive: true });
  const out: ProposalFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const kind = checked.kinds[i];
    const id = `pf-${crypto.randomBytes(8).toString("hex")}`;
    const kept = await keepPart(f, path.join(dir, `${id}.${kind}`));
    out.push({ id, kind, name: safeFileName(f.originalname, kind), size: kept.size, sha256: kept.sha256 });
  }
  return out;
}

/** The bytes of one kept file, when they are still the bytes that were kept; else null. */
export async function readProposalFile(root: string, proposalId: string, file: ProposalFile): Promise<Buffer | null> {
  let bytes: Buffer;
  try {
    bytes = await fs.promises.readFile(path.join(folderOf(root, proposalId), `${file.id}.${file.kind}`));
  } catch {
    return null;
  }
  return crypto.createHash("sha256").update(bytes).digest("hex") === file.sha256 ? bytes : null;
}

/** Remove a proposal's folder and everything in it. A folder already gone is fine. */
export async function removeProposalFiles(root: string, proposalId: string): Promise<void> {
  if (!PROPOSAL_DIR.test(proposalId)) return;
  await fs.promises.rm(path.join(root, proposalId), { recursive: true, force: true });
}

/**
 * Remove every folder whose proposal no longer keeps files: deleted (never
 * confirmed, or not sent) or anonymised. `keeping` answers which of the ids
 * handed in are still rows that keep their files. Returns how many folders went.
 */
export async function sweepProposalFiles(root: string, keeping: (ids: string[]) => Promise<Set<string>>): Promise<number> {
  let names: string[];
  try {
    names = (await fs.promises.readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory() && PROPOSAL_DIR.test(d.name)).map((d) => d.name);
  } catch {
    return 0;
  }
  if (!names.length) return 0;
  const kept = await keeping(names);
  let removed = 0;
  for (const id of names) {
    if (kept.has(id)) continue;
    await removeProposalFiles(root, id);
    removed += 1;
  }
  return removed;
}

/*
 * VOICE NOTES (Rye, 14 Nov 2026; the contract is shared/voiceNotes.ts). Kept in
 * the same folder as the proposal's files, each `<pv-id>.<kind>`, so every rule
 * above that removes the folder removes them too. One more rule is theirs: 90
 * days after the decision they go even from a proposal that keeps its folder
 * (`removeVoiceNotes`, called by the tidy job).
 */

/** Every recording checked, before any is written. The first problem is answered. */
export async function checkVoiceNotes(notes: readonly UploadedFile[]): Promise<{ ok: true; kinds: VoiceNoteKind[] } | { ok: false; error: string }> {
  if (notes.length > VOICE_NOTES_MAX) return { ok: false, error: VOICE_WORDS.tooMany };
  const kinds: VoiceNoteKind[] = [];
  for (const n of notes) {
    const size = sizeOf(n);
    if (!size) return { ok: false, error: VOICE_WORDS.wrongType };
    if (size > VOICE_NOTE_MAX_BYTES) return { ok: false, error: VOICE_WORDS.tooBig };
    const kind = voiceNoteKind(await headOf(n, 16).catch(() => Buffer.alloc(0)));
    if (!kind) return { ok: false, error: VOICE_WORDS.wrongType };
    kinds.push(kind);
  }
  return { ok: true, kinds };
}

/** Write a proposal's recordings into its own folder, with the lengths the page timed. Call `checkVoiceNotes` first. */
export async function writeVoiceNotes(root: string, proposalId: string, notes: readonly UploadedFile[], seconds: readonly number[]): Promise<VoiceNote[]> {
  const checked = await checkVoiceNotes(notes);
  if (!checked.ok) throw new Error(checked.error);
  if (!notes.length) return [];
  const dir = folderOf(root, proposalId);
  await fs.promises.mkdir(dir, { recursive: true });
  const out: VoiceNote[] = [];
  for (let i = 0; i < notes.length; i++) {
    const kind = checked.kinds[i];
    const id = `pv-${crypto.randomBytes(8).toString("hex")}`;
    const kept = await keepPart(notes[i], path.join(dir, `${id}.${kind}`));
    out.push({ id, kind, seconds: seconds[i] ?? 0, size: kept.size, sha256: kept.sha256 });
  }
  return out;
}

/** The bytes of one kept recording, when they are still the bytes that were kept; else null. */
export async function readVoiceNote(root: string, proposalId: string, note: VoiceNote): Promise<Buffer | null> {
  if (!VOICE_NOTE_ID.test(note.id)) return null;
  let bytes: Buffer;
  try {
    bytes = await fs.promises.readFile(path.join(folderOf(root, proposalId), `${note.id}.${note.kind}`));
  } catch {
    return null;
  }
  return crypto.createHash("sha256").update(bytes).digest("hex") === note.sha256 ? bytes : null;
}

/** Remove every recording from a proposal's folder, leaving its files. A recording already gone is fine. */
export async function removeVoiceNotes(root: string, proposalId: string): Promise<void> {
  if (!PROPOSAL_DIR.test(proposalId)) return;
  let names: string[];
  try {
    names = await fs.promises.readdir(path.join(root, proposalId));
  } catch {
    return;
  }
  for (const name of names) {
    if (/^pv-[0-9a-f]{16}\./.test(name)) await fs.promises.rm(path.join(root, proposalId, name), { force: true });
  }
}

/** Every clip beside an answer checked, before any is written: its bytes, its size. The first problem is answered. */
export async function checkVoiceClips(clips: readonly UploadedFile[]): Promise<{ ok: true; kinds: VoiceNoteKind[] } | { ok: false; error: string }> {
  const kinds: VoiceNoteKind[] = [];
  for (const c of clips) {
    const size = sizeOf(c);
    if (!size) return { ok: false, error: VOICE_WORDS.wrongType };
    if (size > VOICE_CLIP_MAX_BYTES) return { ok: false, error: VOICE_WORDS.tooBig };
    const kind = voiceNoteKind(await headOf(c, 16).catch(() => Buffer.alloc(0)));
    if (!kind) return { ok: false, error: VOICE_WORDS.wrongType };
    kinds.push(kind);
  }
  return { ok: true, kinds };
}

/**
 * Write the clips beside answers into the proposal's folder, each `<pv-id>.<kind>`
 * like the main recordings, so every removal above takes them too. `sent` names
 * each clip's answer, length and words, in the order the bytes came.
 */
export async function writeVoiceClips(root: string, proposalId: string, clips: readonly UploadedFile[], sent: readonly SentClip[]): Promise<VoiceClip[]> {
  const checked = await checkVoiceClips(clips);
  if (!checked.ok) throw new Error(checked.error);
  if (!clips.length) return [];
  const dir = folderOf(root, proposalId);
  await fs.promises.mkdir(dir, { recursive: true });
  const out: VoiceClip[] = [];
  for (let i = 0; i < clips.length; i++) {
    const kind = checked.kinds[i];
    const id = `pv-${crypto.randomBytes(8).toString("hex")}`;
    const kept = await keepPart(clips[i], path.join(dir, `${id}.${kind}`));
    const meta = sent[i];
    out.push({ id, kind, field: meta.field, seconds: meta.seconds, words: meta.words, size: kept.size, sha256: kept.sha256 });
  }
  return out;
}
