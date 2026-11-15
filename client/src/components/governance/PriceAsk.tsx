/**
 * THE SUGGESTED PRICE, AND THEIR OWN (Rye, 14 Nov 2026): "with the pay is as a contractor they can suggest
 * a price higher or lower (to be more competitive as a proposal) than the suggested price ... even though
 * our system suggests a price based on their answers in the process but we have that popup where they can
 * make adjustments especially if they made a lot of changes to the role card along the way."
 *
 * The suggestion is the full band times their commitment (shared/commitmentRange.ts). In the popup they
 * may keep it, propose a price higher or lower (above the full band too, with a gentle note), or
 * negotiate on the first call, with an optional line on why. When they suggested changes to the role
 * card, the popup says so and asks how those change the price. The contract decides the amount.
 *
 * THE CAP (Rye, 15 Nov 2026): a proposal goes up to ROLE_PAY_CAP_PCT of the suggested price at their
 * commitment (`capAt`), the full role's cap before they choose one. The popup says so, says why when a
 * price goes above it, and will not save one; the server refuses it too (server/routes/openProposals.ts).
 */
import { useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { askPeriod, capAt, ceilingAt, priceDifferencePct, signedPct, PRICE_WHY_MAX, ROLE_PAY_CAP_PCT, type PayAsk } from "@shared/commitmentRange";
import type { PayCeiling } from "@shared/roleCardSections";
import { moneyWords } from "@shared/roleRewardWords";
import { perPeriod } from "@/components/roleCard/rewardWords";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const FIELD = "w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
const HINT = "text-sm text-muted-foreground";

type Choice = "suggested" | "amount" | "negotiate";

export default function PriceAsk({
  idPrefix,
  ceiling,
  pct,
  value,
  onChange,
  suggestionCount = 0,
}: {
  idPrefix: string;
  ceiling: PayCeiling;
  /** Their chosen commitment, or null before they choose. */
  pct: number | null;
  value: PayAsk | null;
  onChange: (next: PayAsk | null) => void;
  /** How many changes they suggested to the role card (shared/pieceSuggestions.ts). */
  suggestionCount?: number;
}) {
  const { t, i18n } = useLingui();
  const [open, setOpen] = useState(false);
  // Focus goes back to the button that opened the popup (a11y sweep P1-4): the dialog is opened by state, not a trigger.
  const adjustRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    setTimeout(() => adjustRef.current?.focus(), 0);
  };
  const suggested = pct && pct > 0 ? ceilingAt(ceiling.amount, pct) : null;
  const money = (n: number) => moneyWords(n, ceiling.currency, i18n.locale);
  /** "$6,500 a month", in the reader's language and the role's own period. */
  const priced = (n: number, p: PayCeiling["per"] = ceiling.per) => perPeriod(i18n, money(n), p);
  const per = ceiling.per;
  const capPct = pct && pct > 0 ? pct : 100;
  const cap = capAt(ceiling.amount, capPct);
  const capLine = suggested
    ? t({ message: `Proposals up to ${priced(cap)}, ${ROLE_PAY_CAP_PCT}% of the suggested price.`, context: "price ask: the cap on a proposal" })
    : t({ message: `Proposals for the full role go up to ${priced(cap)}.`, context: "price ask: the cap before a commitment is chosen" });

  // The popup's own draft, taken from the saved choice each time it opens.
  const [choice, setChoice] = useState<Choice>("suggested");
  const [amount, setAmount] = useState("");
  const [why, setWhy] = useState("");
  const start = () => {
    setChoice(!value ? "suggested" : value.kind === "negotiate" ? "negotiate" : "amount");
    setAmount(value?.kind === "amount" ? String(value.monthly) : suggested ? String(suggested) : "");
    setWhy(value?.why ?? "");
    setOpen(true);
  };
  const typed = Math.floor(Number(amount) || 0);
  const overCap = choice === "amount" && cap > 0 && typed > cap;
  const diff = suggested && typed > 0 ? priceDifferencePct(suggested, typed) : null;
  const save = () => {
    const w = why.trim().slice(0, PRICE_WHY_MAX);
    const withWhy = w ? { why: w } : {};
    if (choice === "suggested") onChange(null);
    else if (choice === "negotiate") onChange({ kind: "negotiate", ...withWhy });
    else if (typed > 0 && !overCap) onChange({ kind: "amount", monthly: typed, per, ...withWhy });
    close();
  };

  const savedDiff = value?.kind === "amount" && suggested && askPeriod(value) === per ? priceDifferencePct(suggested, value.monthly) : null;
  const summary = !value
    ? suggested
      ? t({ message: "You'll take the suggested price.", context: "price ask summary" })
      : null
    : value.kind === "negotiate"
      ? t({ message: "Negotiate on the first call if chosen.", context: "price ask summary" })
      : t({ message: `You propose ${priced(value.monthly, askPeriod(value))}${savedDiff !== null ? ` (${signedPct(savedDiff)} on the suggestion)` : ""}.`, context: "price ask summary" });

  return (
    <div className="mt-4 grid gap-2 border-t border-border pt-3" data-price-ask="">
      <p className="text-sm font-semibold text-foreground">{t({ message: "Your price", context: "price ask heading" })}</p>
      {suggested ? (
        <p className="text-foreground" data-suggested-price="">
          {t({ message: `Suggested: ${priced(suggested)}, from your commitment of ${pct}%.`, context: "price ask: the suggested price" })}
        </p>
      ) : (
        <p className={HINT}>{t({ message: "Choose your commitment to see a suggested price.", context: "price ask" })}</p>
      )}
      {cap > 0 && (
        <p className={HINT} data-price-cap="">
          {capLine}
        </p>
      )}
      <p className={HINT}>{t({ message: "Your first month starts lower and follows what you deliver.", context: "price ask: the first month" })}</p>
      {summary && (
        <p className="font-medium text-foreground" data-price-summary="">
          {summary}
        </p>
      )}
      <button
        ref={adjustRef}
        type="button"
        onClick={start}
        className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-xl border border-notice px-4 font-semibold text-foreground hover:bg-notice/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        data-adjust-price=""
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {t({ message: "Adjust the price", context: "price ask: open the popup" })}
      </button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent
          className="max-w-lg"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            adjustRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t({ message: "Your price", context: "price popup title" })}</DialogTitle>
            <DialogDescription>
              {suggested
                ? t({ message: `We suggest ${priced(suggested)} at ${pct}%. Your proposal sets your pay: propose more or less, and we agree it together in your first month's contract.`, context: "price popup lede" })
                : t({ message: "Your proposal sets your pay: propose your own price, and we agree it together in your first month's contract.", context: "price popup lede" })}
            </DialogDescription>
          </DialogHeader>
          {cap > 0 && (
            <p className={HINT} data-price-popup-cap="">
              {capLine}
            </p>
          )}
          <fieldset className="grid gap-2" data-price-popup="">
            <legend className="sr-only">{t({ message: "Your price", context: "price popup" })}</legend>
            {suggested && (
              <label className="flex min-h-11 items-center gap-2 text-foreground">
                <input type="radio" name={`${idPrefix}-price`} className="size-5 accent-notice" checked={choice === "suggested"} onChange={() => setChoice("suggested")} />
                {t({ message: `Take the suggested price, ${priced(suggested)}`, context: "price popup choice" })}
              </label>
            )}
            <label className="flex min-h-11 items-center gap-2 text-foreground">
              <input type="radio" name={`${idPrefix}-price`} className="size-5 accent-notice" checked={choice === "amount"} onChange={() => setChoice("amount")} />
              {t({ message: "Propose my own price", context: "price popup choice" })}
            </label>
            {choice === "amount" && (
              <div className="grid gap-1 pl-7">
                <input
                  id={`${idPrefix}-price-amount`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={cap > 0 ? cap : undefined}
                  step={100}
                  aria-label={t({ message: `Your monthly price, in ${ceiling.currency}`, context: "price popup" })}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`${FIELD} min-h-11 sm:max-w-xs`}
                  data-price-amount=""
                />
                {diff !== null && (
                  <p className={HINT} aria-live="polite" data-price-diff="">
                    {t({ message: `${signedPct(diff)} on the suggested price`, context: "price popup: the difference" })}
                  </p>
                )}
                {overCap ? (
                  <p id={`${idPrefix}-price-over-cap`} className="text-sm font-medium text-foreground" role="alert" data-price-over-cap="">
                    {t({ message: `That's above ${priced(cap)}, the most a proposal can ask at ${capPct}%: ${ROLE_PAY_CAP_PCT}% of the suggested price. Choose ${priced(cap)} or less.`, context: "price popup: above the cap" })}
                  </p>
                ) : typed > ceiling.amount && (
                  <p className="text-sm text-foreground" data-price-above-band="">
                    {t({ message: `That's above ${priced(ceiling.amount)}, the most for the full role. You can still propose it.`, context: "price popup: above the full band" })}
                  </p>
                )}
              </div>
            )}
            <label className="flex min-h-11 items-center gap-2 text-foreground">
              <input type="radio" name={`${idPrefix}-price`} className="size-5 accent-notice" checked={choice === "negotiate"} onChange={() => setChoice("negotiate")} />
              {t({ message: "Negotiate on the first call if chosen", context: "price popup choice" })}
            </label>
          </fieldset>
          {choice !== "suggested" && (
            <div className="grid gap-1">
              <label htmlFor={`${idPrefix}-price-why`} className="text-sm font-semibold text-foreground">
                {t({ message: "Why this price (optional)", context: "price popup" })}
              </label>
              {suggestionCount > 0 && (
                <p className={HINT} data-price-nudge="">
                  {suggestionCount === 1
                    ? t({ message: "You suggested 1 change to the role. If it changes the work, say how it changes the price.", context: "price popup nudge, one" })
                    : t({ message: `You suggested ${suggestionCount} changes to the role. If they change the work, say how they change the price.`, context: "price popup nudge, several" })}
                </p>
              )}
              <textarea id={`${idPrefix}-price-why`} rows={3} maxLength={PRICE_WHY_MAX} value={why} onChange={(e) => setWhy(e.target.value)} className={FIELD} />
            </div>
          )}
          {choice === "amount" && typed <= 0 && (
            <p id={`${idPrefix}-price-why-off`} className={HINT} data-price-needs-amount="">
              {t({ message: `Enter a price above ${money(0)}.`, context: "price popup: why Use this price is off" })}
            </p>
          )}
          <DialogFooter>
            <button type="button" onClick={close} className="min-h-11 rounded-lg px-4 text-muted-foreground hover:text-foreground">
              {t({ message: "Cancel", context: "price popup" })}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={choice === "amount" && (typed <= 0 || overCap)}
              aria-describedby={choice === "amount" && typed <= 0 ? `${idPrefix}-price-why-off` : overCap ? `${idPrefix}-price-over-cap` : undefined}
              className="min-h-11 rounded-lg border border-notice bg-notice px-4 font-semibold text-background disabled:opacity-40"
              data-save-price=""
            >
              {t({ message: "Use this price", context: "price popup" })}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
