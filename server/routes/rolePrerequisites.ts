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
import type { LapseContext } from "../lib/orgChart";
import { prerequisitesFor, rolePathFor } from "../lib/rolePrerequisites";
import { memberNames } from "../repos/seasonPlaces";

type Deps = Pick<AppDeps, "authedUser" | "getPool" | "firstName"> & { lapse(): LapseContext };

export function register(app: Express, deps: Deps): void {
  const { authedUser, getPool, firstName, lapse } = deps;

  /**
   * One role's path for the reader: its words, its holders now by first name
   * (signed-in live view, III.2), and each thing it asks for, in order, with
   * what the reader has. The role's own application door does the asking.
   */
  app.get("/api/governance/role-path/:roleId", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in to see a role's path." });
    const path = await rolePathFor(getPool(), String(user.id), String(req.params.roleId ?? ""), lapse());
    if (!path) return res.status(404).json({ error: "not_found", message: "There is no role by that id." });
    const names = await memberNames(getPool(), path.holderIds);
    res.json({ ...path, holderIds: undefined, holders: path.holderIds.map((id) => firstName(names.get(id) ?? "")).filter(Boolean) });
  });

  app.get("/api/governance/role-prerequisites", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required", message: "Sign in to see what a role asks for." });
    const role = typeof req.query.role === "string" && req.query.role.trim() ? [req.query.role.trim()] : undefined;
    res.json({ roles: await prerequisitesFor(getPool(), String(user.id), role) });
  });
}
