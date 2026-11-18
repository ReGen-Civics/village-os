/**
 * Funding rounds: the village chooses which proposed quests to fund within a
 * pot (Rye, 2026-11-06). This file holds the rules; server/repos/fundingRounds.ts
 * holds the SQL; server/routes/fundingRounds.ts holds the doors.
 *
 * WHAT IS BUILT HERE. Pots, rounds and the seed stage (S2): a member posts a
 * rough idea, named or anonymous by their own tick, and each idea opens its
 * own forum discussion thread so every idea exists in the standard format.
 * The loop (S3): in grow the author shapes their idea into a quest (what it
 * delivers, what it asks); in choose members tick every quest they would
 * fund, privately until it closes; at harvest both counts run ONCE (Equal
 * Shares weighted by counted Voice, and one member one vote), the pot's
 * decider funds, each funded quest holds an earmark on the pot and becomes a
 * quest on the board, and the disagreement is kept in the round's record.
 * A round whose grow date is unset stays in seed, which is how a village runs
 * seed only for a season.
 *
 * THE COUNTED-VOICE GUARDRAILS (S4, plan §13). The power count weighs each
 * member by counted Voice, which is WORK-ONLY by default (`readCountedVoice`,
 * `workEarnedVoice`): Voice from donations, investment and backing weighs
 * nothing in a pot ballot. Each member's counted Voice is FROZEN when choosing
 * opens (`freezeVoiceIfDue`: the freeze job, a member's read or tick, or
 * harvest itself as a late fallback), and harvest reads only the frozen rows.
 * Where the two counts fund different quests, those quests are HELD
 * (`on_ballot`) and a 48-hour village vote decides them (`askVillageIfHeld`,
 * subject `funding_divergence`); the closer settles them by one count
 * (`settleDivergence`). The round asks; the village decides.
 *
 * ANONYMITY. The author is always stored, for erasure and abuse handling, and
 * never leaves the server when the idea is anonymous: every view below is
 * built through `bylineOf`. An anonymous idea's forum thread is posted under
 * the account that opened the round, with a line saying so, because a thread
 * must have an author and the real one may not be shown.
 *
 * THE INTERACTION RECORD. Every member act here writes one row through
 * `recordInteraction`, references only. Acts on an anonymous idea by its
 * author are private rows.
 */
import { randomUUID } from "node:crypto";
import type { Pool } from "mysql2/promise";
import {
  ANONYMOUS_BYLINE, ANONYMOUS_MIN_MEMBERS, acceptsIdeas, datesProblem, parseIdea, stageAt,
  type Byline, type IdeaStatus, type PotClock, type RoundStage,
  isGrown, parseGrow,
  COUNT_WORDS, DIVERGENCE_VOTE_DAYS, DIVERGENCE_VOTE_HOURS, fundInOrder, otherCount, sideOf, type CountName,
} from "../../shared/fundingRounds";
import { FUNDING_DIVERGENCE, dialsForSubject, thresholdSettingsFrom } from "../../shared/ballotSubjects";
import type { SubjectCloser } from "./applyDue";
import type { RollNotice } from "./ballotNotices";
import type { BallotSetup } from "./ballotSetup";
import { openBallot, ballotById } from "./ballots";
import { recordEvent } from "./events";
import { memberAccount } from "./ledger";
import { VILLAGE_VOICE } from "./economy";
import { numberVar, stringVar } from "./variables";
import { workEarnedVoice } from "./voiceProvenance";
import { balancesOf } from "../repos/voiceLedger";
import { countBothWays, divergenceOf, type ShareResult } from "../../shared/equalShares";
import type { QuestRecord } from "../repos/quests";
import { onRealItemPublished } from "./examples";
import { LIFECYCLE_RANK, MODULES_BY_ID } from "../../shared/modules";
import { firstNameOf } from "./peopleLock";
import { effectiveLifecycle, moduleConfig } from "./modules";
import {
  forgetMember, ideaById, ideasByAuthor, ideasOfRound, insertIdea, insertIdeaThread, insertInteraction, insertPot, insertRound,
  interactionCountsFor, interactionsOf, listPots, listRounds, liveIdeasOf, openRoundCount, potById, receivedOf, roundById,
  setIdeaThread, updateRoundDates, type IdeaRow, type InteractionInput, type PotRow, type Queryable, type RoundRow,
  allMarksOf, claimIdeaQuest, claimOutcome, earmarkTotals, insertEarmark, lockPot, marksOf, marksOfMember, releaseIdeaQuest, replaceMarks, setEarmarkQuest, setIdeaStatus, updateIdeaGrow,
  firmPledges, firmTotals, insertPledge, lowerEarmark, pledgeById, pledgesByBacker, pledgesOfRound, releasePledges, withdrawPledgeRow,
  type PledgeRow, type PledgeStage,
  allVoiceOf, claimDivergenceResult, claimVoiceSnapshot, roundsAwaitingVoice, setDivergenceBallot, voiceOfMember, voiceOfRound,
} from "../repos/fundingRounds";

export const MODULE_ID = "funding-rounds";

const newId = (prefix: string): string => `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 20)}`;

// ── the interaction record ──────────────────────────────────────────────────

/** Write one interaction. Never throws into the act it records. */
export async function recordInteraction(pool: Pool, e: Omit<InteractionInput, "channel"> & { channel?: InteractionInput["channel"] }): Promise<void> {
  try {
    await insertInteraction(pool, { channel: "web", ...e });
  } catch (err) {
    console.error("[funding-rounds] an interaction was not recorded:", err);
  }
}

// ── pots ────────────────────────────────────────────────────────────────────

export interface PotView {
  id: string;
  name: string;
  purpose: string | null;
  unitKind: "currency" | "token";
  unit: string;
  clock: PotClock;
  decider: "power" | "people";
  holderRoleId: string | null;
  circleId: string | null;
  homeStructureKey: string | null;
  status: PotRow["status"];
  /** Received minus paid. */
  balanceMinor: number;
  /** Held plus owed earmarks: money promised to funded quests. */
  earmarkedMinor: number;
  /** Balance minus earmarks: what a new round may offer. */
  freeMinor: number;
}

/** A pot's money, in its minor unit. Free = received - held - owed - paid, never below zero. */
async function potMoney(db: Queryable, potId: string): Promise<{ balance: number; earmarked: number; free: number }> {
  const received = await receivedOf(db, potId);
  const e = await earmarkTotals(db, potId);
  return { balance: received - e.paid, earmarked: e.held + e.owed, free: Math.max(0, received - e.held - e.owed - e.paid) };
}

export async function potView(pool: Pool, p: PotRow): Promise<PotView> {
  const money = await potMoney(pool, p.id);
  return {
    id: p.id,
    name: p.name,
    purpose: p.purpose,
    unitKind: p.unitKind,
    unit: p.unitCode,
    clock: p.clock,
    decider: p.decider,
    holderRoleId: p.holderRoleId,
    circleId: p.circleId,
    homeStructureKey: p.structureKey,
    status: p.status,
    balanceMinor: money.balance,
    earmarkedMinor: money.earmarked,
    freeMinor: money.free,
  };
}

const UNIT_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;

export async function createPot(pool: Pool, actorId: string, body: unknown): Promise<{ ok: true; pot: PotView } | { ok: false; problem: string }> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  if (!name) return { ok: false, problem: "Give the pot a name." };
  const unitKind = b.unitKind === "token" ? "token" : "currency";
  const unitCode = typeof b.unitCode === "string" ? b.unitCode.trim() : "";
  if (!UNIT_CODE.test(unitCode)) return { ok: false, problem: "Name the pot's unit: a currency code such as CRC, or a token id." };
  if (unitKind === "currency" && !/^[A-Z]{3}$/.test(unitCode)) return { ok: false, problem: "A currency is three capital letters, such as CRC." };
  const clock: PotClock = b.clock === "lunar" || b.clock === "fixed" ? b.clock : "seasonal";
  const opt = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const id = newId("pot");
  await insertPot(pool, {
    id,
    name,
    purpose: opt(b.purpose, 4000),
    unitKind,
    unitCode,
    holderRoleId: opt(b.holderRoleId, 64),
    circleId: opt(b.circleId, 64),
    structureKey: opt(b.structureKey, 128),
    clock,
    createdBy: actorId,
  });
  const pot = await potById(pool, id);
  return { ok: true, pot: await potView(pool, pot as PotRow) };
}

// ── rounds ──────────────────────────────────────────────────────────────────

export interface RoundView {
  id: string;
  potId: string;
  title: string;
  stage: RoundStage;
  acceptsIdeas: boolean;
  seedAt: string;
  growAt: string | null;
  chooseAt: string | null;
  harvestAt: string | null;
  /** When the current stage ends, or null when no later date is set. */
  stageEndsAt: string | null;
  offeredMinor: number | null;
  ideasPerMember: number;
  /** True when the anonymous tick is offered: allowed by the round and the village is big enough. */
  anonymousOffered: boolean;
  ideaCount: number;
}

const isoOf = (d: Date | null): string | null => (d ? d.toISOString() : null);

function datesOf(r: RoundRow) {
  return { seedAt: r.seedAt, growAt: r.growAt, chooseAt: r.chooseAt, harvestAt: r.harvestAt, closedAt: r.closedAt };
}

export function roundView(r: RoundRow, now: Date, memberCount: number, ideaCount: number): RoundView {
  const stage = stageAt(datesOf(r), now);
  const next: Record<RoundStage, Date | null> = { seed: r.growAt, grow: r.chooseAt, choose: r.harvestAt, harvest: r.closedAt, closed: null };
  return {
    id: r.id,
    potId: r.potId,
    title: r.title,
    stage,
    acceptsIdeas: acceptsIdeas(datesOf(r), now),
    seedAt: r.seedAt.toISOString(),
    growAt: isoOf(r.growAt),
    chooseAt: isoOf(r.chooseAt),
    harvestAt: isoOf(r.harvestAt),
    stageEndsAt: isoOf(next[stage]),
    offeredMinor: r.offeredMinor,
    ideasPerMember: r.ideasPerMember,
    anonymousOffered: r.anonymousAllowed && memberCount >= ANONYMOUS_MIN_MEMBERS,
    ideaCount,
  };
}

const dateOrNull = (v: unknown): Date | null | "bad" => {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : "bad";
};

export async function openRound(pool: Pool, actorId: string, potId: string, body: unknown): Promise<{ ok: true; round: RoundRow } | { ok: false; status: number; problem: string }> {
  const pot = await potById(pool, potId);
  if (!pot) return { ok: false, status: 404, problem: "No such pot." };
  if (pot.status !== "open") return { ok: false, status: 409, problem: "This pot is not open." };
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 160) : "";
  if (!title) return { ok: false, status: 400, problem: "Give the round a name, such as the season it funds." };
  const seed = dateOrNull(b.seedAt ?? new Date().toISOString());
  const grow = dateOrNull(b.growAt);
  const choose = dateOrNull(b.chooseAt);
  const harvest = dateOrNull(b.harvestAt);
  if (seed === "bad" || grow === "bad" || choose === "bad" || harvest === "bad" || seed === null) {
    return { ok: false, status: 400, problem: "A date could not be read." };
  }
  const problem = datesProblem({ seedAt: seed, growAt: grow, chooseAt: choose, harvestAt: harvest, closedAt: null });
  if (problem) return { ok: false, status: 400, problem };
  const offered = b.offeredMinor == null || b.offeredMinor === "" ? null : Number(b.offeredMinor);
  if (offered != null && (!Number.isInteger(offered) || offered < 0)) return { ok: false, status: 400, problem: "The amount offered must be a whole amount." };
  const perMember = b.ideasPerMember == null ? 2 : Number(b.ideasPerMember);
  if (!Number.isInteger(perMember) || perMember < 1 || perMember > 10) return { ok: false, status: 400, problem: "Ideas per member is a number from 1 to 10." };
  const id = newId("round");
  await insertRound(pool, {
    id,
    potId,
    title,
    seedAt: seed,
    growAt: grow,
    chooseAt: choose,
    harvestAt: harvest,
    offeredMinor: offered,
    quorumPct: 40,
    ideasPerMember: perMember,
    anonymousAllowed: b.anonymousAllowed !== false,
    createdBy: actorId,
  });
  return { ok: true, round: (await roundById(pool, id)) as RoundRow };
}

/** Set or clear the later dates. The seed date never moves once ideas can arrive. */
export async function setRoundDates(pool: Pool, roundId: string, body: unknown, now: Date): Promise<{ ok: true; round: RoundRow } | { ok: false; status: number; problem: string }> {
  const r = await roundById(pool, roundId);
  if (!r) return { ok: false, status: 404, problem: "No such round." };
  const stage = stageAt(datesOf(r), now);
  if (stage !== "seed") return { ok: false, status: 409, problem: "Dates are set while the round is still taking ideas." };
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const grow = dateOrNull(b.growAt);
  const choose = dateOrNull(b.chooseAt);
  const harvest = dateOrNull(b.harvestAt);
  if (grow === "bad" || choose === "bad" || harvest === "bad") return { ok: false, status: 400, problem: "A date could not be read." };
  if (grow && grow.getTime() <= now.getTime()) return { ok: false, status: 400, problem: "The grow date must be in the future." };
  const problem = datesProblem({ seedAt: r.seedAt, growAt: grow, chooseAt: choose, harvestAt: harvest, closedAt: null });
  if (problem) return { ok: false, status: 400, problem };
  await updateRoundDates(pool, roundId, { growAt: grow, chooseAt: choose, harvestAt: harvest });
  return { ok: true, round: (await roundById(pool, roundId)) as RoundRow };
}

// ── ideas ───────────────────────────────────────────────────────────────────

export interface IdeaView {
  id: string;
  roundId: string;
  title: string;
  what: string;
  whoHelps: string | null;
  roughCostMinor: number | null;
  whoMight: string | null;
  structureKey: string | null;
  circleId: string | null;
  status: IdeaStatus;
  /** Grow: what the quest delivers and what it asks of the pot. */
  deliverable: string | null;
  askMinor: number | null;
  sharedImpact: boolean;
  byline: Byline;
  /** The viewer wrote it. True for their own anonymous idea too; never reveals anyone else. */
  mine: boolean;
  threadId: string | null;
  questId: string | null;
  createdAt: string | null;
  /** First names of the members who ticked it. Only once choosing has closed (plan R6); absent before. */
  markedBy?: string[];
  /** Pledges are shown openly with names (R19). Set by roundDetail. */
  backing?: Backing;
}

export interface Backing {
  /** Standing pledges: pledged, firm, collected or paid. */
  pledgedMinor: number;
  /** People with a standing pledge. */
  backers: number;
  firmMinor: number;
  withdrawnMinor: number;
  /** The viewer's own latest standing pledge, or null: the "backing (pending)" marker. */
  mine: { id: string; amountMinor: number; status: PledgeRow["status"] } | null;
  /** Every pledge, withdrawals and releases included, oldest first. */
  pledges: Array<{ id: string; name: string; amountMinor: number; status: PledgeRow["status"] }>;
}

const STANDING: ReadonlySet<PledgeRow["status"]> = new Set<PledgeRow["status"]>(["pledged", "firm", "collected", "paid"]);
const FIRM: ReadonlySet<PledgeRow["status"]> = new Set<PledgeRow["status"]>(["firm", "collected", "paid"]);

/** The words shown for an anonymous idea's author backing their own idea: a name there would unmask them. */
export const PROPOSER_BYLINE = "the proposer";

export function backingOf(
  pledges: readonly PledgeRow[],
  viewerId: string | null,
  nameOf: (id: string) => string | null,
  idea?: Pick<IdeaRow, "shownAs" | "authorId">,
): Backing {
  const nameFor = (backer: string): string =>
    idea?.shownAs === "anonymous" && backer === idea.authorId ? PROPOSER_BYLINE : firstNameOf(nameOf(backer) ?? "") || "a member";
  const standing = pledges.filter((p) => STANDING.has(p.status));
  const sum = (xs: readonly PledgeRow[]) => xs.reduce((s, p) => s + p.amountMinor, 0);
  const mine = viewerId ? standing.filter((p) => p.backerUserId === viewerId).at(-1) : undefined;
  return {
    pledgedMinor: sum(standing),
    backers: new Set(standing.map((p) => p.backerUserId)).size,
    firmMinor: sum(pledges.filter((p) => FIRM.has(p.status))),
    withdrawnMinor: sum(pledges.filter((p) => p.status === "withdrawn")),
    mine: mine ? { id: mine.id, amountMinor: mine.amountMinor, status: mine.status } : null,
    pledges: pledges.map((p) => ({ id: p.id, name: nameFor(p.backerUserId), amountMinor: p.amountMinor, status: p.status })),
  };
}

/** How an idea's author is shown: "a member" when anonymous, else their first name. */
export function bylineOf(idea: Pick<IdeaRow, "shownAs" | "authorId">, nameOf: (id: string) => string | null): Byline {
  if (idea.shownAs === "anonymous") return ANONYMOUS_BYLINE;
  const name = firstNameOf(nameOf(idea.authorId) ?? "");
  return name ? { kind: "named", text: name } : ANONYMOUS_BYLINE;
}

export function ideaView(idea: IdeaRow, viewerId: string | null, nameOf: (id: string) => string | null): IdeaView {
  return {
    id: idea.id,
    roundId: idea.roundId,
    title: idea.title,
    what: idea.what,
    whoHelps: idea.whoHelps,
    roughCostMinor: idea.roughCostMinor,
    whoMight: idea.whoMight,
    structureKey: idea.structureKey,
    circleId: idea.circleId,
    status: idea.status,
    deliverable: idea.deliverable,
    askMinor: idea.askMinor,
    sharedImpact: idea.sharedImpact,
    byline: bylineOf(idea, nameOf),
    mine: viewerId != null && idea.authorId === viewerId,
    threadId: idea.threadId,
    questId: idea.questId,
    createdAt: idea.createdAt,
  };
}

/** An amount in a unit's minor units, as plain text for a thread body. */
export function amountText(minor: number, unitKind: "currency" | "token", unit: string): string {
  if (unitKind === "currency") {
    try {
      const f = new Intl.NumberFormat("en", { style: "currency", currency: unit });
      const digits = f.resolvedOptions().maximumFractionDigits ?? 2;
      return f.format(minor / 10 ** digits);
    } catch {
      return `${minor} ${unit}`;
    }
  }
  return `${minor} ${unit}`;
}

/** The forum category an idea's thread goes in: Projects when the village has it, else the first. */
function ideaCategory(): string | null {
  const cfg = moduleConfig<{ categories?: Array<{ id: string }> }>("forum");
  const cats = Array.isArray(cfg?.categories) ? cfg!.categories : (MODULES_BY_ID["forum"]?.defaultConfig?.categories ?? []);
  if (!Array.isArray(cats) || cats.length === 0) return null;
  return (cats.find((c: { id: string }) => c.id === "projects") ?? cats[0]).id;
}

export interface SeedDeps {
  memberCount: () => Promise<number>;
  nameOf: (id: string) => string | null;
}

export async function seedIdea(
  pool: Pool,
  deps: SeedDeps,
  authorId: string,
  roundId: string,
  body: unknown,
  now: Date,
): Promise<{ ok: true; idea: IdeaView } | { ok: false; status: number; problem: string }> {
  const round = await roundById(pool, roundId);
  if (!round) return { ok: false, status: 404, problem: "No such round." };
  if (!acceptsIdeas(datesOf(round), now)) return { ok: false, status: 409, problem: "This round is not taking ideas right now." };
  const pot = await potById(pool, round.potId);
  if (!pot || pot.status !== "open") return { ok: false, status: 409, problem: "This round's pot is not open." };
  const parsed = parseIdea(body);
  if (!parsed.ok) return { ok: false, status: 400, problem: parsed.problem };
  const idea = parsed.idea;
  if (idea.shownAs === "anonymous") {
    if (!round.anonymousAllowed) return { ok: false, status: 400, problem: "This round asks every idea to carry a name." };
    if ((await deps.memberCount()) < ANONYMOUS_MIN_MEMBERS) {
      return { ok: false, status: 400, problem: `The village needs ${ANONYMOUS_MIN_MEMBERS} members before an idea can be shared without a name.` };
    }
  }
  if ((await liveIdeasOf(pool, roundId, authorId)) >= round.ideasPerMember) {
    return { ok: false, status: 409, problem: `Each member may share ${round.ideasPerMember} ideas in this round. Withdraw one to share another.` };
  }
  const id = newId("idea");
  await insertIdea(pool, id, roundId, authorId, idea);
  const row = (await ideaById(pool, id)) as IdeaRow;
  await openIdeaThread(pool, row, round, pot, deps);
  await recordInteraction(pool, {
    actorUserId: authorId,
    kind: "idea.seeded",
    subjectType: "funding_idea",
    subjectRef: id,
    roundId,
    visibility: idea.shownAs === "anonymous" ? "private" : "members",
    dedupeKey: `idea.seeded:${id}`,
  });
  return { ok: true, idea: ideaView((await ideaById(pool, id)) as IdeaRow, authorId, deps.nameOf) };
}

/** Open the idea's forum discussion thread, when the forum is on for members. Never fails the seed. */
async function openIdeaThread(pool: Pool, idea: IdeaRow, round: RoundRow, pot: PotRow, deps: SeedDeps): Promise<void> {
  try {
    if (LIFECYCLE_RANK[effectiveLifecycle("forum")] < LIFECYCLE_RANK.members) return;
    const category = ideaCategory();
    if (!category) return;
    const anonymous = idea.shownAs === "anonymous";
    const lines = [
      anonymous ? "Posted for a member who chose not to give their name." : null,
      idea.what,
      idea.whoHelps ? `Who it would help: ${idea.whoHelps}` : null,
      idea.roughCostMinor != null ? `Rough cost: ${amountText(idea.roughCostMinor, pot.unitKind, pot.unitCode)}` : null,
      idea.whoMight ? `Who might do it: ${idea.whoMight}` : null,
      `An idea for ${round.title}, in Funding rounds: /funding-rounds/${round.id}`,
    ].filter(Boolean);
    const threadId = `thr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await insertIdeaThread(pool, {
      id: threadId,
      category,
      authorId: anonymous ? round.createdBy : idea.authorId,
      title: `Idea: ${idea.title}`,
      body: lines.join("\n\n"),
      meta: { fundingIdeaId: idea.id, fundingRoundId: round.id },
    });
    await setIdeaThread(pool, idea.id, threadId);
  } catch (err) {
    console.error(`[funding-rounds] idea ${idea.id} has no forum thread yet:`, err);
  }
}

// ── reads ───────────────────────────────────────────────────────────────────

export interface Overview {
  pots: PotView[];
  rounds: RoundView[];
}

export async function overview(pool: Pool, now: Date, memberCount: number): Promise<Overview> {
  const pots = await listPots(pool);
  const rounds = await listRounds(pool);
  const views: RoundView[] = [];
  for (const r of rounds) views.push(roundView(r, now, memberCount, (await ideasOfRound(pool, r.id)).length));
  const potViews: PotView[] = [];
  for (const p of pots) potViews.push(await potView(pool, p));
  return { pots: potViews, rounds: views };
}

export interface RoundDetail {
  round: RoundView;
  pot: PotView;
  ideas: IdeaView[];
  /** The quests members choose between: grown, with an ask. Shown from choose on. */
  ballot: IdeaView[];
  /** The viewer's own ticks. Nobody else's are shown until choosing closes. */
  myMarks: string[];
  /** Both counts and the disagreement, from harvest on; null before, or while the count waits. */
  outcome: RoundOutcome | null;
  /** S4: the frozen Voice, once choosing has opened. The viewer sees only their own. */
  voice: VoiceView | null;
  /** S4: the 48-hour vote on the quests the two counts disagree on, when there is one. */
  divergenceVote: DivergenceVoteView | null;
}

export interface VoiceView {
  frozenAt: string;
  countedVoice: "work_only" | "all";
  /** Members on the frozen roll. */
  roll: number;
  /** The viewer's own counted Voice, in Voice's minor units, or null when they were not on the roll. */
  mine: number | null;
  /** Voice sources the count could not classify, so it is understated. */
  unclassified: string[];
}

export interface DivergenceVoteView {
  heldIdeaIds: string[];
  ballotId: string | null;
  closesAt: string | null;
  /** Null while the village decides. */
  result: "decider" | "other" | null;
  note: string | null;
  settledAt: string | null;
}

export async function roundDetail(
  pool: Pool,
  roundId: string,
  viewerId: string,
  now: Date,
  memberCount: number,
  nameOf: (id: string) => string | null,
  harvest?: HarvestDeps,
): Promise<RoundDetail | null> {
  let r = await roundById(pool, roundId);
  if (!r) return null;
  const pot = await potById(pool, r.potId);
  if (!pot) return null;
  const stage = stageAt(datesOf(r), now);
  if (stage === "choose" && harvest) {
    try {
      r = await freezeVoiceIfDue(pool, harvest, r, pot, now);
    } catch (err) {
      console.error(`[funding-rounds] round ${r.id} could not freeze its Voice yet:`, err);
    }
  }
  if (stage === "harvest" && harvest) {
    await harvestIfDue(pool, harvest, r, pot);
    r = (await roundById(pool, roundId)) as RoundRow;
  }
  const ideas = await ideasOfRound(pool, roundId);
  const views = ideas.map((i) => ideaView(i, viewerId, nameOf));
  const pledgesByIdea = new Map<string, PledgeRow[]>();
  for (const p of await pledgesOfRound(pool, roundId)) pledgesByIdea.set(p.ideaId as string, [...(pledgesByIdea.get(p.ideaId as string) ?? []), p]);
  ideas.forEach((idea, n) => {
    views[n].backing = backingOf(pledgesByIdea.get(idea.id) ?? [], viewerId, nameOf, idea);
  });
  if (stage === "harvest" || stage === "closed") {
    // Ticks are named once choosing has closed (plan R6). First names only.
    const byIdea = new Map<string, string[]>();
    for (const m of await marksOf(pool, roundId)) {
      const name = firstNameOf(nameOf(m.userId) ?? "") || "a member";
      byIdea.set(m.ideaId, [...(byIdea.get(m.ideaId) ?? []), name]);
    }
    for (const v of views) v.markedBy = byIdea.get(v.id) ?? [];
  }
  const showBallot = stage === "choose" || stage === "harvest" || stage === "closed";
  return {
    round: roundView(r, now, memberCount, ideas.length),
    pot: await potView(pool, pot),
    ideas: views,
    ballot: showBallot ? views.filter((v) => onBallot(v)) : [],
    myMarks: await marksOfMember(pool, roundId, viewerId),
    outcome: (r.outcome as RoundOutcome | null) ?? null,
    voice: r.voiceFrozenAt
      ? {
          frozenAt: r.voiceFrozenAt.toISOString(),
          countedVoice: r.countedVoice ?? pot.countedVoice,
          roll: (await voiceOfRound(pool, roundId)).length,
          mine: await voiceOfMember(pool, roundId, viewerId),
          unclassified: r.voiceUnclassified,
        }
      : null,
    divergenceVote: await divergenceVoteView(pool, r),
  };
}

async function divergenceVoteView(pool: Pool, r: RoundRow): Promise<DivergenceVoteView | null> {
  const held = (r.outcome as RoundOutcome | null)?.heldForVote ?? [];
  if (held.length === 0) return null;
  const ballot = r.divergenceBallotId ? await ballotById(pool, r.divergenceBallotId) : null;
  return {
    heldIdeaIds: held,
    ballotId: r.divergenceBallotId,
    closesAt: ballot ? new Date(ballot.closesAt).toISOString() : null,
    result: r.divergenceResult,
    note: r.divergenceNote,
    settledAt: isoOf(r.divergenceSettledAt),
  };
}

/**
 * On the round's ballot: shaped in grow, with an ask, and not withdrawn or
 * held. `on_ballot` is a quest held back at harvest for the divergence vote.
 */
function onBallot(i: { status: IdeaStatus; deliverable: string | null; askMinor: number | null }): boolean {
  return (i.status === "grown" || i.status === "on_ballot" || i.status === "funded" || i.status === "not_funded") && isGrown(i);
}

// ── grow ────────────────────────────────────────────────────────────────────

type Refusal = { ok: false; status: number; problem: string };

/** The author shapes their idea, in seed or grow. It joins the ballot once it says what it delivers and asks. */
export async function growIdea(pool: Pool, actorId: string, ideaId: string, body: unknown, now: Date, nameOf: (id: string) => string | null): Promise<{ ok: true; idea: IdeaView } | Refusal> {
  const idea = await ideaById(pool, ideaId);
  if (!idea) return { ok: false, status: 404, problem: "No such idea." };
  if (idea.authorId !== actorId) return { ok: false, status: 403, problem: "Only the person who shared this idea can shape it." };
  const round = (await roundById(pool, idea.roundId)) as RoundRow;
  const stage = stageAt(datesOf(round), now);
  if (stage !== "seed" && stage !== "grow") return { ok: false, status: 409, problem: "Ideas are shaped before choosing opens." };
  if (idea.status === "withdrawn" || idea.status === "held" || idea.status === "stopped") {
    return { ok: false, status: 409, problem: "This idea is not in the round any more." };
  }
  const parsed = parseGrow(body);
  if (!parsed.ok) return { ok: false, status: 400, problem: parsed.problem };
  const g = parsed.grow;
  const next = {
    title: g.title ?? idea.title,
    what: g.what ?? idea.what,
    deliverable: g.deliverable === undefined ? idea.deliverable : g.deliverable,
    askMinor: g.askMinor === undefined ? idea.askMinor : g.askMinor,
    sharedImpact: g.sharedImpact ?? idea.sharedImpact,
  };
  const status: IdeaStatus = isGrown(next) ? "grown" : "seed";
  await updateIdeaGrow(pool, ideaId, { ...next, status });
  await recordInteraction(pool, {
    actorUserId: actorId,
    kind: "idea.grown",
    subjectType: "funding_idea",
    subjectRef: ideaId,
    roundId: idea.roundId,
    visibility: idea.shownAs === "anonymous" ? "private" : "members",
    dedupeKey: `idea.grown:${ideaId}:${now.getTime()}`,
  });
  return { ok: true, idea: ideaView((await ideaById(pool, ideaId)) as IdeaRow, actorId, nameOf) };
}

/** The author takes their idea out of the round, before choosing opens. It frees a place in their allowance. */
export async function withdrawIdea(pool: Pool, actorId: string, ideaId: string, now: Date, nameOf: (id: string) => string | null): Promise<{ ok: true; idea: IdeaView } | Refusal> {
  const idea = await ideaById(pool, ideaId);
  if (!idea) return { ok: false, status: 404, problem: "No such idea." };
  if (idea.authorId !== actorId) return { ok: false, status: 403, problem: "Only the person who shared this idea can withdraw it." };
  const round = (await roundById(pool, idea.roundId)) as RoundRow;
  const stage = stageAt(datesOf(round), now);
  if (stage !== "seed" && stage !== "grow") return { ok: false, status: 409, problem: "An idea is withdrawn before choosing opens." };
  await setIdeaStatus(pool, ideaId, "withdrawn");
  await recordInteraction(pool, {
    actorUserId: actorId,
    kind: "idea.withdrawn",
    subjectType: "funding_idea",
    subjectRef: ideaId,
    roundId: idea.roundId,
    visibility: idea.shownAs === "anonymous" ? "private" : "members",
    dedupeKey: `idea.withdrawn:${ideaId}`,
  });
  return { ok: true, idea: ideaView((await ideaById(pool, ideaId)) as IdeaRow, actorId, nameOf) };
}

// ── backing (S3b, plan §18) ─────────────────────────────────────────────────

export interface PledgeView {
  id: string;
  ideaId: string | null;
  amountMinor: number;
  unit: string;
  status: PledgeRow["status"];
  stageAtPledge: PledgeStage;
  createdAt: string | null;
}

const pledgeView = (p: PledgeRow): PledgeView => ({
  id: p.id, ideaId: p.ideaId, amountMinor: p.amountMinor, unit: p.unitCode, status: p.status, stageAtPledge: p.stageAtPledge, createdAt: p.createdAt,
});

/**
 * Back a quest with a pledge, at any stage (R18). Before choosing closes it is
 * a standing pledge the backer can withdraw. In harvest it is accepted only on
 * a funded quest, firm at once, and it lowers that quest's earmark. Nothing is
 * collected here (Q-B1 waits on Rye).
 */
export async function pledgeToIdea(pool: Pool, actorId: string, ideaId: string, body: unknown, now: Date): Promise<{ ok: true; pledge: PledgeView } | Refusal> {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).amountMinor : undefined;
  const amount = Number(raw);
  if (raw == null || raw === "" || !Number.isInteger(amount) || amount <= 0) return { ok: false, status: 400, problem: "A pledge is a whole amount above zero." };
  const idea = await ideaById(pool, ideaId);
  if (!idea) return { ok: false, status: 404, problem: "No such idea." };
  const round = (await roundById(pool, idea.roundId)) as RoundRow;
  const pot = await potById(pool, round.potId);
  if (!pot) return { ok: false, status: 404, problem: "No such pot." };
  const stage = stageAt(datesOf(round), now);
  if (stage === "closed") return { ok: false, status: 409, problem: "This round is closed." };
  if (idea.status === "withdrawn" || idea.status === "held" || idea.status === "stopped") return { ok: false, status: 409, problem: "This idea is not in the round any more." };
  const id = newId("pledge");
  if (stage !== "harvest") {
    await insertPledge(pool, { id, ideaId, backerUserId: actorId, amountMinor: amount, unitCode: pot.unitCode, stageAtPledge: stage, status: "pledged" });
  } else {
    if (round.outcome == null) return { ok: false, status: 409, problem: "The count is being made. Try again in a moment." };
    if (idea.status === "on_ballot") return { ok: false, status: 409, problem: "The village is voting on this quest. Back it once the vote has closed." };
    if (idea.status !== "funded") return { ok: false, status: 409, problem: "Only a quest the round funded can be backed now." };
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await insertPledge(conn, { id, ideaId, backerUserId: actorId, amountMinor: amount, unitCode: pot.unitCode, stageAtPledge: "harvest", status: "firm" });
      await lowerEarmark(conn, ideaId, amount);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
  await recordInteraction(pool, {
    actorUserId: actorId,
    kind: "idea.backed",
    subjectType: "funding_idea",
    subjectRef: ideaId,
    roundId: idea.roundId,
    visibility: "members",
    dedupeKey: `idea.backed:${id}`,
  });
  return { ok: true, pledge: pledgeView((await pledgeById(pool, id)) as PledgeRow) };
}

/** The backer withdraws a standing pledge, until choosing closes. The withdrawal stays on the record. */
export async function withdrawPledge(pool: Pool, actorId: string, pledgeId: string, now: Date): Promise<{ ok: true; pledge: PledgeView } | Refusal> {
  const p = await pledgeById(pool, pledgeId);
  if (!p || !p.ideaId) return { ok: false, status: 404, problem: "No such pledge." };
  if (p.backerUserId !== actorId) return { ok: false, status: 403, problem: "Only the person who made this pledge can withdraw it." };
  const idea = (await ideaById(pool, p.ideaId)) as IdeaRow;
  const round = (await roundById(pool, idea.roundId)) as RoundRow;
  const stage = stageAt(datesOf(round), now);
  if (p.status !== "pledged" || (stage !== "seed" && stage !== "grow" && stage !== "choose")) {
    return { ok: false, status: 409, problem: "A pledge is firm once choosing closes, and can no longer be withdrawn." };
  }
  if (!(await withdrawPledgeRow(pool, pledgeId))) return { ok: false, status: 409, problem: "This pledge has already changed." };
  await recordInteraction(pool, {
    actorUserId: actorId,
    kind: "pledge.withdrawn",
    subjectType: "funding_idea",
    subjectRef: p.ideaId,
    roundId: idea.roundId,
    visibility: "members",
    dedupeKey: `pledge.withdrawn:${pledgeId}`,
  });
  return { ok: true, pledge: pledgeView((await pledgeById(pool, pledgeId)) as PledgeRow) };
}

// ── choose ──────────────────────────────────────────────────────────────────

/** Replace the member's ticks, while the round is in choose. Every tick must be on the ballot. */
export async function setMarks(
  pool: Pool,
  actorId: string,
  roundId: string,
  body: unknown,
  now: Date,
  harvest?: Pick<HarvestDeps, "roll" | "countedVoice">,
): Promise<{ ok: true; myMarks: string[] } | Refusal> {
  let round = await roundById(pool, roundId);
  if (!round) return { ok: false, status: 404, problem: "No such round." };
  if (stageAt(datesOf(round), now) !== "choose") return { ok: false, status: 409, problem: "Ticks are given while the round is choosing." };
  // S4: the roll and its Voice freeze when choosing opens, so a member who
  // was not on the voting roll then cannot tick in this round.
  if (harvest) {
    const pot = await potById(pool, round.potId);
    if (pot) round = await freezeVoiceIfDue(pool, harvest, round, pot, now);
  }
  if (round.voiceFrozenAt && (await voiceOfMember(pool, roundId, actorId)) === null) {
    return { ok: false, status: 403, problem: "This round's voting roll was set when choosing opened, and you were not on it then, so you cannot tick in this round." };
  }
  const raw = (body && typeof body === "object" ? (body as Record<string, unknown>).ideaIds : null) ?? [];
  if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string")) return { ok: false, status: 400, problem: "Send the ideas you would fund as a list." };
  const wanted = Array.from(new Set(raw as string[]));
  const ballot = new Set((await ideasOfRound(pool, roundId)).filter(onBallot).map((i) => i.id));
  if (wanted.some((id) => !ballot.has(id))) return { ok: false, status: 400, problem: "You can only tick quests on this round's ballot." };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await replaceMarks(conn, roundId, actorId, wanted);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  // Ticks are secret until close, so the record of this act is private.
  await recordInteraction(pool, {
    actorUserId: actorId,
    kind: "round.marked",
    subjectType: "funding_round",
    subjectRef: roundId,
    roundId,
    visibility: "private",
    dedupeKey: `round.marked:${roundId}:${actorId}`,
  });
  return { ok: true, myMarks: await marksOfMember(pool, roundId, actorId) };
}

// ── harvest ─────────────────────────────────────────────────────────────────

export interface CountView {
  funded: string[];
  steps: ShareResult["steps"];
  spentMinor: number;
  leftoverMinor: number;
}

/** A round's outcome, written once at harvest and kept in its record. */
export interface RoundOutcome {
  /** The public tie-break draw: the round id and its harvest instant. */
  seed: string;
  decider: "power" | "people";
  quorumMet: boolean;
  quorumPct: number;
  /** Members who ticked at least one quest, and the electorate they came from. */
  markers: number;
  electorate: number;
  /** What the round could spend: the amount offered, never more than the pot's free money. */
  availableMinor: number;
  power: CountView;
  people: CountView;
  divergence: Array<{ ideaId: string; fundedBy: "power" | "people"; costMinor: number }>;
  /** Quests their backers' firm pledges covered whole; funded without the count. */
  backerFunded: string[];
  /** Ticks per quest, kept so the record survives a ticker's erasure. */
  marksByIdea: Record<string, number>;
  countedAt: string;
  /** S4: which Voice weighed the power count. Absent on a round counted before S4. */
  countedVoice?: "work_only" | "all";
  /** S4: when the Voice the count read was frozen. */
  voiceFrozenAt?: string | null;
  /** S4: true when nothing froze the Voice while the round was choosing, so it was frozen at harvest. */
  voiceFrozenLate?: boolean;
  /** S4: Voice mint sources that are neither work nor money; a work-only count is understated by them. */
  unclassifiedSources?: string[];
  /** S4: the quests the two counts disagree on, held back for the village's 48-hour vote. */
  heldForVote?: string[];
}

/** What a 48-hour divergence vote needs that only server/index.ts has. */
export interface DivergenceDeps {
  governanceOn: () => boolean;
  ballotSetup: () => Promise<BallotSetup>;
  notifyRoll: (b: { id: string }, input: RollNotice) => Promise<number>;
}

/** Reads each member's counted Voice in Voice's minor units. Injected in tests; the ledger read otherwise. */
export type CountedVoiceRead = (
  pool: Pool,
  userIds: readonly string[],
  kind: "work_only" | "all",
) => Promise<{ byUser: Map<string, number>; unclassified: string[] }>;

export interface HarvestDeps {
  /**
   * Who may choose: the village's voting roll (present members holding
   * ballot.vote), with no weights. `votingRoll` in server/index.ts, the roll
   * every village vote opens with. Their counted Voice is read separately.
   */
  roll: () => Promise<string[]>;
  /** Defaults to `readCountedVoice`. */
  countedVoice?: CountedVoiceRead;
  questsRepo: { add: (q: QuestRecord) => Promise<unknown>; all: () => Promise<unknown[]> };
  /** Absent, or with governance off, the deciding count settles disagreements at once. */
  divergence?: DivergenceDeps;
}

const countView = (r: ShareResult): CountView => ({ funded: r.funded, steps: r.steps, spentMinor: r.spent, leftoverMinor: r.leftover });

// ── the Voice snapshot (S4) ─────────────────────────────────────────────────

/**
 * Each member's counted Voice, off the ledger. `work_only` (the default every
 * pot is created with) is `workEarnedVoice`: the balance times the share of it
 * minted from work, so Voice from donations, investment and backing weighs
 * nothing. `all` is the whole Voice balance; no door sets it yet.
 */
export const readCountedVoice: CountedVoiceRead = async (pool, userIds, kind) => {
  if (kind === "work_only") return workEarnedVoice(pool, userIds);
  const ids = Array.from(new Set(userIds.map(String)));
  const balances = await balancesOf(pool, VILLAGE_VOICE, ids.map((id) => memberAccount(id)));
  return { byUser: new Map(ids.map((id) => [id, Math.max(0, balances.get(memberAccount(id)) ?? 0)])), unclassified: [] };
};

/**
 * Freeze the round's counted Voice if choosing has opened and nobody has. The
 * first of three callers wins: the freeze job, a member's read or tick while
 * choosing, or harvest itself when nothing earlier ran (then the outcome says
 * it was late). The pot's decider, cap and counted-Voice setting freeze with
 * it, so changing the pot mid-round changes nothing for this round.
 */
export async function freezeVoiceIfDue(pool: Pool, deps: Pick<HarvestDeps, "roll" | "countedVoice">, round: RoundRow, pot: PotRow, now: Date): Promise<RoundRow> {
  if (round.voiceFrozenAt || round.outcome != null) return round;
  const stage = stageAt(datesOf(round), now);
  if (stage !== "choose" && stage !== "harvest") return round;
  const roll = Array.from(new Set((await deps.roll()).map(String)));
  const read = await (deps.countedVoice ?? readCountedVoice)(pool, roll, pot.countedVoice);
  const conn = await pool.getConnection();
  let claimed = false;
  try {
    await conn.beginTransaction();
    claimed = await claimVoiceSnapshot(conn, round.id, {
      at: now,
      decider: pot.decider,
      capPct: pot.weightCapPct,
      countedVoice: pot.countedVoice,
      unclassified: read.unclassified,
      rows: roll.map((userId) => ({ userId, voice: read.byUser.get(userId) ?? 0 })),
    });
    if (claimed) await conn.commit();
    else await conn.rollback();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  if (claimed) {
    await recordInteraction(pool, {
      actorUserId: round.createdBy,
      kind: "round.voice_frozen",
      subjectType: "funding_round",
      subjectRef: round.id,
      roundId: round.id,
      visibility: "members",
      dedupeKey: `round.voice_frozen:${round.id}`,
    });
  }
  return (await roundById(pool, round.id)) as RoundRow;
}

/** The freeze job's tick: every round whose choosing has opened without a snapshot. Asks nothing and decides nothing. */
export async function freezeDueVoice(pool: Pool, deps: Pick<HarvestDeps, "roll" | "countedVoice">, now: Date): Promise<number> {
  let n = 0;
  for (const r of await roundsAwaitingVoice(pool, now)) {
    const pot = await potById(pool, r.potId);
    if (!pot) continue;
    const after = await freezeVoiceIfDue(pool, deps, r, pot, now);
    if (after.voiceFrozenAt) n++;
  }
  return n;
}

/**
 * Run the count if the round is in harvest and nobody has. Never twice: the
 * pot row is locked, the outcome is re-read under the lock, and the outcome
 * is written by a guarded update before any earmark. A failure leaves the
 * outcome empty, so the next read tries again; it never fails the read.
 */
export async function harvestIfDue(pool: Pool, deps: HarvestDeps, round: RoundRow, pot: PotRow): Promise<void> {
  try {
    if (round.outcome == null) await runHarvest(pool, deps, round, pot);
    await askVillageIfHeld(pool, deps, round.id);
    await ensureQuests(pool, deps, round.id, pot);
  } catch (err) {
    console.error(`[funding-rounds] round ${round.id} has not counted yet:`, err);
  }
}

async function runHarvest(pool: Pool, deps: HarvestDeps, round: RoundRow, pot: PotRow): Promise<void> {
  // Harvest reads the FROZEN Voice. A round nothing froze while it chose is
  // frozen now, and the outcome says so.
  const frozen = await freezeVoiceIfDue(pool, deps, round, pot, new Date());
  const snapshot = await voiceOfRound(pool, round.id);
  const voice = new Map(snapshot.map((e) => [e.userId, e.voice]));
  const electorate = snapshot.map((e) => e.userId);
  const decider = frozen.decider ?? pot.decider;
  const capPct = frozen.weightCapPct ?? pot.weightCapPct;
  const conn = await pool.getConnection();
  let held: string[] = [];
  try {
    await conn.beginTransaction();
    await lockPot(conn, pot.id);
    const fresh = await roundById(conn, round.id);
    if (!fresh || fresh.outcome != null) {
      await conn.rollback();
      return;
    }
    const ideas = (await ideasOfRound(conn, round.id)).filter(onBallot);
    const ballotIds = new Set(ideas.map((i) => i.id));
    const members = new Set(electorate);
    const marks = (await marksOf(conn, round.id)).filter((m) => ballotIds.has(m.ideaId) && members.has(m.userId));
    const markers = new Set(marks.map((m) => m.userId)).size;
    const quorumMet = electorate.length > 0 && markers * 100 >= round.quorumPct * electorate.length;
    const money = await potMoney(conn, pot.id);
    const availableMinor = Math.min(round.offeredMinor ?? money.free, money.free);
    // Choosing has closed: the standing pledges on the ballot are firm now
    // (R19), and the pot is asked only for what they do not cover (§18.5).
    await firmPledges(conn, ideas.map((i) => i.id));
    const firm = await firmTotals(conn, round.id);
    const potPart = new Map(ideas.map((i) => [i.id, Math.max(0, (i.askMinor as number) - (firm.get(i.id) ?? 0))]));
    // A quest its backers cover whole goes ahead without the count (the plan's
    // suggested answer to Q-B6; the stop vote it mentions is still to come).
    const backerFunded = ideas.filter((i) => potPart.get(i.id) === 0).map((i) => i.id);
    const options = ideas.filter((i) => (potPart.get(i.id) as number) > 0).map((i) => ({ id: i.id, cost: potPart.get(i.id) as number }));
    const seed = `${round.id}:${(round.harvestAt as Date).toISOString()}`;
    const both = countBothWays({
      pot: quorumMet ? availableMinor : 0,
      voice,
      options,
      marks: marks.map((m) => ({ voter: m.userId, option: m.ideaId })),
      seed,
      capPct,
    });
    const marksByIdea: Record<string, number> = {};
    for (const m of marks) marksByIdea[m.ideaId] = (marksByIdea[m.ideaId] ?? 0) + 1;
    const divergence = divergenceOf(both, options).map((d) => ({ ideaId: d.option, fundedBy: d.fundedBy, costMinor: d.cost }));
    // S4: the quests the counts disagree on are held back for the village.
    held = divergence.map((d) => d.ideaId);
    const frozenAt = frozen.voiceFrozenAt;
    const outcome: RoundOutcome = {
      seed,
      decider,
      quorumMet,
      quorumPct: round.quorumPct,
      markers,
      electorate: electorate.length,
      availableMinor,
      power: countView(both.power),
      people: countView(both.people),
      divergence,
      backerFunded,
      marksByIdea,
      countedAt: new Date().toISOString(),
      countedVoice: frozen.countedVoice ?? pot.countedVoice,
      voiceFrozenAt: frozenAt ? frozenAt.toISOString() : null,
      // Late: no snapshot existed when the count began, so it was taken just now.
      voiceFrozenLate: round.voiceFrozenAt == null,
      unclassifiedSources: frozen.voiceUnclassified,
      heldForVote: held,
    };
    if (!(await claimOutcome(conn, round.id, outcome))) {
      await conn.rollback();
      return;
    }
    const heldSet = new Set(held);
    // Funded now: what both counts fund, and what backers covered whole.
    const funded = new Set([...outcome[decider].funded.filter((id) => !heldSet.has(id)), ...backerFunded]);
    const promised = ideas.filter((i) => funded.has(i.id)).reduce((s, i) => s + (potPart.get(i.id) as number), 0);
    // held + owed + paid never exceeds what the pot received.
    if (promised > money.free) throw new Error(`round ${round.id} would promise ${promised} from a pot with ${money.free} free`);
    for (const i of ideas) {
      if (funded.has(i.id)) {
        const part = potPart.get(i.id) as number;
        if (part > 0) await insertEarmark(conn, { id: newId("earmark"), potId: pot.id, roundId: round.id, ideaId: i.id, amountMinor: part, changedBy: null });
        await setIdeaStatus(conn, i.id, "funded");
      } else if (heldSet.has(i.id)) {
        // On the village's ballot: the divergence vote decides it.
        await setIdeaStatus(conn, i.id, "on_ballot");
      } else {
        await setIdeaStatus(conn, i.id, "not_funded");
      }
    }
    // Pledges on an idea that will not happen go back to the backer: those not
    // funded, and those that never reached the ballot. Nothing was collected.
    // A held quest's pledges stay firm until the vote settles it.
    const all = await ideasOfRound(conn, round.id);
    await releasePledges(conn, all.filter((i) => !funded.has(i.id) && !heldSet.has(i.id)).map((i) => i.id));
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  await recordInteraction(pool, {
    actorUserId: round.createdBy,
    kind: "round.harvested",
    subjectType: "funding_round",
    subjectRef: round.id,
    roundId: round.id,
    visibility: "members",
    dedupeKey: `round.harvested:${round.id}`,
  });
}

// ── the divergence vote (S4) ────────────────────────────────────────────────

/** Who opened the divergence vote: the round itself, never a person (the same reasoning as `MOON_PROPOSER`). */
export const FUNDING_PROPOSER = "sys:funding-rounds";

/** The vote's document: the two sides, what each costs, and what each answer does. */
export function divergenceDoc(input: {
  roundTitle: string;
  roundId: string;
  decider: CountName;
  deciderSide: Array<{ title: string; cost: string }>;
  otherSide: Array<{ title: string; cost: string }>;
}): { title: string; doc: string } {
  const other = otherCount(input.decider);
  const title = `${input.roundTitle}: fund the disputed quests by ${COUNT_WORDS[other]}?`;
  const list = (side: Array<{ title: string; cost: string }>) => (side.length ? side.map((q) => `- ${q.title} (${q.cost})`) : ["- nothing"]);
  const doc = [
    `# ${title}`,
    "",
    `This round counted its ticks two ways, by ${COUNT_WORDS.power} and by ${COUNT_WORDS.people}, and the two counts fund different quests. The quests they agree on are already funded. These are held back until this vote closes.`,
    "",
    `## The pot decides by ${COUNT_WORDS[input.decider]}, which funds`,
    "",
    ...list(input.deciderSide),
    "",
    `## ${COUNT_WORDS[other][0].toUpperCase()}${COUNT_WORDS[other].slice(1)} funds instead`,
    "",
    ...list(input.otherSide),
    "",
    "## If this carries",
    "",
    `The quests ${COUNT_WORDS[other]} chose are funded and the others are not. A carried vote waits its window like any change to the Game, and a seated steward may stop it.`,
    "",
    "## If it does not carry",
    "",
    `The quests ${COUNT_WORDS[input.decider]} chose are funded and the others are not. Too few votes, a withdrawn vote and a stopped one end the same way.`,
    "",
    `The round: /funding-rounds/${input.roundId}`,
    "",
  ].join("\n");
  return { title, doc };
}

/**
 * Put the held quests to the village, once. Runs after every harvest read, so
 * a vote that failed to open is asked again; a second opener finds the first
 * ballot by its open key and records it. When no vote can open (voting is off,
 * the weights cannot be read, nobody may vote, a governance window is shut)
 * the deciding count settles them at once and the round says why.
 */
export async function askVillageIfHeld(pool: Pool, deps: HarvestDeps, roundId: string): Promise<void> {
  const r = await roundById(pool, roundId);
  if (!r || r.outcome == null || r.divergenceResult != null || r.divergenceBallotId != null) return;
  const o = r.outcome as RoundOutcome;
  const held = o.heldForVote ?? [];
  if (held.length === 0) return;
  const d = deps.divergence;
  const standing = (why: string) => settleDivergence(pool, roundId, "decider", `${why} So the deciding count stands.`, deps.questsRepo);
  if (!d || !d.governanceOn()) {
    await standing("Voting is off in this village, so no vote could open.");
    return;
  }
  const setup = await d.ballotSetup();
  if (setup.tokenProblem) {
    await standing(`No vote could open: ${setup.tokenProblem}.`);
    return;
  }
  const pot = await potById(pool, r.potId);
  if (!pot) return;
  const ideas = new Map((await ideasOfRound(pool, roundId)).map((i) => [i.id, i]));
  const words = (side: Array<{ id: string; cost: number }>) =>
    side.map((q) => ({ title: ideas.get(q.id)?.title ?? q.id, cost: amountText(q.cost, pot.unitKind, pot.unitCode) }));
  const { title, doc } = divergenceDoc({
    roundTitle: r.title,
    roundId,
    decider: o.decider,
    deciderSide: words(sideOf(o[o.decider], held)),
    otherSide: words(sideOf(o[otherCount(o.decider)], held)),
  });
  const dials = dialsForSubject(
    FUNDING_DIVERGENCE,
    setup.method,
    setup.dials,
    thresholdSettingsFrom((key) => Number(numberVar(key)), (key) => stringVar(key)),
  );
  const opened = await openBallot(pool, {
    subjectType: FUNDING_DIVERGENCE,
    subjectRef: roundId,
    title,
    docMarkdown: doc,
    method: setup.method,
    weightMode: setup.snapshot.mode,
    weightToken: setup.snapshot.token ?? null,
    unityPct: dials.unityPct,
    quorumPct: dials.quorumPct,
    durationDays: DIVERGENCE_VOTE_DAYS,
    openedBy: FUNDING_PROPOSER,
    electorate: setup.electorate,
    timing: "at_acceptance",
    // A missed quorum is not asked again: the 48 hours is the promise, and
    // the deciding count standing is the answer to too few votes.
    quorumFallback: false,
  });
  if (!opened.ok) {
    if (opened.alreadyOpen) {
      await setDivergenceBallot(pool, roundId, opened.alreadyOpen.id);
      return;
    }
    await standing(`No vote could open: ${opened.error}.`);
    return;
  }
  await setDivergenceBallot(pool, roundId, opened.ballot.id);
  await d.notifyRoll(opened.ballot, {
    type: "ballot_opened",
    title: `${r.title}: the two counts disagree, and the village decides`,
    body: `${held.length === 1 ? "One quest is" : `${held.length} quests are`} held back until the vote closes in ${DIVERGENCE_VOTE_HOURS} hours.`,
    keySuffix: "open",
    roll: setup.electorate.map((e) => e.userId),
  });
  await recordEvent(pool, {
    kind: "governance",
    text: `The quests ${r.title}'s two counts disagree on went to the village as a ${DIVERGENCE_VOTE_HOURS}-hour vote`,
    actorKind: "system",
    originModuleId: MODULE_ID,
    entityType: "ballot",
    entityRef: opened.ballot.id,
  });
}

/**
 * Settle the held quests by one count, once. `decider` keeps the pot's own
 * count; `other` switches to the round's other count. Under the pot's lock,
 * the chosen side is funded in its count's order while the pot's free money
 * lasts (another round on the same pot may have spent some since harvest); a
 * quest that no longer fits is not funded and the note names how many. Every
 * other held quest is not funded and its pledges go back to its backers.
 */
export async function settleDivergence(
  pool: Pool,
  roundId: string,
  result: "decider" | "other",
  note: string,
  questsRepo?: HarvestDeps["questsRepo"],
): Promise<{ settled: boolean; funded: string[]; short: string[] }> {
  const none = { settled: false, funded: [] as string[], short: [] as string[] };
  const first = await roundById(pool, roundId);
  if (!first || first.outcome == null) return none;
  const conn = await pool.getConnection();
  let out = none;
  let pot: PotRow | null = null;
  try {
    await conn.beginTransaction();
    await lockPot(conn, first.potId);
    const r = (await roundById(conn, roundId)) as RoundRow;
    if (r.divergenceResult != null) {
      await conn.rollback();
      return none;
    }
    pot = await potById(conn, r.potId);
    const o = r.outcome as RoundOutcome;
    const held = o.heldForVote ?? [];
    const side = result === "decider" ? o.decider : otherCount(o.decider);
    const ideas = new Map((await ideasOfRound(conn, roundId)).map((i) => [i.id, i]));
    const waiting = sideOf(o[side], held).filter((q) => ideas.get(q.id)?.status === "on_ballot");
    const money = await potMoney(conn, r.potId);
    const plan = fundInOrder(waiting, money.free);
    const shortNote = plan.short.length ? ` ${plan.short.length === 1 ? "One quest" : `${plan.short.length} quests`} no longer fit the pot's free money and ${plan.short.length === 1 ? "was" : "were"} not funded.` : "";
    if (!(await claimDivergenceResult(conn, roundId, result, `${note}${shortNote}`, new Date()))) {
      await conn.rollback();
      return none;
    }
    const fundedSet = new Set(plan.funded);
    for (const q of waiting) {
      if (!fundedSet.has(q.id)) continue;
      if (q.cost > 0) await insertEarmark(conn, { id: newId("earmark"), potId: r.potId, roundId, ideaId: q.id, amountMinor: q.cost, changedBy: null });
      await setIdeaStatus(conn, q.id, "funded");
    }
    const losers = held.filter((id) => !fundedSet.has(id) && ideas.get(id)?.status === "on_ballot");
    for (const id of losers) await setIdeaStatus(conn, id, "not_funded");
    await releasePledges(conn, losers);
    await conn.commit();
    out = { settled: true, funded: plan.funded, short: plan.short };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  await recordInteraction(pool, {
    actorUserId: first.createdBy,
    kind: "round.divergence_settled",
    subjectType: "funding_round",
    subjectRef: roundId,
    roundId,
    visibility: "members",
    dedupeKey: `round.divergence_settled:${roundId}`,
  });
  await recordEvent(pool, {
    kind: "governance",
    text: `${first.title}: the quests its two counts disagreed on were settled by ${result === "decider" ? "the deciding count" : "the other count"}`,
    actorKind: "system",
    originModuleId: MODULE_ID,
    entityType: "funding_round",
    entityRef: roundId,
  });
  if (questsRepo && pot && out.funded.length > 0) await ensureQuests(pool, { questsRepo }, roundId, pot);
  return out;
}

/**
 * WHAT CLOSING THE DIVERGENCE VOTE DOES, written into `SUBJECT_CLOSERS` by
 * server/index.ts. Carried, `execute` switches the held quests to the other
 * count once the landing is due. Every other ending (not carried, too few
 * votes, withdrawn, stopped by a steward, written off) keeps the deciding
 * count, at once. Idempotent: the round's result is claimed once.
 */
export function fundingDivergenceCloser(deps: () => { pool: Pool; questsRepo: HarvestDeps["questsRepo"] }): SubjectCloser {
  const keep = async (roundId: string, why: string) => settleDivergence(deps().pool, roundId, "decider", why, deps().questsRepo);
  return {
    settle: async (b, outcome) => {
      if (outcome === "passed") return { applied: [], held: null, proposerTold: null };
      const r = await keep(b.subjectRef, outcome === "no_quorum" ? "Too few voted, so the deciding count stands." : "The vote did not carry, so the deciding count stands.");
      return { applied: r.settled ? [`${FUNDING_DIVERGENCE}:${b.subjectRef}:decider`] : [], held: null, proposerTold: null };
    },
    execute: async (b) => {
      const r = await settleDivergence(deps().pool, b.subjectRef, "other", "The village voted to fund these quests by the other count.", deps().questsRepo);
      return {
        applied: r.settled ? [`${FUNDING_DIVERGENCE}:${b.subjectRef}:other`] : [],
        held: r.settled ? null : "this round's held quests had already been settled",
        proposerTold: null,
      };
    },
    onWithdraw: async (b) => {
      await keep(b.subjectRef, "The vote was withdrawn, so the deciding count stands.");
    },
    onUnlanded: async (b, reason) => {
      await keep(b.subjectRef, reason === "vetoed" ? "A steward stopped the switch, so the deciding count stands." : "The switch was written off, so the deciding count stands.");
    },
  };
}

/**
 * Each funded idea becomes a quest on the board, through the same repo the
 * admin form and accepted proposals use. Priced as asked: a currency pot's
 * quest pays that cash at consent, through the existing cash rails. Runs on
 * every harvest read, so a quest that failed to save is made next time.
 */
async function ensureQuests(pool: Pool, deps: Pick<HarvestDeps, "questsRepo">, roundId: string, pot: PotRow): Promise<void> {
  const funded = (await ideasOfRound(pool, roundId)).filter((i) => i.status === "funded" && !i.questId);
  if (funded.length === 0) return;
  let order = (await deps.questsRepo.all()).length;
  let made = 0;
  const cash = pot.unitKind === "currency";
  for (const i of funded) {
    const quest: QuestRecord = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: i.title.slice(0, 160),
      description: i.what,
      impact: i.whoHelps,
      deliverable: i.deliverable,
      gratitude: "",
      valueMinor: cash ? i.askMinor : null,
      valueCurrency: cash ? pot.unitCode : null,
      cashMinor: cash ? i.askMinor : null,
      cashCurrency: cash ? pot.unitCode : null,
      tags: ["funding-round"],
      status: "Open",
      order: ++order,
      isExample: false,
    };
    // Claim first: only the request that wins the claim makes the quest.
    if (!(await claimIdeaQuest(pool, i.id, quest.id))) continue;
    try {
      await deps.questsRepo.add(quest);
    } catch (err) {
      await releaseIdeaQuest(pool, i.id, quest.id);
      throw err;
    }
    await setEarmarkQuest(pool, i.id, quest.id);
    made++;
  }
  if (made > 0) onRealItemPublished(pool, "quests", null);
}

export { interactionCountsFor };

// ── member export and erasure ───────────────────────────────────────────────

/** A member's own Funding rounds data: their ideas (anonymous ones included, they are theirs), their ticks, their frozen Voice per round and their interaction rows. */
export async function exportMemberFundingRounds(pool: Pool, userId: string): Promise<unknown> {
  const ideas = await ideasByAuthor(pool, userId);
  return {
    ideas: ideas.map((i) => ({
      id: i.id, roundId: i.roundId, title: i.title, what: i.what, deliverable: i.deliverable, askMinor: i.askMinor,
      shownAs: i.shownAs, status: i.status, createdAt: i.createdAt,
    })),
    marks: await allMarksOf(pool, userId),
    voice: await allVoiceOf(pool, userId),
    pledges: (await pledgesByBacker(pool, userId)).map(pledgeView),
    interactions: await interactionsOf(pool, userId),
  };
}

export async function forgetMemberFundingRounds(pool: Pool, userId: string): Promise<void> {
  await forgetMember(pool, userId);
}

/** The off switch waits while a round has moved past seed and is not closed. */
export async function fundingRoundsOpenState(pool: Pool): Promise<{ count: number; description: string }> {
  const n = await openRoundCount(pool, new Date());
  return { count: n, description: n === 1 ? "a funding round is under way" : `${n} funding rounds are under way` };
}
