/**
 * PAY SCALED BY THE SPLIT, END TO END (Rye, 14 Nov 2026, answer A), against a
 * real schema. When a member's roles are paid through separate applications,
 * each role's pay scales by its share of their time, from the split they set
 * on their roles card. The member sees the scaled pay on their invoice; a
 * Treasurer sees each line's base pay, share and scaled amount and confirms
 * them before Finance approval can pass. Each case:
 *
 *   apart, whole split   the draft and the sent invoice are scaled; approval
 *                        is refused until confirmed; only a cash.pay holder
 *                        confirms; confirming keeps the work approval; the
 *                        cash owed rows carry the scaled amounts
 *   no split             pay is the terms; nothing to confirm
 *   split not 100        pay is the terms (fails closed)
 *   one pay              one application for both roles: pay is the terms
 *   split + proposal     a Treasurer's proposed amount on a scaled line is
 *                        confirmed and paid, never deadlocked (QA F1)
 *   stale confirm        a confirm carrying amounts that moved is refused, and
 *                        the write only lands on the lines it read (QA F2)
 *   own pay              a cash.pay holder never confirms their own split (QA F8)
 *
 * Every person here is invented.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { LUNAR_CLOCK } from "../../shared/cycleClock";
import { APPROVAL_REFUSALS, MOON_ROUTES, seenAmountsOf } from "../../shared/moonRecap";
import * as store from "../repos/moonRecaps";
import { moonOf } from "./moonRecap";
import { register } from "../routes/moonRecaps";
import { cashSeatsWithoutTerms, unpricedSeatsLaunchCheck } from "./cashOwed";

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
// Each agreement is priced at 50%, the member gives 50% in all (`split` below): a 60/40 split gives the water
// role 30% of them against its 50%, so it pays 60% of its terms. No double cut (Rye, 15 Nov 2026).
const PAY = JSON.stringify({ v: 1, pay: { kind: "fixed", currency: "USD", amountMinor: 100000, per: "moon" }, clocks: { commitmentPct: 50 } });

describe.skipIf(!configured)("pay scaled by the split, against a real schema", () => {
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
    for (const id of ["m-wren", "m-ops", "m-fin", "m-treas", "m-ash", "m-hand"]) {
      await q("INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `handle`) VALUES (?,?,?,'x',?)", [id, id.slice(2), `${id}@example.test`, id.slice(2)]); // module-review-ok: fixture SQL
    }
    await q("INSERT INTO `org_roles` (`id`, `name`, `accountabilities`) VALUES ('r-water', 'Water keeper', ?), ('r-garden', 'Garden keeper', ?)", [JSON.stringify(["Keep the water clean"]), JSON.stringify(["Tend the beds"])]); // module-review-ok: fixture SQL
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
    for (const t of ["moon_recap_items", "moon_invoices", "moon_recaps", "moon_review_events", "member_pay_routes", "cash_owed", "app_config", "member_commitments", "org_role_assignments", "seat_applications"]) {
      await q(`DELETE FROM \`${t}\``); // module-review-ok: fixture SQL
    }
    await q("INSERT INTO `app_config` (`config_key`, `value`) VALUES ('payers', ?), ('moon-review-settings', ?)", [JSON.stringify(PAYERS), JSON.stringify(SETTINGS)]); // module-review-ok: fixture SQL
    await q( // module-review-ok: fixture SQL
      "INSERT INTO `member_pay_routes` (`user_id`, `route`, `payer_key`, `legal_name`, `address`, `tax_form_kind`, `invoice_seq`, `confirmed_at`, `confirmed_by`) VALUES ('m-wren', 'abroad', 'holding', 'Wren Alder', '2 Example Lane', 'none', 0, UTC_TIMESTAMP(), 'm-fin')",
    );
  });

  /** Seat m-wren in both roles: through two applications (apart) or one (together). */
  const seat = async (how: "apart" | "together") => {
    const apps = how === "apart" ? [["app-water", ["a-water"]], ["app-garden", ["a-garden"]]] : [["app-both", ["a-water", "a-garden"]]];
    for (const [id, seats] of apps) {
      await q( // module-review-ok: fixture SQL
        "INSERT INTO `seat_applications` (`id`, `candidate_user_id`, `proposed_by`, `seat_ids`, `settings_json`, `settings_hash`, `term_ends_at`, `status`) VALUES (?, 'm-wren', 'm-wren', ?, ?, ?, '2027-06-01 00:00:00', 'adopted')",
        [id, JSON.stringify(seats), PAY, "0".repeat(64)],
      );
    }
    for (const [seatId, roleId] of [["a-water", "r-water"], ["a-garden", "r-garden"]]) {
      const app = how === "apart" ? (roleId === "r-water" ? "app-water" : "app-garden") : "app-both";
      await q( // module-review-ok: fixture SQL
        "INSERT INTO `org_role_assignments` (`id`, `org_role_id`, `holder_kind`, `user_id`, `holder_key`, `started_at`, `application_id`) VALUES (?, ?, 'member', 'm-wren', 'm-wren', '2026-09-01 12:00:00', ?)",
        [seatId, roleId, app],
      );
    }
  };
  const split = async (shares: Array<[string, number]>) => {
    await q( // module-review-ok: fixture SQL
      "INSERT INTO `member_commitments` (`user_id`, `pct`, `from_date`, `period_kind`, `note`, `split_json`) VALUES ('m-wren', 50, '2026-09-01', 'season', NULL, ?)",
      [JSON.stringify(shares.map(([roleId, share]) => ({ roleId, share })))],
    );
  };
  const draft = async () => {
    as("m-wren");
    const out = await call(`GET ${MOON_ROUTES.myMoon}`, { query: { cycle: CYCLE } });
    expect(out.status).toBe(200);
    return out.body.invoice;
  };
  const sendAll = async () => {
    as("m-wren");
    expect((await call(`POST ${MOON_ROUTES.addItem}`, { params: { cycle: CYCLE }, body: { text: "Fixed the pump", roleId: "r-water", accountabilityWords: "Keep the water clean" } })).status).toBe(201);
    expect((await call(`POST ${MOON_ROUTES.sendRecap}`, { params: { cycle: CYCLE }, body: {} })).status).toBe(200);
    const sent = await call(`POST ${MOON_ROUTES.sendInvoice}`, { params: { cycle: CYCLE }, body: { attestation: ATTEST, pilotAckVersion: "v1", memberNumber: "INV-7" } });
    expect(sent.status).toBe(200);
    return sent.body.invoice;
  };
  const queueRow = async () => {
    const out = await call(`GET ${MOON_ROUTES.queue}`, { query: { cycle: CYCLE } });
    expect(out.status).toBe(200);
    return out.body.rows.find((r: any) => r.userId === "m-wren");
  };
  const approveWork = async () => {
    as("m-ops");
    const row = await queueRow();
    expect((await call(`POST ${MOON_ROUTES.work}`, { params: { recap: row.recapId }, body: { hash: row.hash, items: [] } })).status).toBe(200);
  };
  const approveInvoice = async (by = "m-fin") => {
    as(by);
    const row = await queueRow();
    return call(`POST ${MOON_ROUTES.approveInvoices}`, { body: { invoices: [{ id: row.invoice.id, hash: row.hash, expectedOn: "2026-11-20" }] } });
  };
  /** Confirm as `by`, carrying the amounts the Treasurer saw: the invoice's lines as stored, unless given (QA F2). */
  const confirm = async (by: string, id: string, amounts?: Record<string, number | null>) => {
    const [row] = await q("SELECT `lines_json` FROM `moon_invoices` WHERE `id` = ?", [id]); // module-review-ok: fixture SQL
    as(by);
    return call(`POST ${MOON_ROUTES.confirmSplit}`, { params: { id }, body: { amounts: amounts ?? (row ? seenAmountsOf(JSON.parse(row.lines_json)) : {}) } });
  };
  const amounts = (inv: any) => inv.lines.map((l: any) => [l.roleNames.join(", "), l.amountMinor]).sort();

  it("apart, whole split: scaled on the draft and the invoice, refused until a Treasurer confirms, then paid as scaled", async () => {
    await seat("apart");
    await split([["r-water", 60], ["r-garden", 40]]);

    // The member sees their scaled pay per role before sending.
    const d = await draft();
    expect(amounts(d)).toEqual([["Garden keeper", 40000], ["Water keeper", 60000]]);
    expect(d.lines.find((l: any) => l.roleIds.includes("r-water")).split).toMatchObject({ sharePct: 60, givenPct: 30, pricedPct: 50, baseMinor: 100000, scaledMinor: 60000, confirmedAt: null });

    const sent = await sendAll();
    expect(sent.totalMinor).toBe(100000);
    expect(amounts(sent)).toEqual([["Garden keeper", 40000], ["Water keeper", 60000]]);
    await approveWork();

    // The Treasurer sees base, share and scaled on the queue row.
    as("m-fin");
    const row = await queueRow();
    expect(row.invoice.lines.map((l: any) => l.split && [l.split.baseMinor, l.split.sharePct, l.split.scaledMinor]).sort()).toEqual([[100000, 40, 40000], [100000, 60, 60000]]);

    // Nothing pays off the split until it is confirmed.
    const early = await approveInvoice();
    expect(early.body.refused).toEqual([{ id: row.invoice.id, reason: APPROVAL_REFUSALS.splitUnconfirmed }]);
    expect(await q("SELECT `id` FROM `cash_owed`")).toHaveLength(0); // module-review-ok: fixture SQL

    // Only someone who may act for Finance confirms; the work approver may not, nor the member.
    expect((await confirm("m-ops", row.invoice.id)).status).toBe(403);
    expect(await confirm("m-wren", row.invoice.id)).toEqual({ status: 403, body: { error: APPROVAL_REFUSALS.ownConfirm } });
    const ok = await confirm("m-fin", row.invoice.id);
    expect(ok).toEqual({ status: 200, body: { confirmed: row.invoice.id } });
    const events = (await q("SELECT `kind`, `actor_user_id`, `amount_minor` FROM `moon_review_events` WHERE `kind` = 'split_confirmed'")); // module-review-ok: fixture SQL
    expect(events).toEqual([{ kind: "split_confirmed", actor_user_id: "m-fin", amount_minor: 100000 }]);

    // Confirming changes no amount, so the work approval and the hash stand.
    const after = await queueRow();
    expect(after.hash).toBe(row.hash);
    expect(after.waitingOn).toBe("invoice");

    const paid = await approveInvoice();
    expect(paid.body.approved).toEqual([row.invoice.id]);
    const owed = (await q("SELECT `amount_minor` FROM `cash_owed` ORDER BY `amount_minor`")).map((r: any) => Number(r.amount_minor)); // module-review-ok: fixture SQL
    expect(owed).toEqual([40000, 60000]);
  });

  it("settlement owes nothing at the start of a moon to holders seated through applications or by hand, and the End of Moon invoice still approves (QA-1115 P0-2, pay defect 2)", async () => {
    // A $13,000 cash role, held by two people through adopted applications, and by one seated by hand.
    await q("UPDATE `org_roles` SET `cash_minor` = 1300000, `cash_currency` = 'USD' WHERE `id` = 'r-water'"); // module-review-ok: fixture SQL
    try {
      await seat("apart");
      await q( // module-review-ok: fixture SQL
        "INSERT INTO `seat_applications` (`id`, `candidate_user_id`, `proposed_by`, `seat_ids`, `settings_json`, `settings_hash`, `term_ends_at`, `status`) VALUES ('app-ash', 'm-ash', 'm-ash', ?, ?, ?, '2027-06-01 00:00:00', 'adopted')",
        [JSON.stringify(["a-ash"]), PAY, "0".repeat(64)],
      );
      await q( // module-review-ok: fixture SQL
        "INSERT INTO `org_role_assignments` (`id`, `org_role_id`, `holder_kind`, `user_id`, `holder_key`, `started_at`, `application_id`) VALUES ('a-ash', 'r-water', 'member', 'm-ash', 'm-ash', '2026-09-01 12:00:00', 'app-ash'), ('a-hand', 'r-water', 'member', 'm-hand', 'm-hand', '2026-09-01 12:00:00', NULL)",
      );
      // The hand-seated holder has no application, so no price and no commitment (pay defect 2): the seat is
      // listed for the Treasurer to set terms and owed nothing (the settlement side is server/workPay.test.ts).
      expect((await cashSeatsWithoutTerms(pool)).map((s) => [s.seatId, s.userId, s.roleName])).toEqual([["a-hand", "m-hand", "Water keeper"]]);
      const launchRow = await unpricedSeatsLaunchCheck(pool);
      expect(launchRow.state).toBe("partial");
      expect(launchRow.detail).toContain("1 person holds a cash role with no application: Water keeper");

      // The member's End of Moon invoice is not blocked by a settlement row, and pays its terms once approved.
      const sent = await sendAll();
      expect(amounts(sent)).toEqual([["Garden keeper", 100000], ["Water keeper", 100000]]);
      await approveWork();
      const row = await queueRow();
      const paid = await approveInvoice();
      expect(paid.body.approved).toEqual([row.invoice.id]);
      const owed = (await q("SELECT `user_id`, `amount_minor` FROM `cash_owed` WHERE `user_id` = 'm-wren' ORDER BY `amount_minor`")).map((r: any) => Number(r.amount_minor)); // module-review-ok: fixture SQL
      expect(owed).toEqual([100000, 100000]);
    } finally {
      await q("UPDATE `org_roles` SET `cash_minor` = NULL, `cash_currency` = NULL WHERE `id` = 'r-water'"); // module-review-ok: fixture SQL
    }
  });

  it("no split: pay is the terms, and there is nothing to confirm", async () => {
    await seat("apart");
    const sent = await sendAll();
    expect(amounts(sent)).toEqual([["Garden keeper", 100000], ["Water keeper", 100000]]);
    expect(sent.lines.every((l: any) => !l.split)).toBe(true);
    await approveWork();
    expect((await confirm("m-fin", sent.id)).body).toEqual({ error: APPROVAL_REFUSALS.noSplit });
    expect((await approveInvoice()).body.approved).toEqual([sent.id]);
  });

  it("a split that does not add up to 100 fails closed: pay is the terms", async () => {
    await seat("apart");
    await split([["r-water", 60], ["r-garden", 30]]);
    const sent = await sendAll();
    expect(amounts(sent)).toEqual([["Garden keeper", 100000], ["Water keeper", 100000]]);
    await approveWork();
    expect((await approveInvoice()).body.approved).toEqual([sent.id]);
  });

  it("one pay: both roles on one application are paid as the terms, split or not", async () => {
    await seat("together");
    await split([["r-water", 60], ["r-garden", 40]]);
    const sent = await sendAll();
    expect(sent.lines.map((l: any) => [[...l.roleIds].sort(), l.amountMinor])).toEqual([[["r-garden", "r-water"], 100000]]);
    expect(sent.lines.every((l: any) => !l.split)).toBe(true);
  });

  it("split, then a proposed amount on a scaled line: confirmed once, then paid as proposed (QA F1)", async () => {
    await seat("apart");
    await split([["r-water", 60], ["r-garden", 40]]);
    const sent = await sendAll();
    await approveWork();
    as("m-fin");
    const p = await call(`POST ${MOON_ROUTES.adjustPay}`, { params: { id: sent.id }, body: { applicationId: "app-water", amountMinor: 70000, reason: "Took on the pump rebuild." } });
    expect(p).toEqual({ status: 200, body: { voided: sent.id } });

    // The member sends again; the water line carries the split and the proposal on top of it.
    as("m-wren");
    expect((await call(`POST ${MOON_ROUTES.sendRecap}`, { params: { cycle: CYCLE }, body: {} })).status).toBe(200);
    const again = await call(`POST ${MOON_ROUTES.sendInvoice}`, { params: { cycle: CYCLE }, body: { attestation: ATTEST, pilotAckVersion: "v1", memberNumber: "INV-8" } });
    expect(again.status, JSON.stringify(again.body)).toBe(200);
    const water = again.body.invoice.lines.find((l: any) => l.applicationId === "app-water");
    expect(water).toMatchObject({ amountMinor: 70000, split: { scaledMinor: 60000 }, adjust: { baseMinor: 60000, adjustedMinor: 70000 } });
    await approveWork();

    // One Confirm covers the split and the proposal, then approval pays.
    as("m-fin");
    const row2 = await queueRow();
    expect((await approveInvoice()).body.refused).toHaveLength(1);
    expect(await confirm("m-treas", row2.invoice.id)).toEqual({ status: 200, body: { confirmed: row2.invoice.id } });
    expect((await approveInvoice()).body.approved).toEqual([row2.invoice.id]);
    const owed = (await q("SELECT `amount_minor` FROM `cash_owed` ORDER BY `amount_minor`")).map((r: any) => Number(r.amount_minor)); // module-review-ok: fixture SQL
    expect(owed).toEqual([40000, 70000]);
  });

  it("a confirm whose amounts moved is refused, and nothing is stamped (QA F2)", async () => {
    await seat("apart");
    await split([["r-water", 60], ["r-garden", 40]]);
    const sent = await sendAll();
    await approveWork();
    // The Treasurer saw a different water amount than the invoice now says.
    const stale = { ...seenAmountsOf(sent.lines), "app-water": 55000 };
    expect(await confirm("m-fin", sent.id, stale)).toEqual({ status: 409, body: { error: APPROVAL_REFUSALS.amountsChanged } });
    expect(await confirm("m-fin", sent.id, {})).toEqual({ status: 409, body: { error: APPROVAL_REFUSALS.amountsChanged } });
    const [row] = await q("SELECT `lines_json` FROM `moon_invoices` WHERE `id` = ?", [sent.id]); // module-review-ok: fixture SQL
    expect(JSON.parse(row.lines_json).every((l: any) => !l.split || l.split.confirmedAt === null)).toBe(true);
    expect(await q("SELECT `id` FROM `moon_review_events` WHERE `kind` = 'split_confirmed'")).toHaveLength(0); // module-review-ok: fixture SQL

    // The write itself only lands on the lines it read: lines changed in between leave it nothing to write.
    expect(await store.setInvoiceLinesIfUnchanged(pool, sent.id, "[]", row.lines_json, sent.totalMinor)).toBe(0);
    expect(await store.setInvoiceLinesIfUnchanged(pool, sent.id, row.lines_json, row.lines_json, sent.totalMinor)).toBe(1);
  });

  it("a cash.pay holder never confirms their own split (QA F8)", async () => {
    HOLDERS["cash.pay"] = ["m-fin", "m-treas", "m-wren"];
    try {
      await seat("apart");
      await split([["r-water", 60], ["r-garden", 40]]);
      const sent = await sendAll();
      await approveWork();
      expect(await confirm("m-wren", sent.id)).toEqual({ status: 403, body: { error: APPROVAL_REFUSALS.ownConfirm } });
      expect(await q("SELECT `id` FROM `moon_review_events` WHERE `kind` = 'split_confirmed'")).toHaveLength(0); // module-review-ok: fixture SQL
    } finally {
      HOLDERS["cash.pay"] = ["m-fin", "m-treas"];
    }
  });
});
