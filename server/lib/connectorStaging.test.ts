/**
 * The pure parts of lane 5's staging step (server/lib/connectorStaging.ts). The filing route's behaviour with the
 * engine is in server/routes/proposedChanges.test.ts, on a real schema.
 */
import { describe, expect, it } from "vitest";
import { HELD_FOR_FILER, readReconsider, REDISCARD_DAYS, sameAsLive } from "./connectorStaging";
import { HELD_CODES } from "../../shared/suggestionPipeline/engine";

describe("whether a proposal is already live", () => {
  it("is live only when every value it sets is the value live holds there", () => {
    expect(sameAsLive({ hero: { headline: "Welcome", badge: "Open" } }, { hero: { headline: "Welcome" } })).toBe(true);
    expect(sameAsLive({ hero: { headline: "Welcome" } }, { hero: { headline: "Hello" } })).toBe(false);
    expect(sameAsLive({ value: "10" }, { value: "10" })).toBe(true);
    expect(sameAsLive({ goals: [{ text: "a" }] }, { goals: [{ text: "a" }, { text: "b" }] })).toBe(false);
  });
  it("is never live when live could not be read, or when the proposal sets nothing", () => {
    expect(sameAsLive(null, { value: "10" })).toBe(false);
    expect(sameAsLive(undefined, { value: "10" })).toBe(false);
    expect(sameAsLive({ value: "10" }, {})).toBe(false);
    expect(sameAsLive("text", { value: "10" })).toBe(false);
  });
});

describe("a filing's reconsider", () => {
  it("takes a code and a reason, bounded, and nothing else", () => {
    expect(readReconsider({ code: " B-9.1 ", reason: "The circle asked  again." })).toEqual({ code: "B-9.1", reason: "The circle asked again." });
    expect(readReconsider({ code: "B-9.1" })).toBeNull();
    expect(readReconsider({ code: "", reason: "Because." })).toBeNull();
    expect(readReconsider("B-9.1")).toBeNull();
    expect(readReconsider({ code: "B".repeat(99), reason: "x".repeat(900) })).toEqual({ code: "B".repeat(24), reason: "x".repeat(500) });
  });
});

describe("what the filer is told", () => {
  it("says every held reason in a sentence, with no other filer's words, and the window is the lead's thirty days", () => {
    for (const code of HELD_CODES) expect(HELD_FOR_FILER[code], code).toMatch(/^Held: /);
    expect(REDISCARD_DAYS).toBe(30);
  });
});
