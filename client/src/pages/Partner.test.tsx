// @vitest-environment jsdom
/**
 * BECOME A PARTNER (the lead, 23 Nov 2026): no account needed, the submissions pipeline as `partner`, its honeypot,
 * and the other ways to build once it is sent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const sent: Array<{ type: string; data: any; hp: string }> = [];
let answer = { ok: true as boolean, idea: null };
vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/gameApi", () => ({ useGameConfig: () => ({ contributorReplyDays: 9, project: { name: "Riverbend" } }) }));
vi.mock("@/lib/brochure", () => ({ useStoryPageShown: () => () => false }));
vi.mock("@/lib/proposals", () => ({
  sendProposal: async (type: string, data: unknown, hp: string) => {
    sent.push({ type, data, hp });
    return answer;
  },
}));

import Partner from "./Partner";

beforeEach(() => {
  sent.length = 0;
  answer = { ok: true, idea: null };
});
afterEach(cleanup);

const fill = () => {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: " Ana Lima " } });
  fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "ana@example.org" } });
  fireEvent.change(screen.getByLabelText("Your project or business"), { target: { value: "River Kitchen" } });
  fireEvent.click(document.querySelector('[data-serves="village"]') as HTMLElement);
  fireEvent.click(document.querySelector('[data-serves="thriving"]') as HTMLElement);
  fireEvent.change(screen.getByLabelText("What you offer"), { target: { value: "Meals for work days" } });
  fireEvent.change(screen.getByLabelText("What you would like from the village"), { target: { value: "A kitchen day a month" } });
};

describe("the partner form", () => {
  it("says what a partner brings and gets back, and when they hear, in the village's days", () => {
    render(<Partner />);
    expect(screen.getByRole("heading", { level: 1, name: "Become a partner" })).toBeTruthy();
    expect(screen.getByText("No account needed.")).toBeTruthy();
    expect(screen.getByText("Local nonprofits can partner with the village too, including to share in its profits.")).toBeTruthy();
    expect(document.querySelector("[data-route-promise]")?.textContent).toBe("You'll hear within 9 days.");
  });

  it("sends a partner proposal with every field, trimmed, and then offers the other three ways", async () => {
    render(<Partner />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /Send your proposal/ }));
    await waitFor(() => expect(document.querySelector("[data-partner-sent]")).toBeTruthy());
    expect(sent).toEqual([{ type: "partner", hp: "", data: { name: "Ana Lima", email: "ana@example.org", project: "River Kitchen", link: "", serves: ["village", "thriving"], offer: "Meals for work days", wish: "A kitchen day a month", source: "contributor_route", route: "partner" } }]);
    expect(Array.from(document.querySelectorAll("[data-route-door]")).map((a) => a.getAttribute("data-route-door"))).toEqual(["team", "venture", "quest"]);
  });

  it("CONTROL: sends nothing until what the partnership serves is chosen, and says so", () => {
    render(<Partner />);
    fill();
    fireEvent.click(document.querySelector('[data-serves="village"]') as HTMLElement);
    fireEvent.click(document.querySelector('[data-serves="thriving"]') as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: /Send your proposal/ }));
    expect(sent).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toBe("Choose at least one thing the partnership serves.");
  });

  it("passes the honeypot through for the server to drop, and keeps the form when sending fails", async () => {
    answer = { ok: false, idea: null };
    render(<Partner />);
    fill();
    fireEvent.change(document.querySelector('input[name="website"]') as HTMLElement, { target: { value: "bot" } });
    fireEvent.click(screen.getByRole("button", { name: /Send your proposal/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("That didn't send. Try again in a few minutes."));
    expect(sent[0].hp).toBe("bot");
    expect(document.querySelector("[data-partner-form]")).toBeTruthy();
  });
});
