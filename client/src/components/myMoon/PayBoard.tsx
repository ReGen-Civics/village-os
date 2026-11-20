/**
 * THE TREASURER'S PAY BOARD, inside the admin Cash payouts desk (Rye, 15 Nov
 * 2026: "the treasurer sections shows all the USD pay and if it's been sent
 * out from escrow - but also the token pay and approving or adjusting those
 * numbers"). It loads as its own chunk and reads nothing until opened.
 *
 * Per member, for one month:
 *   - cash: every line, owed, claimed or sent from escrow (with the day, the
 *     reference and who recorded it), and the totals owed against sent. The
 *     transfer itself is recorded on the desk below, as it always was;
 *   - tokens: each Earned Equity and Credits line from End of Moon, the bonus
 *     on the pay. A Treasurer or founder approves it, or changes it up or down
 *     with a reason the member reads and can answer. Before launch an
 *     approved line reads "issues at launch".
 *
 * Nothing here decides permission or proposes an amount. The server's one
 * gate answers who may open it, `rewardApproveRefusal` who may approve, and a
 * refusal draws the server's sentence. The contract is shared/moonRewardReview.ts.
 */
import { useCallback, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { formatMoney } from "@shared/money";
import {
  PAY_BOARD_ROUTES, monthOf, type CashLineStatus, type PayBoard as PayBoardData, type PayBoardCashLine, type PayBoardMember, type PayBoardTokenLine, type TokenLineStatus,
} from "@shared/moonRewardReview";
import * as api from "./moonApi";
import { useShareNames } from "@/components/ContributionWord";
import { ERROR, INPUT, LABEL, MUTED, SMALL_BTN } from "./moonUi";

const CHIP = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";
const CHIP_TONE: Record<CashLineStatus | TokenLineStatus, string> = {
  owed: "border-border text-foreground",
  claimed: "border-border text-foreground",
  sent: "border-border bg-sage-light text-open",
  waiting: "border-border bg-amber-light text-notice",
  issues_at_launch: "border-border bg-muted text-foreground",
  approved: "border-border bg-muted text-foreground",
  issued: "border-border bg-sage-light text-open",
  refused: "border-destructive text-destructive",
};

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
const count = (n: number) => n.toLocaleString();

/** The words for each status, translated. Keyed by the union, so a new status cannot draw an empty chip. */
function useStatusWords(): Record<CashLineStatus | TokenLineStatus, string> {
  const { t } = useLingui();
  return {
    owed: t({ message: "Owed", context: "pay board status" }),
    claimed: t({ message: "Claimed, ready to send", context: "pay board status" }),
    sent: t({ message: "Sent from escrow", context: "pay board status" }),
    waiting: t({ message: "Waiting for approval", context: "pay board status" }),
    issues_at_launch: t({ message: "Approved, issues at launch", context: "pay board status" }),
    approved: t({ message: "Approved, issuing", context: "pay board status" }),
    issued: t({ message: "Issued to their account", context: "pay board status" }),
    refused: t({ message: "Could not issue", context: "pay board status" }),
  };
}

/**
 * A token's name in words: the two End of Moon issues under the village's own words (the contribution token from the
 * vocabulary, never the registry's "Earned Equity", as 1.3.28 set), or its slug.
 */
export function useTokenName(): (slug: string) => string {
  const names = useShareNames();
  return (slug) => (slug === "earned-equity" ? names.equity : slug === "credits" ? names.credits : slug);
}

function StatusChip({ status }: { status: CashLineStatus | TokenLineStatus }) {
  const words = useStatusWords();
  return <span className={`${CHIP} ${CHIP_TONE[status]}`} data-status={status}>{words[status]}</span>;
}

/** Change one token line: the new whole amount and why. */
function ChangeForm({ line, init, onDone }: { line: PayBoardTokenLine; init: RequestInit; onDone: () => Promise<unknown> }) {
  const { t } = useLingui();
  const [units, setUnits] = useState(String(line.units));
  const ceiling = line.ceiling !== null ? count(line.ceiling) : null;
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setError(null);
    setBusy(true);
    const r = await api.call<{ key: string; units: number }>(PAY_BOARD_ROUTES.adjust, "POST", { key: line.key, units: units.trim(), reason: reason.trim() }, init);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    await onDone();
  };
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-2" data-testid="token-change-form">
      <label className={LABEL}>
        {ceiling !== null ? t({ message: `New amount, at most ${ceiling}`, context: "pay board" }) : t({ message: "New amount", context: "pay board" })}
        <input type="number" inputMode="numeric" min={1} max={line.ceiling ?? undefined} step={1} value={units} onChange={(e) => setUnits(e.target.value)} className={INPUT} />
      </label>
      <label className={LABEL}>
        <Trans context="pay board">Why it changed. The member reads this and can answer.</Trans>
        <textarea value={reason} rows={2} maxLength={500} onChange={(e) => setReason(e.target.value)} className={INPUT} />
      </label>
      {error ? <p role="alert" className={ERROR}>{error}</p> : null}
      <button type="button" className={`${SMALL_BTN} self-start`} disabled={busy || !reason.trim()} onClick={save}><Trans context="pay board">Save the change</Trans></button>
    </div>
  );
}

function TokenRow({ line, board, picked, onPick, init, onDone }: {
  line: PayBoardTokenLine;
  board: PayBoardData;
  picked: boolean;
  onPick: (on: boolean) => void;
  init: RequestInit;
  onDone: () => Promise<unknown>;
}) {
  const tokenName = useTokenName();
  const [changing, setChanging] = useState(false);
  const open = line.status === "waiting" || line.status === "issues_at_launch" || line.status === "approved";
  const canReview = board.mayReview && open && line.review !== null;
  const { t } = useLingui();
  const name = tokenName(line.token);
  const units = count(line.units);
  const shared = count(line.sharedUnits);
  const changedBy = line.change?.by ?? t({ message: "a holder", context: "pay board" });
  const reason = line.change?.reason ?? "";
  const answer = line.memberReply?.text ?? "";
  const approvedBy = line.approvedBy ?? "";
  return (
    <li className="flex flex-col gap-1 border-b border-border py-2 last:border-b-0" data-testid="token-line">
      <div className="flex flex-wrap items-start gap-2">
        {canReview && line.status === "waiting" ? (
          <input type="checkbox" className="mt-1" aria-label={`${name}, ${line.title}`} checked={picked} onChange={(e) => onPick(e.target.checked)} />
        ) : null}
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <span className="text-sm text-foreground">{line.title}</span>
          <span className="text-sm font-semibold text-foreground">
            {line.units !== line.sharedUnits ? <Trans context="pay board">{units} {name}, changed from {shared}</Trans> : <>{units} {name}</>}
          </span>
        </div>
        <StatusChip status={line.status} />
      </div>
      {line.change ? (
        <p className={`m-0 text-xs ${MUTED}`}>
          <Trans context="pay board">Changed by {changedBy}: {reason}</Trans>
        </p>
      ) : null}
      {line.memberReply ? <p className="m-0 text-xs text-foreground"><Trans context="pay board">Their answer: {answer}</Trans></p> : null}
      {line.approvedBy ? (
        <p className={`m-0 text-xs ${MUTED}`}>
          {line.approvedAlone ? <Trans context="pay board">Approved by {approvedBy}, who changed it and was the only one who could.</Trans> : <Trans context="pay board">Approved by {approvedBy}.</Trans>}
        </p>
      ) : null}
      {line.refusal ? <p className={`m-0 text-xs ${ERROR}`}>{line.refusal}</p> : null}
      {line.noApprover ? (
        <p className="m-0 text-xs text-notice" data-testid="no-approver">
          <Trans context="pay board">Nobody but this member holds the power to approve it, so it waits. The stewards can seat another Treasurer, or the village can vote one in.</Trans>
        </p>
      ) : null}
      {canReview ? (
        <button type="button" className={`${SMALL_BTN} self-start`} aria-expanded={changing} onClick={() => setChanging((v) => !v)}>
          {changing ? <Trans context="pay board">Keep the amount</Trans> : <Trans context="pay board">Change the amount</Trans>}
        </button>
      ) : null}
      {changing ? <ChangeForm line={line} init={init} onDone={async () => { setChanging(false); await onDone(); }} /> : null}
    </li>
  );
}

/** Where one cash line stands, in words: sent with its day, who recorded it and the reference, or owed since. */
function CashNote({ line }: { line: PayBoardCashLine }) {
  const { t } = useLingui();
  if (line.status === "sent") {
    const when = day(line.sentAt);
    const who = line.sentBy ?? t({ message: "a holder", context: "pay board" });
    const reference = line.reference ?? "";
    return <p className={`m-0 text-xs ${MUTED}`}><Trans context="pay board">Recorded {when} by {who}. {reference}</Trans></p>;
  }
  const since = day(line.owedAt);
  return <p className={`m-0 text-xs ${MUTED}`}><Trans context="pay board">Owed since {since}</Trans></p>;
}

function MemberCard({ m, board, init, reload }: { m: PayBoardMember; board: PayBoardData; init: RequestInit; reload: () => Promise<unknown> }) {
  const { t } = useLingui();
  const tokenName = useTokenName();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const approve = async () => {
    setError(null);
    setDone(null);
    const keys = Array.from(picked);
    const r = await api.call<{ approved: Array<{ key: string; outcome: string; message?: string }> }>(PAY_BOARD_ROUTES.approve, "POST", { keys }, init);
    if (!r.ok) return setError(r.error);
    setPicked(new Set());
    const atLaunch = r.data.approved.filter((a) => a.outcome === "issues_at_launch").length;
    setDone(atLaunch ? t({ message: "Approved. They issue at launch.", context: "pay board" }) : t({ message: "Approved and issued.", context: "pay board" }));
    await reload();
  };
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" data-testid="pay-board-member">
      <h4 className="m-0 text-base font-semibold text-foreground">{m.name || t({ message: "A member", context: "pay board" })}</h4>

      <section aria-label={t({ message: "Cash", context: "pay board" })} className="flex flex-col gap-1">
        <p className="m-0 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Trans context="pay board">Cash</Trans></p>
        {m.cashTotals.map((c) => {
          const owed = formatMoney(c.owedMinor, c.currency);
          const sent = formatMoney(c.sentMinor, c.currency);
          return <p key={c.currency} className="m-0 text-sm text-foreground" data-testid="cash-totals"><Trans context="pay board">Owed {owed}, sent {sent}</Trans></p>;
        })}
        {m.cash.length === 0 ? <p className={MUTED}><Trans context="pay board">No cash this month.</Trans></p> : (
          <ul className="m-0 flex list-none flex-col p-0">
            {m.cash.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 border-b border-border py-2 last:border-b-0" data-testid="cash-line">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-[12rem] flex-1 text-sm text-foreground">{c.title}</span>
                  <span className="text-sm font-semibold text-foreground">{formatMoney(c.amountMinor, c.currency)}</span>
                  <StatusChip status={c.status} />
                </div>
                <CashNote line={c} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t({ message: "Token pay", context: "pay board" })} className="flex flex-col gap-1">
        <p className="m-0 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Trans context="pay board">Token pay, the bonus on the pay</Trans></p>
        {m.tokenTotals.map((tt) => {
          const token = tokenName(tt.token);
          const waiting = count(tt.waiting);
          const approved = count(tt.approved);
          const issued = count(tt.issued);
          return <p key={tt.token} className="m-0 text-sm text-foreground" data-testid="token-totals"><Trans context="pay board">{token}: {waiting} waiting, {approved} approved, {issued} issued</Trans></p>;
        })}
        {m.tokens.length === 0 ? <p className={MUTED}><Trans context="pay board">No token pay this month.</Trans></p> : (
          <ul className="m-0 flex list-none flex-col p-0">
            {m.tokens.map((l) => (
              <TokenRow
                key={l.key}
                line={l}
                board={board}
                picked={picked.has(l.key)}
                onPick={(on) => setPicked((s) => { const n = new Set(s); if (on) n.add(l.key); else n.delete(l.key); return n; })}
                init={init}
                onDone={reload}
              />
            ))}
          </ul>
        )}
        {board.mayReview && m.tokens.some((l) => l.status === "waiting") ? (
          <button type="button" className={`${SMALL_BTN} self-start`} disabled={picked.size === 0} onClick={approve}>
            {board.launched ? <Trans context="pay board">Approve and issue selected</Trans> : <Trans context="pay board">Approve selected</Trans>}
          </button>
        ) : null}
        {error ? <p role="alert" className={ERROR}>{error}</p> : null}
        {done ? <p role="status" className="m-0 text-sm text-foreground">{done}</p> : null}
      </section>
    </li>
  );
}

/** The board itself, for one month. Exported for its test. */
export function PayBoardView({ board, init, reload }: { board: PayBoardData; init: RequestInit; reload: () => Promise<unknown> }) {
  return (
    <div className="flex flex-col gap-3">
      {!board.launched ? (
        <p className={MUTED}><Trans context="pay board">The village has not launched yet. Approved token pay issues to each account at launch.</Trans></p>
      ) : null}
      {board.truncated ? (
        <p role="status" className="m-0 text-sm text-notice"><Trans context="pay board">This month has more pay than one board shows. The first 2,000 lines of each kind are here.</Trans></p>
      ) : null}
      {board.members.length === 0 ? <p className={MUTED}><Trans context="pay board">Nobody was paid this month.</Trans></p> : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {board.members.map((m) => <MemberCard key={m.userId} m={m} board={board} init={init} reload={reload} />)}
        </ul>
      )}
    </div>
  );
}

function PayBoardLoader({ password }: { password: string }) {
  const { t } = useLingui();
  const [month, setMonth] = useState(monthOf(new Date()));
  const [board, setBoard] = useState<PayBoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const init: RequestInit = { headers: { Authorization: `Bearer ${password}` } };
  const load = useCallback(async () => {
    const r = await api.call<PayBoardData>(`${PAY_BOARD_ROUTES.board}?month=${encodeURIComponent(month)}`, "GET", undefined, { headers: { Authorization: `Bearer ${password}` } });
    if (r.ok) {
      setBoard(r.data);
      setError(null);
    } else {
      setBoard(null);
      setError(r.status === 404 ? t({ message: "The End of Moon review is not on in this village.", context: "pay board" }) : r.error);
    }
  }, [password, month, t]);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="flex flex-col gap-3">
      <label className={`${LABEL} max-w-48`}>
        <Trans context="pay board">Month</Trans>
        <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={INPUT} />
      </label>
      {error ? <p role="alert" className={ERROR}>{error}</p> : !board ? <p className={MUTED}><Trans context="pay board">Reading the month's pay.</Trans></p> : <PayBoardView board={board} init={init} reload={load} />}
    </div>
  );
}

/** Closed until opened, so the desk reads no pay it was not asked for. */
export default function PayBoard({ password }: { password: string }) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  return (
    <section id="pay-board" aria-label={t({ message: "Pay by member", context: "pay board" })} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="m-0 text-lg font-semibold text-foreground"><Trans context="pay board">Pay by member</Trans></h3>
          <p className={`m-0 ${MUTED}`}><Trans context="pay board">Each member's cash and token pay for a month: what is owed, what was sent from escrow, and the token pay to approve.</Trans></p>
        </div>
        <button type="button" className={SMALL_BTN} aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? <Trans context="pay board">Close</Trans> : <Trans context="pay board">Open</Trans>}</button>
      </div>
      {open ? <PayBoardLoader password={password} /> : null}
    </section>
  );
}
