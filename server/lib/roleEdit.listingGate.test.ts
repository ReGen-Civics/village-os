/**
 * THE LISTING GATE, lighter for a role that is coming soon or a future venture (20 Nov 2026).
 *
 * Cards proposed through the connector set `listed` and `comingSoon` together on near-empty cards, passed filing,
 * and were then refused on accept for Track, Village goals and the rest. A role nobody applies to yet is listed once
 * it has its Purpose and What it looks after; an open role still needs everything.
 */
import { describe, expect, it } from "vitest";
import { listingProblems, mergedForListing, notReadyToList, type EditorState } from "./roleEdit";

const FULL_OPEN = ["Purpose", "What it looks after", "What you can count on me for", "Time commitment", "Track", "Village goals this role serves", "Selection criteria", "Interviewers"];

const card = (words: Record<string, unknown>, parameters: Record<string, unknown>, pay: EditorState["pay"] = null): EditorState =>
  ({ id: "r", name: "R", circleId: null, isExample: false, words, parameters, parameterKeys: [], pay, archetypes: [], sections: {} }) as unknown as EditorState;

describe("listingProblems", () => {
  it("lists a coming soon card once it has its aim and domain", () => {
    expect(listingProblems(card({ aim: "Keep the books.", domain: "The ledger." }, { comingSoon: true }))).toEqual([]);
  });

  it("lists a future venture card once it has its aim and domain", () => {
    expect(listingProblems(card({ aim: "Run the bakery.", domain: "The oven." }, { futureVenture: true }))).toEqual([]);
  });

  it("still asks a coming soon card for its aim and domain", () => {
    expect(listingProblems(card({ aim: "", domain: [] }, { comingSoon: true }))).toEqual(["Purpose", "What it looks after"]);
    expect(listingProblems(card({}, { futureVenture: true }))).toEqual(["Purpose", "What it looks after"]);
  });

  it("asks an open role for everything, and pay on offer on a paid track (control)", () => {
    expect(listingProblems(card({ aim: "Keep the books.", domain: "The ledger." }, {}))).toEqual(FULL_OPEN.slice(2));
    expect(listingProblems(card({}, { comingSoon: false, futureVenture: false }))).toEqual(FULL_OPEN);
    const paid = listingProblems(card({ aim: "a", domain: "d" }, { track: "contractor" }));
    expect(paid).toContain("Pay on offer");
  });

  it("asks a coming soon card for everything when asked what it lacks to open", () => {
    expect(listingProblems(card({ aim: "Keep the books.", domain: "The ledger." }, { comingSoon: true }), { asOpen: true })).toEqual(FULL_OPEN.slice(2));
  });
});

describe("mergedForListing", () => {
  it("reads comingSoon from the change over the role, so one save that sets comingSoon and listed passes", () => {
    const stored = card({ aim: "Keep the books.", domain: "" }, { listed: false, comingSoon: false });
    const merged = mergedForListing(stored, { listed: true, comingSoon: true, domain: "The ledger." }, null);
    expect(merged.parameters.comingSoon).toBe(true);
    expect(listingProblems(merged)).toEqual([]);
    // Without the change's comingSoon the same card is judged as an open role.
    expect(listingProblems(mergedForListing(stored, { listed: true, domain: "The ledger." }, null))).toContain("Track");
  });

  it("says what is missing in one sentence", () => {
    expect(notReadyToList(["Purpose", "What it looks after"])).toBe("This card is not ready to list yet. Still to write: Purpose, What it looks after.");
  });
});
