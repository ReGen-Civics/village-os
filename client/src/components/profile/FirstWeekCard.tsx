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
  // The start date, and the week's steps with done or to do (QA pass 1): done once its moment has passed.
  const startAt = new Date(`${week.startIso}T12:00:00Z`);
  const started = Date.now() >= Date.parse(`${week.startIso}T00:00:00Z`);
  const startDay = new Intl.DateTimeFormat(i18n.locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(startAt);
  const steps: Array<{ key: string; label: string; done: boolean }> = [
    { key: "start", label: t({ message: `Your start day: ${startDay}`, context: "profile: a newcomer's first week, the start day step" }), done: started },
    ...(at ? [{ key: "all-hands", label: t({ message: "Join the all-hands that day", context: "profile: a newcomer's first week, the all-hands step" }), done: Date.now() >= at.getTime() }] : []),
    ...(week.buddy ? [{ key: "buddy", label: t({ message: `Meet ${week.buddy.name}, your buddy`, context: "profile: a newcomer's first week, the buddy step" }), done: false }] : []),
  ];
  return (
    <section aria-labelledby="first-week-heading" className={CARD} data-first-week="">
      <p className={EYEBROW}>{t({ message: "Your first week", context: "profile: a newcomer's first week, kicker" })}</p>
      <h2 id="first-week-heading" className={`mt-1 ${H2}`}>{t({ message: "Welcome. Here's how you start", context: "profile: a newcomer's first week, heading" })}</h2>
      <p className="mt-1 text-foreground" data-first-week-start="">{t({ message: `You start ${startDay}.`, context: "profile: a newcomer's first week, the start date" })}</p>
      <ol className="mt-3 grid gap-2" data-first-week-steps="">
        {steps.map((step) => (
          <li key={step.key} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3" data-first-week-step={step.key} data-step-done={step.done ? "" : undefined}>
            <span className="text-foreground">{step.label}</span>
            <span className={`text-sm ${step.done ? "text-open" : "text-muted-foreground"}`}>{step.done ? t({ message: "Done", context: "profile: a first-week step, done" }) : t({ message: "To do", context: "profile: a first-week step, to do" })}</span>
          </li>
        ))}
      </ol>
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
