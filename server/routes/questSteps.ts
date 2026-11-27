/**
 * THE QUEST CARD, PART 2 (the lead, 27 Nov 2026): taking back work turned in,
 * a submission for each step, and the quests suited to a member's roles.
 *
 *   take back   POST   /api/game/quests/:id/pull-back
 *   steps       GET    /api/game/quests/:id/steps
 *               POST   /api/game/quests/:id/steps/:index
 *               DELETE /api/game/quests/:id/steps/submissions/:submissionId
 *   admin       PUT    /api/admin/quests/:id/step-needs
 *   suited      GET    /api/game/quests/suited
 *
 * Registered from server/routes/quests.ts, so the order beside the claim and
 * submit routes is fixed in one place. None of these paths is a parameter
 * twin of another: `suited` is a literal under /api/game/quests, and no GET
 * on /api/game/quests/:id exists to read it as an id.
 *
 * NOTHING HERE MOVES VALUE. Taking work back is refused once a steward has
 * consented it, because consent pays in the same commit (`consentOnce`). A
 * step submission is evidence for the steward to read; the human gate that
 * releases value is still the consent route and only that.
 */
import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import multer from "multer";
import type { ClaimRecord, ClaimsRepo, QuestRecord, QuestsRepo } from "../repos/quests";
import { setQuestStepNeeds } from "../repos/quests";
import {
  addStepSubmission,
  isStepSubmissionKind,
  removeStepSubmission,
  stepSubmissionsForClaim,
  type StepSubmission,
} from "../repos/questStepSubmissions";
import { readStepNeeds } from "../../shared/questStepNeeds";
import { CarriesLocationData, LocationDataSurvived, sanitiseForVolume, stampedName, writeToVolume } from "../lib/uploads";
import { EXAMPLE_REFUSAL_BODY, isExampleRow } from "../lib/examples";
import { recordEvent } from "../lib/events";
import { circleForQuestName } from "../lib/questNextStep";
import { listOrgAssignments, listOrgRoles, type LapseContext } from "../lib/orgChart";
import { questClosed } from "../repos/quests";
import type { Pool } from "mysql2/promise";

/** The most one step file may weigh. A phone photo is a few MB; a scanned document fits. */
export const MAX_STEP_FILE_BYTES = 15 * 1024 * 1024;
/** The most words one text submission may carry. */
export const MAX_STEP_TEXT = 4000;
/** How many pieces a member may add per hour, across every step of every quest. */
const STEP_ADDS_PER_HOUR = 60;

export interface QuestStepDeps {
  authedUser(req: any): Promise<{ id: string; name: string } | null>;
  isAdmin(req: any): Promise<boolean>;
  adminActor(req: any): { id: string } | null;
  getPool(): Pool;
  uploadsDir: string;
  questsRepo: QuestsRepo;
  claimsRepo: ClaimsRepo;
  overLimit(bucket: string, max: number, windowMs: number): Promise<boolean>;
  notify(n: { userId: string; type: string; title: string; body: string; link: string; dedupeKey: string; actorUserId?: string }): Promise<unknown>;
  questConsentRecipients(): Promise<string[]>;
  firstName(name: string): string;
  roleIdsFor(userId: string): string[];
  /** The circles, for a quest's free-text circle; absent, the suited list matches on role gates alone. */
  circles?: () => Array<{ id: string; name?: string; aliases?: string[] }>;
  lapseContext?: () => LapseContext;
}

/** The member's open claim on a quest, or null. */
export function openClaimOn(mine: readonly ClaimRecord[], questId: string): ClaimRecord | null {
  return mine.find((c) => c.questId === questId && (c.status === "claimed" || c.status === "submitted")) ?? null;
}

/** Unlink a step file. Never throws: a file left over is the uploads sweep's to find. */
export function forgetStepFile(uploadsDir: string, fileName: string | null | undefined): void {
  const name = String(fileName ?? "").trim();
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return;
  try {
    fs.unlinkSync(path.join(uploadsDir, name));
  } catch {
    /* already gone, or never written */
  }
}

/** A submission as the member and the steward read it: the file as its address, never a path. */
export function stepSubmissionView(s: StepSubmission) {
  return {
    id: s.id,
    stepIndex: s.stepIndex,
    kind: s.kind,
    body: s.body,
    fileUrl: s.fileName ? `/api/uploads/${encodeURIComponent(s.fileName)}` : null,
    originalName: s.originalName,
    createdAt: s.createdAt,
  };
}

export function register(app: Express, deps: QuestStepDeps): void {
  const { authedUser, isAdmin, adminActor, getPool, uploadsDir, questsRepo, claimsRepo, overLimit, notify, questConsentRecipients, firstName } = deps;

  /**
   * TAKE BACK WORK TURNED IN, until it is paid (the lead, 27 Nov 2026: "Until
   * it's paid, yes"). `submitted` becomes `claimed` and keeps everything the
   * member gave, so they change it and turn it in again. It leaves the
   * steward's queue by that alone: the queue lists `submitted` claims.
   *
   * WHO IS TOLD. Every steward the turn-in rang, the same list the submit
   * sweep reads, so nobody opens /review for work that is no longer there.
   * The key carries the claim and the turn-in it takes back (`submittedAt`),
   * so each take-back rings once and a later one rings again.
   */
  app.post("/api/game/quests/:id/pull-back", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const mine = await claimsRepo.forUser(user.id);
    const held = openClaimOn(mine, req.params.id);
    if (!held) {
      // A consented claim is approved and paid in one commit, so it says so; anything else holds nothing.
      if (mine.some((c) => c.questId === req.params.id && c.status === "consented")) {
        return res.status(409).json({ error: "This work was approved and paid, so it cannot be taken back.", status: "consented" });
      }
      return res.status(404).json({ error: "No claim of yours on this quest" });
    }
    // Already in hand: the member's intent is satisfied, and nobody is rung.
    if (held.status === "claimed") return res.json({ ok: true, status: "claimed", already: true });
    const moved = await claimsRepo.pullBackOnce(held.id);
    if (!moved.ok) {
      if (moved.reason === "missing") return res.status(404).json({ error: "No claim of yours on this quest" });
      return res.status(409).json({
        error: moved.status === "consented"
          ? "This work was approved and paid, so it cannot be taken back."
          : `This claim was already ${moved.status}, so nothing was changed.`,
        status: moved.status,
      });
    }
    const title = String(held.questTitle ?? "a quest");
    const turnIn = String(held.submittedAt ?? "");
    try {
      for (const recipientId of await questConsentRecipients()) {
        if (recipientId === user.id) continue;
        try {
          await notify({
            userId: recipientId,
            type: "quest_pulled_back",
            title: `${firstName(user.name)} took back their work on ${title}`,
            body: "It left the review queue. They will turn it in again when it is ready.",
            link: "/review",
            dedupeKey: `quest-pullback:${held.id}:${turnIn}:${recipientId}`,
            actorUserId: user.id,
          });
        } catch (bell) {
          console.error(`[quests] claim ${held.id}: the take-back notice for ${recipientId} did not send`, bell);
        }
      }
    } catch (who) {
      console.error(`[quests] claim ${held.id}: could not read who to tell about the take-back`, who);
    }
    res.json({ ok: true, status: "claimed", claim: moved.claim });
  });

  /** The member's own step submissions on their open claim, with which steps need one. */
  app.get("/api/game/quests/:id/steps", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const quest = await questsRepo.byId(req.params.id);
    if (!quest) return res.status(404).json({ error: "Quest not found" });
    const claim = openClaimOn(await claimsRepo.forUser(user.id), quest.id);
    const stepNeeds = readStepNeeds(quest.stepNeeds, (quest.steps ?? []).length);
    if (!claim) return res.json({ stepNeeds, claimId: null, submissions: [] });
    const rows = await stepSubmissionsForClaim(getPool(), claim.id);
    res.json({ stepNeeds, claimId: claim.id, submissions: rows.map(stepSubmissionView) });
  });

  /**
   * ADD TO ONE STEP: words as JSON (`{ kind: "text", body }`), or one file as
   * multipart (`file`, with `kind` photo or document). Only while the claim is
   * `claimed`: work turned in is the steward's to read, and changing it means
   * taking it back first. A file goes through the strip like every other door.
   */
  app.post("/api/game/quests/:id/steps/:index", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    if (await overLimit(`quest-step-add:${user.id}`, STEP_ADDS_PER_HOUR, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "That is a lot at once. Wait a little and add the rest." });
    }
    const quest: QuestRecord | null = await questsRepo.byId(req.params.id);
    if (!quest) return res.status(404).json({ error: "Quest not found" });
    if (await isExampleRow(getPool(), "quests", quest.id)) return res.status(409).json(EXAMPLE_REFUSAL_BODY);
    const index = Number(req.params.index);
    const steps = quest.steps ?? [];
    if (!Number.isInteger(index) || index < 0 || index >= steps.length) return res.status(400).json({ error: "That step is not on this quest." });
    const claim = openClaimOn(await claimsRepo.forUser(user.id), quest.id);
    if (!claim) return res.status(404).json({ error: "No active claim for this quest" });
    if (claim.status !== "claimed") {
      return res.status(409).json({ error: "You turned this in. Take it back first to change a step.", status: claim.status });
    }
    const base = { claimId: claim.id, questId: quest.id, userId: user.id, stepIndex: index };
    const id = `qss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (String(req.headers["content-type"] ?? "").startsWith("application/json")) {
      const body = String(req.body?.body ?? "").trim();
      if (!body) return res.status(400).json({ error: "Write a few words first." });
      if (body.length > MAX_STEP_TEXT) return res.status(400).json({ error: `Keep it under ${MAX_STEP_TEXT} characters.` });
      const row = await addStepSubmission(getPool(), { ...base, id, kind: "text", body, fileName: null, originalName: null });
      return res.json({ submission: stepSubmissionView(row) });
    }

    const parse = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_STEP_FILE_BYTES, files: 1 },
    }).single("file");
    parse(req as any, res as any, async (err: any) => {
      if (err) {
        const tooBig = String(err?.code ?? "") === "LIMIT_FILE_SIZE";
        return res.status(400).json({
          error: tooBig ? `That file is over ${Math.round(MAX_STEP_FILE_BYTES / (1024 * 1024))} MB. Send a smaller one.` : "That file did not arrive.",
        });
      }
      const file = (req as any).file;
      if (!file?.buffer?.length) return res.status(400).json({ error: "Choose a file first." });
      const kind = String((req as any).body?.kind ?? "");
      if (!isStepSubmissionKind(kind) || kind === "text") return res.status(400).json({ error: "Say whether it is a photo or a document." });
      try {
        const clean = await sanitiseForVolume(file.buffer, String(file.originalname ?? ""));
        if (kind === "photo" && clean.kind !== "image") return res.status(400).json({ error: "That is not a picture. Add it as a document." });
        if (kind === "document" && clean.kind !== "pdf" && clean.kind !== "image") {
          return res.status(400).json({ error: "Send a PDF or a picture of the page." });
        }
        const fileName = stampedName("queststep", clean.ext || ".bin");
        writeToVolume(uploadsDir, fileName, clean.bytes);
        const originalName = String(file.originalname ?? "").slice(0, 255) || null;
        const row = await addStepSubmission(getPool(), { ...base, id, kind, body: null, fileName, originalName });
        return res.json({ submission: stepSubmissionView(row) });
      } catch (e: any) {
        if (e instanceof CarriesLocationData) return res.status(400).json({ error: e.message });
        if (e instanceof LocationDataSurvived) {
          return res.status(400).json({ error: "That file kept its hidden data through the strip, so it was not stored. Try another." });
        }
        console.error(`[quests] claim ${claim.id}: a step file was not stored`, e);
        return res.status(400).json({ error: "That file could not be read. Try a JPEG, PNG or PDF." });
      }
    });
  });

  /** Take one piece off a step, while the claim is still in hand. Its file comes off the volume. */
  app.delete("/api/game/quests/:id/steps/submissions/:submissionId", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const claim = openClaimOn(await claimsRepo.forUser(user.id), req.params.id);
    if (!claim) return res.status(404).json({ error: "No active claim for this quest" });
    if (claim.status !== "claimed") {
      return res.status(409).json({ error: "You turned this in. Take it back first to change a step.", status: claim.status });
    }
    const gone = await removeStepSubmission(getPool(), req.params.submissionId, claim.id, user.id);
    if (!gone) return res.status(404).json({ error: "Not found" });
    forgetStepFile(uploadsDir, gone.fileName);
    res.json({ ok: true, id: gone.id });
  });

  /**
   * WHICH STEPS NEED A SUBMISSION, set by the hands that edit the quest. Its
   * own write, like the roots and the thread, so it never rides an unrelated
   * edit. One boolean per step; a list with none true clears it.
   */
  app.put("/api/admin/quests/:id/step-needs", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const id = String(req.params.id);
    if (await isExampleRow(getPool(), "quests", id)) return res.status(409).json(EXAMPLE_REFUSAL_BODY);
    const quest = await questsRepo.byId(id);
    if (!quest) return res.status(404).json({ error: "Not found" });
    if (!Array.isArray(req.body?.stepNeeds)) return res.status(400).json({ error: "stepNeeds must be a list", field: "stepNeeds" });
    const needs = readStepNeeds(req.body.stepNeeds, (quest.steps ?? []).length);
    if (!(await setQuestStepNeeds(getPool(), id, needs))) return res.status(404).json({ error: "Not found" });
    const actor = (await authedUser(req))?.id ?? adminActor(req)?.id ?? null;
    await recordEvent(getPool(), {
      kind: "audit", text: `quest:step-needs:${id}`, actorUserId: actor,
      entityType: "quest", entityRef: id, audience: "admin",
    });
    res.json({ id, stepNeeds: needs });
  });

  /**
   * THE QUESTS SUITED TO THE MEMBER'S ROLES (the lead, 27 Nov 2026: "any that
   * are suited for that role"). Open, real quests the member does not already
   * hold, where either:
   *
   *   - the quest's role gate (`requires_role`) is a role the member holds, in
   *     the roles plane or as a live org seat; or
   *   - the quest's circle is a circle one of the member's live org seats sits
   *     in, matched by the same alias rule the next-step box uses.
   *
   * Those are the only two links between a quest and a role in the schema.
   * A quest names no owner role, so nothing else is matched, and a member
   * whose roles no quest names gets an empty list, never a guess.
   */
  app.get("/api/game/quests/suited", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const pool = getPool();
    const roleIds = new Set(deps.roleIdsFor(user.id));
    const circleIds = new Set<string>();
    if (deps.lapseContext) {
      try {
        const [roles, seatings] = await Promise.all([listOrgRoles(pool), listOrgAssignments(pool, deps.lapseContext())]);
        const byId = new Map(roles.map((r) => [r.id, r]));
        for (const s of seatings) {
          if (s.userId !== user.id || s.holderKind !== "member" || s.lapsed) continue;
          roleIds.add(s.orgRoleId);
          const circleId = byId.get(s.orgRoleId)?.circleId;
          if (circleId) circleIds.add(circleId);
        }
      } catch (err) {
        console.error("[quests] suited: the org roles held could not be read", err);
      }
    }
    const circles = deps.circles?.() ?? [];
    const held = new Set((await claimsRepo.forUser(user.id)).filter((c) => c.status === "claimed" || c.status === "submitted").map((c) => c.questId));
    const quests = (await questsRepo.all()).filter((q) => !q.isExample && !questClosed(q.status) && !held.has(q.id));
    const suited = quests.flatMap((q): Array<{ q: QuestRecord; why: "role" | "circle" }> => {
      if (q.requiresRole && roleIds.has(q.requiresRole)) return [{ q, why: "role" }];
      const circle = circleForQuestName(circles, q.circle);
      if (circle && circleIds.has(circle.id)) return [{ q, why: "circle" }];
      return [];
    });
    res.json({
      quests: suited.slice(0, 24).map(({ q, why }) => ({ id: q.id, title: q.title, circle: q.circle ?? null, why })),
      matchedOn: { roles: roleIds.size, circles: circleIds.size },
    });
  });
}
