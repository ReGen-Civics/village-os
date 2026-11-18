/**
 * THE PAY ADOPTING WRITES (QA-1115 P0-1, 15 Nov 2026), on the page the people deciding read: the figure the
 * contract will record and where it comes from (their ask, the suggested price, or "negotiate on the first
 * call", which records the suggested price until one is agreed). The server works it out
 * (shared/contractPrice.ts); this only says it. A Treasurer confirms every End of Moon line drawn from it.
 */
import { useLingui } from "@lingui/react/macro";
import type { ContractPriceSource } from "@shared/contractPrice";
import { moneyWords } from "@shared/seatSettings";
import { ROLE_PAY_CAP_PCT } from "@shared/rolePayMath";
import { MoonText } from "@/components/MoonWord";

export interface ContractPriceData {
  amountMinor: number;
  currency: string;
  per: "month" | "moon";
  source: ContractPriceSource;
  capped: boolean;
  pct: number;
}

/** `role`: on a proposal naming several roles, the role this agreement is for (the lead, 17 Nov 2026): each is priced on its own. */
export default function ContractPrice({ data, role }: { data: ContractPriceData | null | undefined; role?: string }) {
  const { t, i18n } = useLingui();
  if (data === undefined) return null;
  if (data === null) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground" data-contract-price="none">
        {role ? `${role}: ` : ""}
        {t({ message: "This role lists no price, so adopting records no pay in the contract. A Treasurer writes it.", context: "open proposal: the contract's pay" })}
      </p>
    );
  }
  const money = moneyWords(data.amountMinor, data.currency, i18n.locale);
  const figure = data.per === "month"
    ? t({ message: `${money} a month`, context: "an amount for each month" })
    : t({ message: `${money} a moon`, context: "an amount for each moon" });
  const pct = data.pct;
  const from =
    data.source === "ask"
      ? t({ message: `From their price ask, at ${pct}% commitment.`, context: "open proposal: where the contract's pay comes from" })
      : data.source === "negotiate"
        ? t({ message: `They chose to negotiate on the first call. This is the suggested price at ${pct}% commitment until a price is agreed.`, context: "open proposal: where the contract's pay comes from" })
        : t({ message: `The suggested price: the listed price at ${pct}% commitment.`, context: "open proposal: where the contract's pay comes from" });
  return (
    <section aria-labelledby={role ? undefined : "op-contract-price"} aria-label={role} className="grid gap-1 rounded-xl border border-border bg-card p-4" data-contract-price={data.source}>
      <h2 id={role ? undefined : "op-contract-price"} className="text-lg font-bold text-foreground">
        {role
          ? t({ message: `Pay the contract for ${role} will record`, context: "open proposal: the contract's pay, one of several roles" })
          : t({ message: "Pay the contract will record", context: "open proposal: the contract's pay" })}
      </h2>
      <p className="font-display text-2xl text-foreground" data-contract-price-figure="">
        <MoonText text={figure} />
      </p>
      <p className="text-sm text-muted-foreground">{from}</p>
      {data.capped && (
        <p className="text-sm text-foreground" data-contract-price-capped="">
          {t({ message: `Their ask was above ${ROLE_PAY_CAP_PCT}% of the listed price, so it is held there.`, context: "open proposal: the contract's pay" })}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {t({ message: "A Treasurer confirms each payment drawn from it.", context: "open proposal: the contract's pay" })}
      </p>
    </section>
  );
}
