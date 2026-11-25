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

export const INBOX_SOURCES = ["connector", "intake", "quest", "claim", "approval", "agent", "sera"] as const;
export type InboxSource = (typeof INBOX_SOURCES)[number];

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
}

/** How one queue answered: `ok` with its items, `refused` (not this reader's), `off` (its module is off), `failed`. */
export type SectionState = "ok" | "refused" | "off" | "failed";

export interface InboxSection {
  source: InboxSource;
  state: SectionState;
  items: InboxItem[];
}

/** A queue's own route, read as the person. One route can feed two sources (the intake read holds the quests too). */
export const INBOX_READS = [
  { path: "/api/admin/proposals", sources: ["connector"] },
  { path: "/api/review/queue", sources: ["intake", "quest"] },
  { path: "/api/admin/quest-claims", sources: ["claim"] },
  { path: "/api/approval-inbox", sources: ["approval"] },
  { path: "/api/agent-proposals/waiting", sources: ["agent"] },
  { path: "/api/saberra/differences", sources: ["sera"] },
] as const satisfies ReadonlyArray<{ path: string; sources: readonly InboxSource[] }>;

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
      key: id.startsWith("draft:") ? `agent:draft:${id.slice("draft:".length)}` : kind === "seating" ? `agent:seating:${id}` : `approval:${id}`,
      source: id.startsWith("draft:") || kind === "seating" ? ("agent" as const) : ("approval" as const),
      kind,
      code: null,
      summary: line(c.title, "An approval"),
      filedAt: str(c.at),
      batch: null,
      decideAt: "/approvals",
      touchesPerson: kind === "seating",
    }];
  });
}

/** Agent role changes and seatings (`GET /api/agent-proposals/waiting`). The same rows the approvals read lists. */
export function fromAgentWaiting(body: unknown): InboxItem[] {
  const b = obj(body);
  const drafts = list(b?.roleChanges).flatMap((x) => {
    const d = obj(x);
    if (!d || !str(d.draftId)) return [];
    return [{ key: `agent:draft:${d.draftId}`, source: "agent" as const, kind: "role_change", code: null, summary: line(d.title, "A role change"), filedAt: null, batch: null, decideAt: "/review", touchesPerson: false }];
  });
  const seatings = list(b?.seatings).flatMap((x) => {
    const s = obj(x);
    if (!s || !str(s.id)) return [];
    return [{ key: `agent:seating:${s.id}`, source: "agent" as const, kind: "seating", code: null, summary: line(s.title, "A seating"), filedAt: str(s.createdAt), batch: null, decideAt: "/review", touchesPerson: true }];
  });
  return [...drafts, ...seatings];
}

/** Sera's differences (`GET /api/saberra/differences`), each with its one sentence and the batch it came in on. */
export function fromSeraDifferences(body: unknown): InboxItem[] {
  return list(obj(body)?.differences).flatMap((x) => {
    const d = obj(x);
    if (!d || !str(d.key)) return [];
    return [{
      key: `sera:${d.key}`,
      source: "sera" as const,
      kind: String(d.kind ?? "difference"),
      code: null,
      summary: line(obj(d.words)?.sentence, "A difference Sera noticed"),
      filedAt: str(obj(d.source)?.editedAt),
      batch: d.batchId ? { key: `intake:${d.batchId}`, code: null, title: null } : null,
      decideAt: "/review",
      touchesPerson: false,
    }];
  });
}

// ── One list ────────────────────────────────────────────────────────────────

/**
 * The sections as one list: an item two queues both list (an agent's seating or role change is on the approvals read
 * and the agent read) appears once, under the first section that read it. Oldest first; an item whose queue keeps no
 * time goes after those that do, in its queue's own order.
 */
export function mergeSections(sections: readonly InboxSection[]): InboxItem[] {
  const seen = new Set<string>();
  const out: InboxItem[] = [];
  for (const s of sections) {
    if (s.state !== "ok") continue;
    for (const item of s.items) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      out.push(item);
    }
  }
  const timed = out.filter((i) => i.filedAt);
  const untimed = out.filter((i) => !i.filedAt);
  timed.sort((a, b) => a.filedAt!.localeCompare(b.filedAt!) || a.key.localeCompare(b.key));
  return [...timed, ...untimed];
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
    const id = i.key.slice(i.key.indexOf(":") + 1);
    const batchId = i.batch ? i.batch.key.slice(i.batch.key.indexOf(":") + 1) : null;
    return matchesFind(q, { id, code: i.code, batchId, batchCode: i.batch?.code ?? null });
  });
}

/** Whether a search reads as a code, for the page to say "No B-71 that you may see" rather than "nothing matched". */
export const searchedCode = (raw: string): string | null => normalizeCode(raw);
