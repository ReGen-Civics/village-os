/**
 * THE LIVING MAP IS FOR MEMBERS (the lead, 24 Nov 2026).
 *
 * Every read under `/api/map` asks the one capability gate for `map.view`, which opens at the
 * member rung (`STAGE_UNLOCKS` in shared/capabilities.ts; a village that wants its map wider moves
 * the rung, and a role or badge may carry it). A visitor, an entered portal visitor and a
 * signed-in account below the rung are refused with a sentence; the circles' own words stay where
 * they are (`/api/org`, `/api/circles`, the Circles pages), so a visitor reads what each circle is
 * for and never the map.
 *
 * Installed right after `requireModule("map")`, so a module that is off still answers 404 first,
 * and in front of every map route registered after it. Writes under `/api/map` already ask their
 * own keys (raise a hand, contact, edit, publish) and pass here untouched.
 *
 * One read is left open: `/api/map/my-light`, a member's own setting for how the map is lit,
 * which the notification preferences page reads for anybody signed in.
 */
import type { Express, NextFunction, Request, Response } from "express";
import type { Capability } from "../../shared/capabilities";

export const MAP_MEMBERS_ONLY = {
  error: "members_only",
  message: "The living map is for members. The circles and what each one is for are open to you.",
};

/** Reads under `/api/map` that are not the map. Paths relative to the mount. */
const NOT_THE_MAP: readonly string[] = ["/my-light"];

export interface MapViewDeps {
  guardCapability(req: Request, res: Response, cap: Capability, refusal?: { status: number; body: Record<string, unknown> }): Promise<boolean>;
}

/** The gate alone, for a test to mount. */
export function mapViewGate(deps: MapViewDeps) {
  const { guardCapability } = deps;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (NOT_THE_MAP.includes(req.path)) return next();
    try {
      if (await guardCapability(req, res, "map.view", { status: 403, body: MAP_MEMBERS_ONLY })) return next();
    } catch (e) {
      next(e);
    }
  };
}

export function register(app: Express, deps: MapViewDeps): void {
  app.use("/api/map", mapViewGate(deps));
}
