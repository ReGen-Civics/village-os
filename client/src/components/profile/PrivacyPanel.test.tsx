// @vitest-environment jsdom
/**
 * Who sees what: every privacy flag in one panel (Direction D). Each box shows the stored answer (an absent
 * flag reads as the server's default), saves through /api/me/privacy, and moves only when the server saved it.
 * The cases of the old "Show my first name to visitors" card are kept here, since this panel replaced it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const gameFetch = vi.fn();
vi.mock("@/lib/gameApi", () => ({ gameFetch: (...args: unknown[]) => gameFetch(...args) }));

import PrivacyPanel, { PRIVACY_FALLBACK, PRIVACY_FLAGS } from "./PrivacyPanel";

const answer = (body: unknown, status = 200) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
const box = (flag: string) => document.querySelector(`[data-privacy-flag="${flag}"]`) as HTMLInputElement;

beforeEach(() => {
  gameFetch.mockReset();
});

describe("PrivacyPanel", () => {
  it("offers all seven flags, the five that had no switch among them", async () => {
    gameFetch.mockImplementation(() => answer({ privacy: { ...PRIVACY_FALLBACK } }));
    render(<PrivacyPanel />);
    await screen.findByLabelText("Show my first name to visitors");
    for (const flag of PRIVACY_FLAGS) expect(box(flag)).toBeTruthy();
    expect(PRIVACY_FLAGS).toEqual(["showFirstNameToVisitors", "showRoles", "showBadges", "showHearts", "showInventory", "showCalendar", "showHome"]);
  });

  it("reads absent flags as the server's defaults: roles, badges, standing and first name on; the rest off", async () => {
    gameFetch.mockImplementation(() => answer({ privacy: {} }));
    render(<PrivacyPanel />);
    await screen.findByLabelText("Show my first name to visitors");
    expect(box("showFirstNameToVisitors").checked).toBe(true);
    expect(box("showRoles").checked).toBe(true);
    expect(box("showBadges").checked).toBe(true);
    expect(box("showHearts").checked).toBe(true);
    expect(box("showInventory").checked).toBe(false);
    expect(box("showCalendar").checked).toBe(false);
    expect(box("showHome").checked).toBe(false);
  });

  it("turns one flag off through /api/me/privacy, sending only that flag", async () => {
    gameFetch.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? answer({ privacy: JSON.parse(String(init.body)) }) : answer({ privacy: { showFirstNameToVisitors: true } }),
    );
    render(<PrivacyPanel />);
    await userEvent.click(await screen.findByLabelText("Show my first name to visitors"));
    expect(gameFetch).toHaveBeenCalledWith("/api/me/privacy", expect.objectContaining({ method: "PUT", body: JSON.stringify({ showFirstNameToVisitors: false }) }));
    await waitFor(() => expect(box("showFirstNameToVisitors").checked).toBe(false));
  });

  it("stays where it was and says so when the save fails", async () => {
    gameFetch.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? answer({ error: "no" }, 500) : answer({ privacy: { showHome: false } }),
    );
    render(<PrivacyPanel />);
    await screen.findByLabelText("Show where I live");
    await userEvent.click(box("showHome"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(box("showHome").checked).toBe(false);
  });

  it("draws nothing until the stored answer arrives, so it never shows a guess", async () => {
    let arrive: (v: unknown) => void = () => {};
    gameFetch.mockImplementation(() => new Promise((resolve) => (arrive = resolve)));
    const { container } = render(<PrivacyPanel />);
    expect(container.innerHTML).toBe("");
    arrive({ ok: true, status: 200, json: async () => ({ privacy: { showFirstNameToVisitors: false } }) });
    expect(((await screen.findByLabelText("Show my first name to visitors")) as HTMLInputElement).checked).toBe(false);
  });
});
