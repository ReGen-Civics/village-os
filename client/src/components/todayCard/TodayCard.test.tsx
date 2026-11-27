// @vitest-environment jsdom
/**
 * Today's card on the profile (Direction D): absent without lines; face down with a door to the draw before the
 * day's card is drawn; its name and focus once it is, with the door reading "Open your card". The draw itself is
 * the page's (/profile/today-card), so the profile never draws a second card.
 */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const gameFetch = vi.fn();
vi.mock("@/lib/gameApi", () => ({ gameFetch: (...args: unknown[]) => gameFetch(...args) }));

import TodayCard from "./TodayCard";

const answer = (body: unknown, status = 200) => Promise.resolve({ ok: status < 300, status, json: async () => body });

beforeEach(() => gameFetch.mockReset());
afterEach(() => cleanup());

describe("TodayCard", () => {
  it("is absent for a member with no lines", async () => {
    gameFetch.mockImplementation(() => answer({ error: "Find your lines first, and the card reads them." }, 404));
    const { container } = render(<TodayCard />);
    await waitFor(() => expect(gameFetch).toHaveBeenCalled());
    expect(String(gameFetch.mock.calls[0][0])).toMatch(/^\/api\/me\/today-card\?date=\d{4}-\d{2}-\d{2}$/);
    expect(container.innerHTML).toBe("");
  });

  it("lies face down with a door to the draw before the day's card is drawn", async () => {
    gameFetch.mockImplementation(() => answer({ card: null, consent: { state: "none" } }));
    render(<TodayCard />);
    const door = await screen.findByRole("link", { name: "Pull today's card" });
    expect(door.getAttribute("href")).toBe("/profile/today-card");
    expect(document.querySelector("[data-today-card]")?.getAttribute("data-today-card")).toBe("down");
    expect(gameFetch.mock.calls.every(([, init]) => !init || (init as RequestInit).method !== "POST")).toBe(true);
  });

  it("shows the day's card by name and focus once it is drawn", async () => {
    gameFetch.mockImplementation(() =>
      answer({ card: { card: { name: "Radiance", gate: 12 }, reading: { focus: "What keeps you well" } }, consent: { state: "given" } }),
    );
    render(<TodayCard />);
    expect(await screen.findByText("Radiance")).toBeTruthy();
    expect(screen.getByText("What keeps you well")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open your card" }).getAttribute("href")).toBe("/profile/today-card");
    expect(document.querySelector("[data-today-card]")?.getAttribute("data-today-card")).toBe("up");
  });
});
