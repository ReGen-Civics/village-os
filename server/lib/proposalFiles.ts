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
import {
  ATTACHMENT_WORDS,
  PROPOSAL_FILES_MAX,
  PROPOSAL_FILE_MAX_BYTES,
  proposalFileKind,
  safeFileName,
  type ProposalFile,
} from "../../shared/proposalAttachments";
import { VOICE_CLIP_MAX_BYTES, VOICE_NOTES_MAX, VOICE_NOTE_ID, VOICE_NOTE_MAX_BYTES, VOICE_WORDS, voiceNoteKind, type SentClip, type VoiceClip, type VoiceNote, type VoiceNoteKind } from "../../shared/voiceNotes";

/** A proposal id as the intake makes it. Anything else never becomes a path. */
const PROPOSAL_DIR = /^op-[0-9a-f]{20}$/;

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
}

function folderOf(root: string, proposalId: string): string {
  if (!PROPOSAL_DIR.test(proposalId)) throw new Error(`not a proposal id: ${proposalId}`);
  return path.join(root, proposalId);
}

/** Every file checked, before any is written. The first problem is answered. */
export function checkProposalFiles(files: readonly UploadedFile[]): { ok: true; kinds: ProposalFile["kind"][] } | { ok: false; error: string } {
  if (files.length > PROPOSAL_FILES_MAX) return { ok: false, error: ATTACHMENT_WORDS.tooManyFiles };
  const kinds: ProposalFile["kind"][] = [];
  for (const f of files) {
    if (!f.buffer?.length) return { ok: false, error: ATTACHMENT_WORDS.fileUnreadable };
    if (f.buffer.length > PROPOSAL_FILE_MAX_BYTES) return { ok: false, error: ATTACHMENT_WORDS.fileTooBig };
    const kind = proposalFileKind(f.originalname, f.buffer);
    if (!kind) return { ok: false, error: ATTACHMENT_WORDS.fileWrongType };
    kinds.push(kind);
  }
  return { ok: true, kinds };
}

/** Write a proposal's files into its own folder. Call `checkProposalFiles` first. */
export async function writeProposalFiles(root: string, proposalId: string, files: readonly UploadedFile[]): Promise<ProposalFile[]> {
  const checked = checkProposalFiles(files);
  if (!checked.ok) throw new Error(checked.error);
  if (!files.length) return [];
  const dir = folderOf(root, proposalId);
  await fs.promises.mkdir(dir, { recursive: true });
  const out: ProposalFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const kind = checked.kinds[i];
    const id = `pf-${crypto.randomBytes(8).toString("hex")}`;
    const target = path.join(dir, `${id}.${kind}`);
    const temp = `${target}.${crypto.randomBytes(4).toString("hex")}.part`;
    await fs.promises.writeFile(temp, f.buffer);
    await fs.promises.rename(temp, target);
    out.push({ id, kind, name: safeFileName(f.originalname, kind), size: f.buffer.length, sha256: crypto.createHash("sha256").update(f.buffer).digest("hex") });
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
export function checkVoiceNotes(notes: readonly UploadedFile[]): { ok: true; kinds: VoiceNoteKind[] } | { ok: false; error: string } {
  if (notes.length > VOICE_NOTES_MAX) return { ok: false, error: VOICE_WORDS.tooMany };
  const kinds: VoiceNoteKind[] = [];
  for (const n of notes) {
    if (!n.buffer?.length) return { ok: false, error: VOICE_WORDS.wrongType };
    if (n.buffer.length > VOICE_NOTE_MAX_BYTES) return { ok: false, error: VOICE_WORDS.tooBig };
    const kind = voiceNoteKind(n.buffer);
    if (!kind) return { ok: false, error: VOICE_WORDS.wrongType };
    kinds.push(kind);
  }
  return { ok: true, kinds };
}

/** Write a proposal's recordings into its own folder, with the lengths the page timed. Call `checkVoiceNotes` first. */
export async function writeVoiceNotes(root: string, proposalId: string, notes: readonly UploadedFile[], seconds: readonly number[]): Promise<VoiceNote[]> {
  const checked = checkVoiceNotes(notes);
  if (!checked.ok) throw new Error(checked.error);
  if (!notes.length) return [];
  const dir = folderOf(root, proposalId);
  await fs.promises.mkdir(dir, { recursive: true });
  const out: VoiceNote[] = [];
  for (let i = 0; i < notes.length; i++) {
    const kind = checked.kinds[i];
    const id = `pv-${crypto.randomBytes(8).toString("hex")}`;
    const target = path.join(dir, `${id}.${kind}`);
    const temp = `${target}.${crypto.randomBytes(4).toString("hex")}.part`;
    await fs.promises.writeFile(temp, notes[i].buffer);
    await fs.promises.rename(temp, target);
    out.push({ id, kind, seconds: seconds[i] ?? 0, size: notes[i].buffer.length, sha256: crypto.createHash("sha256").update(notes[i].buffer).digest("hex") });
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
export function checkVoiceClips(clips: readonly UploadedFile[]): { ok: true; kinds: VoiceNoteKind[] } | { ok: false; error: string } {
  const kinds: VoiceNoteKind[] = [];
  for (const c of clips) {
    if (!c.buffer?.length) return { ok: false, error: VOICE_WORDS.wrongType };
    if (c.buffer.length > VOICE_CLIP_MAX_BYTES) return { ok: false, error: VOICE_WORDS.tooBig };
    const kind = voiceNoteKind(c.buffer);
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
  const checked = checkVoiceClips(clips);
  if (!checked.ok) throw new Error(checked.error);
  if (!clips.length) return [];
  const dir = folderOf(root, proposalId);
  await fs.promises.mkdir(dir, { recursive: true });
  const out: VoiceClip[] = [];
  for (let i = 0; i < clips.length; i++) {
    const kind = checked.kinds[i];
    const id = `pv-${crypto.randomBytes(8).toString("hex")}`;
    const target = path.join(dir, `${id}.${kind}`);
    const temp = `${target}.${crypto.randomBytes(4).toString("hex")}.part`;
    await fs.promises.writeFile(temp, clips[i].buffer);
    await fs.promises.rename(temp, target);
    const meta = sent[i];
    out.push({ id, kind, field: meta.field, seconds: meta.seconds, words: meta.words, size: clips[i].buffer.length, sha256: crypto.createHash("sha256").update(clips[i].buffer).digest("hex") });
  }
  return out;
}
