/**
 * "THE ROLE IN ONE MINUTE" (the lead, 20 Nov 2026; the roles lane's idea 1, shared/roleOneMinute.ts): the top of
 * every role card. The goal, the next three deliverables, then commitment, price and where as three quick facts,
 * and the one act. The tabs below hold the depth.
 *
 * Each concept once: the commitment and where are said here and nowhere else in the card's header, the price
 * here as the full role's figure (the Rewards tab works it out at the reader's own share), and the goal line
 * is left out of the box under "The role".
 *
 * Laid out by the card's width (container queries), so it reads the same in the founding card, a directory row
 * and an application's narrow column. On a phone `act` is null and the act comes as `phoneAct`, drawn right under
 * the goal so the first screen shows both (the lead, 20 Nov 2026); the bar along the phone's foot shows only while
 * it is off the screen (FullRoleCard, useApplyBarStuck.ts), so the act is in view once.
 */
import type { ReactNode } from "react";
import { CalendarCheck, Clock, Coins, Flag, MapPin } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import type { Deliverable } from "@shared/roleDeliverables";
import { EYEBROW } from "@/components/journey/look";
import { TipText } from "./CardTips";

function dayWords(day: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale || "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
  } catch {
    return day;
  }
}

export interface OneMinuteProps {
  /** The role's own goal, or its purpose when it writes no goal line. */
  goal: string;
  /** The next three deliverables by date. */
  next: Deliverable[];
  commitment: string;
  /** The price as drawn (it may carry the moon word's tip). */
  price: ReactNode;
  where: string;
  /** The one act, or null when it is drawn elsewhere (a phone) or not at all. */
  act: ReactNode;
  /** The heading level under the card's title. */
  as: "h3" | "h4";
  /** A phone's act, drawn right under the goal (the lead, 20 Nov 2026). */
  phoneAct?: ReactNode;
}

export default function RoleOneMinute({ goal, next, commitment, price, where, act, as: H, phoneAct = null }: OneMinuteProps) {
  const { t, i18n } = useLingui();
  const locale = i18n.locale || "en";
  const facts: Array<{ key: string; icon: typeof Clock; label: string; value: ReactNode }> = [
    { key: "commitment", icon: Clock, label: t({ message: "Commitment", context: "role in one minute: a fact" }), value: commitment },
    { key: "price", icon: Coins, label: t({ message: "Price", context: "role in one minute: a fact" }), value: price },
    { key: "where", icon: MapPin, label: t({ message: "Where", context: "role in one minute: a fact" }), value: where },
  ].filter((f) => !!f.value);
  if (!goal && !next.length && !facts.length && !act && !phoneAct) return null;
  return (
    <section className="@container rounded-2xl border border-notice/40 bg-muted/50 p-4 shadow-sm @md:p-5" data-role-one-minute="">
      <H className={EYEBROW}>{t({ message: "The role in one minute", context: "role card: the summary at the top" })}</H>
      {goal && (
        <p className="mt-2 flex items-start gap-2.5 font-display text-xl leading-snug text-card-foreground @md:text-2xl" data-one-minute-goal="">
          <Flag className="mt-1.5 size-4 shrink-0 text-notice" aria-hidden="true" />
          <span className="min-w-0">
            <span className="sr-only">{t({ message: "Goal:", context: "role in one minute: before the goal, for a screen reader" })} </span>
            <TipText text={goal} />
          </span>
        </p>
      )}
      {phoneAct}
      {next.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-muted-foreground">{t({ message: "Next deliverables", context: "role in one minute: the next three dated outcomes" })}</p>
          <ol className="mt-2 grid gap-2 @2xl:grid-cols-3" data-one-minute-next="">
            {next.map((d, k) => (
              <li key={`${d.start}-${k}`} className="flex min-w-0 gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
                <CalendarCheck className="mt-0.5 size-4 shrink-0 text-notice" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-snug text-card-foreground">{d.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {d.milestone
                      ? t({ message: `On ${dayWords(d.start, locale)}`, context: "role in one minute: a milestone's day" })
                      : t({ message: `By ${dayWords(d.end, locale)}`, context: "role in one minute: when a deliverable is due" })}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {facts.length > 0 && (
        <dl className="mt-4 grid gap-2 @md:grid-cols-3" data-one-minute-facts="">
          {facts.map((f) => (
            <div key={f.key} className="min-w-0 rounded-xl bg-card px-3 py-2.5" data-one-minute-fact={f.key}>
              <dt className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                <f.icon className="size-3.5 text-notice" aria-hidden="true" />
                {f.label}
              </dt>
              <dd className="mt-0.5 break-words text-sm font-semibold leading-snug text-card-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {act && <div className="mt-4" data-one-minute-act="">{act}</div>}
    </section>
  );
}
