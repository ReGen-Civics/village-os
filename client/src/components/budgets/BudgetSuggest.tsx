/**
 * SUGGEST A CHANGE TO THE BUDGET, a member's act (fold QA round 1, 27 Nov 2026; the 6 Nov ruling: everything changes
 * by the highest vote, and no action is ever stuck without a vote path).
 *
 * Every member may suggest a line (budgets spec R22). The budget read names the door to knock on when this reader
 * may not write (`door.suggest`: `{ path: "/api/admin/suggestions", control: "budget_lines" }`), and this form sends
 * exactly that: one hand line as a manual import, and why. The server previews it with the import every write uses,
 * then routes it to whoever holds the budget power, or to a vote when the village holds it or nobody does
 * (`routeSuggestion`, shared/suggestions.ts). Nothing here decides where it goes or whether it counts.
 */
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { BUDGET_CATEGORIES, type BudgetCategory } from "@shared/budgets";
import { sentenceOf, type BudgetRead } from "./budgetApi";
import type { BudgetLook } from "./budgetLook";
import { CATEGORY_WORDS } from "./budgetWords";

export interface BudgetSuggestDoor {
  path: string;
  control: string;
}

/** The suggestion door the budget read names for this reader, or null when they write directly or none is named. */
export function suggestDoorOf(read: BudgetRead | null): BudgetSuggestDoor | null {
  const s = read?.door?.suggest as Partial<BudgetSuggestDoor> | null | undefined;
  if (!read || read.door?.mayWrite || !s || typeof s.path !== "string" || typeof s.control !== "string") return null;
  return s.path.startsWith("/api/") ? { path: s.path, control: s.control } : null;
}

export default function BudgetSuggest({ read, door, bearer, look, onClose }: {
  read: BudgetRead;
  door: BudgetSuggestDoor;
  bearer: string;
  look: BudgetLook;
  onClose: () => void;
}) {
  const { t, i18n } = useLingui();
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<BudgetCategory>("quest_pay");
  const [planned, setPlanned] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  const ready = label.trim() && planned.trim() && why.trim();

  async function send() {
    setBusy(true);
    setSaid(null);
    const line = {
      period: read.moon.id,
      label: label.trim(),
      category,
      planned: planned.trim(),
      ...(read.villageCurrency ? { currency: read.villageCurrency } : {}),
      note: null,
    };
    try {
      const res = await fetch(door.path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
        body: JSON.stringify({ control: door.control, payload: { source: "manual", lines: [line] }, why: why.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaid({ ok: true, text: t({ message: "Sent. It goes to whoever holds the budget power, or to a village vote when nobody does.", context: "budget suggestion sent" }) });
        setLabel("");
        setPlanned("");
        setWhy("");
      } else {
        setSaid({ ok: false, text: sentenceOf(data, t({ message: "The suggestion was not sent. Try again in a moment.", context: "budget suggestion error" })) });
      }
    } catch {
      setSaid({ ok: false, text: t({ message: "The server could not be reached, so nothing was sent. Check the connection and try again.", context: "budget suggestion error" }) });
    }
    setBusy(false);
  }

  return (
    <section className={look.panel} aria-labelledby="budget-suggest-h" data-budget-suggest>
      <h3 id="budget-suggest-h" className={`${look.h2} mb-1`} data-section-focus tabIndex={-1}>
        {t({ message: "Suggest a change to the budget", context: "budget suggestion" })}
      </h3>
      <ul className={`${look.hint} mb-4 list-disc space-y-1 pl-5`}>
        <li>{t({ message: "Name one line and what it should pay this moon.", context: "budget suggestion" })}</li>
        <li>{t({ message: "Whoever holds the budget power decides, or the village votes.", context: "budget suggestion" })}</li>
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`${look.label} flex flex-col gap-1`}>
          {t({ message: "What the line is for", context: "budget suggestion field" })}
          <input className={look.field} value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className={`${look.label} flex flex-col gap-1`}>
          {t({ message: "Kind", context: "budget suggestion field" })}
          <select className={look.field} value={category} onChange={(e) => setCategory(e.target.value as BudgetCategory)}>
            {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{i18n._(CATEGORY_WORDS[c])}</option>)}
          </select>
        </label>
        <label className={`${look.label} flex flex-col gap-1`}>
          {read.villageCurrency
            ? t({ message: `Amount, in ${read.villageCurrency}`, context: "budget suggestion field" })
            : t({ message: "Amount", context: "budget suggestion field" })}
          <input className={look.field} value={planned} inputMode="decimal" onChange={(e) => setPlanned(e.target.value)} />
        </label>
        <label className={`${look.label} flex flex-col gap-1 sm:col-span-2`}>
          {t({ message: "Why", context: "budget suggestion field" })}
          <textarea className={look.field} rows={3} value={why} maxLength={2000} onChange={(e) => setWhy(e.target.value)} />
        </label>
      </div>
      {said ? (
        <p className={`mt-3 ${said.ok ? look.hint : look.error}`} role={said.ok ? "status" : "alert"}>{said.text}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className={look.primary} disabled={busy || !ready} onClick={() => void send()}>
          {t({ message: "Send the suggestion", context: "budget suggestion button" })}
        </button>
        <button type="button" className={look.secondary} disabled={busy} onClick={onClose}>
          {t({ message: "Close", context: "budget suggestion button" })}
        </button>
      </div>
    </section>
  );
}
