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
 * Kept out of vite.config.ts so a test can pin it without loading the build.
 */

/** A route page only a power holder or an admin opens, by its file name. */
export const PRIVILEGED_PAGE = /client[\\/]src[\\/]pages[\\/](?:Treasury|Admin|Mint|Cash)[^\\/]*\.tsx$/;

/** A component that carries one of those pages' powers, never a group member. */
export const PRIVILEGED_COMPONENT = /client[\\/]src[\\/]components[\\/](?:admin[\\/](?:MintDesk|CashPayoutsTab)|myMoon[\\/]PayBoard|roleCard[\\/]Waitlist(?:Admin|Letter)|treasury[\\/][^\\/]+)\.tsx$/;

/** Whether this module may join a shared page or component group at all. */
export function mayJoinSharedGroup(id: string): boolean {
  return !PRIVILEGED_PAGE.test(id) && !PRIVILEGED_COMPONENT.test(id);
}

/*
 * ADMIN-ONLY CODE NEVER SHARES A CHUNK WITH MEMBER CODE (size pass, 28 Nov 2026).
 *
 * The names above keep a few files apart. They could not see the rest: a small
 * module only the Admin page reaches, imported by two of its tabs, joined
 * "smallui" like any other, and "smallui" is on the first view of most member
 * routes; a lazy tab of the Admin page shared a "lazy-" file with a piece a
 * member chunk can ask for. Counted from the routes, about 250 KB of admin code
 * sat in files a member's browser fetches.
 *
 * So the build works out, from the router and the import graph, which modules
 * only an admin route can reach, and the group rules in vite.config.ts keep
 * them out of every member group. Nothing is decided by a module's folder or
 * name:
 *
 *   1. THE ADMIN ROOTS are the pages the router (client/src/App.tsx) draws only
 *      on admin routes: /admin and the paths under it, except the pages under
 *      /admin that people who are not admins open (OPENED_BY_OTHERS). A page a
 *      member route also draws is a member page.
 *   2. THE MEMBERS' REACH starts at the entry and follows every static and lazy
 *      import, except the router's own lazy import of an admin root. A module
 *      any member page can import, now or later, is a member module, even when
 *      it only renders for an admin. Such an import is a leak to fix in the code
 *      (make it lazy behind the admin root, or split out the piece a member
 *      uses), never a name to add here.
 *   3. ADMIN-ONLY is what the roots reach that the members' reach did not.
 *
 * The rule errs one way only. The import lists keep edges the bundler shakes
 * out, so a module can read as reachable by a member when no member chunk
 * holds it; that keeps it on the members' side, which costs bytes and never
 * hides any. guard-admin-chunks (vite.config.ts) reads the finished bundle and
 * fails the build when a file a member's browser can fetch carries admin-only
 * code (adminCodeOnMemberFiles).
 */

/**
 * Pages under /admin that a person who is not an admin opens, so their code is
 * a member's. Each reason is the page's own word. This list can only move a
 * page to the members' side; a new page under /admin is an admin root until it
 * is named here.
 */
export const OPENED_BY_OTHERS: Readonly<Record<string, string>> = {
  "/admin/review": "a steward who is not an admin opens it (pages/AdminReview.tsx)",
  "/admin/proposals": "it is for the people who hold the powers the changes need, not only admins (pages/ProposedChanges.tsx)",
  "/admin/role-progress": "a circle's lead opens it (App.tsx)",
};

/** A route only an admin can use. */
export function isAdminRoute(routePath: string): boolean {
  return (routePath === "/admin" || routePath.startsWith("/admin/")) && !Object.prototype.hasOwnProperty.call(OPENED_BY_OTHERS, routePath);
}

/** The page modules ("pages/Admin", as App.tsx imports them) that only admin routes draw. */
export function adminRootPages(routes: ReadonlyArray<{ path: string; module: string }>): string[] {
  const member = new Set(routes.filter((r) => !isAdminRoute(r.path)).map((r) => r.module));
  return Array.from(new Set(routes.filter((r) => isAdminRoute(r.path) && !member.has(r.module)).map((r) => r.module))).sort();
}

/** What the rule needs to know about one module of the graph. */
export interface GraphNode {
  importedIds: readonly string[];
  dynamicallyImportedIds: readonly string[];
  isEntry: boolean;
}

/** The modules only the admin roots reach (rules 2 and 3 above). `router` is the module whose lazy imports of a root are held back. */
export function adminOnlyModules(ids: readonly string[], info: (id: string) => GraphNode | null, roots: ReadonlySet<string>, router: string): Set<string> {
  const member = new Set<string>();
  const stack = ids.filter((id) => info(id)?.isEntry);
  while (stack.length) {
    const m = stack.pop() as string;
    if (member.has(m)) continue;
    member.add(m);
    const node = info(m);
    if (!node) continue;
    for (const dep of node.importedIds) stack.push(dep);
    for (const dep of node.dynamicallyImportedIds) if (!(m === router && roots.has(dep))) stack.push(dep);
  }
  const admin = new Set<string>();
  const more = Array.from(roots).filter((r) => !member.has(r));
  while (more.length) {
    const m = more.pop() as string;
    if (member.has(m) || admin.has(m)) continue;
    admin.add(m);
    const node = info(m);
    if (!node) continue;
    for (const dep of node.importedIds) more.push(dep);
    for (const dep of node.dynamicallyImportedIds) more.push(dep);
  }
  return admin;
}

/** Our own source, the only code the rule judges: packages and the bundler's virtual modules are left to it. */
export function isOwnSource(id: string): boolean {
  return !id.startsWith("\0") && !id.includes("node_modules") && /\.[cm]?[jt]sx?$/.test(id.split("?")[0]);
}

/** What guard-admin-chunks reads off one emitted chunk. */
export interface BuiltChunk {
  fileName: string;
  isEntry: boolean;
  imports: readonly string[];
  dynamicImports: readonly string[];
  modules: Readonly<Record<string, { renderedLength: number }>>;
}

/** A file a member's browser can fetch that carries admin-only code: the defect guard-admin-chunks refuses. */
export interface AdminLeak {
  fileName: string;
  admin: string[];
}

/**
 * Every file a member can fetch that holds rendered admin-only modules of our
 * own source. Which files a member can fetch is read off the BUILT chunk graph,
 * a second reading beside the module graph the chunker used: from the entry,
 * every static and lazy import between files, except the router's file's lazy
 * import of the file holding an admin root, held back only when nothing but the
 * router imports that root (`routerOnly`). A module the import lists call a
 * member's but the bundler placed only in admin files is therefore no leak:
 * no member file asks for it.
 */
export function adminCodeOnMemberFiles(chunks: readonly BuiltChunk[], adminOnly: ReadonlySet<string>, roots: ReadonlySet<string>, router: string, routerOnly: (root: string) => boolean): AdminLeak[] {
  const reached = memberFiles(chunks, roots, router, routerOnly);
  const out: AdminLeak[] = [];
  for (const c of chunks) {
    if (!reached.has(c.fileName)) continue;
    const admin = Object.keys(c.modules).filter((id) => isOwnSource(id) && c.modules[id].renderedLength > 0 && adminOnly.has(id));
    if (admin.length) out.push({ fileName: c.fileName, admin });
  }
  return out;
}

/** The files a member's browser can fetch (see adminCodeOnMemberFiles). */
export function memberFiles(chunks: readonly BuiltChunk[], roots: ReadonlySet<string>, router: string, routerOnly: (root: string) => boolean): Set<string> {
  const byFile = new Map(chunks.map((c) => [c.fileName, c]));
  const routerFile = chunks.find((c) => Object.prototype.hasOwnProperty.call(c.modules, router))?.fileName;
  // The file holding a root, found by its modules: a dynamic entry rollup gave a manual chunk has no facade.
  const rootFiles = new Set(chunks.filter((c) => Object.keys(c.modules).some((id) => roots.has(id) && routerOnly(id))).map((c) => c.fileName));
  const reached = new Set<string>();
  const stack = chunks.filter((c) => c.isEntry).map((c) => c.fileName);
  while (stack.length) {
    const f = stack.pop() as string;
    if (reached.has(f)) continue;
    reached.add(f);
    const c = byFile.get(f);
    if (!c) continue;
    for (const to of c.imports) stack.push(to);
    for (const to of c.dynamicImports) if (!(f === routerFile && rootFiles.has(to))) stack.push(to);
  }
  return reached;
}

/*
 * THE ADMIN FOLDER ON MEMBERS' FILES, A RATCHET. The rule above decides from
 * the graph, so a member page that imports an admin panel makes that panel a
 * member's, and nothing above fails: the import is the leak, and it is the one
 * a lane is likeliest to add without noticing (a guide dock imported by the
 * site header, a settings form drawn by a member page for a steward). So the
 * build also lists every module under client/src/components/admin/ that a
 * member's file carries, and fails on one that scripts/admin-on-member.json
 * does not already name. The list only shrinks. The folder is a detector here,
 * never the decider: a module on the list is a member's module by the graph,
 * and each is a known leak to fix by making its import lazy behind the page
 * that needs it, or by moving the small piece a member page uses out of the
 * folder.
 */
export const ADMIN_FOLDER = /client[\\/]src[\\/]components[\\/]admin[\\/]/;

/** The modules under the admin folder a member's file carries, as `name` spells them, sorted. */
export function adminFolderOnMemberFiles(chunks: readonly BuiltChunk[], reached: ReadonlySet<string>, name: (id: string) => string): string[] {
  const out = new Set<string>();
  for (const c of chunks) {
    if (!reached.has(c.fileName)) continue;
    for (const id of Object.keys(c.modules)) if (isOwnSource(id) && ADMIN_FOLDER.test(id) && c.modules[id].renderedLength > 0) out.add(name(id));
  }
  return Array.from(out).sort();
}
