// @vitest-environment jsdom
/**
 * THE SCREENSHOT CHECK OF 1.3.38: the phone's Apply bar waits until the goal is clear above it, and is opaque; the
 * path-in tab never draws an empty panel; the phone's tab rail says it scrolls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { Sprout } from "lucide-react";
import FullRoleCard from "./FullRoleCard";
import RolePieces, { railEdges } from "./RolePieces";
import { applyBarMayStick } from "./useApplyBarStuck";

const SECTIONS = {
  idealBackground: [],
  qualities: [],
  aiSupport: "",
  aiCompanion: "",
  paid: true,
  payShape: [],
  payNote: "",
  payCeiling: { amount: 9000, currency: "USD", per: "moon" },
  paySplitNote: "",
  where: "",
  deliverables: [],
};
const seat = (card: Record<string, unknown> = { commitmentPct: 60 }) => ({
  id: "finance",
  name: "Lead Finance Steward",
  aim: "Keep the books true.",
  state: "open",
  archetypes: [],
  whyItMatters: "Goal: a funded first season",
  domain: "The books",
  accountabilities: ["Budget agreed"],
  card,
});

beforeEach(() => {
  const answer = { sections: SECTIONS, lastEdited: null, showPayRanges: false, villagePay: null, mayEdit: false, shared: { lines: [], rhythm: [], onboarding: [] } };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/api/org/role-card/") ? { ok: true, status: 200, json: async () => answer } : { ok: false, status: 404, json: async () => ({}) })));
  Element.prototype.scrollIntoView = vi.fn();
  window.history.replaceState(null, "", "/roles");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function card(s = seat()) {
  render(<FullRoleCard seat={s} circleName="Anchor Circle" register="founding" />);
  const el = document.querySelector('[data-full-role-card="finance"]') as HTMLElement;
  await waitFor(() => expect(el.querySelector("[data-one-minute-goal]")).toBeTruthy());
  return el;
}

describe("the phone's Apply bar", () => {
  it("may ride the screen only once the goal's bottom is above where the bar would sit", () => {
    // A 664px screen, a 64px tab bar and a 130px bar: the bar's top would be at 470.
    expect(applyBarMayStick(520, 664, 64, 130)).toBe(false);
    expect(applyBarMayStick(470, 664, 64, 130)).toBe(true);
    expect(applyBarMayStick(-200, 664, 64, 130)).toBe(true);
    // A card with no goal line has nothing to cover (control).
    expect(applyBarMayStick(null, 664, 64, 130)).toBe(true);
  });

  it("waits in its slot at the card's end while the goal is low on the screen, and is opaque", async () => {
    // The goal sits low on the first screen, where the bar would cover it.
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const bottom = this.hasAttribute("data-one-minute-goal") ? window.innerHeight - 40 : 0;
      return { top: bottom - 30, bottom, left: 0, right: 0, width: 0, height: 30, x: 0, y: bottom - 30, toJSON: () => ({}) } as DOMRect;
    });
    // The bar is 130px tall, so it would cover the goal's last 90px.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(130);
    const el = await card();
    const bar = el.querySelector("[data-phone-apply-bar]") as HTMLElement;
    await waitFor(() => expect(bar.className).not.toContain("sticky"));
    expect(bar.hasAttribute("data-stuck")).toBe(false);
    expect(bar.className).toMatch(/(^|\s)bg-card(\s|$)/);
    expect(bar.className).not.toMatch(/bg-card\/|backdrop-blur/);
    // Still the card's last child, with the one act, so the end of the card keeps it.
    expect(el.lastElementChild).toBe(bar);
    expect(within(el).getAllByRole("link", { name: /Apply for this role/ })).toHaveLength(1);
    // Once the goal has scrolled clear above it, the bar rides the screen.
    rect.mockImplementation(() => ({ top: -100, bottom: -70, left: 0, right: 0, width: 0, height: 30, x: 0, y: -100, toJSON: () => ({}) }) as DOMRect);
    window.dispatchEvent(new Event("scroll"));
    await waitFor(() => expect(bar.className).toContain("sticky"));
  });
});

describe("the path in", () => {
  it("says a plain line when the role names no steps or goals, never an empty panel", async () => {
    const el = await card(seat({}));
    fireEvent.click(within(el).getByRole("button", { name: /The path in/ }));
    const chosen = el.querySelector('[data-piece="chosen"]') as HTMLElement;
    expect(chosen.hidden).toBe(false);
    expect(within(chosen).getByTestId("chosen-empty").textContent).toBe("The steps in are shared in the first conversation.");
    expect(chosen.querySelector('[data-testid="role-card-params"]')).toBeNull();
  });

  it("draws the steps, and no note, when the role names them (control)", async () => {
    const el = await card(seat({ conversations: [{ title: "A first talk with the circle" }] }));
    fireEvent.click(within(el).getByRole("button", { name: /The path in/ }));
    const chosen = el.querySelector('[data-piece="chosen"]') as HTMLElement;
    expect(chosen.querySelector('[data-testid="role-card-params"]')).toBeTruthy();
    expect(chosen.querySelector('[data-testid="chosen-empty"]')).toBeNull();
  });
});

describe("the phone's tab rail", () => {
  it("knows which ends have more tabs past them", () => {
    expect(railEdges(0, 390, 900)).toEqual({ before: false, after: true });
    expect(railEdges(200, 390, 900)).toEqual({ before: true, after: true });
    expect(railEdges(510, 390, 900)).toEqual({ before: true, after: false });
    expect(railEdges(0, 390, 390)).toEqual({ before: false, after: false });
  });

  it("fades the edge that has more tabs past it, and not when everything fits", () => {
    const pieces = ["one", "two", "three", "four", "five"].map((k) => ({ key: k, tab: k, icon: Sprout, title: k, body: <p>{k}</p> }));
    const sizes = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(390);
    const { container, unmount } = render(<RolePieces pieces={pieces} level={3} />);
    expect(container.querySelector('[data-rail-fade="after"]')).toBeTruthy();
    expect(container.querySelector('[data-rail-fade="before"]')).toBeNull();
    // The sticky one-row rail of 1.3.36 stays.
    expect(container.querySelector("[data-piece-rail]")!.className).toContain("max-sm:sticky");
    unmount();
    sizes.mockReturnValue(390);
    const fits = render(<RolePieces pieces={pieces} level={3} />);
    expect(fits.container.querySelector("[data-rail-fade]")).toBeNull();
  });
});
