import { describe, expect, it } from "vitest";
import { deliveryAddresses, deliveryExtra, isEmailDelivery, normalizeAddress } from "./memberEmails";

const one = [{ email: "ops@village.test", getsMail: false }];
const two = [
  { email: "a@x.test", getsMail: false },
  { email: "b@x.test", getsMail: true },
];

describe("where a member's mail goes", () => {
  it("nothing chosen, or main, is the main address only: how every account behaved before", () => {
    expect(deliveryAddresses({ main: "Me@Home.test", delivery: null, extras: one })).toEqual(["me@home.test"]);
    expect(deliveryAddresses({ main: "me@home.test", delivery: "main", extras: one })).toEqual(["me@home.test"]);
    expect(deliveryAddresses({ main: "me@home.test", delivery: "nonsense", extras: one })).toEqual(["me@home.test"]);
  });

  it("other is the extra address only; both is the two of them", () => {
    expect(deliveryAddresses({ main: "me@home.test", delivery: "other", extras: one })).toEqual(["ops@village.test"]);
    expect(deliveryAddresses({ main: "me@home.test", delivery: "both", extras: one })).toEqual(["me@home.test", "ops@village.test"]);
  });

  it("with several extra addresses, the marked one receives; with none marked, the earliest", () => {
    expect(deliveryExtra(two)).toBe("b@x.test");
    expect(deliveryExtra([{ email: "a@x.test", getsMail: false }, { email: "c@x.test", getsMail: false }])).toBe("a@x.test");
    expect(deliveryAddresses({ main: "me@home.test", delivery: "other", extras: two })).toEqual(["b@x.test"]);
  });

  it("a choice with no extra address left falls back to the main one, so mail never goes nowhere", () => {
    expect(deliveryAddresses({ main: "me@home.test", delivery: "other", extras: [] })).toEqual(["me@home.test"]);
    expect(deliveryAddresses({ main: "me@home.test", delivery: "both", extras: [] })).toEqual(["me@home.test"]);
  });

  it("knows its three choices and stores addresses trimmed and lower-cased", () => {
    expect(["main", "other", "both"].every(isEmailDelivery)).toBe(true);
    expect(isEmailDelivery("all")).toBe(false);
    expect(normalizeAddress("  Ops@Village.Test ")).toBe("ops@village.test");
  });
});
