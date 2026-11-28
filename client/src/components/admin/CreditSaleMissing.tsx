/**
 * WHY THE CREDIT-SALE CARD IS NOT ON THE LIBRARY SCREEN.
 *
 * The card that opens selling library credits is drawn on the Library tab from
 * the exchange's own read (GET /api/admin/exchange), which answers only while
 * the Exchange module is on. With the Exchange off the card was simply absent,
 * while the module's settings still say the switch "is opened on the Library
 * screen" (ModuleSettingsSection.tsx). A founder following that sentence found
 * nothing, and nothing said why.
 *
 * So the place the card would be says which of two things happened:
 *
 *   exchange-off   the Exchange module is off. Credits are listed and sold on
 *                  the Exchange, so there is no sale to open yet. It says so
 *                  and links the Exchange module's own page, where it is turned on.
 *   unread         the read failed for any other reason. Whether sales are open
 *                  is not known, and it says that, never "closed".
 *
 * No control moved and no permission changed: this is words where there was a gap.
 */
import { Trans } from "@lingui/react/macro";
import { Link } from "wouter";

export type CreditSaleMissingWhy = "exchange-off" | "unread";

/**
 * What the exchange's read said about the credit-sale card: its state, or why
 * there is none. The server answers one body for a module that is off
 * (`requireModule`): 404 with `error: "module_disabled"`.
 */
export async function readCreditSale(res: { ok: boolean; status: number; json: () => Promise<any> }): Promise<any> {
  const body = await res.json().catch(() => null);
  if (res.ok && body?.creditSale) return body.creditSale;
  const why: CreditSaleMissingWhy = res.status === 404 && body?.error === "module_disabled" ? "exchange-off" : "unread";
  return { missing: why };
}

/** The Exchange module's own page, which holds the control that turns it on. */
export const EXCHANGE_MODULE_PAGE = "/modules/exchange";

export default function CreditSaleMissing({ why }: { why: CreditSaleMissingWhy }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground" data-testid="credit-sale-missing">
      {why === "exchange-off" ? (
        <>
          <h3 className="mb-1 font-semibold"><Trans context="CreditSaleMissing, h3">Selling library credits needs the Exchange</Trans></h3>
          <p className="mb-3 text-sm text-muted-foreground">
            <Trans context="CreditSaleMissing, p">Library credits are listed and sold on the Exchange, and the Exchange module is off. Turn it on from its own page, and the caution card that opens credit sales shows here.</Trans>
          </p>
          <Link href={EXCHANGE_MODULE_PAGE} className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground">
            <Trans context="CreditSaleMissing, link">Open the Exchange module</Trans>
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          <Trans context="CreditSaleMissing, p">Whether library credits can be sold did not load. Reload the page to try again.</Trans>
        </p>
      )}
    </div>
  );
}
