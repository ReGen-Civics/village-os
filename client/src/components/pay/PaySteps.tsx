/**
 * The four steps of paying somebody: who, how much, check it, done.
 *
 * Each step is a plain component the page (client/src/pages/Pay.tsx) swaps,
 * and each takes only what it draws, so the page owns every request and every
 * piece of state. The pad works in credits; the member's own currency is shown
 * beside every amount (payMoney.ts says where that figure comes from).
 */
import { useEffect } from "react";
import { useLingui } from "@lingui/react/macro";
import { ArrowLeft, Delete, ScanLine } from "lucide-react";
import { PAY_NOTE_MAX, PAYEE_KINDS, type Payee, type PayeeKind } from "@shared/payLink";
import { BTN_PRIMARY, BTN_SECONDARY, CARD_FEATURED, EYEBROW, FIELD, HINT, LABEL, QUIET, RING, STATEMENT, TILE } from "@/components/journey/look";
import { amountProblem, creditsWords, initialsOf, moneyBeside, type PayToken } from "./payMoney";

/** What a money figure needs to be drawn. */
export interface MoneyContext {
  target: string | null;
  rates: Record<string, number> | null;
  locale: string;
}

/** The round tile that stands for a person or a venture. */
export function PayeeMark({ payee, size = "md" }: { payee: Payee; size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-14 text-lg" : "size-11 text-sm";
  return (
    <span aria-hidden="true" className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full border-2 border-notice font-semibold text-notice`}>
      {initialsOf(payee.name)}
    </span>
  );
}

/** One line under a name: the handle for a member, the word for a venture. */
function PayeeSub({ payee }: { payee: Payee }) {
  const { t } = useLingui();
  const kindWord: Record<PayeeKind, string> = {
    member: payee.handle ? `@${payee.handle}` : t({ context: "pay page, who a payment goes to", message: "Member" }),
    org: t({ context: "pay page, who a payment goes to", message: "Venture" }),
  };
  return <span className="block truncate text-sm text-muted-foreground">{kindWord[payee.kind]}</span>;
}

/** A credit amount and, beside it, the same value in the member's currency. */
export function AmountLine({ minor, token, money, big = false }: { minor: number; token: PayToken; money: MoneyContext; big?: boolean }) {
  const { t } = useLingui();
  const beside = moneyBeside(minor, token, money.target, money.rates, money.locale);
  const credits = creditsWords(minor, token.decimals, money.locale);
  const name = token.name;
  const aboutText = beside?.text ?? "";
  return (
    <span className="block">
      <span className={big ? "block font-display text-5xl leading-none text-card-foreground sm:text-6xl" : "font-semibold text-card-foreground"}>
        {credits}
      </span>
      <span className={big ? "mt-2 block text-base text-muted-foreground" : "text-muted-foreground"}>
        {big ? name : ` ${name}`}
        {beside && (
          <span className="text-notice">
            {" · "}
            {beside.converted ? t({ context: "pay page, an amount converted into the reader's currency", message: `about ${aboutText}` }) : aboutText}
          </span>
        )}
      </span>
    </span>
  );
}

/** Step one: choose who. Search, recent people, or a code or link. */
export function WhoStep({
  query,
  onQuery,
  results,
  searching,
  searchProblem,
  recent,
  onPick,
  onScan,
}: {
  query: string;
  onQuery: (q: string) => void;
  results: Payee[];
  searching: boolean;
  searchProblem: string | null;
  recent: Payee[];
  onPick: (p: Payee) => void;
  onScan: () => void;
}) {
  const { t } = useLingui();
  const typedEnough = query.replace(/^@+/, "").trim().length >= 2;
  const grouped = PAYEE_KINDS.map((kind) => ({ kind, people: results.filter((p) => p.kind === kind) })).filter((g) => g.people.length);
  const groupWord: Record<PayeeKind, string> = {
    member: t({ context: "pay page, search results heading", message: "Members" }),
    org: t({ context: "pay page, search results heading", message: "Ventures" }),
  };
  return (
    <div className="space-y-6">
      {recent.length > 0 && (
        <div>
          <p className={LABEL}>{t({ context: "pay page", message: "Paid lately" })}</p>
          <ul className="-mx-1 mt-2 flex gap-3 overflow-x-auto px-1 pb-2">
            {recent.map((p) => (
              <li key={`${p.kind}:${p.id}`} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="jw-btn flex w-20 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center hover:bg-muted"
                >
                  <PayeeMark payee={p} size="lg" />
                  <span className="w-full truncate text-xs font-medium text-foreground">{p.name.split(/\s+/)[0]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <label className="block space-y-1">
        <span className={LABEL}>{t({ context: "pay page", message: "Who are you paying?" })}</span>
        <input
          className={`${FIELD} min-h-12 text-base`}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t({ context: "pay page, search field", message: "@handle or name" })}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
        />
      </label>
      {searchProblem && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {searchProblem}
        </p>
      )}
      {typedEnough && !searching && !searchProblem && results.length === 0 && (
        <p className={HINT}>{t({ context: "pay page, search", message: "Nobody by that name or handle. Ask for their link or code." })}</p>
      )}
      {grouped.map((g) => (
        <div key={g.kind}>
          {grouped.length > 1 && <p className={EYEBROW}>{groupWord[g.kind]}</p>}
          <ul className="mt-2 space-y-2">
            {g.people.map((p) => (
              <li key={`${p.kind}:${p.id}`}>
                <button type="button" onClick={() => onPick(p)} className={`jw-btn flex w-full min-h-11 items-center gap-3 text-left hover:border-notice ${TILE}`}>
                  <PayeeMark payee={p} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{p.name}</span>
                    <PayeeSub payee={p} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <button type="button" onClick={onScan} className={`${BTN_SECONDARY} w-full sm:w-auto`}>
        <ScanLine className="h-4 w-4" aria-hidden="true" />
        {t({ context: "pay page, button", message: "Scan a code or open a link" })}
      </button>
    </div>
  );
}

/** The person being paid, with a way back to choose somebody else. */
function PayingStrip({ payee, onChange }: { payee: Payee; onChange: () => void }) {
  const { t } = useLingui();
  return (
    <div className={`flex items-center gap-3 ${QUIET}`}>
      <PayeeMark payee={payee} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{payee.name}</span>
        <PayeeSub payee={payee} />
      </span>
      <button type="button" onClick={onChange} className={BTN_SECONDARY}>
        {t({ context: "pay page, button: choose somebody else", message: "Change" })}
      </button>
    </div>
  );
}

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

/** Step two: how much, on a pad that works in credits. */
export function AmountStep({
  payee,
  token,
  typed,
  minor,
  note,
  onKey,
  onNote,
  onNext,
  onChangePayee,
  money,
}: {
  payee: Payee;
  token: PayToken;
  typed: string;
  minor: number;
  note: string;
  onKey: (key: string) => void;
  onNote: (n: string) => void;
  onNext: () => void;
  onChangePayee: () => void;
  money: MoneyContext;
}) {
  const { t } = useLingui();
  const problem = amountProblem(minor, token.balance);
  const heldText = creditsWords(token.balance, token.decimals, money.locale);
  const tokenName = token.name;

  // A desktop has a keyboard: digits, a point or comma, Backspace and Enter work on the pad.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (/^\d$/.test(e.key)) onKey(e.key);
      else if (e.key === "." || e.key === ",") onKey(".");
      else if (e.key === "Backspace") onKey("back");
      else if (e.key === "Enter" && !problem) onNext();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKey, onNext, problem]);

  return (
    <div className="space-y-5">
      <PayingStrip payee={payee} onChange={onChangePayee} />
      <div className="py-2 text-center" aria-live="polite">
        <AmountLine minor={minor} token={token} money={money} big />
        {typed === "" && <span className="sr-only">{t({ context: "pay page", message: "No amount yet" })}</span>}
      </div>
      <p className={`text-center ${problem === "too_much" ? "font-semibold text-destructive" : HINT}`}>
        {problem === "too_much"
          ? t({ context: "pay page, amount pad", message: `That is more than you hold. You hold ${heldText} ${tokenName}.` })
          : t({ context: "pay page, amount pad", message: `You hold ${heldText} ${tokenName}.` })}
      </p>
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-2" role="group" aria-label={t({ context: "pay page", message: "Amount pad" })}>
        {PAD_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onKey(k)}
            disabled={k === "." && token.decimals === 0}
            className="jw-btn flex min-h-14 items-center justify-center rounded-xl border border-border bg-muted font-display text-2xl text-foreground hover:border-notice disabled:opacity-30"
            aria-label={k === "back" ? t({ context: "pay page, amount pad key", message: "Delete the last digit" }) : k === "." ? t({ context: "pay page, amount pad key", message: "Decimal point" }) : k}
          >
            {k === "back" ? <Delete className="h-6 w-6" aria-hidden="true" /> : k}
          </button>
        ))}
      </div>
      <label className="block space-y-1">
        <span className={LABEL}>{t({ context: "pay page", message: "What it is for (optional)" })}</span>
        <input
          className={FIELD}
          value={note}
          maxLength={PAY_NOTE_MAX}
          onChange={(e) => onNote(e.target.value)}
          placeholder={t({ context: "pay page, note field example", message: "Two jars of honey" })}
        />
      </label>
      <div className="sticky bottom-3 z-10 sm:static">
        <button type="button" className={`${BTN_PRIMARY} w-full shadow-sm`} disabled={!!problem} onClick={onNext}>
          {t({ context: "pay page, button: go to the check step", message: "Review" })}
        </button>
      </div>
    </div>
  );
}

/** Step three: everything once more before it moves. */
export function ConfirmStep({
  payee,
  token,
  minor,
  note,
  busy,
  problem,
  onSend,
  onBack,
  money,
}: {
  payee: Payee;
  token: PayToken;
  minor: number;
  note: string;
  busy: boolean;
  problem: string | null;
  onSend: () => void;
  onBack: () => void;
  money: MoneyContext;
}) {
  const { t } = useLingui();
  const left = token.balance - minor;
  const amountText = creditsWords(minor, token.decimals, money.locale);
  const tokenName = token.name;
  const name = payee.name;
  return (
    <div className={`${CARD_FEATURED} space-y-5`}>
      <p className={EYEBROW}>{t({ context: "pay page, check step", message: "Check before you send" })}</p>
      <div className="flex items-center gap-3">
        <PayeeMark payee={payee} size="lg" />
        <span className="min-w-0">
          <span className={`block truncate ${STATEMENT}`}>{name}</span>
          <PayeeSub payee={payee} />
        </span>
      </div>
      <dl className="space-y-3">
        <div className={TILE}>
          <dt className={LABEL}>{t({ context: "pay page, check step", message: "Amount" })}</dt>
          <dd className="mt-1">
            <AmountLine minor={minor} token={token} money={money} />
          </dd>
        </div>
        {note.trim() && (
          <div className={TILE}>
            <dt className={LABEL}>{t({ context: "pay page, check step", message: "What it is for" })}</dt>
            <dd className="mt-1 break-words text-foreground">{note.trim()}</dd>
          </div>
        )}
        <div className={TILE}>
          <dt className={LABEL}>{t({ context: "pay page, check step", message: "Left after this" })}</dt>
          <dd className="mt-1">
            <AmountLine minor={Math.max(0, left)} token={token} money={money} />
          </dd>
        </div>
      </dl>
      {problem && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {problem}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={BTN_SECONDARY} onClick={onBack} disabled={busy}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t({ context: "pay page, button", message: "Back" })}
        </button>
        <button type="button" className={`${BTN_PRIMARY} sm:min-w-56`} onClick={onSend} disabled={busy}>
          {busy
            ? t({ context: "pay page, button while sending", message: "Sending" })
            : t({ context: "pay page, button", message: `Send ${amountText} ${tokenName} to ${name}` })}
        </button>
      </div>
    </div>
  );
}

/** What the server said moved, as the receipt shows it. */
export interface PayReceipt {
  sentMinor: number;
  toName: string;
  balanceMinor: number;
  note: string;
  at: Date;
}

/** Step four: the receipt. */
export function ReceiptStep({
  receipt,
  token,
  money,
  onAgain,
  dateText,
}: {
  receipt: PayReceipt;
  token: PayToken;
  money: MoneyContext;
  onAgain: () => void;
  dateText: string;
}) {
  const { t } = useLingui();
  const toName = receipt.toName;
  return (
    <div className="space-y-5" role="status">
      <div className="flex items-center gap-3">
        <span className={RING} aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <div>
          <p className={EYEBROW}>{t({ context: "pay page, receipt", message: "Sent" })}</p>
          <p className="font-display text-2xl text-card-foreground">{t({ context: "pay page, receipt", message: `Paid to ${toName}` })}</p>
        </div>
      </div>
      <dl className="space-y-3">
        <div className={TILE}>
          <dt className={LABEL}>{t({ context: "pay page, receipt", message: "Amount" })}</dt>
          <dd className="mt-1">
            <AmountLine minor={receipt.sentMinor} token={token} money={money} />
          </dd>
        </div>
        {receipt.note && (
          <div className={TILE}>
            <dt className={LABEL}>{t({ context: "pay page, receipt", message: "What it is for" })}</dt>
            <dd className="mt-1 break-words text-foreground">{receipt.note}</dd>
          </div>
        )}
        <div className={TILE}>
          <dt className={LABEL}>{t({ context: "pay page, receipt", message: "You hold now" })}</dt>
          <dd className="mt-1">
            <AmountLine minor={receipt.balanceMinor} token={token} money={money} />
          </dd>
        </div>
      </dl>
      <p className={HINT}>
        {t({ context: "pay page, receipt", message: `On the village ledger, ${dateText}. Both of you can see it in your history.` })}
      </p>
      <button type="button" className={`${BTN_PRIMARY} w-full sm:w-auto`} onClick={onAgain}>
        {t({ context: "pay page, button", message: "Pay someone else" })}
      </button>
    </div>
  );
}
