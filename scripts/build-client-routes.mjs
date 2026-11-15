/**
 * The client's routes, written beside the server bundle (dist/client-routes.json)
 * so the server can answer an address no page draws with a 404 status, while
 * still sending the same shell, which draws the "Off the trail" page (NotFound).
 *
 * Derived from client/src/App.tsx by the same reader the QA sweeps use
 * (scripts/qa/routes.mjs), so a new page is known the moment it is routed.
 * Outside dist/public on purpose: it is for the server, and the CI budget
 * measures dist/public. If the file is missing, the server answers 200 for
 * every page exactly as it did before (server/index.ts, the catch-all).
 */
import fs from "node:fs";
import path from "node:path";
import { routes } from "./qa/routes.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "dist", "client-routes.json");

const r = routes();
const patterns = [...r.concrete, ...r.parameterised, "/404"].sort();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ patterns }, null, 1) + "\n");
console.log(`  dist/client-routes.json: ${patterns.length} route pattern(s) from client/src/App.tsx`);
