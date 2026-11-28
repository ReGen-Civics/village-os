/**
 * THE PERMISSION MATRIX: who is let in to every admin and launch route.
 *
 * One row for every admin and launch route the server registers, one column
 * for each of six people, and in every cell the HTTP status the BUILT server
 * answered. The table is committed beside this file
 * (`server/permissionMatrix.snapshot.json`) and a normal run compares against
 * it, cell by cell.
 *
 * ── WHAT IT PROVES ────────────────────────────────────────────────────────
 *
 * That a change moved no permission outcome. The Admin Garden rework runs in
 * three lanes, and its rule is that nothing alters who the server lets in
 * unless a ruling says so. A pull request that leaves the snapshot untouched
 * and this file green changed no cell. A pull request that changes the
 * snapshot shows exactly the cells it moved, one line each, and each moved
 * line needs a ruling named in the pull request.
 *
 * ── THE SIX PEOPLE (the columns, least privileged first) ───────────────────
 *
 *   signedOut    no session
 *   member       an admitted account at the member stage, holding no power
 *   powerHolder  a member, account role `member`, seated in a power group
 *                that carries every power `ROUTE_POWERS` names
 *                (server/lib/operatorRoutes.ts), so this column shows every
 *                admin route a power opens to somebody who is no admin
 *   adminGroup   a member, account role `member`, seated in a power group
 *                that carries admin access and no power
 *                (server/lib/groupAdmin.ts, `userIsAdmin` in server/index.ts)
 *   admin        account role `admin`
 *   founder      account role `founder`
 *
 * All five accounts are admitted at the member stage, so two columns differ
 * only by the role or the power that names them.
 *
 * The village has NOT started its Game. That is the only time all six exist:
 * the founder's extra power ends at launch (`founderPowerStands`,
 * server/lib/gameStart.ts), so a started village would show the founder and
 * the admin as one person.
 *
 * ── THE ROUTES (the rows) ARE READ FROM THE SOURCE ─────────────────────────
 *
 * `deriveRoutes` (server/testkit/getRoutes.ts) parses `server/index.ts` and
 * everything under `server/routes/` with the TypeScript compiler and reads
 * every `app.get/post/put/patch/delete` registration. `IN_SCOPE` below picks
 * the rows by PATTERN: everything under `/api/admin/`, and the launch and
 * setup doors that live elsewhere. So a route somebody adds tomorrow is in
 * the matrix tomorrow, and this file fails, naming it, until the snapshot
 * holds it. A registration whose path the reader cannot resolve fails by file
 * and line; it is never skipped.
 *
 * ── HOW A ROUTE IS PROBED WITHOUT ACTING ───────────────────────────────────
 *
 * Every path parameter is the placeholder `matrix-probe`, and every write
 * carries the empty JSON body `{}`. (`PROBE_WITH` names the few routes
 * probed with something else, and why.) Somebody the gate refuses meets 401
 * or 403. Somebody it lets in meets the handler's own validation: a 400, a 404
 * or a 409 for the most part, a 200 on a read. Every module that can be
 * switched on is switched on first, because a module that is off answers 404
 * to everybody before any gate runs.
 *
 * ── WHAT WAS DONE ABOUT STATE ──────────────────────────────────────────────
 *
 * One probe must never change what a later probe reads.
 *
 *   1. The order is fixed: each person in turn, least privileged first, each
 *      walking the routes in sorted order. Nobody acts before a less
 *      privileged person has read every cell of their own.
 *   2. A write that answers an empty body with a success has done something.
 *      Each such route is named in `ANSWERS_AN_EMPTY_WRITE` with what it did
 *      and why that reaches no cell, and those routes are probed LAST, after
 *      every other cell is recorded. A write that succeeds and is not on that
 *      list fails this file by name, so the next one is a decision and never
 *      a surprise.
 *   3. When the walk is over, every person is asked again who they are
 *      (account role, admin access, the powers they hold). A probe that
 *      changed anybody fails here.
 *   4. The file's last block acts for real: it drives the launch row route
 *      (`POST /api/admin/launch/confirm`) with real rows, as everybody the
 *      admin gate admits and everybody it refuses, and puts each row back.
 *      It runs after the snapshot is compared.
 *
 * ── WHAT IT CANNOT SEE ─────────────────────────────────────────────────────
 *
 *   - A gate that lets somebody in and refuses them on a LATER check with
 *     anything other than 401 or 403. A 404 that means "not yours" reads as
 *     let in.
 *   - A handler that validates the body or looks up its subject BEFORE it
 *     asks who is calling. Every column reads 400 or 404 and the row says
 *     nothing about the gate. The same is true of a module that could not be
 *     switched on: `modulesLeftOff` in the snapshot names them.
 *   - Anything behind a check that depends on the body or on a real row: an
 *     owner's rights over their own record, a refusal that needs a real id.
 *   - The other side of launch. A gate that reads the launch state is
 *     recorded here as it answers BEFORE the Game starts, and only there.
 *   - A power that `ROUTE_POWERS` does not name. The power holder holds
 *     exactly that map's powers, so a route some other key opens reads
 *     refused in that column.
 *   - Whether a response body leaks. This reads status codes and nothing
 *     else.
 *
 * ── HOW TO UPDATE IT ───────────────────────────────────────────────────────
 *
 *     pnpm build
 *     UPDATE_PERMISSION_MATRIX=1 npx vitest run server/permissionMatrix.routes.e2e.test.ts
 *
 * That rewrites the snapshot from the built server and asserts nothing about
 * the cells (the fixture's own controls still run). Commit the snapshot with
 * the change that moved it.
 *
 * A NEW ROUTE WITHOUT A LOCAL BUILD. A pull request that adds a route fails
 * this file until the snapshot holds its line. The run that fails also prints
 * that line, with the six codes the built server answered, in the test shard's
 * log. Read the codes, check they are the ones the route was meant to have,
 * and add the line in sorted order. That is the one edit made by hand. A
 * CHANGED line is never edited by hand: it is regenerated, so the diff is what
 * the server did and never what somebody typed.
 *
 * `PERMISSION_MATRIX_SURVEY=<file>` writes every probe's status and the first
 * line of its answer to a JSON file, for reading why a cell says what it says.
 *
 * ── WHAT A DIFF IN A PULL REQUEST MEANS ────────────────────────────────────
 *
 *   a new line       a new route; read its six codes and check they are the
 *                    ones the route was meant to have
 *   a removed line   a route that is gone, or one that moved out of scope
 *   a changed line   somebody is let in who was refused, or refused who was
 *                    let in, or meets a different answer once inside. The
 *                    first two change a permission and need a ruling.
 *
 * A cell is an exact status code. A route whose exact code is not the same on
 * two fresh runs is recorded by class instead ("refused" for 401 and 403,
 * "let in" for anything else) and named in `RECORDED_BY_CLASS` with the
 * reason; that list is meant to stay short.
 *
 * Boots the BUILT `dist/index.js` against a throwaway schema: run
 * `pnpm build` first. Skips loudly without TEST_DATABASE_URL, and a skip is
 * not a pass. The route list is checked against the snapshot without a
 * database, so that half runs everywhere.
 */
import fs from "fs";
import os from "os";
import path from "path";
import type { Pool } from "mysql2/promise";
import { spawn, type ChildProcess } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb, waitForPortFree } from "./db/testDb";
import { waitForHealth } from "./db/e2eBoot";
import { ROUTE_POWERS } from "./lib/operatorRoutes";
import { deriveRoutes } from "./testkit/getRoutes";

const DB_CONFIGURED = testDbConfigured();
if (!DB_CONFIGURED) {
  console.warn("[permissionMatrix.routes] TEST_DATABASE_URL not set: the probes are SKIPPED. Only the route list is checked.");
}

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, "dist/index.js");
const SNAPSHOT = path.resolve(ROOT, "server/permissionMatrix.snapshot.json");
const UPDATE = process.env.UPDATE_PERMISSION_MATRIX === "1";
const SURVEY = process.env.PERMISSION_MATRIX_SURVEY ?? "";
const HOW_TO_UPDATE =
  "If the change is meant, run `pnpm build` and then " +
  "`UPDATE_PERMISSION_MATRIX=1 npx vitest run server/permissionMatrix.routes.e2e.test.ts`, " +
  "and commit server/permissionMatrix.snapshot.json with it. A cell that moved between refused and let in needs a ruling.";

// Its window is checked by scripts/check-e2e-ports.mjs, never claimed by hand here. The map was full on 2026-11-27,
// so these 200 ports came off the top of server/examples.routes.e2e.test.ts's window, which had 1,500.
const PORT = 12800 + (process.pid % 200);
const BASE = `http://localhost:${PORT}`;
const ADMIN = "permission-matrix-admin";
const PASSWORD = "PermissionMatrix123!";
const POWERS_GROUP = "pm-powers";
const PANEL_GROUP = "pm-panel";
const PLACEHOLDER = "matrix-probe";
const PROBE_TIMEOUT_MS = 30_000;

// ── The columns ─────────────────────────────────────────────────────────────

const IDENTITIES = ["signedOut", "member", "powerHolder", "adminGroup", "admin", "founder"] as const;
type Identity = (typeof IDENTITIES)[number];

/** What each person must be, before the walk and again after it. */
const WHO: Record<Exclude<Identity, "signedOut">, { role: string; adminAccess: boolean }> = {
  member: { role: "member", adminAccess: false },
  powerHolder: { role: "member", adminAccess: false },
  adminGroup: { role: "member", adminAccess: true },
  admin: { role: "admin", adminAccess: true },
  founder: { role: "founder", adminAccess: true },
};

/** Every power the operator map names, which is what the power holder's group carries. */
const MAPPED_POWERS = [...new Set(Object.values(ROUTE_POWERS))].sort();

// ── The rows ────────────────────────────────────────────────────────────────

/**
 * Which registered routes are rows. A PATTERN each, never a route list: the
 * routes under a pattern are read from the source, so a new one joins by
 * existing. Each pattern must match something, so a rename cannot empty one
 * in silence.
 */
const IN_SCOPE: ReadonlyArray<{ name: string; why: string; holds: (routePath: string) => boolean }> = [
  { name: "admin", why: "every route under /api/admin", holds: (p) => p.startsWith("/api/admin/") },
  {
    name: "journey",
    why: "the Journey to Launch document, which asks the admin gate from outside /api/admin (server/routes/journey.ts)",
    holds: (p) => p.startsWith("/api/journey/"),
  },
  {
    name: "steward slate",
    why: "the slate of first stewards a launch ballot carries (server/routes/stewardSlate.ts)",
    holds: (p) => p.endsWith("/steward-slate"),
  },
  {
    name: "hand-over",
    why: "handing the stewards' powers to the village (server/routes/stewardHandover.ts)",
    holds: (p) => p === "/api/governance/powers/hand-to-village" || p.startsWith("/api/governance/powers/hand-to-village/"),
  },
  { name: "test run", why: "the test run a village reads before it votes its Game on (server/routes/dryRun.ts)", holds: (p) => p === "/api/dry-run" },
];

/** A floor on what was read. Reading no routes would find nothing to compare and pass. 517 were read on 2026-11-27. */
const ROUTE_FLOOR = 400;

const NOTHING_DUE = "a job that ran and found nothing to do in a fresh village";
const NOTHING_THERE = "aimed at the placeholder, or at something this village does not have yet; it changed no row and answered success";

/**
 * WRITES THAT ANSWER AN EMPTY BODY WITH A SUCCESS, each with what it did and
 * why no cell can read the difference. They are probed last. A write that
 * succeeds and is not here fails this file by name: read its handler, then
 * either add it with the reason or change the probe so it does not act
 * (`PROBE_WITH`, below).
 */
const ANSWERS_AN_EMPTY_WRITE: Readonly<Record<string, string>> = {
  // Jobs and sweeps a person can start by hand.
  "POST /api/admin/badges/evaluate": `${NOTHING_DUE}: it weighed the badges and awarded none, and the people are asked again after the walk`,
  "POST /api/admin/brand/resync": `${NOTHING_DUE}: the brand had not changed`,
  "POST /api/admin/cycles/close": `${NOTHING_DUE}: no cycle was ready to close`,
  "POST /api/admin/cycles/settlement-proposal": `${NOTHING_DUE}: no moon had ended unsettled`,
  "POST /api/admin/exchange/reconcile": `${NOTHING_DUE}: no swap was waiting`,
  "POST /api/admin/governance/land-due": `${NOTHING_DUE}: no passed vote was waiting to land`,
  "POST /api/admin/hypha/refresh": `${NOTHING_DUE}: nothing is bound to Hypha`,
  "POST /api/admin/library/sweep": `${NOTHING_DUE}: nothing is on loan`,
  "POST /api/admin/member-tasks/bridge/send": `${NOTHING_DUE}: nothing was waiting to be sent`,
  "POST /api/admin/member-tasks/bridge/sync": `${NOTHING_DUE}: the bridge has no key, so it synced nobody`,
  "POST /api/admin/network/sync": `${NOTHING_DUE}: the village has no peers`,
  "POST /api/admin/open-proposals/voice/transcribe-waiting": `${NOTHING_DUE}: no voice note was waiting`,
  "POST /api/admin/proposals/check": `${NOTHING_DUE}: it checked the empty list it was sent`,
  "POST /api/admin/quests/mark-examples": `${NOTHING_DUE}: it marked the empty list it was sent`,
  "POST /api/admin/role-renewals/renew-all": `${NOTHING_DUE}: no holding was near its end, so none was renewed`,
  "POST /api/admin/seasons/roll": `${NOTHING_DUE}: without a confirmation it is a dry run and writes nothing`,
  "POST /api/admin/stays/post-nights": `${NOTHING_DUE}: nobody is staying`,
  "POST /api/admin/tools/check-links": `${NOTHING_DUE}: there are no tools to check`,
  "POST /api/admin/visitors/invitations/decline": `${NOTHING_DUE}: it declined the empty list it was sent`,
  "POST /api/admin/visitors/invitations/promote": `${NOTHING_DUE}: it promoted the empty list it was sent`,
  // Writes that found nothing to change.
  "DELETE /api/admin/confidentiality/document": `${NOTHING_THERE}: there was no document to remove`,
  "DELETE /api/admin/land/imagery": `${NOTHING_THERE}: there was no imagery to remove`,
  "DELETE /api/admin/seasons/patterns/:id/members": NOTHING_THERE,
  "POST /api/admin/member-tasks/review/:feedbackId": NOTHING_THERE,
  "POST /api/admin/member-tasks/role-queue/:id": NOTHING_THERE,
  "PUT /api/admin/agent-accounts/full-access": `${NOTHING_THERE}: full access was off and stayed off`,
  "PUT /api/admin/events/:id/slots/:slotId": NOTHING_THERE,
  "PUT /api/admin/stays/accommodations/:id/prices": NOTHING_THERE,
  "PUT /api/admin/tools/order": `${NOTHING_THERE}: an empty order is the whole order of no tools`,
  // Writes that stored something. None of it is read by a gate, and no later probe addresses it: every id probed is the placeholder.
  "POST /api/admin/comms/letter-previews/send": "queued the letter previews to the caller's own address; with no mail key none was sent",
  "POST /api/admin/comms/settings/test": "queued one test letter to the caller's own address; with no mail key it was not sent",
  "POST /api/admin/exchange/tokens/:slug/halt": "halted trading in the placeholder token, whose settings row the PUT sorted just before it had stored",
  "POST /api/admin/org/drafts": "made an empty org chart draft",
  "POST /api/admin/org/roles": "made an unnamed seat nobody holds, which carries no power group",
  "POST /api/admin/seasons/patterns": "made an empty season pattern",
  "PUT /api/admin/brand": "saved the brand overlay with nothing in it changed",
  "PUT /api/admin/comms/settings/sender": "cleared the mail sender, which a fresh village has not set",
  "PUT /api/admin/comms/settings/webhook": "cleared the delivery-report secret, which a fresh village has not set",
  "PUT /api/admin/content/:section": "stored an empty page section named by the placeholder, which no page reads",
  "PUT /api/admin/email-config": "saved the mail routing addresses with nothing in them changed",
  "PUT /api/admin/exchange/tokens/:slug": "stored exchange settings for a token named by the placeholder, which does not exist",
  "PUT /api/admin/investor-summary": "replaced the investor summary with an empty document",
  "PUT /api/admin/map/vocabulary": "stored an empty map vocabulary",
  "PUT /api/admin/map/walk": "stored an empty map walk",
  "PUT /api/admin/member-tasks/access/:userId": "stored task access as off for a member named by the placeholder, who does not exist",
  "PUT /api/admin/member-tasks/bridge/notes": "stored the bridge's notes as held, which is what anything but a release stores",
  "PUT /api/admin/settings": "saved the site settings with nothing in them changed",
  "PUT /api/admin/village-paths": "stored the village's path words with no override",
  "PUT /api/admin/visit-config": "replaced the visit page's settings with an empty document",
  "PUT /api/admin/work-with-us-config": "saved the work-with-us settings with nothing in them changed",
};

/**
 * ROUTES RECORDED BY CLASS, each with why its exact code is not the same on
 * two fresh runs. Keep it short: a route here can change its answer once
 * inside and this file will not see it.
 */
const RECORDED_BY_CLASS: Readonly<Record<string, string>> = {};

interface Row {
  key: string;
  method: string;
  path: string;
}

/** The rows, sorted by path and then verb, so one feature's routes sit together in the snapshot. */
function rowsFromSource(): { rows: Row[]; unresolved: string[]; emptyPatterns: string[] } {
  const derived = deriveRoutes(ROOT);
  const seen = new Map<string, Row>();
  for (const r of derived.routes) {
    if (!IN_SCOPE.some((s) => s.holds(r.path))) continue;
    const key = `${r.method} ${r.path}`;
    seen.set(key, { key, method: r.method, path: r.path });
  }
  const rows = [...seen.values()].sort((a, b) => (a.path === b.path ? cmp(a.method, b.method) : cmp(a.path, b.path)));
  return {
    rows,
    unresolved: derived.unresolved.map((u) => `${u.method} ${u.text} at ${u.file}:${u.line}`),
    emptyPatterns: IN_SCOPE.filter((s) => !rows.some((r) => s.holds(r.path))).map((s) => `${s.name}: ${s.why}`),
  };
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * ROUTES PROBED WITH SOMETHING OTHER THAN THE PLACEHOLDER AND THE EMPTY BODY,
 * each with why. Two reasons only: the path's SHAPE decides whether the
 * handler runs at all, or the empty body would rewrite something a gate
 * stands on. A body the gate itself depends on stays in "what it cannot see".
 */
const PROBE_WITH: Readonly<Record<string, { url?: string; body?: unknown; why: string }>> = {
  "POST /api/admin/call-tasks/:id/:action": {
    url: `/api/admin/call-tasks/${PLACEHOLDER}/accept`,
    why: "an action that is neither accept nor dismiss falls through to the catch-all 404 before the gate is asked",
  },
  "PUT /api/admin/seasons": {
    body: { timezone: PLACEHOLDER },
    why:
      "an empty body saves the season document and restamps every seat's term onto the calendar, and a power group's holding is what " +
      "admin access through a group stands on; a time zone that does not exist is refused after the gate and before anything is stored",
  },
};

/** The URL a route is probed at: every parameter the placeholder, an Express 5 wildcard one segment. */
const probeUrl = (row: Row): string =>
  PROBE_WITH[row.key]?.url ?? row.path.replace(/:[A-Za-z_]+\??/g, PLACEHOLDER).replace(/\{\*[A-Za-z_]+\}/g, PLACEHOLDER);

/** The body a route is probed with: none on a read, `{}` on a write. */
const probeBody = (row: Row): unknown => (row.method === "GET" ? undefined : PROBE_WITH[row.key]?.body ?? {});

// ── The snapshot ────────────────────────────────────────────────────────────

type Cell = number | "refused" | "let in";

interface Snapshot {
  about: string;
  identities: string[];
  modulesLeftOff: string[];
  routes: Record<string, Cell[]>;
}

const classOf = (status: number): "refused" | "let in" => (status === 401 || status === 403 ? "refused" : "let in");

function readSnapshot(): Snapshot | null {
  if (!fs.existsSync(SNAPSHOT)) return null;
  return JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")) as Snapshot;
}

/** One route to a line, so a moved cell is one changed line in a pull request. */
function renderSnapshot(s: Snapshot): string {
  const lines = Object.keys(s.routes).map((k) => `    ${JSON.stringify(k)}: [${s.routes[k].map((c) => JSON.stringify(c)).join(", ")}]`);
  return [
    "{",
    `  "about": ${JSON.stringify(s.about)},`,
    `  "identities": [${s.identities.map((i) => JSON.stringify(i)).join(", ")}],`,
    `  "modulesLeftOff": [${s.modulesLeftOff.map((m) => JSON.stringify(m)).join(", ")}],`,
    '  "routes": {',
    lines.join(",\n"),
    "  }",
    "}",
    "",
  ].join("\n");
}

const ABOUT =
  "The permission matrix: the HTTP status the built server answers each of six people on every admin and launch route, " +
  "probed with placeholder ids and an empty body, in a village that has not started its Game. " +
  "Written by server/permissionMatrix.routes.e2e.test.ts, whose header says what this proves, what it cannot see and how to update it. " +
  "Never edit by hand.";

// ── The server ──────────────────────────────────────────────────────────────

let child: ChildProcess | undefined;
let testDb: TestDb | undefined;
let dataDir = "";
let pool: Pool | undefined;
const serverLogs: string[] = [];
const tokens: Record<Identity, string> = { signedOut: "", member: "", powerHolder: "", adminGroup: "", admin: "", founder: "" };
let modulesLeftOff: string[] = [];

interface Answer {
  status: number;
  json: any;
  text: string;
}

async function call(method: string, route: string, body: unknown, token: string): Promise<Answer> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(BASE + route, { // module-review-ok: the test client dialling the built server on localhost, as every e2e suite does
      method,
      signal: ctl.signal,
      redirect: "manual",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // The status is the cell, and it has arrived. A body that never ends (a stream) is read for as long as the timer allows.
    const status = res.status;
    const text = await res.text().catch(() => "");
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* non-JSON stays visible through text */ }
    return { status, json, text };
  } catch (err: any) {
    return { status: -1, json: null, text: String(err?.name ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

const asFounder = (method: string, route: string, body?: unknown) => call(method, route, body, tokens.founder);

async function register(name: string, slug: string): Promise<{ token: string; id: string }> {
  const r = await call("POST", "/api/auth/register", { name, email: `${slug}-${PORT}@example.test`, password: PASSWORD, paths: ["resident"] }, "");
  expect(r.status, `${name} must register: ${r.text.slice(0, 300)}`).toBe(200);
  return { token: String(r.json?.token ?? ""), id: String(r.json?.user?.id ?? "") };
}

/** Every module that will go public, public. Dependencies settle over a few passes. Returns the ones that would not. */
async function everyModuleOn(): Promise<string[]> {
  const list = await asFounder("GET", "/api/admin/modules");
  expect(list.status, list.text.slice(0, 300)).toBe(200);
  const mods: Array<{ id: string; core?: boolean }> = Array.isArray(list.json) ? list.json : list.json?.modules ?? [];
  const ids = mods.filter((m) => !m.core).map((m) => String(m.id));
  expect(ids.length, "the module list must come back").toBeGreaterThan(5);
  const on = new Set<string>();
  for (let pass = 0; pass < 4; pass++) {
    for (const id of ids) {
      if (on.has(id)) continue;
      const r = await asFounder("PUT", `/api/admin/modules/${id}/lifecycle`, { lifecycle: "public", examples: false });
      if (r.status === 200) on.add(id);
    }
  }
  return ids.filter((id) => !on.has(id)).sort();
}

/** Who this session is, as the server tells the client: account role, admin access, the powers held. */
async function whoIs(who: Exclude<Identity, "signedOut">): Promise<{ role: string; adminAccess: boolean; powers: string[] }> {
  const profile = await call("GET", "/api/profile", undefined, tokens[who]);
  expect(profile.status, `${who} must still hold a session: ${profile.text.slice(0, 200)}`).toBe(200);
  const caps = await call("GET", "/api/me/capabilities", undefined, tokens[who]);
  expect(caps.status, `${who} must read their own powers: ${caps.text.slice(0, 200)}`).toBe(200);
  return {
    role: String(profile.json?.role ?? ""),
    adminAccess: profile.json?.adminAccess === true,
    powers: ([...(caps.json?.capabilities ?? [])] as string[]).sort(),
  };
}

/** The six people are who the header says they are. Asked before the walk and again after it. */
async function assertThePeople(when: string): Promise<void> {
  const seen = {} as Record<Exclude<Identity, "signedOut">, Awaited<ReturnType<typeof whoIs>>>;
  for (const who of IDENTITIES) {
    if (who === "signedOut") continue;
    seen[who] = await whoIs(who);
    expect({ role: seen[who].role, adminAccess: seen[who].adminAccess }, `${who}, ${when}`).toEqual(WHO[who]);
  }
  const mapped = new Set<string>(MAPPED_POWERS);
  const mappedHeldBy = (who: Exclude<Identity, "signedOut">) => seen[who].powers.filter((p) => mapped.has(p));
  expect(mappedHeldBy("member"), `the member holds none of the operator map's powers, ${when}`).toEqual([]);
  expect(mappedHeldBy("adminGroup"), `admin access through a group is no power, ${when}`).toEqual([]);
  expect(mappedHeldBy("powerHolder"), `the power holder holds every power the operator map names, ${when}`).toEqual(MAPPED_POWERS);
  expect(seen.adminGroup.powers, `the admin group gives its holder no power a member lacks, ${when}`).toEqual(seen.member.powers);
  expect((await call("GET", "/api/profile", undefined, "")).status, `no session is no session, ${when}`).toBe(401);
}

beforeAll(async () => {
  if (!DB_CONFIGURED) return;
  if (!fs.existsSync(DIST)) {
    throw new Error(`${DIST} is missing. Run \`pnpm build\` before the permission matrix.`);
  }
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "village-permission-matrix-"));
  // Before launch: the only time the founder and the admin are two people (see the header).
  testDb = await provisionTestDb({ gameStarted: false });
  pool = testPool(testDb, { connectionLimit: 2 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
  // Written before boot so the role cache loads them.
  for (const [id, name, caps, grantsAdmin, order] of [
    [POWERS_GROUP, "Matrix Powers", MAPPED_POWERS, 0, 90],
    [PANEL_GROUP, "Matrix Panel", [], 1, 91],
  ] as const) {
    await pool.query( // module-review-ok: a fixture on the scratch schema this suite provisioned
      "INSERT INTO roles (id, name, description, capabilities, sort_order, grants_admin) VALUES (?,?,?,?,?,?)",
      [id, name, `${name}, a fixture group.`, JSON.stringify(caps), order, grantsAdmin],
    );
  }

  await waitForPortFree(PORT);
  child = spawn(process.execPath, [DIST], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      SCHEDULER_ENABLED: "0",
      DATA_DIR: dataDir,
      DATABASE_URL: testDb.url,
      ADMIN_PASSWORD: ADMIN,
      AUTH_TOKEN_SECRET: "permission-matrix-token-secret", // module-review-ok: a fixture signing secret for a throwaway server on a scratch schema, same as every e2e suite
      VILLAGE_SECRETS_KEY: "2e".repeat(32), // module-review-ok: fixture sealing key, same as every e2e suite
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      BACKUP_EXPORT_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => serverLogs.push(String(d)));
  child.stderr?.on("data", (d) => serverLogs.push(String(d)));
  await waitForHealth({ base: BASE, logs: serverLogs, child });

  const boot = await call("POST", "/api/admin/bootstrap", { password: ADMIN, email: `founder-${PORT}@example.test`, name: "Matrix Founder" }, "");
  const claim = decodeURIComponent(String(boot.json?.claimUrl ?? "").match(/token=([^&]+)/)?.[1] ?? "");
  const setPw = await call("POST", "/api/auth/set-password", { token: claim, password: PASSWORD }, "");
  tokens.founder = String(setPw.json?.token ?? "");
  expect(tokens.founder, "the founder must hold a session").toBeTruthy();

  const people = {
    member: await register("Mira Plain", "pm-member"),
    powerHolder: await register("Pau Keys", "pm-power"),
    adminGroup: await register("Gia Panel", "pm-group"),
    admin: await register("Ada Role", "pm-admin"),
  };
  for (const who of ["member", "powerHolder", "adminGroup", "admin"] as const) tokens[who] = people[who].token;
  // Everybody is admitted, the founder included: a founder below the member rung is refused by doors that open there.
  const founderId = String(setPw.json?.user?.id ?? "");
  expect(founderId, "the founder must have an id").toBeTruthy();
  for (const [who, id] of [["member", people.member.id], ["powerHolder", people.powerHolder.id], ["adminGroup", people.adminGroup.id], ["admin", people.admin.id], ["founder", founderId]] as const) {
    const staged = await asFounder("PUT", `/api/admin/players/${id}/stage`, { stageId: "member" });
    expect(staged.status, `${who} must be admitted: ${staged.text.slice(0, 300)}`).toBe(200);
  }
  const seatedPowers = await asFounder("POST", `/api/admin/roles/${POWERS_GROUP}/holders`, { userId: people.powerHolder.id, action: "add" });
  expect(seatedPowers.status, seatedPowers.text.slice(0, 300)).toBe(200);
  const seatedPanel = await asFounder("POST", `/api/admin/roles/${PANEL_GROUP}/holders`, { userId: people.adminGroup.id, action: "add" });
  expect(seatedPanel.status, seatedPanel.text.slice(0, 300)).toBe(200);
  // A registered address is unproved, and the route asks the founder to say they know (R104, server/lib/founderGrant.ts).
  const raised = await asFounder("PUT", `/api/admin/users/${people.admin.id}/role`, { role: "admin", addressUnprovedOk: true });
  expect(raised.status, raised.text.slice(0, 300)).toBe(200);

  modulesLeftOff = await everyModuleOn();
}, 300_000);

afterAll(async () => {
  child?.kill();
  await pool?.end();
  await testDb?.drop();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

// ── The route list, which needs no database ─────────────────────────────────

describe("the permission matrix reads its routes from the source", () => {
  const source = rowsFromSource();

  it("reads every route registration, and every pattern in scope matches something", () => {
    expect(source.unresolved, "a registration this reader cannot resolve is a route the matrix would never probe").toEqual([]);
    expect(source.emptyPatterns, "a pattern in IN_SCOPE matches no route, so a rename took its routes out of the matrix").toEqual([]);
    expect(source.rows.length, "the reader has stopped reading the server").toBeGreaterThanOrEqual(ROUTE_FLOOR);
  });

  it("every named exception is a route that exists", () => {
    const keys = new Set(source.rows.map((r) => r.key));
    expect(Object.keys(ANSWERS_AN_EMPTY_WRITE).filter((k) => !keys.has(k)), "ANSWERS_AN_EMPTY_WRITE names a route that is gone").toEqual([]);
    expect(Object.keys(RECORDED_BY_CLASS).filter((k) => !keys.has(k)), "RECORDED_BY_CLASS names a route that is gone").toEqual([]);
    expect(Object.keys(PROBE_WITH).filter((k) => !keys.has(k)), "PROBE_WITH names a route that is gone").toEqual([]);
  });

  it.skipIf(UPDATE)("the snapshot holds exactly the routes the server registers", () => {
    const snapshot = readSnapshot();
    expect(snapshot, `server/permissionMatrix.snapshot.json is missing. ${HOW_TO_UPDATE}`).not.toBeNull();
    const held = new Set(Object.keys(snapshot!.routes));
    const live = new Set(source.rows.map((r) => r.key));
    const notInSnapshot = [...live].filter((k) => !held.has(k));
    const gone = [...held].filter((k) => !live.has(k));
    expect(
      { "routes the server registers that the snapshot does not hold": notInSnapshot, "routes the snapshot holds that are gone": gone },
      `The permission matrix and the server disagree about which routes exist. ${HOW_TO_UPDATE}`,
    ).toEqual({ "routes the server registers that the snapshot does not hold": [], "routes the snapshot holds that are gone": [] });
    expect(snapshot!.identities, "the snapshot's columns").toEqual([...IDENTITIES]);
  });
});

// ── The walk ────────────────────────────────────────────────────────────────

describe.skipIf(!DB_CONFIGURED)("the permission matrix, against the built server", () => {
  const source = rowsFromSource();
  const observed = new Map<string, number[]>();
  const survey: Array<{ route: string; who: Identity; status: number; says: string }> = [];

  it("the six people are who the header says they are", async () => {
    await assertThePeople("before the walk");
  });

  it("probes every route as every person, least privileged first", async () => {
    const last = new Set(Object.keys(ANSWERS_AN_EMPTY_WRITE));
    const passes = [source.rows.filter((r) => !last.has(r.key)), source.rows.filter((r) => last.has(r.key))];
    for (const rows of passes) {
      for (const who of IDENTITIES) {
        const column = IDENTITIES.indexOf(who);
        for (const row of rows) {
          const a = await call(row.method, probeUrl(row), probeBody(row), tokens[who]);
          const cells = observed.get(row.key) ?? new Array<number>(IDENTITIES.length).fill(0);
          cells[column] = a.status;
          observed.set(row.key, cells);
          survey.push({ route: row.key, who, status: a.status, says: a.text.slice(0, 200).split("\n")[0] });
        }
      }
    }
    if (SURVEY) fs.writeFileSync(SURVEY, JSON.stringify({ modulesLeftOff, probes: survey }, null, 1));

    const unanswered = survey.filter((p) => p.status < 100).map((p) => `${p.route} as ${p.who}: ${p.says}`);
    expect(unanswered, "a probe that got no answer has no cell").toEqual([]);
  }, 900_000);

  it("no write answered an empty body with a success, outside the named list", () => {
    const acted = [...new Set(survey.filter((p) => !p.route.startsWith("GET ") && p.status >= 200 && p.status < 300).map((p) => p.route))];
    const unnamed = acted.filter((k) => !(k in ANSWERS_AN_EMPTY_WRITE));
    const idle = Object.keys(ANSWERS_AN_EMPTY_WRITE).filter((k) => !acted.includes(k));
    expect(
      unnamed,
      "These writes answered an empty body with a success, so the probe DID something. Read each handler, then name it in " +
        "ANSWERS_AN_EMPTY_WRITE with what it did and why no cell reads the difference, or change the probe so it does not act.",
    ).toEqual([]);
    expect(idle, "ANSWERS_AN_EMPTY_WRITE names a write that no longer succeeds on an empty body. Delete the line.").toEqual([]);
  });

  it("the walk changed nobody: the six people are still who they were", async () => {
    await assertThePeople("after the walk");
  });

  it("matches the committed snapshot, cell by cell", () => {
    const routes: Record<string, Cell[]> = {};
    for (const row of source.rows) {
      const cells = observed.get(row.key);
      expect(cells, `${row.key} was never probed`).toBeDefined();
      routes[row.key] = row.key in RECORDED_BY_CLASS ? cells!.map(classOf) : [...cells!];
    }
    const now: Snapshot = { about: ABOUT, identities: [...IDENTITIES], modulesLeftOff, routes };

    if (UPDATE) {
      fs.writeFileSync(SNAPSHOT, renderSnapshot(now));
      console.warn(`[permissionMatrix.routes] wrote ${Object.keys(routes).length} routes x ${IDENTITIES.length} people to ${path.relative(ROOT, SNAPSHOT)}. Nothing was compared.`);
      return;
    }

    const snapshot = readSnapshot();
    expect(snapshot, `server/permissionMatrix.snapshot.json is missing. ${HOW_TO_UPDATE}`).not.toBeNull();
    const moved: string[] = [];
    const unheld: string[] = [];
    for (const key of Object.keys(routes)) {
      const was = snapshot!.routes[key];
      if (!was) {
        // The route-list test above fails by name for this route. Here is its line, as the built server answered.
        unheld.push(`    ${JSON.stringify(key)}: [${routes[key].map((c) => JSON.stringify(c)).join(", ")}],`);
        continue;
      }
      const cells = routes[key]
        .map((c, i) => (c === was[i] ? null : `${IDENTITIES[i]} ${JSON.stringify(was[i])} -> ${JSON.stringify(c)}`))
        .filter((c): c is string => c !== null);
      if (cells.length) moved.push(`${key}: ${cells.join(", ")}`);
    }
    // Said as a FAILURE, so the lines reach the log: this suite's console is shown only for a test that failed.
    expect(
      unheld.length,
      `${unheld.length} route(s) the snapshot does not hold yet. Below is each one's line, as the built server answered just now. ` +
        `Read the six codes, then add each line to "routes" in ${path.relative(ROOT, SNAPSHOT).split(path.sep).join("/")}, in sorted order:\n${unheld.join("\n")}\n`,
    ).toBe(0);
    expect(moved, `These cells of the permission matrix moved. ${HOW_TO_UPDATE}`).toEqual([]);
    expect(modulesLeftOff, `The modules the fixture could not switch on changed, so their routes read 404 for everybody (or stopped doing so). ${HOW_TO_UPDATE}`).toEqual(snapshot!.modulesLeftOff);
  });
});

// ── Who answers a launch row, driven with a real row ────────────────────────

/**
 * WHOEVER THE ADMIN GATE ADMITS ANSWERS A LAUNCH ROW (Rye, 27 Nov 2026, on
 * marking a row done, taking that back and declining: "Admins can too").
 *
 * `POST /api/admin/launch/confirm` marks a launch row done, takes that back,
 * or declines it. It asks the admin gate and nothing narrower, so an admin, a
 * member with admin access through a power group and a founder all answer a
 * row, and the answer carries the name of whoever gave it. A narrower rule
 * (founders only) was built on this branch and taken out again on that
 * ruling. The matrix above pins the six codes on an empty body. This drives
 * the route with real rows, because a 400 on an empty body cannot tell "let
 * in" from "let in and then refused by name".
 *
 * Opening the vote, the steward list and the hand-over stay a founder's; the
 * matrix holds their cells and their own suites drive them.
 *
 * It runs LAST and after every cell is compared: it changes the launch record,
 * and puts each row back as it found it.
 */
describe.skipIf(!DB_CONFIGURED)("whoever the admin gate admits answers a launch row", () => {
  /** A row somebody confirms by hand, and the one row that may be declined. */
  const MANUAL = "backups-drilled";
  const DECLINABLE = "issuance-cap";
  const answers = [{ id: MANUAL, done: true }, { id: MANUAL, done: false }, { id: DECLINABLE, done: "declined" }, { id: DECLINABLE, done: false }];
  const ADMITTED = ["adminGroup", "admin", "founder"] as const;
  const REFUSED = ["signedOut", "member", "powerHolder"] as const;
  const confirm = (body: unknown, who: Identity) => call("POST", "/api/admin/launch/confirm", body, tokens[who]);

  /** One row as the checklist reads it, asked as `who`. */
  async function row(id: string, who: Identity = "founder"): Promise<{ state: string; confirmedBy: string | null; declinedBy: string | null }> {
    const r = await call("GET", "/api/admin/launch", undefined, tokens[who]);
    expect(r.status, `${who} reads the checklist: ${r.text.slice(0, 200)}`).toBe(200);
    const found = (r.json?.items ?? []).find((i: any) => i.id === id);
    expect(found, `the checklist ${who} reads has a row ${id}`).toBeTruthy();
    return { state: String(found.state), confirmedBy: found.confirmedBy ?? null, declinedBy: found.declinedBy ?? null };
  }

  it("covers all six identities between the admitted and the refused", () => {
    expect([...ADMITTED, ...REFUSED].sort()).toEqual([...IDENTITIES].sort());
  });

  it("refuses whoever the admin gate refuses, and no refused answer changes a row", async () => {
    const before = { manual: await row(MANUAL), declinable: await row(DECLINABLE) };
    expect(before.manual.confirmedBy, "the fixture starts with the row unconfirmed").toBeNull();
    expect(before.declinable.declinedBy, "the fixture starts with the row undeclined").toBeNull();
    for (const who of REFUSED) {
      for (const body of answers) {
        const r = await confirm(body, who);
        expect(r.status, `${who} sending ${JSON.stringify(body)}: ${r.text.slice(0, 200)}`).toBe(401);
      }
    }
    expect({ manual: await row(MANUAL), declinable: await row(DECLINABLE) }).toEqual(before);
  });

  it("lets an admin, a group holder and a founder mark a row done, take it back, decline a row, and take that back", async () => {
    const names = new Set<string>();
    for (const who of ADMITTED) {
      const done = await confirm({ id: MANUAL, done: true }, who);
      expect(done.status, `${who} marks done: ${done.text.slice(0, 300)}`).toBe(200);
      const confirmed = await row(MANUAL);
      expect(confirmed.state, who).toBe("ok");
      expect(confirmed.confirmedBy, `the confirmation carries the name of the ${who} who gave it`).toBeTruthy();
      names.add(String(confirmed.confirmedBy));

      const back = await confirm({ id: MANUAL, done: false }, who);
      expect(back.status, `${who} takes it back: ${back.text.slice(0, 300)}`).toBe(200);
      expect((await row(MANUAL)).confirmedBy, who).toBeNull();

      const declined = await confirm({ id: DECLINABLE, done: "declined" }, who);
      expect(declined.status, `${who} declines: ${declined.text.slice(0, 300)}`).toBe(200);
      expect((await row(DECLINABLE)).declinedBy, `the decline carries the name of the ${who} who gave it`).toBeTruthy();

      const undone = await confirm({ id: DECLINABLE, done: false }, who);
      expect(undone.status, `${who} takes the decline back: ${undone.text.slice(0, 300)}`).toBe(200);
      expect((await row(DECLINABLE)).declinedBy, who).toBeNull();
    }
    // Three people answered, and each answer was attributed to the one who gave it.
    expect(names.size, `the three answers were attributed to three people: ${[...names].join(", ")}`).toBe(ADMITTED.length);
  });

  /**
   * THE RULING, PINNED AS BEHAVIOUR. Rye, 27 Nov 2026, on marking a launch step done, taking that back and
   * declining: "Admins can too". Opening the vote, the steward list and the hand-over stay a founder's.
   *
   * The snapshot above only says the server agrees with a table, and a table can agree with the wrong server:
   * for a day it held 403 for an admin on this route and every check was green. So this says what the table
   * must hold, in the ruling's own terms: an admin who is NOT a founder answers a launch row, and each door that
   * stays a founder's refuses that same admin by name while it lets the founder through to its own checks.
   */
  it('"Admins can too": an admin who is not a founder marks a launch step done, and the founders\' doors still refuse that admin', async () => {
    const admin = await whoIs("admin");
    expect(admin.role, "the admin in this fixture is an admin by role, and not a founder").toBe("admin");
    expect((await whoIs("founder")).role).toBe("founder");

    // Marking a step done, and taking it back: 200 for an admin who is not a founder.
    const done = await confirm({ id: MANUAL, done: true }, "admin");
    expect(done.status, `an admin marks a launch step done: ${done.text.slice(0, 300)}`).toBe(200);
    expect((await row(MANUAL)).state).toBe("ok");
    const back = await confirm({ id: MANUAL, done: false }, "admin");
    expect(back.status, `an admin takes it back: ${back.text.slice(0, 300)}`).toBe(200);
    expect((await row(MANUAL)).confirmedBy).toBeNull();

    // Opening the vote is a founder's act. The steward list is named in the same call (migration 0220), so it
    // stands behind the same door: with a list or without one, the admin is refused before the body is read.
    for (const body of [{}, { stewards: [] }, { stewards: ["someone"] }]) {
      const asAdmin = await call("POST", "/api/admin/launch/propose", body, tokens.admin);
      expect(asAdmin.status, `an admin opening the vote with ${JSON.stringify(body)}: ${asAdmin.text.slice(0, 200)}`).toBe(403);
      expect(asAdmin.json?.error).toBe("Asking the village to start its Game is a founder's act");
    }
    const founderOpens = await call("POST", "/api/admin/launch/propose", {}, tokens.founder);
    expect([401, 403], `the founder is let through that door to its own checks: ${founderOpens.status} ${founderOpens.text.slice(0, 200)}`).not.toContain(founderOpens.status);

    // Handing a power to the village is a founder's act.
    const adminHands = await call("POST", "/api/governance/powers/hand-to-village", {}, tokens.admin);
    expect(adminHands.status, `an admin handing a power over: ${adminHands.text.slice(0, 200)}`).toBe(403);
    const founderHands = await call("POST", "/api/governance/powers/hand-to-village", {}, tokens.founder);
    expect([401, 403], `the founder is let through that door to its own checks: ${founderHands.status} ${founderHands.text.slice(0, 200)}`).not.toContain(founderHands.status);
  });

  it("an admin and a group holder read the same rows a founder does", async () => {
    const asFounderReads = (await call("GET", "/api/admin/launch", undefined, tokens.founder)).json?.items ?? [];
    expect(asFounderReads.length, "the checklist has rows").toBeGreaterThan(5);
    for (const who of ["adminGroup", "admin"] as const) {
      const r = await call("GET", "/api/admin/launch", undefined, tokens[who]);
      expect(r.status, `${who} reads the checklist`).toBe(200);
      expect((r.json?.items ?? []).map((i: any) => i.id), `${who} reads the same rows a founder does`).toEqual(asFounderReads.map((i: any) => i.id));
    }
  });
});
