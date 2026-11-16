/**
 * Meeting templates over HTTP. Every door is the "Doors" list in
 * shared/sessionTemplates.ts, the contract, and every rule behind a door is
 * server/lib/sessionTemplates.ts:
 *
 *   GET    /api/session-templates                       { templates, mayKeep }
 *   POST   /api/session-templates                       TemplateInput -> { template }
 *   PATCH  /api/session-templates/:id                   Partial<TemplateInput> -> { template }
 *   POST   /api/session-templates/:id/duplicate         {} -> { template }
 *   POST   /api/session-templates/:id/archive           { archived } -> { template }
 *   POST   /api/session-templates/:id/move              { direction } -> { templates }
 *   GET    /api/session-templates/rooms/:sessionId      TemplateRoomView
 *   POST   /api/session-templates/rooms/:sessionId/stick
 *   POST   /api/session-templates/rooms/:sessionId/moon-share
 *   POST   /api/session-templates/rooms/:sessionId/priorities
 *   PATCH  /api/session-templates/rooms/:sessionId/priorities/:pid
 *   POST   /api/session-templates/rooms/:sessionId/shares
 *   POST   /api/session-templates/rooms/:sessionId/shares/:shareId/bring
 *   PATCH  /api/session-templates/rooms/:sessionId/shares/:shareId
 *   GET    /api/session-templates/season?season=<id>       SeasonView (0292)
 *   GET    /api/session-templates/week                      WeekPayload (shared/priorities.ts)
 *   PUT    /api/session-templates/week
 *   GET    /api/session-templates/board?season=<id>         BoardPayload
 *   POST   /api/session-templates/board
 *   PATCH  /api/session-templates/board/:id
 *   POST   /api/session-templates/rooms/:sessionId/tops
 *   PATCH  /api/session-templates/rooms/:sessionId/tops/:no
 *   POST   /api/session-templates/rooms/:sessionId/board
 *
 * The session's own create door (`POST /api/sessions`, server/routes/
 * liveSessions.ts) takes `templateId` and links the new session here.
 *
 * ITS OWN PREFIX, BEHIND THE SAME GATES AS THE ROOM. The module gate and a
 * members-only gate are mounted on this prefix, the same two the room mounts
 * on `/api/sessions`, so a guest is refused at every door with one sentence.
 *
 * KEEPING THE TEMPLATES ASKS THE ONE GATE: every door that writes a template
 * asks `guardCapability(req, res, "session.template")` before anything runs.
 * The room's panel needs no capability: its writes follow the room's own
 * facts (who is in it, who facilitates), the way the room's doors do.
 */
import type { Express, NextFunction, Request, Response } from "express";
import type { AppDeps } from "../lib/appDeps";
import { isAdmitted } from "../lib/admission";
import { GAME_CONFIG } from "../../shared/gameConfig";
import { effectiveLifecycle, requireModule } from "../lib/modules";
import { bringItem } from "../lib/sessionLibrary";
import { ensureMemberNo, memberNo, namesFor, parseId, type MemberLookup, type Outcome } from "../lib/liveSessions";
import {
  addPriority,
  addShare,
  archiveTemplate,
  boardRoomAct,
  bringShare,
  changeTemplate,
  createTemplate,
  duplicateTemplate,
  ensureMoonSeeded,
  ensureSeeded,
  listTemplates,
  moonShareAct,
  moveTemplate,
  patchPriority,
  patchEntryServes,
  patchShare,
  readSeasons,
  regroupTension,
  roomView,
  seasonRefOf,
  seasonView,
  stickAct,
  topAct,
  topMarkAct,
} from "../lib/sessionTemplates";
import { addBoardItem, boardPayload, patchBoardItem, setOwnLine, thisWeekOf, weekPayload } from "../lib/priorities";
import { BOARD_API, PRIORITY_REFUSALS, WEEK_API } from "../../shared/priorities";
import { liveCircles } from "./sessionRhythm";
import { MOON_REVIEW_MODULE_ID, SEASON_VIEW_API, TEMPLATES_API, TEMPLATE_LIMITS, TEMPLATE_REFUSALS as R } from "../../shared/sessionTemplates";

type Deps = Pick<AppDeps, "authedUser" | "isAdmin" | "getPool" | "overLimit" | "members" | "circlesRepo" | "guardCapability" | "mayAct" | "lapseContext" | "seasonState">;

const HOUR_MS = 60 * 60 * 1000;
const NAME_TTL_MS = 60_000;

export function register(app: Express, deps: Deps): void {
  const { authedUser, isAdmin, getPool, overLimit, members, circlesRepo, guardCapability, mayAct, seasonState } = deps;
  /** The running season's priorities, the only words a priority or a win may name as the one it serves. */
  const season = () => seasonRefOf(seasonState().current);
  const goals = () => season()?.goals ?? [];
  const timeZone = () => {
    try {
      return seasonState().timezone || "UTC";
    } catch {
      return "UTC";
    }
  };

  app.use(TEMPLATES_API, requireModule("sessions"));
  app.use(TEMPLATES_API, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authedUser(req);
      if (user && !isAdmitted(user, GAME_CONFIG.stages) && !(await isAdmin(req))) {
        return res.status(403).json({ error: R.membersOnly });
      }
      next();
    } catch (e) {
      next(e);
    }
  });

  const nameCache = new Map<string, { at: number; m: { name: unknown; handle: unknown } | null }>();
  const lookup: MemberLookup = async (userId) => {
    const hit = nameCache.get(userId);
    if (hit && Date.now() - hit.at < NAME_TTL_MS) return hit.m;
    const m = await members.byId(userId);
    const v = m ? { name: m.name, handle: m.handle ?? null } : null;
    if (nameCache.size > 5000) nameCache.clear();
    nameCache.set(userId, { at: Date.now(), m: v });
    return v;
  };
  const circles = () => liveCircles(circlesRepo);
  const circleIds = () => new Set(circles().map((c) => c.id));
  const circleName = (id: string | null) => (id ? (circles().find((c) => c.id === id)?.name ?? null) : null);

  const answer = <T>(res: Response, out: Outcome<T>, ok: (v: T) => unknown) =>
    out.ok ? res.json(ok(out.value)) : res.status(out.status).json({ ...(out.body ?? {}), error: out.error });

  /** The signed-in member, or a 401 sent; with a bucket, or a 429 sent. */
  const signedIn = async (req: Request, res: Response, bucket: { key: string; max: number } | null) => {
    const user = await authedUser(req);
    if (!user) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    const userId = String(user.id);
    if (bucket && (await overLimit(`${bucket.key}:${userId}`, bucket.max, HOUR_MS))) {
      res.status(429).json({ error: R.slowDown });
      return null;
    }
    return { userId, admin: await isAdmin(req) };
  };

  /** A keeper of the templates: signed in, within the bucket, and let through by the gate. */
  const keeper = async (req: Request, res: Response) => {
    const who = await signedIn(req, res, { key: "session-templates", max: TEMPLATE_LIMITS.writesPerHour });
    if (!who) return null;
    if (!(await guardCapability(req, res, "session.template", { status: 403, body: { error: R.mayNotKeep } }))) return null;
    return { ...who, no: await ensureMemberNo(getPool(), who.userId) };
  };
  const idOf = (req: Request) => parseId(req.params?.id);

  // ── The templates ─────────────────────────────────────────────────────────

  app.get(TEMPLATES_API, async (req, res) => {
    const who = await signedIn(req, res, null);
    if (!who) return;
    const pool = getPool();
    await ensureSeeded(pool);
    // The End of moon template, written once and only while the moon-review module is on.
    await ensureMoonSeeded(pool, effectiveLifecycle(MOON_REVIEW_MODULE_ID) !== "off");
    const verdict = await mayAct(req, "session.template");
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ templates: await listTemplates(pool), mayKeep: verdict.ok });
  });

  app.post(TEMPLATES_API, async (req, res) => {
    const who = await keeper(req, res);
    if (!who) return;
    answer(res, await createTemplate(getPool(), who.no, req.body, circleIds()), (v) => v);
  });

  app.patch(`${TEMPLATES_API}/:id`, async (req, res) => {
    const who = await keeper(req, res);
    if (!who) return;
    const id = idOf(req);
    if (id == null) return res.status(404).json({ error: R.notFound });
    answer(res, await changeTemplate(getPool(), who.no, id, req.body, circleIds()), (v) => v);
  });

  app.post(`${TEMPLATES_API}/:id/duplicate`, async (req, res) => {
    const who = await keeper(req, res);
    if (!who) return;
    const id = idOf(req);
    if (id == null) return res.status(404).json({ error: R.notFound });
    answer(res, await duplicateTemplate(getPool(), who.no, id), (v) => v);
  });

  app.post(`${TEMPLATES_API}/:id/archive`, async (req, res) => {
    const who = await keeper(req, res);
    if (!who) return;
    const id = idOf(req);
    if (id == null) return res.status(404).json({ error: R.notFound });
    answer(res, await archiveTemplate(getPool(), who.no, id, req.body), (v) => v);
  });

  app.post(`${TEMPLATES_API}/:id/move`, async (req, res) => {
    const who = await keeper(req, res);
    if (!who) return;
    const id = idOf(req);
    if (id == null) return res.status(404).json({ error: R.notFound });
    answer(res, await moveTemplate(getPool(), id, req.body), (v) => v);
  });

  // ── The season so far (0292) ──────────────────────────────────────────────

  app.get(SEASON_VIEW_API, async (req, res) => {
    const who = await signedIn(req, res, null);
    if (!who) return;
    const raw = req.query?.season;
    const seasonId = typeof raw === "string" && raw ? raw.slice(0, 64) : null;
    const out = await seasonView(getPool(), seasonState(), seasonId, { no: await memberNo(getPool(), who.userId), admin: who.admin });
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ view: out.value });
  });

  /** Say how a Heart share tension groups: the people who were there know better than the word guess. */
  app.post(`${SEASON_VIEW_API}/tensions/:shareId`, async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const userId = String(user.id);
    if (await overLimit(`session-templates-room:${userId}`, TEMPLATE_LIMITS.roomWritesPerHour, HOUR_MS)) return res.status(429).json({ error: R.slowDown });
    const shareId = parseId(req.params?.shareId);
    if (shareId == null) return res.status(404).json({ error: R.tensionNotFound });
    const viewer = { no: await memberNo(getPool(), userId), admin: await isAdmin(req) };
    const out = await regroupTension(getPool(), shareId, req.body, viewer);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    const view = await seasonView(getPool(), seasonState(), typeof req.body?.season === "string" ? req.body.season.slice(0, 64) : null, viewer);
    if (!view.ok) return res.status(view.status).json({ error: view.error });
    res.json({ view: view.value });
  });

  // ── Each person's top priority, and the priority board (shared/priorities.ts) ──

  const namesOf = async (nos: number[]) => new Map(Array.from(await namesFor(getPool(), nos, lookup), ([no, n]) => [no, n.name]));

  app.get(WEEK_API, async (req, res) => {
    const who = await signedIn(req, res, null);
    if (!who) return;
    const pool = getPool();
    res.setHeader("Cache-Control", "private, no-cache");
    res.json(await weekPayload(pool, await memberNo(pool, who.userId), namesOf, goals(), thisWeekOf(new Date(), timeZone())));
  });

  app.put(WEEK_API, async (req, res) => {
    const who = await signedIn(req, res, { key: "session-templates-room", max: TEMPLATE_LIMITS.roomWritesPerHour });
    if (!who) return;
    const pool = getPool();
    const no = await ensureMemberNo(pool, who.userId);
    const week = thisWeekOf(new Date(), timeZone());
    const out = await setOwnLine(pool, no, req.body, goals(), week);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    res.json(await weekPayload(pool, no, namesOf, goals(), week));
  });

  /** The season a board read names: `?season=<id>`, or the running one. */
  const boardSeason = (raw: unknown) => {
    const id = typeof raw === "string" && raw ? raw.slice(0, 64) : null;
    if (!id) return season();
    const hit = readSeasons(seasonState().seasons).find((x) => x.id === id);
    return hit ? { id: hit.id, name: hit.name, goals: hit.goals.map((g) => ({ id: g.id, text: g.text })) } : null;
  };

  app.get(BOARD_API, async (req, res) => {
    const who = await signedIn(req, res, null);
    if (!who) return;
    const verdict = await mayAct(req, "session.template");
    res.setHeader("Cache-Control", "private, no-cache");
    res.json(await boardPayload(getPool(), boardSeason(req.query?.season), verdict.ok));
  });

  /** A keeper of the board: the same people who keep the meeting templates. */
  const boardKeeper = async (req: Request, res: Response) => {
    const who = await signedIn(req, res, { key: "session-templates", max: TEMPLATE_LIMITS.writesPerHour });
    if (!who) return null;
    if (!(await guardCapability(req, res, "session.template", { status: 403, body: { error: PRIORITY_REFUSALS.mayNotKeep } }))) return null;
    return who;
  };

  app.post(BOARD_API, async (req, res) => {
    if (!(await boardKeeper(req, res))) return;
    const out = await addBoardItem(getPool(), season(), req.body);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    res.json(await boardPayload(getPool(), season(), true));
  });

  app.patch(`${BOARD_API}/:id`, async (req, res) => {
    if (!(await boardKeeper(req, res))) return;
    const id = idOf(req);
    if (id == null) return res.status(404).json({ error: PRIORITY_REFUSALS.itemNotFound });
    const out = await patchBoardItem(getPool(), season(), id, req.body);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    res.json(await boardPayload(getPool(), season(), true));
  });

  // ── The room's panel ──────────────────────────────────────────────────────

  const ROOM = `${TEMPLATES_API}/rooms/:sessionId`;
  const sessionOf = (req: Request) => parseId(req.params?.sessionId);

  /** Answer a room write with the panel as it now stands. */
  const afterWrite = async (res: Response, sessionId: number, asker: { no: number | null; admin: boolean }, out: Outcome<null>) => {
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    const view = await roomView(getPool(), sessionId, asker, lookup, season(), Date.now(), timeZone());
    if (!view) return res.status(404).json({ error: R.roomNotFound });
    res.json(view);
  };

  /** A writer in a room: signed in (or a 401 sent) and within the room bucket (or a 429 sent). */
  const roomWriter = async (req: Request, res: Response) => {
    const user = await authedUser(req);
    if (!user) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    const userId = String(user.id);
    if (await overLimit(`session-templates-room:${userId}`, TEMPLATE_LIMITS.roomWritesPerHour, HOUR_MS)) {
      res.status(429).json({ error: R.slowDown });
      return null;
    }
    const sessionId = sessionOf(req);
    if (sessionId == null) {
      res.status(404).json({ error: R.roomNotFound });
      return null;
    }
    return { sessionId, userId, asker: { no: await memberNo(getPool(), userId), admin: await isAdmin(req) } };
  };

  app.get(ROOM, async (req, res) => {
    const who = await signedIn(req, res, null);
    if (!who) return;
    const sessionId = sessionOf(req);
    if (sessionId == null) return res.status(404).json({ error: R.roomNotFound });
    const view = await roomView(getPool(), sessionId, { no: await memberNo(getPool(), who.userId), admin: who.admin }, lookup, season(), Date.now(), timeZone());
    if (!view) return res.status(404).json({ error: R.roomNotFound });
    res.setHeader("Cache-Control", "private, no-cache");
    res.json(view);
  });

  app.post(`${ROOM}/stick`, async (req, res) => {
    const w = await roomWriter(req, res);
    if (!w) return;
    await afterWrite(res, w.sessionId, w.asker, await stickAct(getPool(), w.sessionId, w.asker, req.body));
  });

  app.post(`${ROOM}/moon-share`, async (req, res) => {
    const w = await roomWriter(req, res);
    if (!w) return;
    await afterWrite(res, w.sessionId, w.asker, await moonShareAct(getPool(), w.sessionId, w.asker, req.body));
  });

  app.post(`${ROOM}/priorities`, async (req, res) => {
    const w = await roomWriter(req, res);
    if (!w) return;
    await afterWrite(res, w.sessionId, w.asker, await addPriority(getPool(), w.sessionId, w.asker, req.body, goals()));
  });

  app.patch(`${ROOM}/priorities/:pid`, async (req, res) => {
    const w = await roomWriter(req, res);
    if (!w) return;
    const pid = parseId(req.params?.pid);
    if (pid == null) return res.status(404).json({ error: R.priorityNotFound });
    await afterWrite(res, w.sessionId, w.asker, await patchPriority(getPool(), w.sessionId, w.asker, pid, req.body, goals()));
  });

  app.post(`${ROOM}/tops`, async (req, res) => {
    const w = await roomWriter(req, res);
    if (!w) return;
    await afterWrite(res, w.sessionId, w.asker, await topAct(getPool(), w.sessionId, w.asker, req.body, goals(), timeZone()));
  });

  app.patch(`${ROOM}/tops/:no`, async (req, res) => {
    const w = await roomWriter(req, res);
    if (!w) return;
    const forNo = parseId(req.params?.no);
    if (forNo == null) return res.status(404).json({ error: PRIORITY_REFUSALS.noLine });
    await afterWrite(res, w.sessionId, w.asker, await topMarkAct(getPool(), w.sessionId, w.asker, forNo, req.body, timeZone()));
  });

  app.post(`${ROOM}/board`, async (req, res) => {
    const w = await roomWriter(req, res);
    if (!w) return;
    await afterWrite(res, w.sessionId, w.asker, await boardRoomAct(getPool(), w.sessionId, w.asker, req.body, season()));
  });

  app.post(`${ROOM}/shares`, async (req, res) => {
    const w = await roomWriter(req, res);
    if (!w) return;
    await afterWrite(res, w.sessionId, w.asker, await addShare(getPool(), w.sessionId, w.asker, req.body, goals()));
  });

  app.patch(`${ROOM}/shares/:shareId`, async (req, res) => {
    const w = await roomWriter(req, res);
    if (!w) return;
    const shareId = parseId(req.params?.shareId);
    if (shareId == null) return res.status(404).json({ error: R.shareNotFound });
    await afterWrite(res, w.sessionId, w.asker, await patchShare(getPool(), w.sessionId, w.asker, shareId, req.body, goals()));
  });

  app.patch(`${ROOM}/entries/:entryId`, async (req, res) => {
    const w = await roomWriter(req, res);
    if (!w) return;
    const entryId = parseId(req.params?.entryId);
    if (entryId == null) return res.status(404).json({ error: R.entryNotFound });
    answer(res, await patchEntryServes(getPool(), w.sessionId, w.asker, entryId, req.body, goals()), (v) => v);
  });

  app.post(`${ROOM}/shares/:shareId/bring`, async (req, res) => {
    const w = await roomWriter(req, res);
    if (!w) return;
    const shareId = parseId(req.params?.shareId);
    if (shareId == null) return res.status(404).json({ error: R.shareNotFound });
    const pool = getPool();
    const out = await bringShare(pool, w.sessionId, w.asker, shareId, req.body, async (input) => {
      const brought = await bringItem(pool, { userId: w.userId, admin: w.asker.admin }, input, circleIds(), { lookup, circleName, lapseContext: deps.lapseContext });
      return brought.ok ? { ok: true, value: { id: brought.value.item.id } } : brought;
    });
    await afterWrite(res, w.sessionId, w.asker, out);
  });
}
