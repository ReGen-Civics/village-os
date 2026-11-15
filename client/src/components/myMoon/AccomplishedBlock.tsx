/**
 * AGREED AND DELIVERED (Rye, 14 Nov 2026: "paid on what we truly
 * accomplished"). The member and the Treasurer read the same block: what was
 * agreed (each role's pay before any change, and the moon goals) beside what
 * was delivered (goals done, and the tasks done, per role and outside the
 * member's roles), in one sentence, with the far-off flag when it is raised.
 * Counts only, no score, band or reading. Amounts hide in Room view.
 *
 * The Treasurer's desk adds `ProposeAmount`: an amount for one pay line and a
 * reason the member reads. `AdjustBreakdown` shows a proposal on its line.
 */
import { useEffect, useId, useRef, useState } from "react";
import { exponentOf } from "@shared/money";
import { ACCOMPLISHED_WORDS, adjustableLine, type AccomplishedView, type LineAdjust } from "@shared/accomplishedReview";
import type { InvoiceLine } from "@shared/moonRecap";
import * as api from "./moonApi";
import { Amount, ERROR, INPUT, LABEL, SMALL_BTN, useRoomView } from "./moonUi";

/**
 * `level` is the block title's heading level, one below the heading it sits
 * under: the member's invoice panel titles its parts with h4, and the Finance
 * desk names each member with an h4, so the block is h5 there (a11y P2-15).
 */
export function AccomplishedBlock({ view, level = 5 }: { view: AccomplishedView; level?: 4 | 5 }) {
  const W = ACCOMPLISHED_WORDS;
  const Heading = level === 4 ? "h4" : "h5";
  const room = useRoomView();
  const roles = view.tasks.byRole.filter((r) => r.count > 0).map((r) => `${r.name} ${r.count}`);
  if (view.tasks.outside > 0) roles.push(`${W.outside} ${view.tasks.outside}`);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3" data-testid="accomplished">
      <Heading className="m-0 text-sm font-semibold text-foreground">{W.heading}</Heading>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{W.agreed}</dt>
        <dd className="m-0 text-foreground">
          {view.agreed.lines.map((l, i) => (
            <span key={`${l.roleNames.join(",")}-${i}`}>
              {i > 0 ? ", " : ""}
              {l.roleNames.join(", ")} <Amount minor={l.amountMinor} currency={l.currency} />
            </span>
          ))}
          {view.agreed.lines.length > 0 ? " · " : ""}
          {view.agreed.goals === 1 ? "1 goal" : `${view.agreed.goals} goals`}
        </dd>
        <dt className="text-muted-foreground">{W.goals}</dt>
        <dd className="m-0 text-foreground">{view.goals.total > 0 ? W.goalCounts(view.goals) : W.noGoals}</dd>
        <dt className="text-muted-foreground">{W.tasksDone}</dt>
        <dd className="m-0 text-foreground">{view.tasks.done}{roles.length ? `: ${roles.join(", ")}` : ""}</dd>
      </dl>
      {/* The sentence names the agreed amount, so it hides in Room view with every other amount. */}
      {room ? null : <p className="m-0 text-sm text-foreground" data-testid="accomplished-sentence">{view.sentence}</p>}
      {view.farOff ? (
        <div className="flex flex-col gap-1 rounded-lg bg-muted/60 px-2 py-1.5" data-testid="far-off" role="note">
          <p className="m-0 text-sm font-semibold text-foreground">{W.farOff}</p>
          {view.farOff.lines.map((l) => <p key={l} className="m-0 text-xs text-foreground">{l}</p>)}
          <p className="m-0 text-xs text-muted-foreground">{W.dialNote(view.farOff.pct)}</p>
        </div>
      ) : null}
      <p className="m-0 text-xs text-muted-foreground">{W.facts}</p>
    </div>
  );
}

/** A line carrying a Treasurer's proposal: as agreed, proposed, the reason, the reply, and whether it is confirmed. */
export function AdjustBreakdown({ adjust, currency }: { adjust: LineAdjust; currency: string | null }) {
  const W = ACCOMPLISHED_WORDS;
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground" data-testid="line-adjust">
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt>{W.base}</dt>
        <dd className="m-0 text-right text-foreground"><Amount minor={adjust.baseMinor} currency={currency} /></dd>
        <dt>{W.proposed}</dt>
        <dd className="m-0 text-right font-semibold text-foreground"><Amount minor={adjust.adjustedMinor} currency={currency} /></dd>
      </dl>
      <p className="m-0"><span className="font-medium text-foreground">{W.reasonLabel}:</span> {adjust.reason}</p>
      {adjust.reply ? <p className="m-0"><span className="font-medium text-foreground">{W.replyShown}:</span> {adjust.reply}</p> : null}
      <p className="m-0">{adjust.confirmedAt ? W.confirmed : W.waiting}</p>
    </div>
  );
}

/** "1,200.50" in a currency to minor units, or null when it is not a figure. */
export function minorOf(figure: string, currency: string): number | null {
  const t = figure.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const exp = exponentOf(currency);
  const [whole, frac = ""] = t.split(".");
  if (frac.length > exp) return null;
  return Number(whole) * 10 ** exp + Number((frac + "0".repeat(exp)).slice(0, exp) || "0");
}

/** The Treasurer's form: one pay line, an amount, a reason. Sends it back to the member to read and reply. */
export function ProposeAmount({ invoiceId, lines, init, onDone }: { invoiceId: string; lines: readonly InvoiceLine[]; init: RequestInit; onDone: () => Promise<unknown> }) {
  const W = ACCOMPLISHED_WORDS;
  const payLines = lines.filter(adjustableLine);
  const [open, setOpen] = useState(false);
  const [app, setApp] = useState(payLines[0]?.applicationId ?? "");
  const [figure, setFigure] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  // An amount that is not a figure is the amount field's own error, tied to it (a11y P2-15).
  const [amountBad, setAmountBad] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  // Opening the form moves focus to the amount, so it never drops to the page (a11y P2-15).
  useEffect(() => {
    if (open) amountRef.current?.focus();
  }, [open]);
  if (payLines.length === 0) return null;
  const line = payLines.find((l) => l.applicationId === app) ?? payLines[0];
  const send = async (withdraw: boolean) => {
    setError(null);
    setAmountBad(false);
    const amountMinor = withdraw ? null : minorOf(figure, line.currency as string);
    if (!withdraw && amountMinor === null) {
      setAmountBad(true);
      setError(W.amount);
      amountRef.current?.focus();
      return;
    }
    const r = await api.adjustPay(invoiceId, { applicationId: line.applicationId, amountMinor, reason: reason.trim() }, init);
    if (!r.ok) return setError(r.error);
    await onDone();
  };
  if (!open) return <button type="button" className={`${SMALL_BTN} self-start`} onClick={() => setOpen(true)}>{W.propose}</button>;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-2" data-testid="propose-amount">
      {payLines.length > 1 ? (
        <label className={LABEL}>
          {W.agreed}
          <select value={line.applicationId} onChange={(e) => setApp(e.target.value)} className={INPUT}>
            {payLines.map((l) => <option key={l.applicationId} value={l.applicationId}>{l.roleNames.join(", ")}</option>)}
          </select>
        </label>
      ) : <p className="m-0 text-sm font-medium text-foreground">{line.roleNames.join(", ")}</p>}
      <label className={LABEL}>
        {W.amount} ({line.currency})
        <input
          ref={amountRef}
          inputMode="decimal"
          value={figure}
          onChange={(e) => setFigure(e.target.value)}
          className={INPUT}
          aria-invalid={amountBad || undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </label>
      <label className={LABEL}>
        {W.reason}
        <textarea value={reason} rows={2} maxLength={500} onChange={(e) => setReason(e.target.value)} className={INPUT} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={SMALL_BTN} disabled={!reason.trim() || !figure.trim()} onClick={() => void send(false)}>{W.send}</button>
        {line.adjust ? <button type="button" className={SMALL_BTN} disabled={!reason.trim()} onClick={() => void send(true)}>{W.withdraw}</button> : null}
      </div>
      {error ? <p id={errorId} role="alert" className={ERROR}>{error}</p> : null}
    </div>
  );
}
