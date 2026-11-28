/**
 * SETTING A ROLE'S PAY WITH THE VALUATION ENGINE (Rye, 2026-11-06: "Role pay is
 * set by both the treasurer and the role/valuation algorithm").
 *
 * THE RULE. The flow, in the order research 03 and the UX pass asked for:
 *   1. the role's effort for the moon: a band and an estimate, with an optional
 *      low and high;
 *   2. the setter's own number, asked BEFORE the suggestion shows, so the
 *      suggestion does not anchor it (optional, "skip");
 *   3. the suggestion and its receipt;
 *   4. the figure: "Use the suggestion" or the setter's own, never prefilled;
 *      outside the no-sign band a reason is asked, and the screen says who signs
 *      next before anything is sent.
 *
 * THE ONE EXCEPTION, BY RULING. Rye, 28 Nov 2026, on confirming one of Sera's
 * pay suggestions: "both write the figure and open the pay control to show it,
 * so that a player can simply accept or edit and accept". It applies ONLY when
 * this control is opened from one of Sera's pay rows, which is when it is
 * handed `sera`. Then:
 *   - her figure arrives ALREADY WRITTEN AND CHOSEN, marked as hers, with the
 *     pay it replaces said beside it. The person accepts it as it stands, or
 *     edits it, which makes it their own figure, and accepts. Steps 2 and 4
 *     above do not apply: no own number first, and the figure is prefilled;
 *   - on her monthly figure, Rye the same day: "As listed". It is written with
 *     no conversion, and the choice says a month's figure is used as this
 *     moon's pay (`seraFigure`, lib/seraPay.ts). It is written as the figure
 *     only where the village sets pay in US dollars, the money she lists in;
 *     elsewhere her words show and the rule above holds;
 *   - the estimate kept with the role's last pay setting arrives filled in,
 *     said to come from last time, and editable. With none, the person gives
 *     it, and is told so first;
 *   - where her figure falls outside the band, the reason arrives filled with
 *     one true sentence the person can edit. Nothing else about the band
 *     changes: the server judges it like any other figure;
 *   - if pay was set here after her suggestion was last edited, the control
 *     says so before the person accepts;
 *   - NOTHING IS SAVED UNTIL THE PERSON PRESSES. The save carries a record of
 *     what she listed, what it replaces and what was saved.
 * Opened any other way, this control is exactly the rule above. Both are
 * pinned in RolePayWithEngine.test.tsx.
 *
 * The suggestion is worked out here with the same pure engine the server uses,
 * so it moves as the setter types; the server prices the inputs again on save
 * and decides (PUT /api/org/roles/:id/pay). Admin is light-only by ruling.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trans, useLingui } from "@lingui/react/macro";
import { exponentOf } from "@shared/money";
import type { ValuationModel, WorkInputs } from "@shared/valuation";
import { suggestValuation, wholeMoney } from "@shared/valuationEngine";
import { REASON_CODES } from "@shared/valuationSetting";
import ValuationReceipt from "./ValuationReceipt";
import PayDoorNote, { type PayDoor } from "./PayDoorNote";
import NoSignBandNote from "./NoSignBandNote";
import { seraFigure, type CurrentPay, type SeraPay, type StoredEstimate } from "@/lib/seraPay";

type Call = (path: string, body?: unknown, method?: string) => Promise<any>;
type ModelRead = { model: ValuationModel; eeMeaningWritten: boolean; tokenNames: Record<string, string>; payDoor?: PayDoor };

const field = "w-full border border-border rounded-lg px-3 py-2 text-sm min-h-[44px] bg-card";
const label = "block text-xs font-semibold text-muted-foreground mb-1";

const toMinor = (text: string, currency: string): number | null => {
  const n = Number(String(text).replace(/[^0-9.]/g, ""));
  if (!text.trim() || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * Math.pow(10, exponentOf(currency)));
};

/** "20 Nov 2026", in the reader's own zone. */
const dayWords = (iso: string): string => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

export default function RolePayWithEngine({
  role,
  call,
  onSaved,
  sera = null,
  stored = null,
  current = null,
  onOutcome,
}: {
  role: { id: string; name: string };
  call: Call;
  onSaved: () => void;
  /** What Sera lists for this role. Handed only when the control is opened from her pay row: the ruled exception. */
  sera?: SeraPay | null;
  /** The estimate kept with this role's last pay setting. Used only with `sera`. */
  stored?: StoredEstimate | null;
  /** The role's pay as it stands, which an accepted figure replaces. Said only with `sera`. */
  current?: CurrentPay | null;
  /** What the pay route answered, each time it answers: set, waiting for a second signer, or to the village. */
  onOutcome?: (state: "set" | "awaiting_second" | "village") => void;
}) {
  const { t } = useLingui();
  const [read, setRead] = useState<ModelRead | null>(null);
  const [band, setBand] = useState("");
  const [hours, setHours] = useState("");
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [responsibility, setResponsibility] = useState("none");
  const [ownFirst, setOwnFirst] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [choice, setChoice] = useState<"suggestion" | "own" | "sera" | null>(null);
  const [own, setOwn] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);
  // From her row only: whether the person has written their own reason or note, and whether the estimate from last time is in the fields.
  const [reasonTouched, setReasonTouched] = useState(false);
  const [noteTouched, setNoteTouched] = useState(false);
  const [estimateTouched, setEstimateTouched] = useState(false);
  const [filledThenEdited, setFilledThenEdited] = useState(false);

  useEffect(() => {
    void call("/valuation/model", undefined, "GET").then((d) => {
      if (!d?.model) return;
      setRead(d);
      setBand((b) => b || d.model.bands[0]?.key || "");
    });
  }, []);

  const model = read?.model ?? null;
  const currency = model?.currency ?? "";
  // The estimate from last time, when it is for a kind of work the village still has. Only from her row.
  const last = sera && stored && model?.bands.some((b) => b.key === stored.band) ? stored : null;
  // It is in the fields from the first draw, never a moment later, until the person changes any of them. An estimate
  // the person typed before it arrived is left alone.
  const fromLast = !!last && !estimateTouched;
  const est = fromLast && last
    ? {
        band: last.band,
        hours: String(last.estimatedHours),
        low: last.estimateLow !== null ? String(last.estimateLow) : "",
        high: last.estimateHigh !== null ? String(last.estimateHigh) : "",
        responsibility: last.responsibility && model?.responsibility.some((l) => l.key === last.responsibility) ? last.responsibility : responsibility,
      }
    : { band, hours, low, high, responsibility };
  const editEstimate = (patch: Partial<typeof est>) => {
    const next = { ...est, ...patch };
    setBand(next.band);
    setHours(next.hours);
    setLow(next.low);
    setHigh(next.high);
    setResponsibility(next.responsibility);
    if (fromLast) setFilledThenEdited(true);
    setEstimateTouched(true);
  };

  const work: WorkInputs | null = useMemo(() => {
    const h = Number(est.hours);
    if (!est.band || !(h > 0)) return null;
    const line = { band: est.band, payee: "lead" as const, estimatedHours: h, ...(Number(est.low) > 0 ? { estimateLow: Number(est.low) } : {}), ...(Number(est.high) > 0 ? { estimateHigh: Number(est.high) } : {}) };
    return { kind: "role", lines: [line], responsibility: est.responsibility };
  }, [est.band, est.hours, est.low, est.high, est.responsibility]);
  const suggestion = useMemo(() => {
    if (!model || !work) return null;
    const s = suggestValuation(model, work, { eeMeaningWritten: !!read?.eeMeaningWritten });
    return s.ok ? { ok: true as const, payee: s.payees[0], warnings: s.warnings } : { ok: false as const, problems: s.refusals.map((r) => r.problem) };
  }, [model, work, read]);

  if (!read) return <p className="text-sm text-muted-foreground"><Trans>Reading the village's pay settings…</Trans></p>;
  if (!model || model.bands.length === 0) {
    return <p className="text-sm text-muted-foreground"><Trans>The village has not set its rates yet. Set them on the economics page, then work out this role's pay here.</Trans></p>;
  }

  const s = suggestion?.ok ? suggestion.payee : null;
  const agent = sera?.agent ?? "";
  // Her figure and how it is said, from one place. `hersMinor` is null where the village sets pay in another currency.
  const hers = seraFigure(sera, currency);
  const hersMinor = hers?.minor ?? null;
  const usd = hers?.usd ?? "";
  /** The ruled exception is in force: opened from her row, with a figure of hers to write. */
  const herFigure = hersMinor !== null;
  const hersMoney = hersMinor !== null ? wholeMoney(hersMinor, currency) : "";
  const chosen = choice ?? (herFigure ? "sera" : null);
  const figure = chosen === "suggestion" && s ? s.expected.totalMinor : chosen === "own" ? toMinor(own, currency) : chosen === "sera" ? hersMinor : null;
  const outside = s && figure !== null ? figure < s.band.lowMinor || figure > s.band.highMinor : false;
  const tokenName = (slug: string) => read.tokenNames[slug] ?? slug;

  // Outside the band, her figure arrives with its reason written: one true sentence, the person's to edit.
  const herWords = hers ? t({ message: `${agent} lists this role at ${usd} a month.`, context: "role pay" }) : "";
  const reasonWritten = chosen === "sera" && outside && !reasonTouched;
  const reasonNow = reasonWritten ? "Other" : reason;
  const noteNow = noteTouched ? note : reasonWritten ? herWords : "";

  const lastKind = last ? model.bands.find((b) => b.key === last.band)?.label ?? "" : "";
  const lastHours = last ? (last.estimatedHours === 1 ? t({ message: "1 hour", context: "role pay" }) : t({ message: `${last.estimatedHours} hours`, context: "role pay" })) : "";
  const lastLow = last?.estimateLow ?? null;
  const lastHigh = last?.estimateHigh ?? null;
  const filledFromLast = !!last && (fromLast || filledThenEdited);

  const was = current ? wholeMoney(current.minor, current.currency) : "";
  // Pay set here after her suggestion was last edited: said before the person accepts.
  const stale = !!sera && !!current?.setAt && !!sera.editedAt && new Date(current.setAt).getTime() > new Date(sera.editedAt).getTime();
  const setDay = stale && current?.setAt ? dayWords(current.setAt) : "";
  const editedDay = stale && sera?.editedAt ? dayWords(sera.editedAt) : "";

  const save = async () => {
    if (!work || figure === null) return;
    if (outside && !reasonNow) return toast.error(t`This figure is outside the suggestion's band, so pick a reason.`);
    const why = reasonNow === "Other" ? noteNow.trim() || "Other" : reasonNow || undefined;
    const saved = wholeMoney(figure, currency);
    const before = current ? was : t({ message: "no pay set", context: "role pay" });
    // From her row, the record keeps what she listed, what it replaces and what was saved.
    const record = !sera
      ? ""
      : hers
        ? t({ message: `Opened from the pay ${agent} lists: ${usd} a month. Before: ${before}. Saved: ${saved}.`, context: "role pay" })
        : t({ message: `Opened from a pay suggestion ${agent} lists. Before: ${before}. Saved: ${saved}.`, context: "role pay" });
    const typed = noteTouched ? note.trim() : "";
    const d = await call(`/org/roles/${role.id}/pay`, {
      work,
      set: { totalMinor: figure },
      reason: why,
      note: [typed, record].filter(Boolean).join(" ") || undefined,
      ownNumberFirst: toMinor(ownFirst, currency) ?? undefined,
    }, "PUT");
    if (!d) return;
    onOutcome?.(d.state === "set" ? "set" : d.state === "awaiting_second" ? "awaiting_second" : "village");
    if (d.state === "set") {
      toast.success(t({ message: "Saved", context: "role pay" }));
      setOutcome(t`Saved. The role's pay is set.`);
      onSaved();
    } else if (d.state === "awaiting_second") {
      setOutcome(t`Waiting for a second signer: another Treasurer or a steward. Until they sign, the role's pay stays as it is. If nobody signs within 7 days, put the change to the village in an org draft.`);
    } else {
      setOutcome(t`Nobody else can sign this figure, so it goes to the village. Put the change in an org draft and put it to a vote.`);
    }
  };

  return (
    <div className="space-y-3 text-foreground" data-role-pay-engine>
      <PayDoorNote door={read.payDoor} />
      {last && filledFromLast && (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm" data-testid="stored-estimate">
          <Trans context="role pay">Filled in from the last time this role's pay was set: {lastKind}, {lastHours} for the moon.</Trans>{" "}
          {lastLow !== null && lastHigh !== null ? (
            <><Trans context="role pay">It could be as little as {lastLow} or as much as {lastHigh}.</Trans>{" "}</>
          ) : lastLow !== null ? (
            <><Trans context="role pay">It could be as little as {lastLow}.</Trans>{" "}</>
          ) : lastHigh !== null ? (
            <><Trans context="role pay">It could be as much as {lastHigh}.</Trans>{" "}</>
          ) : null}
          <Trans context="role pay">Change anything that is different now.</Trans>
        </p>
      )}
      {herFigure && !work && (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm" data-testid="needs-estimate">
          <Trans context="role pay">Give this role's effort for the moon first. The figure {agent} lists is ready below once you do.</Trans>
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          <span className={label}><Trans context="role pay">Kind of work</Trans></span>
          <select className={field} value={est.band} onChange={(e) => editEstimate({ band: e.target.value })}>
            {model.bands.map((b) => (
              <option key={b.key} value={b.key}>{b.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}><Trans context="role pay">Responsibility</Trans></span>
          <select className={field} value={est.responsibility} onChange={(e) => editEstimate({ responsibility: e.target.value })}>
            {model.responsibility.map((l) => (
              <option key={l.key} value={l.key}>{l.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}><Trans>Estimated effort for the moon, in hours</Trans></span>
          <input className={field} inputMode="decimal" value={est.hours} onChange={(e) => editEstimate({ hours: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={label}><Trans>Could be as little as</Trans></span>
            <input className={field} inputMode="decimal" value={est.low} onChange={(e) => editEstimate({ low: e.target.value })} />
          </label>
          <label>
            <span className={label}><Trans context="role pay">Or as much as</Trans></span>
            <input className={field} inputMode="decimal" value={est.high} onChange={(e) => editEstimate({ high: e.target.value })} />
          </label>
        </div>
      </div>

      {/* The rule: the setter's own number first. Not from her row with a figure of hers: the ruled exception. */}
      {!revealed && !herFigure && (
        <div className="rounded-lg border border-border bg-muted px-3 py-2">
          <label className="block">
            <span className={label}><Trans>Your own figure first, before you see the suggestion (optional)</Trans></span>
            <input className={field} inputMode="decimal" value={ownFirst} onChange={(e) => setOwnFirst(e.target.value)} />
          </label>
          <button type="button" disabled={!s} onClick={() => setRevealed(true)} className="mt-2 min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-40">
            <Trans context="role pay">Show the suggestion</Trans>
          </button>
        </div>
      )}

      {suggestion && !suggestion.ok && <p className="text-sm text-muted-foreground">{suggestion.problems[0]}</p>}

      {(revealed || herFigure) && s && (
        <>
          <ValuationReceipt suggestion={s} currency={currency} tokenName={tokenName} />
          {suggestion?.ok && suggestion.warnings.map((w) => (
            <p key={w.text} className="text-sm text-muted-foreground">{w.text}</p>
          ))}
          {toMinor(ownFirst, currency) !== null && (
            <p className="text-sm text-muted-foreground"><Trans>Your own figure was {wholeMoney(toMinor(ownFirst, currency)!, currency)}.</Trans></p>
          )}
          {sera && <p className="text-sm text-foreground" data-sera-pay>{sera.sentence}</p>}
          {sera && (
            <p className="text-sm text-muted-foreground">
              {current ? <Trans context="role pay">This role's pay is {was} now.</Trans> : <Trans context="role pay">This role has no pay set now.</Trans>}
            </p>
          )}
          {stale && (
            <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground" data-testid="pay-stale">
              <Trans context="role pay">Pay was set here on {setDay}, after {agent} last edited the suggestion on {editedDay}. Check the figure still applies before you set it.</Trans>
            </p>
          )}
          {hers && !herFigure && (
            <p className="text-sm text-muted-foreground"><Trans context="role pay">{agent} lists a figure in US dollars. This village sets pay in {currency}, so choose the suggestion or type your own figure.</Trans></p>
          )}
          <fieldset className="space-y-2">
            <legend className={label}><Trans context="role pay">The figure you set</Trans></legend>
            {herFigure && (
              <label className="flex min-h-[44px] items-center gap-2">
                <input type="radio" name={`pay-${role.id}`} checked={chosen === "sera"} onChange={() => setChoice("sera")} />
                <span><Trans context="role pay">{agent} suggests {hersMoney} a month, used as this moon's pay</Trans></span>
              </label>
            )}
            <label className="flex min-h-[44px] items-center gap-2">
              <input type="radio" name={`pay-${role.id}`} checked={chosen === "suggestion"} onChange={() => setChoice("suggestion")} />
              <span><Trans context="role pay">Use the suggestion, {wholeMoney(s.expected.totalMinor, currency)}</Trans></span>
            </label>
            <label className="flex min-h-[44px] items-center gap-2">
              <input type="radio" name={`pay-${role.id}`} checked={chosen === "own"} onChange={() => setChoice("own")} />
              <span><Trans context="role pay">My own figure</Trans></span>
            </label>
            {/* Her figure is written here and may be edited in place. An edit makes it the person's own figure. */}
            {(chosen === "sera" || chosen === "own") && (
              <input
                className={field}
                inputMode="decimal"
                aria-label={chosen === "sera" ? t({ message: "The figure to set", context: "role pay" }) : t({ message: "Your figure", context: "role pay" })}
                value={chosen === "sera" && hersMinor !== null ? String(hersMinor / Math.pow(10, exponentOf(currency))) : own}
                onChange={(e) => {
                  setOwn(e.target.value);
                  setChoice("own");
                }}
              />
            )}
          </fieldset>
          <NoSignBandNote model={model} />
          {figure !== null && (
            <p className="text-sm text-muted-foreground">
              {outside
                ? t`This is outside the suggestion's band, so give a reason. A second Treasurer or a steward then signs it, or the village decides.`
                : t`This is inside the suggestion's band, so your word sets it.`}
            </p>
          )}
          {outside && (
            <label className="block">
              <span className={label}><Trans context="role pay">Reason</Trans></span>
              <select
                className={field}
                value={reasonNow}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonTouched(true);
                }}
              >
                <option value=""><Trans context="role pay">Pick a reason</Trans></option>
                {REASON_CODES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className={label}>{reasonNow === "Other" ? t({ message: "Say why", context: "role pay" }) : t({ message: "A note (optional)", context: "role pay" })}</span>
            <input
              className={field}
              value={noteNow}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteTouched(true);
              }}
            />
          </label>
          <button type="button" disabled={figure === null} onClick={() => void save()} className="min-h-[44px] rounded-lg bg-teal-deep px-4 text-sm font-semibold text-white hover:bg-teal-deep-dark disabled:opacity-40">
            <Trans context="role pay">Set this role's pay</Trans>
          </button>
          {outcome && <p className="text-sm text-foreground" role="status">{outcome}</p>}
        </>
      )}
    </div>
  );
}
