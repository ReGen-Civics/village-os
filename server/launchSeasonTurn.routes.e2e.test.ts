/**
 * THE LAUNCH IS THE TURN OF THE SEASON, driven through a real launch vote.
 *
 * Rye, 27 Nov 2026: "Yes moon 1 starts the turn of the season when we're
 * live". The Admin Garden plan (Q5a): "The launch is the turn of the season.
 * Moon 1 starts at that turn, when the village is live."
 *
 * One village walks it, in the first village's own shape: a founding season
 * with no end date, the next season queued for a day weeks away, and a member
 * holding a role whose term followed the founding season while it still had an
 * end. Three founders say yes, and in that request:
 *
 *   the queued season begins that day, and that is the ONE date that moves;
 *   the founding season still has no end date, so the role that followed it
 *     keeps the end date it was given;
 *   the founder the proposal named holds the steward role for the whole new
 *     season, where the calendar as it stood could have seated nobody;
 *   Moon 1 is the moon the launch fell in; and
 *   the pay period is the same pay period, to the id and both bounds.
 *
 * The rule's cases, the re-run and the controls are in
 * `server/lib/launchSeasonTurn.test.ts`, with no database.
 *
 * THE CASES RUN IN ORDER. Run the whole file, never a `-t` slice. Boots the
 * BUILT `dist/index.js` against a throwaway schema, so run `pnpm build` first.
 * Skips loudly without TEST_DATABASE_URL.
 */
import fs from "fs";
import os from "os";
import path from "path";
import mysql from "mysql2/promise";
import { spawn, type ChildProcess } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPool, provisionTestDb, testDbConfigured, type TestDb, waitForPortFree } from "./db/testDb";
import { waitForHealth } from "./db/e2eBoot";
import { clearTheJourney, makeFounders } from "./db/launchGovernanceFixture";
import { civilDateInstant } from "../shared/seatTerms";
import { anchorCycleFrom, villageMoonFor } from "./lib/villageMoon";

const DB_CONFIGURED = testDbConfigured();
if (!DB_CONFIGURED) {
  console.warn("[launchSeasonTurn.routes] TEST_DATABASE_URL not set - DB-backed tests SKIPPED.");
}

const DIST = path.resolve(process.cwd(), "dist/index.js");

/** This suite's port window. `scripts/check-e2e-ports.mjs` holds it apart from every other file's. */
const PORT = 12450 + (process.pid % 250);
const BASE = `http://localhost:${PORT}`;
const ADMIN = "launchseason-admin";
const PASSWORD = "LaunchSeasonTest123!";
/** A role with no powers, so seating somebody in it asks nothing of the gate. */
const KITCHEN = "road-kitchen";

let child: ChildProcess | undefined;
let testDb: TestDb | undefined;
let dataDir = "";
let pool: mysql.Pool;
const logs: string[] = [];

let founderToken = "";
let founderId = "";
let wrenToken = "";
let wrenId = "";
let idaToken = "";
let idaId = "";
let tamId = "";
let launchBallot = "";

/** The village's own today and zone, read off the server so the test and the server agree on the day. */
let today = "";
let zone = "";
let cadence = "";
/** The days this village's calendar is written in, all relative to today. */
let foundationsStart = "";
let foundationsFirstEnd = "";
let rootingWasToStart = "";
let rootingEnd = "";
let bloomEnd = "";
/** The pay period as the server read it before the vote. */
let cycleBefore: any = null;

interface Answer { status: number; json: any }

async function call(
  method: string,
  route: string,
  opts: { body?: unknown; token?: string | null } = {},
): Promise<Answer> {
  const token = opts.token === undefined ? founderToken : opts.token;
  const res = await fetch(BASE + route, { // module-review-ok: the test client dialling the built server on localhost, as every e2e suite does
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function register(name: string, slug: string): Promise<{ token: string; id: string }> {
  const r = await call("POST", "/api/auth/register", {
    token: "",
    body: { name, email: `${slug}-${PORT}@example.test`, password: PASSWORD, paths: ["resident"] },
  });
  expect(r.status, `${name} must register`).toBe(200);
  return { token: String(r.json?.token ?? ""), id: String(r.json?.user?.id ?? "") };
}

/** A civil date some days from another, in plain calendar arithmetic. */
const addDays = (day: string, n: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const calendar = (foundationsEndsOn: string) => [
  { id: "foundations", name: "Season of Foundations", theme: "Lay the ground", focus: "", startsOn: foundationsStart, endsOn: foundationsEndsOn },
  { id: "rooting", name: "Season of Rooting", theme: "Take root", focus: "", startsOn: rootingWasToStart, endsOn: rootingEnd },
  { id: "bloom", name: "Season of Bloom", theme: "", focus: "", startsOn: rootingEnd, endsOn: bloomEnd },
];

/** The season document exactly as it is stored, read raw. */
const storedSeasons = async (): Promise<any[]> => {
  const [rows] = await pool.query<any[]>("SELECT value FROM app_config WHERE config_key = 'season'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  const doc = typeof rows[0]?.value === "string" ? JSON.parse(rows[0].value) : rows[0]?.value;
  return Array.isArray(doc?.seasons) ? doc.seasons : [];
};

/** One role's holders as the table has them. */
const holdersOf = async (roleId: string): Promise<Array<{ userId: string; endsAt: number | null; seasonId: string | null; follows: boolean; grantedBy: string | null }>> => {
  const [rows] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    "SELECT user_id, UNIX_TIMESTAMP(term_ends_at) AS ends, season_id, term_follows_season, granted_by FROM role_holders WHERE role_id = ? ORDER BY user_id",
    [roleId],
  );
  return rows.map((r) => ({
    userId: String(r.user_id),
    endsAt: r.ends === null ? null : Number(r.ends) * 1000,
    seasonId: r.season_id === null ? null : String(r.season_id),
    follows: Number(r.term_follows_season) === 1,
    grantedBy: r.granted_by === null ? null : String(r.granted_by),
  }));
};

const auditLines = async (prefix: string): Promise<string[]> => {
  const [rows] = await pool.query<any[]>("SELECT text FROM health_events WHERE kind = 'audit' AND text LIKE ?", [`${prefix}%`]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  return rows.map((r) => String(r.text));
};

const vote = (ballotId: string, token: string, body: Record<string, unknown>) =>
  call("POST", `/api/governance/ballots/${ballotId}/vote`, { token, body });

beforeAll(async () => {
  if (!DB_CONFIGURED) return;
  if (!fs.existsSync(DIST)) {
    throw new Error(`${DIST} is missing. Run \`pnpm build\` before the launch season turn route test.`);
  }
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "village-launchseason-"));
  testDb = await provisionTestDb({ gameStarted: false });
  pool = testPool(testDb, { connectionLimit: 4 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
  // Before the server boots, so its role cache loads the row.
  await pool.query( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    "INSERT INTO roles (id, name, description, capabilities, sort_order, grants_admin) VALUES (?,?,?,?,?,?)",
    [KITCHEN, "Kitchen Keeper", "Keeps the shared kitchen stocked.", JSON.stringify([]), 80, 0],
  );

  await waitForPortFree(PORT);
  child = spawn(process.execPath, [DIST], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      // No background scheduler: the hourly and five-minute jobs are not this suite's subject.
      SCHEDULER_ENABLED: "0",
      DATA_DIR: dataDir,
      DATABASE_URL: testDb.url,
      ADMIN_PASSWORD: ADMIN,
      AUTH_TOKEN_SECRET: "launchseason-token-secret", // module-review-ok: a fixture signing secret for a throwaway server on a scratch schema, same as every e2e suite
      FRONTEND_URL: BASE,
      VILLAGE_SECRETS_KEY: "3f".repeat(32), // module-review-ok: fixture sealing key, same as every e2e suite
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => logs.push(String(d)));
  child.stderr?.on("data", (d) => logs.push(String(d)));
  await waitForHealth({ base: BASE, logs, child });

  const boot = await call("POST", "/api/admin/bootstrap", {
    token: "",
    body: { password: ADMIN, email: `founder-${PORT}@example.test`, name: "Mara Fenn" },
  });
  const claim = decodeURIComponent(String(boot.json?.claimUrl ?? "").match(/token=([^&]+)/)?.[1] ?? "");
  const setPw = await call("POST", "/api/auth/set-password", { token: "", body: { token: claim, password: PASSWORD } });
  founderToken = String(setPw.json?.token ?? "");
  founderId = String(setPw.json?.user?.id ?? "");
  expect(founderToken, "founder must hold a session").toBeTruthy();

  await clearTheJourney(call, { name: "Wealden" });

  const wren = await register("Wren Ashby", "wren");
  wrenToken = wren.token; wrenId = wren.id;
  const ida = await register("Ida Kestrel", "ida");
  idaToken = ida.token; idaId = ida.id;
  const tam = await register("Tam Reyes", "tam");
  tamId = tam.id;
  for (const id of [founderId, wrenId, idaId, tamId]) {
    const r = await call("PUT", `/api/admin/players/${id}/stage`, { body: { stageId: "member" } });
    expect(r.status, `${id} reaches member`).toBe(200);
  }
  // Three founders, which is the rule as shipped. Tam is a member, and holds a role.
  await makeFounders(call, [wrenId, idaId]);
}, 240_000);

afterAll(async () => {
  child?.kill();
  await pool?.end();
  if (dataDir && fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
  await testDb?.drop();
});

describe.skipIf(!DB_CONFIGURED)("a village in the first village's shape, before its launch", () => {
  it("writes its own calendar, and seats a member in a role that ends with the founding season", async () => {
    const season = (await call("GET", "/api/season", { token: null })).json;
    today = String(season?.today ?? "");
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const admin = (await call("GET", "/api/admin/seasons")).json;
    zone = String(admin?.timezone ?? "");
    cadence = String(admin?.cadence ?? "");
    foundationsStart = addDays(today, -60);
    foundationsFirstEnd = addDays(today, 20);
    rootingWasToStart = addDays(today, 40);
    rootingEnd = addDays(today, 130);
    bloomEnd = addDays(today, 220);

    // First with an end date, so a role can be given for the season.
    const dated = await call("PUT", "/api/admin/seasons", { body: { seasons: calendar(foundationsFirstEnd), cadence, timezone: zone } });
    expect(dated.status, JSON.stringify(dated.json)).toBe(200);
    expect(dated.json?.current?.id).toBe("foundations");

    const seated = await call("POST", `/api/admin/roles/${KITCHEN}/holders`, { body: { userId: tamId, action: "add" } });
    expect(seated.status, JSON.stringify(seated.json)).toBe(200);
    const [tam] = await holdersOf(KITCHEN);
    expect(tam).toMatchObject({ userId: tamId, seasonId: "foundations", follows: true });
    expect(tam.endsAt).toBe((civilDateInstant(foundationsFirstEnd, zone) as Date).getTime());

    // Then the founding season becomes open-ended, the shape the first village is in.
    // A season that lost its end moves nothing: the role keeps the last date it had.
    const open = await call("PUT", "/api/admin/seasons", { body: { seasons: calendar(""), cadence, timezone: zone } });
    expect(open.status, JSON.stringify(open.json)).toBe(200);
    expect(open.json?.seatsMoved).toEqual({ permission: 0, org: 0 });
    expect(open.json?.current?.id).toBe("foundations");
    expect(open.json?.openEnded).toBe(true);
    expect(open.json?.upcoming?.id).toBe("rooting");
    expect((await holdersOf(KITCHEN))[0].endsAt).toBe(tam.endsAt);
  });

  it("has no Moon 1 yet, and reads its pay period off the moon", async () => {
    const facts = await call("GET", "/api/admin/launch");
    expect(facts.json?.launchedAt).toBeNull();
    expect(anchorCycleFrom(null, facts.json?.launchedAt).moonOneCycle).toBeNull();
    cycleBefore = (await call("GET", "/api/game/cycle", { token: null })).json;
    expect(String(cycleBefore?.id)).toMatch(/^lunar-\d{6}$/);
  });
});

describe.skipIf(!DB_CONFIGURED)("the launch vote on that calendar", () => {
  it("says in its frozen document which season the carry begins, and that no role's end moves", async () => {
    const asked = await call("POST", "/api/admin/launch/propose", { body: { slate: [founderId] } });
    expect(asked.status, JSON.stringify(asked.json)).toBe(200);
    const [rows] = await pool.query<any[]>("SELECT id, doc_markdown FROM ballots WHERE subject_type = 'village_launch'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    expect(rows).toHaveLength(1);
    launchBallot = String(rows[0].id);
    const doc = String(rows[0].doc_markdown ?? "");
    expect(doc).toContain("## The season");
    expect(doc).toContain("The day this carries is the turn of the season. Season of Rooting begins that day, taking over from Season of Foundations.");
    expect(doc).toContain(`Whoever is seated as a steward by this vote holds the role for the whole of Season of Rooting, until ${rootingEnd}.`);
    expect(doc).toContain("Nothing else on the calendar moves, and every role anybody holds keeps the end date it was given.");
    expect(doc).toContain("Moon 1 is the moon that day falls in. Pay periods follow the moons as they always have, and none of them moves.");
    // Opening the vote turned nothing.
    const season = (await call("GET", "/api/season", { token: null })).json;
    expect(season?.current?.id).toBe("foundations");
    expect((await storedSeasons())[1].startsOn).toBe(rootingWasToStart);
  });

  it("carries on the third founder's yes, in that request", async () => {
    // The founder the proposal named accepts the steward role with their yes.
    const first = await vote(launchBallot, founderToken, { choice: "yes", standsForSteward: true });
    expect(first.status, JSON.stringify(first.json)).toBe(200);
    expect(first.json?.carried).toBe(false);
    expect((await vote(launchBallot, wrenToken, { choice: "yes" })).json?.carried).toBe(false);
    // Two yeses turned nothing either.
    expect((await call("GET", "/api/season", { token: null })).json?.current?.id).toBe("foundations");
    const third = await vote(launchBallot, idaToken, { choice: "yes" });
    expect(third.status, JSON.stringify(third.json)).toBe(200);
    expect(third.json?.carried).toBe(true);
  });
});

describe.skipIf(!DB_CONFIGURED)("the launch turned the season", () => {
  it("the queued season began that day, and that is the one date that moved", async () => {
    // The audit line is written fire-and-forget, so it is waited for.
    const deadline = Date.now() + 15_000;
    let turned: string[] = [];
    while (Date.now() < deadline) {
      turned = await auditLines("launch:season-");
      if (turned.length) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    // What happened, who it took over from, the day, and how many roles the save moved: none.
    expect(turned).toEqual([`launch:season-turned:foundations->rooting:${today}:seats-moved:0`]);

    const season = (await call("GET", "/api/season", { token: null })).json;
    expect(season?.current?.id).toBe("rooting");
    expect(season?.current?.startsOn).toBe(today);
    expect(season?.current?.endsOn).toBe(rootingEnd);
    expect(season?.openEnded).toBe(false);
    expect(season?.upcoming?.id).toBe("bloom");

    // THE STORED DOCUMENT: one date moved, and every other field of every season is as the founder wrote it.
    const stored = await storedSeasons();
    expect(stored.map((s) => [s.id, s.name, s.theme, s.startsOn, s.endsOn])).toEqual([
      ["foundations", "Season of Foundations", "Lay the ground", foundationsStart, ""],
      ["rooting", "Season of Rooting", "Take root", today, rootingEnd],
      ["bloom", "Season of Bloom", "", rootingEnd, bloomEnd],
    ]);
  });

  it("the village was told, on its pulse, in the words every season turn uses", async () => {
    const [pulse] = await pool.query<any[]>("SELECT text FROM health_events WHERE kind = 'season'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    expect(pulse.map((p) => String(p.text))).toContain("The season has turned: Season of Rooting");
  });

  it("THE ROLE THAT FOLLOWED THE FOUNDING SEASON KEEPS THE END DATE IT WAS GIVEN", async () => {
    const [tam] = await holdersOf(KITCHEN);
    expect(tam).toMatchObject({ userId: tamId, seasonId: "foundations", follows: true });
    expect(tam.endsAt, "twenty days from the launch, as it was promised, and never the launch day").toBe((civilDateInstant(foundationsFirstEnd, zone) as Date).getTime());
    expect(tam.endsAt!).toBeGreaterThan(Date.now());
    // Nobody was told a term moved, because none did.
    const [told] = await pool.query<any[]>("SELECT id FROM notifications WHERE dedupe_key LIKE 'seat-restamp:%' OR dedupe_key LIKE 'org-seat-restamp:%'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    expect(told).toHaveLength(0);
  });

  it("the founder the proposal named holds the steward role for the WHOLE new season", async () => {
    const seats = await holdersOf("steward");
    expect(seats.map((s) => s.userId)).toEqual([founderId]);
    expect(seats[0].grantedBy).toBe(launchBallot);
    expect(seats[0].seasonId).toBe("rooting");
    expect(seats[0].follows).toBe(true);
    expect(seats[0].endsAt).toBe((civilDateInstant(rootingEnd, zone) as Date).getTime());
    // The calendar as it stood had no end to give a steward, and that refusal rings the admins. It did not happen.
    const [held] = await pool.query<any[]>("SELECT id FROM notifications WHERE dedupe_key = ?", [`bal:${launchBallot}:launch-seating-held`]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    expect(held).toHaveLength(0);
    const [told] = await pool.query<any[]>("SELECT body FROM notifications WHERE user_id = ? AND type = 'role_appointed'", [founderId]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    expect(told.map((n) => String(n.body)).some((b) => b.includes(`The role ends on ${rootingEnd}, with the season`))).toBe(true);
  });

  it("MOON 1 IS THE MOON THE LAUNCH FELL IN, and the pay period did not move", async () => {
    const facts = await call("GET", "/api/admin/launch");
    const launchedAt = String(facts.json?.launchedAt ?? "");
    expect(launchedAt).toBeTruthy();
    expect(facts.json?.launchedByBallotId).toBe(launchBallot);

    const cycleAfter = (await call("GET", "/api/game/cycle", { token: null })).json;
    // The same pay period, to the id and both bounds, across a launch that turned a season.
    expect(cycleAfter?.id).toBe(cycleBefore.id);
    expect(cycleAfter?.cycleNumber).toBe(cycleBefore.cycleNumber);
    expect(cycleAfter?.startsAt).toBe(cycleBefore.startsAt);
    expect(cycleAfter?.endsAt).toBe(cycleBefore.endsAt);

    // And the village's own count starts in it: this pay period is Moon 1.
    const anchor = anchorCycleFrom(null, launchedAt).moonOneCycle;
    expect(anchor).toBe(cycleBefore.cycleNumber);
    const moon = villageMoonFor(new Date(launchedAt), anchor);
    expect(moon.ordinal).toBe(1);
    expect(moon.startsAt).toBe(cycleBefore.startsAt);
    expect(moon.endsAt).toBe(cycleBefore.endsAt);
  });

  it("the Season tab still saves, and saving what it shows moves nothing", async () => {
    const shown = (await call("GET", "/api/admin/seasons")).json;
    const again = await call("PUT", "/api/admin/seasons", { body: { seasons: shown.seasons, cadence: shown.cadence, timezone: shown.timezone } });
    expect(again.status, JSON.stringify(again.json)).toBe(200);
    expect(again.json?.seatsMoved).toEqual({ permission: 0, org: 0 });
    expect(again.json?.current?.id).toBe("rooting");
    expect((await storedSeasons())[1].startsOn).toBe(today);
  });
});
