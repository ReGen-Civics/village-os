/**
 * The icon of each kind of change and each flag on the review page. Their words live in ChangeCard.tsx, beside
 * the macros that compile them.
 * Keyed by the unions in shared/proposalReview.ts, so a new face or flag fails the compiler here.
 */
import { CalendarDays, CalendarPlus, ClipboardList, Coins, Files, FileText, Footprints, Globe2, Layers, Link2, ListChecks, MessageCircleQuestion, Settings2, SlidersHorizontal, Sprout, UserRound, type LucideIcon } from "lucide-react";
import type { ChangeFace, ChangeFlag } from "@shared/proposalReview";

export const FACE_ICON: Record<ChangeFace, LucideIcon> = {
  page_words: FileText,
  role_card: UserRound,
  faq: MessageCircleQuestion,
  village_setting: SlidersHorizontal,
  module: Layers,
  listed_roles: ListChecks,
  season_priorities: Sprout,
  onboarding: Footprints,
  calendar_event: CalendarDays,
  meeting_agenda: ClipboardList,
  admin_setting: Settings2,
};

export const FLAG_ICON: Record<ChangeFlag, LucideIcon> = {
  whole_document: Files,
  public_page: Globe2,
  money_words: Coins,
  calendar_event: CalendarPlus,
  priorities_links: Link2,
};

