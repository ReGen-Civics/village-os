/**
 * The commitment a Compare split suggests rides on the proposal page's address and is typed into the counter-offer,
 * never saved by itself (the lead, 20 Nov 2026). Only a whole step of ten from 10 to 100 reads as one.
 */
import { describe, expect, it } from "vitest";
import { prefillFromSearch } from "./TermsWeOffer";

describe("a suggested commitment on the address", () => {
  it("reads a step of ten, with the role it is for", () => {
    expect(prefillFromSearch("?commitment=40&role=r-garden")).toEqual({ commitmentPct: 40, roleId: "r-garden" });
    expect(prefillFromSearch("?commitment=100")).toEqual({ commitmentPct: 100 });
  });
  it("reads nothing from an address without one, or with one that is not a step of ten", () => {
    for (const q of ["", "?role=r", "?commitment=0", "?commitment=45", "?commitment=110", "?commitment=abc", "?commitment=40.0x"]) expect(prefillFromSearch(q), q).toBeNull();
  });
});
