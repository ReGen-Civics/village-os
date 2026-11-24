// @vitest-environment jsdom
/**
 * A page chunk that did not arrive reloads once, quietly, and then shows the
 * "just updated" card instead of a blank page. Any other error keeps the
 * ordinary error page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import ErrorBoundary from "./ErrorBoundary";
import { RELOAD_MARKER, resetStaleChunkStateForTests } from "@/lib/staleChunk";
import { RELOAD_QUOTES } from "@shared/reloadQuotes";

i18n.load("en", {});
i18n.activate("en");

function Boom({ error }: { error: Error }): never {
  throw error;
}

const reload = vi.fn();

function mount(error: Error) {
  return render(
    <I18nProvider i18n={i18n}>
      <ErrorBoundary>
        <Boom error={error} />
      </ErrorBoundary>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
  window.sessionStorage.clear();
  reload.mockClear();
  resetStaleChunkStateForTests();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const stale = () => new TypeError("Importing a module script failed.");

describe("ErrorBoundary and a page that outlived a deploy", () => {
  it("reloads once for a missing chunk and shows no card while it does", () => {
    mount(stale());
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(RELOAD_MARKER)).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the reload card when the chunk fails again right after that reload", () => {
    window.sessionStorage.setItem(RELOAD_MARKER, String(Date.now()));
    mount(stale());
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("The site just grew");
    expect(screen.getByRole("button", { name: /refresh the page/i })).toBeTruthy();
    expect(screen.getByText(/Nothing is broken/)).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/reset");
  });

  it("keeps the ordinary error page for an ordinary bug", () => {
    mount(new Error("something else"));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("This page didn't load");
  });
});

describe("a chunk that fails while offline (performance QA sweep, resilience P2-4)", () => {
  it("does not reload, and says the device is offline instead of claiming an update", () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    mount(stale());
    expect(reload).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(RELOAD_MARKER)).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("You're offline");
    expect(screen.getByText("We'll keep your answers. When you're back online, tap try again.")).toBeTruthy();
    expect(screen.queryByText("The site just grew")).toBeNull();

    // Still offline: the button says so and reloads nothing.
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Still offline. Check your connection.");

    // Back online: the same button loads the page again.
    online.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("the refresh screen (public launch, 24 Nov 2026)", () => {
  it("shows one big refresh button that reloads, and a quote with who said it", async () => {
    window.sessionStorage.setItem(RELOAD_MARKER, String(Date.now()));
    vi.spyOn(Math, "random").mockReturnValue(0);
    mount(stale());
    fireEvent.click(screen.getByRole("button", { name: /refresh the page/i }));
    expect(reload).toHaveBeenCalledTimes(1);
    const first = RELOAD_QUOTES[0];
    expect(await screen.findByText(first.text)).toBeTruthy();
    expect(screen.getByText(first.source)).toBeTruthy();
  });

  it("gives the crash screen the same button, a way home, and the stack tucked away", () => {
    mount(new Error("something else"));
    expect(screen.getByRole("button", { name: /refresh the page/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /home page/i }).getAttribute("href")).toBe("/");
    expect(screen.getByText("Details for a bug report")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).not.toContain("Error");
  });

  it("does not show the same quote twice running in one tab", async () => {
    window.sessionStorage.setItem(RELOAD_MARKER, String(Date.now()));
    vi.spyOn(Math, "random").mockReturnValue(0);
    mount(stale());
    expect(await screen.findByText(RELOAD_QUOTES[0].text)).toBeTruthy();
    cleanup();
    mount(stale());
    expect(await screen.findByText(RELOAD_QUOTES[1].text)).toBeTruthy();
  });

  it("offers no quote on the offline card, whose file could not arrive anyway", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    mount(stale());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("figure")).toBeNull();
  });

  it("speaks the Spanish rendering to a Spanish reader", async () => {
    window.sessionStorage.setItem(RELOAD_MARKER, String(Date.now()));
    vi.spyOn(Math, "random").mockReturnValue(0);
    i18n.load("es", {});
    i18n.activate("es");
    try {
      mount(stale());
      expect(await screen.findByText(RELOAD_QUOTES[0].es)).toBeTruthy();
    } finally {
      i18n.activate("en");
    }
  });
});
