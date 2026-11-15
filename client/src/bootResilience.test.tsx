// @vitest-environment jsdom
/**
 * EVERY BOOT API ANSWERS 500, AND NO PAGE IS EVER BLANK (performance QA sweep,
 * resilience P1-1).
 *
 * The home page, /steward and /visit wait on /api/game/config so neither
 * village's page flashes on the other's. One failed read used to be kept for
 * the page's whole life, so a single 500 left all three blank for good. This
 * boots the whole app with every request failing and holds that each one ends
 * on words a visitor can act on, and that a config that answers on a later try
 * draws the page itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { CONFIG_RETRY_DELAYS_MS, resetGameConfigForTests } from "@/lib/gameApi";
import App from "./App";

const ALL_TRIES_MS = CONFIG_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0) + 500;
const CARD = "We couldn't reach the village just now";

const fail = () => new Response(JSON.stringify({ error: "boom" }), { status: 500, headers: { "Content-Type": "application/json" } });

/** A config with the story pages off: the neutral welcome page is the home page. */
const CONFIG = { project: { name: "Hollow Oak", tagline: "A test village" }, brochurePages: false, brochureHidden: [] };

function boot(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

/** What a visitor can read: never empty, and never only the loading words. */
const visibleText = () => (document.body.textContent ?? "").replace(/\s+/g, " ").trim();

beforeEach(() => {
  resetGameConfigForTests();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("every boot API answers 500", () => {
  for (const path of ["/", "/steward", "/visit"]) {
    it(`${path} ends on the try-again card, never a blank page`, async () => {
      const calls: string[] = [];
      vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
        calls.push(String(url));
        return fail();
      }));
      boot(path);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ALL_TRIES_MS);
      });
      expect((await screen.findByText(CARD)).getAttribute("role")).toBe("alert");
      expect(visibleText()).toContain(CARD);
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      // It asked more than once before giving up.
      expect(calls.filter((u) => u.includes("/api/game/config")).length).toBe(CONFIG_RETRY_DELAYS_MS.length + 1);
    });
  }
});

describe("a config that answers on a later try", () => {
  it("draws the home page and no card", async () => {
    let configTries = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("/api/game/config")) {
        configTries += 1;
        if (configTries < 3) return fail();
        return new Response(JSON.stringify(CONFIG), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return fail();
    }));
    boot("/");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ALL_TRIES_MS);
    });
    await waitFor(() => expect(visibleText()).toContain("A test village"));
    expect(screen.queryByText(CARD)).toBeNull();
    expect(configTries).toBe(3);
  });

  it("is not kept as a failure: the card's button asks again and the page comes back", async () => {
    let up = false;
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("/api/game/config") && up) {
        return new Response(JSON.stringify(CONFIG), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return fail();
    }));
    boot("/");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ALL_TRIES_MS);
    });
    const again = await screen.findByRole("button", { name: "Try again" });
    up = true;
    await act(async () => {
      again.click();
      await vi.advanceTimersByTimeAsync(100);
    });
    await waitFor(() => expect(visibleText()).toContain("A test village"));
    expect(screen.queryByText(CARD)).toBeNull();
  });
});
