// @vitest-environment jsdom
/**
 * Every crash screen tells the server once (lib/crashReport.ts): the boundary
 * sends one report for a crash, and none for a stale chunk it can reload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import ErrorBoundary from "./ErrorBoundary";
import { CRASH_REPORT_FIELDS, resetCrashReportsForTests } from "@/lib/crashReport";
import { resetStaleChunkStateForTests } from "@/lib/staleChunk";

i18n.load("en", {});
i18n.activate("en");

function Boom({ error }: { error: Error }): never {
  throw error;
}

const beacon = vi.fn((_url: string, _body: Blob) => true);
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
  Object.defineProperty(window.navigator, "sendBeacon", { configurable: true, value: beacon });
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, pathname: "/propose-a-role", search: "?ref=me@example.org", reload } });
  window.sessionStorage.clear();
  beacon.mockClear();
  reload.mockClear();
  resetCrashReportsForTests();
  resetStaleChunkStateForTests();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ErrorBoundary crash reports", () => {
  it("sends exactly one report when a page crashes", async () => {
    mount(new ReferenceError("Cannot access uninitialized variable."));
    expect(screen.getByRole("alert").textContent).toContain("didn't load");
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe("/api/client-crash");
    const report = JSON.parse(await blob.text());
    expect(Object.keys(report).sort()).toEqual([...CRASH_REPORT_FIELDS].sort());
    expect(report).toMatchObject({ source: "boundary", name: "ReferenceError", message: "Cannot access uninitialized variable.", route: "/propose-a-role" });
    expect(JSON.stringify(report)).not.toContain("example.org");
  });

  it("sends nothing for a stale chunk it reloads", () => {
    mount(new TypeError("Importing a module script failed."));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(beacon).not.toHaveBeenCalled();
  });
});
