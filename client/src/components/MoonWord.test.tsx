// @vitest-environment jsdom
/**
 * THE MOON WORD (the lead, 18 Nov 2026): every "moon" on the applicant surfaces carries "We work in moon cycles, from
 * new moon to new moon." It renders closed, opens on focus, on a tap and on hover, and Escape closes it. A price set
 * per moon wears it; a price set per month does not.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MoonText, MoonWord } from "./MoonWord";
import PriceAsk from "./governance/PriceAsk";

i18n.load("en", {});
i18n.activate("en");
afterEach(cleanup);

const TIP = "We work in moon cycles, from new moon to new moon.";
const inI18n = (ui: React.ReactNode) => render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
const word = (c: HTMLElement) => c.querySelector(".moon > [tabindex]") as HTMLElement;

describe("the moon word", () => {
  it("renders the word with its dotted underline, focusable, and the tip closed", () => {
    const { container } = inI18n(<p>Band: $1 to $2 a <MoonWord /> in total comp</p>);
    expect(container.textContent).toBe("Band: $1 to $2 a moon in total comp");
    const w = word(container);
    expect(w.textContent).toBe("moon");
    expect(w.tabIndex).toBe(0);
    expect(w.parentElement?.className).toBe("moon"); // the dotted underline is `.moon > [tabindex]` in index.css
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(w.getAttribute("aria-describedby")).toBeNull();
  });

  it("opens on focus, names the tip as its description, and closes on Escape", () => {
    const { container } = inI18n(<MoonWord />);
    const w = word(container);
    fireEvent.focus(w);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe(TIP);
    expect(w.getAttribute("aria-describedby")).toBe(tip.id);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens on a tap, closes when the tap lands elsewhere, and a tap inside a label does not reach its field", () => {
    const { container } = inI18n(
      <>
        <label htmlFor="d">
          A day in this <MoonWord /> (optional)
          <input id="d" />
        </label>
        <button type="button">elsewhere</button>
      </>,
    );
    const w = word(container);
    const click = fireEvent.click(w);
    expect(click).toBe(false); // the label's activation is prevented, so focus stays off the field
    expect(screen.getByRole("tooltip").textContent).toBe(TIP);
    // A tap elsewhere moves focus off the word (and a phone sends the word a mouseleave).
    fireEvent.blur(w);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens on hover with a mouse and closes when the pointer leaves", () => {
    const { container } = inI18n(<MoonWord />);
    const w = word(container);
    fireEvent.mouseEnter(w);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.mouseLeave(w);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("Escape closes only the tip, not a panel around it that listens for Escape", () => {
    let panelClosed = false;
    document.addEventListener("keydown", () => (panelClosed = true), { once: true });
    const { container } = inI18n(<MoonWord />);
    fireEvent.focus(word(container));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(panelClosed).toBe(false);
  });

  it("wraps each whole-word moon or moons in a sentence and leaves other words alone", () => {
    const { container } = inI18n(<MoonText text="Each moon's end, over three moons, after the honeymoon." />);
    expect(container.textContent).toBe("Each moon's end, over three moons, after the honeymoon.");
    expect(Array.from(container.querySelectorAll(".moon")).map((e) => e.textContent)).toEqual(["moon", "moons"]);
  });
});

describe("a price line per moon", () => {
  const ask = (per: "moon" | "month") =>
    inI18n(<PriceAsk idPrefix="t" ceiling={{ amount: 10000, currency: "USD", per }} pct={50} value={null} onChange={() => {}} />);

  it("says the suggested price a moon, with the tip on the word", () => {
    const { container } = ask("moon");
    const line = container.querySelector("[data-suggested-price]") as HTMLElement;
    expect(line.textContent).toBe("Suggested: $5,000 a moon, from your commitment of 50%.");
    const w = line.querySelector(".moon > [tabindex]") as HTMLElement;
    expect(w.textContent).toBe("moon");
    fireEvent.focus(w);
    expect(screen.getByRole("tooltip").textContent).toBe(TIP);
  });

  it("a price set per month stays a month and carries no tip", () => {
    const { container } = ask("month");
    const line = container.querySelector("[data-suggested-price]") as HTMLElement;
    expect(line.textContent).toBe("Suggested: $5,000 a month, from your commitment of 50%.");
    expect(line.querySelector(".moon")).toBeNull();
  });
});
