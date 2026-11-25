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
  fromAgentWaiting,
  fromApprovals,
  fromClaims,
  fromConnector,
  fromReviewQueue,
  fromSeraDifferences,
  INBOX_READS,
  mergeSections,
  searchedCode,
  stateOfStatus,
  type InboxSection,
  type InboxSource,
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

/** Every queue, read as the person, in one shape. Exported for the test that holds the visibility rule. */
export async function readInbox(read: Read): Promise<InboxSection[]> {
  const answers = await Promise.all(INBOX_READS.map(async (r) => ({ r, a: await read(r.path) })));
  const sections: InboxSection[] = [];
  for (const { r, a } of answers) {
    const state = stateOfStatus(a.status);
    const items = (source: InboxSource) => {
      if (state !== "ok") return [];
      switch (source) {
        case "connector":
          return fromConnector(a.body);
        case "intake":
          return fromReviewQueue(a.body).intake;
        case "quest":
          return fromReviewQueue(a.body).quest;
        case "claim":
          return fromClaims(a.body);
        case "approval":
          return fromApprovals(a.body);
        case "agent":
          return fromAgentWaiting(a.body);
        case "sera":
          return fromSeraDifferences(a.body);
      }
    };
    for (const source of r.sources) sections.push({ source, state, items: items(source) });
  }
  // The approvals read lists the agent's seatings and role changes too: they belong to the agent section.
  const fromApprovalRead = sections.find((s) => s.source === "approval");
  const agent = sections.find((s) => s.source === "agent");
  if (fromApprovalRead && agent) {
    const moved = fromApprovalRead.items.filter((i) => i.source === "agent");
    fromApprovalRead.items = fromApprovalRead.items.filter((i) => i.source !== "agent");
    if (agent.state === "ok") agent.items = [...agent.items, ...moved.filter((m) => !agent.items.some((x) => x.key === m.key))];
    else if (moved.length) {
      agent.state = "ok";
      agent.items = moved;
    }
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
