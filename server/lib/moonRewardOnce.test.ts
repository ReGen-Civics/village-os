/**
 * SECURITY AUDIT, END OF MOON PAY (S1, S3), against a real schema.
 *
 *   once          a seat held on an adopted application's money terms is paid
 *                 its Credits by its End of Moon invoice, and the hourly
 *                 settlement pays it none: both doors run, one payment lands
 *   control       a seat whose terms carry no money is still paid by the
 *                 settlement, since its invoice shares nothing out
 *   paid first    a moon the settlement already paid (before this rule) owes
 *                 nothing more from the invoice in that token
 *   held equity   while the village has not written what Earned Equity means,
 *                 its share is recorded owed, refused at the ledger door, and
 *                 paid once the meaning is written
 *
 * Every person here is invented.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { LUNAR_CLOCK } from "../../shared/cycleClock";
import { MOON_ROUTES } from "../../shared/moonRecap";
import { SECTIONS_DOC_KEY } from "../../shared/roleCardSections";
import { moonOf } from "./moonRecap";
import { register } from "../routes/moonRecaps";
import { loadTokenRegistry, memberAccount } from "./ledger";
import { seedEconomy } from "./economySeed";
import { CREDITS, EARNED_EQUITY, EQUITY_MEANING_UNWRITTEN, faucetFor, fromLedgerUnits, keys, mint, runSettlement, toLedgerUnits, villageId } from "./economy";
import { loadVariables, setVariable } from "./variables";
import { lineRewardClaimId, MOON_REWARD_SOURCE, settleLineRewards } from "./moonReward";
import { PAY_BOARD_ROUTES } from "../../shared/moonRewardReview";
import { recordGameStart } from "./gameStart";

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
/** 6,500 a moon, the whole reward. */
const PAY = JSON.stringify({ v: 1, pay: { kind: "fixed", currency: "USD", amountMinor: 650_000, per: "moon" } });

describe.skipIf(!configured)("one seat-moon is paid its tokens once, and a held share is owed", () => {
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
    await h({ params: {}, body: {}, query: {}, get: () => undefined, ...req }, res);
    return out;
  };
  const as = (who: string) => { whoami = who; };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 6 });
    await loadTokenRegistry(pool);
    await seedEconomy(pool, villageId());
    await loadTokenRegistry(pool);
    await loadVariables(pool);
    for (const id of ["m-wren", "m-ops", "m-fin", "m-treas"]) {
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

  /** The village has written what Earned Equity means, or not. */
  const equityMeaning = async (words: string) => {
    await q("UPDATE `tokens` SET `description` = ? WHERE `slug` = ?", [words, EARNED_EQUITY]); // module-review-ok: fixture SQL
    await loadTokenRegistry(pool);
  };
  /** The role card's own split. */
  const cardShape = async (shares: Array<{ label: string; pct: number }>) => {
    await q("DELETE FROM `app_config` WHERE `config_key` = ?", [SECTIONS_DOC_KEY]); // module-review-ok: fixture SQL
    await q("INSERT INTO `app_config` (`config_key`, `value`) VALUES (?, ?)", [SECTIONS_DOC_KEY, JSON.stringify({ roles: { "r-water": { sections: { payShape: shares } } } })]); // module-review-ok: fixture SQL
  };
  const villageShape = async (setting: string) => {
    const set = await setVariable(pool, "org.pay_shape", setting);
    expect(set.ok, JSON.stringify(set)).toBe(true);
  };

  beforeEach(async () => {
    whoami = "m-wren";
    for (const t of ["moon_recap_items", "moon_invoices", "moon_recaps", "moon_review_events", "member_pay_routes", "cash_owed", "app_config", "org_role_assignments", "seat_applications", "moon_goals"]) {
      await q(`DELETE FROM \`${t}\``); // module-review-ok: fixture SQL
    }
    await q(`DELETE FROM \`token_ledger\` WHERE \`source\` = ?`, [MOON_REWARD_SOURCE]); // module-review-ok: fixture SQL
    await q("DELETE FROM `quest_owed_postings` WHERE `source` = ?", [MOON_REWARD_SOURCE]); // module-review-ok: fixture SQL
    await q("DELETE FROM `moon_reward_reviews`"); // module-review-ok: fixture SQL
    await q("DELETE FROM `token_ledger` WHERE `source` = 'role_cycle'"); // module-review-ok: fixture SQL
    await q("DELETE FROM `mint_rules` WHERE `village_id` = ? AND `trigger` = 'role.cycle'", [villageId()]); // module-review-ok: fixture SQL
    await q("UPDATE `org_roles` SET `value_tokens` = ? WHERE `id` = 'r-water'", [JSON.stringify([{ token: CREDITS, amount: 100 }])]); // module-review-ok: fixture SQL
    await villageShape("");
    await equityMeaning("A share of what the village builds together.");
    await recordGameStart(pool, { ballotId: "b-launch", startedBy: "m-ops", note: "Launched for the test." });
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

  const queueRow = async () => {
    const out = await call(`GET ${MOON_ROUTES.queue}`, { query: { cycle: CYCLE } });
    expect(out.status).toBe(200);
    return out.body.rows.find((r: any) => r.userId === "m-wren");
  };
  /** Recap, invoice, work approval: the invoice waits on Finance. */
  const sendAll = async () => {
    as("m-wren");
    expect((await call(`POST ${MOON_ROUTES.addItem}`, { params: { cycle: CYCLE }, body: { text: "Tested the water", roleId: "r-water", accountabilityWords: "Keep the water clean", state: "kept" } })).status).toBe(201);
    expect((await call(`POST ${MOON_ROUTES.sendRecap}`, { params: { cycle: CYCLE }, body: {} })).status).toBe(200);
    const sent = await call(`POST ${MOON_ROUTES.sendInvoice}`, { params: { cycle: CYCLE }, body: { attestation: ATTEST, pilotAckVersion: "v1", memberNumber: "INV-1" } });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    as("m-ops");
    const row = await queueRow();
    if (row.waitingOn === "work") expect((await call(`POST ${MOON_ROUTES.work}`, { params: { recap: row.recapId }, body: { hash: row.hash, items: [] } })).status).toBe(200);
    return sent.body.invoice;
  };
  const approve = async () => {
    as("m-fin");
    const row = await queueRow();
    return call(`POST ${MOON_ROUTES.approveInvoices}`, { body: { invoices: [{ id: row.invoice.id, hash: row.hash, expectedOn: "2026-11-20" }] } });
  };
  /** A Treasurer approves the invoice's token shares (each waits for that review, shared/moonRewardReview.ts). */
  const approveTokens = async () => {
    as("m-treas");
    const keys = (await q("SELECT `idempotency_key` FROM `quest_owed_postings` WHERE `source` = ?", [MOON_REWARD_SOURCE])).map((r: any) => String(r.idempotency_key)); // module-review-ok: fixture SQL
    const out = await call(`POST ${PAY_BOARD_ROUTES.approve}`, { body: { keys } });
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    return out;
  };
  const cashOwed = async () => (await q("SELECT `amount_minor` FROM `cash_owed` WHERE `user_id` = 'm-wren'")).map((r: any) => Number(r.amount_minor)); // module-review-ok: fixture SQL
  const issuedOf = async (token: string) =>
    Number((await q("SELECT COALESCE(SUM(`amount`), 0) AS n FROM `token_ledger` WHERE `source` = ? AND `token_type` = ? AND `to_account` = ?", [MOON_REWARD_SOURCE, token, memberAccount("m-wren")]))[0].n); // module-review-ok: fixture SQL
  const issued = async () => ({
    // Summed off the ledger's own rows for this door: the balance cache is not recomputed when a case clears them.
    equity: await issuedOf(EARNED_EQUITY),
    credits: await issuedOf(CREDITS),
    rows: Number((await q("SELECT COUNT(*) AS n FROM `token_ledger` WHERE `source` = ?", [MOON_REWARD_SOURCE]))[0].n), // module-review-ok: fixture SQL
  });
  const storedLines = async () => JSON.parse((await q("SELECT `lines_json` FROM `moon_invoices` WHERE `user_id` = 'm-wren' AND `status` = 'approved'"))[0].lines_json); // module-review-ok: fixture SQL

  /** A `role.cycle` rule that reads its Credits amount from the role, as a village paying seats would have. */
  const creditsRule = async () => {
    await q( // module-review-ok: fixture SQL
      "INSERT INTO `mint_rules` (`id`, `village_id`, `trigger`, `token_slug`, `amount`, `ceiling`, `recipient`, `enabled`, `effective_from_cycle`) VALUES ('once-credits', ?, 'role.cycle', ?, NULL, 0, 'holder', 1, 0)",
      [villageId(), CREDITS],
    );
  };
  /** The Credits this member was paid, by door. */
  const creditsBy = async (source: string) =>
    fromLedgerUnits(CREDITS, Number((await q("SELECT COALESCE(SUM(`amount`), 0) AS n FROM `token_ledger` WHERE `source` = ? AND `token_type` = ? AND `to_account` = ?", [source, CREDITS, memberAccount("m-wren")]))[0].n)); // module-review-ok: fixture SQL
  const approvedId = async () => (await q("SELECT `id` FROM `moon_invoices` WHERE `user_id` = 'm-wren' AND `status` = 'approved'"))[0].id as string; // module-review-ok: fixture SQL
  const AT = new Date("2026-10-20T12:00:00Z");

  it("both doors run for one seat-moon, and its Credits are paid once, by the invoice", async () => {
    await creditsRule();
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Credits", pct: 40 }]);
    const settled = await runSettlement(pool, AT);
    expect(settled.cycleKey).toBe(CYCLE);
    expect(await creditsBy("role_cycle")).toBe(0);
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    await approveTokens();
    // The settlement again, after the approval: still nothing from it.
    await runSettlement(pool, AT);
    expect(await creditsBy("role_cycle")).toBe(0);
    expect(await creditsBy(MOON_REWARD_SOURCE)).toBe(2600);
  });

  it("control: a seat whose terms carry no money is still paid its role's Credits by the settlement", async () => {
    await creditsRule();
    await q("UPDATE `seat_applications` SET `settings_json` = ? WHERE `id` = 'app-water'", [JSON.stringify({ v: 1, pay: { kind: "honorary" } })]); // module-review-ok: fixture SQL
    await runSettlement(pool, AT);
    expect(await creditsBy("role_cycle")).toBe(100);
  });

  it("a moon the settlement already paid owes nothing more from the invoice in that token", async () => {
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Credits", pct: 40 }]);
    // The settlement's own posting for this seat-moon, under its own key, as a run before this rule wrote it.
    const paid = await mint(pool, {
      toUserId: "m-wren",
      tokenSlug: CREDITS,
      amount: toLedgerUnits(CREDITS, 100),
      from: faucetFor(CREDITS)!,
      source: "role_cycle",
      sourceRef: "a-water",
      description: "Thanks for holding a role",
      idempotencyKey: keys.roleCycle(villageId(), CYCLE, "a-water", "m-wren", CREDITS),
    });
    expect(paid.ok, JSON.stringify(paid)).toBe(true);
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    expect(await q("SELECT `token_slug` FROM `quest_owed_postings` WHERE `claim_id` = ?", [lineRewardClaimId(await approvedId())])).toEqual([]); // module-review-ok: fixture SQL
    expect(await creditsBy(MOON_REWARD_SOURCE)).toBe(0);
    expect(await creditsBy("role_cycle")).toBe(100);
  });

  it("a held Earned Equity share is owed, refused until the meaning is written, then paid once", async () => {
    await equityMeaning("");
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    await approveTokens();
    const id = await approvedId();
    const rows = await q("SELECT `token_slug`, `units`, `state`, `refusal_reason`, `last_error` FROM `quest_owed_postings` WHERE `claim_id` = ?", [lineRewardClaimId(id)]); // module-review-ok: fixture SQL
    expect(rows.map((r: any) => [r.token_slug, r.state, r.refusal_reason, r.last_error])).toEqual([[EARNED_EQUITY, "owed", "equity_meaning", EQUITY_MEANING_UNWRITTEN]]);
    expect(fromLedgerUnits(EARNED_EQUITY, Number(rows[0].units))).toBe(2600);
    // Pressed again while still unwritten: nothing issues.
    expect((await settleLineRewards(pool, id)).map((o) => o.outcome)).toEqual(["still_owed"]);
    expect((await issued()).equity).toBe(0);
    await equityMeaning("A share of what the village builds together.");
    expect((await settleLineRewards(pool, id)).map((o) => o.outcome)).toEqual(["posted"]);
    expect(fromLedgerUnits(EARNED_EQUITY, (await issued()).equity)).toBe(2600);
    expect(await settleLineRewards(pool, id)).toEqual([]);
  });
});
