/**
 * MAY THIS PERSON USE ADMIN, asked in one place.
 *
 * The server answers that question with three ways in (`userIsAdmin`,
 * server/index.ts): the account's own role is admin, it is founder, or the
 * member holds a live power group that carries admin access (sheet 19,
 * server/lib/groupAdmin.ts). It works the third one out on every read and sends
 * the answer as `adminAccess` on the signed-in account: `GET /api/profile`, and
 * the `user` that sign-in, registration and a profile save hand back.
 *
 * The client used to test the two role names by hand, page by page, and so it
 * hid the admin pages from a steward whose way in is a power group while the
 * server would have let them through. `hasAdminAccess` is the one test now.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 *
 * It is the door `isAdmin` guards on the server and nothing wider. A route
 * that asks the capability gate instead (the mail settings, the game
 * variables, seating somebody in a seat) reads the account's OWN role for its
 * admin shortcut, so it refuses a member whose admin access comes from a
 * group. A control behind such a route stays on `holdsAdminRole`, or it would
 * offer an act the server refuses. server/permissionMatrix.snapshot.json shows
 * which routes are which: the fourth column is the group holder.
 *
 * It decides what a page offers. Every route still guards itself.
 */

/** The two fields this reads off the signed-in account. */
export interface AdminAccessView {
  role?: string | null;
  /** The server's own answer: this account may open admin, through its role or through a live power group. */
  adminAccess?: unknown;
}

/** Whether this person may use admin: an admin's or a founder's account, or admin access through a power group. */
export function hasAdminAccess(user: AdminAccessView | null | undefined): boolean {
  return !!user && (user.role === "admin" || user.role === "founder" || user.adminAccess === true);
}

/**
 * Whether the account's OWN role is admin or founder. Narrower than
 * `hasAdminAccess` on purpose, for a control whose route asks the capability
 * gate (see "what it is not" above).
 */
export function holdsAdminRole(user: AdminAccessView | null | undefined): boolean {
  return !!user && (user.role === "admin" || user.role === "founder");
}

/**
 * Whether a menu entry's `roles` list (client/src/config/nav.ts) lets this
 * person see it. The account's own role is read as it always was. One thing
 * is added: a member whose admin access comes from a power group is let in
 * wherever the list names the admin role, so they are offered the working
 * pages the server opens for them. No list means everyone.
 */
export function menuRolesAllow(roles: readonly string[] | undefined, user: AdminAccessView | null | undefined): boolean {
  if (!roles) return true;
  if (!user) return false;
  if (user.role && roles.includes(user.role)) return true;
  return !holdsAdminRole(user) && hasAdminAccess(user) && roles.includes("admin");
}
