// @vitest-environment jsdom
/**
 * THE APPLICANT'S NEXT STEP ON THEIR PROFILE (the lead, 27 Nov 2026): the same stage, next step and role-only booking
 * button as their application's page, and nothing when no application of theirs waits.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

i18n.load("en", {});
i18n.activate("en");

let served: unknown = { next: null };
vi.mock("@/lib/gameApi", () => ({
  authToken: () => "t",
  gameFetch: async () => new Response(JSON.stringify(served), { status: 200, headers: { "content-type": "application/json" } }),
}));

import ApplicationNextCard from "./ApplicationNextCard";

afterEach(cleanup);

const KEYS = ["received", "review", "references", "final_interview", "agreement", "start"] as const;
const status = (now: (typeof KEYS)[number], extra: Record<string, unknown> = {}) => ({
  step: "interview",
  actsNext: "x",
  path: [],
  booking: "x",
  mode: "split",
  outcome: null,
  sixStages: {
    stages: KEYS.map((key, i) => ({ key, state: i < KEYS.indexOf(now) ? "done" : key === now ? "now" : "later" })),
    now,
    refine: { open: false, frozen: now === "final_interview", why: "", aim: "", versions: 0 },
  },
  ...extra,
});

const draw = () =>
  render(
    <I18nProvider i18n={i18n}>
      <ApplicationNextCard />
    </I18nProvider>,
  );

describe("the applicant's next step on their profile", () => {
  it("shows the stage, the next step and the role-only booking button", async () => {
    served = { next: { ref: "op-1", status: status("final_interview", { bookNow: { role: "Visionary Channel", label: "Visionary", url: "https://cal.example.test/v", links: [{ who: null, url: "https://cal.example.test/v" }], final: true } }) } };
    draw();
    expect(await screen.findByRole("heading", { name: "Final conversation" })).toBeTruthy();
    expect(screen.getByText(/Book your final conversation with Visionary/)).toBeTruthy();
    const book = screen.getByRole("link", { name: "Book with Visionary" });
    expect(book.getAttribute("href")).toBe("https://cal.example.test/v");
    expect(screen.getByRole("link", { name: /Open your application/ }).getAttribute("href")).toBe("/application-status/op-1");
  });

  it("a later step's link never shows early: the final's button waits for the Final conversation", async () => {
    served = { next: { ref: "op-1", status: status("references", { bookNow: { role: "Visionary Channel", label: "Visionary", url: "https://cal.example.test/v", links: [{ who: null, url: "https://cal.example.test/v" }], final: true } }) } };
    draw();
    await screen.findByRole("heading", { name: "References and proposal" });
    expect(screen.queryByRole("link", { name: "Book with Visionary" })).toBeNull();
    expect(document.body.innerHTML).not.toContain("cal.example.test/v");
  });

  it("draws nothing when no application of theirs waits", async () => {
    served = { next: null };
    const { container } = draw();
    await new Promise((r) => setTimeout(r, 20));
    expect(container.innerHTML).toBe("");
  });
});
