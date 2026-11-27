/**
 * THE INVESTOR GATE'S FOUR DOORS IN server/index.ts (the lead, 27 Nov 2026: "only those we accept should be able to
 * see it"). The routes behind the gate are server/index.ts's own, so this reads each handler and holds it to asking
 * `investorAccess.allowed(req)` before it reads anything: the summary, the packet request, the investor page's words
 * and their translation. investorAccess.test.ts proves what `allowed` answers; this proves each door asks it first.
 * And the desk's status route hands every decision to `investorAccess.decided`.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = fs.readFileSync(path.join(__dirname, "..", "index.ts"), "utf8").replace(/\r\n/g, "\n");

/** The first lines of one route's handler. */
function head(route: string, lines = 4): string {
  const at = src.indexOf(route);
  expect(at, route).toBeGreaterThan(-1);
  return src.slice(at).split("\n").slice(0, lines).join("\n");
}

describe("the investor gate's doors in server/index.ts", () => {
  it("refuses the summary and the packet to a reader the team has not let in, before anything is read", () => {
    expect(head('app.get("/api/investor-summary",', 3)).toMatch(/if \(!\(await investorAccess\.allowed\(req\)\)\) return res\.status\(403\)\.json\(INVESTOR_ONLY\);/);
    expect(head('app.post("/api/investor-docs/request",', 3)).toMatch(/if \(!\(await investorAccess\.allowed\(req\)\)\) return res\.status\(403\)\.json\(INVESTOR_ONLY\);/);
  });

  it("refuses the investor page's own words and their translation the same way", () => {
    expect(head('app.get("/api/content/:section",', 4)).toMatch(/req\.params\.section === INVESTOR_SECTION\) \{ noSharedCache\(res\); if \(!\(await investorAccess\.allowed\(req\)\)\) return res\.status\(403\)\.json\(INVESTOR_ONLY\); \}/);
    expect(head('app.get("/api/content/:section/translation",', 6)).toMatch(/section === INVESTOR_SECTION && !\(await investorAccess\.allowed\(req\)\)\) return res\.status\(403\)\.json\(INVESTOR_ONLY\)/);
  });

  it("hands every decision on the submissions desk to the gate, and says what it did", () => {
    const route = src.slice(src.indexOf('app.put("/api/admin/submissions/:id/status"'));
    const end = route.indexOf("\n  });\n");
    const body = route.slice(0, end);
    expect(body).toMatch(/const investor = before === status \? null : await investorAccess\.decided\(submissions\[idx\], status,/);
    expect(body).toMatch(/res\.json\(\{ success: true, rewarded, rewardRefused, notified, admitted, investor \}\)/);
  });

  it("reads the gate's dial", () => {
    expect(src).toMatch(/registerInvestorAccess\(app, \{ getPool, gateOn: \(\) => boolVar\("investors\.gate"\),/);
  });
});
