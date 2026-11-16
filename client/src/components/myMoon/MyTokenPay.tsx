/**
 * MY TOKEN PAY, on the member's own moon page (Rye, 15 Nov 2026). The Earned
 * Equity and Credits each End of Moon approval owes them, the bonus on the
 * pay, with where each line stands: waiting for the Treasurer's approval,
 * approved and issuing at launch, or issued to their account.
 *
 * When a Treasurer or founder changed a line, the member reads the new amount
 * and why, and can answer once; whoever changed it is told
 * (`POST /api/me/moon/rewards/reply`). The contract is shared/moonRewardReview.ts.
 *
 * Draws nothing while the member has no token pay, and nothing at all while
 * the module is off.
 */
import { useCallback, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { PAY_BOARD_ROUTES, type PayBoardTokenLine, type TokenLineStatus } from "@shared/moonRewardReview";
import * as api from "./moonApi";
import { ERROR, INPUT, LABEL, MUTED, SMALL_BTN } from "./moonUi";
import { useTokenName } from "./PayBoard";

const count = (n: number) => n.toLocaleString();

function useMineWords(): Record<TokenLineStatus, string> {
  const { t } = useLingui();
  return {
    waiting: t({ message: "Waiting for the Treasurer's approval", context: "my token pay" }),
    issues_at_launch: t({ message: "Approved, issues to your account at launch", context: "my token pay" }),
    approved: t({ message: "Approved, issuing to your account", context: "my token pay" }),
    issued: t({ message: "Issued to your account", context: "my token pay" }),
    refused: t({ message: "Could not issue yet. The Treasurer can see why.", context: "my token pay" }),
  };
}

function Reply({ line, onDone }: { line: PayBoardTokenLine; onDone: () => Promise<unknown> }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setError(null);
    const r = await api.call<{ key: string }>(PAY_BOARD_ROUTES.reply, "POST", { key: line.key, text: text.trim() });
    if (!r.ok) return setError(r.error);
    setText("");
    await onDone();
  };
  return (
    <div className="flex flex-col gap-2">
      <label className={LABEL}>
        <Trans>Your answer</Trans>
        <textarea value={text} rows={2} maxLength={1000} onChange={(e) => setText(e.target.value)} className={INPUT} />
      </label>
      {error ? <p role="alert" className={ERROR}>{error}</p> : null}
      <button type="button" className={`${SMALL_BTN} self-start`} disabled={!text.trim()} onClick={send}><Trans>Send your answer</Trans></button>
    </div>
  );
}

function Line({ line, onDone }: { line: PayBoardTokenLine; onDone: () => Promise<unknown> }) {
  const words = useMineWords();
  const tokenName = useTokenName();
  const name = tokenName(line.token);
  const units = count(line.units);
  const shared = count(line.sharedUnits);
  const reason = line.change?.reason ?? "";
  const answer = line.memberReply?.text ?? "";
  return (
    <li className="flex flex-col gap-1 border-b border-border py-2 last:border-b-0" data-testid="my-token-line">
      <span className="text-sm text-foreground">{line.title}</span>
      <span className="text-sm font-semibold text-foreground">
        {line.change ? <Trans>{units} {name}, changed from {shared}</Trans> : <>{units} {name}</>}
      </span>
      <span className={`text-xs ${MUTED}`} data-status={line.status}>{words[line.status]}</span>
      {line.change ? <p className="m-0 text-xs text-foreground"><Trans>Why it changed: {reason}</Trans></p> : null}
      {line.change && line.memberReply ? <p className={`m-0 text-xs ${MUTED}`}><Trans>You answered: {answer}</Trans></p> : null}
      {line.change && !line.memberReply && line.status !== "issued" ? <Reply line={line} onDone={onDone} /> : null}
    </li>
  );
}

export default function MyTokenPay() {
  const { t } = useLingui();
  const [lines, setLines] = useState<PayBoardTokenLine[] | null>(null);
  const [launched, setLaunched] = useState(true);
  const load = useCallback(async () => {
    const r = await api.call<{ launched: boolean; lines: PayBoardTokenLine[] }>(PAY_BOARD_ROUTES.mine);
    if (r.ok) {
      setLines(r.data.lines);
      setLaunched(r.data.launched);
    } else setLines([]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!lines || lines.length === 0) return null;
  return (
    <section id="token-pay" aria-label={t`Your token pay`} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <h3 className="m-0 text-lg font-semibold text-foreground"><Trans>Your token pay</Trans></h3>
      <p className={`m-0 ${MUTED}`}>
        {launched
          ? <Trans>The Earned Equity and Credits on your pay. Each line issues to your account once the Treasurer approves it.</Trans>
          : <Trans>The Earned Equity and Credits on your pay. Approved lines issue to your account when the village launches.</Trans>}
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {lines.map((l) => <Line key={l.key} line={l} onDone={load} />)}
      </ul>
    </section>
  );
}
