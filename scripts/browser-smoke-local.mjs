#!/usr/bin/env node
/**
 * THE BROWSER SMOKE AGAINST THIS TREE'S OWN BUILD (CI's `browser-smoke` job,
 * and the same command on a laptop).
 *
 *   pnpm build
 *   npx tsx scripts/browser-smoke-local.mjs [browser-smoke options]
 *
 * It does what the e2e suites do: provisions a scratch schema from
 * TEST_DATABASE_URL (server/db/testDb.ts), points mail at a fake provider
 * (server/testkit/fakeResend.ts), and boots the BUILT dist/index.js with
 * SMOKE_TEST_TOKEN set. It then sets the village up the way the pilot runs,
 * just enough for the apply flow (a founder, a season, this moon's proposals,
 * one circle and one role with a card as full as a founding role's), runs scripts/browser-smoke.mjs against it with
 * --require-apply, and finally fails if the fake provider received a single
 * email while the smoke ran: a TEST application must never be mailed.
 *
 * Exit codes are browser-smoke.mjs's, plus 1 when mail went out and 2 when
 * the server could not be started.
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { provisionTestDb, testDbConfigured, waitForPortFree, E2E_BOOT_DEADLINE_MS } from "../server/db/testDb.ts";
import { startFakeResend } from "../server/testkit/fakeResend.ts";
import { main as smoke } from "./browser-smoke.mjs";
import { healthFailure } from "./lib/healthFailure.mjs";

const DIST = path.resolve("dist/index.js");
const PORT = 6500 + (process.pid % 400);
/*
 * 127.0.0.1, never "localhost" (#1627, 25 Nov 2026). The server binds IPv4 0.0.0.0 and waitForPortFree checks
 * 127.0.0.1, but "localhost" may resolve to ::1 first on a runner. Asked by name, the boot poll could reach whatever
 * holds the port on the IPv6 side, which the free-port check never looked at, while the server it started answered
 * nobody: run 45557117427 logged "listening on 0.0.0.0:6566" at +1.0s and then two minutes of "fetch failed". The
 * address the poll asks is now the one checked and the one bound.
 */
const SMOKE_HOST = "127.0.0.1";
const BASE = `http://${SMOKE_HOST}:${PORT}`;
const ADMIN = `browser-smoke-admin-${crypto.randomBytes(12).toString("hex")}`;
const PROVIDER_KEY = "re_test_browser_smoke";
const FOUNDER = { email: `smoke-founder-${PORT}@example.test`, name: "Smoke Founder", password: "SmokeFounder123!" };
const TOKEN = process.env.SMOKE_TEST_TOKEN || crypto.randomBytes(24).toString("hex");

function civil(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

async function call(method, route, body, token) {
  const res = await fetch(BASE + route, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, text };
}

function must(r, what) {
  if (r.status >= 300) throw new Error(`${what}: HTTP ${r.status} ${r.text.slice(0, 300)}`);
  return r;
}

/** Just enough village for the apply flow, the same steps server/roleJourney.e2e.test.ts takes. */
async function seed() {
  const boot = must(await call("POST", "/api/admin/bootstrap", { password: ADMIN, email: FOUNDER.email, name: FOUNDER.name }), "bootstrap");
  const claim = decodeURIComponent(String(boot.json?.claimUrl ?? "").match(/token=([^&]+)/)?.[1] ?? "");
  const claimed = must(await call("POST", "/api/auth/set-password", { token: claim, password: FOUNDER.password }), "claim");
  const F = String(claimed.json?.token ?? "");
  must(await call("PUT", "/api/admin/modules/governance/lifecycle", { lifecycle: "public" }, F), "governance on");
  const cfg = must(await call("GET", "/api/admin/seasons", undefined, F), "seasons").json;
  const now = Date.now();
  const DAY = 86_400_000;
  const seasons = [
    { id: "s-now", name: "Season of Seeds", startsOn: civil(now - 30 * DAY), endsOn: civil(now + 150 * DAY), goals: [{ id: "g-pages", text: "Every page loads for every visitor", done: false }] },
    { id: "s-next", name: "", startsOn: civil(now + 151 * DAY), endsOn: civil(now + 240 * DAY), goals: [] },
  ];
  must(await call("PUT", "/api/admin/seasons", { ...cfg, seasons }, F), "season");
  must(await call("PUT", "/api/admin/open-proposals/settings", { term: "moon", publicLink: true }, F), "open proposals");
  must(await call("POST", "/api/admin/circles", { id: "anchor", name: "Anchor Circle" }, F), "circle");
  const role = must(await call("POST", "/api/admin/org/roles", { name: "Gate Keeper", circleId: "anchor", seats: 1 }, F), "role");
  must(
    await call("PUT", `/api/admin/org/roles/${role.json.id}`, { name: "Gate Keeper", circleId: "anchor", seats: 1, aim: "The gate opens at dawn.", accountabilities: ["Open the gate", "Close it at dusk"] }, F),
    "role words",
  );
  // A card as full as a real founding role's (the lead, after 1.3.42): a goal line, three dated deliverables, the
  // commitment, where and a paid line, featured on the founding team. On the thin card above the phone's Apply sat
  // well clear of the tab bar whatever the layout, so the role page check could not tell 1.3.42's hidden Apply apart.
  const day = (n) => civil(now + n * DAY);
  must(
    await call(
      "POST",
      `/api/org/role-edit/${role.json.id}`,
      {
        words: { aim: "The gate opens at dawn.", whyItMatters: "Goal: every neighbour finds the gate open at dawn and closed at dusk, every day of the season", accountabilities: ["Open the gate", "Close it at dusk"] },
        parameters: { commitmentPct: 60 },
        sections: {
          paid: true,
          where: "On the land, with some work from home",
          deliverables: [
            { title: "The gate's hours agreed with the circle", start: day(5), end: day(30) },
            { title: "A new latch fitted and tested", start: day(31), end: day(31), milestone: true },
            { title: "A season of gate logs shared", start: day(32), end: day(90) },
          ],
        },
      },
      F,
    ),
    "role card",
  );
  must(await call("PUT", "/api/admin/variables/org.founding_team", { value: true }, F), "founding team on");
  must(await call("PUT", "/api/admin/variables/org.founding_team_roles", { value: role.json.id }, F), "founding team role");
  // The portal entrance on, as the pilot runs it: every page check draws it in front of /roles and
  // /propose-a-role, and every apply check passes it the way a visitor does (enterPortal).
  must(await call("PUT", "/api/admin/variables/entrance.required", { value: true }, F), "portal entrance on");
}

async function run() {
  if (!testDbConfigured()) {
    console.error("browser-smoke-local: TEST_DATABASE_URL is not set, so there is no database to boot the server on.");
    return 2;
  }
  if (!fs.existsSync(DIST)) {
    console.error(`browser-smoke-local: ${DIST} is missing. Run pnpm build first.`);
    return 2;
  }
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "village-browser-smoke-"));
  const db = await provisionTestDb();
  const fake = await startFakeResend({ apiKey: PROVIDER_KEY });
  await waitForPortFree(PORT);
  const logs = [];
  const child = spawn(process.execPath, [DIST], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      SCHEDULER_ENABLED: "0",
      DATA_DIR: dataDir,
      DATABASE_URL: db.url,
      ADMIN_PASSWORD: ADMIN,
      AUTH_TOKEN_SECRET: crypto.randomBytes(24).toString("hex"),
      FRONTEND_URL: BASE,
      RESEND_API_BASE: fake.url,
      RESEND_API_KEY: PROVIDER_KEY,
      EMAIL_FROM: "Test Village <hello@village.example.test>",
      ANTHROPIC_API_KEY: "",
      SMOKE_TEST_TOKEN: TOKEN,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Each line stamped with the time since spawn: the boot that gave up on #1592 (run 45489920721) printed every line
  // at the same instant, so nobody could tell a two-minute boot from a server that was up and answering 503.
  const spawned = Date.now();
  const stamp = (d) => String(d).split("\n").filter((l) => l.length).map((l) => `[+${((Date.now() - spawned) / 1000).toFixed(1)}s] ${l}\n`).join("");
  child.stdout.on("data", (d) => logs.push(stamp(d)));
  child.stderr.on("data", (d) => logs.push(stamp(d)));
  try {
    const deadline = Date.now() + E2E_BOOT_DEADLINE_MS;
    let lastHealth = "no answer yet";
    for (;;) {
      if (Date.now() > deadline || child.exitCode !== null) {
        console.error(`browser-smoke-local: the server did not start within ${E2E_BOOT_DEADLINE_MS / 1000}s${child.exitCode !== null ? ` (it exited with ${child.exitCode})` : ""}.`);
        console.error(`browser-smoke-local: the last /health answer, at +${((Date.now() - spawned) / 1000).toFixed(1)}s: ${lastHealth}`);
        console.error(`browser-smoke-local: what the database was doing:\n${await databaseNow(db.url)}`);
        console.error(`browser-smoke-local: the server's last lines:\n${logs.join("").slice(-4000)}`);
        return 2;
      }
      try {
        // A bounded ask: a request the server accepts and never answers would otherwise hold the loop past its deadline.
        const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) break;
        lastHealth = `HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 400)}`;
      } catch (e) {
        lastHealth = `no answer (${healthFailure(e)})`;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    await seed();
    const mailBefore = fake.emails().length;
    const code = await smoke([...process.argv.slice(2), "--base-url", BASE, "--require-apply"], { ...process.env, SMOKE_TEST_TOKEN: TOKEN });
    const mailed = fake.emails().slice(mailBefore);
    if (mailed.length) {
      console.error(`browser-smoke-local: FAIL, ${mailed.length} email(s) went out during the smoke, and a TEST application must never be mailed: ${mailed.map((m) => JSON.stringify(m.body.to)).join(", ")}`);
      return 1;
    }
    console.log("browser-smoke-local: no email went out during the smoke.");
    return code;
  } finally {
    child.kill();
    await fake.close();
    await db.drop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

run().then(
  (code) => process.exit(code),
  (e) => {
    console.error("browser-smoke-local: crashed", e);
    process.exit(2);
  },
);

/**
 * What the database is busy with when a boot gives up: every connection that is not idle, how long it has been
 * on its statement, and what it waits for, so a boot stuck behind a lock names the lock. Best effort: a database
 * that cannot be asked says so in one line and never hides the rest of the report.
 */
async function databaseNow(url) {
  try {
    const mysql = (await import("mysql2/promise")).default;
    const conn = await mysql.createConnection({ uri: url, connectTimeout: 5000 });
    try {
      const [rows] = await conn.query("SELECT ID, USER, DB, COMMAND, TIME, STATE, LEFT(INFO, 200) AS INFO FROM information_schema.PROCESSLIST WHERE COMMAND NOT IN ('Sleep', 'Daemon') AND ID <> CONNECTION_ID() ORDER BY TIME DESC LIMIT 20");
      if (!rows.length) return "  (no connection is busy)";
      return rows.map((r) => `  #${r.ID} ${r.USER}@${r.DB ?? "-"} ${r.COMMAND} ${r.TIME}s ${r.STATE ?? ""} ${r.INFO ?? ""}`.trimEnd()).join("\n");
    } finally {
      await conn.end().catch(() => {});
    }
  } catch (e) {
    return `  (could not ask the database: ${String(e?.message ?? e).slice(0, 200)})`;
  }
}
