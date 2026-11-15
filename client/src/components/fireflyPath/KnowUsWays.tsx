/**
 * STEP 1'S ACTS: WAYS TO GET TO KNOW US, EACH ONE A LINK (Rye, 15 Nov 2026).
 *
 * Above the ticks: a warm push (most people have not done these yet, and that
 * is fine), a fork for someone completely new (the Steward path first) or
 * already sure (carry on), and one act per way: watch the last recording,
 * join the next call, book a land tour, come to the next potluck. The links
 * come from shared/knowUsLinks.ts; an act with no link is not drawn.
 *
 * Every link opens in a new tab, so the application's draft stays where it is.
 */
import { useLingui } from "@lingui/react/macro";
import { ArrowUpRight } from "lucide-react";
import type { KnowUsLinks, KnowUsNext } from "@shared/knowUsLinks";

const ACT = "inline-flex min-h-11 items-center gap-2 font-medium text-notice underline underline-offset-2 hover:text-foreground";

function when(next: KnowUsNext, locale: string): string {
  const d = new Date(next.startsAt);
  const day = d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  return next.place ? `${day}, ${time} · ${next.place}` : `${day}, ${time}`;
}

function Act({ href, label, next }: { href: string | null; label: string; next?: KnowUsNext | null }) {
  const { i18n } = useLingui();
  if (!href) return null;
  return (
    <li>
      <a href={href} target="_blank" rel="noopener noreferrer" className={ACT}>
        {label}
        <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
      </a>
      {next && <span className="block text-sm text-muted-foreground">{when(next, i18n.locale || "en")}</span>}
    </li>
  );
}

export function KnowUsWays({ links }: { links: KnowUsLinks | undefined }) {
  const { t } = useLingui();
  if (!links) return null;
  const acts = [
    { key: "recording", href: links.recording, label: t({ message: "Watch the last recording", context: "founding application know us act" }), next: null },
    { key: "call", href: links.call.href, label: t({ message: "Join the next call", context: "founding application know us act" }), next: links.call.next },
    { key: "tour", href: links.tour.href, label: t({ message: "Book a land tour", context: "founding application know us act" }), next: links.tour.next },
    { key: "potluck", href: links.potluck.href, label: t({ message: "Come to the next potluck", context: "founding application know us act" }), next: links.potluck.next },
  ].filter((a) => a.href);
  return (
    <div className="grid gap-4" data-know-us-ways="">
      <p className="text-base leading-relaxed text-foreground">
        {t({ message: "Most people haven't done these yet, and that's fine.", context: "founding application know us push" })}{" "}
        {links.recording ? t({ message: "Watching the last recording is the easiest first step.", context: "founding application know us push" }) : null}
      </p>
      {acts.length > 0 && (
        <ul className="grid gap-2" data-know-us-acts="">
          {acts.map((a) => (
            <Act key={a.key} href={a.href} label={a.label} next={a.next} />
          ))}
        </ul>
      )}
      <ul className="grid gap-2 text-sm text-foreground sm:grid-cols-2" data-know-us-fork="">
        <li className="rounded-xl border border-border p-3">
          {t({ message: "Completely new here?", context: "founding application know us fork" })}{" "}
          <a href={links.stewardPath} target="_blank" rel="noopener noreferrer" className={ACT} data-steward-path="">
            {t({ message: "Explore the Steward path first", context: "founding application know us fork" })}
            <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
          </a>
        </li>
        <li className="rounded-xl border border-border p-3">
          {t({ message: "Already feel like a strong fit? Carry on with your application.", context: "founding application know us fork" })}
        </li>
      </ul>
    </div>
  );
}
