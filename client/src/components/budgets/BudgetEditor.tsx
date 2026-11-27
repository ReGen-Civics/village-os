/**
 * THE BUDGET EDITOR, for whoever the server's door lets change the budget
 * (`role.pay`: the Treasurer, or an admin before launch). Its own chunk:
 * BudgetDesk loads it only when `GET /api/budgets` answers `door.mayWrite`.
 *
 * Three acts, each on the routes in server/routes/budgets.ts:
 *
 *   an upload    POST /api/admin/budgets/import       rows from a sheet: preview, read it, then save it
 *   a hand line  POST /api/admin/budgets/lines        one line; one press previews and saves
 *   an edit      PATCH /api/admin/budgets/lines/:id   the cells that changed; one press previews and saves
 *   withdraw     POST .../lines/:id/withdraw          kept on the record, never deleted (R3); restore brings it back
 *
 * Every write is a preview first and a confirm of that preview's revision,
 * because the server refuses a confirm without one. A refused row, a word held
 * for naming somebody, a stale preview and the door's own refusal all come
 * back as the server's sentence, and this file prints that sentence.
 */
import { useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { BUDGET_CATEGORIES, IMPORT_ROWS_MAX, type BudgetCategory } from "@shared/budgets";
import { exponentOf, formatMoney } from "@shared/money";
import { majorText, sentenceOf, type BudgetCall, type BudgetLine, type BudgetRead, type ImportAnswer } from "./budgetApi";
import type { BudgetLook } from "./budgetLook";
import BudgetLineRow from "./BudgetLineRow";
import { readBudgetSheet, type SheetRow } from "./budgetSheet";
import { CATEGORY_WORDS } from "./budgetWords";

interface Props {
  call: BudgetCall;
  read: BudgetRead;
  look: BudgetLook;
  reload: () => Promise<void> | void;
}

type Outcome = { kind: "error"; text: string; rows?: string[] } | { kind: "done"; text: string } | null;

interface LineForm {
  period: string;
  label: string;
  category: BudgetCategory;
  planned: string;
  currency: string;
  circle: string;
  role: string;
  note: string;
}

export default function BudgetEditor({ call, read, look, reload }: Props) {
  const { t, i18n } = useLingui();
  const Heading = look.hTag;
  // Folded on the sheet: the two ways to add start closed, each behind its own button.
  const [uploadOpen, setUploadOpen] = useState(!look.fold);
  const [addOpen, setAddOpen] = useState(!look.fold);
  const village = read.villageCurrency ?? "";
  /** Every refused or held row as "Row 3, planned: <the server's sentence>". Row 0 is the upload's own name or scope. */
  const rowSentences = (a: Partial<ImportAnswer>): string[] =>
    [...(a.refused ?? []), ...(a.held ?? [])].map((r) =>
      r.row > 0 ? t({ message: `Row ${r.row}, ${r.cell}: ${r.message}`, context: "budget refused row" }) : r.message,
    );

  // ── The upload ────────────────────────────────────────────────────────────
  const [sheet, setSheet] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [whole, setWhole] = useState(false);
  const [rows, setRows] = useState<SheetRow[] | null>(null);
  const [preview, setPreview] = useState<ImportAnswer | null>(null);
  const [uploadOutcome, setUploadOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);

  const sheetProblem = (p: "empty" | "no_columns" | "no_rows" | "no_label") =>
    ({
      empty: t({ message: "Choose a sheet or paste its cells first.", context: "budget upload error" }),
      no_columns: t({ message: "The first row should name the columns: period, label, category, planned, and if you like circle, role, currency and note.", context: "budget upload error" }),
      no_rows: t({ message: "The sheet has its column names and no lines under them.", context: "budget upload error" }),
      no_label: t({ message: "The sheet needs a label column, so every line has a name.", context: "budget upload error" }),
    })[p];

  const failed = (r: { status: number; data: any }, fallback: string): Outcome => {
    if (r.status === 0) return { kind: "error", text: t({ message: "The server could not be reached, so nothing was saved. Check the connection and try again.", context: "budget editor error" }) };
    return { kind: "error", text: sentenceOf(r.data, fallback), rows: rowSentences(r.data ?? {}) };
  };

  const importBody = (list: SheetRow[], extra: Record<string, unknown>) => ({
    lines: list,
    scope: whole ? { whole: true } : null,
    sourceLabel: sourceLabel.trim() || null,
    ...extra,
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    setSheet(await file.text());
    setPreview(null);
    setUploadOutcome(null);
  }

  async function previewUpload() {
    setUploadOutcome(null);
    setPreview(null);
    const parsed = readBudgetSheet(sheet);
    if (!parsed.ok) return setUploadOutcome({ kind: "error", text: sheetProblem(parsed.problem) });
    if (parsed.rows.length > IMPORT_ROWS_MAX) {
      return setUploadOutcome({ kind: "error", text: t({ message: `One upload carries at most ${IMPORT_ROWS_MAX} lines. Split the sheet by period and upload each part.`, context: "budget upload error" }) });
    }
    setBusy(true);
    const r = await call("/admin/budgets/import", importBody(parsed.rows, { dryRun: true }));
    setBusy(false);
    if (!r.ok) return setUploadOutcome(failed(r, t({ message: "The sheet could not be read just now. Try again in a moment.", context: "budget upload error" })));
    setRows(parsed.rows);
    setPreview(r.data as ImportAnswer);
  }

  async function confirmUpload() {
    if (!rows || !preview) return;
    setBusy(true);
    const r = await call("/admin/budgets/import", importBody(rows, { dryRun: false, revision: preview.revision }));
    setBusy(false);
    if (!r.ok || !r.data?.written) {
      setPreview(null);
      return setUploadOutcome(failed(r, t({ message: "The upload was not saved. Preview it again, then save.", context: "budget upload error" })));
    }
    const d = r.data as ImportAnswer;
    setPreview(null);
    setRows(null);
    setSheet("");
    setUploadOutcome({
      kind: "done",
      text: t({ message: `Saved. ${d.added.length} added, ${d.changed.length} changed, ${d.withdrawn.length} withdrawn.`, context: "budget upload saved" }),
    });
    await reload();
  }

  const previewSummary = preview
    ? t({ message: `${preview.added.length} to add, ${preview.changed.length} to change, ${preview.withdrawn.length} to withdraw, ${preview.unchanged} the same as now.`, context: "budget upload preview" })
    : "";
  const previewRows = preview ? rowSentences(preview) : [];
  const mayConfirm = !!preview && preview.door?.mayWrite === true && preview.held.length === 0 && (preview.added.length > 0 || preview.changed.length > 0);

  // ── A hand line, and an edit ──────────────────────────────────────────────
  const blank = (): LineForm => ({ period: read.moon.id, label: "", category: "role_pay", planned: "", currency: village, circle: "", role: "", note: "" });
  const [form, setForm] = useState<LineForm>(blank);
  const [addOutcome, setAddOutcome] = useState<Outcome>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LineForm>(blank);
  const [lineOutcome, setLineOutcome] = useState<{ id: string; outcome: Outcome } | null>(null);

  /** Preview, stop on any refused or held row or a closed door, else confirm that preview. */
  async function pressWrite(path: string, method: string, body: Record<string, unknown>, fallback: string): Promise<Outcome> {
    const p = await call(path, { ...body, dryRun: true }, method);
    if (!p.ok) return failed(p, fallback);
    const a = p.data as ImportAnswer;
    const stops = rowSentences(a);
    if (stops.length) return { kind: "error", text: t({ message: "Some cells cannot be saved as written:", context: "budget line error" }), rows: stops };
    if (a.door && a.door.mayWrite === false) return { kind: "error", text: a.door.message || fallback };
    if (!a.added.length && !a.changed.length) return { kind: "error", text: t({ message: "Nothing differs from the line as it stands.", context: "budget line error" }) };
    const w = await call(path, { ...body, dryRun: false, revision: a.revision }, method);
    if (!w.ok || !w.data?.written) return failed(w, fallback);
    return { kind: "done", text: t({ message: "Saved.", context: "budget line saved" }) };
  }

  const lineCells = (f: LineForm) => ({
    period: f.period.trim(),
    label: f.label.trim(),
    category: f.category,
    planned: f.planned.trim(),
    ...(f.currency.trim() ? { currency: f.currency.trim().toUpperCase() } : {}),
    ...(f.circle.trim() ? { circle: f.circle.trim() } : {}),
    ...(f.role.trim() ? { role: f.role.trim() } : {}),
    note: f.note.trim() || null,
  });

  async function addLine() {
    setAddOutcome(null);
    setBusy(true);
    const out = await pressWrite("/admin/budgets/lines", "POST", { line: lineCells(form) }, t({ message: "The line was not added. Try again in a moment.", context: "budget line error" }));
    setBusy(false);
    setAddOutcome(out);
    if (out?.kind === "done") {
      setForm(blank());
      await reload();
    }
  }

  const formOf = (l: BudgetLine): LineForm => ({
    period: l.periodKey,
    label: l.label,
    category: l.category,
    planned: majorText(l.plannedMinor, exponentOf(l.currency)),
    currency: l.currency,
    circle: "",
    role: "",
    note: l.note ?? "",
  });

  async function saveEdit(l: BudgetLine) {
    const before = formOf(l);
    const changes: Record<string, unknown> = {};
    if (editForm.label.trim() !== before.label) changes.label = editForm.label.trim();
    if (editForm.period.trim() !== before.period) changes.period = editForm.period.trim();
    if (editForm.category !== before.category) changes.category = editForm.category;
    if (editForm.note.trim() !== before.note) changes.note = editForm.note.trim() || null;
    const currency = editForm.currency.trim().toUpperCase();
    // A new currency needs its amount written again in it, so the planned amount goes with it (M3).
    if (editForm.planned.trim() !== before.planned || currency !== before.currency) changes.planned = editForm.planned.trim();
    if (currency !== before.currency) changes.currency = currency;
    if (!Object.keys(changes).length) {
      setLineOutcome({ id: l.id, outcome: { kind: "error", text: t({ message: "Nothing differs from the line as it stands.", context: "budget line error" }) } });
      return;
    }
    setBusy(true);
    const out = await pressWrite(`/admin/budgets/lines/${encodeURIComponent(l.id)}`, "PATCH", { changes }, t({ message: "The change was not saved. Try again in a moment.", context: "budget line error" }));
    setBusy(false);
    setLineOutcome({ id: l.id, outcome: out });
    if (out?.kind === "done") {
      setEditing(null);
      await reload();
    }
  }

  async function press(l: BudgetLine, act: "withdraw" | "restore") {
    setBusy(true);
    const id = encodeURIComponent(l.id);
    const r = await call(act === "withdraw" ? `/admin/budgets/lines/${id}/withdraw` : `/admin/budgets/lines/${id}/restore`, {});
    setBusy(false);
    if (!r.ok || !r.data?.written) {
      setLineOutcome({ id: l.id, outcome: failed(r, t({ message: "That did not save. Try again in a moment.", context: "budget line error" })) });
      return;
    }
    setLineOutcome({
      id: l.id,
      outcome: {
        kind: "done",
        text: act === "withdraw"
          ? t({ message: "Withdrawn. It stops counting and stays on the record.", context: "budget line withdrawn" })
          : t({ message: "Restored. It counts again.", context: "budget line restored" }),
      },
    });
    await reload();
  }

  const categoryOptions = useMemo(() => BUDGET_CATEGORIES.map((c) => ({ value: c, label: i18n._(CATEGORY_WORDS[c]) })), [i18n]);

  const OutcomeNote = ({ o }: { o: Outcome }) =>
    !o ? null : o.kind === "done" ? (
      <p className={`${look.hint} mt-3`} role="status">{o.text}</p>
    ) : (
      <div className={`${look.error} mt-3`} role="alert">
        <p>{o.text}</p>
        {o.rows && o.rows.length > 0 && (
          <ul className="mt-2 list-disc pl-5">
            {o.rows.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        )}
      </div>
    );

  const fields = (f: LineForm, set: (f: LineForm) => void, idp: string, withScope: boolean) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={look.label}>
        {t({ message: "Label", context: "budget line field" })}
        <input id={`${idp}-label`} className={look.field} value={f.label} onChange={(e) => set({ ...f, label: e.target.value })} placeholder={t({ message: "Garden crew pay", context: "budget line field example" })} />
      </label>
      <label className={look.label}>
        {t({ message: "Period", context: "budget line field" })}
        <input id={`${idp}-period`} className={look.field} value={f.period} onChange={(e) => set({ ...f, period: e.target.value })} />
      </label>
      <label className={look.label}>
        {t({ message: "Category", context: "budget line field" })}
        <select id={`${idp}-category`} className={look.field} value={f.category} onChange={(e) => set({ ...f, category: e.target.value as BudgetCategory })}>
          {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className={look.label}>
        {t({ message: "Planned amount", context: "budget line field" })}
        <input id={`${idp}-planned`} className={look.field} inputMode="decimal" value={f.planned} onChange={(e) => set({ ...f, planned: e.target.value })} />
      </label>
      <label className={look.label}>
        {t({ message: "Currency", context: "budget line field" })}
        <input id={`${idp}-currency`} className={look.field} value={f.currency} maxLength={3} onChange={(e) => set({ ...f, currency: e.target.value })} placeholder={village} />
      </label>
      {withScope && (
        <>
          <label className={look.label}>
            {t({ message: "Circle (empty for the whole village)", context: "budget line field" })}
            <input id={`${idp}-circle`} className={look.field} value={f.circle} onChange={(e) => set({ ...f, circle: e.target.value })} />
          </label>
          <label className={look.label}>
            {t({ message: "Role (if the line pays one role)", context: "budget line field" })}
            <input id={`${idp}-role`} className={look.field} value={f.role} onChange={(e) => set({ ...f, role: e.target.value })} />
          </label>
        </>
      )}
      <label className={`${look.label} sm:col-span-2`}>
        {t({ message: "Note", context: "budget line field" })}
        <input id={`${idp}-note`} className={look.field} value={f.note} onChange={(e) => set({ ...f, note: e.target.value })} />
      </label>
    </div>
  );

  return (
    <>
      {look.fold ? (
        <div className="flex flex-wrap gap-3" data-budget-acts>
          <button type="button" className={look.secondary} aria-expanded={uploadOpen} aria-controls="budget-upload-part" onClick={() => setUploadOpen((v) => !v)}>
            {t({ message: "Upload a budget sheet", context: "budget upload" })}
          </button>
          <button type="button" className={look.secondary} aria-expanded={addOpen} aria-controls="budget-add-part" onClick={() => setAddOpen((v) => !v)}>
            {t({ message: "Add one line by hand", context: "budget add line" })}
          </button>
        </div>
      ) : null}

      {uploadOpen ? (
      <section id="budget-upload-part" className={look.panel} aria-labelledby="budget-upload" data-budget-upload>
        <Heading id="budget-upload" className={`${look.h2} mb-1`}>{t({ message: "Upload a budget sheet", context: "budget upload" })}</Heading>
        {look.fold ? (
          <ul className={`${look.hint} mb-4 list-disc space-y-1 pl-5`}>
            <li>{t({ message: "Save the sheet as CSV, or paste its cells below.", context: "budget upload" })}</li>
            <li>{t({ message: "The first row names the columns: period, label, category and planned, then circle, role, currency and note if you like.", context: "budget upload" })}</li>
            <li>{t({ message: "A period is a moon, a month like 2026-11, a season, or two dates. You read what changes before anything is saved.", context: "budget upload" })}</li>
          </ul>
        ) : (
          <p className={`${look.hint} mb-4`}>
            {t({ message: "Save the sheet as CSV, or copy its cells and paste them below. The first row names the columns: period, label, category and planned, and if you like circle, role, currency and note. A period is a moon, a month like 2026-11, a season, or two dates. You read what changes before anything is saved.", context: "budget upload" })}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <label className={look.label}>
            {t({ message: "The sheet", context: "budget upload field" })}
            <input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" className={look.field} onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          <label className={look.label}>
            {t({ message: "Or paste the cells", context: "budget upload field" })}
            <textarea id="budget-sheet" rows={5} className={`${look.field} font-mono`} value={sheet} onChange={(e) => { setSheet(e.target.value); setPreview(null); }} />
          </label>
          <label className={look.label}>
            {t({ message: "A name for this upload (optional)", context: "budget upload field" })}
            <input className={look.field} value={sourceLabel} maxLength={120} onChange={(e) => setSourceLabel(e.target.value)} placeholder={t({ message: "November budget sheet", context: "budget upload field example" })} />
          </label>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input type="checkbox" className="mt-1 accent-notice" checked={whole} onChange={(e) => { setWhole(e.target.checked); setPreview(null); }} />
            <span>{t({ message: "This is the whole budget for these periods. Lines from an earlier upload that this sheet leaves out are withdrawn.", context: "budget upload field" })}</span>
          </label>
          <div>
            <button type="button" className={look.secondary} disabled={busy} onClick={() => void previewUpload()}>
              {t({ message: "Preview the upload", context: "budget upload button" })}
            </button>
          </div>
        </div>
        {preview && (
          <div className={`${look.tile} mt-4`} data-budget-preview>
            <p className="font-semibold text-foreground">{previewSummary}</p>
            {preview.added.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground">
                {preview.added.map((a, i) => (
                  <li key={`a${i}`}>{t({ message: `Adds ${a.label}: ${formatMoney(a.plannedMinor, a.currency)}, ${a.periodKey}`, context: "budget upload preview line" })}</li>
                ))}
              </ul>
            )}
            {preview.changed.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground">
                {preview.changed.map((c, i) => (
                  <li key={`c${i}`}>{t({ message: `Changes ${c.before.label}: ${formatMoney(c.before.plannedMinor, c.before.currency)} to ${formatMoney(c.plannedMinor, c.currency)}`, context: "budget upload preview line" })}</li>
                ))}
              </ul>
            )}
            {preview.withdrawn.length > 0 && (
              <p className={`${look.hint} mt-2`}>{t({ message: `Withdraws: ${preview.withdrawn.join(", ")}`, context: "budget upload preview" })}</p>
            )}
            {previewRows.length > 0 && (
              <div className={`${look.error} mt-3`}>
                <p>{t({ message: "These rows cannot be saved as written. The other rows can be saved, or fix these and preview again:", context: "budget upload preview" })}</p>
                <ul className="mt-2 list-disc pl-5">{previewRows.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            )}
            {preview.flags.length > 0 && (
              <ul className={`${look.hint} mt-2 list-disc pl-5`}>{preview.flags.map((f, i) => <li key={i}>{f.message}</li>)}</ul>
            )}
            {preview.door && preview.door.mayWrite === false && preview.door.message && <p className={`${look.error} mt-3`}>{preview.door.message}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" className={look.primary} disabled={busy || !mayConfirm} onClick={() => void confirmUpload()}>
                {t({ message: "Save this budget", context: "budget upload button" })}
              </button>
              <button type="button" className={look.secondary} disabled={busy} onClick={() => setPreview(null)}>
                {t({ message: "Cancel", context: "budget upload button" })}
              </button>
            </div>
          </div>
        )}
        <OutcomeNote o={uploadOutcome} />
      </section>
      ) : null}

      {addOpen ? (
      <section id="budget-add-part" className={look.panel} aria-labelledby="budget-add" data-budget-add>
        <Heading id="budget-add" className={`${look.h2} mb-1`}>{t({ message: "Add one line by hand", context: "budget add line" })}</Heading>
        <p className={`${look.hint} mb-4`}>{t({ message: "For a line that is not on a sheet. It counts as soon as it is saved.", context: "budget add line" })}</p>
        {fields(form, setForm, "budget-add", true)}
        <div className="mt-4">
          <button type="button" className={look.primary} disabled={busy} onClick={() => void addLine()}>
            {t({ message: "Add the line", context: "budget add line button" })}
          </button>
        </div>
        <OutcomeNote o={addOutcome} />
      </section>
      ) : null}

      <section className={look.panel} aria-labelledby="budget-lines">
        <Heading id="budget-lines" className={`${look.h2} mb-1`}>{t({ message: "The lines", context: "budget desk" })}</Heading>
        <p className={`${look.hint} mb-4`}>{t({ message: "Every line that touches this moon. A withdrawn line stays on the record and can be restored.", context: "budget desk" })}</p>
        {read.lines.length === 0 ? (
          <p className={look.hint}>{t({ message: "No budget line touches this moon yet.", context: "budget desk empty" })}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {read.lines.map((l) => (
              <BudgetLineRow key={l.id} line={l} villageCurrency={read.villageCurrency} look={look}>
                {editing === l.id ? (
                  <div className="mt-2">
                    {fields(editForm, setEditForm, `budget-edit-${l.id}`, false)}
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button type="button" className={look.primary} disabled={busy} onClick={() => void saveEdit(l)}>
                        {t({ message: "Save the change", context: "budget edit line button" })}
                      </button>
                      <button type="button" className={look.secondary} disabled={busy} onClick={() => setEditing(null)}>
                        {t({ message: "Cancel", context: "budget edit line button" })}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {l.status !== "withdrawn" && (
                      <button type="button" className={look.secondary} disabled={busy} onClick={() => { setEditing(l.id); setEditForm(formOf(l)); setLineOutcome(null); }}>
                        {t({ message: `Edit ${l.label}`, context: "budget line button" })}
                      </button>
                    )}
                    {l.status === "withdrawn" ? (
                      <button type="button" className={look.secondary} disabled={busy} onClick={() => void press(l, "restore")}>
                        {t({ message: `Restore ${l.label}`, context: "budget line button" })}
                      </button>
                    ) : (
                      <button type="button" className={look.secondary} disabled={busy} onClick={() => void press(l, "withdraw")}>
                        {t({ message: `Withdraw ${l.label}`, context: "budget line button" })}
                      </button>
                    )}
                  </div>
                )}
                {lineOutcome?.id === l.id && <OutcomeNote o={lineOutcome.outcome} />}
              </BudgetLineRow>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
