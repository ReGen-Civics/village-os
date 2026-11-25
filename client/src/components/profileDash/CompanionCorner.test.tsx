// @vitest-environment jsdom
/**
 * The companions' corner (Direction D): the animals stand together bottom right, each in its painting, with
 * a count of drafts waiting; a tap opens the companions panel as a dialog; Escape closes it and focus comes
 * back; a member with no companions has no corner at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CompanionView } from "@shared/companionItems";

const gameFetch = vi.fn();
vi.mock("@/lib/gameApi", () => ({ gameFetch: (...args: unknown[]) => gameFetch(...args) }));
vi.mock("./YourCompanions", () => ({ default: () => <div data-stub="your-companions" /> }));

import CompanionCorner from "./CompanionCorner";

const companion = (over: Partial<CompanionView>): CompanionView =>
  ({
    id: "c1",
    scope: "personal",
    scopeId: "",
    provider: "village",
    engine: "Maia",
    engineConnected: true,
    chatEngine: "Maia",
    outsideEngine: "Sera",
    name: "Scarlet",
    scopeLine: "Personal companion",
    look: { source: "nature", art: "scarlet-macaw" },
    lookUrl: null,
    persona: null,
    dailyCap: 3,
    status: "active",
    sortOrder: 0,
    questions: [],
    drafts: [],
    heldCount: 0,
    doneThisWeek: [],
    ...over,
  }) as CompanionView;

const answer = (companions: CompanionView[]) => Promise.resolve({ ok: true, status: 200, json: async () => ({ companions }) });

beforeEach(() => {
  gameFetch.mockReset();
  window.history.replaceState(null, "", "/profile");
});
afterEach(() => cleanup());

describe("CompanionCorner", () => {
  it("stands each companion in its painting, and names them and what waits", async () => {
    gameFetch.mockImplementation(() =>
      answer([
        companion({ drafts: [{ id: "d1", status: "open" } as never] }),
        companion({ id: "c2", scope: "role", name: "Hammerhead", sortOrder: 1, look: { source: "nature", art: "hammerhead-shark" } }),
      ]),
    );
    render(<CompanionCorner />);
    const button = await screen.findByRole("button", { name: "Your companions: Scarlet, Hammerhead. One draft waits for your yes." });
    const srcs = Array.from(button.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
    expect(srcs[0]).toContain("scarlet-macaw");
    expect(srcs[1]).toContain("hammerhead-shark");
    expect(button.id).toBe("companions");
  });

  it("opens the panel as a dialog, and Escape closes it and returns focus", async () => {
    gameFetch.mockImplementation(() => answer([companion({})]));
    render(<CompanionCorner />);
    const button = await screen.findByRole("button", { name: "Your companions: Scarlet" });
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Your companions" })).toBeTruthy();
    expect(await screen.findByText((_, el) => el?.getAttribute("data-stub") === "your-companions")).toBeTruthy();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close your companions");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens straight away from a link to /profile#companions", async () => {
    window.history.replaceState(null, "", "/profile#companions");
    gameFetch.mockImplementation(() => answer([companion({})]));
    render(<CompanionCorner />);
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Your companions" })).toBeTruthy());
  });

  it("is absent for a member with no companions, and while they are read", async () => {
    gameFetch.mockImplementation(() => answer([]));
    const { container } = render(<CompanionCorner />);
    await waitFor(() => expect(gameFetch).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });
});
