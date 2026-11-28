/**
 * READING THE LAUNCH FACTS (`shared/launchFacts.ts` says what each one means
 * and which server door reads it).
 *
 * EVERY FACT COMES FROM THE READER ITS DOOR ALREADY USES. `readGameStart` for
 * issuance, `launchedAtOf` and `launchedByBallotIdOf` for the launch record,
 * the ballot engine for the vote. Nothing here keeps a second copy of a rule:
 * two readers of one field is how two screens start disagreeing about a
 * village, and `server/lib/launch.ts` says so about these very fields.
 *
 * NO CHECK RUNS. `launchStatus` resolves every launch requirement, some of
 * which ask a mail provider or a DNS host. These are a handful of indexed
 * reads, so a status line can ask on every screen.
 */
import type { Pool } from "mysql2/promise";
import { LAUNCH_SUBJECT_REF, VILLAGE_LAUNCH } from "../../shared/ballotSubjects";
import type { LaunchFacts, LaunchVoteRecord } from "../../shared/launchFacts";
import { ballotsFor } from "./ballots";
import { readGameStart } from "./gameStart";
import { launchedAtOf, launchedByBallotIdOf } from "./launch";
import { villageIsClaimed } from "../repos/launchFacts";

export async function readLaunchFacts(pool: Pool): Promise<LaunchFacts> {
  const [claimed, gameStart, ballots] = await Promise.all([
    villageIsClaimed(pool),
    readGameStart(pool),
    ballotsFor(pool, VILLAGE_LAUNCH, LAUNCH_SUBJECT_REF),
  ]);

  /*
   * The launch record is one document and `recordLaunchCarried` writes both
   * fields in one statement, but these are two reads of it. A vote carrying
   * between them would hand back a ballot with no instant. So the instant is
   * read first, and read once more in the one case that can only be that race.
   */
  let launchedAt = await launchedAtOf(pool);
  const launchedByBallotId = await launchedByBallotIdOf(pool);
  if (launchedByBallotId !== null && launchedAt === null) launchedAt = await launchedAtOf(pool);

  // Newest first, as the engine returns them. A ballot the quorum fallback
  // asked again (`no_quorum_rerun`) is closed and is not an outcome: the
  // answer is its re-run's, which is the newer row.
  const open = ballots.find((b) => b.status === "open") ?? null;
  const closed = ballots.find((b) => b.status !== "open" && b.status !== "no_quorum_rerun") ?? null;
  const lastVote: LaunchVoteRecord | null = closed
    ? { id: closed.id, status: closed.status, closedAt: closed.closedAt }
    : null;

  return {
    claimed,
    issuing: gameStart.started,
    issuingSince: gameStart.startedAt,
    voteCarried: launchedByBallotId !== null,
    launchedByBallotId,
    checklistFrozen: launchedAt !== null,
    launchedAt,
    voteOpen: open !== null,
    openBallotId: open ? open.id : null,
    lastVote,
    // `founderPowerStands` in ./gameStart is this same reading of the same row.
    founderPowerStands: !gameStart.started,
  };
}
