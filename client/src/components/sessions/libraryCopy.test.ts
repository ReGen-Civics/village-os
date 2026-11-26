import { describe, expect, it } from "vitest";
import { LIBRARY_COPY as SHARED, broughtFor as sharedFor } from "@shared/sessionLibrary";
import { AIM_DEFS as SHARED_AIMS } from "@shared/sessions";
import { AIM_DEFS, LIBRARY_COPY, broughtFor } from "./libraryCopy";

describe("the agenda library's words match the shared tables (the Spanish crawl, 26 Nov 2026)", () => {
  it("has every key, and every plain word reads the shared English with no language started", () => {
    expect(Object.keys(LIBRARY_COPY).sort()).toEqual(Object.keys(SHARED).sort());
    for (const [k, v] of Object.entries(SHARED)) if (typeof v === "string") expect(LIBRARY_COPY[k as keyof typeof LIBRARY_COPY], k).toBe(v);
  });

  it("every worded line reads the shared English", () => {
    expect(LIBRARY_COPY.broughtBy("Ana", "18 Nov")).toBe(SHARED.broughtBy("Ana", "18 Nov"));
    expect(LIBRARY_COPY.broughtByName("Ana")).toBe(SHARED.broughtByName("Ana"));
    expect(LIBRARY_COPY.broughtByYou("18 Nov")).toBe(SHARED.broughtByYou("18 Nov"));
    expect(LIBRARY_COPY.changedBy("Ana")).toBe(SHARED.changedBy("Ana"));
    for (const n of [1, 3]) expect(LIBRARY_COPY.startWith(n)).toBe(SHARED.startWith(n));
    for (const c of ["Garden", "Garden circle", null]) {
      expect(LIBRARY_COPY.saved(c)).toBe(SHARED.saved(c));
      expect(broughtFor(c)).toBe(sharedFor(c));
    }
  });

  it("the three aims read the shared English", () => {
    expect(Object.keys(AIM_DEFS).sort()).toEqual(Object.keys(SHARED_AIMS).sort());
    for (const [aim, d] of Object.entries(SHARED_AIMS)) expect({ ...AIM_DEFS[aim as keyof typeof AIM_DEFS] }, aim).toEqual(d);
  });
});
