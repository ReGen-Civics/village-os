/**
 * WHO VOTES ON STARTING THE GAME, AND HOW MANY OF THEM MUST SAY YES.
 *
 * Rye, 2026-11-27: the launch carries with "Not everyone, but at least 3
 * members holding the founder role". The details he accepted the same day are
 * on the `village_launch` entry in shared/ballotSubjects.ts. This file is the
 * first of them: who is frozen onto the roll.
 *
 * ── THE RULE AS SHIPPED: THE FOUNDERS PRESENT WHEN THE VOTE OPENS ───────────
 *
 * Every account whose stored role is `founder`, that is a present person
 * (`isPresentMember`: a claimed account, no tombstone, no example identity),
 * and that has not left the village (`withoutFormerMembers`, the same filter
 * every other roll runs). Nothing else is asked. In particular the progression
 * rung that unlocks `ballot.vote` is NOT asked: the founder role is the
 * standing this vote reads, and a founder who never walked the member ladder
 * is still a founder.
 *
 * ── WHAT A VILLAGE MAY CHANGE (Rye, 2026-11-06) ─────────────────────────────
 *
 * "EVERYTHING can change with the highest village vote", and no action may be
 * left without a vote path. So both halves are the village's own settings:
 *
 *   `governance.launch_roll`           who counts: `founders` as shipped, or
 *                                      `members`, every member who holds a
 *                                      voice (the roll every other vote uses).
 *   `governance.launch_min_electorate` how many of them must say yes, and so
 *                                      how many must be on the roll before the
 *                                      vote may open. Three, never fewer.
 *
 * A founder sets them before the Game starts. Once a village is issuing they
 * close to the panel and move only by a vote at its highest tier
 * (server/lib/launchDoors.ts). `launchRollProblem` says which of those two is
 * the way through for the village reading it.
 *
 * ── EACH PERSON COUNTS ONCE ─────────────────────────────────────────────────
 *
 * The ruling counts people. So every seat is frozen at a weight of one and the
 * ballot is stamped `equal`, whatever `governance.weight_mode` says and
 * whichever roll the village chose. A village that weighs its ordinary votes
 * by a token or by an allocation table keeps doing so from its first ordinary
 * vote. On this one a founder holding no token would otherwise weigh nothing,
 * and a no that weighs nothing would not hold the vote, which is the opposite
 * of the rule.
 *
 * ── WHO IS MISSING, SAID BY NAME ────────────────────────────────────────────
 *
 * On a roll of founders, a founder account that cannot be on it is named with
 * its reason, so a village short of its number is told which invitation is
 * still unanswered instead of a bare count.
 */
import { electorateFloorProblem, launchMinElectorate, LAUNCH_YES_HEADS, VILLAGE_LAUNCH, type LaunchRollKind } from "../../shared/ballotSubjects";

/** The member fields this reads. Any member record satisfies it. */
export interface FounderRecord {
  id?: unknown;
  name?: unknown;
  role?: unknown;
  email?: unknown;
  [key: string]: unknown;
}

export interface LaunchRollDeps {
  /** Every member record. */
  members: () => Promise<FounderRecord[]>;
  /** `isPresentMember` with the session secret bound. */
  isPresent: (member: FounderRecord) => boolean;
  /** The former-member filter every roll runs (`withoutFormerMembers`). */
  withoutFormer: (people: FounderRecord[]) => Promise<FounderRecord[]>;
  /** How the village reads a name. */
  shortName: (name: string) => string;
  /**
   * The ids on the roll every ordinary vote uses: present members holding
   * `ballot.vote`, former members left out. Read only when the village's
   * launch asks every member.
   */
  votingRoll: () => Promise<string[]>;
}

export type NotOnTheRollReason = "not_signed_in" | "left";

export interface LaunchRoll {
  /** Who this village's launch asks. */
  kind: LaunchRollKind;
  /** What `openBallot` freezes: everybody on the roll at one. */
  electorate: Array<{ userId: string; weight: number }>;
  /**
   * The people on the roll, by the name the village reads, in a stable order.
   * Named `founders` for the roll as shipped; on a roll of members it holds
   * the members.
   */
  founders: Array<{ id: string; name: string }>;
  /** Accounts holding the founder role that are not on a roll of founders, and why. Empty on a roll of members. */
  notOnTheRoll: Array<{ id: string; name: string; reason: NotOnTheRollReason }>;
}

/** The weight every seat is frozen at. One person, one answer. */
export const FOUNDER_SEAT_WEIGHT = 1;

/** Build the launch roll as it stands now. Reads, and writes nothing. */
export async function launchRollNow(deps: LaunchRollDeps, kind: LaunchRollKind = "founders"): Promise<LaunchRoll> {
  const everyone = (await deps.members()).filter((u) => String(u.id ?? "") !== "");
  const byId = (a: FounderRecord, b: FounderRecord) => String(a.id).localeCompare(String(b.id));
  const named = (u: FounderRecord) => ({
    id: String(u.id),
    name: deps.shortName(String(u.name ?? "")) || (kind === "founders" ? "A founding member" : "A member"),
  });

  if (kind === "members") {
    const voting = new Set(await deps.votingRoll());
    const here = everyone.filter((u) => voting.has(String(u.id))).sort(byId);
    return {
      kind,
      electorate: here.map((u) => ({ userId: String(u.id), weight: FOUNDER_SEAT_WEIGHT })),
      founders: here.map(named),
      notOnTheRoll: [],
    };
  }

  const holders = everyone.filter((u) => String(u.role ?? "") === "founder").sort(byId);
  const present = holders.filter((u) => deps.isPresent(u));
  const here = await deps.withoutFormer(present);
  const hereIds = new Set(here.map((u) => String(u.id)));
  const presentIds = new Set(present.map((u) => String(u.id)));
  return {
    kind,
    electorate: here.map((u) => ({ userId: String(u.id), weight: FOUNDER_SEAT_WEIGHT })),
    founders: here.map(named),
    notOnTheRoll: holders
      .filter((u) => !hereIds.has(String(u.id)))
      .map((u) => ({ ...named(u), reason: presentIds.has(String(u.id)) ? ("left" as const) : ("not_signed_in" as const) })),
  };
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The two facts that decide which way through a village short of its number has. */
export interface LaunchRollStanding {
  /** `governance.launch_min_electorate`, raw. Held at three or above by the reader. */
  villageMin?: number;
  /**
   * Whether a founder may still give the founder role and set the launch's
   * dials directly: `founderPowerStands`, true until the village is issuing.
   * Absent reads as true, which is every village that has not started.
   */
  founderPowerStands?: boolean;
}

/**
 * Why the launch vote cannot open on this roll, or null when it can.
 *
 * The count comes from `electorateFloorProblem`, so the sentence and the
 * number a route refuses on are the same reading. Added here: who is on the
 * roll, which founder accounts are not and why, and THE WAY THROUGH, because
 * no village may be left with no path (Rye, 2026-11-06).
 */
export function launchRollProblem(roll: LaunchRoll, standing: LaunchRollStanding = {}): string | null {
  const short = electorateFloorProblem(VILLAGE_LAUNCH, roll.electorate.length, standing.villageMin, roll.kind);
  if (!short) return null;
  const parts = [short];
  if (roll.founders.length > 0 && roll.founders.length <= 12) parts.push(`On the roll: ${listNames(roll.founders.map((f) => f.name))}.`);
  const waiting = roll.notOnTheRoll.filter((f) => f.reason === "not_signed_in").map((f) => f.name);
  if (waiting.length > 0) {
    parts.push(
      waiting.length === 1
        ? `${waiting[0]} holds the founder role and has not signed in yet, so that account is not on the roll.`
        : `${listNames(waiting)} hold the founder role and have not signed in yet, so those accounts are not on the roll.`,
    );
  }
  const gone = roll.notOnTheRoll.filter((f) => f.reason === "left").map((f) => f.name);
  if (gone.length > 0) {
    parts.push(
      gone.length === 1
        ? `${gone[0]} holds the founder role and has left the village, so that account is not on the roll.`
        : `${listNames(gone)} hold the founder role and have left the village, so those accounts are not on the roll.`,
    );
  }
  const asked = standing.villageMin === undefined ? LAUNCH_YES_HEADS : launchMinElectorate(standing.villageMin);
  parts.push(wayThrough(roll.kind, standing.founderPowerStands !== false, asked));
  return parts.join(" ");
}

/**
 * The path for a village short of its number. Four cases, because who may do
 * what changes the day a village starts issuing (R90): before it, a founder
 * gives the role and sets the dials; after it, nobody new is made a founder
 * and the launch's two settings move only by the village's highest vote.
 */
function wayThrough(kind: LaunchRollKind, founderPowerStands: boolean, asked: number): string {
  if (kind === "members") {
    // Three is the floor nothing lowers (R67), so at three the only way is more people.
    if (asked <= LAUNCH_YES_HEADS) return "The way through: more members join. A launch needs three people.";
    return founderPowerStands
      ? "The way through: more members join, or a founder lowers how many the launch asks in the governance settings, never below three."
      : "The way through: more members join, or the village lowers how many the launch asks, never below three, by a vote at its highest tier.";
  }
  return founderPowerStands
    ? "The way through: a founder gives the Founder access to more people on their card in Admin, People, or sets the launch to ask every member in the governance settings."
    : "The way through: nobody new can be given the founder role now that this village is issuing, so the village changes who the launch asks, by a vote at its highest tier that every member answers.";
}

/** What the frozen document says about how an answer is counted. */
export const FOUNDERS_COUNT_ONCE = "Each person on this roll counts once, whatever weight the village gives its ordinary votes.";
