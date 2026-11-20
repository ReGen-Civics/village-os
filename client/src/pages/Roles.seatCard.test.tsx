// @vitest-environment jsdom
/**
 * /roles: THE ROW HEADER AND THE ROLE CARD UNDER IT. Since the /roles index (20 Nov 2026) the header is the
 * index card's badge, and what an opened row showed is on the role's own page, `/roles/<slug>`. The raised hand
 * (promise 3 below) went with the inline row: it stays on the map's seat card (MapSeatCard, /circles).
 *
 * Nothing rendered this page in a test before. Three promises are held here:
 *
 *   1. THE HEADER SAYS THE SEAT'S STATE IN THE CARD'S WORDS. A seat whose term
 *      reached its date used to fall through `normalizeStatus` and read "Open
 *      Role", which told a reader the place was free when it was waiting to be
 *      re-chosen. Now the header and the card read one map (`STATE_WORDS`).
 *   2. OPENING A ROW SHOWS THE CARD, with the seat's history, its needs and
 *      the vendor drawer still below it, outside the night card.
 *   3. THE ONE DOOR IS A RAISED HAND, and only while the map module is on for
 *      this reader, because the route lives under `/api/map` behind that
 *      module. The contact relay is the map's alone and never appears here.
 *
 * Every absence has a known-positive control beside it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import type { ReactNode } from "react";

const session = vi.hoisted(() => ({ token: null as string | null, user: null as null | { id: string; role?: string } }));
const catalog = vi.hoisted(() => ({ modules: [] as Array<{ id: string; name: string; lifecycle: string }> }));

vi.mock("@/components/Layout", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/SeatClaimCard", () => ({ default: () => null }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: session.user, token: session.token, loading: false }),
  useIsAdmin: () => session.user?.role === "admin" || session.user?.role === "founder",
}));
vi.mock("@/lib/gameApi", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authToken: () => session.token,
}));
// The catalog by its real rule (`moduleIsOn`, for a catalog that loaded): a
// module is on when the viewer's manifest lists it with a lifecycle past off.
vi.mock("@/modules/ModuleProvider", () => ({
  useModule: (id: string) => catalog.modules.find((m) => m.id === id),
  useModuleOn: (id: string) => catalog.modules.some((m) => m.id === id && m.lifecycle !== "off"),
}));
vi.mock("@/components/natural/useReducedMotion", () => ({
  useReducedMotion: () => true,
  prefersReducedMotion: () => true,
}));

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

const MAP_ON = { id: "map", name: "Village map", lifecycle: "members" };
const VENDOR_ON = { id: "saberra", name: "Fieldnotes", lifecycle: "members" };

/** `/api/org` at the member tier, in the shape the seat projection serves. */
const ORG = {
  people: { visible: true, membersOnly: false, signedIn: true },
  village: { decidesBy: "consent" },
  circles: [{ id: "land", name: "Land & Water", purpose: "The ground and its water", decidesBy: null, color: "sage", status: "active" }],
  roles: [
    {
      id: "water-keeper",
      name: "Water Keeper",
      circleId: "land",
      aim: "Keep the village's water clean.",
      domain: "The tanks and the greywater lines",
      accountabilities: ["Testing the spring monthly"],
      whyItMatters: "A village that loses its water loses a season.",
      seats: 1,
      holderCount: 1,
      state: "expired",
      stateSource: "derived",
      criticality: "normal",
      recruiting: false,
      representsCircle: false,
      howChosen: null,
      howChosenGloss: null,
      termEnds: "2026-09-01T12:00:00.000Z",
      archetypes: [],
      isExample: false,
      holders: [{ userId: "u-mara", name: "Mara", kind: "member", focus: null, lapsed: true, isAgent: false, note: null }],
    },
    {
      id: "seed-keeper",
      name: "Seed Keeper",
      circleId: "land",
      aim: "Keep the seed library alive.",
      domain: null,
      accountabilities: [],
      whyItMatters: null,
      seats: 2,
      holderCount: 1,
      state: "partial",
      stateSource: "derived",
      criticality: "normal",
      recruiting: false,
      representsCircle: false,
      howChosen: null,
      howChosenGloss: null,
      termEnds: "2027-02-01T12:00:00.000Z",
      archetypes: [],
      isExample: false,
      // A member with an account: the map would offer to reach her.
      holders: [{ userId: "u-ines", name: "Ines", kind: "member", focus: null, lapsed: false, isAgent: false, note: null }],
    },
  ],
};

const asked: Array<{ url: string; method: string; body: unknown }> = [];

beforeEach(() => {
  asked.length = 0;
  // Opening a row writes `?seat=` into the address, and the page opens
  // whatever seat the address names, so each test starts on a bare /roles.
  window.history.replaceState(null, "", "/roles");
  session.token = "a-token";
  session.user = { id: "u-me" };
  catalog.modules = [MAP_ON];
  vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      asked.push({ url: u, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
      if (u === "/api/org") return reply(ORG);
      if (u === "/api/season") return reply({ current: { name: "Season of Foundations", endsOn: "2099-03-21" }, daysLeft: 171 });
      if (u === "/api/archetypes") return reply([]);
      if (u.endsWith("/needs")) return reply({ needs: [] });
      if (u.includes("/raise-hand")) return reply({ success: true });
      return reply([]);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function renderRoles() {
  return render(
    <Router>
      <Roles />
    </Router>,
  );
}
/** A role's whole record lives on its own page since the /roles index (20 Nov 2026). */
function renderRole(id: string) {
  window.history.replaceState(null, "", `/roles/${id}`);
  return render(
    <Router>
      <RoleShare />
    </Router>,
  );
}

const indexCard = async (name: string) => (await screen.findByRole("heading", { level: 3, name })).closest("[data-role-card]") as HTMLElement;

describe("the /roles card's badge", () => {
  it("says a seat whose term reached its date is ready to be re-chosen, never an open role", async () => {
    renderRoles();
    const expired = await indexCard("Water Keeper");
    expect(expired.querySelector("[data-role-card-badge]")?.textContent).toBe("Ready to be re-chosen");
    // Known positive: the neighbour's card draws its own state the same way.
    expect((await indexCard("Seed Keeper")).querySelector("[data-role-card-badge]")?.textContent).toBe("Partly held");
    expect(screen.queryByText(/Open Role/)).toBeNull();
    // Nothing opens inline: the card is a link to the role's page.
    expect(expired.querySelector("[aria-expanded]")).toBeNull();
  });
});

describe("an agent on /roles", () => {
  it("never shows the vendor's name an agent's member row carries", async () => {
    const VENDOR = "Fieldnotes Assistant";
    const withAgent = {
      ...ORG.roles[1],
      holders: [
        ...ORG.roles[1].holders,
        { userId: null, name: VENDOR, kind: "documented", focus: null, lapsed: false, isAgent: true, note: null },
      ],
      holderCount: 2,
      state: "partial",
      seats: 3,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const body = String(url) === "/api/org" ? { ...ORG, roles: [withAgent] } : [];
        return { ok: true, status: 200, json: async () => body };
      }),
    );
    renderRoles();
    await indexCard("Seed Keeper");
    // Control: the vendor's name is in what the route served.
    expect(JSON.stringify(withAgent)).toContain(VENDOR);
    expect(document.body.textContent).not.toContain(VENDOR);
  });
});

describe("a role's own page, below its card", () => {
  it("asks for the seat's history and its needs, and draws the vendor drawer outside the card, in the service's own name", async () => {
    catalog.modules = [MAP_ON, VENDOR_ON];
    renderRole("water-keeper");
    const card = await waitFor(() => {
      const el = document.querySelector('[data-full-role-card="water-keeper"]') as HTMLElement | null;
      if (!el) throw new Error("no card yet");
      return el;
    });
    await waitFor(() => expect(asked.some((a) => a.url === "/api/org/roles/water-keeper/history")).toBe(true));
    expect(asked.some((a) => a.url === "/api/org/roles/water-keeper/needs")).toBe(true);
    // #391's drawer sits under the card, outside it.
    const vendor = await screen.findByRole("button", { name: "See what Fieldnotes holds" });
    expect(card.contains(vendor)).toBe(false);
  });
});
