// @vitest-environment jsdom
/**
 * Today's card for yourself (Direction D): absent without lines, face down until pulled, then the day and the
 * member's own line, with the sky in a fold; a refusal says the server's own sentence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const gameFetch = vi.fn();
vi.mock("@/lib/gameApi", () => ({ gameFetch: (...args: unknown[]) => gameFetch(...args) }));
vi.mock("@shared/geneKeysSky", () => ({ skyAt: () => ({ at: "2026-11-25T12:00:00.000Z" }) }));

import TodayCard from "./TodayCard";

const answer = (body: unknown, status = 200) => Promise.resolve({ ok: status < 300, status, json: async () => body });
const CARD = {
  sky: { gates: { Sun: { gate: 26, line: 3 } } },
  day: "The day leans outward.",
  line: "Today's Sun stands in your gate 26.",
  skyLines: { "human-design": "The Sun in gate 26.", western: "The Sun in Sagittarius." },
};

beforeEach(() => gameFetch.mockReset());
afterEach(() => cleanup());

describe("TodayCard", () => {
  it("is absent for a member with no lines", async () => {
    gameFetch.mockImplementation(() => answer({ geneKeys: null }));
    const { container } = render(<TodayCard />);
    await waitFor(() => expect(gameFetch).toHaveBeenCalledWith("/api/gene-keys/me"));
    expect(container.innerHTML).toBe("");
  });

  it("lies face down, then a pull sends the browser's sky and turns it to the member's own line", async () => {
    gameFetch.mockImplementation((url: string) => (url === "/api/me/today-card" ? answer(CARD) : answer({ geneKeys: { type: "Generator" } })));
    render(<TodayCard />);
    const button = await screen.findByRole("button", { name: "Pull today's card" });
    expect(document.querySelector("[data-today-card]")?.getAttribute("data-today-card")).toBe("down");
    fireEvent.click(button);
    expect(await screen.findByText("Today's Sun stands in your gate 26.")).toBeTruthy();
    expect(gameFetch).toHaveBeenCalledWith("/api/me/today-card", expect.objectContaining({ method: "POST", body: JSON.stringify({ sky: { at: "2026-11-25T12:00:00.000Z" } }) }));
    expect(document.querySelector("[data-today-card]")?.getAttribute("data-today-card")).toBe("up");
    expect(screen.getByText("The day leans outward.")).toBeTruthy();
    expect(screen.getByText("The Sun in Sagittarius.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pull again" })).toBeTruthy();
  });

  it("says the server's own sentence when the pull is refused", async () => {
    gameFetch.mockImplementation((url: string) =>
      url === "/api/me/today-card" ? answer({ error: "Find your lines first, and the card reads them." }, 404) : answer({ geneKeys: { type: "Projector" } }),
    );
    render(<TodayCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Pull today's card" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Find your lines first, and the card reads them.");
  });
});
