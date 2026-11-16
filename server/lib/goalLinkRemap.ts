/**
 * MOVE A SEASON'S LINKS FROM A GOAL ID IT NO LONGER HOLDS TO ONE IT DOES.
 *
 * WHY THIS EXISTS. A season goal is linked by its id (0298), and a proposal
 * that rewords a goal used to give it a NEW id (fixed by the lane that lets a
 * proposal keep a reworded goal's id). A rewording accepted before that fix
 * left the season holding the goal under a new id while every priority, share,
 * win, moon item, moon goal and tagged task still named the old one, so they
 * read as serving a goal that was removed. This is the repair: an admin names
 * the old id and the new one, and the season's own links move.
 *
 * THE RULES, each refused in words before anything is read:
 *   - `to` must be a goal the season holds today;
 *   - `from` must NOT be one it holds (moving links off a live goal would
 *     orphan them the other way);
 *   - only rows that BELONG to this season move. A goal id is not unique to one
 *     season: the season after it may hold the same goal, word for word, under
 *     the same id, and its links must stay where they are. So every row is
 *     placed in a season by its own record (`placeRow` below) with the same
 *     rule the moon recap uses (`seasonOn`), and a row placed anywhere else,
 *     or nowhere, is counted and left alone.
 *
 * IDEMPOTENT: a moved row no longer names `from`, so a second run reads none.
 * A dry run reads and counts and writes nothing.
 */
import type { Pool } from "mysql2/promise";
import { civilDateKey } from "../../shared/lunar";
import { boundsForNumber, parseId } from "../../shared/cycleClock";
import { moonDays } from "../../shared/moonRecap";
import { seasonOn } from "./moonRecap";
import { GOAL_ID_TABLES, linksNaming, moveLinks, type GoalLinkRow, type GoalLinkTable } from "../repos/goalLinkRemap";

export interface RemapSeason {
  id: string;
  name?: string;
  startsOn?: string;
  endsOn?: string;
  goals?: Array<{ id?: string; text?: string }>;
}

export interface RemapPair {
  from: string;
  to: string;
}

export interface PairResult {
  from: string;
  to: string;
  /** The words of the goal the links now name. */
  toWords: string;
  /** Rows of this season moved (or, in a dry run, that would move), per table. */
  tables: Record<GoalLinkTable, number>;
  moved: number;
  /** Rows naming `from` that belong to another season, left as they are. */
  otherSeasons: number;
  /** Rows naming `from` that no season contains (no date, or a date outside every season), left as they are. */
  unplaced: number;
  /** Other seasons that still hold `from` as a goal. Their links are never touched. */
  heldElsewhere: string[];
}

export type RemapResult =
  | { ok: true; seasonId: string; dryRun: boolean; pairs: PairResult[]; moved: number }
  | { ok: false; status: number; error: string; field?: string };

const GOAL_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const MAX_PAIRS = 20;

/** The pairs a request names: `{from, to}`, `{pairs: [...]}` or a bare list. */
export function readPairs(body: unknown): { ok: true; pairs: RemapPair[] } | { ok: false; error: string; field: string } {
  const b = body as Record<string, unknown> | unknown[] | null;
  const list: unknown[] = Array.isArray(b) ? b : Array.isArray((b as Record<string, unknown> | null)?.pairs) ? ((b as Record<string, unknown>).pairs as unknown[]) : b && typeof b === "object" && "from" in b ? [b] : [];
  if (!list.length) return { ok: false, error: "Name the goal id to move from and the goal id to move to, as {from, to}.", field: "from" };
  if (list.length > MAX_PAIRS) return { ok: false, error: `Move at most ${MAX_PAIRS} goals at once.`, field: "pairs" };
  const pairs: RemapPair[] = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i] as Record<string, unknown> | null;
    const from = typeof p?.from === "string" ? p.from.trim() : "";
    const to = typeof p?.to === "string" ? p.to.trim() : "";
    const at = list.length > 1 ? `pairs.${i}.` : "";
    if (!GOAL_ID.test(from)) return { ok: false, error: "from is a goal id, such as g1a2b3c4d5e6.", field: `${at}from` };
    if (!GOAL_ID.test(to)) return { ok: false, error: "to is a goal id, such as g1a2b3c4d5e6.", field: `${at}to` };
    if (from === to) return { ok: false, error: "from and to are the same goal, so there is nothing to move.", field: `${at}to` };
    if (pairs.some((q) => q.from === from)) return { ok: false, error: `${from} is named twice.`, field: `${at}from` };
    pairs.push({ from, to });
  }
  return { ok: true, pairs };
}

/**
 * The season a row belongs to, by the row's own record:
 *   a season id it carries (a moon recap's), else
 *   its moon: the season holding the moon's last day, as the moon recap reads it, else
 *   its instant or day: the season holding that village-calendar day.
 */
export function placeRow(row: GoalLinkRow, seasons: readonly RemapSeason[], timeZone: string): string | null {
  if (row.seasonId) return row.seasonId;
  let day: string | null = null;
  if (row.cycleId) {
    const parsed = parseId(row.cycleId);
    if (parsed?.cycleNumber != null) day = moonDays(boundsForNumber(parsed.cycleNumber), timeZone).lastDay;
  }
  if (!day && row.at && !Number.isNaN(row.at.getTime())) day = civilDateKey(row.at, timeZone || "UTC");
  if (!day && row.day) day = row.day;
  if (!day) return null;
  return seasonOn(seasons, day)?.id ?? null;
}

const zeroTables = (): Record<GoalLinkTable, number> => Object.fromEntries(GOAL_ID_TABLES.map((t) => [t, 0])) as Record<GoalLinkTable, number>;

/** Check the pairs against the season, then move (or count) every link that belongs to it. */
export async function remapGoalLinks(
  pool: Pool,
  input: { seasonId: string; seasons: readonly RemapSeason[]; timeZone: string; pairs: readonly RemapPair[]; dryRun: boolean },
): Promise<RemapResult> {
  const season = input.seasons.find((s) => s.id === input.seasonId);
  if (!season) return { ok: false, status: 404, error: "There is no season by that id.", field: "seasonId" };
  const held = new Map((season.goals ?? []).filter((g) => g.id).map((g) => [String(g.id), String(g.text ?? "")]));
  for (let i = 0; i < input.pairs.length; i++) {
    const p = input.pairs[i];
    const at = input.pairs.length > 1 ? `pairs.${i}.` : "";
    if (!held.has(p.to)) return { ok: false, status: 400, error: `${p.to} is not a goal ${season.name ?? season.id} holds, so links cannot move to it.`, field: `${at}to` };
    if (held.has(p.from)) return { ok: false, status: 400, error: `${p.from} is still a goal ${season.name ?? season.id} holds. Its links already point at a live goal.`, field: `${at}from` };
  }

  const conn = await pool.getConnection();
  try {
    if (!input.dryRun) await conn.beginTransaction();
    const pairs: PairResult[] = [];
    for (const p of input.pairs) {
      const toWords = held.get(p.to) ?? "";
      const result: PairResult = {
        from: p.from,
        to: p.to,
        toWords,
        tables: zeroTables(),
        moved: 0,
        otherSeasons: 0,
        unplaced: 0,
        heldElsewhere: input.seasons.filter((s) => s.id !== season.id && (s.goals ?? []).some((g) => g.id === p.from)).map((s) => s.id),
      };
      for (const table of GOAL_ID_TABLES) {
        const rows = await linksNaming(conn, table, p.from);
        const mine: string[] = [];
        for (const row of rows) {
          const placed = placeRow(row, input.seasons, input.timeZone);
          if (placed === season.id) mine.push(row.id);
          else if (placed) result.otherSeasons += 1;
          else result.unplaced += 1;
        }
        const n = input.dryRun ? mine.length : await moveLinks(conn, table, mine, p.from, { id: p.to, text: toWords });
        result.tables[table] = n;
        result.moved += n;
      }
      pairs.push(result);
    }
    if (!input.dryRun) await conn.commit();
    return { ok: true, seasonId: season.id, dryRun: input.dryRun, pairs, moved: pairs.reduce((a, p) => a + p.moved, 0) };
  } catch (err) {
    if (!input.dryRun) await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
}
