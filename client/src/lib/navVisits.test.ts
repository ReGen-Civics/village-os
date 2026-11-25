// @vitest-environment jsdom
/**
 * The phone's half of the responsive bar: what it sends (an address, once per
 * page per session), what it keeps on the device, and that blocked storage
 * gives the village's bar rather than an error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOKEN_PREFIX } from "../../../server/lib/agentTokens";
import { AGENT_TOKEN_PREFIX, forgetBar, HISTORY_KEY, loadBar, personalFor, SENT_KEY, visited } from "./navVisits";

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  forgetBar();
});
afterEach(() => vi.restoreAllMocks());

describe("visited", () => {
  it("sends the address alone, once per page per session, and never a fixed place", async () => {
    const f = vi.fn(() => ok({}));
    await visited("/quests?tab=mine", "tok", f as unknown as typeof fetch);
    await visited("/quests", "tok", f as unknown as typeof fetch);
    await visited("/", "tok", f as unknown as typeof fetch);
    await visited("/path", "tok", f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/nav/visit");
    expect(JSON.parse(String(init.body))).toEqual({ path: "/quests" });
    expect(JSON.parse(window.sessionStorage.getItem(SENT_KEY)!)).toEqual(["/quests"]);
  });

  it("keeps the member's own counts on the device", async () => {
    const f = vi.fn(() => ok({}));
    await visited("/journal", "tok", f as unknown as typeof fetch);
    window.sessionStorage.clear();
    await visited("/journal", "tok", f as unknown as typeof fetch);
    expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY)!).counts).toEqual({ "/journal": 2 });
  });

  it("sends nothing and keeps nothing for the live view, which only reads", async () => {
    const f = vi.fn(() => ok({}));
    await visited("/quests", `${AGENT_TOKEN_PREFIX}live`, f as unknown as typeof fetch);
    expect(f).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(SENT_KEY)).toBeNull();
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it("knows an agent token by the server's own prefix", () => {
    expect(AGENT_TOKEN_PREFIX).toBe(TOKEN_PREFIX);
  });

  it("carries on when storage and the network both refuse", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await expect(visited("/quests", "tok", (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch)).resolves.toBeUndefined();
  });
});

describe("personalFor", () => {
  it("chooses once a day and keeps the choice all day", () => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify({ counts: { "/journal": 5, "/events": 3 } }));
    const morning = new Date(2026, 10, 24, 8);
    expect(personalFor(["/quests"], [], morning)).toBe("/journal");
    // /events overtakes it later the same day: today's place holds.
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify({ ...JSON.parse(window.localStorage.getItem(HISTORY_KEY)!), counts: { "/journal": 5, "/events": 9 } }));
    expect(personalFor(["/quests"], [], new Date(2026, 10, 24, 20))).toBe("/journal");
    expect(personalFor(["/quests"], [], new Date(2026, 10, 25, 8))).toBe("/events");
  });
});

describe("loadBar", () => {
  it("is the fixed bar while the setting is off, or the server cannot be asked", async () => {
    expect(await loadBar("tok", (() => ok({ on: false, siteWide: [], personal: false, excluded: [] })) as unknown as typeof fetch)).toBeNull();
    forgetBar();
    expect(await loadBar("tok", (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch)).toBeNull();
  });

  it("is the village's page and the member's own, and asks the server at most every ten minutes", async () => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify({ counts: { "/journal": 4 } }));
    const f = vi.fn(() => ok({ on: true, siteWide: ["/quests", "/roles"], personal: true, excluded: [] }));
    const t = Date.parse("2026-11-24T12:00:00Z");
    expect(await loadBar("tok", f as unknown as typeof fetch, t)).toEqual(["/quests", "/journal"]);
    await loadBar("tok", f as unknown as typeof fetch, t + 5 * 60_000);
    expect(f).toHaveBeenCalledTimes(1);
    await loadBar("tok", f as unknown as typeof fetch, t + 11 * 60_000);
    expect(f).toHaveBeenCalledTimes(2);
  });
});
