/**
 * Every page spec, keyed by its content section (`page-home`, ...).
 *
 * Imported by the server (to validate a save) and by Admin, Pages (to build
 * the editor). A public page imports ONLY its own spec file, never this
 * registry, so one page's words never ride in another page's bundle.
 */
import { HOME_PAGE } from "./home";
import { SITE_PAGE } from "./site";
import { RIGHTS_RESIDENT_PAGE, RIGHTS_STEWARD_PAGE } from "./rights";
import { HOUSING_PAGE } from "./housing";
import { OPPORTUNITIES_PAGE } from "./opportunities";
import { VISIT_PAGE } from "./visit";
import { WORK_WITH_US_PAGE } from "./workWithUs";
import { GOOD_NEIGHBOR_PAGE } from "./goodNeighbor";
import { HOW_WE_CREATE_PAGE } from "./howWeCreate";
import { CO_CREATORS_GUIDE_PAGE } from "./coCreatorsGuide";
import { TEAM_PAGE } from "./team";
import { MASTER_PLAN_PAGE } from "./masterPlan";
import { LOVE_LETTER_PAGE } from "./loveLetter";
import { JOURNEY_PAGES } from "./journeys";
import { GOVERNANCE_PAGE } from "./governance";
import { GOVERNANCE_NOW_PAGE } from "./governanceNow";
import { CIRCLES_PAGE } from "./circles";
import { TRAINING_RESIDENT_PAGE, TRAINING_STEWARD_PAGE } from "./training";
import { APP_WORDS_PAGE } from "./appWords";
import { PAGE_SECTION_PREFIX, pageSectionKey, type PageSpec } from "./types";
import { pageDocumentProblems } from "./resolve";
import { INVESTOR_PAGE, INVESTOR_PAGE_ID } from "../investorInterest";

export const PAGE_SPECS: readonly PageSpec[] = [HOME_PAGE, SITE_PAGE, RIGHTS_RESIDENT_PAGE, RIGHTS_STEWARD_PAGE, HOUSING_PAGE, OPPORTUNITIES_PAGE, VISIT_PAGE, WORK_WITH_US_PAGE, GOOD_NEIGHBOR_PAGE, HOW_WE_CREATE_PAGE, CO_CREATORS_GUIDE_PAGE, TEAM_PAGE, MASTER_PLAN_PAGE, LOVE_LETTER_PAGE, ...JOURNEY_PAGES, GOVERNANCE_PAGE, GOVERNANCE_NOW_PAGE, CIRCLES_PAGE, TRAINING_STEWARD_PAGE, TRAINING_RESIDENT_PAGE, APP_WORDS_PAGE];

/**
 * The pages Admin, Pages edits whose spec, and so whose default words, only the server holds, by id and path alone:
 * the investor page (server/lib/investorJourney.ts, the lead, 27 Nov 2026). It is still a story page a village can
 * switch off (shared/brochure.ts), and the editor still edits it, reading its spec from GET /api/admin/page-specs/kept.
 * No word of the page is here; server/routes/investorAccess.test.ts holds this list to the specs the server keeps.
 */
export const KEPT_PAGES: readonly { id: string; path: string }[] = [{ id: INVESTOR_PAGE_ID, path: INVESTOR_PAGE }];

/** Every page path Admin, Pages edits: the specs here, and the ones the server keeps. */
export const EDITED_PAGE_PATHS: readonly string[] = [...PAGE_SPECS.map((s) => s.path), ...KEPT_PAGES.map((p) => p.path)];

/** The kept specs themselves. The server adds them at boot; in a browser this stays empty. */
const KEPT_SPECS: PageSpec[] = [];
export function keepPageSpec(spec: PageSpec): void {
  if (!KEPT_PAGES.some((p) => p.id === spec.id && p.path === spec.path)) throw new Error(`keepPageSpec: ${spec.id} is not named in KEPT_PAGES`);
  if (!KEPT_SPECS.some((s) => s.id === spec.id)) KEPT_SPECS.push(spec);
}
export function keptPageSpecs(): readonly PageSpec[] {
  return KEPT_SPECS;
}

export function pageSpecForSection(section: string): PageSpec | null {
  if (!section.startsWith(PAGE_SECTION_PREFIX)) return null;
  return [...PAGE_SPECS, ...KEPT_SPECS].find((spec) => pageSectionKey(spec) === section) ?? null;
}

/**
 * Why `PUT /api/admin/content/:section` must refuse this body, or null.
 *
 * Sections outside `page-*` are not this module's to judge and pass through
 * untouched. A `page-*` name no spec claims is refused: nothing renders it.
 */
export function pageContentProblem(section: string, body: unknown): string | null {
  if (!section.startsWith(PAGE_SECTION_PREFIX)) return null;
  const spec = pageSpecForSection(section);
  if (!spec) return `There is no page called "${section.slice(PAGE_SECTION_PREFIX.length)}".`;
  const problems = pageDocumentProblems(spec, body);
  return problems.length ? problems.join(" ") : null;
}

export * from "./types";
export * from "./resolve";
