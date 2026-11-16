/**
 * PRIVILEGED PAGES NEVER RIDE A SHARED PAGE GROUP (2026-11-16).
 *
 * `vite.config.ts` merges small lazy pages into "smallpages", 12 to 18 KB ones
 * into "midpages", and the brochure pages into "shopfront", so a member who
 * opens one page of a group downloads every page in it. That is fine for
 * member pages and wrong for the ones only a power holder or an admin opens:
 * the Treasury's mint and pay screens, Admin and its pages, the Mint, the cash
 * pages. Their code would ship to every member who opens a neighbour in the
 * group. The server still gates every read and write, so this is about what a
 * page reveals by being downloaded, and about keeping those chunks out of
 * ordinary members' caches.
 *
 * So a page whose file name starts with one of these words keeps its own lazy
 * chunk, whatever its size. The same goes for the hand-mint form both the
 * Admin token tab and the Treasury draw (`components/admin/MintDesk.tsx`),
 * which would otherwise qualify for the "smallui" group by having two importers,
 * and likewise the treasurer's pay board (`components/myMoon/PayBoard.tsx`,
 * "Pay by member") and the cash desk (`components/admin/CashPayoutsTab.tsx`),
 * each drawn by the Treasury page and by Admin.
 *
 * Kept out of vite.config.ts so a test can pin it without loading the build.
 */

/** A route page only a power holder or an admin opens, by its file name. */
export const PRIVILEGED_PAGE = /client[\\/]src[\\/]pages[\\/](?:Treasury|Admin|Mint|Cash)[^\\/]*\.tsx$/;

/** A component that carries one of those pages' powers, never a group member. */
export const PRIVILEGED_COMPONENT = /client[\\/]src[\\/]components[\\/](?:admin[\\/](?:MintDesk|CashPayoutsTab)|myMoon[\\/]PayBoard|treasury[\\/][^\\/]+)\.tsx$/;

/** Whether this module may join a shared page or component group at all. */
export function mayJoinSharedGroup(id: string): boolean {
  return !PRIVILEGED_PAGE.test(id) && !PRIVILEGED_COMPONENT.test(id);
}
