// @vitest-environment jsdom
/**
 * MEET YOUR COMPANION (approved design, 14 Nov 2026): the egg beats save what
 * the member chose through their own routes, a lens is stored only with a yes,
 * Skip for now keeps the beat, and the tour lights real sections and drops one
 * the page does not show.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { CompanionView } from "@shared/companionItems";
import type { WelcomePayload } from "@shared/companionPersona";

const calls: { path: string; method: string; body: any }[] = [];
vi.mock("@/lib/gameApi", () => ({
  gameFetch: async (path: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, method: String(init.method ?? "GET"), body });
    const lenses = path.includes("companion-lenses") && init.method === "PUT" ? [{ lens: "own", data: body.data, note: "x", updatedAt: "" }] : [];
    return { ok: true, json: async () => ({ lenses, state: null }) } as Response;
  },
}));
vi.mock("@/components/MicButton", () => ({ default: () => null }));

import CompanionWelcome from "./CompanionWelcome";

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

const payload: WelcomePayload = { state: null, lenses: [], geneKeys: null };
const army = [companion({}), companion({ id: "r1", scope: "role", scopeId: "treasurer", name: "Ledger", scopeLine: "Treasurer companion", look: { source: "choose", pet: "star", tint: "leaf" } })];

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const saved = (beat: number, status: string) => calls.some((c) => c.path === "/api/me/companion-welcome" && c.method === "PUT" && c.body.beat === beat && c.body.status === status);

describe("CompanionWelcome", () => {
  it("walks the egg: arrival, a name, a character, and saves each on the member's own rows", async () => {
    render(<CompanionWelcome firstName="Rowan" companions={army} payload={payload} startBeat={0} onTab={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Welcome, Rowan." })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Speak aloud" }));
    expect(saved(1, "open")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Juniper" }));
    expect(calls.some((c) => c.path === "/api/me/companions/c1" && c.body?.name === "Juniper")).toBe(true);
    expect(screen.getByText("Juniper? Juniper! Oh, I love it. Juniper it is. You can rename me any time.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next: who you'll be" }));

    fireEvent.click(screen.getByRole("button", { name: /Plain Talker/ }));
    expect(screen.getByText("“Two tasks due Friday. Start with the invoice.”")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Never nag" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const persona = calls.find((c) => c.path === "/api/me/companions/c1" && c.body?.persona)?.body.persona;
    expect(persona).toMatchObject({ character: "plain", help: ["cheer", "no-nag"] });
  });

  it("stores a lens only with the yes ticked, and says what it changes first", async () => {
    render(<CompanionWelcome firstName="Rowan" companions={army} payload={payload} startBeat={3} onTab={() => {}} onClose={() => {}} />);
    // Gene Keys is offered only when the module is on (geneKeys non-null).
    expect(screen.queryByRole("button", { name: "Gene Keys" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "In your own words" }));
    fireEvent.change(screen.getByPlaceholderText("Night owl. Short messages. Love metaphors."), { target: { value: "Short messages please" } });
    expect(screen.getByText('I\'ll remember, in your words: "Short messages please"')).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Yes, use this/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add lens" }));
    expect(screen.getByRole("alert").textContent).toBe("Tick the box to say yes first.");
    expect(calls.some((c) => c.path.startsWith("/api/me/companion-lenses"))).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: /Yes, use this/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add lens" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/me/companion-lenses/own" && c.body.consent === true && c.body.data.text === "Short messages please")).toBe(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "Next (1 added)" })).toBeTruthy());
  });

  it("meets the family: each role companion is named, and shares the persona unless told not to", () => {
    render(<CompanionWelcome firstName="Rowan" companions={army} payload={payload} startBeat={4} onTab={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Name for the Treasurer companion"), { target: { value: "Tally" } });
    fireEvent.click(screen.getByRole("button", { name: "Start the tour" }));
    const body = calls.find((c) => c.path === "/api/me/companions/r1")?.body;
    expect(body).toMatchObject({ name: "Tally", persona: { character: "sidekick" } });
  });

  it("Skip for now keeps the beat and closes", () => {
    const onClose = vi.fn();
    render(<CompanionWelcome firstName="Rowan" companions={army} payload={payload} startBeat={2} onTab={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(saved(2, "skipped")).toBe(true);
    expect(onClose).toHaveBeenCalledWith("skipped", 2, "Pip");
  });

  it("the tour opens each section's tab, lights what is there and drops what is not", async () => {
    const tabs: string[] = [];
    // Only the companions section is on this page.
    const sec = document.createElement("section");
    sec.id = "companions";
    document.body.appendChild(sec);
    Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get() { return this.id === "companions" ? document.body : null; } });
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    render(<CompanionWelcome firstName="Rowan" companions={army} payload={payload} startBeat={5} onTab={(t) => tabs.push(t)} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Here's where Pip, Ledger live/)).toBeTruthy(), { timeout: 3000 });
    expect(tabs).toContain("quests");
    expect(screen.getByRole("img", { name: "Section 1 of 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText(/you're paid for what you truly got done/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(saved(7, "done")).toBe(true);
    expect(screen.getByRole("heading", { name: "Pip is yours." })).toBeTruthy();
  });
});
