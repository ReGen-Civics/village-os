/**
 * THE ROUTES THAT ARE NOT ADMIN'S: the named families of server routes the Admin Garden does not answer for.
 *
 * The scoreboard's Endpoints count (shared/gardenScore.ts) asks every route the server registers one question: whose
 * is it? A route is an admin act's (the registry of acts names it), or it sits in a family below, or it is OPEN and
 * printed. This list is the one place a person's judgement enters that count, so it is kept short and held by tests
 * (shared/notAdminRoutes.test.ts and server/gardenScoreboard.test.ts):
 *
 *   - no family may match a route under /api/admin/;
 *   - no family may match a route the permission matrix shows is admin's;
 *   - every family matches at least one real route;
 *   - a family is a path prefix that means something, never /api/ whole.
 *
 * Three kinds:
 *
 *   public    a signed-out visitor may call it: the public pages' reads, the forms a stranger sends, sign-in
 *   member    a signed-in member's own side of the village: their profile, their work, their votes
 *   machine   no person calls it: health checks, webhooks, the connector's own protocol, the files a browser loads
 *
 * When nobody can tell whose a route is, it has no family and stays open. That is the honest answer.
 *
 * Pure: no I/O, no clock.
 */

export type NotAdminKind = "public" | "member" | "machine";

export interface NotAdminFamily {
  /** A short stable name for the family. */
  key: string;
  kind: NotAdminKind;
  /** Whether a route is one of the family's: its method in capitals, and its path exactly as Express registers it. */
  test(method: string, path: string): boolean;
  /** Why these routes are not admin's, in a sentence. */
  why: string;
}

/** Empty until the families are named and reviewed. */
export const NOT_ADMIN_ROUTES: readonly NotAdminFamily[] = [];

/** The family a route belongs to, or null when it has none. */
export function notAdminFamily(method: string, path: string, families: readonly NotAdminFamily[] = NOT_ADMIN_ROUTES): NotAdminFamily | null {
  return families.find((f) => f.test(method.toUpperCase(), path)) ?? null;
}
