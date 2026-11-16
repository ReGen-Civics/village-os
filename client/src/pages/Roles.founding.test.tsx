// @vitest-environment jsdom
/**
 * PHASE A, LANE A3: the Roles and Circles page with "Join the founding team"
 * at the top, the full card in the founding register, and the admin view.
 *
 *   - the section draws only while the village turns it on, with the roles it
 *     names in order, and each role appears ONCE on the page;
 *   - the full card holds the founding sections, the village's pay shape with
 *     its at-risk line and footer, never a range, and one act, "Apply for this
 *     role", to /propose-a-role?role=<id>;
 *   - the card is read-only for a reader without the editor's door;
 *   - VERIFY 2.2: a steward the server sends unlisted roles to sees what a
 *     visitor sees, and the rest behind one switch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import type { ReactNode } from "react";

const session = vi.hoisted(() => ({ token: null as string | null, user: null as null | { id: string; role?: string } }));

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/SeatClaimCard", () => ({ default: () => null }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: session.user, token: session.token, loading: false }),
  useIsAdmin: () => false,
  useOptionalAuth: () => ({ user: session.user }),
}));
vi.mock("@/lib/gameApi", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authToken: () => session.token,
}));
vi.mock("@/modules/ModuleProvider", () => ({ useModule: () => undefined, useModuleOn: () => false }));
vi.mock("@/components/natural/useReducedMotion", () => ({ useReducedMotion: () => true, prefersReducedMotion: () => true }));

import Roles from "./Roles";

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const RANGE_NOTE = "Full time, with equity and other bonuses";
const seat = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  circleId: "anchor",
  aim: `Lead all things ${name.toLowerCase()}.`,
  domain: "The whole domain",
  accountabilities: ["Model the viability", "Keep the daily books"],
  authorities: ["Choose the accounting tools"],
  responsibilities: ["A cash view every Monday"],
  bringMe: ["Invoices to approve"],
  notMine: ["Fundraising decisions alone"],
  whyItMatters: "Every home we plan runs on money someone keeps true.",
  signsStretched: "The close slips past day ten.",
  flowsBack: null,
  stepBack: null,
  timeCommitment: "Full time",
  seats: 1,
  holderCount: 0,
  state: "open",
  stateSource: "derived",
  criticality: "normal",
  recruiting: true,
  representsCircle: false,
  howChosen: null,
  howChosenGloss: null,
  termEnds: null,
  archetypes: ["catalyzing", "researching"],
  isExample: false,
  holders: [],
  card: { complete: true, missing: [], written: 11, of: 11, gated: false, track: "contractor", selectionCriteria: ["A", "B", "C"], conversations: [], villageGoals: null, publicPay: { kind: "range", currency: "USD", minMinor: 675000, maxMinor: 900000, per: "month", note: RANGE_NOTE } },
  ...over,
});

const SECTIONS = {
  idealBackground: ["Ideally studied finance", "Real estate development finance"],
  qualities: ["Owns the whole domain"],
  aiSupport: "An AI companion keeps the daily books moving.",
  aiCompanion: "Heron",
  paid: true,
  payShape: [],
  payNote: "",
  payCeiling: { amount: 9000, currency: "USD", per: "month" },
  paySplitNote: "To be decided in the onboarding process.",
};
const VILLAGE_PAY = {
  shape: [
    { label: "cash", pct: 40 },
    { label: "equity", pct: 55 },
    { label: "village credits", pct: 5 },
  ],
  atRisk: "The equity share depends on what the village raises.",
  note: "Indicative only. Equity, land credit, token and credit terms are still being defined and are subject to legal review.",
};

let org: any;
let founding: any;
let roleCard: (id: string) => any;
const asked: string[] = [];

beforeEach(() => {
  asked.length = 0;
  window.history.replaceState(null, "", "/roles");
  session.token = null;
  session.user = null;
  vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
  org = {
    people: { visible: false, membersOnly: false, signedIn: false },
    circles: [{ id: "anchor", name: "Anchor Circle", purpose: "", status: "active" }],
    roles: [seat("finance", "Lead Finance Steward"), seat("land", "Regenerative Land & Building Lead"), seat("cook", "Village Cook")],
  };
  founding = { on: true, roleIds: ["land", "finance"], sections: { finance: SECTIONS }, showPayRanges: false, villagePay: VILLAGE_PAY };
  roleCard = (id: string) => ({ roleId: id, sections: id === "finance" ? SECTIONS : null, lastEdited: { by: "Mara", on: "2026-11-11" }, showPayRanges: false, villagePay: VILLAGE_PAY, mayEdit: false });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const u = String(url);
      asked.push(u);
      const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
      if (u === "/api/org") return reply(org);
      if (u === "/api/org/founding-team") return reply(founding);
      if (u.startsWith("/api/org/role-card/")) return reply(roleCard(decodeURIComponent(u.split("/").pop() ?? "")));
      if (u === "/api/season") return reply({ current: null });
      return reply([], 404);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const renderRoles = () =>
  render(
    <Router>
      <Roles />
    </Router>,
  );

describe("Join the founding team", () => {
  it("leads the page with the roles the village names, in its order, and each role appears once", async () => {
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    const rows = within(section).getAllByRole("button").filter((b) => b.hasAttribute("data-founding-role"));
    expect(rows.map((b) => b.getAttribute("data-founding-role"))).toEqual(["land", "finance"]);
    // The draft board's competing primary act is gone while the section leads.
    expect(screen.queryByRole("link", { name: /Browse the open roles/ })).toBeNull();
    // Each concept once: the directory leaves the featured roles out.
    fireEvent.click(screen.getByRole("button", { name: "See all roles" }));
    await screen.findByRole("heading", { level: 3, name: "Village Cook" });
    expect(screen.queryByRole("heading", { level: 3, name: "Lead Finance Steward" })).toBeNull();
  });

  it("hiring first (Rye, 14 Nov 2026): says the founding roles come first, and puts every other open role right under them as opening next, once", async () => {
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    const line = section.querySelector("[data-hiring-first]") as HTMLElement;
    expect(line.textContent).toMatch(/We are filling these roles first\. More roles open after them\./);
    expect(within(line).getByRole("link", { name: "See the roles opening next" }).getAttribute("href")).toBe("#opening-next");
    const next = await screen.findByRole("region", { name: "More roles, opening next" });
    expect(next.id).toBe("opening-next");
    expect(next.textContent).toMatch(/You are welcome to apply for any of these now\. It may be a while before we reply/);
    expect(within(next).getByRole("heading", { level: 3, name: "Village Cook" })).toBeTruthy();
    // Hear first (Rye, 15 Nov 2026): the community calls always; the newsletter only once the village has one.
    const hear = next.querySelector("[data-hear-first]") as HTMLElement;
    expect(within(hear).getByRole("link", { name: "join a community call" }).getAttribute("href")).toBe("/events");
    expect(within(hear).queryByRole("link", { name: "sign up for our newsletter" })).toBeNull();
    expect(within(next).queryByRole("heading", { level: 3, name: "Lead Finance Steward" })).toBeNull();
    // Once on the page: the directory leaves it out.
    fireEvent.click(screen.getByRole("button", { name: "See all roles" }));
    await screen.findByRole("heading", { level: 2, name: "All roles and circles" });
    expect(screen.getAllByRole("heading", { level: 3, name: "Village Cook" })).toHaveLength(1);
  });

  it("names the newsletter beside the calls once the village has one, in a new tab (Rye, 15 Nov 2026)", async () => {
    founding = { ...founding, otherWays: { newsletter: "https://news.example.test/join" } };
    renderRoles();
    const next = await screen.findByRole("region", { name: "More roles, opening next" });
    const hear = next.querySelector("[data-hear-first]") as HTMLElement;
    const a = within(hear).getByRole("link", { name: "sign up for our newsletter" });
    expect([a.getAttribute("href"), a.getAttribute("target")]).toEqual(["https://news.example.test/join", "_blank"]);
    expect(hear.textContent).toMatch(/Hear first about new opportunities: join a community call and sign up for our newsletter\./);
  });

  it("with no other role open, the line stays and points nowhere, and no opening-next section draws (control)", async () => {
    org.roles = org.roles.slice(0, 2);
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    expect(section.querySelector("[data-hiring-first]")?.textContent).toMatch(/We are filling these roles first/);
    expect(within(section).queryByRole("link", { name: "See the roles opening next" })).toBeNull();
    expect(screen.queryByRole("region", { name: "More roles, opening next" })).toBeNull();
  });

  it("keeps the page's outline whole while the founding team leads: no heading skips a level (axe heading-order)", async () => {
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    const row = within(section).getAllByRole("button").find((b) => b.getAttribute("data-founding-role") === "land") as HTMLElement;
    if (row.getAttribute("aria-expanded") !== "true") fireEvent.click(row);
    await waitFor(() => expect(section.querySelector("[data-full-role-card]")).toBeTruthy());
    const levels = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading ${i}: h${levels[i - 1]} then h${levels[i]}`).toBeLessThanOrEqual(1);
  });

  it("draws nothing while the village has it off (control: the directory lists every role, and the board's act returns)", async () => {
    founding = { on: false, roleIds: [], sections: {}, showPayRanges: false, villagePay: VILLAGE_PAY };
    renderRoles();
    await screen.findByRole("link", { name: /Browse the open roles/ });
    expect(screen.queryByRole("region", { name: "Join the founding team" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "See all roles" }));
    expect(await screen.findByRole("heading", { level: 3, name: "Lead Finance Steward" })).toBeTruthy();
  });

  it("opens a full card with the founding sections, the village's pay shape and no range, and one Apply act", async () => {
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    fireEvent.click(within(section).getByRole("button", { name: /Lead Finance Steward/ }));
    const card = await waitFor(() => {
      const el = section.querySelector('[data-full-role-card="finance"]') as HTMLElement | null;
      if (!el) throw new Error("no card yet");
      return el;
    });
    await waitFor(() => expect(within(card).getByTestId("last-edited").textContent).toBe("Last edited by Mara on 11 November 2026"));
    // Piece by piece (Rye, 14 Nov): every piece is in the page, and one button opens them all.
    fireEvent.click(within(card).getByRole("button", { name: "Show every piece" }));
    expect(within(card).getByTestId("paid-role-line").textContent).toBe("This is a paid role");
    expect(within(card).getByRole("heading", { name: "Ideal background" })).toBeTruthy();
    expect(within(card).getByRole("heading", { name: "Qualities we're looking for" })).toBeTruthy();
    // QA2-09: "Digital Companion" (capitalised) replaces the AI wording.
    expect(within(card).getByRole("heading", { name: "Digital Companion" })).toBeTruthy();
    expect(card.textContent).not.toMatch(/AI support/);
    expect(card.textContent).toContain("Heron");
    // Everything the editor holds: the words under the editor's own headings.
    for (const h of ["Why it matters", "What I look after", "What I can decide on my own", "What you can count on me for", "What I do regularly", "Bring me", "Not mine to hold", "Holding this role well"]) {
      expect(within(card).getByRole("heading", { name: h })).toBeTruthy();
    }
    const pay = within(card).getByTestId("pay-shape");
    expect(within(pay).getByTestId("pay-ceiling").textContent).toBe("Listed price: $9,000 a month for the full role*");
    expect(within(pay).getByTestId("pay-split").textContent).toBe("Default split: 40% cash, 55% equity, 5% village credits. To be decided in the onboarding process.");
    expect(within(pay).getByTestId("pay-at-risk").textContent).toBe(VILLAGE_PAY.atRisk);
    // One footnote: the ceiling's own, so the village's note is not drawn again (copy sweep, 15 Nov 2026).
    expect(within(pay).queryByTestId("pay-note")).toBeNull();
    expect(within(pay).getByTestId("pay-footnote")).toBeTruthy();
    // The split is said once: the tiles show it, and its words stay for screen readers.
    expect(within(pay).getByTestId("pay-split").querySelector(".sr-only")?.textContent).toBe("Default split: 40% cash, 55% equity, 5% village credits. ");
    // RANGES AND MINIMUMS STAY HIDDEN, even when an older payload still carries one.
    expect(card.textContent).not.toContain("6,750");
    expect(card.textContent).not.toContain("6750");
    expect(card.textContent).not.toContain(RANGE_NOTE);
    const apply = within(card).getAllByRole("link", { name: /Apply for this role/ });
    expect(apply).toHaveLength(1);
    expect(apply[0].getAttribute("href")).toBe("/propose-a-role?role=finance");
    // Read-only: no editor door for a visitor.
    expect(within(card).queryByRole("button", { name: "Edit this role" })).toBeNull();
  });

  it("CONTROL for the hidden range: a village that shows ranges draws the range on the same card", async () => {
    roleCard = (id: string) => ({ roleId: id, sections: SECTIONS, lastEdited: null, showPayRanges: true, villagePay: VILLAGE_PAY, mayEdit: false });
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    fireEvent.click(within(section).getByRole("button", { name: /Lead Finance Steward/ }));
    await waitFor(() => expect(section.textContent).toContain(RANGE_NOTE));
  });

  it("opening a role moves focus to its card, where the eye goes (a11y sweep P1-3)", async () => {
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    fireEvent.click(within(section).getByRole("button", { name: /Lead Finance Steward/ }));
    const slot = section.querySelector("[data-founding-card-slot]") as HTMLElement;
    expect(slot.tabIndex).toBe(-1);
    await waitFor(() => expect(document.activeElement).toBe(slot));
  });

  it("a card that writes its own shares shows those in place of the village's", async () => {
    roleCard = (id: string) => ({ roleId: id, sections: { ...SECTIONS, payShape: [{ label: "cash", pct: 70 }, { label: "equity", pct: 30 }], payNote: "This role's own note." }, lastEdited: null, showPayRanges: false, villagePay: VILLAGE_PAY, mayEdit: false });
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    fireEvent.click(within(section).getByRole("button", { name: /Lead Finance Steward/ }));
    await waitFor(() => expect(within(section).getByTestId("pay-split").textContent).toContain("70% cash, 30% equity"));
    expect(within(section).getByTestId("pay-shape").textContent).not.toContain("55%");
    // With a listed price, the card's own note is the footnote's fine print (steelman, 15 Nov 2026).
    expect(within(section).getByTestId("pay-footnote").textContent).toBe("*At 100% commitment. Your first month often starts lower and follows what you deliver. Equity and credit terms are still being written and are subject to legal review. This role's own note.");
    expect(within(section).queryByTestId("pay-note")).toBeNull();
  });
});

describe("QA2-16: each concept once on the founding card", () => {
  const open = async () => {
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    fireEvent.click(within(section).getByRole("button", { name: /Lead Finance Steward/ }));
    return waitFor(() => {
      const el = section.querySelector('[data-full-role-card="finance"]') as HTMLElement | null;
      if (!el) throw new Error("no card yet");
      return el;
    });
  };
  it("says paid once: the circle alone in the eyebrow, then This is a paid role", async () => {
    const card = await open();
    await waitFor(() => expect(within(card).getByTestId("paid-role-line").textContent).toBe("This is a paid role"));
    expect(card.textContent).not.toMatch(/Paid role/);
    expect(card.querySelector("header p")?.textContent).toBe("Anchor Circle");
  });
  it("says the commitment once when the role's terms name a percent", async () => {
    org.roles[0] = seat("finance", "Lead Finance Steward", { timeCommitment: "Full commitment", card: { ...seat("x", "x").card, commitmentPct: 100 } });
    const card = await open();
    await waitFor(() => expect(card.textContent).toContain("100%"));
    expect(card.textContent).not.toContain("Full commitment");
  });
  it("keeps the written commitment on a card whose terms name no percent (control)", async () => {
    org.roles[0] = seat("finance", "Lead Finance Steward", { timeCommitment: "Full commitment" });
    const card = await open();
    await waitFor(() => expect(card.textContent).toContain("Full commitment"));
  });
});

describe("the two pay lines on the card", () => {
  const open = async () => {
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    fireEvent.click(within(section).getByRole("button", { name: /Lead Finance Steward/ }));
    return section;
  };
  it("ceiling unset: only the split line", async () => {
    roleCard = (id: string) => ({ roleId: id, sections: { ...SECTIONS, payCeiling: null }, lastEdited: null, showPayRanges: false, villagePay: VILLAGE_PAY, mayEdit: false });
    const section = await open();
    await waitFor(() => expect(within(section).getByTestId("pay-split")).toBeTruthy());
    expect(within(section).queryByTestId("pay-ceiling")).toBeNull();
  });
  it("split unset: only the ceiling line, with the footer kept", async () => {
    roleCard = (id: string) => ({ roleId: id, sections: SECTIONS, lastEdited: null, showPayRanges: false, villagePay: { shape: [], atRisk: VILLAGE_PAY.atRisk, note: VILLAGE_PAY.note }, mayEdit: false });
    const section = await open();
    await waitFor(() => expect(within(section).getByTestId("pay-ceiling").textContent).toBe("Listed price: $9,000 a month for the full role*"));
    expect(within(section).queryByTestId("pay-split")).toBeNull();
    expect(within(section).getByTestId("pay-at-risk")).toBeTruthy();
  });
  it("lead, 12 Nov: the 60/40/0 split draws a 0% tile, the asterisk follows the note, and a long label wraps whole", async () => {
    const long = "village credits for the shared commons"; // 38 of the 40 a label may hold
    const village = { shape: [{ label: "cash", pct: 60 }, { label: "equity", pct: 40 }, { label: long, pct: 0 }], atRisk: VILLAGE_PAY.atRisk, note: "*The total shown is the full band available for this role." };
    roleCard = (id: string) => ({ roleId: id, sections: SECTIONS, lastEdited: null, showPayRanges: false, villagePay: village, mayEdit: false });
    const section = await open();
    await waitFor(() => expect(within(section).getByTestId("pay-ceiling").textContent).toBe("Listed price: $9,000 a month for the full role*"));
    const tiles = within(section).getByTestId("pay-tiles");
    expect(Array.from(tiles.querySelectorAll("li")).map((li) => li.textContent)).toEqual(["cash60%", "equity40%", `${long}0%`]);
    expect(within(section).getByTestId("pay-split").textContent).toBe(`Default split: 60% cash, 40% equity, 0% ${long}. To be decided in the onboarding process.`);
    // Never cut with an ellipsis: the label wraps, so no truncate and no line clamp on it.
    for (const label of within(tiles).getAllByTestId("pay-tile-label")) {
      expect(label.className).not.toMatch(/truncate|line-clamp|text-ellipsis/);
      expect(label.className).toContain("break-words");
    }
  });
});

describe("the other ways in, and the words", () => {
  it("offers Propose a new role from the start, and names the conflict steps in the village's words", async () => {
    renderRoles();
    const other = await screen.findByRole("region", { name: "Other ways to join" });
    expect(within(other).getByRole("link", { name: /Propose a new role/ }).getAttribute("href")).toBe("/role-proposals/new");
    expect(screen.getByRole("heading", { name: "How we evolve through conflict" })).toBeTruthy();
    expect(screen.queryByText(/When a Tension Is Between People/)).toBeNull();
  });
});

describe("QA2-07: Founding Seeders and volunteering are named among the other ways in", () => {
  it("offers the resident path and the gifts tile in the platform's words, to the way to stay close and the work-with-us door", async () => {
    renderRoles();
    await screen.findByRole("region", { name: "Join the founding team" });
    const other = screen.getByRole("region", { name: "Other ways to join" });
    expect(within(other).getByRole("link", { name: /Become a Founding Seeder/ }).getAttribute("href")).toBe("/resident");
    expect(within(other).getByText("Live here one day? Start on the resident path.")).toBeTruthy();
    expect(within(other).getByRole("link", { name: /Offer your gifts/ }).getAttribute("href")).toBe("/work-with-us");
    expect(within(other).getByText("Volunteer or work-trade: tell us what you would like to give.")).toBeTruthy();
  });
  it("shows the village's own words and link when it wrote them", async () => {
    founding = { ...founding, otherWays: { seeder: { title: "Join the Friends", line: "Come close first.", href: "/friends" }, gifts: { title: "Give a day", line: "Saturdays in the garden.", href: "/work-with-us" } } };
    renderRoles();
    await screen.findByRole("region", { name: "Join the founding team" });
    const other = screen.getByRole("region", { name: "Other ways to join" });
    expect(within(other).getByRole("link", { name: /Join the Friends/ }).getAttribute("href")).toBe("/friends");
    expect(within(other).getByText("Saturdays in the garden.")).toBeTruthy();
    expect(within(other).queryByText(/Become a Founding Seeder/)).toBeNull();
  });
});

describe("QA2-02: no second step one under the founding team", () => {
  it("leaves the game behind one quiet door inside Other ways to join, with no Step one (design pass D-04, M3)", async () => {
    renderRoles();
    await screen.findByRole("region", { name: "Join the founding team" });
    const other = screen.getByRole("region", { name: "Other ways to join" });
    expect(within(other).getByRole("heading", { name: "Find your place in the game" })).toBeTruthy();
    expect(within(other).getByRole("link", { name: /Explore the game/ }).getAttribute("href")).toBe("/roles/select");
    // The roots live on /roles/select while the founding team leads.
    expect(document.querySelector("[data-archetype-step]")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Step one/i);
  });
  it("keeps Step one as the page's first step while the founding team is off (control)", async () => {
    founding = { on: false, roleIds: [], sections: {}, showPayRanges: false, villagePay: VILLAGE_PAY };
    renderRoles();
    await screen.findByRole("link", { name: /Browse the open roles/ });
    const roots = document.querySelector("[data-archetype-step]") as HTMLElement;
    expect(roots.getAttribute("data-archetype-step")).toBe("step");
    expect(screen.getByRole("region", { name: "Other ways to join" }).contains(roots)).toBe(false);
    expect(screen.queryByRole("heading", { name: "Find your place in the game" })).toBeNull();
  });
});

describe("design pass M1: the founding team leads the page", () => {
  it("opens on the founding team as the page's h1, then Other ways to join, with the page's own header below them", async () => {
    renderRoles();
    const h1 = await screen.findByRole("heading", { level: 1, name: "Join the founding team" });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    // Nothing of the game sits between the founding section and Other ways to join: only the roles opening next.
    const after = h1.closest("[data-founding-team]")?.nextElementSibling;
    expect(after?.matches("[data-opening-next]")).toBe(true);
    expect(after?.nextElementSibling?.matches("[data-other-ways]")).toBe(true);
    const other = screen.getByRole("region", { name: "Other ways to join" });
    const header = await screen.findByRole("heading", { level: 2, name: "Roles and Circles" });
    expect(other.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("keeps the page's own header first while the founding team is off (control)", async () => {
    founding = { on: false, roleIds: [], sections: {}, showPayRanges: false, villagePay: VILLAGE_PAY };
    renderRoles();
    const h1 = await screen.findByRole("heading", { level: 1, name: "Roles and Circles" });
    const other = screen.getByRole("region", { name: "Other ways to join" });
    expect(h1.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("the founding card, piece by piece (Rye, 14 Nov 2026; replaces the D-03 offer rail)", () => {
  const open = async () => {
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    fireEvent.click(within(section).getByRole("button", { name: /Lead Finance Steward/ }));
    return waitFor(() => {
      const el = section.querySelector('[data-full-role-card="finance"]') as HTMLElement | null;
      if (!el) throw new Error("no card yet");
      return el;
    });
  };
  it("keeps the role, its facts and the one act together in the seat column, beside the pieces", async () => {
    org.roles[0] = seat("finance", "Lead Finance Steward", { card: { ...seat("x", "x").card, commitmentPct: 100 } });
    const card = await open();
    const header = card.querySelector("header") as HTMLElement;
    expect(within(header).getByTestId("open-seat").textContent).toBe("Open role");
    expect(within(header).getByTestId("card-facts").textContent).toContain("100%");
    expect(within(header).getByTestId("card-facts").textContent).toContain("Paid contractor");
    // One act: in the seat column on a desktop, riding the bottom of the screen on a phone (jsdom is narrow).
    expect(within(card).getAllByRole("link", { name: /Apply for this role/ })).toHaveLength(1);
    // Each concept once: the details under "How you're chosen" leave out the track the facts say.
    expect(within(card).getByTestId("role-card-params").textContent).not.toContain("Paid contractor");
  });
  it("opens on the purpose, one piece at a time, and steps through the rest", async () => {
    const card = await open();
    const visible = () => Array.from(card.querySelectorAll<HTMLElement>("[data-piece]")).filter((el) => !el.hidden).map((el) => el.dataset.piece);
    expect(visible()).toEqual(["purpose"]);
    fireEvent.click(within(card).getByRole("button", { name: /Next: Looks after/ }));
    expect(visible()).toEqual(["domain"]);
    fireEvent.click(within(card).getByRole("button", { name: "Back" }));
    expect(visible()).toEqual(["purpose"]);
    fireEvent.click(within(card).getByRole("button", { name: /Rewards/ }));
    expect(visible()).toEqual(["rewards"]);
    fireEvent.click(within(card).getByRole("button", { name: "Show every piece" }));
    expect(visible().length).toBeGreaterThan(5);
  });
  it("holds the ceiling, the shares as tiles and the split line in the rewards piece", async () => {
    const card = await open();
    fireEvent.click(within(card).getByRole("button", { name: /Rewards/ }));
    const piece = card.querySelector('[data-piece="rewards"]') as HTMLElement;
    await waitFor(() => expect(within(piece).getByTestId("pay-ceiling").textContent).toBe("Listed price: $9,000 a month for the full role*"));
    expect(within(piece).getByRole("heading", { name: "How rewards work" })).toBeTruthy();
    expect(Array.from(within(piece).getByTestId("pay-tiles").querySelectorAll("li")).map((li) => li.textContent)).toEqual(["cash40%", "equity55%", "village credits5%"]);
    expect(within(piece).getByTestId("pay-split").textContent).toContain("To be decided in the onboarding process.");
  });
  it("a role that can be shared says the range, that the proposal sets the pay, the pay at 50%, and the footnote (Rye, 14 Nov 2026)", async () => {
    org.roles[0] = seat("finance", "Lead Finance Steward", { card: { ...seat("x", "x").card, commitmentMin: 30, commitmentTarget: 100 } });
    const card = await open();
    fireEvent.click(within(card).getByRole("button", { name: /Rewards/ }));
    const piece = card.querySelector('[data-piece="rewards"]') as HTMLElement;
    await waitFor(() => expect(within(piece).getByTestId("pay-ceiling").textContent).toBe("Listed price: $9,000 a month for the full role*"));
    expect(within(piece).getByTestId("pay-range-words").textContent).toBe("Take on all of it, or part of it: we're open to proposals from 30% to 100%. One person can hold the whole role, or a few people can share it.");
    expect(within(piece).getByTestId("pay-proposal-words").textContent).toContain("At 50%, the suggested price is $4,500 a month. You can propose more or less.");
    // The 120% cap (Rye, 15 Nov 2026): for the full role, and at the example share.
    expect(within(piece).getByTestId("pay-cap-words").textContent).toBe("Proposals up to $10,800 a month for the full role, 120% of the listed price. At 50%, up to $5,400 a month.");
    // The footnote (Rye, 15 Nov 2026): the first month with no figure, and the equity and credits clause because the
    // village's split pays 55% in equity and 5% in credits; then the village's own note.
    expect(within(piece).getByTestId("pay-footnote").textContent).toBe(`*At 100% commitment. Your first month often starts lower and follows what you deliver. Equity and credit terms are still being written and are subject to legal review. ${VILLAGE_PAY.note}`);
    // The cap sits beside the listed price, before the range.
    const order = Array.from(piece.querySelectorAll("[data-testid]")).map((e) => e.getAttribute("data-testid"));
    expect(order.indexOf("pay-cap-words")).toBe(order.indexOf("pay-ceiling") + 1);
    // One footnote (copy sweep): the village's own note is not drawn beside it.
    expect(within(piece).queryByTestId("pay-note")).toBeNull();
    expect(piece.textContent).not.toContain("full band");
    expect(piece.textContent).not.toContain("value in, value out");
    expect(within(card.querySelector("header") as HTMLElement).getByTestId("card-facts").textContent).toContain("Full or part commitment (from 30%)");
  });
  it("a role offered whole says nothing about sharing (control)", async () => {
    const card = await open();
    fireEvent.click(within(card).getByRole("button", { name: /Rewards/ }));
    const piece = card.querySelector('[data-piece="rewards"]') as HTMLElement;
    await waitFor(() => expect(within(piece).getByTestId("pay-ceiling")).toBeTruthy());
    expect(within(piece).queryByTestId("pay-range-words")).toBeNull();
    expect(within(piece).getByTestId("pay-proposal-words").textContent).not.toContain("At ");
    expect(within(piece).getByTestId("pay-cap-words").textContent).toBe("Proposals up to $10,800 a month, 120% of the listed price.");
  });
  it("shows only the split when no ceiling is written", async () => {
    roleCard = (id: string) => ({ roleId: id, sections: { ...SECTIONS, payCeiling: null }, lastEdited: null, showPayRanges: false, villagePay: VILLAGE_PAY, mayEdit: false });
    const card = await open();
    await waitFor(() => expect(within(card).getByTestId("pay-split")).toBeTruthy());
    expect(within(card).queryByTestId("pay-ceiling")).toBeNull();
  });
  it("splits a domain written as a list into its parts and a 'Lead: rest' line into a titled tile, word for word", async () => {
    org.roles[0] = seat("finance", "Lead Finance Steward", { domain: "The money: the model; the books; and the close.", accountabilities: ["Payment flows: reconcile the two channels", "Keep the books"] });
    const card = await open();
    const domain = within(card).getByTestId("words-domain");
    expect(Array.from(domain.querySelectorAll("li")).map((li) => li.textContent)).toEqual(["The model", "The books", "The close"]);
    const tiles = within(card).getByTestId("words-accountabilities");
    expect(Array.from(tiles.querySelectorAll("li")).map((li) => li.textContent)).toEqual(["Payment flowsreconcile the two channels", "Keep the books"]);
  });
});

describe("the founding team as positions (Rye, 14 Nov 2026: team sheet by default, formation on request)", () => {
  it("opens on the team sheet: the open roles, then the circle's filled roles as Role (FirstName)", async () => {
    org.roles.push(seat("ops", "Human Operations Steward", { state: "filled", holderCount: 1, holders: [{ name: "Rye Cordon" }] }));
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    const sheet = await within(section).findByTestId("team-sheet");
    expect(within(section).getByRole("button", { name: "Team sheet" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(sheet).getAllByText("Open role")).toHaveLength(2);
    await waitFor(() => expect(within(sheet).getByTestId("filled-roles").textContent).toContain("Human Operations Steward (Rye)"));
    // Positions, never players: no rating, score or rank anywhere in the team view.
    expect(section.textContent).not.toMatch(/rating|score|rank/i);
  });
  it("shows anyone the current team the server sends, unlisted roles included, as Role (FirstName) (Rye, 14 Nov 2026)", async () => {
    founding = { ...founding, team: [{ id: "facilitator", name: "Governance Facilitator", holders: ["Rye"] }] };
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    await waitFor(() => expect(within(section).getByTestId("filled-roles").textContent).toContain("Governance Facilitator (Rye)"));
    // The directory never lists it: it is the team, not a role to apply for.
    expect(screen.queryByRole("heading", { level: 3, name: "Governance Facilitator" })).toBeNull();
  });

  it("shows how full each open role is: held and open, and covered past 100% (Rye, 14 Nov 2026)", async () => {
    founding = { ...founding, fill: { finance: { heldPct: 50, targetPct: 100, openPct: 50, covered: false }, land: { heldPct: 120, targetPct: 100, openPct: 0, covered: true } } };
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    const sheet = await within(section).findByTestId("team-sheet");
    await waitFor(() => expect(Array.from(sheet.querySelectorAll("[data-fill-meter]")).map((m) => m.textContent)).toEqual(["120% held · covered", "50% held · 50% open"]));
    fireEvent.click(within(section).getByRole("button", { name: "Formation" }));
    expect(within(section).getByTestId("formation").querySelectorAll("[data-fill-meter]")).toHaveLength(2);
  });

  it("a role one named person holds says covered or open, never their share (security sweep L3)", async () => {
    founding = { ...founding, fill: { finance: { coarse: true, targetPct: 100, covered: false }, land: { coarse: true, targetPct: 100, covered: true } } as any };
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    const sheet = await within(section).findByTestId("team-sheet");
    await waitFor(() => expect(Array.from(sheet.querySelectorAll("[data-fill-meter]")).map((m) => m.textContent)).toEqual(["Covered", "Held, still open"]));
    expect(sheet.textContent).not.toMatch(/\d+% held/);
  });

  it("names no holder to a reader the village shows no names to (control: the role still shows, filled)", async () => {
    org.roles.push(seat("ops", "Human Operations Steward", { state: "filled", holderCount: 1, holders: [] }));
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    const filled = await within(section).findByTestId("filled-roles");
    expect(filled.textContent).toContain("Human Operations Steward");
    expect(filled.textContent).not.toContain("(");
  });
  it("one circle, domains not sub-circles: each open role shows the domains it holds, in both views (Rye, 14 Nov 2026)", async () => {
    org.roles[0] = seat("finance", "Lead Finance Steward", { domain: "The whole financial picture: the financial model and its change log; tax and entity questions, with legal; and, as the circle grows, a bookkeeper." });
    // A circle grown from a lead in the chart draws nothing here.
    org.circles.push({ id: "events", name: "Events circle", purpose: "", status: "forming", grownFromOrgRoleId: "land" });
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    const sheet = await within(section).findByTestId("team-sheet");
    const held = () => Array.from(section.querySelectorAll("[data-domains-held] li")).map((li) => li.textContent);
    expect(held()).toEqual(["The financial model and its change log", "Tax and entity questions, with legal"]);
    expect(sheet.textContent).toContain("Domains they hold");
    fireEvent.click(within(section).getByRole("button", { name: "Formation" }));
    const formation = within(section).getByTestId("formation");
    expect(held()).toEqual(["The financial model and its change log", "Tax and entity questions, with legal"]);
    // Nothing implies hiring or building a circle.
    expect(section.textContent).not.toMatch(/Events circle|circles? (they|it) will grow|circles to grow|Grows/i);
    // Choosing a lead opens its card below, piece by piece.
    fireEvent.click(within(formation).getByRole("button", { name: /Lead Finance Steward/ }));
    await waitFor(() => expect(section.querySelector('[data-full-role-card="finance"]')).toBeTruthy());
  });
  it("remembers the reader's choice of view on this device, and opens on the team sheet otherwise", async () => {
    renderRoles();
    let section = await screen.findByRole("region", { name: "Join the founding team" });
    fireEvent.click(within(section).getByRole("button", { name: "Formation" }));
    cleanup();
    renderRoles();
    section = await screen.findByRole("region", { name: "Join the founding team" });
    expect(within(section).getByRole("button", { name: "Formation" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("a role whose domain is prose shows no domain chips (control: nothing invented)", async () => {
    renderRoles();
    const section = await screen.findByRole("region", { name: "Join the founding team" });
    await within(section).findByTestId("team-sheet");
    expect(section.querySelector("[data-domains-held]")).toBeNull();
  });
});

describe("verify 2.2: the admin view", () => {
  it("a steward sees what a visitor sees, and the unlisted roles behind one switch", async () => {
    founding = { on: false, roleIds: [], sections: {}, showPayRanges: false, villagePay: VILLAGE_PAY };
    org.roles = [seat("finance", "Lead Finance Steward"), seat("ai-secretary", "AI Secretary", { listed: false }), seat("old", "Old Role", { listed: false })];
    renderRoles();
    fireEvent.click(await screen.findByRole("button", { name: "See all roles" }));
    await screen.findByRole("heading", { level: 3, name: "Lead Finance Steward" });
    expect(screen.queryByRole("heading", { level: 3, name: "AI Secretary" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Show the 2 roles visitors do not see/ }));
    expect(await screen.findByRole("heading", { level: 3, name: "AI Secretary" })).toBeTruthy();
  });

  it("a visitor has no switch, because the server sends no unlisted role (control)", async () => {
    founding = { on: false, roleIds: [], sections: {}, showPayRanges: false, villagePay: VILLAGE_PAY };
    renderRoles();
    fireEvent.click(await screen.findByRole("button", { name: "See all roles" }));
    await screen.findByRole("heading", { level: 3, name: "Lead Finance Steward" });
    expect(screen.queryByRole("checkbox", { name: /roles visitors do not see/ })).toBeNull();
  });
});

describe("a founding team that would not load (performance QA sweep, resilience P2-6)", () => {
  it("says so with a way to ask again, instead of silently dropping the founding team", async () => {
    let tries = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
        if (u === "/api/org") return reply(org);
        if (u === "/api/org/founding-team") {
          tries += 1;
          return tries === 1 ? reply({ error: "boom" }, 500) : reply(founding);
        }
        if (u === "/api/season") return reply({ current: null });
        return reply([], 404);
      }),
    );
    renderRoles();
    expect(await screen.findByText("We couldn't load the founding team just now.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Join the founding team" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("region", { name: "Join the founding team" })).toBeTruthy();
    expect(screen.queryByText("We couldn't load the founding team just now.")).toBeNull();
    expect(tries).toBe(2);
  });

  it("shows a loading line while the founding team is on its way, and no notice for a team that is simply off (control)", async () => {
    let answer: (v: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
        if (u === "/api/org") return reply(org);
        if (u === "/api/org/founding-team") return new Promise((done) => { answer = () => done(reply({ on: false, roleIds: [] })); });
        if (u === "/api/season") return reply({ current: null });
        return reply([], 404);
      }),
    );
    renderRoles();
    const status = document.querySelector("[data-founding-status]") as HTMLElement;
    await waitFor(() => expect(status.textContent).toContain("Loading roles"));
    await act(async () => answer(null));
    await waitFor(() => expect(status.textContent).toBe(""));
    expect(screen.queryByText("We couldn't load the founding team just now.")).toBeNull();
  });
});
