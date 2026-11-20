/**
 * ONE ROLE'S LINK PREVIEW (the lead, 20 Nov 2026; the roles lane's idea 3).
 *
 *   GET /roles/:slug   the page shell, with the role's own title, description and picture in its preview tags
 *
 * A link to `/roles/<slug>` shared in a messaging app unfurls as the role: its name at the village, its purpose
 * (or its Goal: line), and its art, or the village's own share picture when the role has none. A crawler runs no
 * JavaScript, so the tags must be in the shell the server sends; this reuses the one meta splice every page
 * already gets (server/lib/pageMeta.ts), the way /quests/:id does, and adds no rendering of its own. The client
 * draws the page (client/src/pages/RoleShare.tsx).
 *
 * The address follows shared/roleSlug.ts, which the card's share link reads too. Only a role anybody may read
 * gets a card: live, not an example, and shown (listed, coming soon or a future venture). Anything else falls
 * through to the ordinary page, which says the role is not there. The village's name comes from its own
 * configuration, never from this file.
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import { listOrgRoles } from "../lib/orgChart";
import { sitePageMeta, spliceMeta, trimTo } from "../lib/pageMeta";
import { isShown } from "../../shared/roleListing";
import { RESERVED_ROLE_SLUGS, roleForSlug, rolePath } from "../../shared/roleSlug";
import { goalOf } from "../../shared/roleOneMinute";
import { castArt } from "../../shared/archetypeRoots";

type SiteConfig = Parameters<typeof sitePageMeta>[2];

export interface RoleShareDeps {
  /** The shell with the village's theme, or null when there is no built client. */
  shell(): string | null;
  config(): SiteConfig;
  origin(req: Request): string;
  content(): Record<string, unknown> | null;
  /** Sends the finished page the way every page is sent (its language, its cache rule). */
  send(req: Request, res: Response, html: string): void;
  pool(): Pool;
}

export interface ShareableRole {
  id: string;
  name: string;
  aim?: string | null;
  whyItMatters?: string | null;
  archetypes?: string[];
}

const absolute = (src: string, origin: string): string => (/^https?:\/\//i.test(src) ? src : origin && src.startsWith("/") ? origin + src : "");

/** The preview for one role: its name at the village, its purpose or goal, its art or the village's picture. */
export function roleShareMeta(role: ShareableRole, roles: readonly ShareableRole[], origin: string, config: SiteConfig, content: Record<string, unknown> | null) {
  const path = rolePath(role, roles);
  const meta = sitePageMeta(path, origin, config, content);
  const village = config.project.name;
  const goal = goalOf(String(role.whyItMatters ?? "").split(/\r?\n/)).goal;
  meta.title = village ? `${role.name} at ${village}` : role.name;
  meta.description = trimTo(String(role.aim ?? "").trim() || goal || meta.description);
  const art = role.archetypes?.[0] ? absolute(castArt(role.archetypes[0]), origin) : "";
  if (art) meta.image = art;
  meta.type = "article";
  meta.url = origin ? origin + path : "";
  return meta;
}

export function register(app: Express, deps: RoleShareDeps): void {
  app.get("/roles/:slug", async (req, res, next) => {
    const slug = String(req.params.slug ?? "");
    if (RESERVED_ROLE_SLUGS.has(slug.toLowerCase())) return next();
    const shell = deps.shell();
    if (!shell) return next();
    const roles = (await listOrgRoles(deps.pool())).filter((r) => !r.isExample && r.active !== false && isShown(r));
    const role = roleForSlug(slug, roles);
    if (!role) return next();
    const meta = roleShareMeta(role, roles, deps.origin(req), deps.config(), deps.content());
    deps.send(req, res, spliceMeta(shell, meta));
  });
}
