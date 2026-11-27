/**
 * THE APPLICANT'S REFERENCES: people connected with this work, ideally allies or
 * partners of the village. At least two, three preferred, up to ten rows (shared/applyLimits.ts
 * `APPLY_COUNTS.statusReferences`). The page never shows the details back: the answer is a count.
 *
 * HOW WE REACH THEM (the lead, 27 Nov 2026): each reference's email AND at least one of a WhatsApp number, a US phone
 * number or a Signal number. Checked here first with the server's own rule (shared/applicantOnboarding.ts
 * `parseReferenceList`), then again by the server.
 *
 * EDITING (the lead: "offer them a chance to edit references"): once given, and until anybody reaches out, the form
 * opens again empty; sending replaces the list. The details are never drawn back onto the page.
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
import { ONBOARDING_REFERENCES_MAX, parseReferenceList, REF_ALLY_MAX, REF_CONTACT_MAX, REF_HOW_MAX, REF_NAME_MAX, type ReferenceError } from "@shared/applicantOnboarding";

type ReferenceRow = { name: string; email: string; whatsapp: string; usPhone: string; signal: string; how: string; ally: string };
const EMPTY_ROW: ReferenceRow = { name: "", email: "", whatsapp: "", usPhone: "", signal: "", how: "", ally: "" };
type ReferenceFormWords = ReturnType<typeof wordsIn>["status"]["referenceForm"];

export function ReferenceForm({ postUrl, words, onGiven, line, editing = false }: { postUrl: string; words: ReferenceFormWords; onGiven: (n: number) => void; line?: string; editing?: boolean }) {
  // Three rows to start, the number the village prefers; at least two are asked (the lead, 19 Nov 2026).
  const [rows, setRows] = useState<ReferenceRow[]>(() => Array.from({ length: APPLY_COUNTS.referencesPreferred }, () => ({ ...EMPTY_ROW })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; row: number | null } | null>(null);
  const set = (i: number, key: keyof ReferenceRow, value: string) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  // Which reference and which field (QA pass 1): "Reference 2, WhatsApp: One of those numbers doesn't look right."
  const fieldLabel: Record<string, string> = { name: words.name, email: words.email, whatsapp: words.whatsapp, usPhone: words.usPhone, signal: words.signal, how: words.how, ally: words.ally };
  const say = (code: string, row: number | null, field?: string) => {
    const text = words.errors[code as ReferenceError] ?? words.failed;
    const where = row === null ? "" : `${words.row(row + 1)}${field && fieldLabel[field] ? `, ${fieldLabel[field]}` : ""}: `;
    setError({ text: `${where}${text}`, row });
  };
  const send = async () => {
    setError(null);
    // The server's own rule, here first, so a missing number is said before anything is sent.
    const checked = parseReferenceList(rows);
    if (!checked.ok) return say(checked.error, checked.row, checked.field);
    setBusy(true);
    try {
      const res = await gameFetch(postUrl, { method: "POST", body: JSON.stringify({ references: rows }), cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok) onGiven(Number(data?.given ?? rows.length));
      else say(String(data?.error ?? ""), typeof data?.row === "number" ? data.row : null, typeof data?.field === "string" ? data.field : undefined);
    } catch {
      setError({ text: words.failed, row: null });
    } finally {
      setBusy(false);
    }
  };
  const field = (i: number, key: keyof ReferenceRow, label: string, opts: { max: number; type?: string; inputMode?: "email" | "tel" | "text" } = { max: REF_CONTACT_MAX }) => (
    <label className="mt-2 block">
      <span className={LABEL}>{label}</span>
      <input
        className={`mt-1 ${FIELD}`}
        value={rows[i][key]}
        maxLength={opts.max}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        autoComplete="off"
        onChange={(e) => set(i, key, e.target.value)}
        data-reference-field={key}
      />
    </label>
  );
  return (
    <section id="reference-form" aria-labelledby="your-references" className={`scroll-mt-24 ${CARD_FEATURED}`} data-reference-form={editing ? "edit" : ""}>
      <p className={EYEBROW}>{words.step}</p>
      <h2 id="your-references" className={H2}>{words.heading}</h2>
      <p className="mt-1 text-foreground">{editing ? words.editLine : (line ?? words.line)}</p>
      <p className="mt-1 font-semibold text-foreground" data-reference-how-many="">{words.howMany}</p>
      <p className="mt-1 text-foreground" data-reference-tell-them="">{words.tellThem}</p>
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
            {field(i, "name", words.name, { max: REF_NAME_MAX })}
            {field(i, "email", words.email, { max: REF_CONTACT_MAX, type: "email", inputMode: "email" })}
            <div className="mt-2" role="group" aria-describedby={`ref-channels-hint-${i}`}>
              <p id={`ref-channels-hint-${i}`} className={HINT}>{words.channelsHint}</p>
              {field(i, "whatsapp", words.whatsapp, { max: 40, type: "tel", inputMode: "tel" })}
              {field(i, "usPhone", words.usPhone, { max: 40, type: "tel", inputMode: "tel" })}
              {field(i, "signal", words.signal, { max: 40 })}
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
      {error && <p role="alert" className="mt-2 text-sm text-destructive" data-reference-error="">{error.text}</p>}
    </section>
  );
}
