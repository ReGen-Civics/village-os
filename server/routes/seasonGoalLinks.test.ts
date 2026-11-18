/**
 * MOVING A SEASON'S GOAL LINKS, over real HTTP and the scratch schema.
 *
 * The shape that needs it: season-1 holds three reworded goals under new ids,
 * and the upcoming season still holds one of the OLD ids word for word, so its
 * links must stay on it.
 *
 *   - only rows that belong to season-1 move, in all six tables, words included
 *   - the upcoming season's rows (same old id) and an earlier season's rows stay
 *   - `to` not held by the season is refused; `from` still held is refused
 *   - a second run moves nothing; a dry run counts and writes nothing
 *   - it is a `setting` the proposal route files, and accepting it moves the links
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { usersRepo } from "../repos/users";
import { LUNAR_CLOCK } from "../../shared/cycleClock";
import { registerGoalLinkRemap } from "./seasonGoalLinks";
import { register as registerProposals } from "./proposedChanges";
import { checkProposal, routeExistsIn } from "../lib/proposedChanges";

const configured = testDbConfigured();
if (!configured) console.warn("[seasonGoalLinks] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const ADMIN = { id: "u-admin", name: "Fern Oak", email: "fern@example.test" };
const AGENT = { id: "u-agent", name: "Helper Agent", email: "agent@example.test" };
const STRANGER = { id: "u-str", name: "Sam Field", email: "sam@example.test" };

// Old ids a rewording replaced, and the new ids the season holds.
const OLD_FUNDING = "g0a0000000a1";
const NEW_FUNDING = "g0b0000000b1";
const OLD_WATER = "g0a0000000a2";
const NEW_WATER = "g0b0000000b2";
const OLD_COMMUNITY = "g0a0000000a3";
const NEW_COMMUNITY = "g0b0000000b3";

const SEASONS = [
  { id: "season-0", name: "Founding", startsOn: "2026-05-01", endsOn: "2026-08-01", goals: [] },
  {
    id: "season-1",
    name: "First season",
    startsOn: "2026-08-01",
    endsOn: "2026-12-01",
    goals: [
      { id: NEW_FUNDING, text: "Fund the next year", done: false },
      { id: NEW_WATER, text: "Clean water for every home", done: false },
      { id: NEW_COMMUNITY, text: "A thriving community", done: false },
    ],
  },
  {
    id: "season-1792808851567",
    name: "Next season",
    startsOn: "2026-12-01",
    endsOn: "2027-03-01",
    goals: [{ id: OLD_COMMUNITY, text: "A thriving community: shared meals and walks", done: false }],
  },
];

const IN_S1 = "2026-10-10 15:00:00";
const IN_UP = "2027-01-12 15:00:00";
const IN_S0 = "2026-06-10 15:00:00";
const MOON_S1 = LUNAR_CLOCK.boundsFor(new Date("2026-10-10T12:00:00Z")).id;
const MOON_UP = LUNAR_CLOCK.boundsFor(new Date("2027-01-12T12:00:00Z")).id;

describe.skipIf(!configured)("moving a season's goal links, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let port = 0;
  let app: express.Express;

  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 8 });
    const users = usersRepo(pool);
    for (const p of [ADMIN, AGENT, STRANGER]) await users.add({ id: p.id, name: p.name, email: p.email, passwordHash: "x", paths: [] } as any);
    await q("UPDATE users SET is_agent = 1 WHERE id = ?", [AGENT.id]);

    const authedUser = async (req: any) => {
      const who = String(req.headers.authorization ?? "").replace("Bearer ", "");
      return who ? await usersRepo(pool).byId(who) : null;
    };
    const isAdmin = async (req: any) => [ADMIN.id, AGENT.id].includes(String((await authedUser(req))?.id ?? ""));
    const seasonState = () => ({ current: SEASONS[1], seasons: SEASONS, timezone: "UTC" });
    app = express();
    app.use(express.json());
    registerGoalLinkRemap(app, {
      isAdmin,
      adminActor: (req: any) => ({ id: String(req.headers.authorization ?? "").replace("Bearer ", "") }),
      getPool: () => pool,
      seasonState,
    } as any);
    registerProposals(app, {
      authedUser,
      getPool: () => pool,
      isAdmin,
      overLimit: async () => false,
      members: usersRepo(pool),
      contentRepo: { get: () => ({}) } as any,
      faqsRepo: { get: () => ({}) } as any,
      seasonState,
      liveHoldersOf: async () => [],
      port: () => port,
      clientIp: () => "203.0.113.9",
    } as any);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as { port: number }).port;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await pool?.end();
    await db?.drop();
  });

  /** One link of every kind naming `goal`, placed by `at` (a session date, a task day) and `moon`. */
  const seedLinks = async (goal: string, at: string, moon: string, tag: string) => {
    await q("INSERT INTO live_sessions (title, facilitator_no, created_by_no, duration_min, state, stamp, created_at) VALUES (?, 1, 1, 60, '{}', '{}', ?)", [`Circle ${tag}`, at]);
    const sid = Number((await q("SELECT id FROM live_sessions WHERE title = ?", [`Circle ${tag}`]))[0].id);
    await q("INSERT INTO live_session_priorities (session_id, text, serves_goal, serves_goal_id) VALUES (?, ?, 'old words', ?)", [sid, `priority ${tag}`, goal]);
    await q("INSERT INTO live_session_shares (session_id, kind, text, serves_goal, serves_goal_id) VALUES (?, 'working', ?, 'old words', ?)", [sid, `share ${tag}`, goal]);
    await q("INSERT INTO live_session_entries (session_id, kind, text, author_no, serves_goal, serves_goal_id) VALUES (?, 'decision', ?, 1, 'old words', ?)", [sid, `win ${tag}`, goal]);
    await q("INSERT INTO moon_recaps (id, user_id, cycle_id, season_id) VALUES (?, ?, ?, NULL)", [`mr-${tag}`, `u-${tag}`, moon]);
    await q("INSERT INTO moon_recap_items (id, recap_id, origin, dedupe_key, text, season_goal_id) VALUES (?, ?, 'task', ?, 'did a thing', ?)", [`mri-${tag}`, `mr-${tag}`, `k-${tag}`, goal]);
    await q("INSERT INTO moon_goals (id, user_id, cycle_id, position, text, season_goal_id) VALUES (?, ?, ?, 1, 'a moon goal', ?)", [`mg-${tag}`, `u-${tag}`, moon, goal]);
    await q("INSERT INTO member_tasks (id, user_id, title, created_on, serves_goal_id) VALUES (?, ?, 'a task', ?, ?)", [`mt-${tag}`, `u-${tag}`, at.slice(0, 10), goal]);
  };

  /** Which goal id each of the six links seeded under `tag` names now. */
  const linksOf = async (tag: string) => {
    const [sess] = await q("SELECT id FROM live_sessions WHERE title = ?", [`Circle ${tag}`]);
    const one = async (sql: string, args: unknown[]) => (await q(sql, args))[0]?.g ?? null;
    return {
      priority: await one("SELECT serves_goal_id AS g FROM live_session_priorities WHERE session_id = ?", [sess.id]),
      share: await one("SELECT serves_goal_id AS g FROM live_session_shares WHERE session_id = ?", [sess.id]),
      entry: await one("SELECT serves_goal_id AS g FROM live_session_entries WHERE session_id = ?", [sess.id]),
      recapItem: await one("SELECT season_goal_id AS g FROM moon_recap_items WHERE id = ?", [`mri-${tag}`]),
      moonGoal: await one("SELECT season_goal_id AS g FROM moon_goals WHERE id = ?", [`mg-${tag}`]),
      task: await one("SELECT serves_goal_id AS g FROM member_tasks WHERE id = ?", [`mt-${tag}`]),
    };
  };
  const all = (g: string) => ({ priority: g, share: g, entry: g, recapItem: g, moonGoal: g, task: g });

  beforeEach(async () => {
    for (const t of ["live_session_priorities", "live_session_shares", "live_session_entries", "live_sessions", "moon_recap_items", "moon_recaps", "moon_goals", "member_tasks", "proposed_changes", "proposed_change_batches"]) await q(`DELETE FROM ${t}`);
    await q("DELETE FROM health_events WHERE kind = 'audit'");
    await seedLinks(OLD_COMMUNITY, IN_S1, MOON_S1, "s1-community");
    await seedLinks(OLD_COMMUNITY, IN_UP, MOON_UP, "up-community");
    await seedLinks(OLD_FUNDING, IN_S1, MOON_S1, "s1-funding");
    await seedLinks(OLD_FUNDING, IN_S0, LUNAR_CLOCK.boundsFor(new Date("2026-06-10T12:00:00Z")).id, "s0-funding");
  });

  const call = async (method: string, path: string, body?: unknown, as: string | null = ADMIN.id) => {
    const res = await fetch(`${base}${path}`, { // module-review-ok: a test calling its own local server, never an outside host
      method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(as ? { authorization: `Bearer ${as}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as any };
  };
  const REMAP = "/api/admin/seasons/season-1/goal-links/remap";

  it("moves season-1's links only, in all six tables, and leaves the upcoming season's links on the old id", async () => {
    const r = await call("POST", REMAP, { from: OLD_COMMUNITY, to: NEW_COMMUNITY });
    expect(r.status).toBe(200);
    expect(r.body.dryRun).toBe(false);
    const [pair] = r.body.pairs;
    expect(pair.tables).toEqual({ live_session_priorities: 1, live_session_shares: 1, live_session_entries: 1, moon_recap_items: 1, moon_goals: 1, member_tasks: 1 });
    expect(pair.moved).toBe(6);
    expect(pair.otherSeasons).toBe(6);
    expect(pair.heldElsewhere).toEqual(["season-1792808851567"]);
    expect(await linksOf("s1-community")).toEqual(all(NEW_COMMUNITY));
    expect(await linksOf("up-community")).toEqual(all(OLD_COMMUNITY));
    // A moved link takes the goal's words too; the upcoming season's keep theirs.
    const words = await q("SELECT serves_goal_id AS g, serves_goal AS w FROM live_session_priorities ORDER BY id");
    expect(words.find((x) => x.g === NEW_COMMUNITY)?.w).toBe("A thriving community");
    expect(words.find((x) => x.g === OLD_COMMUNITY)?.w).toBe("old words");
    const events = await q("SELECT text, entity_ref, audience FROM health_events WHERE kind = 'audit'");
    expect(events).toEqual([{ text: `season-goal-links:remap:season-1:${OLD_COMMUNITY}:${NEW_COMMUNITY}:6`, entity_ref: "season-1", audience: "admin" }]);
  });

  it("an earlier season's links to the old id stay where they are, and a list of pairs moves each", async () => {
    const r = await call("POST", REMAP, { pairs: [{ from: OLD_FUNDING, to: NEW_FUNDING }, { from: OLD_WATER, to: NEW_WATER }] });
    expect(r.status).toBe(200);
    expect(r.body.pairs.map((p: any) => p.moved)).toEqual([6, 0]);
    expect(await linksOf("s1-funding")).toEqual(all(NEW_FUNDING));
    expect(await linksOf("s0-funding")).toEqual(all(OLD_FUNDING));
  });

  it("refuses a `to` the season does not hold, and a `from` it still holds, and moves nothing", async () => {
    const notHeld = await call("POST", REMAP, { from: OLD_COMMUNITY, to: "gaaaaaaaaaaa" });
    expect(notHeld.status).toBe(400);
    expect(notHeld.body.fields).toEqual(["to"]);
    const stillHeld = await call("POST", REMAP, { from: NEW_WATER, to: NEW_FUNDING });
    expect(stillHeld.status).toBe(400);
    expect(stillHeld.body.fields).toEqual(["from"]);
    // A to held only by ANOTHER season is not held by this one.
    const elsewhere = await call("POST", REMAP, { from: OLD_FUNDING, to: OLD_COMMUNITY });
    expect(elsewhere.status).toBe(400);
    expect(elsewhere.body.fields).toEqual(["to"]);
    expect((await call("POST", "/api/admin/seasons/no-such-season/goal-links/remap", { from: OLD_COMMUNITY, to: NEW_COMMUNITY })).status).toBe(404);
    expect((await call("POST", REMAP, { from: OLD_COMMUNITY, to: NEW_COMMUNITY }, STRANGER.id)).status).toBe(401);
    expect(await linksOf("s1-community")).toEqual(all(OLD_COMMUNITY));
  });

  it("is idempotent: a second run moves nothing and records nothing more", async () => {
    expect((await call("POST", REMAP, { from: OLD_COMMUNITY, to: NEW_COMMUNITY })).body.moved).toBe(6);
    const again = await call("POST", REMAP, { from: OLD_COMMUNITY, to: NEW_COMMUNITY });
    expect(again.status).toBe(200);
    expect(again.body.moved).toBe(0);
    expect(await linksOf("s1-community")).toEqual(all(NEW_COMMUNITY));
    expect(await linksOf("up-community")).toEqual(all(OLD_COMMUNITY));
    expect(await q("SELECT id FROM health_events WHERE kind = 'audit'")).toHaveLength(1);
  });

  it("a dry run answers the same counts and writes nothing", async () => {
    const dry = await call("POST", `${REMAP}?dryRun=1`, { from: OLD_COMMUNITY, to: NEW_COMMUNITY });
    expect(dry.status).toBe(200);
    expect(dry.body.dryRun).toBe(true);
    expect(dry.body.moved).toBe(6);
    expect(await linksOf("s1-community")).toEqual(all(OLD_COMMUNITY));
    expect(await q("SELECT id FROM health_events WHERE kind = 'audit'")).toHaveLength(0);
    const inBody = await call("POST", REMAP, { from: OLD_COMMUNITY, to: NEW_COMMUNITY, dryRun: true });
    expect(inBody.body.dryRun).toBe(true);
    expect(await linksOf("s1-community")).toEqual(all(OLD_COMMUNITY));
  });

  it("is a setting a proposal can name: its validator passes, and accepting it moves season-1's links", async () => {
    const item = {
      kind: "setting",
      target: { method: "POST", path: REMAP },
      body: { pairs: [{ from: OLD_FUNDING, to: NEW_FUNDING }, { from: OLD_WATER, to: NEW_WATER }, { from: OLD_COMMUNITY, to: NEW_COMMUNITY }] },
      summary: "Point season-1's links at its reworded goals.",
    };
    const checked = await checkProposal({ pool, content: () => ({}), faqs: () => ({}), seasons: () => SEASONS, routeExists: routeExistsIn(app) }, item as any);
    expect(checked).toEqual({ ok: true, label: REMAP, method: "POST", path: REMAP });

    const filed = await call("POST", "/api/admin/proposals", { batch: "Goal links", items: [item] }, AGENT.id);
    expect(filed.status).toBe(200);
    expect(await linksOf("s1-community")).toEqual(all(OLD_COMMUNITY)); // filing changed nothing
    const acc = await call("POST", "/api/admin/proposals/accept", { items: [{ id: filed.body.ids[0] }] });
    expect(acc.body.results).toEqual([{ id: filed.body.ids[0], ok: true }]);
    expect(await linksOf("s1-community")).toEqual(all(NEW_COMMUNITY));
    expect(await linksOf("s1-funding")).toEqual(all(NEW_FUNDING));
    expect(await linksOf("up-community")).toEqual(all(OLD_COMMUNITY));
    expect(await linksOf("s0-funding")).toEqual(all(OLD_FUNDING));
  });
});
