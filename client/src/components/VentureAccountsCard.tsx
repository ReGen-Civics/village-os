/**
 * The ventures you run, and what each one holds (0419, credits lane 1).
 *
 * Members spend credits, and only ventures redeem them (the lead, 23 Nov
 * 2026). A member seated in a venture's role runs that venture, so this card
 * shows them the venture's balance and its payments in and out, on their own
 * Treasury tab beside their wallet.
 *
 * It renders NOTHING when the village has not opened venture accounts
 * (`ledger.org_accounts_open`, off when a village is born) or when the member
 * runs no venture that holds one. Redeeming is a later door (credits lane 2),
 * so this card only reads.
 */
import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Store } from "lucide-react";
import { authToken } from "@/lib/gameApi";
import { useAuth } from "@/contexts/AuthContext";
import { formatTokenGrouped } from "@/lib/tokenAmount";
import type { OrgAccountEntry, OrgAccountView } from "@shared/orgAccounts";
import { CARD, H2, HINT, QUIET, TILE } from "@/components/journey/look";

interface Mine {
  account: OrgAccountView;
  history: OrgAccountEntry[];
}

const headers = (): Record<string, string> => {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export default function VentureAccountsCard() {
  const { user } = useAuth();
  const { t } = useLingui();
  const [mine, setMine] = useState<Mine[]>([]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch("/api/org-accounts/mine", { headers: headers() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setMine(Array.isArray(d?.accounts) ? d.accounts : []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user || mine.length === 0) return null;

  return (
    <section aria-labelledby="ventures-h" className={CARD}>
      <h2 id="ventures-h" className={`${H2} flex items-center gap-2`}>
        <Store className="h-5 w-5 text-notice" aria-hidden="true" />
        {mine.length === 1 ? t`The venture you run` : t`The ventures you run`}
      </h2>
      <p className={`${HINT} mt-1`}>
        <Trans>What members have paid each venture. Its credits never expire.</Trans>
      </p>
      <div className="mt-4 flex flex-col gap-4">
        {mine.map(({ account, history }) => {
          const held = Object.entries(account.balances).filter(([, v]) => Number(v) !== 0);
          return (
            <article key={account.orgRoleId} className={TILE}>
              <h3 className="font-display text-lg font-bold text-card-foreground">{account.label}</h3>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {held.length
                  ? held
                      .map(([slug, v]) => `${formatTokenGrouped(v, account.decimals[slug] ?? 0)} ${account.tokenNames[slug] ?? slug}`)
                      .join(", ")
                  : t({ message: "Nothing held yet", context: "profile ventures you run" })}
              </p>
              {history.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2" aria-label={t({ message: `Payments for ${account.label}`, context: "profile ventures you run" })}>
                  {history.slice(0, 10).map((h) => (
                    <li key={h.id} className={`${QUIET} flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm`}>
                      <span className={h.amount < 0 ? "font-semibold text-destructive" : "font-semibold text-open"}>
                        {h.amount < 0 ? "-" : "+"}
                        {formatTokenGrouped(Math.abs(h.amount), h.decimals)} {h.tokenName}
                      </span>
                      <span className="order-last min-w-0 basis-full text-foreground sm:order-none sm:basis-0 sm:flex-1">
                        {h.withName ? (h.amount < 0 ? t({ message: `to ${h.withName}`, context: "profile ventures you run" }) : t({ message: `from ${h.withName}`, context: "profile ventures you run" })) : h.amount < 0 ? t({ message: "paid out", context: "profile ventures you run" }) : t({ message: "received", context: "profile ventures you run" })}
                        {h.description ? `: ${h.description}` : ""}
                      </span>
                      <time className="ml-auto text-xs text-muted-foreground" dateTime={h.at}>
                        {new Date(h.at).toLocaleDateString()}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
