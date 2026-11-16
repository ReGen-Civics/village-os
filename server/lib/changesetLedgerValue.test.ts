/**
 * A longtext dial's change is recorded in the amendment ledger, clipped to the
 * 255-character columns with a marker, instead of failing the row (QA I-5:
 * `guide.voice` and `characters.forge_style` vanished from "Changes to the Rules").
 */
import { describe, expect, it } from "vitest";
import { LEDGER_CLIPPED_MARK, LEDGER_VALUE_MAX, ledgerValue } from "./changeset";

describe("a ledger value", () => {
  it("is kept as it is when it fits", () => {
    expect(ledgerValue(null)).toBeNull();
    expect(ledgerValue("10")).toBe("10");
    expect(ledgerValue("x".repeat(LEDGER_VALUE_MAX))).toBe("x".repeat(LEDGER_VALUE_MAX));
  });

  it("is clipped to the column with a marker when it does not", () => {
    const v = ledgerValue("y".repeat(1000))!;
    expect(Array.from(v)).toHaveLength(LEDGER_VALUE_MAX);
    expect(v.endsWith(LEDGER_CLIPPED_MARK)).toBe(true);
  });

  it("counts code points the way the column does, and never splits one", () => {
    const v = ledgerValue("🌱".repeat(300))!;
    expect(Array.from(v)).toHaveLength(LEDGER_VALUE_MAX);
    expect(v.startsWith("🌱")).toBe(true);
    expect(ledgerValue("🌱".repeat(200))).toBe("🌱".repeat(200));
  });
});
