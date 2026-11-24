// @vitest-environment jsdom
/**
 * /roles AS APPROVED IN 1.3.41, WITH THE TWO CHANGES THE LEAD ASKED FOR (21 Nov 2026).
 *
 *   1. FULL CARDS: the founding team's roles open their full card (the one-minute summary, the founding sections)
 *      on /roles itself, as 1.3.41 drew them; nothing sends the reader away to read a role.
 *   2. THE ORDER: "Open roles", then "Open ventures", then "Upcoming roles", then the roles held now.
 *   3. ONE FRAME PER ROLE: each role is its own bordered panel, its card opening inside it, the roles a lead will add
 *      inside it too ("Roles to be added:"), so a reader always knows which role they are in.
 *   4. OLD LINKS (`?seat=`, `?role=`, `#<id>`, `#role-<id>`, `#<slug>`) land on the role's own page, its share link;
 *      `#waitlist-<id>` still opens that coming-soon role's waitlist here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const SECTIONS = { idealBackground: [], qualities: [], aiSupport: "", aiCompanion: "", paid: false, payShape: [], payNote: "", payCeiling: null, paySplitNote: "" };

let org: any;
let founding: any;

/** A desktop: the founding team opens on its first role's card. */
const wide = () => vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("min-width"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));

beforeEach(() => {
  window.history.replaceState(null, "", "/roles");
  try {
    window.localStorage.clear();
  } catch {
    // nothing kept
  }
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
      seat("cook", "Village Cook"),
      seat("dev", "Development Steward", { circleId: "money", comingSoon: true, state: "forming" }),
      seat("perma", "Permaculture Steward", { circleId: "money", comingSoon: true, state: "forming" }),
      seat("guest", "Guest House Venture Steward", { futureVenture: true, state: "forming" }),
      seat("ops", "Operations Steward", { state: "filled", holderCount: 1, holders: [{ name: "Rye Ashby" }], recruiting: false }),
    ],
  };
  founding = {
    on: true,
    roleIds: ["finance", "land"],
    sections: { finance: SECTIONS, land: SECTIONS },
    showPayRanges: false,
    villagePay: { shape: [], atRisk: "", note: "" },
    fill: {},
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const u = String(url);
      const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
      if (u === "/api/org") return reply(org);
      if (u === "/api/org/founding-team") return reply(founding);
      if (u === "/api/season") return reply({ current: null });
      return reply({}, 404);
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
const frame = (id: string) => document.querySelector(`[data-role-frame="${id}"]`) as HTMLElement;

describe("the full role cards, back on /roles", () => {
  it("opens the first founding role's full card on a desktop, inside its own frame, with the one-minute summary and the founding sections", async () => {
    wide();
    renderRoles();
    await screen.findByRole("heading", { level: 1, name: "Join the founding team" });
    const card = await waitFor(() => {
      const el = frame("finance")?.querySelector('[data-full-role-card="finance"]') as HTMLElement | null;
      if (!el) throw new Error("no card yet");
      return el;
    });
    expect(card.querySelector("[data-role-one-minute]")).toBeTruthy();
    expect(within(card).getByText("The role in one minute")).toBeTruthy();
    // The other role is a row in its own frame, closed, and holds no card.
    expect(frame("land").querySelector("[data-full-role-card]")).toBeNull();
    // Nothing on /roles sends the reader away to read a role.
    expect(document.querySelector("[data-role-card]")).toBeNull();
    expect(document.querySelector("[data-read-role]")).toBeNull();
  });

  it("moves the card into the frame of the role a reader opens, and nowhere else", async () => {
    wide();
    renderRoles();
    await waitFor(() => expect(frame("finance")?.querySelector('[data-full-role-card="finance"]')).toBeTruthy());
    fireEvent.click(frame("land").querySelector('[data-founding-role="land"]') as HTMLElement);
    await waitFor(() => expect(frame("land").querySelector('[data-full-role-card="land"]')).toBeTruthy());
    expect(frame("finance").querySelector("[data-full-role-card]")).toBeNull();
    expect(document.querySelectorAll("[data-full-role-card]")).toHaveLength(1);
  });

  it("keeps the roles a lead will build inside that lead's frame, never between two roles", async () => {
    wide();
    renderRoles();
    const builds = await waitFor(() => {
      const el = document.querySelector("[data-lead-builds]") as HTMLElement | null;
      if (!el) throw new Error("not yet");
      return el;
    });
    expect(frame("finance").contains(builds)).toBe(true);
  });
});

describe("the groups, in the order the lead asked for", () => {
  it("Open roles, Open ventures, Upcoming roles, then the roles held now, each heading once", async () => {
    renderRoles();
    const open = await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    const ventures = screen.getByRole("heading", { level: 2, name: "Open ventures (1)" });
    const soon = screen.getByRole("heading", { level: 2, name: "Upcoming roles (2)" });
    const held = await screen.findByRole("heading", { level: 2, name: "Holding it now" });
    const order = [open, ventures, soon, held];
    for (let i = 1; i < order.length; i++) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The founding roles come first under Open roles, then the role opening next.
    expect(within(screen.getByRole("region", { name: "More roles, opening next" })).getByRole("heading", { level: 3, name: "Village Cook" })).toBeTruthy();
    // Each role once: the venture and the coming-soon roles are not rows of the open group.
    expect(document.querySelector('[data-opening-next] [data-role-row="guest"]')).toBeNull();
    expect(document.querySelector('[data-opening-next] [data-role-row="dev"]')).toBeNull();
    expect(document.querySelector('[data-future-ventures] [data-role-row="guest"]')).toBeTruthy();
  });

  it("keeps the page's outline whole: one h1 and no heading skips a level (axe heading-order)", async () => {
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const levels = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => Number(h.tagName[1]));
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });
});

describe("open ventures: what a venture is, the pitch, and the ones open now first (the lead, 23 Nov 2026)", () => {
  it("says what a venture is, offers Start a venture, and draws the venture open now first with its badge", async () => {
    org.roles = org.roles.map((r: any) => (r.id === "guest" ? { ...r, recruiting: false } : r));
    org.roles.push(seat("cafe", "Cafe Venture", { futureVenture: true, recruiting: true, state: "forming" }));
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open ventures (2)" });
    const group = document.querySelector("[data-future-ventures]") as HTMLElement;
    expect(group.querySelector("[data-venture-explainer]")?.textContent).toBe("A venture is a business you build and run on the land with the village. You earn from what you build; it is separate from a paid role.");
    const pitch = within(group).getByRole("link", { name: "Start a venture" });
    expect(["/work-with-us?kind=venture", "/role-proposals/new"]).toContain(pitch.getAttribute("href"));
    // The venture open now comes first, though it was listed last; the other reads Accepting proposals.
    const rows = Array.from(group.querySelectorAll("[data-role-row]")).map((r) => r.getAttribute("data-role-row"));
    expect(rows).toEqual(["cafe", "guest"]);
    const chips = Array.from(group.querySelectorAll('[data-testid="venture-chip"]')).map((c) => c.textContent);
    expect(chips).toEqual(["Open now", "Accepting proposals"]);
    // One explainer: the older "Pieces of the village..." paragraph is gone (the lead, 23 Nov 2026).
    expect(group.textContent).not.toContain("Pieces of the village");
    // The stable anchor the four ways land on, its heading ready to take focus.
    expect(group.id).toBe("open-ventures");
    expect(group.querySelector("[data-section-focus]")?.getAttribute("tabindex")).toBe("-1");
  });

  it("CONTROL: with no venture open now, the list keeps its order and none reads Open now", async () => {
    org.roles = org.roles.map((r: any) => (r.id === "guest" ? { ...r, recruiting: false } : r));
    org.roles.push(seat("cafe", "Cafe Venture", { futureVenture: true, recruiting: false, state: "forming" }));
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open ventures (2)" });
    const group = document.querySelector("[data-future-ventures]") as HTMLElement;
    expect(Array.from(group.querySelectorAll("[data-role-row]")).map((r) => r.getAttribute("data-role-row"))).toEqual(["guest", "cafe"]);
    expect(group.querySelector("[data-open-now]")).toBeNull();
  });

  it("opens with the four ways to build as compact tiles, largest commitment first, Join the team and Start a venture scrolling down this page", async () => {
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    const four = screen.getByRole("region", { name: /^Four ways to build/ });
    expect(four.querySelector("[data-contributor-routes]")?.getAttribute("data-contributor-routes")).toBe("tiles");
    const doors = Array.from(four.querySelectorAll("[data-route-door]"));
    expect(doors.map((a) => a.textContent)).toEqual([
      "Join the teamA role on the team, with its own terms.",
      "Start a ventureYour own business on the land.",
      "Become a partnerPartner with us, thrive together.",
      "Propose a questA one-off piece of work, rewarded.",
    ]);
    expect(doors.map((a) => a.getAttribute("href"))).toEqual(["#founding-team", "#open-ventures", "/partner", "/propose-quest"]);
    // Both anchors are real sections on the page, each with a heading that takes focus.
    const team = document.getElementById("founding-team") as HTMLElement;
    expect(team.querySelector("[data-section-focus]")?.textContent).toBe("Join the founding team");
    expect(document.getElementById("open-ventures")).toBeTruthy();
    // The first view stays the founding team's (the lead, 23 Nov 2026): no bring, get back or reply days up here.
    expect(four.querySelectorAll("dt, [data-route-promise]")).toHaveLength(0);
    // At the top: before the open roles.
    expect(four.compareDocumentPosition(screen.getByRole("heading", { level: 2, name: "Open roles (3)" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("lands a link from another page on its section: /roles#open-ventures scrolls there and focuses its heading, never read as a role", async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    } as typeof Element.prototype.scrollIntoView;
    renderRoles("/roles#open-ventures");
    await screen.findByRole("heading", { level: 2, name: /^Open ventures/ });
    await waitFor(() => expect(document.activeElement?.id).toBe("future-ventures-heading"));
    expect(scrolled).toContain("open-ventures");
    // Still on /roles: an anchor is never mistaken for an old one-role link.
    expect(window.location.pathname).toBe("/roles");
    cleanup();
    scrolled.length = 0;
    renderRoles("/roles#founding-team");
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Join the founding team"));
    expect(scrolled).toContain("founding-team");
  });

  it("ends the lists with Don't see your gift in a role?, offering the other three", async () => {
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    const gift = screen.getByRole("region", { name: "Don't see your gift in a role? Consider these:" });
    expect(Array.from(gift.querySelectorAll("[data-route-door]")).map((a) => a.textContent)).toEqual(["Start a venture", "Become a partner", "Propose a quest"]);
    expect(within(gift).getByRole("link", { name: "Propose a quest" }).getAttribute("href")).toBe("/propose-quest");
    // Start a venture here leaves for the venture form, never the anchor at the top (the lead, 24 Nov 2026); this village
    // serves no story pages, so it is the new-role door (ContributorRoutes.test.tsx holds the served case).
    expect(["/work-with-us?kind=venture", "/role-proposals/new"]).toContain(within(gift).getByRole("link", { name: "Start a venture" }).getAttribute("href"));
    expect(gift.textContent).toContain("A one-off piece of value, rewarded when the work is accepted.");
  });
});

describe("one frame per role", () => {
  it("frames every founding role, every opening-next and venture row, and every coming-soon role on its own, with room between them", async () => {
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    expect(Array.from(document.querySelectorAll("[data-role-frame]")).map((f) => f.getAttribute("data-role-frame"))).toEqual(["finance", "land"]);
    for (const f of Array.from(document.querySelectorAll<HTMLElement>("[data-role-frame]"))) {
      for (const c of ["rounded-2xl", "shadow-sm"]) expect(f.className).toContain(c);
    }
    const cookRow = document.querySelector('[data-role-row="cook"] > button') as HTMLElement;
    for (const c of ["rounded-2xl", "border", "shadow-sm"]) expect(cookRow.className).toContain(c);
    expect((document.querySelector('[data-role-row="cook"]') as HTMLElement).parentElement!.className).toContain("space-y-5");
    const dev = document.getElementById("role-dev") as HTMLElement;
    for (const c of ["rounded-2xl", "border", "shadow-sm"]) expect(dev.className).toContain(c);
  });

  it("names a lead role's coming-soon roles in its row, Roles to be added, and opens that role's waitlist on a press", async () => {
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    const line = frame("finance").querySelector("[data-roles-to-be-added]") as HTMLElement;
    // Wrapping chips (b1), the list tied to its label; no middle dots strung through a sentence.
    expect(line.querySelector("p")?.textContent).toBe("Related roles this role will onboard:");
    expect(Array.from(line.querySelectorAll("[data-role-to-be-added]")).map((b) => b.textContent)).toEqual(["Development Steward", "Permaculture Steward"]);
    expect(line.querySelector("ul")?.getAttribute("aria-labelledby")).toBe(line.querySelector("p")?.id);
    expect((line.querySelector("button") as HTMLElement).className).toContain("text-left");
    expect(frame("land").querySelector("[data-roles-to-be-added]")).toBeNull();
    expect(document.body.textContent).not.toContain("Will grow into");
    fireEvent.click(line.querySelector('[data-role-to-be-added="perma"]') as HTMLElement);
    expect(window.location.hash).toBe("#waitlist-perma");
    await waitFor(() => expect(document.getElementById("role-perma")?.querySelector("[data-waitlist-form]")).toBeTruthy());
  });

  it("shows the card's own related roles in its order over the derived list: an open role and a role from another circle (the lead, 24 Nov 2026)", async () => {
    // Cook is open and sits in the anchor circle, outside the Money Circle the finance lead leads; Ops is held.
    founding.sections.finance = { ...SECTIONS, relatedRoles: ["cook", "perma", "ops"] };
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    const line = frame("finance").querySelector("[data-roles-to-be-added]") as HTMLElement;
    expect(Array.from(line.querySelectorAll("[data-role-to-be-added]")).map((b) => b.textContent)).toEqual(["Village Cook", "Permaculture Steward", "Operations Steward"]);
    // The derived coming-soon role the card left out is not added back.
    expect(line.querySelector('[data-role-to-be-added="dev"]')).toBeNull();
    // The open role opens its own row on this page, as the other chips do.
    fireEvent.click(line.querySelector('[data-role-to-be-added="cook"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-role-row="cook"] [aria-expanded="true"]')).toBeTruthy());
  });

  it("opens another founding role's card when the related list names it", async () => {
    founding.sections.finance = { ...SECTIONS, relatedRoles: ["land"] };
    wide();
    renderRoles();
    await waitFor(() => expect(frame("finance")?.querySelector('[data-full-role-card="finance"]')).toBeTruthy());
    fireEvent.click(frame("finance").querySelector('[data-role-to-be-added="land"]') as HTMLElement);
    await waitFor(() => expect(frame("land").querySelector('[data-full-role-card="land"]')).toBeTruthy());
  });

  it("falls back to the derived list when the card's related roles are empty (control)", async () => {
    founding.sections.finance = { ...SECTIONS, relatedRoles: [] };
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    const line = frame("finance").querySelector("[data-roles-to-be-added]") as HTMLElement;
    expect(Array.from(line.querySelectorAll("[data-role-to-be-added]")).map((b) => b.textContent)).toEqual(["Development Steward", "Permaculture Steward"]);
  });

  it("skips a named role the page draws nowhere: unlisted, an example, a venture, one it does not hold, and the lead itself", async () => {
    org.roles.push(seat("hidden", "Hidden Steward", { listed: false }), seat("demo", "Demo Steward", { isExample: true }));
    founding.sections.finance = { ...SECTIONS, relatedRoles: ["hidden", "demo", "guest", "ghost", "finance", "cook"] };
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    const line = frame("finance").querySelector("[data-roles-to-be-added]") as HTMLElement;
    expect(Array.from(line.querySelectorAll("[data-role-to-be-added]")).map((b) => b.getAttribute("data-role-to-be-added"))).toEqual(["cook"]);
    // With every named role skipped, the line is not drawn at all; the derived list does not come back in its place.
    cleanup();
    founding.sections.finance = { ...SECTIONS, relatedRoles: ["hidden", "guest"] };
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open roles (3)" });
    expect(frame("finance").querySelector("[data-roles-to-be-added]")).toBeNull();
  });

  it("keeps a coming-soon role's Join the waitlist and Apply early, and the empty ventures line when none is flagged", async () => {
    org.roles = org.roles.filter((r: any) => r.id !== "guest");
    renderRoles();
    await screen.findByRole("heading", { level: 2, name: "Open ventures (0)" });
    expect(document.querySelector("[data-ventures-none]")?.textContent).toContain("No venture is open yet.");
    const dev = document.getElementById("role-dev") as HTMLElement;
    expect(within(dev).getByRole("button", { name: "Join the waitlist: Development Steward" })).toBeTruthy();
    expect(dev.querySelector('[data-apply-early="dev"]')?.getAttribute("href")).toBe("/propose-a-role?role=dev&early=1");
  });
});

describe("old links to one role", () => {
  const lands = async (at: string, path: string) => {
    renderRoles(at);
    await waitFor(() => expect(window.location.pathname).toBe(path));
    cleanup();
  };
  it("?seat=, ?role=, #<id>, #role-<id> and #<slug> each land on the role's own page", async () => {
    await lands("/roles?seat=cook", "/roles/village-cook");
    await lands("/roles?role=finance", "/roles/lead-finance-steward");
    await lands("/roles#cook", "/roles/village-cook");
    await lands("/roles#role-guest", "/roles/guest-house-venture-steward");
    await lands("/roles#land-steward", "/roles/land-steward");
  });

  it("#waitlist-<id> stays here and opens that coming-soon role's waitlist (control: not a redirect)", async () => {
    renderRoles("/roles#waitlist-perma");
    await waitFor(() => expect(document.getElementById("role-perma")?.querySelector("[data-waitlist-form]")).toBeTruthy());
    expect(window.location.pathname).toBe("/roles");
    expect(document.getElementById("role-dev")?.querySelector("[data-waitlist-form]")).toBeNull();
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
