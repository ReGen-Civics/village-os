// @vitest-environment jsdom
/**
 * "VALUE IN EQUALS VALUE OUT." (lead, 17 Nov 2026): the callout renders, and its explainer opens on a tap, a click
 * or a key, closes on Escape with focus back on the control, and says the three parts.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { setupI18n } from "@lingui/core";
import ValueCallout from "./ValueCallout";
import { ROLE_PAY_CAP_PCT } from "@shared/commitmentRange";
import { EXPLAINER_BAND, valueExplainerWords } from "./valueExplainerWords";

afterEach(cleanup);

describe("the value callout on the Rewards piece", () => {
  it("renders the callout with a closed explainer and a labelled control", () => {
    render(<ValueCallout />);
    expect(screen.getByTestId("value-callout").textContent).toContain("Value in equals value out.");
    const control = screen.getByRole("button", { name: "Value in equals value out." });
    expect(control.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("value-explainer")).toBeNull();
    // The callout's own words are the control (the lead, 27 Nov 2026), described by what it opens, with no icon beside them.
    expect(control).toHaveAccessibleDescription("How rewards are set");
    expect(control.querySelector("svg")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    // The whole line is the control, 44px tall like the round button it replaced (QA round 2).
    expect(control.className).toMatch(/min-h-11/);
    expect(control.className).toMatch(/w-full/);
  });

  it("opens the explainer on activation, with the three parts, and Escape closes it and returns focus", () => {
    render(<ValueCallout />);
    const control = screen.getByRole("button", { name: "Value in equals value out." });
    fireEvent.click(control);
    expect(control.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByTestId("value-explainer");
    expect(control.getAttribute("aria-controls")).toBe(panel.id);
    expect(Array.from(panel.querySelectorAll("[data-explainer-part]")).map((e) => e.getAttribute("data-explainer-part"))).toEqual(["price", "agreement", "aim"]);
    expect(panel.textContent).toContain("How compensation is set");
    expect(panel.textContent).toContain("Each role's compensation comes from a regenerative valuation engine");
    expect(panel.textContent).toContain("Pay sits in a band from 80% to 100% of that figure, in total comp. Proposals can go up to 120%, and the figure for that will show once the team agrees it.");
    // A percent only: no money amount anywhere in the explainer.
    expect(panel.textContent).not.toMatch(/\$\s?\d/);
    expect(panel.textContent).toContain("Each moon you recap what you delivered, and pay follows what you deliver.");
    expect(panel.textContent).toContain("in cash and in Contribution tokens, which track what you contribute.");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("value-explainer")).toBeNull();
    expect(document.activeElement).toBe(control);
  });

  it("closes from its own Close button and on a tap outside", () => {
    render(
      <div>
        <ValueCallout />
        <p data-testid="outside">elsewhere</p>
      </div>,
    );
    const control = screen.getByRole("button", { name: "Value in equals value out." });
    fireEvent.click(control);
    fireEvent.click(screen.getByTestId("value-explainer-close"));
    expect(screen.queryByTestId("value-explainer")).toBeNull();
    fireEvent.click(control);
    fireEvent.pointerDown(screen.getByTestId("outside"));
    expect(screen.queryByTestId("value-explainer")).toBeNull();
  });

  it("names the band from the figures it is given (hardcoded 80 to 100 for now)", () => {
    const i18n = setupI18n({ locale: "en", messages: { en: {} } });
    expect(EXPLAINER_BAND).toEqual({ lowPct: 80, highPct: 100 });
    expect(valueExplainerWords(i18n, { lowPct: 90, highPct: 110 }).parts[0].text).toContain("a band from 90% to 110% of that figure");
    expect(ROLE_PAY_CAP_PCT).toBe(120);
    expect(valueExplainerWords(i18n, EXPLAINER_BAND, 130).parts[0].text).toContain("Proposals can go up to 130%");
  });
});
