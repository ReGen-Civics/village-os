/**
 * THE VILLAGE'S PATHS, ONE SOURCE (the lead, 27 Nov 2026: "one button for paths to show the various paths").
 *
 * The home page's "Choose your path" cards and the phone header's Paths sheet (components/mobile/PathsSheet.tsx) read
 * the same list: the cards in Admin, Pages, Home, "Choose your path" (shared/pageContent/home.ts, their titles and
 * second lines from Paths & Stages), each card's journey page and picture from PATH_CARD_LOOK, and a journey page the
 * village switched off on its own takes its card with it. Nothing here is typed by hand per village.
 *
 * While the village has its founding team on, the steward card is that team's door: it opens the founding team on
 * /roles (the lead, 24 Nov 2026, option B on the landing), on both surfaces.
 */
import { useEffect, useState } from "react";
import { Home as HomeIcon } from "lucide-react";
import { MushroomNetwork, Pines, SeedGlint } from "@/components/sacred/living";
import { ROLES_SECTIONS } from "@/lib/sectionAnchor";
import type { ResolvedItem, ResolvedSection } from "@shared/pageContent/types";

/** What each path card needs that is not words: where it goes, its icon, its picture. */
export const PATH_CARD_LOOK = {
  investor: { icon: Pines, href: "/investor", color: "bg-amber", imageKey: "investorHero", altKey: "investorHeroAlt", focusKey: "investorHeroFocus" },
  steward: { icon: MushroomNetwork, href: "/steward", color: "bg-sage", imageKey: "stewardHero", altKey: "stewardHeroAlt", focusKey: "stewardHeroFocus" },
  resident: { icon: HomeIcon, href: "/resident", color: "bg-teal", imageKey: "residentHero", altKey: "residentHeroAlt", focusKey: "residentHeroFocus" },
  prosperity: { icon: SeedGlint, href: "/prosperity", color: "bg-teal-light", imageKey: "prosperityHero", altKey: "prosperityHeroAlt", focusKey: "prosperityHeroFocus" },
} as const;

export type PathCardId = keyof typeof PATH_CARD_LOOK;
export type PathCardLook = (typeof PATH_CARD_LOOK)[PathCardId];

/** One path as both surfaces draw it. */
export interface PathCard {
  id: PathCardId;
  title: string;
  subtitle: string;
  description: string;
  look: PathCardLook;
}

/** The cards the village shows, in its order: a card with no journey page here, or whose page is off, is left out. */
export function visiblePathCards(paths: ResolvedSection | undefined, pageOff: (href: string) => boolean): PathCard[] {
  if (!paths || paths.hidden) return [];
  return (paths.lists.cards ?? []).flatMap((card: ResolvedItem) => {
    const look = PATH_CARD_LOOK[card.id as PathCardId];
    if (!look || pageOff(look.href)) return [];
    return [{ id: card.id as PathCardId, title: card.title ?? "", subtitle: card.subtitle ?? "", description: card.description ?? "", look }];
  });
}

/** Whether the steward card is the founding team's door (the founding team is on). */
export function isCoreTeamCard(id: PathCardId, founding: boolean): boolean {
  return founding && id === "steward";
}

/** Where a path card goes: its journey page, or the founding team on /roles for the steward card while it is on. */
export function pathCardHref(card: PathCard, founding: boolean): string {
  return isCoreTeamCard(card.id, founding) ? `/roles#${ROLES_SECTIONS.team}` : card.look.href;
}

/** How long a reader waits on the founding switch before it draws without it. */
const FOUNDING_READ_WAIT_MS = 8000;

/**
 * Whether the village has its founding team section on: null until the read
 * answers, false when it fails, and false once FOUNDING_READ_WAIT_MS has gone
 * by, so a stalled read never holds the page back. A late yes still turns the
 * section on.
 */
export function useFoundingOn(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const stall = setTimeout(() => live && setOn((v) => (v === null ? false : v)), FOUNDING_READ_WAIT_MS);
    // The same public read the roles page makes (GET /api/org/founding-team),
    // asked for its one yes or no; any failure is the section off.
    fetch("/api/org/founding-team")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setOn(d?.on === true && Array.isArray(d?.roleIds) && d.roleIds.length > 0))
      .catch(() => live && setOn(false));
    return () => {
      live = false;
      clearTimeout(stall);
    };
  }, []);
  return on;
}
