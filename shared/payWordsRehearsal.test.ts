/**
 * Pay words the launch rehearsal (15 Nov 2026) read wrong, each pinned:
 *   F2  the terms a member aligns with name how the total reward is shared
 *   F8  a reason that ends its own sentence gets no second full stop
 *   F9  a cash or ledger line names the moon by its dates, never its cycle id
 */
import { describe, expect, it } from "vitest";
import { settingsWords, paySharedLine } from "./seatSettings";
import { ACCOMPLISHED_WORDS } from "./accomplishedReview";
import { invoiceTitleOf } from "../server/lib/moonReview";

describe("pay words from the launch rehearsal", () => {
  it("F2: the terms say the figure is the total reward, and how it is shared", () => {
    const rows = settingsWords({ v: 1, pay: { kind: "fixed", currency: "USD", amountMinor: 850_000, per: "month", shape: [{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }] } } as any);
    const pay = rows.find((r) => r.lines.some((l) => l.startsWith("Total reward")));
    expect(pay?.lines).toContain("Total reward, shared as Cash 60%, Equity 40%");
    // The control: no shape, no line.
    const plain = settingsWords({ v: 1, pay: { kind: "fixed", currency: "USD", amountMinor: 850_000, per: "month" } } as any);
    expect(plain.some((r) => r.lines.some((l) => l.startsWith("Total reward")))).toBe(false);
    expect(paySharedLine([{ label: "Cash", pct: 100 }])).toBe("Total reward, shared as Cash 100%");
  });

  it("F8: one full stop after the reason, whether or not the Treasurer typed one", () => {
    const withStop = ACCOMPLISHED_WORDS.returned("Events Steward", "US$2,500", "Three of the four potlucks happened this moon.");
    const without = ACCOMPLISHED_WORDS.returned("Events Steward", "US$2,500", "Three of the four potlucks happened this moon");
    expect(withStop).toBe("The Treasurer proposes US$2,500 for Events Steward: Three of the four potlucks happened this moon. Read it, reply if you want, and send your invoice again.");
    expect(without).toBe(withStop);
    expect(withStop).not.toContain("..");
    expect(ACCOMPLISHED_WORDS.returned("Events Steward", "US$2,500", "Why so few?")).toContain("Why so few? Read it");
  });

  it("F9: the moon by its dates, the cycle id only when there are none", () => {
    expect(invoiceTitleOf("lunar-000331", "FAY-2", "10 October to 8 November 2026")).toBe("moon of 10 October to 8 November 2026, invoice FAY-2");
    expect(invoiceTitleOf("lunar-000331", "FAY-2", null)).toBe("moon lunar-000331, invoice FAY-2");
  });
});
