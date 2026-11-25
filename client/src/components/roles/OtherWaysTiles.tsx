/**
 * THE TILES UNDER "OTHER WAYS TO JOIN" ON /roles (QA2-07; the five-reviewer QA pass, 25 Nov 2026). Each tile is drawn
 * only where it leads somewhere this reader can go: the member's door for a new role to a member, and the seeder and
 * gifts tiles only while their page is served here, so a village that switched a story page off gets no tile and never
 * a 404.
 */
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { LINK, TILE } from "@/components/journey/look";
import { OTHER_WAYS_DEFAULTS, type OtherWays } from "@shared/otherWays";

export default function OtherWaysTiles({ otherWays, newcomer, shown: storyShown }: { otherWays: OtherWays; newcomer: boolean; shown: (href: string) => boolean }) {
  const { t } = useLingui();
  return (
        <ul className="grid gap-3 sm:grid-cols-2">
          {/* The member's door for a new role: a newcomer could not open it (the five-reviewer QA pass, 25 Nov 2026). */}
          {!newcomer && (
          <li className={TILE}>
            <Link href="/role-proposals/new" className={`inline-flex min-h-11 items-center gap-2 ${LINK}`} data-propose-new-role="">
              {t({ message: "Propose a new role", context: "roles page, other ways to join" })}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">{t({ message: "Propose is for a role we don't list. Tell us the role you see, and the village decides.", context: "roles page, other ways to join" })}</p>
          </li>
          )}
          <li className={TILE}>
            <Link href="/quests" className={`inline-flex min-h-11 items-center gap-2 ${LINK}`}>
              {t({ message: "Take a quest, alone or with others", context: "roles page, other ways to join" })}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </li>
          {/* QA2-07: the resident path and the gifts tile, the village's own words (shared/otherWays.ts). */}
          {/* Each tile only while its page is served here: a village that switched the page off gets no tile, never a
              404 (the five-reviewer QA pass, 25 Nov 2026). */}
          {storyShown(otherWays.seeder.href) && (
          <li className={TILE} data-other-way="seeder">
            <Link href={otherWays.seeder.href} className={`inline-flex min-h-11 items-center gap-2 ${LINK}`}>
              {otherWays.seeder.title === OTHER_WAYS_DEFAULTS.seederTitle ? t({ message: "Become a Founding Seeder", context: "roles page, other ways to join" }) : otherWays.seeder.title}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {otherWays.seeder.line === OTHER_WAYS_DEFAULTS.seederLine ? t({ message: "Live here one day? Start on the resident path.", context: "roles page, other ways to join" }) : otherWays.seeder.line}
            </p>
          </li>
          )}
          {storyShown(otherWays.gifts.href) && (
          <li className={TILE} data-other-way="gifts">
            <Link href={otherWays.gifts.href} className={`inline-flex min-h-11 items-center gap-2 ${LINK}`}>
              {otherWays.gifts.title === OTHER_WAYS_DEFAULTS.giftsTitle ? t({ message: "Offer your gifts", context: "roles page, other ways to join" }) : otherWays.gifts.title}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {otherWays.gifts.line === OTHER_WAYS_DEFAULTS.giftsLine ? t({ message: "Volunteer or work-trade: tell us what you would like to give.", context: "roles page, other ways to join" }) : otherWays.gifts.line}
            </p>
          </li>
          )}
        </ul>
  );
}
