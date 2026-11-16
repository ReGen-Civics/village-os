/**
 * WHAT A ROLE ASKS FOR FIRST, for the signed-in member reading it:
 *
 *   GET /api/governance/role-prerequisites[?role=<id>]   each role that asks for something, and what the reader has
 *
 * Registered below the governance module's gate on /api/governance. The dial
 * itself (`roles.prerequisites`) is a game variable, so every member sees it
 * and may propose a change to it on the dials page; this read says what it
 * means for the reader. The member door asks the same reader
 * (server/lib/rolePrerequisites.ts), so the page and the refusal cannot disagree.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { prerequisitesFor } from "../lib/rolePrerequisites";

type Deps = Pick<AppDeps, "authedUser" | "getPool">;

export function register(app: Express, deps: Deps): void {
  const { authedUser, getPool } = deps;

  app.get("/api/governance/role-prerequisites", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in to see what a role asks for." });
    const role = typeof req.query.role === "string" && req.query.role.trim() ? [req.query.role.trim()] : undefined;
    res.json({ roles: await prerequisitesFor(getPool(), String(user.id), role) });
  });
}
