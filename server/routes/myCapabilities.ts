/**
 * WHAT THE VIEWER MAY READ, ASKED ONCE (live QA pass, 25 Nov 2026; the coordinator's ruling).
 *
 *   GET /api/me/capabilities   the signed-in viewer's OWN keys, and nothing else
 *
 * Several member pages asked an admin or power-holder route to find out whether it was theirs, and read the
 * refusal as "not yours": every member's console showed one to five 401s and 403s per visit. This read lets a
 * page ask first. It is not a gate and changes no route: every route still guards itself, and a page that cannot
 * read this answer asks the route the way it always did.
 *
 * The answer is the READ side of the one gate (shared/capabilities.ts), the same question `mayStillSee` in
 * server/index.ts answers for the list routes: an admin or a founder may look at every key, and anyone else holds
 * a key when `capabilityDecision` allows it. No break-glass: a read never reaches past the village.
 *
 * A request marked to read as a plain member (server/lib/readAsMember.ts, the live view for QA) is judged as one:
 * no admin, no founder. It answers which keys, never why or from which seat, and never anybody else's.
 */
import type { Express } from "express";
import { ALL_CAPABILITIES, capabilityDecision, type Capability, type CapabilityCtx } from "../../shared/capabilities";
import type { AppDeps } from "../lib/appDeps";
import { readsAsPlainMember } from "../lib/readAsMember";

type Deps = Pick<AppDeps, "authedUser" | "capabilityCtx">;

/** The keys this viewer may look through, as the read side of the gate answers them. */
export function heldForReading(role: unknown, ctx: CapabilityCtx, plain: boolean): Capability[] {
  if (!plain && (role === "admin" || role === "founder")) return [...ALL_CAPABILITIES];
  const judged: CapabilityCtx = plain ? { ...ctx, isAdmin: false, isFounder: false } : ctx;
  return ALL_CAPABILITIES.filter((cap) => capabilityDecision(cap, { ...judged, adminOverride: false }).allowed);
}

export function register(app: Express, deps: Deps): void {
  app.get("/api/me/capabilities", async (req, res) => {
    const user = await deps.authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    res.set("Cache-Control", "private, no-store");
    res.json({ capabilities: heldForReading(user.role, await deps.capabilityCtx(user), readsAsPlainMember(req)) });
  });
}
