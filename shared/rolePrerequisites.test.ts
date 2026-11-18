/**
 * Role prerequisites, the grammar and the check. Every id here is invented.
 */
import { describe, expect, it } from "vitest";
import { VARIABLES_BY_KEY, validateVariable } from "./gameVariables";
import { missingFor, missingSentence, parsePrerequisites, prerequisitesProblem, printPrerequisites, PREREQUISITES_KEY } from "./rolePrerequisites";

describe("the grammar", () => {
  it("blank asks nothing of anybody", () => {
    const p = parsePrerequisites("");
    expect(p.ok && p.map.size).toBe(0);
  });

  it("reads roles, items and both kinds, and prints back the same", () => {
    const raw = "lead-role = product:prod-1, quest:q-9; second = quest:q-2";
    const p = parsePrerequisites(raw);
    if (!p.ok) throw new Error(p.error);
    expect(p.map.get("lead-role")).toEqual([{ kind: "product", id: "prod-1" }, { kind: "quest", id: "q-9" }]);
    expect(printPrerequisites(p.map)).toBe(raw);
  });

  it("refuses a malformed value whole, in words", () => {
    expect(prerequisitesProblem("lead-role product:prod-1")).toMatch(/equals sign/);
    expect(prerequisitesProblem("lead-role = token:abc")).toMatch(/product: or quest:/);
    expect(prerequisitesProblem("lead-role = product:bad id")).toMatch(/not an id/);
    expect(prerequisitesProblem("a = quest:q; a = quest:r")).toMatch(/listed twice/);
    expect(prerequisitesProblem("a = ")).toMatch(/asks for nothing/);
  });

  it("is held at every write door: the dial refuses a bad value", () => {
    const def = VARIABLES_BY_KEY[PREREQUISITES_KEY];
    expect(def).toBeDefined();
    expect(validateVariable(def, "lead-role = token:abc")).toMatch(/product: or quest:/);
    expect(validateVariable(def, "lead-role = product:prod-1")).toBeNull();
    expect(validateVariable(def, "")).toBeNull();
  });
});

describe("the check", () => {
  const parsed = parsePrerequisites("lead-role = product:prod-1, quest:q-9");
  const map = parsed.ok ? parsed.map : new Map();

  it("names each missing item, and nothing once all are held", () => {
    const none = { paidProducts: new Set<string>(), consentedQuests: new Set<string>() };
    expect(missingFor(["lead-role", "other"], map, none)).toEqual([
      { roleId: "lead-role", items: [{ kind: "product", id: "prod-1" }, { kind: "quest", id: "q-9" }] },
    ]);
    const all = { paidProducts: new Set(["prod-1"]), consentedQuests: new Set(["q-9"]) };
    expect(missingFor(["lead-role"], map, all)).toEqual([]);
  });

  it("says what to do in plain words", () => {
    expect(missingSentence([{ roleName: "Lead", labels: ["Pay for Lessons"] }])).toBe("Lead asks for one thing before you apply: Pay for Lessons.");
  });
});
