/**
 * COMING SOON, IN PLACE OF AN EMPTY PAGE (a reviewer's feedback, approved by
 * the lead on 24 Nov 2026).
 *
 * An area the village has switched on and not filled yet used to draw its
 * heading over "No photographs yet." or "No raisings yet", which read as a
 * broken page. A member still reaches these areas from the menu (a newcomer
 * does not: config/nav.ts, `newcomers`), so the empty page says plainly that
 * the area is coming, what will appear there, and keeps a door open when
 * there is somewhere useful to go meanwhile.
 *
 * Drawn in the profile's look (docs/DESIGN_RULE.md): a panel, the eyebrow over
 * the display face, a quiet second act.
 */
import { Link } from "wouter";
import { useLingui } from "@lingui/react/macro";
import { BTN_SECONDARY, CARD, EYEBROW, NOTE } from "@/components/journey/look";

export default function ComingSoonPanel({
  title,
  body,
  door,
  className = "",
}: {
  /** What this area is, in a few words: "Photographs of the land". */
  title: string;
  /** What will appear here, and how it starts. */
  body: string;
  /** Somewhere useful to go meanwhile. */
  door?: { href: string; label: string } | null;
  className?: string;
}) {
  const { t } = useLingui();
  return (
    <section className={`${CARD} text-center ${className}`} data-coming-soon="" aria-labelledby="coming-soon-h">
      <p className={EYEBROW}>{t({ message: "Coming soon", context: "an area the village has not filled yet: the eyebrow over its name" })}</p>
      <h2 id="coming-soon-h" className="mt-2 font-display text-2xl leading-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <p className={`mx-auto mt-3 max-w-xl ${NOTE}`}>{body}</p>
      {door ? (
        <Link href={door.href} className={`${BTN_SECONDARY} mt-6`}>
          {door.label}
        </Link>
      ) : null}
    </section>
  );
}
