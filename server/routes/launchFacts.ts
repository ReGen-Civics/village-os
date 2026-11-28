/**
 * WHERE THIS VILLAGE STANDS, AS FACTS.
 *
 *   GET /api/admin/launch/facts
 *
 * One small read for every screen that has to say, or act on, whether the
 * village has launched. `shared/launchFacts.ts` names each fact and the server
 * door that reads it, and why "launched" was never one fact.
 *
 * ── READ ONLY, AND CHEAP ───────────────────────────────────────────────────
 *
 * It writes nothing and runs no launch check. `GET /api/admin/launch` beside
 * it resolves the whole checklist, which asks a mail provider and a DNS host;
 * a status line on every admin screen must not wait on those.
 *
 * ── WHO MAY READ IT ────────────────────────────────────────────────────────
 *
 * Whoever may read `GET /api/admin/launch`: the same `isAdmin` door, which
 * also marks the gate for the default-deny under `/api/admin`. It is NOT on
 * the member-readable list (`server/lib/memberReadable.ts`). Whether a village
 * is still unclaimed is something the bootstrap door tells only a caller who
 * holds the shared password, and this route keeps it that way: a signed-out
 * visitor is refused before anything is read.
 *
 * ── THE LABEL ──────────────────────────────────────────────────────────────
 *
 * `label` is display only. This file is the only server code that may import
 * it (`shared/launchFacts.guard.test.ts`): a gate reads the fact, never the name.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { launchLabel, type LaunchFactsAnswer } from "../../shared/launchFacts";
import { readLaunchFacts } from "../lib/launchFacts";

type Deps = Pick<AppDeps, "isAdmin" | "getPool">;

export function register(app: Express, deps: Deps): void {
  const { isAdmin, getPool } = deps;

  app.get("/api/admin/launch/facts", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const facts = await readLaunchFacts(getPool());
    const answer: LaunchFactsAnswer = { facts, label: launchLabel(facts) };
    res.json(answer);
  });
}
