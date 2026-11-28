/**
 * WHAT THE SCOREBOARD READS, GATHERED FROM THE REPOSITORY: the half of the Admin Garden's scoreboard that touches
 * files. shared/gardenScore.ts is pure and takes everything as input; this hands it the real thing.
 *
 *   the routes        `routeDoors` (server/testkit/routeDoors.ts): every route `deriveRoutes` reads from the server's
 *                     sources, each with what its own handler asks
 *   the matrix        server/permissionMatrix.snapshot.json, written by the permission matrix's own test
 *   the acts          ADMIN_ACTS (shared/adminActs.ts)
 *   the dials         VARIABLES (shared/gameVariables.ts)
 *   the tabs          ADMIN_TABS (shared/adminTabs.ts)
 *   the ledger        shared/adminActs/ledger.ts
 *   the mount, cuts   shared/gardenMounts.ts
 *   not admin's       shared/notAdminRoutes.ts
 *   the old doors     the folded tab keys (client/src/components/admin/adminTabAliases.ts) and the client's router,
 *                     read from client/src/App.tsx by the reader the QA sweeps use (scripts/qa/routes.mjs)
 *
 * Nothing here is a list of its own. The script (scripts/garden-scoreboard.ts) and the ratchet
 * (server/gardenScoreboard.test.ts) both call `gatherScoreInputs`, so they count the same repository.
 */
import fs from "node:fs";
import path from "node:path";
import { LEFT_ADMIN, MOVED_TABS } from "../../client/src/components/admin/adminTabAliases";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { routes as clientRoutes } from "../../scripts/qa/routes.mjs";
import { ADMIN_ACTS } from "../../shared/adminActs";
import { LEDGER_NEVER_DRAWN, LEDGER_STILL_OPEN, PARITY_LEDGER } from "../../shared/adminActs/ledger";
import { ADMIN_TABS } from "../../shared/adminTabs";
import { VARIABLES } from "../../shared/gameVariables";
import { CUT_BY_RULING, GARDEN_MOUNTS } from "../../shared/gardenMounts";
import type { MatrixSnapshot, ScoreInputs } from "../../shared/gardenScore";
import { NOT_ADMIN_ROUTES } from "../../shared/notAdminRoutes";
import { routeDoors } from "./routeDoors";

/** The permission matrix's committed snapshot. */
export function readMatrix(root: string): MatrixSnapshot {
  const raw = JSON.parse(fs.readFileSync(path.join(root, "server", "permissionMatrix.snapshot.json"), "utf8")) as MatrixSnapshot;
  return { identities: raw.identities, routes: raw.routes };
}

/** Every path pattern the client's router draws a page for. */
export function readClientRoutes(): string[] {
  const r = clientRoutes() as { concrete: string[]; parameterised: string[] };
  return [...r.concrete, ...r.parameterised];
}

/** Everything the scoreboard counts, read from the repository at `root`. */
export function gatherScoreInputs(root: string): ScoreInputs {
  const { doors, unresolved } = routeDoors(root);
  return {
    routes: doors,
    unresolved,
    matrix: readMatrix(root),
    acts: ADMIN_ACTS,
    dials: VARIABLES,
    tabs: ADMIN_TABS,
    ledger: { rows: PARITY_LEDGER, stillOpen: LEDGER_STILL_OPEN, neverDrawn: LEDGER_NEVER_DRAWN },
    mounts: GARDEN_MOUNTS,
    cuts: CUT_BY_RULING,
    notAdmin: NOT_ADMIN_ROUTES,
    old: { movedTabs: MOVED_TABS, leftAdmin: LEFT_ADMIN, clientRoutes: readClientRoutes() },
  };
}
