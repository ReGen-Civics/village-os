/**
 * The live view for QA (the lead, 25 Nov 2026): a seated holder's personal
 * token reads the live game as them, past the entrance, and never writes.
 *
 * The middleware is tested against fakes for its five dependencies, so each
 * refusal is pinned by name. The gate itself is pinned at the bottom against
 * the real `capabilityDecision`: only a seat (or an admin) opens it, never a
 * badge and never a stage.
 */
import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { liveViewMiddleware, LIVE_VIEW_READS_PER_HOUR, type LiveViewDeps } from "./liveView";
import { cleanScopes, LIVE_VIEW_DEFAULT_TTL_DAYS, LIVE_VIEW_MAX_TTL_DAYS, tokenTtlDays, type AgentTokenRow } from "./agentTokens";
import { capabilityDecision, type CapabilityCtx } from "../../shared/capabilities";

const TOKEN = "vat_" + "x".repeat(43);

function row(scopes: string[]): AgentTokenRow {
  return {
    id: "atk-1", userId: "u1", name: "QA", prefix: "vat_xxxxxx", scopes: scopes as AgentTokenRow["scopes"],
    createdAt: "", lastUsedAt: null, expiresAt: new Date(Date.now() + 86400000).toISOString(), revokedAt: null,
  };
}

function deps(over: Partial<LiveViewDeps> & { scopes?: string[] } = {}): LiveViewDeps & { hits: string[] } {
  const hits: string[] = [];
  return {
    hits,
    verify: async () => ({ ok: true, row: row(over.scopes ?? ["live.view"]) }),
    userById: async () => ({ id: "u1", email: "qa@example.invalid", tokenVersion: 0 }),
    stands: () => true,
    mayView: async () => true,
    sessionFor: () => "session-for-u1",
    overLimit: async (b) => { hits.push(b); return false; },
    ...over,
  };
}

async function run(d: LiveViewDeps, method: string, path: string, auth: string | null = `Bearer ${TOKEN}`) {
  const req: any = { method, path, headers: auth !== null ? { authorization: auth } : {} };
  const out: { status?: number; body?: any; next: boolean; headers: Record<string, string> } = { next: false, headers: {} };
  const res: any = {
    status(n: number) { out.status = n; return res; },
    json(b: unknown) { out.body = b; return res; },
    setHeader(k: string, v: string) { out.headers[k] = v; },
  };
  await liveViewMiddleware(d)(req as Request, res as Response, () => { out.next = true; });
  return { ...out, auth: req.headers.authorization as string | undefined, mark: req.liveView };
}

describe("the live view middleware", () => {
  it("turns a read into the holder's own session, marked read-only", async () => {
    const r = await run(deps(), "GET", "/api/org");
    expect(r.next).toBe(true);
    expect(r.auth).toBe("Bearer session-for-u1");
    expect(r.mark).toEqual({ tokenId: "atk-1", prefix: "vat_xxxxxx" });
    expect(r.headers["X-Live-View"]).toBe("read-only");
  });

  it("refuses every write, whatever its holder may do signed in", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      const r = await run(deps(), method, "/api/ballots/1/vote");
      expect([method, r.status, r.body.error, r.next]).toEqual([method, 403, "live_view_read_only", false]);
      expect(r.auth).toBe(`Bearer ${TOKEN}`);
    }
  });

  it("refuses a write on the agent paths too, so a live view token mints nothing", async () => {
    const r = await run(deps(), "POST", "/api/agent/tokens");
    expect([r.status, r.body.error]).toEqual([403, "live_view_read_only"]);
  });

  it("asks the gate on every request: an unseated holder is refused now", async () => {
    const r = await run(deps({ mayView: async () => false }), "GET", "/api/org");
    expect([r.status, r.body.error, r.next]).toEqual([403, "live_view_not_held", false]);
    expect(r.auth).toBe(`Bearer ${TOKEN}`);
  });

  it("refuses a token whose account is gone", async () => {
    const r = await run(deps({ stands: () => false }), "GET", "/api/org");
    expect([r.status, r.body.error]).toEqual([401, "live_view_invalid"]);
  });

  it("counts reads per token and stops at the hour's ceiling", async () => {
    const d = deps();
    await run(d, "GET", "/api/org");
    expect(d.hits).toEqual(["live-view:atk-1"]);
    const over = await run(deps({ overLimit: async () => true }), "GET", "/api/org");
    expect([over.status, over.body.error]).toEqual([429, "live_view_rate_limited"]);
    expect(over.body.message).toContain(String(LIVE_VIEW_READS_PER_HOUR));
  });

  it("leaves every other request exactly as it was", async () => {
    // No bearer, a member session, a page, another scope's token, a dead token.
    const cases: Array<[LiveViewDeps, string, string, string | null]> = [
      [deps(), "GET", "/api/org", null],
      [deps(), "POST", "/api/org", "Bearer some.session"],
      [deps(), "GET", "/roles", `Bearer ${TOKEN}`],
      [deps({ scopes: ["moon.read"] }), "POST", "/api/org", `Bearer ${TOKEN}`],
      [deps({ verify: async () => ({ ok: false, reason: "revoked" }) }), "POST", "/api/org", `Bearer ${TOKEN}`],
    ];
    for (const [d, method, path, auth] of cases) {
      const r = await run(d, method, path, auth);
      expect([method, path, r.next, r.status]).toEqual([method, path, true, undefined]);
      expect(r.auth).toBe(auth ?? undefined);
    }
  });

  it("leaves a read on the agent gateway to the gateway, with no session minted", async () => {
    const r = await run(deps(), "GET", "/api/agent/v1/calendar");
    expect(r.next).toBe(true);
    expect(r.auth).toBe(`Bearer ${TOKEN}`);
  });

  it("fails closed when it cannot read the token or the gate", async () => {
    const a = await run(deps({ verify: async () => { throw new Error("db"); } }), "GET", "/api/org");
    expect([a.status, a.next]).toEqual([503, false]);
    const b = await run(deps({ mayView: async () => { throw new Error("db"); } }), "GET", "/api/org");
    expect([b.status, b.next]).toEqual([503, false]);
  });
});

describe("the live.view scope", () => {
  it("is made only by a holder, and only on its own", () => {
    expect(cleanScopes(["live.view"], { intentsAllowed: false })).toMatchObject({ ok: false });
    expect(cleanScopes(["live.view"], { intentsAllowed: false, liveViewAllowed: true })).toEqual({ ok: true, scopes: ["live.view"] });
    const mixed = cleanScopes(["live.view", "moon.read"], { intentsAllowed: false, liveViewAllowed: true });
    expect(mixed.ok).toBe(false);
  });

  it("lives a week unless asked, and a month at most; other tokens keep their 90 and 365", () => {
    expect(tokenTtlDays(["live.view"], undefined)).toBe(LIVE_VIEW_DEFAULT_TTL_DAYS);
    expect(tokenTtlDays(["live.view"], 365)).toBe(LIVE_VIEW_MAX_TTL_DAYS);
    expect(tokenTtlDays(["live.view"], 2)).toBe(2);
    expect(tokenTtlDays(["moon.read"], undefined)).toBe(90);
    expect(tokenTtlDays(["moon.read"], 1000)).toBe(365);
  });
});

describe("the gate behind it: qa.live_view", () => {
  // The top of the ladder: no stage opens this key, however far a member has climbed.
  const ctx = (over: Partial<CapabilityCtx> = {}): CapabilityCtx => ({ isAdmin: false, stageIndex: 99, stageIndexOf: () => 0, roleCapabilities: [], ...over });

  it("opens for a seat that carries it", () => {
    expect(capabilityDecision("qa.live_view", ctx({ roleCapabilities: ["qa.live_view"] })).allowed).toBe(true);
  });

  it("stays shut for a member at any stage with no seat", () => {
    expect(capabilityDecision("qa.live_view", ctx()).allowed).toBe(false);
  });

  it("stays shut for a badge that names it", () => {
    expect(capabilityDecision("qa.live_view", ctx({ badgeCapabilities: ["qa.live_view"] })).allowed).toBe(false);
  });
});
