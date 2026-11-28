/**
 * WHAT THE LAUNCH PROPOSAL SAYS, AND WHO IT MAY NAME.
 *
 * Two halves of one act, kept together because they are the same sentence seen
 * from two sides: `launchSlateProblem` decides who a proposal is ALLOWED to
 * put forward for the inaugural steward's seat, and `launchProposalDoc` writes
 * what the village READS about them.
 *
 * ── RYE'S CHOICE, 2026-09-24 ───────────────────────────────────────────────
 *
 * Shown two designs, he picked this one: "is whoever is clicking the 'launch
 * village' button then selects from a list of members in the proposal to carry
 * the steward role so then it's there in the proposal to be voted on. I like
 * this second route better." Asked who may be on that list and what happens to
 * somebody who does not want the job: "founders only for this first season
 * (after that anyone can raise their hand for a steward role and fill it if
 * voted in), and show the declines".
 *
 * ── WHY THE DOCUMENT HAS TO NAME THEM ──────────────────────────────────────
 *
 * `ballots.doc_markdown` is frozen when the vote opens and is the thing every
 * member actually votes on. A slate that lived only in a side table and a page
 * component would be a proposal whose own text did not say what it proposed,
 * and a member reading the frozen document a year later would find no record
 * of who the village agreed to seat. "So it's there in the proposal to be
 * voted on" is a requirement about this string, not about a screen.
 *
 * ── TWO THINGS THE TEXT IS HONEST ABOUT, AND WHY THEY ARE HERE ─────────────
 *
 * ONE PERSON CHOSE IT. The slate is picked by whoever opened the vote, not by
 * the village, and the village is voting on somebody else's list. The document
 * says whose list it is. That is the whole reason this design needed a consent
 * step: a slate chosen by one hand can name somebody who does not want the
 * job.
 *
 * IT IS ALL NINETEEN POWERS. Accepting is not accepting a title. `HANDOVER_SET`
 * is every entrustable power this village has, and at launch the seat holds all
 * of them for the first season (`seatCatalystsAsStewards`). The count comes off
 * that set rather than being typed, for the reason the set's own header gives:
 * a new transferable power joins it without anybody remembering to, and a
 * hand-typed nineteen would then be a promise nobody checks.
 *
 * ── WHAT THIS MODULE DELIBERATELY DOES NOT DECIDE ──────────────────────────
 *
 * Whether anybody is SEATED. That is `seatCatalystsAsStewards` at the close,
 * against who was still a founder then. The founder test here is about who may
 * be PUT ON a slate, which is a different question asked at a different
 * moment, and the close asks its own because `users.role` can move in between.
 */
import type { Pool } from "mysql2/promise";
import type { PowerInPlainWords } from "./launchHandover";
import { LAUNCH_YES_HEADS, type LaunchRollKind } from "../../shared/ballotSubjects";
import { HANDOVER_SET } from "../../shared/capabilities";
import { MODULE_SWITCH_KEY, switchVerdict } from "../../shared/moduleSwitch";
import { ORG_DECIDE } from "./orgDraftDecide";
import { catalystRoster } from "../repos/users";

/** One member a launch proposal puts forward, with the name the village reads. */
export interface SlateMember {
  id: string;
  /** Already shortened by the caller's own `firstName`, so this module holds no second copy of that rule. */
  name: string;
}

/**
 * A DISCRIMINATED UNION ON `ok`, never on the error string.
 *
 * `if (verdict.error)` reads fine and narrows nothing useful: an error string
 * can be empty, so the compiler has to keep the refusal branch alive on the
 * happy path and `members` comes back possibly undefined. A boolean tag makes
 * the narrowing exact, which is the difference between the caller being
 * REQUIRED to handle the refusal and merely being able to.
 */
export type SlateVerdict = { ok: false; error: string } | { ok: true; members: SlateMember[] };

/**
 * A slate bigger than this is not a slate, it is the village.
 *
 * There is no rule from Rye about a maximum and this is deliberately not
 * pretending to be one. It is a bound on a request body, sized so that no
 * plausible founding roll ever meets it, and it exists so a malformed or
 * hostile payload cannot make the opening transaction write an unbounded
 * number of rows. Every real limit is below it already: only founders may be
 * named, and only founders who are on the frozen roll.
 */
const MAX_SLATE = 200;

/**
 * Who may be put on the slate, checked against the roll this vote froze.
 *
 * THREE RULES, and each one is a different failure a village would otherwise
 * discover at the close:
 *
 *   FOUNDERS ONLY, for the first season, in Rye's words. The stored value is
 *   `founder` and the word a player reads is Catalyst; `catalystRoster` holds
 *   the statement and the argument for asking by the stored value.
 *
 *   ON THE ROLL. Accepting rides on the vote row
 *   (`ballot_votes.stands_for_steward`), so somebody who cannot vote on this
 *   ballot has no way to say yes to it. Naming them would be naming somebody
 *   who is guaranteed not to be seated, with nothing on any screen explaining
 *   why. The roll is the one this proposal is about to freeze, so the two
 *   cannot disagree.
 *
 *   NO DUPLICATES. The table's primary key would refuse the second row inside
 *   the opening transaction and roll the whole launch vote back with a driver
 *   error in place of a sentence. Caught here so the answer is a sentence.
 *
 * AN EMPTY SLATE IS NOT AN ERROR. A village may open its launch vote naming
 * nobody, and then it starts its Game with the seat empty, which `nobodyStood`
 * already has words for and which stops nothing. Refusing it would invent a
 * requirement Rye did not make and would block a village whose founders would
 * rather vote somebody in afterwards.
 */
export async function launchSlateProblem(
  pool: Pool,
  raw: unknown,
  roll: readonly { userId: string }[],
  shortName: (name: string) => string,
): Promise<SlateVerdict> {
  if (raw === undefined || raw === null) return { ok: true, members: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "The list of founding stewards has to be a list of members." };
  }
  if (raw.length > MAX_SLATE) {
    return { ok: false, error: `A launch proposal can name at most ${MAX_SLATE} founding stewards.` };
  }
  const ids = raw.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "One member is on the list twice. Each founding steward is named once." };
  }
  if (ids.length === 0) return { ok: true, members: [] };

  const onTheRoll = new Set(roll.map((e) => e.userId));
  const founders = await catalystRoster(pool);
  const byId = new Map(founders.map((f) => [f.id, f]));

  const notFounding = ids.filter((id) => !byId.has(id));
  if (notFounding.length > 0) {
    return {
      ok: false,
      error:
        `Only founding members can carry the steward role for this first season, and ${notFounding.length === 1 ? "one of the people named is not one" : `${notFounding.length} of the people named are not`}. ` +
        `After this season anybody can raise their hand for the role and the village votes them in.`,
    };
  }
  const offTheRoll = ids.filter((id) => !onTheRoll.has(id));
  if (offTheRoll.length > 0) {
    return {
      ok: false,
      error:
        `Everybody named as a founding steward has to be on this vote's roll, because accepting the role is part of answering this vote, and ${offTheRoll.length === 1 ? "one of them is not" : `${offTheRoll.length} of them are not`}.`,
    };
  }
  /*
   * Returned in the order the proposer chose them, which is the order the
   * document lists. The TABLE reads back sorted by id, because a page should
   * not reorder itself between two loads; the frozen document keeps the
   * proposer's order because it is the proposer's sentence.
   */
  return { ok: true, members: ids.map((id) => ({ id, name: shortName(byId.get(id)!.name) })) };
}

export interface LaunchProposalDocInput {
  villageName: string;
  quorumPct: number;
  unityPct: number;
  /** How many founders this vote is frozen to. */
  onTheRoll: number;
  /**
   * The founders on the frozen roll, as the village reads their names, so the
   * document a member opens a year later says who was asked (Rye, 2026-11-27:
   * only founders vote on the launch). Absent on a caller that has no names;
   * the count above is then all the document says.
   */
  founders?: readonly string[];
  /**
   * How many on the roll must say yes: the village's own number, frozen when
   * the vote opened (`governance.launch_min_electorate`, never below three).
   * Absent reads as the rule as shipped.
   */
  yesNeeded?: number;
  /** Who the village's launch asks (`governance.launch_roll`). Absent reads as the founding members. */
  rollKind?: LaunchRollKind;
  /** How an answer is counted on this vote. Empty string when there is nothing to say. */
  weightNote: string;
  /** Whoever opened the vote and chose the slate, as the village reads their name. */
  openedBy: string;
  /** The civil date the journey read done, `YYYY-MM-DD`. */
  openedOn: string;
  slate: readonly SlateMember[];
  /**
   * The powers the launch hands to the village, in plain words: the stewards'
   * selection as it stood when the vote opened (`readLaunchSelection`). Empty
   * is a real answer and the document says so. The hand-over control refuses
   * to change the selection while this vote is open, so what members read here
   * is what crosses.
   */
  handover: readonly PowerInPlainWords[];
  /**
   * Journey rows only the host can clear, open when the vote opened, which
   * this vote carries (`carriedByVote`, shared/launchRequirements.ts). Named
   * in the document so the last line never claims a done the village did not
   * have. Absent or empty means every row read done.
   */
  carriedOpen?: readonly string[];
  /**
   * Set when this is a RATIFYING vote: the village was already issuing when it
   * opened (Rye, 2026-11-27: "one ratifying launch vote that does not restart
   * issuance"). `issuingSince` is the instant `game-start` holds. Every
   * sentence that says issuance starts is replaced, because on this village it
   * already did. Absent means a first launch, exactly as before.
   */
  ratifying?: { issuingSince: string | null };
}

/**
 * The frozen document a launch vote carries.
 *
 * PURE, and that is the point of extracting it: every sentence a village votes
 * on can now be asserted in a test with no database, no ballot and no server,
 * which is what `server/launchProposalDoc.test.ts` does. It used to be an
 * array literal inside the route, where the only way to check a word was to
 * open a vote.
 */
export function launchProposalDoc(input: LaunchProposalDocInput): string {
  return [
    ...openingSection(input),
    ...doorsSection(input),
    ...stewardSection(input),
    ...handoverSection(input),
    "## What this vote asks",
    "",
    // The rule, in Rye's words of 2026-11-27 and the details he accepted, at
    // the number and the roll this village holds. Its home is the
    // village_launch entry in shared/ballotSubjects.ts.
    `${whoVotes(input)} It carries the moment ${yesNeededOf(input)} of them have said yes, unless one of them has said no. It does not wait for the voting window to end.`,
    "",
    "A no from any one of them holds it for as long as that no stands. Whoever said it can change their answer, and so can anybody who said yes, until the vote carries. Once it has carried, no answer moves.",
    "",
    rollKindOf(input) === "founders"
      ? `${rollLine(input)} A member who is not a founding member is not asked on this one vote, and is asked on every vote the village holds after it.`
      : rollLine(input),
    "",
    // An abstention is neither answer: it does not count toward the yeses and
    // it does not hold the vote.
    `An abstention is not a yes and it is not a no. A vote cast for somebody by a person they follow does not count here: each person on the roll answers for themselves. If the window ends before ${yesNeededOf(input)} of them have said yes, nothing changes and the village can ask again.`,
    "",
    // Rye, 2026-11-06: everything changes by the highest village vote. Said in
    // the document, so a reader knows this rule is the village's own.
    "How many must say yes, and who is asked, are this village's own settings. A founder sets them before the Game starts, and after that only a vote at the village's highest tier moves them. This vote froze them as they stood when it opened.",
    "",
    // How weight was assigned when this froze, in the document itself. The
    // roll and the dials are already frozen here; the rule that turned
    // members into weights was not written down anywhere a member reads.
    ...(input.weightNote ? [input.weightNote, ""] : []),
    input.carriedOpen?.length
      ? `Every item on the journey to launch read done when ${input.openedBy} opened this, on ${input.openedOn}, except what only the host can set, which this vote carries open: ${input.carriedOpen.join("; ")}.`
      : `Every item on the journey to launch read done when ${input.openedBy} opened this, on ${input.openedOn}.`,
    "",
  ].join("\n");
}

/**
 * THE OPENING, AND THE ONE PLACE A RATIFYING VOTE READS DIFFERENTLY.
 *
 * A first launch starts issuance, and says so. A ratifying vote is held by a
 * village that has been issuing since before the vote existed, so saying
 * "issuance turns on" would be false twice: it is already on, and a member
 * could read it as a restart. It says what is true instead: the day issuance
 * began, that it does not move, and that nothing already issued changes.
 * Everything below this section is the same for both, because what the launch
 * hands over and who is seated is the same act.
 */
function openingSection(input: LaunchProposalDocInput): string[] {
  if (!input.ratifying) {
    return [
      `# Start the Game`,
      "",
      `${input.villageName} is built. This vote is what starts it.`,
      "",
      "## What changes when this carries",
      "",
      "Token issuance turns on. Until then this village can be set up in every other way, and nothing can be issued to anybody.",
      "",
    ];
  }
  const iso = String(input.ratifying.issuingSince ?? "");
  const day = /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : "";
  return [
    // The vote keeps its name (Rye, 2026-11-28: "Let's stay with start the game and have it as the 'birthday of the game' going forward").
    `# Start the Game`,
    "",
    day
      ? `${input.villageName} has been issuing tokens since ${day}, from before the launch vote existed. This vote starts its Game on the record, and the day it carries is the Game's birthday.`
      : `${input.villageName} was already issuing tokens before the launch vote existed. This vote starts its Game on the record, and the day it carries is the Game's birthday.`,
    "",
    "## What was already running",
    "",
    day
      ? `Token issuance. It does not restart, and the day it began stays ${day}. Nothing already issued changes, and nobody's balance moves because of this vote.`
      : "Token issuance. It does not restart, and the day it began does not move. Nothing already issued changes, and nobody's balance moves because of this vote.",
    "",
    "## What changes when this carries",
    "",
    "That day is the Game's birthday, and Moon 1 is the moon it falls in. The village's powers pass the way a launch passes them, as the sections below say: who may turn a module on, who may publish the org chart, who is seated as a steward, and what the village holds from that day.",
    "",
  ];
}

const rollKindOf = (input: LaunchProposalDocInput): LaunchRollKind => input.rollKind ?? "founders";

/** The village's number, never below the three the rule ships with. */
const yesNeededOf = (input: LaunchProposalDocInput): number =>
  Math.max(LAUNCH_YES_HEADS, Math.trunc(Number(input.yesNeeded ?? LAUNCH_YES_HEADS)) || LAUNCH_YES_HEADS);

function whoVotes(input: LaunchProposalDocInput): string {
  return rollKindOf(input) === "founders"
    ? "Only founding members vote on this."
    : "Every member who holds a voice votes on this, each counted once.";
}

/** Who the vote is frozen to: by name when the caller has them and the list is short, and the count either way. */
function rollLine(input: LaunchProposalDocInput): string {
  const n = input.onTheRoll;
  const one = rollKindOf(input) === "founders" ? "founding member" : "member";
  const who = input.founders?.length && input.founders.length <= 24 ? `: ${nameList(input.founders)}` : "";
  return n === 1
    ? `One ${one} is on the roll today${who}, and this vote is frozen to that one.`
    : `${n} ${one}s are on the roll today${who}, and this vote is frozen to those ${n}.`;
}

function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * THE ADMIN DOORS THE LAUNCH CLOSES (R166). Read off the same predicates the
 * routes ask, so the document cannot promise a door the code keeps open:
 * `switchVerdict` for modules, and the org chart's admin door, which
 * `publishDoorFor` (server/lib/orgDraftDecide.ts) shuts once a launch vote
 * has carried. Who holds the two powers after the vote comes from the slate:
 * the steward role carries every power in HANDOVER_SET.
 */
function doorsSection(input: LaunchProposalDocInput): string[] {
  const after = { launched: true, admin: true, holder: false } as const;
  const lines: string[] = [];
  if (!switchVerdict({ ...after, from: "off", to: "members" }).ok) {
    const valve = switchVerdict({ ...after, from: "members", to: "off" }).ok
      ? " An admin can still pause a module or turn one off, and the village hears about it."
      : "";
    lines.push(`An admin can no longer turn a module on directly. Whoever holds the power to switch modules does it, or the village by vote.${valve}`, "");
  }
  lines.push("An admin can no longer publish a change to the org chart directly. Whoever holds the power to decide the org chart does it, or the village by vote.", "");
  const stewardsCarry = HANDOVER_SET.includes(MODULE_SWITCH_KEY) && HANDOVER_SET.includes(ORG_DECIDE);
  if (stewardsCarry) {
    lines.push(
      input.slate.length > 0
        ? "Whoever on the list below accepts the steward role holds both powers from the day this carries."
        : "Nobody holds those two powers after this vote, so both go to a village vote until the village seats somebody who carries them.",
      "",
    );
  }
  return lines;
}

/**
 * WHAT THE LAUNCH HANDS TO THE VILLAGE, written into the frozen document so a
 * member votes on the exact list (coordinator ruling on #769, 2026-11-01, on
 * Rye's "at launch the stewards select WHAT powers are being passed over").
 */
function handoverSection(input: LaunchProposalDocInput): string[] {
  const heading = ["## What the launch hands to the village", ""];
  if (input.handover.length === 0) {
    return [
      ...heading,
      "None of its powers. The stewards hold every one of them after launch, and hand each to the village when they judge it ready. Handing one back takes a village vote.",
      "",
    ];
  }
  return [
    ...heading,
    input.handover.length === 1
      ? "When this carries, the village holds this power, and only a village vote hands it back:"
      : `When this carries, the village holds these ${input.handover.length} powers, and only a village vote hands one back:`,
    "",
    ...input.handover.map((p) => `- ${p.title}: whoever holds it can ${p.consequence}.`),
    "",
    "The stewards hold every other power, and hand each to the village when they judge it ready.",
    "",
  ];
}

/**
 * The part of the document that names the stewards, or says nobody was named.
 *
 * BOTH BRANCHES SAY SOMETHING. A launch that names nobody is a real outcome
 * and the document says so out loud, because the alternative is a village
 * reading a proposal with no steward section and concluding the feature was
 * not part of this vote.
 */
function stewardSection(input: LaunchProposalDocInput): string[] {
  const powers = HANDOVER_SET.length;
  if (input.slate.length === 0) {
    return [
      "## The steward role",
      "",
      `${input.openedBy} named nobody for the steward role, so the village starts with it empty. ` +
        "That stops nothing: decisions land at their landing time either way, and the village can vote anybody into the role whenever it likes.",
      "",
    ];
  }
  return [
    "## Who carries the steward role",
    "",
    `${input.openedBy} opened this vote and chose who it puts forward. Voting yes is voting for this list as well as for starting the Game.`,
    "",
    ...input.slate.map((m) => `- ${m.name}`),
    "",
    `Each of them answers for themselves. Carrying the role for this first season means holding all ${powers} of the powers this village has to give, and being able to stop a decision the village has already carried inside the window before it lands. Anybody named can decline, and a decline is shown here beside the vote.`,
    "",
    "Whoever accepts is seated when this vote carries. If nobody accepts, the role starts empty and the village votes somebody into it whenever it likes.",

    "",
  ];
}
