/**
 * The entry cookie and the gate (server/lib/entrance.ts), on a real Express server with the
 * record faked: no database is needed to prove who passes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { cookieValue, entranceMiddleware, entryChecker, entryCookieHeader, ENTRY_MS, eventPassOpens, fallbackHuman, pickKeys, readEntry, readEventPass, signEntry, signEventPass, verifyTurnstile, type EntryState } from "./entrance";

const SECRET = "test-secret-that-is-long-enough-for-hmac"; // module-review-ok: a test fixture key for the HMAC, never a real credential
const ID = "pe-0123456789abcdef0123";

describe("the entry cookie", () => {
  it("reads back the id it signed until it runs out", () => {
    const now = 1_800_000_000_000;
    const v = signEntry(SECRET, ID, now);
    expect(readEntry(SECRET, v, now + 1000)).toBe(ID);
    expect(readEntry(SECRET, v, now + ENTRY_MS + 1)).toBeNull();
  });

  it("refuses a forged, altered or foreign value", () => {
    const now = 1_800_000_000_000;
    const v = signEntry(SECRET, ID, now);
    const [id, exp, sig] = v.split(".");
    expect(readEntry("another-secret", v, now)).toBeNull();
    expect(readEntry(SECRET, `${id}.${Number(exp) + 1}.${sig}`, now)).toBeNull();
    expect(readEntry(SECRET, `pe-ffffffffffffffffffff.${exp}.${sig}`, now)).toBeNull();
    expect(readEntry(SECRET, "nonsense", now)).toBeNull();
    expect(readEntry(SECRET, null, now)).toBeNull();
  });

  it("is set HttpOnly and SameSite=Lax for ninety days, and Secure behind https", () => {
    const h = entryCookieHeader("v", true);
    expect(h).toContain("HttpOnly");
    expect(h).toContain("SameSite=Lax");
    expect(h).toContain("Secure");
    expect(h).toContain(`Max-Age=${90 * 24 * 60 * 60}`);
    expect(entryCookieHeader("v", false)).not.toContain("Secure");
  });

  it("finds its own cookie among others", () => {
    const req = { headers: { cookie: "a=1; vos_portal=abc%2Edef; b=2" } } as any;
    expect(cookieValue(req)).toBe("abc.def");
    expect(cookieValue({ headers: {} } as any)).toBeNull();
  });
});

describe("the fallback human check", () => {
  it("passes a person and refuses a bot that filled the hidden field or posted at once", () => {
    const now = 1_000_000;
    expect(fallbackHuman({ website: "", shownAt: now - 5000 }, 2500, now)).toEqual({ ok: true, how: "fallback" });
    expect(fallbackHuman({ website: "spam.example", shownAt: now - 5000 }, 2500, now)).toEqual({ ok: false, why: "check_failed" });
    expect(fallbackHuman({ shownAt: now - 100 }, 2500, now)).toEqual({ ok: false, why: "too_fast" });
    expect(fallbackHuman({}, 2500, now)).toEqual({ ok: false, why: "check_failed" });
    expect(fallbackHuman({ shownAt: now + 10 }, 2500, now)).toEqual({ ok: false, why: "check_failed" });
  });
});

describe("Turnstile", () => {
  const answering = (body: unknown) => async () => body;
  it("passes only on Cloudflare's success", async () => {
    expect(await verifyTurnstile("s", "tok", "1.2.3.4", answering({ success: true }))).toEqual({ ok: true, how: "turnstile" });
    expect(await verifyTurnstile("s", "tok", null, answering({ success: false }))).toEqual({ ok: false, why: "check_failed" });
    expect(await verifyTurnstile("s", "", null, answering({ success: true }))).toEqual({ ok: false, why: "check_failed" });
  });
  it("says the check is unavailable when Cloudflare cannot be reached", async () => {
    const down = async () => {
      throw new Error("offline");
    };
    expect(await verifyTurnstile("s", "tok", null, down)).toEqual({ ok: false, why: "check_unavailable" });
  });
});

describe("a gathering's pass", () => {
  it("reads back the gathering it signed until it runs out, and refuses another key or an edit", () => {
    const now = 1_800_000_000_000;
    const v = signEventPass(SECRET, "ev-abc", now);
    expect(readEventPass(SECRET, v, now + 1000)).toMatchObject({ eventId: "ev-abc" });
    expect(readEventPass(SECRET, v, now + 121 * 24 * 60 * 60 * 1000)).toBeNull();
    expect(readEventPass("another", v, now)).toBeNull();
    const [, exp, sig] = v.split(".");
    expect(readEventPass(SECRET, `${Buffer.from("ev-other").toString("base64url")}.${exp}.${sig}`, now)).toBeNull();
  });

  it("opens the calendar and that gathering's own routes, and nothing else", () => {
    expect(eventPassOpens("/api/events", "ev-1")).toBe("list");
    expect(eventPassOpens("/api/events/ev-1", "ev-1")).toBe("open");
    expect(eventPassOpens("/api/events/ev-1/guest-rsvp", "ev-1")).toBe("open");
    expect(eventPassOpens("/api/events/ev-10", "ev-1")).toBe(false);
    expect(eventPassOpens("/api/org", "ev-1")).toBe(false);
  });
});

describe("pickKeys", () => {
  it("keeps only the listed keys of an object, and nothing of anything else", () => {
    expect(pickKeys({ on: true, roleIds: ["a"], names: { a: "A" }, sections: { a: { payCeiling: 1 } }, team: [{ holders: ["X"] }] }, ["on", "roleIds", "names"])).toEqual({ on: true, roleIds: ["a"], names: { a: "A" } });
    expect(pickKeys([1, 2], ["on"])).toEqual({});
    expect(pickKeys(null, ["on"])).toEqual({});
  });
});

describe("the gate, on a real server", () => {
  let server: Server;
  let base = "";
  let required = true;
  const PASS = "pass-for-our-own-automation-0123456789";
  const LOOKING = "pe-11111111111111111111";
  const OVER = "pe-22222222222222222222";
  const records = new Map<string, EntryState>([[ID, "in"], [LOOKING, "look"], [OVER, "code"]]);
  const now = Date.now();
  // A local request to the test's own server, never an outbound call.
  const get = (p: string, init?: RequestInit) => fetch(`${base}${p}`, init); // module-review-ok: the test's own loopback server, not an outbound call
  const cookie = `vos_portal=${encodeURIComponent(signEntry(SECRET, ID, now))}`;

  beforeAll(async () => {
    const app = express();
    const entered = entryChecker({ secret: SECRET, entryState: async (id) => records.get(id) ?? null });
    app.use(
      entranceMiddleware(
        {
          boolVar: (k) => (k === "entrance.required" ? required : false),
          authedUser: async (req) => (req.headers.authorization === "Bearer member" ? { id: "u1" } : null),
          isAgent: async (req) => req.headers.authorization === "Bearer vat_live",
          passToken: () => PASS,
          eventPassFor: (req) => readEventPass(SECRET, cookieValue(req, "vos_event"))?.eventId ?? null,
        },
        entered,
      ),
    );
    app.get("/api/org", (_req, res) => res.json({ roles: [{ id: "r", card: { publicPay: { kind: "range" } } }] }));
    app.get("/api/org/founding-team", (_req, res) => res.json({ on: true, roleIds: ["r"], names: { r: "Role" }, sections: { r: { payCeiling: { amount: 1 } } }, team: [{ holders: ["Ana"] }] }));
    app.get("/api/game/config", (_req, res) => res.json({ project: { name: "V" } }));
    app.get("/api/events", (_req, res) => res.json({ events: [{ id: "ev-1" }, { id: "ev-2" }], timezone: "UTC" }));
    app.get("/api/events/:id", (req, res) => res.json({ id: req.params.id }));
    app.get("/api/events/:id/join", (_req, res) => res.json({ room: true }));
    app.post("/api/org", (_req, res) => res.json({ wrote: true }));
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  it("refuses a visitor without an entry, by name", async () => {
    required = true;
    const r = await get("/api/org");
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe("entrance_required");
  });

  it("lets a signed-in member through without any entry", async () => {
    required = true;
    expect((await get("/api/org", { headers: { Authorization: "Bearer member" } })).status).toBe(200);
  });

  it("lets a visitor with a live entry through", async () => {
    required = true;
    expect((await get("/api/org", { headers: { cookie } })).status).toBe(200);
  });

  it("stops honouring an entry once its record is forgotten", async () => {
    required = true;
    const otherId = "pe-aaaaaaaaaaaaaaaaaaaa";
    const c = `vos_portal=${encodeURIComponent(signEntry(SECRET, otherId, now))}`;
    expect((await get("/api/org", { headers: { cookie: c } })).status).toBe(401);
  });

  it("lets a visitor inside their short look through, and asks for the code once it is over", async () => {
    required = true;
    const looking = `vos_portal=${encodeURIComponent(signEntry(SECRET, LOOKING, now))}`;
    const over = `vos_portal=${encodeURIComponent(signEntry(SECRET, OVER, now))}`;
    expect((await get("/api/org", { headers: { cookie: looking } })).status).toBe(200);
    const res = await get("/api/org", { headers: { cookie: over } });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe("code_required");
  });

  it("answers a visitor the founding team's open roles only", async () => {
    required = true;
    const r = await get("/api/org/founding-team");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ on: true, roleIds: ["r"], names: { r: "Role" } });
    const full = await (await get("/api/org/founding-team", { headers: { cookie } })).json();
    expect(full.sections.r.payCeiling.amount).toBe(1);
  });

  it("never stands in front of a page every visitor needs, or a write", async () => {
    required = true;
    expect((await get("/api/game/config")).status).toBe(200);
    expect((await get("/api/org", { method: "POST" })).status).toBe(200);
  });

  it("lets an agent token through, as its holder is a member", async () => {
    required = true;
    expect((await get("/api/org", { headers: { Authorization: "Bearer vat_live" } })).status).toBe(200);
    expect((await get("/api/org", { headers: { Authorization: "Bearer vat_dead" } })).status).toBe(401);
  });

  it("lets our own automation through by the pass header, and refuses a wrong one", async () => {
    required = true;
    expect((await get("/api/org", { headers: { "X-Entrance-Pass": PASS } })).status).toBe(200);
    expect((await get("/api/org", { headers: { "X-Entrance-Pass": PASS + "x" } })).status).toBe(401);
    expect((await get("/api/org", { headers: { "X-Entrance-Pass": "" } })).status).toBe(401);
  });

  it("refuses a visitor with no cookie at all", async () => {
    required = true;
    const r = await get("/api/org");
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe("entrance_required");
  });

  it("opens one gathering to an invited guest, and the calendar trimmed to it", async () => {
    required = true;
    const c = `vos_event=${encodeURIComponent(signEventPass(SECRET, "ev-1"))}`;
    expect(await (await get("/api/events", { headers: { cookie: c } })).json()).toEqual({ events: [{ id: "ev-1" }], timezone: "UTC" });
    expect((await get("/api/events/ev-1", { headers: { cookie: c } })).status).toBe(200);
    expect((await get("/api/events/ev-2", { headers: { cookie: c } })).status).toBe(401);
    expect((await get("/api/org", { headers: { cookie: c } })).status).toBe(401);
    expect((await get("/api/events")).status).toBe(401);
  });

  it("keeps a gathering's join link open to anybody holding it", async () => {
    required = true;
    expect((await get("/api/events/ev-2/join")).status).toBe(200);
  });

  it("stands nowhere while the village keeps no entrance", async () => {
    required = false;
    expect((await get("/api/org")).status).toBe(200);
    const r = await (await get("/api/org/founding-team")).json();
    expect(r.sections).toBeDefined();
  });
});
