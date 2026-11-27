// @vitest-environment jsdom
/**
 * MY ROLES, ONE CARD PER ROLE (the lead, 27 Nov 2026: "yes" to merging Your roles and the player card).
 *
 * Each role the member holds is one card carrying both sets of facts: the player card's (its art, its
 * circle, its term and health, the role in full) and the "Your roles" list's (the member's part of their
 * commitment, the doors to the moon and the season plan, its page on /roles). The proposing door and how
 * much you give stay on the tab, once. A member with no role reads one plain empty state and the door.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { FIXTURE_ROLE_TITLE, fixturePayload } from "@/test/playerCardFixture";

i18n.load("en", {});
i18n.activate("en");

vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({ loaded: true, modules: [] }),
  useModule: (id: string) => ({ id, lifecycle: "public" }),
  useModuleOn: () => false,
  moduleIsOn: () => false,
}));

import MyRoleCards, { partOfYou } from "./MyRoleCards";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let rolesN = 2;
const seat = (n: number) => ({ id: `r${n}`, name: FIXTURE_ROLE_TITLE(n), termEndsOn: "2026-12-31", lapsed: false });

function answer(url: string): Response {
  if (url.startsWith("/api/people/me/role-card")) return json(fixturePayload(rolesN));
  if (url.startsWith("/api/season-plans/mine"))
    return json({ season: { id: "s2", name: "Season of Foundations", startsOn: "2026-10-01", endsOn: "2026-12-31", goals: [] }, window: null, plan: null, filed: null, heldSeats: Array.from({ length: rolesN }, (_, i) => seat(i + 1)), applications: [], questsThisMoon: { done: 0 }, mayApply: true });
  if (url.startsWith("/api/governance/role-applications")) return json({ applications: [] });
  if (url.startsWith("/api/me/commitment"))
    return json({ now: { id: 1, pct: 50, period: "season", fromDate: "2026-10-01", note: null, saidAt: null, split: rolesN === 2 ? [{ roleId: "r1", share: 60 }, { roleId: "r2", share: 40 }] : null }, history: [] });
  return json({});
}

beforeEach(() => {
  localStorage.setItem("village-auth-token", "a-token");
  vi.stubGlobal("fetch", vi.fn(async (url: unknown) => answer(String(url))));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  rolesN = 2;
});

const view = () =>
  render(
    <I18nProvider i18n={i18n}>
      <Router>
        <MyRoleCards />
      </Router>
    </I18nProvider>,
  );

describe("My roles", () => {
  it("draws one card per role, each holding the player card's facts and the Your roles facts together", async () => {
    view();
    await waitFor(() => expect(document.querySelectorAll("[data-role-part]")).toHaveLength(2));
    const cards = document.querySelectorAll("article.pc-rolecard");
    expect(cards).toHaveLength(2);
    // No second panel listing the same roles, and no tile strip pointing down to them.
    expect(document.querySelectorAll("#sheet-roles")).toHaveLength(1);
    expect(document.querySelector(".pc-htiles")).toBeNull();
    expect(screen.getByRole("heading", { name: "Your roles" })).toBeTruthy();

    for (const [i, part] of [[1, "Your part: 30% of you, 60% of what you give"], [2, "Your part: 20% of you, 40% of what you give"]] as const) {
      const card = document.getElementById(`role-r${i}`)! as HTMLElement;
      const inCard = within(card);
      // The player card's facts: the role, its art, its circle, its term and health, the role in full.
      expect(inCard.getByRole("heading", { name: FIXTURE_ROLE_TITLE(i) })).toBeTruthy();
      expect(card.querySelector("svg[data-role-icon]")).not.toBeNull();
      expect(inCard.getByRole("link", { name: "Community Anchor" }).getAttribute("href")).toBe("/circles/c1");
      expect(card.textContent).toContain("Held until 31 Dec 2026");
      expect(card.querySelector("[data-role-health]")).not.toBeNull();
      expect(card.querySelector('[data-role-section="purpose"]')).not.toBeNull();
      // The Your roles facts: the member's part of their commitment and the doors.
      expect(card.querySelector("[data-role-part]")!.textContent).toBe(part);
      expect(inCard.getByRole("link", { name: /This moon/ }).getAttribute("href")).toBe("#pc-moons-h");
      expect(inCard.getByRole("link", { name: /Season plan/ }).getAttribute("href")).toBe("/season#plan");
      expect(inCard.getByRole("link", { name: "On the roles page" }).getAttribute("href")).toBe(`/roles?seat=r${i}`);
    }

    // Once on the tab, never per role: how much you give, and the proposing door.
    expect(document.querySelectorAll("[data-commitment-field]")).toHaveLength(1);
    const door = document.querySelector("[data-proposing-door]") as HTMLElement;
    expect(within(door).getByRole("link", { name: /Apply for a role/ }).getAttribute("href")).toContain("type=role_application");
    expect(within(door).getByRole("link", { name: /Plan your season/ }).getAttribute("href")).toBe("/season#plan");
  });

  it("gives a member with no role one plain empty state and the door to take one on", async () => {
    rolesN = 0;
    view();
    const empty = await waitFor(() => {
      const el = document.querySelector("[data-no-roles]");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(empty.textContent).toContain("You are not holding a role for the village's work yet.");
    expect(document.querySelectorAll("article.pc-rolecard")).toHaveLength(0);
    expect(document.querySelector("[data-commitment-field]")).toBeNull();
    // The door follows the empty state directly, and nothing is drawn across no roles.
    expect(empty.nextElementSibling?.hasAttribute("data-proposing-door")).toBe(true);
    await waitFor(() => expect(within(document.querySelector("[data-proposing-door]") as HTMLElement).getByRole("link", { name: /Apply for a role/ })).toBeTruthy());
    // "Across my roles" is the one panel the card labels by aria-label; across none it is not drawn.
    expect(document.querySelector("[data-player-card] section.pc-panel[aria-label]")).toBeNull();
  });

  it("falls back to the plain Your roles panel when the card cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => (String(url).startsWith("/api/people/me/role-card") ? json({ error: "nope" }, 500) : answer(String(url)))));
    view();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your roles" })).toBeTruthy());
    expect(document.querySelector("[data-player-card]")).toBeNull();
    await waitFor(() => expect(screen.getByRole("link", { name: new RegExp(FIXTURE_ROLE_TITLE(1)) }).getAttribute("href")).toBe("/roles?seat=r1"));
  });
});

describe("partOfYou", () => {
  it("reads a role's part from the split, the whole word for an only role, and nothing with nothing said", () => {
    expect(partOfYou("a", ["a", "b"], { pct: 50, split: [{ roleId: "a", share: 60 }, { roleId: "b", share: 40 }] })).toEqual({ pct: 30, share: 60 });
    expect(partOfYou("a", ["a", "b"], { pct: 50, split: null })).toEqual({ pct: 50, share: null });
    expect(partOfYou("a", ["a"], { pct: 70 })).toEqual({ pct: 70, share: null });
    expect(partOfYou("a", ["a"], null)).toBeNull();
    // A stale split (a role handed back) is no split at all.
    expect(partOfYou("a", ["a", "c"], { pct: 50, split: [{ roleId: "a", share: 60 }, { roleId: "b", share: 40 }] })).toEqual({ pct: 50, share: null });
  });
});
