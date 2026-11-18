/**
 * OPEN ROLE PROPOSALS, THE INTAKE, over real HTTP and the S5 scratch schema
 * (server/routes/openProposals.ts), with the mail door handed in as a fake
 * that records what would go out. Nothing here reaches a provider.
 *
 * What is pinned:
 *
 *   - WHO CAN OPEN THE FORM: the public link is on unless switched off (sheet
 *     19i); a link made for one person opens it whatever the switch says,
 *     until it is switched off itself; the governance module has to be on.
 *     Only live roles in live circles are offered, never an example.
 *   - NOTHING UNCONFIRMED REACHES A PERSON: a proposal is kept unconfirmed and
 *     the address gets one essential email with a link; the desk lists only
 *     confirmed proposals.
 *   - A SEND THAT DID NOT GO KEEPS THE APPLICATION (Rye, 14 Nov 2026): 200 in
 *     honest words, confirmed by us and marked "address not confirmed", the
 *     admins told in the bell, never deleted by the tidy job, the email tried
 *     again every hour until it goes, and its link clears the mark.
 *   - The link confirms once, and not after 48 hours.
 *   - The gates on the way in: the honeypot, a cap per connection and per
 *     address, and every field checked, with the field named.
 *   - The tidy job: unconfirmed after 48 hours is deleted, and a declined or
 *     withdrawn proposal loses its name and address after 90 days.
 *   - The desk: the gate on `intake.moderate`; the switch; a link shown once
 *     and switched off.
 */
import { applicantSteps } from "../../shared/applicantWords";
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { OPEN_GLOBAL_HOURLY, OPEN_WORDS, roleTermsOf } from "../../shared/openProposals";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { escapeHtml } from "../lib/comms/mailer";
import { createOrgRole } from "../lib/orgChart";
import { readOpenProposal } from "../repos/openProposals";
import { retryOwedConfirmations } from "../lib/openProposalKept";
import { rewriteTermsOffer } from "../repos/seatApplications";
import { saveSections } from "../lib/roleCardSections";
import { EMPTY_SECTIONS } from "../../shared/roleCardSections";
import { usersRepo } from "../repos/users";
import { loadVariables } from "../lib/variables";
import { LANGUAGES } from "../../shared/applicantWords";
import { register, tidyOpenProposals } from "./openProposals";

const configured = testDbConfigured();
if (!configured) console.warn("[openProposals] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const ORIGIN = "https://village.example.test";
const ADMIN = { id: "u-admin", name: "Ada Stone" };
const MEMBER = { id: "u-member", name: "Ivo Lantern" };
const NEXT = { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01", endsOn: "2099-03-20", goals: [{ id: "g-roots", text: "Roots in the ground", done: false }, { id: "g-done", text: "Already done", done: true }] };
const NOW_SEASON = { id: "s-now", name: "Season of Seeds", startsOn: "2000-01-01", endsOn: "2098-12-31" };

describe.skipIf(!configured)("open role proposals, the intake, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let base = "";
  let gate = "";
  let well = "";
  let example = "";
  let dormant = "";

  const state = {
    viewer: null as { id: string; name: string } | null,
    moderators: [ADMIN.id] as string[],
    governance: "public",
    seasons: [NOW_SEASON, NEXT] as any[],
    limited: [] as string[],
    /** Count every hit the way the real limiter does (the attack tests); off, only `limited` refuses. */
    counting: false,
    sent: [] as OutgoingEmail[],
    answer: { status: "sent", messageId: "m-1" } as PostResult,
    clock: null as Date | null,
    /** What the admins were told in the bell. */
    admins: [] as Array<{ type: string; title: string; dedupeKey: string; link?: string }>,
  };

  /** The limiter's counts, per bucket, while `state.counting` is on. */
  const hits = new Map<string, number>();
  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await q("INSERT INTO circles (id, name, aliases, is_example) VALUES ('c-land', 'Land Circle', '[]', 0), ('c-old', 'Old Circle', '[]', 0)");
    await q("UPDATE circles SET status = 'dormant' WHERE id = 'c-old'");
    gate = await createOrgRole(pool, { id: "op-role-gate", name: "Gate Keeper", seats: 2, circleId: "c-land", aim: "Open the gate at dawn." });
    well = await createOrgRole(pool, { id: "op-role-well", name: "Well Keeper", seats: 2, circleId: "c-land", aim: "Keep the well clean." });
    example = await createOrgRole(pool, { id: "op-role-example", name: "Example Keeper", seats: 1, circleId: "c-land", aim: "A sample." });
    await q("UPDATE org_roles SET is_example = 1 WHERE id = ?", [example]);
    dormant = await createOrgRole(pool, { id: "op-role-dormant", name: "Old Keeper", seats: 1, circleId: "c-old", aim: "Gone." });

    const app = express();
    app.use(express.json());
    register(app, {
      getPool: () => pool,
      overLimit: async (bucket: string, max: number) => {
        if (state.limited.some((b) => bucket.startsWith(b))) return true;
        if (!state.counting) return false;
        const n = (hits.get(bucket) ?? 0) + 1;
        hits.set(bucket, n);
        return n > max;
      },
      clientIp: (req: any) => String(req.headers["x-test-ip"] ?? "203.0.113.9"),
      guardCapability: async (_req: any, res: any) => {
        if (state.viewer && state.moderators.includes(state.viewer.id)) return true;
        res.status(state.viewer ? 403 : 401).json({ error: state.viewer ? "forbidden" : "auth_required" });
        return false;
      },
      authedUser: async () => state.viewer,
      commsPostOffice: { getPool: () => pool },
      deploymentOrigin: () => ORIGIN,
      projectName: () => "Test Village",
      escapeHtml,
      seasonState: () => ({ current: NOW_SEASON, seasons: state.seasons, timezone: "UTC" }),
      postEmail: async (email: OutgoingEmail) => {
        state.sent.push(email);
        return state.answer;
      },
      governanceLifecycle: () => state.governance,
      now: () => state.clock ?? new Date(),
      // What the confirm step reads to ask the circle (part B, server/routes/openProposalDecide.test.ts pins it).
      notify: async () => ({ fresh: true }),
      notifyAdmins: async (type: string, title: string, dedupeKey: string, link?: string) => {
        state.admins.push({ type, title, dedupeKey, link });
      },
      members: usersRepo(pool),
      liveHoldersOf: async () => [],
      rolesCarrying: () => [],
      loadRoleHolders: () => [],
      seatCalendar: () => ({ seasons: state.seasons, currentSeasonId: "s-now", timezone: "UTC" }),
      lapse: () => ({ currentSeasonId: "s-now", cadence: "season_turn" }),
      stageOf: async () => "guest",
      recordStageEvent: async () => undefined,
      // An admin reads the pay ceiling while the village keeps pay hidden; nobody else here does.
      mayReadPay: async () => state.viewer?.id === ADMIN.id,
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

  beforeEach(async () => {
    state.viewer = null;
    state.moderators = [ADMIN.id];
    state.governance = "public";
    state.seasons = [NOW_SEASON, NEXT];
    state.limited = [];
    state.counting = false;
    hits.clear();
    state.sent.length = 0;
    state.answer = { status: "sent", messageId: "m-1" };
    state.clock = null;
    state.admins.length = 0;
    await q("DELETE FROM app_config WHERE config_key = 'open-proposals'");
  });

  const call = async (method: string, path: string, body?: unknown, ip?: string) => {
    const res = await fetch(`${base}${path}`, { // module-review-ok: a test calling its own local server, never an outside host
      method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(ip ? { "x-test-ip": ip } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };

  /** The village's `org.show_pay_ranges`: "true" shows pay to everyone, null puts the default (off) back. */
  const setPayShown = async (value: string | null) => {
    if (value === null) await q("DELETE FROM game_variables WHERE config_key = 'org.show_pay_ranges'");
    else await q("INSERT INTO game_variables (config_key, value) VALUES ('org.show_pay_ranges', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [value]);
    await loadVariables(pool);
  };

  const proposal = (over: Record<string, unknown> = {}) => ({
    name: "Rowan Field",
    email: "rowan@example.test",
    roles: [{ roleId: gate, note: "I open gates for a living." }],
    why: "I live up the road and the gate is always shut.",
    aim: "The gate opens at dawn every day.",
    ...over,
  });

  /** The confirmation link's token: the line that parses as a link on this village's own origin, compared whole. */
  const tokenOf = (mail: OutgoingEmail) => {
    const line = mail.text.split("\n").find((l) => {
      try {
        return new URL(l).origin === ORIGIN;
      } catch {
        return false;
      }
    });
    return new URL(line as string).searchParams.get("token") as string;
  };

  /** Send a proposal, and answer the id of the row it wrote and the token its email carried. */
  const send = async (over: Record<string, unknown> = {}) => {
    const before = state.sent.length;
    const r = await call("POST", "/api/open-proposals", proposal(over));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const mail = state.sent[before];
    const id = mail.idempotencyKey.split(":")[1];
    return { id, token: tokenOf(mail), mail };
  };

  describe("who can open the form", () => {
    it("names each role's conversations in its order, the final approval marked, and never its booking link (role audit, 10 Nov 2026)", async () => {
      await pool.query("UPDATE `org_roles` SET `conversations` = ?, `booking_url` = ? WHERE `id` = ?", [ // module-review-ok: fixture SQL against this suite's scratch schema
        JSON.stringify([{ roleId: gate, minutes: 20, final: false }, { roleId: well, minutes: 30, final: true }]),
        "https://book.example.test/well",
        well,
      ]);
      try {
        const r = await call("GET", "/api/open-proposals/form");
        expect(r.body.roles.find((x: any) => x.id === well).conversations).toEqual([
          { role: "Gate Keeper", minutes: 20 },
          { role: "Well Keeper", minutes: 30, finalApproval: true },
        ]);
        expect(JSON.stringify(r.body)).not.toContain("book.example.test");
      } finally {
        await pool.query("UPDATE `org_roles` SET `conversations` = NULL, `booking_url` = NULL WHERE `id` = ?", [well]); // module-review-ok: fixture SQL against this suite's scratch schema
      }
    });

    it("the public link is on unless switched off, and offers only live roles in live circles", async () => {
      const r = await call("GET", "/api/open-proposals/form");
      expect(r.body).toMatchObject({ open: true, village: "Test Village", season: { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01" } });
      expect(r.body.roles.map((x: any) => x.id).sort()).toEqual([gate, well].sort());
      expect(r.body.roles.find((x: any) => x.id === gate)).toEqual({ id: gate, name: "Gate Keeper", circle: "Land Circle", aim: "Open the gate at dawn.", accountabilities: [], whyItMatters: null, timeCommitment: null, terms: { words: {}, commitmentPct: null }, conversations: [], alwaysChecked: false, commitmentMin: null, opensLater: false, payShape: [] });
      // Pay hidden (org.show_pay_ranges ships off): the ceiling key is absent, never null.
      expect("payCeiling" in r.body.roles.find((x: any) => x.id === gate)).toBe(false);
      expect(JSON.stringify(r.body)).not.toContain(example);
      expect(JSON.stringify(r.body)).not.toContain(dormant);
    });

    it("step 1's acts (Rye, 15 Nov 2026): the village's links, none where it wrote none, and /steward for the new", async () => {
      // Read here, not imported above, so this file's import list stays as it was.
      const { loadVariables } = await import("../lib/variables");
      const setVar = async (key: string, value: string | null) => {
        if (value === null) await q("DELETE FROM game_variables WHERE config_key = ?", [key]);
        else await q("INSERT INTO game_variables (config_key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [key, value]);
        await loadVariables(pool);
      };
      const none = (await call("GET", "/api/open-proposals/form")).body.founding.knowUsLinks;
      expect(none).toEqual({ recording: null, call: { href: null, next: null }, tour: { href: null, next: null }, potluck: { href: null, next: null }, stewardPath: "/steward" });
      await setVar("org.founding_recording_link", "https://video.example.test/last-call");
      await setVar("org.founding_tour_link", "https://book.example.test/tour");
      try {
        const l = (await call("GET", "/api/open-proposals/form")).body.founding.knowUsLinks;
        expect(l).toMatchObject({ recording: "https://video.example.test/last-call", tour: { href: "https://book.example.test/tour", next: null }, potluck: { href: null } });
      } finally {
        await setVar("org.founding_recording_link", null);
        await setVar("org.founding_tour_link", null);
      }
    });

    it("the governance module off closes it, and no next season says so", async () => {
      state.governance = "off";
      expect((await call("GET", "/api/open-proposals/form")).body).toEqual({ open: false, message: OPEN_WORDS.closed });
      expect((await call("POST", "/api/open-proposals", proposal())).status).toBe(403);
      state.governance = "public";
      state.seasons = [NOW_SEASON];
      expect((await call("GET", "/api/open-proposals/form")).body).toMatchObject({ open: true, season: null, roles: [] });
      const refused = await call("POST", "/api/open-proposals", proposal());
      expect(refused.status).toBe(409);
      expect(refused.body.error).toBe(OPEN_WORDS.noSeason);
      expect(state.sent).toHaveLength(0);
    });

    it("the switch off closes the public link, a link made for one person still opens it, and a switched-off link does not", async () => {
      state.viewer = ADMIN;
      expect((await call("PUT", "/api/admin/open-proposals/settings", { publicLink: false })).body).toMatchObject({ publicLink: false, message: OPEN_WORDS.publicOff });
      const made = await call("POST", "/api/admin/open-proposals/links", { label: "Sol from the market" });
      expect(made.status).toBe(200);
      const madeUrl = new URL(made.body.url);
      expect([madeUrl.origin, madeUrl.pathname.startsWith("/propose-a-role/")]).toEqual([ORIGIN, true]);
      const token = decodeURIComponent(made.body.url.split("/propose-a-role/")[1]);
      state.viewer = null;

      expect((await call("GET", "/api/open-proposals/form")).body.open).toBe(false);
      expect((await call("POST", "/api/open-proposals", proposal())).status).toBe(403);
      const viaLink = await call("GET", `/api/open-proposals/form?link=${encodeURIComponent(token)}`);
      expect(viaLink.body.open).toBe(true);
      // The admin's label for the person is never shown on the page.
      expect(JSON.stringify(viaLink.body)).not.toContain("Sol from the market");
      const sent = await send({ link: token, email: "sol@example.test" });
      expect((await readOpenProposal(pool, sent.id))?.linkId).toBe(made.body.id);

      state.viewer = ADMIN;
      expect((await call("POST", `/api/admin/open-proposals/links/${made.body.id}/revoke`)).body.message).toBe(OPEN_WORDS.linkOff);
      expect((await call("POST", `/api/admin/open-proposals/links/${made.body.id}/revoke`)).status).toBe(404);
      state.viewer = null;
      expect((await call("GET", `/api/open-proposals/form?link=${encodeURIComponent(token)}`)).body.open).toBe(false);
      expect((await call("GET", "/api/open-proposals/form?link=not-a-real-link")).body.open).toBe(false);
    });
  });

  describe("the founding-team application (Phase A, 11 Nov 2026)", () => {
    it("the form carries the village's words from its settings, and no pay shape the village has not written (the page shows N%)", async () => {
      const r = await call("GET", "/api/open-proposals/form");
      expect(r.body.founding).toMatchObject({
        knowUs: ["Join a community call", "Visit the land", "Share a meal with us"],
        shares: [],
        atRisk: "",
        footer: "",
        firstConversations: [],
      });
      expect(r.body.founding.firstCycle).toMatch(/either side may/);
      // Shares only: never a range, a minimum or an amount.
      expect(JSON.stringify(r.body.founding)).not.toMatch(/\$|USD|minimum|budget/i);
    });

    it("keeps the ticks for ways the village lists, drops any other, and keeps the ramp-up and Human Design or Gene Keys", async () => {
      const { id } = await send({ knowUs: ["Visit the land", "A way nobody lists", "Visit the land"], rampUp: true, selfKnowledge: "Projector, 4/6" });
      const row = await readOpenProposal(pool, id);
      expect(row?.body).toMatchObject({ knowUs: ["Visit the land"], rampUp: true, selfKnowledge: "Projector, 4/6" });
      // An application without them stores none of the three.
      const plain = await send({ email: "plain@example.test" });
      const body = (await readOpenProposal(pool, plain.id))?.body ?? {};
      for (const key of ["knowUs", "rampUp", "selfKnowledge"]) expect(body).not.toHaveProperty(key);
    });

    it("hiring the founding team first (Rye, 14 Nov 2026): a role outside it opens later, and its applicant is told the reply waits, on every page and letter", async () => {
      const setVar = async (key: string, value: string | null) => {
        if (value === null) await q("DELETE FROM game_variables WHERE config_key = ?", [key]);
        else await q("INSERT INTO game_variables (config_key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [key, value]);
        await loadVariables(pool);
      };
      await setVar("org.founding_team", "true");
      await setVar("org.founding_team_roles", gate);
      try {
        const form = await call("GET", "/api/open-proposals/form");
        const flag = (id: string) => form.body.roles.find((r: any) => r.id === id)?.opensLater;
        expect(flag(gate)).toBe(false);
        expect(flag(well)).toBe(true);
        // The founding role keeps the village's days (control).
        const founding = await call("POST", "/api/open-proposals", proposal({ email: "first@example.test" }));
        expect(founding.body).toMatchObject({ replyDays: expect.any(Number), afterFounding: false });
        // A role opening next: no days, and said.
        const before = state.sent.length;
        const later = await call("POST", "/api/open-proposals", proposal({ email: "later@example.test", roles: [{ roleId: well, note: "Wells are my life." }] }));
        expect(later.body).toMatchObject({ sent: true, replyDays: null, afterFounding: true });
        const confirmed = await call("POST", "/api/open-proposals/confirm", { token: tokenOf(state.sent[before]) });
        expect(confirmed.body).toMatchObject({ confirmed: true, replyDays: null, afterFounding: true, steps: applicantSteps("en", null) });
        expect(confirmed.body.steps.find((s: any) => s.key === "review").when).toMatch(/Once our founding team is in place/);
        const status = state.sent.find((m) => m.idempotencyKey.endsWith(":status") && m.to.email === "later@example.test");
        expect(status?.text).toContain(LANGUAGES.en.replyPromise(null));
        expect(status?.text).not.toMatch(/We reply within \d/);
      } finally {
        await setVar("org.founding_team", null);
        await setVar("org.founding_team_roles", null);
      }
      // With the founding team off, nothing opens later (control).
      expect((await call("GET", "/api/open-proposals/form")).body.roles.every((r: any) => r.opensLater === false)).toBe(true);
    });

    it("refuses Human Design or Gene Keys longer than its limit, naming the field", async () => {
      const r = await call("POST", "/api/open-proposals", proposal({ selfKnowledge: "x".repeat(301) }));
      expect(r.status).toBe(400);
      expect(r.body.field).toBe("selfKnowledge");
      expect(state.sent).toHaveLength(0);
    });
  });

  describe("nothing unconfirmed reaches a person", () => {
    it("a proposal is kept unconfirmed and its address gets one essential email with a link, and nothing else", async () => {
      const { id, mail } = await send();
      expect(mail).toMatchObject({ kind: "essential", origin: "open_proposal.confirm", to: { email: "rowan@example.test", name: "Rowan" }, subject: "Confirm your application to Test Village" });
      // A listed role is applied for (Phase A vocabulary): the email says application.
      expect(mail.text).toContain("You applied for Gate Keeper in Test Village.");
      expect(mail.text).toContain("Confirm it's you, and your application reaches us:");
      expect(mail.text).toContain(`${ORIGIN}/propose-a-role/confirm?token=`);
      expect(state.sent).toHaveLength(1);
      const row = await readOpenProposal(pool, id);
      expect(row).toMatchObject({ status: "unconfirmed", name: "Rowan Field", email: "rowan@example.test", targetSeasonId: "s-next", linkId: null });
      expect(row?.body).toEqual({ roles: [{ roleId: gate, note: "I open gates for a living." }], why: "I live up the road and the gate is always shut.", aim: "The gate opens at dawn every day.", locale: "en" });
      // The desk does not see it.
      state.viewer = ADMIN;
      expect((await call("GET", "/api/admin/open-proposals")).body.proposals.map((p: any) => p.id)).not.toContain(id);
    });

    it("the link confirms it once, then the desk sees it; a second use, a wrong token and one past 48 hours are refused", async () => {
      const { id, token } = await send();
      const ok = await call("POST", "/api/open-proposals/confirm", { token });
      // The applicant also gets the link to their own status page (role journey L5); only its hash is kept.
      // The firefly path's confirmed page: it speaks the language proposed in, and dates the first reply.
      expect(ok.body).toEqual({ confirmed: true, message: OPEN_WORDS.confirmed, statusPath: expect.stringContaining(`/application-status/${id}?token=`), locale: "en", replyDays: expect.any(Number), afterFounding: false, steps: applicantSteps("en", ok.body.replyDays) });
      // The confirmed page draws the one step list the status page uses (shared/applicantWords.ts), in order.
      expect(ok.body.steps.map((s: { key: string }) => s.key)).toEqual(["received", "review", "invitation", "conversations", "decision", "first_cycle"]);
      expect((await readOpenProposal(pool, id))?.status).toBe("confirmed");
      const again = await call("POST", "/api/open-proposals/confirm", { token });
      expect(again.status).toBe(410);
      expect(again.body.error).toBe(OPEN_WORDS.confirmGone);
      expect((await call("POST", "/api/open-proposals/confirm", { token: "nope" })).status).toBe(410);
      expect((await call("POST", "/api/open-proposals/confirm", {})).status).toBe(410);

      state.viewer = ADMIN;
      const desk = await call("GET", "/api/admin/open-proposals");
      const seen = desk.body.proposals.find((p: any) => p.id === id);
      expect(seen).toMatchObject({ name: "Rowan Field", email: "rowan@example.test", via: null, roles: [{ roleId: gate, name: "Gate Keeper (Land Circle)", note: "I open gates for a living." }] });

      const late = await send({ email: "late@example.test" });
      state.clock = new Date(Date.now() + 49 * 60 * 60_000);
      expect((await call("POST", "/api/open-proposals/confirm", { token: late.token })).status).toBe(410);
      expect((await readOpenProposal(pool, late.id))?.status).toBe("unconfirmed");
    });

    it("a confirmation that did not go KEEPS the application, marked, and says so honestly (Rye, 14 Nov 2026)", async () => {
      state.answer = { status: "failed", messageId: null, reason: "provider said 403" };
      const before = (await q("SELECT COUNT(*) AS n FROM open_role_proposals"))[0].n;
      const r = await call("POST", "/api/open-proposals", proposal({ email: "outage@example.test" }));
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body).toMatchObject({ sent: true, kept: true, email: "outage@example.test", message: OPEN_WORDS.keptNotSent("outage@example.test") });
      expect(r.body.message).toBe("We have your application. Our confirmation email didn't go out, so we'll write to you at outage@example.test soon.");
      // The status page is offered on screen, since no email carried it.
      expect(r.body.statusPath).toEqual(expect.stringMatching(/^\/application-status\/op-[0-9a-f]+\?token=/));
      expect((await q("SELECT COUNT(*) AS n FROM open_role_proposals"))[0].n).toBe(before + 1);
      const id = state.sent[0].idempotencyKey.split(":")[1];
      const row = await readOpenProposal(pool, id);
      expect(row).toMatchObject({ status: "confirmed", name: "Rowan Field", email: "outage@example.test" });
      expect(row?.addressUnconfirmed).toMatchObject({ owed: true, sentAt: null });
      // The admins hear it in the bell, never by email: only the one confirmation email was tried.
      expect(state.admins).toContainEqual({ type: "governance", title: OPEN_WORDS.keptAlertTitle, dedupeKey: `op:${id}:email-failed:admins`, link: `/open-proposals/${id}` });
      expect(state.sent).toHaveLength(1);
      // The desk sees it like any received application, flagged.
      state.viewer = ADMIN;
      const seen = (await call("GET", "/api/admin/open-proposals")).body.proposals.find((p: any) => p.id === id);
      expect(seen).toMatchObject({ name: "Rowan Field", email: "outage@example.test", addressUnconfirmed: OPEN_WORDS.addressUnconfirmed });
      // CONTROL: a proposal confirmed the usual way carries no flag.
      state.viewer = null;
      state.answer = { status: "sent", messageId: "m-2" };
      const plain = await send({ email: "plain-confirm@example.test" });
      await call("POST", "/api/open-proposals/confirm", { token: plain.token });
      expect((await readOpenProposal(pool, plain.id))?.addressUnconfirmed).toBeNull();
    });

    it("an address the post office refuses (bounced, complained, erased, malformed, expired) is NOT kept: the old 'couldn't send' answer (security sweep, 14 Nov 2026)", async () => {
      const refused: PostResult[] = [
        { status: "skipped", messageId: "m-s", reason: "suppressed" },
        { status: "skipped", messageId: "m-b", reason: "bad_address" },
        { status: "expired", messageId: "m-e", reason: "expired" },
        { status: "bounced", messageId: "m-x" },
      ];
      for (const [i, answer] of refused.entries()) {
        state.answer = answer;
        const before = (await q("SELECT COUNT(*) AS n FROM open_role_proposals"))[0].n;
        const r = await call("POST", "/api/open-proposals", proposal({ email: `refused-${i}@example.test` }));
        expect(r, JSON.stringify(answer)).toMatchObject({ status: 503, body: { error: OPEN_WORDS.notSent } });
        expect((await q("SELECT COUNT(*) AS n FROM open_role_proposals"))[0].n).toBe(before);
      }
      expect(state.admins).toEqual([]);
      // CONTROL: the village's own mail not being set up is a passing fault, and the application is kept.
      state.answer = { status: "skipped", messageId: null, reason: "no_api_key" };
      const kept = await call("POST", "/api/open-proposals", proposal({ email: "not-set-up@example.test" }));
      expect(kept.body).toMatchObject({ sent: true, kept: true });
    });

    /** What the tidy job's retry is handed: this suite's fake mail door. */
    const retryDeps = () => ({
      getPool: () => pool,
      postEmail: async (email: OutgoingEmail) => {
        state.sent.push(email);
        return state.answer;
      },
      siteUrl: () => ORIGIN,
      projectName: () => "Test Village",
      escapeHtml,
    });

    it("a kept application is never deleted by the tidy job, is tried again every hour, and its later link clears the mark", async () => {
      state.answer = { status: "skipped", messageId: null, reason: "not_configured" };
      const r = await call("POST", "/api/open-proposals", proposal({ email: "later@example.test" }));
      expect(r.status).toBe(200);
      const id = state.sent[0].idempotencyKey.split(":")[1];

      // Days old, and the 48-hour sweep runs: it is kept.
      await q("UPDATE open_role_proposals SET created_at = ? WHERE id = ?", [new Date(Date.now() - 3 * 24 * 60 * 60_000), id]);
      await tidyOpenProposals(pool, new Date());
      expect((await readOpenProposal(pool, id))?.status).toBe("confirmed");

      // The email is still down: tried, still owed.
      state.sent.length = 0;
      expect(await retryOwedConfirmations(retryDeps(), new Date())).toMatchObject({ went: 0 });
      expect(state.sent.filter((m) => m.to.email === "later@example.test")).toHaveLength(1);
      expect((await readOpenProposal(pool, id))?.addressUnconfirmed?.owed).toBe(true);

      // It is back: the email goes, under a key of its own, saying we already have it.
      state.answer = { status: "sent", messageId: "m-3" };
      state.sent.length = 0;
      await retryOwedConfirmations(retryDeps(), new Date());
      const mail = state.sent.find((m) => m.to.email === "later@example.test") as OutgoingEmail;
      expect(mail.idempotencyKey).toMatch(new RegExp(`^open-proposal:${id}:confirm-again:`));
      expect(mail.text).toContain("We already have your application.");
      expect((await readOpenProposal(pool, id))?.addressUnconfirmed).toMatchObject({ owed: false, sentAt: expect.any(Date) });
      // Sent once: the next hour sends it nothing more.
      state.sent.length = 0;
      await retryOwedConfirmations(retryDeps(), new Date());
      expect(state.sent.filter((m) => m.to.email === "later@example.test")).toHaveLength(0);

      // A retry that went never exposes it to the sweep: still kept, still confirmed.
      await tidyOpenProposals(pool, new Date());
      expect((await readOpenProposal(pool, id))?.status).toBe("confirmed");

      // The address opens the later link: confirmed, the application was already in, and the mark goes.
      const ok = await call("POST", "/api/open-proposals/confirm", { token: tokenOf(mail) });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect(ok.body).toMatchObject({ confirmed: true, message: OPEN_WORDS.addressConfirmed, statusPath: null });
      expect(await readOpenProposal(pool, id)).toMatchObject({ status: "confirmed", addressUnconfirmed: null });
      // Once: the same link again is refused.
      expect((await call("POST", "/api/open-proposals/confirm", { token: tokenOf(mail) })).status).toBe(410);
    });

    it("a kept application's later link runs out after 48 hours, and the application stays kept", async () => {
      state.answer = { status: "failed", messageId: null };
      await call("POST", "/api/open-proposals", proposal({ email: "slow@example.test" }));
      const id = state.sent[0].idempotencyKey.split(":")[1];
      state.answer = { status: "sent", messageId: "m-4" };
      state.sent.length = 0;
      await retryOwedConfirmations(retryDeps(), new Date());
      const mail = state.sent.find((m) => m.to.email === "slow@example.test") as OutgoingEmail;
      state.clock = new Date(Date.now() + 49 * 60 * 60_000);
      expect((await call("POST", "/api/open-proposals/confirm", { token: tokenOf(mail) })).status).toBe(410);
      expect(await readOpenProposal(pool, id)).toMatchObject({ status: "confirmed", addressUnconfirmed: { owed: false } });
    });
  });

  describe("the gates on the way in", () => {
    it("the honeypot pretends it went and keeps nothing", async () => {
      const before = (await q("SELECT COUNT(*) AS n FROM open_role_proposals"))[0].n;
      expect((await call("POST", "/api/open-proposals", { ...proposal(), hp: "I am a bot" })).body).toEqual({ sent: true });
      expect((await q("SELECT COUNT(*) AS n FROM open_role_proposals"))[0].n).toBe(before);
      expect(state.sent).toHaveLength(0);
    });

    it("a cap per connection and a cap per address", async () => {
      state.limited = ["open-proposal:ip:"];
      const ip = await call("POST", "/api/open-proposals", proposal());
      expect(ip.status).toBe(429);
      expect(ip.body.error).toBe(OPEN_WORDS.tooMany);
      state.limited = ["open-proposal:email:"];
      const r = await call("POST", "/api/open-proposals", proposal());
      expect(r.status).toBe(429);
      expect(r.body.error).toBe(OPEN_WORDS.tooManyForAddress);
      expect(state.sent).toHaveLength(0);
    });

    it("B1: five refused bodies, then a valid one from the same connection, is accepted", async () => {
      state.counting = true;
      const ip = "198.51.100.77";
      for (const bad of [{ name: " " }, { email: "" }, { roles: [] }, { why: "" }, { roles: [{ roleId: "nope" }] }]) {
        const r = await call("POST", "/api/open-proposals", proposal(bad), ip);
        expect(r.status).toBe(400);
      }
      const ok = await call("POST", "/api/open-proposals", proposal({ email: "after-refusals@example.test" }), ip);
      expect(ok.status).toBe(200);
      expect(ok.body.sent).toBe(true);
      expect(state.sent).toHaveLength(1);
    });

    it("the 429 for a connection that really sent five says what happened and when to try again", async () => {
      state.counting = true;
      for (let i = 0; i < 5; i += 1) expect((await call("POST", "/api/open-proposals", proposal({ email: `five${i}@example.test` }), "198.51.100.78")).status).toBe(200);
      const r = await call("POST", "/api/open-proposals", proposal({ email: "six@example.test" }), "198.51.100.78");
      expect(r.status).toBe(429);
      expect(r.body.error).toBe(OPEN_WORDS.tooMany);
      expect(OPEN_WORDS.tooMany).toMatch(/five proposals/);
      expect(OPEN_WORDS.tooMany).toMatch(/in about an hour/);
    });

    it("a flood of refused tries is still stopped, by the generous bucket", async () => {
      state.counting = true;
      let refused429 = 0;
      for (let i = 0; i < 70; i += 1) if ((await call("POST", "/api/open-proposals", proposal({ why: "" }), "198.51.100.79")).status === 429) refused429 += 1;
      expect(refused429).toBe(10);
    });

    it("ATTACK: 100 proposals from one connection: 5 go, 95 are refused, and only 5 emails are sent", async () => {
      state.counting = true;
      const before = (await q("SELECT COUNT(*) AS n FROM open_role_proposals"))[0].n;
      const statuses: number[] = [];
      for (let i = 0; i < 100; i += 1) statuses.push((await call("POST", "/api/open-proposals", proposal({ email: `flood${i}@example.test` }), "198.51.100.7")).status);
      expect(statuses.filter((x) => x === 200)).toHaveLength(5);
      expect(statuses.filter((x) => x === 429)).toHaveLength(95);
      expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
      expect(state.sent).toHaveLength(5);
      expect((await q("SELECT COUNT(*) AS n FROM open_role_proposals"))[0].n).toBe(before + 5);
      // Another connection is not caught by this one's cap.
      expect((await call("POST", "/api/open-proposals", proposal({ email: "elsewhere@example.test" }), "198.51.100.8")).status).toBe(200);
    });

    it("ATTACK: one address from 20 connections: 3 go, 17 are refused, and that address gets 3 emails at most", async () => {
      state.counting = true;
      const statuses: number[] = [];
      for (let i = 0; i < 20; i += 1) statuses.push((await call("POST", "/api/open-proposals", proposal({ email: "Target@Example.test" }), `192.0.2.${i + 1}`)).status);
      expect(statuses.filter((x) => x === 200)).toHaveLength(3);
      expect(statuses.filter((x) => x === 429)).toHaveLength(17);
      // The cap is on the address as folded, so a change of case is the same address.
      expect((await call("POST", "/api/open-proposals", proposal({ email: "target@example.test" }), "192.0.2.99")).status).toBe(429);
      expect(state.sent.filter((m) => m.to.email.toLowerCase() === "target@example.test")).toHaveLength(3);
    });

    it("ATTACK: plus-addressing does not reset the cap on an address (red team, 9 Nov)", async () => {
      state.counting = true;
      const statuses: number[] = [];
      for (let i = 0; i < 6; i += 1) statuses.push((await call("POST", "/api/open-proposals", proposal({ email: `victim+${i}@example.test` }), `192.0.2.${120 + i}`)).status);
      expect(statuses).toEqual([200, 200, 200, 429, 429, 429]);
    });

    it("ATTACK: one IPv6 /64 is one connection for the cap", async () => {
      state.counting = true;
      const statuses: number[] = [];
      for (let i = 0; i < 7; i += 1) statuses.push((await call("POST", "/api/open-proposals", proposal({ email: `six${i}@example.test` }), `2001:db8:abcd:12::${(i + 1).toString(16)}`)).status);
      expect(statuses.filter((x) => x === 200)).toHaveLength(5);
      // Another /64 is another connection.
      expect((await call("POST", "/api/open-proposals", proposal({ email: "other64@example.test" }), "2001:db8:abcd:13::1")).status).toBe(200);
    });

    it("ATTACK: an overall hourly cap on confirmation email, whatever the connections and addresses", async () => {
      state.counting = true;
      let ok = 0;
      let refused = 0;
      for (let i = 0; i < OPEN_GLOBAL_HOURLY + 3; i += 1) {
        const r = await call("POST", "/api/open-proposals", proposal({ email: `crowd${i}@example.test` }), `198.18.${Math.floor(i / 200)}.${(i % 200) + 1}`);
        if (r.status === 200) ok += 1;
        else if (r.status === 429) refused += 1;
      }
      expect(ok).toBe(OPEN_GLOBAL_HOURLY);
      expect(refused).toBe(3);
      expect(state.sent).toHaveLength(OPEN_GLOBAL_HOURLY);
    });

    it("ATTACK: the sender cannot choose the greeting's words, only a name", async () => {
      // One application per role per address while it waits (shared/applicationAgain.ts): close this address's earlier ones first.
      await q("UPDATE open_role_proposals SET status = 'withdrawn', decided_at = NOW(3) WHERE email = ? AND status = 'confirmed'", ["rowan@example.test"]);
      const { mail } = await send({ name: "evil.example/login Smith" });
      expect(mail.text.startsWith("Hi,\n")).toBe(true);
      expect(mail.text).not.toContain("evil.example");
      const { mail: plain } = await send({ name: "Rowan Field", email: "plain@example.test" });
      expect(plain.text.startsWith("Hi Rowan,")).toBe(true);
    });

    it("takes several roles in one proposal, each keeping its own commitment and price ask (the lead, 17 Nov 2026)", async () => {
      await q("UPDATE open_role_proposals SET status = 'withdrawn', decided_at = NOW(3) WHERE email = ? AND status IN ('confirmed', 'unconfirmed')", ["two@example.test"]);
      const { id, mail } = await send({ email: "two@example.test", roles: [{ roleId: gate, note: "" }, { roleId: well, note: "", commitmentPct: 40, payAsk: { kind: "negotiate", why: "Let us talk." } }] });
      expect(mail.text).toContain("Gate Keeper");
      expect(mail.text).toContain("Well Keeper");
      const row = await readOpenProposal(pool, id);
      expect(row?.body.roles).toEqual([
        { roleId: gate, note: "" },
        { roleId: well, note: "", commitmentPct: 40, payAsk: { kind: "negotiate", why: "Let us talk." } },
      ]);
      expect(roleTermsOf(row!.body).map((r) => r.commitmentPct)).toEqual([null, 40]);
    });

    it.each([
      ["no name", { name: "  " }, "name", OPEN_WORDS.needName],
      ["no address", { email: "" }, "email", OPEN_WORDS.needEmail],
      ["two addresses", { email: "a@example.test, b@example.test" }, "email", OPEN_WORDS.badEmail],
      ["an address with no dot after the @", { email: "rowan@example" }, "email", OPEN_WORDS.badEmail],
      ["no role", { roles: [] }, "roles", OPEN_WORDS.needRole],
      // Several roles in one proposal (the lead, 17 Nov 2026): a role added after the first needs its own commitment.
      ["a second role with no commitment", { roles: [{ roleId: "op-role-gate" }, { roleId: "op-role-well" }] }, "roles.1", OPEN_WORDS.needRoleCommitment],
      ["four roles", { roles: [1, 2, 3, 4].map(() => ({ roleId: "x" })) }, "roles", OPEN_WORDS.tooManyRoles],
      ["an example role", { roles: [{ roleId: "op-role-example" }] }, "roles", OPEN_WORDS.unknownRole],
      ["a role in a dormant circle", { roles: [{ roleId: "op-role-dormant" }] }, "roles", OPEN_WORDS.unknownRole],
      ["the same role twice", { roles: [{ roleId: "op-role-gate" }, { roleId: "op-role-gate", commitmentPct: 50 }] }, "roles", OPEN_WORDS.sameRoleTwice],
      ["no why", { why: "" }, "why", OPEN_WORDS.needWhy],
      ["a why too long", { why: "x".repeat(1201) }, "why", OPEN_WORDS.tooLong("Why you", 1200)],
    ])("refuses %s, naming the field", async (_label, over, field, error) => {
      const r = await call("POST", "/api/open-proposals", proposal(over));
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ error, field });
      expect(state.sent).toHaveLength(0);
    });
  });

  describe("the tidy job (sheet 19i)", () => {
    it("closes a confirmed proposal nobody decided within 90 days, and takes its name and address off (red team, 9 Nov)", async () => {
      const { id, token } = await send({ email: "waiting@example.test" });
      expect((await call("POST", "/api/open-proposals/confirm", { token })).status).toBe(200);
      await q("UPDATE open_role_proposals SET confirmed_at = ? WHERE id = ?", [new Date(Date.now() - 91 * 24 * 60 * 60_000), id]);
      await tidyOpenProposals(pool, new Date());
      const row = await readOpenProposal(pool, id);
      expect(row).toMatchObject({ status: "withdrawn", name: null, email: null });
    });

    it("deletes what was never confirmed after 48 hours, and takes the name and address off what was declined or withdrawn after 90 days", async () => {
      const fresh = await send({ email: "fresh@example.test" });
      const old = await send({ email: "old@example.test" });
      await q("UPDATE open_role_proposals SET created_at = ? WHERE id = ?", [new Date(Date.now() - 49 * 60 * 60_000), old.id]);
      const confirmedOld = await send({ email: "kept@example.test" });
      await call("POST", "/api/open-proposals/confirm", { token: confirmedOld.token });
      await q("UPDATE open_role_proposals SET created_at = ? WHERE id = ?", [new Date(Date.now() - 49 * 60 * 60_000), confirmedOld.id]);
      const declined = await send({ email: "no@example.test" });
      const recent = await send({ email: "recent@example.test" });
      await q("UPDATE open_role_proposals SET status = 'declined', decided_at = ? WHERE id = ?", [new Date(Date.now() - 91 * 24 * 60 * 60_000), declined.id]);
      await q("UPDATE open_role_proposals SET status = 'withdrawn', decided_at = ? WHERE id = ?", [new Date(Date.now() - 10 * 24 * 60 * 60_000), recent.id]);

      const said = await tidyOpenProposals(pool, new Date());
      expect(said).toMatch(/^\d+ unconfirmed deleted, \d+ undecided closed, \d+ anonymised$/);
      expect(await readOpenProposal(pool, old.id)).toBeNull();
      expect((await readOpenProposal(pool, fresh.id))?.status).toBe("unconfirmed");
      // Confirmed is never deleted, however old.
      expect((await readOpenProposal(pool, confirmedOld.id))?.status).toBe("confirmed");
      expect(await readOpenProposal(pool, declined.id)).toMatchObject({ status: "declined", name: null, email: null });
      expect(await readOpenProposal(pool, recent.id)).toMatchObject({ status: "withdrawn", name: "Rowan Field", email: "recent@example.test" });
      // A second run finds nothing more to do.
      await tidyOpenProposals(pool, new Date());
      expect(await readOpenProposal(pool, declined.id)).toMatchObject({ name: null, email: null });
    });
  });

  describe("the applicant's own card (Rye, 9 Nov 2026)", () => {
    it("the form offers the season's open goals; a card is kept with each goal's words, and checked", async () => {
      const form = await call("GET", "/api/open-proposals/form");
      expect(form.body.goals).toEqual([{ id: "g-roots", text: "Roots in the ground" }]);
      const card = {
        roles: [{ roleId: gate, moves: [], firstMoon: [{ quest: "Oil the hinges", doneWhen: "the gate opens without a sound" }] }],
        serves: [{ goalId: "g-roots", how: "A gate that opens lets people in." }],
        commitmentPct: 50,
        agreed: { loveLetter: true, nda: true },
        terms: { answers: {} },
      };
      const { id } = await send({ card, email: "carded@example.test" });
      const row = await readOpenProposal(pool, id);
      expect(row?.body.card).toEqual({ ...card, hours: "", terms: { choice: "accept", note: "" }, serves: [{ goalId: "g-roots", how: "A gate that opens lets people in.", goal: "Roots in the ground" }] });

      const badGoal = await call("POST", "/api/open-proposals", proposal({ email: "badgoal@example.test", card: { ...card, serves: [{ goalId: "g-done", how: "x" }] } }));
      expect(badGoal.status).toBe(400);
      const noAgree = await call("POST", "/api/open-proposals", proposal({ email: "noagree@example.test", card: { ...card, agreed: { loveLetter: true, nda: false } } }));
      expect(noAgree).toMatchObject({ status: 400, body: { field: "agreed" } });
    });

    it("goals: each role card needs one to eight, and each is checked against the role's goals, the season's goals and the moon", async () => {
      const base = (firstMoon: unknown) => ({
        roles: [{ roleId: gate, moves: [], firstMoon }],
        serves: [{ goalId: "g-roots", how: "" }],
        commitmentPct: 50,
        agreed: { loveLetter: true, nda: true },
        terms: { answers: {} },
      });
      const post = (firstMoon: unknown, email: string) => call("POST", "/api/open-proposals", proposal({ email, card: base(firstMoon) }));
      const g = { quest: "Oil the hinges", doneWhen: "the gate opens" };
      expect(await post([], "none@example.test")).toMatchObject({ status: 400, body: { field: "card" } });
      expect((await post([{ quest: "No test", doneWhen: "" }], "nodone@example.test")).status).toBe(400);
      expect((await post(Array.from({ length: 9 }, () => g), "nine@example.test")).status).toBe(400);
      expect((await post([{ ...g, moves: "A goal the role never had" }], "moves@example.test")).status).toBe(400);
      expect((await post([{ ...g, serves: "g-unknown" }], "serves@example.test")).status).toBe(400);
      expect((await post([{ ...g, date: "2031-01-01" }], "far@example.test")).status).toBe(400);
      // CONTROL: eight goals, one naming a season goal and a day this moon, are taken and kept.
      const day = new Date().toISOString().slice(0, 10);
      const ok = await post([...Array.from({ length: 7 }, () => g), { ...g, serves: "g-roots", date: day }], "eight@example.test");
      expect(ok.status).toBe(200);
    });

    it("the eight settings: a role's written settings reach the form, each needs an answer, and the commitment is required", async () => {
      const offer = ({ v: 1, clocks: { commitmentPct: 100 }, words: { term: "We renew together each moon.", ending: "One moon's notice." } });
      await rewriteTermsOffer(pool, gate, offer);
      try {
        const form = await call("GET", "/api/open-proposals/form");
        expect(form.body.roles.find((x: any) => x.id === gate).terms).toEqual({ words: { term: "We renew together each moon.", ending: "One moon's notice." }, commitmentPct: 100 });
        const card = (terms: unknown, commitmentPct?: number) => ({
          roles: [{ roleId: gate, moves: [], firstMoon: [{ quest: "Oil the hinges", doneWhen: "the gate opens" }] }],
          serves: [{ goalId: "g-roots", how: "" }],
          ...(commitmentPct === undefined ? {} : { commitmentPct }),
          agreed: { loveLetter: true, nda: true },
          terms,
        });
        const a = (c: unknown, email: string) => call("POST", "/api/open-proposals", proposal({ email, card: c }));
        // Written settings left unanswered, and no commitment, are each refused.
        expect(await a(card({ answers: { term: { choice: "accept" } } }, 50), "one@example.test")).toMatchObject({ status: 400, body: { field: "terms" } });
        const all = { term: { choice: "accept" }, clocks: { choice: "talk", note: "Four days overlap" }, ending: { choice: "accept" } };
        expect(await a(card({ answers: all }), "two@example.test")).toMatchObject({ status: 400, body: { field: "terms" } });
        expect(await a(card({ answers: all }, 55), "three@example.test")).toMatchObject({ status: 400, body: { field: "terms" } });
        // Answered, with a commitment of 0 (a choice, not an absence): taken and kept with each answer.
        const { id } = await send({ card: card({ answers: all }, 0), email: "four@example.test" });
        const stored = (await readOpenProposal(pool, id))?.body.card;
        expect(stored).toMatchObject({ commitmentPct: 0, hours: "", terms: { choice: "talk", note: "Clocks: Four days overlap" } });
        expect(stored?.terms?.answers).toMatchObject({ clocks: { choice: "talk", note: "Four days overlap" } });
      } finally {
        await rewriteTermsOffer(pool, gate, null);
      }
    });

    it("a role that can be shared: the form offers its minimum; a commitment below it is refused, and the optional ask is kept (Rye, 14 Nov 2026)", async () => {
      await setPayShown("true");
      await pool.query("UPDATE org_roles SET commitment_min = 60 WHERE id = ?", [gate]); // module-review-ok: a test setting the column it asserts on
      // A listed price, so an amount ask has a cap to be read against (at 60% of $13,000: $7,800, capped at $9,360).
      await saveSections(pool, gate, { ...EMPTY_SECTIONS, payCeiling: { amount: 13000, currency: "USD", per: "month" } }, "test");
      try {
        const form = await call("GET", "/api/open-proposals/form");
        expect(form.body.roles.find((x: any) => x.id === gate).commitmentMin).toBe(60);
        const card = (commitmentPct: number) => ({
          roles: [{ roleId: gate, moves: [], firstMoon: [{ quest: "Oil the hinges", doneWhen: "the gate opens" }] }],
          serves: [{ goalId: "g-roots", how: "" }],
          commitmentPct,
          agreed: { loveLetter: true, nda: true },
          terms: { answers: {} },
        });
        const low = await call("POST", "/api/open-proposals", proposal({ email: "low@example.test", card: card(50), payAsk: { kind: "negotiate" } }));
        expect(low).toMatchObject({ status: 400, body: { field: "terms", error: "This role takes proposals from 60% to 100%. Choose 60% or more." } });
        const badAsk = await call("POST", "/api/open-proposals", proposal({ email: "badask@example.test", card: card(60), payAsk: { kind: "amount", monthly: "lots" } }));
        expect(badAsk).toMatchObject({ status: 400, body: { field: "payAsk" } });
        // CONTROL: at the minimum, with an ask, it is taken and the ask kept.
        const { id } = await send({ card: card(60), email: "atmin@example.test", payAsk: { kind: "amount", monthly: 6000 } });
        expect((await readOpenProposal(pool, id))?.body.payAsk).toEqual({ kind: "amount", monthly: 6000 });
      } finally {
        await saveSections(pool, gate, EMPTY_SECTIONS, "test");
        await setPayShown(null);
        await pool.query("UPDATE org_roles SET commitment_min = NULL WHERE id = ?", [gate]); // module-review-ok: a test restoring the column it set
      }
    });

    it("the 120% cap: an ask just over it at their commitment is refused in words, one at it is taken (Rye, 15 Nov 2026)", async () => {
      await setPayShown("true");
      await saveSections(pool, gate, { ...EMPTY_SECTIONS, payCeiling: { amount: 13000, currency: "USD", per: "month" } }, "test");
      try {
        const card = (commitmentPct: number) => ({
          roles: [{ roleId: gate, moves: [], firstMoon: [{ quest: "Oil the hinges", doneWhen: "the gate opens" }] }],
          serves: [{ goalId: "g-roots", how: "" }],
          commitmentPct,
          agreed: { loveLetter: true, nda: true },
          terms: { answers: {} },
        });
        const ask = (monthly: number, per = "month") => ({ kind: "amount", monthly, per });
        // At 50% the listed price is $6,500 and the cap $7,800.
        const over = await call("POST", "/api/open-proposals", proposal({ email: "over@example.test", card: card(50), payAsk: ask(7801) }));
        expect(over).toMatchObject({ status: 400, body: { field: "payAsk", error: "Proposals for this role go up to $7,800 at 50%, 120% of its listed price. Choose a price at or below that." } });
        // At 100%, $15,600.
        const overFull = await call("POST", "/api/open-proposals", proposal({ email: "overfull@example.test", card: card(100), payAsk: ask(15601) }));
        expect(overFull).toMatchObject({ status: 400, body: { field: "payAsk" } });
        // An ask in another period cannot be read against the cap: refused, never let through.
        const yearly = await call("POST", "/api/open-proposals", proposal({ email: "yearly@example.test", card: card(50), payAsk: ask(7000, "year") }));
        expect(yearly).toMatchObject({ status: 400, body: { field: "payAsk", error: "Write your price for each month, the way the role lists it." } });
        // An edited request (QA-1115 hostile edges): an absurd figure, negotiate with a figure, an unknown period, and a shape that is neither kind.
        expect(await call("POST", "/api/open-proposals", proposal({ email: "absurd@example.test", card: card(50), payAsk: ask(100_000_000) }))).toMatchObject({ status: 400, body: { field: "payAsk" } });
        expect(await call("POST", "/api/open-proposals", proposal({ email: "both@example.test", card: card(50), payAsk: { kind: "negotiate", monthly: 5000 } }))).toMatchObject({ status: 400, body: { field: "payAsk", error: "Choose a price or to negotiate on the first call, one of the two." } });
        expect(await call("POST", "/api/open-proposals", proposal({ email: "hourly@example.test", card: card(50), payAsk: { kind: "amount", monthly: 50, per: "hour" } }))).toMatchObject({ status: 400, body: { field: "payAsk" } });
        expect(await call("POST", "/api/open-proposals", proposal({ email: "shape@example.test", card: card(50), payAsk: [1, 2] }))).toMatchObject({ status: 400, body: { field: "payAsk" } });
        // CONTROL: at the cap, and negotiate, are taken.
        const { id } = await send({ card: card(50), email: "atcap@example.test", payAsk: ask(7800) });
        expect((await readOpenProposal(pool, id))?.body.payAsk).toEqual({ kind: "amount", monthly: 7800, per: "month" });
        await send({ card: card(100), email: "atcapfull@example.test", payAsk: ask(15600) });
      } finally {
        await saveSections(pool, gate, EMPTY_SECTIONS, "test");
        await setPayShown(null);
      }
      // A role that lists no price has no cap: an amount is refused in words, negotiate is taken.
      const card = {
        roles: [{ roleId: gate, moves: [], firstMoon: [{ quest: "Oil the hinges", doneWhen: "the gate opens" }] }],
        serves: [{ goalId: "g-roots", how: "" }],
        commitmentPct: 50,
        agreed: { loveLetter: true, nda: true },
        terms: { answers: {} },
      };
      expect(await call("POST", "/api/open-proposals", proposal({ email: "noprice@example.test", card, payAsk: { kind: "amount", monthly: 5000, per: "month" } }))).toMatchObject({ status: 400, body: { field: "payAsk", error: "This role lists no price yet, so choose to negotiate on the first call." } });
      await send({ card, email: "noprice-negotiate@example.test", payAsk: { kind: "negotiate" } });
    });

    it("the split (the lead, 17 Nov 2026): the form offers the card's shape; the proposal keeps the commitment, the village's offer and what they proposed", async () => {
      await setPayShown("true");
      const shape = [{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }, { label: "Credits", pct: 0 }];
      await saveSections(pool, gate, { ...EMPTY_SECTIONS, payShape: shape, payCeiling: { amount: 13000, currency: "USD", per: "month" } }, "test");
      try {
        const form = await call("GET", "/api/open-proposals/form");
        expect(form.body.roles.find((x: any) => x.id === gate).payShape).toEqual(shape);
        const card = {
          roles: [{ roleId: gate, moves: [], firstMoon: [{ quest: "Oil the hinges", doneWhen: "the gate opens" }] }],
          serves: [{ goalId: "g-roots", how: "" }],
          commitmentPct: 50,
          agreed: { loveLetter: true, nda: true },
          terms: { answers: {} },
        };
        // At 50% the suggested price is $6,500: amounts that do not add up to it, or labels off the shape, are refused.
        const off = await call("POST", "/api/open-proposals", proposal({ email: "split-off@example.test", card, paySplit: { shares: [{ label: "Cash", pct: 50, amount: 3000 }, { label: "Equity", pct: 50, amount: 3000 }, { label: "Credits", pct: 0, amount: 0 }] } }));
        expect(off).toMatchObject({ status: 400, body: { field: "paySplit" } });
        const wrong = await call("POST", "/api/open-proposals", proposal({ email: "split-wrong@example.test", card, paySplit: { shares: [{ label: "Gold", pct: 100 }] } }));
        expect(wrong).toMatchObject({ status: 400, body: { field: "paySplit" } });
        // CONTROL: a hand-changed split is kept beside the village's offer, worked here at the same commitment.
        const proposed = [{ label: "Cash", pct: 50, amount: 3250 }, { label: "Equity", pct: 40, amount: 2600 }, { label: "Credits", pct: 10, amount: 650 }];
        const { id } = await send({ card, email: "split@example.test", paySplit: { shares: proposed } });
        const kept = (await readOpenProposal(pool, id))?.body;
        expect(kept?.card?.commitmentPct).toBe(50);
        expect(kept?.paySplit).toEqual({
          commitmentPct: 50,
          offered: { total: 6500, shares: [{ label: "Cash", pct: 60, amount: 3900 }, { label: "Equity", pct: 40, amount: 2600 }, { label: "Credits", pct: 0, amount: 0 }] },
          proposed: { total: 6500, shares: proposed },
        });
        // Their own price: the split is read against it, and the offer stays at the suggested price.
        const own = await send({ card, email: "split-own@example.test", payAsk: { kind: "amount", monthly: 7000, per: "month" }, paySplit: { shares: [{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }, { label: "Credits", pct: 0 }] } });
        const ownKept = (await readOpenProposal(pool, own.id))?.body.paySplit;
        expect(ownKept?.proposed).toEqual({ total: 7000, shares: [{ label: "Cash", pct: 60, amount: 4200 }, { label: "Equity", pct: 40, amount: 2800 }, { label: "Credits", pct: 0, amount: 0 }] });
        expect(ownKept?.offered.total).toBe(6500);
      } finally {
        await saveSections(pool, gate, EMPTY_SECTIONS, "test");
        await setPayShown(null);
      }
    });

    it("pay hidden (org.show_pay_ranges off): the form carries no ceiling key for a visitor, and an amount ask names no figure; on, and for an admin, it is there", async () => {
      await saveSections(pool, gate, { ...EMPTY_SECTIONS, payCeiling: { amount: 13000, currency: "USD", per: "month" } }, "test");
      try {
        const roleIn = (body: any) => body.roles.find((x: any) => x.id === gate);
        // Off, signed out: the key is absent and the figure is nowhere in the payload.
        const hidden = await call("GET", "/api/open-proposals/form");
        expect("payCeiling" in roleIn(hidden.body)).toBe(false);
        expect(JSON.stringify(hidden.body)).not.toContain("13000");
        // An edited post asking an amount meets a role with no listed price: refused, and the cap is not named.
        const card = {
          roles: [{ roleId: gate, moves: [], firstMoon: [{ quest: "Oil the hinges", doneWhen: "the gate opens" }] }],
          serves: [{ goalId: "g-roots", how: "" }],
          commitmentPct: 50,
          agreed: { loveLetter: true, nda: true },
          terms: { answers: {} },
        };
        const probe = await call("POST", "/api/open-proposals", proposal({ email: "probe@example.test", card, payAsk: { kind: "amount", monthly: 7801, per: "month" } }));
        expect(probe).toMatchObject({ status: 400, body: { field: "payAsk", error: "This role lists no price yet, so choose to negotiate on the first call." } });
        expect(JSON.stringify(probe.body)).not.toContain("7,800");
        // CONTROL: an admin reads it while it is off.
        state.viewer = ADMIN;
        expect(roleIn((await call("GET", "/api/open-proposals/form")).body).payCeiling).toEqual({ amount: 13000, currency: "USD", per: "month" });
        state.viewer = null;
        // CONTROL: on, everyone reads it.
        await setPayShown("true");
        expect(roleIn((await call("GET", "/api/open-proposals/form")).body).payCeiling).toEqual({ amount: 13000, currency: "USD", per: "month" });
      } finally {
        state.viewer = null;
        await saveSections(pool, gate, EMPTY_SECTIONS, "test");
        await setPayShown(null);
      }
    });

    it("a card's own choice beats the village switch on the form both ways (founding team, 16 Nov 2026)", async () => {
      const CEILING = { amount: 13000, currency: "USD" as const, per: "month" as const };
      const roleIn = (body: any) => body.roles.find((x: any) => x.id === gate);
      const card = {
        roles: [{ roleId: gate, moves: [], firstMoon: [{ quest: "Oil the hinges", doneWhen: "the gate opens" }] }],
        serves: [{ goalId: "g-roots", how: "" }],
        commitmentPct: 50,
        agreed: { loveLetter: true, nda: true },
        terms: { answers: {} },
      };
      try {
        // SHOW, with the village switch off: a visitor reads the figure, the choice itself is never sent, and an amount ask is read against the cap.
        await saveSections(pool, gate, { ...EMPTY_SECTIONS, payCeiling: CEILING, payVisibility: "show" }, "test");
        const shown = roleIn((await call("GET", "/api/open-proposals/form")).body);
        expect(shown.payCeiling).toEqual(CEILING);
        expect("payVisibility" in shown).toBe(false);
        const over = await call("POST", "/api/open-proposals", proposal({ email: "show-over@example.test", card, payAsk: { kind: "amount", monthly: 7801, per: "month" } }));
        expect(over.status).toBe(400);
        expect(over.body.field).toBe("payAsk");
        expect(over.body.error).not.toBe("This role lists no price yet, so choose to negotiate on the first call.");
        // HIDE, with the village switch on: nobody reads it on the form, an admin included, and an amount ask meets no listed price.
        await setPayShown("true");
        await saveSections(pool, gate, { ...EMPTY_SECTIONS, payCeiling: CEILING, payVisibility: "hide" }, "test");
        for (const viewer of [null, ADMIN]) {
          state.viewer = viewer;
          const body = (await call("GET", "/api/open-proposals/form")).body;
          expect("payCeiling" in roleIn(body)).toBe(false);
          expect(JSON.stringify(body)).not.toContain("13000");
        }
        state.viewer = null;
        const probe = await call("POST", "/api/open-proposals", proposal({ email: "hide-probe@example.test", card, payAsk: { kind: "amount", monthly: 5000, per: "month" } }));
        expect(probe).toMatchObject({ status: 400, body: { field: "payAsk", error: "This role lists no price yet, so choose to negotiate on the first call." } });
      } finally {
        state.viewer = null;
        await saveSections(pool, gate, EMPTY_SECTIONS, "test");
        await setPayShown(null);
      }
    });

    it("form v2: a card needs an aim; the 90-day tidy clears the time zone, usual times and earliest start", async () => {
      const card = {
        roles: [{ roleId: gate, moves: [], firstMoon: [{ quest: "Oil the hinges", doneWhen: "the gate opens" }] }],
        serves: [{ goalId: "g-roots", how: "" }],
        commitmentPct: 50,
        agreed: { loveLetter: true, nda: true },
        terms: { answers: {} },
        timeZone: "America/Costa_Rica",
        windows: ["weekday-mornings"],
        earliestStart: "2026-11-16",
      };
      const noAim = await call("POST", "/api/open-proposals", proposal({ email: "noaim@example.test", aim: "", card }));
      expect(noAim).toMatchObject({ status: 400, body: { field: "aim" } });
      const { id, token } = await send({ email: "practical@example.test", card });
      expect((await readOpenProposal(pool, id))?.body.card).toMatchObject({ timeZone: "America/Costa_Rica", windows: ["weekday-mornings"], earliestStart: "2026-11-16" });
      expect((await call("POST", "/api/open-proposals/confirm", { token })).status).toBe(200);
      await q("UPDATE open_role_proposals SET confirmed_at = ? WHERE id = ?", [new Date(Date.now() - 91 * 24 * 60 * 60_000), id]);
      await tidyOpenProposals(pool, new Date());
      const kept = (await readOpenProposal(pool, id))?.body.card;
      expect(kept?.timeZone).toBeUndefined();
      expect(kept?.windows).toBeUndefined();
      expect(kept?.earliestStart).toBeUndefined();
      expect(kept?.terms).toEqual({ choice: "accept", note: "" });
    });
  });

  describe("proposals for this moon (Rye, 9 Nov 2026)", () => {
    it("an admin switches public proposals to the moon; the form offers it, and a proposal carries its days and this season", async () => {
      // One application per role per address while it waits (shared/applicationAgain.ts): close this address's earlier ones first.
      await q("UPDATE open_role_proposals SET status = 'withdrawn', decided_at = NOW(3) WHERE email = ? AND status = 'confirmed'", ["rowan@example.test"]);
      state.viewer = ADMIN;
      const switched = await call("PUT", "/api/admin/open-proposals/settings", { term: "moon" });
      expect(switched.status).toBe(200);
      expect(switched.body).toMatchObject({ term: "moon", publicLink: true });
      expect((await call("PUT", "/api/admin/open-proposals/settings", { term: "decade" })).status).toBe(400);
      state.viewer = null;
      state.clock = new Date("2026-11-09T18:00:00Z");
      try {
        const form = await call("GET", "/api/open-proposals/form");
        expect(form.body).toMatchObject({ open: true, season: { id: "s-now" }, term: { kind: "moon", startsOn: "2026-11-09", endsOn: "2026-12-09" } });
        expect(form.body.roles.length).toBeGreaterThan(0);
        const { id, mail } = await send();
        expect(mail.text).toContain("in Test Village for this moon, from 9 November 2026 to 9 December 2026.");
        const row = await readOpenProposal(pool, id);
        expect(row?.targetSeasonId).toBe("s-now");
        expect(row?.body.term).toEqual({ kind: "moon", startsOn: "2026-11-09", endsOn: "2026-12-09" });
      } finally {
        state.clock = null;
        state.viewer = ADMIN;
        await call("PUT", "/api/admin/open-proposals/settings", { term: "season" });
        state.viewer = null;
      }
    });
  });

  describe("the desk", () => {
    it("asks the gate on intake.moderate for every desk door", async () => {
      state.viewer = MEMBER;
      expect((await call("GET", "/api/admin/open-proposals")).status).toBe(403);
      expect((await call("PUT", "/api/admin/open-proposals/settings", { publicLink: false })).status).toBe(403);
      expect((await call("POST", "/api/admin/open-proposals/links", { label: "x" })).status).toBe(403);
      expect((await call("POST", "/api/admin/open-proposals/links/opl-x/revoke")).status).toBe(403);
      state.viewer = null;
      expect((await call("GET", "/api/admin/open-proposals")).status).toBe(401);
    });

    it("the switch is on to start, a link needs a label, and its address is shown once", async () => {
      state.viewer = ADMIN;
      const desk = await call("GET", "/api/admin/open-proposals");
      expect(desk.body).toMatchObject({ publicLink: true, publicPath: "/propose-a-role" });
      expect((await call("PUT", "/api/admin/open-proposals/settings", { publicLink: "yes" })).status).toBe(400);
      expect((await call("POST", "/api/admin/open-proposals/links", { label: "  " })).status).toBe(400);
      const made = await call("POST", "/api/admin/open-proposals/links", { label: "Rick" });
      const listed = (await call("GET", "/api/admin/open-proposals")).body.links.find((l: any) => l.id === made.body.id);
      expect(listed).toMatchObject({ label: "Rick", on: true });
      expect(JSON.stringify(listed)).not.toContain(made.body.url.split("/propose-a-role/")[1]);
    });
  });
});
