// @vitest-environment jsdom
/**
 * /roles AS AN INDEX OF ROLE CARDS (the lead, 20 Nov 2026: "redesign /roles so roles are easy to tell apart").
 *
 *   1. GROUPS WITH COUNTS: "Open roles (n)", "Open ventures (n)", "Upcoming roles (n)", read from the row's own flags
 *      (`comingSoon`, `futureVenture`), the founding team first in the village's order, each role once.
 *   2. ONE ANATOMY: every card has a badge, the title as a link to its own page, a one-line purpose, the circle,
 *      commitment and place tags, the held/open bar, "Read the role" and Apply. Nothing expands inline, and no
 *      control sits inside another.
 *   3. APPLY LANDS IN THAT ROLE'S FORM: `/propose-a-role?role=<id>`; a coming-soon card keeps Join the waitlist and Apply early;
 *      a venture's act says "Bring your venture", into the same form.
 *   4. A STEWARD'S CHILDREN are one line inside its card, each a link to the child's page.
 *   5. OLD LINKS (`?seat=`, `?role=`, `#<id>`, `#role-<id>`, `#<slug>`) become the role's page; `#waitlist-<id>` still
 *      opens that card's waitlist here; a link to a role that is gone says so in one line.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/SeatClaimCard", () => ({ default: () => null }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, token: null, loading: false }),
  useIsAdmin: () => false,
  useOptionalAuth: () => ({ user: null }),
}));
vi.mock("@/modules/ModuleProvider", () => ({ useModule: () => undefined, useModuleOn: () => false }));
vi.mock("@/components/natural/useReducedMotion", () => ({ useReducedMotion: () => true, prefersReducedMotion: () => true }));

import Roles, { roleForOldLink } from "./Roles";

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const seat = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  circleId: "anchor",
  aim: `Hold all things ${name.toLowerCase()}.`,
  domain: "The whole domain",
  accountabilities: ["Keep it true"],
  seats: 1,
  holderCount: 0,
  state: "open",
  recruiting: true,
  archetypes: [],
  isExample: false,
  holders: [],
  timeCommitment: "Full time",
  card: { complete: true, missing: [], written: 11, of: 11, gated: false, whereWorked: "both", commitmentPct: 100 },
  ...over,
});

let org: any;
let founding: any;

beforeEach(() => {
  window.history.replaceState(null, "", "/roles");
  vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
  Element.prototype.scrollIntoView = vi.fn();
  org = {
    people: { visible: true, membersOnly: false, signedIn: false },
    circles: [
      { id: "anchor", name: "Anchor Circle", purpose: "", status: "active" },
      { id: "money", name: "Money Circle", purpose: "", status: "active", leadRoleId: "finance" },
    ],
    roles: [
      seat("finance", "Lead Finance Steward"),
      seat("land", "Land Steward"),
      seat("cook", "Village Cook", { card: { complete: true, missing: [], written: 11, of: 11, gated: false, whereWorked: "land", commitmentMin: 30 } }),
      seat("dev", "Development Steward", { circleId: "money", comingSoon: true, state: "forming" }),
      seat("perma", "Permaculture Steward", { circleId: "money", comingSoon: true, state: "forming" }),
      seat("guest", "Guest House Venture Steward", { futureVenture: true, state: "forming" }),
      seat("ops", "Operations Steward", { state: "filled", holderCount: 1, holders: [{ name: "Rye Ashby" }], recruiting: false }),
      seat("demo", "Demonstration Seat", { isExample: true }),
    ],
  };
  founding = { on: true, roleIds: ["land", "finance"], sections: {}, showPayRanges: false, villagePay: { shape: [], atRisk: "", note: "" }, fill: { finance: { heldPct: 50, targetPct: 100, openPct: 50, covered: false } } };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const u = String(url);
      const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
      if (u === "/api/org") return reply(org);
      if (u === "/api/org/founding-team") return reply(founding);
      if (u === "/api/season") return reply({ current: null });
      return reply([], 404);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const renderRoles = (at = "/roles") => {
  window.history.replaceState(null, "", at);
  return render(
    <Router>
      <Roles />
    </Router>,
  );
};
const cardIds = (root: ParentNode) => Array.from(root.querySelectorAll("[data-role-card]")).map((el) => el.getAttribute("data-role-card"));
const card = (id: string) => document.querySelector(`[data-role-card="${id}"]`) as HTMLElement;

describe("the groups and their counts", () => {
  it("puts each role in one group by its own flags, the founding team first in its order, each role once", async () => {
    renderRoles();
    const open = (await screen.findByRole("heading", { level: 2, name: "Open roles (3)" })).closest("section") as HTMLElement;
    expect(cardIds(open)).toEqual(["land", "finance", "cook"]);
    const soon = screen.getByRole("heading", { level: 2, name: "Upcoming roles (2)" }).closest("section") as HTMLElement;
    expect(cardIds(soon)).toEqual(["dev", "perma"]);
    const ventures = screen.getByRole("heading", { level: 2, name: "Open ventures (1)" }).closest("section") as HTMLElement;
    expect(cardIds(ventures)).toEqual(["guest"]);
    // Document order (the lead, 20 Nov 2026): open roles, then open ventures, then the roles still to come.
    expect(open.compareDocumentPosition(ventures) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ventures.compareDocumentPosition(soon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The second and third groups each open on a break, so the three read as chapters.
    for (const s of [ventures, soon]) expect(s.className).toContain("border-t-2");
    expect(open.className).not.toContain("border-t-2");
    // Each role once, the held role on no card and no demonstration seat at all.
    const all = cardIds(document);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain("ops");
    expect(all).not.toContain("demo");
  });

  it("with no venture flagged, Open ventures still stands above the upcoming roles and says so honestly", async () => {
    org.roles = org.roles.filter((r: any) => r.id !== "guest");
    renderRoles();
    const ventures = (await screen.findByRole("heading", { level: 2, name: "Open ventures (0)" })).closest("section") as HTMLElement;
    expect(ventures.querySelector("[data-role-card]")).toBeNull();
    expect(ventures.querySelector("[data-ventures-none]")?.textContent).toContain("No venture is open yet.");
    expect(ventures.querySelector("[data-ventures-propose]")?.getAttribute("href")).toBe("/role-proposals/new");
    const soon = screen.getByRole("heading", { level: 2, name: "Upcoming roles (2)" }).closest("section") as HTMLElement;
    expect(ventures.compareDocumentPosition(soon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("with the founding team off, every listed open role is open now and the board's door is the header's act (control)", async () => {
    founding = { on: false, roleIds: [], sections: {}, showPayRanges: false, villagePay: { shape: [], atRisk: "", note: "" } };
    renderRoles();
    const open = (await screen.findByRole("heading", { level: 2, name: "Open roles (3)" })).closest("section") as HTMLElement;
    expect(cardIds(open)).toEqual(["finance", "land", "cook"]);
    expect(screen.getByRole("heading", { level: 1, name: "Roles and Circles" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Browse the open roles/ }).getAttribute("href")).toBe("/roles/select");
  });

  it("says the founding roles come first, and the rest open next with the calls to hear first, inside Open roles", async () => {
    founding = { ...founding, otherWays: { newsletter: "https://news.example.test/join" } };
    renderRoles();
    const h1 = await screen.findByRole("heading", { level: 1, name: "Join the founding team" });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const line = document.querySelector("[data-hiring-first]") as HTMLElement;
    expect(line.textContent).toMatch(/We are filling these roles first\. More roles open after them\./);
    expect(within(line).getByRole("link", { name: "See the roles opening next" }).getAttribute("href")).toBe("#opening-next");
    const next = document.getElementById("opening-next") as HTMLElement;
    expect(cardIds(next)).toEqual(["cook"]);
    expect(within(next).getByRole("heading", { level: 3, name: "More roles, opening next" })).toBeTruthy();
    const hear = next.querySelector("[data-hear-first]") as HTMLElement;
    expect(hear.textContent).toMatch(/Hear first about new opportunities: join a community call and sign up for our newsletter\./);
    expect(h1.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the page's outline whole: no heading skips a level (axe heading-order)", async () => {
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    const levels = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading ${i}: h${levels[i - 1]} then h${levels[i]}`).toBeLessThanOrEqual(1);
  });
});

describe("one card, the same anatomy for every role", () => {
  it("has the badge, the title linking to its page, the purpose, three tags, the bar, Read the role and Apply", async () => {
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    const c = card("finance");
    expect(c.querySelector("[data-role-card-badge]")?.textContent).toBe("Open");
    const title = within(c).getByRole("heading", { level: 3, name: "Lead Finance Steward" });
    expect(within(title).getByRole("link").getAttribute("href")).toBe("/roles/lead-finance-steward");
    expect(c.querySelector("[data-role-card-purpose]")?.textContent).toBe("Hold all things lead finance steward.");
    expect(Array.from(c.querySelectorAll("[data-role-card-tags] li")).map((li) => li.textContent)).toEqual(["Anchor Circle", "100%", "On the land or remote"]);
    // The server's fill wins; a role it sent none for draws its own from the row.
    expect(c.querySelector("[data-fill-meter]")?.textContent).toBe("50% held · 50% open");
    expect(card("cook").querySelector("[data-fill-meter]")?.textContent).toBe("0% held · 100% open");
    expect(Array.from(card("cook").querySelectorAll("[data-role-card-tags] li")).map((li) => li.textContent)).toEqual(["Anchor Circle", "Full or part commitment (from 30%)", "On the land"]);
    expect(within(c).getByRole("link", { name: "Read the role: Lead Finance Steward" }).getAttribute("href")).toBe("/roles/lead-finance-steward");
    expect(within(c).getByRole("link", { name: /^Apply: Lead Finance Steward/ }).getAttribute("href")).toBe("/propose-a-role?role=finance");
  });

  it("opens nothing inline and nests no control inside another (a stretched link, the acts above it)", async () => {
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    for (const c of Array.from(document.querySelectorAll<HTMLElement>("[data-role-card]"))) {
      expect(c.querySelector("[aria-expanded='true'], details, dialog, [data-full-role-card]")).toBeNull();
      expect(c.querySelector("a a, a button, button a, button button")).toBeNull();
      // One link carries the whole card; the acts sit above it.
      const stretched = c.querySelector("[data-role-card-link]") as HTMLElement;
      expect(stretched.className).toContain("after:absolute");
      expect(c.querySelector("[data-role-card-acts]")?.className).toContain("z-10");
    }
  });

  it("says a seat waiting to be re-chosen in its badge, never Open (control: an open seat says Open)", async () => {
    org.roles.push(seat("water", "Water Keeper", { state: "expired", holderCount: 1 }));
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (4)" });
    expect(card("water").querySelector("[data-role-card-badge]")?.textContent).toBe("Ready to be re-chosen");
    expect(card("cook").querySelector("[data-role-card-badge]")?.textContent).toBe("Open");
  });

  it("a coming-soon card keeps Join the waitlist and Apply early in place of Apply; a venture's act is Bring your venture, into the apply flow", async () => {
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Upcoming roles (2)" });
    const dev = card("dev");
    expect(dev.querySelector("[data-role-card-badge]")?.textContent).toBe("Coming soon");
    expect(dev.querySelector("[data-apply-role]")).toBeNull();
    expect(dev.querySelector('[data-waitlist-open="dev"]')).toBeTruthy();
    expect(dev.querySelector('[data-apply-early="dev"]')?.getAttribute("href")).toBe("/propose-a-role?role=dev&early=1");
    expect(dev.querySelector("[data-read-role]")?.getAttribute("href")).toBe("/roles/development-steward");
    const guest = card("guest");
    expect(guest.querySelector("[data-role-card-badge]")?.textContent).toBe("Future venture");
    expect(guest.querySelector('[data-apply-role="guest"]')?.getAttribute("href")).toBe("/propose-a-role?role=guest");
    expect(within(guest).getByRole("link", { name: "Bring your venture: Guest House Venture Steward" })).toBeTruthy();
    expect(within(dev).getByRole("button", { name: /^Join the waitlist/ })).toBeTruthy();
  });

  it("offers no Apply on a card the village holds back as Being written (control: Read the role stays)", async () => {
    org.roles[2] = seat("cook", "Village Cook", { card: { complete: false, missing: ["aim"], written: 3, of: 11, gated: true } });
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    expect(card("cook").querySelector("[data-apply-role]")).toBeNull();
    expect(card("cook").querySelector("[data-read-role]")).toBeTruthy();
  });
});

describe("a steward's children", () => {
  it("are one indented line inside the steward's card, each a link to its own page, and nowhere between cards", async () => {
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    const line = card("finance").querySelector("[data-role-card-children]") as HTMLElement;
    expect(line.textContent).toBe("Will grow into: Development Steward · Permaculture Steward");
    expect(Array.from(line.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual(["/roles/development-steward", "/roles/permaculture-steward"]);
    // A steward that leads no circle has no line (control).
    expect(card("land").querySelector("[data-role-card-children]")).toBeNull();
    // The old block between cards is gone.
    expect(document.querySelector("[data-lead-builds]")).toBeNull();
  });
});

describe("who holds it now", () => {
  it("draws the held roles as a roster below the groups, a held role still recruiting with its Apply", async () => {
    org.roles.push(seat("books", "Bookkeeper", { state: "filled", holderCount: 1, holders: [{ name: "Ana Ruiz" }], recruiting: true }));
    renderRoles();
    const held = (await screen.findByRole("heading", { level: 2, name: "Holding it now (2)" })).closest("section") as HTMLElement;
    const roster = await within(held).findByTestId("filled-roles");
    await waitFor(() => expect(roster.querySelector('[data-roster-person="p:Ana"]')).toBeTruthy());
    expect(within(roster.querySelector('[data-roster-person="p:Ana"]') as HTMLElement).getByRole("link", { name: /Apply/ }).getAttribute("href")).toBe("/propose-a-role?role=books");
    expect(roster.querySelector('[data-roster-person="p:Rye"]')?.textContent).toContain("Operations Steward");
    expect(held.textContent).not.toMatch(/rating|score|rank/i);
  });
});

describe("old links to one role", () => {
  const lands = async (at: string, path: string) => {
    renderRoles(at);
    await waitFor(() => expect(window.location.pathname).toBe(path));
    cleanup();
  };
  it("?seat=, ?role=, #<id>, #role-<id> and #<slug> each become the role's own page", async () => {
    await lands("/roles?seat=cook", "/roles/village-cook");
    await lands("/roles?role=finance", "/roles/lead-finance-steward");
    await lands("/roles#cook", "/roles/village-cook");
    await lands("/roles#role-guest", "/roles/guest-house-venture-steward");
    await lands("/roles#land-steward", "/roles/land-steward");
  });

  it("replaces the entry, so Back still leaves the page in one press", async () => {
    const before = window.history.length;
    renderRoles("/roles?seat=cook");
    await waitFor(() => expect(window.location.pathname).toBe("/roles/village-cook"));
    expect(window.history.length).toBe(before);
  });

  it("#waitlist-<id> stays here and opens that coming-soon card's waitlist (control: not a redirect)", async () => {
    renderRoles("/roles#waitlist-perma");
    await waitFor(() => expect(card("perma").querySelector("[data-waitlist-form]")).toBeTruthy());
    expect(window.location.pathname).toBe("/roles");
    expect(card("dev").querySelector("[data-waitlist-form]")).toBeNull();
  });

  it("a link to a role that is gone says so in one line, keeps every card, and drops only the role from the address", async () => {
    renderRoles("/roles?seat=gone&from=mail");
    expect(await screen.findByText("That role is not on this page anymore.")).toBeTruthy();
    expect(window.location.pathname).toBe("/roles");
    expect(window.location.search).toBe("?from=mail");
    expect(cardIds(document)).toContain("cook");
  });

  it("reads an old link without a page: the same rule as a pure function", () => {
    const roles = [{ id: "cook", path: "/roles/village-cook" }];
    expect(roleForOldLink({ seat: "cook", hash: null }, roles)?.path).toBe("/roles/village-cook");
    expect(roleForOldLink({ seat: null, hash: "village-cook" }, roles)?.path).toBe("/roles/village-cook");
    expect(roleForOldLink({ seat: null, hash: "waitlist-cook" }, roles)).toBeNull();
    expect(roleForOldLink({ seat: null, hash: "opening-next" }, roles)).toBeNull();
    expect(roleForOldLink({ seat: "gone", hash: null }, roles)).toBeNull();
  });
});
