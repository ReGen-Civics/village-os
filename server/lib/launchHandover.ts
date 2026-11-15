/**
 * WHAT THE LAUNCH HANDS TO THE VILLAGE: the stewards' own selection (Rye,
 * 2026-11-01).
 *
 * "At launch the stewards select WHAT powers are being passed over. It
 * doesn't pass none; they select which powers the launch passes over." The
 * selection may be none, some or all of `HANDOVER_SET`. Before this, the
 * launch closer crossed all nineteen at once, hardcoded.
 *
 * One document in `app_config`, written whole by the one hand-over control
 * (server/routes/stewardHandover.ts) and read once by the launch closer
 * (`seatCatalystsAsStewards`, step 3), which moves exactly what it names.
 *
 * NOTHING SELECTED MOVES NOTHING. An absent document, an unreadable one, and a
 * key that is not a power the stewards hold all read as "not selected", so a
 * failure here leaves every power with the stewards: the state a village is in
 * after launch anyway, and one the stewards change by their own act.
 */
import type { Pool, PoolConnection } from "mysql2/promise";
import { HANDOVER_SET, type Capability } from "../../shared/capabilities";
import { CAPABILITY_CONSEQUENCE } from "../../shared/draftKinds";
import { readConfigDocument, writeConfigDocument } from "../repos/appConfigDocs";
import { POWERS } from "./capabilityRegistry";

export interface PowerInPlainWords {
  /** Its name in the admin list. */
  title: string;
  /** What holding it lets somebody do, as a phrase that follows "can". */
  consequence: string;
}

/** One power in the words a member reads: on the checklist and in the launch document. */
export function powerInPlainWords(capability: string): PowerInPlainWords {
  const entry = POWERS.find((p) => p.capability === capability);
  return { title: entry?.title ?? capability, consequence: CAPABILITY_CONSEQUENCE[capability as Capability] ?? capability };
}

/**
 * MATURE VILLAGES ONLY (Rye, 2026-11-01): "a village should be able to run
 * without admins or stewards (only the most mature would)". These can always
 * be handed over, and the hand-over asks a second, explicit confirm first:
 * the veto that stops a carried decision, the money, the module switch and
 * the village's dials.
 */
export const MATURE_ONLY: readonly Capability[] = ["steward.veto", "cash.pay", "role.pay", "exchange.manage", "module.switch", "dial.set"];

export function isMatureOnly(capability: string): boolean {
  return (MATURE_ONLY as readonly string[]).includes(capability);
}

export const LAUNCH_HANDOVER_KEY = "launch-handover";

export interface LaunchSelection {
  /** The powers the launch hands to the village, in `HANDOVER_SET` order. */
  capabilities: Capability[];
  chosenBy: string | null;
  chosenAt: string | null;
}

const NONE: LaunchSelection = { capabilities: [], chosenBy: null, chosenAt: null };

/** Keep only powers the stewards hold, once each, in the set's own order. */
export function onlyHandoverPowers(raw: unknown): Capability[] {
  const asked = new Set(Array.isArray(raw) ? raw.map(String) : []);
  return HANDOVER_SET.filter((c) => asked.has(c));
}

export async function readLaunchSelection(pool: Pool): Promise<LaunchSelection> {
  try {
    const doc = await readConfigDocument<{ capabilities?: unknown; chosenBy?: unknown; chosenAt?: unknown }>(pool, LAUNCH_HANDOVER_KEY);
    if (!doc) return { ...NONE };
    return {
      capabilities: onlyHandoverPowers(doc.capabilities),
      chosenBy: doc.chosenBy ? String(doc.chosenBy) : null,
      chosenAt: doc.chosenAt ? String(doc.chosenAt) : null,
    };
  } catch (e) {
    console.error("[launch handover] could not read the launch selection, so the launch hands nothing over", e);
    return { ...NONE };
  }
}

export async function writeLaunchSelection(
  pool: Pool,
  capabilities: readonly string[],
  chosenBy: string,
  at: Date = new Date(),
): Promise<LaunchSelection> {
  const selection: LaunchSelection = { capabilities: onlyHandoverPowers(capabilities), chosenBy, chosenAt: at.toISOString() };
  await writeConfigDocument(pool, LAUNCH_HANDOVER_KEY, { ...selection });
  return selection;
}

/**
 * THE SELECTION A LAUNCH VOTE OPENED WITH, frozen beside the ballot (audit S3).
 *
 * The launch document tells the roll, in plain words, which powers the launch
 * hands over, read off the live selection when the vote opens. The closer used
 * to read the live selection again at the close, so whatever the document said
 * and whatever crossed could differ. The copy is written in the same
 * transaction that opens the ballot (`openBallot`'s `onOpen`), keyed by the
 * ballot's id, and the closer moves exactly that copy.
 *
 * WHY HERE AND NOT ON THE BALLOT ROW. `ballots` carries no JSON column, and
 * `doc_markdown` is display copy that a copy edit would break a parser on, so
 * the copy lives in its own `app_config` document naming the ballot. No
 * migration.
 */
export const LAUNCH_HANDOVER_FROZEN_KEY = "launch-handover-frozen";

export async function freezeLaunchSelection(conn: Pool | PoolConnection, ballotId: string, capabilities: readonly string[], at: Date = new Date()): Promise<void> {
  await writeConfigDocument(conn, LAUNCH_HANDOVER_FROZEN_KEY, { ballotId, capabilities: onlyHandoverPowers(capabilities), frozenAt: at.toISOString() });
}

/**
 * The powers a launch ballot opened with, or null when no copy names this
 * ballot (a vote opened before the copy existed). A failed read throws, so a
 * closer never falls back silently on a read error.
 */
export async function frozenLaunchSelection(pool: Pool, ballotId: string): Promise<Capability[] | null> {
  const doc = await readConfigDocument<{ ballotId?: unknown; capabilities?: unknown }>(pool, LAUNCH_HANDOVER_FROZEN_KEY);
  if (!doc || String(doc.ballotId ?? "") !== ballotId) return null;
  return onlyHandoverPowers(doc.capabilities);
}

/**
 * WHETHER THE LAUNCH'S CROSSING IS STILL OWED (R165).
 *
 * The launch hands the village the stewards' selection only when somebody
 * holds the steward seat; with nobody seated it waits, and the comments said
 * it crosses "the moment the village votes somebody into the role". Nothing
 * did. This marker is what lets the vote-seating finish it exactly once:
 *   waiting  the launch carried with nobody in the seat, so the selection is owed
 *   crossed  the selection has crossed (at launch, or at the first vote-seating)
 * Absent is a village that launched before this marker existed, and it is
 * left alone: a later seating never re-crosses a power the village may since
 * have voted back.
 */
export const LAUNCH_CROSSING_KEY = "launch-crossing";
export type LaunchCrossing = "waiting" | "crossed";

export async function readLaunchCrossing(pool: Pool): Promise<LaunchCrossing | null> {
  try {
    const doc = await readConfigDocument<{ state?: unknown }>(pool, LAUNCH_CROSSING_KEY);
    return doc?.state === "waiting" || doc?.state === "crossed" ? doc.state : null;
  } catch {
    return null;
  }
}

export async function writeLaunchCrossing(pool: Pool, state: LaunchCrossing, at: Date = new Date(), launchBallotId: string | null = null): Promise<void> {
  await writeConfigDocument(pool, LAUNCH_CROSSING_KEY, { state, at: at.toISOString(), ...(launchBallotId ? { launchBallotId } : {}) });
}

/** The launch ballot whose crossing is owed, when the marker names one. */
export async function owedLaunchBallotId(pool: Pool): Promise<string | null> {
  try {
    const doc = await readConfigDocument<{ launchBallotId?: unknown }>(pool, LAUNCH_CROSSING_KEY);
    return typeof doc?.launchBallotId === "string" && doc.launchBallotId ? doc.launchBallotId : null;
  } catch {
    return null;
  }
}

/**
 * What a launch hands over: the copy its ballot opened with, and the live
 * selection only for a vote opened before the copy existed (the hand-over
 * control refused changes while such a vote was open, so the two agree).
 */
export async function selectionForLaunch(pool: Pool, launchBallotId: string | null): Promise<Capability[]> {
  const frozen = launchBallotId ? await frozenLaunchSelection(pool, launchBallotId) : null;
  return frozen ?? (await readLaunchSelection(pool)).capabilities;
}
