// @vitest-environment jsdom
/**
 * Your quests on the profile (the lead, 27 Nov 2026): every quest the member
 * is doing, the newest few the village consented to (the short Quests card
 * carried those until it left My work), and the open quests suited to their
 * roles, each opening the quest's own page. Nothing to list draws nothing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

i18n.load("en", {});
i18n.activate("en");

const gameFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/gameApi", () => ({ gameFetch }));

import YourQuests from "./YourQuests";

afterEach(() => {
  cleanup();
  gameFetch.mockReset();
});

const claim = (id: string, status: "claimed" | "submitted" | "consented" | "declined", extra: Record<string, unknown> = {}) => ({
  id: `c-${id}`, questId: id, questTitle: `Quest ${id}`, status, claimedAt: "2026-11-20T10:00:00.000Z", artifactUrl: "", note: "", ...extra,
});

const view = (claims: ReturnType<typeof claim>[]) =>
  render(
    <I18nProvider i18n={i18n}>
      <Router>
        <YourQuests claims={claims as any} />
      </Router>
    </I18nProvider>,
  );

describe("your quests", () => {
  it("lists what the member is doing and what suits their roles, each opening the quest", async () => {
    gameFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ quests: [{ id: "bees", title: "Tend the hives", circle: null, why: "role" }] }) });
    view([claim("swale", "claimed"), claim("mulch", "submitted"), claim("old", "consented"), claim("back", "claimed", { submittedAt: "2026-11-26T09:00:00.000Z" })]);
    expect(screen.getByRole("link", { name: /Quest swale/ }).getAttribute("href")).toBe("/quests/swale");
    // The board's sprout: a quest in hand carries the same mark it wears on the board.
    expect(screen.getByRole("link", { name: /Quest swale/ }).querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("link", { name: /Quest mulch/ }).textContent).toContain("Turned in. Waiting on a steward.");
    expect(screen.getByRole("link", { name: /Quest back/ }).textContent).toContain("Taken back to change.");
    expect(screen.getByRole("link", { name: /Quest old/ }).textContent).toContain("Done");
    await waitFor(() => expect(screen.getByRole("link", { name: /Tend the hives/ }).getAttribute("href")).toBe("/quests/bees"));
    expect(gameFetch).toHaveBeenCalledWith("/api/game/quests/suited");
  });

  it("keeps the newest three done, newest first, and leaves a returned claim out", async () => {
    gameFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ quests: [] }) });
    view([
      claim("a", "consented", { resolvedAt: "2026-10-01T10:00:00.000Z" }),
      claim("b", "consented", { resolvedAt: "2026-11-01T10:00:00.000Z" }),
      claim("c", "consented", { resolvedAt: "2026-11-10T10:00:00.000Z" }),
      claim("d", "consented", { resolvedAt: "2026-11-20T10:00:00.000Z" }),
      claim("e", "declined"),
    ]);
    const done = screen.getAllByRole("link").filter((a) => a.getAttribute("data-your-quest") === "consented");
    expect(done.map((a) => a.getAttribute("href"))).toEqual(["/quests/d", "/quests/c", "/quests/b"]);
    // One short line with the day, and the board's own mark beside each row (a flower only for this moon).
    expect(done[0]!.textContent).toContain("Done · 20 Nov");
    expect(done.every((a) => a.firstElementChild?.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(screen.queryByRole("link", { name: /Quest e/ })).toBeNull();
    await waitFor(() => expect(gameFetch).toHaveBeenCalled());
  });

  it("draws nothing with nothing in hand, nothing done and nothing suited", async () => {
    gameFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ quests: [] }) });
    const { container } = view([claim("old", "declined")]);
    await waitFor(() => expect(gameFetch).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
