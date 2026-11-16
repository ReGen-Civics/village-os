/**
 * The roots grid never leaves a hole (design pass D-21): five cards in three columns
 * used to leave the last row one card short on the left. A short last row is centred.
 */
import { describe, expect, it } from "vitest";
import { centring } from "./centring";

describe("centring a short last row", () => {
  it("centres the last two of five on a desktop and the lone fifth on a tablet", () => {
    expect([0, 1, 2, 3, 4].map((i) => centring(i, 5))).toEqual(["", "", "", "lg:col-start-2", "sm:col-start-2 lg:col-start-auto"]);
  });
  it("centres a lone fourth card on a desktop and leaves a full tablet grid alone", () => {
    expect([0, 1, 2, 3].map((i) => centring(i, 4))).toEqual(["", "", "", "lg:col-start-3"]);
  });
  it("does the same one breakpoint down for the characters, two on a phone and three from sm", () => {
    expect([3, 4].map((i) => centring(i, 5, "base-sm"))).toEqual(["sm:col-start-2", "col-start-2 sm:col-start-auto"]);
  });
  it("moves nothing when every row is full", () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => centring(i, 6)).every((c) => c === "")).toBe(true);
  });
});
