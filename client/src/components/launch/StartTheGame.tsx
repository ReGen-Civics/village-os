/**
 * STARTING THE GAME: the card on Journey to Launch that opens the village's
 * vote on starting its Game (R74). Moved out of pages/JourneyToLaunch.tsx when
 * the founder-path pass of 2026-11-01 gave it the governance gate and an
 * in-page refusal, and the page crossed the monolith ratchet's 1,000 lines.
 * Nothing about it changed in the move except those two additions.
 */
import { Link } from "wouter";
import { SeedGlint } from "@/components/sacred/living";
import StewardSlatePicker, { type StewardCandidate } from "@/components/governance/StewardSlatePicker";
import { useAppWords } from "@/hooks/useAppWords";
import { useTokensWord } from "@/hooks/useTokenNames";
import { Trans, useLingui } from "@lingui/react/macro";
import { launchDoors, type LaunchFacts } from "@shared/launchFacts";

/** What `/api/admin/launch` says about the launch vote itself (R74). */
export interface LaunchVote {
  /**
   * Whether the governance module is on for members. The vote is held there,
   * and `POST /api/admin/launch/propose` refuses while it is off, a refusal
   * this card used to learn about only by asking and getting a browser alert.
   * Absent on a server older than the field, which reads as "not known".
   */
  governanceOn?: boolean;
  /** How many founders are on the launch roll today. Null when the roll could not be read. */
  onTheRoll: number | null;
  /** The roll is short of the floor, said as a fact. Null when it is not. */
  tooFew: string | null;
  /**
   * How many founder yeses carry the vote (Rye, 2026-11-27: only founders vote
   * on the launch). Absent on a server older than the field.
   */
  yesNeeded?: number | null;
  /**
   * This village is already issuing and never held its launch vote, so the
   * vote it may open is a RATIFYING one: it puts the launch on the record and
   * never restarts issuance (Rye, 2026-11-27). Absent on an older server.
   */
  ratifying?: boolean;
  /** The instant issuance began, which a ratifying vote never moves. */
  issuingSince?: string | null;
  unityPct: number | null;
  quorumPct: number | null;
  minElectorate: number | null;
  why: string | null;
  openBallot: { id: string; title: string; closesAt: string; electorateCount: number; voted: number } | null;
  past: Array<{ id: string; status: string; closedAt: string | null; outcomeNote: string | null }>;
}

/**
 * STARTING THE GAME (R74). The card that used to mark a village launched.
 *
 * Five states, so each gets its own words and nothing is inferred from a
 * missing field:
 *
 *   a vote is running     what it is waiting for, and where to go and vote
 *   already issuing       tokens are issued here and no launch vote was held.
 *                         The server refuses to open the vote for this village
 *                         (`POST /api/admin/launch/propose` reads `game-start`),
 *                         so the card says that plainly and offers no button
 *   the roll is short     how many hold a voice, and how many more
 *   ready to ask          the ask, with what carrying it needs
 *   items still open      how many, unchanged from before
 *
 * R55 and R56 govern every sentence here. A village that has not started is
 * YOUNG. There is no countdown, nothing is late, no village is compared to
 * another, and the one cautionary-looking line is a count of people, which is
 * a thing the founder cannot otherwise see.
 */
export default function StartTheGame({
  status,
  vote,
  facts,
  isFounder,
  busy,
  onAsk,
  candidates,
  powerCount,
  slate,
  onToggleSlate,
  refusal,
}: {
  status: any;
  vote: LaunchVote | null;
  /**
   * Where the village stands (`shared/launchFacts.ts`), or null when that read
   * has not arrived. Null reads as "may be asked", which is what this card
   * assumed before the facts existed; the server still answers for itself.
   */
  facts?: LaunchFacts | null;
  isFounder: boolean;
  busy: boolean;
  onAsk: () => void;
  candidates: StewardCandidate[];
  powerCount: number;
  slate: string[];
  onToggleSlate: (id: string) => void;
  /** What the server said when it refused the ask, shown on the card. */
  refusal: string;
}) {
  const { t } = useLingui();
  // The village may name its launch vote (gap G7); blank keeps the platform's name.
  const launchName = useAppWords()("launch", "name") ?? "Start the Game";
  // What this village calls all its tokens together, so the sentence below is in its own words.
  const tokens = useTokensWord();
  const running = vote?.openBallot ?? null;
  const shortOfPeople = !!vote?.tooFew;
  const governanceOff = vote?.governanceOn === false;
  // The card reads the fact the button's own door reads (shared/launchFacts.ts).
  const cannotBeAsked = !running && !!facts && !launchDoors(facts).voteCanBeAsked;
  // Issuing with no vote held: from the launch read, or from the facts when that read is the one in hand.
  const alreadyIssuing = !!vote?.ratifying || (!!facts && facts.issuing && !facts.voteCarried && !facts.checklistFrozen);
  const issuingSince = vote?.issuingSince ?? facts?.issuingSince ?? null;
  const issuingDay = issuingSince ? new Date(issuingSince).toLocaleDateString() : "";
  const canAsk = !!status.readyToLaunch && !shortOfPeople && !governanceOff && !running && isFounder && !cannotBeAsked;

  return (
    <section
      className={`rounded-xl border p-5 ${
        status.readyToLaunch && !shortOfPeople ? "bg-teal-deep/5 border-teal-deep/30" : "bg-white border-stone-200"
      }`}
    >
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div>
          <p className="font-semibold text-stone-900 flex items-center gap-2">
            <SeedGlint className="w-4 h-4 text-teal-deep" /> {launchName}
          </p>
          {/* One line, in one element. A village already issuing may hold this vote once (server/lib/launchRatify.ts), and it
              keeps the name (Rye, 2026-11-28: "Let's stay with start the game and have it as the 'birthday of the game'
              going forward"). So it is told what does not restart, and what begins the day the vote carries. */}
          {!running && (alreadyIssuing || governanceOff) && (
            <p data-testid={alreadyIssuing ? "start-already-issuing" : undefined} className="text-xs text-stone-700 mt-1 max-w-md">
              {alreadyIssuing && (
                <>
                  {issuingDay ? (
                    <Trans context="StartTheGame, a village already issuing">This village has been issuing {tokens} since {issuingDay}, and that does not restart. The day this vote carries is the Game's birthday, and Moon 1 is the moon it falls in.</Trans>
                  ) : (
                    <Trans context="StartTheGame, a village already issuing">This village is already issuing {tokens}, and that does not restart. The day this vote carries is the Game's birthday, and Moon 1 is the moon it falls in.</Trans>
                  )}
                  {governanceOff && " "}
                </>
              )}
              {governanceOff && (
              <Trans context="StartTheGame, p">The vote is held in the governance module, and it is off for members.{" "}
              <Link href="/modules/governance" className="text-teal-deep underline">
                Turn it on for members first
              </Link>
              .
            </Trans>)}</p>
          )}
          {!cannotBeAsked && (<>
          {!running && !status.readyToLaunch && shortOfPeople && (
            <p className="text-xs text-stone-700 mt-1 max-w-md">{vote?.tooFew}</p>
          )}
          <p className="text-xs text-stone-500 mt-1 max-w-md">
            {running
              ? `The village is voting on this now. ${running.voted} of ${running.electorateCount} have answered, and it closes on ${new Date(running.closesAt).toLocaleDateString()}.`
              : !status.readyToLaunch
                ? `${status.blockingOpen} item(s) on the journey still block the vote. The button opens when they read done.`
                : shortOfPeople
                  ? vote?.tooFew
                  : vote?.why ?? "This opens the village's vote on starting its Game."}
          </p>
          {!running && status.readyToLaunch && !shortOfPeople && vote?.onTheRoll != null && (
            <p className="text-xs text-stone-500 mt-1 max-w-md">
              <Trans context="StartTheGame, p">{vote.onTheRoll} people are on its roll today, and the vote carries without waiting for its window to end.</Trans>
            </p>
          )}
          </>)}
        </div>
        {running ? (
          <Link
            href={`/governance/decisions/${running.id}`}
            className="text-sm bg-teal-deep text-white rounded-lg px-5 py-2.5 font-semibold"
          >
            <Trans context="StartTheGame, Link">Open the vote
          </Trans></Link>
        ) : cannotBeAsked ? null : (
          <button
            onClick={onAsk}
            disabled={!canAsk || busy}
            title={isFounder ? undefined : t({ message: "Opening this vote is a founder's act", context: "StartTheGame, title" })}
            className="text-sm bg-teal-deep text-white rounded-lg px-5 py-2.5 font-semibold disabled:opacity-40"
          >
            <Trans context="StartTheGame, button">Ask the village
          </Trans></button>
        )}
      </div>

      {/* THE SLATE IS PART OF THE PROPOSAL, so it is picked on the same card
          that opens it and never in a step of its own. It is hidden once a
          vote is running, because the slate froze when that vote opened and an
          editable list beside a frozen one would read as a list somebody could
          still change. */}
      {refusal && (
        <p role="alert" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {refusal}
        </p>
      )}
      {!running && isFounder && !cannotBeAsked && <StewardSlatePicker candidates={candidates} powerCount={powerCount} chosen={slate} onToggle={onToggleSlate} disabled={busy} />}

      {/*
        * Every time this village has asked before. A vote that closed without
        * starting the Game is part of the journey and belongs on the record,
        * so nobody has to wonder whether the last one happened.
        */}
      {vote && vote.past.length > 0 && (
        <ul className="mt-4 border-t border-stone-900/10 pt-3 space-y-1.5">
          {vote.past.map((p) => (
            <li key={p.id} className="text-xs text-stone-600">
              <Link href={`/governance/decisions/${p.id}`} className="font-medium text-teal-deep hover:underline">
                {p.closedAt ? new Date(p.closedAt).toLocaleDateString() : "Closed"}
              </Link>
              {": "}
              {p.status === "no_quorum"
                ? t({ message: "too few on the roll said yes", context: "StartTheGame, a past launch vote" })
                : p.status === "withdrawn"
                  ? "called off"
                  : p.status === "failed"
                    ? "did not carry"
                    : p.status}
              {p.outcomeNote ? `. ${p.outcomeNote}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
