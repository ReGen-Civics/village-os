/**
 * WHAT THEY PROPOSE TO GIVE, AND WHAT IT WOULD COVER (Rye, 14 Nov 2026), on the page the people deciding
 * read: the commitment, what the role pays at it, their optional ask (or "negotiate on the first call"),
 * and plain arithmetic of how full each role is now and would be with this application.
 *
 * Facts side by side. Nothing ranks, scores or picks anyone (standing ruling), and the contract sets the
 * pay.
 */
import { useLingui } from "@lingui/react/macro";
import { askPeriod, priceDifferencePct, signedPct, type PayAsk } from "@shared/commitmentRange";
import type { PayCeiling } from "@shared/roleCardSections";
import { moneyWords } from "@shared/roleRewardWords";
import { perPeriod } from "@/components/roleCard/rewardWords";

export interface CommitmentReviewData {
  pct: number | null;
  ask: PayAsk | null;
  /** How many changes they suggested to the role card. */
  suggestionCount?: number;
  roles: Array<{ roleId: string; full: PayCeiling | null; atCommitment: number | null; heldPct: number; targetPct: number; withThisPct: number }>;
}

export default function CommitmentReview({ data, roles }: { data: CommitmentReviewData | null | undefined; roles: Array<{ id: string; name: string | null }> }) {
  const { t, i18n } = useLingui();
  const money = (n: number, currency: string) => moneyWords(n, currency, i18n.locale);
  const priced = (n: number, currency: string, per: PayCeiling["per"]) => perPeriod(i18n, money(n, currency), per);
  if (!data) return null;
  const several = data.roles.length > 1;
  const askWords = !data.ask
    ? t({ message: "No ask given", context: "open proposal: the pay ask" })
    : data.ask.kind === "negotiate"
      ? t({ message: "Negotiate on the first call if chosen", context: "open proposal: the pay ask" })
      : null;
  return (
    <section aria-labelledby="op-commitment" className="grid gap-3 rounded-xl border border-border bg-card p-4" data-testid="commitment-review">
      <h2 id="op-commitment" className="text-lg font-bold text-foreground">
        {t({ message: "Commitment and pay", context: "open proposal: commitment heading" })}
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-semibold text-muted-foreground">{t({ message: "They propose", context: "open proposal: commitment" })}</dt>
          <dd className="mt-0.5 font-display text-2xl text-foreground" data-commitment-pct="">{data.pct !== null ? `${data.pct}%` : t({ message: "Not chosen", context: "open proposal: commitment" })}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-muted-foreground">{t({ message: "Their price", context: "open proposal: the pay ask" })}</dt>
          <dd className="mt-0.5 text-foreground" data-pay-ask-shown="">
            {askWords ??
              (data.ask?.kind === "amount" ? priced(data.ask.monthly, data.roles.find((r) => r.full)?.full?.currency ?? "USD", askPeriod(data.ask)) : "")}
          </dd>
        </div>
      </dl>
      {data.ask?.why && (
        <div data-price-why="">
          <p className="text-sm font-semibold text-muted-foreground">{t({ message: "Why this price", context: "open proposal: the pay ask" })}</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground">{data.ask.why}</p>
        </div>
      )}
      {(data.suggestionCount ?? 0) > 0 && (
        <p className="text-sm text-muted-foreground" data-suggestion-count="">
          {data.suggestionCount === 1
            ? t({ message: "They suggested 1 change to the role card.", context: "open proposal: suggestions count, one" })
            : t({ message: `They suggested ${data.suggestionCount} changes to the role card.`, context: "open proposal: suggestions count, several" })}
        </p>
      )}
      <ul className="grid gap-2">
        {data.roles.map((r) => {
          const name = roles.find((x) => x.id === r.roleId)?.name ?? r.roleId;
          return (
            <li key={r.roleId} className="rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground" data-commitment-role={r.roleId}>
              {several && <p className="font-semibold">{name}</p>}
              {r.full && r.atCommitment !== null && (
                <p data-commitment-ceiling="">
                  {t({ message: `At ${data.pct}%, the role pays up to ${priced(r.atCommitment, r.full.currency, r.full.per)} (the full role: ${money(r.full.amount, r.full.currency)}).`, context: "open proposal: the ceiling at their commitment" })}
                </p>
              )}
              {(() => {
                // Suggested against proposed, for THIS role (QA F7): plain numbers, nothing judges the price. Only in the
                // same period, and only with a suggestion above 0, so a missing figure never reads as "0%".
                const ask = data.ask;
                if (!r.full || !r.atCommitment || ask?.kind !== "amount" || askPeriod(ask) !== r.full.per) return null;
                const diff = priceDifferencePct(r.atCommitment, ask.monthly);
                return (
                  <p data-price-compare="">
                    {t({ message: `Suggested ${priced(r.atCommitment, r.full.currency, r.full.per)}; they propose ${money(ask.monthly, r.full.currency)}${diff !== null ? ` (${signedPct(diff)})` : ""}.${ask.monthly > r.full.amount ? ` That is above ${money(r.full.amount, r.full.currency)}, the most for the full role.` : ""}`, context: "open proposal: suggested and proposed price" })}
                  </p>
                );
              })()}
              <p data-commitment-coverage="">
                {t({ message: `Held now: ${r.heldPct}% of ${r.targetPct}%. With this application: ${r.withThisPct}% of ${r.targetPct}%.`, context: "open proposal: how full the role would be" })}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{t({ message: "The contract sets the pay. As a contractor they may propose more or less than the suggested price.", context: "open proposal: commitment footnote" })}</p>
    </section>
  );
}
