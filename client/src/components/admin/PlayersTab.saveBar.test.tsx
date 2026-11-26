// @vitest-environment jsdom
/**
 * PLAYERS ON THE ONE SAVE BAR (the lead, 25 Nov 2026): picking an access or a
 * stage on a card used to act at once. It now waits on the page's one bar, so
 * a slip on a select changes nobody's access. Save runs each change through
 * its own route, and the confirm questions still ask at Save: a "no" keeps the
 * change on the bar instead of sending it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { resetUnsavedForTests } from "@/lib/unsavedChanges";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me", role: "founder" }, loading: false }) }));

import PlayersTab from "./PlayersTab";

const PLAYERS = [
  { id: "a", name: "Ada", email: "ada@village.test", handle: null, role: "member", paths: [], joinedAt: "2026-11-01T00:00:00Z", balance: 0, stageComputed: "s1", stageGranted: null },
  { id: "b", name: "Bea", email: "bea@village.test", handle: null, role: "member", paths: [], joinedAt: "2026-11-02T00:00:00Z", balance: 0, stageComputed: "s1", stageGranted: null },
];

let puts: { url: string; body: any }[];
/** Founder is offered only before the Game starts (PlayerCard.tsx). */
let started = true;
beforeEach(() => {
  puts = [];
  started = true;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    if (init?.method === "PUT") {
      puts.push({ url: u, body: JSON.parse(String(init.body)) });
      return ok({ success: true });
    }
    if (u.endsWith("/admin/players")) return ok(PLAYERS);
    if (u.endsWith("/game/config")) return ok({ stages: [{ id: "s1", name: "Seed" }, { id: "s2", name: "Sprout" }], paths: [] });
    if (u.endsWith("/game/mechanics")) return ok({ gameStart: { started } });
    // Every other panel on the tab reads its own route; here they find nothing.
    return { ok: false, status: 404, json: async () => ({}) };
  }));
});
afterEach(() => {
  cleanup();
  resetUnsavedForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const card = (name: string) => screen.getByLabelText(`Select ${name}`).closest("article")!;
const barSave = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
};

describe("Players on the one save bar", () => {
  it("holds an access change and a stage change on one bar, and one Save sends both", async () => {
    render(<PlayersTab password="pw" />);
    const access = (await screen.findByLabelText("Access for Ada")) as HTMLSelectElement;
    fireEvent.change(access, { target: { value: "admin" } });
    fireEvent.click(within(card("Bea")).getByLabelText("Sprout"));
    // Nothing is sent by picking.
    expect(puts).toEqual([]);
    expect(await screen.findByText("2 changes not saved yet")).toBeTruthy();
    await barSave();
    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts).toEqual(expect.arrayContaining([
      { url: "/api/admin/users/a/role", body: { role: "admin" } },
      { url: "/api/admin/players/b/stage", body: { stageId: "s2" } },
    ]));
  });

  it("asks before making a founder at Save, and a no keeps the change on the bar unsent", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    started = false;
    render(<PlayersTab password="pw" />);
    fireEvent.change(await screen.findByLabelText("Access for Ada"), { target: { value: "founder" } });
    expect(window.confirm).not.toHaveBeenCalled();
    await barSave();
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText(/Not changed: you answered no\./)).toBeTruthy();
    expect(screen.getByText("1 change not saved yet")).toBeTruthy();
    expect(puts).toEqual([]);
  });
});
