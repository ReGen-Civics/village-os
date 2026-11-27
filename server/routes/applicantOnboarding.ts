/**
 * TAKING AN APPLICANT TO A DECISION: the doors. Registered by the review's own
 * module (server/routes/applicationReview.ts), so server/index.ts keeps one line
 * for the whole feature. The rules are shared/applicantOnboarding.ts and the
 * work is server/lib/applicantOnboarding.ts.
 *
 *   GET  /api/governance/applications/:ref/walkthrough             the stage track, references and scorecards this reader may read
 *   POST /api/governance/applications/:ref/shortlist               shortlist, or not (one answer)
 *   POST /api/governance/applications/:ref/references/ask          ask the applicant for references (the letter goes once)
 *   POST /api/governance/applications/:ref/references/:id/owner    give a reference to a role or a member
 *   POST /api/governance/applications/:ref/references/:id/notes    the owner's follow-up notes
 *   POST /api/governance/applications/:ref/final-conversation      add the final conversation for the final-call role
 *   POST /api/application-status/:ref/references?token=            the applicant gives their references, by the emailed link
 *   POST /api/governance/applications/:ref/references              the same, signed in as the applicant
 *   GET  /api/governance/applications/:ref/references/mine         a member's own first-role application: asked, and a count once given
 *   POST /api/governance/applications/:ref/interviews/:id/notes    a written note, or one file, on one conversation (0444)
 *   DELETE /api/governance/applications/:ref/conversation-notes/:id         the author takes their note or file off
 *   GET  /api/governance/applications/:ref/conversation-notes/:id/file      one note's file, read again through who may read it
 *
 * THE CONVERSATIONS' NOTES ARE NEVER THE APPLICANT'S (the lead, 27 Nov 2026: "a link is sent to me and other
 * interviewers (never the applicant)"). Every notes door is a member door under /api/governance; the applicant's
 * own doors (/api/application-status/...) read none of it, and the walkthrough answers the applicant 404.
 *
 * Every member door asks the gate on `terms.read` first, as the review's own
 * doors do; who may do what past that is the power to place people in roles
 * (read through the gate, `liveHoldersOf("org.seat")`), the circle's ask, the
 * final-call role and the reference's owner (server/lib/applicantOnboarding.ts).
 *
 * NOBODY BUT PEOPLE. No door here adopts, declines or seats, and no AI reads
 * what these doors serve: no tool a companion holds reaches them
 * (server/lib/applicationReview.refusal.test.ts).
 */
import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import multer from "multer";
import { kindOfRef } from "../../shared/applicationReview";
import { ONBOARDING_WORDS } from "../../shared/applicantOnboarding";
import { isApplicant, statusByToken, type ReviewDeps } from "../lib/applicationReview";
import { addFinalConversation, answerShortlist, askForReferences, assignOwner, claimReference, giveReferences, ownReferencesFor, saveFollowUp, saveGuideNote, walkthroughFor, type GiveOutcome } from "../lib/applicantOnboarding";
import { addConversationFile, addConversationText, conversationFileFor, mayAddConversationFile, removeConversationNote } from "../lib/applicantOnboarding";
import { CONVERSATION_FILE_MAX_BYTES, CONVERSATION_NOTES_PER_HOUR, NOTES_WORDS, isConversationNoteKind, storedExtension } from "../../shared/conversationNotes";
import { CarriesLocationData, LocationDataSurvived, sanitiseForVolume } from "../lib/uploads";
import { noteFilePath, setNoteFilesDir, writeNoteFile } from "../lib/conversationNoteFiles";

const TOKEN_MAX = 300;
const MINUTE = 60_000;
const NOT_HERE = { error: "not_found", message: ONBOARDING_WORDS.notFound };

export interface OnboardingRouteDeps {
  work: ReviewDeps;
  authedUser(req: any): Promise<any | null>;
  guardCapability(req: any, res: any, capability: string, refusal?: { status: number; body: unknown }): Promise<boolean>;
  overLimit(bucket: string, max: number, windowMs: number): Promise<boolean>;
  clientIp?(req: any): string;
  /** The private folder the conversations' files live in, outside the uploads volume. Absent refuses file uploads. */
  noteFilesDir?: string;
}

export function registerApplicantOnboarding(app: Express, deps: OnboardingRouteDeps): void {
  const { work, authedUser, guardCapability, overLimit } = deps;
  setNoteFilesDir(deps.noteFilesDir ?? null);

  /** The signed-in member holding `terms.read`, or null after answering 401. */
  async function reader(req: any, res: any): Promise<any | null> {
    if (!(await guardCapability(req, res, "terms.read", { status: 401, body: { error: "auth_required" } }))) return null;
    const viewer = await authedUser(req);
    if (!viewer) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    return viewer;
  }

  const refOf = (req: any): string | null => {
    const ref = String(req.params.ref ?? "");
    return kindOfRef(ref) ? ref : null;
  };
  const idOf = (req: any): number | null => {
    const id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  /** One member act, counted per member: twenty in ten minutes. */
  async function acting(req: any, res: any, bucket: string): Promise<{ viewerId: string; ref: string } | null> {
    const viewer = await reader(req, res);
    if (!viewer) return null;
    const viewerId = String(viewer.id);
    if (await overLimit(`application-onboarding-${bucket}:${viewerId}`, 20, 10 * MINUTE)) {
      res.status(429).json({ error: "too_many" });
      return null;
    }
    const ref = refOf(req);
    if (!ref) {
      res.status(404).json(NOT_HERE);
      return null;
    }
    return { viewerId, ref };
  }

  const answer = (res: any, out: { ok: true } | { ok: false; status: number; error: string; code: string }, ok: Record<string, unknown> = {}) =>
    out.ok ? res.json({ success: true, ...ok }) : res.status(out.status).json({ error: out.code, message: out.error });

  // ── The walkthrough ───────────────────────────────────────────────────────

  app.get("/api/governance/applications/:ref/walkthrough", async (req, res) => {
    const viewer = await reader(req, res);
    if (!viewer) return;
    if (await overLimit(`application-walkthrough:${String(viewer.id)}`, 120, 10 * MINUTE)) return res.status(429).json({ error: "too_many" });
    const ref = refOf(req);
    const view = ref ? await walkthroughFor(work, ref, String(viewer.id)) : null;
    // The applicant and a stranger get the same answer: nothing is here.
    if (!view) return res.status(404).json(NOT_HERE);
    res.set("Cache-Control", "private, no-store").json({ walkthrough: view });
  });

  // ── The team's acts ───────────────────────────────────────────────────────

  app.post("/api/governance/applications/:ref/shortlist", async (req, res) => {
    const a = await acting(req, res, "shortlist");
    if (!a) return;
    const out = await answerShortlist(work, a.ref, a.viewerId, req.body?.answer);
    if (!out.ok) return answer(res, out);
    res.json({ success: true, answer: out.answer, message: out.answer === "yes" ? ONBOARDING_WORDS.shortlisted : ONBOARDING_WORDS.notShortlisted });
  });

  app.post("/api/governance/applications/:ref/references/ask", async (req, res) => {
    const a = await acting(req, res, "ask");
    if (!a) return;
    answer(res, await askForReferences(work, a.ref, a.viewerId), { message: ONBOARDING_WORDS.referencesAskedNow });
  });

  app.post("/api/governance/applications/:ref/references/:id/owner", async (req, res) => {
    const a = await acting(req, res, "owner");
    if (!a) return;
    const id = idOf(req);
    if (!id) return res.status(404).json(NOT_HERE);
    answer(res, await assignOwner(work, a.ref, a.viewerId, id, req.body), { message: ONBOARDING_WORDS.ownerSaved });
  });

  app.post("/api/governance/applications/:ref/references/:id/claim", async (req, res) => {
    const a = await acting(req, res, "claim");
    if (!a) return;
    const id = idOf(req);
    if (!id) return res.status(404).json(NOT_HERE);
    answer(res, await claimReference(work, a.ref, a.viewerId, id), { message: ONBOARDING_WORDS.claimed });
  });

  app.post("/api/governance/applications/:ref/references/:id/notes", async (req, res) => {
    const a = await acting(req, res, "notes");
    if (!a) return;
    const id = idOf(req);
    if (!id) return res.status(404).json(NOT_HERE);
    answer(res, await saveFollowUp(work, a.ref, a.viewerId, id, req.body), { message: ONBOARDING_WORDS.notesSaved });
  });

  app.post("/api/governance/applications/:ref/guide-notes", async (req, res) => {
    const a = await acting(req, res, "guide");
    if (!a) return;
    answer(res, await saveGuideNote(work, a.ref, a.viewerId, req.body), { message: ONBOARDING_WORDS.notesSaved });
  });

  app.post("/api/governance/applications/:ref/final-conversation", async (req, res) => {
    const a = await acting(req, res, "final");
    if (!a) return;
    const out = await addFinalConversation(work, a.ref, a.viewerId);
    if (!out.ok) return answer(res, out);
    res.json({ success: true, opened: out.opened, message: ONBOARDING_WORDS.finalAdded });
  });

  // ── The applicant gives their references ──────────────────────────────────

  const given = (res: any, out: GiveOutcome) =>
    out.ok ? res.json({ success: true, given: out.given }) : res.status(out.status).json({ error: out.error, ...(out.row !== null ? { row: out.row } : {}) });

  app.post("/api/application-status/:ref/references", async (req, res) => {
    const ref = refOf(req);
    const token = typeof req.query.token === "string" ? req.query.token.slice(0, TOKEN_MAX) : "";
    if (await overLimit(`application-references:${deps.clientIp ? deps.clientIp(req) : "x"}`, 10, 10 * MINUTE)) return res.status(429).json({ error: "too_many" });
    // The link proves who gives them, the way it does for the status page.
    if (!ref || !token || !(await statusByToken(work, ref, token))) return res.status(404).json(NOT_HERE);
    given(res, await giveReferences(work, ref, req.body?.references));
  });

  // A member's own application (a first long-term role): whether references are asked, a count once given. Never the details.
  app.get("/api/governance/applications/:ref/references/mine", async (req, res) => {
    const viewer = await authedUser(req);
    if (!viewer) return res.status(401).json({ error: "auth_required" });
    if (await overLimit(`application-references-mine:${String(viewer.id)}`, 120, 10 * MINUTE)) return res.status(429).json({ error: "too_many" });
    const ref = refOf(req);
    const mine = ref ? await ownReferencesFor(work, ref, String(viewer.id)) : null;
    res.set("Cache-Control", "private, no-store").json({ references: mine });
  });

  app.post("/api/governance/applications/:ref/references", async (req, res) => {
    const viewer = await authedUser(req);
    if (!viewer) return res.status(401).json({ error: "auth_required" });
    if (await overLimit(`application-references:${String(viewer.id)}`, 10, 10 * MINUTE)) return res.status(429).json({ error: "too_many" });
    const ref = refOf(req);
    if (!ref || !(await isApplicant(work, ref, String(viewer.id)))) return res.status(404).json(NOT_HERE);
    given(res, await giveReferences(work, ref, req.body?.references));
  });

  // ── The conversations' notes (0444) ───────────────────────────────────────

  /** One notes act, counted per member: sixty in an hour, across every application. */
  async function noting(req: any, res: any): Promise<{ viewerId: string; ref: string } | null> {
    const viewer = await reader(req, res);
    if (!viewer) return null;
    const viewerId = String(viewer.id);
    if (await overLimit(`application-conversation-notes:${viewerId}`, CONVERSATION_NOTES_PER_HOUR, 60 * MINUTE)) {
      res.status(429).json({ error: "too_many" });
      return null;
    }
    const ref = refOf(req);
    if (!ref) {
      res.status(404).json(NOT_HERE);
      return null;
    }
    return { viewerId, ref };
  }

  app.post("/api/governance/applications/:ref/interviews/:id/notes", async (req, res) => {
    const a = await noting(req, res);
    if (!a) return;
    const interviewId = idOf(req);
    if (!interviewId) return res.status(404).json(NOT_HERE);

    // A written note arrives as JSON.
    if (String(req.headers["content-type"] ?? "").startsWith("application/json")) {
      const out = await addConversationText(work, a.ref, a.viewerId, interviewId, req.body?.body);
      return out.ok ? res.json({ success: true, id: out.id, message: NOTES_WORDS.saved }) : answer(res, out);
    }

    // A file: who may write is asked before a byte is stored.
    const may = await mayAddConversationFile(work, a.ref, a.viewerId, interviewId);
    if (!may.ok) return answer(res, may);
    const parse = multer({ storage: multer.memoryStorage(), limits: { fileSize: CONVERSATION_FILE_MAX_BYTES, files: 1 } }).single("file");
    parse(req as any, res as any, async (err: any) => {
      if (err) return res.status(400).json({ error: "file", message: String(err?.code ?? "") === "LIMIT_FILE_SIZE" ? NOTES_WORDS.tooBig : NOTES_WORDS.wrongType });
      const file = (req as any).file;
      const kind = String((req as any).body?.kind ?? "");
      if (!file?.buffer?.length || !isConversationNoteKind(kind) || kind === "text") return res.status(400).json({ error: "file", message: NOTES_WORDS.wrongType });
      const originalName = String(file.originalname ?? "").slice(0, 255);
      const ext = storedExtension(kind, originalName);
      if (!ext) return res.status(400).json({ error: "file", message: NOTES_WORDS.wrongType });
      let stored: string;
      try {
        // Through the strip: a picture loses its location data, a PDF holding a geotagged photo is refused.
        const clean = await sanitiseForVolume(file.buffer, originalName);
        stored = writeNoteFile(clean.bytes, clean.kind === "image" || clean.kind === "pdf" ? clean.ext || ext : ext);
      } catch (e: any) {
        if (e instanceof CarriesLocationData) return res.status(400).json({ error: "file", message: e.message });
        if (e instanceof LocationDataSurvived) return res.status(400).json({ error: "file", message: NOTES_WORDS.wrongType });
        return res.status(400).json({ error: "file", message: NOTES_WORDS.wrongType });
      }
      const out = await addConversationFile(work, a.ref, a.viewerId, interviewId, { kind, fileName: stored, originalName });
      if (!out.ok) {
        const p = noteFilePath(stored);
        if (p) fs.promises.unlink(p).catch(() => undefined);
        return answer(res, out);
      }
      res.json({ success: true, id: out.id, message: NOTES_WORDS.saved });
    });
  });

  app.delete("/api/governance/applications/:ref/conversation-notes/:id", async (req, res) => {
    const a = await noting(req, res);
    if (!a) return;
    const id = idOf(req);
    if (!id) return res.status(404).json(NOT_HERE);
    answer(res, await removeConversationNote(work, a.ref, a.viewerId, id), { message: NOTES_WORDS.removed });
  });

  app.get("/api/governance/applications/:ref/conversation-notes/:id/file", async (req, res) => {
    const viewer = await reader(req, res);
    if (!viewer) return;
    if (await overLimit(`application-conversation-file:${String(viewer.id)}`, 120, 10 * MINUTE)) return res.status(429).json({ error: "too_many" });
    const ref = refOf(req);
    const id = idOf(req);
    // Anybody who may not read this conversation gets the same 404 as a stranger, the applicant included.
    const file = ref && id ? await conversationFileFor(work, ref, String(viewer.id), id) : null;
    const where = file ? noteFilePath(file.fileName) : null;
    if (!file || !where || !fs.existsSync(where)) return res.status(404).json(NOT_HERE);
    const safeName = path.basename(file.originalName).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Content-Disposition", `attachment; filename="${safeName}"`);
    res.type("application/octet-stream");
    fs.createReadStream(where).pipe(res);
  });
}
