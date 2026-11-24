// @vitest-environment jsdom
/**
 * The festivals page says nothing about the calendar until it has read it.
 *
 * It used to print "The season calendar hasn't been set yet" on every cold
 * load, a false statement on a village that has one, and then drop the "Now"
 * card in above it and shove the calendar 298px down a phone screen. The
 * empty-calendar sentence is still the right answer once the read lands with
 * no seasons, and that half is pinned too.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/modules/ModuleProvider", () => ({ useModule: () => null }));
const shownPages = vi.hoisted(() => ({ list: [] as string[] }));
vi.mock("@/lib/brochure", () => ({ useBrochurePages: () => false, useStoryPageShown: () => (href: string) => shownPages.list.includes(href) }));

import SeasonalFestivals from "./SeasonalFestivals";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

function answerWith(fn: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(fn));
}

afterEach(() => {
  vi.unstubAllGlobals();
  shownPages.list = [];
  cleanup();
});

const NOT_SET = /calendar hasn't been set yet/;

describe("SeasonalFestivals", () => {
  it("makes no claim about the calendar while the season is still being read", () => {
    answerWith(() => new Promise<Response>(() => {}));
    render(<SeasonalFestivals />);
    expect(screen.queryByText(NOT_SET)).toBeNull();
  });

  it("says the calendar is unset once the read lands with no seasons", async () => {
    answerWith(async () => json({ current: null, seasons: [] }));
    render(<SeasonalFestivals />);
    expect(await screen.findByText(NOT_SET)).toBeTruthy();
  });

  it("shows the season now under way, and on the calendar, once read", async () => {
    const season = { id: "s1", name: "Season of Foundations", startsOn: "2026-09-01", endsOn: "" };
    answerWith(async () => json({ current: season, seasons: [season] }));
    render(<SeasonalFestivals />);
    expect(await screen.findAllByText("Season of Foundations")).toHaveLength(2);
    expect(screen.queryByText(NOT_SET)).toBeNull();
  });

  it("still says the calendar is unset after a failed read", async () => {
    answerWith(async () => {
      throw new Error("offline");
    });
    render(<SeasonalFestivals />);
    expect(await screen.findByText(NOT_SET)).toBeTruthy();
  });

  describe("the steward path under this season's goals (the lead, 24 Nov 2026)", () => {
    const season = {
      id: "s1",
      name: "Season of Foundations",
      startsOn: "2026-09-01",
      endsOn: "",
      goals: [{ text: "Plant the food forest" }, { text: "Open the first home", done: true }],
    };
    const INVITE = /If you can help us meet these, consider the/;

    it("keeps the goals public and invites the reader to the Village Steward path", async () => {
      shownPages.list = ["/steward"];
      answerWith(async () => json({ current: season, seasons: [season] }));
      render(<SeasonalFestivals />);
      expect(await screen.findByText("Plant the food forest")).toBeTruthy();
      // One card per goal (the lead, 24 Nov 2026): a reached goal wears the seal and says so.
      const reached = screen.getByText("Open the first home").closest("li")!;
      expect(reached.hasAttribute("data-done")).toBe(true);
      expect(reached.textContent).toContain("Reached");
      const growing = screen.getByText("Plant the food forest").closest("li")!;
      expect(growing.hasAttribute("data-done")).toBe(false);
      expect(growing.textContent).toContain("Growing");
      const invite = screen.getByText(INVITE);
      expect(invite.textContent).toBe("If you can help us meet these, consider the Village Steward path.");
      expect(screen.getByRole("link", { name: "Village Steward path" }).getAttribute("href")).toBe("/steward");
    });

    it("CONTROL: says nothing about the path where the village keeps no /steward page", async () => {
      answerWith(async () => json({ current: season, seasons: [season] }));
      render(<SeasonalFestivals />);
      expect(await screen.findByText("Plant the food forest")).toBeTruthy();
      expect(screen.queryByText(INVITE)).toBeNull();
    });

    it("CONTROL: says nothing about the path when the season has no goals", async () => {
      shownPages.list = ["/steward"];
      const bare = { ...season, goals: [] };
      answerWith(async () => json({ current: bare, seasons: [bare] }));
      render(<SeasonalFestivals />);
      expect(await screen.findAllByText("Season of Foundations")).toHaveLength(2);
      expect(screen.queryByText(INVITE)).toBeNull();
    });
  });
});
