/**
 * Today's card for one member (shared/myCard.ts says what it is and why).
 *
 *   - The sky comes from the browser, read at noon UTC of the card's date, and is checked as a session pull
 *     checks it; the chart is the member's own and never leaves this file except as the facts of their own card.
 *   - The draw is seeded by the member and the date and weighed by the sky at noon UTC of that date, so it is the
 *     same all day on every device. The first pull of a date keeps the card in the member's own prefs, by date
 *     (`MY_CARD_PREFS_KEY`, the last `MY_CARD_KEEP_DAYS` dates), so every later read that day answers the same
 *     card without asking anybody again. A plain card's "what waits on you" row is rebuilt from the day's counts
 *     on a later pull, so a draw tapped before the counts arrived is not stuck saying nothing waits.
 *   - The plain reading is always there. The village guide weaves the same facts into its own words only when
 *     the member said yes to both the guide using their lines and the provider line that names who runs the
 *     model (`cardDisclosure`). Nothing of theirs goes upstream before that, and a woven reading that is cut off,
 *     too long, adds a number the facts do not hold, or trips the house voice check is thrown away and the plain
 *     one stands.
 *   - The model call is the guide engine's own (`callAssistant`, mode `card`, its day budget, the per-account
 *     share and the burst guard), with two caps of its own on a borrowed platform key.
 */
import type { Pool } from "mysql2/promise";
import { analyse, AUTHORITY_WORDS, SPHERES, STRATEGY_WORDS, profileOf, type Chart } from "../../shared/geneKeys";
import { parseSky, plainReading, readRoom, skyLines, type CardSky } from "../../shared/sessionCard";
import {
  MY_CARD_KEEP_DAYS, MY_CARD_PREFS_KEY, MY_CARD_REFUSALS, READING_ROWS, WOVEN_LIMITS, drawCard, parseCardDate, parseTodayFacts, plainCardReading, seedOf,
  skyFitsDate, timeLine,
  type CardConsent, type CardReading, type MyCard, type MyCardAnswer, type TodayFacts,
} from "../../shared/myCard";
import { asTheVillageGuide } from "../../shared/guideName";
import { voiceLint } from "../../shared/comms/voiceLint";
import { letGuideUseLines, ownLinesFor } from "./geneKeys";
import { cardDisclosure, consentFor, withConsent, type CompanionDisclosure } from "./companionConsent";
import { callAssistant, DEFAULT_ASSISTANT_MODEL, parseJsonReply, resolveKey, type AssistantRequest, type AssistantResult } from "./assistant";
import { resolveMemberKey, type ResolvedMemberKey } from "./memberSecrets";
import { recordAssistantUsage } from "./assistantUsage";
import { instanceIdentity } from "./identity";

export type MyCardOutcome<T = MyCardAnswer> = { ok: true; value: T } | { ok: false; status: number; error: string };

/** The member as the route read them: their id and their prefs, where their yes and the day's card live. */
export interface CardMember {
  id: string;
  prefs?: unknown;
}

export interface MyCardDeps {
  getPool(): Pool;
  /** The users repository's locked read-modify-write (`members.update`). */
  updateMember(id: string, mutate: (m: { prefs?: unknown }) => void): Promise<{ prefs?: unknown } | null>;
  /** The village's own name, for the provider line. */
  villageName(): string;
  /** The village's guide as a prompt names it (`guidePromptName`). Absent: unnamed. */
  guideName?(): string;
  /** The village's limiter. Absent: no caps of the card's own (the engine's still apply). */
  overLimit?(key: string, max: number, windowMs: number): Promise<boolean>;
  /** Tests pass their own. */
  call?(req: AssistantRequest): Promise<AssistantResult>;
  memberKey?(userId: string): Promise<ResolvedMemberKey | null>;
  env?: NodeJS.ProcessEnv;
}

/**
 * Woven cards on a BORROWED platform key, per day. Its day cap is shared by every mode in the village, so the
 * card keeps to a small share of it. A member's own key and the village's own key do not meet these.
 */
export const PLATFORM_WOVEN = { perMemberDay: 3, perVillageDay: 40 } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

// ── The member's yes ────────────────────────────────────────────────────────

interface GuideLine {
  disclosure: CompanionDisclosure;
  memberKey: ResolvedMemberKey | null;
}

/** The key that would write the card now, and the line that names it. Null: no key at all on this village. */
async function guideLineFor(deps: MyCardDeps, userId: string): Promise<GuideLine | null> {
  const env = deps.env ?? process.env;
  const memberKey = await (deps.memberKey ?? ((id: string) => resolveMemberKey(deps.getPool(), id, env)))(userId).catch(() => null);
  const resolved = resolveKey(env, memberKey);
  if (!resolved) return null;
  return { disclosure: cardDisclosure(resolved.source, memberKey, deps.villageName(), env), memberKey };
}

function consentOf(prefs: unknown, line: GuideLine | null, maia: boolean): CardConsent {
  if (!line) return { state: "none" };
  if (maia && consentFor(prefs, line.disclosure)) return { state: "given" };
  const d = line.disclosure;
  return { state: "ask", provider: d.provider, operator: d.operator, source: d.source, sentence: d.sentence };
}

// ── The kept card ───────────────────────────────────────────────────────────

/** The kept cards by date, as prefs hold them; anything else reads as none. */
function keptByDate(prefs: unknown): Record<string, unknown> {
  const raw = (prefs as Record<string, unknown> | null | undefined)?.[MY_CARD_PREFS_KEY];
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** This date's kept card from prefs, when it still reads as one. */
export function keptCard(prefs: unknown, date: string): MyCard | null {
  const raw = keptByDate(prefs)[date] as Partial<MyCard> | undefined;
  if (!raw || typeof raw !== "object" || raw.date !== date) return null;
  const c = raw.card, r = raw.reading as Partial<CardReading> | undefined;
  if (!c || !SPHERES.includes(c.sphere) || !r || typeof r.focus !== "string" || READING_ROWS.some((k) => typeof r[k] !== "string")) return null;
  if (!raw.sky || !parseSky(raw.sky, Date.parse(raw.sky.at))) return null;
  return raw as MyCard;
}

/** Prefs with this card kept under its date, the newest `MY_CARD_KEEP_DAYS` dates only. A new object. */
export function withKeptCard(prefs: unknown, card: MyCard): Record<string, unknown> {
  const base = prefs && typeof prefs === "object" && !Array.isArray(prefs) ? { ...(prefs as Record<string, unknown>) } : {};
  const byDate = { ...keptByDate(base), [card.date]: card };
  const dates = Object.keys(byDate).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-MY_CARD_KEEP_DAYS);
  base[MY_CARD_PREFS_KEY] = Object.fromEntries(dates.map((d) => [d, byDate[d]]));
  return base;
}

/** Prefs with every kept card gone: the member removed their lines, so the cards drawn from them go too. */
export function withoutKeptCards(prefs: unknown): Record<string, unknown> {
  const base = prefs && typeof prefs === "object" && !Array.isArray(prefs) ? { ...(prefs as Record<string, unknown>) } : {};
  delete base[MY_CARD_PREFS_KEY];
  return base;
}

async function keep(deps: MyCardDeps, userId: string, card: MyCard): Promise<void> {
  await deps.updateMember(userId, (m) => {
    m.prefs = withKeptCard(m.prefs, card);
  });
}

// ── Building the card ───────────────────────────────────────────────────────

export function buildCard(userId: string, chart: Chart, sky: CardSky, date: string, factsRaw: unknown): MyCard {
  const room = readRoom([{ userId, name: "you", chart }], sky);
  const plain = plainReading(room);
  const line = plain.lines[userId] ?? "";
  const d = analyse(chart);
  const card = drawCard(chart, sky, seedOf(userId, date));
  const facts = parseTodayFacts(factsRaw);
  return {
    date,
    sky,
    card,
    lean: plain.collective.find((c) => c.system === "western")?.text ?? "",
    line,
    skyLines: skyLines(room),
    design: { type: d.type, authority: AUTHORITY_WORDS[d.authority].name, profile: profileOf(chart), strategy: STRATEGY_WORDS[d.type].strategy },
    facts,
    reading: plainCardReading(card, sky, line, facts, d.type, d.authority),
  };
}

/** A kept card with the day's counts as they are now, and, for a plain card, the plain reading built again from them. */
function withFacts(kept: MyCard, chart: Chart, facts: TodayFacts): MyCard {
  if (kept.reading.source !== "plain") return { ...kept, facts };
  const d = analyse(chart);
  return { ...kept, facts, reading: plainCardReading(kept.card, kept.sky, kept.line, facts, d.type, d.authority) };
}

// ── The guide's weaving ─────────────────────────────────────────────────────

const systemPrompt = (guide: string): string => [
  `You are ${asTheVillageGuide(guide)}, writing one member's card for the day.`,
  "The card was drawn from their own chart: one of their Gene Keys spheres, with its gate and line, weighed by today's sky.",
  "You are given the card, their Human Design type, authority, profile and strategy, the day's sky, counts of what waits on them in the village today, the village's moon and season, and a plain draft built from all of it.",
  "Write a short focus line for the day, under twelve words, and three bullets, each under 30 words and at most two sentences: sky, what today's sky does with the card; design, how their own design meets the day; waits, how they might meet what waits on them, by how they decide.",
  "Speak to them as you. Keep every fact exactly as given. Add no number, fact, prediction or promise, and name no person.",
  "It is a lens for the day: invite, never predict, never tell them what they are able to do, never steer them away from work or from people.",
  "Plain warm words, no headings, no emoji, no dashes between clauses.",
  'Reply with JSON only: {"focus":"...","sky":"...","design":"...","waits":"..."}',
].join(" ");

const undash = (s: string): string => s.replace(/\s*[–—]\s*/g, ", ").replace(/\s+/g, " ").trim();

/** Every number the woven words may say: the ones the facts hold. Anything else was invented. */
function allowedNumbers(c: MyCard): Set<string> {
  const nums: Array<number | null | undefined> = [
    c.card.gate, c.card.line, c.card.skyGate,
    c.sky.gates.Sun.gate, c.sky.gates.Sun.line, c.sky.gates.Earth.gate, c.sky.gates.Earth.line, c.sky.gates.Moon.gate, c.sky.gates.Moon.line,
    c.facts.quests, c.facts.tasks, c.facts.decisions, c.facts.asks, c.facts.sessions, c.facts.gatherings,
    c.facts.moon?.n, c.facts.moon?.day, c.facts.moon?.of, c.facts.season?.day, c.facts.season?.of,
  ];
  const out = new Set(nums.filter((v): v is number => typeof v === "number").map(String));
  for (const part of [c.card.channel ?? "", c.design.profile, ...(c.facts.season?.name.match(/\d+/g) ?? [])].join(" ").match(/\d+/g) ?? []) out.add(part);
  return out;
}

function factsForGuide(c: MyCard): unknown {
  return {
    card: { sphere: c.card.name, focus: c.card.focus, gate: c.card.gate, line: c.card.line, lineWord: c.card.word, todaysSkyTouch: c.card.touch, skyGate: c.card.skyGate, channel: c.card.channel },
    design: c.design,
    sky: c.skyLines,
    dayLeans: c.lean,
    waitingToday: {
      decisions: c.facts.decisions, questsInHand: c.facts.quests, sessionTasks: c.facts.tasks, asks: c.facts.asks,
      sessionsToday: c.facts.sessions, gatheringsToday: c.facts.gatherings,
    },
    moonAndSeason: timeLine(c.facts),
    draft: c.reading,
  };
}

async function mayWeave(deps: MyCardDeps, userId: string, line: GuideLine): Promise<boolean> {
  if (line.disclosure.source !== "platform" || !deps.overLimit) return true;
  if (await deps.overLimit(`today-card-woven:${userId}`, PLATFORM_WOVEN.perMemberDay, DAY_MS)) return false;
  return !(await deps.overLimit("today-card-woven:village", PLATFORM_WOVEN.perVillageDay, DAY_MS));
}

/** The guide's reading of the card, or null for "keep the plain one". Never an error the member sees. */
export async function weaveCard(deps: MyCardDeps, card: MyCard, userId: string, line: GuideLine): Promise<CardReading | null> {
  if (!(await mayWeave(deps, userId, line))) return null;
  const call = await (deps.call ?? callAssistant)({
    mode: "card",
    system: systemPrompt(deps.guideName?.() ?? ""),
    messages: [{ role: "user", content: "Read my card for today." }],
    model: DEFAULT_ASSISTANT_MODEL,
    clientIp: "today-card",
    burstKey: `assist-today-card:${userId}`,
    userId,
    prefetch: [{ key: "card.facts", data: factsForGuide(card) }],
    memberKey: line.memberKey,
  });
  await noteUsage(deps.getPool(), call, userId);
  if (!call.ok || call.stopReason === "max_tokens" || call.stopReason === "length") return null;
  const got = parseJsonReply<Record<string, unknown>>(call.text, {});
  const focus = undash(String(got.focus ?? ""));
  if (focus.length < 3 || focus.length > WOVEN_LIMITS.focus) return null;
  const rows = Object.fromEntries(READING_ROWS.map((k) => [k, undash(String(got[k] ?? ""))])) as Record<(typeof READING_ROWS)[number], string>;
  if (READING_ROWS.some((k) => rows[k].length < 3 || rows[k].length > WOVEN_LIMITS.row)) return null;
  const allowed = allowedNumbers(card);
  const words = [focus, ...READING_ROWS.map((k) => rows[k])];
  if (words.some((t) => (t.match(/\d+/g) ?? []).some((num) => !allowed.has(String(Number(num)))))) return null;
  if (words.some((t) => voiceLint(t, "body").length > 0)) return null;
  return { focus, ...rows, source: "guide" };
}

async function noteUsage(pool: Pool, call: AssistantResult, userId: string): Promise<void> {
  const paid = call.ok ? { keySource: call.keySource, usage: call.usage, iterations: call.iterations, stopReason: call.stopReason } : call.spent;
  if (!paid) return;
  try {
    await recordAssistantUsage(pool, {
      villageId: instanceIdentity().instanceId,
      mode: "card",
      model: DEFAULT_ASSISTANT_MODEL,
      keySource: paid.keySource,
      userId,
      usage: paid.usage,
      iterations: paid.iterations,
      stopReason: paid.stopReason,
      path: "prefetch",
    });
  } catch (e) {
    console.error("[today-card] the card's assistant usage was not recorded", e);
  }
}

// ── The doors ───────────────────────────────────────────────────────────────

/** The day's card if it has been drawn, and where the member stands with the guide. Writes nothing. */
export async function readTodayCard(deps: MyCardDeps, member: CardMember, rawDate: unknown, now: number): Promise<MyCardOutcome> {
  const date = parseCardDate(rawDate, now);
  if (!date) return { ok: false, status: 400, error: MY_CARD_REFUSALS.badDate };
  const lines = await ownLinesFor(deps.getPool(), member.id);
  if (!lines) return { ok: false, status: 404, error: MY_CARD_REFUSALS.noLines };
  const line = await guideLineFor(deps, member.id);
  return { ok: true, value: { card: keptCard(member.prefs, date), consent: consentOf(member.prefs, line, lines.maia) } };
}

/**
 * Pull today's card: body `{ date, sky, today }`. The first pull of the day draws and keeps it; a later pull
 * answers the kept card, unless the member has since said yes and the kept reading is still plain, when the
 * guide writes it now.
 */
export async function pullTodayCard(deps: MyCardDeps, member: CardMember, body: unknown, now: number): Promise<MyCardOutcome> {
  const b = (body ?? {}) as { date?: unknown; sky?: unknown; today?: unknown };
  const date = parseCardDate(b.date, now);
  if (!date) return { ok: false, status: 400, error: MY_CARD_REFUSALS.badDate };
  const lines = await ownLinesFor(deps.getPool(), member.id);
  if (!lines) return { ok: false, status: 404, error: MY_CARD_REFUSALS.noLines };
  const line = await guideLineFor(deps, member.id);
  const consent = consentOf(member.prefs, line, lines.maia);
  const kept = keptCard(member.prefs, date);
  if (kept && kept.reading.source === "guide") return { ok: true, value: { card: kept, consent } };
  if (kept && consent.state !== "given") {
    // A plain card is the same card all day; only its "what waits on you" row follows the day's counts.
    if (b.today === undefined) return { ok: true, value: { card: kept, consent } };
    const fresh = withFacts(kept, lines.chart, parseTodayFacts(b.today));
    if (fresh.reading.waits !== kept.reading.waits) await keep(deps, member.id, fresh);
    return { ok: true, value: { card: fresh, consent } };
  }

  let card: MyCard;
  if (kept) {
    // The same card and sky; the day's counts as they are now, for the guide to read.
    card = b.today === undefined ? kept : withFacts(kept, lines.chart, parseTodayFacts(b.today));
  } else {
    const sky = parseSky(b.sky, now);
    if (!sky || !skyFitsDate(sky, date)) return { ok: false, status: 400, error: MY_CARD_REFUSALS.badSky };
    card = buildCard(member.id, lines.chart, sky, date, b.today);
  }
  if (consent.state === "given" && line) {
    const woven = await weaveCard(deps, card, member.id, line).catch(() => null);
    if (woven) card = { ...card, reading: woven };
  }
  await keep(deps, member.id, card);
  return { ok: true, value: { card, consent } };
}

/**
 * The one tap: the member says yes to the line they were shown, and to the guide using their lines. The body
 * names the provider, operator and key kind they read; a line that changed since is refused with the new one.
 */
export async function consentToCard(deps: MyCardDeps, member: CardMember, body: unknown, now: number): Promise<MyCardOutcome<{ consent: CardConsent }>> {
  const lines = await ownLinesFor(deps.getPool(), member.id);
  if (!lines) return { ok: false, status: 404, error: MY_CARD_REFUSALS.noLines };
  const line = await guideLineFor(deps, member.id);
  if (!line) return { ok: false, status: 409, error: MY_CARD_REFUSALS.noKey };
  const d = line.disclosure;
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.provider !== d.provider || b.operator !== d.operator || b.source !== d.source) return { ok: false, status: 409, error: MY_CARD_REFUSALS.stale };
  const at = new Date(now).toISOString();
  const updated = await deps.updateMember(member.id, (m) => {
    m.prefs = withConsent(m.prefs, d, at);
  });
  if (!updated) return { ok: false, status: 404, error: "Your account could not be found." };
  if (!lines.maia) await letGuideUseLines(deps.getPool(), member.id);
  return { ok: true, value: { consent: { state: "given" } } };
}
