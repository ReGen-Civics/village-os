/**
 * SEVERAL ROLES IN ONE PROPOSAL (the lead, 17 Nov 2026, confirmed 18 Nov): each role with its own commitment, price
 * ask and split, read the same way whatever shape the body was stored in.
 */
import { describe, expect, it } from "vitest";
import { OPEN_APPLY_ROLES, OPEN_PROPOSAL_MAX_ROLES, OPEN_WORDS, openBodyOf, parseOpenProposal, roleTermsOf, termsPerRole } from "./openProposals";

const split = { commitmentPct: 40, offered: { total: 4000, shares: [{ label: "Cash", pct: 60, amount: 2400 }, { label: "Equity", pct: 40, amount: 1600 }] }, proposed: { total: 4000, shares: [{ label: "Cash", pct: 80, amount: 3200 }, { label: "Equity", pct: 20, amount: 800 }] } };

describe("several roles in one proposal", () => {
  it("takes up to the same three roles a stored proposal is read with", () => {
    expect(OPEN_APPLY_ROLES).toBe(OPEN_PROPOSAL_MAX_ROLES);
    expect(OPEN_APPLY_ROLES).toBe(3);
  });

  it("a one-role body reads as it always did: its terms from the card, the ask and the split", () => {
    const body = openBodyOf({ roles: [{ roleId: "r1" }], why: "w", aim: "a", payAsk: { kind: "amount", monthly: 5000 }, paySplit: split });
    expect(termsPerRole(body)).toBe(false);
    expect(body.roles).toEqual([{ roleId: "r1", note: "" }]);
    expect(roleTermsOf({ ...body, card: { commitmentPct: 50 } as any })).toEqual([{ roleId: "r1", commitmentPct: 50, payAsk: { kind: "amount", monthly: 5000 }, paySplit: split }]);
  });

  it("an older body naming several roles with one commitment gives every role that commitment and ask", () => {
    const body = openBodyOf({ roles: [{ roleId: "r1" }, { roleId: "r2" }], why: "w", aim: "a", payAsk: { kind: "negotiate" } });
    expect(termsPerRole(body)).toBe(false);
    expect(roleTermsOf({ ...body, card: { commitmentPct: 60 } as any }).map((r) => [r.roleId, r.commitmentPct, r.payAsk?.kind])).toEqual([
      ["r1", 60, "negotiate"],
      ["r2", 60, "negotiate"],
    ]);
  });

  it("a body with a commitment for each role keeps each role's own terms, and drops what is not one", () => {
    const body = openBodyOf({
      roles: [
        { roleId: "r1", commitmentPct: 50, payAsk: { kind: "amount", monthly: 6000 } },
        { roleId: "r2", commitmentPct: 40, payAsk: { kind: "negotiate" }, paySplit: split },
        { roleId: "r3", commitmentPct: 35, payAsk: { kind: "amount", monthly: -1 }, paySplit: { nope: true } },
      ],
      why: "w",
      aim: "a",
    });
    expect(termsPerRole(body)).toBe(true);
    expect(body.roles[2]).toEqual({ roleId: "r3", note: "" });
    expect(roleTermsOf(body)).toEqual([
      { roleId: "r1", commitmentPct: 50, payAsk: { kind: "amount", monthly: 6000 }, paySplit: null },
      { roleId: "r2", commitmentPct: 40, payAsk: { kind: "negotiate" }, paySplit: split },
      { roleId: "r3", commitmentPct: null, payAsk: null, paySplit: null },
    ]);
  });

  it("the first role of several falls back to where a one-role proposal keeps its terms", () => {
    const body = openBodyOf({ roles: [{ roleId: "r1" }, { roleId: "r2", commitmentPct: 30 }], why: "w", aim: "a", payAsk: { kind: "negotiate" }, paySplit: split });
    expect(roleTermsOf({ ...body, card: { commitmentPct: 70 } as any })[0]).toEqual({ roleId: "r1", commitmentPct: 70, payAsk: { kind: "negotiate" }, paySplit: split });
  });

  describe("as the form sends it", () => {
    const ctx = { roleIds: new Set(["r1", "r2", "r3", "r4"]), address: (s: string) => (s.includes("@") ? s.trim() : null) };
    const base = { name: "Rowan", email: "rowan@example.test", why: "Because.", aim: "", payAsk: { kind: "negotiate" } };

    it("refuses a coming-soon role added after the first, and takes it as the first (the lead, 19 Nov 2026)", () => {
      const notYetOpen = (id: string) => id === "r2";
      const added = parseOpenProposal({ ...base, roles: [{ roleId: "r1" }, { roleId: "r2", commitmentPct: 40 }] }, { ...ctx, notYetOpen });
      expect(added).toMatchObject({ ok: false, field: "roles.1", error: OPEN_WORDS.addedRoleNotOpen });
      // CONTROL: the same role as the first one is not refused here, and with no rule nothing is refused.
      expect(parseOpenProposal({ ...base, roles: [{ roleId: "r2" }] }, { ...ctx, notYetOpen }).ok).toBe(true);
      expect(parseOpenProposal({ ...base, roles: [{ roleId: "r1" }, { roleId: "r2", commitmentPct: 40 }] }, ctx).ok).toBe(true);
    });

    it("keeps each added role's commitment and ask, and copies the first role's onto it", () => {
      const p = parseOpenProposal({ ...base, roles: [{ roleId: "r1" }, { roleId: "r2", commitmentPct: 50, payAsk: { kind: "amount", monthly: 3000, per: "month" } }] }, ctx);
      expect(p.ok).toBe(true);
      if (!p.ok) return;
      expect(p.value.body.roles).toEqual([
        { roleId: "r1", note: "", payAsk: { kind: "negotiate" } },
        { roleId: "r2", note: "", commitmentPct: 50, payAsk: { kind: "amount", monthly: 3000, per: "month" } },
      ]);
      // The previous release reads the first role's terms where they always were.
      expect(p.value.body.payAsk).toEqual({ kind: "negotiate" });
    });

    it("refuses an added role's commitment off the steps, and an ask that is not one, on that role's field", () => {
      expect(parseOpenProposal({ ...base, roles: [{ roleId: "r1" }, { roleId: "r2", commitmentPct: 45 }] }, ctx)).toMatchObject({ ok: false, field: "roles.1" });
      expect(parseOpenProposal({ ...base, roles: [{ roleId: "r1" }, { roleId: "r2", commitmentPct: 0 }] }, ctx)).toMatchObject({ ok: false, field: "roles.1" });
      expect(parseOpenProposal({ ...base, roles: [{ roleId: "r1" }, { roleId: "r2", commitmentPct: 50, payAsk: { kind: "amount", monthly: "lots" } }] }, ctx)).toMatchObject({ ok: false, field: "roles.1" });
    });

    it("refuses a fourth role", () => {
      const four = ["r1", "r2", "r3", "r4"].map((roleId, i) => (i ? { roleId, commitmentPct: 20 } : { roleId }));
      expect(parseOpenProposal({ ...base, roles: four }, ctx)).toMatchObject({ ok: false, field: "roles" });
    });
  });
});
