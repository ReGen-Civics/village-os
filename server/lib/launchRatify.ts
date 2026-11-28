/**
 * THE RATIFYING LAUNCH VOTE: for a village that is already issuing and never
 * held its launch vote.
 *
 * Rye, 27 Nov 2026 (the Admin Garden plan, section 2): the first village is
 * "issuing on purpose", and it holds "one ratifying launch vote that does not
 * restart issuance".
 *
 * ── THE STATE THIS IS FOR ───────────────────────────────────────────────────
 *
 * Migration 0112 recorded `game-start` for every village that was already
 * issuing before the launch vote existed, with no ballot behind it, and wrote
 * no launch state for them. So such a village has two facts that disagree:
 * issuance is open (`game-start`), and its launch vote never carried
 * (`launch-state.launchedByBallotId`). Until this file, `POST
 * /api/admin/launch/propose` answered 409 for it, because the route that must
 * never start a Game twice read the first fact alone. The village could never
 * hold the vote that seats its stewards and hands its powers over.
 *
 * ── WHAT A RATIFYING VOTE IS ────────────────────────────────────────────────
 *
 * The same launch vote, with the same rule, the same roll, the same document
 * sections and the same closer, minus the one thing that already happened:
 *
 *   IT NEVER STARTS ISSUANCE AND NEVER MOVES THE DAY ISSUANCE BEGAN.
 *
 * When it carries, the launch is recorded (`recordLaunchCarried`) and
 * `recordGameStart` is not called. `game-start` keeps its `startedAt`, and it
 * keeps its null ballot id, which is what `handTokenMintOverFor0112`
 * (server/lib/tokenMintHandover.ts) keys on: that boot step still reads the
 * village as one that started before the vote existed, which stays true.
 *
 * ── ONCE, AND NEVER FOR A VILLAGE THAT VOTED ────────────────────────────────
 *
 * `mayRatify` is true only while `game-start` is set with NO ballot id AND
 * the launch has no ballot on record. A village that started by its own vote
 * carries that ballot's id on `game-start`. A ratified village carries the
 * ratifying ballot on the launch state. Either reads false, so there is one
 * ratifying vote in a village's life, and none for a village that needs none.
 */
import type { Pool, PoolConnection } from "mysql2/promise";
import { readGameStart, type GameStart } from "./gameStart";
import { launchedByBallotIdOf } from "./launch";

export interface RatifyStanding {
  /** A launch ballot may open on this village although it is already issuing. */
  mayRatify: boolean;
  /** The day issuance began, as `game-start` holds it. Null when the Game has not started. */
  issuingSince: string | null;
  /** The fact itself, so a caller that needs both does not read it twice. */
  gameStart: GameStart;
}

/** Whether this village may hold its one ratifying launch vote. Reads, and writes nothing. */
export async function ratifyStanding(pool: Pool | PoolConnection): Promise<RatifyStanding> {
  const gameStart = await readGameStart(pool);
  const mayRatify =
    gameStart.started && gameStart.ballotId === null && (await launchedByBallotIdOf(pool as Pool)) === null;
  return { mayRatify, issuingSince: gameStart.startedAt, gameStart };
}

/**
 * Whether the launch ballot being closed is a ratifying one: the Game had
 * already started, and this ballot is not the one that started it.
 *
 * Read from the fact and never from the ballot's title, so a re-run of the
 * closer answers the same way: a village this ballot started carries this
 * ballot's id on `game-start` and reads false, and a village that was issuing
 * before it reads true however many times it is asked.
 */
export function isRatifying(gameStart: GameStart, ballotId: string): boolean {
  return gameStart.started && gameStart.ballotId !== ballotId;
}

/** The civil day issuance began, for a sentence. Empty when unknown. */
export function issuingSinceDay(issuingSince: string | null | undefined): string {
  const iso = String(issuingSince ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : "";
}

/**
 * The words a ratifying vote says where a first launch says "issuance starts".
 * One home, so the route, the closer and the tests read the same sentences.
 */
export const RATIFY_WORDS = {
  title: (villageName: string) => `Ratify the launch of ${villageName}`,
  deciding: "The village is deciding whether to put its launch on the record",
  carriedTitle: (title: string) => `The village ratified its launch: ${title}`,
  carriedBody: (issuingSince: string | null) => {
    const day = issuingSinceDay(issuingSince);
    return day
      ? `The launch is on the record. Token issuance began on ${day}, and that date has not moved.`
      : "The launch is on the record. Token issuance was already open, and nothing about it has moved.";
  },
  carriedPulse: "The village put its launch on the record: its launch vote carried.",
  shortTitle: "Too few on the roll said yes, so the launch is not on the record yet",
  shortBody:
    "The window ended before enough of the roll had said yes. Nothing has changed, issuance carries on as it was, and it can be asked again whenever they are more gathered.",
  notRatifiedTitle: "The village did not ratify its launch",
  mintNote: "The launch was ratified: the founding stewards and the Treasury role mint from today (Rye, 2026-11-15).",
} as const;
