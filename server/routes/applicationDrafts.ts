/**
 * SAVE AND FINISH LATER: THE ROUTES (the lead, 24 Nov 2026; the contract is shared/applicationDrafts.ts,
 * the SQL server/repos/applicationDrafts.ts, migration 0423). Registered by server/routes/openProposals.ts,
 * beside the application it saves, with that route's door, its parts store and its mail door.
 *
 *   POST /api/application-drafts          { token?, roleId, link?, step, draft, email?, name?, locale?, files: { keep, parts } }
 *   POST /api/application-drafts/open     { token }
 *   POST /api/application-drafts/file     { token, fileId }
 *   POST /api/application-drafts/discard  { token }
 *
 * Every route is public (an applicant needs no account) and rate limited by connection. The token comes
 * in the body and is never written to a log: a failure logs the draft's id at most. Nothing here shows a
 * draft to the team, and nothing counts one as an application.
 *
 * FILES are sent ahead as parts (POST /api/open-proposals/parts, the same door a send uses), named here by
 * their part ids, checked again, and copied into the draft's own folder `<files root>/drafts/<draft id>/`,
 * outside the uploads volume, the way a sent application keeps its files. A file the page no longer lists
 * is removed. The cleanup job deletes a draft and its folder DRAFT_KEEP_DAYS after its last save.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Express, Request } from "express";
import type { Pool } from "mysql2/promise";
import { addressProblem, emailKeyOf } from "../../shared/comms/address";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { isApplicantLanguage, DEFAULT_APPLICANT_LANGUAGE, type ApplicantLanguage } from "../../shared/applicantWords";
import { PROPOSAL_FILES_MAX } from "../../shared/proposalAttachments";
import { limiterAddressKey } from "../../shared/openProposals";
import { DRAFT_ERRORS, DRAFT_FILE_ID, DRAFT_ID, DRAFT_KEEP_DAYS, DRAFT_KEEP_MS, DRAFT_LIMITS, isDraftToken, resumePath, type DraftFileRef, type DraftOpened, type DraftSaved } from "../../shared/applicationDrafts";
import * as store from "../repos/applicationDrafts";
import type { StoredDraftFile } from "../repos/applicationDrafts";
import { checkProposalFiles, readKeptFile, writeCheckedFilesInto } from "../lib/proposalFiles";
import { removeParts, resolveParts } from "../lib/uploadParts";
import { draftLinkEmail } from "../lib/applicationDraftMail";
import { registerJob } from "../lib/scheduler";

export const DRAFT_CLEANUP_JOB = "application-drafts-cleanup";
const DRAFT_CLEANUP_EVERY_MS = 6 * 60 * 60 * 1000;

const WENT: ReadonlySet<PostResult["status"]> = new Set<PostResult["status"]>(["sending", "sent", "delivered", "duplicate"]);

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export interface DraftDeps {
  getPool(): Pool;
  overLimit(key: string, max: number, windowMs: number): Promise<boolean>;
  /** The connection's address, bucketed the way the application's own limits bucket it. */
  connectionKey(req: Request): string;
  /** The application's door: open for this personal link (or none). */
  door(link: unknown): Promise<{ open: boolean }>;
  /** The roles the form offers now, by id and name. */
  offered(): Promise<Array<{ id: string; name: string }>>;
  /** Where sent parts wait (server/lib/uploadParts.ts). */
  incoming: string;
  /** The private root a sent application's files live under; drafts keep theirs in `drafts/` inside it. */
  fileDir?: string;
  postEmail(email: OutgoingEmail): Promise<PostResult>;
  siteUrl(): string;
  projectName(): string;
  escapeHtml(s: string): string;
  now(): Date;
}

const hashOf = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");

/** A draft's own folder, or null for an id that is not a draft's. */
export function draftFolder(fileDir: string, id: string): string | null {
  return DRAFT_ID.test(id) ? path.join(fileDir, "drafts", id) : null;
}

const refOf = (f: StoredDraftFile): DraftFileRef => ({ id: f.id, name: f.name, size: f.size });
const idList = (v: unknown, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : []);

/** Delete a draft's folder and its row. A folder or row already gone is fine. */
export async function removeDraft(pool: Pool, fileDir: string | undefined, id: string): Promise<void> {
  const dir = fileDir ? draftFolder(fileDir, id) : null;
  if (dir) await fs.promises.rm(dir, { recursive: true, force: true });
  await store.deleteDraft(pool, id);
}

/**
 * THE CLEANUP (idempotent): every draft last saved more than DRAFT_KEEP_DAYS ago goes with its files, and any
 * draft folder whose row is gone goes too. Running it twice deletes nothing the first run left. Returns a line.
 */
export async function cleanupDrafts(pool: Pool, fileDir: string | undefined, at: Date): Promise<string> {
  const old = await store.draftsSavedBefore(pool, new Date(at.getTime() - DRAFT_KEEP_MS));
  for (const id of old) await removeDraft(pool, fileDir, id);
  let orphans = 0;
  if (fileDir) {
    const root = path.join(fileDir, "drafts");
    let names: string[] = [];
    try {
      names = (await fs.promises.readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory() && DRAFT_ID.test(d.name)).map((d) => d.name);
    } catch {
      names = [];
    }
    const kept = await store.draftIdsKept(pool, names);
    for (const id of names) {
      if (kept.has(id)) continue;
      await fs.promises.rm(path.join(root, id), { recursive: true, force: true });
      orphans += 1;
    }
  }
  return `${old.length} saved applications deleted after ${DRAFT_KEEP_DAYS} days${orphans ? `, ${orphans} file folders without a draft removed` : ""}`;
}

export function registerApplicationDraftRoutes(app: Express, d: DraftDeps): void {
  const limited = (req: Request, bucket: string, max: number) => d.overLimit(`application-draft:${bucket}:${d.connectionKey(req)}`, max, DRAFT_LIMITS.windowMs);
  /** The draft a token names, while it is still kept; null for an unknown, malformed or expired token. */
  const byToken = async (token: unknown) => {
    if (!isDraftToken(token)) return null;
    const draft = await store.draftByTokenHash(d.getPool(), hashOf(token));
    if (!draft || d.now().getTime() - draft.updatedAt.getTime() > DRAFT_KEEP_MS) return null;
    return draft;
  };

  app.post("/api/application-drafts", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (await limited(req, "save", DRAFT_LIMITS.savesPerWindow)) return res.status(429).json({ error: DRAFT_ERRORS.tooMany });
    const b = (req.body ?? {}) as Record<string, any>;
    const pool = d.getPool();
    try {
      const link = typeof b.link === "string" && b.link.trim() ? b.link.trim().slice(0, 200) : null;
      if (!(await d.door(link ?? undefined)).open) return res.status(403).json({ error: DRAFT_ERRORS.closed });
      const roleId = typeof b.roleId === "string" ? b.roleId.trim().slice(0, 128) : "";
      const role = roleId ? (await d.offered()).find((r) => r.id === roleId) : undefined;
      const body = b.draft && typeof b.draft === "object" && !Array.isArray(b.draft) ? (b.draft as Record<string, unknown>) : null;
      if (!role || !body) return res.status(400).json({ error: DRAFT_ERRORS.invalid });
      if (Buffer.byteLength(JSON.stringify(body), "utf8") > DRAFT_LIMITS.bodyBytes) return res.status(413).json({ error: DRAFT_ERRORS.tooBig });
      const step = Number.isInteger(b.step) ? Math.max(0, Math.min(20, b.step)) : 0;
      const typed = typeof b.email === "string" ? b.email.trim().slice(0, 320) : "";
      const email = typed && !addressProblem(typed) && !/[,;]/.test(typed) ? typed : null;

      // An update names its draft by token; a token that names nothing is gone, never quietly a new draft.
      const existing = b.token !== undefined && b.token !== null ? await byToken(b.token) : null;
      if (b.token !== undefined && b.token !== null && !existing) return res.status(404).json({ error: DRAFT_ERRORS.gone });
      const id = existing?.id ?? `ad-${crypto.randomBytes(10).toString("hex")}`;
      const token = existing ? String(b.token) : newToken();

      // THE FILES: the ones already kept that the page still lists, then the new parts, checked and copied in.
      const keepIds = new Set(idList(b.files?.keep, PROPOSAL_FILES_MAX).filter((x) => DRAFT_FILE_ID.test(x)));
      const before = existing?.files ?? [];
      const kept = before.filter((f) => keepIds.has(f.id));
      const partIds = idList(b.files?.parts, PROPOSAL_FILES_MAX);
      if (kept.length + partIds.length > PROPOSAL_FILES_MAX) return res.status(400).json({ error: DRAFT_ERRORS.files });
      let added: StoredDraftFile[] = [];
      const dir = d.fileDir ? draftFolder(d.fileDir, id) : null;
      if (partIds.length) {
        if (!dir) return res.status(400).json({ error: DRAFT_ERRORS.files });
        const staged = await resolveParts(d.incoming, { files: partIds, voice: [], clips: [] });
        if (!staged) return res.status(400).json({ error: DRAFT_ERRORS.uploadGone });
        const checked = await checkProposalFiles(staged.files);
        if (!checked.ok) return res.status(400).json({ error: DRAFT_ERRORS.files, message: checked.error });
        added = (await writeCheckedFilesInto(dir, staged.files, checked.kinds, "df")).map((f) => ({ id: f.id, name: f.name, size: f.size, kind: f.kind, sha256: f.sha256 }));
      }
      const files = [...kept, ...added];
      const at = d.now();
      if (existing) await store.updateDraft(pool, id, { roleId, email, body, files, step, at });
      else await store.insertDraft(pool, { id, tokenHash: hashOf(token), roleId, link, email, body, files, step, at });
      // Kept in the draft's own folder now: the parts have done their work, and a file the page dropped goes.
      if (partIds.length) await removeParts(d.incoming, { files: partIds, voice: [], clips: [] }).catch(() => undefined);
      if (dir) for (const f of before.filter((x) => !keepIds.has(x.id))) await fs.promises.rm(path.join(dir, `${f.id}.${f.kind}`), { force: true }).catch(() => undefined);

      // THE EMAIL: to the address typed, once per draft and address, through the application's own mail door.
      let emailed: DraftSaved["emailed"] = "none";
      let emailedTo = existing?.emailedTo ?? null;
      if (email && emailedTo && emailKeyOf(emailedTo) === emailKeyOf(email)) emailed = "already";
      else if (email) {
        if (await d.overLimit(`application-draft:email:${limiterAddressKey(emailKeyOf(email))}`, DRAFT_LIMITS.emailsPerDay, DRAFT_LIMITS.dayMs)) emailed = "limited";
        else {
          const lang: ApplicantLanguage = isApplicantLanguage(b.locale) ? b.locale : DEFAULT_APPLICANT_LANGUAGE;
          const url = `${d.siteUrl()}${resumePath(token, existing?.link ?? link)}`;
          const name = typeof b.name === "string" ? b.name.slice(0, 120) : "";
          const sent = await d.postEmail(draftLinkEmail(d, { draftId: id, email, name, roleName: role.name, village: d.projectName(), url, lang, keepDays: DRAFT_KEEP_DAYS })).catch((): PostResult => ({ status: "failed", messageId: null }));
          if (WENT.has(sent.status)) {
            emailed = "sent";
            emailedTo = email;
            await store.markEmailed(pool, id, email);
          } else emailed = "failed";
        }
      }
      const answer: DraftSaved = { token, savedAt: at.toISOString(), files: files.map(refOf), emailed, emailedTo };
      res.json(answer);
    } catch (e) {
      // Never the token, never the answers: the error alone.
      console.error("[application-drafts] a save did not go through", e instanceof Error ? e.message : "unknown");
      if (!res.headersSent) res.status(500).json({ error: DRAFT_ERRORS.invalid });
    }
  });

  app.post("/api/application-drafts/open", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (await limited(req, "open", DRAFT_LIMITS.opensPerWindow)) return res.status(429).json({ error: DRAFT_ERRORS.tooMany });
    const draft = await byToken((req.body ?? {}).token);
    if (!draft) return res.status(404).json({ error: DRAFT_ERRORS.gone });
    const answer: DraftOpened = { roleId: draft.roleId, link: draft.link, step: draft.step, savedAt: draft.updatedAt.toISOString(), draft: draft.body, files: draft.files.map(refOf) };
    res.json(answer);
  });

  app.post("/api/application-drafts/file", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (await limited(req, "file", DRAFT_LIMITS.fileReadsPerWindow)) return res.status(429).json({ error: DRAFT_ERRORS.tooMany });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const draft = await byToken(b.token);
    const file = draft ? draft.files.find((f) => f.id === b.fileId) : undefined;
    const dir = draft && file && d.fileDir ? draftFolder(d.fileDir, draft.id) : null;
    const bytes = dir && file ? await readKeptFile(dir, file) : null;
    if (!bytes || !file) return res.status(404).json({ error: DRAFT_ERRORS.gone });
    res.setHeader("Content-Type", CONTENT_TYPES[file.kind] ?? "application/octet-stream");
    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(bytes);
  });

  app.post("/api/application-drafts/discard", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (await limited(req, "open", DRAFT_LIMITS.opensPerWindow)) return res.status(429).json({ error: DRAFT_ERRORS.tooMany });
    const draft = await byToken((req.body ?? {}).token);
    if (draft) await removeDraft(d.getPool(), d.fileDir, draft.id);
    res.json({ ok: true });
  });

  registerJob(DRAFT_CLEANUP_JOB, DRAFT_CLEANUP_EVERY_MS, () => cleanupDrafts(d.getPool(), d.fileDir, d.now()));
}
