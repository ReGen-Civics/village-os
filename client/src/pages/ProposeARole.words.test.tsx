// @vitest-environment jsdom
/**
 * FEWER WORDS, ONE STEP COUNT, A REPLY PROMISE (the lead, 20 Nov 2026; ideas 7, 16 and 18), on /propose-a-role:
 *
 *   - the start says the real step count, from the steps themselves, and "About 25 minutes. You can answer by
 *     voice."; that line, the limits line and the remember box's two lines are said on the first step only
 *   - the AI transcription line and its switch show once, on the first voice field
 *   - the role's aim folds under "About the role" on every step but The terms
 *   - The terms name the settings nobody wrote in one line, never a block each
 *   - Review & submit: four short lines, the full wording behind "More"
 *   - the sent page says "We reply within N days." with N from the server, never typed
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { STONES } from "@/components/fireflyPath/stones";
import { forgetTranscriptionOn } from "@/components/voice/VoiceStepMore";
import { SETUP, fillValue, sendNow, stoneNow } from "@/test/proposeStones";
import { OPEN_AI_DRAFTS, OPEN_WORDS } from "@shared/openProposals";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ user: null }) }));

import ProposeARole from "./ProposeARole";

const LETTER = { version: "lv-0123456789abcdef", title: "Membership agreement", body: "Dear friend, welcome home.", intent: "I align with the Membership agreement.", parts: {} };
const FORM = {
  open: true,
  village: "Test Village",
  season: { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01" },
  goals: [{ id: "g-team", text: "Build the team" }],
  roles: [
    { id: "r-gate", name: "Gate Keeper", circle: "Anchor Circle", aim: "Open the gate at dawn.", terms: { words: { term: "One season.", ending: "A moon's notice." }, commitmentPct: 50 } },
    { id: "r-host", name: "Welcome Host", circle: "Anchor Circle", aim: "Meet every newcomer." },
  ],
  founding: SETUP,
  voice: { max: 12, seconds: 120 },
};

class FakeRecorder {
  static isTypeSupported() {
    return true;
  }
}

function serve(answer: unknown = { sent: true, replyMoons: 5 }) {
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({}) } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("voice-transcribe")) return new Response(JSON.stringify({ on: true }), { status: 200 });
      if (init?.method === "POST") return new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } });
      if (String(url).startsWith("/api/membership-letter")) return new Response(JSON.stringify(LETTER), { status: 200 });
      if (String(url).startsWith("/api/profile/alignments")) return new Response(JSON.stringify({ alignments: [] }), { status: 200 });
      return new Response(JSON.stringify(FORM), { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
}

const settle = async () => {
  for (let i = 0; i < 10; i += 1) await act(async () => void (await new Promise((r) => setTimeout(r, 0))));
};

const open = async () => {
  forgetTranscriptionOn();
  window.history.pushState({}, "", "/propose-a-role?role=r-gate");
  serve();
  render(<ProposeARole />);
  await screen.findByRole("heading", { level: 1, name: /^Apply: / });
  await settle();
};
const next = () => fireEvent.click(document.querySelector("[data-stone-next]") as HTMLElement);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("one step count and a time, said once at the start", () => {
  it("says the steps the form has and about 25 minutes, by voice if you like; then the notes step aside", async () => {
    await open();
    expect(document.querySelector("[data-apply-lede]")?.textContent).toBe(`${STONES.length} steps. About 25 minutes. You can answer by voice. No account needed.`);
    expect(document.querySelectorAll("[data-stone]")).toHaveLength(STONES.length);
    expect(document.querySelector("[data-limits-at-top]")).toBeTruthy();
    expect((document.getElementById("propose-remember-hint") as HTMLElement).hidden).toBe(false);
    expect(document.querySelector("[data-step-trail]")?.getAttribute("aria-label")).toBe(`The ${STONES.length} steps of your application`);
    next();
    expect(stoneNow()).toBe("about");
    expect(document.querySelector("[data-apply-lede]")).toBeNull();
    expect(document.querySelector("[data-limits-at-top]")).toBeNull();
    // The box itself stays, so it can still be unticked.
    expect(screen.getByLabelText("Remember my answers on this device")).toBeTruthy();
    expect((document.getElementById("propose-remember-hint") as HTMLElement).hidden).toBe(true);
  });
});

describe("said once", () => {
  it("the AI line and its switch show once, on the voice card, and move to the first answer when the card is skipped", async () => {
    await open();
    expect(document.querySelectorAll("[data-voice-ai-line]")).toHaveLength(1);
    expect(document.querySelector("[data-voice-invite] [data-voice-ai-line]")).toBeTruthy();
    expect(document.querySelectorAll("[data-voice-auto-switch]")).toHaveLength(1);
    fireEvent.click(document.querySelector("[data-voice-skip]") as HTMLElement);
    await settle();
    expect(document.querySelectorAll("[data-voice-ai-line]")).toHaveLength(1);
    expect(document.querySelector('[data-voice-clip="why"] [data-voice-ai-line]')).toBeTruthy();
  });

  it("the role's aim folds under About the role, and opens on The terms", async () => {
    await open();
    const beside = () => document.querySelector("[data-role-beside]") as HTMLElement;
    expect(beside().querySelector("[data-role-beside-folded]")).toBeTruthy();
    expect((beside().querySelector("details") as HTMLDetailsElement).open).toBe(false);
    const terms = document.querySelector('[data-stone="terms"]') as HTMLElement;
    // The terms: every setting nobody wrote, in one line, and no block of its own.
    expect(terms.querySelectorAll("[data-set-together]")).toHaveLength(1);
    expect(terms.querySelector("[data-set-together]")?.textContent).toBe("We'll set these together: Rhythm, Allowance, Bonus, Goals, How we track progress.");
    expect(terms.querySelector('[data-term="bonus"]')).toBeNull();
    expect(terms.querySelector('[data-term="term"]')?.textContent).toContain("One season.");
    // The commitment keeps its row under Time.
    expect(terms.querySelector('[data-term="clocks"] [data-commitment]')).toBeTruthy();
  });

  it("Review & submit: four short lines, the AI line whole, the full wording behind More", async () => {
    await open();
    const review = document.querySelector('[data-stone="review"] [data-review-promises]') as HTMLElement;
    expect(review.querySelectorAll("li")).toHaveLength(4);
    expect(review.querySelector("[data-ai-drafts]")?.textContent).toBe(OPEN_AI_DRAFTS);
    const more = review.querySelector("details") as HTMLDetailsElement;
    expect(more.open).toBe(false);
    expect(more.querySelector("[data-kept-for]")?.textContent).toMatch(/we remove your name and email 90 days later/);
  });

  it("Your value offers the season's goals in each item's choice alone", async () => {
    await open();
    const value = document.querySelector('[data-stone="value"]') as HTMLElement;
    expect(value.querySelector("[data-season-goals]")).toBeNull();
    expect(value.textContent?.match(/Build the team/g)).toHaveLength(1);
  });
});

describe("a reply promise (idea 18)", () => {
  it("the sent page says they will hear within one moon cycle, once it is sent (the lead, 24 Nov 2026)", async () => {
    await open();
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.nameLabel), { target: { value: "Rowan" } });
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.emailLabel), { target: { value: "rowan@example.test" } });
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.whyLabel), { target: { value: "The gate is always shut." } });
    fireEvent.click(screen.getByLabelText(/agree to the background check/i));
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.aimLabel), { target: { value: "The gate opens at dawn." } });
    fillValue();
    fireEvent.change(screen.getByLabelText("Your commitment"), { target: { value: "50" } });
    for (const g of Array.from(document.querySelectorAll('[data-stone="terms"] [role="radiogroup"]'))) fireEvent.click(g.querySelector("input") as HTMLInputElement);
    fireEvent.click(await screen.findByLabelText(LETTER.intent));
    fireEvent.click(screen.getByLabelText(/confidentiality agreement before I see/));
    sendNow();
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeTruthy();
    expect(document.querySelector("[data-reply-promise]")?.textContent).toBe("You'll hear from us within one moon cycle.");
  });
});
