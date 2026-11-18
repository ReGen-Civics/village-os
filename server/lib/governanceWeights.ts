/**
 * Voting weight, resolved and recorded (round 5, lane G1; GOV_DESIGN 2.2).
 *
 * Three modes, chosen by the founder-held `governance.weight_mode`:
 *
 *   equal   every electorate member weighs 1. One person, one vote.
 *   token   weight = the member's balance of `governance.weight_token` at
 *           ballot open, read from the ledger's recomputed token_balances
 *           (recompute, never increment — the cache is already the truth by
 *           the time this reads it). Platform-governed tokens only: a
 *           hypha-governed mirror is a display-only fact about Base, and
 *           weighting votes by it would make this platform the cap table's
 *           second source of truth.
 *   custom  weight = the member's governance_weights row. Absent row = 0,
 *           fail closed: nobody holds power an admin never assigned.
 *
 * Every custom-mode change appends to governance_weight_changes with a
 * REQUIRED note. The trail is member-visible by design: weights are power,
 * and hidden power ends here.
 */
import type { Pool, RowDataPacket } from "mysql2/promise";
import { tokenDef, memberAccount } from "./ledger";
import { isListedForTrade } from "./exchange";
import { boolVar, numberVar, stringVar } from "./variables";
import { capWeights, fewestHoldersForCap } from "../../shared/governanceShare";
import { capsInMinor, countedWeight, splitHeld, type SourceCaps } from "../../shared/voiceSourceCaps";
import { netMintedBySource } from "./heldBySource";
import { balancesOf } from "../repos/voiceLedger";

/**
 * The share arithmetic, re-exported so a server caller has ONE door to
 * everything about weight. It is pure and lives in `shared/` because the dry
 * run needs it and may not import this file: `shared/dryRun/` has no import
 * path to a connection, and this module opens one on its second line.
 */
export { capWeights, fewestHoldersForCap, shareOfTotal, topShares } from "../../shared/governanceShare";

export type WeightMode = "equal" | "token" | "custom";

/** The switch and the number for the cap on one member's weight (Rye, 2026-11-05). */
export const WEIGHT_CAP_ON_KEY = "governance.weight_cap_on";
export const WEIGHT_CAP_PCT_KEY = "governance.weight_cap_pct";

/**
 * The switches and numbers for the caps on weight BY SOURCE, in whole tokens
 * (shared/voiceSourceCaps.ts). Counted when a ballot opens, never clipped at
 * the mint.
 */
export const WEIGHT_CAP_CASH_ON_KEY = "governance.weight_cap_cash_on";
export const WEIGHT_CAP_CASH_KEY = "governance.weight_cap_cash";
export const WEIGHT_CAP_OTHER_ON_KEY = "governance.weight_cap_other_on";
export const WEIGHT_CAP_OTHER_KEY = "governance.weight_cap_other";
export const SOURCE_CAP_KEYS = [WEIGHT_CAP_CASH_ON_KEY, WEIGHT_CAP_CASH_KEY, WEIGHT_CAP_OTHER_ON_KEY, WEIGHT_CAP_OTHER_KEY] as const;

export interface WeightModeSnapshot {
  mode: WeightMode;
  /** The token slug when mode = token, else null. */
  token: string | null;
  /**
   * The cap on one member's share of the vote, in percent, when mode = token
   * and the cap is switched on. Null or absent means no cap, which is the
   * shipped posture, so a snapshot built before the cap existed reads the same.
   */
  capPct?: number | null;
  /**
   * The caps on what one member counts from cash and from other contributions,
   * in WHOLE tokens, each null while its switch is off. The whole field is null
   * or absent while both are off, so a village that never touches them reads
   * exactly as before and pays no extra read.
   */
  sourceCaps?: SourceCaps | null;
}

/**
 * What one roll member's weight was counted from, frozen beside the weight on
 * `ballot_electorate`. MINOR units, the weight's own. Present only when the
 * snapshot carries source caps.
 */
export interface WeightBasis {
  /** The member's whole balance of the weight token at open. */
  held: number;
  /** The part of it that came from cash. The rest came from other contributions. */
  heldCash: number;
  /** The caps it was counted under, null for one that was off. */
  capCash: number | null;
  capOther: number | null;
}

export interface RollEntry {
  userId: string;
  weight: number;
  basis?: WeightBasis | null;
}

function sourceCapsNow(): SourceCaps | null {
  const cash = boolVar(WEIGHT_CAP_CASH_ON_KEY) ? Math.max(0, numberVar(WEIGHT_CAP_CASH_KEY)) : null;
  const other = boolVar(WEIGHT_CAP_OTHER_ON_KEY) ? Math.max(0, numberVar(WEIGHT_CAP_OTHER_KEY)) : null;
  return cash === null && other === null ? null : { cash, other };
}

/**
 * The weight-mode snapshot the NEXT ballot would freeze, read off the
 * founder-held dials. The one place that decides it: `server/index.ts` passes
 * this to every route module through deps, and none of them rebuilds it.
 *
 * The cap rides the snapshot only in token mode, the same way the token does,
 * because it is only in token mode that one member's weight can grow without
 * a steward allocating it.
 */
export function weightModeNow(): WeightModeSnapshot {
  const raw = stringVar("governance.weight_mode");
  const mode: WeightMode = raw === "token" || raw === "custom" ? raw : "equal";
  if (mode !== "token") return { mode, token: null, capPct: null };
  const sourceCaps = sourceCapsNow();
  return {
    mode,
    token: stringVar("governance.weight_token").trim(),
    capPct: boolVar(WEIGHT_CAP_ON_KEY) ? numberVar(WEIGHT_CAP_PCT_KEY) : null,
    ...(sourceCaps ? { sourceCaps } : {}),
  };
}

const wholeNumber = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** The sentence about the caps by source, or null while both are off. */
export function sourceCapLine(snapshot: WeightModeSnapshot): string | null {
  const caps = snapshot.mode === "token" ? snapshot.sourceCaps : null;
  if (!caps || (caps.cash === null && caps.other === null)) return null;
  const parts: string[] = [];
  if (caps.cash !== null) parts.push(`${wholeNumber(caps.cash)} from cash put in`);
  if (caps.other !== null) parts.push(`${wholeNumber(caps.other)} from other contributions`);
  return (
    `When a ballot opens, it counts at most ${parts.join(" and at most ")} for any one member. ` +
    "Every balance stays as it was minted; only the count stops at the cap."
  );
}

/**
 * What a member reads about the caps, or null when there is nothing to say:
 * every switch is off, or the mode is not token, where the caps do nothing.
 */
export function weightCapLine(snapshot: WeightModeSnapshot): string | null {
  if (snapshot.mode !== "token") return null;
  const lines: string[] = [];
  const bySource = sourceCapLine(snapshot);
  if (bySource) lines.push(bySource);
  if (snapshot.capPct != null) {
    const share = `The cap is on: when a ballot opens, no member carries more than ${snapshot.capPct}% of the vote.`;
    // The same number `capWeights` switches on, so the sentence and the
    // arithmetic cannot disagree about where everyone starts to weigh the same.
    const fewest = fewestHoldersForCap(snapshot.capPct);
    lines.push(
      !(fewest > 1) || !Number.isFinite(fewest)
        ? share
        : `${share} With fewer than ${fewest} members holding weight, everyone weighs the same.`,
    );
  }
  return lines.length ? lines.join(" ") : null;
}

/**
 * Every weight on a WHOLE roll, as a ballot freezes it: `weightsFor`, then
 * the cap when the snapshot carries one.
 *
 * Its own function because the cap is a fact about the roll and never about
 * one member. `weightsFor` is also asked about a single member (a member's
 * own standing), and capping a roll of one would trim that member against
 * their own balance. Only a caller holding the whole roll may call this.
 */
export async function rollWeightsFor(
  pool: Pool,
  userIds: string[],
  snapshot: WeightModeSnapshot,
): Promise<Map<string, number>> {
  const weights = await weightsFor(pool, userIds, snapshot);
  if (snapshot.mode !== "token" || snapshot.capPct == null) return weights;
  return capWeights(weights, snapshot.capPct);
}

/**
 * The roll as a ballot freezes it, each member with their weight and, when
 * the snapshot carries caps by source, the basis that weight was counted from
 * (`ballot_electorate.held_weight` and the three beside it). The caps by
 * source run first, per member; the share cap then runs over the whole roll's
 * counted weights, exactly as `rollWeightsFor` does.
 */
export async function rollEntriesFor(
  pool: Pool,
  userIds: string[],
  snapshot: WeightModeSnapshot,
): Promise<RollEntry[]> {
  if (snapshot.mode !== "token" || !snapshot.sourceCaps) {
    const weights = await rollWeightsFor(pool, userIds, snapshot);
    return userIds.map((id) => ({ userId: id, weight: weights.get(id) ?? 0 }));
  }
  const counted = await tokenWeightsWithBasis(pool, userIds, snapshot);
  let weights = new Map(Array.from(counted.entries()).map(([id, c]) => [id, c.weight] as [string, number]));
  if (snapshot.capPct != null) weights = capWeights(weights, snapshot.capPct);
  return userIds.map((id) => ({ userId: id, weight: weights.get(id) ?? 0, basis: counted.get(id)?.basis ?? null }));
}

/**
 * One member's own standing: what a ballot opened now would count for them
 * (before the share cap, which is the roll's), and the whole balance it was
 * counted from. `held` is null outside token mode, where weight is no balance.
 */
export async function standingWeightFor(
  pool: Pool,
  userId: string,
  snapshot: WeightModeSnapshot,
): Promise<{ weight: number; held: number | null }> {
  if (snapshot.mode !== "token") {
    return { weight: (await weightsFor(pool, [userId], snapshot)).get(userId) ?? 0, held: null };
  }
  const c = (await tokenWeightsWithBasis(pool, [userId], snapshot)).get(userId);
  return { weight: c?.weight ?? 0, held: c?.basis?.held ?? c?.weight ?? 0 };
}

/**
 * Token-mode weights with the caps by source applied, and the basis of each.
 * The caller has already refused a token that may not weigh votes.
 */
async function tokenWeightsWithBasis(
  pool: Pool,
  userIds: string[],
  snapshot: WeightModeSnapshot,
): Promise<Map<string, { weight: number; basis: WeightBasis | null }>> {
  const out = new Map<string, { weight: number; basis: WeightBasis | null }>();
  if (userIds.length === 0) return out;
  const slug = snapshot.token ?? "";
  const problem = weightTokenProblem(slug);
  if (problem) throw new Error(problem);
  const accounts = userIds.map((id) => memberAccount(id));
  // The recomputed cache, read through the repo (recompute, never increment:
  // the cache is already the truth by the time this reads it).
  const byAccount = await balancesOf(pool, slug, accounts);
  const caps = snapshot.sourceCaps ? capsInMinor(snapshot.sourceCaps, tokenDef(slug)?.decimals ?? 0) : null;
  const net = caps ? await netMintedBySource(pool, slug, accounts) : new Map<string, Record<string, number>>();
  userIds.forEach((id, i) => {
    // A negative member balance cannot happen outside faucet accounts; the
    // clamp is belt to that braces so weight never goes below zero.
    const held = Math.max(0, byAccount.get(accounts[i]) ?? 0);
    if (!caps) {
      out.set(id, { weight: held, basis: null });
      return;
    }
    const split = splitHeld(held, net.get(accounts[i]) ?? {});
    out.set(id, {
      weight: countedWeight(split, caps).counted,
      basis: { held: split.held, heldCash: split.cash, capCash: caps.cash, capOther: caps.other },
    });
  });
  return out;
}

/**
 * Refuse a weight-token choice the engine may not conduct. Returns the
 * refusal sentence, or null when the token can weigh votes.
 *
 * ── WHY A LISTED TOKEN MAY NOT WEIGH A VOTE ─────────────────────────────────
 *
 * Until 2026-08-30 this refused exactly one thing, a hypha mirror, and the
 * reason was source-of-truth rather than power: weighting by a mirror would
 * make this platform the cap table's second author. That left every
 * platform-governed token eligible, INCLUDING one currently listed on the
 * exchange for a card payment. A founder pointing `governance.weight_token` at
 * the village's ordinary credit token, in `token` weight mode, turns every
 * dollar into voting weight, with nothing anywhere refusing it.
 *
 * So the rule the exchange states from its side ("the token that weighs votes
 * is not listed", `weightTokenListingProblem`) is stated here from this one:
 * a token that is listed does not weigh votes. Two doors, one rule, and
 * neither door can be reached without passing a check.
 *
 * THIS SIDE IS THE ONE THAT FAILS CLOSED IN THE GAP. The exchange's clause is
 * re-proven at boot and at every listing write; a founder who flips the mode
 * to `token` between two boots would otherwise have a listed weight token
 * until the next restart. This runs at every ballot open and inside
 * `weightsFor`, so during that gap the weights simply cannot be resolved and
 * no ballot opens.
 *
 * Deliberately NOT gated on `weight_mode`. Every caller already asks this only
 * when the mode is `token` (see `weightsFor` below), so re-reading the mode
 * here would add a second copy of that judgment and no safety.
 */
export function weightTokenProblem(slug: string): string | null {
  const def = tokenDef(slug);
  if (!def) return `No token called "${slug}" exists in this village's registry`;
  if (def.governance !== "platform") {
    return `${def.name} is governed on Hypha and only mirrored here. Voting weight reads platform-governed tokens only`;
  }
  if (isListedForTrade(slug)) {
    return (
      `${def.name} is listed on the exchange, so anybody can buy it. A token money can buy is not what weighs a vote. ` +
      `Take it off the exchange, or weigh votes with something else`
    );
  }
  return null;
}

/**
 * Resolve each member's weight under a mode. Members absent from the returned
 * map weigh 0 by contract; the caller decides whether a zero-weight member
 * still enters the electorate (they do: an electorate row with weight 0 keeps
 * the record of who was asked, while adding nothing to any tally).
 */
export async function weightsFor(
  pool: Pool,
  userIds: string[],
  snapshot: WeightModeSnapshot,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (userIds.length === 0) return out;
  if (snapshot.mode === "equal") {
    for (const id of userIds) out.set(id, 1);
    return out;
  }
  if (snapshot.mode === "token") {
    // The balance, counted up to the caps by source when the snapshot carries
    // them. Per member, so a member's own standing reads the same number the
    // roll will freeze for them (before the share cap, which is the roll's).
    (await tokenWeightsWithBasis(pool, userIds, snapshot)).forEach((c, id) => out.set(id, c.weight));
    return out;
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id, weight FROM governance_weights WHERE user_id IN (${userIds.map(() => "?").join(",")})`,
    userIds,
  );
  const byUser = new Map(rows.map((r) => [String(r.user_id), Number(r.weight)]));
  for (const id of userIds) out.set(id, Math.max(0, byUser.get(id) ?? 0));
  return out;
}

export interface WeightChangeInput {
  userId: string;
  weight: number;
  actorUserId: string;
  note: string;
}

/** What is wrong with a proposed allocation, or null. Shared by set and bulk. */
export function weightChangeProblem(input: { weight: unknown; note: unknown }): string | null {
  const w = Number(input.weight);
  if (!Number.isFinite(w) || w < 0) return "A weight must be zero or a positive number";
  if (w > 1_000_000_000) return "That weight is past any believable allocation. Check the number";
  const note = String(input.note ?? "").trim();
  if (!note) return "Every weight change carries a reason. Say why";
  if (note.length > 500) return "The reason runs past 500 characters";
  return null;
}

export interface WeightChangeResult {
  /** The audit row this write appended. The bell's dedupe key rides it. */
  changeId: string;
  /** What the member weighed before, or null when they had no row at all. */
  oldWeight: number | null;
  /** Whether the member's actual weight moved. A re-save of the same number
   *  appends a trail row (the act happened) and changes no power. */
  moved: boolean;
}

/**
 * Set one member's custom-mode weight and append the audit row, in one
 * transaction. The current-state upsert and the trail row commit together or
 * never: an allocation the trail cannot explain must not exist.
 *
 * Returns what changed, because the member whose power moved has to be TOLD
 * and the caller cannot work either fact out afterwards: the previous weight
 * is gone the moment this commits, and the trail row's id is what makes the
 * notice dedupe per change instead of collapsing every future change into
 * one row that is never seen again.
 */
export async function setWeight(pool: Pool, input: WeightChangeInput): Promise<WeightChangeResult> {
  const problem = weightChangeProblem(input);
  if (problem) throw new Error(problem);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [prev] = await conn.query<RowDataPacket[]>(
      "SELECT weight FROM governance_weights WHERE user_id = ? FOR UPDATE",
      [input.userId],
    );
    const oldWeight = prev[0] ? Number(prev[0].weight) : null;
    await conn.query( // module-review-ok: the weight tables' one enumerable home; state and trail commit in one transaction here and nowhere else
      "INSERT INTO governance_weights (user_id, weight) VALUES (?,?) ON DUPLICATE KEY UPDATE weight = VALUES(weight)",
      [input.userId, input.weight],
    );
    const [trail] = await conn.query<any>( // module-review-ok: the weight tables' one enumerable home; state and trail commit in one transaction here and nowhere else
      "INSERT INTO governance_weight_changes (user_id, old_weight, new_weight, actor_user_id, note) VALUES (?,?,?,?,?)",
      [input.userId, oldWeight, input.weight, input.actorUserId, input.note.trim()],
    );
    await conn.commit();
    return {
      changeId: String(trail?.insertId ?? ""),
      oldWeight,
      // An absent row and a stored zero are the same amount of power, so
      // going from one to the other moved nothing and is not news.
      moved: (oldWeight ?? 0) !== input.weight,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export interface WeightChangeRow {
  id: string;
  userId: string;
  oldWeight: number | null;
  newWeight: number;
  actorUserId: string;
  note: string;
  at: string;
}

/** The append-only trail, newest first. One member's, or everyone's. */
export async function weightHistory(pool: Pool, userId?: string, limit = 200): Promise<WeightChangeRow[]> {
  const capped = Math.max(1, Math.min(500, limit));
  const [rows] = userId
    ? await pool.query<RowDataPacket[]>(
        "SELECT * FROM governance_weight_changes WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT ?",
        [userId, capped],
      )
    : await pool.query<RowDataPacket[]>(
        "SELECT * FROM governance_weight_changes ORDER BY at DESC, id DESC LIMIT ?",
        [capped],
      );
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    oldWeight: r.old_weight === null ? null : Number(r.old_weight),
    newWeight: Number(r.new_weight),
    actorUserId: String(r.actor_user_id),
    note: String(r.note),
    at: r.at instanceof Date ? r.at.toISOString() : String(r.at),
  }));
}

/** Current custom-mode allocations, for the admin table and the member trail. */
export async function allWeights(pool: Pool): Promise<Map<string, number>> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT user_id, weight FROM governance_weights");
  return new Map(rows.map((r) => [String(r.user_id), Number(r.weight)]));
}
