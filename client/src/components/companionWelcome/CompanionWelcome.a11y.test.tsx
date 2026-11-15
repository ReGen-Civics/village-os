// @vitest-environment jsdom
/**
 * MEET YOUR COMPANION, for a keyboard and a screen reader (the accessibility
 * sweep, 14 Nov 2026): the stage is really modal (the page behind it is inert,
 * the lens sheet takes focus and gives it back), the tour keeps focus on Next
 * from stop to stop, nothing is said aloud before the member chooses, and
 * closing the welcome puts focus back where it was.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { CompanionView } from "@shared/companionItems";
import type { WelcomePayload, WelcomeState } from "@shared/companionPersona";

let welcomeState: WelcomeState | null = null;
vi.mock("@/lib/gameApi", () => ({
  gameFetch: async (path: string) => {
    const json = path === "/api/me/companions" ? { companions: army } : path === "/api/me/companion-welcome" ? { state: welcomeState, lenses: [], geneKeys: null } : { lenses: [] };
    return { ok: true, json: async () => json } as Response;
  },
}));
vi.mock("@/components/MicButton", () => ({ default: () => null }));

import CompanionWelcome from "./CompanionWelcome";
import CompanionWelcomeMount from "./CompanionWelcomeMount";

i18n.load("en", {});
i18n.activate("en");
const render = (ui: ReactElement) => rtlRender(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);

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
    name: "Pip",
    scopeLine: "Personal companion",
    look: { source: "choose", pet: "horns", tint: "gold" },
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

const army = [companion({})];
const payload = { state: null, lenses: [], geneKeys: { has: true, profile: "4/6", hdType: "Generator", guideUses: true } } as unknown as WelcomePayload;
const spoken: string[] = [];
const open = (startBeat: number, onClose = () => {}) => render(<CompanionWelcome firstName="Rowan" companions={army} payload={payload} startBeat={startBeat} onTab={() => {}} onClose={onClose} />);

beforeEach(() => {
  spoken.length = 0;
  welcomeState = null;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  vi.stubGlobal("speechSynthesis", { speak: (u: { text: string }) => spoken.push(u.text), cancel: () => {} });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("CompanionWelcome, for a keyboard and a screen reader", () => {
  it("makes the page behind the stage inert while it is open, and frees it after", () => {
    const behind = document.createElement("main");
    document.body.appendChild(behind);
    const view = open(1);
    expect(behind.hasAttribute("inert")).toBe(true);
    expect(screen.getByRole("dialog", { name: "Meet your companion" }).contains(document.activeElement)).toBe(true);
    view.unmount();
    expect(behind.hasAttribute("inert")).toBe(false);
  });

  it("says nothing aloud until the member chooses, and Quiet keeps it that way", async () => {
    vi.useFakeTimers();
    open(0);
    // The choice is the only Quiet on the arrival: the top-bar toggle waits for it.
    fireEvent.click(screen.getByRole("button", { name: "Quiet" }));
    await act(async () => vi.advanceTimersByTime(1000));
    expect(spoken).toEqual([]);
    expect(screen.getByRole("button", { name: "Quiet: on" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("speaks once Speak aloud is chosen", async () => {
    vi.useFakeTimers();
    open(0);
    fireEvent.click(screen.getByRole("button", { name: "Speak aloud" }));
    await act(async () => vi.advanceTimersByTime(1000));
    expect(spoken.some((s) => s.includes("what's my name?"))).toBe(true);
  });

  it("a welcome resumed before the choice asks it again, and is silent until answered", async () => {
    vi.useFakeTimers();
    open(1);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(spoken).toEqual([]);
    const ask = screen.getByRole("group", { name: "Should I speak aloud?" });
    fireEvent.click(ask.querySelector("button") as HTMLButtonElement);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(spoken.length).toBeGreaterThan(0);
    expect(screen.queryByRole("group", { name: "Should I speak aloud?" })).toBeNull();
  });

  it("lens buttons open a dialog and say added in words; the sheet takes focus and gives it back", async () => {
    open(3);
    const gk = screen.getByRole("button", { name: "Gene Keys, added" });
    expect(gk.getAttribute("aria-haspopup")).toBe("dialog");
    expect(gk.hasAttribute("aria-pressed")).toBe(false);
    // Human Design rides the same switch, and says so.
    expect(screen.getByRole("button", { name: "Human Design, added, with Gene Keys" })).toBeTruthy();
    const own = screen.getByRole("button", { name: "In your own words" });
    own.focus();
    fireEvent.click(own);
    const sheet = screen.getByRole("dialog", { name: /own words/i });
    expect(document.activeElement).toBe(sheet);
    // The stage behind the sheet is inert: its top bar and its beat.
    expect(screen.getByRole("button", { name: "Skip for now" }).closest("[inert]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(document.activeElement).toBe(own));
    expect(screen.getByRole("button", { name: "Skip for now" }).closest("[inert]")).toBeNull();
  });

  it("each dial says where it sits in words", () => {
    open(2);
    const dial = screen.getByRole("slider", { name: "Calm to Playful" });
    fireEvent.change(dial, { target: { value: "90" } });
    expect(dial.getAttribute("aria-valuetext")).toBe("Playful");
    fireEvent.change(dial, { target: { value: "50" } });
    expect(dial.getAttribute("aria-valuetext")).toBe("Halfway between calm and playful");
  });

  it("the tour puts focus on Next, keeps it there from stop to stop, and reads each stop out", async () => {
    for (const id of ["companions", "my-tasks"]) {
      const sec = document.createElement("section");
      sec.id = id;
      document.body.appendChild(sec);
    }
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      configurable: true,
      get() {
        return ["companions", "my-tasks"].includes(this.id) ? document.body : null;
      },
    });
    open(5);
    await waitFor(() => expect(screen.getByText(/Here's where Pip live/)).toBeTruthy(), { timeout: 3000 });
    const next = screen.getByRole("button", { name: "Next" });
    await waitFor(() => expect(document.activeElement).toBe(next));
    expect(screen.getByText(/Here's where Pip live/).closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite");

    fireEvent.click(next);
    await waitFor(() => expect(screen.getByText(/Your tasks\./)).toBeTruthy());
    // The same button, not a remounted one, so focus never fell to the page.
    expect(screen.getByRole("button", { name: "Done" })).toBe(next);
    expect(document.activeElement).toBe(next);

    // Back leaves the first stop with no Back button: focus returns to Next.
    const back = screen.getByRole("button", { name: "Back" });
    back.focus();
    fireEvent.click(back);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next" })));
  });
});

describe("CompanionWelcomeMount", () => {
  it("closing the welcome puts focus back on the control that opened it", async () => {
    welcomeState = { beat: 2, status: "skipped", at: "2026-11-14T00:00:00.000Z" };
    render(<CompanionWelcomeMount firstName="Rowan" onTab={() => {}} />);
    const resume = await screen.findByRole("button", { name: "Resume" });
    resume.focus();
    fireEvent.click(resume);
    const skip = await screen.findByRole("button", { name: "Skip for now" }, { timeout: 5000 });
    fireEvent.click(skip);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Resume" })));
  });
});
