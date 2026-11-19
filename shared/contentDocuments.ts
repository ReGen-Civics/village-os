/**
 * THE CONTENT DOCUMENTS THAT ARE NOT PAGES (the lead, 19 Nov 2026: "Seems like we need to upgrade what agents are
 * able to do in the Game").
 *
 * `PUT /api/admin/content/:section` (server/index.ts) saves every content section. A section named `page-...` is a
 * page and is read by its page spec (`pageContentProblem`). Three more sections are documents of their own, each
 * with its own validator in that same route:
 *
 *   app-vocabulary   the village's own words for things (shared/vocabulary.ts, gap G4), the contribution token's
 *                    name among them. Admin, Make it yours, Identity.
 *   app-menu         the menu labels, hidden entries and phone tabs (shared/menuDoc.ts, gap G5).
 *   app-notices      the village's own notice titles and blurbs (shared/noticeWords.ts, gap G6).
 *
 * A proposal could not reach them: `page_content` looked for a page spec or a stored section, and a village that
 * never saved its words has no stored section, so the vocabulary answered "There is no page section by that name".
 * This list lets a proposal name them, checked by the SAME validator the route runs, so a proposal the route would
 * refuse is refused when it is filed. `canvas` is not here: it has its own door (shared/canvasPublicLines.ts), and
 * the content route refuses it.
 *
 * Pure: no database, no Express.
 */
import { MENU_SECTION, menuDocProblem } from "./menuDoc";
import { NOTICE_SECTION, noticeWordsProblem } from "./noticeWords";
import { NOUN_SLOT_IDS, NOUN_SLOTS, VOCAB_SECTION, vocabularyOf, vocabularyProblem } from "./vocabulary";

export interface ContentDocument {
  section: string;
  /** What it is, in a few words, for the review page and the connector. */
  label: string;
  /** Where a person edits it in the app. */
  where: { label: string; href: string };
  /** The content route's own validator for this section. */
  problem: (raw: unknown) => string | null;
}

export const CONTENT_DOCUMENTS: readonly ContentDocument[] = [
  { section: VOCAB_SECTION, label: "The village's words for things", where: { label: "Admin, Make it yours, Identity", href: "/admin?tab=setup" }, problem: vocabularyProblem },
  { section: MENU_SECTION, label: "The menu and phone tabs", where: { label: "Admin, Make it yours, Menu", href: "/admin?tab=setup" }, problem: menuDocProblem },
  { section: NOTICE_SECTION, label: "The village's notice words", where: { label: "Admin, Make it yours, Notices", href: "/admin?tab=setup" }, problem: noticeWordsProblem },
];

/** The content document a section names, or null for a page or any other section. */
export function contentDocumentFor(section: string): ContentDocument | null {
  return CONTENT_DOCUMENTS.find((d) => d.section === section) ?? null;
}

/**
 * What a content document reads as now, in the shape a proposal writes. The vocabulary reads every word slot with
 * the word in force (the village's own, else the platform's), so the review page shows it beside the proposal and
 * putting a change back has a value to write for each slot. The others read as stored, or `{}` when never saved.
 */
export function contentDocumentLive(section: string, stored: unknown): Record<string, unknown> {
  if (section === VOCAB_SECTION) {
    const v = vocabularyOf(stored);
    return Object.fromEntries(NOUN_SLOT_IDS.map((s) => [s, { one: v[s].one, many: v[s].many }]));
  }
  return stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
}

/** The vocabulary's word slots, each with what it names, for the connector's description. */
export function vocabularySlotsLine(): string {
  return NOUN_SLOT_IDS.map((s) => `${s} (${NOUN_SLOTS[s].what.toLowerCase()})`).join(", ");
}
