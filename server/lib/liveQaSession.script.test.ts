/**
 * scripts/live-qa-session.mjs, the live QA probe: its pure parts.
 *
 * The browser half needs a live village and a holder's token, so it is not
 * run here. What can go wrong quietly is pinned instead: the probe must
 * refuse to start without a token, must stop unless the server marks the
 * read as a live view, and must put the token where the app reads its
 * sign-in. That last one is a string in two files, so it is read from both.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error: a plain .mjs script, no declarations
import { parseArgs, startProblem, whoAmI, pageFetch, readOnlyRoute, stoppedHere, TOKEN_KEY, LIVE_VIEW_HEADER, PROXY_PLACEHOLDER } from "../../scripts/live-qa-session.mjs";
import { TOKEN_KEY as APP_TOKEN_KEY } from "../../client/src/lib/gameApi";

const TOKEN = "vat_" + "y".repeat(43);

function answer(status: number, body: unknown, headers: Record<string, string> = {}) {
  return async () => ({ status, json: async () => body, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } });
}

describe("the live QA probe", () => {
  it("puts the token in the slot the app reads its sign-in from", () => {
    expect(TOKEN_KEY).toBe(APP_TOKEN_KEY);
  });

  it("reads the header the server sets", () => {
    const src = fs.readFileSync(path.join(__dirname, "liveView.ts"), "utf8");
    expect(src).toContain(`res.setHeader("X-Live-View", "read-only")`);
    expect(LIVE_VIEW_HEADER).toBe("x-live-view");
  });

  it("refuses to start without a token, with a token of the wrong shape, or with no village named", () => {
    const opts = parseArgs(["/roles"], { LIVE_QA_URL: "https://village.example/" });
    expect(opts.url).toBe("https://village.example");
    expect(opts.paths).toEqual(["/roles"]);
    expect(startProblem(opts, {})).toContain("LIVE_QA_TOKEN is not set");
    expect(startProblem(opts, { LIVE_QA_TOKEN: "a-password" })).toContain("vat_");
    expect(startProblem(parseArgs([], {}), { LIVE_QA_TOKEN: TOKEN })).toContain("--url");
    expect(startProblem(opts, { LIVE_QA_TOKEN: TOKEN })).toBeNull();
  });

  it("never puts the token in a problem it prints", () => {
    const opts = parseArgs([], { LIVE_QA_URL: "https://village.example" });
    const wrongShape = "abc-" + "q".repeat(20); // not a credential: the wrong shape on purpose
    for (const env of [{ LIVE_QA_TOKEN: wrongShape }, {}]) {
      expect(String(startProblem(opts, env))).not.toContain("qqqqqqqqqq");
    }
  });

  it("puts the token on the village's own API reads only, and stops every write before it leaves", () => {
    const stopped: string[] = [];
    const rule = readOnlyRoute("https://v.example", TOKEN, stopped);
    const run = (method: string, url: string) => {
      const out: { did?: string; headers?: Record<string, string> } = {};
      rule({
        request: () => ({ url: () => url, method: () => method, headers: () => ({ accept: "application/json" }) }),
        continue: (o?: { headers?: Record<string, string> }) => { out.did = "continue"; out.headers = o?.headers; },
        abort: () => { out.did = "abort"; },
      });
      return out;
    };
    expect(run("GET", "https://v.example/api/season")).toEqual({ did: "continue", headers: { accept: "application/json", authorization: `Bearer ${TOKEN}` } });
    expect(run("GET", "https://v.example/roles")).toEqual({ did: "continue", headers: undefined });
    expect(run("GET", "https://elsewhere.example/api/season")).toEqual({ did: "continue", headers: undefined });
    expect(run("POST", "https://v.example/api/nav/visit")).toEqual({ did: "abort" });
    expect(run("DELETE", "https://v.example/api/quests/1")).toEqual({ did: "abort" });
    expect(stopped).toEqual(["POST /api/nav/visit", "DELETE /api/quests/1"]);
  });

  it("with no token of its own (the proxy adds it), adds no header and still stops writes", () => {
    const stopped: string[] = [];
    const rule = readOnlyRoute("https://v.example", null, stopped);
    const seen: Array<string | undefined> = [];
    const run = (method: string, url: string) =>
      rule({
        request: () => ({ url: () => url, method: () => method, headers: () => ({}) }),
        continue: (o?: { headers?: Record<string, string> }) => { seen.push(o?.headers?.authorization); },
        abort: () => { seen.push("aborted"); },
      });
    run("GET", "https://v.example/api/season");
    run("POST", "https://v.example/api/nav/visit");
    expect(seen).toEqual([undefined, "aborted"]);
    expect(stopped).toEqual(["POST /api/nav/visit"]);
  });

  it("does not count a write it stopped a second time, as a failed load", () => {
    const stopped = ["POST /api/nav/visit"];
    expect(stoppedHere(stopped, "https://v.example/api/nav/visit")).toBe(true);
    expect(stoppedHere(stopped, "https://v.example/api/season")).toBe(false);
    expect(stoppedHere(stopped, undefined)).toBe(false);
  });

  it("goes on only for a signed-in read marked read-only", async () => {
    await expect(whoAmI("https://v.example", TOKEN, answer(200, { displayName: "Ana" }, { "x-live-view": "read-only" }))).resolves.toMatchObject({ displayName: "Ana" });
    await expect(whoAmI("https://v.example", TOKEN, answer(200, { displayName: "Ana" }))).rejects.toThrow(/did not mark this as a read-only live view/);
    await expect(whoAmI("https://v.example", TOKEN, answer(403, { error: "live_view_not_held" }))).rejects.toThrow(/live_view_not_held/);
  });

  /*
   * THE TOKEN AS A NETWORK SECRET (whole-app QA, 25 Nov 2026): the proxy adds it, so no process here holds it.
   */
  it("under --proxy-auth reads no token, and still needs the village named", () => {
    expect(parseArgs(["--proxy-auth", "/roles"], {}).proxyAuth).toBe(true);
    expect(parseArgs(["/roles"], { LIVE_QA_PROXY_AUTH: "1" }).proxyAuth).toBe(true);
    expect(parseArgs(["/roles"], {}).proxyAuth).toBe(false);
    expect(startProblem(parseArgs(["--proxy-auth"], { LIVE_QA_URL: "https://village.example" }), {})).toBeNull();
    expect(startProblem(parseArgs(["--proxy-auth"], {}), {})).toContain("--url");
  });

  it("asks with no Authorization of its own when there is no token, and still stops on an unmarked answer", async () => {
    let sent: Record<string, string> = {};
    const spy = (async (_u: string, init: { headers: Record<string, string> }) => {
      sent = init.headers;
      return { status: 200, headers: { get: () => "read-only" }, json: async () => ({ displayName: "Ana" }) };
    }) as unknown as typeof fetch;
    await expect(whoAmI("https://v.example", null, spy)).resolves.toMatchObject({ displayName: "Ana" });
    expect(Object.keys(sent).map((k) => k.toLowerCase())).not.toContain("authorization");
    await expect(whoAmI("https://v.example", null, answer(200, { displayName: "Ana" }))).rejects.toThrow(/did not mark this as a read-only live view/);
  });

  it("reads the live-view mark and the body through a page, the browser's own path", async () => {
    const page = { evaluate: async () => ({ status: 200, live: "read-only", text: JSON.stringify({ displayName: "Ana" }) }) };
    await expect(whoAmI("https://v.example", PROXY_PLACEHOLDER, pageFetch(page))).resolves.toMatchObject({ displayName: "Ana" });
    const unmarked = { evaluate: async () => ({ status: 200, live: null, text: "{}" }) };
    await expect(whoAmI("https://v.example", null, pageFetch(unmarked))).rejects.toThrow(/read-only live view/);
  });

  it("uses a placeholder that is not a personal token's secret", () => {
    expect(PROXY_PLACEHOLDER.startsWith("vat_")).toBe(true);
    expect(PROXY_PLACEHOLDER).toMatch(/^vat_[a-z_]+$/);
  });
});

