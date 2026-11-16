/**
 * CIRCLE PLACES AT A GATHERING, THE DOORS. Registered from
 * server/routes/seasonPlaces.ts, so the season places module's gate stands in
 * front of every one of them, and each also answers 404 while the calendar
 * (`events`) is off.
 *
 *   GET  /api/season-places/gatherings/:eventId                          the host's settings, the circles going and waiting
 *   PUT  /api/season-places/gatherings/:eventId/settings                 a holder of event.manage changes them
 *   POST /api/season-places/gatherings/:eventId/circles                  a crew member signs their circle up
 *   POST /api/season-places/gatherings/:eventId/circles/:circleId/leave  a crew member takes it out; the next in line goes
 *
 * WHO MAY DO WHAT. The settings are the gathering's, so they follow
 * `event.manage`, the power that already sets its person capacity, through
 * `guardCapability` (constitution I.1; the vote path is that power's own,
 * spec C6). Which gatherings a circle goes to is its picker's call for the
 * season (`season_crew.picker_role`, server/lib/seasonCrew.ts), and with no
 * live picker its crew's.
 */
import type { Express } from "express";
import { capabilityDecision } from "../../shared/capabilities";
import {
  CIRCLE_NOTICES,
  CIRCLE_REFUSALS,
  CIRCLE_STATUS_WORDS,
  circleSettingsChange,
  seasonCovering,
} from "../../shared/circlePlaces";
import { civilDateKey } from "../../shared/lunar";
import type { PlaceSeason } from "../../shared/seasonPlaces";
import type { AppDeps } from "../lib/appDeps";
import { getCalendarRow, type CalendarRow } from "../lib/calendar";
import { cleanRecurrence } from "../lib/calendar";
import { effectiveLifecycle } from "../lib/modules";
import type { NotifyInput } from "../lib/notify";
import type { LapseContext } from "../lib/orgChart";
import { crews } from "../lib/seasonPlaces";
import { pickersOf } from "../lib/seasonCrew";
import {
  gatheringsTakingCircles,
  circleSettingsOf,
  holdsSeasonPlace,
  leaveOn,
  listCirclePlaces,
  promoteCirclesOn,
  saveCircleSettings,
  signUpOn,
  withGatheringLock,
} from "../repos/circlePlaces";
import { circleNames } from "../repos/seasonPlaces";

export type GatheringPlaceDeps = Pick<AppDeps, "authedUser" | "capabilityCtx" | "guardCapability" | "getPool" | "overLimit"> & {
  notify(input: NotifyInput): Promise<unknown>;
  lapse(): LapseContext;
  seasonState(): { seasons: PlaceSeason[]; timezone?: string };
};

const NOT_HERE = { error: "not_found", message: "That gathering isn't on the calendar." };
const SIGN_IN = { error: "auth_required", message: "Sign in to see the circles at a gathering." };
const HOSTS_ONLY = { error: "hosts_only", message: "A gathering's circle settings are changed by whoever holds the power to manage gatherings." };
const ASKS = 30;

/** The notice kinds a crew hears about a gathering (shared/notificationKinds.ts), read by the catalogue's producer scan. */
const CIRCLE_NOTICE_TYPES: Record<"going" | "waiting" | "opened", string> = {
  going: "circle_place_going",
  waiting: "circle_place_waiting",
  opened: "circle_place_opened",
};
const ASK_WINDOW_MS = 10 * 60 * 1000;

export function registerGatheringPlaces(app: Express, deps: GatheringPlaceDeps): void {
  const { authedUser, capabilityCtx, guardCapability, getPool, overLimit, notify, lapse, seasonState } = deps;
  const eventsOn = () => effectiveLifecycle("events") !== "off";
  const base = "/api/season-places/gatherings/:eventId";

  async function gathering(id: string): Promise<CalendarRow | null> {
    const row = await getCalendarRow(getPool(), id);
    return row && !row.removedAt ? row : null;
  }

  async function tellCircle(circleId: string, eventId: string, kind: keyof typeof CIRCLE_NOTICE_TYPES, title: string, key: string) {
    for (const userId of (await crews(getPool(), lapse())).get(circleId) ?? []) {
      await notify({ userId, type: CIRCLE_NOTICE_TYPES[kind], title, body: null, link: "/events", actorUserId: null, dedupeKey: `cp:${eventId}:${circleId}:${key}:${userId}` });
    }
  }

  async function fill(eventId: string, title: string, cap: number | null) {
    const promoted = (await withGatheringLock(getPool(), eventId, (conn) => promoteCirclesOn(conn, eventId, cap))) ?? [];
    const names = await circleNames(getPool(), promoted);
    const stamp = Date.now().toString(36);
    for (const c of promoted) await tellCircle(c, eventId, "opened", CIRCLE_NOTICES.opened(names.get(c) ?? c, title), `opened:${stamp}`);
    return promoted.length;
  }

  // Every upcoming gathering that takes circles, with where the reader's circles stand in each.
  app.get("/api/season-places/gatherings", async (req, res) => {
    if (!eventsOn()) return res.status(404).json(NOT_HERE);
    const user = await authedUser(req);
    if (!user) return res.status(401).json(SIGN_IN);
    const pool = getPool();
    const crewMap = await crews(pool, lapse());
    const mine = new Set(Array.from(crewMap.entries()).filter(([, crew]) => crew.includes(String(user.id))).map(([id]) => id));
    const out = [];
    for (const g of await gatheringsTakingCircles(pool)) {
      const places = await listCirclePlaces(pool, g.id);
      const waiting = places.filter((p) => p.status === "waiting");
      const names = await circleNames(pool, places.filter((p) => mine.has(p.circleId)).map((p) => p.circleId));
      out.push({
        eventId: g.id,
        title: g.title,
        startsAt: g.startsAt,
        circleCap: g.circleCap,
        going: places.length - waiting.length,
        waiting: waiting.length,
        mine: places
          .filter((p) => mine.has(p.circleId))
          .map((p) => ({ circleId: p.circleId, name: names.get(p.circleId) ?? p.circleId, status: p.status, position: p.status === "waiting" ? waiting.findIndex((w) => w.circleId === p.circleId) + 1 : null })),
      });
    }
    res.json({ gatherings: out });
  });

  app.get(base, async (req, res) => {
    if (!eventsOn()) return res.status(404).json(NOT_HERE);
    const user = await authedUser(req);
    if (!user) return res.status(401).json(SIGN_IN);
    const row = await gathering(req.params.eventId);
    if (!row) return res.status(404).json(NOT_HERE);
    const pool = getPool();
    const settings = await circleSettingsOf(pool, row.id);
    const places = await listCirclePlaces(pool, row.id);
    const crewMap = await crews(pool, lapse());
    const myCircles = Array.from(crewMap.entries()).filter(([, crew]) => crew.includes(String(user.id))).map(([id]) => id);
    const names = await circleNames(pool, Array.from(new Set([...places.map((p) => p.circleId), ...myCircles])));
    let waiting = 0;
    res.json({
      eventId: row.id,
      title: row.title,
      settings,
      mayManage: capabilityDecision("event.manage", await capabilityCtx(user)).allowed,
      going: places.filter((p) => p.status === "going").length,
      circles: places.map((p) => ({
        circleId: p.circleId,
        name: names.get(p.circleId) ?? p.circleId,
        status: p.status,
        statusWords: CIRCLE_STATUS_WORDS[p.status],
        position: p.status === "waiting" ? ++waiting : null,
        mine: myCircles.includes(p.circleId),
      })),
      myCircles: myCircles.map((id) => ({ circleId: id, name: names.get(id) ?? id, status: places.find((p) => p.circleId === id)?.status ?? null })),
    });
  });

  app.put(`${base}/settings`, async (req, res) => {
    if (!eventsOn()) return res.status(404).json(NOT_HERE);
    if (!(await guardCapability(req, res, "event.manage", { status: 403, body: HOSTS_ONLY }))) return;
    const user = await authedUser(req);
    const row = await gathering(req.params.eventId);
    if (!row) return res.status(404).json(NOT_HERE);
    const pool = getPool();
    const parsed = circleSettingsChange(req.body, await circleSettingsOf(pool, row.id));
    if (!parsed.ok) return res.status(400).json({ error: "settings", message: parsed.error });
    await saveCircleSettings(pool, row.id, parsed.settings, String(user?.id ?? ""));
    // A raised cap lets the waitlist in at once.
    const filled = await fill(row.id, row.title, parsed.settings.circleCap);
    res.json({ settings: parsed.settings, filled });
  });

  app.post(`${base}/circles`, async (req, res) => {
    if (!eventsOn()) return res.status(404).json(NOT_HERE);
    const user = await authedUser(req);
    if (!user) return res.status(401).json(SIGN_IN);
    const userId = String(user.id);
    if (await overLimit(`circle-place:${userId}`, ASKS, ASK_WINDOW_MS)) return res.status(429).json({ error: "too_many_asks", message: "Wait a little and try again." });
    const row = await gathering(req.params.eventId);
    if (!row) return res.status(404).json(NOT_HERE);
    const pool = getPool();
    const settings = await circleSettingsOf(pool, row.id);
    if (!settings.takesCircles) return res.status(409).json({ error: "not_taking", message: CIRCLE_REFUSALS.notTaking });
    if (cleanRecurrence(row.recurrence)) return res.status(409).json({ error: "recurring", message: CIRCLE_REFUSALS.recurring });
    if (row.status !== "scheduled" && row.status !== "postponed") return res.status(409).json({ error: "not_open", message: CIRCLE_REFUSALS.closed });
    const circleId = String(req.body?.circleId ?? "").trim();
    if (!(await pickersOf(pool, lapse(), circleId)).pickers.includes(userId)) {
      return res.status(403).json({ error: "not_crew", message: "A circle is signed up by whoever picks its team this season, or by its role holders when nobody does." });
    }
    const name = (await circleNames(pool, [circleId])).get(circleId) ?? circleId;
    if (settings.needsSeasonPlace) {
      const state = seasonState();
      const season = seasonCovering(civilDateKey(new Date(row.startsAt), state.timezone || "UTC"), state.seasons);
      if (!season) return res.status(409).json({ error: "no_season", message: CIRCLE_REFUSALS.noSeason });
      if (!(await holdsSeasonPlace(pool, season.id, circleId))) {
        return res.status(409).json({ error: "needs_season_place", message: CIRCLE_REFUSALS.needsPlace(name, season.name?.trim() || "the season"), seasonId: season.id });
      }
    }
    const out = await withGatheringLock(pool, row.id, (conn) => signUpOn(conn, row.id, circleId, userId, settings.circleCap));
    if (!out) return res.status(404).json(NOT_HERE);
    if (!out.duplicate) {
      const stamp = Date.now().toString(36);
      if (out.status === "going") await tellCircle(circleId, row.id, "going", CIRCLE_NOTICES.going(name, row.title), `going:${stamp}`);
      else await tellCircle(circleId, row.id, "waiting", CIRCLE_NOTICES.waiting(name, row.title, out.position ?? 1), `waiting:${stamp}`);
    }
    res.json({ success: true, status: out.status, position: out.position, duplicate: out.duplicate });
  });

  app.post(`${base}/circles/:circleId/leave`, async (req, res) => {
    if (!eventsOn()) return res.status(404).json(NOT_HERE);
    const user = await authedUser(req);
    if (!user) return res.status(401).json(SIGN_IN);
    const userId = String(user.id);
    if (await overLimit(`circle-place:${userId}`, ASKS, ASK_WINDOW_MS)) return res.status(429).json({ error: "too_many_asks", message: "Wait a little and try again." });
    const row = await gathering(req.params.eventId);
    if (!row) return res.status(404).json(NOT_HERE);
    const pool = getPool();
    const circleId = String(req.params.circleId ?? "");
    if (!(await pickersOf(pool, lapse(), circleId)).pickers.includes(userId)) {
      return res.status(403).json({ error: "not_crew", message: "A circle is taken out by whoever picks its team this season, or by its role holders when nobody does." });
    }
    const out = await withGatheringLock(pool, row.id, (conn) => leaveOn(conn, row.id, circleId, userId));
    if (!out?.left) return res.status(409).json({ error: "not_signed_up", message: "That circle is not signed up for this gathering." });
    const filled = out.wasGoing ? await fill(row.id, row.title, (await circleSettingsOf(pool, row.id)).circleCap) : 0;
    res.json({ success: true, status: "left", placeWentTo: filled });
  });
}
