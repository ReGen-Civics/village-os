/**
 * PROPOSED CHANGES, over HTTP (the lead, 11 Nov 2026; shared/proposedChanges.ts).
 *
 * Proposing (the connector's `propose_changes`, as the token's holder, or a person):
 *   POST /api/admin/proposals            one change or a batch; refused whole, with a reason per item, when any is broken
 *   GET  /api/admin/proposals/lessons    what people changed before accepting, grouped by kind and field
 *   GET  /api/admin/proposals/queue      the queue, redacted: batch, id, kind, sentence, state, and whether you filed it
 *   GET  /api/admin/proposals/seat-terms a role's terms as words: the wordings, the commitment, the names of groups set
 *   POST /api/admin/proposals/discard-mine  put aside changes the caller filed through the connector, while they wait
 *
 * Reviewing (a person, on /admin/proposals):
 *   GET  /api/admin/proposals            everything waiting, by batch, each beside what is live now
 *   GET  /api/admin/proposals/count      how many wait, for Admin's link
 *   PUT  /api/admin/proposals/:id/draft  the person's edits, saved as they type
 *   POST /api/admin/proposals/check      the dry run: each edited change read by its own validator, nothing written
 *   POST /api/admin/proposals/accept     accept a selection, in order, each through its own route AS THE PERSON
 *   POST /api/admin/proposals/discard    put a selection aside
 *   POST /api/admin/proposals/accept-as-holder  the full-access agent's accept or discard, through the connector only
 *   POST /api/admin/proposals/:id/put-back  file a NEW proposal that puts an accepted change back; applies nothing
 *
 * ACCEPTING IS A PERSON'S ACT. Each change runs over the loopback with the
 * accepting person's own authorization, so the one capability gate and the
 * route's own validator answer for them, exactly as the app's own editor
 * would. One that fails does not undo the others: each lands or fails on its
 * own and the answer says which. An agent account, or any call that came
 * through the connector, is refused at accept and discard, and
 * `ALWAYS_A_PERSON` (shared/agentAdmin.ts) keeps these paths off the agent
 * paths list whatever an admin writes there.
 *
 * PUTTING IT BACK. Just before each change is applied, what is live is read the
 * way the page reads it (`liveOf`) and kept on the change (0400). A failed read
 * keeps null and the accept goes on. "Propose putting it back" files a new
 * proposal, same kind and target, carrying what was live before and marked as
 * putting back the original; a person accepts it here like any other
 * (shared/proposalPutBack.ts says where it is never offered, and why).
 *
 * OLDER WORDS (the lead, 17 Nov 2026). Each waiting change is served with the accepts made since it was proposed
 * that wrote what it writes (`staleAgainst`, shared/proposalConflicts.ts): it was drafted against an older live
 * value. The accept reads that again for each change as it runs and answers it beside the result, so the page's
 * warning is never itself out of date. It never stops or rejects an accept.
 *
 * WHO OPENS THE PAGE. An admin, or a live holder of a power these changes need
 * (story.tell, org.decide, org.seat, dial.set), the way the approval inbox
 * reads. The route behind each change still decides whether this person may
 * make it.
 */
import type express from "express";
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { recordEvent } from "../lib/events";
import { isAgentAccount } from "../repos/agentAccounts";
import { applyProposal, checkProposal, labelsFor, liveOf, NEW_ROLE_ALREADY_MADE, newRoleAlreadyMade, readBefore, routeExistsIn, whereOf, type KindDeps, type Run } from "../lib/proposedChanges";
import * as store from "../repos/proposedChanges";
import {
  ACCEPT_NOTE,
  fieldDiffs,
  KIND_ALIASES,
  type KindAlias,
  groupLessons,
  PROPOSAL_LIMITS,
  readProposalInput,
  REVIEW_WORDS,
  type Lesson,
  type ProposalInput,
} from "../../shared/proposedChanges";
import { APPROVAL_FIELDS, readLeadApproval } from "../../shared/agentAdmin";
import { ACCEPT_PROPOSAL_WORDS, approvalCovers, FULL_ACCESS_WORDS, fullAccessFloor } from "../../shared/agentFullAccess";
import { fullAccessFor } from "../lib/agentFullAccess";
import { putBackOf, putBackVerdict, type PutBackVerdict } from "../../shared/proposalPutBack";
import { footprintOf, overlaps, staleAgainst, staleVersionOf, type AcceptedRecord, type StaleBy } from "../../shared/proposalConflicts";
import { queueItemOf, QUEUE_WORDS } from "../../shared/proposalQueue";
import { capabilityDecision } from "../../shared/capabilities";
import { readsAsPlainMember } from "../lib/readAsMember";
import { seatTermsRead } from "../../shared/seatTermsProposal";
import { listOrgRoles } from "../lib/orgChart";
import { recordChangeOutcome, recordStagedOutcome } from "../lib/suggestionOutcome";
import { closeStaged, closeStagedForChange, heldOf, markPublished, releaseReconsider, stagedById, type StagedRow } from "../repos/suggestionStaging";
import { afterRelease, HELD_FOR_FILER, readReconsider, sameAsLive, stageAndSort, type Filing } from "../lib/connectorStaging";
import { GUIDE_DRAFT_HEADER, isGuideDraft } from "../lib/guideFiling";

type Deps = Pick<AppDeps, "authedUser" | "getPool" | "isAdmin" | "overLimit" | "members" | "contentRepo" | "faqsRepo" | "seasonState" | "capabilityCtx"> & {
  liveHoldersOf: (capability: string) => Promise<string[]>;
  port: () => number;
  clientIp: (req: express.Request) => string;
};


/** The role routes a `setting` may name, whose bodies can carry a role's pay or terms. */
const ROLE_ROUTE = /^\/api\/admin\/org\/roles(\/|$)/;
const ROLE_PAY_KEYS = ["pay", "termsOffer", "terms_offer", "valueMinor", "value_minor", "valueTokens", "value_tokens", "cashMinor", "cash_minor", "cashCurrency", "cash_currency", "valueCurrency", "value_currency"];

/** The keys of a change's body that carry pay or terms: a role card's pay group, and a role route's pay fields. */
export function payKeysOf(kind: string, target: Record<string, unknown>): readonly string[] {
  if (kind === "role_card") return ["pay"];
  if (kind === "setting" && ROLE_ROUTE.test(String(target.path ?? ""))) return ROLE_PAY_KEYS;
  return [];
}

/** A copy of a body without its pay and terms keys, and whether it had any. */
export function withoutPay(keys: readonly string[], v: unknown): { value: unknown; had: boolean } {
  if (!keys.length || !v || typeof v !== "object" || Array.isArray(v)) return { value: v, had: false };
  const o = v as Record<string, unknown>;
  if (!keys.some((k) => k in o)) return { value: v, had: false };
  return { value: Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k))), had: true };
}

/** What a reader who may not read pay saves or accepts: their words, with the stored pay and terms put back exactly. */
export function keepStoredPay(keys: readonly string[], sent: Record<string, unknown>, stored: Record<string, unknown>): Record<string, unknown> {
  if (!keys.length) return sent;
  const out: Record<string, unknown> = Object.fromEntries(Object.entries(sent).filter(([k]) => !keys.includes(k)));
  for (const k of keys) if (k in stored) out[k] = stored[k];
  return out;
}

/** An accepted change as the conflict rules read it: what went live, and when. */
const acceptedRecord = (c: store.StoredChange): AcceptedRecord => ({
  id: c.id,
  kind: c.kind,
  target: c.target,
  route: { method: c.routeMethod, path: c.routePath },
  body: c.accepted ?? c.body,
  summary: c.summary,
  decidedAt: c.decidedAt ?? "",
});

/** The accepts since this change was proposed that wrote what it writes (shared/proposalConflicts.ts). */
const staleOf = (c: store.StoredChange, body: Record<string, unknown>, accepted: readonly AcceptedRecord[]): StaleBy[] =>
  staleAgainst({ id: c.id, at: c.createdAt, kind: c.kind, target: c.target, route: { method: c.routeMethod, path: c.routePath }, body }, accepted);

/**
 * The other waiting changes that write what this one would write, with the body each would be accepted with (the
 * person's saved edits when there are any). These are the options a person chooses between.
 */
async function waitingRivals(pool: Parameters<typeof store.listOpen>[0], c: store.StoredChange, body: Record<string, unknown>): Promise<store.StoredChange[]> {
  const mine = footprintOf(c.kind, c.target, { method: c.routeMethod, path: c.routePath }, body);
  if (!mine) return [];
  const { changes } = await store.listOpen(pool);
  return changes.filter((o) => o.id !== c.id && overlaps(mine, footprintOf(o.kind, o.target, { method: o.routeMethod, path: o.routePath }, o.draft ?? o.body)));
}

/** The powers whose holders open the page besides an admin. */
const READERS = ["story.tell", "org.decide", "org.seat", "dial.set"] as const;
const WINDOW = 10 * 60_000;
const firstName = (name: unknown) => String(name ?? "").trim().split(/\s+/)[0] || "Someone";
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const withoutApproval = (b: Record<string, unknown>) => Object.fromEntries(Object.entries(b).filter(([k]) => !(APPROVAL_FIELDS as readonly string[]).includes(k)));

/** Why a change cannot be proposed back, in words for a caller that is not the page (the page has its own). */
const PUT_BACK_REFUSED: Record<import("../../shared/proposalPutBack").PutBackBlock, string> = {
  not_accepted: "Only an accepted change can be proposed back.",
  not_kept: "What was live before this change was not kept, so there is nothing to put back. Changes accepted from now on keep it.",
  unread: "What was live before this change could not be read when it was accepted, so there is nothing to put back.",
  made_new: "This change made something new. Taking it away is its own change, on its own page.",
  took_away: "This change took something away. Making it again is its own change, on its own page.",
  goal_links: "A season's goals carry links to quests and moon items, which putting the list back could cut. Change the goals in Admin, Season.",
  added_fields: "This change set fields that were not there before, and putting it back cannot take them away. Change them on the page itself.",
  already_waiting: "A proposal putting this change back is already waiting on the review page.",
};

export function register(app: Express, deps: Deps): void {
  const { authedUser, getPool, isAdmin, overLimit, members, liveHoldersOf, port, clientIp } = deps;

  /**
   * PAY FOLLOWS THE READER'S RIGHT TO READ TERMS (the coordinator, 26 Nov 2026). This page is open to holders of
   * story.tell, org.decide, org.seat and dial.set, none of which is `terms.read`, and a role card change that carries
   * pay was served with the role's LIVE pay group beside the proposed one. For a reader without `terms.read` the pay is
   * taken out of what is live, what was proposed, the draft and what was accepted, and the change says only that its
   * pay changes (`payHidden`). Such a reader also cannot drop or set pay by accident: what they save or accept keeps
   * the pay that was stored (`keepStoredPay`).
   */
  const readsPay = async (req: express.Request): Promise<boolean> => {
    if (readsAsPlainMember(req)) return false;
    // Fails closed: with no gate to ask (a harness that wires none), nobody reads pay, and stored pay is kept.
    if (typeof deps.capabilityCtx !== "function") return false;
    const user = await authedUser(req);
    return !!user && capabilityDecision("terms.read", await deps.capabilityCtx(user)).allowed;
  };
  const routeExists = routeExistsIn(app);
  const kindDeps = (): KindDeps => ({
    pool: getPool(),
    content: () => (deps.contentRepo.get() ?? {}) as Record<string, unknown>,
    faqs: () => (deps.faqsRepo.get() ?? {}) as unknown as ReturnType<KindDeps["faqs"]>,
    seasons: () => (deps.seasonState().seasons ?? []) as ReturnType<KindDeps["seasons"]>,
    routeExists,
  });

  /**
   * The key a decision is recorded under (suggestion_outcomes names a capability, never a person): `admin` when an
   * admin reads the page as one, otherwise the first reader key the person holds live, the same order `reader` asks.
   */
  async function decidingKey(req: express.Request, uid: string): Promise<string> {
    if (await isAdmin(req)) return "admin";
    for (const cap of READERS) if ((await liveHoldersOf(cap)).includes(uid)) return cap;
    return "unknown";
  }

  /** The signed-in member who may open the page, or null after answering. */
  async function reader(req: express.Request, res: express.Response): Promise<any | null> {
    const user = await authedUser(req);
    if (!user) {
      res.status(401).json({ error: "auth_required", message: "Sign in first." });
      return null;
    }
    if (await isAdmin(req)) return user;
    const uid = String(user.id);
    for (const cap of READERS) if ((await liveHoldersOf(cap)).includes(uid)) return user;
    res.status(403).json({ error: "not_a_reader", message: REVIEW_WORDS.notReader });
    return null;
  }

  /** A reader who is a person and did not come through the connector, or null after answering 403. */
  async function person(req: express.Request, res: express.Response): Promise<any | null> {
    if (req.get("x-village-connector")) {
      res.status(403).json({ error: "person_only", message: REVIEW_WORDS.personOnly });
      return null;
    }
    const user = await reader(req, res);
    if (!user) return null;
    if (await isAgentAccount(getPool(), String(user.id))) {
      res.status(403).json({ error: "person_only", message: REVIEW_WORDS.personOnly });
      return null;
    }
    return user;
  }

  /** Run a route as the person in this request, over the loopback, and read its JSON. */
  const runAs = (req: express.Request): Run => async (method, path, body) => {
    if (!path.startsWith("/api/") || path.startsWith("/api/agent/")) return { status: 400, body: { error: "not a route a proposal may call" } };
    const r = await fetch(`http://127.0.0.1:${port()}${path}`, { // module-review-ok: the loopback to this same process, run as the person who pressed Accept, never an outside host
      method,
      headers: {
        authorization: String(req.headers.authorization ?? ""),
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(clientIp(req) ? { "x-forwarded-for": clientIp(req) } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    const text = await r.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { error: "The route did not answer with JSON." };
    }
    return { status: r.status, body: parsed };
  };

  // ── Proposing ──────────────────────────────────────────────────────────────

  app.post("/api/admin/proposals", async (req, res) => {
    const user = await reader(req, res);
    if (!user) return;
    const uid = String(user.id);
    if (await overLimit(`proposals-file:${uid}`, 60, WINDOW)) return res.status(429).json({ error: "too_many", message: "That is a lot of proposals in a few minutes. Wait a little." });
    const raw = obj(req.body) ?? {};
    const list: unknown[] = Array.isArray(raw.items) ? raw.items : [raw];
    if (!list.length) return res.status(400).json({ error: "refused", message: "Send items: a list of proposals, or one proposal." });
    if (list.length > PROPOSAL_LIMITS.items) return res.status(400).json({ error: "refused", message: `A batch holds ${PROPOSAL_LIMITS.items} proposals at most.` });
    const pool = getPool();
    const batchArg = raw.batch;
    const batchId = typeof raw.batchId === "string" ? raw.batchId : null;
    const title = (typeof batchArg === "string" ? batchArg : typeof obj(batchArg)?.title === "string" ? String(obj(batchArg)!.title) : "").replace(/\s+/g, " ").trim();
    if (!batchId && title.length < 2) return res.status(400).json({ error: "refused", message: "Name the batch: batch, a short title such as Phase A content." });
    if (title.length > PROPOSAL_LIMITS.title) return res.status(400).json({ error: "refused", message: `Keep the batch title under ${PROPOSAL_LIMITS.title} characters.` });
    if (batchId && !(await store.batchById(pool, batchId))) return res.status(404).json({ error: "not_found", message: "There is no batch by that id." });

    // Every item is read and checked before any is filed: a batch is filed whole or not at all.
    const kd = kindDeps();
    const ready: Array<{ p: ProposalInput; label: string; method: string; path: string }> = [];
    const refused: Array<{ index: number; error: string; field?: string; code?: string }> = [];
    for (let i = 0; i < list.length; i++) {
      const read = readProposalInput(list[i]);
      if (!read.ok) {
        refused.push({ index: i, error: read.error });
        continue;
      }
      const p = { ...read.value, body: withoutApproval(read.value.body) };
      const checked = await checkProposal(kd, p);
      if (!checked.ok) refused.push({ index: i, error: checked.error, ...(checked.field ? { field: checked.field } : {}), ...(checked.code ? { code: checked.code } : {}) });
      else ready.push({ p, label: checked.label, method: checked.method, path: checked.path });
    }
    if (refused.length) {
      return res.status(400).json({ error: "refused", message: `Nothing was filed. ${refused.length} of ${list.length} cannot be proposed as sent.`, refused });
    }
    // An agent account or the connector first. Then the guide's draft, sent to review by this person from the dock:
    // only this process can make that mark (server/lib/guideFiling.ts), so no outside caller files as the guide.
    const kind = (await isAgentAccount(pool, uid)) || req.get("x-village-connector") ? "agent" : isGuideDraft(req.get(GUIDE_DRAFT_HEADER)) ? "guide" : "person";
    // Staged and read by the engine first (server/lib/connectorStaging.ts): what is held waits in Held with its reason,
    // what already waits is answered with that change, and only the rest becomes a proposed change.
    const now = new Date();
    const run = runAs(req);
    const filings: Filing[] = ready.map((r, i) => ({ kind: r.p.kind, target: r.p.target, body: r.p.body, summary: r.p.summary, reconsider: readReconsider(obj(list[i])?.reconsider) }));
    const isLive = async (f: Filing) => {
      try {
        return sameAsLive(await liveOf(kd, run, f.kind, f.target, f.body), f.body);
      } catch {
        return false;
      }
    };
    const sorted = await stageAndSort({ pool, now, isLive }, filings, uid, kind === "agent" ? "agent" : "member");
    const going = sorted.filter((x) => x.to === "publish");
    const bid = going.length ? batchId ?? (await store.addBatch(pool, { title, proposedBy: uid, proposedByKind: kind })) : batchId;
    let position = bid ? await store.nextPosition(pool, bid) : 0;
    const ids: string[] = [];
    for (const x of going) {
      const r = ready[x.index]!;
      const id = await store.addChange(pool, {
        batchId: bid!, position: position++, kind: r.p.kind, target: r.p.target, targetLabel: r.label, routeMethod: r.method, routePath: r.path,
        summary: r.p.summary, body: r.p.body, proposedBy: uid, proposedByKind: kind,
      });
      await markPublished(pool, x.stagedId, id, now);
      ids.push(id);
    }
    const held = sorted.flatMap((x) => (x.to === "held" ? [{ index: x.index, code: x.code, fields: x.fields, words: HELD_FOR_FILER[x.code] }] : []));
    const waiting = await Promise.all(
      sorted.flatMap((x) => (x.to === "waiting" ? [x] : [])).map(async (x) => ({ index: x.index, id: x.changeId, code: x.changeId ? (await store.changeById(pool, x.changeId))?.code ?? null : null })),
    );
    if (ids.length && bid) {
      await recordEvent(pool, {
        kind: "proposed_change",
        text: `${ids.length} change${ids.length === 1 ? "" : "s"} proposed for review${title ? `: ${title.slice(0, 120)}` : ""}`,
        actorUserId: uid,
        actorKind: kind === "agent" ? "agent" : "human",
        entityType: "proposed_change_batch",
        entityRef: bid,
        audience: "admin",
      });
    }
    if (held.length) {
      await recordEvent(pool, { kind: "proposed_change", text: `${held.length} proposed change${held.length === 1 ? " was" : "s were"} held before review`, actorUserId: uid, actorKind: kind === "agent" ? "agent" : "human", entityType: "suggestion_staging", entityRef: sorted.find((x) => x.to === "held")!.stagedId, audience: "admin" });
    }
    const filedBatch = bid ? await store.batchById(pool, bid) : null;
    const filed = await Promise.all(ids.map((id) => store.changeById(pool, id)));
    res.json({
      success: true,
      batchId: ids.length ? bid : null,
      batchCode: ids.length ? filedBatch?.code ?? null : null,
      ids,
      codes: ids.map((id, i) => ({ id, code: filed[i]?.code ?? null })),
      // Held before review, by the fixed reason and its fields, never anybody's words. Each waits in Held for a person.
      held,
      // The same filing already waits: this is that change, not a second one.
      waiting,
      applied: false,
      reviewAt: "/admin/proposals",
      message: held.length || waiting.length ? `${REVIEW_WORDS.nothingLive} ${ids.length} filed for review, ${held.length} held, ${waiting.length} already waiting.` : REVIEW_WORDS.nothingLive,
    });
  });

  app.get("/api/admin/proposals/lessons", async (req, res) => {
    const user = await reader(req, res);
    if (!user) return;
    const asked = typeof req.query.kind === "string" ? req.query.kind : null;
    // An alias (`vocabulary`) reads the lessons of the kind and target it stands for.
    const alias = asked && Object.prototype.hasOwnProperty.call(KIND_ALIASES, asked) ? KIND_ALIASES[asked as KindAlias] : null;
    const kind = alias ? alias.kind : asked;
    const section = alias ? alias.target.section : null;
    const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 100) || 100));
    const mayPay = await readsPay(req);
    const lessons: Lesson[] = [];
    for (const c of await store.listDecided(getPool(), 200, true)) {
      if (kind && c.kind !== kind) continue;
      if (section && c.target.section !== section) continue;
      for (const l of (c.lessons ?? []) as Array<{ field: string; proposed: unknown; accepted: unknown }>) {
        // A lesson about pay carries its figures: only for a reader who may read terms.
        if (!mayPay && payKeysOf(c.kind, c.target).some((k) => l.field === k || l.field.startsWith(`${k}.`))) continue;
        lessons.push({ proposalId: c.id, kind: c.kind, target: c.targetLabel, summary: c.summary, field: l.field, proposed: l.proposed, accepted: l.accepted, acceptedAt: c.decidedAt ?? "" });
      }
    }
    const recent = lessons.slice(0, limit);
    res.set("Cache-Control", "no-store").json({
      note: "Each entry is a field a person changed before accepting a proposal: what was proposed and what they accepted. Read these before drafting the next proposal of the same kind.",
      count: recent.length,
      groups: groupLessons(recent),
    });
  });

  // ── What an agent may read and do (the lead, 19 Nov 2026) ─────────────────

  /**
   * THE QUEUE, REDACTED: what waits and what was decided lately, each change as its batch, id, kind, one sentence and
   * state (waiting, accepted, discarded), and whether the reader filed it through the connector. Never a body, a draft,
   * what is live, a route, or who decided: an agent checks what is waiting and confirms its own items, and the page is
   * where a person reads the rest. Open to the connector (shared/proposalQueue.ts).
   */
  app.get("/api/admin/proposals/queue", async (req, res) => {
    const user = await reader(req, res);
    if (!user) return;
    const pool = getPool();
    const uid = String(user.id);
    await store.ensureCodes(pool);
    const { batches, changes } = await store.listOpen(pool);
    const decided = await store.listDecided(pool, Math.max(1, Math.min(100, Number(req.query.decided ?? 40) || 40)));
    const titles = new Map(batches.map((b) => [b.id, b.title]));
    const batchCodes = new Map(batches.map((b) => [b.id, b.code]));
    for (const id of Array.from(new Set(decided.map((c) => c.batchId)))) {
      if (titles.has(id)) continue;
      const b = await store.batchById(pool, id);
      if (b) {
        titles.set(id, b.title);
        batchCodes.set(id, b.code);
      }
    }
    const items = [...changes, ...decided].map((c) => queueItemOf(c, uid));
    const batchIds = Array.from(new Set(items.map((i) => i.batchId)));
    res.set("Cache-Control", "no-store").json({
      note: QUEUE_WORDS.note,
      waiting: items.filter((i) => i.state === "waiting").length,
      batches: batchIds.map((id) => ({ batchId: id, code: batchCodes.get(id) ?? null, title: titles.get(id) ?? "", items: items.filter((i) => i.batchId === id) })),
    });
  });

  /**
   * A ROLE'S TERMS, AS WORDS: the suggested wording for each setting, the commitment it asks, and the names of the
   * groups its offer sets. Never a value of a group: no amount, currency or pay shape (shared/seatTermsProposal.ts).
   * `roleId` names one role; without it, every role that is not a standing example.
   */
  app.get("/api/admin/proposals/seat-terms", async (req, res) => {
    const user = await reader(req, res);
    if (!user) return;
    const want = typeof req.query.roleId === "string" ? req.query.roleId.slice(0, 120) : "";
    const roles = (await listOrgRoles(getPool())).filter((r) => !r.isExample && (!want || r.id === want));
    if (want && !roles.length) return res.status(404).json({ error: "not_found", message: "There is no role by that id." });
    res.set("Cache-Control", "no-store").json({ note: QUEUE_WORDS.termsNote, roles: roles.map((r) => seatTermsRead(r)) });
  });

  /**
   * AN AGENT PUTS ASIDE WHAT IT FILED: a superseded draft no longer waits on a person to discard it. Only changes the
   * caller filed through the connector or as an agent account, and only while they wait or failed. Discard only:
   * accepting stays a person's act on the review page.
   */
  app.post("/api/admin/proposals/discard-mine", async (req, res) => {
    const user = await reader(req, res);
    if (!user) return;
    const uid = String(user.id);
    if (await overLimit(`proposals-discard:${uid}`, 120, WINDOW)) return res.status(429).json({ error: "too_many" });
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).map((x) => String(x).slice(0, 60)).slice(0, 100) : [];
    if (!ids.length) return res.status(400).json({ error: "bad_request", message: "Send ids: the changes you filed that you want put aside." });
    const pool = getPool();
    const agent = !!req.get("x-village-connector") || (await isAgentAccount(pool, uid));
    const results = [];
    for (const id of ids) {
      const ok = await store.markDiscardedByFiler(pool, id, uid);
      if (ok) await closeStagedForChange(pool, id, new Date());
      if (ok) {
        await recordEvent(pool, { kind: "proposed_change", text: "A proposed change was put aside by the one who filed it", actorUserId: uid, actorKind: agent ? "agent" : "human", entityType: "proposed_change", entityRef: id, audience: "admin" });
      }
      results.push({ id, code: (await store.changeById(pool, id))?.code ?? null, ok, ...(ok ? {} : { error: QUEUE_WORDS.notYours }) });
    }
    res.json({ results, discarded: results.filter((r) => r.ok).length });
  });

  // ── Reviewing ──────────────────────────────────────────────────────────────

  app.get("/api/admin/proposals/count", async (req, res) => {
    const user = await reader(req, res);
    if (!user) return;
    res.set("Cache-Control", "no-store").json({ open: await store.openCount(getPool()) });
  });

  app.get("/api/admin/proposals", async (req, res) => {
    const user = await reader(req, res);
    if (!user) return;
    const pool = getPool();
    const kd = kindDeps();
    const run = runAs(req);
    await store.ensureCodes(pool);
    const { batches, changes } = await store.listOpen(pool);
    const decided = await store.listDecided(pool, 40);
    const names = new Map<string, string>();
    // An agent account is named whole ("Sera Companion"), so two agents never read as one; a person by first name.
    const agentIds = new Set([...changes, ...decided].filter((c) => c.proposedByKind === "agent").map((c) => c.proposedBy));
    for (const id of Array.from(new Set([...changes, ...decided].flatMap((c) => [c.proposedBy, c.decidedBy ?? ""]).filter(Boolean)))) {
      const name = (await members.byId(id))?.name;
      names.set(id, agentIds.has(id) ? String(name ?? "").trim() || "An agent" : firstName(name));
    }
    // The batches the decided changes came from, so the history names its batch.
    const decidedBatches = new Map<string, store.StoredBatch>();
    for (const id of Array.from(new Set(decided.map((c) => c.batchId)))) {
      const b = batches.find((x) => x.id === id) ?? (await store.batchById(pool, id));
      if (b) decidedBatches.set(id, b);
    }
    for (const b of [...batches, ...Array.from(decidedBatches.values())]) {
      if (names.has(b.proposedBy)) continue;
      const name = (await members.byId(b.proposedBy))?.name;
      names.set(b.proposedBy, b.proposedByKind === "agent" ? String(name ?? "").trim() || "An agent" : firstName(name));
    }
    // What was accepted since the oldest waiting change was proposed: a waiting change drafted before a later accept
    // that wrote the same thing is stale, and says so on its card.
    const oldest = changes.reduce<string | null>((m, c) => (!m || c.createdAt < m ? c.createdAt : m), null);
    const acceptedLater = oldest ? (await store.acceptedSince(pool, new Date(oldest))).map(acceptedRecord) : [];
    const mayPay = await readsPay(req);
    const cut = (c: { kind: string; target: Record<string, unknown> }, v: unknown) => (mayPay ? v : withoutPay(payKeysOf(c.kind, c.target), v).value);
    const had = (c: { kind: string; target: Record<string, unknown> }, ...vs: unknown[]) => vs.some((v) => withoutPay(payKeysOf(c.kind, c.target), v).had);
    const served = [];
    for (const c of changes) {
      const live = await liveOf(kd, run, c.kind, c.target, c.draft ?? c.body);
      served.push({
        id: c.id,
        code: c.code,
        batchId: c.batchId,
        batchCode: batches.find((b) => b.id === c.batchId)?.code ?? null,
        kind: c.kind,
        target: c.target,
        targetLabel: c.targetLabel,
        route: { method: c.routeMethod, path: c.routePath },
        summary: c.summary,
        body: cut(c, c.body),
        draft: c.draft === null ? null : cut(c, c.draft),
        live: cut(c, live),
        // The pay changes, and this reader may not read terms: the card says so and shows no figure.
        payHidden: !mayPay && had(c, c.body, c.draft),
        labels: labelsFor(c.kind, c.target, c.draft ?? c.body),
        where: whereOf(c.kind, c.target),
        status: c.status,
        error: c.error,
        by: names.get(c.proposedBy) ?? "Someone",
        byKind: c.proposedByKind,
        at: c.createdAt,
        position: c.position,
        reverts: c.reverts,
        stale: staleOf(c, c.draft ?? c.body, acceptedLater),
      });
    }
    // A change that already has a put-back waiting is not offered another.
    const waitingBack = new Set(changes.map((c) => c.reverts).filter((x): x is string => !!x));
    const putBack = (c: store.StoredChange): PutBackVerdict => {
      const v = putBackVerdict(c);
      return v.can && waitingBack.has(c.id) ? { can: false, reason: "already_waiting" } : v;
    };
    res.set("Cache-Control", "no-store").json({
      // Every time on the page is read in village time, named when it is not the reader's own.
      timezone: deps.seasonState().timezone || "UTC",
      batches: batches.map((b) => ({ id: b.id, code: b.code, title: b.title, by: names.get(b.proposedBy) ?? firstName(""), byKind: b.proposedByKind, at: b.createdAt })),
      changes: served,
      // The history: what was proposed, what was accepted (the person's edits included), who decided and when, and
      // the last reason a change did not land, which a discarded change keeps, and whether it may be proposed back.
      decided: decided.map((c) => {
        const b = decidedBatches.get(c.batchId);
        return {
          id: c.id,
          code: c.code,
          batchId: c.batchId,
          batchCode: b?.code ?? null,
          batchTitle: b?.title ?? "",
          kind: c.kind,
          target: c.target,
          targetLabel: c.targetLabel,
          route: { method: c.routeMethod, path: c.routePath },
          summary: c.summary,
          body: cut(c, c.body),
          accepted: c.accepted === null || c.accepted === undefined ? c.accepted : cut(c, c.accepted),
          payHidden: !mayPay && had(c, c.body, c.accepted),
          labels: labelsFor(c.kind, c.target, c.accepted ?? c.body),
          where: whereOf(c.kind, c.target),
          status: c.status,
          error: c.error,
          proposedBy: names.get(c.proposedBy) ?? "Someone",
          proposedByKind: c.proposedByKind,
          proposedAt: c.createdAt,
          by: names.get(c.decidedBy ?? "") ?? "Someone",
          at: c.decidedAt,
          edited: (c.lessons ?? []).length,
          reverts: c.reverts,
          putBack: putBack(c),
        };
      }),
    });
  });

  app.put("/api/admin/proposals/:id/draft", async (req, res) => {
    const user = await person(req, res);
    if (!user) return;
    const uid = String(user.id);
    if (await overLimit(`proposals-draft:${uid}`, 600, WINDOW)) return res.status(429).json({ error: "too_many" });
    const draft = req.body?.body === null ? null : obj(req.body?.body);
    if (req.body?.body !== null && !draft) return res.status(400).json({ error: "bad_request", message: "Send body: the edited change, or null to drop the edits." });
    if (draft && JSON.stringify(draft).length > PROPOSAL_LIMITS.bodyBytes) return res.status(400).json({ error: "bad_request", message: "That is longer than a proposal can carry." });
    let saved = draft;
    if (draft && !(await readsPay(req))) {
      const c = await store.changeById(getPool(), String(req.params.id ?? ""));
      if (c) saved = keepStoredPay(payKeysOf(c.kind, c.target), draft, c.draft ?? c.body);
    }
    const ok = await store.saveDraft(getPool(), String(req.params.id ?? ""), saved, uid);
    if (!ok) return res.status(409).json({ error: "not_open", message: REVIEW_WORDS.notProposed });
    res.json({ success: true, savedAt: new Date().toISOString() });
  });

  /** The body a person accepts: what they sent, else their saved draft, else what was proposed. */
  const finalBody = (c: store.StoredChange, sent: unknown, mayPay = true): Record<string, unknown> => {
    const stored = c.draft ?? c.body;
    const chosen = obj(sent) ?? stored;
    return withoutApproval(mayPay ? chosen : keepStoredPay(payKeysOf(c.kind, c.target), chosen, stored));
  };

  app.post("/api/admin/proposals/check", async (req, res) => {
    const user = await person(req, res);
    if (!user) return;
    if (await overLimit(`proposals-check:${String(user.id)}`, 120, WINDOW)) return res.status(429).json({ error: "too_many" });
    const items = Array.isArray(req.body?.items) ? (req.body.items as unknown[]).slice(0, 100) : [];
    const pool = getPool();
    const kd = kindDeps();
    const mayPay = await readsPay(req);
    const results = [];
    for (const it of items) {
      const id = String(obj(it)?.id ?? "");
      const c = await store.changeById(pool, id);
      if (!c) {
        results.push({ id, ok: false, error: REVIEW_WORDS.gone });
        continue;
      }
      const checked = await checkProposal(kd, { kind: c.kind, target: c.target, body: finalBody(c, obj(it)?.body, mayPay), summary: c.summary });
      results.push(checked.ok ? { id, ok: true, ...(c.kind === "setting" ? { note: "This setting's own route checks it when you accept." } : {}) } : { id, ok: false, error: checked.error, field: checked.field ?? null });
    }
    res.json({ results });
  });

  type AcceptResult = { id: string; ok: boolean; error?: string; field?: string | null; note?: string; stale?: StaleBy[]; code?: string; rivals?: { id: string; summary: string }[]; otherChosen?: string[] };
  /** Who an accept is recorded as: the person on the review page, or the full-access agent acting on their approval. */
  interface AcceptAs {
    actorKind: "human" | "agent";
    approvedBy: string;
    approvalNote: string;
    /** "accepted by Ana, accepted on the review page" or "accepted by Ana's agent, on the approval: ...". */
    said: string;
    /** The capability the decision is recorded under in suggestion_outcomes (`decidingKey`). */
    decidedBy: string;
  }

  /**
   * One change, accepted through its own route as the person in this request. A failure stops nothing and undoes
   * nothing. The review page's Accept and the full-access agent's accept run exactly this (the lead, 20 Nov 2026).
   */
  async function acceptOne(req: express.Request, uid: string, it: unknown, as: AcceptAs): Promise<AcceptResult> {
    const pool = getPool();
    const run = runAs(req);
    const id = String(obj(it)?.id ?? "");
    const c = await store.changeById(pool, id);
    if (!c) return { id, ok: false, error: REVIEW_WORDS.gone };
    // A change whose last try may have landed is tried again only once the person says they checked its page.
    const checked = obj(it)?.checked === true;
    if (store.needsACheck(c) && !checked) return { id, ok: false, error: REVIEW_WORDS.checkFirst, field: null, code: "check_target" };
    if (c.status !== "proposed" && c.status !== "failed" && !store.needsACheck(c)) return { id, ok: false, error: REVIEW_WORDS.notProposed };
    const body = finalBody(c, obj(it)?.body, await readsPay(req));
    // Read again now, so the page's warning is never itself out of date: the accepts since this change was proposed
    // that wrote what it writes, an earlier item of this same accept included. It informs; it never stops the accept.
    const stale = staleOf(c, body, (await store.acceptedSince(pool, new Date(c.createdAt))).map(acceptedRecord));
    const staleOut = stale.length ? { stale } : {};
    // The latest edits are kept even when the change fails, so fixing it starts from them.
    if (obj(obj(it)?.body)) await store.saveDraft(pool, id, body, uid);
    // CONFLICTS BLOCK (the lead, 25 Nov 2026). Another waiting change that writes the same thing makes this one
    // option among several: it is accepted only when the accept names every other option it is chosen over, and
    // those are then set aside as another option chosen. The full-access agent's accept never names them, so a
    // person always makes the choice.
    const over = new Set(Array.isArray(obj(it)?.over) ? (obj(it)!.over as unknown[]).slice(0, 100).map((x) => String(x).slice(0, 60)) : []);
    const rivals = await waitingRivals(pool, c, body);
    if (rivals.some((r) => !over.has(r.id))) {
      return { id, ok: false, error: REVIEW_WORDS.chooseFirst, field: null, code: "choose_first", rivals: rivals.map((r) => ({ id: r.id, summary: r.summary })), ...staleOut };
    }
    // A STALE CHANGE IS SEEN FIRST (the lead, 25 Nov 2026): the accept carries the version of what is live now that
    // the person was shown, and an accept that landed since makes it a different version, refused.
    if (stale.length && String(obj(it)?.seen ?? "") !== staleVersionOf(stale)) {
      return { id, ok: false, error: REVIEW_WORDS.seeLiveFirst, field: null, code: "see_live", stale };
    }
    // Claimed before it is applied, so a second accept racing this one applies nothing (audit, 15 Nov 2026).
    if (!(await store.claimForApplying(pool, id, uid, checked))) return { id, ok: false, error: REVIEW_WORDS.notProposed };
    const kd = kindDeps();
    // A change that throws on its way to its route (the loopback timing out, a read that fails) is THIS change's
    // outcome, recorded, and the loop goes on. It is NOT a plain "failed": the route may have committed before the
    // answer was lost, so it is `unknown`, and a person checks its page before it is tried again (audit, 15 Nov 2026).
    let out: { ok: true; note?: string } | { ok: false; error: string; field?: string | null };
    try {
      // A retry whose earlier try already made the role: that try landed, so this one records it (`newRoleAlreadyMade`).
      const retried = c.status === "failed" || store.needsACheck(c);
      const valid = retried && (await newRoleAlreadyMade(pool, c.kind, c.target, body))
        ? null
        : await checkProposal(kd, { kind: c.kind, target: c.target, body, summary: c.summary });
      if (valid === null) out = { ok: true, note: NEW_ROLE_ALREADY_MADE };
      else if (valid.ok) {
        // What is live now, kept so this change can be proposed back (0400). A read that fails keeps null and never
        // stops the accept; a kind that is never put back reads nothing.
        const before = await readBefore(kd, run, c.kind, c.target, body);
        if (before.keep) await store.saveBefore(pool, id, before.value);
        out = await applyProposal(kd, run, c.kind, c.target, body);
      } else out = { ok: false as const, error: valid.error, field: valid.field };
    } catch (e) {
      const error = `${REVIEW_WORDS.unknown} (${String((e as Error)?.message ?? e).slice(0, 200)})`;
      await store.markUnknown(pool, id, uid, error);
      await recordEvent(pool, { kind: "proposed_change", text: `A proposed change may or may not have landed, so it waits on a check: ${c.summary.slice(0, 140)}`, actorUserId: uid, actorKind: as.actorKind, entityType: "proposed_change", entityRef: id, audience: "admin" });
      return { id, ok: false, error, field: null, ...staleOut };
    }
    if (!out.ok) {
      await store.markFailed(pool, id, uid, out.error);
      await recordEvent(pool, { kind: "proposed_change", text: `A proposed change did not land: ${c.summary.slice(0, 140)}`, actorUserId: uid, actorKind: as.actorKind, entityType: "proposed_change", entityRef: id, audience: "admin" });
      return { id, ok: false, error: out.error, field: out.field ?? null, ...staleOut };
    }
    const lessons = fieldDiffs(c.body, body);
    await store.markAccepted(pool, id, { by: uid, accepted: body, lessons, approvedBy: as.approvedBy, approvalNote: as.approvalNote });
    // Its staged row closes, so the same value sent again later is judged afresh, never answered as still waiting.
    await closeStagedForChange(pool, id, new Date());
    // After the change has landed, never before, and never able to fail it (server/lib/suggestionOutcome.ts).
    await recordChangeOutcome(pool, c, lessons.length ? "edited" : "accepted", lessons.length, as.decidedBy);
    await recordEvent(pool, {
      kind: "proposed_change",
      text: `A proposed change was ${as.said}${lessons.length ? `, with ${lessons.length} field${lessons.length === 1 ? "" : "s"} edited` : ""}: ${c.summary.slice(0, 140)}`,
      actorUserId: uid,
      actorKind: as.actorKind,
      entityType: "proposed_change",
      entityRef: id,
      audience: "admin",
    });
    // The other options, set aside only now the chosen one has landed. One that was decided meanwhile is left alone.
    const otherChosen: string[] = [];
    for (const r of rivals) {
      if (!(await store.markDiscarded(pool, r.id, uid))) continue;
      await closeStagedForChange(pool, r.id, new Date());
      otherChosen.push(r.id);
      await recordChangeOutcome(pool, r, "other_chosen", 0, as.decidedBy);
      await recordEvent(pool, { kind: "proposed_change", text: `A proposed change was set aside because another option for the same thing was chosen: ${r.summary.slice(0, 140)}`, actorUserId: uid, actorKind: as.actorKind, entityType: "proposed_change", entityRef: r.id, audience: "admin" });
    }
    return { id, ok: true, ...(out.note ? { note: out.note } : {}), ...staleOut, ...(otherChosen.length ? { otherChosen } : {}) };
  }

  app.post("/api/admin/proposals/accept", async (req, res) => {
    const user = await person(req, res);
    if (!user) return;
    const uid = String(user.id);
    if (await overLimit(`proposals-accept:${uid}`, 60, WINDOW)) return res.status(429).json({ error: "too_many" });
    const items = Array.isArray(req.body?.items) ? (req.body.items as unknown[]).slice(0, 100) : [];
    if (!items.length) return res.status(400).json({ error: "bad_request", message: "Send items: the changes to accept, in order." });
    const name = String(user.name ?? "").trim() || "A person";
    const as: AcceptAs = { actorKind: "human", approvedBy: name, approvalNote: ACCEPT_NOTE, said: `accepted by ${firstName(name)}, ${ACCEPT_NOTE}`, decidedBy: await decidingKey(req, uid) };
    const results: AcceptResult[] = [];
    // One after another, each through its own route. A failure stops nothing and undoes nothing.
    for (const it of items) results.push(await acceptOne(req, uid, it, as));
    res.json({ results, accepted: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
  });

  /**
   * THE FULL-ACCESS AGENT'S ACCEPT AND DISCARD (the lead, 20 Nov 2026; shared/agentFullAccess.ts). The connector's
   * `accept_proposals` calls it, as the token's holder, and nothing else may: the call must come through the
   * connector, from a person (never an agent account) who holds a live seat in the role a person named for full
   * access, right now. The approval note must name the batch code or every change's code. A change whose route is
   * in the floor (money, secrets, erasure, the veto, the agent accounts, letters) is refused here whatever the
   * queue says. Each accepted change then runs exactly as the review page's Accept runs it, recorded as the agent's,
   * on the person's approval, with the note.
   */
  app.post("/api/admin/proposals/accept-as-holder", async (req, res) => {
    if (!req.get("x-village-connector")) return res.status(403).json({ error: "connector_only", message: "This door is the connector's. A person accepts on the review page." });
    const user = await reader(req, res);
    if (!user) return;
    const uid = String(user.id);
    if (!(await fullAccessFor(getPool(), uid))) return res.status(403).json({ error: "full_access_off", message: FULL_ACCESS_WORDS.notOn });
    if (await overLimit(`proposals-accept:${uid}`, 60, WINDOW)) return res.status(429).json({ error: "too_many" });
    const action = req.body?.action === "accept" || req.body?.action === "discard" ? (req.body.action as "accept" | "discard") : null;
    if (!action) return res.status(400).json({ error: "bad_request", message: "action is accept or discard." });
    const ids = Array.isArray(req.body?.ids) ? Array.from(new Set((req.body.ids as unknown[]).map((x) => String(x).slice(0, 60)))).slice(0, 100) : [];
    if (!ids.length) return res.status(400).json({ error: "bad_request", message: "Send ids: the changes, in order." });
    const approval = readLeadApproval(obj(req.body) ?? {});
    if (!approval.ok) return res.status(400).json({ error: "approval_required", message: approval.words });
    const pool = getPool();
    await store.ensureCodes(pool);
    const changes = await Promise.all(ids.map((id) => store.changeById(pool, id)));
    const codes = await Promise.all(changes.map(async (c) => ({ code: c?.code ?? null, batchCode: c ? (await store.batchById(pool, c.batchId))?.code ?? null : null })));
    if (!approvalCovers(approval.approvalNote, codes)) return res.status(400).json({ error: "approval_not_covering", message: ACCEPT_PROPOSAL_WORDS.notCovered });
    const name = String(user.name ?? "").trim() || "A person";
    const as: AcceptAs = {
      actorKind: "agent",
      approvedBy: approval.approvedBy,
      approvalNote: approval.approvalNote,
      said: `accepted by ${firstName(name)}'s agent with full access, approved by ${approval.approvedBy.slice(0, 80)}: "${approval.approvalNote.slice(0, 300)}"`,
      decidedBy: await decidingKey(req, uid),
    };
    const results: AcceptResult[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const c = changes[i];
      const code = codes[i]?.code ?? undefined;
      if (!c) {
        results.push({ id, ok: false, error: REVIEW_WORDS.gone });
        continue;
      }
      // The floor, read off the route the change would run: a person's act whatever the switch says.
      const floor = fullAccessFloor(c.routeMethod, c.routePath, uid, { applicantDataOpen: false });
      if (floor) {
        results.push({ id, ok: false, error: `A person accepts this one on the review page. ${floor.words}`, ...(code ? { code } : {}) });
        continue;
      }
      if (action === "discard") {
        const ok = await store.markDiscarded(pool, id, uid);
        if (ok) await closeStagedForChange(pool, id, new Date());
        if (ok) {
          await recordChangeOutcome(pool, c, "discarded", 0, as.decidedBy);
          await recordEvent(pool, { kind: "proposed_change", text: `A proposed change was put aside by ${firstName(name)}'s agent with full access, approved by ${approval.approvedBy.slice(0, 80)}: "${approval.approvalNote.slice(0, 300)}"`, actorUserId: uid, actorKind: "agent", entityType: "proposed_change", entityRef: id, audience: "admin" });
        }
        results.push({ id, ok, ...(ok ? {} : { error: REVIEW_WORDS.notProposed }), ...(code ? { code } : {}) });
        continue;
      }
      results.push({ ...(await acceptOne(req, uid, { id }, as)), ...(code ? { code } : {}) });
    }
    res.json({ action, results, landed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
  });

  app.post("/api/admin/proposals/:id/put-back", async (req, res) => {
    const user = await reader(req, res);
    if (!user) return;
    const uid = String(user.id);
    if (await overLimit(`proposals-file:${uid}`, 60, WINDOW)) return res.status(429).json({ error: "too_many", message: "That is a lot of proposals in a few minutes. Wait a little." });
    const pool = getPool();
    const c = await store.changeById(pool, String(req.params.id ?? "").slice(0, 60));
    if (!c) return res.status(404).json({ error: "not_found", message: REVIEW_WORDS.gone });
    const back = putBackOf(c, c.summary);
    if (!back.ok) return res.status(409).json({ error: "cannot_put_back", reason: back.reason, message: PUT_BACK_REFUSED[back.reason] });
    const waiting = await store.waitingPutBack(pool, c.id);
    if (waiting) return res.status(409).json({ error: "cannot_put_back", reason: "already_waiting", id: waiting, message: PUT_BACK_REFUSED.already_waiting });
    // Read by the same check every proposal passes. What was live may no longer pass today's rules; then nothing is filed.
    const p = back.proposal;
    const checked = await checkProposal(kindDeps(), { kind: p.kind, target: p.target, body: p.body, summary: p.summary });
    if (!checked.ok) return res.status(400).json({ error: "refused", message: `Nothing was filed. ${checked.error}`, ...(checked.field ? { field: checked.field } : {}) });
    const kind = (await isAgentAccount(pool, uid)) || req.get("x-village-connector") ? "agent" : "person";
    const batch = await store.batchById(pool, c.batchId);
    const title = `Putting back: ${(batch?.title || c.summary).replace(/\s+/g, " ").trim()}`.slice(0, PROPOSAL_LIMITS.title);
    const batchId = await store.addBatch(pool, { title, proposedBy: uid, proposedByKind: kind });
    const newId = await store.addChange(pool, {
      batchId, position: 0, kind: p.kind, target: p.target, targetLabel: checked.label, routeMethod: checked.method, routePath: checked.path,
      summary: p.summary, body: p.body, proposedBy: uid, proposedByKind: kind, reverts: c.id,
    });
    await recordEvent(pool, {
      kind: "proposed_change",
      text: `A change was proposed back to what was live before it: ${c.summary.slice(0, 140)}`,
      actorUserId: uid,
      actorKind: kind === "agent" ? "agent" : "human",
      entityType: "proposed_change_batch",
      entityRef: batchId,
      audience: "admin",
    });
    const filedBack = await store.changeById(pool, newId);
    res.json({ success: true, batchId, batchCode: (await store.batchById(pool, batchId))?.code ?? null, id: newId, code: filedBack?.code ?? null, reverts: c.id, applied: false, reviewAt: "/admin/proposals", message: REVIEW_WORDS.nothingLive });
  });

  // ── Held (docs/REVIEW_INBOX_PLAN.md, lane 4b) ─────────────────────────────
  //
  // What the engine held back from the connector's stream: a fixed code with fields, never prose, and how long it has
  // waited. Held items never lapse (the lead, 25 Nov 2026): a person clears each one, or lets a reconsider through.

  /** The held row a person may act on: the connector's own, still held. */
  const heldRow = async (id: string): Promise<StagedRow | null> => {
    const row = await stagedById(getPool(), id.slice(0, 48));
    return row && row.state === "held" && row.staged.stream === "connector" ? row : null;
  };

  app.get("/api/admin/proposals/held", async (req, res) => {
    const user = await reader(req, res);
    if (!user) return;
    const rows = await heldOf(getPool(), "connector", 200);
    res.set("Cache-Control", "no-store").json({
      held: rows.map((r) => ({
        id: r.staged.id,
        kind: r.staged.kind,
        where: whereOf(r.staged.kind, r.staged.target),
        code: r.heldCode,
        fields: r.heldFields,
        receivedAt: r.staged.receivedAt,
        filerKind: r.filerKind,
        reconsider: r.staged.reconsider ? { code: r.staged.reconsider.code } : null,
        released: r.released,
      })),
    });
  });

  app.post("/api/admin/proposals/held/:id/release", async (req, res) => {
    const user = await person(req, res);
    if (!user) return;
    const uid = String(user.id);
    if (await overLimit(`proposals-held:${uid}`, 120, WINDOW)) return res.status(429).json({ error: "too_many" });
    const row = await heldRow(String(req.params.id ?? ""));
    if (!row || row.heldCode !== "reconsider_waits") return res.status(409).json({ error: "not_held", message: REVIEW_WORDS.notProposed });
    const key = await decidingKey(req, uid);
    if (!(await releaseReconsider(getPool(), row.staged.id, key, new Date()))) return res.status(409).json({ error: "not_held", message: REVIEW_WORDS.notProposed });
    await recordStagedOutcome(getPool(), row, "released", key);
    await recordEvent(getPool(), { kind: "proposed_change", text: "A suggestion sent again after a discard was let through to be read", actorUserId: uid, actorKind: "human", entityType: "suggestion_staging", entityRef: row.staged.id, audience: "admin" });
    // Read again with the release counted. Let through, it goes onto the review page as the filer's own proposal; held
    // for another reason since (already live, decided meanwhile), it stays in Held with that reason.
    const pool = getPool();
    const kd = kindDeps();
    const run = runAs(req);
    const now = new Date();
    const isLive = async (f: Filing) => {
      try {
        return sameAsLive(await liveOf(kd, run, f.kind, f.target, f.body), f.body);
      } catch {
        return false;
      }
    };
    const next = await afterRelease({ pool, now, isLive }, row.staged.id);
    if (!next || !next.publish) return res.json({ success: true, published: null, heldFor: next && !next.publish ? next.code : null });
    const s = row.staged;
    const summary = (row.why ?? "").trim() || "A change sent again after a discard";
    const checked = await checkProposal(kd, { kind: s.kind, target: s.target, body: s.body, summary });
    if (!checked.ok) return res.json({ success: true, published: null, refused: checked.error });
    const filerKind = row.filerKind === "member" ? "person" : "agent";
    const bid = await store.addBatch(pool, { title: `Sent again: ${summary}`.slice(0, PROPOSAL_LIMITS.title), proposedBy: s.filer, proposedByKind: filerKind });
    const changeId = await store.addChange(pool, {
      batchId: bid, position: 0, kind: s.kind, target: s.target, targetLabel: checked.label, routeMethod: checked.method, routePath: checked.path,
      summary, body: s.body, proposedBy: s.filer, proposedByKind: filerKind,
    });
    await markPublished(pool, s.id, changeId, now);
    res.json({ success: true, published: { id: changeId, code: (await store.changeById(pool, changeId))?.code ?? null } });
  });

  app.post("/api/admin/proposals/held/:id/clear", async (req, res) => {
    const user = await person(req, res);
    if (!user) return;
    const uid = String(user.id);
    if (await overLimit(`proposals-held:${uid}`, 120, WINDOW)) return res.status(429).json({ error: "too_many" });
    const row = await heldRow(String(req.params.id ?? ""));
    if (!row) return res.status(409).json({ error: "not_held", message: REVIEW_WORDS.notProposed });
    if (!(await closeStaged(getPool(), row.staged.id, new Date()))) return res.status(409).json({ error: "not_held", message: REVIEW_WORDS.notProposed });
    await recordStagedOutcome(getPool(), row, "discarded", await decidingKey(req, uid));
    await recordEvent(getPool(), { kind: "proposed_change", text: "A held suggestion was cleared on the review page", actorUserId: uid, actorKind: "human", entityType: "suggestion_staging", entityRef: row.staged.id, audience: "admin" });
    res.json({ success: true });
  });

  app.post("/api/admin/proposals/discard", async (req, res) => {
    const user = await person(req, res);
    if (!user) return;
    const uid = String(user.id);
    if (await overLimit(`proposals-discard:${uid}`, 120, WINDOW)) return res.status(429).json({ error: "too_many" });
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).map((x) => String(x).slice(0, 60)).slice(0, 100) : [];
    if (!ids.length) return res.status(400).json({ error: "bad_request", message: "Send ids: the changes to put aside." });
    const pool = getPool();
    const decidedBy = await decidingKey(req, uid);
    const results = [];
    for (const id of ids) {
      const c = await store.changeById(pool, id);
      const ok = await store.markDiscarded(pool, id, uid);
      if (ok) {
        await closeStagedForChange(pool, id, new Date());
        if (c) await recordChangeOutcome(pool, c, "discarded", 0, decidedBy);
        await recordEvent(pool, { kind: "proposed_change", text: "A proposed change was discarded on the review page", actorUserId: uid, actorKind: "human", entityType: "proposed_change", entityRef: id, audience: "admin" });
      }
      results.push({ id, ok, ...(ok ? {} : { error: REVIEW_WORDS.notProposed }) });
    }
    res.json({ results });
  });
}
