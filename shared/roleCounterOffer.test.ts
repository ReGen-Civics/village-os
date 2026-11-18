/**
 * THE COUNTER-OFFER FOR EACH ROLE (the lead, 18 Nov 2026): each role's commitment (after the first) and price.
 */
import { describe, expect, it } from "vitest";
import { counterOfferOf, editOffer, offerVersion, replyToOffer } from "./counterOffer";
import { contractPriceWith } from "./contractPrice";
import { currentRoleValue, editRoleOffer, replyKey, replyToRoleOffer, roleCounterOf, roleOpenTalks, rolePriceCountered, roleStateOf } from "./roleCounterOffer";

const BY = { id: "u-hal", name: "Hal" };
const NOW = new Date("2026-11-18T12:00:00Z");
const ROLES = [
  { roleId: "r1", commitmentPct: 50, price: 6000 },
  { roleId: "r2", commitmentPct: 40, price: null },
];

describe("a counter-offer for each role", () => {
  it("counters a later role's commitment and any role's price, and refuses the first role's commitment here", () => {
    const first = editRoleOffer({ rc: null, roles: ROLES, edits: [{ roleId: "r1", commitmentPct: 60 }], by: BY, now: NOW });
    expect(first).toMatchObject({ ok: false, roleId: "r1" });
    const e = editRoleOffer({ rc: null, roles: ROLES, edits: [{ roleId: "r2", commitmentPct: 60, price: 2500 }, { roleId: "r1", price: 5500 }], by: BY, now: NOW });
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(e.revision?.changes).toEqual([
      { roleId: "r2", key: "commitment", from: "40", to: "60" },
      { roleId: "r2", key: "price", from: null, to: "2500" },
      { roleId: "r1", key: "price", from: "6000", to: "5500" },
    ]);
    expect(currentRoleValue(e.rc, "r2", "commitment", 40)).toBe(60);
    expect(rolePriceCountered(e.rc, "r1")).toBe(5500);
    expect(rolePriceCountered(e.rc, "r3")).toBeNull();
    // The same values again change nothing.
    expect(editRoleOffer({ rc: e.rc, roles: ROLES, edits: [{ roleId: "r2", commitmentPct: 60 }], by: BY, now: NOW })).toMatchObject({ ok: true, revision: null });
  });

  it("refuses a role not in the proposal, a commitment off the steps and a price that is not a whole number", () => {
    expect(editRoleOffer({ rc: null, roles: ROLES, edits: [{ roleId: "r9", price: 100 }], by: BY, now: NOW })).toMatchObject({ ok: false });
    expect(editRoleOffer({ rc: null, roles: ROLES, edits: [{ roleId: "r2", commitmentPct: 45 }], by: BY, now: NOW })).toMatchObject({ ok: false });
    expect(editRoleOffer({ rc: null, roles: ROLES, edits: [{ roleId: "r2", price: 10.5 }], by: BY, now: NOW })).toMatchObject({ ok: false });
  });

  it("asks the applicant again when a value changes again, and lists what is not agreed", () => {
    const one = editRoleOffer({ rc: null, roles: ROLES, edits: [{ roleId: "r2", price: 2500 }], by: BY, now: NOW });
    if (!one.ok) throw new Error("no edit");
    expect(roleOpenTalks(one.rc)).toEqual([{ roleId: "r2", key: "price" }]);
    const answered = replyToRoleOffer(one.rc, { [replyKey("r2", "price")]: { choice: "accept", note: "" } }, NOW);
    if (!answered.ok || !answered.rc) throw new Error("no reply");
    expect(roleStateOf(answered.rc, "r2", "price")).toBe("accept");
    expect(roleOpenTalks(answered.rc)).toEqual([]);
    const again = editRoleOffer({ rc: answered.rc, roles: ROLES, edits: [{ roleId: "r2", price: 2700 }], by: BY, now: NOW });
    if (!again.ok) throw new Error("no edit");
    expect(roleStateOf(again.rc, "r2", "price")).toBe("waiting");
    // Only a countered value can be answered.
    expect(replyToRoleOffer(again.rc, { [replyKey("r1", "price")]: { choice: "accept" } }, NOW)).toMatchObject({ ok: false });
  });

  it("rides in the proposal's counter-offer: kept through its reader and its edits, and counted in the version a save checks", () => {
    const e = editRoleOffer({ rc: null, roles: ROLES, edits: [{ roleId: "r2", commitmentPct: 70 }], by: BY, now: NOW });
    if (!e.ok) throw new Error("no edit");
    // Only a role countered: the proposal's own revisions are empty, and the roles' are read back.
    const stored = counterOfferOf(JSON.parse(JSON.stringify({ revisions: [], replies: {}, roles: e.rc })));
    expect(stored?.roles?.revisions).toHaveLength(1);
    expect(offerVersion(stored)).toBe(1);
    const words = editOffer({ base: {}, theirs: 50, co: stored, edit: { commitmentPct: 60 }, by: BY, now: NOW });
    if (!words.ok) throw new Error("no words");
    expect(words.co.roles).toEqual(stored?.roles);
    expect(offerVersion(words.co)).toBe(2);
    const replied = replyToOffer(words.co, { commitment: { choice: "accept", note: "" } }, NOW);
    expect(replied.ok && replied.co.roles).toEqual(stored?.roles);
    // CONTROL: a counter-offer from before roles were countered reads as it always did.
    expect(counterOfferOf({ revisions: [], replies: {} })).toBeNull();
    expect(roleCounterOf(undefined)).toBeNull();
  });

  it("the contract takes a countered price as the price agreed, held to the cap", () => {
    const ceiling = { amount: 10000, currency: "USD", per: "month" as const };
    expect(contractPriceWith(ceiling, 50, { kind: "amount", monthly: 4000 }, 4500)).toMatchObject({ source: "countered", amountMinor: 450000, capped: false });
    expect(contractPriceWith(ceiling, 50, null, 9000)).toMatchObject({ source: "countered", amountMinor: 600000, capped: true });
    // CONTROL: no counter, the ask as before.
    expect(contractPriceWith(ceiling, 50, { kind: "amount", monthly: 4000 }, null)).toMatchObject({ source: "ask", amountMinor: 400000 });
  });
});
