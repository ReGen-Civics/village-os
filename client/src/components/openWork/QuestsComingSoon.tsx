/**
 * "QUESTS COMING SOON" (the lead, 24 Nov 2026): the top of /quests while the
 * board holds no real open work, only examples. One line says what the
 * stamped cards are, and one door invites the reader to propose a quest of
 * their own. When a real quest is open the board does not render this at all.
 *
 * The page's one featured panel (CARD_FEATURED, the gold edge): it is where a
 * visitor to an example board should start.
 */
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { BTN_PRIMARY, CARD_FEATURED, EYEBROW, H2, LEDE } from "@/components/journey/look";

export default function QuestsComingSoon({ className = "" }: { className?: string }) {
  const { t } = useLingui();
  return (
    <section
      aria-labelledby="quests-coming-soon"
      className={`${CARD_FEATURED} flex flex-col gap-4 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-8 ${className}`}
      data-quests-coming-soon
    >
      <div className="min-w-0">
        <p className={EYEBROW}>{t({ message: "Quests", context: "quests coming soon banner eyebrow" })}</p>
        <h2 id="quests-coming-soon" className={`${H2} mt-1`}>
          {t({ message: "Quests coming soon", context: "quests board banner while every quest is an example" })}
        </h2>
        <p className={`${LEDE} mt-2`}>
          {t({ message: "These are examples of the quests to come. Have one in mind?", context: "quests coming soon banner: the one line under the heading" })}
        </p>
      </div>
      <Link href="/propose-quest" className={`${BTN_PRIMARY} shrink-0 self-start sm:self-auto`} data-propose-quest>
        {t({ message: "Propose a quest", context: "quests coming soon banner: the one door" })}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
