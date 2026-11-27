/**
 * THE APPLICANT FLOW, PART 2 (the lead, 27 Nov 2026): the six stages on the applicant's own page, and the applicant
 * refining their proposal at References and proposal until the final conversation opens. Over real HTTP and the S5
 * scratch schema; nothing is sent for real.
 *
 * What is pinned, each with a control:
 *   - the applicant's page reads the six stages in the lead's order, and the stage follows what the team does
 *   - refining is refused before References and proposal, saves there with the earlier version kept, and the team
 *     reads the replaced words on the walkthrough
 *   - it freezes once the final conversation opens
 *   - nothing moves a stage by itself
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { escapeHtml } from "../lib/comms/mailer";
import { loadVariables } from "../lib/variables";
import { createOrgRole, seatHolder } from "../lib/orgChart";
import { usersRepo } from "../repos/users";
import { register } from "./openProposals";
import { signLink } from "../lib/comms/links";

const configured = testDbConfigured();
if (!configured) console.warn("[applicantFlow] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const ORIGIN = "https://village.example.test";
const NOW_SEASON = { id: "s-now", name: "Season of Seeds", startsOn: "2000-01-01", endsOn: "2037-01-01" };
const NEXT = { id: "s-next", name: "Season of Roots", startsOn: "2037-01-01", endsOn: "2037-03-20" };
const person = (id: string, name: string) => ({ id, name, email: `${id}@example.test` });
const FOUNDER = person("u-af-founder", "Fern Oak");
const IA = person("u-af-ia", "Iva Alder");
const IB = person("u-af-ib", "Ivo Birch");
const FINAL = person("u-af-final", "Flor Lima");
const OUTSIDER = person("u-af-out", "Olly Out");

describe.skipIf(!configured)("the applicant flow, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let gate = "";
  let roleA = "";
  let roleFinal = "";
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "applicantflow-"));

  const state = {
    viewer: null as string | null,
    sent: [] as OutgoingEmail[],
    notices: [] as Array<{ userId: string; type: string; title: string; body?: string; dedupeKey: string; link?: string | null }>,
  };

  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned
  const variable = async (key: string, value: string) => {
    await q("INSERT INTO game_variables (config_key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [key, value]);
    await loadVariables(pool);
  };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 8 });
    const have = new Set((await q("SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'org_roles'")).map((r: any) => String(r.c)));
    for (const col of ["conversations", "selection_criteria", "conversation_mode"]) if (!have.has(col)) await q(`ALTER TABLE org_roles ADD COLUMN ${col} text NULL`);
    const users = usersRepo(pool);
    for (const p of [FOUNDER, IA, IB, FINAL, OUTSIDER]) await users.add({ id: p.id, name: p.name, email: p.email, passwordHash: "x", emailVerifiedAt: "2026-01-01T00:00:00.000Z", paths: [] } as any);
    await q("INSERT INTO circles (id, name, aliases, is_example) VALUES ('c-af', 'Core Circle', '[]', 0), ('c-af-people', 'People Circle', '[]', 0)");
    gate = await createOrgRole(pool, { id: "af-role-lead", name: "Lead Steward", seats: 1, circleId: "c-af", aim: "Hold the money." });
    roleA = await createOrgRole(pool, { id: "af-role-ops", name: "Operations Role", seats: 1, circleId: "c-af", aim: "Hold operations." });
    const roleB = await createOrgRole(pool, { id: "af-role-data", name: "Data Role", seats: 1, circleId: "c-af-people", aim: "Hold data." });
    roleFinal = await createOrgRole(pool, { id: "af-role-final", name: "Final Call Role", seats: 1, circleId: "c-af-people", aim: "Make the final call." });
    const until = new Date("2036-12-01T00:00:00Z");
    for (const [r, u] of [[roleA, IA], [roleB, IB], [roleFinal, FINAL]] as const) await seatHolder(pool, r, { userId: u.id, seasonId: "s-now", termEndsAt: until });
    // One conversation, held by the operations role.
    await q("UPDATE org_roles SET conversations = ? WHERE id = ?", [JSON.stringify([{ roleId: roleA, minutes: 30, final: false }]), gate]);
    await variable("org.final_call_role", roleFinal);

    const app = express();
    app.use(express.json());
    register(app, {
      getPool: () => pool,
      overLimit: async () => false,
      clientIp: () => "203.0.113.9",
      proposalFileDir: path.join(dataDir, "private-proposal-files"),
      guardCapability: async (_req: any, res: any, cap: string, refusal?: { status: number; body: unknown }) => {
        const ok = !!state.viewer && (cap === "terms.read" ? true : state.viewer === FOUNDER.id);
        if (ok) return true;
        if (refusal) res.status(refusal.status).json(refusal.body);
        else res.status(state.viewer ? 403 : 401).json({ error: state.viewer ? "forbidden" : "auth_required" });
        return false;
      },
      authedUser: async () => (state.viewer ? await usersRepo(pool).byId(state.viewer) : null),
      commsPostOffice: { getPool: () => pool },
      deploymentOrigin: () => ORIGIN,
      projectName: () => "Test Village",
      escapeHtml,
      seasonState: () => ({ current: NOW_SEASON, seasons: [NOW_SEASON, NEXT], timezone: "UTC" }),
      postEmail: async (email: OutgoingEmail) => {
        state.sent.push(email);
        return { status: "sent", messageId: "m-1" } as PostResult;
      },
      governanceLifecycle: () => "public",
      notify: async (n: any) => {
        state.notices.push(n);
        return { fresh: true };
      },
      notifyAdmins: async () => {},
      members: usersRepo(pool),
      firstName: (name: string) => String(name ?? "").trim().split(/\s+/)[0] ?? "",
      liveHoldersOf: async () => [FOUNDER.id],
      rolesCarrying: () => [],
      loadRoleHolders: () => [],
      seatCalendar: () => ({ seasons: [NOW_SEASON, NEXT], currentSeasonId: "s-now", timezone: "UTC" }),
      lapse: () => ({ currentSeasonId: "s-now", cadence: "season_turn" }),
      stageOf: async () => "guest",
      recordStageEvent: async () => {},
      sessionsOn: () => false,
    } as any);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("the test server did not report a port");
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await pool?.end();
    await db?.drop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    state.viewer = null;
    state.sent.length = 0;
    state.notices.length = 0;
  });

  const call = async (method: string, p: string, body?: unknown, as: string | null = null) => {
    state.viewer = as;
    try {
      const res = await fetch(`${base}${p}`, { // module-review-ok: a test calling its own local server, never an outside host
        method,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      return { status: res.status, body: json, text, headers: res.headers };
    } finally {
      state.viewer = null;
    }
  };

  const tokenOf = (mail: OutgoingEmail) => {
    const line = mail.text.split("\n").find((l) => /https:\/\/village\.example\.test\//.test(l)) as string;
    return new URL(/(https:\/\/\S+)/.exec(line)![1]).searchParams.get("token") as string;
  };

  const confirmed = async (email: string) => {
    const before = state.sent.length;
    const r = await call("POST", "/api/open-proposals", { name: "Rowan Field", email, locale: "en", roles: [{ roleId: gate, note: "I keep books." }], why: "I want to hold the money well.", aim: "A clear budget." });
    expect(r.status, r.text).toBe(200);
    const mail = state.sent[before];
    const id = mail.idempotencyKey.split(":")[1];
    expect((await call("POST", "/api/open-proposals/confirm", { token: tokenOf(mail) })).status).toBe(200);
    return id;
  };

  const app = (id: string) => `/api/governance/applications/${id}`;
  const interviewOf = async (id: string) => Number((await q("SELECT id FROM application_interviews WHERE application_ref = ? ORDER BY position LIMIT 1", [id]))[0].id);
  const status = async (id: string) => {
    const r = await call("GET", `/api/application-status/${id}?token=${encodeURIComponent(signLink("application_status", { ref: id }, 1))}`);
    expect(r.status, r.text).toBe(200);
    return r.body.status;
  };
  const refine = (id: string, body: unknown) => call("POST", `/api/application-status/${id}/proposal?token=${encodeURIComponent(signLink("application_status", { ref: id }, 1))}`, body);
  const nowOf = async (id: string) => (await status(id)).sixStages.now;
  /** Shortlisted, the first conversation written up, references asked: References and proposal. */
  const atReferences = async (email: string) => {
    const id = await confirmed(email);
    expect((await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id)).status).toBe(200);
    await q("UPDATE application_interviews SET state = 'scored' WHERE id = ?", [await interviewOf(id)]);
    expect((await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id)).status).toBe(200);
    return id;
  };

  /**
   * Everything References and proposal asks (QA round 4): the references asked if they were not, given by the
   * applicant's own link, and each followed up (fixture SQL: the follow-up door is tested in applicantOnboarding.test).
   */
  const readyForFinal = async (id: string) => {
    const [asked] = await q("SELECT COUNT(*) AS n FROM application_steps WHERE application_ref = ? AND kind = 'refs_asked'", [id]);
    if (!Number(asked.n)) expect((await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id)).status).toBe(200);
    const given = await call("POST", `/api/application-status/${id}/references?token=${encodeURIComponent(signLink("application_status", { ref: id }, 1))}`, {
      references: [
        { name: "Ana Reference", email: "ana.reference@example.test", whatsapp: "+506 8888 1234", how: "We kept the books of a farm together.", ally: "" },
        { name: "Ben Reference", email: "ben.reference@example.test", whatsapp: "+506 8888 1234", how: "He hired me for two harvests.", ally: "" },
      ],
    });
    expect(given.status, given.text).toBe(200);
    await q("UPDATE application_references SET followed_up_at = NOW(3) WHERE application_ref = ?", [id]);
  };

  it("the applicant's page reads the six stages in order, and the stage follows what the team does", async () => {
    const id = await confirmed("flow-stages@example.test");
    const s = await status(id);
    expect(s.sixStages.stages.map((x: any) => x.key)).toEqual(["received", "review", "references", "final_interview", "agreement", "start"]);
    expect(s.sixStages.now).toBe("review");
    // Refining is open from the start (the lead, 27 Nov 2026: "they can refine proposal in each stage").
    expect(s.sixStages.refine.open).toBe(true);
    await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id);
    // Shortlisted, the first conversation not yet written up: still our review.
    expect(await nowOf(id)).toBe("review");
    await q("UPDATE application_interviews SET state = 'scored' WHERE id = ?", [await interviewOf(id)]);
    expect(await nowOf(id)).toBe("references");
    // Stage keys and states, the shortlist flag and the next ROLE (QA round 2): no note, score, reference or person rides on it.
    expect(Object.keys(s.sixStages).sort()).toEqual(["anchorCircle", "next", "now", "refine", "shortlisted", "stages", "toCircle"]);
    expect(s.sixStages.shortlisted).toBe(false);
    expect(s.sixStages.next).toBeNull();
  });

  it("refining saves at every stage before Agreement, with the earlier version kept, and the team reads what changed", async () => {
    // From Received on (the lead, 27 Nov 2026: "they can refine proposal in each stage").
    const early = await confirmed("flow-early@example.test");
    const before = await refine(early, { why: "New why.", aim: "New aim." });
    expect([before.status, before.body.versions]).toEqual([200, 1]);

    const id = await atReferences("flow-refine@example.test");
    expect((await status(id)).sixStages.refine).toMatchObject({ open: true, frozen: false, why: "I want to hold the money well.", aim: "A clear budget.", versions: 0 });
    // CONTROLS: a wrong token is the same 404 as a stranger; empty words and unchanged words write nothing.
    expect((await call("POST", `/api/application-status/${id}/proposal?token=nope`, { why: "x", aim: "y" })).status).toBe(404);
    expect((await refine(id, { why: "", aim: "y" })).status).toBe(400);
    expect((await refine(id, { why: "I want to hold the money well.", aim: "A clear budget." })).body.error).toBe("unchanged");

    const saved = await refine(id, { why: "I kept the books of two farms for six years.", aim: "Monthly books anyone can read." });
    expect(saved.status, saved.text).toBe(200);
    expect(saved.body.versions).toBe(1);
    const [row] = await q("SELECT JSON_UNQUOTE(JSON_EXTRACT(body_json, '$.why')) AS why FROM open_role_proposals WHERE id = ?", [id]);
    expect(row.why).toBe("I kept the books of two farms for six years.");
    expect((await status(id)).sixStages.refine.versions).toBe(1);
    // The team reads the words it replaced; an outsider reads nothing.
    const w = await call("GET", `${app(id)}/walkthrough`, undefined, FOUNDER.id);
    expect(w.body.walkthrough.proposalVersions.map((v: any) => [v.why, v.aim])).toEqual([["I want to hold the money well.", "A clear budget."]]);
    expect((await call("GET", `${app(id)}/walkthrough`, undefined, OUTSIDER.id)).status).toBe(404);
  });

  it("stays open through the final conversation, and freezes once it is written up (the lead, 27 Nov 2026)", async () => {
    const id = await atReferences("flow-freeze@example.test");
    expect((await refine(id, { why: "Second why.", aim: "Second aim." })).status).toBe(200);
    await readyForFinal(id);
    // Moving to the final conversation is the team's act, and it is what opens it (QA round 1).
    const moved = await call("POST", `${app(id)}/final-conversation`, {}, FINAL.id);
    expect(moved.status, moved.text).toBe(200);
    expect((await q("SELECT state FROM application_interviews WHERE application_ref = ? AND is_final = 1", [id]))[0].state).toBe("open");
    expect(await nowOf(id)).toBe("final_interview");
    // "they can also refine their proposal from this conversation": still open at the Final conversation.
    expect((await status(id)).sixStages.refine).toMatchObject({ open: true, frozen: false });
    expect((await refine(id, { why: "Third why.", aim: "Third aim." })).status).toBe(200);
    // RULING 7: the final written up fixes nothing; the applicant refines once more, then sends it to the anchor circle.
    await q("UPDATE application_interviews SET state = 'scored' WHERE application_ref = ? AND is_final = 1", [id]);
    expect(await nowOf(id)).toBe("final_interview");
    expect((await status(id)).sixStages).toMatchObject({ toCircle: true, refine: { open: true, frozen: false } });
    expect((await refine(id, { why: "Fourth why.", aim: "Fourth aim." })).status).toBe(200);
    expect((await call("POST", `/api/application-status/${id}/to-circle?token=${encodeURIComponent(signLink("application_status", { ref: id }, 1))}`)).status).toBe(200);
    expect(await nowOf(id)).toBe("agreement");
    const frozen = await refine(id, { why: "Fifth why.", aim: "Fifth aim." });
    expect([frozen.status, frozen.body.error]).toEqual([409, "closed"]);
    expect((await status(id)).sixStages.refine).toMatchObject({ open: false, frozen: true });
    const [row] = await q("SELECT JSON_UNQUOTE(JSON_EXTRACT(body_json, '$.why')) AS why FROM open_role_proposals WHERE id = ?", [id]);
    expect(row.why).toBe("Fourth why.");
  });

  it("a stage never moves by itself: reading the page, refining and waiting change no step", async () => {
    const id = await atReferences("flow-still@example.test");
    const steps = async () => (await q("SELECT kind FROM application_steps WHERE application_ref = ? ORDER BY id", [id])).map((r: any) => r.kind);
    const was = await steps();
    await status(id);
    await refine(id, { why: "Still why.", aim: "Still aim." });
    await status(id);
    expect(await steps()).toEqual(was);
    expect(await nowOf(id)).toBe("references");
  });

  it("THE CASE QA ROUND 1 HIT: writing up the last conversation never opens the final one; only the team's move does", async () => {
    // A role whose own list names a final conversation: before this change it opened by itself once the others scored.
    await q("UPDATE org_roles SET conversations = ? WHERE id = ?", [JSON.stringify([{ roleId: roleA, minutes: 30, final: false }, { roleId: roleFinal, minutes: 30, final: true }]), gate]);
    try {
      const id = await confirmed("flow-final-waits@example.test");
      expect((await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id)).status).toBe(200);
      const [first] = await q("SELECT id FROM application_interviews WHERE application_ref = ? AND is_final = 0", [id]);
      await q("UPDATE application_interviews SET state = 'open', opened_at = NOW(3) WHERE id = ?", [first.id]);
      const card = await call("GET", `${app(id)}/scorecards`, undefined, IA.id);
      const criteria = card.body?.scorecards?.criteria ?? [{ id: "c1" }];
      const scored = await call("POST", `${app(id)}/interviews/${first.id}/score`, { entries: criteria.map((c: any) => ({ criterionId: c.id, level: "solid", evidence: "Heard it." })), gut: { answer: "yes", note: "" } }, IA.id);
      expect(scored.status, scored.text).toBe(200);
      // The final conversation still waits, the applicant is still at References and proposal, and no final button shows.
      expect((await q("SELECT state FROM application_interviews WHERE application_ref = ? AND is_final = 1", [id]))[0].state).toBe("waiting");
      await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id);
      const s1 = await status(id);
      expect(s1.sixStages.now).toBe("references");
      expect(s1.bookNow).toBeNull();
      expect(s1.sixStages.refine.open).toBe(true);
      await readyForFinal(id);
      // The team moves it on: that opens the final conversation; the proposal stays open to refine (the lead, 27 Nov 2026).
      expect((await call("POST", `${app(id)}/final-conversation`, {}, FINAL.id)).status).toBe(200);
      const s2 = await status(id);
      expect(s2.sixStages.now).toBe("final_interview");
      expect(s2.sixStages.refine).toMatchObject({ open: true, frozen: false });
      expect(s2.bookNow?.final).toBe(true);
    } finally {
      await q("UPDATE org_roles SET conversations = ? WHERE id = ?", [JSON.stringify([{ roleId: roleA, minutes: 30, final: false }]), gate]);
    }
  });

  it("QA ROUND 2: a final listed FIRST never opens on confirm, and with no final-call role the team can still move to it", async () => {
    // The role's own list names the final first, and the village names no final-call role (the older path).
    await q("UPDATE org_roles SET conversations = ? WHERE id = ?", [JSON.stringify([{ roleId: roleFinal, minutes: 30, final: true }, { roleId: roleA, minutes: 30, final: false }]), gate]);
    await variable("org.final_call_role", "");
    try {
      const id = await confirmed("flow-final-first@example.test");
      // QA ROUND 3: the older path's waiting final is not movable before References and proposal (no shortlist, no
      // first conversation written up): the door refuses (in its own words for what is first), and the page offers nothing.
      const early = await call("POST", `${app(id)}/final-conversation`, {}, FOUNDER.id);
      expect(early.status, early.text).toBe(409);
      expect((await call("GET", `${app(id)}/walkthrough`, undefined, FOUNDER.id)).body.walkthrough.you.mayAddFinal).toBe(false);
      const rows = async () => (await q("SELECT position, is_final, state FROM application_interviews WHERE application_ref = ? ORDER BY position", [id])).map((r: any) => [Number(r.position), Number(r.is_final), r.state]);
      // The final went last, and nothing about it is open.
      const after = await rows();
      expect(after.map((r: any[]) => r[1])).toEqual([0, 1]);
      expect(after[1][2]).toBe("waiting");
      expect((await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id)).status).toBe(200);
      // The invitation (or the confirm itself) opens the NON-final conversation, never the final.
      const [nonFinal] = await q("SELECT id, state FROM application_interviews WHERE application_ref = ? AND is_final = 0", [id]);
      if (nonFinal.state === "waiting") await q("UPDATE application_interviews SET state = 'open', opened_at = NOW(3) WHERE id = ?", [nonFinal.id]);
      expect((await rows())[1][2]).toBe("waiting");
      await q("UPDATE application_interviews SET state = 'scored' WHERE id = ?", [nonFinal.id]);
      expect((await rows())[1][2]).toBe("waiting");
      // QA ROUND 4, CASE B: the older path with no references asked. Before, the door let it through; now it refuses
      // with the readiness words, and the page offers no move.
      const noRefs = await call("POST", `${app(id)}/final-conversation`, {}, FOUNDER.id);
      expect([noRefs.status, noRefs.body?.error]).toEqual([409, "not_references"]);
      expect((await rows())[1][2]).toBe("waiting");
      expect((await call("GET", `${app(id)}/walkthrough`, undefined, FOUNDER.id)).body.walkthrough.you.mayAddFinal).toBe(false);
      await readyForFinal(id);
      // The page offers the move (it named the final but showed no button before), and the server accepts it.
      const w = await call("GET", `${app(id)}/walkthrough`, undefined, FOUNDER.id);
      expect(w.status, w.text).toBe(200);
      expect(w.body.walkthrough.you.mayAddFinal).toBe(true);
      const moved = await call("POST", `${app(id)}/final-conversation`, {}, FOUNDER.id);
      expect(moved.status, moved.text).toBe(200);
      expect((await rows())[1][2]).toBe("open");
      expect((await call("GET", `${app(id)}/walkthrough`, undefined, FOUNDER.id)).body.walkthrough.you.mayAddFinal).toBe(false);
    } finally {
      await variable("org.final_call_role", roleFinal);
      await q("UPDATE org_roles SET conversations = ? WHERE id = ?", [JSON.stringify([{ roleId: roleA, minutes: 30, final: false }]), gate]);
    }
  });
});
