/**
 * THE LAUNCH FACTS: where this village stands, one field per fact a server
 * door reads, and one display label over them.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * "Has this village launched" is four different facts, written by four
 * different events, and they only agree for a village that launched by its own
 * vote after that vote existed:
 *
 *   claimed            a founder or an admin account exists. The bootstrap
 *                      door (`POST /api/admin/bootstrap`) asks this before the
 *                      shared password may do anything.
 *   issuing            the `game-start` row (`server/lib/gameStart.ts`). The
 *                      ledger reads it on every faucet posting, and
 *                      `POST /api/admin/launch/propose` refuses once it is set.
 *   vote carried       `launch-state.launchedByBallotId`
 *                      (`launchBallotCarried`, `server/lib/launch.ts`). The
 *                      module switch, the key co-sign and the seating read it.
 *   checklist frozen   `launch-state.launchedAt`. `confirmManual` refuses a
 *                      launch row's answer once it is set.
 *
 * Migration 0112 recorded `game-start` for every village that was already
 * issuing before the vote existed and wrote no launch state for them, so such
 * a village is issuing with no vote held and an open checklist. A screen that
 * read only `launchedAt` offered that village a button to open its vote, and
 * the server answered 409. The fix is the rule below, and this file is what
 * makes it cheap to follow:
 *
 *   EACH CONTROL READS THE FACT ITS OWN SERVER DOOR READS.
 *
 * ── THE LABEL IS FOR DISPLAY, AND ONLY FOR DISPLAY ─────────────────────────
 *
 * `launchLabel` folds the facts into one of six plain names for a status line.
 * It loses information on purpose (a village can be issuing AND have a vote
 * open), so nothing may decide access by it. A server gate reads the fact, by
 * its own reader, inside its own transaction where it needs one.
 * `shared/launchFacts.guard.test.ts` fails when server code outside the route
 * that serves the label imports it.
 */

/** The newest launch ballot that has closed, whatever it decided. */
export interface LaunchVoteRecord {
  id: string;
  /** The ballot's closing status as the engine wrote it: passed, failed, no_quorum, withdrawn. */
  status: string;
  closedAt: string | null;
}

export interface LaunchFacts {
  /** A founder or an admin account exists, so the shared bootstrap password is spent. */
  claimed: boolean;
  /** Token issuance is open (`game-start`). True for a village migration 0112 recorded, with no vote behind it. */
  issuing: boolean;
  /** The instant issuance opened, or null. */
  issuingSince: string | null;
  /** The village's own launch vote carried (`launch-state.launchedByBallotId`). */
  voteCarried: boolean;
  /** The ballot that carried, or null. */
  launchedByBallotId: string | null;
  /** The launch checklist is a record and its answers no longer change (`launch-state.launchedAt`). */
  checklistFrozen: boolean;
  /** The instant the checklist froze, or null. */
  launchedAt: string | null;
  /** A launch ballot is open now. */
  voteOpen: boolean;
  /** That ballot, or null. */
  openBallotId: string | null;
  /** The newest launch ballot that closed, or null when none was ever held. */
  lastVote: LaunchVoteRecord | null;
  /** The founder role still carries powers of its own (R90). It ends when issuance opens. */
  founderPowerStands: boolean;
}

/** The six display names, in the order a village meets them. */
export const LAUNCH_LABELS = [
  "unclaimed",
  "setup",
  "vote-open",
  "vote-did-not-carry",
  "issuing-vote-not-held",
  "running",
] as const;

export type LaunchLabel = (typeof LAUNCH_LABELS)[number];

/**
 * One plain name for where the village stands. Display only.
 *
 * The order of the tests is the meaning:
 *
 *   unclaimed               nobody holds the village yet.
 *   running                 its own vote carried. Nothing later changes that.
 *   vote-open               a launch ballot is open, whatever else is true.
 *   vote-did-not-carry      the newest launch ballot closed without carrying.
 *   issuing-vote-not-held   tokens are being issued and no launch vote was ever held.
 *   setup                   none of the above: still being built.
 *
 * A village marked launched by the old one-press act (a frozen checklist with
 * no ballot behind it) reads by its other facts here. `checklistFrozen` is the
 * fact a screen reads for the checklist itself.
 */
export function launchLabel(f: LaunchFacts): LaunchLabel {
  if (!f.claimed) return "unclaimed";
  if (f.voteCarried) return "running";
  if (f.voteOpen) return "vote-open";
  if (f.lastVote && f.lastVote.status !== "passed") return "vote-did-not-carry";
  if (f.issuing) return "issuing-vote-not-held";
  return "setup";
}

/** What `GET /api/admin/launch/facts` answers. */
export interface LaunchFactsAnswer {
  facts: LaunchFacts;
  /** Display only. See the header. */
  label: LaunchLabel;
}

/**
 * WHAT A SCREEN MAY OFFER, from the facts and who is looking.
 *
 * Each answer names the server door it mirrors, and reads exactly the facts
 * that door reads, so a screen that follows these never shows a control the
 * server refuses. They are a convenience for the client. The server never
 * calls them: its doors keep their own checks.
 */
export interface LaunchDoors {
  /**
   * `POST /api/admin/launch/confirm`: a launch row may still be answered. The
   * door refuses once the checklist froze.
   */
  rowsOpen: boolean;
  /**
   * `POST /api/admin/launch/propose`: the card that opens the launch vote may
   * be shown as something to act on. The door refuses a village that is
   * already issuing and one whose checklist froze. Who may press, the open
   * rows and the roll are separate conditions the card already reads.
   */
  voteCanBeAsked: boolean;
}

export function launchDoors(f: LaunchFacts): LaunchDoors {
  return {
    rowsOpen: !f.checklistFrozen,
    voteCanBeAsked: !f.issuing && !f.checklistFrozen,
  };
}
