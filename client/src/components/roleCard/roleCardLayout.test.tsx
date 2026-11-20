// @vitest-environment jsdom
/**
 * THE ROLE CARD'S LAYOUT (the lead, Anchor session of 19 Nov 2026): bullets with bold labels, "What {village}
 * needs from you" with the village's shared lines first, Deliverables as a timeline with its text list, the
 * village's sessions first under Rhythm, Bring me beside Decides, what goes to the circle, "Once you're
 * selected" (the card's own steps, else the village's), and each conversation's booking on How you're chosen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FullRoleCard from "./FullRoleCard";

const SECTIONS = {
  idealBackground: [],
  qualities: ["Calm under pressure"],
  aiSupport: "",
  aiCompanion: "",
  paid: false,
  payShape: [],
  payNote: "",
  payCeiling: null,
  paySplitNote: "",
};
const seat = (over: Record<string, unknown> = {}) => ({
  id: "finance",
  name: "Lead Finance Steward",
  aim: "Keep the books true.",
  state: "open",
  archetypes: [],
  whyItMatters: "Goal: a funded first season\nYour part: the budget",
  domain: "The books",
  accountabilities: ["By 31 Jan: budget agreed", "By 28 Feb: accounts open", "By 31 Mar: first report"],
  authorities: ["Pay agreed invoices"],
  bringMe: ["Any spend over the budget line"],
  notMine: ["Changing the pay bands"],
  responsibilities: ["Weekly: reconcile the accounts"],
  card: {
    conversations: [
      { roleId: "h", roleName: "Human Operations Lead", minutes: 30, booking: { kind: "link", url: "https://cal.example.org/ops" } },
      { roleId: "v", roleName: "Visionary Channel", minutes: 20, final: true, booking: { kind: "note" } },
    ],
  },
  ...over,
});

let answer: Record<string, unknown>;
beforeEach(() => {
  answer = {
    sections: { ...SECTIONS, deliverables: [{ title: "Budget agreed", start: "2027-01-05", end: "2027-01-31", workstream: "Budget" }, { title: "Accounts open", start: "2027-02-01", end: "2027-02-01", workstream: "Banking" }] },
    lastEdited: null,
    showPayRanges: false,
    villagePay: null,
    mayEdit: false,
    shared: { lines: ["Where: on the land"], rhythm: ["Weekly: Monday team meeting", "Each moon: new moon recap and intentions"], onboarding: ["Village step one", "Village step two"] },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => (String(url).includes("/api/org/role-card/") ? { ok: true, status: 200, json: async () => answer } : { ok: false, status: 404, json: async () => ({}) })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openCard() {
  render(<FullRoleCard seat={seat()} circleName="Anchor Circle" register="founding" />);
  const card = document.querySelector('[data-full-role-card="finance"]') as HTMLElement;
  fireEvent.click(within(card).getByRole("button", { name: "Show every piece" }));
  await waitFor(() => expect(card.querySelector('[data-testid="onboarding"]')).toBeTruthy());
  return card;
}

describe("the role card's layout", () => {
  it("sets the village's shared lines apart as a banner above what the village needs, and lifts the goal into the summary (the lead, 20 Nov 2026)", async () => {
    const card = await openCard();
    expect(within(card).getByRole("heading", { name: /^What .+ needs from you$/ })).toBeTruthy();
    const banner = within(card).getByTestId("village-goal");
    expect(Array.from(banner.querySelectorAll("li")).map((li) => li.textContent)).toEqual(["Where: on the land"]);
    expect(banner.querySelector("li .font-semibold")?.textContent).toBe("Where:");
    // The box keeps the role's own labelled lines, without the goal the summary already says.
    const box = within(card).getByTestId("words-whyItMatters");
    expect(Array.from(box.querySelectorAll("li")).map((li) => li.textContent)).toEqual(["Your part: the budget"]);
    expect(banner.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The role in one minute: the goal, then the deliverables by date.
    const summary = card.querySelector("[data-role-one-minute]") as HTMLElement;
    expect(summary.querySelector("[data-one-minute-goal]")?.textContent).toBe("Goal: a funded first season");
    expect(Array.from(summary.querySelectorAll("[data-one-minute-next] li")).map((li) => li.querySelector("span span")?.textContent)).toEqual(["Budget agreed", "Accounts open"]);
    // The summary sits above the tabs.
    expect(summary.compareDocumentPosition(card.querySelector("[data-piece-rail]") as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws Deliverables as a timeline with its dates as a list, and keeps the accountabilities beside it", async () => {
    const card = await openCard();
    const gantt = await within(card).findByTestId("deliverables-gantt");
    expect(within(gantt).getByTestId("deliverables-list").textContent).toContain("Budget agreed");
    expect(within(gantt).getByTestId("deliverables-list").textContent).toContain("(Banking)");
    expect(within(card).getByTestId("words-accountabilities").textContent).toContain("By 31 Jan");
    // Control: with no dated deliverables, no timeline, and the list reads as before.
    cleanup();
    answer = { ...answer, sections: SECTIONS };
    const again = await openCard();
    expect(again.querySelector('[data-testid="deliverables-gantt"]')).toBeNull();
    expect(within(again).getByTestId("words-accountabilities").textContent).toContain("By 31 Jan");
  });

  it("puts the village's sessions first under Rhythm, grouped by cadence, then the role's own", async () => {
    const card = await openCard();
    const shared = within(card).getByTestId("shared-rhythm");
    expect(shared.textContent).toContain("Weekly");
    expect(shared.textContent).toContain("Monday team meeting");
    expect(shared.textContent).toContain("Each moon");
    expect(within(card).getByTestId("words-responsibilities").textContent).toContain("reconcile the accounts");
    const order = Array.from(card.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid"));
    expect(order.indexOf("shared-rhythm")).toBeLessThan(order.indexOf("words-responsibilities"));
  });

  it("puts Bring me beside Decides, names the circle for consent, and shows the onboarding steps", async () => {
    const card = await openCard();
    const order = Array.from(card.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid"));
    expect(order.indexOf("words-bringMe")).toBe(order.indexOf("words-authorities") + 1);
    expect(within(card).getByRole("heading", { name: "Goes to the Anchor Circle" })).toBeTruthy();
    expect(within(card).getByTestId("onboarding").textContent).toContain("Village step one");
    // A card's own steps take the village's place.
    cleanup();
    answer = { ...answer, sections: { ...SECTIONS, onboarding: ["Own step"] } };
    const own = await openCard();
    expect(within(own).getByTestId("onboarding").textContent).toContain("Own step");
    expect(within(own).getByTestId("onboarding").textContent).not.toContain("Village step one");
  });

  it("shows each conversation's booking, a WhatsApp note with no number", async () => {
    const card = await openCard();
    const book = card.querySelector('[data-card-booking="link"]') as HTMLAnchorElement;
    expect(book.getAttribute("href")).toBe("https://cal.example.org/ops");
    expect(book.textContent).toBe("Book a time");
    const note = card.querySelector('[data-card-booking="note"]')!;
    expect(note.textContent).toBe("We'll message you on WhatsApp");
    expect(note.textContent).not.toMatch(/\d/);
  });
});
