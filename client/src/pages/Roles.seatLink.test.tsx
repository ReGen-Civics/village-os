// @vitest-environment jsdom
/**
 * /roles?seat=<id> AND ONE ROLE'S LINK.
 *
 * A steward recruiting for a role sends its link. Until the /roles index (20 Nov 2026) the link opened that row
 * on /roles; now every role has its own page, `/roles/<slug>`, and the old links land there. Four promises:
 *
 *   1. AN OLD LINK LANDS ON THE ROLE'S PAGE, replacing the entry, so Back still leaves in one press.
 *   2. A LINK TO A ROLE THE PAGE NO LONGER LISTS SAYS SO in one line, with the roles still listed below it.
 *      The address drops `?seat=` and keeps everything else.
 *   3. "Copy link" on the role's page writes the absolute link inside the click. Where the clipboard refuses or
 *      is missing, a read-only field holds the link, selected. Its every name carries the role.
 *   4. A DEMONSTRATION SEAT HAS NO PAGE AND NO LINK. Nobody is recruited for one.
 *
 * Every absence has a known-positive control beside it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
// The catalog by its real rule: a module is on when the viewer's manifest
// lists it with a lifecycle past off.
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
import { roleForSlug } from "@shared/roleSlug";



class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const seat = (id: string, name: string, state: string) => ({
  id,
  name,
  circleId: "land",
  aim: `Keep the ${name.toLowerCase()} work going.`,
  domain: null,
  accountabilities: [],
  whyItMatters: null,
  seats: 1,
  holderCount: state === "open" ? 0 : 1,
  state,
  stateSource: "derived",
  criticality: "normal",
  recruiting: state === "open",
  representsCircle: false,
  howChosen: null,
  howChosenGloss: null,
  termEnds: "2027-02-01T12:00:00.000Z",
  archetypes: [],
  isExample: false,
  holders: [],
});

/** `/api/org` at the member tier, in the shape the seat projection serves. */
const ORG = {
  people: { visible: true, membersOnly: false, signedIn: true },
  village: { decidesBy: "consent" },
  circles: [{ id: "land", name: "Land & Water", purpose: "The ground and its water", decidesBy: null, color: "sage", status: "active" }],
  roles: [seat("water-keeper", "Water Keeper", "filled"), seat("seed-keeper", "Seed Keeper", "open")],
};

const MISSING = "That role is not on this page anymore.";
/** The copy control's accessible name, the fallback field's, and the line a copy says, for one seat. */
const COPY = (seat: string) => `Copy link to ${seat}`;
const FIELD = (seat: string) => `Link to ${seat}`;
const COPIED = (seat: string) => `Link to ${seat} copied.`;
/** Any seat's copy control, whichever seat it names. */
const ANY_COPY = /^Copy link/;

/** What `/api/org` answers in this test; reset to ORG before each. */
let org: typeof ORG;

let scrolled: ReturnType<typeof vi.fn>;
const hadScroll = Object.prototype.hasOwnProperty.call(HTMLElement.prototype, "scrollIntoView");
const ownScroll = HTMLElement.prototype.scrollIntoView;

/** Gives jsdom a clipboard, or takes it away (`undefined`), as an http origin has none. */
function setClipboard(clip: { writeText: (s: string) => Promise<void> } | undefined) {
  Object.defineProperty(window.navigator, "clipboard", { value: clip, configurable: true, writable: true });
}

beforeEach(() => {
  window.history.replaceState(null, "", "/roles");
  session.token = "a-token";
  session.user = { id: "u-me" };
  catalog.modules = [];
  org = ORG;
  vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
  // jsdom lays nothing out, so it has no scrollIntoView; the spy records the call.
  scrolled = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scrolled, configurable: true, writable: true });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const u = String(url);
      const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
      if (u === "/api/org") return reply(org);
      if (u === "/api/season") return reply({ current: { name: "Season of Foundations", endsOn: "2099-03-21" }, daysLeft: 171 });
      if (u.endsWith("/needs")) return reply({ needs: [] });
      return reply([]);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (window.navigator as unknown as { clipboard?: unknown }).clipboard;
  if (hadScroll) HTMLElement.prototype.scrollIntoView = ownScroll;
  else delete (HTMLElement.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
  window.history.replaceState(null, "", "/");
});

function renderRoles() {
  return render(
    <Router>
      <Roles />
    </Router>,
  );
}
function renderRole(slug: string) {
  window.history.replaceState(null, "", `/roles/${slug}`);
  return render(
    <Router>
      <RoleShare />
    </Router>,
  );
}
const card = () => document.querySelector("[data-full-role-card]") as HTMLElement | null;

describe("an old link to one role", () => {
  it("lands on the role's own page, replacing the entry", async () => {
    window.history.replaceState(null, "", "/roles?seat=seed-keeper&from=letter");
    const before = window.history.length;
    renderRoles();
    await waitFor(() => expect(window.location.pathname).toBe("/roles/seed-keeper"));
    expect(window.history.length).toBe(before);
  });

  it("says a role the page no longer lists is gone, in one line, with every role still listed, dropping only ?seat=", async () => {
    window.history.replaceState(null, "", "/roles?seat=retired-seat&from=letter#top");
    renderRoles();
    expect(await screen.findByText(MISSING)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Seed Keeper" })).toBeTruthy();
    expect(window.location.pathname).toBe("/roles");
    expect(window.location.search).toBe("?from=letter");
    // Control: a link that names a listed role says nothing of the kind.
    expect(screen.getAllByText(MISSING)).toHaveLength(1);
  });
});

describe("copying a role's link", () => {
  it("writes the absolute link inside the click, says so politely, and the link opens that role", async () => {
    const writeText = vi.fn(async (_s: string) => undefined);
    setClipboard({ writeText });
    const view = renderRole("seed-keeper");
    const control = await screen.findByRole("button", { name: COPY("Seed Keeper") });
    // Below the card, outside it.
    expect(card()).toBeTruthy();
    expect(card()!.contains(control)).toBe(false);

    fireEvent.click(control);
    // Called before any await: the write ran inside the click handler.
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0];
    // The role's own page (the lead, 20 Nov 2026), which a messaging app previews with the role.
    expect(copied).toBe(`${window.location.origin}/roles/seed-keeper`);

    // The line names the role it copied.
    const said = await screen.findByText(COPIED("Seed Keeper"));
    expect(said.closest('[role="status"]')).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: FIELD("Seed Keeper") })).toBeNull();

    view.unmount();
    expect(roleForSlug(new URL(copied).pathname.replace(/^\/roles\//, ""), org.roles)?.id).toBe("seed-keeper");
  });

  it("selects the link in a read-only field when the clipboard refuses", async () => {
    const writeText = vi.fn(async (_s: string) => {
      throw new DOMException("Write permission denied.", "NotAllowedError");
    });
    setClipboard({ writeText });
    renderRole("water-keeper");
    const control = await screen.findByRole("button", { name: COPY("Water Keeper") });
    expect(screen.queryByRole("textbox", { name: FIELD("Water Keeper") })).toBeNull();

    fireEvent.click(control);
    expect(writeText).toHaveBeenCalledTimes(1);
    const field = (await screen.findByRole("textbox", { name: FIELD("Water Keeper") })) as HTMLInputElement;
    const link = `${window.location.origin}/roles/water-keeper`;
    expect(field.value).toBe(link);
    expect(field.readOnly).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, link.length]);
    expect(screen.getByText(/Copying did not work here/).closest('[role="status"]')).toBeTruthy();
    expect(screen.queryByText(/copied\.$/)).toBeNull();
  });

  it("selects the link in the field when the browser has no clipboard at all", async () => {
    setClipboard(undefined);
    renderRole("seed-keeper");
    fireEvent.click(await screen.findByRole("button", { name: COPY("Seed Keeper") }));
    const field = (await screen.findByRole("textbox", { name: FIELD("Seed Keeper") })) as HTMLInputElement;
    expect(field.value).toBe(`${window.location.origin}/roles/seed-keeper`);
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
  });

  it("names its own role in the control, and the page has one", async () => {
    setClipboard({ writeText: vi.fn(async (_s: string) => undefined) });
    renderRole("seed-keeper");
    const seed = await screen.findByRole("button", { name: COPY("Seed Keeper") });
    expect(seed.textContent).toBe("Copy link");
    expect(seed.getAttribute("aria-label")).toBe(COPY("Seed Keeper"));
    expect(screen.getAllByRole("button", { name: ANY_COPY })).toEqual([seed]);
    expect(screen.queryByRole("button", { name: COPY("Water Keeper") })).toBeNull();
  });

  it("offers no page and no link for a demonstration seat, which nobody is recruited for", async () => {
    org = { ...ORG, roles: [...ORG.roles, { ...seat("demo-steward", "Demo Steward", "open"), isExample: true }] };
    setClipboard({ writeText: vi.fn(async (_s: string) => undefined) });
    renderRole("demo-steward");
    await waitFor(() => expect(document.querySelector("[data-role-page-missing]")).toBeTruthy());
    expect(screen.queryByRole("button", { name: ANY_COPY })).toBeNull();
    // Nor a link in its opened row on /roles (control: a real seat's row carries one).
    cleanup();
    window.history.replaceState(null, "", "/roles");
    renderRoles();
    fireEvent.click(await screen.findByRole("button", { name: "See all roles" }));
    const demo = (await screen.findByRole("heading", { level: 3, name: "Demo Steward" })).closest("button") as HTMLElement;
    fireEvent.click(demo);
    expect(demo.getAttribute("aria-expanded")).toBe("true");
    await waitFor(() => expect(document.querySelector("[data-full-role-card], [data-seat-card]") ?? document.querySelector('[aria-labelledby="' + demo.id + '"]')).toBeTruthy());
    expect(screen.queryByRole("button", { name: ANY_COPY })).toBeNull();
    fireEvent.click((await screen.findByRole("heading", { level: 3, name: "Seed Keeper" })).closest("button") as HTMLElement);
    expect(await screen.findByRole("button", { name: COPY("Seed Keeper") })).toBeTruthy();
  });
});
