// @vitest-environment jsdom
/**
 * Sending a report replaces the form, and the button that sent it, with a
 * "Received" panel. Before, focus fell to <body> and a screen reader heard
 * nothing at all, so the person could not tell whether it had gone.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import Feedback from "./Feedback";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Feedback, once it is sent", () => {
  it("moves focus to the panel that says it was received", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => (url === "/api/feedback/config" ? { relayOn: false, villageName: "Hollow Oak" } : { shared: false }),
    })));
    const user = userEvent.setup();
    render(<Feedback />);
    await user.type(screen.getByLabelText(/what went wrong/i), "The map is blank");
    await user.type(screen.getByLabelText(/what did you do/i), "Opened it on a phone and waited.");
    await user.click(screen.getByRole("button", { name: /send it/i }));

    const panel = (await screen.findByText(/received, thank you/i)).closest("div[tabindex]") as HTMLElement;
    expect(panel).toBeTruthy();
    expect(document.activeElement).toBe(panel);
  });
});

describe("the kind of feedback (the five-reviewer QA pass, 25 Nov 2026)", () => {
  it("says which kind is chosen with aria-pressed, and moves it on a press", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ relayOn: false, villageName: "Hollow Oak" }) })));
    const user = userEvent.setup();
    render(<Feedback />);
    const broke = screen.getByRole("button", { name: /Something broke/ });
    const idea = screen.getByRole("button", { name: /An idea/ });
    expect(broke.getAttribute("aria-pressed")).toBe("true");
    expect(idea.getAttribute("aria-pressed")).toBe("false");
    await user.click(idea);
    expect(idea.getAttribute("aria-pressed")).toBe("true");
    expect(broke.getAttribute("aria-pressed")).toBe("false");
  });
});

