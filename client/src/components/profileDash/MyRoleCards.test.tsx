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
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { FIXTURE_ROLE_TITLE, fixturePayload } from "@/test/playerCardFixture";
import { TOKEN_KEY } from "@/lib/gameApi";

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
  localStorage.setItem(TOKEN_KEY, "a-token");
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
      // The Your roles facts: the member's part of their commitment and the role's own page.
      expect(card.querySelector("[data-role-part]")!.textContent).toBe(part);
      expect(inCard.getByRole("link", { name: "On the roles page" }).getAttribute("href")).toBe(`/roles?seat=r${i}`);
      // The moon and the season plan are the same door for every role: never inside a card.
      expect(inCard.queryByRole("link", { name: /This moon/ })).toBeNull();
      expect(inCard.queryByRole("link", { name: /Season plan/ })).toBeNull();
    }

    // Once on the tab, after the cards: the moon and the season plan, how much you give, the proposing door.
    expect(screen.getAllByRole("link", { name: /This moon/ })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /This moon/ }).getAttribute("href")).toBe("#pc-moons-h");
    expect(screen.getAllByRole("link", { name: /^Season plan$/ })).toHaveLength(1);
    const doors = document.querySelector("[data-roles-doors]")!;
    expect(cards[1]!.compareDocumentPosition(doors) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelectorAll("[data-commitment-field]")).toHaveLength(1);
    const door = document.querySelector("[data-proposing-door]") as HTMLElement;
    const apply = within(door).getByRole("link", { name: /Apply for a role/ });
    expect(apply.getAttribute("href")).toContain("type=role_application");
    // Apply is the door's one gold act; the rest are pills.
    expect(door.querySelectorAll(".pc-act")).toHaveLength(1);
    expect(apply.classList.contains("pc-act")).toBe(true);
    expect(within(door).getByRole("link", { name: /Plan your season/ }).getAttribute("href")).toBe("/season#plan");
  });

  it("breathes while the card is on its way, never a blank slot", async () => {
    let release: () => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown) =>
        String(url).startsWith("/api/people/me/role-card")
          ? new Promise<Response>((r) => { release = () => r(answer(String(url))); })
          : Promise.resolve(answer(String(url))),
      ),
    );
    view();
    expect(document.querySelector("[data-roles-loading] [role='status']")?.textContent).toContain("Opening your roles");
    release();
    await waitFor(() => expect(document.querySelectorAll("article.pc-rolecard")).toHaveLength(2));
    expect(document.querySelector("[data-roles-loading]")).toBeNull();
  });

  it("says when the roles held did not load, and asks again on Retry", async () => {
    let fail = true;
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => (String(url).startsWith("/api/season-plans/mine") && fail ? json({ error: "down" }, 500) : answer(String(url)))));
    view();
    const line = await waitFor(() => {
      const el = document.querySelector("[data-roles-failed]");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(line.textContent).toContain("Your roles did not load.");
    expect(document.querySelector("[data-commitment-field]")).toBeNull();
    fail = false;
    fireEvent.click(within(line).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(document.querySelectorAll("[data-commitment-field]")).toHaveLength(1));
    expect(document.querySelector("[data-roles-failed]")).toBeNull();
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
    // Nothing is lost: how much you give is still there with no role, and no per-role moon door.
    await waitFor(() => expect(document.querySelectorAll("[data-commitment-field]")).toHaveLength(1));
    expect(document.querySelector("[data-roles-doors]")).toBeNull();
    // The door follows the empty state directly, and nothing is drawn across no roles.
    expect(empty.nextElementSibling?.hasAttribute("data-proposing-door")).toBe(true);
    await waitFor(() => expect(within(document.querySelector("[data-proposing-door]") as HTMLElement).getByRole("link", { name: /Apply for a role/ })).toBeTruthy());
    // "Across my roles" is the one panel the card labels by aria-label; across none it is not drawn.
    expect(document.querySelector("[data-player-card] section.pc-panel[aria-label]")).toBeNull();
  });

  it("says the card did not load, with Retry, above the plain Your roles panel", async () => {
    let fail = true;
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => (String(url).startsWith("/api/people/me/role-card") && fail ? json({ error: "nope" }, 500) : answer(String(url)))));
    view();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your roles" })).toBeTruthy());
    expect(document.querySelector("[data-player-card]")).toBeNull();
    const failed = document.querySelector("[data-card-failed]") as HTMLElement;
    expect(failed.firstElementChild?.textContent).toContain("This card did not load.");
    await waitFor(() => expect(screen.getByRole("link", { name: new RegExp(FIXTURE_ROLE_TITLE(1)) }).getAttribute("href")).toBe("/roles?seat=r1"));
    fail = false;
    fireEvent.click(within(failed.firstElementChild as HTMLElement).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(document.querySelectorAll("article.pc-rolecard")).toHaveLength(2));
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
