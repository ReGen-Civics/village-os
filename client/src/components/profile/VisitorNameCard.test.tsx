// @vitest-environment jsdom
/**
 * "Show my first name to visitors": the box shows the stored answer (absent reads as on), saves through
 * /api/me/privacy, and moves only when the server saved it. The server is what hides the name; this only asks.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const gameFetch = vi.fn();
vi.mock("@/lib/gameApi", () => ({ gameFetch: (...args: unknown[]) => gameFetch(...args) }));

import VisitorNameCard from "./VisitorNameCard";

const answer = (body: unknown, status = 200) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });

// A block body: a returned function would run as a teardown, and calling the mock there waits on whatever it last answered.
beforeEach(() => {
  gameFetch.mockReset();
});

describe("VisitorNameCard", () => {
  it("reads as on when the server sends the flag on, and says what a visitor sees", async () => {
    gameFetch.mockImplementation(() => answer({ privacy: { showFirstNameToVisitors: true } }));
    render(<VisitorNameCard />);
    const box = (await screen.findByLabelText("Show my first name to visitors")) as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(screen.getByText(/they see "A member" instead/)).toBeTruthy();
  });

  it("reads an absent flag as on, its default", async () => {
    gameFetch.mockImplementation(() => answer({ privacy: { showInventory: false } }));
    render(<VisitorNameCard />);
    expect(((await screen.findByLabelText("Show my first name to visitors")) as HTMLInputElement).checked).toBe(true);
  });

  it("turns it off through /api/me/privacy", async () => {
    gameFetch.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? answer({ privacy: JSON.parse(String(init.body)) }) : answer({ privacy: { showFirstNameToVisitors: true } }),
    );
    render(<VisitorNameCard />);
    const box = (await screen.findByLabelText("Show my first name to visitors")) as HTMLInputElement;
    await userEvent.click(box);
    expect(gameFetch).toHaveBeenCalledWith("/api/me/privacy", expect.objectContaining({ method: "PUT", body: JSON.stringify({ showFirstNameToVisitors: false }) }));
    await waitFor(() => expect(box.checked).toBe(false));
  });

  it("stays where it was and says so when the save fails", async () => {
    gameFetch.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? answer({ error: "no" }, 500) : answer({ privacy: { showFirstNameToVisitors: true } }),
    );
    render(<VisitorNameCard />);
    const box = (await screen.findByLabelText("Show my first name to visitors")) as HTMLInputElement;
    await userEvent.click(box);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(box.checked).toBe(true);
  });

  it("draws nothing until the stored answer arrives, so it never shows a guess", async () => {
    let arrive: (v: unknown) => void = () => {};
    gameFetch.mockImplementation(() => new Promise((resolve) => (arrive = resolve)));
    const { container } = render(<VisitorNameCard />);
    expect(container.innerHTML).toBe("");
    arrive({ ok: true, status: 200, json: async () => ({ privacy: { showFirstNameToVisitors: false } }) });
    expect(((await screen.findByLabelText("Show my first name to visitors")) as HTMLInputElement).checked).toBe(false);
  });
});
