// @vitest-environment jsdom
/**
 * A COPY PART THAT OUTLIVED A DEPLOY (2026-11-24).
 *
 * A tab open across a release opens a lazy page, and the page's copy part (its
 * long English, client/src/i18n/copySplit.ts) is one the new server never had:
 * `/api/i18n/catalog/en/part/<hash>` answers 404 and the part fetch rejects
 * with "copy part <hash>: 404". That used to fall through to the plain error
 * page and a crash report, which the server emailed to every admin. Now it is
 * the same case as a missing chunk: one quiet reload, no report, and if it
 * happens again right after that reload, the "just updated" card and no loop.
 *
 * The message is produced by the REAL part fetch (a stubbed `fetch` answering
 * 404), so a change to its wording breaks this file instead of quietly
 * reopening the crash emails.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { copyReady } from "@/i18n/i18n";
import { resetCrashReportsForTests } from "./crashReport";
import { RELOAD_MARKER, isChunkLoadError, resetStaleChunkStateForTests } from "./staleChunk";

i18n.load("en", {});
i18n.activate("en");

const reload = vi.fn();
const beacon = vi.fn((_url: string, _body: Blob) => true);

/** The error the real part fetch throws when the server has no such part. */
async function missingPartError(name = "kxi1ofHr6p0P"): Promise<Error> {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "no_such_part" }), { status: 404 })));
  try {
    await copyReady([name]);
  } catch (e) {
    return e as Error;
  } finally {
    vi.unstubAllGlobals();
  }
  throw new Error("the part fetch did not fail");
}

function Boom({ error }: { error: Error }): never {
  throw error;
}

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
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, pathname: "/roles", reload } });
  window.sessionStorage.clear();
  reload.mockClear();
  beacon.mockClear();
  resetStaleChunkStateForTests();
  resetCrashReportsForTests();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("a copy part the server no longer has", () => {
  it("fails with the words the stale-build check knows", async () => {
    const err = await missingPartError();
    expect(err.message).toBe("copy part kxi1ofHr6p0P: 404");
    expect(isChunkLoadError(err)).toBe(true);
  });

  it("any other status is not a stale build, and stays a crash", () => {
    expect(isChunkLoadError(new Error("copy part kxi1ofHr6p0P: 500"))).toBe(false);
    expect(isChunkLoadError(new Error("copy part kxi1ofHr6p0P was not loaded before its chunk ran"))).toBe(false);
  });

  it("reloads the page once, quietly, and sends no crash report", async () => {
    mount(await missingPartError());
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(RELOAD_MARKER)).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(beacon).not.toHaveBeenCalled();
  });

  it("right after that reload it does not reload again: the update card shows, so nothing loops", async () => {
    window.sessionStorage.setItem(RELOAD_MARKER, String(Date.now()));
    mount(await missingPartError());
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("The site just grew");
  });
});
