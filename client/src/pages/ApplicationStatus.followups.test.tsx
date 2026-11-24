// @vitest-environment jsdom
/**
 * The applicant follow-ups on the status page (15 Nov 2026): the "send me a new invitation" door when
 * the invitation expired, which asks and never reissues, and the closed card for an application nobody
 * answered in time, which never says "you withdrew".
 */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LANGUAGES } from "@shared/applicantWords";

vi.mock("@/components/Layout", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/modules/ModuleProvider", () => ({
  useModuleOn: () => true,
}));
vi.mock("@/components/natural/useReducedMotion", () => ({
  useReducedMotion: () => true,
  prefersReducedMotion: () => true,
}));
vi.mock("wouter", async (orig) => ({
  ...(await orig<typeof import("wouter")>()),
  useParams: () => ({ ref: "op_status_1" }),
}));

let served: Record<string, unknown> = {};
let asks: Array<{ url: string; method: string }> = [];
let askAnswer = 200;
vi.mock("@/lib/gameApi", () => ({
  gameFetch: async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      asks.push({ url, method: init.method });
      return new Response(JSON.stringify(askAnswer === 200 ? { success: true, invitation: "asked" } : { error: "no_expired_invitation" }), { status: askAnswer, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ status: served }), { status: 200, headers: { "content-type": "application/json" } });
  },
}));

import ApplicationStatus from "./ApplicationStatus";

const W = LANGUAGES.en.status;

const ADOPTED = {
  step: "decided",
  stepWords: "Decision",
  actsNext: "",
  by: null,
  roles: ["Gate Keeper"],
  path: [
    { label: "Received", state: "done" },
    { label: "Decision", state: "done" },
  ],
  booking: null,
  mode: "block",
  outcome: "adopted",
  replyMoons: 1,
  locale: "en",
};

beforeEach(() => {
  asks = [];
  askAnswer = 200;
  window.history.pushState({}, "", "/application-status/op_status_1?token=tok-123");
});
afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe("the new-invitation door", () => {
  it("shows when the invitation expired; pressing asks the team once, by the emailed link, and thanks them", async () => {
    served = { ...ADOPTED, invitation: "expired" };
    render(<ApplicationStatus />);
    const door = await screen.findByRole("button", { name: W.newInvitation.ask });
    expect(screen.getByText(W.newInvitation.line)).toBeTruthy();
    fireEvent.click(door);
    expect(await screen.findByText(W.newInvitation.asked)).toBeTruthy();
    expect(asks).toEqual([{ url: "/api/application-status/op_status_1/new-invitation?token=tok-123", method: "POST" }]);
    expect(screen.queryByRole("button", { name: W.newInvitation.ask })).toBeNull();
  });

  it("once asked, the page only thanks them, with no button to press again", async () => {
    served = { ...ADOPTED, invitation: "asked" };
    render(<ApplicationStatus />);
    expect(await screen.findByText(W.newInvitation.asked)).toBeTruthy();
    expect(screen.queryByRole("button", { name: W.newInvitation.ask })).toBeNull();
  });

  it("a refused ask says so and keeps the door", async () => {
    served = { ...ADOPTED, invitation: "expired" };
    askAnswer = 409;
    render(<ApplicationStatus />);
    fireEvent.click(await screen.findByRole("button", { name: W.newInvitation.ask }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: W.newInvitation.ask })).toBeTruthy();
  });

  it("is not offered while the invitation is open, nor without the emailed link", async () => {
    served = { ...ADOPTED, invitation: "none" };
    render(<ApplicationStatus />);
    await screen.findByRole("heading", { level: 1 });
    expect(document.querySelector("[data-new-invitation]")).toBeNull();
    cleanup();
    window.history.pushState({}, "", "/application-status/op_status_1");
    served = { ...ADOPTED, invitation: "expired" };
    render(<ApplicationStatus />);
    await screen.findByRole("heading", { level: 1 });
    expect(document.querySelector("[data-new-invitation]")).toBeNull();
  });
});

describe("the closed page", () => {
  it("an application nobody answered in time reads as closed, points to quests, and never says they withdrew", async () => {
    served = { ...ADOPTED, outcome: "withdrawn", closed: true, invitation: "none" };
    render(<ApplicationStatus />);
    expect(await screen.findByRole("heading", { level: 2, name: W.closed.heading })).toBeTruthy();
    expect(screen.getByText(W.move.closed)).toBeTruthy();
    expect(screen.getByText(W.closed.step)).toBeTruthy();
    expect(screen.getByRole("link", { name: W.closed.quests }).getAttribute("href")).toBe("/quests");
    expect(document.body.textContent).not.toContain(W.move.withdrawn);
  });

  it("a withdrawal the applicant made keeps its own words", async () => {
    served = { ...ADOPTED, outcome: "withdrawn", closed: false };
    render(<ApplicationStatus />);
    expect(await screen.findByText(W.move.withdrawn)).toBeTruthy();
    expect(document.querySelector("[data-application-closed]")).toBeNull();
  });
});
