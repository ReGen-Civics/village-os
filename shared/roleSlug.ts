/**
 * A ROLE'S OWN ADDRESS, `/roles/<slug>` (the lead, 20 Nov 2026; the roles lane's idea 3): a page and a share link
 * for each role. The client draws the page (client/src/pages/RoleShare.tsx) and the server puts the role's
 * link preview on it (server/routes/roleShare.ts). Both read the rule here, so a link the card copies is a link
 * the server knows.
 *
 * THE RULE, first match wins:
 *   1. the role's own `slug`, when it carries one that reads as a slug;
 *   2. a slug of its name: lower case, accents dropped, words joined by dashes, at most 60 characters;
 *   3. its id, when the name gives no slug, the name's slug is a word the roles pages already use
 *      (`select`, `draft`), or another role earlier in the list has the same name's slug.
 * Ids made from a name (createOrgRole) are usually the name's slug already, so for most roles 1 to 3 agree.
 *
 * READING AN ADDRESS back, an id always wins, so `/roles/<id>` works for every role whatever its name became,
 * and a name's slug goes to the first role in the list that carries it. A rename moves the name's link; the id's
 * link never moves.
 *
 * Pure: no pool, no clock, no Node builtins.
 */

export interface SluggedRole {
  id: string;
  name?: string | null;
  slug?: string | null;
}

const MAX = 60;
/** Words the roles pages already answer at `/roles/<word>`. */
export const RESERVED_ROLE_SLUGS: ReadonlySet<string> = new Set(["select", "draft"]);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A slug of a name: lower case, accents dropped, words joined by dashes; "" when nothing is left. */
export function slugOfName(name: string | null | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX)
    .replace(/-+$/g, "");
}

/** The slug a role is known by before collisions: its own, else its name's, else "". */
function ownOrName(r: SluggedRole): string {
  const own = typeof r.slug === "string" ? r.slug.trim().toLowerCase() : "";
  if (own && SLUG.test(own) && own.length <= MAX && !RESERVED_ROLE_SLUGS.has(own)) return own;
  const s = slugOfName(r.name);
  return s && !RESERVED_ROLE_SLUGS.has(s) ? s : "";
}

/** The slug for one role among `roles` (the village's listed roles, in its order). */
export function roleSlug(role: SluggedRole, roles: readonly SluggedRole[] = [role]): string {
  const s = ownOrName(role);
  if (!s) return role.id;
  const first = roles.find((r) => ownOrName(r) === s);
  return !first || first.id === role.id ? s : role.id;
}

/** The role an address names: an id first, then the first role whose slug it is. */
export function roleForSlug<T extends SluggedRole>(slug: string, roles: readonly T[]): T | null {
  let s = "";
  try {
    s = decodeURIComponent(String(slug ?? "")).trim();
  } catch {
    return null;
  }
  if (!s) return null;
  const byId = roles.find((r) => r.id === s);
  if (byId) return byId;
  const lower = s.toLowerCase();
  return roles.find((r) => ownOrName(r) === lower) ?? null;
}

/** The page's path for a role. */
export function rolePath(role: SluggedRole, roles?: readonly SluggedRole[]): string {
  return `/roles/${encodeURIComponent(roleSlug(role, roles))}`;
}
