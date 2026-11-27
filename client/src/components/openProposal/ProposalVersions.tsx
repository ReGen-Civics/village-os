/**
 * THE PROPOSAL'S EARLIER VERSIONS on the team's walkthrough (shared/proposalRefine.ts; the lead, 27 Nov 2026). The
 * applicant refines their proposal at References and proposal; the final conversation reads what changed: each
 * earlier version beside the current words, newest first, dated in the reader's language. Quiet rows, never a box
 * inside a box. Nothing is compared, scored or read by an AI.
 */
import { useLingui } from "@lingui/react/macro";
import { EYEBROW, H2, HINT, LABEL } from "@/components/journey/look";
import type { ProposalVersion } from "@shared/proposalRefine";
import { useDayWords } from "@/components/openProposal/ConversationNotes";

export default function ProposalVersions({ versions, current }: { versions: ProposalVersion[]; current: { why: string; aim: string } | null }) {
  const { t } = useLingui();
  const day = useDayWords();
  if (!versions.length) return null;
  return (
    <section className="mt-6 min-w-0" aria-labelledby="proposal-versions-heading" data-walk-proposal-versions="">
      <p className={EYEBROW}>{t({ message: "The proposal", context: "proposal versions: the kicker" })}</p>
      <h3 id="proposal-versions-heading" className={`mt-1 ${H2}`}>
        {t({ message: "Earlier versions of the proposal", context: "proposal versions: the heading" })}
      </h3>
      <p className={`mt-1 ${HINT}`}>{t({ message: "The applicant refined their proposal. Each earlier version sits beside the words it became.", context: "proposal versions: what they are" })}</p>
      <ol className="mt-3 grid grid-cols-[minmax(0,1fr)] divide-y divide-border">
        {[...versions].reverse().map((v) => (
          <li key={v.at} className="grid min-w-0 gap-3 py-4 sm:grid-cols-2" data-proposal-version={v.at}>
            <div className="min-w-0">
              <p className={LABEL}>{t({ message: `Before ${day(v.at)}`, context: "proposal versions: the words until that day" })}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{v.why}</p>
              <p className="mt-2 break-words text-muted-foreground">{v.aim}</p>
            </div>
            {current ? (
              <div className="min-w-0" data-proposal-current="">
                <p className={LABEL}>{t({ message: "Now", context: "proposal versions: the current words" })}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{current.why}</p>
                <p className="mt-2 break-words text-foreground">{current.aim}</p>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
