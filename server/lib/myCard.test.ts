/**
 * Today's card for one member (shared/myCard.ts): the browser's sky checked as a session pull checks it, the
 * member's own chart, the day's draw kept in their prefs, and the guide's weaving behind both of the member's
 * yeses. Invented birth, real arithmetic; the model is a stub that records what it was sent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chartAt, skyAt, zonedToUtc } from "../../shared/geneKeysSky";
import { MY_CARD_PREFS_KEY, MY_CARD_REFUSALS, type MyCard } from "../../shared/myCard";

const lines = vi.fn();
const letGuide = vi.fn();
vi.mock("./geneKeys", () => ({ ownLinesFor: (...a: unknown[]) => lines(...a), letGuideUseLines: (...a: unknown[]) => letGuide(...a) }));
vi.mock("./assistantUsage", () => ({ recordAssistantUsage: vi.fn(async () => undefined) }));
vi.mock("./identity", () => ({ instanceIdentity: () => ({ instanceId: "test" }) }));

import { cardDisclosure, withConsent } from "./companionConsent";
import { pullTodayCard, readTodayCard, consentToCard, type MyCardDeps } from "./myCard";

const WREN = chartAt(zonedToUtc(1990, 6, 15, 14, 30, "America/New_York"));
const DATE = "2024-08-05";
const SKY = JSON.parse(JSON.stringify(skyAt(new Date(`${DATE}T12:00:00Z`))));
const NOW = Date.parse(`${DATE}T17:00:00Z`);
const KEYED = { PLATFORM_ASSISTANT_KEY: "test-key", PLATFORM_ASSISTANT_OPERATOR: "Op" } as NodeJS.ProcessEnv;

function harness(env: NodeJS.ProcessEnv = KEYED, reply?: string) {
  let prefs: Record<string, unknown> = {};
  const call = vi.fn(async (_req: { system: string; messages: unknown; prefetch: unknown; mode: string; userId: string }) => ({
    ok: true as const,
    text: reply ?? JSON.stringify({ focus: "Let your Radiance show", paragraphs: ["The sky meets your card today.", "Take the day as it comes."] }),
    keySource: "platform" as const,
    usage: { inputTokens: 1, outputTokens: 1 },
    stopReason: "end_turn",
    iterations: 1,
    toolsUsed: [],
  }));
  const deps: MyCardDeps = {
    getPool: () => ({}) as never,
    villageName: () => "Testvale",
    guideName: () => "Sol",
    updateMember: async (_id, mutate) => {
      const m = { prefs };
      mutate(m);
      prefs = m.prefs as Record<string, unknown>;
      return m;
    },
    call: call as never,
    memberKey: async () => null,
    env,
  };
  return { deps, call, prefs: () => prefs, setPrefs: (p: Record<string, unknown>) => (prefs = p) };
}

const body = (extra: Record<string, unknown> = {}) => ({ date: DATE, sky: SKY, today: { quests: 2, decisions: 1, season: { name: "Dry", day: 3, of: 90 } }, ...extra });

beforeEach(() => {
  lines.mockReset();
  letGuide.mockReset();
});

describe("pulling today's card", () => {
  it("draws, keeps and answers the same card all day, without the guide when the member has not said yes", async () => {
    lines.mockResolvedValue({ chart: WREN, maia: false });
    const h = harness();
    const first = await pullTodayCard(h.deps, { id: "7", prefs: h.prefs() }, body(), NOW);
    if (!first.ok) throw new Error(first.error);
    expect(first.value.card?.reading.source).toBe("plain");
    expect(first.value.consent.state).toBe("ask");
    expect(h.call).not.toHaveBeenCalled();
    expect((h.prefs()[MY_CARD_PREFS_KEY] as MyCard).date).toBe(DATE);
    expect(first.value.card?.reading.paragraphs.join(" ")).toContain("decision waits on you");

    // Later the same day, a different sky and different counts: the same card, from the kept slot.
    const later = await pullTodayCard(h.deps, { id: "7", prefs: h.prefs() }, body({ sky: { ...SKY, moonPhase: 0.9 }, today: {} }), NOW + 3600_000);
    if (!later.ok) throw new Error(later.error);
    expect(later.value.card).toEqual(first.value.card);
    const read = await readTodayCard(h.deps, { id: "7", prefs: h.prefs() }, DATE, NOW);
    if (!read.ok) throw new Error(read.error);
    expect(read.value.card).toEqual(first.value.card);
  });

  it("weaves the card only with both yeses, and sends counts and chart facts, never a title or a name", async () => {
    lines.mockResolvedValue({ chart: WREN, maia: true });
    const h = harness();
    h.setPrefs(withConsent({}, cardDisclosure("platform", null, "Testvale", KEYED), new Date(NOW).toISOString()));
    const out = await pullTodayCard(h.deps, { id: "7", prefs: h.prefs() }, body(), NOW);
    if (!out.ok) throw new Error(out.error);
    expect(out.value.consent.state).toBe("given");
    expect(out.value.card?.reading).toEqual({ focus: "Let your Radiance show", paragraphs: ["The sky meets your card today.", "Take the day as it comes."], source: "guide" });
    // What goes upstream: the system prompt, the message and the prefetched facts. The member id rides only
    // on the limiter's keys and the usage row, which stay on this server.
    const req = h.call.mock.calls[0][0] as { system: string; messages: unknown; prefetch: unknown };
    const sent = JSON.stringify([req.system, req.messages, req.prefetch]);
    expect(sent).toContain("questsInHand");
    expect(sent).not.toMatch(/"7"|Testvale|Rowan/);
    expect(h.call.mock.calls[0][0]).toMatchObject({ mode: "card", userId: "7" });
  });

  it("does not weave for a member who said yes to the provider but not to the guide using their lines", async () => {
    lines.mockResolvedValue({ chart: WREN, maia: false });
    const h = harness();
    h.setPrefs(withConsent({}, cardDisclosure("platform", null, "Testvale", KEYED), new Date(NOW).toISOString()));
    const out = await pullTodayCard(h.deps, { id: "7", prefs: h.prefs() }, body(), NOW);
    if (!out.ok) throw new Error(out.error);
    expect(out.value.consent.state).toBe("ask");
    expect(h.call).not.toHaveBeenCalled();
  });

  it("keeps the plain words when the guide adds a number the facts do not hold", async () => {
    lines.mockResolvedValue({ chart: WREN, maia: true });
    const h = harness(KEYED, JSON.stringify({ focus: "Seven doors open", paragraphs: ["In 3 days, gate 999 opens for you."] }));
    h.setPrefs(withConsent({}, cardDisclosure("platform", null, "Testvale", KEYED), new Date(NOW).toISOString()));
    const out = await pullTodayCard(h.deps, { id: "7", prefs: h.prefs() }, body(), NOW);
    if (!out.ok) throw new Error(out.error);
    expect(h.call).toHaveBeenCalledTimes(1);
    expect(out.value.card?.reading.source).toBe("plain");
  });

  it("asks nothing on a village with no key, and serves the plain card", async () => {
    lines.mockResolvedValue({ chart: WREN, maia: true });
    const h = harness({} as NodeJS.ProcessEnv);
    const out = await pullTodayCard(h.deps, { id: "7", prefs: h.prefs() }, body(), NOW);
    if (!out.ok) throw new Error(out.error);
    expect(out.value.consent).toEqual({ state: "none" });
    expect(h.call).not.toHaveBeenCalled();
  });

  it("refuses a sky not read at the day's noon, a date off the clock, and a member with no lines", async () => {
    lines.mockResolvedValue({ chart: WREN, maia: false });
    const h = harness();
    expect(await pullTodayCard(h.deps, { id: "7" }, body({ sky: { ...SKY, moonPhase: 1.5 } }), NOW)).toEqual({ ok: false, status: 400, error: MY_CARD_REFUSALS.badSky });
    expect(await pullTodayCard(h.deps, { id: "7" }, body({ date: "2024-08-09" }), NOW)).toEqual({ ok: false, status: 400, error: MY_CARD_REFUSALS.badDate });
    lines.mockResolvedValue(null);
    expect(await pullTodayCard(h.deps, { id: "7" }, body(), NOW)).toEqual({ ok: false, status: 404, error: MY_CARD_REFUSALS.noLines });
  });
});

describe("the one tap", () => {
  it("records the yes to the line shown and lets the guide use the lines; a changed line is refused", async () => {
    lines.mockResolvedValue({ chart: WREN, maia: false });
    const h = harness();
    const ask = await readTodayCard(h.deps, { id: "7", prefs: h.prefs() }, DATE, NOW);
    if (!ask.ok || ask.value.consent.state !== "ask") throw new Error("expected an ask");
    expect(ask.value.consent.sentence).toContain("never titles or names");
    const stale = await consentToCard(h.deps, { id: "7", prefs: h.prefs() }, { ...ask.value.consent, operator: "Someone else" }, NOW);
    expect(stale).toEqual({ ok: false, status: 409, error: MY_CARD_REFUSALS.stale });
    const out = await consentToCard(h.deps, { id: "7", prefs: h.prefs() }, ask.value.consent, NOW);
    expect(out).toEqual({ ok: true, value: { consent: { state: "given" } } });
    expect(letGuide).toHaveBeenCalledWith(expect.anything(), "7");
    lines.mockResolvedValue({ chart: WREN, maia: true });
    const after = await readTodayCard(h.deps, { id: "7", prefs: h.prefs() }, DATE, NOW);
    expect(after.ok && after.value.consent).toEqual({ state: "given" });
  });
});
