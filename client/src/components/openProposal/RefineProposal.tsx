/**
 * THE APPLICANT REFINES THEIR PROPOSAL on their own status page (shared/proposalRefine.ts; the lead, 27 Nov 2026).
 * Open at References and proposal; fixed once the final conversation opens, when the page says so instead. The words
 * are the page's own table in the applicant's language (shared/applicantWords.ts `status.six.refine`).
 */
import { useState } from "react";
import { gameFetch } from "@/lib/gameApi";
import { BTN_PRIMARY, CARD, FIELD, H2, HINT, LABEL } from "@/components/journey/look";
import { OPEN_AIM_MAX, OPEN_WHY_MAX } from "@shared/openProposals";
import type { ApplicantMessages } from "@shared/applicantWords";

type Words = ApplicantMessages["status"]["six"]["refine"];

export default function RefineProposal({
  refine,
  words,
  url,
  onSaved,
}: {
  refine: { open: boolean; frozen: boolean; why: string; aim: string; versions: number };
  words: Words;
  url: string;
  onSaved: (versions: number) => void;
}) {
  const [why, setWhy] = useState(refine.why);
  const [aim, setAim] = useState(refine.aim);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  if (!refine.open) {
    return refine.frozen ? (
      <p className={`text-sm text-muted-foreground`} data-refine-frozen="">
        {words.frozen}
      </p>
    ) : null;
  }

  const save = async () => {
    setBusy(true);
    setSaid(null);
    const res = await gameFetch(url, { method: "POST", body: JSON.stringify({ why, aim }) }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (res?.ok) {
      setSaid({ ok: true, text: words.saved });
      onSaved(Number(data?.versions ?? refine.versions + 1));
    } else setSaid({ ok: false, text: String(data?.message ?? words.failed) });
  };

  return (
    <section aria-labelledby="refine-heading" className={CARD} data-refine="">
      <h2 id="refine-heading" className={H2}>
        {words.heading}
      </h2>
      <p className={`mt-1 ${HINT}`}>{words.line}</p>
      <label htmlFor="refine-why" className={`mt-4 block ${LABEL}`}>
        {words.why}
      </label>
      <textarea id="refine-why" className={`mt-1 min-h-32 w-full ${FIELD}`} maxLength={OPEN_WHY_MAX} value={why} onChange={(e) => setWhy(e.target.value)} />
      <label htmlFor="refine-aim" className={`mt-3 block ${LABEL}`}>
        {words.aim}
      </label>
      <textarea id="refine-aim" className={`mt-1 min-h-16 w-full ${FIELD}`} maxLength={OPEN_AIM_MAX} value={aim} onChange={(e) => setAim(e.target.value)} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={BTN_PRIMARY} disabled={busy || !why.trim() || !aim.trim()} onClick={() => void save()} data-refine-save="">
          {words.save}
        </button>
        {refine.versions > 0 ? <span className="text-sm text-muted-foreground">{words.versions(refine.versions)}</span> : null}
      </div>
      {said ? (
        <p role={said.ok ? "status" : "alert"} className={`mt-2 text-sm ${said.ok ? "text-foreground" : "text-destructive"}`}>
          {said.text}
        </p>
      ) : null}
    </section>
  );
}
