// @vitest-environment jsdom
/**
 * /profile/today-card, PULL A CARD: face down until drawn; a draw sends the member's date, the sky at noon and
 * only the COUNTS of what waits on them; the card turns over with its focus, its reading and the day's doors;
 * the guide's one tap posts the line shown and the card is read again; a card kept from earlier today is face
 * up at once; a member with no lines is sent to find them.
 */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1", name: "Rowan Fell" } }) }));
vi.mock("@/hooks/useGuideName", () => ({ useGuideName: () => ({ name: "Sol", named: true, loaded: true }) }));
vi.mock("@/components/journey/nature", () => ({
  Fireflies: ({ children }: { children?: ReactNode }) => <>{children}</>,
  MoonPhase: () => null,
  SeedOfLife: () => null,
}));
const mods = vi.hoisted(() => ({ on: ["gene-keys", "journal", "sessions"] }));
vi.mock("@/modules/ModuleProvider", () => {
  const state = () => ({ loaded: true, failed: false, modules: mods.on.map((id) => ({ id, lifecycle: "members" })) });
  return { useModules: state, moduleIsOn: (_s: unknown, id: string) => mods.on.includes(id) };
});
vi.mock("@shared/geneKeysSky", () => ({ skyAt: (d: Date) => ({ at: d.toISOString() }) }));

const gameFetch = vi.fn();
vi.mock("@/lib/gameApi", () => ({ gameFetch: (...a: unknown[]) => gameFetch(...a) }));

import TodayCardPage from "./TodayCard";
import { localDate, localNoon } from "@/lib/todayCardApi";

const answer = (body: unknown, status = 200) => Promise.resolve({ ok: status < 300, status, json: async () => body });

const CARD = {
  date: localDate(),
  sky: { gates: { Sun: { gate: 26, line: 3 } } },
  card: { sphere: "radiance", name: "Radiance", gate: 12, line: 2, word: "Marriage", focus: "what keeps you well", touch: "sun", skyGate: null, channel: null },
  lean: "The day leans outward.",
  line: "Your line.",
  skyLines: { "human-design": "The Sun in gate 26.", western: "The Sun in Sagittarius." },
  design: { type: "Projector", authority: "Emotional", profile: "2/4", strategy: "Wait for the invitation" },
  facts: { quests: 1, tasks: 0, decisions: 1, asks: 0, sessions: 0, gatherings: 0, moon: null, season: null },
  reading: { focus: "What keeps you well", paragraphs: ["Today's Sun stands in gate 12, your Radiance."], source: "plain" },
};
const ASK = { state: "ask", provider: "Anthropic", operator: "Op", source: "platform", sentence: "To write your card in its own words, the guide sends your lines." };

/** Every door the page reads, answering as a member with one quest in hand and one consent waiting. */
function doors(overrides: Record<string, () => Promise<unknown>>) {
  gameFetch.mockImplementation((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url.split("?")[0]}`;
    if (overrides[key]) return overrides[key]();
    if (url === "/api/game/me") return answer({ quests: [{ questId: "q1", questTitle: "Mend the well", status: "claimed" }] });
    if (url === "/api/governance/waiting-on-me") return answer({ applications: [], drafts: [], toConsent: [{ proposalId: "p" }] });
    return answer({}, 404);
  });
}

beforeEach(() => {
  gameFetch.mockReset();
  mods.on = ["gene-keys", "journal", "sessions"];
});
afterEach(() => cleanup());

describe("Pull a card", () => {
  it("draws face down to face up, sending counts and never a title", async () => {
    let card = { ...CARD };
    doors({
      "GET /api/me/today-card": () => answer({ card: null, consent: ASK }),
      "POST /api/me/today-card": () => answer({ card, consent: ASK }),
    });
    render(<TodayCardPage />);
    expect((await screen.findAllByRole("button", { name: "Draw today's card" })).length).toBe(2);
    // Let the day's doors answer before the draw, so the counts ride with it.
    await waitFor(() => expect(gameFetch).toHaveBeenCalledWith("/api/governance/waiting-on-me"));
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getAllByRole("button", { name: "Draw today's card" }).at(-1)!);
    expect(await screen.findByText("What keeps you well")).toBeTruthy();
    const post = gameFetch.mock.calls.find(([u, i]) => u === "/api/me/today-card" && i?.method === "POST")!;
    const sent = JSON.parse(String(post[1].body));
    expect(sent.date).toBe(localDate());
    expect(sent.sky.at).toBe(localNoon(localDate()).toISOString());
    expect(sent.today).toMatchObject({ quests: 1, decisions: 1 });
    expect(JSON.stringify(sent)).not.toContain("Mend the well");
    expect(document.querySelector("[data-today-card-face]")?.getAttribute("data-today-card-face")).toBe("radiance");
    expect(screen.getByText("Mend the well")).toBeTruthy();
    expect(screen.getByText("A decision waits on you")).toBeTruthy();
    expect(screen.getByText("Sun-lit")).toBeTruthy();

    // The one tap: the line shown is posted, then the card is read again, now in the guide's words.
    card = { ...CARD, reading: { focus: "Let it be seen", paragraphs: ["Woven."], source: "guide" } };
    doors({
      "POST /api/me/today-card/consent": () => answer({ consent: { state: "given" } }),
      "POST /api/me/today-card": () => answer({ card, consent: { state: "given" } }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Yes, read my card" }));
    expect(await screen.findByText("Read by Sol")).toBeTruthy();
    const yes = gameFetch.mock.calls.find(([u]) => u === "/api/me/today-card/consent")!;
    expect(JSON.parse(String(yes[1].body))).toEqual({ provider: "Anthropic", operator: "Op", source: "platform" });
    expect(screen.queryByRole("button", { name: "Yes, read my card" })).toBeNull();
  });

  it("shows a card kept from earlier today face up, without drawing again", async () => {
    doors({ "GET /api/me/today-card": () => answer({ card: CARD, consent: { state: "none" } }) });
    render(<TodayCardPage />);
    expect(await screen.findByText("What keeps you well")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Draw today's card" })).toBeNull();
    expect(gameFetch.mock.calls.some(([u, i]) => u === "/api/me/today-card" && i?.method === "POST")).toBe(false);
    expect(screen.queryByText("Let Sol read your card")).toBeNull();
  });

  it("keeps the day's card in the private journal, once per day", async () => {
    doors({
      "GET /api/me/today-card": () => answer({ card: CARD, consent: { state: "none" } }),
      "POST /api/journal/entries": () => answer({ id: "e1" }),
    });
    render(<TodayCardPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Keep in my journal" }));
    expect(await screen.findByText("Kept in your journal")).toBeTruthy();
    const saved = JSON.parse(String(gameFetch.mock.calls.find(([u]) => u === "/api/journal/entries")![1].body));
    expect(saved).toMatchObject({ clientId: `today-card-${CARD.date}`, practice: "free", privacy: "private" });
  });

  it("sends a member with no lines to find them", async () => {
    doors({ "GET /api/me/today-card": () => answer({ error: "Find your lines first, and the card reads them." }, 404) });
    render(<TodayCardPage />);
    expect((await screen.findByText("Find your lines")).closest("a")?.getAttribute("href")).toBe("/profile/gene-keys");
  });
});
