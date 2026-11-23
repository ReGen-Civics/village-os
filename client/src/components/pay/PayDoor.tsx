/**
 * The profile's door to `/pay`, where the send-by-email form used to stand.
 *
 * Sending moved to its own page (client/src/pages/Pay.tsx) so it can search by
 * handle or name, scan a code, and show a receipt, none of which fitted a card
 * on the treasury tab. What stays here is the question "can I pass this to
 * someone", beside the balance it is about, and two doors: pay, and my code.
 *
 * Renders NOTHING when the village has no sendable token, exactly as the card
 * it replaces did, so a village that has closed sending sees no promise.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useLingui } from "@lingui/react/macro";
import { QrCode as QrIcon, Send } from "lucide-react";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { gameFetch } from "@/lib/gameApi";
import { getFormattingLocale } from "@/i18n/i18n";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, H2, HINT } from "@/components/journey/look";
import { creditsWords, type PaySummary } from "./payMoney";

export default function PayDoor() {
  const { t } = useLingui();
  const user = useOptionalAuth()?.user ?? null;
  const [summary, setSummary] = useState<PaySummary | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    gameFetch("/api/pay")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) setSummary(d);
      })
      .catch(() => {
        /* the door simply does not appear */
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const token = summary?.tokens?.[0];
  if (!user || !token) return null;
  const heldText = creditsWords(token.balance, token.decimals, getFormattingLocale());
  const tokenName = token.name;

  return (
    <section aria-labelledby="pay-door-h" className={CARD}>
      <h2 id="pay-door-h" className={`${H2} flex items-center gap-2`}>
        <Send className="h-6 w-6" aria-hidden="true" />
        {t({ context: "profile, door to the pay page", message: "Send and receive credits" })}
      </h2>
      <p className={`${HINT} mt-2`}>
        {t({
          context: "profile, door to the pay page",
          message: `Pay someone for a jar of honey, a haircut, an afternoon of help. You hold ${heldText} ${tokenName}.`,
        })}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/pay" className={BTN_PRIMARY}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {t({ context: "profile, door to the pay page", message: "Pay someone" })}
        </Link>
        <Link href="/pay?tab=receive" className={BTN_SECONDARY}>
          <QrIcon className="h-4 w-4" aria-hidden="true" />
          {t({ context: "profile, door to the pay page", message: "Your code" })}
        </Link>
      </div>
    </section>
  );
}
