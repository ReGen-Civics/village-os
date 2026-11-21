/**
 * THE NATURE ART LIBRARY (shared/natureArt.ts; Rye, 20 Nov 2026): the 48 painted animals and plants
 * every role card, upcoming role and venture card shows, and which painting each role has.
 *
 *   GET  /images/nature/<slug>.webp          the paintings (server/assets/nature, like moduleArt.ts)
 *   GET  /images/nature/sm/<slug>.webp       their half-size copies (scripts/nature-art-sizes.mjs)
 *   GET  /api/art/nature                     the library and every role's painting, for any reader
 *   GET  /api/admin/art/nature               the same with each role's name and whether an admin chose it
 *   PUT  /api/admin/art/nature/roles/:roleId { slug } chooses a painting; { slug: null } goes back to automatic
 *
 * A role nobody chose for draws one from its id (assignNatureArt), so every card has art from the first
 * deploy with nothing stored. The choices live in one app_config document, NATURE_ART_DOC.
 */
import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import type { Pool } from "mysql2/promise";
import type { AppDeps } from "../lib/appDeps";
import { dbDocument } from "../repos/store-db";
import { listOrgRoles } from "../lib/orgChart";
import { NATURE_ART, NATURE_ART_URL, assignNatureArt, isNatureSlug, readChosenArt, shownRoleIds } from "../../shared/natureArt";

export const NATURE_ART_DIR = path.join("server", "assets", "nature");
export const NATURE_ART_DOC = "role-nature-art";
const MAX_AGE_SECONDS = 86400;
const YEAR_SECONDS = 31536000;
const READS = 120;
const WINDOW_MS = 60_000;

type Deps = Pick<AppDeps, "isAdmin" | "guardCapability" | "overLimit"> & { getPool: () => Pool; dir: string };

async function chosenArt(pool: Pool): Promise<Record<string, string>> {
  const doc = dbDocument<{ roles: Record<string, string> }>(pool, NATURE_ART_DOC, { roles: {} });
  await doc.load();
  return readChosenArt(doc.get().roles);
}

/** Every live role's painting, the roles themselves, and the choices behind them. */
export async function roleArt(pool: Pool): Promise<{ roles: Record<string, string>; chosen: Record<string, string>; names: Record<string, string> }> {
  const all = (await listOrgRoles(pool)).filter((r) => !r.isExample);
  const chosen = await chosenArt(pool);
  const names = Object.fromEntries(all.map((r) => [r.id, String(r.name ?? r.id)]));
  return { roles: assignNatureArt(all.map((r) => r.id), chosen, shownRoleIds(all)), chosen, names };
}

export function register(app: Express, deps: Deps): void {
  const { isAdmin, guardCapability, overLimit, getPool } = deps;
  if (!fs.existsSync(deps.dir)) console.warn(`[nature-art] ${deps.dir} is missing, so role cards will draw their fallback art`);
  // A URL carrying the file's fingerprint (`?v=`, natureArtUrl) names one exact file, so a reader may keep it for a year;
  // a bare URL keeps the day, because the file behind it can be repainted.
  app.use(NATURE_ART_URL, (req, res, next) => {
    res.set("Cache-Control", typeof req.query.v === "string" && /^[0-9a-f]{6,16}$/.test(req.query.v) ? `public, max-age=${YEAR_SECONDS}, immutable` : `public, max-age=${MAX_AGE_SECONDS}`);
    next();
  });
  app.use(NATURE_ART_URL, express.static(deps.dir, { index: false, redirect: false, dotfiles: "ignore", cacheControl: false }));

  app.get("/api/art/nature", async (req, res) => {
    if (await overLimit(`nature-art:${req.ip ?? "anon"}`, READS, WINDOW_MS)) return res.status(429).json({ error: "too_many_asks" });
    const { roles } = await roleArt(getPool());
    res.set("Cache-Control", "no-store").json({ art: NATURE_ART, roles });
  });

  app.get("/api/admin/art/nature", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required", message: "Sign in as an admin to see the art library." });
    const out = await roleArt(getPool());
    res.set("Cache-Control", "no-store").json({ art: NATURE_ART, ...out });
  });

  app.put("/api/admin/art/nature/roles/:roleId", express.json({ limit: "4kb" }), async (req, res) => {
    if (!(await guardCapability(req, res, "story.tell"))) return;
    const roleId = String(req.params.roleId ?? "");
    const slug = (req.body ?? {}).slug;
    if (slug !== null && !isNatureSlug(slug)) return res.status(400).json({ error: "Name one of the 48 paintings, or null to go back to automatic." });
    const pool = getPool();
    const { names } = await roleArt(pool);
    if (!names[roleId]) return res.status(404).json({ error: "There is no role by that id." });
    const doc = dbDocument<{ roles: Record<string, string> }>(pool, NATURE_ART_DOC, { roles: {} });
    await doc.load();
    const roles = readChosenArt(doc.get().roles);
    if (slug === null) delete roles[roleId];
    else roles[roleId] = slug;
    await doc.put({ roles });
    res.json({ ok: true, ...(await roleArt(pool)) });
  });
}
