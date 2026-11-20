/**
 * "TERMS WE OFFER" (joining lane PR 4): what the people who seat a role read and word for ONE proposal.
 * All eight settings and the commitment, each with the role's suggestion, the candidate's answer
 * and our wording. Saving writes a new revision and never overwrites; the log below lists who,
 * when, and what changed from and to. The log is for deciders and is only ever served to them.
 *
 * Drawn in the profile's look (docs/DESIGN_RULE.md): the semantic tokens only, panels and tiles,
 * a gold main act, 44px targets. Used by the open proposal page and the member door's application page.
 *
 * TYPED WORDS ARE NEVER LOST QUIETLY (audit M5): every unsaved wording or commitment counts on the
 * house save bar ("1 change not saved yet · Revision 2"), which also guards leaving the page.
 */
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { COMMITMENT_CHOICES } from "@shared/termsWords";
import { OFFER_WORD_MAX } from "@shared/counterOffer";
import { askPeriod, ceilingAt, type PayAsk } from "@shared/commitmentRange";
import type { PayCeiling } from "@shared/roleCardSections";
import { moneyWords } from "@shared/roleRewardWords";
import { perPeriod } from "@/components/roleCard/rewardWords";
import { gameFetch } from "@/lib/gameApi";
import SaveBar, { type SaveResult } from "@/components/SaveBar";

export interface ServedDeciderOffer {
  revision: number;
  rows: Array<{
    key: string;
    label: string;
    suggested: string | null;
    current: string | null;
    theirs: { choice: "accept" | "talk"; note: string } | null;
    state: "accept" | "talk" | "waiting";
    changed: boolean;
  }>;
  theirCommitment: number | null;
  roleCommitment: number | null;
  ourCommitment: number | null;
  history: Array<{ n: number; at: string; by: string; changes: Array<{ key: string; label: string; from: string | null; to: string | null }> }>;
  openTalks: string[];
  /** Each role's commitment and price, as asked and as countered (the lead, 18 Nov 2026). Absent or empty: none to counter. */
  roles?: ServedRoleRow[];
}

export interface ServedRoleRow {
  roleId: string;
  name: string;
  first: boolean;
  theirCommitment: number | null;
  ourCommitment: number | null;
  commitmentChanged: boolean;
  commitmentState: "accept" | "talk" | "waiting";
  ask: PayAsk | null;
  ceiling: PayCeiling | null;
  ourPrice: number | null;
  priceChanged: boolean;
  priceState: "accept" | "talk" | "waiting";
}

const PANEL = "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6";
const TILE = "rounded-xl border border-border bg-muted p-4";
const EYEBROW = "text-xs font-semibold uppercase tracking-widest text-notice";
const FIELD = "w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
const BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-notice px-5 py-2 font-semibold text-background hover:bg-notice/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const CHIP = "inline-flex items-center rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground";

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/**
 * A commitment the Compare section's split suggests for this proposal (`?commitment=40&role=<id>` on the page's link),
 * typed into the counter-offer for a person to read, change or drop. It is never saved by itself: it counts on the save
 * bar as an unsaved change, and only Save sends it (the lead, 20 Nov 2026).
 */
export interface CommitmentPrefill {
  commitmentPct: number;
  roleId?: string | null;
}

/** The prefill on a page's address, when it reads as one: a whole step of ten from 10 to 100. */
export function prefillFromSearch(search: string): CommitmentPrefill | null {
  const q = new URLSearchParams(search);
  const n = Number(q.get("commitment"));
  if (!Number.isInteger(n) || n < 10 || n > 100 || n % 10 !== 0) return null;
  const roleId = (q.get("role") ?? "").trim().slice(0, 64);
  return { commitmentPct: n, ...(roleId ? { roleId } : {}) };
}

export default function TermsWeOffer({ offer, mayEdit, savePath, onSaved, prefill }: { offer: ServedDeciderOffer; mayEdit: boolean; savePath: string; onSaved: () => void; prefill?: CommitmentPrefill | null }) {
  const { t, i18n } = useLingui();
  const [words, setWords] = useState<Record<string, string>>({});
  // A suggested commitment for a later role lands on that role's row; for the first or only role, on the commitment.
  const prefillRow = mayEdit && prefill?.roleId ? (offer.roles ?? []).find((r) => r.roleId === prefill.roleId && !r.first) : undefined;
  const [pct, setPct] = useState<string>("");
  /** Each role's countered commitment and price, typed and not saved yet. */
  const [roleEdits, setRoleEdits] = useState<Record<string, { commitmentPct?: string; price?: string }>>({});
  // Typed in once, after the first render, as a person's typing would be: the save bar counts a change that arrives
  // after it is listening, and one present before it subscribed would never show.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !mayEdit || !prefill) return;
    prefilled.current = true;
    if (prefillRow) setRoleEdits({ [prefillRow.roleId]: { commitmentPct: String(prefill.commitmentPct) } });
    else setPct(String(prefill.commitmentPct));
  }, [mayEdit, prefill, prefillRow]);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  const wordsFor = (k: string, current: string | null) => (k in words ? words[k] : (current ?? ""));
  const edits = offer.rows.filter((r) => r.key in words && (words[r.key] ?? "").trim() !== (r.current ?? "").trim());
  const commitmentEdit = pct !== "" && Number(pct) !== offer.ourCommitment;
  const roleRows = offer.roles ?? [];
  const roleChanges = roleRows
    .map((r) => {
      const e = roleEdits[r.roleId] ?? {};
      const c = !r.first && e.commitmentPct !== undefined && e.commitmentPct !== "" && Number(e.commitmentPct) !== r.ourCommitment ? { commitmentPct: Number(e.commitmentPct) } : {};
      const p = e.price !== undefined && e.price.trim() !== "" && Number(e.price) !== r.ourPrice ? { price: Number(e.price) } : {};
      return Object.keys(c).length || Object.keys(p).length ? { roleId: r.roleId, ...c, ...p } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const dirty = edits.length > 0 || commitmentEdit || roleChanges.length > 0;

  const save = async (): Promise<SaveResult> => {
    setBusy(true);
    setSaid(null);
    try {
      const res = await gameFetch(savePath, {
        method: "POST",
        body: JSON.stringify({
          expectedRevision: offer.revision,
          words: Object.fromEntries(edits.map((r) => [r.key, words[r.key]])),
          ...(commitmentEdit ? { commitmentPct: Number(pct) } : {}),
          ...(roleChanges.length ? { roles: roleChanges } : {}),
        }),
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const reason = String(data?.message ?? data?.error ?? t`That did not save. Try again.`);
        setSaid({ ok: false, text: reason });
        return { ok: false, reason };
      }
      setWords({});
      setPct("");
      setRoleEdits({});
      setSaid({ ok: true, text: t`Saved. We told the applicant.` });
      onSaved();
      return { ok: true };
    } catch {
      const reason = t`That did not save. Try again.`;
      setSaid({ ok: false, text: reason });
      return { ok: false, reason };
    } finally {
      setBusy(false);
    }
  };
  const discard = () => {
    setWords({});
    setPct("");
    setRoleEdits({});
  };

  const choiceWords = (c: "accept" | "talk") => (c === "accept" ? t({ message: `I accept`, context: "reviewer's terms panel for a proposal" }) : t({ message: `Let's talk`, context: "reviewer's terms panel for a proposal" }));
  const stateWords = (s: "accept" | "talk" | "waiting") => (s === "waiting" ? t`Waiting for their answer` : s === "talk" ? t({ message: `Let's talk`, context: "reviewer's terms panel for a proposal" }) : t({ message: `Agreed`, context: "reviewer's terms panel for a proposal" }));

  return (
    <section aria-labelledby="terms-we-offer" className={PANEL} data-terms-we-offer="">
      <p className={EYEBROW}>{t({ message: `Counter-offer`, context: "reviewer's terms panel for a proposal" })}</p>
      <h2 id="terms-we-offer" className="font-display text-2xl font-bold text-card-foreground">
        {t({ message: `Terms we offer`, context: "reviewer's terms panel for a proposal" })}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {mayEdit
          ? t`Word any setting for this proposal. Each save is a new revision, the applicant sees what changed and answers it, and the history stays here.`
          : t`The terms as they stand for this proposal. Whoever holds the power to fill roles can change them.`}
      </p>

      <ul className="mt-4 grid gap-3">
        {offer.rows.map((r) => (
          <li key={r.key} className={TILE} data-term-row={r.key}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">{r.label}</h3>
              <span className="flex flex-wrap gap-1.5">
                {r.theirs && <span className={CHIP}>{t({ message: `They said: ${choiceWords(r.theirs.choice)}`, context: "reviewer's terms panel for a proposal" })}</span>}
                {r.changed && <span className={CHIP} data-term-state={r.state}>{stateWords(r.state)}</span>}
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t({ message: `The role suggests`, context: "reviewer's terms panel for a proposal" })}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">{r.suggested ?? t`Not written. We'll set this together.`}</p>
            {r.theirs?.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">{t({ message: `Their note: ${r.theirs.note}`, context: "reviewer's terms panel for a proposal" })}</p>}
            {mayEdit ? (
              <label className="mt-3 block">
                <span className="text-sm font-semibold text-foreground">{t`Our wording for this proposal`}</span>
                <textarea
                  rows={3}
                  maxLength={OFFER_WORD_MAX}
                  value={wordsFor(r.key, r.current)}
                  onChange={(e) => setWords((w) => ({ ...w, [r.key]: e.target.value }))}
                  className={`${FIELD} mt-1`}
                />
              </label>
            ) : (
              r.changed && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">{t({ message: `Our wording: ${r.current ?? ""}`, context: "reviewer's terms panel for a proposal" })}</p>
            )}
          </li>
        ))}
        <li className={TILE} data-term-row="commitment">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-foreground">{t({ message: `Commitment`, context: "reviewer's terms panel for a proposal" })}</h3>
            <span className={CHIP}>{offer.theirCommitment == null ? t`They have not chosen` : t({ message: `They chose ${offer.theirCommitment}%`, context: "reviewer's terms panel for a proposal" })}</span>
          </div>
          {offer.roleCommitment != null && <p className="mt-2 text-sm text-foreground">{t`The role asks ${offer.roleCommitment}%`}</p>}
          <p className="mt-1 text-sm text-muted-foreground">{t`Energy and attention. We agree it together.`}</p>
          {mayEdit ? (
            <label className="mt-3 block">
              <span className="text-sm font-semibold text-foreground">{t`The commitment we'd agree on`}</span>
              <select value={pct === "" ? String(offer.ourCommitment ?? "") : pct} onChange={(e) => setPct(e.target.value)} className={`${FIELD} mt-1 min-h-11`}>
                {offer.ourCommitment == null && <option value="">{t({ message: `Choose`, context: "reviewer's terms panel for a proposal" })}</option>}
                {COMMITMENT_CHOICES.map((c) => (
                  <option key={c} value={c}>
                    {c}%
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="mt-2 text-sm text-foreground">{offer.ourCommitment == null ? "" : t({ message: `We'd agree ${offer.ourCommitment}%`, context: "reviewer's terms panel for a proposal" })}</p>
          )}
        </li>
      </ul>

      {/* EACH ROLE ON ITS OWN TERMS (the lead, 18 Nov 2026): its commitment (the first role's is above) and its price. */}
      {roleRows.length > 0 && (
        <ul className="mt-4 grid gap-3" data-role-counters="">
          {roleRows.map((r) => {
            const e = roleEdits[r.roleId] ?? {};
            const money = (n: number) => (r.ceiling ? perPeriod(i18n, moneyWords(n, r.ceiling.currency, i18n.locale), r.ceiling.per) : String(n));
            const at = r.ourCommitment ?? r.theirCommitment;
            const suggested = r.ceiling && at ? ceilingAt(r.ceiling.amount, at) : null;
            const asked = r.ask?.kind === "amount" && (!r.ceiling || askPeriod(r.ask) === r.ceiling.per) ? r.ask.monthly : null;
            return (
              <li key={r.roleId} className={TILE} data-role-counter={r.roleId}>
                <h3 className="font-semibold text-foreground">{r.name}</h3>
                {!r.first && (
                  <div className="mt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-foreground">{r.theirCommitment == null ? t`They have not chosen` : t({ message: `They chose ${r.theirCommitment}%`, context: "reviewer's terms panel, one role's commitment" })}</p>
                      {r.commitmentChanged && <span className={CHIP} data-role-state="commitment">{stateWords(r.commitmentState)}</span>}
                    </div>
                    {mayEdit ? (
                      <label className="mt-2 block">
                        <span className="text-sm font-semibold text-foreground">{t({ message: `The commitment we'd agree on for ${r.name}`, context: "reviewer's terms panel, one role's commitment" })}</span>
                        <select value={e.commitmentPct ?? String(r.ourCommitment ?? "")} onChange={(ev) => setRoleEdits((m) => ({ ...m, [r.roleId]: { ...m[r.roleId], commitmentPct: ev.target.value } }))} className={`${FIELD} mt-1 min-h-11`}>
                          {r.ourCommitment == null && <option value="">{t({ message: `Choose`, context: "reviewer's terms panel for a proposal" })}</option>}
                          {COMMITMENT_CHOICES.filter((c) => c >= 10).map((c) => (
                            <option key={c} value={c}>
                              {c}%
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      r.ourCommitment != null && <p className="mt-1 text-sm text-foreground">{t({ message: `We'd agree ${r.ourCommitment}%`, context: "reviewer's terms panel for a proposal" })}</p>
                    )}
                  </div>
                )}
                <div className="mt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-foreground" data-role-asked="">
                      {asked !== null
                        ? t({ message: `Their price: ${money(asked)}`, context: "reviewer's terms panel, one role's price" })
                        : r.ask?.kind === "negotiate"
                          ? t({ message: "They chose to negotiate on the first call.", context: "reviewer's terms panel, one role's price" })
                          : t({ message: "They asked no price of their own.", context: "reviewer's terms panel, one role's price" })}
                    </p>
                    {r.priceChanged && <span className={CHIP} data-role-state="price">{stateWords(r.priceState)}</span>}
                  </div>
                  {suggested !== null && <p className="mt-1 text-sm text-muted-foreground">{t({ message: `Suggested at ${at}%: ${money(suggested)}`, context: "reviewer's terms panel, one role's price" })}</p>}
                  {mayEdit && r.ceiling ? (
                    <label className="mt-2 block">
                      <span className="text-sm font-semibold text-foreground">{t({ message: `The price we'd agree on for ${r.name}, each ${r.ceiling.per}`, context: "reviewer's terms panel, one role's price" })}</span>
                      <input inputMode="numeric" value={e.price ?? (r.ourPrice != null ? String(r.ourPrice) : "")} onChange={(ev) => setRoleEdits((m) => ({ ...m, [r.roleId]: { ...m[r.roleId], price: ev.target.value.replace(/[^0-9]/g, "") } }))} className={`${FIELD} mt-1 min-h-11 sm:max-w-xs`} />
                    </label>
                  ) : (
                    r.priceChanged && r.ourPrice != null && <p className="mt-1 text-sm text-foreground">{t({ message: `We'd agree ${money(r.ourPrice)}`, context: "reviewer's terms panel, one role's price" })}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {mayEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy || !dirty} onClick={() => void save()} className={BTN_PRIMARY}>
            {t({ message: `Save revision ${offer.revision + 1}`, context: "reviewer's terms panel for a proposal" })}
          </button>
          {said && (
            <p role="status" className={said.ok ? "text-sm text-foreground" : "text-sm text-destructive"}>
              {said.text}
            </p>
          )}
        </div>
      )}

      {mayEdit && (
        <SaveBar
          count={edits.length + (commitmentEdit ? 1 : 0) + roleChanges.length}
          onSave={save}
          onDiscard={discard}
          what={t({ message: `Revision ${offer.revision + 1} of the terms`, context: "save bar, the counter-offer being saved" })}
        />
      )}

      <details className="mt-5" data-terms-history="">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-notice">{t({ message: `History (${offer.history.length})`, context: "reviewer's terms panel for a proposal" })}</summary>
        {offer.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t`Nothing has been changed yet.`}</p>
        ) : (
          <ol className="mt-2 grid gap-3">
            {offer.history.map((h) => (
              <li key={h.n} className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="font-semibold text-foreground">{t`Revision ${h.n}, ${day(h.at)}, by ${h.by}`}</p>
                <ul className="mt-1 grid gap-1">
                  {h.changes.map((c) => (
                    <li key={c.key} className="break-words text-foreground">
                      <span className="font-semibold">{c.label}: </span>
                      <span className="text-muted-foreground">{c.from ?? t({ message: `not set`, context: "reviewer's terms panel for a proposal" })}</span>
                      {` → `}
                      <span>{c.to ?? t({ message: `not set`, context: "reviewer's terms panel for a proposal" })}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </details>
    </section>
  );
}

/** The warning above an adopt button while a setting is still being talked about. */
export function OpenTalksWarning({ settings, confirmed, onConfirm }: { settings: string[]; confirmed: boolean; onConfirm: (v: boolean) => void }) {
  const { t } = useLingui();
  if (!settings.length) return null;
  return (
    <div className="rounded-xl border-2 border-notice/60 bg-card p-4" role="alert" data-open-talks="">
      <p className="font-semibold text-foreground">{t`We have not agreed these yet: ${settings.join(", ")}.`}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t`Adopting now records the terms as they stand.`}</p>
      <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={confirmed} onChange={(e) => onConfirm(e.target.checked)} className="size-5" />
        {t`I know, and I want to adopt anyway`}
      </label>
    </div>
  );
}
