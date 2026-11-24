/**
 * THE SEND AND RECEIVE PAGE'S READS: who a member can pay, who they paid
 * lately, what a request link points at, and what they hold.
 *
 * The lead, 23 Nov 2026: members spend credits with each other and with
 * ventures, only ventures redeem, credits never expire, and one credit is
 * worth one unit of the currency the village has set for it. The page is
 * `/pay` (client/src/pages/Pay.tsx); the shared shapes are shared/payLink.ts.
 *
 * ── NOTHING HERE MOVES VALUE ────────────────────────────────────────────────
 *
 * The page sends through `POST /api/wallet/send`, the one member-send door,
 * which posts a single `postTransfer` under the client's nonce and refuses a
 * send to yourself, to a tombstone, to a standing example and past your
 * balance. This file only reads, so there is no second door to keep in step
 * with the first.
 *
 * ── THE PRIVACY LIMITS ON THE SEARCH ───────────────────────────────────────
 *
 * `/api/wallet/send` has long refused to ship a member DIRECTORY, because a
 * list of everyone's names readable by anyone signed in is a privacy surface
 * with its own question. The search answers it this way:
 *
 *   - signed in, and an accepted member, to ask at all; somebody not yet a
 *     member is paid by their request link or QR code;
 *   - at least `PAY_SEARCH_MIN` letters, and a PREFIX of a handle or of a word
 *     in a name, never a substring, so a search cannot list the village;
 *   - at most `PAY_SEARCH_LIMIT` answers, accepted members only, never the
 *     asker, a standing example or somebody who has left;
 *   - each answer is a handle and a name, both already printed on the public
 *     profile, and the id the send route takes: no address, no avatar;
 *   - `SEARCHES_PER_HOUR` per member, so walking the alphabet takes days.
 *
 * ── VENTURES ───────────────────────────────────────────────────────────────
 *
 * A venture's account is credits lane 1's (server/lib/orgAccounts.ts). A
 * venture appears here as a payee only while `ledger.org_accounts_open` is
 * on, and never to a member who runs it (a member never pays a venture they
 * run). Its name is all that is shown, the same names-only list
 * `GET /api/org-accounts` already answers any signed-in member, so ventures
 * are searchable by anybody signed in, member or not yet. The payment itself
 * goes to `POST /api/wallet/send { toOrg }`, lane 1's door. With the dial off
 * a venture's link answers that ventures cannot take payments yet.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { isAcceptedMember } from "../lib/applicantAccount";
import { departedRecipient } from "../lib/departed";
import { isExampleUser } from "../lib/examples";
import { latestPrice } from "../lib/exchange";
import { orgAccountsOpen, orgPayees } from "../lib/orgAccounts";
import { latestRates } from "../lib/fxRates";
import { balancesFor, memberAccount } from "../lib/ledger";
import { userIdForHandle } from "../lib/profile";
import { redemptionCurrencies, redemptionRateSource, resolveRedemptionRate } from "../lib/redemption";
import { sendableTokens } from "../lib/spending";
import { numberVar } from "../lib/variables";
import { liveSeatedRoleIds } from "../repos/orgAccounts";
import { recentSendCounterpartRows } from "../repos/tokenLedger";
import { payeeCandidateIds } from "../repos/users";
import { convertMinor, crossRate } from "../../shared/money";
import { ORG_SEND_SOURCE, orgRoleIdFromAccount } from "../../shared/orgAccounts";
import { PAY_RECENT_LIMIT, PAY_SEARCH_LIMIT, PAY_SEARCH_MIN, PAY_SEARCH_ORG_LIMIT, normaliseHandle, parseTarget, type Payee } from "../../shared/payLink";
import { EXCHANGE_PRICE_CURRENCY } from "./redemption";

type Deps = Pick<AppDeps, "authedUser" | "getPool" | "members" | "overLimit" | "projectCurrency">;

const HOUR_MS = 60 * 60 * 1000;
/** Searches one member may make in an hour. A search runs as they type, a little after they pause. */
export const SEARCHES_PER_HOUR = 60;
/** Request links one member may open in an hour. */
export const RESOLVES_PER_HOUR = 60;
/** Rows the search asks the table for before keeping accepted members only. */
const CANDIDATES = 24;

/** The same words for every refusal of a link that points nowhere. */
export const NOBODY_THERE = "Nobody here has that handle. Check the link with the person who sent it.";
export const OWN_LINK = "That is your own request link. Share it with the person paying you.";
export const ORG_NOT_YET = "Ventures cannot take payments here yet.";
export const NO_VENTURE_THERE = "No venture here takes payments by that link. Check it with the person who sent it.";
export const OWN_VENTURE = "That is a venture you run. Share its link with the person paying it.";
/** The ledger source a member-to-member send is written under (`POST /api/wallet/send`). */
const MEMBER_SEND_SOURCE = "member_send";
export const MEMBERS_SEARCH = "Searching for people is for members. Ask the person for their request link or QR code.";

/** A member as the page may show them. */
export function payeeOf(m: { id: unknown; handle?: unknown; name?: unknown }): Payee {
  const handle = normaliseHandle(m.handle);
  return { kind: "member", id: String(m.id), handle, name: String(m.name ?? "").trim() || (handle ? `@${handle}` : "A member") };
}

/** Somebody a payment may go to at all: present, not a demonstration, not the asker. */
function payable(m: any, askerId: string): boolean {
  return !!m && String(m.id) !== askerId && !departedRecipient(m) && !isExampleUser(m);
}

/**
 * The ventures this member may pay, as payees, or none while the village has
 * venture payments switched off. Names only (lane 1's `orgPayees`), and never
 * a venture the member runs.
 */
async function ventureList(pool: ReturnType<Deps["getPool"]>, askerId: string): Promise<Payee[]> {
  if (!orgAccountsOpen()) return [];
  const mine = new Set(await liveSeatedRoleIds(pool, askerId));
  return (await orgPayees(pool))
    .filter((v) => !mine.has(v.orgRoleId))
    .map((v) => ({ kind: "org" as const, id: v.orgRoleId, handle: null, name: v.label }));
}

/** Whether a venture's name has a word starting with what was typed. */
export function ventureMatches(name: string, q: string): boolean {
  const n = String(name ?? "").toLowerCase();
  return n.startsWith(q) || n.includes(` ${q}`);
}

/** What a search box held, as the search reads it: no @, lowercase, short. Null when too short to ask. */
export function searchTerm(raw: unknown): string | null {
  const q = String(raw ?? "").trim().replace(/^@+/, "").toLowerCase().slice(0, 40);
  return q.length >= PAY_SEARCH_MIN ? q : null;
}

/**
 * What one whole token is worth in money, as this village has set it, or null.
 *
 * THE SAME ANSWER A VENTURE IS QUOTED WHEN IT REDEEMS. The village says what a
 * credit is worth once, in the redemption dials (`redemption.currencies`,
 * `redemption.rate_source`, `redemption.rate_per_token`) or through the
 * exchange's posted price, and `resolveRedemptionRate` reads those. So "one
 * credit is one dollar" is set in one place and the send page, the venture's
 * quote and the record agree by construction. Null when nothing is set: the
 * page then shows credits alone, never a guessed price.
 */
export async function faceValueOf(
  pool: ReturnType<Deps["getPool"]>,
  slug: string,
  projectCurrency: string,
): Promise<{ currency: string; minorPerToken: number } | null> {
  const currencies = redemptionCurrencies(projectCurrency);
  const currency = currencies[0];
  const posted = await latestPrice(pool, slug).catch(() => null);
  const table = await latestRates(pool).catch(() => ({ base: "EUR", asOf: null, rates: {} as Record<string, number> }));
  const rate = resolveRedemptionRate({
    currency,
    postedPriceMinor: posted?.priceMinor ?? null,
    postedCurrency: EXCHANGE_PRICE_CURRENCY,
    setRatePerToken: numberVar("redemption.rate_per_token"),
    setRateCurrency: currency,
    source: redemptionRateSource(),
    convert: (amountMinor, from, to) => {
      const r = crossRate(table.rates, from, to);
      return r === null ? null : convertMinor(amountMinor, from, to, r);
    },
  });
  return rate && rate.minorPerToken > 0 ? { currency: rate.currency, minorPerToken: rate.minorPerToken } : null;
}

export function register(app: Express, deps: Deps): void {
  const { authedUser, getPool, members, overLimit, projectCurrency } = deps;

  /**
   * The page's own reads in one call: who is asking (their handle, for the
   * request link), what they can send and hold, what a credit is worth, and
   * the currency they chose to read money in.
   */
  app.get("/api/pay", async (req, res) => {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    const pool = getPool();
    const held = await balancesFor(pool, memberAccount(me.id));
    const tokens = [];
    for (const t of sendableTokens()) {
      tokens.push({
        slug: t.slug,
        name: t.name,
        decimals: t.decimals ?? 0,
        balance: Number(held[t.slug] ?? 0),
        face: await faceValueOf(pool, t.slug, String(projectCurrency() ?? "")),
      });
    }
    res.json({
      me: payeeOf(me),
      tokens,
      displayCurrency: String(me.prefs?.displayCurrency ?? "").trim().toUpperCase() || null,
      villageCurrency: String(projectCurrency() ?? "").trim().toUpperCase() || null,
    });
  });

  /** Accepted members whose handle, or a word of whose name, starts with what was typed. */
  app.get("/api/pay/people", async (req, res) => {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    const q = searchTerm(req.query.q);
    if (!q) return res.json({ people: [] });
    const pool = getPool();
    const member = await isAcceptedMember(me, pool);
    // Somebody not yet a member may still find a venture, whose name is public to anyone signed in.
    if (!member && !orgAccountsOpen()) return res.status(403).json({ error: MEMBERS_SEARCH });
    if (await overLimit(`pay-search:${me.id}`, SEARCHES_PER_HOUR, HOUR_MS)) {
      return res.status(429).json({ error: "That is a lot of searching. Try again in a little while, or ask for their link." });
    }
    const people: Payee[] = [];
    if (member) {
      for (const id of await payeeCandidateIds(pool, q, String(me.id), CANDIDATES)) {
        if (people.length >= PAY_SEARCH_LIMIT) break;
        const m = await members.byId(id);
        if (!payable(m, String(me.id)) || !(await isAcceptedMember(m, pool))) continue;
        people.push(payeeOf(m!));
      }
    }
    const ventures = (await ventureList(pool, String(me.id))).filter((v) => ventureMatches(v.name, q)).slice(0, PAY_SEARCH_ORG_LIMIT);
    res.json({ people: [...people, ...ventures] });
  });

  /** The people this member last sent to or received from, newest first. Never anybody else's. */
  app.get("/api/pay/recent", async (req, res) => {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    const pool = getPool();
    const rows = await recentSendCounterpartRows(pool, memberAccount(me.id), [MEMBER_SEND_SOURCE, ORG_SEND_SOURCE], PAY_RECENT_LIMIT * 2);
    // A venture comes back only while venture payments are open, and only one the member may still pay.
    const ventures = new Map((await ventureList(pool, String(me.id))).map((v) => [v.id, v]));
    const people: Payee[] = [];
    for (const r of rows) {
      if (people.length >= PAY_RECENT_LIMIT) break;
      const acct = String(r.counter_account ?? "");
      const venture = ventures.get(orgRoleIdFromAccount(acct) ?? "");
      if (venture) {
        people.push(venture);
        continue;
      }
      if (!acct.startsWith(memberAccount(""))) continue;
      const m = await members.byId(acct.slice(memberAccount("").length));
      if (payable(m, String(me.id))) people.push(payeeOf(m!));
    }
    res.json({ people });
  });

  /**
   * What a request link points at: `?to=@handle` answers that member's name
   * and handle. Anybody a link names may be paid, member or not yet, because
   * they shared the link themselves; the search is the members-only door.
   */
  app.get("/api/pay/resolve", async (req, res) => {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    if (await overLimit(`pay-resolve:${me.id}`, RESOLVES_PER_HOUR, HOUR_MS)) {
      return res.status(429).json({ error: "That is a lot of links in one hour. Try again in a little while." });
    }
    const target = parseTarget(req.query.to);
    if (!target) return res.status(400).json({ error: NOBODY_THERE });
    if (target.kind === "org") {
      if (!orgAccountsOpen()) return res.status(404).json({ error: ORG_NOT_YET });
      const ref = target.ref.toLowerCase();
      if ((await liveSeatedRoleIds(getPool(), String(me.id))).some((id) => id.toLowerCase() === ref)) {
        return res.status(409).json({ error: OWN_VENTURE });
      }
      const venture = (await ventureList(getPool(), String(me.id))).find((v) => v.id.toLowerCase() === ref);
      return venture ? res.json({ payee: venture }) : res.status(404).json({ error: NO_VENTURE_THERE });
    }
    const id = await userIdForHandle(getPool(), target.ref);
    if (id && id === String(me.id)) return res.status(409).json({ error: OWN_LINK });
    const m = id ? await members.byId(id) : null;
    if (!m || !payable(m, String(me.id))) return res.status(404).json({ error: NOBODY_THERE });
    res.json({ payee: payeeOf(m) });
  });
}
