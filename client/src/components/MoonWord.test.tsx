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

  it("opens on a click, closes when focus leaves, and a click inside a label does not reach its field", () => {
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
    fireEvent.pointerOver(w, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.pointerOut(w, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("on a phone a tap toggles it from the pointer itself, the made-up click after it does not undo it, and a tap outside closes it (production check of 1.3.25)", () => {
    const { container } = inI18n(
      <>
        <MoonWord />
        <button type="button">elsewhere</button>
      </>,
    );
    const w = word(container);
    const tap = (el: HTMLElement) => {
      fireEvent.pointerDown(el, { pointerType: "touch" });
      fireEvent.pointerUp(el, { pointerType: "touch" });
    };
    // A host that cancels the mouse events after a tap leaves only the pointer: that alone opens it.
    tap(w);
    expect(screen.getByRole("tooltip").textContent).toBe(TIP);
    // The click the browser makes up after the tap keeps it open.
    fireEvent.click(w);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    // A second tap closes it, and a third opens it again.
    tap(w);
    expect(screen.queryByRole("tooltip")).toBeNull();
    tap(w);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    // A tap outside closes it.
    fireEvent.pointerDown(screen.getByRole("button", { name: "elsewhere" }), { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    // Escape closes a tapped tip too.
    tap(w);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("two moons on neighbouring lines of one sentence: a tap opens the word it lands on, never the other (production check of 1.3.29)", () => {
    // On a phone at 390px "Each moon you share what you'll bring the next moon." wraps its two words onto neighbouring
    // lines, and the padding that grows each word's box to 44px is taller than a line, so the second word's box lies
    // over the first word's text. The browser reports a tap there on the second word, which is on top.
    const { container } = inI18n(<MoonText text="Each moon you share what you'll bring the next moon." />);
    const [first, second] = Array.from(container.querySelectorAll(".moon > [tabindex]")) as HTMLElement[];
    const text = new Map([
      [first, { left: 70, right: 110, top: 360, bottom: 380 }],
      [second, { left: 70, right: 110, top: 380, bottom: 400 }],
    ]);
    const box = (r: { left: number; right: number; top: number; bottom: number }) => ({ ...r, top: r.top - 14, bottom: r.bottom + 14 });
    const realFromPoint = Object.getOwnPropertyDescriptor(document, "elementsFromPoint");
    const realRange = document.createRange.bind(document);
    const fromPoint = (x: number, y: number) =>
      [second, first].filter((el) => {
        const b = box(text.get(el)!);
        return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
      });
    Object.defineProperty(document, "elementsFromPoint", { configurable: true, value: fromPoint });
    document.createRange = () => {
      let of: HTMLElement | null = null;
      return { selectNodeContents: (n: Node) => (of = n as HTMLElement), getClientRects: () => (of && text.has(of) ? [text.get(of)!] : []) } as unknown as Range;
    };
    // The browser's own order for a tap: down and up on the box on top, then the focus and the click it makes up.
    const tapAt = (y: number) => {
      const top = fromPoint(90, y)[0] as HTMLElement;
      fireEvent.pointerDown(top, { pointerType: "touch", clientX: 90, clientY: y });
      fireEvent.pointerUp(top, { pointerType: "touch", clientX: 90, clientY: y });
      fireEvent.focus(top);
      fireEvent.click(top, { clientX: 90, clientY: y });
    };
    const opened = () => [first, second].map((w) => !!w.getAttribute("aria-describedby"));
    try {
      // The first word's own text, inside the second word's box: the first word opens, and only it.
      tapAt(372);
      expect(opened()).toEqual([true, false]);
      expect(screen.getAllByRole("tooltip")).toHaveLength(1);
      // The second word: the first closes and the second opens.
      tapAt(392);
      expect(opened()).toEqual([false, true]);
      expect(screen.getAllByRole("tooltip")).toHaveLength(1);
      // The second word again closes it, and the next tap on the first word still opens the first.
      tapAt(392);
      expect(opened()).toEqual([false, false]);
      tapAt(372);
      expect(opened()).toEqual([true, false]);
      // The first word again closes it.
      tapAt(372);
      expect(opened()).toEqual([false, false]);
      expect(screen.queryByRole("tooltip")).toBeNull();
    } finally {
      if (realFromPoint) Object.defineProperty(document, "elementsFromPoint", realFromPoint);
      else Reflect.deleteProperty(document, "elementsFromPoint");
      document.createRange = realRange;
    }
  });

  it("draws the tip out of a transformed card, into the night sheet, where a fixed sheet is the screen's own", () => {
    const { container } = inI18n(
      <div className="sheet-night">
        <div style={{ transform: "translateY(8px)", overflow: "hidden" }} data-card="">
          <MoonWord />
        </div>
      </div>,
    );
    fireEvent.click(word(container));
    const tip = screen.getByRole("tooltip");
    expect(tip.className).toBe("moon-tip");
    expect(tip.closest("[data-card]")).toBeNull();
    expect(tip.parentElement?.className).toBe("sheet-night");
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
