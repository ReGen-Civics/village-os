import { useEffect, useState } from "react";
import { BTN_PRIMARY, CARD, EYEBROW, LEDE, RING, TILE } from "@/components/journey/look";
import {
  DollarSign,
  Shield,
  Percent,
  Calendar,
  ArrowRight,
  Info,
  Wallet,
} from "lucide-react";
import { MushroomNetwork, Pines } from "@/components/sacred/living";
import { Trans } from "@lingui/react/macro";

interface SummaryDetail {
  id: string;
  label: string;
  value: string;
  note: string;
  icon: string;
}

interface InvestorSummaryData {
  headline: string;
  intro: string;
  details: SummaryDetail[];
  disclaimer: string;
  cta_label: string;
  cta_url: string;
}

// `wallet` says "an amount" in no currency, the way the Visit page's cost line
// does; the starter summary uses it. `dollar` stays for a village that chose it.
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  wallet: Wallet,
  dollar: DollarSign,
  shield: Shield,
  "trending-up": Pines,
  percent: Percent,
  calendar: Calendar,
  "arrow-right": ArrowRight,
  users: MushroomNetwork,
};

export default function InvestorSummary() {
  const [data, setData] = useState<InvestorSummaryData | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/investor-summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setData(d); })
      .catch(() => { /* ignore */ });
    return () => { alive = false; };
  }, []);

  if (!data) return null;

  /*
   * THE NIGHT WORLD'S TOKENS (investor remake, 24 Nov 2026). This band was a
   * brand-teal block with white ink, the only one of its kind on the page.
   * It sits on /investor inside the sheet's world, so it takes the semantic
   * tokens (docs/DESIGN_RULE.md): a panel, tiles, gold rings, and the
   * village's own words exactly as before.
   */
  return (
    <section className="py-12 sm:py-16">
      <div className="container">
        <div className={CARD}>
          <div className="mb-8 max-w-2xl">
            <p className={`${EYEBROW} mb-3`}>
              <Trans context="InvestorSummary, p">Investment Summary
            </Trans></p>
            <h2 className="mb-3 font-display text-3xl leading-tight text-card-foreground sm:text-4xl break-words">
              {data.headline}
            </h2>
            <p className={LEDE}>{data.intro}</p>
          </div>

          <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.details.map((d) => {
              const Icon = ICONS[d.icon] ?? Info;
              const placeholder = d.value === "To be confirmed";
              return (
                <div key={d.id} className={`${TILE} min-w-0`}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className={`${RING} size-9`} aria-hidden="true">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground break-words">
                      {d.label}
                    </span>
                  </div>
                  {/* A pending value stays italic but not faded - italics carry
                      the "to be confirmed" meaning without costing contrast. */}
                  <div className={`mb-2 font-display text-xl text-foreground break-words ${placeholder ? "italic" : ""}`}>
                    {d.value}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground break-words">{d.note}</p>
                </div>
              );
            })}
          </div>

          {data.cta_url && data.cta_label && (
            <div className="mb-8">
              <a href={data.cta_url} className={BTN_PRIMARY}>
                {data.cta_label}
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          )}

          {data.disclaimer && (
            <p className="border-t border-border/60 pt-5 text-xs leading-relaxed text-muted-foreground">
              {data.disclaimer}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
