/**
 * THE DECIDERS' READ (docs/REVIEW_INBOX_PLAN.md, lane 3): one list of everything waiting on the person asking.
 *
 *   GET /api/admin/review/inbox            every queue, as one list, with each queue's state
 *   GET /api/admin/review/find?q=B-71      the items a code or id names, among what this person may see
 *
 * VISIBILITY IS DELEGATED, NEVER RE-DECIDED. Each section is the answer of that queue's OWN read route, called over
 * the loopback with the person's own authorization header (the same loopback `runAs` in server/routes/proposedChanges.ts
 * uses to accept a change). So a section holds exactly what that queue's page shows this person today: the one
 * capability gate, every admin shortcut, every module switch and every limit answer here as they answer there, and
 * nothing in this file can widen them. The pure half (shared/reviewInbox.ts) keeps only what a list needs, which is
 * less than any of those reads carries.
 *
 * READ-ONLY. Nothing here writes, decides or moves anything. The `/admin/` prefix names the page, not a gate: a steward
 * who is not an admin reads this, and is refused only by the queues they cannot open.
 */
import type express from "express";
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import {
  findInInbox,
  INBOX_READS,
  INBOX_SOURCES,
  mergeSections,
  searchedCode,
  stateOfStatus,
  type InboxItem,
  type InboxSection,
  type InboxSource,
  type SectionState,
} from "../../shared/reviewInbox";

type Deps = Pick<AppDeps, "authedUser" | "overLimit"> & {
  port: () => number;
  clientIp: (req: express.Request) => string | null;
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

/**
 * Every queue, read as the person, in one shape. Exported for the test that holds the visibility rule.
 *
 * A source fed by more than one read (the agent's items are on the approvals read and the agent read; open proposals
 * on waiting-on-me and the intake desk) is `ok` when every read that answered it answered, `failed` when any of them
 * failed (and still lists what the others gave), `refused` when none would let this person in, and `off` when its
 * module is off.
 */
export async function readInbox(read: Read): Promise<InboxSection[]> {
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
  return sections;
}

export function register(app: Express, deps: Deps): void {
  const { authedUser, overLimit } = deps;

  app.get("/api/admin/review/inbox", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in first." });
    if (await overLimit(`review-inbox:${String(user.id)}`, 60, 60_000)) return res.status(429).json({ error: "too_many" });
    const sections = await readInbox(readAs(req, deps));
    const items = mergeSections(sections);
    res.set("Cache-Control", "no-store");
    res.json({
      sections: sections.map((s) => ({ source: s.source, state: s.state, count: s.items.length })),
      items,
      counts: { waiting: items.length },
    });
  });

  app.get("/api/admin/review/find", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in first." });
    if (await overLimit(`review-inbox:${String(user.id)}`, 60, 60_000)) return res.status(429).json({ error: "too_many" });
    const q = String(req.query.q ?? "").slice(0, 80);
    const found = findInInbox(mergeSections(await readInbox(readAs(req, deps))), q);
    res.set("Cache-Control", "no-store");
    // A code that does not exist and a code this person may not see answer the same, so codes cannot be probed.
    if (!found.length) return res.status(404).json({ error: "not_found", code: searchedCode(q) });
    res.json({ items: found, code: searchedCode(q) });
  });
}
