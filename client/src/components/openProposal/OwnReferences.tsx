/**
 * A MEMBER'S OWN REFERENCES, on their application's page (pages/SeatApplication.tsx), when the application is for
 * their first long-term role and references were asked (the lead, 19 Nov 2026; shared/applicantOnboarding.ts
 * `asksReferences`). The same form the status page draws (ReferenceForm.tsx), sent to the signed-in door; once given,
 * a count, never the details back. Draws nothing while references are not asked.
 */
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";
import { TILE } from "@/components/journey/look";
import { chooseApplicantLanguage } from "@shared/applicantLanguage";
import { wordsIn } from "@shared/applicantWords";
import { ReferenceForm } from "./ReferenceForm";

type Mine = { asked: true; given: number | null; mayAdd: boolean } | null;

export default function OwnReferences({ applicationRef }: { applicationRef: string }) {
  const { i18n } = useLingui();
  const [mine, setMine] = useState<Mine>(null);
  const base = `/api/governance/applications/${encodeURIComponent(applicationRef)}/references`;
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await gameFetch(`${base}/mine`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (live) setMine(res.ok ? ((data?.references ?? null) as Mine) : null);
      } catch {
        if (live) setMine(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [base]);
  if (!mine) return null;
  // The words follow the language the member reads the site in (shared/applicantWords.ts holds English and Spanish).
  const w = wordsIn(chooseApplicantLanguage({ chosenOnSite: i18n.locale, profile: null }).language);
  if (mine.mayAdd) {
    return <ReferenceForm postUrl={base} words={w.status.referenceForm} line={w.status.referenceForm.lineFirstRole} onGiven={(n) => setMine({ asked: true, given: n, mayAdd: false })} />;
  }
  return typeof mine.given === "number" ? (
    <p role="status" className={`${TILE} text-foreground`} data-references-given-own="">
      {w.status.referenceForm.given(mine.given)}
    </p>
  ) : null;
}
