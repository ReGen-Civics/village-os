/**
 * THE DECIDERS' READ (docs/REVIEW_INBOX_PLAN.md, lane 3): one list of everything waiting on the person asking.
 *
 *   GET /api/admin/review/inbox            every queue's state and number, and the first page of each queue's rows
 *   GET /api/admin/review/inbox?rows=structure:20   the same, with more rows of the queues named
 *   GET /api/admin/review/find?q=B-71      the items a code or id names, among what this person may see
 *
 * VISIBILITY IS DELEGATED, NEVER RE-DECIDED. Each section is the answer of that queue's OWN read route, called over
 * the loopback with the person's own authorization header (the same loopback `runAs` in server/routes/proposedChanges.ts
 * uses to accept a change). So a section holds exactly what that queue's page shows this person today: the one
 * capability gate, every admin shortcut, every module switch and every limit answer here as they answer there, and
 * nothing in this file can widen them. The pure half (shared/reviewInbox.ts) keeps only what a list needs, which is
 * less than any of those reads carries.
 *
 * PAGED HERE, PER QUEUE (the hall relief, 27 Nov 2026: the live list drew 185 rows with no paging). A page is
 * `INBOX_PAGE` rows of one queue, in the list's one order (shared/reviewInbox.ts, `orderInbox`: what lapses first, then
 * oldest, then what carries no date). A queue that did not load answers `count: null`: its number is unknown, and no
 * page may draw it as zero.
 *
 * BLOCKED is the one fact added to a row: an org chart draft that cannot publish as the village stands, with its
 * first reason. It is worked out only for drafts the person's own reads already listed, and it is what the draft's
 * own decide read (`GET /api/org/drafts/:id/decide`) tells any signed-in person.
 *
 * READ-ONLY. Nothing here writes, decides or moves anything. The `/admin/` prefix names the page, not a gate: a steward
 * who is not an admin reads this, and is refused only by the queues they cannot open.
 */
import type express from "express";
import { governanceNow, nowVoice } from "../../shared/governanceNow";
import { weightModeNow } from "../lib/governanceWeights";
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import {
  findInInbox,
  INBOX_PAGE,
  INBOX_READS,
  INBOX_SOURCES,
  mergeSections,
  pageInbox,
  rowsAsked,
  searchedCode,
  stateOfStatus,
  type InboxBlocked,
  type InboxItem,
  type InboxSection,
  type InboxSource,
  type SectionState,
} from "../../shared/reviewInbox";
import { getPool } from "../db/pool";
import { blockedLinesOf, draftChangeCap, listDrafts, loadPreviewContext, previewLoadedDraft } from "../lib/orgDrafts";
import { communityChanges, communityHands, communityVotes, communityWaiting, type CommunityAnswer, type CommunityRead } from "../../shared/communityReview";

type Deps = Pick<AppDeps, "authedUser" | "overLimit"> & {
  port: () => number;
  clientIp: (req: express.Request) => string | null;
  /** A member at the member stage or past it who has not left: the community face's gate (the lead, 25 Nov 2026). */
  isMember: (user: any) => Promise<boolean>;
  /** The Blocked check for listed drafts. Left out everywhere but a test: the chart's own read (`blockedDraftsNow`). */
  blockedDrafts?: InboxFacts["blockedDrafts"];
};

type Read = (path: string) => Promise<{ status: number; body: unknown }>;

/** Each queue's own read, as the person in this request. Timed out or unreadable is a failed section, never empty. */
function readAs(req: express.Request, deps: Deps): Read {
  return async (path) => {
    try {
      const r = await fetch(`http://127.0.0.1:${deps.port()}${path}`, { // module-review-ok: the loopback to this same process, read as the person asking, never an outside host
        method: "GET",
        headers: {
          authorization: String(req.headers.authorization ?? ""),
          accept: "application/json",
          ...(deps.clientIp(req) ? { "x-forwarded-for": deps.clientIp(req)! } : {}),
        },
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      const text = await r.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        return { status: 502, body: null };
      }
      return { status: r.status, body };
    } catch {
      return { status: 504, body: null };
    }
  };
}

/** What the list adds to a row beyond its queue's own read. Injected, so the visibility test runs without it. */
export interface InboxFacts {
  /** Of these org chart drafts, the ones that cannot publish as the village stands, each with its first reason. */
  blockedDrafts: (draftIds: readonly string[]) => Promise<Map<string, InboxBlocked>>;
}

const DRAFT_KEY = "structure:";

/**
 * The open drafts among `draftIds` that cannot publish now. One read of the open drafts and one of the chart, then
 * each draft previewed in memory by the rule its own decide read uses (`draftReadiness`). A draft that cannot be
 * previewed at all is blocked too, and says so.
 */
export async function blockedDraftsNow(draftIds: readonly string[]): Promise<Map<string, InboxBlocked>> {
  const out = new Map<string, InboxBlocked>();
  if (!draftIds.length) return out;
  const want = new Set(draftIds);
  const pool = getPool();
  const [drafts, context] = await Promise.all([listDrafts(pool, { status: "open" }), loadPreviewContext(pool)]);
  for (const d of drafts) {
    if (!want.has(d.id)) continue;
    try {
      const preview = previewLoadedDraft(d, context, draftChangeCap());
      if (preview.blocked <= 0) continue;
      const first = blockedLinesOf(preview.lines)[0];
      out.set(d.id, { count: preview.blocked, reads: first?.reads || null, why: first?.blocked ?? "Something in it cannot be applied" });
    } catch {
      out.set(d.id, { count: 1, reads: null, why: "This draft could not be previewed, so it cannot be published" });
    }
  }
  return out;
}

/**
 * Every queue, read as the person, in one shape. Exported for the test that holds the visibility rule.
 *
 * A source fed by more than one read (the agent's items are on the approvals read and the agent read; open proposals
 * on waiting-on-me and the intake desk) is `ok` when every read that answered it answered, `failed` when any of them
 * failed (and still lists what the others gave), `refused` when none would let this person in, and `off` when its
 * module is off.
 */
export async function readInbox(read: Read, facts?: InboxFacts): Promise<InboxSection[]> {
  const answers = await Promise.all(INBOX_READS.map(async (r) => ({ r, a: await read(r.path) })));
  const states = new Map<InboxSource, SectionState[]>();
  const items = new Map<InboxSource, Map<string, InboxItem>>();
  for (const { r, a } of answers) {
    const state = stateOfStatus(a.status);
    let got: InboxItem[] = [];
    if (state === "ok") {
      try {
        got = r.read(a.body);
      } catch {
        got = [];
      }
    }
    for (const source of r.sources) {
      states.set(source, [...(states.get(source) ?? []), state]);
      const bucket = items.get(source) ?? new Map<string, InboxItem>();
      for (const item of got) if (item.source === source && !bucket.has(item.key)) bucket.set(item.key, item);
      items.set(source, bucket);
    }
  }
  const sections: InboxSection[] = [];
  for (const source of INBOX_SOURCES) {
    const s = states.get(source);
    if (!s) continue;
    const state: SectionState = s.includes("failed") ? "failed" : s.includes("ok") ? "ok" : s.includes("refused") ? "refused" : "off";
    sections.push({ source, state, items: Array.from(items.get(source)?.values() ?? []) });
  }
  if (facts) await markBlocked(sections, facts);
  return sections;
}

/** Marks the listed drafts that cannot publish. A check that fails marks nothing: unknown is never said as blocked. */
async function markBlocked(sections: InboxSection[], facts: InboxFacts): Promise<void> {
  const drafts = sections.flatMap((s) => s.items).filter((i) => i.key.startsWith(DRAFT_KEY));
  if (!drafts.length) return;
  let blocked: Map<string, InboxBlocked>;
  try {
    blocked = await facts.blockedDrafts(Array.from(new Set(drafts.map((i) => i.key.slice(DRAFT_KEY.length)))));
  } catch {
    return;
  }
  for (const item of drafts) {
    const b = blocked.get(item.key.slice(DRAFT_KEY.length));
    if (b) item.blocked = b;
  }
}

/**
 * THE COMMUNITY FACE'S READ (lane 6, shared/communityReview.ts): the four reads a member takes part through, made as
 * the member, each projected by its allowlist. A read that failed says so; nothing else of the source row survives.
 */
export async function readCommunity(read: Read, me: string): Promise<CommunityAnswer> {
  const [ballots, changes, hands, waiting] = await Promise.all([
    read("/api/governance/ballots"),
    read("/api/change-requests"),
    read("/api/powers/hands"),
    read("/api/governance/waiting-on-me"),
  ]);
  const ok = (a: { status: number }) => stateOfStatus(a.status) === "ok";
  const safe = <T,>(f: () => T, empty: T): T => {
    try {
      return f();
    } catch {
      return empty;
    }
  };
  const c = ok(changes) ? safe(() => communityChanges(changes.body), { open: [], yours: [] }) : { open: [], yours: [] };
  const h = ok(hands) ? safe(() => communityHands(hands.body, me), { open: [], yours: [] }) : { open: [], yours: [] };
  const reads: CommunityAnswer["reads"] = (
    [
      ["ballots", ballots],
      ["changes", changes],
      ["hands", hands],
      ["waiting", waiting],
    ] as [CommunityRead, { status: number }][]
  ).map(([name, a]) => ({ name, state: stateOfStatus(a.status) }));
  return {
    open: [...(ok(ballots) ? safe(() => communityVotes(ballots.body), []) : []), ...c.open, ...h.open],
    waiting: ok(waiting) ? safe(() => communityWaiting(waiting.body), []) : [],
    yours: [...c.yours, ...h.yours],
    reads,
  };
}

export function register(app: Express, deps: Deps): void {
  const { authedUser, overLimit } = deps;
  const facts: InboxFacts = { blockedDrafts: deps.blockedDrafts ?? blockedDraftsNow };

  app.get("/api/admin/review/inbox", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in first." });
    if (await overLimit(`review-inbox:${String(user.id)}`, 60, 60_000)) return res.status(429).json({ error: "too_many" });
    // `?rows=structure:20`: more of a queue a person opened past its first page. Every queue is read again each time,
    // because one item is listed once ACROSS queues and only the whole read knows which queue it sits in.
    const paged = pageInbox(await readInbox(readAs(req, deps), facts), rowsAsked(req.query.rows));
    res.set("Cache-Control", "no-store");
    res.json({
      sections: paged.sections,
      items: paged.items,
      // THE ONE COUNT (shared/reviewInbox.ts, `decisionCounts`): worked out for this person on this read, from their
      // own queues, and kept nowhere. `waiting` is every row listed, for a page that needs to know the list is empty.
      counts: { ...paged.counts, waiting: paged.waiting },
      pageSize: INBOX_PAGE,
    });
  });

  // Members only: signed out is asked to sign in, and a visitor or a former member is refused, reading nothing.
  app.get("/api/review/community", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in first." });
    if (!(await deps.isMember(user))) return res.status(403).json({ error: "members_only", message: "This is for members of the village." });
    if (await overLimit(`review-community:${String(user.id)}`, 60, 60_000)) return res.status(429).json({ error: "too_many" });
    res.set("Cache-Control", "no-store");
    res.json(await readCommunity(readAs(req, deps), String(user.id)));
  });

  /**
   * THE GOVERNANCE PAGE'S NOW (the Governance brief, step 2): what waits for this member's voice, what closes soon,
   * what they brought, and their voice. Members only, refused before any read. Every part is an allowlisted projection
   * (shared/governanceNow.ts), built from the member's own reads, never from a deciders' payload.
   */
  app.get("/api/governance/now", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in first." });
    if (!(await deps.isMember(user))) return res.status(403).json({ error: "members_only", message: "This is for members of the village." });
    if (await overLimit(`governance-now:${String(user.id)}`, 60, 60_000)) return res.status(429).json({ error: "too_many" });
    res.set("Cache-Control", "no-store");
    const read = readAs(req, deps);
    const [community, progression] = await Promise.all([readCommunity(read, String(user.id)), read("/api/game/progression")]);
    const catalogue = stateOfStatus(progression.status) === "ok" ? (progression.body as { capabilityCatalogue?: unknown } | null)?.capabilityCatalogue : [];
    res.json(governanceNow(community, nowVoice(weightModeNow(), catalogue), new Date()));
  });

  app.get("/api/admin/review/find", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in first." });
    if (await overLimit(`review-inbox:${String(user.id)}`, 60, 60_000)) return res.status(429).json({ error: "too_many" });
    const q = String(req.query.q ?? "").slice(0, 80);
    const found = findInInbox(mergeSections(await readInbox(readAs(req, deps), facts)), q);
    res.set("Cache-Control", "no-store");
    // A code that does not exist and a code this person may not see answer the same, so codes cannot be probed.
    if (!found.length) return res.status(404).json({ error: "not_found", code: searchedCode(q) });
    res.json({ items: found, code: searchedCode(q) });
  });
}
