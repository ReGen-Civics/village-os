/**
 * THE PROPOSAL'S EARLIER VERSIONS on the team's walkthrough (shared/proposalRefine.ts; the lead, 27 Nov 2026). The
 * applicant refines their proposal at References and proposal; the final conversation reads what changed. Shown as
 * written, newest first. Nothing is compared, scored or read by an AI.
 */
import { useLingui } from "@lingui/react/macro";
import { HINT, LABEL, TILE } from "@/components/journey/look";
import type { ProposalVersion } from "@shared/proposalRefine";

export default function ProposalVersions({ versions }: { versions: ProposalVersion[] }) {
  const { t } = useLingui();
  if (!versions.length) return null;
  return (
    <section className="mt-6" data-walk-proposal-versions="">
      <h3 className="font-display text-xl font-bold text-foreground">{t({ message: "Earlier versions of the proposal", context: "proposal versions: the heading" })}</h3>
      <p className={`mt-1 ${HINT}`}>
        {t({ message: "The applicant refined their proposal. The proposal above is the current one; these are the words it replaced.", context: "proposal versions: what they are" })}
      </p>
      <ol className="mt-3 grid gap-3">
        {[...versions].reverse().map((v) => (
          <li key={v.at} className={TILE} data-proposal-version={v.at}>
            <p className={LABEL}>{t({ message: `Replaced on ${v.at.slice(0, 10)}`, context: "proposal versions: when one was replaced" })}</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{v.why}</p>
            <p className="mt-2 text-foreground">{v.aim}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
