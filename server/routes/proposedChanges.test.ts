/**
 * PROPOSED CHANGES, over real HTTP and the scratch schema.
 *
 *   - a never-proposable change and a broken one are refused at proposal time, with a reason, and nothing is filed
 *   - accept runs each change through its target route AS THE PERSON; one that fails leaves the others landed
 *   - a missing capability at accept is the route's own refusal, shown on the change, which can be fixed and accepted again
 *   - an edited text is accepted exactly as edited, and the lesson records the difference
 *   - drafts save on the server; the connector and an agent account cannot accept
 *   - a proposed new gathering with no status lands on the calendar, filed before that rule or after it
 *   - a change that throws on its way to its route is recorded as failed with its reason, and the rest still run
 *   - an accept keeps what was live just before it, and "propose putting it back" files a new proposal carrying it,
 *     applying nothing; kinds that are never put back keep nothing and say why
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { usersRepo } from "../repos/users";
import { register } from "./proposedChanges";
import { CCOS_WORDS_REFUSAL, HANDOVER_WORDS_REFUSAL } from "../../shared/roleConsentWords";

const configured = testDbConfigured();
if (!configured) console.warn("[proposedChanges] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

const ADMIN = { id: "u-admin", name: "Fern Oak", email: "fern@example.test" };
const AGENT = { id: "u-agent", name: "Helper Agent", email: "agent@example.test" };
const STRANGER = { id: "u-str", name: "Sam Field", email: "sam@example.test" };

describe.skipIf(!configured)("proposed changes, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let server: http.Server;
  let target: http.Server;
  let base = "";
  let targetPort = 0;
  const content: Record<string, any> = { "page-home": { hero: { headline: "Welcome home", badge: "Open" } } };
  const faqs: Record<string, any[]> = { steward: [{ id: "ste-1", question: "Who decides?", answer: "The circle." }] };
  // Which routes say no, as the one capability gate would for a person without the power.
  const refuse = new Set<string>();
  // Which routes hang up without answering, as a loopback that times out or is cut would.
  const drop = new Set<string>();
  const commitThenDrop = new Set<string>();
  // Reads (GET) that hang up, as a loopback read that fails would; the writes still answer.
  const dropGet = new Set<string>();
  const hits: Array<{ method: string; path: string; auth: string; body: any }> = [];
  const slowTarget = { on: false };

  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 8 });
    const users = usersRepo(pool);
    for (const p of [ADMIN, AGENT, STRANGER]) await users.add({ id: p.id, name: p.name, email: p.email, passwordHash: "x", paths: [] } as any);
    await q("UPDATE users SET is_agent = 1 WHERE id = ?", [AGENT.id]);

    // A stand-in for the target routes: it records who called, and refuses where the person lacks the power.
    const fake = express();
    fake.use(express.json());
    fake.use(async (req, res) => {
      hits.push({ method: req.method, path: req.path, auth: String(req.headers.authorization ?? ""), body: req.body });
      if (drop.has(req.path)) return void req.socket.destroy();
      if (req.method === "GET" && dropGet.has(req.path)) return void req.socket.destroy();
      // The route does its work, then the answer is lost: a loopback that times out after its target committed.
      if (commitThenDrop.has(req.path)) {
        if (req.method === "POST" && req.path === "/api/admin/faqs/steward") faqs.steward.push({ id: `ste-${faqs.steward.length + 1}`, ...req.body });
        return void req.socket.destroy();
      }
      // A slow target, so accepts racing for one change are all in flight at once (the race case below).
      if (slowTarget.on) await new Promise((r) => setTimeout(r, 300));
      if (refuse.has(req.path)) return res.status(403).json({ error: "capability_required", message: "This needs the power to turn the village's dials." });
      if (req.method === "PUT" && req.path.startsWith("/api/admin/content/")) content[req.path.split("/").pop()!] = req.body;
      // The org draft path a role's terms wording is accepted through: a draft with an id, a preview that blocks nothing.
      if (req.method === "POST" && req.path === "/api/admin/org/drafts") return res.json({ success: true, id: "d-terms" });
      if (req.method === "GET" && req.path === "/api/admin/org/drafts/d-terms/preview") return res.json({ lines: [{ blocked: null }] });
      if (req.method === "POST" && req.path === "/api/admin/faqs/steward") faqs.steward.push({ id: `ste-${faqs.steward.length + 1}`, ...req.body });
      res.json({ success: true });
    });
    target = http.createServer(fake);
    await new Promise<void>((resolve) => target.listen(0, "127.0.0.1", resolve));
    targetPort = (target.address() as { port: number }).port;

    const authedUser = async (req: any) => {
      const who = String(req.headers.authorization ?? "").replace("Bearer ", "");
      return who ? await usersRepo(pool).byId(who) : null;
    };
    const app = express();
    app.use(express.json());
    app.put("/api/admin/brand", (_req, res) => res.json({ success: true })); // a route a `setting` may name
    app.post("/api/admin/events", (_req, res) => res.json({ success: true })); // the calendar's new-gathering route, which a `setting` may name
    app.post("/api/admin/org/roles", (_req, res) => res.json({ success: true })); // the new-role route, which a `setting` may name
    register(app, {
      authedUser,
      getPool: () => pool,
      isAdmin: async (req: any) => [ADMIN.id, AGENT.id].includes(String((await authedUser(req))?.id ?? "")),
      overLimit: async () => false,
      members: usersRepo(pool),
      contentRepo: { get: () => content } as any,
      faqsRepo: { get: () => faqs } as any,
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
    refuse.clear();
    drop.clear();
    commitThenDrop.clear();
    dropGet.clear();
    hits.length = 0;
    await q("DELETE FROM proposed_changes");
    await q("DELETE FROM proposed_change_batches");
  });

  const call = async (method: string, path: string, body?: unknown, as: string | null = ADMIN.id, extra: Record<string, string> = {}) => {
    const res = await fetch(`${base}${path}`, { // module-review-ok: a test calling its own local server, never an outside host
      method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(as ? { authorization: `Bearer ${as}` } : {}), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as any };
  };

  const PAGE = { kind: "page_content", target: { section: "page-home" }, body: { hero: { headline: "A home for families on the land" } }, summary: "Reword the homepage headline." };
  const FAQ = { kind: "faq_add", target: { pathway: "steward" }, body: { question: "How do I start?", answer: "Write to the circle." }, summary: "Add an FAQ on starting." };
  const DIAL = { kind: "variable", target: { key: "org.applicant_reply_days" }, body: { value: "10" }, summary: "Promise a reply within ten days." };

  it("a never-proposable change is refused with its reason, and nothing is filed", async () => {
    const r = await call("POST", "/api/admin/proposals", { batch: "Keys", items: [PAGE, { kind: "setting", target: { method: "PUT", path: "/api/admin/integrations/resend" }, body: { key: "x" }, summary: "Set the mail key." }] }, AGENT.id);
    expect(r.status).toBe(400);
    expect(r.body.refused).toEqual([expect.objectContaining({ index: 1, code: "never_secrets" })]);
    expect(await q("SELECT id FROM proposed_changes")).toHaveLength(0);
  });

  it("SHORT CODES (the lead, 20 Nov 2026): a batch is B-n in filing order and its changes B-n.m, given at filing, shown on the page and in the queue, and never reused", async () => {
    const one = await call("POST", "/api/admin/proposals", { batch: "First", items: [PAGE, FAQ] }, AGENT.id);
    expect(one.body.batchCode).toBe("B-1");
    expect(one.body.codes.map((c: any) => c.code)).toEqual(["B-1.1", "B-1.2"]);
    const two = await call("POST", "/api/admin/proposals", { batch: "Second", items: [DIAL] }, AGENT.id);
    expect(two.body.batchCode).toBe("B-2");
    expect(two.body.codes).toEqual([{ id: two.body.ids[0], code: "B-2.1" }]);
    // Adding to a batch already waiting carries on its numbering.
    const more = await call("POST", "/api/admin/proposals", { batchId: one.body.batchId, items: [DIAL] }, AGENT.id);
    expect(more.body.batchCode).toBe("B-1");
    expect(more.body.codes.map((c: any) => c.code)).toEqual(["B-1.3"]);

    const page = await call("GET", "/api/admin/proposals");
    expect(page.body.batches.map((b: any) => b.code)).toEqual(["B-1", "B-2"]);
    expect(page.body.changes.map((c: any) => [c.code, c.batchCode])).toEqual([["B-1.1", "B-1"], ["B-1.2", "B-1"], ["B-2.1", "B-2"], ["B-1.3", "B-1"]]);

    const queue = await call("GET", "/api/admin/proposals/queue", undefined, AGENT.id);
    expect(queue.body.batches.map((b: any) => [b.code, b.items.map((i: any) => i.code)])).toEqual([["B-1", ["B-1.1", "B-1.2", "B-1.3"]], ["B-2", ["B-2.1"]]]);

    // A discarded change keeps its code, and the next batch is never given a number already used.
    await call("POST", "/api/admin/proposals/discard", { ids: two.body.ids });
    const three = await call("POST", "/api/admin/proposals", { batch: "Third", items: [FAQ] }, AGENT.id);
    expect(three.body.batchCode).toBe("B-3");
    const decided = (await call("GET", "/api/admin/proposals")).body.decided;
    expect(decided).toEqual([expect.objectContaining({ code: "B-2.1", batchCode: "B-2" })]);
  });

  it("SHORT CODES: batches and changes filed before the codes existed are numbered by filing order, once, and a second pass changes nothing", async () => {
    const insertBatch = (id: string, at: string) => q("INSERT INTO proposed_change_batches (id, title, proposed_by, proposed_by_kind, created_at) VALUES (?,?,?,?,?)", [id, `Batch ${id}`, AGENT.id, "agent", at]);
    const insertChange = (id: string, batch: string, position: number) =>
      q("INSERT INTO proposed_changes (id, batch_id, position, kind, target_json, target_label, route_method, route_path, summary, body_json, proposed_by, proposed_by_kind) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", [id, batch, position, "page_content", "{}", "Home page", "PUT", "/api/admin/content/page-home", "Old one.", "{}", AGENT.id, "agent"]);
    // Filed out of id order on purpose: the code follows when it was filed.
    await insertBatch("pcb_zzz", "2026-11-01 10:00:00.000");
    await insertBatch("pcb_aaa", "2026-11-02 10:00:00.000");
    await insertChange("pc_z0", "pcb_zzz", 0);
    await insertChange("pc_z1", "pcb_zzz", 1);
    await insertChange("pc_a0", "pcb_aaa", 0);
    const { ensureCodes } = await import("../repos/proposedChanges");
    await ensureCodes(pool);
    const read = async () => ({
      batches: await q("SELECT id, code_no, code FROM proposed_change_batches ORDER BY code_no"),
      changes: await q("SELECT id, code FROM proposed_changes ORDER BY code"),
    });
    const first = await read();
    expect(first.batches.map((b: any) => [b.id, b.code])).toEqual([["pcb_zzz", "B-1"], ["pcb_aaa", "B-2"]]);
    expect(first.changes.map((c: any) => [c.id, c.code])).toEqual([["pc_a0", "B-2.1"], ["pc_z0", "B-1.1"], ["pc_z1", "B-1.2"]].sort((a, b) => (a[1] < b[1] ? -1 : 1)));
    await ensureCodes(pool);
    await Promise.all([ensureCodes(pool), ensureCodes(pool)]);
    expect(await read()).toEqual(first);
    // The next filing carries on from the backfill.
    const next = await call("POST", "/api/admin/proposals", { batch: "New", items: [FAQ] }, AGENT.id);
    expect(next.body.batchCode).toBe("B-3");
  });

  it("the target's validator refuses a broken proposal when it is proposed, naming the field", async () => {
    const r = await call("POST", "/api/admin/proposals", {
      batch: "Broken",
      items: [
        { ...DIAL, body: { value: "900" } },
        { ...PAGE, body: { hero: { nonsense: "x" } } },
        { kind: "setting", target: { method: "PUT", path: "/api/admin/no-such-route" }, body: {}, summary: "Change nothing real." },
      ],
    }, AGENT.id);
    expect(r.status).toBe(400);
    expect(r.body.refused.map((x: any) => [x.index, x.field])).toEqual([[0, "value"], [1, "body"], [2, "target.path"]]);
    expect(await q("SELECT id FROM proposed_changes")).toHaveLength(0);
  });

  it("FILING MIRRORS ACCEPT (20 Nov 2026): a new role carrying handover or CCOS words is refused when filed, in the route's own words", async () => {
    const role = (extra: Record<string, unknown>) => ({ kind: "setting", target: { method: "POST", path: "/api/admin/org/roles" }, body: { name: "Seed Keeper", ...extra }, summary: "A new role." });
    const r = await call("POST", "/api/admin/proposals", { batch: "Roles", items: [role({ bringMe: ["Questions"] }), role({ runbook: "Open the store." }), role({ existsWhile: "While seeds are kept" })] }, AGENT.id);
    expect(r.status).toBe(400);
    expect(r.body.refused.map((x: any) => [x.index, x.error])).toEqual([[0, HANDOVER_WORDS_REFUSAL], [1, HANDOVER_WORDS_REFUSAL], [2, CCOS_WORDS_REFUSAL]]);
    expect(await q("SELECT id FROM proposed_changes")).toHaveLength(0);
    // Control: the same role without those words is filed.
    const fine = await call("POST", "/api/admin/proposals", { batch: "Roles", items: [role({ aim: "Keep the seeds." })] }, AGENT.id);
    expect(fine.status).toBe(200);
  });

  it("an agent proposes a role card's last day to apply: a real date files and is sent on accept, a date that does not exist is refused by name (the lead, 23 Nov 2026)", async () => {
    await q("DELETE FROM org_roles WHERE id = 'rc-apply-by'");
    await q("INSERT INTO org_roles (id, name, aim, seats, active) VALUES ('rc-apply-by', 'Well Keeper', 'Keep the well.', 1, 1)");
    const item = (applyBy: string) => ({ kind: "role_card", target: { roleId: "rc-apply-by" }, body: { sections: { applyBy } }, summary: "Set the last day to apply." });
    const bad = await call("POST", "/api/admin/proposals", { batch: "Apply by", items: [item("2026-11-31")] }, AGENT.id);
    expect(bad.status).toBe(400);
    expect(bad.body.refused[0].field).toBe("sections.applyBy");
    const good = await call("POST", "/api/admin/proposals", { batch: "Apply by", items: [item("2026-11-30")] }, AGENT.id);
    expect(good.status).toBe(200);
    const id = good.body.ids[0];
    hits.length = 0;
    expect((await call("POST", "/api/admin/proposals/accept", { items: [{ id }] })).body.results).toEqual([{ id, ok: true }]);
    const sent = hits.find((h) => h.method === "POST" && h.path === "/api/org/role-edit/rc-apply-by");
    expect(sent?.body.sections.applyBy).toBe("2026-11-30");
  });

  it("an agent proposes a lead card's related roles: real role ids file and are sent on accept in order; an unknown id, the card's own role or a repeat is refused by name (the lead, 24 Nov 2026)", async () => {
    await q("DELETE FROM org_roles WHERE id IN ('rc-lead', 'rc-rel-a', 'rc-rel-b')");
    await q("INSERT INTO org_roles (id, name, aim, seats, active) VALUES ('rc-lead', 'Lead Water Steward', 'Lead the water.', 1, 1), ('rc-rel-a', 'Pond Keeper', 'Keep the pond.', 1, 1), ('rc-rel-b', 'Spring Keeper', 'Keep the spring.', 1, 1)");
    const item = (relatedRoles: string[]) => ({ kind: "role_card", target: { roleId: "rc-lead" }, body: { sections: { relatedRoles } }, summary: "Name the related roles." });
    for (const list of [["rc-rel-a", "rc-nowhere"], ["rc-lead"], ["rc-rel-a", "rc-rel-a"]]) {
      const bad = await call("POST", "/api/admin/proposals", { batch: "Related", items: [item(list)] }, AGENT.id);
      expect(bad.status, list.join(",")).toBe(400);
      expect(bad.body.refused[0].field).toBe("sections.relatedRoles");
    }
    const good = await call("POST", "/api/admin/proposals", { batch: "Related", items: [item(["rc-rel-b", "rc-rel-a"])] }, AGENT.id);
    expect(good.status).toBe(200);
    const id = good.body.ids[0];
    hits.length = 0;
    expect((await call("POST", "/api/admin/proposals/accept", { items: [{ id }] })).body.results).toEqual([{ id, ok: true }]);
    const sent = hits.find((h) => h.method === "POST" && h.path === "/api/org/role-edit/rc-lead");
    expect(sent?.body.sections.relatedRoles).toEqual(["rc-rel-b", "rc-rel-a"]);
  });

  it("FILING MIRRORS ACCEPT: words naming a split the card does not pay are refused when filed; its own split files (control)", async () => {
    await q("DELETE FROM org_roles WHERE id = 'rc-split'");
    await q("INSERT INTO org_roles (id, name, aim, seats, active) VALUES ('rc-split', 'Mill Keeper', 'Keep the mill.', 1, 1)");
    const item = (aim: string) => ({ kind: "role_card", target: { roleId: "rc-split" }, body: { words: { aim }, sections: { payShape: [{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }] } }, summary: "Say the split." });
    const off = await call("POST", "/api/admin/proposals", { batch: "Split", items: [item("Paid 70% cash and 30% tokens.")] }, AGENT.id);
    expect(off.status).toBe(400);
    expect(off.body.refused[0].field).toBe("aim");
    expect(off.body.refused[0].error).toContain("this card's split is 60% Cash, 40% Equity");
    const same = await call("POST", "/api/admin/proposals", { batch: "Split", items: [item("Paid 60% cash and 40% tokens.")] }, AGENT.id);
    expect(same.status).toBe(200);
  });

  it("FILING MIRRORS ACCEPT: listing a card that would fail the listing gate is refused when filed; coming soon needs only its aim and domain", async () => {
    await q("DELETE FROM org_roles WHERE id IN ('rc-list', 'rc-soon')");
    await q("INSERT INTO org_roles (id, name, aim, seats, active, listed) VALUES ('rc-list', 'Seed Keeper', 'Keep the seeds.', 1, 1, 0)");
    await q("INSERT INTO org_roles (id, name, aim, seats, active, listed) VALUES ('rc-soon', 'Oven Keeper', 'Keep the oven.', 1, 1, 0)");
    const list = (roleId: string, body: Record<string, unknown>) => ({ kind: "role_card", target: { roleId }, body, summary: "List it." });
    const open = await call("POST", "/api/admin/proposals", { batch: "List", items: [list("rc-list", { words: { domain: "The seed store." }, parameters: { listed: true } })] }, AGENT.id);
    expect(open.status).toBe(400);
    expect(open.body.refused[0].field).toBe("parameters.listed");
    expect(open.body.refused[0].error).toMatch(/^This card is not ready to list yet\. Still to write: What you can count on me for, Time commitment, Track, /);
    // Coming soon, set in the same change: aim and domain are enough.
    const soon = await call("POST", "/api/admin/proposals", { batch: "List", items: [list("rc-soon", { words: { domain: "The oven." }, parameters: { listed: true, comingSoon: true } })] }, AGENT.id);
    expect(soon.status).toBe(200);
    // Coming soon without a domain is refused, naming only that.
    const bare = await call("POST", "/api/admin/proposals", { batch: "List", items: [list("rc-soon", { parameters: { listed: true, comingSoon: true } })] }, AGENT.id);
    expect(bare.body.refused[0].error).toBe("This card is not ready to list yet. Still to write: What it looks after.");
  });

  it("files a batch, then a bulk accept lands two and leaves the refused one, which is fixed and accepted again", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "Phase A content", items: [PAGE, FAQ, DIAL] }, AGENT.id);
    expect(filed.status).toBe(200);
    expect(filed.body.applied).toBe(false);
    const [pageId, faqId, dialId] = filed.body.ids;
    expect(hits).toHaveLength(0); // proposing changed nothing live

    const page = await call("GET", "/api/admin/proposals");
    expect(page.body.changes.map((c: any) => c.targetLabel)).toEqual(["Home page", "Steward FAQ", "Days we promise to reply to a role proposal"]);
    expect(page.body.changes[0].live).toEqual({ hero: { headline: "Welcome home", badge: "Open" } });
    expect(page.body.changes[0].byKind).toBe("agent");

    refuse.add("/api/admin/variables/org.applicant_reply_days");
    const acc = await call("POST", "/api/admin/proposals/accept", { items: [{ id: pageId }, { id: faqId }, { id: dialId }] });
    expect(acc.status).toBe(200);
    expect(acc.body.results.map((x: any) => x.ok)).toEqual([true, true, false]);
    expect(acc.body.results[2].error).toContain("power");
    // Each call went through its own route as the person who pressed Accept, never as the agent.
    expect(hits.map((h) => `${h.method} ${h.path}`)).toEqual(["PUT /api/admin/content/page-home", "POST /api/admin/faqs/steward", "PUT /api/admin/variables/org.applicant_reply_days"]);
    expect(hits.every((h) => h.auth === `Bearer ${ADMIN.id}`)).toBe(true);
    // The page is merged onto what is live: the badge stays.
    expect(content["page-home"]).toEqual({ hero: { headline: "A home for families on the land", badge: "Open" } });
    const rows = await q("SELECT id, status, error_text, approved_by, approval_note FROM proposed_changes ORDER BY position");
    expect(rows.map((r) => r.status)).toEqual(["accepted", "accepted", "failed"]);
    expect(rows[0]).toMatchObject({ approved_by: "Fern Oak", approval_note: "accepted on the review page" });
    const events = await q("SELECT text FROM health_events WHERE kind = 'proposed_change' ORDER BY at");
    expect(events.some((e) => /accepted by Fern/.test(e.text))).toBe(true);

    // Still on the page with its reason; fixed (the power is now held) and accepted again.
    const again = await call("GET", "/api/admin/proposals");
    expect(again.body.changes.map((c: any) => [c.id, c.status])).toEqual([[dialId, "failed"]]);
    refuse.clear();
    const fixed = await call("POST", "/api/admin/proposals/accept", { items: [{ id: dialId, body: { value: "12" } }] });
    expect(fixed.body.results).toEqual([{ id: dialId, ok: true }]);
    expect(hits.at(-1)!.body).toEqual({ value: "12" });
  });

  it("an edited text is accepted exactly as edited, and the lesson records the difference", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "Words", items: [PAGE] }, AGENT.id);
    const id = filed.body.ids[0];
    const edited = { hero: { headline: "A home on the land, held together" } };
    expect((await call("PUT", `/api/admin/proposals/${id}/draft`, { body: edited })).status).toBe(200);
    // Leaving and coming back keeps the draft.
    expect((await call("GET", "/api/admin/proposals")).body.changes[0].draft).toEqual(edited);
    // Accepted without resending the body: the saved draft is what lands.
    const acc = await call("POST", "/api/admin/proposals/accept", { items: [{ id }] });
    expect(acc.body.results[0].ok).toBe(true);
    expect(hits[0].body.hero.headline).toBe("A home on the land, held together");
    const [row] = await q("SELECT accepted_json FROM proposed_changes WHERE id = ?", [id]);
    expect(JSON.parse(row.accepted_json)).toEqual(edited);
    const lessons = await call("GET", "/api/admin/proposals/lessons", undefined, AGENT.id);
    expect(lessons.body.groups).toEqual([
      { kind: "page_content", fields: [{ field: "hero.headline", changes: [expect.objectContaining({ proposed: "A home for families on the land", accepted: "A home on the land, held together", summary: PAGE.summary })] }] },
    ]);
  });

  it("the page reads where each change lands, the village's clock, who proposed a batch, and a history worth reading", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "Cards", items: [PAGE, FAQ, DIAL] }, AGENT.id);
    const [pageId, faqId, dialId] = filed.body.ids;
    const read = await call("GET", "/api/admin/proposals");
    expect(read.body.timezone).toBe("UTC");
    expect(read.body.batches[0]).toEqual(expect.objectContaining({ title: "Cards", by: "Helper Agent", byKind: "agent" }));
    const where = Object.fromEntries(read.body.changes.map((c: any) => [c.id, c.where]));
    expect(where[pageId]).toEqual({ label: "Home page", href: "/" });
    expect(where[faqId]).toEqual({ label: "Steward page", href: "/steward" });
    expect(where[dialId]).toEqual({ label: "Admin, Variables", href: "/admin?tab=variables" });

    // Accepted with an edit, and refused once by its route and then put aside.
    await call("POST", "/api/admin/proposals/accept", { items: [{ id: pageId, body: { hero: { headline: "A home on the land" } } }] });
    refuse.add("/api/admin/variables/org.applicant_reply_days");
    await call("POST", "/api/admin/proposals/accept", { items: [{ id: dialId }] });
    await call("POST", "/api/admin/proposals/discard", { ids: [dialId] });
    const after = await call("GET", "/api/admin/proposals");
    const page = after.body.decided.find((d: any) => d.id === pageId);
    expect(page).toEqual(
      expect.objectContaining({
        batchTitle: "Cards", kind: "page_content", status: "accepted", by: "Fern", proposedBy: "Helper Agent", proposedByKind: "agent", edited: 1,
        body: PAGE.body, accepted: { hero: { headline: "A home on the land" } }, where: { label: "Home page", href: "/" },
        route: { method: "PUT", path: "/api/admin/content/page-home" },
      }),
    );
    const dial = after.body.decided.find((d: any) => d.id === dialId);
    expect(dial).toEqual(expect.objectContaining({ status: "discarded", error: "This needs the power to turn the village's dials.", accepted: null }));
  });

  it("two accepts of the same change at once apply it once (audit, 15 Nov 2026)", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "One FAQ", items: [FAQ] }, AGENT.id);
    const id = filed.body.ids[0];
    const before = faqs.steward.length;
    slowTarget.on = true;
    const both = await Promise.all([1, 2, 3].map(() => call("POST", "/api/admin/proposals/accept", { items: [{ id }] }))).finally(() => (slowTarget.on = false));
    expect(both.map((r) => r.body.results[0].ok).filter(Boolean)).toHaveLength(1);
    expect(hits.filter((h) => h.path === "/api/admin/faqs/steward")).toHaveLength(1);
    expect(faqs.steward.length - before).toBe(1);
    const [row] = await q("SELECT status FROM proposed_changes WHERE id = ?", [id]);
    expect(row.status).toBe("accepted");
  });

  it("the dry run names the field and writes nothing", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "Dial", items: [DIAL] }, AGENT.id);
    const id = filed.body.ids[0];
    const r = await call("POST", "/api/admin/proposals/check", { items: [{ id, body: { value: "0" } }] });
    expect(r.body.results).toEqual([expect.objectContaining({ id, ok: false, field: "value" })]);
    expect(hits).toHaveLength(0);
    const [row] = await q("SELECT status FROM proposed_changes WHERE id = ?", [id]);
    expect(row.status).toBe("proposed");
  });

  it("the connector and an agent account cannot accept or discard; a stranger cannot open the page", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "Mixed", items: [FAQ] }, AGENT.id);
    const id = filed.body.ids[0];
    expect((await call("POST", "/api/admin/proposals/accept", { items: [{ id }] }, AGENT.id)).status).toBe(403);
    expect((await call("POST", "/api/admin/proposals/accept", { items: [{ id }] }, ADMIN.id, { "x-village-connector": "1" })).status).toBe(403);
    expect((await call("POST", "/api/admin/proposals/discard", { ids: [id] }, AGENT.id)).status).toBe(403);
    expect((await call("GET", "/api/admin/proposals", undefined, STRANGER.id)).status).toBe(403);
    expect(hits).toHaveLength(0);
    const disc = await call("POST", "/api/admin/proposals/discard", { ids: [id] });
    expect(disc.body.results[0].ok).toBe(true);
    expect((await call("GET", "/api/admin/proposals/count")).body.open).toBe(0);
  });

  it("a setting goes through its own route, and approval fields in a body are kept out of it", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "Brand", items: [{ kind: "setting", target: { method: "PUT", path: "/api/admin/brand" }, body: { tagline: "Living together", approvedBy: "x", approvalNote: "yes" }, summary: "A new tagline." }] }, AGENT.id);
    expect(filed.status).toBe(200);
    const [row] = await q("SELECT body_json FROM proposed_changes");
    expect(JSON.parse(row.body_json)).toEqual({ tagline: "Living together" });
  });

  const GATHERING = { kind: "setting", target: { method: "POST", path: "/api/admin/events" }, body: { title: "Potluck on the land", startsAt: "2026-12-05T23:00:00.000Z" }, summary: "Put the potluck on the calendar." };

  it("a proposed new gathering with no status is filed as scheduled, and accepting it puts it on the calendar", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "Calendar", items: [GATHERING, { ...GATHERING, body: { ...GATHERING.body, status: "draft" }, summary: "A draft potluck, on purpose." }] }, AGENT.id);
    expect(filed.status).toBe(200);
    const rows = await q("SELECT body_json FROM proposed_changes ORDER BY position");
    // The reviewer sees the status it will land with, and one the proposal named is kept as written.
    expect(rows.map((r) => JSON.parse(r.body_json).status)).toEqual(["scheduled", "draft"]);
    const acc = await call("POST", "/api/admin/proposals/accept", { items: filed.body.ids.map((id: string) => ({ id })) });
    expect(acc.body.results.map((x: any) => x.ok)).toEqual([true, true]);
    expect(hits.map((h) => [h.path, h.body.status])).toEqual([["/api/admin/events", "scheduled"], ["/api/admin/events", "draft"]]);
  });

  it("a gathering proposed before that rule, with no status, is still put on the calendar when it is accepted", async () => {
    // The shape already waiting in a village's table: filed by the old code, body with no status.
    await q("INSERT INTO proposed_change_batches (id, title, proposed_by, proposed_by_kind) VALUES ('pcb_old', 'Calendar', ?, 'agent')", [AGENT.id]);
    await q(
      "INSERT INTO proposed_changes (id, batch_id, position, kind, target_json, target_label, route_method, route_path, summary, body_json, proposed_by, proposed_by_kind) VALUES ('pc_old', 'pcb_old', 0, 'setting', ?, '/api/admin/events', 'POST', '/api/admin/events', ?, ?, ?, 'agent')",
      [JSON.stringify(GATHERING.target), GATHERING.summary, JSON.stringify(GATHERING.body), AGENT.id],
    );
    const acc = await call("POST", "/api/admin/proposals/accept", { items: [{ id: "pc_old" }] });
    expect(acc.body.results).toEqual([{ id: "pc_old", ok: true }]);
    expect(hits).toHaveLength(1);
    expect(hits[0].body).toMatchObject({ title: "Potluck on the land", status: "scheduled" });
  });

  it("a change whose apply throws is recorded as unknown with its reason, and the changes after it still run", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "Phase A content", items: [PAGE, FAQ] }, AGENT.id);
    const [pageId, faqId] = filed.body.ids;
    drop.add("/api/admin/content/page-home");
    const acc = await call("POST", "/api/admin/proposals/accept", { items: [{ id: pageId }, { id: faqId }] });
    expect(acc.status).toBe(200);
    expect(acc.body.results.map((x: any) => [x.id, x.ok])).toEqual([[pageId, false], [faqId, true]]);
    expect(acc.body.results[0].error).toContain("could not tell whether this change reached its page");
    const rows = await q("SELECT id, status, error_text FROM proposed_changes ORDER BY position");
    expect(rows.map((r) => r.status)).toEqual(["unknown", "accepted"]);
    expect(rows[0].error_text).toContain("could not tell whether this change reached its page");
    // It still waits on the review page, where a person can see it.
    expect((await call("GET", "/api/admin/proposals")).body.changes.map((c: any) => [c.id, c.status])).toEqual([[pageId, "unknown"]]);
  });

  it("a thrown apply that DID land on its route is never applied twice by one more click (audit, 15 Nov 2026)", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "One FAQ", items: [FAQ] }, AGENT.id);
    const id = filed.body.ids[0];
    const before = faqs.steward.length;
    // The route commits, then the connection drops before the answer: the loopback reads it as a throw.
    commitThenDrop.add("/api/admin/faqs/steward");
    const first = await call("POST", "/api/admin/proposals/accept", { items: [{ id }] });
    commitThenDrop.clear();
    expect(first.body.results[0].ok).toBe(false);
    expect(faqs.steward.length - before, "the first try landed").toBe(1);
    // One more click, as the page sends it: refused, and the route is not called again.
    const hitsBefore = hits.length;
    const again = await call("POST", "/api/admin/proposals/accept", { items: [{ id }] });
    expect(again.body.results[0]).toMatchObject({ ok: false, code: "check_target" });
    expect(hits.length).toBe(hitsBefore);
    expect(faqs.steward.length - before).toBe(1);
    // CONTROL: a person who checked and says so may try it again; putting it aside works too.
    const checked = await call("POST", "/api/admin/proposals/accept", { items: [{ id, checked: true }] });
    expect(checked.body.results[0].ok).toBe(true);
  });

  it("an unknown change can be put aside", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "Words", items: [PAGE] }, AGENT.id);
    const id = filed.body.ids[0];
    drop.add("/api/admin/content/page-home");
    await call("POST", "/api/admin/proposals/accept", { items: [{ id }] });
    const out = await call("POST", "/api/admin/proposals/discard", { ids: [id] });
    expect(out.body.results[0].ok).toBe(true);
  });

  // ── Conflicts: a waiting change drafted before a later accept (the lead, 17 Nov 2026) ─────────────────────

  it("two proposals on one role card: accepting the newer marks the older stale, on the page and again at its accept", async () => {
    await q("DELETE FROM org_roles WHERE id = 'rc-conflict'");
    await q("INSERT INTO org_roles (id, name, aim, seats, active) VALUES ('rc-conflict', 'Keeper of the Books', 'Keep the books.', 1, 1)");
    const aim = (words: string, summary: string) => ({ kind: "role_card", target: { roleId: "rc-conflict" }, body: { words: { aim: words } }, summary });
    const older = (await call("POST", "/api/admin/proposals", { batch: "First pass", items: [aim("Hold the money.", "Older aim")] }, AGENT.id)).body.ids[0];
    await new Promise((r) => setTimeout(r, 20));
    const newer = (await call("POST", "/api/admin/proposals", { batch: "Second pass", items: [aim("Tend the money.", "Newer aim")] }, AGENT.id)).body.ids[0];
    // Another field on the same card, proposed first: it never collides.
    const apart = (await call("POST", "/api/admin/proposals", { batch: "Words", items: [{ kind: "role_card", target: { roleId: "rc-conflict" }, body: { words: { domain: "The ledger." } }, summary: "Domain" }] }, AGENT.id)).body.ids[0];

    const before = await call("GET", "/api/admin/proposals");
    expect(before.body.changes.map((c: any) => [c.id, c.stale])).toEqual([[older, []], [newer, []], [apart, []]]);

    // The newer is accepted first. Nothing moved under it, so it carries no flag.
    expect((await call("POST", "/api/admin/proposals/accept", { items: [{ id: newer }] })).body.results).toEqual([{ id: newer, ok: true }]);

    // The older was drafted against the aim the newer has just replaced: the page says so, naming it.
    const after = await call("GET", "/api/admin/proposals");
    const byId = Object.fromEntries(after.body.changes.map((c: any) => [c.id, c]));
    expect(byId[older].stale).toEqual([{ id: newer, summary: "Newer aim", acceptedAt: expect.any(String) }]);
    expect(byId[apart].stale, "another field on the same card is not stale").toEqual([]);

    // Accepting it anyway is the person's call: it lands, and the answer carries the flag read at accept time.
    const acc = await call("POST", "/api/admin/proposals/accept", { items: [{ id: older }] });
    expect(acc.body.results).toEqual([{ id: older, ok: true, stale: [{ id: newer, summary: "Newer aim", acceptedAt: expect.any(String) }] }]);
    const [row] = await q("SELECT status FROM proposed_changes WHERE id = ?", [older]);
    expect(row.status, "a stale change is never rejected").toBe("accepted");
  });

  // ── Putting it back ────────────────────────────────────────────────────────

  it("an accept keeps what was live before, and putting it back files a proposal carrying exactly that, applying nothing", async () => {
    const wasLive = JSON.parse(JSON.stringify(content["page-home"]));
    const filed = await call("POST", "/api/admin/proposals", { batch: "Words", items: [PAGE] }, AGENT.id);
    const id = filed.body.ids[0];
    expect((await call("POST", "/api/admin/proposals/accept", { items: [{ id }] })).body.results[0].ok).toBe(true);
    const [row] = await q("SELECT before_json FROM proposed_changes WHERE id = ?", [id]);
    expect(JSON.parse(row.before_json)).toEqual(wasLive);

    const read = await call("GET", "/api/admin/proposals");
    expect(read.body.decided.find((d: any) => d.id === id).putBack).toEqual({ can: true });

    hits.length = 0;
    const back = await call("POST", `/api/admin/proposals/${id}/put-back`);
    expect(back.status).toBe(200);
    expect(back.body).toMatchObject({ success: true, applied: false, reverts: id });
    expect(hits, "proposing it back moved nothing live").toHaveLength(0);
    const [made] = await q("SELECT kind, target_json, body_json, status, reverts_id, proposed_by, proposed_by_kind FROM proposed_changes WHERE id = ?", [back.body.id]);
    expect(made).toMatchObject({ kind: "page_content", status: "proposed", reverts_id: id, proposed_by: ADMIN.id, proposed_by_kind: "person" });
    expect(JSON.parse(made.target_json)).toEqual(PAGE.target);
    // The fields the change sent, each with the value it held before.
    expect(JSON.parse(made.body_json)).toEqual({ hero: { headline: wasLive.hero.headline } });

    // It waits on the page marked as putting the original back, and the original offers no second one.
    const after = await call("GET", "/api/admin/proposals");
    expect(after.body.changes.map((c: any) => [c.id, c.reverts])).toEqual([[back.body.id, id]]);
    expect(after.body.decided.find((d: any) => d.id === id).putBack).toEqual({ can: false, reason: "already_waiting" });
    expect((await call("POST", `/api/admin/proposals/${id}/put-back`)).body.reason).toBe("already_waiting");

    // A person accepts it like any other, and the page reads as it did.
    expect((await call("POST", "/api/admin/proposals/accept", { items: [{ id: back.body.id }] })).body.results[0].ok).toBe(true);
    expect(content["page-home"]).toEqual(wasLive);
  });

  it("a variable put back carries the old live value exactly", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "Dial", items: [DIAL] }, AGENT.id);
    const id = filed.body.ids[0];
    expect((await call("POST", "/api/admin/proposals/accept", { items: [{ id }] })).body.results[0].ok).toBe(true);
    const [row] = await q("SELECT before_json FROM proposed_changes WHERE id = ?", [id]);
    const before = JSON.parse(row.before_json);
    expect(before).toEqual({ value: expect.anything() });
    expect(before.value).not.toBe("10");
    const back = await call("POST", `/api/admin/proposals/${id}/put-back`);
    expect(back.status).toBe(200);
    const [made] = await q("SELECT body_json FROM proposed_changes WHERE id = ?", [back.body.id]);
    expect(JSON.parse(made.body_json)).toEqual(before);
  });

  it("a read that fails keeps null and the accept still lands; there is then nothing to put back", async () => {
    const BRAND = { kind: "setting", target: { method: "PUT", path: "/api/admin/brand" }, body: { tagline: "Living together" }, summary: "A new tagline." };
    const filed = await call("POST", "/api/admin/proposals", { batch: "Brand", items: [BRAND] }, AGENT.id);
    const id = filed.body.ids[0];
    dropGet.add("/api/admin/brand");
    const acc = await call("POST", "/api/admin/proposals/accept", { items: [{ id }] });
    expect(acc.body.results).toEqual([{ id, ok: true }]);
    expect(hits.map((h) => `${h.method} ${h.path}`)).toEqual(["GET /api/admin/brand", "PUT /api/admin/brand"]);
    const [row] = await q("SELECT status, before_json FROM proposed_changes WHERE id = ?", [id]);
    expect(row).toEqual({ status: "accepted", before_json: "null" });
    const read = await call("GET", "/api/admin/proposals");
    expect(read.body.decided.find((d: any) => d.id === id).putBack).toEqual({ can: false, reason: "unread" });
    const back = await call("POST", `/api/admin/proposals/${id}/put-back`);
    expect(back.status).toBe(409);
    expect(await q("SELECT id FROM proposed_changes")).toHaveLength(1);
  });

  it("a new calendar event keeps nothing and is never put back; a change accepted before this release says so", async () => {
    const filed = await call("POST", "/api/admin/proposals", { batch: "Calendar", items: [GATHERING] }, AGENT.id);
    const id = filed.body.ids[0];
    expect((await call("POST", "/api/admin/proposals/accept", { items: [{ id }] })).body.results[0].ok).toBe(true);
    expect(hits.map((h) => h.method), "the calendar was never read").toEqual(["POST"]);
    const [row] = await q("SELECT before_json FROM proposed_changes WHERE id = ?", [id]);
    expect(row.before_json).toBeNull();
    const back = await call("POST", `/api/admin/proposals/${id}/put-back`);
    expect(back).toMatchObject({ status: 409, body: { reason: "made_new" } });

    // The shape every change accepted before 0400 has: accepted, nothing kept.
    await q(
      "INSERT INTO proposed_changes (id, batch_id, position, kind, target_json, target_label, route_method, route_path, summary, body_json, proposed_by, proposed_by_kind, status, decided_by, decided_at, accepted_json) VALUES ('pc_was', ?, 1, 'variable', ?, 'Dial', 'PUT', '/api/admin/variables/org.applicant_reply_days', 'Older change', ?, ?, 'agent', 'accepted', ?, CURRENT_TIMESTAMP(3), ?)",
      [filed.body.batchId, JSON.stringify(DIAL.target), JSON.stringify(DIAL.body), AGENT.id, ADMIN.id, JSON.stringify(DIAL.body)],
    );
    const read = await call("GET", "/api/admin/proposals");
    expect(read.body.decided.find((d: any) => d.id === "pc_was").putBack).toEqual({ can: false, reason: "not_kept" });
    expect((await call("POST", "/api/admin/proposals/pc_was/put-back")).body.reason).toBe("not_kept");
    expect((await call("POST", "/api/admin/proposals/pc_nope/put-back")).status).toBe(404);
  });

  // ── Agent powers (the lead, 19 Nov 2026) ──────────────────────────────────

  const CONNECTOR = { "x-village-connector": "1" };

  it("the village's words for things are proposable through the connector before they were ever saved, and land through the content route as the person", async () => {
    delete content["app-vocabulary"];
    const broken = await call("POST", "/api/admin/proposals", { batch: "Words", items: [{ kind: "vocabulary", target: {}, body: { notASlot: { one: "x" } }, summary: "A word that is not a slot." }] }, ADMIN.id, CONNECTOR);
    expect(broken.status).toBe(400);
    expect(broken.body.refused[0].error).toContain("not one of the words");
    const filed = await call("POST", "/api/admin/proposals", { batch: "Words", items: [{ kind: "vocabulary", target: {}, body: { contributionToken: { one: "village token", many: "village tokens" } }, summary: "Call the contribution token the village token." }] }, ADMIN.id, CONNECTOR);
    expect(filed.status, JSON.stringify(filed.body)).toBe(200);
    const page = await call("GET", "/api/admin/proposals");
    const c = page.body.changes[0];
    expect(c.kind).toBe("page_content");
    expect(c.target).toEqual({ section: "app-vocabulary" });
    expect(c.live.contributionToken).toEqual({ one: "contribution token", many: "contribution tokens" });
    expect(c.where.label).toContain("Make it yours");
    const acc = await call("POST", "/api/admin/proposals/accept", { items: [{ id: filed.body.ids[0] }] });
    expect(acc.body.accepted).toBe(1);
    expect(hits.find((h) => h.method === "PUT")).toEqual(expect.objectContaining({ path: "/api/admin/content/app-vocabulary", auth: `Bearer ${ADMIN.id}` }));
    expect(content["app-vocabulary"].contributionToken).toEqual({ one: "village token", many: "village tokens" });
    // The lessons read finds it by its alias.
    expect((await call("GET", "/api/admin/proposals/lessons?kind=vocabulary")).status).toBe(200);
  });

  it("the queue an agent reads carries batch, id, kind, sentence and state, and marks what it filed", async () => {
    const mine = await call("POST", "/api/admin/proposals", { batch: "Mine", items: [FAQ] }, AGENT.id);
    const theirs = await call("POST", "/api/admin/proposals", { batch: "Theirs", items: [DIAL] });
    const q = await call("GET", "/api/admin/proposals/queue", undefined, AGENT.id, CONNECTOR);
    expect(q.status).toBe(200);
    expect(q.body.waiting).toBe(2);
    const items = q.body.batches.flatMap((b: any) => b.items);
    expect(items.find((i: any) => i.id === mine.body.ids[0])).toEqual({ id: mine.body.ids[0], code: mine.body.codes[0].code, batchId: mine.body.batchId, kind: "faq_add", summary: FAQ.summary, state: "waiting", stuck: false, yours: true });
    expect(items.find((i: any) => i.id === theirs.body.ids[0]).yours).toBe(false);
    expect(JSON.stringify(q.body)).not.toMatch(/"body"|"live"|"route"|Write to the circle/);
    expect((await call("GET", "/api/admin/proposals/queue", undefined, STRANGER.id)).status).toBe(403);
  });

  it("an agent puts aside what it filed while it waits, and nothing that a person filed or that was decided", async () => {
    const mine = await call("POST", "/api/admin/proposals", { batch: "Mine", items: [FAQ, PAGE] }, ADMIN.id, CONNECTOR);
    const theirs = await call("POST", "/api/admin/proposals", { batch: "Theirs", items: [DIAL] });
    const [draftA, draftB] = mine.body.ids;
    await call("POST", "/api/admin/proposals/accept", { items: [{ id: draftB }] });
    const r = await call("POST", "/api/admin/proposals/discard-mine", { ids: [draftA, draftB, theirs.body.ids[0]] }, ADMIN.id, CONNECTOR);
    expect(r.status).toBe(200);
    expect(r.body.results.map((x: any) => x.ok)).toEqual([true, false, false]);
    expect(r.body.discarded).toBe(1);
    const rows = await q("SELECT id, status FROM proposed_changes ORDER BY id");
    expect(Object.fromEntries(rows.map((x: any) => [x.id, x.status]))).toEqual({ [draftA]: "discarded", [draftB]: "accepted", [theirs.body.ids[0]]: "proposed" });
    // Another agent account cannot put aside what this one filed.
    const other = await call("POST", "/api/admin/proposals", { batch: "Agent's", items: [FAQ] }, AGENT.id);
    expect((await call("POST", "/api/admin/proposals/discard-mine", { ids: other.body.ids }, ADMIN.id, CONNECTOR)).body.discarded).toBe(0);
    // Accepting is still refused to the connector.
    expect((await call("POST", "/api/admin/proposals/accept", { items: [{ id: theirs.body.ids[0] }] }, ADMIN.id, CONNECTOR)).status).toBe(403);
  });

  it("a role's terms read as words with no figure, are proposed as words only, and land through the draft path keeping the pay", async () => {
    const held = { v: 1, pay: { kind: "fixed", currency: "USD", amountMinor: 300000, per: "moon" }, words: { bonus: "Earned Equity under the moon-contract rule.", term: "We renew together each moon." } };
    await q("DELETE FROM org_roles WHERE id = 'r-terms'");
    await q("INSERT INTO org_roles (id, circle_id, name, seats, active, terms_offer) VALUES ('r-terms', 'c-hub', 'Lead Steward', 1, 1, ?)", [JSON.stringify(held)]);
    const read = await call("GET", "/api/admin/proposals/seat-terms?roleId=r-terms", undefined, ADMIN.id, CONNECTOR);
    expect(read.status).toBe(200);
    expect(read.body.roles[0]).toEqual(expect.objectContaining({ roleId: "r-terms", commitmentPct: null, setGroups: ["Pay"] }));
    expect(read.body.roles[0].words.bonus).toBe("Earned Equity under the moon-contract rule.");
    expect(JSON.stringify(read.body)).not.toMatch(/300000|USD|amountMinor/);
    expect((await call("GET", "/api/admin/proposals/seat-terms?roleId=nope")).status).toBe(404);

    const pay = await call("POST", "/api/admin/proposals", { batch: "Terms", items: [{ kind: "seat_terms", target: { roleId: "r-terms" }, body: { words: { bonus: "x" }, pay: { kind: "fixed", amountMinor: 1 } }, summary: "Raise the pay." }] }, ADMIN.id, CONNECTOR);
    expect(pay.status).toBe(400);
    expect(pay.body.refused[0].error).toContain("words");
    const filed = await call("POST", "/api/admin/proposals", { batch: "Terms", items: [{ kind: "seat_terms", target: { roleId: "r-terms" }, body: { words: { bonus: "Five to ten percent of the moon when its goals are met." } }, summary: "Reword the Lead Steward's bonus." }] }, ADMIN.id, CONNECTOR);
    expect(filed.status, JSON.stringify(filed.body)).toBe(200);
    const page = await call("GET", "/api/admin/proposals");
    expect(page.body.changes[0].live.words.bonus).toBe("Earned Equity under the moon-contract rule.");
    const acc = await call("POST", "/api/admin/proposals/accept", { items: [{ id: filed.body.ids[0] }] });
    expect(acc.body.accepted, JSON.stringify(acc.body)).toBe(1);
    expect(hits.map((h) => `${h.method} ${h.path}`)).toEqual(["POST /api/admin/org/drafts", "POST /api/admin/org/drafts/d-terms/changes", "GET /api/admin/org/drafts/d-terms/preview", "POST /api/admin/org/drafts/d-terms/publish"]);
    expect(hits.every((h) => h.auth === `Bearer ${ADMIN.id}`)).toBe(true);
    const offer = hits[1].body.payload.termsOffer;
    expect(offer.pay).toEqual(held.pay);
    expect(offer.words).toEqual({ term: "We renew together each moon.", bonus: "Five to ten percent of the moon when its goals are met." });
    await q("DELETE FROM org_roles WHERE id = 'r-terms'");
  });
});
