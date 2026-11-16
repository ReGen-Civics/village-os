/**
 * SEASON CREW, THE DOORS. Registered from server/routes/seasonPlaces.ts, so
 * the season places module's gate stands in front of every one of them.
 *
 *   GET  /api/season-places/crew                      the season's circles, berths, my application, and the pool for a picker
 *   POST /api/season-places/crew/apply                apply to sail this season (or change the circle wanted, or the words)
 *   POST /api/season-places/crew/:id/pick             a circle's picker picks an applicant for the circle
 *   POST /api/season-places/crew/:id/release          the circle that picked them hands them back to the pool
 *   POST /api/season-places/crew/:id/withdraw         the applicant takes their application back
 *   PUT  /api/season-places/crew/circles/:circleId/berths   a circle's picker sets its berths for the season
 *
 * Every season starts fresh, so nothing here reads earlier seasons.
 *
 * WHO SEES WHAT. Any signed-in member sees each circle, who picks for it and
 * the counts. The pool, with names and what people wrote, is for the people
 * who pick; an applicant sees their own.
 */
import type { Express } from "express";
import {
  BERTHS_MAX,
  CREW_NOTICES,
  CREW_REFUSALS,
  CREW_STATUS_WORDS,
  berthsLeft,
  crewSeasons,
  parseBerths,
} from "../../shared/seasonCrew";
import { parseWords, targetSeasonOf, type PlaceSeason } from "../../shared/seasonPlaces";
import type { AppDeps } from "../lib/appDeps";
import type { NotifyInput } from "../lib/notify";
import type { LapseContext } from "../lib/orgChart";
import { crewDials, pickerRoles, pickersByCircle, pickersOf } from "../lib/seasonCrew";
import { seasonName } from "../lib/seasonPlaces";
import {
  CREW_APPLICATION_ID,
  applicationOf,
  berthsOf,
  circlesTakingPart,
  pickOn,
  pickedCount,
  readCrewApplication,
  releaseOn,
  seasonPool,
  setBerths,
  upsertApplication,
  withdrawApplication,
} from "../repos/seasonCrew";
import { circleNames, memberNames, withSeasonLock } from "../repos/seasonPlaces";

export type CrewDeps = Pick<AppDeps, "authedUser" | "getPool" | "overLimit" | "firstName"> & {
  notify(input: NotifyInput): Promise<unknown>;
  lapse(): LapseContext;
  seasonState(): { current: PlaceSeason | null; upcoming: PlaceSeason | null; seasons: PlaceSeason[] };
};

const SIGN_IN = { error: "auth_required", message: "Sign in to apply for the season." };
const NOT_FOUND = { error: "not_found", message: "There is no application by that id." };
const TOO_MANY = { error: "too_many_asks", message: "Wait a little and try again." };
const ASKS = 40;
const ASK_WINDOW_MS = 10 * 60 * 1000;

/** The notice kinds an applicant or a picker hears (shared/notificationKinds.ts), read by the catalogue's producer scan. */
const CREW_NOTICE_TYPES: Record<"picked" | "released" | "applied", string> = {
  picked: "season_crew_picked",
  released: "season_crew_released",
  applied: "season_crew_applied",
};

export function registerSeasonCrew(app: Express, deps: CrewDeps): void {
  const { authedUser, getPool, overLimit, firstName, notify, lapse, seasonState } = deps;
  const base = "/api/season-places/crew";
  const placeDeps = { seasons: () => seasonState() };

  async function tell(userId: string, kind: keyof typeof CREW_NOTICE_TYPES, title: string, seasonId: string, key: string) {
    await notify({ userId, type: CREW_NOTICE_TYPES[kind], title, body: null, link: `/season-places?season=${encodeURIComponent(seasonId)}`, actorUserId: null, dedupeKey: `crew:${key}:${userId}` });
  }

  /** The circles that sail this season: those holding a place when the village asks for one, else every circle somebody can pick for. */
  async function circlesFor(seasonId: string, pickers: Map<string, { pickers: string[]; roleName: string | null; roleId: string | null }>): Promise<string[]> {
    if (crewDials.needsPlace()) return circlesTakingPart(getPool(), seasonId);
    return Array.from(pickers.keys());
  }

  async function gate(req: any, res: any, bucket: string) {
    const user = await authedUser(req);
    if (!user) { res.status(401).json(SIGN_IN); return null; }
    if (await overLimit(`season-crew-${bucket}:${user.id}`, ASKS, ASK_WINDOW_MS)) { res.status(429).json(TOO_MANY); return null; }
    return String(user.id);
  }

  app.get(base, async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json(SIGN_IN);
    const userId = String(user.id);
    const state = seasonState();
    const season = targetSeasonOf(state, req.query.season);
    const seasons = crewSeasons(state).map((s) => ({ id: s.id, name: s.name ?? null }));
    if (!season) return res.json({ season: null, seasons, goals: [], circles: [], mine: null, pool: null, picksFor: [] });
    const pool = getPool();
    const pickers = await pickersByCircle(pool, lapse());
    const ids = await circlesFor(season.id, pickers);
    const applications = await seasonPool(pool, season.id);
    const berths = await berthsOf(pool, season.id);
    const names = await circleNames(pool, Array.from(new Set([...ids, ...applications.map((a) => a.pickedCircleId ?? a.wantsCircleId ?? "").filter(Boolean)])));
    const pickerIds = Array.from(new Set(ids.flatMap((id) => pickers.get(id)?.pickers ?? [])));
    const picksFor = ids.filter((id) => (pickers.get(id)?.pickers ?? []).includes(userId));
    const people = await memberNames(pool, Array.from(new Set([...pickerIds, ...(picksFor.length ? applications.map((a) => a.userId) : [])])));
    const first = (id: string) => firstName(people.get(id) ?? "") || null;
    const mine = applications.find((a) => a.userId === userId) ?? null;
    res.json({
      season: { id: season.id, name: season.name ?? null },
      seasons,
      goals: (season.goals ?? []).filter((g) => g && typeof g.text === "string" && g.text.trim()).map((g) => ({ text: g.text, done: Boolean(g.done) })),
      applied: applications.length,
      circles: ids.map((id) => {
        const p = pickers.get(id);
        const picked = applications.filter((a) => a.status === "picked" && a.pickedCircleId === id).length;
        const b = berths.has(id) ? berths.get(id) ?? null : null;
        return {
          circleId: id,
          name: names.get(id) ?? id,
          // III.2: the role first, holders' first names in parentheses, read live.
          pickedBy: p?.roleName ? { role: p.roleName, roleId: p.roleId, names: (p.pickers ?? []).map(first).filter(Boolean) } : null,
          berths: b,
          picked,
          berthsLeft: berthsLeft(b, picked),
          // Everyone who named this circle, picked or still waiting: the "applied" count beside it.
          wanted: applications.filter((a) => a.wantsCircleId === id).length,
        };
      }),
      mine: mine
        ? { id: mine.id, status: mine.status, statusWords: CREW_STATUS_WORDS[mine.status], wantsCircleId: mine.wantsCircleId, pickedCircleId: mine.pickedCircleId, pickedCircleName: mine.pickedCircleId ? names.get(mine.pickedCircleId) ?? null : null, words: mine.words }
        : null,
      picksFor,
      // Every role that picks, held or not, so a page can link to what it asks first.
      pickerRoles: await pickerRoles(pool),
      // The pool is for the people who pick. Everyone else sees counts.
      pool: picksFor.length
        ? applications.map((a) => ({ id: a.id, name: first(a.userId), wantsCircleId: a.wantsCircleId, words: a.words, status: a.status, pickedCircleId: a.pickedCircleId }))
        : null,
    });
  });

  app.post(`${base}/apply`, async (req, res) => {
    const userId = await gate(req, res, "apply");
    if (!userId) return;
    const season = targetSeasonOf(seasonState(), req.body?.seasonId);
    if (!season) return res.status(409).json({ error: "no_season", message: CREW_REFUSALS.noSeason });
    const words = parseWords(req.body?.words);
    if (!words.ok) return res.status(400).json({ error: "words", message: words.error });
    const pool = getPool();
    const wants = typeof req.body?.circleId === "string" && req.body.circleId.trim() ? req.body.circleId.trim() : null;
    const pickers = await pickersByCircle(pool, lapse());
    if (wants && !(await circlesFor(season.id, pickers)).includes(wants)) {
      return res.status(400).json({ error: "not_sailing", message: "That circle is not picking a team this season. Apply for one that is, or for any." });
    }
    const out = await upsertApplication(pool, { seasonId: season.id, userId, wantsCircleId: wants, words: words.words });
    if (out.created && wants) {
      for (const p of pickers.get(wants)?.pickers ?? []) {
        if (p !== userId) await tell(p, "applied", CREW_NOTICES.applied(seasonName(placeDeps, season.id)), season.id, `${out.id}:applied`);
      }
    }
    const now = await applicationOf(pool, season.id, userId);
    res.json({ success: true, id: out.id, status: now?.status ?? "applied" });
  });

  /** An application and the circle a picker acts for, or a refusal already sent. */
  async function forPicker(req: any, res: any) {
    const userId = await gate(req, res, "pick");
    if (!userId) return null;
    const id = String(req.params.id ?? "");
    const a = CREW_APPLICATION_ID.test(id) ? await readCrewApplication(getPool(), id) : null;
    if (!a) { res.status(404).json(NOT_FOUND); return null; }
    const circleId = String(req.body?.circleId ?? "").trim();
    if (!(await pickersOf(getPool(), lapse(), circleId)).pickers.includes(userId)) { res.status(403).json({ error: "not_picker", message: CREW_REFUSALS.notPicker }); return null; }
    return { userId, a, circleId };
  }

  app.post(`${base}/:id/pick`, async (req, res) => {
    const got = await forPicker(req, res);
    if (!got) return;
    const { userId, a, circleId } = got;
    const pool = getPool();
    const name = (await circleNames(pool, [circleId])).get(circleId) ?? circleId;
    const season = seasonName(placeDeps, a.seasonId);
    if (crewDials.needsPlace() && !(await circlesTakingPart(pool, a.seasonId)).includes(circleId)) {
      return res.status(409).json({ error: "needs_place", message: CREW_REFUSALS.needsPlace(name, season) });
    }
    const out = await withSeasonLock(pool, a.seasonId, async (conn) => {
      const b = (await berthsOf(conn, a.seasonId)).get(circleId) ?? null;
      if (berthsLeft(b, await pickedCount(conn, a.seasonId, circleId)) === 0) return "full" as const;
      return (await pickOn(conn, a.id, circleId, userId)) ? ("picked" as const) : ("taken" as const);
    });
    if (out === "full") return res.status(409).json({ error: "full", message: CREW_REFUSALS.full(name) });
    if (out === "taken") return res.status(409).json({ error: "taken", message: CREW_REFUSALS.taken });
    await tell(a.userId, "picked", CREW_NOTICES.picked(name, season), a.seasonId, `${a.id}:picked:${circleId}`);
    res.json({ success: true, status: "picked" });
  });

  app.post(`${base}/:id/release`, async (req, res) => {
    const got = await forPicker(req, res);
    if (!got) return;
    const { a, circleId } = got;
    const pool = getPool();
    if (!(await releaseOn(pool, a.id, circleId))) return res.status(409).json({ error: "not_yours", message: "This person is not on your circle's team this season." });
    const name = (await circleNames(pool, [circleId])).get(circleId) ?? circleId;
    await tell(a.userId, "released", CREW_NOTICES.released(name, seasonName(placeDeps, a.seasonId)), a.seasonId, `${a.id}:released:${Date.now().toString(36)}`);
    res.json({ success: true, status: "applied" });
  });

  app.post(`${base}/:id/withdraw`, async (req, res) => {
    const userId = await gate(req, res, "withdraw");
    if (!userId) return;
    const id = String(req.params.id ?? "");
    const a = CREW_APPLICATION_ID.test(id) ? await readCrewApplication(getPool(), id) : null;
    if (!a) return res.status(404).json(NOT_FOUND);
    if (a.userId !== userId) return res.status(403).json({ error: "not_yours", message: "Only the member who applied can withdraw an application." });
    if (!(await withdrawApplication(getPool(), a.id, userId))) return res.status(409).json({ error: "nothing_to_withdraw", message: "This application is already withdrawn." });
    res.json({ success: true, status: "withdrawn" });
  });

  app.put(`${base}/circles/:circleId/berths`, async (req, res) => {
    const userId = await gate(req, res, "berths");
    if (!userId) return;
    const circleId = String(req.params.circleId ?? "");
    if (!(await pickersOf(getPool(), lapse(), circleId)).pickers.includes(userId)) return res.status(403).json({ error: "not_picker", message: CREW_REFUSALS.notPicker });
    const season = targetSeasonOf(seasonState(), req.body?.seasonId);
    if (!season) return res.status(409).json({ error: "no_season", message: CREW_REFUSALS.noSeason });
    const parsed = parseBerths(req.body?.berths);
    if (!parsed.ok) return res.status(400).json({ error: "berths", message: parsed.error });
    await setBerths(getPool(), season.id, circleId, parsed.berths, userId);
    res.json({ success: true, berths: parsed.berths, max: BERTHS_MAX });
  });
}
