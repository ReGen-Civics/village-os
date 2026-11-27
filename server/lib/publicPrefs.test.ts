/**
 * A user object carries the named prefs keys only (server/lib/publicPrefs.ts): never a daily card, a consent,
 * the Google link or a pending email, and never a key somebody adds later without naming it here.
 */
import { describe, expect, it } from "vitest";
import { PUBLIC_PREFS_KEYS, publicPrefs } from "./publicPrefs";

describe("publicPrefs", () => {
  it("keeps the language and the currency, and drops everything else", () => {
    const prefs = {
      locale: "es",
      displayCurrency: "CRC",
      todayCard: { "2026-11-27": { design: { type: "Projector" } } },
      companionConsent: [{ provider: "Anthropic" }],
      googleLink: { sub: "g-1" },
      pendingEmail: "new@example.test",
      someFutureKey: true,
    };
    expect(publicPrefs(prefs)).toEqual({ locale: "es", displayCurrency: "CRC" });
    expect(PUBLIC_PREFS_KEYS).toEqual(["locale", "displayCurrency"]);
  });

  it("reads nothing out of something that is not a prefs object", () => {
    expect(publicPrefs(null)).toBeUndefined();
    expect(publicPrefs([{ locale: "es" }])).toBeUndefined();
    expect(publicPrefs({})).toEqual({});
  });
});
