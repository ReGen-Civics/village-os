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
 * each drawn by the Treasury page and by Admin. And the role waitlist's admin
 * panel and its letter (`components/roleCard/WaitlistAdmin.tsx`, drawn on
 * /roles only for an admin, and `WaitlistLetter.tsx`, opened only from it),
 * which would otherwise share a "lazy-" chunk with the role pieces every
 * visitor opens (dist headroom pass, 23 Nov 2026).
 *
 * THE GUIDE'S DOCK AND THE ADMIN GARDEN (28 Nov 2026). Everything in
 * `components/admin/dock/`, `components/admin/garden/` and the garden's mount
 * on /admin (`components/admin/gardenMount/`) is drawn only behind an admin
 * page: Admin itself, and the road to launch. None of it rides a shared
 * group, by the folder it lives in, so a new file there needs no line here
 * (ADMIN_ONLY_HOME). The table of the garden's places and art
 * (`shared/gardenArt.ts`) lives outside those folders and only they import
 * it, so it is named beside them: left free, the build could put it in a
 * shared group a member page loads.
 *
 * AND A DOOR TO ONE OF THESE IS HELD OUT TOO. The helper's host
 * (`components/admin/AdminHelperHost.tsx`) has two importers and is small, so
 * "smallui" took it, and with it the lazy import that opens the dock: the
 * dock's chunk, with the garden's code and stylesheet in it, sat one lazy
 * import away from every member page that loads "smallui". No member's browser
 * fetched it, and it was still the wrong side of the boundary. So a module is
 * asked what it opens, by its own lazy imports and never by a list of names
 * (`opensPrivileged`): a door stays with whatever imports it, which for the
 * host is the Admin page's own chunk. A route page that draws the dock or the
 * garden itself keeps its own file for the same reason (`drawsAdminOnly`): the
 * road to launch does, and stood alone only by its weight.
 *
 * Kept out of vite.config.ts so a test can pin it without loading the build.
 */

/** A route page only a power holder or an admin opens, by its file name. */
export const PRIVILEGED_PAGE = /client[\\/]src[\\/]pages[\\/](?:Treasury|Admin|Mint|Cash)[^\\/]*\.tsx$/;

/** A component that carries one of those pages' powers, never a group member. */
export const PRIVILEGED_COMPONENT = /client[\\/]src[\\/]components[\\/](?:admin[\\/](?:MintDesk|CashPayoutsTab)|myMoon[\\/]PayBoard|roleCard[\\/]Waitlist(?:Admin|Letter)|treasury[\\/][^\\/]+)\.tsx$/;

/**
 * The guide's dock, the Admin Garden and the garden's mount, by their folders: every file in them, the
 * stylesheet included. And the one table of theirs that lives in `shared/`.
 */
export const ADMIN_ONLY_HOME = /client[\\/]src[\\/]components[\\/]admin[\\/](?:dock|garden|gardenMount)[\\/]|shared[\\/]gardenArt\.ts$/;

/** Whether this module may join a shared page or component group at all. */
export function mayJoinSharedGroup(id: string): boolean {
  return !PRIVILEGED_PAGE.test(id) && !PRIVILEGED_COMPONENT.test(id) && !ADMIN_ONLY_HOME.test(id);
}

/** A door: a module that lazily imports one of the pieces above. Given the module's own lazy imports. */
export function opensPrivileged(lazyImports: readonly string[]): boolean {
  return lazyImports.some((dep) => !mayJoinSharedGroup(dep));
}

/** A route page that draws the dock or the garden itself. Given the page's own static imports. */
export function drawsAdminOnly(staticImports: readonly string[]): boolean {
  return staticImports.some((dep) => ADMIN_ONLY_HOME.test(dep));
}
