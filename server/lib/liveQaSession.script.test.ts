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
import { parseArgs, startProblem, whoAmI, TOKEN_KEY, LIVE_VIEW_HEADER } from "../../scripts/live-qa-session.mjs";
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

  it("goes on only for a signed-in read marked read-only", async () => {
    await expect(whoAmI("https://v.example", TOKEN, answer(200, { displayName: "Ana" }, { "x-live-view": "read-only" }))).resolves.toMatchObject({ displayName: "Ana" });
    await expect(whoAmI("https://v.example", TOKEN, answer(200, { displayName: "Ana" }))).rejects.toThrow(/did not mark this as a read-only live view/);
    await expect(whoAmI("https://v.example", TOKEN, answer(403, { error: "live_view_not_held" }))).rejects.toThrow(/live_view_not_held/);
  });
});
