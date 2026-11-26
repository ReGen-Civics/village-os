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
 *     gateway does, so it passes the entrance as any signed-in member does.
 *     The session is minted for this request and never sent back;
 *   - marks the read to be answered as a PLAIN MEMBER (server/lib/readAsMember.ts):
 *     an admin's token reads no admin route, no editor's door, no pay terms
 *     and no key held only by being an admin. "Read-only QA" never becomes
 *     an admin's view in a lane's browser.
 *
 * The agent paths (`/api/agent/v1`) are left to the agent gateway, which reads
 * the token natively and opens nothing for a scope it does not know.
 */
import type { NextFunction, Request, Response } from "express";
import { isAgentBearer, LIVE_VIEW_ADMIN_SCOPE, LIVE_VIEW_SCOPE, type AgentTokenRow } from "./agentTokens";
import { READ_AS_MEMBER_HEADER, READ_AS_MEMBER_VALUE } from "./readAsMember";
import { normalizePath, refusedForAdminView } from "./liveViewAdmin";
import { outsideReadOnly, runReadOnly } from "../db/readOnlyRequest";

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
  /**
   * THE ADMIN LIVE VIEW (`live.view.admin`): whether this holder may read Admin through it now, which is the live
   * view for QA AND an admin's own access, both asked of the gate on every request. Absent, no admin token passes.
   */
  mayViewAdmin?(user: any): Promise<boolean>;
  /** The admin live view's audit line, at most once an hour per token. Written outside the read-only mark. */
  auditAdminView?(user: any, row: AgentTokenRow): Promise<void>;
}

/** How often the admin live view writes its audit line per token. */
export const LIVE_VIEW_ADMIN_AUDIT_MS = 60 * 60 * 1000;

/** What a request turned into a live view carries, for a route that wants to know. */
export interface LiveViewMark {
  tokenId: string;
  prefix: string;
}

const READS = new Set(["GET", "HEAD"]);

export function liveViewMiddleware(deps: LiveViewDeps) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    // Judged the way the router matches (case-insensitive, decoded), so /API/... cannot step round the live view.
    const where = normalizePath(req.path);
    if (!isAgentBearer(header) || !where.startsWith("/api/")) return next();
    let verified: Awaited<ReturnType<LiveViewDeps["verify"]>>;
    try {
      verified = await deps.verify(String(header).slice(7));
    } catch {
      res.status(503).json({ error: "unavailable", message: "This page is not available right now. Try again in a moment." });
      return;
    }
    // Not a live view token: whatever handled it before still handles it.
    if (!verified.ok) return next();
    const row = verified.row;
    const asAdmin = row.scopes.includes(LIVE_VIEW_ADMIN_SCOPE as AgentTokenRow["scopes"][number]);
    if (!asAdmin && !row.scopes.includes(LIVE_VIEW_SCOPE as AgentTokenRow["scopes"][number])) return next();
    if (!READS.has(req.method)) {
      res.status(403).json({ error: "live_view_read_only", message: "A live view token only reads. Sign in by hand to change anything." });
      return;
    }
    if (LIVE_VIEW_SKIPS.some((p) => where === p || where.startsWith(`${p}/`))) return next();
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
      if (asAdmin && !(deps.mayViewAdmin && (await deps.mayViewAdmin(user)))) {
        res.status(403).json({ error: "live_view_admin_not_held", message: "This token's holder no longer holds both the live view for QA and an admin's access." });
        return;
      }
      if (asAdmin) {
        const refused = refusedForAdminView(req.path);
        if (refused) {
          res.status(403).json({ error: "live_view_admin_refused", message: "The admin live view never reads exports, downloads, secrets or tokens." });
          return;
        }
      }
      if (await deps.overLimit(`live-view:${row.id}`, LIVE_VIEW_READS_PER_HOUR, 60 * 60 * 1000)) {
        res.status(429).json({ error: "live_view_rate_limited", message: `This token made ${LIVE_VIEW_READS_PER_HOUR} reads in the last hour. Wait a while.` });
        return;
      }
      req.headers.authorization = `Bearer ${deps.sessionFor(user)}`;
      (req as any).liveView = { tokenId: row.id, prefix: row.prefix } satisfies LiveViewMark;
      if (!asAdmin) {
        // Read as a PLAIN MEMBER, whatever the holder's own powers (the coordinator, 25 Nov 2026): no admin, no
        // editor's door, no pay terms (server/lib/readAsMember.ts, the one helper for this). QA sees what a member sees.
        req.headers[READ_AS_MEMBER_HEADER] = READ_AS_MEMBER_VALUE;
        res.setHeader("X-Live-View", "read-only");
        next();
        return;
      }
      // The admin live view: the holder's own admin access, and NO WRITE AT ALL, whatever the handler's method says
      // (server/db/readOnlyRequest.ts). The audit line is the one write, made outside that mark, once an hour.
      res.setHeader("X-Live-View", "read-only; admin");
      if (deps.auditAdminView && !(await deps.overLimit(`live-view-admin-audit:${row.id}`, 1, LIVE_VIEW_ADMIN_AUDIT_MS))) {
        await outsideReadOnly(() => deps.auditAdminView!(user, row)).catch(() => undefined);
      }
      runReadOnly("the admin live view", () => next());
    } catch {
      // A gate that cannot read its own record fails closed.
      res.status(503).json({ error: "unavailable", message: "This page is not available right now. Try again in a moment." });
    }
  };
}
