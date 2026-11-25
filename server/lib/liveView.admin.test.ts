/**
 * THE ADMIN LIVE VIEW (`live.view.admin`; the lead's second pass over Admin, the coordinator's approved design,
 * 25 Nov 2026). The same read-only live view, read as the holder's own admin access:
 *
 *   - minted alone, offered only to a holder with BOTH the live view and an admin's access, lives one day;
 *   - asks both again on every request, and refuses every non-GET;
 *   - reads WITHOUT the plain-member mark, says "read-only; admin", and runs the request with writes refused;
 *   - refuses exports, downloads, secrets and tokens by name;
 *   - writes one audit line an hour per token, outside the read-only mark.
 *
 * The middleware runs against fakes for its dependencies, as in liveView.test.ts.
 */
import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { liveViewMiddleware, type LiveViewDeps } from "./liveView";
import { cleanScopes, LIVE_VIEW_ADMIN_SCOPE, tokenTtlDays, type AgentTokenRow } from "./agentTokens";
import { readsAsPlainMember } from "./readAsMember";
import { readOnlyReason } from "../db/readOnlyRequest";
import { offeredScopes } from "./agentOAuth";

const TOKEN = "vat_" + "x".repeat(43);

function row(scopes: string[]): AgentTokenRow {
  return {
    id: "atk-9", userId: "u1", name: "QA admin", prefix: "vat_yyyyyy", scopes: scopes as AgentTokenRow["scopes"],
    createdAt: "", lastUsedAt: null, expiresAt: new Date(Date.now() + 86400000).toISOString(), revokedAt: null,
  };
}

function deps(over: Partial<LiveViewDeps> & { scopes?: string[] } = {}): LiveViewDeps & { audits: string[]; hits: string[] } {
  const audits: string[] = [];
  const hits: string[] = [];
  const seen = new Set<string>();
  return {
    audits,
    hits,
    verify: async () => ({ ok: true, row: row(over.scopes ?? [LIVE_VIEW_ADMIN_SCOPE]) }),
    userById: async () => ({ id: "u1", email: "qa@example.invalid", role: "admin", tokenVersion: 0 }),
    stands: () => true,
    mayView: async () => true,
    mayViewAdmin: async () => true,
    sessionFor: () => "session-for-u1",
    // The audit bucket allows one per window; every other bucket is under its limit.
    overLimit: async (b) => {
      hits.push(b);
      if (!b.startsWith("live-view-admin-audit:")) return false;
      if (seen.has(b)) return true;
      seen.add(b);
      return false;
    },
    auditAdminView: async (_u, r) => {
      // The audit line is written OUTSIDE the read-only mark, or it could not land at all.
      audits.push(`${r.prefix}:${readOnlyReason() ?? "may-write"}`);
    },
    ...over,
  };
}

async function run(d: LiveViewDeps, method: string, path: string) {
  const req: any = { method, path, headers: { authorization: `Bearer ${TOKEN}` } };
  const out: { status?: number; body?: any; next: boolean; headers: Record<string, string>; readOnly: string | null } = { next: false, headers: {}, readOnly: null };
  const res: any = {
    status(n: number) { out.status = n; return res; },
    json(b: unknown) { out.body = b; return res; },
    setHeader(k: string, v: string) { out.headers[k] = v; },
  };
  await liveViewMiddleware(d)(req as Request, res as Response, () => {
    out.next = true;
    out.readOnly = readOnlyReason();
  });
  return { ...out, auth: req.headers.authorization as string | undefined, plain: readsAsPlainMember(req) };
}

describe("the admin live view", () => {
  it("reads as the holder's own admin access, marked read-only; admin, with writes refused for the whole request", async () => {
    const r = await run(deps(), "GET", "/api/admin/players");
    expect(r.next).toBe(true);
    expect(r.auth).toBe("Bearer session-for-u1");
    expect(r.plain).toBe(false);
    expect(r.headers["X-Live-View"]).toBe("read-only; admin");
    expect(r.readOnly).toBe("the admin live view");
  });

  it("leaves the member live view as it was: the plain-member mark, plain read-only, no write refusal", async () => {
    const r = await run(deps({ scopes: ["live.view"] }), "GET", "/api/admin/players");
    expect(r.plain).toBe(true);
    expect(r.headers["X-Live-View"]).toBe("read-only");
    expect(r.readOnly).toBeNull();
  });

  it("refuses every method other than GET and HEAD", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const r = await run(deps(), method, "/api/admin/players");
      expect([method, r.status, r.body?.error, r.next]).toEqual([method, 403, "live_view_read_only", false]);
    }
  });

  it("asks both conditions on every request: losing the admin's access or the QA seat ends it now", async () => {
    const notAdmin = await run(deps({ mayViewAdmin: async () => false }), "GET", "/api/admin/players");
    expect([notAdmin.status, notAdmin.body?.error, notAdmin.next]).toEqual([403, "live_view_admin_not_held", false]);
    const notSeated = await run(deps({ mayView: async () => false }), "GET", "/api/admin/players");
    expect([notSeated.status, notSeated.body?.error, notSeated.next]).toEqual([403, "live_view_not_held", false]);
    const noCheck = await run(deps({ mayViewAdmin: undefined }), "GET", "/api/admin/players");
    expect([noCheck.status, noCheck.body?.error]).toEqual([403, "live_view_admin_not_held"]);
  });

  it("refuses exports, downloads, secrets and tokens by name, and reads of who holds what stay open", async () => {
    for (const path of ["/api/admin/export/database", "/api/admin/entrance/entries.csv", "/api/admin/submission-attachments/form-123.pdf", "/api/admin/member-tasks/u9/export", "/api/admin/integrations", "/api/agent/tokens", "/api/admin/agent-accounts"]) {
      const r = await run(deps(), "GET", path);
      expect([path, r.status, r.body?.error, r.next]).toEqual([path, 403, "live_view_admin_refused", false]);
    }
    expect((await run(deps(), "GET", "/api/powers/hands")).next).toBe(true);
  });

  it("writes its audit line once an hour per token, outside the read-only mark", async () => {
    const d = deps();
    await run(d, "GET", "/api/admin/players");
    await run(d, "GET", "/api/admin/org");
    expect(d.audits).toEqual(["vat_yyyyyy:may-write"]);
  });
});

describe("minting the admin live view", () => {
  it("is offered only to a holder with both conditions, alone, for one day", () => {
    expect(cleanScopes([LIVE_VIEW_ADMIN_SCOPE], { intentsAllowed: false, liveViewAllowed: true, liveViewAdminAllowed: true })).toEqual({ ok: true, scopes: [LIVE_VIEW_ADMIN_SCOPE] });
    const refused = cleanScopes([LIVE_VIEW_ADMIN_SCOPE], { intentsAllowed: false, liveViewAllowed: true, liveViewAdminAllowed: false });
    expect(refused.ok).toBe(false);
    const mixed = cleanScopes([LIVE_VIEW_ADMIN_SCOPE, "live.view"], { intentsAllowed: false, liveViewAllowed: true, liveViewAdminAllowed: true });
    expect(mixed.ok).toBe(false);
    expect(tokenTtlDays([LIVE_VIEW_ADMIN_SCOPE], 30)).toBe(1);
    expect(tokenTtlDays([LIVE_VIEW_ADMIN_SCOPE], undefined)).toBe(1);
  });

  it("is never offered through the connector's sign-in (OAuth), whatever extras a member's rules allow", () => {
    expect(offeredScopes([LIVE_VIEW_ADMIN_SCOPE, "live.view"] as any)).not.toContain(LIVE_VIEW_ADMIN_SCOPE);
    expect(offeredScopes([LIVE_VIEW_ADMIN_SCOPE, "live.view"] as any)).not.toContain("live.view");
  });
});
