/**
 * THE LIVE VIEW FOR QA (the lead, 25 Nov 2026).
 *
 * "ALL lanes need to have access to the live site, we have a QA role in the
 * game." Since the portal entrance stands in front of the game, a signed-out
 * browser (every QA crawl, every lane's Playwright) meets the entrance in place
 * of the page, and the only way past it for automation was the village's one
 * shared pass. A shared secret handed to every lane is exactly what this
 * replaces.
 *
 * HOW IT WORKS. A member seated in a role that carries `qa.live_view` makes a
 * personal token with the `live.view` scope on their own profile (Your agent,
 * Mint a token). It is an ordinary agent token: hashed at rest, shown once,
 * revocable, ended by a new password, and it lives a week by default
 * (`tokenTtlDays`). The browser keeps it where the app keeps its sign-in, and
 * sends it as `Authorization: Bearer vat_...` on every API call. This
 * middleware, mounted ahead of the people lock and the entrance, then:
 *
 *   - leaves every request alone that does not carry a live, live.view token,
 *     so nothing that works today changes;
 *   - refuses every method other than GET and HEAD, 403 `live_view_read_only`,
 *     whatever else the holder may do. Read-only is a property of the token,
 *     so a QA crawl cannot post, vote, pay or decide by accident even when its
 *     holder could do those things signed in by hand;
 *   - asks THE gate (`mayView`, which is `capabilityDecision("qa.live_view")`
 *     in server/index.ts) on every request, so a holder unseated a minute ago
 *     is refused now, 403 `live_view_not_held`;
 *   - turns a read into an in-process session as the holder, the way the agent
 *     gateway does, so the request is the member's own read: it passes the
 *     entrance as any signed-in member does and sees what they would see.
 *     The session is minted for this request and never sent back.
 *
 * The agent paths (`/api/agent/v1`) are left to the agent gateway, which reads
 * the token natively and opens nothing for a scope it does not know.
 */
import type { NextFunction, Request, Response } from "express";
import { isAgentBearer, LIVE_VIEW_SCOPE, type AgentTokenRow } from "./agentTokens";

/** Reads a browser crawl may make in an hour on one token. A page draws ten or twenty. */
export const LIVE_VIEW_READS_PER_HOUR = 3000;

/** The paths the agent gateway answers itself. */
export const LIVE_VIEW_SKIPS: readonly string[] = ["/api/agent/v1"];

export interface LiveViewDeps {
  verify(token: string): Promise<{ ok: true; row: AgentTokenRow } | { ok: false; reason?: string }>;
  userById(id: string): Promise<any | null>;
  /** Whether the account still stands (not erased, not a tombstone). */
  stands(user: any): boolean;
  /** THE gate: whether this member holds `qa.live_view` now. */
  mayView(user: any): Promise<boolean>;
  /** An in-process session for this member, for this one request. */
  sessionFor(user: any): string;
  overLimit(bucket: string, max: number, windowMs: number): Promise<boolean>;
}

/** What a request turned into a live view carries, for a route that wants to know. */
export interface LiveViewMark {
  tokenId: string;
  prefix: string;
}

const READS = new Set(["GET", "HEAD"]);

export function liveViewMiddleware(deps: LiveViewDeps) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!isAgentBearer(header) || !req.path.startsWith("/api/")) return next();
    let verified: Awaited<ReturnType<LiveViewDeps["verify"]>>;
    try {
      verified = await deps.verify(String(header).slice(7));
    } catch {
      res.status(503).json({ error: "unavailable", message: "This page is not available right now. Try again in a moment." });
      return;
    }
    // Not a live view token: whatever handled it before still handles it.
    if (!verified.ok || !verified.row.scopes.includes(LIVE_VIEW_SCOPE as AgentTokenRow["scopes"][number])) return next();
    const row = verified.row;
    if (!READS.has(req.method)) {
      res.status(403).json({ error: "live_view_read_only", message: "A live view token only reads. Sign in by hand to change anything." });
      return;
    }
    if (LIVE_VIEW_SKIPS.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return next();
    try {
      const user = await deps.userById(row.userId);
      if (!user || !deps.stands(user)) {
        res.status(401).json({ error: "live_view_invalid", message: "The account this token belongs to is gone." });
        return;
      }
      if (!(await deps.mayView(user))) {
        res.status(403).json({ error: "live_view_not_held", message: "This token's holder no longer holds a role that carries the live view for QA." });
        return;
      }
      if (await deps.overLimit(`live-view:${row.id}`, LIVE_VIEW_READS_PER_HOUR, 60 * 60 * 1000)) {
        res.status(429).json({ error: "live_view_rate_limited", message: `This token made ${LIVE_VIEW_READS_PER_HOUR} reads in the last hour. Wait a while.` });
        return;
      }
      req.headers.authorization = `Bearer ${deps.sessionFor(user)}`;
      (req as any).liveView = { tokenId: row.id, prefix: row.prefix } satisfies LiveViewMark;
      res.setHeader("X-Live-View", "read-only");
      next();
    } catch {
      // A gate that cannot read its own record fails closed.
      res.status(503).json({ error: "unavailable", message: "This page is not available right now. Try again in a moment." });
    }
  };
}
