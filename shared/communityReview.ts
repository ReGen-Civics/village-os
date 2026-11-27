/**
 * THE COMMUNITY FACE OF /review: ITS OWN PROJECTION (docs/REVIEW_INBOX_PLAN.md, lane 6).
 *
 * What a member reads on /review is built here, from the member's own reads of the queues that are open for their
 * voice, by an ALLOWLIST: each item carries exactly the fields in `COMMUNITY_ITEM_FIELDS` and nothing else. It is never
 * the deciders' payload filtered, so a field a queue adds later never reaches a member by accident.
 *
 * The rules (the lead, 25 Nov 2026, relayed by the coordinator):
 *   - members only (the route holds that gate);
 *   - no applicants and nothing about an application: a vote on a role application is left out whole;
 *   - no amounts;
 *   - no held reasons;
 *   - no other person's words: a raised hand shows the power it asks for, never who raised it or their note; a tension
 *     or done work waiting on your role shows the role, never the text somebody wrote.
 * What IS shown of an open matter is its public title (a vote's question, a change request's title), which is what a
 * member takes part in, on the page they act on.
 */
import { changeRequestHref } from "./changeRequestAddress";

export const COMMUNITY_KINDS = ["vote", "change", "hand", "tension", "task"] as const;
export type CommunityKind = (typeof COMMUNITY_KINDS)[number];

/** The only fields a community item carries. The projection test fails on any other. */
export const COMMUNITY_ITEM_FIELDS = ["id", "kind", "title", "state", "closesAt", "href"] as const;

export interface CommunityItem {
  id: string;
  kind: CommunityKind;
  /** The matter's public title, or the role's name for something waiting on your role. Never anybody's own words. */
  title: string;
  /** Its stage, as a fixed word the page translates (running, in_review, voting, open...), or null. */
  state: string | null;
  closesAt: string | null;
  /** The page where the member takes part. Always a path inside the app. */
  href: string;
}

export interface CommunityAnswer {
  /** Open for your voice: votes you may cast, change requests in review or a vote, hands you may put to the village. */
  open: CommunityItem[];
  /** Waiting on you because of a role you hold: tensions raised with it, done work to accept. */
  waiting: CommunityItem[];
  /** What you filed, and where each one stands. */
  yours: CommunityItem[];
  /** Each read's state, so a read that failed says so and is never shown as nothing. */
  reads: { name: CommunityRead; state: "ok" | "failed" | "refused" | "off" }[];
}

export const COMMUNITY_READS = ["ballots", "changes", "hands", "waiting"] as const;
export type CommunityRead = (typeof COMMUNITY_READS)[number];

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const line = (v: unknown, fallback: string) => (str(v) ?? fallback).replace(/\s+/g, " ").slice(0, 160);
/** A word the page translates: lowercase letters and underscores, bounded. Anything else is dropped. */
const word = (v: unknown): string | null => (typeof v === "string" && /^[a-z_]{1,24}$/.test(v) ? v : null);
const day = (v: unknown): string | null => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const safeId = (v: unknown): string | null => {
  const s = typeof v === "string" || typeof v === "number" ? String(v) : "";
  return /^[A-Za-z0-9_.:-]{1,64}$/.test(s) ? s : null;
};

/** Build one item from exactly the allowlisted fields, so no spread of a source row can ever add another. */
function item(id: string, kind: CommunityKind, title: string, state: string | null, closesAt: string | null, href: string): CommunityItem {
  return { id, kind, title, state, closesAt, href };
}

/** `GET /api/governance/ballots`: running votes this member may cast and has not. Never a vote on a role application. */
export function communityVotes(body: unknown): CommunityItem[] {
  return list(body).flatMap((x) => {
    const v = obj(x);
    const id = safeId(v?.id);
    if (!v || !id || v.status !== "running" || v.myWeight === null || v.myWeight === undefined || v.myVote) return [];
    if (v.subjectType === "role_application" || v.subjectType === "seat_application") return [];
    return [item(id, "vote", line(v.title, "A vote"), "running", day(v.closesAt), `/decisions/${id}`)];
  });
}

/** `GET /api/change-requests`: others' requests in review or a vote (open), and the member's own (yours). */
export function communityChanges(body: unknown): { open: CommunityItem[]; yours: CommunityItem[] } {
  const b = obj(body);
  const one = (x: unknown) => {
    const c = obj(x);
    const id = safeId(c?.id);
    return c && id ? item(id, "change", line(c.title, "A change request"), word(c.state), null, changeRequestHref(id)) : null;
  };
  return {
    open: list(b?.open).map(one).filter((c): c is CommunityItem => !!c),
    yours: list(b?.mine).map(one).filter((c): c is CommunityItem => !!c),
  };
}

/** `GET /api/powers/hands`: hands this member may put to the village (open), and their own (yours). By power, never by person. */
export function communityHands(body: unknown, me: string): { open: CommunityItem[]; yours: CommunityItem[] } {
  const open: CommunityItem[] = [];
  const yours: CommunityItem[] = [];
  for (const x of list(obj(body)?.hands)) {
    const h = obj(x);
    const id = safeId(h?.id);
    if (!h || !id) continue;
    const it = item(id, "hand", line(h.powerLabel, "A power"), word(h.status), null, "/powers");
    if (String(h.userId ?? "") === me) yours.push(it);
    else if (h.youMayPut === true) open.push(it);
  }
  return { open, yours };
}

/** `GET /api/governance/waiting-on-me`: what waits on a role this member holds, named by the role and never by its words. */
export function communityWaiting(body: unknown): CommunityItem[] {
  const b = obj(body);
  const tensions = list(b?.raisedWithYou).flatMap((x) => {
    const t = obj(x);
    const id = safeId(t?.id);
    return t && id ? [item(id, "tension", line(t.role, "Your role"), word(t.status), null, "/profile")] : [];
  });
  const tasks = list(b?.toAccept).flatMap((x) => {
    const t = obj(x);
    const id = safeId(t?.entryId);
    return t && id ? [item(id, "task", line(t.role, "Your role"), null, null, "/profile")] : [];
  });
  return [...tensions, ...tasks];
}
