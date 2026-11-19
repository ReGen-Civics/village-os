// @vitest-environment jsdom
/**
 * THE VILLAGE'S TOKEN NAMES AND THEIR TIPS (the lead, 19 Nov 2026). The contribution token reads by the village's
 * own word (its vocabulary), in full in a sentence and short on a label, never "equity", and EVERY mention carries
 * the at-risk tip. The credits token keeps its registry name and its first mention carries the usage tip. Same
 * mechanics as the moon word: closed until focus, a tap or a hover; Escape closes it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

let config: unknown = null;
vi.mock("@/lib/gameApi", () => ({ useGameConfig: () => config }));

import { ContributionWord, CreditsWord, ShareLabel, TokenText, shareLabelFor } from "./ContributionWord";

i18n.load("en", {});
i18n.activate("en");
afterEach(cleanup);
beforeEach(() => {
  config = {
    project: { name: "Harbour Village" },
    vocabulary: { contributionToken: { one: "Harbour Token", many: "Harbour Tokens", a: "a" } },
    currency: { names: { "earned-equity": "Earned Equity", credits: "Village Credits" } },
  };
});

const inI18n = (ui: React.ReactNode) => render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
const words = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(".tip-word > [tabindex]"));
const TIP = "Harbour Tokens track what you contribute. What they become is still being defined with legal advice, and they are at risk: they have value only if Harbour Village succeeds.";
const CREDITS_TIP = "Village Credits are usage tokens: you spend them on things in the village.";

describe("the contribution token's name", () => {
  it("shows the village's own word, never the registry's, with the tip closed, and never counts as a moon", () => {
    const { container } = inI18n(<p>Paid in <ContributionWord /> each moon</p>);
    expect(container.textContent).toBe("Paid in Harbour Tokens each moon");
    expect(container.textContent).not.toMatch(/equity/i);
    expect(words(container)[0].tabIndex).toBe(0);
    expect(container.querySelector(".moon")).toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens the at-risk tip on focus, names it as its description, and Escape closes it", () => {
    const { container } = inI18n(<ContributionWord short />);
    const w = words(container)[0];
    expect(w.textContent).toBe("Harbour");
    fireEvent.focus(w);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe(TIP);
    expect(w.getAttribute("aria-describedby")).toBe(tip.id);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens on a tap and a second tap closes it", () => {
    const { container } = inI18n(<ContributionWord />);
    const w = words(container)[0];
    fireEvent.pointerUp(w, { pointerType: "touch" });
    expect(screen.getByRole("tooltip").textContent).toBe(TIP);
    fireEvent.pointerUp(w, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("reads the platform default while the village has no word and its registry says equity", () => {
    config = { currency: { names: { "earned-equity": "Earned Equity", credits: "Credits" } } };
    const { container } = inI18n(<ContributionWord />);
    expect(words(container)[0].textContent).toBe("Contribution tokens");
    fireEvent.focus(words(container)[0]);
    const tip = screen.getByRole("tooltip").textContent ?? "";
    expect(tip).toBe("Contribution tokens track what you contribute. What they become is still being defined with legal advice, and they are at risk: they have value only if the village succeeds.");
    expect(tip).not.toMatch(/equity|ownership/i);
  });
});

describe("the credits token's name", () => {
  it("keeps the registry name and opens the usage tip", () => {
    const { container } = inI18n(<CreditsWord />);
    expect(container.textContent).toBe("Village Credits");
    fireEvent.focus(words(container)[0]);
    expect(screen.getByRole("tooltip").textContent).toBe(CREDITS_TIP);
  });
});

describe("a passage with the token names", () => {
  it("tips every mention of the contribution token, full or short, and the first of the credits token", () => {
    const { container } = inI18n(<TokenText text="Harbour Tokens and Village Credits. More Harbour, more Village Credits." />);
    expect(container.textContent).toBe("Harbour Tokens and Village Credits. More Harbour, more Village Credits.");
    expect(words(container).map((w) => w.textContent)).toEqual(["Harbour Tokens", "Village Credits", "Harbour"]);
  });

  it("comes back as is without a name, and hands the rest to `plain`", () => {
    const { container } = inI18n(<TokenText text="All cash." plain={(x) => <em>{x}</em>} />);
    expect(container.querySelector(".tip-word")).toBeNull();
    expect(container.querySelector("em")?.textContent).toBe("All cash.");
  });
});

describe("a share's label as a reader sees it", () => {
  const names = { equity: "Harbour Tokens", equityShort: "Harbour", credits: "Village Credits" };
  it("shows the contribution share by the short name, whatever the stored label says", () => {
    expect(shareLabelFor("Equity", names)).toBe("Harbour");
    expect(shareLabelFor("earned equity", names)).toBe("Harbour");
    expect(shareLabelFor("Harbour Tokens", names)).toBe("Harbour");
    expect(shareLabelFor("Credits", names)).toBe("Village Credits");
    expect(shareLabelFor("Village credits", names)).toBe("Village Credits");
    expect(shareLabelFor("Cash", names)).toBe("Cash");
    // A label the village wrote out stays its own words.
    expect(shareLabelFor("village credits for the shared commons", names)).toBe("village credits for the shared commons");
  });

  it("draws each token share with its tip", () => {
    const { container } = inI18n(
      <>
        <ShareLabel label="Equity" />
        <ShareLabel label="Credits" />
        <ShareLabel label="Cash" />
      </>,
    );
    expect(container.textContent).toBe("HarbourVillage CreditsCash");
    expect(words(container).map((w) => w.textContent)).toEqual(["Harbour", "Village Credits"]);
  });
});
