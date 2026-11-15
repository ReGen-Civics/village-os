/**
 * PAID ON WHAT WE TRULY ACCOMPLISH, END TO END (Rye, 14 Nov 2026), against a
 * real schema. The End of Moon review sets what was agreed beside what was
 * delivered; when it is far off, a Treasurer may propose a different amount
 * with a reason; the member sees it, replies and sends again; nothing pays
 * until a Treasurer confirms. Each case:
 *
 *   the whole flow     the queue shows agreed beside delivered and the flag;
 *                      a Treasurer proposes; the invoice is voided and the
 *                      recap returned; the member's draft shows the proposal;
 *                      the re-sent invoice carries it with the reply; approval
 *                      refuses until a Treasurer confirms; the cash owed row
 *                      carries the proposed amount
 *   who may propose    not the member, not the work approver, never on one's
 *                      own pay, never without a reason
 *   withdrawn          a withdrawn proposal leaves pay as the terms, and the
 *                      voided record's total with it (QA F11)
 *   no task data       no goals and no tasks done: no flag, pay is the terms,
 *                      nothing to confirm (fails closed)
 *
 *   another confirms  with two or more who may confirm, a changed amount is
 *                      confirmed by someone other than whoever changed it; with
 *                      one, they confirm their own, marked (P1-4, 15 Nov 2026)
 *   approve-alone      a holder of approve-alone may confirm a pay change, and
 *                      counts as a confirmer (P2-1: "founders and stewards hold
 *                      that power too until they give it away")
 *   a range amount     the same rule holds for a range amount Finance set: the
 *                      approval that confirms it is someone else's
 *
 * Every person here is invented.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { LUNAR_CLOCK } from "../../shared/cycleClock";
import { APPROVAL_REFUSALS, MOON_ROUTES, SELF_CONFIRMED_WORDS, seenAmountsOf } from "../../shared/moonRecap";
import { ADJUST_REFUSALS } from "../../shared/accomplishedReview";
import { moonOf } from "./moonRecap";
import { register } from "../routes/moonRecaps";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;
const TZ = "America/Costa_Rica";
const configured = testDbConfigured();
const MOON = moonOf(LUNAR_CLOCK.boundsFor(new Date("2026-10-20T12:00:00Z")), TZ);
const CYCLE = MOON.bounds.id;
const SEASONS = [{ id: "season-f", startsOn: "2026-06-21", endsOn: "2027-01-01", goals: [] }];

const PAYERS = {
  payers: [{
    key: "holding", legalName: "Example Holding Company", address: "1 Example Road", taxId: null, country: "US", currencies: ["USD"],
    invoiceTo: "invoices@example.test", invoiceCc: [], invoicing: true, routes: ["abroad", "nomad", "local_contractor"],
    authority: { kind: "none", date: null, routes: [], monthlyCeilingMinor: null, ceilingCurrency: null, filedWhere: null }, queueNote: null,
  }],
};
const SETTINGS = { hostCountry: { code: "XX", name: "Hostland" }, pilotAck: { text: "This is a pilot.", version: "v1" }, taxForms: [], taxFormRoutes: [], holds: [] };
const ATTEST = { workCountries: ["US"], daysInHostCountry: 0, statusUnchanged: true, servedAbroad: null, visitorEntryWork: false };
const HOLDERS: Record<string, string[]> = { "moon.approve": ["m-ops"], "cash.pay": ["m-fin", "m-treas"] };
const HOLDERS_AT_START = JSON.stringify(HOLDERS);
const PAY = JSON.stringify({ v: 1, pay: { kind: "fixed", currency: "USD", amountMinor: 100000, per: "moon" } });

describe.skipIf(!configured)("paid on what we truly accomplish, against a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let whoami: string | null = null;
  const handlers = new Map<string, Handler>();
  const q = async (sql: string, params: unknown[] = []) => (await pool.query<any[]>(sql, params))[0]; // module-review-ok: fixture SQL against the S5 scratch schema, never a production table

  const call = async (key: string, req: any = {}) => {
    const h = handlers.get(key);
    if (!h) throw new Error(`no handler for ${key}`);
    const out: { status: number; body: any } = { status: 200, body: undefined };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: unknown) { out.body = b; return res; } };
    await h({ params: {}, body: {}, query: {}, ...req }, res);
    return out;
  };
  const as = (who: string) => { whoami = who; };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 6 });
    for (const id of ["m-wren", "m-ops", "m-fin", "m-treas", "m-steward"]) {
      await q("INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `handle`) VALUES (?,?,?,'x',?)", [id, id.slice(2), `${id}@example.test`, id.slice(2)]); // module-review-ok: fixture SQL
    }
    await q("INSERT INTO `org_roles` (`id`, `name`, `accountabilities`) VALUES ('r-water', 'Water keeper', ?)", [JSON.stringify(["Keep the water clean"])]); // module-review-ok: fixture SQL
    register({ get: (p: string, h: Handler) => handlers.set(`GET ${p}`, h), post: (p: string, h: Handler) => handlers.set(`POST ${p}`, h), put: (p: string, h: Handler) => handlers.set(`PUT ${p}`, h), patch: (p: string, h: Handler) => handlers.set(`PATCH ${p}`, h), use: () => undefined } as any, {
      authedUser: async () => (whoami ? { id: whoami } : null),
      getPool: () => pool,
      overLimit: async () => false,
      seasonState: () => ({ current: null, seasons: SEASONS, timezone: TZ }) as any,
      lapseContext: () => ({ currentSeasonId: null, cadence: "never" }) as any,
      members: { byId: async (id: string) => ({ id, name: id.slice(2) }), all: async () => [] } as any,
      notify: async () => ({}) as any,
      mayAct: async () => ({ ok: true, reachedPast: false, villageHolds: true, source: "test", message: "No." }) as any,
      cashKeyHolders: async () => HOLDERS["cash.pay"],
      keyHolders: async (k: string) => HOLDERS[k] ?? [],
    });
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  beforeEach(async () => {
    whoami = "m-wren";
    // Each case sets who holds which key; every case starts from the same two Treasurers.
    for (const k of Object.keys(HOLDERS)) delete HOLDERS[k];
    Object.assign(HOLDERS, JSON.parse(HOLDERS_AT_START));
    for (const t of ["moon_recap_items", "moon_invoices", "moon_recaps", "moon_review_events", "member_pay_routes", "cash_owed", "app_config", "org_role_assignments", "seat_applications", "moon_goals"]) {
      await q(`DELETE FROM \`${t}\``); // module-review-ok: fixture SQL
    }
    await q("INSERT INTO `app_config` (`config_key`, `value`) VALUES ('payers', ?), ('moon-review-settings', ?)", [JSON.stringify(PAYERS), JSON.stringify(SETTINGS)]); // module-review-ok: fixture SQL
    await q( // module-review-ok: fixture SQL
      "INSERT INTO `member_pay_routes` (`user_id`, `route`, `payer_key`, `legal_name`, `address`, `tax_form_kind`, `invoice_seq`, `confirmed_at`, `confirmed_by`) VALUES ('m-wren', 'abroad', 'holding', 'Wren Alder', '2 Example Lane', 'none', 0, UTC_TIMESTAMP(), 'm-fin')",
    );
    await q( // module-review-ok: fixture SQL
      "INSERT INTO `seat_applications` (`id`, `candidate_user_id`, `proposed_by`, `seat_ids`, `settings_json`, `settings_hash`, `term_ends_at`, `status`) VALUES ('app-water', 'm-wren', 'm-wren', ?, ?, ?, '2027-06-01 00:00:00', 'adopted')",
      [JSON.stringify(["a-water"]), PAY, "0".repeat(64)],
    );
    await q( // module-review-ok: fixture SQL
      "INSERT INTO `org_role_assignments` (`id`, `org_role_id`, `holder_kind`, `user_id`, `holder_key`, `started_at`, `application_id`) VALUES ('a-water', 'r-water', 'member', 'm-wren', 'm-wren', '2026-09-01 12:00:00', 'app-water')",
    );
  });

  /** The member's moon goals for this moon, with their statuses. */
  const goals = async (statuses: string[]) => {
    let i = 0;
    for (const status of statuses) {
      i += 1;
      await q( // module-review-ok: fixture SQL
        "INSERT INTO `moon_goals` (`id`, `user_id`, `cycle_id`, `position`, `text`, `done_when`, `season_goal_id`, `status`, `carried_from_id`, `carry_count`) VALUES (?, 'm-wren', ?, ?, ?, NULL, NULL, ?, NULL, 0)",
        [`mg-${i}`, CYCLE, i, `Goal ${i}`, status],
      );
    }
  };
  /** A hand-added item: kept is work the member wrote down as done; suggested is not kept, so it is not a task done. */
  const addItem = async (text: string, roleId: string | null, done: boolean) => {
    as("m-wren");
    const body: Record<string, unknown> = { text, roleId, ...(roleId ? { accountabilityWords: "Keep the water clean" } : {}), state: done ? "kept" : "suggested" };
    expect((await call(`POST ${MOON_ROUTES.addItem}`, { params: { cycle: CYCLE }, body })).status).toBe(201);
  };
  const sendRecap = async () => {
    as("m-wren");
    expect((await call(`POST ${MOON_ROUTES.sendRecap}`, { params: { cycle: CYCLE }, body: {} })).status).toBe(200);
  };
  let invoiceNo = 0;
  const sendInvoice = async (extra: Record<string, unknown> = {}) => {
    as("m-wren");
    invoiceNo += 1;
    const sent = await call(`POST ${MOON_ROUTES.sendInvoice}`, { params: { cycle: CYCLE }, body: { attestation: ATTEST, pilotAckVersion: "v1", memberNumber: `INV-${invoiceNo}`, ...extra } });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    return sent.body.invoice;
  };
  const draft = async () => {
    as("m-wren");
    const out = await call(`GET ${MOON_ROUTES.myMoon}`, { query: { cycle: CYCLE } });
    expect(out.status).toBe(200);
    return out.body;
  };
  const queueRow = async () => {
    const out = await call(`GET ${MOON_ROUTES.queue}`, { query: { cycle: CYCLE } });
    expect(out.status).toBe(200);
    return out.body.rows.find((r: any) => r.userId === "m-wren");
  };
  const approveWork = async () => {
    as("m-ops");
    const row = await queueRow();
    if (row.waitingOn !== "work") return;
    expect((await call(`POST ${MOON_ROUTES.work}`, { params: { recap: row.recapId }, body: { hash: row.hash, items: [] } })).status).toBe(200);
  };
  const approveInvoice = async (by = "m-fin") => {
    as(by);
    const row = await queueRow();
    return call(`POST ${MOON_ROUTES.approveInvoices}`, { body: { invoices: [{ id: row.invoice.id, hash: row.hash, expectedOn: "2026-11-20" }] } });
  };
  const propose = (by: string, id: string, body: Record<string, unknown>) => {
    as(by);
    return call(`POST ${MOON_ROUTES.adjustPay}`, { params: { id }, body });
  };
  /** Confirm as `by`, carrying the amounts the Treasurer saw: the invoice's lines as stored, unless given (QA F2). */
  const confirm = async (by: string, id: string, amounts?: Record<string, number | null>) => {
    const [row] = await q("SELECT `lines_json` FROM `moon_invoices` WHERE `id` = ?", [id]); // module-review-ok: fixture SQL
    as(by);
    return call(`POST ${MOON_ROUTES.confirmSplit}`, { params: { id }, body: { amounts: amounts ?? (row ? seenAmountsOf(JSON.parse(row.lines_json)) : {}) } });
  };

  it("the whole flow: agreed beside delivered, a proposal, the member's reply, confirmed before it pays", async () => {
    await goals(["done", "partly", "carried", "carried"]);
    await addItem("Fixed the pump", "r-water", true);
    await addItem("Covered the kitchen rota", null, true);
    await addItem("Ran the open day", null, true);
    await addItem("Mended the fence", null, true);
    await sendRecap();
    const sent = await sendInvoice();
    expect(sent.totalMinor).toBe(100000);
    await approveWork();

    // The Treasurer reads counts, the sentence and the flag. No score, band or reading.
    as("m-fin");
    const row = await queueRow();
    const acc = row.invoice.accomplished;
    expect(acc.goals).toMatchObject({ done: 1, partly: 1, carried: 2, total: 4 });
    expect(acc.tasks).toMatchObject({ done: 4, outside: 3, byRole: [{ roleId: "r-water", name: "Water keeper", count: 1 }] });
    expect(acc.sentence).toBe("Agreed: US$1,000 for 4 goals. Delivered: 1 of 4 goals done, 1 partly, plus 4 other tasks (3 outside your roles).");
    expect(acc.farOff).toMatchObject({ under: true, over: true, pct: 25 });
    expect(Object.keys(acc).sort()).toEqual(["agreed", "farOff", "goals", "sentence", "tasks"]);

    // A Treasurer proposes more, with a reason. The invoice is voided and the recap goes back to the member.
    const p = await propose("m-fin", row.invoice.id, { applicationId: "app-water", amountMinor: 125000, reason: "Two big pieces of work outside the role this moon." });
    expect(p).toEqual({ status: 200, body: { voided: row.invoice.id } });
    expect((await q("SELECT `kind`, `amount_minor`, `note` FROM `moon_review_events` WHERE `kind` = 'pay_adjusted'"))).toEqual([ // module-review-ok: fixture SQL
      { kind: "pay_adjusted", amount_minor: 125000, note: "Two big pieces of work outside the role this moon." },
    ]);

    // The member's draft shows it before they send again.
    const mine = await draft();
    expect(mine.recap.status).toBe("returned");
    expect(mine.invoice.lines[0]).toMatchObject({ amountMinor: 125000, adjust: { baseMinor: 100000, adjustedMinor: 125000, confirmedAt: null } });
    expect(mine.invoice.accomplished.agreed.totals).toEqual([{ currency: "USD", minor: 100000 }]);

    // They reply and send again; the proposal carries, with the reply.
    await sendRecap();
    const again = await sendInvoice({ adjustReply: "Thank you. The open day took most of a week." });
    expect(again.totalMinor).toBe(125000);
    expect(again.lines[0].adjust).toMatchObject({ baseMinor: 100000, adjustedMinor: 125000, reply: "Thank you. The open day took most of a week.", confirmedAt: null });
    await approveWork();

    // Nothing pays until a Treasurer confirms.
    as("m-fin");
    const row2 = await queueRow();
    const early = await approveInvoice();
    expect(early.body.refused).toEqual([{ id: row2.invoice.id, reason: ADJUST_REFUSALS.unconfirmed }]);
    expect(await q("SELECT `id` FROM `cash_owed`")).toHaveLength(0); // module-review-ok: fixture SQL
    expect((await confirm("m-wren", row2.invoice.id)).status).toBe(403);
    expect((await confirm("m-ops", row2.invoice.id)).status).toBe(403);
    expect(await confirm("m-treas", row2.invoice.id)).toEqual({ status: 200, body: { confirmed: row2.invoice.id } });
    const after = await queueRow();
    expect(after.hash).toBe(row2.hash);
    expect(after.invoice.lines[0].adjust).toMatchObject({ confirmedBy: "m-treas" });

    expect((await approveInvoice()).body.approved).toEqual([row2.invoice.id]);
    const owed = (await q("SELECT `amount_minor` FROM `cash_owed`")).map((r: any) => Number(r.amount_minor)); // module-review-ok: fixture SQL
    expect(owed).toEqual([125000]);
  });

  it("who may propose: never the member, never the work approver, never without a reason", async () => {
    await addItem("Fixed the pump", "r-water", true);
    await sendRecap();
    const sent = await sendInvoice();
    const body = { applicationId: "app-water", amountMinor: 90000, reason: "Fewer goals done." };
    expect(await propose("m-wren", sent.id, body)).toEqual({ status: 403, body: { error: ADJUST_REFUSALS.ownPay } });
    expect((await propose("m-ops", sent.id, body)).status).toBe(403);
    expect(await propose("m-fin", sent.id, { ...body, reason: "  " })).toEqual({ status: 400, body: { error: ADJUST_REFUSALS.reason } });
    expect(await propose("m-fin", sent.id, { ...body, applicationId: "app-none" })).toEqual({ status: 400, body: { error: ADJUST_REFUSALS.noLine } });
    expect(await propose("m-fin", sent.id, { ...body, amountMinor: -1 })).toEqual({ status: 400, body: { error: ADJUST_REFUSALS.amount } });
    expect(await q("SELECT `id` FROM `moon_review_events` WHERE `kind` = 'pay_adjusted'")).toHaveLength(0); // module-review-ok: fixture SQL
  });

  it("a withdrawn proposal leaves pay as the terms", async () => {
    await addItem("Fixed the pump", "r-water", true);
    await sendRecap();
    const first = await sendInvoice();
    expect((await propose("m-fin", first.id, { applicationId: "app-water", amountMinor: 80000, reason: "Fewer goals done." })).status).toBe(200);
    await sendRecap();
    const second = await sendInvoice();
    expect(second.totalMinor).toBe(80000);
    expect((await propose("m-fin", second.id, { applicationId: "app-water", amountMinor: null, reason: "We talked it through." })).status).toBe(200);
    await sendRecap();
    const third = await sendInvoice();
    expect(third.totalMinor).toBe(100000);
    expect(third.lines.every((l: any) => !l.adjust)).toBe(true);
    // The withdrawn revision is kept at the agreed total, not the proposal's (QA F11).
    const [voided] = await q("SELECT `total_minor` FROM `moon_invoices` WHERE `id` = ?", [second.id]); // module-review-ok: fixture SQL
    expect(Number(voided.total_minor)).toBe(100000);
  });

  it("no task data: no flag, pay is the terms, nothing to confirm", async () => {
    await addItem("Read the water report", "r-water", false);
    await sendRecap();
    const sent = await sendInvoice();
    expect(sent.totalMinor).toBe(100000);
    expect(sent.lines.every((l: any) => !l.adjust)).toBe(true);
    await approveWork();
    as("m-fin");
    const row = await queueRow();
    expect(row.invoice.accomplished).toMatchObject({ farOff: null, goals: { total: 0 }, tasks: { done: 0 } });
    expect((await approveInvoice()).body.approved).toEqual([sent.id]);
  });

  /** Recap and invoice sent, work approved, a Treasurer's proposal made by `by`, and the member's resend. */
  const proposedBy = async (by: string) => {
    await addItem("Fixed the pump", "r-water", true);
    await sendRecap();
    const first = await sendInvoice();
    expect((await propose(by, first.id, { applicationId: "app-water", amountMinor: 90000, reason: "Fewer goals done." })).status).toBe(200);
    await sendRecap();
    const again = await sendInvoice();
    await approveWork();
    return again.id as string;
  };

  it("another confirms: with two Treasurers, the one who proposed cannot confirm their own amount", async () => {
    const id = await proposedBy("m-fin");
    expect(await confirm("m-fin", id)).toEqual({ status: 403, body: { error: APPROVAL_REFUSALS.otherConfirms } });
    expect(await confirm("m-treas", id)).toEqual({ status: 200, body: { confirmed: id } });
    const [row] = await q("SELECT `lines_json` FROM `moon_invoices` WHERE `id` = ?", [id]); // module-review-ok: fixture SQL
    expect(JSON.parse(row.lines_json)[0].adjust).toMatchObject({ confirmedBy: "m-treas" });
    expect(JSON.parse(row.lines_json)[0].adjust.confirmedAlone).toBeUndefined();
  });

  it("one who may confirm: they confirm their own proposal, and it is marked", async () => {
    HOLDERS["cash.pay"] = ["m-fin"];
    const id = await proposedBy("m-fin");
    expect(await confirm("m-fin", id)).toEqual({ status: 200, body: { confirmed: id } });
    const [row] = await q("SELECT `lines_json` FROM `moon_invoices` WHERE `id` = ?", [id]); // module-review-ok: fixture SQL
    expect(JSON.parse(row.lines_json)[0].adjust).toMatchObject({ confirmedBy: "m-fin", confirmedAlone: true });
    const [ev] = await q("SELECT `self_approved`, `note` FROM `moon_review_events` WHERE `kind` = 'adjust_confirmed'"); // module-review-ok: fixture SQL
    expect([Number(ev.self_approved), ev.note]).toEqual([1, SELF_CONFIRMED_WORDS]);
    expect((await approveInvoice("m-fin")).body.approved).toEqual([id]);
  });

  it("approve-alone holders may confirm a pay change, and count as confirmers (P2-1)", async () => {
    HOLDERS["cash.pay"] = ["m-fin"];
    HOLDERS["moon.approve_alone"] = ["m-steward"];
    const id = await proposedBy("m-fin");
    // Two may confirm now, the Treasurer and the steward, so the proposer cannot confirm their own.
    expect(await confirm("m-fin", id)).toEqual({ status: 403, body: { error: APPROVAL_REFUSALS.otherConfirms } });
    expect(await confirm("m-steward", id)).toEqual({ status: 200, body: { confirmed: id } });
    // CONTROL: someone holding neither key still cannot.
    HOLDERS["moon.approve_alone"] = [];
    expect((await confirm("m-steward", id)).status).toBe(403);
  });

  it("a range amount Finance set is confirmed by someone other than who set it", async () => {
    await q("UPDATE `seat_applications` SET `settings_json` = ? WHERE `id` = 'app-water'", [JSON.stringify({ v: 1, pay: { kind: "range", currency: "USD", minMinor: 80000, maxMinor: 120000, per: "moon" } })]); // module-review-ok: fixture SQL
    await addItem("Fixed the pump", "r-water", true);
    await sendRecap();
    const first = await sendInvoice({ rangeProposals: { "app-water": 110000 } });
    await approveWork();
    as("m-fin");
    expect((await call(`POST ${MOON_ROUTES.setRange}`, { params: { id: first.id }, body: { applicationId: "app-water", finalMinor: 95000, note: "What we agreed on the call." } })).status).toBe(200);
    await sendRecap();
    const again = await sendInvoice();
    expect(again.lines[0]).toMatchObject({ basis: "range", finalMinor: 95000 });
    await approveWork();
    const mine = await approveInvoice("m-fin");
    expect(mine.body.refused).toEqual([{ id: again.id, reason: APPROVAL_REFUSALS.otherConfirms }]);
    expect((await approveInvoice("m-treas")).body.approved).toEqual([again.id]);
  });
});
