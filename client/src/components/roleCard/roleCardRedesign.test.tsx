// @vitest-environment jsdom
/**
 * THE ROLE CARD REDESIGN (the lead, 20 Nov 2026; the roles lane's ideas 1, 2, 6, 10 and 11): the role in one minute
 * at the top, five tabs that keep every piece and its links, the Apply bar along a phone's foot, the village's own
 * words wearing tips, and the village's goal as a banner.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { Sprout } from "lucide-react";
import FullRoleCard from "./FullRoleCard";
import RolePieces from "./RolePieces";
import { AnchorCircleTip } from "./CardTips";

const SECTIONS = {
  idealBackground: ["Ran a budget"],
  qualities: ["Calm under pressure"],
  aiSupport: "Drafts the monthly report.",
  aiCompanion: "Heron",
  paid: true,
  payShape: [],
  payNote: "",
  payCeiling: { amount: 9000, currency: "USD", per: "moon" },
  paySplitNote: "",
  where: "On the land",
  deliverables: [
    { title: "Budget agreed", start: "2027-01-05", end: "2027-01-31" },
    { title: "Accounts open", start: "2027-02-01", end: "2027-02-01", milestone: true },
    { title: "First report", start: "2027-03-01", end: "2027-03-31" },
    { title: "Audit", start: "2027-05-01", end: "2027-05-31" },
  ],
};
const seat = () => ({
  id: "finance",
  name: "Lead Finance Steward",
  aim: "Keep the books true.",
  state: "open",
  archetypes: [],
  whyItMatters: "Goal: a funded first season\nYour part: decisions by consent",
  domain: "The books",
  accountabilities: ["Budget agreed by consent of the Anchor Circle"],
  authorities: ["Pay agreed invoices"],
  bringMe: ["Any spend over the budget line"],
  notMine: ["Changing the pay bands"],
  responsibilities: ["Weekly: reconcile the accounts"],
  signsStretched: "Late reports",
  card: { commitmentPct: 60, conversations: [] },
});

let answer: Record<string, unknown>;
beforeEach(() => {
  answer = { sections: SECTIONS, lastEdited: null, showPayRanges: false, villagePay: null, mayEdit: false, shared: { lines: ["Where: on the land", "Goal: a village of forty homes"], rhythm: [], onboarding: ["Meet the circle"] } };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/api/org/role-card/") ? { ok: true, status: 200, json: async () => answer } : { ok: false, status: 404, json: async () => ({}) })));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-01-20T12:00:00Z"));
  Element.prototype.scrollIntoView = vi.fn();
  window.history.replaceState(null, "", "/roles");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function card(anchor: { name: string; purpose: string } | null = null) {
  render(
    <AnchorCircleTip.Provider value={anchor}>
      <FullRoleCard seat={seat()} circleName="Anchor Circle" register="founding" />
    </AnchorCircleTip.Provider>,
  );
  const el = document.querySelector('[data-full-role-card="finance"]') as HTMLElement;
  await waitFor(() => expect(el.querySelector('[data-one-minute-fact="price"]')).toBeTruthy());
  return el;
}
const visible = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>("[data-piece]")).filter((s) => !s.hidden).map((s) => s.dataset.piece);

describe("the role in one minute", () => {
  it("says the goal, the next three deliverables by date, commitment, price and where, above the tabs", async () => {
    const el = await card();
    const summary = el.querySelector("[data-role-one-minute]") as HTMLElement;
    expect(within(summary).getByRole("heading", { name: "The role in one minute" })).toBeTruthy();
    expect(summary.querySelector("[data-one-minute-goal]")?.textContent).toBe("Goal: a funded first season");
    const next = Array.from(summary.querySelectorAll("[data-one-minute-next] li")).map((li) => li.textContent ?? "");
    expect(next).toHaveLength(3);
    expect(next[0]).toMatch(/^Budget agreedBy .*31.*2027$/);
    expect(next[1]).toMatch(/^Accounts openOn .*1.*2027$/);
    expect(next[2]).toMatch(/^First reportBy .*31.*2027$/);
    expect(summary.querySelector('[data-one-minute-fact="commitment"]')?.textContent).toContain("60%");
    expect(summary.querySelector('[data-one-minute-fact="price"]')?.textContent).toContain("$9,000 a moon for the full role");
    expect(summary.querySelector('[data-one-minute-fact="where"]')?.textContent).toContain("On the land");
    // The seat column draws them again as tiles (the Amora operations role, 20 Nov 2026), from the same lines.
    const facts = (el.querySelector("header") as HTMLElement).querySelector('[data-testid="card-facts"]') as HTMLElement;
    expect(facts.textContent).toContain("Commitment60%");
    expect(facts.textContent).toContain("WhereOn the land");
  });

  it("puts a phone's Apply under the goal, once, with the bar along the foot kept as the card's last child", async () => {
    const el = await card();
    // jsdom is narrow, so this is the phone: no desktop act in the summary, the act in the flow under the goal.
    expect(el.querySelector("[data-one-minute-act]")).toBeNull();
    const summary = el.querySelector("[data-role-one-minute]") as HTMLElement;
    const inflow = summary.querySelector("[data-phone-act]") as HTMLElement;
    expect(inflow).toBeTruthy();
    // Right after the goal line, ahead of the next deliverables.
    expect(summary.querySelector("[data-one-minute-goal]")!.nextElementSibling).toBe(inflow);
    const bar = el.querySelector("[data-phone-apply-bar]") as HTMLElement;
    expect(bar.className).toContain("sticky");
    expect(bar.hidden).toBe(true);
    expect(within(el).getAllByRole("link", { name: /Apply for this role/ })).toHaveLength(1);
    expect(el.lastElementChild).toBe(bar);
  });
});

describe("five tabs, not eleven", () => {
  it("holds every piece under five tabs, in order", async () => {
    const el = await card();
    expect(Array.from(el.querySelectorAll("[data-piece-tab]")).map((b) => b.textContent)).toEqual(["The role", "Deliverables", "How we work", "You and rewards", "The path in"]);
    fireEvent.click(within(el).getByRole("button", { name: /How we work/ }));
    expect(visible(el)).toEqual(["authorities", "bringMe", "responsibilities", "holding"]);
    fireEvent.click(within(el).getByRole("button", { name: /The path in/ }));
    expect(visible(el)).toEqual(["chosen", "onboarding"]);
  });

  it("opens the tab that holds a piece an old link names, by the piece's key or the tab's", async () => {
    window.history.replaceState(null, "", "/roles#rewards");
    const el = await card();
    // The pieces arrive with the card's sections, and the link lands once they have.
    await waitFor(() => expect(visible(el)).toEqual(["who", "rewards"]));
    window.location.hash = "#piece-holding";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => expect(visible(el)).toEqual(["authorities", "bringMe", "responsibilities", "holding"]));
    window.location.hash = "#path";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => expect(visible(el)).toEqual(["chosen", "onboarding"]));
    // A hash that names nothing on the card leaves it where it is (control).
    window.location.hash = "#opening-next";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(visible(el)).toEqual(["chosen", "onboarding"]);
  });

  it("marks a tab when any piece it holds carries a suggestion, and counts them all", () => {
    const pieces = ["a", "b", "c"].map((k) => ({ key: k, tab: k, icon: Sprout, title: k, body: <p>{k}</p> }));
    const { container } = render(<RolePieces pieces={pieces} tabs={[{ key: "one", tab: "One", icon: Sprout, pieces: ["a", "b"] }]} level={3} marks={(k) => (k === "b" ? 2 : 0)} />);
    // A piece no tab names keeps a tab of its own.
    expect(Array.from(container.querySelectorAll("[data-piece-tab]")).map((b) => b.getAttribute("data-piece-tab"))).toEqual(["one", "c"]);
    const one = container.querySelector('[data-piece-tab="one"]') as HTMLElement;
    expect(one.querySelector("[data-piece-marked]")).toBeTruthy();
    expect(one.textContent).toContain("2 suggestions");
    expect(container.querySelector('[data-piece-tab="c"] [data-piece-marked]')).toBeNull();
  });
});

describe("the village's own words, each with a tip", () => {
  it("tips consent, the anchor circle by its own purpose, and the Digital Companion, the first mention in a passage", async () => {
    const el = await card({ name: "Anchor Circle", purpose: "Holds the village's direction." });
    fireEvent.click(within(el).getByRole("button", { name: "Show every piece" }));
    const box = within(el).getByTestId("words-whyItMatters");
    const word = box.querySelector(".tip-word > [tabindex]") as HTMLElement;
    expect(word.textContent).toBe("consent");
    fireEvent.focus(word);
    expect(document.querySelector('[role="tooltip"]')?.textContent).toContain("nobody in the circle has a reasoned objection");
    fireEvent.blur(word);
    const eyebrow = within(el.querySelector("header") as HTMLElement).getByText("Anchor Circle");
    expect(eyebrow.getAttribute("tabindex")).toBe("0");
    fireEvent.focus(eyebrow);
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe("Holds the village's direction.");
    fireEvent.blur(eyebrow);
    expect(within(el).getByTestId("ai-support").querySelector(".tip-word")?.textContent).toBe("Digital Companion");
    // The heading still reads as it did.
    expect(within(el).getByRole("heading", { name: "Goes to the Anchor Circle" })).toBeTruthy();
  });

  it("uses the village's own line for a word over the platform's", async () => {
    answer = { ...answer, shared: { ...(answer.shared as object), tips: [{ word: "consent", tip: "Our way: no one blocks it." }] } };
    const el = await card();
    fireEvent.click(within(el).getByRole("button", { name: "Show every piece" }));
    const word = within(el).getByTestId("words-whyItMatters").querySelector(".tip-word > [tabindex]") as HTMLElement;
    fireEvent.focus(word);
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe("Our way: no one blocks it.");
  });
});

describe("the village's goal as a banner", () => {
  it("draws the shared lines in their own banner above the role's own lines", async () => {
    const el = await card();
    const banner = within(el).getByTestId("village-goal");
    expect(within(banner).getByText("The goal we share")).toBeTruthy();
    expect(Array.from(banner.querySelectorAll("li")).map((li) => li.textContent)).toEqual(["Where: on the land", "Goal: a village of forty homes"]);
    expect(Array.from(within(el).getByTestId("words-whyItMatters").querySelectorAll("li")).map((li) => li.textContent)).toEqual(["Your part: decisions by consent"]);
  });
});
