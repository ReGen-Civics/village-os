/**
 * THE LAUNCH FACTS, READ FROM A REAL DATABASE, and the route that serves them.
 *
 * One village walked through its states in order, because the facts are
 * written by different events and the point of the reader is that it reports
 * each one from the place its own door reads:
 *
 *   nobody holds it          unclaimed
 *   a founder exists         setup
 *   a launch ballot opens    vote-open
 *   it is called off         vote-did-not-carry
 *   issuance opens with no   issuing-vote-not-held  (migration 0112's villages:
 *   vote behind it                                   the state the journey page
 *                                                    offered a dead button for)
 *   the vote carries         running, and the checklist is a record
 *
 * Then the route, over the same database, on a fake gate: refused without the
 * gate, and the facts with their label with it.
 */
import express from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { LAUNCH_SUBJECT_REF, VILLAGE_LAUNCH } from "../../shared/ballotSubjects";
import { launchLabel } from "../../shared/launchFacts";
import { openBallot, withdrawBallot } from "./ballots";
import { founderPowerStands, recordGameStart } from "./gameStart";
import { launchBallotCarried, recordLaunchCarried } from "./launch";
import { readLaunchFacts } from "./launchFacts";
import { register } from "../routes/launchFacts";

const configured = testDbConfigured();

let db: TestDb;
let pool: mysql.Pool;

const openLaunchBallot = async (): Promise<string> => {
  const result = await openBallot(pool, {
    subjectType: VILLAGE_LAUNCH,
    subjectRef: LAUNCH_SUBJECT_REF,
    title: "Start the Game",
    docMarkdown: "# The launch document",
    method: "custom",
    weightMode: "equal",
    unityPct: 100,
    quorumPct: 100,
    durationDays: 7,
    openedBy: "u-founder",
    electorate: [
      { userId: "u-founder", weight: 1 },
      { userId: "u-second", weight: 1 },
      { userId: "u-third", weight: 1 },
    ],
  });
  if (!result.ok) throw new Error(`the launch ballot refused to open: ${result.error}`);
  return result.ballot.id;
};

describe.skipIf(!configured)("the launch facts (MySQL)", () => {
  beforeAll(async () => {
    // A village that is NOT issuing: the fixture's default is one that is.
    db = await provisionTestDb({ gameStarted: false });
    pool = testPool(db, { connectionLimit: 4 }); // module-review-ok: the S5 scratch-schema harness pool
    // The harness may seed example accounts; this suite owns who holds the village.
    await pool.query("UPDATE users SET role = 'member' WHERE role IN ('admin', 'founder')"); // module-review-ok: test fixture on the scratch schema
  });

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("reads a village nobody holds as unclaimed, with every other fact at rest", async () => {
    const f = await readLaunchFacts(pool);
    expect(f).toEqual({
      claimed: false,
      issuing: false,
      issuingSince: null,
      voteCarried: false,
      launchedByBallotId: null,
      checklistFrozen: false,
      launchedAt: null,
      voteOpen: false,
      openBallotId: null,
      lastVote: null,
      founderPowerStands: true,
    });
    expect(launchLabel(f)).toBe("unclaimed");
  });

  it("reads claimed once a founder exists, by the bootstrap door's own test", async () => {
    await pool.query( // module-review-ok: test fixture on the scratch schema
      "INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,'founder')",
      ["u-founder", "Fern Founder", "fern@example.test", ""],
    );
    const f = await readLaunchFacts(pool);
    expect(f.claimed).toBe(true);
    expect(launchLabel(f)).toBe("setup");
  });

  it("counts an admin with no founder as claimed too, as the bootstrap door does", async () => {
    await pool.query("UPDATE users SET role = 'admin' WHERE id = 'u-founder'"); // module-review-ok: test fixture on the scratch schema
    expect((await readLaunchFacts(pool)).claimed).toBe(true);
    await pool.query("UPDATE users SET role = 'founder' WHERE id = 'u-founder'"); // module-review-ok: test fixture on the scratch schema
  });

  it("reads an open launch ballot, by its id", async () => {
    const id = await openLaunchBallot();
    const f = await readLaunchFacts(pool);
    expect(f.voteOpen).toBe(true);
    expect(f.openBallotId).toBe(id);
    expect(f.lastVote).toBeNull();
    expect(launchLabel(f)).toBe("vote-open");
  });

  it("reads a vote that closed without carrying as the last vote, and no vote as open", async () => {
    const open = (await readLaunchFacts(pool)).openBallotId!;
    const done = await withdrawBallot(pool, {
      ballotId: open,
      withdrawnBy: "u-founder",
      reason: "Opened before the roll was ready.",
      withdrawerMayDiscardVotes: true,
    });
    expect(done.ok).toBe(true);
    const f = await readLaunchFacts(pool);
    expect(f.voteOpen).toBe(false);
    expect(f.openBallotId).toBeNull();
    expect(f.lastVote).toMatchObject({ id: open, status: "withdrawn" });
    expect(f.lastVote?.closedAt).toBeTruthy();
    expect(launchLabel(f)).toBe("vote-did-not-carry");
  });

  it("reads issuing with no vote behind it apart from launched: the village migration 0112 recorded", async () => {
    // A second, separate schema state would cost a provision; clearing the closed ballot gives the same village.
    await pool.query("DELETE FROM ballots WHERE subject_type = ?", [VILLAGE_LAUNCH]); // module-review-ok: test fixture on the scratch schema
    await recordGameStart(pool, { ballotId: "", startedBy: "migration-0112", note: "Already issuing before the vote existed." });
    const f = await readLaunchFacts(pool);
    expect(f.issuing).toBe(true);
    expect(f.issuingSince).toBeTruthy();
    // The same reading `founderPowerStands` gives, and the same one the launch-ballot reader gives.
    expect(f.founderPowerStands).toBe(await founderPowerStands(pool));
    expect(f.founderPowerStands).toBe(false);
    expect(f.voteCarried).toBe(await launchBallotCarried(pool));
    expect(f.voteCarried).toBe(false);
    expect(f.checklistFrozen).toBe(false);
    expect(launchLabel(f)).toBe("issuing-vote-not-held");
  });

  it("reads a carried vote as running, with the checklist frozen at the same instant", async () => {
    const at = new Date("2026-12-30T18:00:00.000Z");
    await recordLaunchCarried(pool, { ballotId: "bal-carried", closedBy: "u-founder", at });
    const f = await readLaunchFacts(pool);
    expect(f.voteCarried).toBe(true);
    expect(f.launchedByBallotId).toBe("bal-carried");
    expect(f.checklistFrozen).toBe(true);
    expect(f.launchedAt).toBe(at.toISOString());
    expect(launchLabel(f)).toBe("running");
  });

  describe("GET /api/admin/launch/facts", () => {
    const serve = (isAdmin: boolean) => {
      const app = express();
      const asked: string[] = [];
      register(app, {
        isAdmin: async (req) => {
          asked.push(req.path);
          return isAdmin;
        },
        getPool: () => pool,
      });
      const server = app.listen(0);
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/launch/facts`;
      return { url, asked, close: () => server.close() };
    };

    it("refuses a caller the admin gate refuses, and still asks the gate", async () => {
      const s = serve(false);
      try {
        const r = await fetch(s.url); // module-review-ok: the test calling its own in-process server
        expect(r.status).toBe(401);
        expect(await r.json()).toEqual({ error: "auth_required" });
        // The default-deny under /api/admin needs the gate consulted on every path, the refusal included.
        expect(s.asked).toEqual(["/api/admin/launch/facts"]);
      } finally {
        s.close();
      }
    });

    it("answers the facts and the label the facts give", async () => {
      const s = serve(true);
      try {
        const r = await fetch(s.url); // module-review-ok: the test calling its own in-process server
        expect(r.status).toBe(200);
        const body = await r.json();
        expect(body.facts).toEqual(await readLaunchFacts(pool));
        expect(body.label).toBe(launchLabel(body.facts));
        expect(body.label).toBe("running");
      } finally {
        s.close();
      }
    });
  });
});
