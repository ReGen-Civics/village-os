import { describe, expect, it } from "vitest";
import { overlappingOpenDrafts } from "./orgDraftOverlap";

const d = (id: string, targets: string[], status = "open") => ({ id, status, changes: targets.map((orgRoleId) => ({ orgRoleId })) });

describe("overlappingOpenDrafts: another open draft changes the same part of the chart", () => {
  it("names the other open drafts that touch a target this one touches", () => {
    const me = d("new", ["land-steward"]);
    expect(overlappingOpenDrafts(me, [me, d("old-1", ["land-steward"]), d("old-2", ["land-steward", "water"]), d("else", ["water"])])).toEqual(["old-1", "old-2"]);
  });
  it("leaves out drafts that are no longer open, and the draft itself", () => {
    const me = d("new", ["land-steward"]);
    expect(overlappingOpenDrafts(me, [me, d("gone", ["land-steward"], "withdrawn"), d("done", ["land-steward"], "published")])).toEqual([]);
  });
  it("a circle and a role with the same id are different targets", () => {
    expect(overlappingOpenDrafts(d("a", ["circle:garden"]), [d("b", ["garden"])])).toEqual([]);
  });
  it("a draft with no changes overlaps nothing", () => {
    expect(overlappingOpenDrafts(d("a", []), [d("b", ["x"])])).toEqual([]);
  });
});
