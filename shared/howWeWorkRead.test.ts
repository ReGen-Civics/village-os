import { describe, expect, it } from "vitest";
import { HOW_WE_WORK_HREF, HOW_WE_WORK_READ_PREF, parseReadInput, readHowWeWorkRead } from "./howWeWorkRead";

describe("the read of How we work together, as stored", () => {
  it("takes true or false and nothing else", () => {
    expect(parseReadInput(true)).toEqual({ ok: true, read: true });
    expect(parseReadInput(false)).toEqual({ ok: true, read: false });
    for (const bad of ["true", 1, 0, null, undefined, {}, []]) expect(parseReadInput(bad).ok, JSON.stringify(bad)).toBe(false);
  });

  it("reads the stored moment back as an ISO timestamp, and null for none or a value that is no moment", () => {
    expect(readHowWeWorkRead({ [HOW_WE_WORK_READ_PREF]: "2026-11-27T10:00:00.000Z" })).toBe("2026-11-27T10:00:00.000Z");
    expect(readHowWeWorkRead({})).toBeNull();
    expect(readHowWeWorkRead(null)).toBeNull();
    expect(readHowWeWorkRead({ [HOW_WE_WORK_READ_PREF]: "soon" })).toBeNull();
    expect(readHowWeWorkRead({ [HOW_WE_WORK_READ_PREF]: true })).toBeNull();
  });

  it("leads back to the chapter's own anchor", () => {
    expect(HOW_WE_WORK_HREF).toBe("/governance/how#how-we-work");
  });
});
