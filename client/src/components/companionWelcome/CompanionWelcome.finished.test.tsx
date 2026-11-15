// @vitest-environment jsdom
/**
 * A FINISHED WELCOME STAYS FINISHED (H7, Rye 15 Nov 2026). Two tabs: the member
 * finishes the welcome in one while the other is still open at an earlier beat.
 * When the old tab saves, the server refuses the step back with the finished
 * state (409), and the old tab closes and reloads to it: no "Pick up your
 * welcome" card comes back. A replay of a finished welcome saves nothing but done.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { CompanionView } from "@shared/companionItems";
import { welcomeMoveRefused, type WelcomeState } from "@shared/companionPersona";

/** The server's copy of the welcome, which both tabs share. */
let saved: WelcomeState | null = null;
const puts: { beat: number; status: string }[] = [];
let welcomeReads = 0;

vi.mock("@/lib/gameApi", () => ({
  gameFetch: async (path: string, init?: { method?: string; body?: string }) => {
    let status = 200;
    let json: unknown = { lenses: [] };
    if (path === "/api/me/companions") json = { companions: army };
    else if (path === "/api/me/companion-welcome" && init?.method === "PUT") {
      const next = JSON.parse(String(init.body)) as { beat: number; status: WelcomeState["status"] };
      puts.push(next);
      // The server's rule, the same function the route calls.
      if (welcomeMoveRefused(saved, next)) {
        status = 409;
        json = { error: "You already finished your welcome.", state: saved };
      } else {
        saved = { ...next, at: "now" };
        json = { state: saved };
      }
    } else if (path === "/api/me/companion-welcome") {
      welcomeReads++;
      json = { state: saved, lenses: [], geneKeys: null };
    }
    return { ok: status < 400, status, json: async () => json } as Response;
  },
}));
vi.mock("@/components/MicButton", () => ({ default: () => null }));

import CompanionWelcomeMount from "./CompanionWelcomeMount";

i18n.load("en", {});
i18n.activate("en");
const render = (ui: ReactElement) => rtlRender(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);

const army = [
  {
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
    persona: { character: "plain", dials: {}, help: [], speak: false },
    dailyCap: 3,
    status: "active",
    sortOrder: 0,
    questions: [],
    drafts: [],
    heldCount: 0,
    doneThisWeek: [],
  } as unknown as CompanionView,
];

beforeEach(() => {
  saved = { beat: 2, status: "skipped", at: "earlier" };
  puts.length = 0;
  welcomeReads = 0;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
  vi.stubGlobal("speechSynthesis", { speak: () => {}, cancel: () => {} });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  window.location.hash = "";
});

/** Tab B: the member resumed the welcome here, before finishing it in tab A. */
async function openStaleTab() {
  render(<CompanionWelcomeMount firstName="Rowan" onTab={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Resume" }));
  await screen.findByRole("button", { name: "Skip for now" }, { timeout: 5000 });
  // Tab A finishes the welcome on the server.
  saved = { beat: 7, status: "done", at: "tab A" };
}

describe("a finished welcome stays finished, across two tabs", () => {
  it("the old tab's skip is refused, and the old tab reloads to finished: no Pick up card", async () => {
    await openStaleTab();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await waitFor(() => expect(welcomeReads).toBe(2));
    expect(puts.at(-1)).toMatchObject({ status: "skipped" });
    expect(saved).toMatchObject({ beat: 7, status: "done" });
    await waitFor(() => expect(screen.queryByRole("region", { name: "Pick up your welcome" })).toBeNull());
    expect(screen.queryByRole("dialog", { name: "Meet your companion" })).toBeNull();
  });

  it("the old tab's next step is refused, and the old tab closes and reloads", async () => {
    await openStaleTab();
    const forward = screen.getAllByRole("button").find((b) => /^(Next|Continue|Looks good)/.test(b.textContent?.trim() ?? ""));
    expect(forward, "a button that moves the welcome on").toBeTruthy();
    fireEvent.click(forward as HTMLButtonElement);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Meet your companion" })).toBeNull());
    expect(puts.at(-1)).toMatchObject({ status: "open" });
    expect(saved).toMatchObject({ beat: 7, status: "done" });
    await waitFor(() => expect(welcomeReads).toBe(2));
    expect(screen.queryByRole("region", { name: "Pick up your welcome" })).toBeNull();
  });

  it("a replay of a finished welcome saves no step back at all", async () => {
    saved = { beat: 7, status: "done", at: "earlier" };
    window.location.hash = "#meet-your-companion";
    render(<CompanionWelcomeMount firstName="Rowan" onTab={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Skip for now" }, { timeout: 5000 }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Skip for now" })).toBeNull());
    expect(puts).toEqual([]);
    expect(screen.queryByRole("region", { name: "Pick up your welcome" })).toBeNull();
  });
});
