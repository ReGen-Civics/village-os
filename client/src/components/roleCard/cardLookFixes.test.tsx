// @vitest-environment jsdom
/**
 * THE SCREENSHOT CHECK OF 1.3.38, and the lead's rule after it: a phone's Apply is in the flow under the goal from
 * the first screen, and the opaque bar shows only while that act is off the screen; the
 * path-in tab never draws an empty panel; the phone's tab rail says it scrolls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { Sprout } from "lucide-react";
import FullRoleCard from "./FullRoleCard";
import RolePieces, { railEdges } from "./RolePieces";
import { applyBarShows } from "./useApplyBarStuck";

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

describe("the phone's Apply, visible from the start (the lead, after 1.3.38)", () => {
  it("shows the bar only while the act in the flow is off the screen", () => {
    // A 664px screen, a 64px tab bar and a 130px bar: the bar's top would be at 470.
    // The act on the first screen, under the goal: no bar.
    expect(applyBarShows({ top: 380, bottom: 500 }, 664, 64, 130)).toBe(false);
    // The card low on the screen, its goal not yet on it (the screen ends at 600, above the tab bar): the bar shows,
    // over what comes before the goal.
    expect(applyBarShows({ top: 700, bottom: 820 }, 664, 64, 130, 0, 610)).toBe(true);
    // The goal on the screen, even under the bar line, and the act not yet: the bar waits, so it never covers the goal.
    expect(applyBarShows({ top: 590, bottom: 710 }, 664, 64, 130, 0, 500)).toBe(false);
    expect(applyBarShows({ top: 520, bottom: 640 }, 664, 64, 130, 0, 420)).toBe(false);
    // A card with no goal line reads the act's own top.
    expect(applyBarShows({ top: 520, bottom: 640 }, 664, 64, 130)).toBe(true);
    // Scrolled past above, or under a 60px sticky header: the bar shows.
    expect(applyBarShows({ top: -200, bottom: -80 }, 664, 64, 130)).toBe(true);
    expect(applyBarShows({ top: -60, bottom: 50 }, 664, 64, 130, 60)).toBe(true);
    // Nothing laid out (control): the act in the flow stands alone.
    expect(applyBarShows(null, 664, 64, 130)).toBe(false);
  });

  it("draws Apply under the goal on the first screen with the goal whole, and the opaque bar once it scrolls away", async () => {
    // A phone's first screen: the goal at 290 to 370, the act in the flow at 380 to 500, all above the bar line.
    let scrolled = 0;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const box = (top: number, height: number) => ({ top: top - scrolled, bottom: top - scrolled + height, left: 0, right: 390, width: 390, height, x: 0, y: top - scrolled, toJSON: () => ({}) }) as DOMRect;
      if (this.hasAttribute("data-one-minute-goal")) return box(290, 80);
      if (this.hasAttribute("data-phone-act")) return box(380, 120);
      return box(0, 0);
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(120);
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 664 });
    const el = await card(seat({ commitmentPct: 60, track: "contractor" }));
    const inflow = el.querySelector("[data-phone-act]") as HTMLElement;
    const bar = el.querySelector("[data-phone-apply-bar]") as HTMLElement;
    const goal = el.querySelector("[data-one-minute-goal]") as HTMLElement;
    // Apply is on the first screen, under the goal, and nothing covers the goal: the bar is not drawn.
    expect(inflow.getBoundingClientRect().top).toBeGreaterThanOrEqual(goal.getBoundingClientRect().bottom);
    expect(inflow.getBoundingClientRect().bottom).toBeLessThanOrEqual(664);
    // The fact tiles come after the act on a phone, so they never push it off the first screen (the lead, 20 Nov 2026).
    const tiles = el.querySelector('[data-testid="card-facts"]');
    expect(tiles).toBeTruthy();
    expect(inflow.compareDocumentPosition(tiles!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => expect(bar.hidden).toBe(true));
    expect(within(el).getAllByRole("link", { name: /Apply for this role/ })).toHaveLength(1);
    expect(within(inflow).getAllByRole("link", { name: /Apply for this role/ })).toHaveLength(1);
    // Scrolled on: the act in the flow has gone above the screen, so the bar rides the foot, opaque, and the act in
    // the flow is inert, so one Apply is offered.
    scrolled = 700;
    window.dispatchEvent(new Event("scroll"));
    await waitFor(() => expect(bar.hidden).toBe(false));
    expect(bar.hasAttribute("data-stuck")).toBe(true);
    expect(bar.className).toContain("sticky");
    expect(bar.className).toMatch(/(^|\s)bg-card(\s|$)/);
    expect(bar.className).not.toMatch(/bg-card\/|backdrop-blur/);
    expect(inflow.hasAttribute("inert")).toBe(true);
    expect(within(bar).getAllByRole("link", { name: /Apply for this role/ })).toHaveLength(1);
    // Still the card's last child, so the end of the card keeps its controls above the bar's own slot.
    expect(el.lastElementChild).toBe(bar);
    expect(el.querySelector('[data-testid="last-edited"]')).toBeTruthy();
    // Scrolled back to the top: the bar goes again.
    scrolled = 0;
    window.dispatchEvent(new Event("scroll"));
    await waitFor(() => expect(bar.hidden).toBe(true));
    expect(inflow.hasAttribute("inert")).toBe(false);
  });
});

describe("a long state note never pushes the phone's act off the first screen (the lead, 20 Nov 2026)", () => {
  it("puts a venture's pitch note after Apply, and a coming-soon notice after Join the waitlist, on a phone", async () => {
    const v = await card({ ...seat(), futureVenture: true, state: "forming" } as any);
    const apply = v.querySelector("[data-phone-act] [data-apply-role]") as HTMLElement;
    const pitch = v.querySelector("[data-phone-act] [data-venture-note]") as HTMLElement;
    expect(apply.compareDocumentPosition(pitch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // A venture's act says what it asks for, into the same apply flow.
    expect(apply.textContent).toBe("Bring your venture");
    cleanup();
    const c = await card({ ...seat(), comingSoon: true, state: "forming" } as any);
    const notify = within(c.querySelector("[data-phone-act]") as HTMLElement).getByRole("button", { name: "Join the waitlist" });
    const note = c.querySelector("[data-phone-act] [data-coming-soon-note]") as HTMLElement;
    expect(notify.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("CONTROL: on a desktop the note stays above the act, beside it as before", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("min-width"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    const v = await card({ ...seat(), futureVenture: true, state: "forming" } as any);
    const apply = v.querySelector("[data-apply-role]") as HTMLElement;
    const pitch = v.querySelector("[data-venture-note]") as HTMLElement;
    expect(pitch.compareDocumentPosition(apply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
