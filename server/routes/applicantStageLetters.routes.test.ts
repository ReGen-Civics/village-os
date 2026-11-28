/**
 * THE APPLICANT FLOW, PART 3 (the lead, 27 Nov 2026): a next-step email at each stage, the booking button by role
 * only, and the 90-day close. Over real HTTP and the S5 scratch schema; nothing is sent for real. The fixture post
 * office drops a repeated idempotency key the way the real one does (`duplicate`), so "once" is measured honestly.
 *
 * What is pinned, each with a control:
 *   - each stage's email goes once, however many acts call for it
 *   - no email carries a conversation note, a scorecard's words or a reference's follow-up
 *   - a later step's booking link never appears in an earlier email
 *   - the booking button and the emails name the role only ("Ops"), never a person
 *   - the 90-day close fires only at 90 days with no decision, never on a decided or already-closed application,
 *     sends its one letter and records an event; the days are the village's variable
 *   - the applicant's profile reads the same next step
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
import { register, tidyOpenProposals } from "./openProposals";
import { signLink } from "../lib/comms/links";

const configured = testDbConfigured();
if (!configured) console.warn("[applicantStageLetters] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const ORIGIN = "https://village.example.test";
const NOW_SEASON = { id: "s-now", name: "Season of Seeds", startsOn: "2000-01-01", endsOn: "2037-01-01" };
const NEXT = { id: "s-next", name: "Season of Roots", startsOn: "2037-01-01", endsOn: "2037-03-20" };
const person = (id: string, name: string) => ({ id, name, email: `${id}@example.test` });
// Fictional people only.
const FOUNDER = person("u-sl-founder", "Fern Oak");
const IA = person("u-sl-ia", "Iva Alder");
const IB = person("u-sl-ib", "Ivo Birch");
const FINAL = person("u-sl-final", "Flor Lima");

const LINK = { ops: "https://cal.example.test/ops", community: "https://cal.example.test/community", final: "https://cal.example.test/visionary" };
/** Private words that must never reach the applicant. */
const NOTE = "PRIVATE-NOTE-the-team-wrote-this";
const EVIDENCE = "PRIVATE-EVIDENCE-from-a-scorecard";
const FOLLOWUP = "PRIVATE-FOLLOWUP-from-a-reference-call";

describe.skipIf(!configured)("the applicant's next-step letters and the 90-day close, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let gate = "";
  let roleOps = "";
  let roleCommunity = "";
  let roleFinal = "";
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stageletters-"));

  const state = {
    viewer: null as string | null,
    /** Every email handed to the post office, and the keys it has already taken. */
    posted: [] as OutgoingEmail[],
    fresh: [] as OutgoingEmail[],
    keys: new Set<string>(),
    notices: [] as Array<{ userId: string; type: string; title: string; body?: string; dedupeKey: string }>,
    /** A provider fault for keys starting with this, until cleared (the retry test). */
    failing: null as string | null,
  };

  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned
  const variable = async (key: string, value: string) => {
    await q("INSERT INTO game_variables (config_key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [key, value]);
    await loadVariables(pool);
  };
  const postEmail = async (email: OutgoingEmail): Promise<PostResult> => {
    state.posted.push(email);
    // A provider fault: the post office records the key as failed and never sends that key again.
    if (state.failing && email.idempotencyKey.startsWith(state.failing)) {
      state.keys.add(email.idempotencyKey);
      return { status: "failed", messageId: null, reason: "failed" } as unknown as PostResult;
    }
    if (state.keys.has(email.idempotencyKey)) return { status: "duplicate" } as PostResult;
    state.keys.add(email.idempotencyKey);
    state.fresh.push(email);
    return { status: "sent", messageId: `m-${state.fresh.length}` } as PostResult;
  };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 8 });
    const have = new Set((await q("SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'org_roles'")).map((r: any) => String(r.c)));
    for (const col of ["conversations", "selection_criteria", "conversation_mode"]) if (!have.has(col)) await q(`ALTER TABLE org_roles ADD COLUMN ${col} text NULL`);
    const users = usersRepo(pool);
    for (const p of [FOUNDER, IA, IB, FINAL]) await users.add({ id: p.id, name: p.name, email: p.email, passwordHash: "x", emailVerifiedAt: "2026-01-01T00:00:00.000Z", paths: [] } as any);
    await q("INSERT INTO circles (id, name, aliases, is_example) VALUES ('c-sl', 'Core Circle', '[]', 0)");
    gate = await createOrgRole(pool, { id: "sl-role-lead", name: "Lead Steward", seats: 1, circleId: "c-sl", aim: "Hold the money." });
    roleOps = await createOrgRole(pool, { id: "sl-role-ops", name: "Operations Role", seats: 1, circleId: "c-sl", aim: "Hold operations." });
    roleCommunity = await createOrgRole(pool, { id: "sl-role-community", name: "Community Weaver", seats: 1, circleId: "c-sl", aim: "Hold the community." });
    roleFinal = await createOrgRole(pool, { id: "sl-role-final", name: "Visionary Channel", seats: 1, circleId: "c-sl", aim: "Make the final call." });
    const until = new Date("2036-12-01T00:00:00Z");
    for (const [r, u] of [[roleOps, IA], [roleCommunity, IB], [roleFinal, FINAL]] as const) await seatHolder(pool, r, { userId: u.id, seasonId: "s-now", termEndsAt: until });
    // The holders keep their own links too: the role's link must win, and no person may be named.
    await q("UPDATE users SET prefs = ? WHERE id IN (?, ?)", [JSON.stringify({ bookingUrl: "https://cal.example.test/a-person" }), IA.id, IB.id]).catch(() => undefined);
    await q("UPDATE org_roles SET booking_url = ? WHERE id = ?", [LINK.ops, roleOps]);
    await q("UPDATE org_roles SET booking_url = ? WHERE id = ?", [LINK.community, roleCommunity]);
    await q("UPDATE org_roles SET booking_url = ? WHERE id = ?", [LINK.final, roleFinal]);
    await q("UPDATE org_roles SET conversations = ? WHERE id = ?", [JSON.stringify([{ roleId: roleOps, minutes: 30, final: false }, { roleId: roleCommunity, minutes: 30, final: false }]), gate]);
    await variable("org.final_call_role", roleFinal);
    await variable("org.role_short_labels", `${roleOps} = Ops\n${roleCommunity} = Community\n${roleFinal} = Visionary`);

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
      postEmail,
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
    state.posted.length = 0;
    state.fresh.length = 0;
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
      return { status: res.status, body: json, text };
    } finally {
      state.viewer = null;
    }
  };

  const tokenOf = (mail: OutgoingEmail) => {
    const line = mail.text.split("\n").find((l) => /https:\/\/village\.example\.test\//.test(l)) as string;
    return new URL(/(https:\/\/\S+)/.exec(line)![1]).searchParams.get("token") as string;
  };
  const confirmed = async (email: string) => {
    const r = await call("POST", "/api/open-proposals", { name: "Rowan Field", email, locale: "en", roles: [{ roleId: gate, note: "I keep books." }], why: "I want to hold the money well.", aim: "A clear budget." });
    expect(r.status, r.text).toBe(200);
    const mail = state.fresh.find((m) => m.to.email === email)!;
    const id = mail.idempotencyKey.split(":")[1];
    expect((await call("POST", "/api/open-proposals/confirm", { token: tokenOf(mail) })).status).toBe(200);
    return id;
  };
  const app = (id: string) => `/api/governance/applications/${id}`;
  const statusToken = (id: string) => encodeURIComponent(signLink("application_status", { ref: id }, 1));
  const ivs = async (id: string) => (await q("SELECT id, position, is_final, state FROM application_interviews WHERE application_ref = ? ORDER BY position", [id])) as any[];
  const score = async (id: string, interviewId: number, as: string) => {
    await q("UPDATE application_interviews SET state = 'open', opened_at = COALESCE(opened_at, NOW(3)) WHERE id = ? AND state = 'waiting'", [interviewId]);
    const card = await call("GET", `${app(id)}/scorecards`, undefined, as);
    const criteria = card.body?.scorecards?.criteria ?? [{ id: "c1" }];
    const out = await call("POST", `${app(id)}/interviews/${interviewId}/score`, { entries: criteria.map((c: any) => ({ criterionId: c.id, level: "solid", evidence: EVIDENCE })), gut: { answer: "yes", note: EVIDENCE } }, as);
    expect(out.status, out.text).toBe(200);
  };
  /** The role card's "Apply by" (`sections.applyBy`), as the card's editor saves it; null clears it. */
  const cardApplyBy = async (day: string | null) => {
    const { saveSections } = await import("../lib/roleCardSections");
    const { EMPTY_SECTIONS } = await import("../../shared/roleCardSections");
    await saveSections(pool, gate, { ...EMPTY_SECTIONS, ...(day ? { applyBy: day } : {}) }, FOUNDER.id);
  };
  /** The deadline an application carries, as stamped at its arrival. */
  const stampApplyBy = (ref: string, day: string) =>
    q("UPDATE application_steps SET detail_json = JSON_SET(detail_json, '$.applyBy', ?) WHERE application_ref = ? AND kind = 'confirmed'", [day, ref]);
  const stageMails = (kind: string) => state.fresh.filter((m) => m.idempotencyKey.endsWith(`:stage:${kind}`));
  const everything = () => state.posted.map((m) => `${m.subject}\n${m.text}\n${m.html ?? ""}`).join("\n----\n");

  it("one next-step email per stage, with only the step's own role link, by role, and nothing private", async () => {
    const id = await confirmed("stages@example.test");
    // Received: the confirmation letter is the stage's email. No later link rides on it.
    const receivedMail = state.fresh.find((m) => m.idempotencyKey === `open-proposal:${id}:status`)!;
    expect(receivedMail).toBeTruthy();
    // In the same shape as every letter: the next step, who acts by role, and the link of the conversation open now
    // (this village opens the first one as the address confirms). The old step list is gone.
    expect(receivedMail.text).toContain(`Next step:\n- Book your first conversation, with Ops: ${LINK.ops}`);
    expect(receivedMail.text).toContain("Who acts next:\nYou book the time. Then Ops meets with you.");
    expect(receivedMail.text).not.toContain("decides by consent");
    for (const later of [LINK.community, LINK.final]) expect(everything()).not.toContain(later);

    expect((await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id)).status).toBe(200);
    // The team writes private notes on the first conversation.
    const [first] = await ivs(id);
    await q("UPDATE application_interviews SET state = 'open', opened_at = NOW(3) WHERE id = ? AND state = 'waiting'", [first.id]);
    expect((await call("POST", `${app(id)}/interviews/${first.id}/notes`, { body: NOTE }, IA.id)).status).toBe(200);

    // The first conversation written up: References and proposal begins, and the Community conversation opens. Its ONE
    // letter waits for the references ask (QA round 5), so nothing goes yet: no stage letter and no "Let's talk".
    state.fresh.length = 0;
    await score(id, Number(first.id), IA.id);
    expect(state.fresh.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${id}:`))).toEqual([]);

    // The references asked: the ONE letter of the stage, carrying the ask and the Community link, and nothing else.
    expect((await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id)).status).toBe(200);
    expect(state.fresh.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${id}:`)).map((m) => m.idempotencyKey)).toEqual([`open-proposal:${id}:stage:references`]);
    const refs = stageMails("references")[0];
    expect(refs.text).toContain(`Book your conversation with Community: ${LINK.community}`);
    expect(refs.text).toMatch(/references/i);
    // Every link by its words (QA round 5, item 9): the booking is a button in the village's own colour (never the
    // page's background, which once made it white on white), and the page is "See your page", never a raw address.
    const pill = /<a href="[^"]*" class="vl-btn vl-btn-text" style="[^"]*background-color:(#[0-9a-fA-F]{3,8});color:#ffffff[^"]*">Book with Community<\/a>/.exec(refs.html ?? "");
    expect(pill, "the booking button").toBeTruthy();
    expect(pill![1].toLowerCase()).not.toMatch(/^#f|^#fff/);
    expect(refs.html).toContain(">See your page</a>");
    expect(refs.html).not.toContain(`>${ORIGIN}/application-status/`);
    expect(refs.text).not.toContain(LINK.final);
    expect(refs.text).not.toContain("a-person");
    expect(refs.text).not.toMatch(/Iva|Ivo|Flor|Fern/);

    // The applicant gives references and refines: the refined letter goes once, however often they save.
    const given = await call("POST", `/api/application-status/${id}/references?token=${statusToken(id)}`, {
      references: [
        { name: "Ana Example", email: "ana@example.test", whatsapp: "+506 8888 1234", how: "We kept a farm's books.", ally: "" },
        { name: "Ben Example", email: "ben@example.test", whatsapp: "+506 8888 1234", how: "He hired me twice.", ally: "" },
      ],
    });
    expect(given.status, given.text).toBe(200);
    state.fresh.length = 0;
    expect((await call("POST", `/api/application-status/${id}/proposal?token=${statusToken(id)}`, { why: "Six years of books.", aim: "Books anyone can read." })).status).toBe(200);
    expect((await call("POST", `/api/application-status/${id}/proposal?token=${statusToken(id)}`, { why: "Seven years of books.", aim: "Books anyone can read." })).status).toBe(200);
    expect(stageMails("refined")).toHaveLength(1);
    expect(state.fresh).toHaveLength(1);

    // The Community conversation written up: the stage stays, so nothing new is sent (a repeated stage is a duplicate).
    state.fresh.length = 0;
    const second = (await ivs(id)).find((i: any) => Number(i.position) === 2);
    await score(id, Number(second.id), IB.id);
    expect(stageMails("references")).toHaveLength(0);
    expect(state.posted.filter((m) => m.idempotencyKey.endsWith(":stage:references")).length).toBeGreaterThan(0);
    expect(everything()).not.toContain(LINK.final);

    // Each reference followed up (private words), then the team moves on: Final conversation, with the final link only now.
    await q("UPDATE application_references SET followed_up_at = NOW(3), notes = ? WHERE application_ref = ?", [FOLLOWUP, id]);
    state.fresh.length = 0;
    expect((await call("POST", `${app(id)}/final-conversation`, {}, FINAL.id)).status).toBe(200);
    expect(stageMails("final_interview")).toHaveLength(1);
    const fin = stageMails("final_interview")[0];
    expect(fin.subject).toBe("Next up: your final conversation with Visionary");
    expect(fin.text).toContain(`Book your final conversation with Visionary: ${LINK.final}`);
    expect(state.fresh.filter((m) => m.idempotencyKey.includes(":update:conversation"))).toHaveLength(0);

    // Sending it on before the final is written up is refused (ruling 7).
    expect((await call("POST", `/api/application-status/${id}/to-circle?token=${statusToken(id)}`)).body.error).toBe("not_ready");
    // RULING 7: the final written up neither fixes the proposal nor moves it to Agreement, and sends no Agreement letter.
    state.fresh.length = 0;
    const final = (await ivs(id)).find((i: any) => Number(i.is_final) === 1);
    await score(id, Number(final.id), FINAL.id);
    expect(stageMails("agreement")).toHaveLength(0);
    // Its own letter instead (QA round 5, item 8): refine, then send it on, with the page as its button; once.
    const ready = state.fresh.filter((m) => m.idempotencyKey === `open-proposal:${id}:to-circle-ready`);
    expect(ready).toHaveLength(1);
    expect(ready[0].text).toContain("Refine your proposal, then send it to");
    expect(ready[0].text).toMatch(new RegExp(`Refine and send it: ${ORIGIN}/application-status/${id}\\?token=`));
    expect(ready[0].html).toContain("Refine and send it");
    const after = (await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`)).body.status.sixStages;
    expect(after).toMatchObject({ now: "final_interview", toCircle: true, refine: { open: true, frozen: false } });
    expect((await call("POST", `/api/application-status/${id}/proposal?token=${statusToken(id)}`, { why: "After the final, a little clearer.", aim: "Books anyone can read." })).status).toBe(200);
    // Ruling 23 (QA round 5): every call written up, but not sent: no adoption and no terms yet.
    expect((await call("POST", `/api/governance/open-proposals/${id}/adopt`, {}, FOUNDER.id)).body).toMatchObject({ error: "send_first", message: "Send it to the Anchor Circle first." });
    expect((await call("POST", `/api/governance/open-proposals/${id}/terms`, { words: { term: "x" }, expectedRevision: 0 }, FOUNDER.id)).body.error).toBe("send_first");
    // A member who is neither Ops, the Visionary nor a placer cannot send it on.
    expect((await call("POST", `${app(id)}/to-circle`, {}, IB.id)).status).toBe(404);
    // The applicant sends it on: Agreement, its one letter, and the proposal fixed from that moment.
    const sent = await call("POST", `/api/application-status/${id}/to-circle?token=${statusToken(id)}`);
    expect(sent.status, sent.text).toBe(200);
    expect((await call("POST", `/api/application-status/${id}/to-circle?token=${statusToken(id)}`)).status).toBe(409);
    expect((await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`)).body.status.sixStages).toMatchObject({ now: "agreement", toCircle: false, refine: { open: false, frozen: true } });
    expect((await call("POST", `/api/application-status/${id}/proposal?token=${statusToken(id)}`, { why: "Too late now.", aim: "Fixed." })).body.error).toBe("closed");
    expect(stageMails("agreement")).toHaveLength(1);
    const agr = stageMails("agreement")[0];
    expect(agr.text).toContain("Who acts next:\nThe circle.");
    for (const l of Object.values(LINK)) expect(agr.text).not.toContain(l);

    // Every email this application ever got: once per key, and no private word in any of them.
    const keys = state.posted.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${id}:`)).map((m) => m.idempotencyKey);
    const freshKeys = Array.from(state.keys).filter((k) => k.startsWith(`open-proposal:${id}:`));
    expect(new Set(freshKeys).size).toBe(freshKeys.length);
    expect(keys.filter((k) => k.includes(":stage:")).length).toBeGreaterThanOrEqual(4);
    for (const secret of [NOTE, EVIDENCE, FOLLOWUP]) {
      expect(everything()).not.toContain(secret);
      expect(state.notices.map((n) => `${n.title}\n${n.body ?? ""}`).join("\n")).not.toContain(secret);
    }
  });

  it("the booking button names the role only, and the role's own link wins over a person's", async () => {
    const id = await confirmed("button@example.test");
    const [first] = await ivs(id);
    await q("UPDATE application_interviews SET state = 'open', opened_at = NOW(3) WHERE id = ?", [first.id]);
    const s = await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`);
    expect(s.status, s.text).toBe(200);
    expect(s.body.status.bookNow).toMatchObject({ label: "Ops", links: [{ who: null, url: LINK.ops }] });
    // CONTROL: with no short label the full name stands, still with no person.
    await variable("org.role_short_labels", "");
    try {
      const plain = await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`);
      expect(plain.body.status.bookNow.label).toBe("Operations Role");
    } finally {
      await variable("org.role_short_labels", `${roleOps} = Ops\n${roleCommunity} = Community\n${roleFinal} = Visionary`);
    }
  });

  it("the applicant's profile reads the same next step, and only the applicant's own", async () => {
    const APPLICANT = person("u-sl-applicant", "Rowan Field");
    await usersRepo(pool).add({ id: APPLICANT.id, name: APPLICANT.name, email: APPLICANT.email, passwordHash: "x", emailVerifiedAt: "2026-01-01T00:00:00.000Z", paths: [] } as any);
    const id = await confirmed(APPLICANT.email);
    const mine = await call("GET", "/api/me/application-next", undefined, APPLICANT.id);
    expect(mine.status, mine.text).toBe(200);
    expect(mine.body.next?.ref).toBe(id);
    expect(mine.body.next.status.sixStages.now).toBe("review");
    const page = await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`);
    expect(mine.body.next.status.bookNow).toEqual(page.body.status.bookNow);
    // CONTROLS: another member reads nothing of it; a stranger is asked to sign in.
    expect((await call("GET", "/api/me/application-next", undefined, IA.id)).body).toEqual({ next: null });
    expect((await call("GET", "/api/me/application-next")).status).toBe(401);
    // Nothing private rides on it either.
    for (const secret of [NOTE, EVIDENCE, FOLLOWUP]) expect(mine.text).not.toContain(secret);
  });

  it("THE STATUS LINK (the lead: 'Yes! status link'): works for the application's life, and stops once it is closed and cleared", async () => {
    const { statusLinkDays } = await import("../lib/applicantUpdates");
    expect(statusLinkDays()).toBeGreaterThanOrEqual(120);
    const id = await confirmed("link-life@example.test");
    expect((await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`)).status).toBe(200);
    // Closed and its details removed: the same link shows nothing of it, and says it closed (QA round 5: it said
    // "that link does not match a proposal"). A wrong token still answers the plain 404, so a ref cannot be probed.
    await q("UPDATE open_role_proposals SET status = 'withdrawn', decided_at = NOW(3), name = NULL, email = NULL, email_key = NULL, anonymised_at = NOW(3) WHERE id = ?", [id]);
    const closed = await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`);
    expect([closed.status, closed.body]).toEqual([410, { error: "closed" }]);
    expect((await call("GET", `/api/application-status/${id}?token=nope`)).status).toBe(404);
  });

  it("WITHDRAW (the lead): the applicant's own quiet act, by their link; no letter goes, and it closes once", async () => {
    const id = await confirmed("withdraw@example.test");
    state.fresh.length = 0;
    const out = await call("POST", `/api/application-status/${id}/withdraw?token=${statusToken(id)}`, {});
    expect(out.status, out.text).toBe(200);
    expect(state.fresh).toEqual([]);
    expect(String((await q("SELECT status FROM open_role_proposals WHERE id = ?", [id]))[0].status)).toBe("withdrawn");
    const page = await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`);
    expect(page.body.status.outcome).toBe("withdrawn");
    // Again: nothing more happens. CONTROL: a wrong token is the 404 a stranger gets.
    expect((await call("POST", `/api/application-status/${id}/withdraw?token=${statusToken(id)}`, {})).status).toBe(409);
    expect((await call("POST", `/api/application-status/${id}/withdraw?token=nope`, {})).status).toBe(404);
  });

  it("THE TEAM'S REFERENCES (the lead): claim one, the standard questions, mark it done; the applicant sees only reached or not", async () => {
    const id = await confirmed("team-refs@example.test");
    expect((await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id)).status).toBe(200);
    expect((await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id)).status).toBe(200);
    const given = await call("POST", `/api/application-status/${id}/references?token=${statusToken(id)}`, {
      references: [
        { name: "Ana Example", email: "ana@example.test", whatsapp: "+506 8888 1234", how: "We kept a farm's books.", ally: "" },
        { name: "Ben Example", email: "ben@example.test", signal: "ben.42", how: "He hired me twice.", ally: "" },
      ],
    });
    expect(given.status, given.text).toBe(200);
    const w = await call("GET", `${app(id)}/walkthrough`, undefined, IA.id);
    expect(w.status, w.text).toBe(200);
    expect(w.body.walkthrough.references.questions).toContain("What are they great at?");
    expect(w.body.walkthrough.references.mayClaim).toBe(true);
    const [first, second] = w.body.walkthrough.references.list;
    // I'll follow up: IA takes the first; IB cannot take it from them.
    expect((await call("POST", `${app(id)}/references/${first.id}/claim`, {}, IA.id)).status).toBe(200);
    expect((await call("POST", `${app(id)}/references/${first.id}/claim`, {}, IB.id)).status).toBe(409);
    expect((await call("POST", `${app(id)}/references/${first.id}/notes`, { notes: FOLLOWUP, followedUp: true }, IA.id)).status).toBe(200);
    // The applicant: reached or not, by place, and never the notes or a contact.
    const page = await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`);
    expect(page.body.status.referencesAsked.reached).toEqual([true, false]);
    for (const secret of [FOLLOWUP, "ana@example.test", "+506 8888 1234", "ben.42", "Ana Example"]) expect(page.text).not.toContain(secret);
    expect(second.contact).toBe("Email: ben@example.test\nSignal: ben.42");
    // CONTROL: outsiders and the applicant's link reach no claim.
    expect((await call("POST", `${app(id)}/references/${second.id}/claim`, {}, null)).status).toBe(401);
  });

  it("REFERENCE CONTACTS: 'Interviewers + placers' (the lead, 27 Nov 2026). Ops, Community, Visionary and a placer read and claim; a consent peer, a plain member and an outsider do not; two claims at once, one wins", async () => {
    const users = usersRepo(pool);
    const PEER = person("u-sl-peer", "Kai Peer");
    const PLAIN = person("u-sl-plain", "Pia Plain");
    for (const u of [PEER, PLAIN]) if (!(await users.byId(u.id))) await users.add({ id: u.id, name: u.name, email: u.email, passwordHash: "x", emailVerifiedAt: "2026-01-01T00:00:00.000Z", paths: [] } as any);
    const id = await confirmed("interviewers-placers@example.test");
    expect((await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id)).status).toBe(200);
    expect((await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id)).status).toBe(200);
    const given = await call("POST", `/api/application-status/${id}/references?token=${statusToken(id)}`, {
      references: [
        { name: "Cora Example", email: "cora@example.test", whatsapp: "+506 8888 4321", how: "We ran a market.", ally: "" },
        { name: "Dov Example", email: "dov@example.test", usPhone: "+1 415 555 0100", how: "He taught me bookkeeping.", ally: "" },
      ],
    });
    expect(given.status, given.text).toBe(200);
    // A member of the consent circle: asked to consent, holding none of the conversation roles.
    await q("INSERT INTO role_proposal_asks (proposal_id, user_id, circle_id, closes_at) VALUES (?, ?, 'c-sl', ?)", [id, PEER.id, new Date(Date.now() + 7 * 86_400_000)]);
    // Ops, Community, the Visionary (the final-call role) and the placer: every reference, with its contact.
    for (const who of [IA, IB, FINAL, FOUNDER]) {
      const w = await call("GET", `${app(id)}/walkthrough`, undefined, who.id);
      expect(w.status, `${who.name}: ${w.text}`).toBe(200);
      expect(w.body.walkthrough.references.list.map((r: any) => r.contact), who.name).toEqual(["Email: cora@example.test\nWhatsApp: +506 8888 4321", expect.stringContaining("dov@example.test")]);
      expect(w.body.walkthrough.references.mayClaim, who.name).toBe(true);
    }
    // The consent peer reads the application, never a reference, and cannot claim.
    const peer = await call("GET", `${app(id)}/walkthrough`, undefined, PEER.id);
    // The guide's notes follow the same rule (QA round 5: a consent peer read them).
    if (peer.status === 200) {
      expect(peer.body.walkthrough.references.list).toEqual([]);
      expect(peer.body.walkthrough.guide ?? null).toBeNull();
    }
    expect((await call("POST", `${app(id)}/guide-notes`, { key: "x", note: "peer" }, PEER.id)).status).not.toBe(200);
    expect(peer.text).not.toContain("cora@example.test");
    const [first, second] = (await call("GET", `${app(id)}/walkthrough`, undefined, IA.id)).body.walkthrough.references.list;
    expect((await call("POST", `${app(id)}/references/${first.id}/claim`, {}, PEER.id)).status).toBe(404);
    // A plain member and an outsider: nothing.
    const plain = await call("GET", `${app(id)}/walkthrough`, undefined, PLAIN.id);
    expect(plain.status).toBe(404);
    expect((await call("POST", `${app(id)}/references/${first.id}/claim`, {}, PLAIN.id)).status).toBe(404);
    expect((await call("GET", `${app(id)}/walkthrough`)).status).toBe(401);
    // Two claims at once (QA pass 3: both won). The fixture's viewer is one shared slot, so the race is run where it is
    // decided: two claims in flight together on two connections, and exactly one wins.
    const { claimOwner } = await import("../repos/applicantOnboarding");
    const both = await Promise.all([claimOwner(pool, id, Number(second.id), IA.id), claimOwner(pool, id, Number(second.id), IB.id)]);
    expect(both.filter(Boolean)).toHaveLength(1);
    // The loser, through the route, is told it is taken.
    const loser = both[0] ? IB : IA;
    expect((await call("POST", `${app(id)}/references/${second.id}/claim`, {}, loser.id)).status).toBe(409);
    // Everyone who reads sees who claimed it (QA pass 2: Community read "No references yet").
    const seen = (await call("GET", `${app(id)}/walkthrough`, undefined, IB.id)).body.walkthrough.references.list.find((r: any) => r.id === second.id);
    expect(seen.owner.userName).toMatch(/^(Iva|Ivo)$/);
  });

  it("THE LETTERS (QA round 4, item 3): the Received email reaches an account holder; the frame and its button; one email at References; a provider fault is tried again, once", async () => {
    const { reviewClockTick } = await import("../lib/applicationReview");
    const { makeApplicantTeller } = await import("../lib/applicantUpdates");
    const users = usersRepo(pool);
    const ACC = person("u-sl-account", "Ari Account");
    if (!(await users.byId(ACC.id))) await users.add({ id: ACC.id, name: ACC.name, email: ACC.email, passwordHash: "x", emailVerifiedAt: "2026-01-01T00:00:00.000Z", paths: [] } as any);
    // 3b: an account holder gets the Received email, with a signed status link and their profile.
    const own = await confirmed(ACC.email);
    const received = state.posted.find((m) => m.idempotencyKey === `open-proposal:${own}:status`);
    expect(received, "the Received email").toBeTruthy();
    expect(received!.text).toContain(`${ORIGIN}/profile`);
    expect(received!.text).toMatch(new RegExp(`${ORIGIN}/application-status/${own}\\?token=`));
    // 3d: in the invitation's frame, the status link a button, the village's sign-off.
    expect(received!.html).toContain("See your page");
    expect(received!.text).toContain("With love,");
    expect(received!.text).toContain("The Test Village team");

    // QA round 5, item 1. ASK FIRST: shortlisted and asked while Ops is still open, nothing goes; Ops written up, ONE
    // letter goes, carrying the ask and the Community link, and no "Let's talk" beside it.
    const id = await confirmed("one-letter@example.test");
    const [first] = await ivs(id);
    await q("UPDATE application_interviews SET state = 'open', opened_at = NOW(3) WHERE id = ? AND state = 'waiting'", [first.id]);
    state.fresh.length = 0;
    expect((await call("POST", `${app(id)}/shortlist`, { answer: "yes" }, FOUNDER.id)).status).toBe(200);
    expect((await call("POST", `${app(id)}/references/ask`, {}, FOUNDER.id)).status).toBe(200);
    expect(state.fresh.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${id}:`))).toEqual([]);
    await score(id, Number(first.id), IA.id);
    const mails = state.fresh.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${id}:`));
    expect(mails.map((m) => m.idempotencyKey)).toEqual([`open-proposal:${id}:stage:references`]);
    expect(mails[0].text).toMatch(/reference/i);
    expect(mails[0].text).toContain(LINK.community);

    // A FAULT: the provider fails References' letter. No "Let's talk" goes in its place; the review clock sends the one
    // letter, once, under its retry key.
    const { tellStageLetter } = await import("../lib/applicantStageLetters");
    const tellDeps = { getPool: () => pool, members: usersRepo(pool), notify: async () => ({ fresh: true }), postEmail, projectName: () => "Test Village", siteUrl: () => ORIGIN };
    const faulty = await confirmed("one-letter-fault@example.test");
    const [fFirst] = await ivs(faulty);
    await q("UPDATE application_interviews SET state = 'open', opened_at = NOW(3) WHERE id = ? AND state = 'waiting'", [fFirst.id]);
    expect((await call("POST", `${app(faulty)}/shortlist`, { answer: "yes" }, FOUNDER.id)).status).toBe(200);
    expect((await call("POST", `${app(faulty)}/references/ask`, {}, FOUNDER.id)).status).toBe(200);
    state.fresh.length = 0;
    state.failing = `open-proposal:${faulty}:stage:references`;
    await score(faulty, Number(fFirst.id), IA.id);
    state.failing = null;
    expect(state.fresh.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${faulty}:`))).toEqual([]);
    const tickDeps: any = { getPool: () => pool, notify: async () => ({ fresh: true }), notifyAdmins: async () => {}, liveHoldersOf: async () => [FOUNDER.id], now: () => new Date(), calendar: () => ({ seasons: [NOW_SEASON, NEXT], currentSeasonId: "s-now", timezone: "UTC" }), members: usersRepo(pool) };
    tickDeps.tellApplicant = makeApplicantTeller(tellDeps as any);
    await reviewClockTick(tickDeps);
    await reviewClockTick(tickDeps);
    expect(state.fresh.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${faulty}:`)).map((m) => m.idempotencyKey)).toEqual([`open-proposal:${faulty}:stage:references:r1`]);

    // TWO TRIGGERS OF ONE LETTER AT ONCE (the write-up and the ask, with a slow provider): one letter.
    const raced = await confirmed("one-letter-race@example.test");
    const [rFirst] = await ivs(raced);
    await q("UPDATE application_interviews SET state = 'scored' WHERE id = ?", [rFirst.id]);
    expect((await call("POST", `${app(raced)}/shortlist`, { answer: "yes" }, FOUNDER.id)).status).toBe(200);
    await q("INSERT IGNORE INTO application_steps (application_ref, kind, subject, stamped_at) VALUES (?, 'refs_asked', '', NOW(3))", [raced]);
    state.fresh.length = 0;
    await Promise.all([tellStageLetter(tellDeps as any, raced), tellStageLetter(tellDeps as any, raced), tellStageLetter(tellDeps as any, raced)]);
    expect(state.fresh.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${raced}:`)).map((m) => m.idempotencyKey)).toEqual([`open-proposal:${raced}:stage:references`]);

    // 3f: the provider fails the Final conversation's letter; the review clock sends it again, once, under a new key.
    await q("UPDATE application_interviews SET state = 'scored' WHERE application_ref = ? AND is_final = 0", [id]);
    await q("UPDATE application_references SET followed_up_at = NOW(3) WHERE application_ref = ?", [id]);
    await call("POST", `/api/application-status/${id}/references?token=${statusToken(id)}`, { references: [{ name: "Eve Example", email: "eve@example.test", whatsapp: "+506 8888 1111", how: "We farmed together.", ally: "" }, { name: "Fay Example", email: "fay@example.test", signal: "fay.01", how: "She taught me.", ally: "" }] });
    await q("UPDATE application_references SET followed_up_at = NOW(3) WHERE application_ref = ?", [id]);
    state.failing = `open-proposal:${id}:stage:final_interview`;
    expect((await call("POST", `${app(id)}/final-conversation`, {}, FINAL.id)).status).toBe(200);
    state.failing = null;
    expect(state.fresh.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${id}:stage:final_interview`))).toEqual([]);
    const deps: any = { getPool: () => pool, notify: async () => ({ fresh: true }), notifyAdmins: async () => {}, liveHoldersOf: async () => [FOUNDER.id], now: () => new Date(), calendar: () => ({ seasons: [NOW_SEASON, NEXT], currentSeasonId: "s-now", timezone: "UTC" }), members: usersRepo(pool) };
    deps.tellApplicant = makeApplicantTeller({ getPool: () => pool, members: usersRepo(pool), notify: deps.notify, postEmail, projectName: () => "Test Village", siteUrl: () => ORIGIN });
    await reviewClockTick(deps);
    await reviewClockTick(deps);
    const finals = state.fresh.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${id}:stage:final_interview`));
    expect(finals.map((m) => m.idempotencyKey)).toEqual([`open-proposal:${id}:stage:final_interview:r1`]);
  });

  it("START NOW IS OPS'S OWN ACT (ruling 8, QA round 5): a placer cannot set it; Ops sets it once, the walkthrough says so, and adopt needs the send", async () => {
    const id = await confirmed("start-now@example.test");
    // A placer (the founder) is not Ops.
    expect((await call("POST", `${app(id)}/start-now`, {}, FOUNDER.id)).status).toBe(403);
    // The Community holder is not Ops either.
    expect((await call("POST", `${app(id)}/start-now`, {}, IB.id)).status).toBe(403);
    // Ops is (the role the short labels call "Ops").
    const w0 = await call("GET", `${app(id)}/walkthrough`, undefined, IA.id);
    expect(w0.body.walkthrough.you).toMatchObject({ mayStartNow: true, startNow: false });
    expect((await call("POST", `${app(id)}/start-now`, {}, IA.id)).status).toBe(200);
    expect((await call("POST", `${app(id)}/start-now`, {}, IA.id)).status).toBe(409);
    expect((await call("GET", `${app(id)}/walkthrough`, undefined, IA.id)).body.walkthrough.you).toMatchObject({ mayStartNow: false, startNow: true });
    // Ruling 23: nothing is adopted, and no terms are offered, before the proposal is sent to the Anchor Circle.
    const adopt = await call("POST", `/api/governance/open-proposals/${id}/adopt`, {}, FOUNDER.id);
    expect([adopt.status, adopt.body.error]).toEqual([409, expect.stringMatching(/send_first|interviews_not_done|review_first/)]);
  });

  it("NUDGES (the lead: 'yes' to nudges): once each, and never a move", async () => {
    const { nudgeTick } = await import("../lib/applicantNudges");
    const { makeApplicantTeller } = await import("../lib/applicantUpdates");
    const deps: any = {
      getPool: () => pool,
      notify: async (n: any) => {
        state.notices.push(n);
        return { fresh: true };
      },
      notifyAdmins: async () => {},
      liveHoldersOf: async () => [FOUNDER.id],
      now: () => new Date(),
      calendar: () => ({ seasons: [NOW_SEASON, NEXT], currentSeasonId: "s-now", timezone: "UTC" }),
      members: usersRepo(pool),
    };
    deps.tellApplicant = makeApplicantTeller({ getPool: () => pool, members: usersRepo(pool), notify: deps.notify, postEmail, projectName: () => "Test Village", siteUrl: () => ORIGIN });
    const id = await confirmed("nudge@example.test");
    const [first] = await ivs(id);
    // Open six days (past the five), and the application seventy-six days old (past the seventy-five).
    await q("UPDATE application_interviews SET state = 'open', opened_at = ? WHERE id = ?", [new Date(Date.now() - 6 * 86_400_000), first.id]);
    await q("UPDATE application_steps SET stamped_at = ? WHERE application_ref = ? AND kind = 'confirmed'", [new Date(Date.now() - 76 * 86_400_000), id]);
    const steps = async () => (await q("SELECT kind FROM application_steps WHERE application_ref = ? ORDER BY id", [id])).map((r: any) => r.kind);
    const before = await steps();
    state.fresh.length = 0;
    state.notices.length = 0;
    await nudgeTick(deps);
    await nudgeTick(deps);
    const nudges = state.fresh.filter((m) => m.idempotencyKey === `open-proposal:${id}:nudge:book:${first.id}`);
    expect(nudges).toHaveLength(1);
    expect(nudges[0].text).toContain(`Book it here: ${LINK.ops}`);
    for (const l of [LINK.community, LINK.final]) expect(nudges[0].text).not.toContain(l);
    // The role up next hears it once (deduped by its key), and the close warning reaches the people who place roles.
    const keys = state.notices.map((n) => n.dedupeKey);
    expect(keys.filter((k) => k === `app:${id}:nudge:conversation:${first.id}:${IA.id}`).length).toBeGreaterThanOrEqual(1);
    expect(keys.filter((k) => k === `app:${id}:close-warning:${FOUNDER.id}`).length).toBeGreaterThanOrEqual(1);
    // Nothing moved.
    expect(await steps()).toEqual(before);
    expect(String((await ivs(id))[0].state)).toBe("open");
  });

  it("I'VE BOOKED IT (the lead, 27 Nov 2026): the applicant says the call's time, it shows in both zones, it stops the reminder; nobody else sets it, and a past time is refused", async () => {
    const { nudgeTick } = await import("../lib/applicantNudges");
    const { makeApplicantTeller } = await import("../lib/applicantUpdates");
    const deps: any = { getPool: () => pool, notify: async (n: any) => { state.notices.push(n); return { fresh: true }; }, notifyAdmins: async () => {}, liveHoldersOf: async () => [FOUNDER.id], now: () => new Date(), calendar: () => ({ seasons: [NOW_SEASON, NEXT], currentSeasonId: "s-now", timezone: "UTC" }), members: usersRepo(pool) };
    deps.tellApplicant = makeApplicantTeller({ getPool: () => pool, members: usersRepo(pool), notify: deps.notify, postEmail, projectName: () => "Test Village", siteUrl: () => ORIGIN });
    const id = await confirmed("booked@example.test");
    const [first] = await ivs(id);
    await q("UPDATE application_interviews SET state = 'open', opened_at = ? WHERE id = ?", [new Date(Date.now() - 6 * 86_400_000), first.id]);
    const byToken = `/api/application-status/${id}/booked?token=${statusToken(id)}`;
    const inTwoDays = new Date(Date.now() + 2 * 86_400_000);
    inTwoDays.setUTCHours(16, 0, 0, 0);

    // Nobody else: a wrong token and a stranger are the same 404; another member's account is too; no account is 401.
    expect((await call("POST", `/api/application-status/${id}/booked?token=nope`, { at: inTwoDays.toISOString() })).status).toBe(404);
    expect((await call("POST", `${app(id)}/booked`, { at: inTwoDays.toISOString() }, IB.id)).status).toBe(404);
    expect((await call("POST", `${app(id)}/booked`, { at: inTwoDays.toISOString() })).status).toBe(401);
    // A time past, a time too far ahead, and no time at all are refused, and nothing is stored.
    expect((await call("POST", byToken, { at: new Date(Date.now() - 3_600_000).toISOString() })).body.error).toBe("past");
    expect((await call("POST", byToken, { at: new Date(Date.now() + 120 * 86_400_000).toISOString() })).body.error).toBe("far");
    expect((await call("POST", byToken, { at: "next Tuesday" })).body.error).toBe("when");
    expect((await q("SELECT booked_at FROM application_interviews WHERE id = ?", [first.id]))[0].booked_at).toBeNull();

    // The applicant says it, by their link.
    const saved = await call("POST", byToken, { at: inTwoDays.toISOString() });
    expect(saved.status, saved.text).toBe(200);
    expect(saved.body.at).toBe(inTwoDays.toISOString());
    const page = await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`);
    expect(page.body.status.bookNow).toMatchObject({ booked: inTwoDays.toISOString() });
    expect(typeof page.body.status.bookNow.zone).toBe("string");
    // The conversation's row reads Booked, done.
    const { statusView } = await import("../../shared/applicantWords");
    const row = statusView("en", page.body.status).tasks?.find((x) => x.key === "conversation");
    expect(row).toMatchObject({ state: "Booked", done: true });

    // The 5-day reminder stops: the conversation is six days open, and no reminder goes.
    state.fresh.length = 0;
    await nudgeTick(deps);
    expect(state.fresh.filter((m) => m.idempotencyKey === `open-proposal:${id}:nudge:book:${first.id}`)).toEqual([]);

    // "Change": a later save corrects it.
    const later = new Date(inTwoDays.getTime() + 86_400_000);
    expect((await call("POST", byToken, { at: later.toISOString() })).status).toBe(200);
    // The team sees it on the walkthrough, and may correct it there too.
    const w = await call("GET", `${app(id)}/walkthrough`, undefined, IA.id);
    const conv = w.body.walkthrough.conversations.find((c: any) => c.interviewId === Number(first.id));
    expect(conv).toMatchObject({ bookedAt: later.toISOString(), mayBook: true });
    const fixed = await call("POST", `${app(id)}/interviews/${first.id}/booked`, { at: inTwoDays.toISOString() }, IA.id);
    expect(fixed.status, fixed.text).toBe(200);
    // A member who may not read that conversation is the stranger's 404.
    expect((await call("POST", `${app(id)}/interviews/${first.id}/booked`, { at: inTwoDays.toISOString() }, IB.id)).status).toBe(404);
    expect(new Date((await q("SELECT booked_at FROM application_interviews WHERE id = ?", [first.id]))[0].booked_at).toISOString()).toBe(inTwoDays.toISOString());

    // Once written up, it is no longer open: nothing more is set.
    await q("UPDATE application_interviews SET state = 'scored' WHERE id = ?", [first.id]);
    expect((await call("POST", byToken, { at: later.toISOString() })).status).toBe(409);
  });

  it("REFINE AT EVERY STAGE (the lead: 'they can refine proposal in each stage'): from Received on, until the circle", async () => {
    const id = await confirmed("refine-early@example.test");
    const saved = await call("POST", `/api/application-status/${id}/proposal?token=${statusToken(id)}`, { why: "Early why.", aim: "Early aim." });
    expect(saved.status, saved.text).toBe(200);
    const page = await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`);
    expect(page.body.status.sixStages.refine.open).toBe(true);
    // The first letter offers it too.
    const first = state.posted.find((m) => m.idempotencyKey === `open-proposal:${id}:status`)!;
    expect(first.text).toContain("You can refine your proposal on your page at any step");
  });

  it("THE REVIEW WINDOW (the lead: 'we review 1-2 weeks after the application deadline'): said when a role sets a deadline, and the team is nudged only once it opens", async () => {
    const { nudgeTick } = await import("../lib/applicantNudges");
    const deadline = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    // The role card's own date (`sections.applyBy`, the one source the card shows), stamped on the application at arrival.
    await cardApplyBy(deadline);
    try {
      const id = await confirmed("window@example.test");
      const first = state.posted.find((m) => m.idempotencyKey === `open-proposal:${id}:status`)!;
      expect(first.text).toContain("We review applications 1 to 2 weeks after");
      expect(first.text).not.toContain("within one moon cycle");
      const before = (await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`)).body.status;
      expect(before.reviewAfter).toBe(deadline);
      // Ruling 17: nothing to book before the window opens, on the page or in the letter.
      expect(before.bookNow?.url ?? null).toBeNull();
      expect(JSON.stringify(before)).not.toContain(LINK.ops);
      expect(first.text).not.toContain(LINK.ops);
      // A conversation open four days, before the window: not stalled, no heads-up to the team.
      const [iv] = await ivs(id);
      await q("UPDATE application_interviews SET state = 'open', opened_at = ? WHERE id = ?", [new Date(Date.now() - 4 * 86_400_000), iv.id]);
      const deps: any = { getPool: () => pool, notify: async (n: any) => { state.notices.push(n); return { fresh: true }; }, notifyAdmins: async () => {}, liveHoldersOf: async () => [FOUNDER.id], now: () => new Date(), members: usersRepo(pool) };
      state.notices.length = 0;
      await nudgeTick(deps);
      expect(state.notices.filter((n) => n.dedupeKey.startsWith(`app:${id}:nudge:conversation`))).toEqual([]);
      // Clearing the card's date later re-times nothing: the application keeps the day it arrived under (QA round 5).
      await cardApplyBy(null);
      expect((await call("GET", `/api/application-status/${id}?token=${statusToken(id)}`)).body.status.reviewAfter).toBe(deadline);
      // Nothing to book yet: "I've booked it" is refused, and the page offers no booking (QA round 5).
      expect((await call("POST", `/api/application-status/${id}/booked?token=${statusToken(id)}`, { at: new Date(Date.now() + 2 * 86_400_000).toISOString() })).body.error).toBe("no_booking");
      // The window opens (its stamped deadline 30 days back): the role up next hears it, and the applicant gets the
      // Ops booking letter, once, with its link (nothing had brought it).
      const { makeApplicantTeller } = await import("../lib/applicantUpdates");
      deps.tellApplicant = makeApplicantTeller({ getPool: () => pool, members: usersRepo(pool), notify: deps.notify, postEmail, projectName: () => "Test Village", siteUrl: () => ORIGIN });
      await stampApplyBy(id, new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
      // The conversation opened at arrival, 40 days back, long before the window (opened 23 days back).
      await q("UPDATE application_interviews SET opened_at = ? WHERE id = ?", [new Date(Date.now() - 40 * 86_400_000), iv.id]);
      state.fresh.length = 0;
      await nudgeTick(deps);
      await nudgeTick(deps);
      expect(state.notices.some((n) => n.dedupeKey.startsWith(`app:${id}:nudge:conversation`))).toBe(true);
      const opened = state.fresh.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${id}:update:conversation:window`));
      expect(opened).toHaveLength(1);
      expect(opened[0].text).toContain(LINK.ops);
      // The 5-day reminder counts from the opening: the conversation has been open four days, the window far longer,
      // and no reminder goes before five days from the window's opening... which is past here, so exactly one may go.
      expect(state.fresh.filter((m) => m.idempotencyKey.startsWith(`open-proposal:${id}:nudge:book`)).length).toBeLessThanOrEqual(1);

      // Applied after the deadline: said plainly (QA round 5: "after 10 September 2026" to a late applicant).
      const pastDay = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
      await cardApplyBy(pastDay);
      const late = await confirmed("window-late@example.test");
      const lateMail = state.posted.find((m) => m.idempotencyKey === `open-proposal:${late}:status`)!;
      expect(lateMail.text).toContain("Applications for this role closed on");
      expect(lateMail.text).not.toContain("We review applications 1 to 2 weeks after");
    } finally {
      await cardApplyBy(null);
    }
  });

  describe("the 90-day close", () => {
    const closing = { postEmail, projectName: () => "Test Village", siteUrl: () => ORIGIN, onboardingRole: () => "" };
    const ageOf = async (id: string, days: number, at: Date) => q("UPDATE open_role_proposals SET confirmed_at = ? WHERE id = ?", [new Date(at.getTime() - days * 86_400_000), id]);
    const statusOf = async (id: string) => String((await q("SELECT status FROM open_role_proposals WHERE id = ?", [id]))[0].status);
    const events = async (id: string) => (await q("SELECT kind, actor_kind FROM health_events WHERE kind = 'application_closed' AND entity_ref = ?", [id])) as any[];

    it("closes only an undecided application past the village's days, once, with its letter and an event", async () => {
      const at = new Date();
      const old = await confirmed("old@example.test");
      const young = await confirmed("young@example.test");
      const adopted = await confirmed("adopted@example.test");
      const closedAlready = await confirmed("closed@example.test");
      await ageOf(old, 91, at);
      await ageOf(young, 89, at);
      await ageOf(adopted, 200, at);
      await ageOf(closedAlready, 200, at);
      await q("UPDATE open_role_proposals SET status = 'adopted', decided_at = ? WHERE id = ?", [at, adopted]);
      await q("UPDATE open_role_proposals SET status = 'withdrawn', decided_at = ? WHERE id = ?", [at, closedAlready]);
      state.fresh.length = 0;
      await tidyOpenProposals(pool, at, undefined, closing);
      expect([await statusOf(old), await statusOf(young), await statusOf(adopted), await statusOf(closedAlready)]).toEqual(["withdrawn", "confirmed", "adopted", "withdrawn"]);
      expect(state.fresh.map((m) => m.idempotencyKey)).toEqual([`open-proposal:${old}:closed`]);
      expect(await events(old)).toEqual([{ kind: "application_closed", actor_kind: "system" }]);
      for (const other of [young, adopted, closedAlready]) expect(await events(other)).toEqual([]);
      // Running again sends nothing and records nothing more.
      state.fresh.length = 0;
      await tidyOpenProposals(pool, at, undefined, closing);
      expect(state.fresh).toEqual([]);
      expect(await events(old)).toHaveLength(1);
    });

    it("THE CLOCK STARTS AT REVIEW (the lead, 27 Nov 2026: 'Yes'): with a deadline, the days count from the review window's opening; without one, from arrival. The warning and the link follow", async () => {
      const { nudgeTick } = await import("../lib/applicantNudges");
      const { statusLinkDays } = await import("../lib/applicantUpdates");
      const at = new Date();
      const dayAgo = (n: number) => new Date(at.getTime() - n * 86_400_000).toISOString().slice(0, 10);
      // Both arrived 120 days ago.
      const late = await confirmed("clock-late@example.test");
      const due = await confirmed("clock-due@example.test");
      await ageOf(late, 120, at);
      await ageOf(due, 120, at);
      await q("UPDATE application_steps SET stamped_at = ? WHERE application_ref IN (?, ?) AND kind = 'confirmed'", [new Date(at.getTime() - 120 * 86_400_000), late, due]);
      try {
        // The deadline 50 days back: the window opened 43 days ago, so 43 days on the clock. Not closed.
        for (const r of [late, due]) await stampApplyBy(r, dayAgo(50));
        await tidyOpenProposals(pool, at, undefined, closing);
        expect(await statusOf(late)).toBe("confirmed");
        expect(await statusOf(due)).toBe("confirmed");
        // No warning either: 43 is short of the 75.
        const deps: any = { getPool: () => pool, notify: async (n: any) => { state.notices.push(n); return { fresh: true }; }, notifyAdmins: async () => {}, liveHoldersOf: async () => [FOUNDER.id], now: () => at, members: usersRepo(pool) };
        state.notices.length = 0;
        await nudgeTick(deps);
        expect(state.notices.filter((n) => n.dedupeKey === `app:${late}:close-warning:${FOUNDER.id}`)).toEqual([]);
        // The deadline 87 days back: the window opened 80 days ago. The warning goes, and nothing closes yet.
        for (const r of [late, due]) await stampApplyBy(r, dayAgo(87));
        await nudgeTick(deps);
        expect(state.notices.filter((n) => n.dedupeKey === `app:${late}:close-warning:${FOUNDER.id}`)).toHaveLength(1);
        await tidyOpenProposals(pool, at, undefined, closing);
        expect(await statusOf(late)).toBe("confirmed");
        // The deadline 100 days back: the window opened 93 days ago. Both close.
        for (const r of [late, due]) await stampApplyBy(r, dayAgo(100));
        await tidyOpenProposals(pool, at, undefined, closing);
        expect([await statusOf(late), await statusOf(due)]).toEqual(["withdrawn", "withdrawn"]);
      } finally {
        await cardApplyBy(null);
      }
      // Without a deadline, from arrival: 120 days is closed (the test above pins 91 and 89).
      // The link: signed now for a window opening in 60 days, it lives those 60 days plus the close's 90 and the margin.
      expect(statusLinkDays(null, at)).toBe(120);
      expect(statusLinkDays(new Date(at.getTime() + 60 * 86_400_000), at)).toBe(60 + 90 + 30);
      // A window already open adds nothing.
      expect(statusLinkDays(new Date(at.getTime() - 5 * 86_400_000), at)).toBe(120);
    });

    it("the days are the village's: at 30, an application 31 days old closes", async () => {
      const at = new Date();
      const id = await confirmed("thirty@example.test");
      await ageOf(id, 31, at);
      await tidyOpenProposals(pool, at, undefined, closing);
      expect(await statusOf(id)).toBe("confirmed");
      await variable("org.application_close_days", "30");
      try {
        await tidyOpenProposals(pool, at, undefined, closing);
        expect(await statusOf(id)).toBe("withdrawn");
      } finally {
        await variable("org.application_close_days", "90");
      }
    });
  });
});
