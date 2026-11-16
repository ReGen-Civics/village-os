// @vitest-environment jsdom
/**
 * What the hidden map keeps on the phone for a cold open with no signal: the
 * village's words and the member's dials, under `village.offline.*`, and
 * nothing that says where or how many (QA pass 6, P6-2).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { readMapSnapshot, writeMapSnapshot } from "./hiddenMapOffline";

const me: any = {
  open: true, vouchedCount: 9, needed: 7, ownPins: 12, allPins: 63, planters: 10, keeper: true, mayApproveExports: true,
  title: "Our map", kindPrompts: { planting: "What went in?" }, labels: { planting: "Plantings" }, kinds: { planting: ["Seeds"] },
  openLayers: ["stop"], basemap: "none", maxZoom: 13, defaultPrecision: "region", teaser: false, precisions: ["region"],
  vouchesPerPin: 1, plantingPays: true, openedAt: "2026-11-15T12:00:00Z", openedBefore: 6,
};

beforeEach(() => window.localStorage.clear());

describe("the words snapshot", () => {
  it("keeps the village's words and the dials, and no count, time, power or place", () => {
    writeMapSnapshot("u-ash", me);
    const raw = window.localStorage.getItem("village.offline.hidden-map.u-ash")!;
    expect(raw).toContain("Our map");
    for (const gone of ["allPins", "planters", "openedAt", "keeper", "ownPins", "openLayers", "63", "2026-11-15"]) {
      expect(raw).not.toContain(gone);
    }
  });

  it("reads back as a closed map holding nothing, for its owner only", () => {
    writeMapSnapshot("u-ash", me);
    const back = readMapSnapshot("u-ash")!;
    expect(back).toMatchObject({ title: "Our map", open: false, keeper: false, allPins: 0, openLayers: [] });
    expect(readMapSnapshot("u-someone-else")).toBeNull();
  });
});
