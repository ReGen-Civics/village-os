// @vitest-environment jsdom
/**
 * The reference form on the applicant's status page (shared/applicantOnboarding.ts): shown once a
 * shortlisted applicant is asked, sent by the emailed link, answered with a count and never the
 * details back, and in the applicant's own language.
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
let posts: Array<{ url: string; body: any }> = [];
let answer: { status: number; body: unknown } = { status: 200, body: { success: true, given: 1 } };
vi.mock("@/lib/gameApi", () => ({
  gameFetch: async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts.push({ url, body: JSON.parse(String(init.body ?? "{}")) });
      return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ status: served }), { status: 200, headers: { "content-type": "application/json" } });
  },
}));

import ApplicationStatus, { ReferenceForm } from "./ApplicationStatus";

const EN = LANGUAGES.en.status.referenceForm;
const ES = LANGUAGES.es.status.referenceForm;

const WAITING = {
  step: "interview",
  stepWords: "Conversation",
  actsNext: "The next conversation is arranged once the last one is written up.",
  by: null,
  roles: ["Lead Steward"],
  path: [
    { label: "Received", state: "done" },
    { label: "References", state: "now" },
    { label: "Decision", state: "later" },
  ],
  booking: null,
  mode: "split",
  outcome: null,
  replyDays: 7,
  locale: "en",
  referencesAsked: { given: null, mayAdd: true },
};

beforeEach(() => {
  posts = [];
  answer = { status: 200, body: { success: true, given: 1 } };
  window.history.pushState({}, "", "/application-status/op_status_1?token=tok-123");
});
afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe("the reference form", () => {
  it("shows once asked, sends the rows by the emailed link, and then says how many, never who", async () => {
    served = { ...WAITING };
    render(<ApplicationStatus />);
    expect(await screen.findByRole("heading", { level: 2, name: EN.heading })).toBeTruthy();
    expect(screen.getByText(EN.privacy)).toBeTruthy();
    // Three rows to start, and the minimum said (the lead, 19 Nov 2026: at least two, we prefer three).
    expect(document.querySelectorAll("[data-reference-row]")).toHaveLength(3);
    expect(document.querySelector("[data-reference-how-many]")?.textContent).toBe(EN.howMany);
    fireEvent.change(screen.getAllByLabelText(EN.name)[0], { target: { value: "Ana Reference" } });
    fireEvent.change(screen.getAllByLabelText(EN.contact)[0], { target: { value: "ana@example.test" } });
    fireEvent.change(screen.getAllByLabelText(EN.how)[0], { target: { value: "We built a garden." } });
    fireEvent.change(screen.getAllByLabelText(EN.name)[1], { target: { value: "Ben Reference" } });
    fireEvent.change(screen.getAllByLabelText(EN.contact)[1], { target: { value: "ben@example.test" } });
    fireEvent.change(screen.getAllByLabelText(EN.how)[1], { target: { value: "He hired me." } });
    fireEvent.click(screen.getByRole("button", { name: EN.send }));
    expect(await screen.findByText(EN.given(1))).toBeTruthy();
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe("/api/application-status/op_status_1/references?token=tok-123");
    expect(posts[0].body.references[0]).toMatchObject({ name: "Ana Reference", contact: "ana@example.test", how: "We built a garden." });
    expect(document.querySelector("[data-reference-form]")).toBeNull();
    expect(document.body.textContent).not.toContain("ana@example.test");
  });

  it("a refused row says why in the applicant's words and keeps the form", async () => {
    served = { ...WAITING };
    answer = { status: 400, body: { error: "contact", row: 0 } };
    render(<ApplicationStatus />);
    fireEvent.click(await screen.findByRole("button", { name: EN.send }));
    expect((await screen.findByRole("alert")).textContent).toBe(EN.errors.contact);
    expect(document.querySelector("[data-reference-form]")).not.toBeNull();
  });

  it("adds rows up to ten (the lead, 19 Nov 2026)", async () => {
    served = { ...WAITING };
    render(<ApplicationStatus />);
    const add = await screen.findByRole("button", { name: EN.add });
    for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole("button", { name: EN.add }));
    expect(document.querySelectorAll("[data-reference-row]")).toHaveLength(10);
    expect(add).toBeTruthy();
    expect(screen.queryByRole("button", { name: EN.add })).toBeNull();
  });

  it("speaks the language it is handed: every word comes from the applicant's word set", () => {
    render(<ReferenceForm postUrl="/x" words={ES} onGiven={() => {}} />);
    expect(screen.getByRole("heading", { level: 2, name: ES.heading })).toBeTruthy();
    expect(screen.getByRole("button", { name: ES.send })).toBeTruthy();
    expect(screen.getAllByLabelText(ES.contact).length).toBe(3);
    expect(screen.getByText(ES.howMany)).toBeTruthy();
  });

  it("a single reference is refused in the applicant's words (too_few)", async () => {
    served = { ...WAITING };
    answer = { status: 400, body: { error: "too_few" } };
    render(<ApplicationStatus />);
    fireEvent.click(await screen.findByRole("button", { name: EN.send }));
    expect((await screen.findByRole("alert")).textContent).toBe(EN.errors.too_few);
  });

  it("is not offered before references are asked for, nor after they are given", async () => {
    served = { ...WAITING, referencesAsked: null };
    render(<ApplicationStatus />);
    await screen.findByRole("heading", { level: 1 });
    expect(document.querySelector("[data-reference-form]")).toBeNull();
    cleanup();
    served = { ...WAITING, referencesAsked: { given: 2, mayAdd: false } };
    render(<ApplicationStatus />);
    expect(await screen.findByText(EN.given(2))).toBeTruthy();
    expect(document.querySelector("[data-reference-form]")).toBeNull();
  });
});
