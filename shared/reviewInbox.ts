/**
 * THE DECIDERS' READ, the pure half (docs/REVIEW_INBOX_PLAN.md, lane 3).
 *
 * `/admin/review` shows, in one list, everything waiting on the person reading it, from every queue. The server half
 * (server/routes/reviewInbox.ts) reads each queue's OWN route as that person, over the loopback, and this file turns
 * each answer into one shape. That is the whole visibility rule: a section holds exactly what its own page would show
 * the same person today, because it IS that page's read. Nothing here decides who sees what, and nothing here can show
 * more than the queue it came from. A queue that refuses the reader is left out; a queue that failed says so and is
 * never shown as empty.
 *
 * An item carries what a list needs and no more: where it came from, its kind, its code when it has one (only the
 * connector's changes have codes today, B-71 and B-71.2), one line of words, when it was filed, its batch, and the page
 * where it is decided today. No body, no live value, no evidence quote, no amount: the item's own page shows those,
 * behind its own gate.
 *
 * Pure: no database, no Express, no React.
 */
import { matchesFind, normalizeCode } from "./proposedChanges";
import { draftPageHref } from "./orgDraftView";
import { APPROVALS_HREF, expiresAt } from "./approvalInbox";
import { changeRequestHref } from "./changeRequestAddress";
import { waitingKind } from "./seraWaiting";
import { formKindWords, needsAction } from "./formsWaiting";

import { INBOX_ORDER, INBOX_PAGE, INBOX_SOURCES, SERA_ROW_KEY, type InboxSource } from "./reviewInboxSources";
export { INBOX_ORDER, INBOX_PAGE, INBOX_SOURCES, SERA_ROW_KEY, type InboxSource };

export interface InboxItem {
  /** `<source>:<the queue's own id>`. Unique across the list. */
  key: string;
  source: InboxSource;
  kind: string;
  /** B-71.2 on a connector change; null everywhere else today. */
  code: string | null;
  summary: string;
  /** When it was filed or received, or null when its queue keeps no time. */
  filedAt: string | null;
  batch: { key: string; code: string | null; title: string | null } | null;
  /** The page where it is decided today. */
  decideAt: string;
  /** A seating, or anything tied to an application: shown in arrival order, never grouped or judged. */
  touchesPerson: boolean;
  /**
   * When it lapses undecided (shared/approvalInbox.ts, seven days after it was filed): an agent's seating or setting.
   * Absent for everything that waits until somebody decides it.
   */
  lapsesAt?: string | null;
  /**
   * How many decisions this ONE row stands for, when a queue is gone through as one list (Sera's differences, the hall
   * relief of 27 Nov 2026). Absent on a row that is one thing.
   */
  holds?: number;
  /**
   * BLOCKED: it cannot be applied as the village stands (an org chart draft naming a role that no longer exists).
   * How many of its changes are blocked, and the first one in its queue's own words: what it would do, and why it
   * cannot. Set by the server half for the items a person's own reads already listed; absent when nothing blocks it.
   */
  blocked?: InboxBlocked | null;
}

export interface InboxBlocked {
  count: number;
  reads: string | null;
  why: string;
}

/** How one queue answered: `ok` with its items, `refused` (not this reader's), `off` (its module is off), `failed`. */
export type SectionState = "ok" | "refused" | "off" | "failed";

export interface InboxSection {
  source: InboxSource;
  state: SectionState;
  items: InboxItem[];
}




/** A queue's own route, read as the person, and the sources its answer feeds. Defined below the readers. */
export interface InboxRead {
  path: string;
  sources: readonly InboxSource[];
  read: (body: unknown) => InboxItem[];
}

/** What an HTTP status means for a section. A 404 is a module that is off (the Sera read mounts behind its module). */
export function stateOfStatus(status: number): SectionState {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401 || status === 403) return "refused";
  if (status === 404) return "off";
  return "failed";
}

// ── Reading each queue's answer ─────────────────────────────────────────────

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const line = (v: unknown, fallback: string): string => (str(v) ?? fallback).replace(/\s+/g, " ").trim().slice(0, 200);

/** The connector's batches (`GET /api/admin/proposals`): every waiting change, with its code and its batch's. */
export function fromConnector(body: unknown): InboxItem[] {
  const b = obj(body);
  const batches = new Map(list(b?.batches).map((x) => [String(obj(x)?.id ?? ""), obj(x)!] as const));
  return list(b?.changes).flatMap((x) => {
    const c = obj(x);
    if (!c || !str(c.id)) return [];
    const batch = batches.get(String(c.batchId ?? ""));
    return [{
      key: `connector:${c.id}`,
      source: "connector" as const,
      kind: String(c.kind ?? "setting"),
      code: str(c.code),
      summary: line(c.summary, "A proposed change"),
      filedAt: str(c.at),
      batch: c.batchId ? { key: `connector:${c.batchId}`, code: str(c.batchCode), title: str(batch?.title) } : null,
      decideAt: "/admin/proposals",
      touchesPerson: false,
    }];
  });
}

/** One line for an intake card, which carries no summary of its own: the payload's name or title, or its kind. */
function intakeLine(card: Obj): string {
  const p = obj(card.payload) ?? {};
  return line(p.title ?? p.name ?? p.summary ?? p.text, String(card.kind ?? "A proposal").replace(/\./g, " "));
}

/** Sera and outside intake, and the quest ideas, from one read (`GET /api/review/queue`). */
export function fromReviewQueue(body: unknown): { intake: InboxItem[]; quest: InboxItem[] } {
  const b = obj(body);
  const intake = list(b?.batches).flatMap((x) => {
    const batch = obj(x);
    return list(batch?.items).flatMap((y) => {
      const c = obj(y);
      if (!c || !str(c.id)) return [];
      return [{
        key: `intake:${c.id}`,
        source: "intake" as const,
        kind: String(c.kind ?? "proposal"),
        code: null,
        summary: intakeLine(c),
        filedAt: str(c.receivedAt),
        batch: batch?.batchId ? { key: `intake:${batch.batchId}`, code: null, title: null } : null,
        decideAt: "/review",
        touchesPerson: false,
      }];
    });
  });
  const quest = list(b?.quests).flatMap((x) => {
    const q = obj(x);
    if (!q || !str(q.id)) return [];
    return [{
      key: `quest:${q.id}`,
      source: "quest" as const,
      kind: "quest.proposed",
      code: null,
      summary: line(obj(q.prose)?.title, "A quest idea"),
      filedAt: str(q.receivedAt),
      batch: null,
      decideAt: "/review",
      touchesPerson: false,
    }];
  });
  return { intake, quest };
}

/** Finished work waiting for a witness (`GET /api/admin/quest-claims`, which answers every claim: only `submitted` waits). */
export function fromClaims(body: unknown): InboxItem[] {
  return list(body).flatMap((x) => {
    const c = obj(x);
    if (!c || !str(c.id) || c.status !== "submitted") return [];
    return [{
      key: `claim:${c.id}`,
      source: "claim" as const,
      kind: "quest.finished",
      code: null,
      summary: line(c.questTitle, "Finished work"),
      filedAt: str(c.submittedAt) ?? str(c.claimedAt),
      batch: null,
      decideAt: "/review",
      touchesPerson: false,
    }];
  });
}

/** The one-tap approvals (`GET /api/approval-inbox`). Its agent role-change drafts carry the id `draft:<id>`. */
export function fromApprovals(body: unknown): InboxItem[] {
  return list(obj(body)?.waiting).flatMap((x) => {
    const c = obj(x);
    if (!c || !str(c.id)) return [];
    const id = String(c.id);
    const kind = String(c.kind ?? "setting");
    return [{
      // A draft is keyed as every read keys it (`structure:<id>`), so the approvals, the agents' and the org drafts'
      // reads list one draft once (the review page audit, 26 Nov 2026: an admin saw an agent's role draft twice).
      key: id.startsWith("draft:") ? `structure:${id.slice("draft:".length)}` : kind === "seating" ? `agent:seating:${id}` : `approval:${id}`,
      source: id.startsWith("draft:") || kind === "seating" ? ("agent" as const) : ("approval" as const),
      kind,
      code: null,
      summary: line(c.title, "An approval"),
      filedAt: str(c.at),
      batch: null,
      decideAt: id.startsWith("draft:") ? draftPageHref(id.slice("draft:".length)) : APPROVALS_HREF,
      touchesPerson: kind === "seating",
      // A draft waits until it is decided; an approval lapses seven days after it was filed.
      lapsesAt: !id.startsWith("draft:") && str(c.at) ? expiresAt(String(c.at)).toISOString() : null,
    }];
  });
}

/** Agent role changes and seatings (`GET /api/agent-proposals/waiting`). The same rows the approvals read lists. */
export function fromAgentWaiting(body: unknown): InboxItem[] {
  const b = obj(body);
  const drafts = list(b?.roleChanges).flatMap((x) => {
    const d = obj(x);
    if (!d || !str(d.draftId)) return [];
    return [{ key: `structure:${d.draftId}`, source: "agent" as const, kind: "role_change", code: null, summary: line(d.title, "A role change"), filedAt: null, batch: null, decideAt: draftPageHref(String(d.draftId)), touchesPerson: false }];
  });
  const seatings = list(b?.seatings).flatMap((x) => {
    const s = obj(x);
    if (!s || !str(s.id)) return [];
    return [{ key: `agent:seating:${s.id}`, source: "agent" as const, kind: "seating", code: null, summary: line(s.title, "A seating"), filedAt: str(s.createdAt), batch: null, decideAt: APPROVALS_HREF, touchesPerson: true, lapsesAt: str(s.createdAt) ? expiresAt(String(s.createdAt)).toISOString() : null }];
  });
  return [...drafts, ...seatings];
}

/**
 * Sera's differences (`GET /api/saberra/differences`) as ONE row (the hall relief, 27 Nov 2026: 159 of the 185 rows on
 * the live list were these, each a door to another page). The row holds what waits for a person by the list's own rule
 * (shared/seraWaiting.ts: every decision and conflict, and the small changes), so its number is the number the list
 * itself says. Facts, and what is ahead here, wait for nobody and are not counted. The row opens the list where a
 * person ticks and takes. Pay and new roles are in that list too; the list confirms those one at a time, as before.
 * Dated by its oldest waiting difference, so it takes its place in the order like anything else.
 */
export function fromSeraDifferences(body: unknown): InboxItem[] {
  const waiting = list(obj(body)?.differences).flatMap((x) => {
    const d = obj(x);
    if (!d || !str(d.key)) return [];
    const kind = waitingKind({ state: d.state as never, lane: d.lane as never });
    return kind === "toDecide" || kind === "small" ? [d] : [];
  });
  if (!waiting.length) return [];
  const oldest = waiting.map((d) => str(obj(d.source)?.editedAt)).filter((v): v is string => !!v).sort()[0] ?? null;
  const n = waiting.length;
  return [{
    key: SERA_ROW_KEY,
    source: "sera" as const,
    kind: "difference_list",
    code: null,
    summary: n === 1 ? line(obj(waiting[0].words)?.sentence, "A difference Sera noticed") : `${n} differences Sera noticed`,
    filedAt: oldest,
    batch: null,
    decideAt: "/review",
    touchesPerson: false,
    holds: n,
  }];
}

// ── Every other queue a person decides from ─────────────────────────────────
//
// Each reader keeps only what waits on THIS reader. A route that answers only the reader's own (waiting-on-me, the
// suggestions queue, handoffs, the vouch queue) is read whole. A route that answers everything carries its own "may
// act" flag, and the reader keeps what the flag allows (ballots: running, a vote this person may cast and has not;
// raised hands: `youMayPut`). A route that answers everything with no flag at all is read whole only where its own
// gate already limits it to the people who act on it (the admin desks, the cash and mint desks, the erasure queue).
//
// APPLICANTS (seat applications, consent rounds, open proposals, letters to applicants, seatings) are listed by the
// seat and never by the person, in arrival order, with nothing that ranks, scores or judges. The application's own
// page, behind its own gate, is where a person reads who applied.

const seatWords = (v: unknown): string => list(v).map((x) => (typeof x === "string" ? x : String(obj(x)?.name ?? ""))).filter(Boolean).join(", ");

/** A door handed back by a queue, kept only when it stays inside this app: a path, never a scheme or `//host`. */
function inApp(v: unknown): string | null {
  return typeof v === "string" && /^\/(?![\/\\])/.test(v) ? v : null;
}

/** `GET /api/governance/waiting-on-me`: applications, drafts, done work, tensions, consent rounds, open proposals. */
export function fromWaitingOnMe(body: unknown): InboxItem[] {
  const b = obj(body);
  const out: InboxItem[] = [];
  for (const x of list(b?.applications)) {
    const a = obj(x);
    if (!a || !str(a.id)) continue;
    const seats = seatWords(a.seats);
    out.push({ key: `application:${a.id}`, source: "application", kind: "seat_application", code: null, summary: line(seats ? `An application for ${seats}` : "", "An application"), filedAt: str(a.appliedOn), batch: null, decideAt: inApp(a.href) ?? `/role-applications/${a.id}`, touchesPerson: true });
  }
  for (const x of list(b?.toConsent)) {
    const c = obj(x);
    if (!c || !str(c.proposalId)) continue;
    const roles = seatWords(c.roles);
    out.push({ key: `consent:${c.proposalId}`, source: "consent", kind: "circle_consent", code: null, summary: line(roles ? `Consent asked for ${roles}` : "", "Consent asked"), filedAt: null, batch: null, decideAt: inApp(c.href) ?? "/profile", touchesPerson: true });
  }
  for (const x of list(b?.openProposals)) {
    const o = obj(x);
    if (!o || !str(o.id)) continue;
    const roles = seatWords(o.roles);
    out.push({ key: `open:${o.id}`, source: "open", kind: `open_proposal_${String(o.ask ?? "consent")}`, code: null, summary: line(roles ? `A proposal from outside for ${roles}` : "", "A proposal from outside the village"), filedAt: str(o.confirmedOn), batch: null, decideAt: inApp(o.href) ?? `/open-proposals/${o.id}`, touchesPerson: true });
  }
  for (const x of list(b?.drafts)) {
    const d = obj(x);
    if (!d || !str(d.id)) continue;
    out.push({ key: `structure:${d.id}`, source: "structure", kind: "org_draft", code: null, summary: line(d.title, "A draft to publish"), filedAt: null, batch: null, decideAt: draftPageHref(String(d.id)), touchesPerson: false });
  }
  for (const x of list(b?.toAccept)) {
    const t = obj(x);
    if (!t || t.entryId === undefined || t.entryId === null) continue;
    out.push({ key: `task:${t.entryId}`, source: "task", kind: "task_done", code: null, summary: line(t.text, "Done work to accept"), filedAt: str(t.doneOn), batch: null, decideAt: "/profile", touchesPerson: false });
  }
  for (const x of list(b?.raisedWithYou)) {
    const t = obj(x);
    if (!t || !str(t.id)) continue;
    out.push({ key: `tension:${t.id}`, source: "tension", kind: "role_tension", code: null, summary: line(t.text, "A tension raised with your role"), filedAt: str(t.raisedOn), batch: null, decideAt: "/profile", touchesPerson: false });
  }
  return out;
}

/** `GET /api/governance/ballots`: every ballot; only the running ones this reader may vote in and has not. */
export function fromBallots(body: unknown): InboxItem[] {
  return list(body).flatMap((x) => {
    const v = obj(x);
    if (!v || !str(v.id) || v.status !== "running" || v.myWeight === null || v.myWeight === undefined || v.myVote) return [];
    return [{ key: `vote:${v.id}`, source: "vote" as const, kind: String(v.subjectType ?? "ballot"), code: null, summary: line(v.title, "A vote"), filedAt: str(v.opensAt), batch: null, decideAt: `/decisions/${v.id}`, touchesPerson: v.subjectType === "role_application" }];
  });
}

/** `GET /api/moon-review/queue` (holders of a review key): recaps still waiting on an approval stage. */
export function fromMoonQueue(body: unknown): InboxItem[] {
  return list(obj(body)?.rows).flatMap((x) => {
    const r = obj(x);
    if (!r || !str(r.recapId) || !r.waitingOn) return [];
    const roles = list(r.roles).map((y) => str(obj(y)?.name)).filter(Boolean).join(", ");
    return [{ key: `recap:${r.recapId}`, source: "recap" as const, kind: `recap_${String(r.waitingOn)}`, code: null, summary: line(roles ? `A moon recap for ${roles}` : "", "A moon recap"), filedAt: null, batch: null, decideAt: "/governance/treasury#end-of-moon", touchesPerson: false }];
  });
}

/** `GET /api/change-requests`: the change requests open for review or a vote, the reader's own left out. */
export function fromChangeRequests(body: unknown): InboxItem[] {
  return list(obj(body)?.open).flatMap((x) => {
    const c = obj(x);
    if (!c || !str(c.id) || c.yours) return [];
    return [{ key: `change:${c.id}`, source: "change" as const, kind: `change_${String(c.state ?? "review")}`, code: null, summary: line(c.title, "A change request"), filedAt: str(c.updatedAt), batch: null, decideAt: changeRequestHref(String(c.id)), touchesPerson: false }];
  });
}

/** `GET /api/admin/suggestions/queue`: members' suggested edits to a control this reader holds. */
export function fromSuggestions(body: unknown): InboxItem[] {
  return list(obj(body)?.suggestions).flatMap((x) => {
    const g = obj(x);
    if (!g || !str(g.id) || (g.status && g.status !== "open" && g.status !== "waiting" && g.status !== "proposed")) return [];
    return [{ key: `suggestion:${g.id}`, source: "suggestion" as const, kind: String(g.control ?? "suggestion"), code: null, summary: line(g.controlLabel, "A suggested edit"), filedAt: str(g.suggestedAt), batch: null, decideAt: "/admin", touchesPerson: false }];
  });
}

/** `GET /api/powers/hands`: members asking to hold a power, only those this reader may put to the village. */
export function fromHands(body: unknown): InboxItem[] {
  return list(obj(body)?.hands).flatMap((x) => {
    const h = obj(x);
    if (!h || !str(h.id) || h.youMayPut !== true) return [];
    return [{ key: `hand:${h.id}`, source: "hand" as const, kind: "raised_hand", code: null, summary: line(h.powerLabel ? `A member asks to hold: ${h.powerLabel}` : "", "A member asks to hold a power"), filedAt: str(h.submittedAt), batch: null, decideAt: "/powers", touchesPerson: true }];
  });
}

/** `GET /api/member-tasks/handoffs/waiting`: tasks handed to this reader's role, waiting to be taken. */
export function fromHandoffs(body: unknown): InboxItem[] {
  return list(obj(body)?.waiting).flatMap((x) => {
    const h = obj(x);
    if (!h || !str(h.id)) return [];
    return [{ key: `handoff:${h.id}`, source: "handoff" as const, kind: "task_handoff", code: null, summary: line(h.title, "A task handed to you"), filedAt: str(h.sentOn), batch: null, decideAt: "/profile", touchesPerson: false }];
  });
}

/** `GET /api/cash-owed/queue` (`cash.pay`): cash still owed. */
export function fromCashOwed(body: unknown): InboxItem[] {
  return list(obj(body)?.unpaid).flatMap((x) => {
    const c = obj(x);
    if (!c || !str(c.id)) return [];
    return [{ key: `cash:${c.id}`, source: "cash" as const, kind: "cash_owed", code: null, summary: line(c.workTitle, "Cash owed for work"), filedAt: str(c.owedAt), batch: null, decideAt: "/governance/treasury#cash", touchesPerson: false }];
  });
}

/** `GET /api/admin/quest-claims/owed` (`quest.consent`): witnessed work whose posting is still owed. */
export function fromOwedPostings(body: unknown): InboxItem[] {
  return list(body).flatMap((x) => {
    const o = obj(x);
    const id = str(o?.key) ?? str(o?.claimId);
    if (!o || !id) return [];
    return [{ key: `owed:${id}`, source: "owed" as const, kind: "owed_posting", code: null, summary: line(o.questTitle, "A posting owed"), filedAt: str(o.createdAt), batch: null, decideAt: "/review", touchesPerson: false }];
  });
}

/** `GET /api/admin/mint-requests`: mint requests still pending. */
export function fromMintRequests(body: unknown): InboxItem[] {
  return list(obj(body)?.requests).flatMap((x) => {
    const m = obj(x);
    if (!m || !str(m.id) || (m.status && m.status !== "pending")) return [];
    return [{ key: `mint:${m.id}`, source: "mint" as const, kind: "mint_request", code: null, summary: line(m.reason, "A mint request"), filedAt: str(m.requestedAt), batch: null, decideAt: "/admin/mint", touchesPerson: false }];
  });
}

/** `GET /api/admin/cycles/pending` (admin): gratitude cycles due to settle. */
export function fromCycles(body: unknown): InboxItem[] {
  return list(obj(body)?.due).flatMap((x, n) => {
    const c = obj(x);
    const id = str(c?.id) ?? str(c?.cycleId) ?? str(c?.cycle) ?? String(n);
    const label = str(c?.label) ?? str(c?.name) ?? str(c?.cycle) ?? null;
    return [{ key: `cycle:${id}`, source: "cycle" as const, kind: "cycle_settlement", code: null, summary: line(label ? `A gratitude cycle to settle: ${label}` : "", "A gratitude cycle to settle"), filedAt: null, batch: null, decideAt: "/admin", touchesPerson: false }];
  });
}

/** `GET /api/admin/planting-requests`: keys waiting on a second person's co-sign. */
export function fromPlanting(body: unknown): InboxItem[] {
  return list(obj(body)?.waiting).flatMap((x) => {
    const w = obj(x);
    if (!w || !str(w.id)) return [];
    const at = typeof w.requestedAt === "number" ? new Date(w.requestedAt).toISOString() : str(w.requestedAt);
    return [{ key: `cosign:${w.id}`, source: "cosign" as const, kind: "planting_cosign", code: null, summary: line(w.title, "A key waiting for a co-sign"), filedAt: at, batch: null, decideAt: "/setup-game", touchesPerson: false }];
  });
}

/** `GET /api/admin/letter-drafts`: letters an agent drafted, waiting for a person to read and send. By subject only. */
export function fromLetters(body: unknown): InboxItem[] {
  return list(obj(body)?.letters).flatMap((x) => {
    const l = obj(x);
    if (!l || !str(l.id)) return [];
    return [{ key: `letter:${l.id}`, source: "letter" as const, kind: String(l.kind ?? "letter"), code: null, summary: line(l.subject, "A letter waiting to be read"), filedAt: str(l.createdAt), batch: null, decideAt: "/admin", touchesPerson: !!l.applicationRef }];
  });
}

/** `GET /api/admin/drafts`: the assistant's drafts waiting on an admin. */
export function fromAssistantDrafts(body: unknown): InboxItem[] {
  return list(obj(body)?.drafts).flatMap((x) => {
    const d = obj(x);
    if (!d || !str(d.id)) return [];
    return [{ key: `assistant:${d.id}`, source: "assistant" as const, kind: `assistant_${String(d.kind ?? "draft")}`, code: null, summary: line(d.rationale, "A draft from the assistant"), filedAt: str(d.proposedAt), batch: null, decideAt: "/admin", touchesPerson: false }];
  });
}

/** `GET /api/admin/feedback`: feedback nobody has read yet. */
export function fromFeedback(body: unknown): InboxItem[] {
  return list(obj(body)?.items).flatMap((x) => {
    const f = obj(x);
    if (!f || f.id === undefined || f.id === null || (f.status && f.status !== "new")) return [];
    return [{ key: `feedback:${f.id}`, source: "feedback" as const, kind: String(f.kind ?? "feedback"), code: null, summary: line(f.title, "Feedback to read"), filedAt: str(f.created_at), batch: null, decideAt: "/admin", touchesPerson: false }];
  });
}

/** `GET /api/hidden-map/vouch-queue`: places on the hidden map waiting for this reader's vouch. */
export function fromVouches(body: unknown): InboxItem[] {
  const b = obj(body);
  if (b?.mayVouch !== true) return [];
  return list(b.pins).flatMap((x) => {
    const p = obj(x);
    if (!p || !str(p.id) || p.mine) return [];
    return [{ key: `vouch:${p.id}`, source: "vouch" as const, kind: `vouch_${String(p.kind ?? "pin")}`, code: null, summary: line(p.title, "A place waiting for a vouch"), filedAt: str(p.plantedOn), batch: null, decideAt: "/hidden-map", touchesPerson: false }];
  });
}

/** `GET /api/review/erasure` (`intake.moderate`): counts only, so one item says how many erasures wait to be retried. */
export function fromErasure(body: unknown): InboxItem[] {
  const local = obj(obj(body)?.local);
  const n = Number(local?.count ?? 0);
  if (!Number.isFinite(n) || n <= 0) return [];
  return [{ key: "erasure:local", source: "erasure" as const, kind: "erasure_retry", code: null, summary: n === 1 ? "1 erasure waits to be retried" : `${n} erasures wait to be retried`, filedAt: str(local?.oldestSince), batch: null, decideAt: "/review", touchesPerson: false }];
}

/** `GET /api/admin/open-proposals` (`intake.moderate`): the desk's open proposals, by the roles asked for only. */
export function fromOpenProposalDesk(body: unknown): InboxItem[] {
  return list(obj(body)?.proposals).flatMap((x) => {
    const o = obj(x);
    if (!o || !str(o.id)) return [];
    const roles = seatWords(o.roles);
    return [{ key: `open:${o.id}`, source: "open" as const, kind: `open_proposal_${String(obj(o.stage)?.key ?? "desk")}`, code: null, summary: line(roles ? `A proposal from outside for ${roles}` : "", "A proposal from outside the village"), filedAt: str(o.confirmedAt) ?? str(o.createdAt), batch: null, decideAt: `/open-proposals/${o.id}`, touchesPerson: true }];
  });
}

/**
 * Every queue's own read, and what each feeds. Adding a queue is one row here and one reader above; the server
 * half and the page read this list, so neither changes.
 */
/**
 * Every open org chart draft (`GET /api/admin/org/drafts`, an admin's read). Waiting-on-me lists only the drafts a
 * proposal made, so a draft made in the admin panel, by the assistant or by an import was on no list before (the lead,
 * 25 Nov 2026: "I can't even find where to publish"). Keyed as waiting-on-me keys a draft, so a draft both reads list
 * is listed once, with the door waiting-on-me gives it.
 */
export function fromOrgDrafts(body: unknown): InboxItem[] {
  return list(body).flatMap((x) => {
    const d = obj(x);
    const id = str(d?.id);
    if (!d || !id || d.status !== "open") return [];
    const changes = list(d.changes).length;
    return [{ key: `structure:${id}`, source: "structure" as const, kind: "org_draft", code: null, summary: line(d.title, changes === 1 ? "An org chart draft with one change" : `An org chart draft with ${changes} changes`), filedAt: null, batch: null, decideAt: draftPageHref(id), touchesPerson: false }];
  });
}

/**
 * `GET /api/admin/submissions` (an admin's read): the forms people sent that nobody has answered yet, by the rule the
 * admin's own lists use (shared/formsWaiting.ts). Each is named by the KIND of form and the day it came, never by
 * who sent it: the form's own page, behind its own gate, is where a person reads that. Until the one count (27 Nov
 * 2026) Home counted these as "requests" beside this list, so the two never added up.
 */
export function fromForms(body: unknown): InboxItem[] {
  return list(body).flatMap((x) => {
    const f = obj(x);
    const id = str(f?.id);
    if (!f || !id || !needsAction(typeof f.status === "string" ? f.status : null)) return [];
    const kind = typeof f.type === "string" && f.type.trim() ? f.type : "request";
    return [{ key: `form:${id}`, source: "form" as const, kind: `form_${kind}`, code: null, summary: line(formKindWords(kind), "A form to answer"), filedAt: str(f.submittedAt), batch: null, decideAt: "/admin?tab=submissions", touchesPerson: true }];
  });
}

export const INBOX_READS: readonly InboxRead[] = [
  { path: "/api/admin/proposals", sources: ["connector"], read: fromConnector },
  { path: "/api/review/queue", sources: ["intake", "quest"], read: (b) => { const r = fromReviewQueue(b); return [...r.intake, ...r.quest]; } },
  { path: "/api/admin/quest-claims", sources: ["claim"], read: fromClaims },
  { path: "/api/approval-inbox", sources: ["approval", "agent"], read: fromApprovals },
  { path: "/api/agent-proposals/waiting", sources: ["agent"], read: fromAgentWaiting },
  { path: "/api/saberra/differences", sources: ["sera"], read: fromSeraDifferences },
  { path: "/api/governance/waiting-on-me", sources: ["application", "consent", "open", "structure", "task", "tension"], read: fromWaitingOnMe },
  { path: "/api/admin/org/drafts", sources: ["structure"], read: fromOrgDrafts },
  { path: "/api/governance/ballots", sources: ["vote"], read: fromBallots },
  { path: "/api/moon-review/queue", sources: ["recap"], read: fromMoonQueue },
  { path: "/api/change-requests", sources: ["change"], read: fromChangeRequests },
  { path: "/api/admin/suggestions/queue", sources: ["suggestion"], read: fromSuggestions },
  { path: "/api/powers/hands", sources: ["hand"], read: fromHands },
  { path: "/api/member-tasks/handoffs/waiting", sources: ["handoff"], read: fromHandoffs },
  { path: "/api/cash-owed/queue", sources: ["cash"], read: fromCashOwed },
  { path: "/api/admin/quest-claims/owed", sources: ["owed"], read: fromOwedPostings },
  { path: "/api/admin/mint-requests", sources: ["mint"], read: fromMintRequests },
  { path: "/api/admin/cycles/pending", sources: ["cycle"], read: fromCycles },
  { path: "/api/admin/planting-requests", sources: ["cosign"], read: fromPlanting },
  { path: "/api/admin/letter-drafts", sources: ["letter"], read: fromLetters },
  { path: "/api/admin/drafts", sources: ["assistant"], read: fromAssistantDrafts },
  { path: "/api/admin/feedback", sources: ["feedback"], read: fromFeedback },
  { path: "/api/hidden-map/vouch-queue", sources: ["vouch"], read: fromVouches },
  { path: "/api/review/erasure", sources: ["erasure"], read: fromErasure },
  { path: "/api/admin/open-proposals", sources: ["open"], read: fromOpenProposalDesk },
  { path: "/api/admin/submissions", sources: ["form"], read: fromForms },
];

// ── One list ────────────────────────────────────────────────────────────────

/**
 * THE ORDER OF THE LIST, one rule wherever it is drawn (the hall relief, 27 Nov 2026):
 *   1. what lapses undecided, soonest lapse first: a real deadline is the only clock on this list;
 *   2. then everything that carries a date, oldest first;
 *   3. then what carries no date, in the order its own queue lists it. Its queue keeps no time, and nothing here
 *      invents one, so it never jumps ahead of something that has waited a known time.
 * Nothing in this order reads who filed an item or who it is about: a seating and an application sit where their
 * arrival puts them.
 */
export function orderInbox(items: readonly InboxItem[]): InboxItem[] {
  const lapsing = items.filter((i) => i.lapsesAt);
  const dated = items.filter((i) => !i.lapsesAt && i.filedAt);
  const undated = items.filter((i) => !i.lapsesAt && !i.filedAt);
  lapsing.sort((a, b) => a.lapsesAt!.localeCompare(b.lapsesAt!) || a.key.localeCompare(b.key));
  dated.sort((a, b) => a.filedAt!.localeCompare(b.filedAt!) || a.key.localeCompare(b.key));
  return [...lapsing, ...dated, ...undated];
}

/**
 * The sections as one list: an item two queues both list (an agent's seating or role change is on the approvals read
 * and the agent read) appears once, under the first section that read it. In the list's one order (`orderInbox`).
 */
export function mergeSections(sections: readonly InboxSection[]): InboxItem[] {
  const seen = new Set<string>();
  const out: InboxItem[] = [];
  for (const s of sections) {
    // A queue fed by two reads where one failed is `failed` and still lists what the other read gave.
    if (s.state !== "ok" && s.state !== "failed") continue;
    for (const item of s.items) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      out.push(item);
    }
  }
  return orderInbox(out);
}

/** One queue on the list, as the server answers it: its state, how many wait, and whether more rows can be asked for. */
export interface InboxSectionAnswer {
  source: InboxSource;
  state: SectionState;
  /**
   * How many rows wait in this queue. NULL WHEN THE QUEUE DID NOT LOAD: its number is not known, and a page says
   * "unknown", never zero. `atLeast` is then what the reads that did answer listed.
   */
  count: number | null;
  atLeast: number;
  /** How many of its rows are blocked (cannot be applied as the village stands). */
  blocked: number;
  /** Whether rows past the ones sent wait to be asked for (`?rows=<queue>:<how many>`). */
  more: boolean;
}

/** The most rows of one queue a single read will send, however many are asked for. */
export const INBOX_ROWS_MAX = 200;

/**
 * `?rows=structure:20,quest:30`: how many rows of a queue to send, for the queues a person opened past their first
 * page. A word that names no queue is dropped; a number is held between one page and `INBOX_ROWS_MAX`.
 */
export function rowsAsked(raw: unknown): Map<InboxSource, number> {
  const out = new Map<InboxSource, number>();
  if (typeof raw !== "string") return out;
  for (const part of raw.slice(0, 600).split(",")) {
    const [name, n] = part.split(":");
    const source = (INBOX_SOURCES as readonly string[]).includes(name) ? (name as InboxSource) : null;
    const rows = Math.floor(Number(n));
    if (source && Number.isFinite(rows)) out.set(source, Math.min(INBOX_ROWS_MAX, Math.max(INBOX_PAGE, rows)));
  }
  return out;
}

/**
 * THE ONE COUNT: DECISIONS WAITING ON YOU (the Admin Garden plan, 27 Nov 2026: "One count, defined once. Applications
 * are listed and never counted.").
 *
 * Defined here and nowhere else. The server works it out per person, on every read, from that person's own queues
 * (server/routes/reviewInbox.ts), and every page that says a number says this one: Admin Home, and /admin/review.
 *
 *   decisions     every row waiting on this person that they can decide: one per item, one for a list that is gone
 *                 through as one (Sera's differences), across every queue that answered.
 *   applications  LISTED, NEVER COUNTED: a person's application for a role, and a proposal from outside the village
 *                 for one. Each is shown in arrival order on its own row and its own page, and applicants are
 *                 never added up. (A form to answer is a request, and is a decision like any other.)
 *   blocked       rows that cannot be applied as the village stands. They need a hand before anyone can decide them,
 *                 so they are said beside the count and are not in it.
 *   unknown       the queues that did not load. With any, `decisions` is a floor: say "at least".
 *
 * NEVER CACHED ACROSS PEOPLE: nothing here or in the route keeps a count between requests. The answer is `no-store`,
 * and a page that remembers a count on a device remembers whose it was (client/src/components/admin/todayGlance.ts).
 */
export interface DecisionCounts {
  decisions: number;
  applications: number;
  blocked: number;
  unknown: InboxSource[];
}

/** The queues that are applications: listed on the page, in arrival order, and left out of the count. */
export const LISTED_NOT_COUNTED: readonly InboxSource[] = ["application", "open"];

/** The one count, from every item waiting on a person (one row per item) and each queue's state. */
export function decisionCounts(all: readonly InboxItem[], sections: readonly Pick<InboxSection, "source" | "state">[]): DecisionCounts {
  const listed = all.filter((i) => LISTED_NOT_COUNTED.includes(i.source));
  const counted = all.filter((i) => !LISTED_NOT_COUNTED.includes(i.source));
  return {
    decisions: counted.filter((i) => !i.blocked).length,
    applications: listed.length,
    blocked: counted.filter((i) => i.blocked).length,
    unknown: sections.filter((s) => s.state === "failed").map((s) => s.source),
  };
}

export interface InboxPaged {
  sections: InboxSectionAnswer[];
  /** The rows sent: each queue's first page, or as many as were asked for, in the list's one order. */
  items: InboxItem[];
  /** How many rows wait across every queue that answered, applications and blocked rows among them. */
  waiting: number;
  blocked: number;
  /** The one count a page says (`decisionCounts`). */
  counts: DecisionCounts;
}

/**
 * The list a page is sent: every queue's state and number, and the FIRST PAGE of each queue's rows (`INBOX_PAGE`), or
 * as many as `rows` asks for that queue. One row per item across queues (`mergeSections`), then each queue's rows in
 * the list's one order (`orderInbox`), cut there. The numbers count every item, sent or not.
 */
export function pageInbox(sections: readonly InboxSection[], rows: ReadonlyMap<InboxSource, number> = new Map()): InboxPaged {
  const all = mergeSections(sections);
  const by = new Map<InboxSource, InboxItem[]>();
  for (const item of all) by.set(item.source, [...(by.get(item.source) ?? []), item]);
  const sent = new Set<string>();
  const answers = sections.map((s): InboxSectionAnswer => {
    const queue = by.get(s.source) ?? [];
    const show = rows.get(s.source) ?? INBOX_PAGE;
    for (const item of queue.slice(0, show)) sent.add(item.key);
    return {
      source: s.source,
      state: s.state,
      count: s.state === "failed" ? null : queue.length,
      atLeast: queue.length,
      blocked: queue.filter((i) => i.blocked).length,
      more: queue.length > show,
    };
  });
  return { sections: answers, items: all.filter((i) => sent.has(i.key)), waiting: all.length, blocked: all.filter((i) => i.blocked).length, counts: decisionCounts(all, sections) };
}

/**
 * The items a search names: a code (B-71 for a whole batch, B-71.2 for one change) or a long id, by the review page's
 * own rule (`matchesFind`). Only what the reader may already see is searched, so a code they may not see and a code
 * that does not exist both answer nothing, in the same way.
 */
export function findInInbox(items: readonly InboxItem[], raw: string): InboxItem[] {
  const q = raw.trim();
  if (!q) return [];
  return items.filter((i) => {
    // The id is the key's last part: `agent:seating:<id>` carries the kind between the source and the id.
    const id = i.key.slice(i.key.lastIndexOf(":") + 1);
    const batchId = i.batch ? i.batch.key.slice(i.batch.key.indexOf(":") + 1) : null;
    return matchesFind(q, { id, code: i.code, batchId, batchCode: i.batch?.code ?? null });
  });
}

/** Whether a search reads as a code, for the page to say "No B-71 that you may see" rather than "nothing matched". */
export const searchedCode = (raw: string): string | null => normalizeCode(raw);
