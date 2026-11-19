import { describe, expect, it } from "vitest";
import { setupI18n } from "@lingui/core";
import { backupFileName, backupHtml, backupMailto } from "./applyBackup";
import { needsSafetyNet, sendTimeoutMs } from "./applySendFailure";
import { toDraft } from "./applyDraft";

const en = setupI18n({ locale: "en", messages: { en: {} } });
const now = new Date("2026-11-19T10:00:00Z");
const draft = toDraft(
  {
    step: 5, reached: 5, knowUs: ["Came to a gathering"], why: "Why <me>", name: "Rowan", email: "rowan@example.test",
    about: { based: "Uvita", languages: "English, Spanish", story: "Built fences." }, selfKnowledge: "Projector", links: [{ label: "Site", url: "https://example.test" }],
    aim: "Open the gate", items: [{ title: "A gate", doneWhen: "It opens", serves: "g-1", moves: "", date: "", roleId: "" }], marks: {},
    terms: { answers: { term: { choice: "talk", note: "Shorter please" } }, commitmentPct: 50, payAsk: { kind: "amount", monthly: 900, per: "month" }, paySplit: [{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }] },
    rampUp: true, practical: { timeZone: "America/Costa_Rica", windows: ["Mornings"], earliestStart: "2027-01-04" }, pieceSuggestions: [],
    extras: [{ roleId: "r-2", terms: { answers: {}, commitmentPct: 20, payAsk: { kind: "negotiate" }, paySplit: [{ label: "Credits", pct: 100 }] } }],
  },
  now,
);

describe("the application file", () => {
  it("holds every answer, each added role's terms, the goal in words, and escapes what was written", () => {
    const html = backupHtml({ village: "Test Village", roles: [{ id: "r-1", name: "Gate Keeper" }, { id: "r-2", name: "Welcome Host" }], draft, goals: [{ id: "g-1", text: "Water for all" }], now, pageUrl: "https://v.test/propose-a-role?role=r-1" }, en);
    for (const s of ["Test Village", "Gate Keeper, Welcome Host", "Came to a gathering", "Rowan", "rowan@example.test", "Uvita", "English, Spanish", "Built fences.", "Projector", "Site: https://example.test", "Open the gate", "A gate", "It opens", "Water for all", "50%", "900 / month", "Cash: 60%", "Equity: 40%", "Shorter please", "Term", "America/Costa_Rica", "Mornings", "2027-01-04", "Welcome Host", "20%", "Credits: 100%", "2026-11-19T10:00:00.000Z", "https://v.test/propose-a-role?role=r-1"]) expect(html).toContain(s);
    expect(html).toContain("Why &lt;me&gt;");
    expect(html).not.toContain("Why <me>");
    expect(html).toMatch(/<pre>[\s\S]*&quot;commitmentPct&quot;: 20[\s\S]*<\/pre>/);
  });

  it("names the file by role and day", () => {
    expect(backupFileName("Gate Keeper / Ops", now)).toBe("application-gate-keeper-ops-2026-11-19.html");
  });

  it("the mailto: subject with a plain hyphen, the body asking for the attachments, and nothing with no address", () => {
    const href = backupMailto("ops@village.test", ["Gate Keeper", "Welcome Host"], en);
    expect(href.startsWith("mailto:ops@village.test?subject=")).toBe(true);
    expect(decodeURIComponent(/subject=([^&]*)/.exec(href)?.[1] ?? "")).toBe("Role application backup - Gate Keeper, Welcome Host");
    expect(decodeURIComponent(/body=([^&]*)/.exec(href)?.[1] ?? "")).toContain("attach the application file I downloaded");
    expect(backupMailto("  ", ["Gate Keeper"], en)).toBe("");
  });
});

describe("when a failure shows the safety net", () => {
  it("network, timeout, 5xx, limits and fieldless refusals do; a fixable answer does not", () => {
    expect(needsSafetyNet({ kind: "network" })).toBe(true);
    expect(needsSafetyNet({ kind: "timeout" })).toBe(true);
    expect(needsSafetyNet({ kind: "status", status: 500, field: null })).toBe(true);
    expect(needsSafetyNet({ kind: "status", status: 429, field: null })).toBe(true);
    expect(needsSafetyNet({ kind: "status", status: 413, field: "files" })).toBe(true);
    expect(needsSafetyNet({ kind: "status", status: 400, field: "voice" })).toBe(true);
    expect(needsSafetyNet({ kind: "status", status: 400, field: null })).toBe(true);
    expect(needsSafetyNet({ kind: "status", status: 400, field: "why" })).toBe(false);
    expect(needsSafetyNet({ kind: "status", status: 409, field: "membership" })).toBe(false);
    expect(sendTimeoutMs(true)).toBeGreaterThan(sendTimeoutMs(false));
  });
});
