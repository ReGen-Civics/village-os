/**
 * END OF MOON PAYS THE TOTAL REWARD IN ITS PARTS (Rye, 15 Nov 2026, P1-6:
 * "Total reward"), against a real schema. A confirmed line is shared by the
 * role's split: only the cash share is owed as cash, and the Earned Equity and
 * Credits shares are issued through the ledger, once per line.
 *
 *   60/40           a 6,500 line at Cash 60, Equity 40 owes 3,900 cash and
 *                   issues 2,600 Earned Equity; the member's invoice and the
 *                   Treasurer's queue both show the parts beside the total
 *   once            approving again issues nothing, and issuing the same
 *                   lines again writes no ledger row
 *   100% cash       a village whose split is all cash owes the whole line in
 *                   cash and issues no token
 *   before launch   approved before the launch vote, the shares stay owed
 *                   and are paid, once, after the Game starts
 *   meaning unset   while the village has not written what Earned Equity
 *                   means, its share is held: neither issued nor paid as cash
 *   review          (Rye, 15 Nov 2026) each share waits for a Treasurer or a
 *                   founder: approved as shared, or changed up or down with a
 *                   reason the member reads and answers; a changed amount is
 *                   approved by somebody else while two or more may; only then
 *                   does it issue, or, before launch, read "issues at launch"
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
import { CREDITS, EARNED_EQUITY, fromLedgerUnits, toLedgerUnits, villageId } from "./economy";
import { loadVariables, setVariable } from "./variables";
import { lineRewardClaimId, MOON_REWARD_SOURCE, retryOwedLineRewards, settleLineRewards, settleOwedLineRewards } from "./moonReward";
import { rewardShareLine } from "../../shared/rewardShare";
import { recordGameStart } from "./gameStart";
import { PAY_BOARD_ROUTES, REWARD_NOTICE_WORDS, REWARD_REVIEW_REFUSALS, monthOf } from "../../shared/moonRewardReview";
import { recordCashTransfer } from "./cashOwed";
import { forgetMoonReviews } from "../repos/moonRecaps";

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
const HOLDERS: Record<string, string[]> = { "moon.approve": ["m-ops"], "cash.pay": ["m-fin", "m-treas"], "steward.veto": [] };
/** 6,500 a moon, the whole reward. */
const PAY = JSON.stringify({ v: 1, pay: { kind: "fixed", currency: "USD", amountMinor: 650_000, per: "moon" } });

describe.skipIf(!configured)("End of Moon pays the total reward in its parts, against a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let whoami: string | null = null;
  const notices: Array<{ userId: string; title: string; body?: string | null }> = [];
  const handlers = new Map<string, Handler>();
  const q = async (sql: string, params: unknown[] = []) => (await pool.query<any[]>(sql, params))[0]; // module-review-ok: fixture SQL against the S5 scratch schema, never a production table

  const call = async (key: string, req: any = {}) => {
    const h = handlers.get(key);
    if (!h) throw new Error(`no handler for ${key}`);
    const out: { status: number; body: any } = { status: 200, body: undefined };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: unknown) { out.body = b; return res; } };
    const headers: Record<string, string> = req.headers ?? {};
    await h({ params: {}, body: {}, query: {}, headers, ...req }, res);
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
    for (const id of ["m-wren", "m-ops", "m-fin", "m-treas", "m-admin"]) {
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
      notify: async (n: any) => { notices.push(n); return {} as any; },
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
    HOLDERS["cash.pay"] = ["m-fin", "m-treas"];
    HOLDERS["steward.veto"] = [];
    notices.length = 0;
    await q("DELETE FROM `health_events` WHERE `text` LIKE 'moon_reward:%'"); // module-review-ok: fixture SQL
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
  const cashOwed = async () => (await q("SELECT `amount_minor` FROM `cash_owed` WHERE `user_id` = 'm-wren'")).map((r: any) => Number(r.amount_minor)); // module-review-ok: fixture SQL
  const issuedOf = async (token: string) =>
    Number((await q("SELECT COALESCE(SUM(`amount`), 0) AS n FROM `token_ledger` WHERE `source` = ? AND `token_type` = ? AND `to_account` = ?", [MOON_REWARD_SOURCE, token, memberAccount("m-wren")]))[0].n); // module-review-ok: fixture SQL
  const issued = async () => ({
    // Summed off the ledger's own rows for this door: the balance cache is not recomputed when a case clears them.
    equity: await issuedOf(EARNED_EQUITY),
    credits: await issuedOf(CREDITS),
    rows: Number((await q("SELECT COUNT(*) AS n FROM `token_ledger` WHERE `source` = ?", [MOON_REWARD_SOURCE]))[0].n), // module-review-ok: fixture SQL
  });
  /** The approved invoice's token lines, by key. */
  const rewardKeys = async () => (await q("SELECT `idempotency_key` FROM `quest_owed_postings` WHERE `source` = ? ORDER BY `idempotency_key`", [MOON_REWARD_SOURCE])).map((r: any) => String(r.idempotency_key)); // module-review-ok: fixture SQL
  /** A Treasurer approves every token line as it stands. */
  const approveTokens = async (who = "m-treas") => {
    as(who);
    return call(`POST ${PAY_BOARD_ROUTES.approve}`, { body: { keys: await rewardKeys() } });
  };
  const board = async (who = "m-treas") => {
    as(who);
    const out = await call(`GET ${PAY_BOARD_ROUTES.board}`, { query: { month: monthOf(new Date()) } });
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    return out.body.members.find((m: any) => m.userId === "m-wren");
  };
  const storedLines = async () => JSON.parse((await q("SELECT `lines_json` FROM `moon_invoices` WHERE `user_id` = 'm-wren' AND `status` = 'approved'"))[0].lines_json); // module-review-ok: fixture SQL

  it("a 6,500 line at a 60/40 split owes 3,900 cash and issues 2,600 Earned Equity, and shows the parts", async () => {
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    const before = await issued();
    const sent = await sendAll();
    // The payer is billed the cash share (call 2, PAYER_IS_BILLED); the line keeps the whole reward.
    expect(sent.totalMinor).toBe(390_000);
    expect(sent.lines[0].amountMinor).toBe(650_000);
    expect(sent.lines[0].reward).toMatchObject({ from: "card", cashMinor: 390_000, equityUnits: 2600, creditsUnits: 0 });
    // The Treasurer's queue carries the same parts, before anything is approved.
    as("m-fin");
    expect((await queueRow()).invoice.lines[0].reward).toMatchObject({ cashMinor: 390_000, equityUnits: 2600 });

    expect((await approve()).body.approved).toHaveLength(1);
    expect(await cashOwed()).toEqual([390_000]);
    // The share waits for the Treasurer's review, and issues once approved.
    expect(await issued()).toEqual(before);
    const ok = await approveTokens();
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.approved.map((a: any) => a.outcome)).toEqual(["issued"]);
    const after = await issued();
    expect(fromLedgerUnits(EARNED_EQUITY, after.equity - before.equity)).toBe(2600);
    expect(after.rows - before.rows).toBe(1);
    expect(after.credits).toBe(before.credits);
    const [line] = await storedLines();
    expect(line.reward).toMatchObject({ cashMinor: 390_000, equityUnits: 2600 });
    expect(line.cashOwedId).toBeTruthy();
  });

  it("a re-approve issues nothing twice, and issuing the same lines again writes no ledger row", async () => {
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    expect((await approveTokens()).status).toBe(200);
    const once = await issued();
    expect(once.rows).toBe(1);
    // The same approval again: refused, as it is no longer waiting, and nothing moves.
    as("m-fin");
    const [inv] = await q("SELECT `id` FROM `moon_invoices` WHERE `user_id` = 'm-wren' AND `status` = 'approved'"); // module-review-ok: fixture SQL
    const again = await call(`POST ${MOON_ROUTES.approveInvoices}`, { body: { invoices: [{ id: inv.id, hash: "x", expectedOn: "2026-11-20" }] } });
    expect(again.body.approved).toEqual([]);
    // Settling again, as the owed-postings press would: the row is posted, nothing moves.
    expect(await settleLineRewards(pool, inv.id)).toEqual([]);
    // And a replay of the posting itself is the ledger's duplicate, never a second issue.
    await q("UPDATE `quest_owed_postings` SET `state` = 'owed' WHERE `claim_id` = ?", [lineRewardClaimId(inv.id)]); // module-review-ok: fixture SQL
    expect((await settleLineRewards(pool, inv.id)).map((o) => o.outcome)).toEqual(["duplicate"]);
    expect(await issued()).toEqual(once);
    expect(await cashOwed()).toEqual([390_000]);
    // Approving the tokens again is refused by name, and nothing moves.
    expect((await approveTokens()).status).toBe(409);
    expect(await issued()).toEqual(once);
  });

  it("the contract's split comes first: what the card showed them when they applied", async () => {
    await cardShape([{ label: "Cash", pct: 100 }]);
    await q("UPDATE `seat_applications` SET `settings_json` = ? WHERE `id` = 'app-water'", [JSON.stringify({ v: 1, pay: { kind: "fixed", currency: "USD", amountMinor: 650_000, per: "moon", shape: [{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }] } })]); // module-review-ok: fixture SQL
    const sent = await sendAll();
    expect(sent.lines[0].reward).toMatchObject({ from: "contract", cashMinor: 390_000, equityUnits: 2600 });
    expect((await approve()).body.approved).toHaveLength(1);
    expect(await cashOwed()).toEqual([390_000]);
  });

  it("no split anywhere: all in cash, and the queue says so before anyone confirms", async () => {
    const sent = await sendAll();
    expect(sent.totalMinor).toBe(650_000);
    expect(sent.lines[0].reward).toMatchObject({ from: "none", cashMinor: 650_000, equityUnits: 0, creditsUnits: 0 });
    as("m-fin");
    const row = await queueRow();
    expect(rewardShareLine(row.invoice.lines[0].reward, "USD")).toBe("No split set: paid all in cash. Total reward US$6,500.");
    expect((await approve()).body.approved).toHaveLength(1);
    expect(await cashOwed()).toEqual([650_000]);
  });

  it("a 100%-cash village owes the whole line in cash and issues no token", async () => {
    await villageShape("Cash 100");
    const before = await issued();
    const sent = await sendAll();
    expect(sent.lines[0].reward).toMatchObject({ from: "village", cashMinor: 650_000, equityUnits: 0, creditsUnits: 0 });
    expect((await approve()).body.approved).toHaveLength(1);
    expect(await cashOwed()).toEqual([650_000]);
    expect(await issued()).toEqual(before);
  });

  it("before the launch vote the shares stay owed, and are paid once after the Game starts", async () => {
    await q("DELETE FROM `app_config` WHERE `config_key` = 'game-start'"); // module-review-ok: fixture SQL
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    const before = await issued();
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    expect(await cashOwed()).toEqual([390_000]);
    expect(await issued()).toEqual(before);
    const [inv] = await q("SELECT `id` FROM `moon_invoices` WHERE `user_id` = 'm-wren' AND `status` = 'approved'"); // module-review-ok: fixture SQL
    const owed = await q("SELECT `token_slug`, `units`, `state` FROM `quest_owed_postings` WHERE `claim_id` = ?", [lineRewardClaimId(inv.id)]); // module-review-ok: fixture SQL
    expect(owed.map((r: any) => [r.token_slug, r.state])).toEqual([[EARNED_EQUITY, "awaiting"]]);
    // Approved before the vote, it reads "issues at launch" and nothing moves yet.
    expect((await approveTokens()).body.approved.map((a: any) => a.outcome)).toEqual(["issues_at_launch"]);
    expect((await board()).tokens.map((t: any) => t.status)).toEqual(["issues_at_launch"]);
    expect(await issued()).toEqual(before);
    await recordGameStart(pool, { ballotId: "b-launch", startedBy: "m-ops", note: "Launched for the test." });
    expect((await settleLineRewards(pool, inv.id)).map((o) => o.outcome)).toEqual(["posted"]);
    expect(fromLedgerUnits(EARNED_EQUITY, (await issued()).equity - before.equity)).toBe(2600);
    expect(await settleLineRewards(pool, inv.id)).toEqual([]);
  });

  it("the launch closer's sweep pays what was approved before the vote, once, and nothing before it", async () => {
    await q("DELETE FROM `app_config` WHERE `config_key` = 'game-start'"); // module-review-ok: fixture SQL
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    const before = await issued();
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    expect((await approveTokens()).status).toBe(200);
    // The control: before the Game starts the sweep moves nothing, and the row stays owed.
    expect((await settleOwedLineRewards(pool)).map((o) => o.outcome)).toEqual(["still_owed"]);
    expect(await issued()).toEqual(before);
    await recordGameStart(pool, { ballotId: "b-launch", startedBy: "m-ops", note: "Launched for the test." });
    expect((await settleOwedLineRewards(pool)).map((o) => o.outcome)).toEqual(["posted"]);
    expect(fromLedgerUnits(EARNED_EQUITY, (await issued()).equity - before.equity)).toBe(2600);
    // Twice is safe: nothing is left owed.
    expect(await settleOwedLineRewards(pool)).toEqual([]);
  });

  it("the hourly retry waits for the Game, then pays what the close missed", async () => {
    await q("DELETE FROM `app_config` WHERE `config_key` = 'game-start'"); // module-review-ok: fixture SQL
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    const before = await issued();
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    expect((await approveTokens()).status).toBe(200);
    expect(await retryOwedLineRewards(pool)).toBe("the Game has not started");
    expect(await issued()).toEqual(before);
    // The Game starts and the closer's own sweep never ran (an error at the close): the retry pays it.
    await recordGameStart(pool, { ballotId: "b-launch", startedBy: "m-ops", note: "Launched for the test." });
    expect(await retryOwedLineRewards(pool)).toBe("1 posted, 0 still owed, 0 refused");
    expect(fromLedgerUnits(EARNED_EQUITY, (await issued()).equity - before.equity)).toBe(2600);
    expect(await retryOwedLineRewards(pool)).toBe("0 posted, 0 still owed, 0 refused");
  });

  it("while Earned Equity's meaning is unwritten its share is held: not issued, not paid as cash", async () => {
    await equityMeaning("");
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    const before = await issued();
    const sent = await sendAll();
    expect(sent.lines[0].reward).toMatchObject({ cashMinor: 390_000, equityUnits: 2600, equityHeld: true });
    expect((await approve()).body.approved).toHaveLength(1);
    expect(await cashOwed()).toEqual([390_000]);
    expect(await issued()).toEqual(before);
  });

  it("a share waiting for its review never issues, whoever sweeps: the launch, the retry or the approval's own settle", async () => {
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    const before = await issued();
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    const [inv] = await q("SELECT `id` FROM `moon_invoices` WHERE `user_id` = 'm-wren' AND `status` = 'approved'"); // module-review-ok: fixture SQL
    expect(await settleLineRewards(pool, inv.id)).toEqual([]);
    expect(await settleOwedLineRewards(pool)).toEqual([]);
    expect(await retryOwedLineRewards(pool)).toBe("0 posted, 0 still owed, 0 refused");
    expect(await issued()).toEqual(before);
    const row = await board();
    expect(row.tokens).toMatchObject([{ token: EARNED_EQUITY, sharedUnits: 2600, units: 2600, status: "waiting", ceiling: 3900 }]);
    expect(row.tokenTotals).toEqual([{ token: EARNED_EQUITY, waiting: 2600, approved: 0, issued: 0 }]);
  });

  /** The invoice's status, paid day and paid amount, read off its own row. */
  const invoiceRow = async () => (await q("SELECT `id`, `status`, `paid_on`, `paid_amount_minor` FROM `moon_invoices` WHERE `user_id` = 'm-wren'"))[0]; // module-review-ok: fixture SQL

  it("0% cash (all Earned Equity and Credits): Approved writes no cash row, and the invoice reads Paid once every share has issued (pay defect 1)", async () => {
    await cardShape([{ label: "Equity", pct: 60 }, { label: "Credits", pct: 40 }]);
    const before = await issued();
    const sent = await sendAll();
    expect(sent.totalMinor).toBe(0);
    expect(sent.lines[0].reward).toMatchObject({ cashMinor: 0, equityUnits: 3900, creditsUnits: 2600 });
    expect((await approve()).body.approved).toHaveLength(1);
    // Nothing for the transfers door: no cash row, and the shares wait on their review.
    expect(await cashOwed()).toEqual([]);
    expect((await invoiceRow()).status).toBe("approved");
    // One share approved: still not Paid, because the other has not issued.
    const keys = await rewardKeys();
    expect(keys).toHaveLength(2);
    const credits = keys.find((k) => k.endsWith(`:${CREDITS}`)) as string;
    const equity = keys.find((k) => k.endsWith(`:${EARNED_EQUITY}`)) as string;
    expect([credits, equity].every(Boolean)).toBe(true);
    as("m-treas");
    expect((await call(`POST ${PAY_BOARD_ROUTES.approve}`, { body: { keys: [equity] } })).body.approved.map((a: any) => a.outcome)).toEqual(["issued"]);
    expect((await invoiceRow()).status).toBe("approved");
    // The second share issues, through the ledger, and the invoice is Paid with nothing paid in cash.
    expect((await call(`POST ${PAY_BOARD_ROUTES.approve}`, { body: { keys: [credits] } })).body.approved.map((a: any) => a.outcome)).toEqual(["issued"]);
    const after = await issued();
    expect(fromLedgerUnits(EARNED_EQUITY, after.equity - before.equity)).toBe(3900);
    expect(fromLedgerUnits(CREDITS, after.credits - before.credits)).toBe(2600);
    expect(after.rows - before.rows).toBe(2);
    const row = await invoiceRow();
    expect(row.status).toBe("paid");
    expect(row.paid_on).toBeTruthy();
    expect(Number(row.paid_amount_minor)).toBe(0);
    expect(await cashOwed()).toEqual([]);
    const paidEvents = await q("SELECT `amount_minor` FROM `moon_review_events` WHERE `kind` = 'paid' AND `invoice_id` = ?", [row.id]); // module-review-ok: fixture SQL
    expect(paidEvents.map((e: any) => Number(e.amount_minor))).toEqual([0]);
    expect(notices.some((n) => n.userId === "m-wren" && n.title.startsWith("Your pay is sent on"))).toBe(true);
  });

  it("0% cash approved before the launch vote: Approved until the launch sweep issues its shares, then Paid once (pay defect 1)", async () => {
    await q("DELETE FROM `app_config` WHERE `config_key` = 'game-start'"); // module-review-ok: fixture SQL
    await cardShape([{ label: "Equity", pct: 100 }]);
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    expect((await approveTokens()).body.approved.map((a: any) => a.outcome)).toEqual(["issues_at_launch"]);
    expect((await invoiceRow()).status).toBe("approved");
    // CONTROL: before the Game starts the sweep issues nothing, and the invoice stays Approved.
    expect((await settleOwedLineRewards(pool)).map((o) => o.outcome)).toEqual(["still_owed"]);
    expect((await invoiceRow()).status).toBe("approved");
    await recordGameStart(pool, { ballotId: "b-launch", startedBy: "m-ops", note: "Launched for the test." });
    expect((await settleOwedLineRewards(pool)).map((o) => o.outcome)).toEqual(["posted"]);
    expect((await invoiceRow()).status).toBe("paid");
    // Twice is safe: nothing is left owed, and the invoice is Paid once.
    expect(await settleOwedLineRewards(pool)).toEqual([]);
    expect(await q("SELECT `id` FROM `moon_review_events` WHERE `kind` = 'paid'")).toHaveLength(1); // module-review-ok: fixture SQL
  });

  it("a cash share keeps its invoice on the transfers door: tokens issuing alone never mark it Paid", async () => {
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    expect((await approveTokens()).body.approved.map((a: any) => a.outcome)).toEqual(["issued"]);
    expect((await invoiceRow()).status).toBe("approved");
    expect(await cashOwed()).toEqual([390_000]);
  });

  it("a Treasurer changes the equity up with a reason; the member reads it and answers; somebody else approves it, and it issues as changed", async () => {
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    const before = await issued();
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    const [key] = await rewardKeys();
    as("m-fin");
    const set = await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key, units: 3000, reason: "A bonus for the filter rebuild." } });
    expect(set.status, JSON.stringify(set.body)).toBe(200);
    expect(notices.find((n) => n.userId === "m-wren" && n.title === REWARD_NOTICE_WORDS.changedTitle)?.body).toContain("2,600 is now 3,000. A bonus for the filter rebuild.");
    // The member sees the change and its reason, and answers it.
    as("m-wren");
    const mine = await call(`GET ${PAY_BOARD_ROUTES.mine}`);
    expect(mine.body.lines[0]).toMatchObject({ sharedUnits: 2600, units: 3000, status: "waiting", change: { by: "fin", reason: "A bonus for the filter rebuild." } });
    expect((await call(`POST ${PAY_BOARD_ROUTES.reply}`, { body: { key, text: "Thank you, that was a long week." } })).status).toBe(200);
    expect(notices.some((n) => n.userId === "m-fin" && String(n.body).includes("Thank you"))).toBe(true);
    // The member never approves their own, and whoever changed it does not approve it while another may.
    // The member holds no key, so the door refuses them before the rule would.
    expect((await approveTokens("m-wren")).body.message).toBe(REWARD_REVIEW_REFUSALS.liveKey);
    const self = await approveTokens("m-fin");
    expect(self.status).toBe(403);
    expect(self.body.error).toContain(REWARD_REVIEW_REFUSALS.otherApproves);
    expect(await issued()).toEqual(before);
    const ok = await approveTokens("m-treas");
    expect(ok.body.approved.map((a: any) => a.outcome)).toEqual(["issued"]);
    expect(fromLedgerUnits(EARNED_EQUITY, (await issued()).equity - before.equity)).toBe(3000);
    const row = await board();
    expect(row.tokens[0]).toMatchObject({ status: "issued", units: 3000, approvedBy: "treas", approvedAlone: false, memberReply: { text: "Thank you, that was a long week." } });
    // Issued is final: it can no longer change.
    as("m-fin");
    expect((await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key, units: 100, reason: "Too late." } })).status).toBe(409);
  });

  it("down is a change too, the cap holds it, and with one person who may approve they approve their own change, marked", async () => {
    HOLDERS["cash.pay"] = ["m-fin"];
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    const before = await issued();
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    const [key] = await rewardKeys();
    as("m-fin");
    // The pay cap of the whole line: 120% of 6,500 is 7,800, less the 3,900 cash.
    expect((await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key, units: 3901, reason: "Too much." } })).body.error).toBe(REWARD_REVIEW_REFUSALS.ceiling(3900));
    expect((await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key, units: 0, reason: "Nothing." } })).body.error).toBe(REWARD_REVIEW_REFUSALS.units);
    expect((await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key, units: 2000 } })).body.error).toBe(REWARD_REVIEW_REFUSALS.reason);
    expect((await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key, units: 2000, reason: "Part of the moon was leave." } })).status).toBe(200);
    const ok = await approveTokens("m-fin");
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(fromLedgerUnits(EARNED_EQUITY, (await issued()).equity - before.equity)).toBe(2000);
    expect((await board("m-fin")).tokens[0]).toMatchObject({ units: 2000, approvedAlone: true });
  });

  it("the board reads a month's cash as owed, then sent from escrow with its date, reference and who recorded it", async () => {
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    let row = await board();
    // An End of Moon line is owed as claimed: the member's invoice is the claim.
    expect(row.cash).toMatchObject([{ amountMinor: 390_000, currency: "USD", status: "claimed", sentAt: null }]);
    expect(row.cashTotals).toEqual([{ currency: "USD", owedMinor: 390_000, sentMinor: 0 }]);
    const sent = await recordCashTransfer(pool, "m-treas", { userId: "m-wren", ids: [row.cash[0].id], transferDate: new Date().toISOString().slice(0, 10), reference: "ESCROW-77" });
    expect(sent.ok, JSON.stringify(sent)).toBe(true);
    row = await board();
    expect(row.cash[0]).toMatchObject({ status: "sent", sentBy: "treas" });
    expect(row.cash[0].reference).toContain("ESCROW-77");
    expect(row.cashTotals).toEqual([{ currency: "USD", owedMinor: 0, sentMinor: 390_000 }]);
    // A month that does not read is refused by name.
    expect((await call(`GET ${PAY_BOARD_ROUTES.board}`, { query: { month: "2026-13" } })).status).toBe(400);
  });

  it("a member who leaves keeps the record of their token pay, without their own words", async () => {
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    const [key] = await rewardKeys();
    as("m-fin");
    expect((await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key, units: 2700, reason: "A small bonus." } })).status).toBe(200);
    as("m-wren");
    expect((await call(`POST ${PAY_BOARD_ROUTES.reply}`, { body: { key, text: "My own words." } })).status).toBe(200);
    await forgetMoonReviews(pool, "m-wren");
    const [r] = await q("SELECT `member_reply`, `units_set` FROM `moon_reward_reviews` WHERE `idempotency_key` = ?", [key]); // module-review-ok: fixture SQL
    expect(r.member_reply).toBeNull();
    expect(Number(r.units_set)).toBe(toLedgerUnits(EARNED_EQUITY, 2700));
  });

  it("S2 1: a change after an approval moves the share back to awaiting, so no payer issues the changed amount unapproved", async () => {
    await q("DELETE FROM `app_config` WHERE `config_key` = 'game-start'"); // module-review-ok: fixture SQL
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    const before = await issued();
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    const [key] = await rewardKeys();
    // One person approves it as shared: it is owed, waiting for the launch.
    expect((await approveTokens("m-fin")).body.approved.map((a: any) => a.outcome)).toEqual(["issues_at_launch"]);
    expect((await q("SELECT `state` FROM `quest_owed_postings` WHERE `idempotency_key` = ?", [key]))[0].state).toBe("owed"); // module-review-ok: fixture SQL
    // Then the same person raises it.
    as("m-fin");
    expect((await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key, units: 3500, reason: "A late bonus." } })).status).toBe(200);
    expect((await q("SELECT `state` FROM `quest_owed_postings` WHERE `idempotency_key` = ?", [key]))[0].state).toBe("awaiting"); // module-review-ok: fixture SQL
    await recordGameStart(pool, { ballotId: "b-launch", startedBy: "m-ops", note: "Launched for the test." });
    // The launch sweep and the hourly retry read owed rows only: nothing moves.
    expect(await settleOwedLineRewards(pool)).toEqual([]);
    expect(await retryOwedLineRewards(pool)).toBe("0 posted, 0 still owed, 0 refused");
    expect(await issued()).toEqual(before);
    // The person who changed it cannot approve it; somebody else does, and the changed amount issues.
    expect((await approveTokens("m-fin")).status).toBe(403);
    expect((await approveTokens("m-treas")).body.approved.map((a: any) => a.outcome)).toEqual(["issued"]);
    expect(fromLedgerUnits(EARNED_EQUITY, (await issued()).equity - before.equity)).toBe(3500);
  });

  it("S2 3: the cap is the whole line's, cash and both token shares together", async () => {
    await cardShape([{ label: "Cash", pct: 40 }, { label: "Equity", pct: 40 }, { label: "Credits", pct: 20 }]);
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    // 6,500 at 40/40/20: 2,600 cash, 2,600 EE, 1,300 Credits. The cap is 7,800 for the line.
    const row = await board();
    const eq = row.tokens.find((t: any) => t.token === EARNED_EQUITY);
    const cr = row.tokens.find((t: any) => t.token === CREDITS);
    expect([eq.ceiling, cr.ceiling]).toEqual([7800 - 2600 - 1300, 7800 - 2600 - 2600]);
    as("m-fin");
    expect((await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key: eq.key, units: 3900, reason: "Raised." } })).status).toBe(200);
    // Raising one share lowers what the other may reach: 7,800 less 2,600 cash less 3,900 EE.
    const refused = await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key: cr.key, units: 1301, reason: "Raised too." } });
    expect(refused.body.error).toBe(REWARD_REVIEW_REFUSALS.ceiling(1300));
  });

  it("S3 5: a share recorded before reviews, moved to awaiting, gets its review from the invoice and is reviewed like any other", async () => {
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    const before = await issued();
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    // As the migration leaves a share from before: awaiting, with no review row.
    await q("DELETE FROM `moon_reward_reviews`"); // module-review-ok: fixture SQL
    expect(await settleOwedLineRewards(pool)).toEqual([]);
    const row = await board();
    expect(row.tokens[0]).toMatchObject({ status: "waiting", sharedUnits: 2600, ceiling: 3900 });
    expect((await approveTokens("m-treas")).body.approved.map((a: any) => a.outcome)).toEqual(["issued"]);
    expect(fromLedgerUnits(EARNED_EQUITY, (await issued()).equity - before.equity)).toBe(2600);
  });

  it("S3 6 and 7: with only the member able to approve, the line says so; a lone approval is logged and told to the stewards", async () => {
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    HOLDERS["cash.pay"] = ["m-wren"];
    HOLDERS["steward.veto"] = ["m-ops"];
    await sendAll();
    as("m-fin");
    HOLDERS["cash.pay"] = ["m-fin", "m-wren"];
    expect((await approve()).body.approved).toHaveLength(1);
    HOLDERS["cash.pay"] = ["m-wren"];
    as("m-wren");
    const mine = await call(`GET ${PAY_BOARD_ROUTES.mine}`);
    expect(mine.body.lines[0].noApprover).toBe(true);
    expect(mine.body.noApproverWords).toContain("The stewards can seat another Treasurer");
    // One Treasurer besides the member: they change it and approve it alone, marked, logged and told.
    HOLDERS["cash.pay"] = ["m-fin", "m-wren"];
    const [key] = await rewardKeys();
    // Holding the key does not let the member approve their own line.
    expect((await approveTokens("m-wren")).body.error).toContain(REWARD_REVIEW_REFUSALS.ownPay);
    as("m-fin");
    expect((await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key, units: 2800, reason: "A small bonus." } })).status).toBe(200);
    expect((await approveTokens("m-fin")).status).toBe(200);
    const audit = await q("SELECT `text` FROM `health_events` WHERE `text` LIKE 'moon_reward:approved:%'"); // module-review-ok: fixture SQL
    expect(audit.map((r: any) => r.text)).toEqual([`moon_reward:approved:${key}:2800:alone`]);
    expect(notices.some((n) => n.userId === "m-ops" && n.title === REWARD_NOTICE_WORDS.aloneTitle && String(n.body).includes("2,800"))).toBe(true);
  });

  it("S3 8 and 10: an admin who holds no key through a seat is refused the board, and the connector is refused a write", async () => {
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    // The test gate passes everybody, as the admin pass would; a live seat is still required.
    as("m-admin");
    const out = await call(`GET ${PAY_BOARD_ROUTES.board}`, { query: { month: monthOf(new Date()) } });
    expect([out.status, out.body.message]).toEqual([403, REWARD_REVIEW_REFUSALS.liveKey]);
    as("m-treas");
    const viaConnector = await call(`POST ${PAY_BOARD_ROUTES.approve}`, { body: { keys: await rewardKeys() }, headers: { "x-village-connector": "1" } });
    expect([viaConnector.status, viaConnector.body.error]).toEqual([403, "person_only"]);
    as("m-treas");
    expect((await call(`GET ${PAY_BOARD_ROUTES.board}`, { query: { month: monthOf(new Date()) } })).body.truncated).toBe(false);
  });

  it("S3 11: a member who has left: their token pay no longer changes, and their words go", async () => {
    await cardShape([{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }]);
    await sendAll();
    expect((await approve()).body.approved).toHaveLength(1);
    const [key] = await rewardKeys();
    as("m-fin");
    expect((await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key, units: 2700, reason: "A small bonus." } })).status).toBe(200);
    await forgetMoonReviews(pool, "m-wren");
    const [r] = await q("SELECT `set_reason`, `member_reply` FROM `moon_reward_reviews` WHERE `idempotency_key` = ?", [key]); // module-review-ok: fixture SQL
    expect([r.set_reason, r.member_reply]).toEqual([null, null]);
    await q("UPDATE `users` SET `email` = 'gone-wren@anonymized.invalid' WHERE `id` = 'm-wren'"); // module-review-ok: fixture SQL
    try {
      const refused = await call(`POST ${PAY_BOARD_ROUTES.adjust}`, { body: { key, units: 2600, reason: "Back." } });
      expect([refused.status, refused.body.error]).toEqual([409, REWARD_REVIEW_REFUSALS.departed]);
    } finally {
      await q("UPDATE `users` SET `email` = 'm-wren@example.test' WHERE `id` = 'm-wren'"); // module-review-ok: fixture SQL
    }
  });
});
