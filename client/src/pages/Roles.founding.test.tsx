// @vitest-environment jsdom
/**
 * PHASE A, LANE A3: the Roles and Circles page with "Join the founding team"
 * at the top, the full card in the founding register, and the admin view.
 * Since the /roles index (20 Nov 2026) the full card is read on the role's own
 * page, `/roles/<slug>`, so the card's tests render that page; the index's own
 * tests (groups, counts, the card's anatomy, old links) are Roles.index.test.tsx.
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
import RoleShare from "./RoleShare";

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
/** A role's full card lives on its own page since the /roles index (20 Nov 2026): `/roles/<id>` opens it. */
const renderRole = (id = "finance") => {
  window.history.replaceState(null, "", `/roles/${id}`);
  return render(
    <Router>
      <RoleShare />
    </Router>,
  );
};

describe("Join the founding team", () => {
  it("opens a full card with the founding sections, the village's pay shape and no range, and one Apply act", async () => {
    renderRole();
    const section = document.body;
    const card = await waitFor(() => {
      const el = section.querySelector('[data-full-role-card="finance"]') as HTMLElement | null;
      if (!el) throw new Error("no card yet");
      return el;
    });
    await waitFor(() => expect(within(card).getByTestId("last-edited").textContent).toBe("Last edited by Mara on 11 November 2026"));
    // Piece by piece (Rye, 14 Nov): every piece is in the page, and one button opens them all.
    fireEvent.click(within(card).getByRole("button", { name: "Show every piece" }));
    expect(within(card).getByTestId("paid-role-line").textContent).toBe("This role is rewarded");
    expect(within(card).getByRole("heading", { name: "Ideal background" })).toBeTruthy();
    expect(within(card).getByRole("heading", { name: "Qualities we're looking for" })).toBeTruthy();
    // QA2-09: "Digital Companion" (capitalised) replaces the AI wording.
    expect(within(card).getByRole("heading", { name: "Digital Companion" })).toBeTruthy();
    expect(card.textContent).not.toMatch(/AI support/);
    expect(card.textContent).toContain("Heron");
    // Everything the editor holds: the words under the editor's own headings.
    // The lead, 19 Nov 2026: "What {village} needs from you", Deliverables, Rhythm, and what goes to the circle for consent.
    for (const h of [/^What .+ needs from you$/, "What I look after", "What I can decide on my own", "What you can count on me for", "Rhythm", "Bring me", "Goes to the Anchor Circle", "Holding this role well"]) {
      expect(within(card).getByRole("heading", { name: h })).toBeTruthy();
    }
    expect(within(card).queryByRole("heading", { name: "Why it matters" })).toBeNull();
    const pay = within(card).getByTestId("pay-shape");
    expect(within(pay).getByTestId("pay-ceiling").textContent).toBe("Listed price: $9,000 a month for the full role*");
    expect(within(pay).getByTestId("pay-split").textContent).toBe("Default split: 40% cash, 55% Contribution tokens, 5% Credits. To be decided in the onboarding process.");
    expect(within(pay).getByTestId("pay-at-risk").textContent).toBe(VILLAGE_PAY.atRisk);
    // One footnote: the ceiling's own, so the village's note is not drawn again (copy sweep, 15 Nov 2026).
    expect(within(pay).queryByTestId("pay-note")).toBeNull();
    expect(within(pay).getByTestId("pay-footnote")).toBeTruthy();
    // The split is said once: the tiles show it, and its words stay for screen readers.
    expect(within(pay).getByTestId("pay-split").querySelector(".sr-only")?.textContent).toBe("Default split: 40% cash, 55% Contribution tokens, 5% Credits. ");
    // RANGES AND MINIMUMS STAY HIDDEN, even when an older payload still carries one.
    expect(card.textContent).not.toContain("6,750");
    expect(card.textContent).not.toContain("6750");
    expect(card.textContent).not.toContain(RANGE_NOTE);
    expect(within(pay).queryByTestId("pay-band")).toBeNull();
    // The callout shows wherever the piece shows pay, ranges hidden or not.
    // Loaded lazily, off the route's first view (guard-route-first-views).
    expect((await within(pay).findByTestId("value-callout")).textContent).toContain("Value in equals value out.");
    const apply = within(card).getAllByRole("link", { name: /Apply for this role/ });
    expect(apply).toHaveLength(1);
    expect(apply[0].getAttribute("href")).toBe("/propose-a-role?role=finance");
    // Read-only: no editor door for a visitor.
    expect(within(card).queryByRole("button", { name: "Edit this role" })).toBeNull();
  });

  it("CONTROL for the hidden range: a village that shows ranges draws the range on the same card", async () => {
    roleCard = (id: string) => ({ roleId: id, sections: SECTIONS, lastEdited: null, showPayRanges: true, villagePay: VILLAGE_PAY, mayEdit: false });
    renderRole();
    const section = document.body;
    // The band, one line under the listed price, with the price and the cap kept as they are.
    const pay = await within(section).findByTestId("pay-shape");
    await within(pay).findByTestId("pay-band");
    // Said once (the lead, 19 Nov 2026): the pay piece says it, so "What it pays" under How you're chosen does not repeat it.
    expect(within(section).queryByTestId("public-pay")).toBeNull();
    await within(pay).findByTestId("value-callout");
    const lines = Array.from(pay.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid"));
    // No cap line (lead, 17 Nov 2026): the listed price is the high end the card shows.
    expect(lines).not.toContain("pay-cap-words");
    expect(pay.textContent).not.toContain("Proposals up to");
    expect(within(pay).getByTestId("pay-band").textContent).toBe("Band: $6,750 to $9,000 a month in total comp");
    // The callout sits under the price and the band, with its explainer closed until asked (lead, 17 Nov 2026).
    expect(lines.slice(0, 3)).toEqual(["pay-ceiling", "pay-band", "value-callout"]);
    fireEvent.click(within(pay).getByTestId("value-explainer-open"));
    const explainer = within(pay).getByTestId("value-explainer");
    expect(explainer.textContent).toContain("Your agreement");
    expect(explainer.textContent).toContain("Proposals can go up to 120%");
    // No 120% money amount on the card: 120% of $9,000 is $10,800.
    expect(section.textContent).not.toContain("$10,800");
    expect(within(pay).getByTestId("pay-ceiling").textContent).toBe("Listed price: $9,000 a month for the full role*");
  });

  it("a card that writes its own shares shows those in place of the village's", async () => {
    roleCard = (id: string) => ({ roleId: id, sections: { ...SECTIONS, payShape: [{ label: "cash", pct: 70 }, { label: "equity", pct: 30 }], payNote: "This role's own note." }, lastEdited: null, showPayRanges: false, villagePay: VILLAGE_PAY, mayEdit: false });
    renderRole();
    const section = document.body;
    await waitFor(() => expect(within(section).getByTestId("pay-split").textContent).toContain("70% cash, 30% Contribution tokens"));
    expect(within(section).getByTestId("pay-shape").textContent).not.toContain("55%");
    // With a listed price, the card's own note is the footnote's fine print (steelman, 15 Nov 2026).
    expect(within(section).getByTestId("pay-footnote").textContent).toBe("*At 100% commitment. Your first moon starts lower and follows what you deliver. Terms for Contribution tokens and Credits are still being written and are subject to legal review. This role's own note.");
    expect(within(section).queryByTestId("pay-note")).toBeNull();
  });
});

describe("QA2-16: each concept once on the founding card", () => {
  const open = async () => {
    renderRole();
    const section = document.body;
    return waitFor(() => {
      const el = section.querySelector('[data-full-role-card="finance"]') as HTMLElement | null;
      if (!el) throw new Error("no card yet");
      return el;
    });
  };
  it("says paid once: the circle alone in the eyebrow, then This role is rewarded", async () => {
    const card = await open();
    await waitFor(() => expect(within(card).getByTestId("paid-role-line").textContent).toBe("This role is rewarded"));
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
    renderRole();
    const section = document.body;
    return section;
  };
  it("ceiling unset: only the split line", async () => {
    roleCard = (id: string) => ({ roleId: id, sections: { ...SECTIONS, payCeiling: null }, lastEdited: null, showPayRanges: false, villagePay: VILLAGE_PAY, mayEdit: false });
    // The role's own page hands the card the founding team's sections and pay, so the fixture says the same there.
    founding = { ...founding, sections: { finance: { ...SECTIONS, payCeiling: null } } };
    const section = await open();
    await waitFor(() => expect(within(section).getByTestId("pay-split")).toBeTruthy());
    expect(within(section).queryByTestId("pay-ceiling")).toBeNull();
  });
  it("split unset: only the ceiling line, with the footer kept", async () => {
    roleCard = (id: string) => ({ roleId: id, sections: SECTIONS, lastEdited: null, showPayRanges: false, villagePay: { shape: [], atRisk: VILLAGE_PAY.atRisk, note: VILLAGE_PAY.note }, mayEdit: false });
    founding = { ...founding, villagePay: { shape: [], atRisk: VILLAGE_PAY.atRisk, note: VILLAGE_PAY.note } };
    const section = await open();
    await waitFor(() => expect(within(section).getByTestId("pay-ceiling").textContent).toBe("Listed price: $9,000 a month for the full role*"));
    expect(within(section).queryByTestId("pay-split")).toBeNull();
    expect(within(section).getByTestId("pay-at-risk")).toBeTruthy();
  });
  it("lead, 12 Nov: the 60/40/0 split shows its 0% share, the asterisk follows the note, and a long label wraps whole (read in the editable split since 18 Nov)", async () => {
    const long = "village credits for the shared commons"; // 38 of the 40 a label may hold
    const village = { shape: [{ label: "cash", pct: 60 }, { label: "equity", pct: 40 }, { label: long, pct: 0 }], atRisk: VILLAGE_PAY.atRisk, note: "*The total shown is the full band available for this role." };
    roleCard = (id: string) => ({ roleId: id, sections: SECTIONS, lastEdited: null, showPayRanges: false, villagePay: village, mayEdit: false });
    const section = await open();
    await waitFor(() => expect(within(section).getByTestId("pay-ceiling").textContent).toBe("Listed price: $9,000 a month for the full role*"));
    // The editable split is the one place the shares read (the lead, 18 Nov 2026): no tiles beside it.
    expect(within(section).queryByTestId("pay-tiles")).toBeNull();
    const rowsNow = () => Array.from(section.querySelectorAll<HTMLElement>("[data-split-share]"));
    await waitFor(() => expect(rowsNow().map((r) => [r.getAttribute("data-split-share"), (r.querySelector("[data-split-pct]") as HTMLInputElement).value])).toEqual([["cash", "60"], ["equity", "40"], [long, "0"]]));
    const rows = rowsNow();
    expect(within(section).getByTestId("pay-split").textContent).toBe(`Default split: 60% cash, 40% Contribution tokens, 0% ${long}. To be decided in the onboarding process.`);
    // Never cut with an ellipsis: the label wraps, so no truncate and no line clamp on it.
    const label = rows[2].querySelector("span") as HTMLElement;
    expect(label.textContent).toBe(long);
    expect(label.className).not.toMatch(/truncate|line-clamp|text-ellipsis/);
    expect(label.className).toContain("break-words");
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
    await screen.findByRole("heading", { level: 1, name: "Join the founding team" });
    const other = screen.getByRole("region", { name: "Other ways to join" });
    expect(within(other).getByRole("link", { name: /Become a Founding Seeder/ }).getAttribute("href")).toBe("/resident");
    expect(within(other).getByText("Live here one day? Start on the resident path.")).toBeTruthy();
    expect(within(other).getByRole("link", { name: /Offer your gifts/ }).getAttribute("href")).toBe("/work-with-us");
    expect(within(other).getByText("Volunteer or work-trade: tell us what you would like to give.")).toBeTruthy();
  });
  it("shows the village's own words and link when it wrote them", async () => {
    founding = { ...founding, otherWays: { seeder: { title: "Join the Friends", line: "Come close first.", href: "/friends" }, gifts: { title: "Give a day", line: "Saturdays in the garden.", href: "/work-with-us" } } };
    renderRoles();
    await screen.findByRole("heading", { level: 1, name: "Join the founding team" });
    const other = screen.getByRole("region", { name: "Other ways to join" });
    expect(within(other).getByRole("link", { name: /Join the Friends/ }).getAttribute("href")).toBe("/friends");
    expect(within(other).getByText("Saturdays in the garden.")).toBeTruthy();
    expect(within(other).queryByText(/Become a Founding Seeder/)).toBeNull();
  });
});

describe("QA2-02: no second step one under the founding team", () => {
  it("leaves the game behind one quiet door inside Other ways to join, with no Step one (design pass D-04, M3)", async () => {
    renderRoles();
    await screen.findByRole("heading", { level: 1, name: "Join the founding team" });
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

describe("the founding card, piece by piece (Rye, 14 Nov 2026; replaces the D-03 offer rail)", () => {
  const open = async () => {
    renderRole();
    const section = document.body;
    return waitFor(() => {
      const el = section.querySelector('[data-full-role-card="finance"]') as HTMLElement | null;
      if (!el) throw new Error("no card yet");
      return el;
    });
  };
  it("keeps the role and its facts in the seat column, the commitment and where among them as the one-minute summary says them", async () => {
    org.roles[0] = seat("finance", "Lead Finance Steward", { card: { ...seat("x", "x").card, commitmentPct: 100, whereWorked: "both" } });
    const card = await open();
    const header = card.querySelector("header") as HTMLElement;
    expect(within(header).getByTestId("open-seat").textContent).toBe("Open role");
    expect(within(header).getByTestId("card-facts").textContent).toContain("Paid contractor");
    // The commitment is back in the seat column as a tile (the Amora operations role, 20 Nov 2026, reversing 1.3.38's
    // "said once" on purpose), and it is the very line "The role in one minute" draws: one source, said the same.
    const tile = Array.from(within(header).getByTestId("card-facts").querySelectorAll("div")).find((d) => d.querySelector("dt")?.textContent === "Commitment");
    expect(tile?.querySelector("dd")?.textContent).toBe("100%");
    expect(card.querySelector('[data-one-minute-fact="commitment"] dd')?.textContent).toBe(tile?.querySelector("dd")?.textContent);
    const where = Array.from(within(header).getByTestId("card-facts").querySelectorAll("div")).find((d) => d.querySelector("dt")?.textContent === "Where");
    expect(where?.querySelector("dd")?.textContent).toBe("On the land or remote");
    expect(card.querySelector('[data-one-minute-fact="where"] dd')?.textContent).toBe("On the land or remote");
    // One act: in the seat column on a desktop, riding the bottom of the screen on a phone (jsdom is narrow).
    expect(within(card).getAllByRole("link", { name: /Apply for this role/ })).toHaveLength(1);
    // Each concept once: the details under "How you're chosen" leave out the track the facts say.
    expect(within(card).getByTestId("role-card-params").textContent).not.toContain("Paid contractor");
  });
  it("opens on the purpose, one piece at a time, and steps through the rest", async () => {
    const card = await open();
    const visible = () => Array.from(card.querySelectorAll<HTMLElement>("[data-piece]")).filter((el) => !el.hidden).map((el) => el.dataset.piece);
    // Five tabs (the lead, 20 Nov 2026): The role opens Purpose and Looks after together.
    const tabs = Array.from(card.querySelectorAll<HTMLElement>("[data-piece-tab]")).map((b) => b.textContent);
    expect(tabs).toEqual(["The role", "Deliverables", "How we work", "You and rewards", "The path in"]);
    expect(visible()).toEqual(["purpose", "domain"]);
    fireEvent.click(within(card).getByRole("button", { name: /Next: Deliverables/ }));
    expect(visible()).toEqual(["accountabilities"]);
    fireEvent.click(within(card).getByRole("button", { name: "Back" }));
    expect(visible()).toEqual(["purpose", "domain"]);
    fireEvent.click(within(card).getByRole("button", { name: /You and rewards/ }));
    expect(visible()).toEqual(["who", "rewards"]);
    fireEvent.click(within(card).getByRole("button", { name: "Show every piece" }));
    expect(visible().length).toBeGreaterThan(5);
  });
  it("holds the ceiling, the shares in the editable split and the split line in the rewards piece", async () => {
    const card = await open();
    fireEvent.click(within(card).getByRole("button", { name: /You and rewards/ }));
    const piece = card.querySelector('[data-piece="rewards"]') as HTMLElement;
    await waitFor(() => expect(within(piece).getByTestId("pay-ceiling").textContent).toBe("Listed price: $9,000 a month for the full role*"));
    expect(within(piece).getByRole("heading", { name: "How rewards work" })).toBeTruthy();
    // The editable split reads the shares; no tiles beside it (the lead, 18 Nov 2026).
    expect(within(piece).queryByTestId("pay-tiles")).toBeNull();
    await waitFor(() => expect(Array.from(piece.querySelectorAll<HTMLInputElement>("[data-split-pct]")).map((i) => `${i.getAttribute("data-split-pct")}${i.value}%`)).toEqual(["cash40%", "equity55%", "village credits5%"]));
    expect(within(piece).getByTestId("pay-split").textContent).toContain("To be decided in the onboarding process.");
  });
  it("a role that can be shared says the range, that the proposal sets the pay, the pay at 50%, and the footnote (Rye, 14 Nov 2026)", async () => {
    org.roles[0] = seat("finance", "Lead Finance Steward", { card: { ...seat("x", "x").card, commitmentMin: 30, commitmentTarget: 100 } });
    const card = await open();
    fireEvent.click(within(card).getByRole("button", { name: /You and rewards/ }));
    const piece = card.querySelector('[data-piece="rewards"]') as HTMLElement;
    await waitFor(() => expect(within(piece).getByTestId("pay-ceiling").textContent).toBe("Listed price: $9,000 a month for the full role*"));
    expect(within(piece).getByTestId("pay-range-words").textContent).toBe("Take on all of it, or part of it: we're open to proposals from 30% to 100%. One person can hold the whole role, or a few people can share it.");
    // The example follows the card's slider (production check, 18 Nov 2026): none at 100%, the price at 50% once slid there.
    expect(within(piece).getByTestId("pay-proposal-words").textContent).not.toContain("suggested price is");
    fireEvent.change(await within(piece).findByLabelText("Your commitment"), { target: { value: "50" } });
    await waitFor(() => expect(within(piece).getByTestId("pay-proposal-words").textContent).toContain("At 50%, the suggested price is $4,500 a month. You can propose more or less."));
    // No cap line (lead, 17 Nov 2026): the 120% cap is a backend rule, never drawn on the card.
    expect(within(piece).queryByTestId("pay-cap-words")).toBeNull();
    expect(piece.textContent).not.toContain("Proposals up to");
    expect(piece.textContent).not.toContain("120%");
    expect(piece.textContent).not.toContain("$5,400");
    expect(piece.textContent).not.toContain("$10,800");
    // The footnote (Rye, 15 Nov 2026): the first month with no figure, and the equity and credits clause because the
    // village's split pays 55% in equity and 5% in credits; then the village's own note.
    expect(within(piece).getByTestId("pay-footnote").textContent).toBe(`*At 100% commitment. Your first moon starts lower and follows what you deliver. Terms for Contribution tokens and Credits are still being written and are subject to legal review. Indicative only.`);
    // One footnote (production check of 1.3.24): the village note's own equity and credit line is not said twice.
    // One footnote (copy sweep): the village's own note is not drawn beside it.
    expect(within(piece).queryByTestId("pay-note")).toBeNull();
    expect(piece.textContent).not.toContain("full band");
    expect(piece.textContent).not.toContain("value in, value out");
    expect(card.querySelector('[data-one-minute-fact="commitment"]')?.textContent).toContain("Full or part commitment (from 30%)");
  });
  it("a role offered whole says nothing about sharing (control)", async () => {
    const card = await open();
    fireEvent.click(within(card).getByRole("button", { name: /You and rewards/ }));
    const piece = card.querySelector('[data-piece="rewards"]') as HTMLElement;
    await waitFor(() => expect(within(piece).getByTestId("pay-ceiling")).toBeTruthy());
    expect(within(piece).queryByTestId("pay-range-words")).toBeNull();
    expect(within(piece).getByTestId("pay-proposal-words").textContent).not.toContain("At ");
    expect(within(piece).queryByTestId("pay-cap-words")).toBeNull();
    expect(piece.textContent).not.toContain("Proposals up to");
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

describe("verify 2.2: the admin view", () => {
  it("a steward sees what a visitor sees, and the unlisted roles behind one switch", async () => {
    founding = { on: false, roleIds: [], sections: {}, showPayRanges: false, villagePay: VILLAGE_PAY };
    org.roles = [seat("finance", "Lead Finance Steward"), seat("ai-secretary", "AI Secretary", { listed: false }), seat("old", "Old Role", { listed: false })];
    renderRoles();
    await screen.findByRole("heading", { level: 3, name: "Lead Finance Steward" });
    expect(screen.queryByRole("heading", { level: 3, name: "AI Secretary" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Show the 2 roles visitors do not see/ }));
    expect(await screen.findByRole("heading", { level: 3, name: "AI Secretary" })).toBeTruthy();
  });

  it("a visitor has no switch, because the server sends no unlisted role (control)", async () => {
    founding = { on: false, roleIds: [], sections: {}, showPayRanges: false, villagePay: VILLAGE_PAY };
    renderRoles();
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
    expect(screen.queryByRole("heading", { level: 1, name: "Join the founding team" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Join the founding team" })).toBeTruthy();
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
