/**
 * THE LAUNCH CARRIES THE MOMENT ITS RULE IS MET.
 *
 * Rye, 2026-11-27: the launch vote "doesn't need to wait 7 days". It carries
 * the moment a third founder says yes, unless a founder has said no
 * (`carriesAtOnce` on the `village_launch` entry, shared/ballotSubjects.ts).
 *
 * ── WHY THIS IS A CLOSE AND NOT A SECOND WAY TO PASS ────────────────────────
 *
 * `closeBallot` is the one function that reads an outcome and takes the
 * guarded transition, and `routeOutcome` is the one road every close takes
 * afterwards. So carrying at once is exactly a close, asked for at a different
 * moment: this module asks `closeBallot` whether the rule is met, and if it
 * is, the ballot closes as passed and routes like any other. If it is not,
 * `closeBallot` refuses and nothing has changed. There is no second place that
 * decides whether a launch carried.
 *
 * ── WHO IS RECORDED AS CLOSING IT ───────────────────────────────────────────
 *
 * `governance`, the same name the clock uses when a window ends. The founder
 * whose yes was the third did not choose the moment any more than the first
 * two did, and a record naming them as the one who launched the village would
 * say something the rule does not.
 *
 * ── TWO CALLERS ─────────────────────────────────────────────────────────────
 *
 * The vote route calls `carryAtOnceIfMet` after every cast on such a ballot,
 * which is what makes it the moment. The five-minute governance job calls
 * `carryEveryMetBallot`, so a process that died between the cast and the close
 * leaves a ballot that carries on the next tick instead of waiting out its
 * window with its rule already met.
 */
import type { Pool } from "mysql2/promise";
import { carriesAtOnce, SUBJECT_THRESHOLDS } from "../../shared/ballotSubjects";
import { ballotById, CARRIED_AT_ONCE_NOTE, closeBallot, type BallotRow } from "./ballots";
import { routeOutcome, type CloseRouting, type LandingDeps } from "./applyDue";
import { openBallotIdsOfSubjects } from "../repos/ballotLandings";

export interface CarryDeps {
  pool: Pool;
  landing: LandingDeps;
  /** Ring the frozen roll with the outcome. Never awaited by this module's callers' responses. */
  tellRoll: (ballot: BallotRow, routing: CloseRouting) => void;
}

export type CarryResult =
  | { carried: true; ballot: BallotRow; routing: CloseRouting }
  | { carried: false };

/** Close and route one ballot if it carries at once and its rule is met now. */
export async function carryAtOnceIfMet(deps: CarryDeps, ballotId: string): Promise<CarryResult> {
  const b = await ballotById(deps.pool, ballotId);
  if (!b || b.status !== "open" || !carriesAtOnce(b.subjectType)) return { carried: false };
  const closed = await closeBallot(deps.pool, {
    ballotId: b.id,
    closedBy: "governance",
    outcomeNote: CARRIED_AT_ONCE_NOTE,
    // Not asked of a subject that carries at once: the rule closes it, never a person's standing.
    closerMayCloseEarly: false,
  });
  // Refused means the rule is not met yet, or somebody closed it first. Either way there is nothing to route here.
  if (!closed.ok || closed.outcome !== "passed") return { carried: false };
  const routing = await routeOutcome(deps.landing, closed.ballot, "passed", closed.ballot.outcomeNote ?? "", "governance");
  deps.tellRoll(closed.ballot, routing);
  return { carried: true, ballot: closed.ballot, routing };
}

/** The same check over every open ballot that carries at once. Returns how many carried. */
export async function carryEveryMetBallot(deps: CarryDeps): Promise<number> {
  const atOnce = Object.keys(SUBJECT_THRESHOLDS).filter((s) => carriesAtOnce(s));
  if (atOnce.length === 0) return 0;
  let carried = 0;
  for (const id of await openBallotIdsOfSubjects(deps.pool, atOnce)) {
    try {
      if ((await carryAtOnceIfMet(deps, id)).carried) carried += 1;
    } catch (e) {
      console.error(`[governance] carrying ballot ${id} at once threw (it stays open and is read again on the next tick)`, e);
    }
  }
  return carried;
}
