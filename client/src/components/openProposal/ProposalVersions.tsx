/**
 * THE PROPOSAL'S EARLIER VERSIONS on the team's walkthrough (shared/proposalRefine.ts; the lead, 27 Nov 2026). The
 * applicant refines their proposal at References and proposal; the final conversation reads what changed: the
 * current words once, then each earlier version, newest first, dated in the reader's language (QA round 2: "Now" was
 * drawn beside every row). Two versions from the same day carry the time too, so no two rows read alike. Quiet rows,
 * never a box inside a box. Nothing is compared, scored or read by an AI.
 */
import { useLingui } from "@lingui/react/macro";
import { EYEBROW, H2, HINT, LABEL } from "@/components/journey/look";
import type { ProposalVersion } from "@shared/proposalRefine";
import { useDayWords } from "@/components/openProposal/ConversationNotes";

export default function ProposalVersions({ versions, current }: { versions: ProposalVersion[]; current: { why: string; aim: string } | null }) {
  const { t, i18n } = useLingui();
  const day = useDayWords();
  if (!versions.length) return null;
  const days = versions.map((v) => v.at.slice(0, 10));
  const shared = new Set(days.filter((d, i) => days.indexOf(d) !== i));
  /** The day, and the time as well when another version shares that day. */
  const when = (at: string): string => {
    if (!shared.has(at.slice(0, 10))) return day(at);
    const d = new Date(at);
    return Number.isNaN(d.getTime()) ? day(at) : i18n.date(d, { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });
  };
  return (
    <section className="mt-6 min-w-0" aria-labelledby="proposal-versions-heading" data-walk-proposal-versions="">
      <p className={EYEBROW}>{t({ message: "The proposal", context: "proposal versions: the kicker" })}</p>
      <h3 id="proposal-versions-heading" className={`mt-1 ${H2}`}>
        {t({ message: "Earlier versions of the proposal", context: "proposal versions: the heading" })}
      </h3>
      <p className={`mt-1 ${HINT}`}>
        {t({ message: "The applicant refined their proposal. Their words now come first, then each earlier version, newest first.", context: "proposal versions: what they are" })}
      </p>
      <ol className="mt-3 grid grid-cols-[minmax(0,1fr)] divide-y divide-border">
        {current ? (
          <li className="min-w-0 py-4" data-proposal-current="">
            <p className={LABEL}>{t({ message: "Now", context: "proposal versions: the current words" })}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{current.why}</p>
            <p className="mt-2 break-words text-foreground">{current.aim}</p>
          </li>
        ) : null}
        {[...versions].reverse().map((v, i) => (
          <li key={`${v.at}-${i}`} className="min-w-0 py-4" data-proposal-version={v.at}>
            <p className={LABEL}>{t({ message: `Before ${when(v.at)}`, context: "proposal versions: the words until that day" })}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{v.why}</p>
            <p className="mt-2 break-words text-muted-foreground">{v.aim}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
