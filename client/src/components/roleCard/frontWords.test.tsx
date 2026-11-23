// @vitest-environment jsdom
/**
 * THE CLOSED CARD'S FRONT (the lead, 23 Nov 2026): the status pill says the kind, the pay split is a mini bar with a
 * one-line legend and no amount (credits always, 0% said as not in use yet), the last day to apply on its gold tile,
 * and "Upcoming paid role" on an upcoming role. Unit checks of the words, then the team sheet and the upcoming cards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupI18n } from "@lingui/core";
import { cleanup, render } from "@testing-library/react";
import { DEFAULT_SHARE_NAMES, type ShareNames } from "@shared/contributionToken";
import { readApplyBy, readSections } from "@shared/roleCardSections";
import { applyByWords, frontKind, payMixParts, payMixWords, pillKind, soonIsPaid, volunteerLine } from "./frontWords";
import FoundingTeam, { type FoundingRole } from "./FoundingTeam";
import ComingSoonRoles from "./ComingSoonRoles";

vi.mock("@/lib/natureArt", () => ({ useRoleArt: () => () => null }));

const i18n = setupI18n({ locale: "en", messages: { en: {} } });
const NAMES: ShareNames = { equity: "Harbour Tokens", equityShort: "Harbour tokens", credits: "Harbour Credits" };
const SECTIONS = { idealBackground: [], qualities: [], aiSupport: "", aiCompanion: "", paid: false, payShape: [], payNote: "", payCeiling: null, paySplitNote: "" };

describe("the front's words", () => {
  it("names the role's kind from its track, then the card's paid flag; a venture and an AI role say nothing", () => {
    expect(frontKind({ card: { track: "contractor" } }, null)).toBe("paid");
    expect(frontKind({ card: { track: "paid" } }, null)).toBe("paid");
    expect(frontKind({ card: { track: "employee" } }, null)).toBe("paid");
    expect(frontKind({ card: { track: "volunteer" } }, { paid: true })).toBe("volunteer");
    expect(frontKind({ card: { track: "ai" } }, { paid: true })).toBeNull();
    expect(frontKind({ card: {} }, { paid: true })).toBe("paid");
    expect(frontKind({ card: {} }, { paid: false, payCeiling: { amount: 9000, currency: "USD", per: "month" } })).toBe("paid");
    expect(frontKind({ card: {} }, { paid: false })).toBeNull();
    expect(frontKind({ futureVenture: true, card: { track: "contractor" } }, { paid: true })).toBeNull();
  });

  it("says only the shares above zero, with the village's own token names, and never an amount", () => {
    expect(payMixWords(i18n, [{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }, { label: "Credits", pct: 0 }], NAMES)).toBe("60% cash, 40% Harbour tokens");
    expect(payMixWords(i18n, [{ label: "Cash", pct: 40 }, { label: "Harbour Tokens", pct: 55 }, { label: "Credits", pct: 5 }], NAMES)).toBe("40% cash, 55% Harbour tokens, 5% Harbour Credits");
    expect(payMixWords(i18n, [{ label: "Cash", pct: 100 }], DEFAULT_SHARE_NAMES)).toBe("100% cash");
    // A label that reads as no share is said as written.
    expect(payMixWords(i18n, [{ label: "Housing", pct: 30 }, { label: "Cash", pct: 70 }], NAMES)).toBe("30% Housing, 70% Cash");
    expect(payMixWords(i18n, [], NAMES)).toBe("Compensation in cash and tokens");
  });

  it("gives the pill its kind: Open paid role for a paid track, Open role for the rest; Volunteer role is said once", () => {
    expect(pillKind("paid")).toBe("openPaid");
    expect(pillKind("volunteer")).toBe("open");
    expect(pillKind(null)).toBe("open");
    expect(volunteerLine(i18n, "volunteer")).toBe("Volunteer role");
    expect(volunteerLine(i18n, "paid")).toBeNull();
  });

  it("keeps the credits share at 0% only when asked, for the mini split", () => {
    const shape = [{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }, { label: "Credits", pct: 0 }];
    expect(payMixParts(i18n, shape, NAMES).map((p) => p.part)).toEqual(["cash", "equity"]);
    expect(payMixParts(i18n, shape, NAMES, { withCredits: true }).map((p) => [p.part, p.pct])).toEqual([["cash", 60], ["equity", 40], ["credits", 0]]);
    // CONTROL: a 0% cash share never shows, with or without the credits.
    expect(payMixParts(i18n, [{ label: "Cash", pct: 0 }, { label: "Equity", pct: 100 }], NAMES, { withCredits: true }).map((p) => p.part)).toEqual(["equity", "credits"]);
  });

  it("says the last day to apply until it has passed", () => {
    expect(applyByWords(i18n, "2026-11-30", "2026-11-23")).toBe("Apply by Mon 30 Nov");
    expect(applyByWords(i18n, "2026-11-30", "2026-11-30")).toBe("Apply by Mon 30 Nov");
    expect(applyByWords(i18n, "2026-11-30", "2026-12-01")).toBeNull();
    expect(applyByWords(i18n, "", "2026-11-23")).toBeNull();
    expect(applyByWords(i18n, undefined, "2026-11-23")).toBeNull();
  });

  it("reads an upcoming role as paid unless its track says otherwise", () => {
    expect(soonIsPaid({ card: {} })).toBe(true);
    expect(soonIsPaid({ card: { track: "contractor" } })).toBe(true);
    expect(soonIsPaid({ card: { track: "volunteer" } })).toBe(false);
    expect(soonIsPaid({ card: { track: "ai" } })).toBe(false);
  });
});

describe("the apply-by date in the card's sections", () => {
  it("keeps a real civil date, clears a blank, and refuses anything else", () => {
    expect(readApplyBy("2026-11-30")).toEqual({ ok: true, value: "2026-11-30" });
    expect(readApplyBy("")).toEqual({ ok: true, value: "" });
    expect(readApplyBy(undefined)).toEqual({ ok: true, value: "" });
    expect(readApplyBy("2026-02-30").ok).toBe(false);
    expect(readApplyBy("30 Nov").ok).toBe(false);
    expect(readApplyBy(20261130).ok).toBe(false);
    const kept = readSections({ ...SECTIONS, applyBy: "2026-11-30" });
    expect(kept.ok && kept.value.applyBy).toBe("2026-11-30");
    // A card without one stores exactly what it stored before.
    const none = readSections({ ...SECTIONS, applyBy: "" });
    expect(none.ok && "applyBy" in none.value).toBe(false);
    const bad = readSections({ ...SECTIONS, applyBy: "soon" });
    expect(bad.ok ? null : bad.field).toBe("sections.applyBy");
  });
});

describe("the team sheet's front", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    Element.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-23T12:00:00Z"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("draws the pill's kind, the mini split from the card's shape or the village's, and the apply-by tile", () => {
    const roles: FoundingRole[] = [
      { seat: { id: "a", name: "Role A", state: "open", archetypes: [], card: { track: "contractor" } }, circleName: "Anchor Circle", sections: { ...SECTIONS, payShape: [{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }], applyBy: "2026-11-30" } },
      { seat: { id: "b", name: "Role B", state: "open", archetypes: [], card: { track: "contractor" } }, circleName: "Anchor Circle", sections: { ...SECTIONS } },
      { seat: { id: "c", name: "Role C", state: "open", archetypes: [], card: { track: "volunteer" } }, circleName: "Anchor Circle", sections: { ...SECTIONS } },
    ];
    const { container } = render(<FoundingTeam roles={roles} villagePay={{ shape: [{ label: "Cash", pct: 100 }], atRisk: "", note: "" }} />);
    const frame = (id: string) => container.querySelector(`[data-role-frame="${id}"]`) as HTMLElement;
    const segments = (id: string) => Array.from(frame(id).querySelectorAll("[data-pay-segment]")).map((s) => [s.getAttribute("data-pay-segment"), (s as HTMLElement).style.width]);
    expect(frame("a").querySelector("[data-status-pill]")?.textContent).toBe("Open paid role");
    expect(frame("a").querySelector("[data-pay-split-words]")?.textContent).toBe("60% cash·40% Contribution tokens·0% Credits, not in use yet");
    // A segment only above 0%: the credits share is said, never drawn, at 0%.
    expect(segments("a")).toEqual([["cash", "60%"], ["equity", "40%"]]);
    expect(frame("a").querySelector('[data-pay-share-zero="credits"]')).toBeTruthy();
    expect(frame("a").querySelector("[data-front-apply-by]")?.textContent).toBe("Apply by Mon 30 Nov");
    expect(frame("b").querySelector("[data-status-pill]")?.textContent).toBe("Open paid role");
    expect(segments("b")).toEqual([["cash", "100%"]]);
    expect(frame("b").querySelector("[data-front-apply-by]")).toBeNull();
    expect(frame("c").querySelector("[data-status-pill]")?.textContent).toBe("Open role");
    expect(frame("c").querySelector("[data-front-kind]")?.textContent).toBe("Volunteer role");
    expect(frame("c").querySelector("[data-pay-split-mini]")).toBeNull();
    // The old "Open paid role ·" line is gone, and no amount shows on the front.
    expect(container.textContent).not.toContain("Open paid role ·");
    expect(frame("a").textContent).not.toMatch(/\$/);
  });
});

describe("the upcoming roles", () => {
  afterEach(() => cleanup());
  it("say Upcoming paid role in their pill, with no amount, on a role that will be paid", () => {
    render(<ComingSoonRoles roles={[{ id: "garden", name: "Garden Steward", paid: true }, { id: "kitchen", name: "Kitchen Steward", paid: false }]} />);
    expect(document.getElementById("role-garden")?.querySelector("[data-soon-paid]")?.textContent).toBe("Upcoming paid role");
    expect(document.getElementById("role-garden")?.querySelector('[data-status-pill="upcomingPaid"]')).toBeTruthy();
    expect(document.getElementById("role-kitchen")?.querySelector("[data-soon-paid]")).toBeNull();
  });
});
