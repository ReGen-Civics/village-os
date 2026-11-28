/**
 * TAKING AN APPLICANT TO A DECISION (shortlist, references, follow-up owners,
 * the final conversation and the gathered view), over real HTTP and the S5
 * scratch schema. The mail door is a fake that records what would go out:
 * nothing is sent for real.
 *
 * What is pinned, each with a control that fails for the reason claimed:
 *   - only the power to place people in roles shortlists, once, and references
 *     are asked only of a shortlisted application, once, with one letter in the
 *     applicant's language carrying their status link
 *   - the applicant gives references by that link, once; each goes first to the
 *     village's follow-up ROLE, and the team hears they arrived
 *   - contact details reach the reviewers, the final-call role and each
 *     reference's owner, and nobody else: never the applicant's page, never a
 *     member outside it
 *   - only the owner writes notes; a reference given to a member leaves the role
 *   - the final conversation is one more conversation in the existing model,
 *     held by the final-call role, opening in order; the final-call role reads
 *     every scorecard in the gathered view
 *   - the admin list carries each application's stage
 *   - the references go with the anonymise and erasure paths
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { escapeHtml } from "../lib/comms/mailer";
import { loadVariables } from "../lib/variables";
import { createOrgRole, seatHolder } from "../lib/orgChart";
import { usersRepo } from "../repos/users";
import { clearReviewOf, forgetMemberReview } from "../repos/applicationReview";
import { anonymiseOpenProposal } from "../repos/openProposals";
import { insertApplication } from "../repos/seatApplications";
import { register, tidyOpenProposals } from "./openProposals";
import { signLink } from "../lib/comms/links";
import { saveSections } from "../lib/roleCardSections";
import { EMPTY_SECTIONS } from "../../shared/roleCardSections";

const configured = testDbConfigured();
if (!configured) console.warn("[applicantOnboarding] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const ORIGIN = "https://village.example.test";
const NEXT = { id: "s-next", name: "Season of Roots", startsOn: "2037-01-01", endsOn: "2037-03-20" };
const NOW_SEASON = { id: "s-now", name: "Season of Seeds", startsOn: "2000-01-01", endsOn: "2037-01-01" };
const person = (id: string, name: string) => ({ id, name, email: `${id}@example.test` });
const FOUNDER = person("u-ob-founder", "Fern Oak");
const IA = person("u-ob-ia", "Iva Alder");
const IB = person("u-ob-ib", "Ivo Birch");
const HR = person("u-ob-hr", "Hana Reed");
const FINAL = person("u-ob-final", "Flor Lima");
const OUTSIDER = person("u-ob-out", "Olly Out");
/** A member holding no role yet: their application is for a first long-term role. */
const NEWBIE = person("u-ob-new", "Nia New");

const REFS = [
  // Each with an email and one of WhatsApp, a US phone or Signal (the lead, 27 Nov 2026).
  { name: "Ana Reference", email: "ana.reference@example.test", whatsapp: "+506 8888 1234", how: "We built a school garden together.", ally: "She runs the valley seed library." },
  { name: "Ben Reference", email: "ben.reference@example.test", usPhone: "(415) 555-0132", how: "He hired me for two harvests.", ally: "" },
];

describe.skipIf(!configured)("applicant onboarding, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let gate = "";
  let roleA = "";
  let roleB = "";
  let roleHR = "";
  let roleFinal = "";

  const state = {
    viewer: null as string | null,
    powerHolders: [FOUNDER.id] as string[],
    sent: [] as OutgoingEmail[],
    answer: { status: "sent", messageId: "m-1" } as PostResult,
    notices: [] as Array<{ userId: string; type: string; title: string; dedupeKey: string; link?: string | null }>,
  };

  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned
  const calendar = () => ({ seasons: [NOW_SEASON, NEXT], currentSeasonId: "s-now", timezone: "UTC" });

  async function ensureRoleColumns() {
    const have = new Set((await q("SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'org_roles'")).map((r: any) => String(r.c)));
    for (const col of ["conversations", "selection_criteria", "conversation_mode"]) if (!have.has(col)) await q(`ALTER TABLE org_roles ADD COLUMN ${col} text NULL`);
  }

  const variable = async (key: string, value: string) => {
    await q("INSERT INTO game_variables (config_key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [key, value]);
    await loadVariables(pool);
  };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 8 });
    await ensureRoleColumns();
    const users = usersRepo(pool);
    for (const p of [FOUNDER, IA, IB, HR, FINAL, OUTSIDER, NEWBIE]) await users.add({ id: p.id, name: p.name, email: p.email, passwordHash: "x", emailVerifiedAt: "2026-01-01T00:00:00.000Z", paths: [] } as any);
    // The people circle is not the application's circle, so its holders are not asked to consent: they read as owners and the final call only.
    await q("INSERT INTO circles (id, name, aliases, is_example) VALUES ('c-ob', 'Core Circle', '[]', 0), ('c-ob-people', 'People Circle', '[]', 0)");
    gate = await createOrgRole(pool, { id: "ob-role-lead", name: "Lead Steward", seats: 1, circleId: "c-ob", aim: "Hold the money." });
    roleA = await createOrgRole(pool, { id: "ob-role-a", name: "Channel Role", seats: 1, circleId: "c-ob", aim: "a" });
    roleB = await createOrgRole(pool, { id: "ob-role-b", name: "Data Role", seats: 1, circleId: "c-ob-people", aim: "b" });
    roleHR = await createOrgRole(pool, { id: "ob-role-hr", name: "People and Operations", seats: 1, circleId: "c-ob-people", aim: "Hold human relations and operations." });
    roleFinal = await createOrgRole(pool, { id: "ob-role-final", name: "Final Call Role", seats: 1, circleId: "c-ob-people", aim: "Make the final call." });
    const until = new Date("2036-12-01T00:00:00Z");
    for (const [r, u] of [[roleA, IA], [roleB, IB], [roleHR, HR], [roleFinal, FINAL]] as const) await seatHolder(pool, r, { userId: u.id, seasonId: "s-now", termEndsAt: until });
    // One intuition conversation with the Channel Role; the role names no final one of its own.
    await q("UPDATE org_roles SET conversations = ?, selection_criteria = ? WHERE id = ?", [JSON.stringify([{ roleId: roleA, minutes: 30, final: false }]), JSON.stringify(["Keeps the village's pace"]), gate]);
    await variable("org.reference_followup_role", roleHR);
    await variable("org.final_call_role", roleFinal);

    const app = express();
    app.use(express.json());
    register(app, {
      getPool: () => pool,
      overLimit: async () => false,
      clientIp: () => "203.0.113.9",
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
        return state.answer;
      },
      governanceLifecycle: () => "public",
      notify: async (n: any) => {
        state.notices.push(n);
        return { fresh: true };
      },
      notifyAdmins: async () => {},
      members: usersRepo(pool),
      firstName: (name: string) => String(name ?? "").trim().split(/\s+/)[0] ?? "",
      liveHoldersOf: async () => state.powerHolders,
      rolesCarrying: () => [],
      loadRoleHolders: () => [],
      seatCalendar: calendar,
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
  });

  beforeEach(() => {
    state.viewer = null;
    state.powerHolders = [FOUNDER.id];
    state.sent.length = 0;
    state.notices.length = 0;
  });

  const call = async (method: string, path: string, body?: unknown, as: string | null = null) => {
    state.viewer = as;
    try {
      const res = await fetch(`${base}${path}`, { // module-review-ok: a test calling its own local server, never an outside host
        method,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, body: (await res.json().catch(() => null)) as any };
    } finally {
      state.viewer = null;
    }
  };

  const tokenOf = (mail: OutgoingEmail) => {
    const line = mail.text.split("\n").find((l) => /https:\/\/village\.example\.test\//.test(l)) as string;
    const url = /(https:\/\/\S+)/.exec(line)![1];
    return new URL(url).searchParams.get("token") as string;
  };

  /** Send and confirm an application for the Lead Steward, in the language given. */
  const confirmed = async (email: string, locale: "en" | "es" = "en") => {
    const before = state.sent.length;
    const r = await call("POST", "/api/open-proposals", { name: "Rowan Field", email, locale, roles: [{ roleId: gate, note: "I keep books." }], why: "I want to hold the money well.", aim: "A clear budget." }, null);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const mail = state.sent[before];
    const id = mail.idempotencyKey.split(":")[1];
    const ok = await call("POST", "/api/open-proposals/confirm", { token: tokenOf(mail) }, null);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    return id;
  };

  const app = (id: string) => `/api/governance/applications/${id}`;
  const walk = (id: string, as: string) => call("GET", `${app(id)}/walkthrough`, undefined, as);
  const refRows = (id: string) => q("SELECT id, position, name, contact, owner_role_id, owner_user_id, notes, notes_by FROM application_references WHERE application_ref = ? ORDER BY position", [id]);
  const interviews = (id: string) => q("SELECT id, position, interviewer_role_id, is_final, state FROM application_interviews WHERE application_ref = ? ORDER BY position", [id]);

  /** Shortlist, ask, and give the references by the link in the letter. */
  const withReferences = async (email: string, locale: "en" | "es" = "en") => {
    const id = await confirmed(email, locale);
    expect((await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id)).status).toBe(200);
    expect((await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id)).status).toBe(200);
    // References' one letter waits for the first conversation's write-up too (QA round 5): the status link is signed here.
    const letter = state.sent.find((m) => m.idempotencyKey === `open-proposal:${id}:stage:references`);
    const token = signLink("application_status", { ref: id }, 1);
    const given = await call("POST", `/api/application-status/${id}/references?token=${encodeURIComponent(token)}`, { references: REFS }, null);
    expect(given.status, JSON.stringify(given.body)).toBe(200);
    return { id, token, letter };
  };

  describe("the shortlist", () => {
    it("is answered once, by a holder of the power to place people in roles", async () => {
      const id = await confirmed("short@example.test");
      expect((await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, OUTSIDER.id)).status).toBe(403);
      expect((await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, HR.id)).status).toBe(403);
      const ok = await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id);
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      // A second answer, either way, loses: the step admits one.
      expect((await call("POST", `${app(id)}/shortlist`, { answer: "no" }, FOUNDER.id)).status).toBe(409);
    });

    it("a no records the answer and declines nobody by itself", async () => {
      const id = await confirmed("notshort@example.test");
      expect((await call("POST", `${app(id)}/shortlist`, { answer: "no" }, FOUNDER.id)).status).toBe(200);
      const [p] = await q("SELECT status FROM open_role_proposals WHERE id = ?", [id]);
      expect(p.status).toBe("confirmed");
      const w = await walk(id, FOUNDER.id);
      // Not shortlisted: it stays in our review, with the decline as the next act (six stages, 27 Nov 2026).
      expect(w.body.walkthrough.track.now).toBe("review");
      expect(w.body.walkthrough.track.primary).toBe("decide");
      expect(state.sent.filter((m) => m.idempotencyKey.includes(id) && m.idempotencyKey.includes("declined"))).toEqual([]);
    });
  });

  describe("asking for references", () => {
    it("waits for the shortlist, then sends one letter in the applicant's language with their status link", async () => {
      const id = await confirmed("ask@example.test", "es");
      // CONTROL: before the shortlist it is refused and nothing goes.
      expect((await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id)).status).toBe(409);
      expect(state.sent.some((m) => m.idempotencyKey.endsWith(":update:references"))).toBe(false);
      await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id);
      expect((await call("POST", `${app(id)}/references/ask`, {}, OUTSIDER.id)).status).toBe(403);
      expect((await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id)).status).toBe(200);
      // ONE EMAIL AT REFERENCES (QA rounds 4 and 5): asked before the first conversation is written up, the stage's letter
      // waits for it, so it carries the ask AND the conversation after; nothing goes at the ask alone.
      expect(state.sent.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${id}:stage:references`))).toEqual([]);
      expect(state.sent.filter((m) => m.idempotencyKey === `open-proposal:${id}:update:references`)).toEqual([]);
      const [first] = await interviews(id);
      const card = await call("GET", `${app(id)}/scorecards`, undefined, IA.id);
      const criteria = card.body.scorecards.criteria as Array<{ id: string }>;
      expect((await call("POST", `${app(id)}/interviews/${first.id}/score`, { entries: criteria.map((c) => ({ criterionId: c.id, level: "solid", evidence: "Heard it." })), gut: { answer: "yes", note: "" } }, IA.id)).status).toBe(200);
      const letters = state.sent.filter((m) => m.idempotencyKey === `open-proposal:${id}:stage:references`);
      expect(letters).toHaveLength(1);
      expect(state.sent.filter((m) => m.idempotencyKey === `open-proposal:${id}:update:references`)).toEqual([]);
      expect(letters[0].to.email).toBe("ask@example.test");
      expect(letters[0].subject).toContain("referencias");
      expect(letters[0].text).toContain(`${ORIGIN}/application-status/${id}?token=`);
      // Asked twice: refused, and no second letter.
      expect((await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id)).status).toBe(409);
      expect(state.sent.filter((m) => m.idempotencyKey === `open-proposal:${id}:stage:references`)).toHaveLength(1);
    });
  });

  describe("the applicant gives their references", () => {
    it("by the link, once; each goes to the follow-up role and the team hears they arrived", async () => {
      const { id, token } = await withReferences("give@example.test");
      const rows = await refRows(id);
      // Nobody is named an owner (ruling 22, QA round 5): each waits for somebody who may read it to claim it.
      expect(rows.map((r: any) => [r.position, r.name, r.owner_role_id, r.owner_user_id])).toEqual([
        [1, "Ana Reference", "", null],
        [2, "Ben Reference", "", null],
      ]);
      const told = state.notices.filter((n) => n.type === "application_references_in").map((n) => n.userId).sort();
      // "Interviewers + placers" (ruling 22): the placer, the final-call role and the conversation's holder; not the follow-up role.
      expect(told).toEqual([FOUNDER.id, FINAL.id, IA.id].sort());
      // No name or contact rides on a notice.
      expect(JSON.stringify(state.notices)).not.toContain("ana.reference@example.test");
      // THE EDIT (the lead, 27 Nov 2026): while nobody has reached out, a second list replaces the first, and the team
      // is not told twice.
      const noticesBefore = state.notices.length;
      const again = await call("POST", `/api/application-status/${id}/references?token=${encodeURIComponent(token)}`, { references: [REFS[1], REFS[0]] }, null);
      expect(again.status, JSON.stringify(again.body)).toBe(200);
      expect((await refRows(id)).map((r: any) => r.name)).toEqual(["Ben Reference", "Ana Reference"]);
      expect(state.notices.length).toBe(noticesBefore);
      // Once somebody has followed one up, the list is the team's: refused, and nothing changes.
      await q("UPDATE application_references SET followed_up_at = NOW(3) WHERE application_ref = ? AND position = 1", [id]);
      const late = await call("POST", `/api/application-status/${id}/references?token=${encodeURIComponent(token)}`, { references: [REFS[0], REFS[1]] }, null);
      expect(late.status).toBe(409);
      expect((await refRows(id)).map((r: any) => r.name)).toEqual(["Ben Reference", "Ana Reference"]);
      // CONTROL: a wrong token is the same 404 as an unknown ref.
      expect((await call("POST", `/api/application-status/${id}/references?token=nope`, { references: REFS }, null)).status).toBe(404);
    });

    it("refuses a list before references were asked for, and a bad row with its row number", async () => {
      const id = await confirmed("early@example.test");
      await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id);
      // A link signed for this application, as the later letters carry: before references are asked for, a list is refused.
      const early = await call("POST", `/api/application-status/${id}/references?token=${encodeURIComponent(signLink("application_status", { ref: id }, 1))}`, { references: REFS }, null);
      expect(early.status).toBe(409);
      expect(early.body.error).toBe("not_asked");
      await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id);
      // The applicant's status link (References' letter waits for the first write-up, QA round 5).
      const linkToken = signLink("application_status", { ref: id }, 1);
      const bad = await call("POST", `/api/application-status/${id}/references?token=${encodeURIComponent(linkToken)}`, { references: [REFS[0], { name: "No Way", email: "no.way@example.test", how: "x" }] }, null);
      expect(bad.status).toBe(400);
      // An email alone is refused: one of WhatsApp, a US phone or Signal too (the lead, 27 Nov 2026).
      expect(bad.body).toMatchObject({ error: "channel", row: 1 });
      const badNumber = await call("POST", `/api/application-status/${id}/references?token=${encodeURIComponent(linkToken)}`, { references: [REFS[0], { name: "No Way", email: "no.way@example.test", usPhone: "12", how: "x" }] }, null);
      expect(badNumber.body).toMatchObject({ error: "contact", row: 1 });
      // The status page asks at least two too (the lead, 19 Nov 2026).
      const one = await call("POST", `/api/application-status/${id}/references?token=${encodeURIComponent(linkToken)}`, { references: [REFS[0]] }, null);
      expect([one.status, one.body.error]).toEqual([400, "too_few"]);
      expect(await refRows(id)).toEqual([]);
    });

    it("the applicant's page shows the step and a count, never the details back", async () => {
      const { id, token } = await withReferences("page@example.test");
      const s = await call("GET", `/api/application-status/${id}?token=${encodeURIComponent(token)}`, undefined, null);
      expect(s.status).toBe(200);
      // Editable while nobody has reached out (the lead, 27 Nov 2026).
      expect(s.body.status.referencesAsked).toEqual({ given: 2, mayAdd: false, mayEdit: true, reached: [false, false] });
      expect(s.body.status.path.map((p: any) => p.label)).toContain("References");
      const text = JSON.stringify(s.body);
      for (const secret of ["Ana Reference", "ana.reference@example.test", "8888", "seed library"]) expect(text).not.toContain(secret);
    });
  });

  describe("who reads the references", () => {
    it("'Interviewers + placers' read the details; the follow-up role's holder with no conversation role and another member get a 404", async () => {
      const { id } = await withReferences("read@example.test");
      // The placer, the final-call role and the first conversation's holder.
      for (const who of [FOUNDER.id, FINAL.id, IA.id]) {
        const w = await walk(id, who);
        expect(w.status, who).toBe(200);
        expect(w.body.walkthrough.references.list.map((r: any) => r.contact)).toEqual(["Email: ana.reference@example.test\nWhatsApp: +506 8888 1234", "Email: ben.reference@example.test\nUS phone: (415) 555-0132"]);
      }
      for (const who of [OUTSIDER.id, HR.id]) {
        const out = await walk(id, who);
        if (out.status === 200) expect(out.body.walkthrough.references.list).toEqual([]);
        else expect(out.status).toBe(404);
        expect(JSON.stringify(out.body)).not.toContain("ana.reference");
      }
    });

    it("NOBODY IS NAMED AN OWNER (ruling 22, QA round 5): the owner door is gone; the member who claims a reference writes its notes, and nobody else", async () => {
      const { id } = await withReferences("owner@example.test");
      const [ana] = await refRows(id);
      expect((await call("POST", `${app(id)}/references/${ana.id}/owner`, { userId: IB.id }, FOUNDER.id)).status).toBe(404);
      // Unclaimed, nobody writes its notes.
      expect((await call("POST", `${app(id)}/references/${ana.id}/notes`, { notes: "Called her.", followedUp: true }, IA.id)).status).toBe(403);
      expect((await call("POST", `${app(id)}/references/${ana.id}/claim`, {}, IA.id)).status).toBe(200);
      expect((await call("POST", `${app(id)}/references/${ana.id}/notes`, { notes: "Called her.", followedUp: true }, FOUNDER.id)).status).toBe(403);
      const saved = await call("POST", `${app(id)}/references/${ana.id}/notes`, { notes: "Called her. Warm, and keen to swap seeds with the village.", followedUp: true }, IA.id);
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      const after = (await refRows(id))[0];
      expect([after.notes_by, after.notes]).toEqual([IA.id, "Called her. Warm, and keen to swap seeds with the village."]);
    });
  });

  describe("the final conversation and the gathered view", () => {
    it("is one more conversation, held by the final-call role, opened only by the team's move; the final-call role reads every scorecard", async () => {
      const { id } = await withReferences("final@example.test");
      expect((await call("POST", `${app(id)}/final-conversation`, {}, OUTSIDER.id)).status).toBe(403);
      // One conversation open at a time: the Channel Role's is still open, so the move waits (QA round 1).
      const early = await call("POST", `${app(id)}/final-conversation`, {}, FINAL.id);
      expect([early.status, early.body.error]).toEqual([409, "talks_first"]);
      expect((await interviews(id)).map((i: any) => Number(i.is_final))).toEqual([0]);

      // The Channel Role writes up its conversation; nothing opens by itself.
      const ivs = await interviews(id);
      const card = await call("GET", `${app(id)}/scorecards`, undefined, IA.id);
      const criteria = card.body.scorecards.criteria as Array<{ id: string }>;
      const scored = await call("POST", `${app(id)}/interviews/${ivs[0].id}/score`, { entries: criteria.map((c) => ({ criterionId: c.id, level: "solid", evidence: "Heard it." })), gut: { answer: "yes", note: "" } }, IA.id);
      expect(scored.status, JSON.stringify(scored.body)).toBe(200);
      expect((await interviews(id)).map((i: any) => Number(i.is_final))).toEqual([0]);

      // QA ROUND 4, CASE A: references given but not followed up. The page offers no move, and the door refuses the
      // final-call holder too: nothing opens and the proposal stays open to refine.
      const notYet = await call("POST", `${app(id)}/final-conversation`, {}, FINAL.id);
      expect([notYet.status, notYet.body.error]).toEqual([409, "not_references"]);
      expect((await interviews(id)).map((i: any) => Number(i.is_final))).toEqual([0]);
      expect((await walk(id, FINAL.id)).body.walkthrough.you.mayAddFinal).toBe(false);
      // Each owner follows up (fixture: the follow-up itself is tested above).
      await q("UPDATE application_references SET followed_up_at = NOW(3) WHERE application_ref = ?", [id]);
      expect((await walk(id, FINAL.id)).body.walkthrough.you.mayAddFinal).toBe(true);

      // The team moves it to the final conversation: it opens at once and its holder is asked.
      const added = await call("POST", `${app(id)}/final-conversation`, {}, FINAL.id);
      expect(added.status, JSON.stringify(added.body)).toBe(200);
      expect(added.body.opened).toBe(true);
      expect((await interviews(id)).map((i: any) => [i.interviewer_role_id, Number(i.is_final), i.state])).toEqual([
        [roleA, 0, "scored"],
        [roleFinal, 1, "open"],
      ]);
      expect((await call("POST", `${app(id)}/final-conversation`, {}, FINAL.id)).status).toBe(409);
      expect(state.notices.some((n) => n.type === "application_interview_turn" && n.userId === FINAL.id)).toBe(true);
      const ivsAfter = await interviews(id);

      // Gathered: the final-call role reads the scorecard without holding the power to place people in roles, and has not interviewed yet.
      const w = await walk(id, FINAL.id);
      expect(w.body.walkthrough.scorecards.mayRead).toBe(false);
      // CONTROL for the line above: the anchoring rule. The final-call role IS an interviewer now, so it reads after its own card.
      const finalCard = await call("POST", `${app(id)}/interviews/${ivsAfter[1].id}/score`, { entries: criteria.map((c) => ({ criterionId: c.id, level: "strong", evidence: "Clear." })), gut: { answer: "yes", note: "" } }, FINAL.id);
      expect(finalCard.status, JSON.stringify(finalCard.body)).toBe(200);
      const gathered = await walk(id, FINAL.id);
      expect(gathered.body.walkthrough.scorecards.mayRead).toBe(true);
      expect(gathered.body.walkthrough.scorecards.interviews[0].entries[0].evidence).toBe("Heard it.");
      // Ruling 7: the final written up waits for the proposal to be sent to the anchor circle.
      expect(gathered.body.walkthrough.track).toMatchObject({ now: "final_interview", primary: "send_to_circle" });
    });

    it("the final-call role reads the scorecards before any conversation of its own, as the power to place people does", async () => {
      const { id } = await withReferences("gather@example.test");
      const ivs = await interviews(id);
      const card = await call("GET", `${app(id)}/scorecards`, undefined, IA.id);
      const criteria = card.body.scorecards.criteria as Array<{ id: string }>;
      await call("POST", `${app(id)}/interviews/${ivs[0].id}/score`, { entries: criteria.map((c) => ({ criterionId: c.id, level: "solid", evidence: "Heard it." })), gut: { answer: "unsure", note: "Pace." } }, IA.id);
      const w = await walk(id, FINAL.id);
      expect(w.body.walkthrough.scorecards.mayRead).toBe(true);
      expect(w.body.walkthrough.scorecards.interviews[0].gut).toEqual({ answer: "unsure", note: "Pace." });
      // CONTROL: with the setting cleared, the same reader is nobody to this application.
      await variable("org.final_call_role", "");
      expect((await walk(id, FINAL.id)).status).toBe(404);
      await variable("org.final_call_role", roleFinal);
    });
  });

  describe("the admin list", () => {
    it("carries each application's stage and who acts next, by role", async () => {
      const { id } = await withReferences("desk@example.test");
      const desk = await call("GET", "/api/admin/open-proposals", undefined, FOUNDER.id);
      expect(desk.status).toBe(200);
      const row = desk.body.proposals.find((p: any) => p.id === id);
      expect(row.stage).toMatchObject({ key: "references", label: "References and proposal" });
      expect(row.stage.who).toContain("People and Operations");
    });
  });

  describe("the references go with the application", () => {
    it("anonymising one proposal deletes them at once", async () => {
      const { id } = await withReferences("anon@example.test");
      expect(await refRows(id)).toHaveLength(2);
      await anonymiseOpenProposal(pool, id, new Date());
      expect(await refRows(id)).toEqual([]);
    });

    it("clearing the review deletes them, and an erased member's notes and name leave", async () => {
      const { id } = await withReferences("erase@example.test");
      const [ana] = await refRows(id);
      await call("POST", `${app(id)}/references/${ana.id}/owner`, { userId: IB.id }, FOUNDER.id);
      await call("POST", `${app(id)}/references/${ana.id}/notes`, { notes: "Spoke with her.", followedUp: true }, IB.id);
      await forgetMemberReview(pool, IB.id, new Date());
      const after = (await refRows(id))[0];
      expect([after.owner_user_id, after.notes, after.notes_by]).toEqual([null, null, null]);
      // CONTROL: the other reference was untouched by the erasure.
      expect((await refRows(id))[1].name).toBe("Ben Reference");
      await clearReviewOf(pool, [id], new Date());
      expect(await refRows(id)).toEqual([]);
    });
  });
  describe("a member's first long-term role (the lead, 19 Nov 2026)", () => {
    /** A member's own application (`sa-` ref) for the Channel Role, waiting on a holder. */
    const memberApplication = async (id: string, candidate: string, status: "awaiting-holder" | "adopted" = "awaiting-holder") => {
      await insertApplication(pool, { id, candidateUserId: candidate, proposedBy: candidate, seatIds: [roleA], note: null, deliverables: null, settings: { v: 1 } as any, settingsHash: "h", termEndsAt: new Date("2036-12-01T00:00:00Z"), termSeasonId: "s-now", termFollowsSeason: false, startsAt: null, status });
      return id;
    };
    const mine = (id: string, as: string) => call("GET", `${app(id)}/references/mine`, undefined, as);

    it("a member holding no role is asked for references with no shortlist, gives them on their own page, and the team walks them", async () => {
      const id = await memberApplication("sa-firstrole-0001", NEWBIE.id);
      // Before anyone asks: the walkthrough shows the references step, and the member's own read says nothing is asked.
      const before = await walk(id, FOUNDER.id);
      expect(before.status, JSON.stringify(before.body)).toBe(200);
      expect(before.body.walkthrough.track.stages.map((x: any) => x.key)).toEqual(["received", "references", "agreement", "start"]);
      expect(before.body.walkthrough.track.primary).toBe("ask_references");
      expect(before.body.walkthrough.you).toMatchObject({ mayAskReferences: true, mayShortlist: false, mayAddFinal: false });
      expect((await mine(id, NEWBIE.id)).body.references).toBeNull();
      // Only the power to place people asks; the member may not ask for themselves.
      expect((await call("POST", `${app(id)}/references/ask`, {}, OUTSIDER.id)).status).toBe(403);
      const asked = await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id);
      expect(asked.status, JSON.stringify(asked.body)).toBe(200);
      // The member hears it on their bell, linked to their application's form. No email: they are a member.
      const bell = state.notices.find((n) => n.type === "application_references_asked");
      expect(bell?.userId).toBe(NEWBIE.id);
      expect(bell?.link).toBe(`/role-applications/${id}#your-references`);
      expect(state.sent.filter((m) => m.idempotencyKey.includes(id))).toEqual([]);
      expect((await mine(id, NEWBIE.id)).body.references).toEqual({ asked: true, given: null, mayAdd: true });
      // CONTROL: nobody else reads the member's own count.
      expect((await mine(id, OUTSIDER.id)).body.references).toBeNull();
      // Another member cannot give them for the applicant.
      expect((await call("POST", `${app(id)}/references`, { references: REFS }, OUTSIDER.id)).status).toBe(404);
      // At least two (the lead, 19 Nov 2026): one alone is refused, and nothing is kept.
      const one = await call("POST", `${app(id)}/references`, { references: [REFS[0]] }, NEWBIE.id);
      expect([one.status, one.body.error]).toEqual([400, "too_few"]);
      expect(await refRows(id)).toEqual([]);
      const given = await call("POST", `${app(id)}/references`, { references: REFS }, NEWBIE.id);
      expect(given.status, JSON.stringify(given.body)).toBe(200);
      expect((await mine(id, NEWBIE.id)).body.references).toEqual({ asked: true, given: 2, mayAdd: false });
      // Nobody is named an owner (ruling 22); the placers read the details; the applicant and an outsider get a 404.
      const rows = await refRows(id);
      expect(rows.map((r: any) => r.owner_role_id)).toEqual(["", ""]);
      const w = await walk(id, FOUNDER.id);
      expect(w.body.walkthrough.references.list.map((r: any) => r.contact)).toEqual(["Email: ana.reference@example.test\nWhatsApp: +506 8888 1234", "Email: ben.reference@example.test\nUS phone: (415) 555-0132"]);
      expect(w.body.walkthrough.track.now).toBe("references");
      expect((await walk(id, NEWBIE.id)).status).toBe(404);
      expect((await walk(id, OUTSIDER.id)).status).toBe(404);
      // A shortlist or a final conversation has no place on a member application.
      expect((await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id)).status).toBe(404);
      expect((await call("POST", `${app(id)}/final-conversation`, {}, FOUNDER.id)).status).toBe(404);
    });

    it("CONTROL: a member who already holds a role is not asked, and their application has no walkthrough", async () => {
      const id = await memberApplication("sa-heldrole-0001", IA.id);
      expect((await walk(id, FOUNDER.id)).status).toBe(404);
      const asked = await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id);
      expect(asked.status).toBe(409);
      expect(asked.body.error).toBe("first_role_only");
      expect(await q("SELECT kind FROM application_steps WHERE application_ref = ?", [id])).toEqual([]);
    });

    it("a member's references go 90 days after the application is decided, by the tidy run; a newer decision keeps them", async () => {
      const old = await memberApplication("sa-retain-old-0001", NEWBIE.id);
      const fresh = await memberApplication("sa-retain-new-0001", NEWBIE.id);
      for (const id of [old, fresh]) {
        expect((await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id)).status).toBe(200);
        expect((await call("POST", `${app(id)}/references`, { references: REFS }, NEWBIE.id)).status).toBe(200);
      }
      const day = 24 * 60 * 60_000;
      const now = new Date();
      await q("UPDATE seat_applications SET status = 'adopted', decided_at = ? WHERE id = ?", [new Date(now.getTime() - 91 * day), old]);
      await q("UPDATE seat_applications SET status = 'not-adopted', decided_at = ? WHERE id = ?", [new Date(now.getTime() - 10 * day), fresh]);
      const said = await tidyOpenProposals(pool, now);
      expect(await refRows(old)).toEqual([]);
      expect(said).toContain("2 member application references deleted");
      // CONTROL: decided ten days ago, its references stay until their 90 days are up.
      expect(await refRows(fresh)).toHaveLength(2);
    });

    it("a decided member application takes no references, and an erased member's references go", async () => {
      const done = await memberApplication("sa-decided-0001", NEWBIE.id, "adopted");
      expect((await call("POST", `${app(done)}/references/ask`, {}, FOUNDER.id)).status).toBe(409);
      const id = await memberApplication("sa-erase-0001", NEWBIE.id);
      expect((await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id)).status).toBe(200);
      expect((await call("POST", `${app(id)}/references`, { references: REFS }, NEWBIE.id)).status).toBe(200);
      expect(await refRows(id)).toHaveLength(2);
      await forgetMemberReview(pool, NEWBIE.id, new Date());
      expect(await refRows(id)).toEqual([]);
    });
  });
  describe("the conversation guide (0417)", () => {
    const notesOf = (id: string) => q("SELECT item_key, author_user_id, note FROM application_guide_notes WHERE application_ref = ? ORDER BY id", [id]);
    const note = (id: string, key: string, text: string, as: string | null) => call("POST", `${app(id)}/guide-notes`, { key, note: text }, as);

    it("is made from the role's criteria and qualities, for the reviewers and the final-call role only", async () => {
      await saveSections(pool, gate, { ...EMPTY_SECTIONS, qualities: ["Listens before answering"] }, FOUNDER.id);
      const id = await confirmed("guide@example.test");
      for (const who of [FOUNDER.id, FINAL.id]) {
        const w = await walk(id, who);
        expect(w.status, who).toBe(200);
        expect(w.body.walkthrough.guide.items).toEqual([
          { key: "c:c1", kind: "criterion", text: "Keeps the village's pace" },
          { key: "q:1", kind: "quality", text: "Listens before answering" },
        ]);
      }
      // The follow-up role may read its own references and nothing of the guide; a stranger gets the 404.
      expect((await walk(id, OUTSIDER.id)).status).toBe(404);
      expect((await note(id, "c:c1", "A note", OUTSIDER.id)).status).toBe(403);
      expect((await note(id, "c:c1", "A note", HR.id)).status).toBe(403);
      expect(await notesOf(id)).toEqual([]);
    });

    it("keeps one note per reviewer and line, read by the others, and nothing in it is a score, a rank or a rating", async () => {
      const id = await confirmed("guide2@example.test");
      expect((await note(id, "c:c1", "She answered with an example from the seed library.", FOUNDER.id)).status).toBe(200);
      expect((await note(id, "c:c1", "Clear about the hours.", FINAL.id)).status).toBe(200);
      // Saving again replaces the writer's own note; it does not add a second.
      expect((await note(id, "c:c1", "She gave two examples from the seed library.", FOUNDER.id)).status).toBe(200);
      expect(await notesOf(id)).toHaveLength(2);
      const w = await walk(id, FINAL.id);
      const guide = w.body.walkthrough.guide;
      expect(guide.notes).toEqual([
        { key: "c:c1", by: "Flor", note: "Clear about the hours.", mine: true },
        { key: "c:c1", by: "Fern", note: "She gave two examples from the seed library.", mine: false },
      ].sort((a, b) => (a.by === "Fern" ? -1 : 1) - (b.by === "Fern" ? -1 : 1)));
      // The served shapes carry words only: no level, score, rank or rating anywhere in the guide.
      expect(Object.keys(guide.items[0]).sort()).toEqual(["key", "kind", "text"]);
      expect(Object.keys(guide.notes[0]).sort()).toEqual(["by", "key", "mine", "note"]);
      expect(JSON.stringify(guide)).not.toMatch(/"(score|level|rank|rating|total)/i);
      // CONTROL: the table itself has no column to hold one.
      const cols = (await q("SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_guide_notes'")).map((r: any) => String(r.c));
      expect(cols.length).toBeGreaterThan(3);
      expect(cols.filter((c) => /score|level|rank|rating|grade|total/i.test(c))).toEqual([]);
    });

    it("refuses a line that is not on the guide and a note that is too long, and an empty note clears the line", async () => {
      const id = await confirmed("guide3@example.test");
      expect((await note(id, "c:nope", "x", FOUNDER.id)).status).toBe(400);
      expect((await note(id, "c:c1", "x".repeat(1001), FOUNDER.id)).status).toBe(400);
      expect(await notesOf(id)).toEqual([]);
      expect((await note(id, "c:c1", "Something to clear.", FOUNDER.id)).status).toBe(200);
      expect(await notesOf(id)).toHaveLength(1);
      expect((await note(id, "c:c1", "  ", FOUNDER.id)).status).toBe(200);
      expect(await notesOf(id)).toEqual([]);
    });

    it("is deleted with the application's review, and a reviewer's notes go when the reviewer is erased", async () => {
      const id = await confirmed("guide4@example.test");
      await note(id, "c:c1", "From Fern.", FOUNDER.id);
      await note(id, "c:c1", "From Flor.", FINAL.id);
      await forgetMemberReview(pool, FINAL.id, new Date());
      expect((await notesOf(id)).map((n: any) => n.author_user_id)).toEqual([FOUNDER.id]);
      await clearReviewOf(pool, [id], new Date());
      expect(await notesOf(id)).toEqual([]);
    });
  });
});
