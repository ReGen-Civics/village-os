// @vitest-environment jsdom
/**
 * /reset is a link anybody can send, so opening it must never sign a member
 * out by itself (security sweep on #1245). The sign-in stays, drafts stay,
 * and signing out is a separate tap that goes through `logout`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { draftKey } from "@/components/fireflyPath/applyDraft";
import { TOKEN_KEY } from "@/lib/gameApi";

const logout = vi.fn(async () => {
  window.localStorage.removeItem(TOKEN_KEY);
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ logout }) }));
vi.mock("@/i18n/PageLanguageBar", () => ({ PageLanguageBar: () => null }));

import Reset, { HOME_AFTER_MS } from "./Reset";

i18n.load("en", {});
i18n.activate("en");

const replace = vi.fn();
const DRAFT = draftKey("role-1", "");

async function open() {
  render(
    <I18nProvider i18n={i18n}>
      <Reset />
    </I18nProvider>,
  );
  await screen.findByText(/^Done\./);
}

beforeEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, replace } });
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem(DRAFT, "{\"why\":\"my words\"}");
  window.localStorage.setItem("some-filter", "x");
  replace.mockClear();
  logout.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("/reset and the sign-in", () => {
  it("keeps a member signed in, stays on the page, and offers the sign-out", async () => {
    window.localStorage.setItem(TOKEN_KEY, "session-token");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open();

    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("session-token");
    expect(window.localStorage.getItem(DRAFT)).toBe("{\"why\":\"my words\"}");
    expect(window.localStorage.getItem("some-filter")).toBeNull();
    expect(screen.getByText("You're still signed in.")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(HOME_AFTER_MS * 4);
    });
    expect(replace).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it("signs out only on the tap, through logout, then goes home", async () => {
    window.localStorage.setItem(TOKEN_KEY, "session-token");
    await open();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Also sign me out" }));
    });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(DRAFT)).not.toBeNull();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("goes home by itself when nobody was signed in", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open();
    expect(screen.queryByRole("button", { name: "Also sign me out" })).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(HOME_AFTER_MS);
    });
    expect(replace).toHaveBeenCalledWith("/");
    expect(logout).not.toHaveBeenCalled();
  });
});
