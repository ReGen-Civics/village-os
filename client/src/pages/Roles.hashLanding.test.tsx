// @vitest-environment jsdom
/**
 * A LINK FROM ANOTHER PAGE LANDS ON ITS SECTION (production 1.3.56: home -> Start a venture left the reader at the top
 * of /roles, the Open ventures heading some 4750px below).
 *
 * The browser's own jump to `#open-ventures` happens before /roles has read the founding team and the roles, so there
 * is nothing to jump to. The page lands once the sections are drawn: it scrolls to the section and focuses its heading,
 * once, and holds the section in place while the founding team above it is still growing, until the reader takes over.
 * A change of hash while the page is open (the address bar, Back, a link inside the app) lands too.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/components/natural/useReducedMotion", () => ({ useReducedMotion: () => false, prefersReducedMotion: () => false }));

import Roles from "./Roles";
import { holdSection } from "@/lib/sectionAnchor";

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

/** A ResizeObserver the test drives: `grow(h)` reports the body at a new height. */
class FakeResizeObserver {
  static live: FakeResizeObserver[] = [];
  constructor(private cb: (entries: Array<{ contentRect: { height: number } }>) => void) {
    FakeResizeObserver.live.push(this);
  }
  observe() {
    this.cb([{ contentRect: { height: 1000 } }]);
  }
  unobserve() {}
  disconnect() {
    FakeResizeObserver.live = FakeResizeObserver.live.filter((o) => o !== this);
  }
  static grow(height: number) {
    for (const o of [...FakeResizeObserver.live]) o.cb([{ contentRect: { height } }]);
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
const ORG = {
  people: { visible: true, membersOnly: false, signedIn: false },
  circles: [{ id: "anchor", name: "Anchor Circle", purpose: "", status: "active" }],
  roles: [seat("finance", "Lead Finance Steward"), seat("land", "Land Steward"), seat("cook", "Village Cook"), seat("guest", "Guest House Venture Steward", { futureVenture: true, state: "forming" })],
};
const FOUNDING = { on: true, roleIds: ["finance", "land"], sections: { finance: SECTIONS, land: SECTIONS }, showPayRanges: false, villagePay: { shape: [], atRisk: "", note: "" }, fill: {} };

/** Every scroll the page asks for: which element, how, and whether that element was on the page at the time. */
let scrolls: Array<{ id: string; behavior: unknown; connected: boolean }>;
/** The two reads, answered only when the test says so. */
let answer: () => void;

beforeEach(() => {
  scrolls = [];
  FakeResizeObserver.live = [];
  vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  Element.prototype.scrollIntoView = function (this: Element, arg?: boolean | ScrollIntoViewOptions) {
    scrolls.push({ id: this.id, behavior: typeof arg === "object" ? arg.behavior : arg, connected: this.isConnected });
  } as typeof Element.prototype.scrollIntoView;
  let open: () => void = () => {};
  const gate = new Promise<void>((r) => (open = r));
  answer = () => open();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const u = String(url);
      const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
      if (u === "/api/org") return gate.then(() => reply(ORG));
      if (u === "/api/org/founding-team") return gate.then(() => reply(FOUNDING));
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

const renderRoles = (at: string) => {
  window.history.replaceState(null, "", at);
  return render(
    <Router>
      <Roles />
    </Router>,
  );
};
const ventureScrolls = () => scrolls.filter((s) => s.id === "open-ventures");

describe("arriving on /roles with a section's hash, before the page has its data", () => {
  it("scrolls to Open ventures and focuses its heading only after the section is drawn, smoothly, once", async () => {
    renderRoles("/roles#open-ventures");
    // The reads are still out: no section, no scroll, nothing focused.
    await screen.findByText("Loading roles…");
    expect(document.getElementById("open-ventures")).toBeNull();
    expect(ventureScrolls()).toHaveLength(0);

    await act(async () => answer());
    await screen.findByRole("heading", { level: 2, name: /^Open ventures/ });
    await waitFor(() => expect(document.activeElement?.id).toBe("future-ventures-heading"));
    expect(ventureScrolls()).toEqual([{ id: "open-ventures", behavior: "smooth", connected: true }]);
    // Still /roles, with its hash: an anchor is never read as an old one-role link.
    expect(window.location.pathname + window.location.hash).toBe("/roles#open-ventures");
  });

  it("holds the section while the page above it grows, and lets go the moment the reader scrolls", async () => {
    renderRoles("/roles#open-ventures");
    await act(async () => answer());
    await waitFor(() => expect(document.activeElement?.id).toBe("future-ventures-heading"));
    const section = document.getElementById("open-ventures") as HTMLElement;
    // The founding team's cards arrive above it: the section is pushed 2400px down the screen.
    section.getBoundingClientRect = () => ({ top: 2400 }) as DOMRect;
    act(() => FakeResizeObserver.grow(3400));
    expect(ventureScrolls().map((s) => s.behavior)).toEqual(["smooth", "auto"]);
    // The reader scrolls: from then on the page is theirs, however much more arrives.
    window.dispatchEvent(new Event("wheel"));
    act(() => FakeResizeObserver.grow(5200));
    expect(ventureScrolls()).toHaveLength(2);
    // The page stays still on later renders too: nothing lands a second time.
    expect(document.activeElement?.id).toBe("future-ventures-heading");
  });

  it("lands the founding team the same way", async () => {
    renderRoles("/roles#founding-team");
    expect(scrolls.filter((s) => s.id === "founding-team")).toHaveLength(0);
    await act(async () => answer());
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Join the founding team"));
    expect(scrolls.filter((s) => s.id === "founding-team")).toEqual([{ id: "founding-team", behavior: "smooth", connected: true }]);
  });
});

describe("a change of hash while /roles is open", () => {
  it("lands on the section the address bar or Back names, and on a link inside the app to /roles#...", async () => {
    renderRoles("/roles");
    await act(async () => answer());
    await screen.findByRole("heading", { level: 2, name: /^Open ventures/ });
    expect(scrolls).toHaveLength(0);

    // The address bar, or Back to an entry with the hash.
    act(() => {
      window.history.replaceState(null, "", "/roles#open-ventures");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => expect(document.activeElement?.id).toBe("future-ventures-heading"));
    expect(ventureScrolls()).toHaveLength(1);

    // A link inside the app (the router's pushState, which the browser never scrolls for).
    act(() => window.history.pushState(null, "", "/roles#founding-team"));
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Join the founding team"));
    expect(scrolls.filter((s) => s.id === "founding-team")).toHaveLength(1);
  });

  it("never lands twice on a press of the four ways, which lands first and then writes the hash", async () => {
    renderRoles("/roles");
    await act(async () => answer());
    const tile = (await screen.findAllByRole("link", { name: /^Start a venture/ }))[0];
    act(() => tile.click());
    expect(window.location.hash).toBe("#open-ventures");
    expect(document.activeElement?.id).toBe("future-ventures-heading");
    // A frame later, when a change of hash would have landed, still the one scroll.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 30));
    expect(ventureScrolls()).toHaveLength(1);
  });
});

describe("holdSection", () => {
  it("ignores the size the page already had, and lets go once the page has been still", () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = '<section id="s"></section>';
      const s = document.getElementById("s") as HTMLElement;
      s.getBoundingClientRect = () => ({ top: 900 }) as DOMRect;
      holdSection("s", { quietMs: 500, maxMs: 5000 });
      // The observer's first report moved nothing.
      expect(scrolls).toHaveLength(0);
      FakeResizeObserver.grow(1800);
      expect(scrolls).toEqual([{ id: "s", behavior: "auto", connected: true }]);
      vi.advanceTimersByTime(600);
      FakeResizeObserver.grow(2600);
      expect(scrolls).toHaveLength(1);
    } finally {
      vi.useRealTimers();
      document.body.innerHTML = "";
    }
  });

  it("leaves a section already at the top of the screen where it is", () => {
    document.body.innerHTML = '<section id="s"></section>';
    const s = document.getElementById("s") as HTMLElement;
    s.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    const release = holdSection("s");
    FakeResizeObserver.grow(1800);
    expect(scrolls).toHaveLength(0);
    release();
    document.body.innerHTML = "";
  });
});
