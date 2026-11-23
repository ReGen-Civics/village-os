/**
 * THE PAY SPLIT, SMALL (the lead, 23 Nov 2026): on a closed role card, in place of the "Open paid role ·" line, the
 * card's pay mix as a thin stacked bar with a one-line legend, "60% cash · 40% Amora tokens · 0% Village Credits, not
 * in use yet". Cash and the contribution token draw a segment only above 0%. The credits share always shows (the lead,
 * the same day: it points to the future): at 0% it has no segment, an empty ring in the legend and the words "not in
 * use yet", as the opened card's tiles still show a 0% share. No amounts, ever.
 *
 * The shares are the ones the opened card's "How compensation works" piece shows (`cardPay`: the card's own shape,
 * else the village's default), with the village's own token names (frontWords.ts `payMixParts`). Each part keeps one
 * colour wherever it is drawn: cash the real-money green, the contribution token gold, credits the sheet's accent.
 * The bar is decoration; the legend carries the words a screen reader hears.
 */
import { useLingui } from "@lingui/react/macro";
import { CreditsWord } from "@/components/ContributionWord";
import type { ShareNames } from "@shared/contributionToken";
import type { PayShare } from "@shared/roleCardSections";
import { noMixWords, payMixParts, type MixPart } from "./frontWords";

/** Each part's colour, as a class; a share the card names in its own words takes the next in turn. */
const PART_FILL: Record<Exclude<MixPart["part"], "named">, string> = { cash: "bg-dash-cash", equity: "bg-dash-gold", credits: "bg-notice" };
const NAMED_FILLS = ["bg-dash-cash", "bg-dash-gold", "bg-notice", "bg-muted-foreground"];

export function fillOf(p: MixPart, i: number): string {
  return p.part === "named" ? NAMED_FILLS[i % NAMED_FILLS.length] : PART_FILL[p.part];
}

export default function PaySplitMini({ shape, names, className = "" }: { shape: readonly PayShare[]; names: ShareNames; className?: string }) {
  const { t, i18n } = useLingui();
  const parts = payMixParts(i18n, shape, names, { withCredits: true });
  if (parts.length === 0) {
    return (
      <p className={`text-sm text-card-foreground ${className}`} data-pay-split-mini="" data-pay-split-words="">
        {noMixWords(i18n)}
      </p>
    );
  }
  const total = parts.reduce((n, p) => n + p.pct, 0) || 1;
  const drawn = parts.filter((p) => p.pct > 0);
  return (
    <div className={`grid max-w-sm gap-1.5 ${className}`} data-pay-split-mini="">
      <span className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {drawn.map((p, i) => (
          <span key={`${p.part}-${i}`} className={`block h-full ${fillOf(p, parts.indexOf(p))}`} style={{ width: `${(p.pct / total) * 100}%` }} data-pay-segment={p.part} />
        ))}
      </span>
      <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-card-foreground" data-pay-split-words="">
        {parts.map((p, i) => (
          <span key={`${p.part}-${i}`} className="inline-flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-muted-foreground" aria-hidden="true">
                ·
              </span>
            )}
            {p.pct > 0 ? <span className={`size-2 shrink-0 rounded-full ${fillOf(p, i)}`} aria-hidden="true" /> : <span className="size-2 shrink-0 rounded-full border border-muted-foreground" aria-hidden="true" />}
            {p.pct > 0 ? (
              p.words
            ) : (
              // A 0% credits share: said, quietly, with the credits token's tip, and that it is not in use yet.
              <span className="text-muted-foreground" data-pay-share-zero={p.part}>
                <CreditsWord>{p.words}</CreditsWord>
                {t({ message: ", not in use yet", context: "role card front: after a 0% credits share in the pay split" })}
              </span>
            )}
          </span>
        ))}
      </p>
    </div>
  );
}
