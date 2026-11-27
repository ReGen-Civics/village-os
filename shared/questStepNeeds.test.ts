/**
 * Which steps need their own submission, and which a claim still owes (0439).
 * The server's submit gate and the quest page both read these.
 */
import { describe, expect, it } from "vitest";
import { anyStepNeeds, missingSteps, readStepNeeds } from "./questStepNeeds";

describe("step needs", () => {
  it("reads a stored list to one boolean per step, false where unreadable or missing", () => {
    expect(readStepNeeds('[true,false,"yes",true]', 3)).toEqual([true, false, false]);
    expect(readStepNeeds([true], 3)).toEqual([true, false, false]);
    expect(readStepNeeds(null, 2)).toEqual([false, false]);
    expect(readStepNeeds("not json", 1)).toEqual([false]);
  });

  it("a quest whose steps need none behaves as before", () => {
    expect(anyStepNeeds([false, false])).toBe(false);
    expect(anyStepNeeds(undefined)).toBe(false);
    expect(missingSteps([false, false], [])).toEqual([]);
  });

  it("names the needed steps that have nothing yet, in order", () => {
    expect(missingSteps([true, false, true, true], [{ stepIndex: 2 }, { stepIndex: 1 }])).toEqual([0, 3]);
  });
});
