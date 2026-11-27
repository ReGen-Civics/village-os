/**
 * YOUR FIRST WEEK, on a newcomer's profile (the lead, 27 Nov 2026): their buddy ("by default ... the Ops role unless
 * I choose someone else"), the day they start, and the all-hands they join that day. The meeting's time shows in the
 * reader's own zone, with the village's beside it ("Yes local times!"). The first-week steps that already exist stay
 * where they are on the profile (RoleStartSteps, the first 14 days); this card sits above them.
 *
 * It reads `/api/me/first-week`: only the signed-in member's own adopted proposal. Nothing there: it draws nothing.
 */
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { authToken, gameFetch } from "@/lib/gameApi";
import { CARD, EYEBROW, H2, HINT } from "@/components/journey/look";
import { zonedInstant, zoneLabel } from "@shared/startDay";

type FirstWeek = { ref: string; startIso: string; buddy: { name: string; role: string | null } | null; allHands: { time: string; zone: string; link: string | null } | null };

/** A moment said in a zone: weekday, date and time. */
export function sayAt(at: Date, zone: string | undefined, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", ...(zone ? { timeZone: zone } : {}) }).format(at);
}

export default function FirstWeekCard() {
  const { t, i18n } = useLingui();
  const [week, setWeek] = useState<FirstWeek | null>(null);
  useEffect(() => {
    if (!authToken()) return;
    let alive = true;
    void (async () => {
      try {
        const res = await gameFetch("/api/me/first-week", { cache: "no-store" });
        const data = res.ok ? await res.json().catch(() => null) : null;
        if (alive && data?.firstWeek?.ref) setWeek(data.firstWeek as FirstWeek);
      } catch {
        /* Nothing to show. */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  if (!week) return null;
  const at = week.allHands ? zonedInstant(week.startIso, week.allHands.time, week.allHands.zone) : null;
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const lang = i18n.locale === "es" ? "es" : "en";
  return (
    <section aria-labelledby="first-week-heading" className={CARD} data-first-week="">
      <p className={EYEBROW}>{t({ message: "Your first week", context: "profile: a newcomer's first week, kicker" })}</p>
      <h2 id="first-week-heading" className={`mt-1 ${H2}`}>{t({ message: "Welcome. Here's how you start", context: "profile: a newcomer's first week, heading" })}</h2>
      <ul className="mt-3 grid gap-2 text-foreground">
        {week.buddy && (
          <li data-first-week-buddy="">
            {week.buddy.role
              ? t({ message: `Your buddy: ${week.buddy.name} (${week.buddy.role})`, context: "profile: the newcomer's buddy, with their role" })
              : t({ message: `Your buddy: ${week.buddy.name}`, context: "profile: the newcomer's buddy" })}
          </li>
        )}
        {at && week.allHands && (
          <li data-first-week-all-hands="">
            {t({ message: `All-hands: ${sayAt(at, local, i18n.locale)} your time`, context: "profile: the all-hands in the reader's own zone" })}
            {local !== week.allHands.zone && <span className={`block ${HINT}`} data-first-week-village-time="">{sayAt(at, week.allHands.zone, i18n.locale)} {zoneLabel(week.allHands.zone, lang)}</span>}
            {week.allHands.link && (
              <a className="mt-1 inline-flex min-h-11 items-center font-medium underline underline-offset-4" href={week.allHands.link} target="_blank" rel="noopener noreferrer" data-first-week-link="">
                {t({ message: "Join the video call", context: "profile: the all-hands video link" })}
              </a>
            )}
          </li>
        )}
      </ul>
    </section>
  );
}
