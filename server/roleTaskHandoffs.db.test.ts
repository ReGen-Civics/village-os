/**
 * HAND A TASK TO A ROLE, end to end on a real schema (shared/roleTaskHandoff.ts
 * is the contract). Every person and role here is invented.
 *
 * What is pinned:
 *
 *   - every door answers 401 to a stranger;
 *   - a new task for a role waits on every live holder, each hears once, the
 *     sender never; a member who holds nothing sees nothing;
 *   - only someone it waits on may answer, and the sender never, even when
 *     they hold the role too;
 *   - a suggested change keeps it waiting and the sender hears, once per change;
 *   - one holder accepting takes it for the role: a copy on their list, tagged
 *     to the role; a second holder is told someone answered first;
 *   - decline needs a reason, which the sender reads;
 *   - the sender's status: waiting, accepted, done, declined, withdrawn;
 *   - every notice is written once however often it is asked for (the real
 *     spine and its unique dedupe key);
 *   - nobody holding the role routes to the circle's lead role, and with no
 *     lead to the stewards, whose admin role queue still closes it;
 *   - the list's own redirect: to a role it lands here with its note; to a
 *     person it still lands directly, as before.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "./db/testDb";
import { insertNotification, type NotifyInput } from "./lib/notify";
import { noticeDone } from "./lib/roleTaskHandoffs";
import { insertTask, setStatus } from "./repos/memberTasks";
import { register } from "./routes/memberTaskBridge";
import { HANDOFF_REFUSALS, HANDOFFS_SENT_URL, HANDOFFS_URL, HANDOFFS_WAITING_URL, handoffDedupeKey } from "../shared/roleTaskHandoff";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function collect(): { app: any; handlers: Map<string, Handler> } {
  const handlers = new Map<string, Handler>();
  const record = (method: string) => (p: string, handler: Handler) => {
    handlers.set(`${method} ${p}`, handler);
  };
  return { app: { get: record("GET"), post: record("POST"), put: record("PUT"), patch: record("PATCH"), delete: record("DELETE"), use: () => undefined }, handlers };
}

function makeRes() {
  const out: { status: number; body: any } = { status: 200, body: undefined };
  const res: any = {
    status(code: number) { out.status = code; return res; },
    json(body: unknown) { out.body = body; return res; },
    set() { return res; },
    setHeader() {},
  };
  return { res, out };
}

const RESPOND = `POST ${HANDOFFS_URL}/:id/respond`;
const WITHDRAW = `POST ${HANDOFFS_URL}/:id/withdraw`;
const DOORS = [`POST ${HANDOFFS_URL}`, `GET ${HANDOFFS_SENT_URL}`, `GET ${HANDOFFS_WAITING_URL}`, RESPOND, WITHDRAW];

const depsFor = (pool: any, who: () => string | null, notify: (i: NotifyInput) => Promise<any>) => ({
  authedUser: async () => (who() ? { id: who() } : null),
  getPool: () => pool,
  overLimit: async () => false,
  isAdmin: async () => who() === "m-steward",
  adminActor: () => (who() === "m-steward" ? { id: "m-steward" } : null),
  timeZone: () => "America/Costa_Rica",
  notify,
}) as any;

describe("a task handed to a role, without a database", () => {
  it("answers 401 at every door to a stranger", async () => {
    const c = collect();
    register(c.app, depsFor(null, () => null, async () => undefined));
    for (const key of DOORS) {
      const { res, out } = makeRes();
      await c.handlers.get(key)!({ params: { id: "rq-x" }, body: {}, query: {} }, res);
      expect(out.status, key).toBe(401);
    }
  });
});

const configured = testDbConfigured();
if (!configured) console.warn("[roleTaskHandoffs.db] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

describe.skipIf(!configured)("a task handed to a role, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let handlers: Map<string, Handler>;
  let whoami: string | null = null;
  const notices: NotifyInput[] = [];
  const q = async (sql: string, params: unknown[] = []) => (await pool.query<any[]>(sql, params))[0]; // module-review-ok: fixture SQL against the S5 scratch schema this suite provisioned, never a production table

  const as = async (who: string | null, key: string, req: any = {}) => {
    whoami = who;
    const handler = handlers.get(key);
    if (!handler) throw new Error(`no handler registered for ${key}`);
    const { res, out } = makeRes();
    await handler({ params: {}, body: {}, query: {}, headers: {}, ...req }, res);
    return out;
  };
  const send = (who: string, body: Record<string, unknown>) => as(who, `POST ${HANDOFFS_URL}`, { body });
  const respond = (who: string, id: string, body: Record<string, unknown>) => as(who, RESPOND, { params: { id }, body });
  const waiting = async (who: string) => (await as(who, `GET ${HANDOFFS_WAITING_URL}`)).body.waiting as any[];
  const sent = async (who: string) => (await as(who, `GET ${HANDOFFS_SENT_URL}`)).body.sent as any[];
  const bell = async (key: string) => q("SELECT `user_id`, `type`, `title` FROM `notifications` WHERE `dedupe_key` = ?", [key]); // module-review-ok: fixture read of the scratch schema

  /** The real spine on the scratch schema: nobody has an email, so nothing is mailed. */
  const notify = async (input: NotifyInput) => {
    notices.push(input);
    return insertNotification(
      { pool, memberById: async () => null, sendEmail: async () => ({ ok: false }) as any, origin: () => "http://127.0.0.1", projectName: () => "Test village", isPresent: () => true } as any,
      input,
    );
  };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    const people = [["m-ops", "Oona Park"], ["m-fin1", "Fen Ito"], ["m-fin2", "Gia Lowe"], ["m-lead", "Lu Marsh"], ["m-out", "Ola Brand"], ["m-steward", "Sol Steward"]];
    for (const [id, name] of people) {
      await q("INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `handle`) VALUES (?,?,?,'x',?)", [id, name, `${id}@example.test`, id]); // module-review-ok: fixture SQL against the S5 scratch schema
    }
    await q("INSERT INTO `circles` (`id`, `name`, `aliases`, `is_example`, `lead_role_id`) VALUES ('c-ops', 'Operations circle', '[]', 0, 'seat-lead'), ('c-bare', 'Bare circle', '[]', 0, NULL)"); // module-review-ok: fixture SQL against the S5 scratch schema
    await q( // module-review-ok: fixture SQL against the S5 scratch schema
      "INSERT INTO `org_roles` (`id`, `circle_id`, `name`, `active`, `is_example`) VALUES " +
        "('seat-finance', 'c-ops', 'Finance steward', 1, 0), ('seat-lead', 'c-ops', 'Operations lead', 1, 0), " +
        "('seat-empty', 'c-ops', 'Tool keeper', 1, 0), ('seat-orphan', 'c-bare', 'Seed keeper', 1, 0), ('seat-gone', 'c-ops', 'Old role', 0, 0)",
    );
    await q( // module-review-ok: fixture SQL against the S5 scratch schema
      "INSERT INTO `org_role_assignments` (`id`, `org_role_id`, `holder_kind`, `user_id`, `holder_key`, `term_ends_at`) VALUES " +
        "('ora-f1', 'seat-finance', 'member', 'm-fin1', 'm-fin1', NULL), ('ora-f2', 'seat-finance', 'member', 'm-fin2', 'm-fin2', NULL), " +
        "('ora-l', 'seat-lead', 'member', 'm-lead', 'm-lead', NULL)",
    );
    const c = collect();
    register(c.app, depsFor(pool, () => whoami, notify));
    handlers = c.handlers;
  }, 240_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  beforeEach(() => {
    notices.length = 0;
  });

  let first = "";

  it("refuses a role that is not live, no words, and a day already past", async () => {
    expect(await send("m-ops", { roleId: "seat-gone", title: "Count the till" })).toEqual({ status: 400, body: { error: HANDOFF_REFUSALS.noRole } });
    expect(await send("m-ops", { roleId: "seat-finance", title: "   " })).toEqual({ status: 400, body: { error: HANDOFF_REFUSALS.noTitle } });
    expect(await send("m-ops", { roleId: "seat-finance", title: "Count the till", dueOn: "2001-01-01" })).toEqual({ status: 400, body: { error: HANDOFF_REFUSALS.badDay } });
    expect(await q("SELECT `id` FROM `member_task_role_queue`")).toEqual([]); // module-review-ok: fixture read of the scratch schema
  });

  it("waits on every live holder, who each hear once, and never on the sender or a stranger", async () => {
    const out = await send("m-ops", { roleId: "seat-finance", title: "Reconcile the moon's receipts", note: "The box is in the office.", dueOn: "2099-01-31" });
    expect(out.status, JSON.stringify(out.body)).toBe(201);
    first = out.body.id;
    expect(notices.map((n) => n.userId).sort()).toEqual(["m-fin1", "m-fin2"]);
    expect(notices.every((n) => n.type === "role_task_handed" && n.title === "For Finance steward: Reconcile the moon's receipts")).toBe(true);
    const w = await waiting("m-fin1");
    expect(w).toEqual([expect.objectContaining({ id: first, role: "Finance steward", circle: "Operations circle", title: "Reconcile the moon's receipts", note: "The box is in the office.", dueOn: "2099-01-31", from: "Oona", via: "holder", edited: false })]);
    expect(await waiting("m-out")).toEqual([]);
    expect(await waiting("m-ops")).toEqual([]);
    expect(await waiting("m-lead")).toEqual([]);
    expect(await sent("m-ops")).toEqual([expect.objectContaining({ id: first, status: "waiting", role: "Finance steward" })]);
  });

  it("lets only someone it waits on answer, and never the sender", async () => {
    expect(await respond("m-out", first, { action: "accept" })).toEqual({ status: 403, body: { error: HANDOFF_REFUSALS.notYours } });
    expect(await respond("m-lead", first, { action: "accept" })).toEqual({ status: 403, body: { error: HANDOFF_REFUSALS.notYours } });
    expect(await respond("m-ops", first, { action: "accept" })).toEqual({ status: 403, body: { error: HANDOFF_REFUSALS.ownTask } });
    expect(await respond("m-fin1", first, { action: "maybe" })).toEqual({ status: 400, body: { error: HANDOFF_REFUSALS.badAction } });
    expect(await respond("m-fin1", first, { action: "suggest", title: "Reconcile the moon's receipts" })).toEqual({ status: 400, body: { error: HANDOFF_REFUSALS.noChange } });
    expect(await as("m-out", WITHDRAW, { params: { id: first } })).toEqual({ status: 403, body: { error: HANDOFF_REFUSALS.notSender } });
    expect((await sent("m-ops"))[0].status).toBe("waiting");
  });

  it("a suggested change keeps it waiting, and the sender hears once per change", async () => {
    const out = await respond("m-fin1", first, { action: "suggest", title: "Reconcile the receipts", dueOn: "2099-02-07" });
    expect(out).toEqual({ status: 200, body: { status: "waiting", taskId: null } });
    expect(notices).toEqual([expect.objectContaining({ userId: "m-ops", type: "role_task_edited", title: "Finance steward suggested a change: Reconcile the receipts" })]);
    expect((await waiting("m-fin2"))[0]).toMatchObject({ title: "Reconcile the receipts", note: "The box is in the office.", dueOn: "2099-02-07", edited: true });
    expect((await sent("m-ops"))[0]).toMatchObject({ status: "waiting", title: "Reconcile the receipts", edited: true });
  });

  it("one holder accepting takes it for the role; the second is told someone answered first", async () => {
    const out = await respond("m-fin2", first, { action: "accept" });
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    expect(out.body.status).toBe("accepted");
    const copy = await q("SELECT `user_id`, `title`, `source`, `external_id`, `role_id`, `requested_by`, DATE_FORMAT(`due_on`, '%Y-%m-%d') AS `due_on`, `status` FROM `member_tasks` WHERE `external_id` = ?", [first]); // module-review-ok: fixture read of the scratch schema
    expect(copy).toEqual([{ user_id: "m-fin2", title: "Reconcile the receipts", source: "redirect", external_id: first, role_id: "seat-finance", requested_by: "Oona", due_on: "2099-02-07", status: "open" }]);
    expect(await respond("m-fin1", first, { action: "accept" })).toEqual({ status: 409, body: { error: HANDOFF_REFUSALS.taken } });
    expect(await waiting("m-fin1")).toEqual([]);
    expect((await sent("m-ops"))[0].status).toBe("accepted");
    expect(await bell(handoffDedupeKey(first, "accepted"))).toEqual([{ user_id: "m-ops", type: "role_task_accepted", title: "Finance steward accepted: Reconcile the receipts" }]);
    expect(await q("SELECT `id` FROM `member_tasks` WHERE `external_id` = ?", [first])).toHaveLength(1); // module-review-ok: fixture read of the scratch schema
  });

  it("tells the sender once when the accepted copy is done, however often the job runs", async () => {
    const [row] = await q("SELECT `id`, `version` FROM `member_tasks` WHERE `external_id` = ?", [first]); // module-review-ok: fixture read of the scratch schema
    expect(await setStatus(pool, "m-fin2", row.id, row.version, "done")).toBe("ok");
    await noticeDone(pool, { notify });
    await noticeDone(pool, { notify });
    expect(await bell(handoffDedupeKey(first, "done"))).toEqual([{ user_id: "m-ops", type: "role_task_done", title: "Finance steward finished: Reconcile the receipts" }]);
    expect((await sent("m-ops"))[0].status).toBe("done");
  });

  it("decline needs a reason, and the sender reads it", async () => {
    const out = await send("m-ops", { roleId: "seat-finance", title: "Pay the well digger" });
    const id = out.body.id;
    expect(await respond("m-fin1", id, { action: "decline", reason: "  " })).toEqual({ status: 400, body: { error: HANDOFF_REFUSALS.noReason } });
    expect(await respond("m-fin1", id, { action: "decline", reason: "That sits with the Land circle." })).toEqual({ status: 200, body: { status: "declined", taskId: null } });
    expect(await respond("m-fin2", id, { action: "accept" })).toEqual({ status: 409, body: { error: HANDOFF_REFUSALS.taken } });
    expect((await sent("m-ops")).find((h) => h.id === id)).toMatchObject({ status: "declined", reason: "That sits with the Land circle." });
    expect(await bell(handoffDedupeKey(id, "declined"))).toHaveLength(1);
  });

  it("the sender can take it back while it waits, and nobody is asked any more", async () => {
    const id = (await send("m-ops", { roleId: "seat-finance", title: "Order receipt books" })).body.id;
    expect(await as("m-ops", WITHDRAW, { params: { id } })).toEqual({ status: 200, body: { withdrawn: true } });
    expect((await sent("m-ops")).find((h) => h.id === id)).toMatchObject({ status: "withdrawn", reason: null });
    expect((await waiting("m-fin1")).some((h) => h.id === id)).toBe(false);
    expect(await as("m-ops", WITHDRAW, { params: { id } })).toEqual({ status: 409, body: { error: HANDOFF_REFUSALS.taken } });
  });

  it("nobody holding the role routes to the circle's lead; no lead routes to the stewards and their queue", async () => {
    const toLead = (await send("m-ops", { roleId: "seat-empty", title: "Sharpen the machetes" })).body.id;
    expect(notices.map((n) => n.userId)).toEqual(["m-lead"]);
    expect(await waiting("m-lead")).toEqual([expect.objectContaining({ id: toLead, via: "lead", role: "Tool keeper" })]);
    expect(await waiting("m-fin1")).toEqual([]);

    notices.length = 0;
    const toStewards = (await send("m-ops", { roleId: "seat-orphan", title: "Sort the seed bank" })).body.id;
    expect(notices).toEqual([]);
    expect(await waiting("m-steward")).toEqual([expect.objectContaining({ id: toStewards, via: "steward" })]);
    expect(await waiting("m-lead")).toEqual([expect.objectContaining({ id: toLead })]);
    const queue = (await as("m-steward", "GET /api/admin/member-tasks/bridge")).body.roleQueue;
    expect(queue.map((r: any) => r.id)).toEqual(expect.arrayContaining([toLead, toStewards]));
    // The steward panel's queue still closes it, and the sender hears.
    expect((await as("m-steward", "POST /api/admin/member-tasks/role-queue/:id", { params: { id: toStewards }, body: { status: "dismissed" } })).body).toEqual({ closed: true });
    expect((await sent("m-ops")).find((h) => h.id === toStewards)?.status).toBe("declined");
    expect(await bell(handoffDedupeKey(toStewards, "declined"))).toHaveLength(1);
    expect(await waiting("m-steward")).toEqual([]);
  });

  it("a sender who holds the role too is never asked; as its only holder it goes to the lead", async () => {
    await q("INSERT INTO `org_role_assignments` (`id`, `org_role_id`, `holder_kind`, `user_id`, `holder_key`, `term_ends_at`) VALUES ('ora-f3', 'seat-finance', 'member', 'm-ops', 'm-ops', NULL), ('ora-t', 'seat-empty', 'member', 'm-ops', 'm-ops', NULL)"); // module-review-ok: fixture SQL against the S5 scratch schema
    const shared = (await send("m-ops", { roleId: "seat-finance", title: "File the moon's report" })).body.id;
    expect(notices.map((n) => n.userId).sort()).toEqual(["m-fin1", "m-fin2"]);
    expect(await respond("m-ops", shared, { action: "accept" })).toEqual({ status: 403, body: { error: HANDOFF_REFUSALS.ownTask } });
    notices.length = 0;
    const solo = (await send("m-ops", { roleId: "seat-empty", title: "Oil the hinges" })).body.id;
    expect(notices.map((n) => n.userId)).toEqual(["m-lead"]);
    expect((await waiting("m-lead")).find((h) => h.id === solo)?.via).toBe("lead");
    await q("DELETE FROM `org_role_assignments` WHERE `id` IN ('ora-f3', 'ora-t')"); // module-review-ok: fixture SQL against the S5 scratch schema
  });

  it("the list's own redirect: to a role it lands with the holders and its note; to a person it lands directly", async () => {
    const taskId = await insertTask(pool, "m-ops", { title: "Book the accountant", tier: "priority", dueOn: null, horizon: null, minutes: null, privateDetail: "my own words", source: "self", createdOn: "2026-11-16" }, "m-ops");
    const out = await as("m-ops", "POST /api/member-tasks/me/:id/redirect", {
      params: { id: taskId },
      body: { version: 1, reason: "not_my_role", feedbackId: "fb-handoff-test-1", toRoleId: "seat-finance", handoffNote: "Before the moon closes.", handoffDueOn: "2099-03-01" },
    });
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    expect(out.body.task.status).toBe("removed");
    expect(notices.map((n) => n.userId).sort()).toEqual(["m-fin1", "m-fin2"]);
    const row = (await waiting("m-fin1")).find((h) => h.title === "Book the accountant");
    expect(row).toMatchObject({ note: "Before the moon closes.", dueOn: "2099-03-01", via: "holder" });
    expect(JSON.stringify(row)).not.toContain("my own words");

    const other = await insertTask(pool, "m-ops", { title: "Water the nursery", tier: "priority", dueOn: null, horizon: null, minutes: null, privateDetail: null, source: "self", createdOn: "2026-11-16" }, "m-ops");
    const direct = await as("m-ops", "POST /api/member-tasks/me/:id/redirect", {
      params: { id: other }, body: { version: 1, reason: "better_for_someone_else", feedbackId: "fb-handoff-test-2", toUserId: "m-out" },
    });
    expect(direct.status, JSON.stringify(direct.body)).toBe(200);
    expect(await q("SELECT `status`, `source` FROM `member_tasks` WHERE `user_id` = 'm-out' AND `title` = 'Water the nursery'")).toEqual([{ status: "open", source: "redirect" }]); // module-review-ok: fixture read of the scratch schema
  });
});
