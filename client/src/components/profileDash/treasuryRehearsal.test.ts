/**
 * The member's Treasury tab, as the launch rehearsal (15 Nov 2026) read it:
 *   F4   Earned Equity issued by End of Moon shows in "Earned by moon"
 *   F10  read-only amounts are grouped: 4,071, not 4071
 */
import { describe, expect, it } from "vitest";
import { moonRows } from "./dashModel";
import { formatTokenAmount, formatTokenGrouped } from "@/lib/tokenAmount";

const ledger = [
  { tokenType: "earned-equity", amount: 3071, decimals: 0, at: "2026-11-15T22:18:29Z" },
  { tokenType: "earned-equity", amount: 1000, decimals: 0, at: "2026-11-15T22:18:29Z" },
  { tokenType: "gratitude", amount: 5, decimals: 0, at: "2026-11-15T22:19:52Z" },
];
const moons = { current: { startsAt: "2026-11-09T07:03:00Z", endsAt: "2026-12-09T00:53:00Z" }, past: [] };

describe("the Treasury tab after a first End of Moon", () => {
  it("F4: this moon's Earned Equity is counted beside the other tokens", () => {
    const [row] = moonRows(ledger, moons, { village: "credits", voice: null, equity: "earned-equity" }, []);
    expect(row).toMatchObject({ label: "This moon", tokens: 0, equity: 4071 });
    // The control: a caller that names no equity token reads zero, as before.
    expect(moonRows(ledger, moons, { village: "credits", voice: null }, [])[0].equity).toBe(0);
  });

  it("F10: grouped for reading, never for inputs", () => {
    expect(formatTokenGrouped(4071, 0)).toBe("4,071");
    expect(formatTokenGrouped(1234567, 2)).toBe("12,345.67");
    expect(formatTokenGrouped(-250000, 2)).toBe("-2,500");
    expect(formatTokenGrouped(7, 0)).toBe("7");
    expect(formatTokenAmount(4071, 0)).toBe("4071");
  });
});
