/**
 * YOUR APPLICATION'S NEXT STEP, on your own profile (the lead, 27 Nov 2026: "show them clearly their next step in
 * their profile"). The same stage, next step, role and booking button as your application's own page
 * (pages/ApplicationStatus.tsx), drawn from the same words (shared/applicantWords.ts `statusView`), so the two never
 * disagree. The booking button names the role only ("Book with Ops").
 *
 * It reads `/api/me/application-next`: your newest application still waiting, and only one this account is trusted to
 * be. None waiting, or not signed in: it draws nothing, and the profile reads as before.
 */
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { authToken, gameFetch } from "@/lib/gameApi";
import { BTN_NOTICE, BTN_PRIMARY, CARD_FEATURED, DOOR, EYEBROW } from "@/components/journey/look";
import { chooseApplicantLanguage } from "@shared/applicantLanguage";
import { statusView, type StatusServedForView } from "@shared/applicantWords";

type Next = { ref: string; status: StatusServedForView & { locale?: string } };

export default function ApplicationNextCard() {
  const { t, i18n } = useLingui();
  const [next, setNext] = useState<Next | null>(null);
  useEffect(() => {
    if (!authToken()) return;
    let alive = true;
    void (async () => {
      try {
        const res = await gameFetch("/api/me/application-next", { cache: "no-store" });
        const data = res.ok ? await res.json().catch(() => null) : null;
        if (alive && data?.next?.ref && data.next.status) setNext(data.next as Next);
      } catch {
        /* Nothing to show: the profile reads as before. */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  if (!next) return null;
  const lang = chooseApplicantLanguage({ chosenOnSite: i18n.locale, profile: next.status.locale ?? null }).language;
  const view = statusView(lang, next.status);
  const page = `/application-status/${encodeURIComponent(next.ref)}`;
  const book = view.booking?.book && "links" in view.booking.book ? view.booking.book.links.filter((l) => /^https:\/\//.test(l.url)) : [];
  return (
    <section aria-labelledby="application-next-heading" className={CARD_FEATURED} data-application-next={next.ref}>
      <p className={EYEBROW}>{t({ message: "Your application", context: "profile: the applicant's next-step card, kicker" })}</p>
      <h2 id="application-next-heading" className="mt-1 font-display text-2xl font-bold text-foreground">
        {view.stepWords}
      </h2>
      <p className="mt-1 text-lg text-foreground" data-application-next-move="">{view.move}</p>
      {(view.primary || book.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {view.primary && (
            <a href={`${page}${view.primary.href}`} className={BTN_PRIMARY} data-application-next-primary="">
              {view.primary.label}
            </a>
          )}
          {book.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className={view.bookGold ? BTN_PRIMARY : BTN_NOTICE} data-application-next-book="">
              {l.label}
            </a>
          ))}
        </div>
      )}
      <a href={page} className={`mt-4 ${DOOR}`} data-application-next-open="">
        {t({ message: "Open your application", context: "profile: the applicant's next-step card, link to the status page" })}
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      </a>
    </section>
  );
}
