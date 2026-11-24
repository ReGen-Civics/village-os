/**
 * Receive: my code, and a request link that fills in my name and, if I want,
 * an amount and what it is for.
 *
 * The code IS the link (shared/payLink.ts), so a phone camera that reads it
 * opens `/pay` with this member already chosen. A phone shares the link
 * through its own share sheet; a desktop copies it (docs/DESIGN_RULE.md, phone
 * and desktop each at its best).
 */
import { useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { amountToMinor, parseAmount, payLinkUrl, PAY_NOTE_MAX, type Payee } from "@shared/payLink";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, EYEBROW, FIELD, H2, HINT, LABEL } from "@/components/journey/look";
import QrCode from "./QrCode";
import { moneyBeside, type PayToken } from "./payMoney";

export default function ReceivePanel({
  me,
  token,
  target,
  rates,
  locale,
  origin,
}: {
  me: Payee;
  token: PayToken | null;
  target: string | null;
  rates: Record<string, number> | null;
  locale: string;
  origin: string;
}) {
  const { t } = useLingui();
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const [said, setSaid] = useState<string | null>(null);
  const amount = parseAmount(typed);
  const link = useMemo(
    () => (me.handle ? payLinkUrl(origin, { to: { kind: "member", ref: me.handle }, amount, note }) : null),
    [origin, me.handle, amount, note],
  );
  const money = amount && token ? moneyBeside(amountToMinor(amount, token.decimals), token, target, rates, locale) : null;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const handle = me.handle ?? "";
  const tokenName = token?.name ?? "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setSaid(t({ context: "pay page, receive", message: "Link copied." }));
    } catch {
      setSaid(t({ context: "pay page, receive", message: "Copying was blocked. Select the link above and copy it." }));
    }
  };
  const share = async () => {
    if (!link) return;
    try {
      await navigator.share({ url: link, title: t({ context: "pay page, receive", message: "Pay me in credits" }) });
    } catch (e) {
      // A share sheet the member closed is not an error; any other refusal still owes them the link.
      if ((e as { name?: string })?.name !== "AbortError") void copy();
    }
  };

  return (
    <section aria-labelledby="receive-h" className={CARD}>
      <p className={EYEBROW}>{t({ context: "pay page, receive", message: "Receive" })}</p>
      <h2 id="receive-h" className={`${H2} mt-1`}>
        {t({ context: "pay page, receive", message: "Your code" })}
      </h2>
      {!link ? (
        <p className={`${HINT} mt-4`}>
          {t({ context: "pay page, receive", message: "Choose a handle on your profile and your code appears here." })}
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="mx-auto w-full max-w-64 sm:max-w-72">
            <QrCode text={link} label={t({ context: "pay page, receive", message: `A code that opens a payment to @${handle}` })} />
          </div>
          <p className="text-center">
            <span className="font-display text-xl text-card-foreground">{me.name}</span>
            <span className="block text-sm text-muted-foreground">@{handle}</span>
          </p>
          {amount && token && (
            <p className="text-center text-sm font-semibold text-notice">
              {t({ context: "pay page, receive, the amount asked", message: `Asking for ${amount} ${tokenName}` })}
              {money ? ` · ${money.text}` : ""}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className={LABEL}>{t({ context: "pay page, receive", message: "Amount, if you like" })}</span>
              <input
                className={FIELD}
                inputMode="decimal"
                value={typed}
                onChange={(e) => setTyped(e.target.value.replace(/[^\d.,]/g, "").slice(0, 10))}
                placeholder="0"
                aria-invalid={!!typed && !amount}
              />
            </label>
            <label className="block space-y-1">
              <span className={LABEL}>{t({ context: "pay page, receive", message: "What it is for" })}</span>
              <input className={FIELD} value={note} maxLength={PAY_NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          <p className="break-all rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" data-pay-link>
            {link}
          </p>
          <div className="flex flex-wrap gap-2">
            {canShare ? (
              <>
                <button type="button" className={`${BTN_PRIMARY} flex-1`} onClick={share}>
                  {t({ context: "pay page, button", message: "Share link" })}
                </button>
                <button type="button" className={BTN_SECONDARY} onClick={copy}>
                  {t({ context: "pay page, button", message: "Copy" })}
                </button>
              </>
            ) : (
              <button type="button" className={`${BTN_PRIMARY} flex-1`} onClick={copy}>
                {t({ context: "pay page, button", message: "Copy link" })}
              </button>
            )}
          </div>
          {said && (
            <p role="status" className={HINT}>
              {said}
            </p>
          )}
          <p className={HINT}>
            {t({ context: "pay page, receive", message: "Anyone here who opens it pays you straight into your credits." })}
          </p>
        </div>
      )}
    </section>
  );
}
