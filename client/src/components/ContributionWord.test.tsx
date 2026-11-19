// @vitest-environment jsdom
/**
 * THE CONTRIBUTION TOKEN'S NAME AND ITS TIP (the lead, 19 Nov 2026). The name is the village's own (Admin, Tokens),
 * never "equity", and wherever it is shown it carries a plain at-risk tip. Same mechanics as the moon word: closed
 * until focus, a tap or a hover; Escape closes it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

let config: unknown = null;
vi.mock("@/lib/gameApi", () => ({ useGameConfig: () => config }));

import { ContributionText, ContributionWord, ShareLabel, shareLabelFor } from "./ContributionWord";

i18n.load("en", {});
i18n.activate("en");
afterEach(cleanup);
beforeEach(() => {
  config = { project: { name: "Harbour Village" }, currency: { names: { "earned-equity": "Harbour", credits: "Usage tokens" } } };
});

const inI18n = (ui: React.ReactNode) => render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
const word = (c: HTMLElement) => c.querySelector(".tip-word > [tabindex]") as HTMLElement;
const TIP = "Harbour tokens track what you contribute. What they become is still being defined with legal advice, and they are at risk: they have value only if Harbour Village succeeds.";

describe("the contribution token's name", () => {
  it("shows the village's own name with the tip closed, and never counts as a moon", () => {
    const { container } = inI18n(<p>Paid in <ContributionWord /> each moon</p>);
    expect(container.textContent).toBe("Paid in Harbour each moon");
    expect(word(container).textContent).toBe("Harbour");
    expect(word(container).tabIndex).toBe(0);
    expect(container.querySelector(".moon")).toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens the at-risk tip on focus, names it as its description, and Escape closes it", () => {
    const { container } = inI18n(<ContributionWord />);
    const w = word(container);
    fireEvent.focus(w);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe(TIP);
    expect(w.getAttribute("aria-describedby")).toBe(tip.id);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens on a tap and a second tap closes it", () => {
    const { container } = inI18n(<ContributionWord />);
    const w = word(container);
    fireEvent.pointerUp(w, { pointerType: "touch" });
    expect(screen.getByRole("tooltip").textContent).toBe(TIP);
    fireEvent.pointerUp(w, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("reads the platform defaults for a village that named nothing, and never says equity", () => {
    config = null;
    const { container } = inI18n(<ContributionWord />);
    expect(word(container).textContent).toBe("Contribution tokens");
    fireEvent.focus(word(container));
    const tip = screen.getByRole("tooltip").textContent ?? "";
    expect(tip).toBe("Contribution tokens track what you contribute. What they become is still being defined with legal advice, and they are at risk: they have value only if the village succeeds.");
    expect(tip).not.toMatch(/equity|ownership/i);
  });

  it("puts the tip on the first mention in a sentence only", () => {
    const { container } = inI18n(<ContributionText text="Harbour and cash. More Harbour later." />);
    expect(container.textContent).toBe("Harbour and cash. More Harbour later.");
    expect(container.querySelectorAll(".tip-word > [tabindex]").length).toBe(1);
    // CONTROL: text without the name comes back as is, with no tip.
    cleanup();
    const plain = inI18n(<ContributionText text="All cash." />);
    expect(plain.container.querySelector(".tip-word")).toBeNull();
  });
});

describe("a share's label as a reader sees it", () => {
  const names = { equity: "Harbour", credits: "Usage tokens" };
  it("shows the contribution share by the token's name, whatever the stored label says", () => {
    expect(shareLabelFor("Equity", names)).toBe("Harbour");
    expect(shareLabelFor("earned equity", names)).toBe("Harbour");
    expect(shareLabelFor("Harbour", names)).toBe("Harbour");
    expect(shareLabelFor("Credits", names)).toBe("Usage tokens");
    expect(shareLabelFor("Village credits", names)).toBe("Usage tokens");
    expect(shareLabelFor("Cash", names)).toBe("Cash");
    // A label the village wrote out stays its own words.
    expect(shareLabelFor("village credits for the shared commons", names)).toBe("village credits for the shared commons");
  });

  it("draws the contribution share with its tip", () => {
    const { container } = inI18n(<ShareLabel label="Equity" />);
    expect(container.textContent).toBe("Harbour");
    expect(word(container)).not.toBeNull();
  });
});
