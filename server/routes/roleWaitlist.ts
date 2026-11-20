/**
 * THE COMING-SOON WAITLIST'S ROUTES (the lead, Anchor session of 19 Nov 2026;
 * shared/roleWaitlist.ts holds the contract). Registered by
 * server/routes/roleEdit.ts, beside the role card's own reads.
 *
 *   POST   /api/roles/waitlist            anybody, rate limited by connection and by address
 *   GET    /api/admin/roles/waitlist      admins only: every sign-up, with the roles' names
 *   DELETE /api/admin/roles/waitlist/:id  admins only: one sign-up removed
 *
 * Nothing here sends anything, and nothing here chooses anyone. The answer to a
 * sign-up says only that it was kept, never whether the address was seen before.
 */
import type { Express } from "express";
import type { Pool } from "mysql2/promise";
import { readWaitlistSignUp, WAITLIST_LIMITS, type WaitlistRow } from "../../shared/roleWaitlist";
import { addWaitlistSignUp, listWaitlist, removeWaitlistRow } from "../repos/roleWaitlist";
import { listOrgRoles } from "../lib/orgChart";
import { callerIp } from "../lib/clientIp";

export interface WaitlistGate {
  authedUser(req: any): Promise<any | null>;
  isAdmin(req: any): Promise<boolean>;
  getPool(): Pool;
  overLimit(key: string, max: number, windowMs: number): Promise<boolean>;
}

export function registerRoleWaitlistRoutes(app: Express, g: WaitlistGate): void {
  app.post("/api/roles/waitlist", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (await g.overLimit(`role-waitlist:${callerIp(req)}`, WAITLIST_LIMITS.perWindow, WAITLIST_LIMITS.windowMs)) return res.status(429).json({ error: "too_many_asks" });
    const roles = await listOrgRoles(g.getPool());
    const soon = new Set(roles.filter((r) => r.active !== false && !r.isExample && r.comingSoon === true && r.futureVenture !== true).map((r) => r.id));
    const read = readWaitlistSignUp(req.body, (id) => soon.has(id));
    if (!read.ok) return res.status(400).json({ error: "invalid", field: read.field, message: read.problem });
    if (await g.overLimit(`role-waitlist-address:${read.value.emailKey}`, WAITLIST_LIMITS.perWindow, WAITLIST_LIMITS.windowMs)) return res.status(429).json({ error: "too_many_asks" });
    const user = await g.authedUser(req);
    await addWaitlistSignUp(g.getPool(), read.value, user?.id ? String(user.id) : null, new Date());
    res.json({ ok: true });
  });

  app.get("/api/admin/roles/waitlist", async (req, res) => {
    if (!(await g.isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const pool = g.getPool();
    const names = new Map((await listOrgRoles(pool)).map((r) => [r.id, r.name]));
    const rows: WaitlistRow[] = (await listWaitlist(pool)).map((r) => ({
      id: r.id,
      email: r.emailKey,
      whatsapp: r.whatsapp,
      roles: r.roleIds.map((id) => ({ id, name: names.get(id) ?? id })),
      member: r.userId !== null,
      consent: r.consent,
      createdAt: r.createdAt,
    }));
    res.set("Cache-Control", "no-store").json({ rows });
  });

  app.delete("/api/admin/roles/waitlist/:id", async (req, res) => {
    if (!(await g.isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const gone = await removeWaitlistRow(g.getPool(), String(req.params.id ?? ""));
    res.status(gone ? 200 : 404).json({ ok: gone });
  });
}
