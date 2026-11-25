import { describe, expect, it } from "vitest";
import { airWelcome } from "./airWelcome";

describe("airWelcome", () => {
  it("never for reduced motion or save-data, whatever the device", () => {
    expect(airWelcome({ reduced: true, cores: 16, memoryGB: 16 })).toBe(false);
    expect(airWelcome({ reduced: false, cores: 16, memoryGB: 16, saveData: true })).toBe(false);
  });
  it("not on a phone short of cores or memory", () => {
    expect(airWelcome({ reduced: false, cores: 2, memoryGB: 8 })).toBe(false);
    expect(airWelcome({ reduced: false, cores: 8, memoryGB: 2 })).toBe(false);
  });
  it("yes on a capable device, and when the browser keeps its numbers to itself", () => {
    expect(airWelcome({ reduced: false, cores: 8, memoryGB: 8 })).toBe(true);
    expect(airWelcome({ reduced: false })).toBe(true);
  });
});
