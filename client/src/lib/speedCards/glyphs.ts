/**
 * A SPEED CARD'S GLYPH, the same on the card and in the picker (QA round 2: the picker borrowed another page's icon
 * for a page with none, so Housing wore the Quests compass and four Join pages the Investor's seed).
 *
 * In order: the page's own icon (config/routeIcons.ts), the one its menu entry carries, the card's own glyph below
 * (Profile, Messages, My tasks, Journal, whose pages have no entry in the icon set), and last a NEUTRAL glyph for its
 * group, which no page uses, so a page with no icon of its own never looks like another page.
 */
import { BookOpen, Bookmark, Circle, DoorOpen, ListChecks, MessagesSquare, NotebookPen, Scale, Trees, UserRound, UsersRound } from "lucide-react";
import { ROUTE_ICONS, type RouteIcon } from "@/config/routeIcons";
import { TASK_BOARD_PATH } from "@shared/taskMenu";
import type { SpeedCard } from "./registry";

/** The account pages' own glyphs: the icon set has none for them. */
export const CARD_GLYPHS: Readonly<Record<string, RouteIcon>> = {
  "/profile": UserRound,
  "/messages": MessagesSquare,
  [TASK_BOARD_PATH]: ListChecks,
  "/journal": NotebookPen,
};

/**
 * One neutral glyph per group, by the menu's own untranslated group name (registry.ts, `groupKey`). None of these is
 * any page's icon; glyphs.test.ts holds every NAV group to one.
 */
export const GROUP_GLYPHS: Readonly<Partial<Record<string, RouteIcon>>> = {
  Village: Trees,
  Community: UsersRound,
  Govern: Scale,
  Join: DoorOpen,
  About: BookOpen,
  Yours: Bookmark,
  More: Circle,
};

/** The glyph a card wears where the page icon set has none for it: its entry's, its own, or its group's. */
export function fallbackGlyph(card: Pick<SpeedCard, "id" | "icon" | "groupKey">): RouteIcon {
  return card.icon ?? CARD_GLYPHS[card.id] ?? GROUP_GLYPHS[card.groupKey] ?? Circle;
}

/** The glyph a card wears, all things considered (the page icon set first, once it has loaded). */
export function glyphFor(card: Pick<SpeedCard, "id" | "href" | "icon" | "groupKey">): RouteIcon {
  return (card.href ? ROUTE_ICONS[card.href] : undefined) ?? fallbackGlyph(card);
}
