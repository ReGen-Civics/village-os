/**
 * WHAT EACH ROUTE'S OWN HANDLER ASKS, READ FROM THE SOURCE, for the scoreboard and its tests.
 *
 * `deriveRoutes` (server/testkit/getRoutes.ts) says which routes exist. This says, for each one, what its handler
 * asks before it acts, by reading the registration's own text with the helpers it calls in its own file folded in,
 * three calls deep (the way shared/adminActs.test.ts reads a handler):
 *
 *   asksAdmin      it asks whether the caller is an admin (`isAdmin`, `userIsAdmin`, `adminOnly`, `isJourney`,
 *                  `plantingAdmins`)
 *   powers         every capability key (shared/capabilities.ts) its text names
 *   asksSignedIn   it asks who is signed in (`authedUser`)
 *
 * WHY IT EXISTS. The list of routes that are not admin's (shared/notAdminRoutes.ts) is kept by hand, family by
 * family, and a hand-kept list fails open. The scoreboard lets what is read here overrule it: a route whose handler
 * asks the admin question, or names a power only a role gives, is never counted as not admin's, whatever family its
 * path falls in. It stays open until an act names it.
 *
 * WHAT IT CANNOT SEE, so nobody reads more into it than is there:
 *
 *   - a door asked in another file (`writeDial` in server/lib/dialWrite.ts, a gate a lib function runs);
 *   - a door mounted as middleware on a prefix (`app.use("/api/x", ...)`);
 *   - whether a named power is the door itself or one branch inside the handler. Naming it is enough to keep the
 *     route open, which errs toward open.
 *
 * So "asks nothing" here never proves a route is public. It only fails to prove it is admin's. The permission matrix
 * is the proof for the routes it holds.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { ALL_CAPABILITIES } from "../../shared/capabilities";
import { deriveRoutes, type DerivedMethodRoute } from "./getRoutes";

export interface RouteDoor extends DerivedMethodRoute {
  asksAdmin: boolean;
  powers: string[];
  asksSignedIn: boolean;
}

interface Source {
  sf: ts.SourceFile;
  /** Every function and constant the file declares, at any depth, by name. */
  declared: Map<string, string>;
  /** Every `app.<verb>(...)` registration, by the line it starts on. */
  registrations: Map<number, string>;
}

const VERBS = new Set(["get", "post", "put", "patch", "delete"]);
const ADMIN_QUESTION = /\bisAdmin\(|\buserIsAdmin\(|\badminOnly\b|\bisJourney\(|\bplantingAdmins\(/;
const SIGNED_IN_QUESTION = /\bauthedUser\(/;
const KEY_LITERAL = /"([a-z][a-z_]*\.[a-z][a-z_.]*)"/g;
const HELPER_CEILING = 6000;

function read(root: string, rel: string, cache: Map<string, Source>): Source {
  const hit = cache.get(rel);
  if (hit) return hit;
  const sf = ts.createSourceFile(rel, fs.readFileSync(path.join(root, rel), "utf8"), ts.ScriptTarget.Latest, true);
  const declared = new Map<string, string>();
  const registrations = new Map<number, string>();
  const visit = (n: ts.Node) => {
    if (ts.isFunctionDeclaration(n) && n.name) declared.set(n.name.text, n.getText(sf));
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) declared.set(n.name.text, n.getText(sf));
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && VERBS.has(n.expression.name.text) && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === "app" && n.arguments.length >= 2) {
      registrations.set(sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, n.getText(sf));
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  const made = { sf, declared, registrations };
  cache.set(rel, made);
  return made;
}

/** What a registration says, with the helpers it calls from its own file folded in, three calls deep. */
function handlerSays(source: Source, line: number): string {
  const own = source.registrations.get(line) ?? "";
  const seen = new Set<string>();
  let text = own;
  let frontier = own;
  for (let depth = 0; depth < 3; depth++) {
    let next = "";
    for (const m of Array.from(frontier.matchAll(/\b([A-Za-z_]\w*)\(/g))) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      const body = source.declared.get(m[1]);
      if (body && body.length < HELPER_CEILING) next += `\n${body}`;
    }
    if (!next) break;
    text += next;
    frontier = next;
  }
  return text;
}

/** Every route the server registers, each with what its own handler asks. */
export function routeDoors(root: string): { doors: RouteDoor[]; unresolved: ReturnType<typeof deriveRoutes>["unresolved"] } {
  const { routes, unresolved } = deriveRoutes(root);
  const known = new Set<string>(ALL_CAPABILITIES);
  const cache = new Map<string, Source>();
  const doors = routes.map((r) => {
    const says = handlerSays(read(root, r.file, cache), r.line);
    const powers = Array.from(new Set(Array.from(says.matchAll(KEY_LITERAL), (m) => m[1]).filter((k) => known.has(k)))).sort();
    return { ...r, asksAdmin: ADMIN_QUESTION.test(says), powers, asksSignedIn: SIGNED_IN_QUESTION.test(says) };
  });
  return { doors, unresolved };
}
