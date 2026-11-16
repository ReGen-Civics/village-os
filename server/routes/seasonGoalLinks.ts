/**
 * `POST /api/admin/seasons/:seasonId/goal-links/remap`: move a season's links
 * from a goal id it no longer holds to one it does (server/lib/goalLinkRemap.ts
 * holds the rules and says why this exists).
 *
 * Body `{from, to}`, `{pairs: [{from, to}, ...]}` or a bare list of pairs.
 * `?dryRun=1` (or `dryRun: true` in the body) answers the same counts and
 * writes nothing. Admin only, gated as the season list's own save is. It is a
 * `setting` a proposal can name, so a person runs it from the review page.
 *
 * Registered from server/routes/seasons.ts, beside the season list it reads.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { recordEvent } from "../lib/events";
import { readPairs, remapGoalLinks, type RemapSeason } from "../lib/goalLinkRemap";

export type GoalLinkDeps = Pick<AppDeps, "isAdmin" | "adminActor" | "getPool"> & {
  seasonState(): { seasons?: RemapSeason[]; timezone?: string };
};

const truthy = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "true";

export function registerGoalLinkRemap(app: Express, deps: GoalLinkDeps): void {
  const { isAdmin, adminActor, getPool, seasonState } = deps;

  app.post("/api/admin/seasons/:seasonId/goal-links/remap", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const read = readPairs(body);
    if (!read.ok) return res.status(400).json({ error: read.error, fields: [read.field] });
    const dryRun = truthy(req.query.dryRun) || truthy(body.dryRun);
    const state = seasonState();
    const seasonId = String(req.params.seasonId ?? "");
    let out;
    try {
      out = await remapGoalLinks(getPool(), { seasonId, seasons: state.seasons ?? [], timeZone: state.timezone ?? "UTC", pairs: read.pairs, dryRun });
    } catch (e) {
      console.error("[seasons] moving goal links failed:", (e as Error)?.message ?? e);
      return res.status(500).json({ error: "Moving the goal links failed and nothing moved. Try again." });
    }
    if (!out.ok) return res.status(out.status).json({ error: out.error, ...(out.field ? { fields: [out.field] } : {}) });
    if (!dryRun && out.moved > 0) {
      const actor = adminActor(req)?.id ?? null;
      for (const p of out.pairs) {
        if (!p.moved) continue;
        await recordEvent(getPool(), {
          kind: "audit",
          text: `season-goal-links:remap:${seasonId}:${p.from}:${p.to}:${p.moved}`,
          actorUserId: actor,
          entityType: "season",
          entityRef: seasonId,
          audience: "admin",
        });
      }
    }
    res.json(out);
  });
}
