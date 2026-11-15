// @vitest-environment jsdom
/**
 * A page chunk that did not arrive reloads once, quietly, and then shows the
 * "just updated" card instead of a blank page. Any other error keeps the
 * ordinary error page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import ErrorBoundary from "./ErrorBoundary";
import { RELOAD_MARKER, resetStaleChunkStateForTests } from "@/lib/staleChunk";

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
    expect(screen.getByRole("alert").textContent).toBe("We just updated the site");
    expect(screen.getByRole("button", { name: /reload/i })).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/reset");
  });

  it("keeps the ordinary error page for an ordinary bug", () => {
    mount(new Error("something else"));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("This page didn't load");
  });
});
