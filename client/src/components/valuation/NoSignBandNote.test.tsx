// @vitest-environment jsdom
/**
 * The no-sign band in words: each side read from its own dial, the older
 * symmetric dial as the fallback, and plus or minus 10% when nothing is set.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import NoSignBandNote from "./NoSignBandNote";
import { PLATFORM_DEFAULT_MODEL, type EngineDials } from "@shared/valuation";

const say = (engine?: Partial<EngineDials>) => {
  const { container, unmount } = render(<NoSignBandNote model={{ ...PLATFORM_DEFAULT_MODEL, ...(engine ? { engine } : {}) }} />);
  const text = container.textContent ?? "";
  unmount();
  return text;
};

describe("the no-sign band note", () => {
  it("says plus or minus 10% when the village set nothing", () => {
    expect(say()).toContain("The band runs from 10% under the suggestion to 10% over it.");
  });
  it("says 20% under up to the suggestion itself for 20 below and 0 above", () => {
    expect(say({ bandBelowPct: 20, bandAbovePct: 0 })).toContain("The band runs from 20% under the suggestion up to the suggestion itself.");
  });
  it("reads a model saved with only the older symmetric dial", () => {
    expect(say({ bandPct: 15 })).toContain("from 15% under the suggestion to 15% over it");
  });
  it("names the other one-sided band and the empty band", () => {
    expect(say({ bandBelowPct: 0, bandAbovePct: 5 })).toContain("The band runs from the suggestion itself up to 5% over it.");
    expect(say({ bandBelowPct: 0, bandAbovePct: 0 })).toContain("The band is the suggestion itself.");
  });
});
