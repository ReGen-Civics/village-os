/**
 * THE FULL-ACCESS SWITCH AND THE AGENT'S ACCEPT, over real HTTP and the scratch schema (the lead, 20 Nov 2026).
 *
 *   switch    off by default; a person names a role and an agent account is refused; turning it on or off is one
 *             admin-audience event naming who did it, and a notice to every live holder in the Anchor Circle
 *   seat      full access reaches only a person holding a live seat in that role now: an ended seat, a run-out
 *             term, an agent account and another role's holder all read as off
 *   accept    the agent's door refuses a call that did not come through the connector, a holder without full
 *             access, and a note that does not name the codes; with all three, the change runs through its route
 *             as the holder, recorded as the agent's with the note; a change whose route is in the floor is refused
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { usersRepo } from "../repos/users";
import { register as registerAccounts } from "./agentAccounts";
import { register as registerProposals } from "./proposedChanges";
import { fullAccessFor, readsOpenFor } from "../lib/agentFullAccess";

const configured = testDbConfigured();
if (!configured) console.warn("[agentFullAccess] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const LEAD = { id: "u-lead", name: "Fern Oak", email: "fern@example.test" };
const OTHER = { id: "u-other", name: "Sam Field", email: "sam@example.test" };
const ANCHOR = { id: "u-anchor", name: "Ivy Stone", email: "ivy@example.test" };
const AGENT = { id: "u-agent", name: "Helper Agent", email: "agent@example.test" };

describe.skipIf(!configured)("the full-access switch, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let target: http.Server;
  let base = "";
  let targetPort = 0;
  const notices: Array<{ userId: string; title: string; dedupeKey: string }> = [];
  const hits: Array<{ method: string; path: string; auth: string }> = [];
  const content: Record<string, any> = { "page-home": { hero: { headline: "Welcome home" } } };

  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 8 });
    const users = usersRepo(pool);
    for (const p of [LEAD, OTHER, ANCHOR, AGENT]) await users.add({ id: p.id, name: p.name, email: p.email, passwordHash: "x", paths: [] } as any);
    await q("UPDATE users SET is_agent = 1 WHERE id = ?", [AGENT.id]);
    await q("INSERT INTO org_roles (id, circle_id, name) VALUES ('r-ops', 'c-ops', 'Operations Lead Steward'), ('r-anchor', 'c-anchor', 'Anchor Keeper'), ('r-other', 'c-ops', 'Gardener')");
    await q("INSERT INTO org_roles (id, circle_id, name, is_example) VALUES ('r-example', 'c-ops', 'Example role', 1)");
    await q("INSERT INTO org_role_assignments (id, org_role_id, holder_kind, user_id, holder_key) VALUES ('a-anchor', 'r-anchor', 'member', ?, ?), ('a-other', 'r-other', 'member', ?, ?)", [ANCHOR.id, ANCHOR.id, OTHER.id, OTHER.id]);

    // The target routes a change is accepted through, recording who called.
    const fake = express();
    fake.use(express.json());
    fake.use((req, res) => {
      hits.push({ method: req.method, path: req.path, auth: String(req.headers.authorization ?? "") });
      if (req.method === "PUT" && req.path.startsWith("/api/admin/content/")) content[req.path.split("/").pop()!] = req.body;
      res.json({ success: true });
    });
    target = http.createServer(fake);
    await new Promise<void>((resolve) => target.listen(0, "127.0.0.1", resolve));
    targetPort = (target.address() as { port: number }).port;

    const authedUser = async (req: any) => {
      const who = String(req.headers.authorization ?? "").replace("Bearer ", "");
      return who ? await usersRepo(pool).byId(who) : null;
    };
    const isAdmin = async (req: any) => [LEAD.id, OTHER.id, AGENT.id].includes(String((await authedUser(req))?.id ?? ""));
    const app = express();
    app.use(express.json());
    registerAccounts(app, {
      authedUser,
      getPool: () => pool,
      isAdmin,
      notify: async (n: any) => {
        notices.push({ userId: n.userId, title: n.title, dedupeKey: n.dedupeKey });
        return { inserted: true } as any;
      },
      circlesRepo: { all: () => [{ id: "c-anchor", name: "Anchor Circle", isAnchor: true }, { id: "c-ops", name: "Operations", parentCircleId: "c-anchor" }] } as any,
    } as any);
    registerProposals(app, {
      authedUser,
      getPool: () => pool,
      isAdmin,
      overLimit: async () => false,
      members: usersRepo(pool),
      contentRepo: { get: () => content } as any,
      faqsRepo: { get: () => ({}) } as any,
      seasonState: () => ({ current: null, seasons: [], timezone: "UTC" }),
      liveHoldersOf: async () => [],
      port: () => targetPort,
      clientIp: () => "203.0.113.9",
    } as any);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await new Promise<void>((resolve) => target?.close(() => resolve()));
    await pool?.end();
    await db?.drop();
  });

  beforeEach(async () => {
    notices.length = 0;
    hits.length = 0;
    await q("DELETE FROM app_config WHERE config_key = 'agent-full-access'");
    await q("DELETE FROM org_role_assignments WHERE org_role_id = 'r-ops'");
    await q("DELETE FROM proposed_changes");
    await q("DELETE FROM proposed_change_batches");
  });

  const call = async (method: string, path: string, body?: unknown, as: string | null = LEAD.id, extra: Record<string, string> = {}) => {
    const res = await fetch(`${base}${path}`, { // module-review-ok: a test calling its own local server, never an outside host
      method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(as ? { authorization: `Bearer ${as}` } : {}), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as any };
  };
  const seatLead = (extra = "") => q(`INSERT INTO org_role_assignments (id, org_role_id, holder_kind, user_id, holder_key${extra ? ", term_ends_at" : ""}) VALUES ('a-lead', 'r-ops', 'member', ?, ?${extra ? ", ?" : ""})`, extra ? [LEAD.id, LEAD.id, extra] : [LEAD.id, LEAD.id]);

  it("is off by default, and an agent account may not set it", async () => {
    const r = await call("GET", "/api/admin/agent-accounts/full-access");
    expect(r.body).toMatchObject({ on: false, roleId: null });
    expect(r.body.roles.map((x: any) => x.id).sort()).toEqual(["r-anchor", "r-ops", "r-other"]);
    const agent = await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: "r-ops" }, AGENT.id);
    expect(agent.status).toBe(403);
    expect((await call("GET", "/api/admin/agent-accounts/full-access")).body.on).toBe(false);
    expect((await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: "r-example" })).status).toBe(409);
    expect((await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: "r-none" })).status).toBe(404);
  });

  it("records who turned it on and off, audience admin, and tells the Anchor Circle each time", async () => {
    const on = await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: "r-ops" });
    expect(on.body).toMatchObject({ on: true, roleId: "r-ops", anchorNotified: 1 });
    expect(notices).toEqual([expect.objectContaining({ userId: ANCHOR.id, title: "Full access is on for the agent of whoever holds Operations Lead Steward" })]);
    const read = (await call("GET", "/api/admin/agent-accounts/full-access")).body;
    expect(read).toMatchObject({ on: true, roleId: "r-ops", roleName: "Operations Lead Steward", setBy: "Fern Oak" });
    const off = await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: null });
    expect(off.body).toMatchObject({ on: false, anchorNotified: 1 });
    expect(notices[1]).toMatchObject({ userId: ANCHOR.id, title: "Full access is off for the agent of Operations Lead Steward" });
    const events = await q("SELECT text, actor_user_id, audience FROM health_events WHERE entity_ref = 'agent-full-access' ORDER BY at");
    expect(events.map((e) => [e.actor_user_id, e.audience])).toEqual([[LEAD.id, "admin"], [LEAD.id, "admin"]]);
    expect(events[0].text).toContain("turned on full access");
    expect(events[1].text).toContain("turned off full access");
  });

  it("reaches only a person in a live seat of the named role, now", async () => {
    expect(await fullAccessFor(pool, LEAD.id)).toBe(false); // off
    await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: "r-ops" });
    expect(await fullAccessFor(pool, LEAD.id)).toBe(false); // no seat
    await seatLead();
    expect(await fullAccessFor(pool, LEAD.id)).toBe(true);
    expect(await fullAccessFor(pool, OTHER.id)).toBe(false); // another role's holder
    expect(await fullAccessFor(pool, AGENT.id)).toBe(false); // an agent account
    await q("UPDATE org_role_assignments SET ended_at = NOW() WHERE id = 'a-lead'");
    expect(await fullAccessFor(pool, LEAD.id)).toBe(false); // the seat changed hands
    await q("DELETE FROM org_role_assignments WHERE id = 'a-lead'");
    await seatLead("2020-01-01 00:00:00");
    expect(await fullAccessFor(pool, LEAD.id)).toBe(false); // the term ran out
  });

  describe("reads open, beside the switch (the lead, 25 Nov 2026)", () => {
    it("is closed by default, a person opens it, an agent account may not, and naming a role keeps it", async () => {
      expect((await call("GET", "/api/admin/agent-accounts/full-access")).body).toMatchObject({ readsOpen: false });
      expect((await call("PUT", "/api/admin/agent-accounts/full-access/reads-open", { on: true }, AGENT.id)).status).toBe(403);
      expect((await call("PUT", "/api/admin/agent-accounts/full-access/reads-open", { on: "yes" })).status).toBe(400);
      await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: "r-ops" });
      const on = await call("PUT", "/api/admin/agent-accounts/full-access/reads-open", { on: true });
      expect(on.body).toMatchObject({ readsOpen: true, anchorNotified: 1 });
      expect(notices.at(-1)).toMatchObject({ userId: ANCHOR.id, title: "Reads are open for the agent of whoever holds Operations Lead Steward" });
      const read = (await call("GET", "/api/admin/agent-accounts/full-access")).body;
      expect(read).toMatchObject({ readsOpen: true, readsSetBy: "Fern Oak" });
      expect(read.readsKept.length).toBe(8);
      // Changing the role is one act, and reads open is another: it stays as a person left it.
      await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: "r-other" });
      expect((await call("GET", "/api/admin/agent-accounts/full-access")).body).toMatchObject({ roleId: "r-other", readsOpen: true });
      const [ev] = await q("SELECT text, actor_user_id, audience FROM health_events WHERE entity_ref = 'agent-full-access' AND text LIKE 'opened reads%' ORDER BY at DESC LIMIT 1");
      expect(ev).toMatchObject({ actor_user_id: LEAD.id, audience: "admin" });
    });

    it("reaches only the seat's agent, and only while full access is theirs", async () => {
      await call("PUT", "/api/admin/agent-accounts/full-access/reads-open", { on: true });
      expect(await readsOpenFor(pool, LEAD.id)).toBe(false); // no role named
      await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: "r-ops" });
      expect(await readsOpenFor(pool, LEAD.id)).toBe(false); // no seat
      await seatLead();
      expect(await readsOpenFor(pool, LEAD.id)).toBe(true);
      expect(await readsOpenFor(pool, OTHER.id)).toBe(false);
      expect(await readsOpenFor(pool, AGENT.id)).toBe(false);
      await call("PUT", "/api/admin/agent-accounts/full-access/reads-open", { on: false });
      expect(await readsOpenFor(pool, LEAD.id)).toBe(false);
    });
  });

  describe("the agent's accept door", () => {
    const PAGE = { kind: "page_content", target: { section: "page-home" }, body: { hero: { headline: "A home on the land" } }, summary: "Reword the homepage headline." };
    const CONNECTOR = { "x-village-connector": "1" };
    const fileOne = async () => {
      const r = await call("POST", "/api/admin/proposals", { batch: "Words", items: [PAGE] }, LEAD.id, CONNECTOR);
      expect(r.status).toBe(200);
      return { id: r.body.ids[0] as string, code: r.body.codes[0].code as string, batchCode: r.body.batchCode as string };
    };

    it("refuses a call that did not come through the connector, and a holder without full access", async () => {
      const c = await fileOne();
      const body = { action: "accept", ids: [c.id], approvedBy: "The lead", approvalNote: `Yes, accept ${c.batchCode}.` };
      expect((await call("POST", "/api/admin/proposals/accept-as-holder", body)).status).toBe(403);
      const off = await call("POST", "/api/admin/proposals/accept-as-holder", body, LEAD.id, CONNECTOR);
      expect(off).toMatchObject({ status: 403, body: { error: "full_access_off" } });
      await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: "r-ops" });
      // On, but this holder sits in another role.
      expect((await call("POST", "/api/admin/proposals/accept-as-holder", body, OTHER.id, CONNECTOR)).status).toBe(403);
      expect(hits).toEqual([]);
    });

    it("refuses a note that does not name the codes, then accepts as the holder, recorded as the agent's with the note", async () => {
      await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: "r-ops" });
      await seatLead();
      const c = await fileOne();
      const vague = await call("POST", "/api/admin/proposals/accept-as-holder", { action: "accept", ids: [c.id], approvedBy: "The lead", approvalNote: "Yes, go ahead." }, LEAD.id, CONNECTOR);
      expect(vague).toMatchObject({ status: 400, body: { error: "approval_not_covering" } });
      expect(hits).toEqual([]);
      const note = `Yes, accept ${c.code}, the new headline.`;
      const r = await call("POST", "/api/admin/proposals/accept-as-holder", { action: "accept", ids: [c.id], approvedBy: "The lead", approvalNote: note }, LEAD.id, CONNECTOR);
      expect(r.status).toBe(200);
      expect(r.body.results).toEqual([expect.objectContaining({ id: c.id, ok: true, code: c.code })]);
      expect(hits.filter((h) => h.method === "PUT")).toEqual([{ method: "PUT", path: "/api/admin/content/page-home", auth: `Bearer ${LEAD.id}` }]);
      const [row] = await q("SELECT status, approved_by, approval_note FROM proposed_changes WHERE id = ?", [c.id]);
      expect(row).toMatchObject({ status: "accepted", approved_by: "The lead", approval_note: note });
      const [ev] = await q("SELECT text, actor_kind, audience FROM health_events WHERE kind = 'proposed_change' AND entity_ref = ? ORDER BY at DESC LIMIT 1", [c.id]);
      expect(ev).toMatchObject({ actor_kind: "agent", audience: "admin" });
      expect(ev.text).toContain("agent with full access");
      expect(ev.text).toContain(note);
    });

    it("discards on the approval, and refuses a change whose route is in the floor", async () => {
      await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: "r-ops" });
      await seatLead();
      const c = await fileOne();
      // A change aimed at a money route, as an older proposal or a hand-written row might be.
      await q("UPDATE proposed_changes SET route_method = 'POST', route_path = '/api/admin/tokens/seed/mint' WHERE id = ?", [c.id]);
      const floor = await call("POST", "/api/admin/proposals/accept-as-holder", { action: "accept", ids: [c.id], approvedBy: "The lead", approvalNote: `Accept ${c.code}` }, LEAD.id, CONNECTOR);
      expect(floor.body.results[0]).toMatchObject({ ok: false });
      expect(floor.body.results[0].error).toContain("A person accepts this one");
      expect(hits).toEqual([]);
      const d = await fileOne();
      const gone = await call("POST", "/api/admin/proposals/accept-as-holder", { action: "discard", ids: [d.id], approvedBy: "The lead", approvalNote: `Put aside ${d.batchCode}` }, LEAD.id, CONNECTOR);
      expect(gone.body.results).toEqual([expect.objectContaining({ id: d.id, ok: true })]);
      const [row] = await q("SELECT status FROM proposed_changes WHERE id = ?", [d.id]);
      expect(row.status).toBe("discarded");
    });

    it("never chooses between two options for one thing: a person does (conflicts block, the lead, 25 Nov 2026)", async () => {
      await call("PUT", "/api/admin/agent-accounts/full-access", { roleId: "r-ops" });
      await seatLead();
      const a = await fileOne();
      const b = await fileOne();
      const note = `Accept ${a.code} and ${b.code}.`;
      const r = await call("POST", "/api/admin/proposals/accept-as-holder", { action: "accept", ids: [a.id, b.id], approvedBy: "The lead", approvalNote: note }, LEAD.id, CONNECTOR);
      expect(r.status).toBe(200);
      expect(r.body.results.map((x: any) => [x.id, x.ok, x.code])).toEqual([[a.id, false, a.code], [b.id, false, b.code]]);
      expect(r.body.results[0].error).toContain("A person chooses one on the review page");
      expect(hits.filter((h) => h.method === "PUT"), "no option reached the page").toEqual([]);
      const rows = await q("SELECT status FROM proposed_changes WHERE id IN (?, ?)", [a.id, b.id]);
      expect(rows.map((x: any) => x.status)).toEqual(["proposed", "proposed"]);
    });
  });
});
