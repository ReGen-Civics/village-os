/**
 * THE APPLICANT'S REFERENCES: people connected with this work, ideally allies or
 * partners of the village. At least two, three preferred, up to ten rows (shared/applyLimits.ts
 * `APPLY_COUNTS.statusReferences`), sent once. The page never shows the details
 * back: the answer is a count.
 *
 * Drawn on the status page of a shortlisted open proposal (pages/ApplicationStatus.tsx)
 * and on a member's own application for their first long-term role
 * (pages/SeatApplication.tsx), which hands in its own `line` (shared/applicantOnboarding.ts).
 */
import { useState } from "react";
import { gameFetch } from "@/lib/gameApi";
import { BTN_PRIMARY, BTN_SECONDARY, CARD_FEATURED, EYEBROW, FIELD, H2, HINT, LABEL, TILE } from "@/components/journey/look";
import type { wordsIn } from "@shared/applicantWords";
import { APPLY_COUNTS } from "@shared/applyLimits";
import { ONBOARDING_REFERENCES_MAX, REF_ALLY_MAX, REF_CONTACT_MAX, REF_HOW_MAX, REF_NAME_MAX, type ReferenceError } from "@shared/applicantOnboarding";

type ReferenceRow = { name: string; contact: string; how: string; ally: string };
const EMPTY_ROW: ReferenceRow = { name: "", contact: "", how: "", ally: "" };
type ReferenceFormWords = ReturnType<typeof wordsIn>["status"]["referenceForm"];

export function ReferenceForm({ postUrl, words, onGiven, line }: { postUrl: string; words: ReferenceFormWords; onGiven: (n: number) => void; line?: string }) {
  // Three rows to start, the number the village prefers; at least two are asked (the lead, 19 Nov 2026).
  const [rows, setRows] = useState<ReferenceRow[]>(() => Array.from({ length: APPLY_COUNTS.referencesPreferred }, () => ({ ...EMPTY_ROW })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; row: number | null } | null>(null);
  const set = (i: number, key: keyof ReferenceRow, value: string) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await gameFetch(postUrl, { method: "POST", body: JSON.stringify({ references: rows }), cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok) onGiven(Number(data?.given ?? rows.length));
      else {
        const code = String(data?.error ?? "") as ReferenceError;
        setError({ text: words.errors[code] ?? words.failed, row: typeof data?.row === "number" ? data.row : null });
      }
    } catch {
      setError({ text: words.failed, row: null });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section id="reference-form" aria-labelledby="your-references" className={`scroll-mt-24 ${CARD_FEATURED}`} data-reference-form="">
      <p className={EYEBROW}>{words.step}</p>
      <h2 id="your-references" className={H2}>{words.heading}</h2>
      <p className="mt-1 text-foreground">{line ?? words.line}</p>
      <p className="mt-1 font-semibold text-foreground" data-reference-how-many="">{words.howMany}</p>
      <p className={`mt-2 ${HINT}`}>{words.privacy}</p>
      <div className="mt-4 grid gap-3">
        {rows.map((r, i) => (
          <fieldset key={i} className={TILE} data-reference-row={i} aria-invalid={error?.row === i ? true : undefined}>
            <legend className="sr-only">{words.row(i + 1)}</legend>
            <div className="flex items-center justify-between gap-2">
              <p className={LABEL}>{words.row(i + 1)}</p>
              {rows.length > 1 && (
                <button type="button" className={BTN_SECONDARY} onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}>
                  {words.remove(i + 1)}
                </button>
              )}
            </div>
            <label className="mt-2 block">
              <span className={LABEL}>{words.name}</span>
              <input className={`mt-1 ${FIELD}`} value={r.name} maxLength={REF_NAME_MAX} autoComplete="off" onChange={(e) => set(i, "name", e.target.value)} />
            </label>
            <div className="mt-2">
              <label className="block">
                <span className={LABEL}>{words.contact}</span>
                <input className={`mt-1 ${FIELD}`} value={r.contact} maxLength={REF_CONTACT_MAX} autoComplete="off" onChange={(e) => set(i, "contact", e.target.value)} aria-describedby={`ref-contact-hint-${i}`} />
              </label>
              <span id={`ref-contact-hint-${i}`} className={HINT}>{words.contactHint}</span>
            </div>
            <label className="mt-2 block">
              <span className={LABEL}>{words.how}</span>
              <textarea rows={2} className={`mt-1 ${FIELD}`} value={r.how} maxLength={REF_HOW_MAX} onChange={(e) => set(i, "how", e.target.value)} />
            </label>
            <div className="mt-2">
              <label className="block">
                <span className={LABEL}>{words.ally}</span>
                <textarea rows={2} className={`mt-1 ${FIELD}`} value={r.ally} maxLength={REF_ALLY_MAX} onChange={(e) => set(i, "ally", e.target.value)} aria-describedby={`ref-ally-hint-${i}`} />
              </label>
              <span id={`ref-ally-hint-${i}`} className={HINT}>{words.allyHint}</span>
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {rows.length < ONBOARDING_REFERENCES_MAX && (
          <button type="button" className={BTN_SECONDARY} onClick={() => setRows((cur) => [...cur, { ...EMPTY_ROW }])} data-reference-add="">
            {words.add}
          </button>
        )}
        <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void send()} data-reference-send="">
          {words.send}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error.text}</p>}
    </section>
  );
}
