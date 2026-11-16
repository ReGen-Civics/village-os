/**
 * The protocols contract: the rules the phone applies offline and the server
 * applies again on arrival. Each case is one acceptance line of the spec.
 */
import { describe, expect, it } from "vitest";
import {
  checkProtocolDraft,
  clampToNow,
  completionRefusal,
  isClientId,
  mayTick,
  openRequiredSteps,
  progress,
  readProtocolImport,
  slugify,
  stepStates,
  type ProtocolStep,
  type TickEvent,
} from "./protocols";

const ROLES = new Map([["role-keyholder", "Keyholder"]]);

const steps: ProtocolStep[] = [
  { id: "lights", text: "Lights on", detail: "", required: true, who: { kind: "member" } },
  { id: "tea", text: "Kettle filled", detail: "", required: false, who: { kind: "member" } },
  { id: "unlock", text: "Front door unlocked", detail: "", required: true, who: { kind: "role", roleId: "role-keyholder", roleTitle: "Keyholder" } },
];

const tick = (stepId: string, done: boolean, at: string, clientId = `${stepId}-${at}`, by = "u1"): TickEvent => ({
  clientId,
  stepId,
  done,
  by,
  byName: "",
  at,
});

describe("checking a draft", () => {
  it("accepts a named list and fills ids from the words", () => {
    const r = checkProtocolDraft({ title: "Opening up", steps: [{ text: "Lights on" }, { text: "Lights on" }] }, ROLES);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.id).toBe("opening-up");
    expect(r.value.steps.map((s) => s.id)).toEqual(["lights-on", "lights-on-2"]);
    expect(r.value.steps[0]!.required).toBe(true);
    expect(r.value.steps[0]!.who).toEqual({ kind: "member" });
  });

  it("refuses a blank name and a list with no steps", () => {
    const r = checkProtocolDraft({ title: " ", steps: [] }, ROLES);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problems).toContain("Give the protocol a name.");
    expect(r.problems).toContain("Add at least one step.");
  });

  it("refuses a step kept for a role the org chart does not hold", () => {
    const r = checkProtocolDraft({ title: "x", steps: [{ text: "a", who: { kind: "role", roleId: "nope" } }] }, ROLES);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problems[0]).toMatch(/Step 1: pick a role that is on the org chart/);
  });

  it("refuses the same written step id twice", () => {
    const r = checkProtocolDraft({ title: "x", steps: [{ id: "a", text: "a" }, { id: "a", text: "b" }] }, ROLES);
    expect(r.ok).toBe(false);
  });

  it("names the role's current title, whatever the draft carried", () => {
    const r = checkProtocolDraft({ title: "x", steps: [{ text: "a", who: { kind: "role", roleId: "role-keyholder", roleTitle: "Old name" } }] }, ROLES);
    expect(r.ok && r.value.steps[0]!.who).toEqual({ kind: "role", roleId: "role-keyholder", roleTitle: "Keyholder" });
  });
});

describe("reading an import file", () => {
  const roles = [{ id: "role-keyholder", title: "Keyholder" }];

  it("reads `who` as a role name, matched without case, and ignores fields it does not know", () => {
    const file = {
      _about: ["a note"],
      protocols: [
        {
          id: "opening-up",
          title: "Opening up",
          summary: "Before anyone arrives.",
          steps: [
            { id: "lights", text: "Lights on.", who: "anyone", required: true, source: "draft" },
            { id: "tea", text: "Kettle filled.", who: "anyone", required: false },
            { id: "unlock", text: "Front door unlocked.", who: "keyholder", required: true },
          ],
        },
      ],
    };
    const r = readProtocolImport(JSON.stringify(file), roles);
    expect(r.problems).toEqual([]);
    expect(r.drafts).toHaveLength(1);
    const d = r.drafts[0]!;
    expect(d.steps.map((s) => [s.id, s.required, s.who.kind])).toEqual([
      ["lights", true, "member"],
      ["tea", false, "member"],
      ["unlock", true, "role"],
    ]);
    expect(d.steps[2]!.who).toEqual({ kind: "role", roleId: "role-keyholder", roleTitle: "Keyholder" });
  });

  it("names a role the chart lacks once, by its name, and saves nothing from that protocol", () => {
    const r = readProtocolImport({ protocols: [{ title: "Closing", steps: [{ text: "Alarm set", role: "Night warden" }] }] }, roles);
    expect(r.drafts).toEqual([]);
    expect(r.missingRoles).toEqual(["Night warden"]);
    expect(r.problems).toEqual(["Add this role to the org chart first, or edit the file: Night warden."]);
  });

  it("refuses a file that is not JSON, or of another format", () => {
    expect(readProtocolImport("{nope", roles).problems).toEqual(["That file is not JSON."]);
    expect(readProtocolImport({ format: "other/2", protocols: [] }, roles).problems[0]).toMatch(/this village reads "village-protocols\/1"/);
  });

  it("refuses the same protocol id twice in one file", () => {
    const one = { id: "a", title: "A", steps: [{ text: "x" }] };
    const r = readProtocolImport({ protocols: [one, one] }, roles);
    expect(r.problems).toEqual(['A: the id "a" is used twice in this file.']);
  });
});

describe("a run's state", () => {
  it("is the latest event per step; on the same instant the larger id wins", () => {
    const s = stepStates(steps, [
      tick("lights", true, "2026-11-15T10:00:00.000Z"),
      tick("lights", false, "2026-11-15T10:01:00.000Z"),
      tick("tea", true, "2026-11-15T10:00:00.000Z", "b"),
      tick("tea", false, "2026-11-15T10:00:00.000Z", "a"),
    ]);
    expect(s.get("lights")!.done).toBe(false);
    expect(s.get("tea")!.done).toBe(true);
    expect(s.get("unlock")!.done).toBe(false);
  });

  it("merges two phones' ticks in any order to the same answer", () => {
    const a = [tick("lights", true, "2026-11-15T10:00:00.000Z", "p1-1"), tick("unlock", true, "2026-11-15T10:02:00.000Z", "p1-2")];
    const b = [tick("lights", false, "2026-11-15T10:01:00.000Z", "p2-1")];
    const one = stepStates(steps, [...a, ...b]);
    const two = stepStates(steps, [...b, ...a].reverse());
    expect([...one.entries()]).toEqual([...two.entries()]);
    expect(progress(steps, [...a, ...b])).toEqual({ done: 1, total: 3 });
  });

  it("cannot complete with a required step open, and can with an optional one open", () => {
    expect(openRequiredSteps(steps, [tick("lights", true, "2026-11-15T10:00:00.000Z")]).map((s) => s.id)).toEqual(["unlock"]);
    expect(
      openRequiredSteps(steps, [tick("lights", true, "2026-11-15T10:00:00.000Z"), tick("unlock", true, "2026-11-15T10:01:00.000Z")]),
    ).toEqual([]);
  });

  it("says which required step waits, and for whom", () => {
    expect(completionRefusal([steps[2]!])).toBe("One required step is still open: Front door unlocked (Keyholder).");
    expect(completionRefusal([steps[0]!, steps[2]!])).toBe("2 required steps are still open, starting with: Lights on.");
  });
});

describe("who may tick", () => {
  it("any member ticks a member step; only a holder ticks a role step", () => {
    expect(mayTick(steps[0]!, { id: "u1", roleIds: [] })).toBe(true);
    expect(mayTick(steps[2]!, { id: "u1", roleIds: [] })).toBe(false);
    expect(mayTick(steps[2]!, { id: "u1", roleIds: ["role-keyholder"] })).toBe(true);
  });
});

describe("small rules", () => {
  it("clamps a future device time to now and keeps a past one", () => {
    const now = Date.parse("2026-11-15T12:00:00.000Z");
    expect(clampToNow("2026-11-16T12:00:00.000Z", now)).toBe("2026-11-15T12:00:00.000Z");
    expect(clampToNow("2026-11-15T11:00:00.000Z", now)).toBe("2026-11-15T11:00:00.000Z");
    expect(clampToNow("garbage", now)).toBe("2026-11-15T12:00:00.000Z");
  });

  it("takes device ids of a sane shape only", () => {
    expect(isClientId("0b8f3a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b")).toBe(true);
    expect(isClientId("short")).toBe(false);
    expect(isClientId("has space in it")).toBe(false);
  });

  it("slugs words", () => {
    expect(slugify("Café: open up!")).toBe("cafe-open-up");
    expect(slugify("!!!")).toBe("item");
  });
});
