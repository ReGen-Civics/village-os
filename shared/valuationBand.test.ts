/**
 * THE NO-SIGN BAND AS TWO DIALS.
 *
 * Inside the band one setter's word sets a figure; outside it, a reason and a
 * second signer, or the village. The band used to be one symmetric dial
 * (`bandPct`, plus or minus 10). It is now how far under the suggestion it
 * reaches (`bandBelowPct`) and how far over (`bandAbovePct`), so a village can
 * run a band from 80% to 100% of the suggestion. These hold:
 *
 *   1. The platform default is unchanged: plus or minus 10.
 *   2. 20 below and 0 above is 80% to 100% of the suggestion, both edges inside.
 *   3. A model saved with only `bandPct` reads the same as before.
 *   4. The engine, the contract price and the setting rule all judge the same band.
 *   5. A village's variables lay over the model, and blank changes nothing.
 */
import { describe, expect, it } from "vitest";
import {
  bandAround,
  diffModels,
  ENGINE_DEFAULTS,
  insideBand,
  noSignBand,
  validateModel,
  withBandDials,
  type ValuationModel,
  type WorkInputs,
} from "./valuation";
import { modelForVillage, suggestValuation, type PayeeSuggestion } from "./valuationEngine";
import { suggestContract } from "./valuationContract";
import { combineSetting, type SettingContext } from "./valuationSetting";

const src = { sentence: "Decree 45303-MTSS, daily rate ÷ 8", date: "2026-10-31" };
const CRC: ValuationModel = { ...modelForVillage("CRC"), version: 1, bands: [{ key: "general", label: "General help", hourValueMinor: 155455, source: src }] };
const ROLE: WorkInputs = { kind: "role", lines: [{ band: "general", payee: "lead", estimatedHours: 20 }], responsibility: "coordinates" };
const CTX: SettingContext = { setterId: 1, payeeIds: [9], secondSigners: [2, 3], setterSetPayOf: [] };
const lead = (model: ValuationModel): PayeeSuggestion => {
  const s = suggestValuation(model, ROLE, { eeMeaningWritten: true });
  if (!s.ok) throw new Error("fixture");
  return s.payees[0];
};
const EIGHTY_TO_HUNDRED: ValuationModel = { ...CRC, engine: { bandBelowPct: 20, bandAbovePct: 0 } };

describe("the band's own arithmetic", () => {
  it("ships plus or minus 10, and a village that set nothing sees exactly that", () => {
    expect(ENGINE_DEFAULTS.bandPct).toBe(10);
    expect(noSignBand()).toEqual({ belowPct: 10, abovePct: 10 });
    expect(noSignBand({})).toEqual({ belowPct: 10, abovePct: 10 });
    expect(bandAround(1000, noSignBand())).toEqual({ lowMinor: 900, highMinor: 1100 });
  });

  it("runs from 80% to 100% for 20 below and 0 above, both edges inside", () => {
    const band = bandAround(1000, noSignBand({ bandBelowPct: 20, bandAbovePct: 0 }));
    expect(band).toEqual({ lowMinor: 800, highMinor: 1000 });
    expect(insideBand(800, band)).toBe(true);
    expect(insideBand(1000, band)).toBe(true);
    expect(insideBand(900, band)).toBe(true);
    expect(insideBand(799, band)).toBe(false);
    expect(insideBand(1001, band)).toBe(false);
  });

  it("reads a model saved with only the older symmetric dial the way it always did", () => {
    expect(noSignBand({ bandPct: 15 })).toEqual({ belowPct: 15, abovePct: 15 });
    // A side with its own dial reads it; the other side still falls back.
    expect(noSignBand({ bandPct: 15, bandAbovePct: 0 })).toEqual({ belowPct: 15, abovePct: 0 });
  });

  it("never reaches under zero, even at 100% below", () => {
    expect(bandAround(1000, { belowPct: 100, abovePct: 0 })).toEqual({ lowMinor: 0, highMinor: 1000 });
  });
});

describe("every reader judges the same band", () => {
  it("the engine puts the band at 80% to 100% of its own suggestion", () => {
    const p = lead(EIGHTY_TO_HUNDRED);
    expect(p.band).toEqual({ lowMinor: Math.round(p.expected.totalMinor * 0.8), highMinor: p.expected.totalMinor });
    // The platform's band on the same work is unchanged.
    const d = lead(CRC);
    expect(d.band).toEqual({ lowMinor: Math.round(d.expected.totalMinor * 0.9), highMinor: Math.round(d.expected.totalMinor * 1.1) });
  });

  it("the contract price carries the same band around the contract", () => {
    const s = suggestContract(EIGHTY_TO_HUNDRED, { priceMinor: 5000000, deliverable: "A fence", effort: ROLE }, { eeMeaningWritten: true });
    if (!s.ok) throw new Error("fixture");
    const p = s.payees[0];
    expect(p.band).toEqual({ lowMinor: Math.round(p.expected.totalMinor * 0.8), highMinor: p.expected.totalMinor });
  });

  it("one setter's word stands from 80% up to the suggestion, and nowhere else", () => {
    const p = lead(EIGHTY_TO_HUNDRED);
    const at = (pct: number) => combineSetting(p, { totalMinor: Math.round((p.expected.totalMinor * pct) / 100) }, CTX);
    expect(at(80)).toMatchObject({ inside: true, needs: "none" });
    expect(at(85)).toMatchObject({ inside: true, needs: "none" });
    expect(at(100)).toMatchObject({ inside: true, needs: "none" });
    expect(combineSetting(p, { totalMinor: p.band.lowMinor - 1 }, CTX)).toMatchObject({ inside: false, needs: "second", missing: ["reason"] });
    expect(combineSetting(p, { totalMinor: p.band.highMinor + 1 }, CTX)).toMatchObject({ inside: false, needs: "second", missing: ["reason"] });
    // 105% stood under the platform's band; under this one it needs a second signer.
    expect(combineSetting(lead(CRC), { totalMinor: Math.round(lead(CRC).expected.totalMinor * 1.05) }, CTX).inside).toBe(true);
    expect(at(105)).toMatchObject({ inside: false, needs: "second" });
  });
});

describe("a village's own dials over the model", () => {
  it("lays each side over the model, and blank leaves the model's own", () => {
    expect(withBandDials(CRC, { belowPct: null, abovePct: null })).toBe(CRC);
    const laid = withBandDials({ ...CRC, engine: { bandPct: 15, narrowPct: 25 } }, { belowPct: 20, abovePct: null });
    expect(laid.engine).toEqual({ bandPct: 15, narrowPct: 25, bandBelowPct: 20 });
    expect(noSignBand(laid.engine)).toEqual({ belowPct: 20, abovePct: 15 });
    expect(noSignBand(withBandDials(CRC, { belowPct: 20, abovePct: 0 }).engine)).toEqual({ belowPct: 20, abovePct: 0 });
    // The model passed in is not changed.
    expect(CRC.engine).toBeUndefined();
  });

  it("validates each side as a whole percent from 0 to 100", () => {
    expect(validateModel(EIGHTY_TO_HUNDRED)).toEqual([]);
    expect(validateModel({ ...CRC, engine: { bandBelowPct: 100, bandAbovePct: 100 } })).toEqual([]);
    expect(validateModel({ ...CRC, engine: { bandBelowPct: 101 } })).toContain("How far the no-sign band reaches under the suggestion must be a whole number from 0% to 100%.");
    expect(validateModel({ ...CRC, engine: { bandAbovePct: -1 } })).toContain("How far the no-sign band reaches over the suggestion must be a whole number from 0% to 100%.");
    expect(validateModel({ ...CRC, engine: { bandBelowPct: 12.5 } })).toContain("How far the no-sign band reaches under the suggestion must be a whole number from 0% to 100%.");
  });

  it("shows a version's change to the band as the side that moved", () => {
    expect(diffModels(CRC, EIGHTY_TO_HUNDRED)).toEqual([
      { key: "engine:bandBelowPct", label: "No-sign band under the suggestion", from: "10%", to: "20%", door: "version" },
      { key: "engine:bandAbovePct", label: "No-sign band over the suggestion", from: "10%", to: "0%", door: "version" },
    ]);
    // Moving from the older dial to the split one at the same width is no change.
    expect(diffModels({ ...CRC, engine: { bandPct: 10 } }, { ...CRC, engine: { bandBelowPct: 10, bandAbovePct: 10 } })).toEqual([]);
  });
});
