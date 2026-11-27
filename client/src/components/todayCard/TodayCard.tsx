/**
 * TODAY'S CARD ON THE PROFILE (profile overhaul, Direction D; shared/myCard.ts says what the card is).
 *
 * The draw itself lives on its own page, /profile/today-card, where the phone's "Pull a card" quick card opens
 * too, so there is one draw and one card a day wherever a member reaches it from. Here, near the top of the
 * profile, a small card stands face down with a door to it; once the day's card is drawn it shows its name and
 * the day's focus, and the door reads "Open your card".
 *
 * Drawn only for a member who has found their lines and only while the Gene Keys module is on; for everybody
 * else it is absent, not an invitation sitting empty.
 */
import { useEffect, useId, useState } from "react";
import { Link } from "wouter";
import { useLingui } from "@lingui/react/macro";
import { ArrowRight, Sparkles } from "lucide-react";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, EYEBROW, H2, HINT, NOTE } from "@/components/journey/look";
import { localDate, readTodayCard } from "@/lib/todayCardApi";
import type { MyCard } from "@shared/myCard";

export default function TodayCard() {
  const { t } = useLingui();
  const base = useId();
  const [state, setState] = useState<{ lines: boolean; card: MyCard | null }>({ lines: false, card: null });

  useEffect(() => {
    let live = true;
    readTodayCard(localDate())
      .then((a) => {
        if (live) setState({ lines: true, card: a.card });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!state.lines) return null;
  const card = state.card;

  return (
    <section aria-labelledby={`${base}-h`} className={CARD} data-today-card={card ? "up" : "down"}>
      <div className="flex items-center gap-5">
        {/* A small card: face down until the day's is drawn, then its gate in gold. Decoration; the words carry it. */}
        <div
          aria-hidden="true"
          className={`flex h-28 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 shadow-sm ${card ? "border-notice bg-card" : "border-notice/60 bg-muted"}`}
        >
          {card ? (
            <span className="font-display text-3xl lining-nums text-notice">{card.card.gate}</span>
          ) : (
            <Sparkles className="size-7 text-notice" />
          )}
        </div>
        <div className="min-w-0">
          <p className={EYEBROW}>{t({ message: "Today's card", context: "today's card: eyebrow" })}</p>
          <h2 id={`${base}-h`} className={`mt-1 ${H2}`}>
            {card ? card.card.name : t({ message: "A card for your day", context: "today's card: heading" })}
          </h2>
          <p className={`mt-1 ${NOTE}`} data-today-card-line="">
            {card ? card.reading.focus : t({ message: "Draw one card from your own lines, read against today's sky and what waits on you.", context: "today's card: before the pull" })}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href="/profile/today-card" className={card ? BTN_SECONDARY : BTN_PRIMARY}>
          {card
            ? t({ message: "Open your card", context: "today's card: the door once drawn" })
            : t({ message: "Pull today's card", context: "today's card: button" })}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        <p className={HINT}>{t({ message: "A lens, never a forecast.", context: "today's card: under the card" })}</p>
      </div>
    </section>
  );
}
