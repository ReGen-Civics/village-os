// @vitest-environment jsdom
/**
 * `mayAsk`: a page may skip a route only on an answer the server actually gave. Signed out, a failed read or a
 * wrong-shaped answer skip nothing (fail closed), and the read happens once per session.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let token: string | null = "tok";
vi.mock("@/lib/gameApi", () => ({
  authToken: () => token,
  gameFetch: (path: string, init?: RequestInit) => fetch(path, init),
}));

import { forgetCapabilities, mayAsk } from "./myCapabilities";

const answer = (status: number, body: unknown) => vi.fn(async (_url?: unknown) => new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  token = "tok";
  forgetCapabilities();
});
afterEach(() => vi.unstubAllGlobals());

describe("mayAsk", () => {
  it("skips a route the viewer holds no key for, and asks one they hold", async () => {
    vi.stubGlobal("fetch", answer(200, { capabilities: ["quest.consent"] }));
    expect(await mayAsk("quest.consent")).toBe(true);
    expect(await mayAsk("org.seat")).toBe(false);
    expect(await mayAsk("intake.moderate", "quest.consent")).toBe(true);
  });

  it("reads the keys once per session", async () => {
    const f = answer(200, { capabilities: [] });
    vi.stubGlobal("fetch", f);
    await mayAsk("org.seat");
    await mayAsk("cash.pay");
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe("/api/me/capabilities");
  });

  it("skips nothing when the keys cannot be read, and tries again next time", async () => {
    const failing = answer(500, { error: "down" });
    vi.stubGlobal("fetch", failing);
    expect(await mayAsk("org.seat")).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await mayAsk("org.seat")).toBe(true);
    vi.stubGlobal("fetch", answer(200, { capabilities: "not a list" }));
    expect(await mayAsk("org.seat")).toBe(true);
    vi.stubGlobal("fetch", answer(200, { capabilities: [] }));
    expect(await mayAsk("org.seat")).toBe(false);
  });

  it("skips nothing when the read cannot even start", async () => {
    vi.stubGlobal("fetch", () => { throw new TypeError("fetch is not a function"); });
    await expect(mayAsk("org.seat")).resolves.toBe(true);
  });

  it("skips nothing signed out, and asks nothing to find that out", async () => {
    token = null;
    const f = answer(200, { capabilities: [] });
    vi.stubGlobal("fetch", f);
    expect(await mayAsk("org.seat")).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });
});
