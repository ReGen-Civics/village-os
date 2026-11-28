// @vitest-environment jsdom
/**
 * THE DEFECT THIS PINS: the closed plaque was read MID-SENTENCE.
 *
 * `InfoTip`'s plaque node sits in the HOST PARAGRAPH'S INLINE FLOW, right
 * after the word that is its trigger. While closed it used to be `sr-only`,
 * which is out of the VISUAL flow and fully inside the reading order, so on
 * /campaigns a screen reader read the definition in the middle of the
 * sentence, let the host sentence resume as a fragment after a full stop, and
 * then read the same words AGAIN when the trigger took focus.
 *
 * Nothing that looks at pixels could catch it: it renders perfectly. So the
 * first test here reads the paragraph the way an assistive technology does,
 * skipping the subtrees a browser drops from the accessibility tree, and
 * asserts the sentence comes out whole. The second half of the requirement is
 * the one the old `sr-only` was protecting, and it is asserted beside it:
 * dropping the node entirely would break the description on focus, so the
 * trigger's `aria-describedby` must still resolve to the tip.
 *
 * Every assertion here is about a RELATIONSHIP - reading order, the described
 * -by target, the accessible description, visibility, focus - and never about
 * a class name, because the class name is the implementation and it has
 * already changed once.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import InfoTip, { forgetTouches, nearestWord } from "./InfoTip";

// A touch in one test must not count as a recent touch when the next one focuses a word from the keyboard.
beforeEach(() => forgetTouches());

// The real sentence from client/src/pages/Crowdpool.tsx, so this test names
// the copy that produced the reported defect rather than a stand-in.
const TIP =
  "A crowdpool gathers pledges of money, goods, tools and hands for one build. Nothing moves through this page; every claim finishes on the hub's own page.";

const HOST_SENTENCE =
  "What this village is gathering through the hub's crowdpool. Each ring fills as the pool does.";

/**
 * The text an assistive technology reads out of a subtree, in order.
 *
 * A node leaves the accessibility tree when it is `hidden`, when its computed
 * display is none, when it is `visibility: hidden`, or when it is
 * `aria-hidden`. Nothing else drops out - and that is exactly why `sr-only`
 * was the defect: it hides a node from EYES and from nothing else.
 */
function readingOrder(root: HTMLElement): string {
  const win = root.ownerDocument.defaultView;
  if (!win) throw new Error("no window");
  const out: string[] = [];
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === child.TEXT_NODE) {
        out.push(child.textContent ?? "");
        continue;
      }
      if (!(child instanceof win.HTMLElement)) continue;
      if (child.hidden) continue;
      if (child.getAttribute("aria-hidden") === "true") continue;
      const style = win.getComputedStyle(child);
      if (style.display === "none" || style.visibility === "hidden") continue;
      walk(child);
    }
  };
  walk(root);
  return out.join("");
}

function renderInParagraph() {
  const view = render(
    <p data-testid="host">
      What this village is gathering through the hub's{" "}
      <InfoTip tip={TIP}>crowdpool</InfoTip>. Each ring fills as the pool does.
    </p>,
  );
  return { ...view, host: screen.getByTestId("host") };
}

describe("InfoTip, closed", () => {
  it("keeps the description out of the host paragraph's reading order", () => {
    const { host } = renderInParagraph();
    expect(readingOrder(host)).toBe(HOST_SENTENCE);
    expect(readingOrder(host)).not.toContain("A crowdpool gathers pledges");
  });

  it("still resolves aria-describedby to the tip, which is what the node is for", () => {
    const { host } = renderInParagraph();
    const trigger = screen.getByRole("button", { name: "crowdpool" });

    // The link itself: the id the trigger names is a node that is still in
    // the DOM, still inside this paragraph, and still carries the tip.
    const id = trigger.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    const target = document.getElementById(id as string);
    expect(target).not.toBeNull();
    expect(host.contains(target)).toBe(true);
    expect(target).toHaveTextContent(TIP);

    // And the computed description, which is what a screen reader announces
    // on focus. This is the half that dropping the node would have broken.
    expect(trigger).toHaveAccessibleDescription(TIP);
  });

  it("leaves the closed plaque out of the accessibility tree while keeping it in the DOM", () => {
    const { host } = renderInParagraph();
    // Role queries exclude inaccessible elements by default, so this pair
    // says "present in the document, absent from the tree" without naming
    // how the component achieves it.
    expect(within(host).queryByRole("tooltip")).toBeNull();
    expect(within(host).getByRole("tooltip", { hidden: true })).toHaveTextContent(TIP);
  });

  it("keeps the tip out of a host heading's accessible name", () => {
    // Fourteen call sites sit inside an h2, h3 or h4. A heading is named from
    // its content, so a closed tip that is still in the tree becomes part of
    // the heading's name, and a screen reader's list of headings read every
    // one of these with its whole definition attached.
    const weightTip =
      "Weight is how much a vote counts. It is read when a ballot opens and frozen there, so a later change never rewrites a vote in flight.";
    render(
      <h3>
        <InfoTip tip={weightTip}>Your weight</InfoTip>
      </h3>,
    );
    const heading = screen.getByRole("heading", { level: 3 });
    // With the words as the trigger the heading is named by its words alone,
    // and no mark's label is folded in either.
    expect(heading).toHaveAccessibleName("Your weight");
    expect(heading).not.toHaveAccessibleName(/Weight is how much a vote counts/);
    expect(screen.getByRole("button", { name: "Your weight" })).toHaveAccessibleDescription(weightTip);
  });
});

describe("InfoTip, open", () => {
  it("renders the tip visibly and stays linked to the trigger", async () => {
    const user = userEvent.setup();
    const { host } = renderInParagraph();
    const trigger = screen.getByRole("button", { name: "crowdpool" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const plaque = screen.getByRole("tooltip");
    expect(plaque).toBeVisible();
    expect(plaque).toHaveTextContent(TIP);
    expect(plaque.id).toBe(trigger.getAttribute("aria-describedby"));
    expect(trigger).toHaveAccessibleDescription(TIP);
    // Fixed from the measured rect, so an overflow-hidden ancestor cannot
    // clip it. Asserted as a computed style, not as a class.
    expect(plaque.style.position).toBe("fixed");
    // And drawn outside the host: a torn card's mask on the Weathered map cut
    // a fixed plaque that stayed inside it (measured at 375, 27 Nov 2026).
    expect(host.contains(plaque)).toBe(false);
    // The words are in the accessibility tree once while it is open.
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  });

  it("draws the open plaque in the body, wearing the night sheet's class when the word sits in one", async () => {
    const user = userEvent.setup();
    render(
      <div className="sheet-night" data-testid="sheet">
        <p>
          A <InfoTip tip={TIP}>crowdpool</InfoTip> here.
        </p>
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "crowdpool" }));
    const plaque = screen.getByRole("tooltip");
    expect(plaque.parentElement).toBe(document.body);
    expect(plaque).toHaveClass("sheet-night");
  });

  it("opens on screen from inside a container-query box (QA round 2: the seat clock's plaque opened off screen)", async () => {
    // `container-type` makes an ancestor the box position:fixed is measured from. The plaque leaves it for the body,
    // and its place is worked out from the word's own rect in the viewport, so it lands where the word is.
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    render(
      <div style={{ containerType: "inline-size" }} data-testid="cq">
        <dl>
          <dt>
            <InfoTip tip={TIP}>Season</InfoTip>
          </dt>
        </dl>
      </div>,
    );
    const word = screen.getByRole("button", { name: "Season" });
    const rect = { left: 1180, right: 1240, top: 400, bottom: 416, width: 60, height: 16, x: 1180, y: 400, toJSON() {} } as DOMRect;
    word.getClientRects = () => [rect] as unknown as DOMRectList;
    word.getBoundingClientRect = () => rect;
    await user.click(word);
    const plaque = screen.getByRole("tooltip");
    expect(screen.getByTestId("cq").contains(plaque)).toBe(false);
    expect(plaque.parentElement).toBe(document.body);
    const left = parseFloat(plaque.style.left);
    const width = parseFloat(plaque.style.width);
    const top = parseFloat(plaque.style.top);
    expect(left).toBeGreaterThanOrEqual(8);
    expect(left + width).toBeLessThanOrEqual(1440 - 8);
    expect(top).toBe(416 + 8);
  });

  it("closes on a second tap, and the description survives the round trip", async () => {
    const user = userEvent.setup();
    const { host } = renderInParagraph();
    const trigger = screen.getByRole("button", { name: "crowdpool" });

    await user.click(trigger);
    expect(screen.getByRole("tooltip")).toBeVisible();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(readingOrder(host)).toBe(HOST_SENTENCE);
    expect(trigger).toHaveAccessibleDescription(TIP);
  });

  it("opens on hover and closes on mouse out for a visitor with a mouse", async () => {
    const user = userEvent.setup();
    const { host } = renderInParagraph();
    const trigger = screen.getByRole("button", { name: "crowdpool" });

    await user.hover(trigger);
    expect(screen.getByRole("tooltip")).toBeVisible();

    await user.unhover(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("InfoTip, keyboard", () => {
  it("Tab reaches the trigger and focus opens the plaque", async () => {
    const user = userEvent.setup();
    const { host } = renderInParagraph();
    const trigger = screen.getByRole("button", { name: "crowdpool" });

    await user.tab();

    expect(trigger).toHaveFocus();
    expect(screen.getByRole("tooltip")).toBeVisible();
  });

  it("Escape closes it and leaves the sentence whole again", async () => {
    const user = userEvent.setup();
    const { host } = renderInParagraph();
    const trigger = screen.getByRole("button", { name: "crowdpool" });

    await user.tab();
    expect(screen.getByRole("tooltip")).toBeVisible();

    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(readingOrder(host)).toBe(HOST_SENTENCE);
    expect(trigger).toHaveFocus();
  });

  it("Enter toggles the plaque", async () => {
    const user = userEvent.setup();
    const { host } = renderInParagraph();
    const trigger = screen.getByRole("button", { name: "crowdpool" });

    await user.tab();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("tooltip")).toBeVisible();

    await user.keyboard("{Enter}");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("Space toggles the plaque", async () => {
    const user = userEvent.setup();
    const { host } = renderInParagraph();
    const trigger = screen.getByRole("button", { name: "crowdpool" });

    await user.tab();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();

    await user.keyboard(" ");
    expect(screen.getByRole("tooltip")).toBeVisible();

    await user.keyboard(" ");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("the word is the trigger (the lead, 27 Nov 2026: tooltips on the word, not next to it)", () => {
  it("names the button with the word itself", () => {
    renderInParagraph();
    const trigger = screen.getByRole("button", { name: "crowdpool" });
    expect(trigger).toHaveTextContent(/^crowdpool$/);
  });

  it("describes the word with the tip", () => {
    renderInParagraph();
    expect(screen.getByRole("button", { name: "crowdpool" })).toHaveAccessibleDescription(TIP);
  });

  it("draws no mark: the host's text is its own sentence and nothing more", () => {
    const { host } = renderInParagraph();
    // Every character a reader sees is the sentence's own: no "i", no "?", no circle.
    expect(readingOrder(host)).toBe(HOST_SENTENCE);
    expect(within(host).queryByText(/^[i?]$/)).toBeNull();
    expect(host.querySelector("svg")).toBeNull();
    // One button, and it is the word.
    expect(within(host).getAllByRole("button")).toHaveLength(1);
  });

  it("stays inline text, so a phrase wraps as the sentence would", () => {
    // A <button> lays out as an inline-block and cannot break across lines;
    // the trigger is an inline span carrying the button role instead, with no
    // box of its own to push the words around.
    render(
      <p>
        Every card <InfoTip tip={TIP}>wears its pills</InfoTip> so you can read it.
      </p>,
    );
    const trigger = screen.getByRole("button", { name: "wears its pills" });
    expect(trigger.tagName).toBe("SPAN");
    expect(trigger).toHaveAttribute("tabindex", "0");
    expect(trigger.getAttribute("style")).toBeNull();
    expect(trigger.parentElement?.tagName).toBe("SPAN");
  });

  it("opens on a tap and closes on a second tap", async () => {
    const user = userEvent.setup();
    const { host } = renderInParagraph();
    const trigger = screen.getByRole("button", { name: "crowdpool" });
    await user.pointer({ keys: "[TouchA]", target: trigger });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toBeVisible();
    await user.pointer({ keys: "[TouchA]", target: trigger });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on a tap anywhere else", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <p data-testid="host">
          A <InfoTip tip={TIP}>crowdpool</InfoTip> here.
        </p>
        <p data-testid="elsewhere">Elsewhere.</p>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "crowdpool" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByTestId("elsewhere"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens from the keyboard and closes on Escape and on blur", async () => {
    const user = userEvent.setup();
    render(
      <p>
        A <InfoTip tip={TIP}>crowdpool</InfoTip> and <a href="#next">a link</a>.
      </p>,
    );
    const trigger = screen.getByRole("button", { name: "crowdpool" });
    await user.tab();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.tab();
    expect(trigger).not.toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when the page scrolls, so a fixed plaque never floats over the wrong words", async () => {
    const user = userEvent.setup();
    renderInParagraph();
    const trigger = screen.getByRole("button", { name: "crowdpool" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("inside a field's label, a click opens the tip and leaves the field alone", async () => {
    const user = userEvent.setup();
    render(
      <label>
        <InfoTip tip={TIP}>Quorum</InfoTip>
        <input type="checkbox" />
      </label>,
    );
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    await user.click(screen.getByRole("button", { name: "Quorum" }));
    expect(screen.getByRole("button", { name: "Quorum" })).toHaveAttribute("aria-expanded", "true");
    expect(box.checked).toBe(false);
  });
});

describe("QA round 1 on the word trigger (27 Nov 2026)", () => {
  it("closes on the first Enter or Space when Tab opened it", async () => {
    const user = userEvent.setup();
    renderInParagraph();
    const trigger = screen.getByRole("button", { name: "crowdpool" });
    await user.tab();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("warns in development when a tip sits inside a link or a button, since on touch the tap is theirs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <a href="/quests">
          A <InfoTip tip={TIP}>crowdpool</InfoTip> inside a link
        </a>,
      );
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(/inside a link or a button/);
      warn.mockClear();
      render(
        <button type="button">
          <InfoTip tip={TIP}>crowdpool</InfoTip>
        </button>,
      );
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockClear();
      renderInParagraph();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("the near tap (QA round 2, 27 Nov 2026)", () => {
  /** Lays a word out at a box, since a test page has no layout of its own. */
  const at = (el: HTMLElement, l: number, t: number, w: number, h: number) => {
    const r = { left: l, right: l + w, top: t, bottom: t + h, width: w, height: h, x: l, y: t, toJSON() {} } as DOMRect;
    el.getClientRects = () => [r] as unknown as DOMRectList;
    el.getBoundingClientRect = () => r;
  };
  /** A touch: the press where the finger went down, then the click the browser makes, on `target` (which may be adjusted). */
  const touchUp = (target: Element, x: number, y: number, clickOn: Element = target) => {
    const down = new MouseEvent("pointerdown", { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(down, "pointerType", { value: "touch" });
    act(() => {
      target.dispatchEvent(down);
      clickOn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    });
  };

  function stacked() {
    render(
      <p data-testid="p">
        Quests pay in <InfoTip tip="Credits tip.">Village Credits</InfoTip> and <InfoTip tip="Voice tip.">Village Voice</InfoTip>.
      </p>,
    );
    const credits = screen.getByRole("button", { name: "Village Credits" });
    const voice = screen.getByRole("button", { name: "Village Voice" });
    // The 320 case: Credits ends line one, Voice starts line two, 20px lines.
    at(credits, 150, 100, 100, 16);
    at(voice, 0, 120, 90, 16);
    return { credits, voice, p: screen.getByTestId("p") };
  }

  it("opens the word whose box a touch lands just off, the nearer of two", () => {
    const { credits, voice, p } = stacked();
    touchUp(p, 200, 119); // 3px under Credits, 1px above Voice but 110px to its right
    expect(credits).toHaveAttribute("aria-expanded", "true");
    expect(voice).toHaveAttribute("aria-expanded", "false");
  });

  it("gives every tap closer to Credits than to Voice to Credits", () => {
    const { credits, voice } = stacked();
    for (let y = 92; y <= 128; y += 2) {
      for (const x of [146, 160, 200, 254]) {
        const pick = nearestWord(x, y);
        const dist = (el: HTMLElement) => {
          const r = el.getClientRects()[0];
          return Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
        };
        if (pick) expect(pick).toBe(dist(credits) <= dist(voice) ? credits : voice);
        if (pick === voice) expect(dist(voice)).toBeLessThan(dist(credits));
      }
    }
  });

  it("leaves a touch more than 12px above or below, or 8px beside, a word alone", () => {
    const { credits, p } = stacked();
    touchUp(p, 200, 100 - 13);
    touchUp(p, 150 - 9, 108);
    expect(credits).toHaveAttribute("aria-expanded", "false");
  });

  it("never takes a tap that lands on something interactive", () => {
    render(
      <div>
        <InfoTip tip="Credits tip.">Village Credits</InfoTip>
        <a href="#next" data-testid="link">next</a>
      </div>,
    );
    const credits = screen.getByRole("button", { name: "Village Credits" });
    at(credits, 0, 100, 100, 16);
    touchUp(screen.getByTestId("link"), 50, 118);
    expect(credits).toHaveAttribute("aria-expanded", "false");
  });

  it("hands a tap the browser gave to the farther word on to the nearer one (Chrome's touch adjustment, 320)", () => {
    const { credits, voice, p } = stacked();
    // The finger went down 3px under Credits; the browser's adjusted click landed on Voice.
    touchUp(p, 200, 119, voice);
    expect(credits).toHaveAttribute("aria-expanded", "true");
    expect(voice).toHaveAttribute("aria-expanded", "false");
  });

  it("drops a tap the browser gave to a word when the finger was in reach of none (its own reach is wider)", () => {
    const { credits, voice, p } = stacked();
    // 14px under Credits and 27px from Voice: nearer Credits, but out of reach of both.
    touchUp(p, 216 - 50, 116 + 14 + 10, voice);
    expect(voice).toHaveAttribute("aria-expanded", "false");
    expect(credits).toHaveAttribute("aria-expanded", "false");
  });

  it("opens nothing for a touch nearer a word that is out of reach than to one in reach", () => {
    const { credits, voice } = stacked();
    // 9px right of Voice's line, 10px under Credits: Voice is nearer and out of reach across, so neither opens.
    expect(nearestWord(99, 126)).toBeNull();
    expect(credits).toHaveAttribute("aria-expanded", "false");
    expect(voice).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps a tap on a word with that word", () => {
    const { credits, voice } = stacked();
    touchUp(voice, 40, 128);
    expect(voice).toHaveAttribute("aria-expanded", "true");
    expect(credits).toHaveAttribute("aria-expanded", "false");
  });

  it("is for touch only: a mouse click near a word does nothing", () => {
    const { credits, p } = stacked();
    const down = new MouseEvent("pointerdown", { bubbles: true, clientX: 200, clientY: 119 });
    Object.defineProperty(down, "pointerType", { value: "mouse" });
    act(() => {
      p.dispatchEvent(down);
      p.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 200, clientY: 119 }));
    });
    expect(credits).toHaveAttribute("aria-expanded", "false");
  });
});

describe("a tap the browser moves onto a link (QA round 3, WebKit, 27 Nov 2026)", () => {
  it("gives a tap beside a word to the word, even when the browser sent the click to a link around the card", () => {
    render(
      <div>
        <a href="#quest" data-testid="card-link">Map the spring path</a>
        <ul data-testid="row">
          <li>
            <InfoTip tip="Builders make what the village stands on.">Builder</InfoTip>
          </li>
        </ul>
      </div>,
    );
    const word = screen.getByRole("button", { name: "Builder" });
    const r = { left: 20, right: 80, top: 100, bottom: 116, width: 60, height: 16, x: 20, y: 100, toJSON() {} } as DOMRect;
    word.getClientRects = () => [r] as unknown as DOMRectList;
    word.getBoundingClientRect = () => r;
    const row = screen.getByTestId("row");
    const link = screen.getByTestId("card-link");
    // Under the finger: the roots row, 6px left of the word. The browser's adjusted click: the card's link.
    const had = (document as { elementFromPoint?: unknown }).elementFromPoint;
    (document as { elementFromPoint: (x: number, y: number) => Element | null }).elementFromPoint = () => row;
    try {
      const down = new MouseEvent("pointerdown", { bubbles: true, clientX: 14, clientY: 108 });
      Object.defineProperty(down, "pointerType", { value: "touch" });
      const click = new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 14, clientY: 108 });
      act(() => {
        row.dispatchEvent(down);
        link.dispatchEvent(click);
      });
      expect(word).toHaveAttribute("aria-expanded", "true");
      expect(click.defaultPrevented).toBe(true);
    } finally {
      (document as { elementFromPoint?: unknown }).elementFromPoint = had;
    }
  });

  it("leaves a tap whose finger was on the link to the link", () => {
    render(
      <div>
        <a href="#quest" data-testid="card-link">Map the spring path</a>
        <InfoTip tip="Builders make what the village stands on.">Builder</InfoTip>
      </div>,
    );
    const word = screen.getByRole("button", { name: "Builder" });
    const r = { left: 20, right: 80, top: 100, bottom: 116, width: 60, height: 16, x: 20, y: 100, toJSON() {} } as DOMRect;
    word.getClientRects = () => [r] as unknown as DOMRectList;
    const link = screen.getByTestId("card-link");
    const down = new MouseEvent("pointerdown", { bubbles: true, clientX: 14, clientY: 108 });
    Object.defineProperty(down, "pointerType", { value: "touch" });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 14, clientY: 108 });
    act(() => {
      link.dispatchEvent(down);
      link.dispatchEvent(click);
    });
    expect(word).toHaveAttribute("aria-expanded", "false");
    expect(click.defaultPrevented).toBe(false);
  });
});

describe("a focus a touch brings (QA round 3, WebKit, 27 Nov 2026)", () => {
  it("keeps the tip closed when a touch elsewhere is followed by focus on the word, and the keyboard still opens it", () => {
    render(
      <div>
        <p data-testid="elsewhere">Every card <InfoTip tip={TIP}>wears its pills</InfoTip>.</p>
      </div>,
    );
    const word = screen.getByRole("button", { name: "wears its pills" });
    const now = vi.spyOn(performance, "now").mockReturnValue(10_000);
    try {
      // WebKit: the finger lands beside the word, and the browser focuses the word for it.
      const down = new MouseEvent("pointerdown", { bubbles: true, clientX: 5, clientY: 5 });
      Object.defineProperty(down, "pointerType", { value: "touch" });
      act(() => {
        screen.getByTestId("elsewhere").dispatchEvent(down);
      });
      now.mockReturnValue(10_200);
      act(() => {
        word.focus();
      });
      expect(word).toHaveFocus();
      expect(word).toHaveAttribute("aria-expanded", "false");
      act(() => {
        word.blur();
      });
      // Long after any touch, a focus is the keyboard's, and it opens the tip as before.
      now.mockReturnValue(20_000);
      act(() => {
        word.focus();
      });
      expect(word).toHaveAttribute("aria-expanded", "true");
    } finally {
      now.mockRestore();
    }
  });
});

