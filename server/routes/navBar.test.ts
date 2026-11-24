/**
 * The responsive bar's routes, on fakes: what the visit route counts (a page,
 * never a person), and how the village's bar is kept steady between recomputes.
 */
import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanPath, NAV_BAR_DOC, register, type NavBarDeps } from "./navBar";

const servers: Array<{ close: () => void }> = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

function harness(over: Partial<NavBarDeps> & { vars?: Record<string, string | number | boolean> } = {}) {
  const vars: Record<string, string | number | boolean> = { "nav.responsive_bar": true, "nav.popular_slots": 2, "nav.personal_slot": true, "nav.refresh_days": 7, "nav.swap_margin_pct": 20, "nav.pinned": "", "nav.excluded": "", ...over.vars };
  const docs = new Map<string, Record<string, unknown>>();
  let clock = new Date("2026-11-24T12:00:00Z");
  const counted: unknown[][] = [];
  const totals = vi.fn(async (_pool: unknown, _since: string) => [
    { path: "/quests", count: 50 },
    { path: "/roles", count: 40 },
    { path: "/events", count: 10 },
  ]);
  const deps: NavBarDeps = {
    getPool: () => ({}) as never,
    authedUser: async (req) => (req.headers.authorization ? { id: "usr-1", email: "m@example.test" } : null),
    overLimit: async () => false,
    connectionKey: () => "1.2.3.4",
    fixedRoutes: () => new Set(["/", "/quests", "/roles", "/events", "/journal"]),
    boolVar: (k) => Boolean(vars[k]),
    numberVar: (k) => Number(vars[k]),
    stringVar: (k) => String(vars[k] ?? ""),
    countVisit: async (...args) => {
      counted.push(args);
    },
    visitTotals: totals,
    readDoc: async (_p, k) => docs.get(k) ?? null,
    writeDoc: async (_p, k, d) => {
      docs.set(k, d);
    },
    now: () => clock,
    ...over,
  };
  const app = express();
  app.use(express.json());
  register(app, deps);
  return {
    docs,
    counted,
    totals,
    vars,
    tick: (ms: number) => (clock = new Date(clock.getTime() + ms)),
    async start() {
      const server = app.listen(0);
      servers.push(server);
      await new Promise((r) => server.once("listening", r));
      return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    },
  };
}

const post = (base: string, body: unknown, signedIn = true) =>
  fetch(`${base}/api/nav/visit`, { method: "POST", headers: { "Content-Type": "application/json", ...(signedIn ? { Authorization: "Bearer t" } : {}) }, body: JSON.stringify(body) }); // module-review-ok: the test client dialling its own in-process server on localhost
const bar = async (base: string, signedIn = true) => (await fetch(`${base}/api/nav/bar`, { headers: signedIn ? { Authorization: "Bearer t" } : {} })).json(); // module-review-ok: the test client dialling its own in-process server on localhost

describe("POST /api/nav/visit", () => {
  it("counts the page alone: the pool, the day and the address, and nothing that names the member", async () => {
    const h = harness();
    const base = await h.start();
    expect((await post(base, { path: "/quests?x=1", user: "usr-1" })).status).toBe(204);
    expect(h.counted).toEqual([[{}, "2026-11-24", "/quests"]]);
    expect(JSON.stringify(h.counted)).not.toContain("usr-1");
  });

  it("counts only a fixed address the client draws, and never Home", async () => {
    const h = harness();
    const base = await h.start();
    for (const path of ["/", "/profile/usr-9", "/roles/abc", "https://elsewhere.example/x", 42]) await post(base, { path });
    expect(h.counted).toEqual([]);
  });

  it("refuses a visitor who is not signed in, and counts nothing", async () => {
    const h = harness();
    const base = await h.start();
    expect((await post(base, { path: "/quests" }, false)).status).toBe(401);
    expect(h.counted).toEqual([]);
  });

  it("is bounded per connection", async () => {
    const h = harness({ overLimit: async () => true });
    const base = await h.start();
    await post(base, { path: "/quests" });
    expect(h.counted).toEqual([]);
  });
});

describe("GET /api/nav/bar", () => {
  it("is off, and asks nothing, while the setting is off or the visitor is signed out", async () => {
    const h = harness({ vars: { "nav.responsive_bar": false } });
    const base = await h.start();
    expect(await bar(base)).toEqual({ on: false, siteWide: [], personal: false, excluded: [] });
    const h2 = harness();
    const base2 = await h2.start();
    expect((await bar(base2, false)).on).toBe(false);
    expect(h.totals).not.toHaveBeenCalled();
    expect(h2.totals).not.toHaveBeenCalled();
  });

  it("chooses the village's pages, keeps them, and reads the counts again only after the refresh period", async () => {
    const h = harness();
    const base = await h.start();
    expect(await bar(base)).toEqual({ on: true, siteWide: ["/quests", "/roles"], personal: true, excluded: [] });
    expect(h.docs.get(NAV_BAR_DOC)?.paths).toEqual(["/quests", "/roles"]);
    h.tick(6 * 86_400_000);
    await bar(base);
    expect(h.totals).toHaveBeenCalledTimes(1);
    h.tick(2 * 86_400_000);
    await bar(base);
    expect(h.totals).toHaveBeenCalledTimes(2);
    // From the four periods before.
    expect(h.totals.mock.calls[1][1]).toBe("2026-11-04");
  });

  it("answers a changed pin or exclusion at once, without waiting for the period", async () => {
    const h = harness();
    const base = await h.start();
    await bar(base);
    h.vars["nav.pinned"] = "/journal";
    h.vars["nav.excluded"] = "/roles";
    const now = await bar(base);
    expect(now.siteWide).toEqual(["/journal", "/quests"]);
    expect(now.excluded).toEqual(["/roles"]);
  });

  it("keeps the fixed bar on any trouble", async () => {
    const h = harness({ visitTotals: async () => Promise.reject(new Error("db down")) });
    const base = await h.start();
    expect((await bar(base)).on).toBe(false);
  });
});

describe("cleanPath", () => {
  it("drops the query, the hash and a trailing slash, and refuses anything else", () => {
    expect(cleanPath("/quests/?a=1#b")).toBe("/quests");
    expect(cleanPath("/")).toBe("/");
    expect(cleanPath("quests")).toBeNull();
    expect(cleanPath("/a b")).toBeNull();
    expect(cleanPath(7)).toBeNull();
  });
});
