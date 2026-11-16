/**
 * SEASON PLACES, THE DOORS (module `season-places`, ships off). The rules are
 * shared/seasonPlaces.ts, the orchestration server/lib/seasonPlaces.ts and the
 * SQL server/repos/seasonPlaces.ts.
 *
 *   GET  /api/season-places                   a season's places, waitlist and proposals, and what the reader may do
 *   POST /api/season-places                   propose a circle (or yourself) for a season, or join one served enough
 *   POST /api/season-places/:id/adopt         a live holder of the power to place people adopts it
 *   POST /api/season-places/:id/decline       the same holder says no
 *   POST /api/season-places/:id/put-to-village  the holder, or the crew when nobody else can decide, opens a vote
 *   POST /api/season-places/:id/withdraw      the crew takes it back; a held place frees for the next in line
 *
 * ── WHO DECIDES, AND THE VOTE PATH (constitution 0.4) ───────────────────────
 *
 * The member door for roles' own rule over `org.seat` (shared/seatApplications.ts):
 * a live holder who is not in the proposing circle adopts or declines, or puts
 * it to the village. Where the village holds the power, nobody holds it live,
 * or only the crew does, the vote opens at once (`season_place` ballot), and
 * a proposal left waiting after its holders leave can be put to the village by
 * the crew itself. So a proposal always has a way to be decided.
 *
 * A full season waits on a place freeing, or on `season_places.cap`, which is
 * a dial any member may propose a change to.
 *
 * ── NO PUBLIC EVENT ─────────────────────────────────────────────────────────
 *
 * No `recordEvent`: the row is the record. A ballot is as public as the
 * governance module, so its title names the circle and the season and nothing
 * a member wrote (`placeBallotTitle`).
 */
import type { Express } from "express";
import type { PoolConnection } from "mysql2/promise";
import { isVillageHeld, type Capability } from "../../shared/capabilities";
import { whoMayPutHandToVillage } from "../../shared/powerHands";
import type { BallotMethod } from "../../shared/governanceEngine";
import { civilDateKey } from "../../shared/lunar";
import { civilDayWords } from "../../shared/seasonPlans";
import {
  PLACE_NOTICES,
  ROAD_WORDS,
  SEASON_PLACE,
  SEASON_PLACE_POWER,
  SEASON_PLACES_MODULE,
  STATUS_WORDS,
  openSeasons,
  overCap,
  parseWords,
  placeAdoptionPath,
  placeBallotDoc,
  placeBallotTitle,
  roadFor,
  seasonsServed,
  targetSeasonOf,
  type PlaceSeason,
  type PlaceStatus,
} from "../../shared/seasonPlaces";
import type { AppDeps } from "../lib/appDeps";
import type { SubjectCloser } from "../lib/applyDue";
import { decisionLink, notifyRollRows } from "../lib/ballotNotices";
import { openBallot, openBallotFor, withdrawBallot, type BallotRow } from "../lib/ballots";
import type { WeightModeSnapshot } from "../lib/governanceWeights";
import { requireModule } from "../lib/modules";
import type { LapseContext } from "../lib/orgChart";
import { registerJob } from "../lib/scheduler";
import { circleNames } from "../repos/seasonPlaces";
import { registerGatheringPlaces } from "./seasonPlaceGatherings";
import { registerSeasonCrew } from "./seasonCrew";
import {
  admit,
  candidatesOf,
  crews,
  dials,
  placeHref,
  promoteAll,
  promoteSeason,
  seasonName,
  subjectOf,
  tellCrew,
  type PlaceDeps,
} from "../lib/seasonPlaces";
import {
  PLACE_ID,
  historiesOf,
  historyOf,
  listSeason,
  memberNames,
  readPlace,
  setStatus,
  withSeasonLock,
  writePlace,
  type StoredPlace,
} from "../repos/seasonPlaces";

export const SEASON_PLACES_JOB = "season-places-fill";
const FILL_EVERY_MS = 60 * 60 * 1000;
const ASKS = 30;
const ASK_WINDOW_MS = 10 * 60 * 1000;
/** The ballot is opened and withdrawn in the system's name: the public record names nobody. */
const PLACE_BALLOT_ACTOR = "system:season-places";

type Deps = Pick<AppDeps, "authedUser" | "capabilityCtx" | "guardCapability" | "getPool" | "notify" | "overLimit" | "firstName"> & {
  liveHoldersOf(capability: string): Promise<string[]>;
  roleBallotSetup(): Promise<{
    method: BallotMethod;
    dials: { unityPct: number; quorumPct: number };
    snapshot: WeightModeSnapshot;
    tokenProblem: string | null;
    electorate: Array<{ userId: string; weight: number }>;
    durationDays: number;
  }>;
  seasonState(): { current: PlaceSeason | null; upcoming: PlaceSeason | null; seasons: PlaceSeason[]; timezone?: string };
  lapse(): LapseContext;
  closers: Record<string, SubjectCloser>;
};

const SIGN_IN = { error: "auth_required", message: "Sign in to see the season's places." };
const NOT_FOUND = { error: "not_found", message: "There is no season place by that id." };
const TOO_MANY = { error: "too_many_asks", message: "Wait a little and try again." };

/** The closer for a `season_place` ballot. A carried vote places the subject when it lands; a no declines it. */
export function seasonPlaceCloser(deps: PlaceDeps): SubjectCloser {
  return {
    settle: async (b: BallotRow, outcome, _note, actorId) => {
      if (outcome === "passed") return { applied: [], held: null, proposerTold: null };
      const pool = deps.getPool();
      const moved = await setStatus(pool, b.subjectRef, ["voting"], "declined", { decidedBy: b.id, decided: true });
      const place = await readPlace(pool, b.subjectRef);
      if (moved && place) {
        await tellCrew(deps, place, "declined", PLACE_NOTICES.declined(await subjectOf(pool, place), seasonName(deps, place.seasonId)), `declined:${b.id}`);
      }
      void actorId;
      return { applied: [], held: null, proposerTold: place?.proposedBy ?? null };
    },
    execute: async (b: BallotRow) => {
      const out = await admit(deps, b.subjectRef, ["voting"], b.id);
      if (out.result === "moved" || !out.place) {
        return { applied: [], held: "The proposal this vote would adopt is no longer waiting on a vote, so nothing changed.", proposerTold: null };
      }
      return {
        applied: [out.result === "taking_part" ? "A place this season" : `A place on the waitlist, number ${out.position ?? 1}`],
        held: null,
        proposerTold: out.place.proposedBy,
      };
    },
    onWithdraw: async (b: BallotRow) => {
      await setStatus(deps.getPool(), b.subjectRef, ["voting"], "withdrawn", { decided: true });
    },
  };
}

export function register(app: Express, deps: Deps): void {
  const { authedUser, capabilityCtx, getPool, notify, overLimit, firstName, liveHoldersOf, roleBallotSetup, seasonState, lapse } = deps;
  const placeDeps: PlaceDeps = { getPool, notify, lapse, seasons: () => seasonState() };

  deps.closers[SEASON_PLACE] = seasonPlaceCloser(placeDeps);
  registerJob(SEASON_PLACES_JOB, FILL_EVERY_MS, async () => `${await promoteAll(placeDeps)} place(s) filled from a waitlist`);

  app.use("/api/season-places", requireModule(SEASON_PLACES_MODULE));
  registerGatheringPlaces(app, { authedUser, capabilityCtx, guardCapability: deps.guardCapability, getPool, overLimit, notify, lapse, seasonState });
  registerSeasonCrew(app, { authedUser, getPool, overLimit, firstName, notify, lapse, seasonState });

  /** Who decides proposals today: the member door's one rule over the power to place people. */
  async function decideRule(viewer: any) {
    const ctx = await capabilityCtx(viewer);
    return whoMayPutHandToVillage(isVillageHeld(SEASON_PLACE_POWER as Capability, ctx.villageHeld), await liveHoldersOf(SEASON_PLACE_POWER));
  }

  /** The circles this member may act for, or themselves under `who = member`. */
  async function subjectsFor(userId: string): Promise<string[]> {
    if (dials.who() === "member") return [userId];
    const out: string[] = [];
    for (const [circleId, crew] of Array.from(await crews(getPool(), lapse()))) if (crew.includes(userId)) out.push(circleId);
    return out;
  }

  async function served(place: Pick<StoredPlace, "subjectKind" | "subjectId">, target: PlaceSeason): Promise<number> {
    return seasonsServed(await historyOf(getPool(), place.subjectKind, place.subjectId), seasonState().seasons, target);
  }

  async function openPlaceVote(place: StoredPlace, openedBy: string, from: readonly PlaceStatus[]) {
    const pool = getPool();
    const setup = await roleBallotSetup();
    if (setup.tokenProblem) return { ok: false as const, status: 409, error: setup.tokenProblem };
    const target = seasonState().seasons.find((s) => s.id === place.seasonId);
    const subject = await subjectOf(pool, place);
    const season = seasonName(placeDeps, place.seasonId);
    const result = await openBallot(pool, {
      subjectType: SEASON_PLACE,
      subjectRef: place.id,
      title: placeBallotTitle(subject, season),
      docMarkdown: placeBallotDoc(subject, season, target ? await served(place, target) : 0),
      method: setup.method,
      weightMode: setup.snapshot.mode,
      weightToken: setup.snapshot.token,
      unityPct: setup.dials.unityPct,
      quorumPct: setup.dials.quorumPct,
      durationDays: setup.durationDays,
      openedBy: PLACE_BALLOT_ACTOR,
      electorate: setup.electorate,
      onOpen: async (conn: PoolConnection) => {
        const moved = await setStatus(conn, place.id, from, "voting");
        if (!moved) throw Object.assign(new Error("the proposal moved before its vote opened"), { code: "SP_MOVED" });
      },
    }).catch((e) => {
      if (e?.code === "SP_MOVED") return { ok: false as const, error: "Somebody decided this proposal a moment ago." };
      throw e;
    });
    if (!result.ok) return { ok: false as const, status: 409, error: result.error };
    void notifyRollRows({ pool, notify, link: decisionLink }, result.ballot, {
      type: "ballot_opened",
      title: placeBallotTitle(subject, season),
      body: `Voting is open until ${civilDayWords(civilDateKey(new Date(result.ballot.closesAt), seasonState().timezone || "UTC"))}.`,
      keySuffix: "open",
      except: [openedBy],
      roll: setup.electorate.map((e) => e.userId),
    });
    return { ok: true as const, ballotId: result.ballot.id, closesAt: result.ballot.closesAt };
  }

  // ── Read ──────────────────────────────────────────────────────────────────
  app.get("/api/season-places", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json(SIGN_IN);
    const userId = String(user.id);
    const state = seasonState();
    const season = targetSeasonOf(state, req.query.season);
    const who = dials.who();
    const cap = dials.cap();
    const freeAfter = dials.freeAfter();
    const base = {
      seasons: openSeasons(state).map((s) => ({ id: s.id, name: s.name ?? null, startsOn: s.startsOn, endsOn: s.endsOn ?? null })),
      dials: { who, freeAfter, cap },
    };
    if (!season) return res.json({ ...base, season: null, places: [], mine: [], decide: { holder: false } });

    const pool = getPool();
    const rows = await listSeason(pool, season.id);
    const circleIds = rows.filter((r) => r.subjectKind === "circle").map((r) => r.subjectId);
    const mySubjects = await subjectsFor(userId);
    const names = await circleNames(pool, Array.from(new Set([...circleIds, ...(who === "circle" ? mySubjects : [])])));
    const rule = await decideRule(user);
    const holder = rule.who === "live-holders" && rule.holders.includes(userId);
    const crewMap = who === "circle" ? await crews(pool, lapse()) : new Map<string, string[]>();
    const people = await memberNames(pool, rows.filter((r) => r.subjectKind === "member").map((r) => r.subjectId));
    const nameOf = (r: Pick<StoredPlace, "subjectKind" | "subjectId">) =>
      r.subjectKind === "circle" ? names.get(r.subjectId) ?? r.subjectId : firstName(people.get(r.subjectId) ?? "") || "A member";

    const places = [];
    let waitingSeen = 0;
    for (const r of rows) {
      const mine = r.subjectKind === "member" ? r.subjectId === userId : (crewMap.get(r.subjectId) ?? []).includes(userId);
      if (r.status === "waitlisted") waitingSeen += 1;
      const candidates = r.subjectKind === "member" ? [r.subjectId] : crewMap.get(r.subjectId) ?? [];
      places.push({
        id: r.id,
        subjectKind: r.subjectKind,
        subjectId: r.subjectId,
        name: nameOf(r),
        status: r.status,
        statusWords: STATUS_WORDS[r.status],
        road: r.road,
        roadWords: ROAD_WORDS[r.road],
        position: r.status === "waitlisted" ? waitingSeen : null,
        words: r.words,
        mine,
        mayDecide: r.status === "proposed" && holder && !candidates.includes(userId),
        mayPutToVillage: r.status === "proposed" && ((holder && !candidates.includes(userId)) || (mine && placeAdoptionPath(rule, candidates) === "ballot")),
        mayWithdraw: mine && ["proposed", "voting", "waitlisted", "taking_part"].includes(r.status),
      });
    }
    const histories = await historiesOf(pool, who, mySubjects);
    const mine = mySubjects.map((id) => {
      const count = seasonsServed(histories.get(id) ?? [], state.seasons, season);
      const row = rows.find((r) => r.subjectKind === who && r.subjectId === id) ?? null;
      return {
        subjectKind: who,
        subjectId: id,
        name: who === "circle" ? names.get(id) ?? id : "You",
        served: count,
        road: roadFor(count, freeAfter),
        place: row ? { id: row.id, status: row.status } : null,
      };
    });
    const taken = rows.filter((r) => r.status === "taking_part").length;
    const waiting = rows.filter((r) => r.status === "waitlisted").length;
    res.json({
      ...base,
      season: { id: season.id, name: season.name ?? null, startsOn: season.startsOn, endsOn: season.endsOn ?? null },
      taken,
      waiting,
      free: cap === null ? null : Math.max(0, cap - taken),
      overCap: overCap(taken, cap),
      places,
      mine,
      decide: { holder, villageVotes: rule.who !== "live-holders" },
    });
  });

  // ── Propose, or join ──────────────────────────────────────────────────────
  app.post("/api/season-places", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json(SIGN_IN);
    const userId = String(user.id);
    if (await overLimit(`season-place-ask:${userId}`, ASKS, ASK_WINDOW_MS)) return res.status(429).json(TOO_MANY);
    const season = targetSeasonOf(seasonState(), req.body?.seasonId);
    if (!season) {
      return res.status(409).json({ error: "no_season", message: "There is no season open to propose for. The village's seasons are dated in Admin, Season." });
    }
    const who = dials.who();
    const subjectId = who === "member" ? userId : String(req.body?.circleId ?? "").trim();
    if (!subjectId) return res.status(400).json({ error: "circle_required", message: "Choose the circle that proposes." });
    const pool = getPool();
    const candidates = await candidatesOf(pool, lapse(), who, subjectId);
    if (!candidates.includes(userId)) {
      return res.status(403).json({ error: "not_crew", message: "A circle is proposed by someone who holds a live role in it." });
    }
    const words = parseWords(req.body?.words);
    if (!words.ok) return res.status(400).json({ error: "words", message: words.error });

    const count = seasonsServed(await historyOf(pool, who, subjectId), seasonState().seasons, season);
    const road = roadFor(count, dials.freeAfter());
    const written = await withSeasonLock(pool, season.id, (conn) =>
      writePlace(conn, { seasonId: season.id, subjectKind: who, subjectId, road, words: words.words, proposedBy: userId, status: "proposed" }),
    );
    if (!written.ok) {
      return res.status(409).json({ error: "exists", message: `This season already has it: ${STATUS_WORDS[written.place.status].toLowerCase()}.`, id: written.place.id });
    }
    const place = (await readPlace(pool, written.id)) as StoredPlace;

    if (road === "served") {
      const out = await admit(placeDeps, place.id, ["proposed"], null);
      return res.json({ success: true, id: place.id, road, served: count, status: out.result, position: out.position });
    }

    const rule = await decideRule(user);
    if (placeAdoptionPath(rule, candidates) === "holder") {
      const subject = await subjectOf(pool, place);
      const season = seasonName(placeDeps, place.seasonId);
      for (const holderId of rule.holders.filter((h) => !candidates.includes(h))) {
        await notify({
          userId: holderId,
          type: "season_place_waiting",
          title: PLACE_NOTICES.waiting(subject, season),
          body: null,
          link: placeHref(place.seasonId),
          actorUserId: null,
          dedupeKey: `sp:${place.id}:waiting:${place.createdAt.replace(/\D/g, "").slice(0, 14)}:${holderId}`,
        });
      }
      return res.json({ success: true, id: place.id, road, served: count, status: "proposed", waitsOn: "holder" });
    }
    const opened = await openPlaceVote(place, userId, ["proposed"]);
    if (!opened.ok) {
      // Nothing can decide a proposal whose vote did not open, so it does not stand.
      await setStatus(pool, place.id, ["proposed"], "withdrawn", { decided: true });
      return res.status(opened.status).json({ error: "vote_not_opened", message: opened.error });
    }
    res.json({ success: true, id: place.id, road, served: count, status: "voting", ballot: { id: opened.ballotId, closesAt: opened.closesAt } });
  });

  /** A proposal and the reader's standing on it, or a refusal already sent. */
  async function loadFor(req: any, res: any, bucket: string) {
    const user = await authedUser(req);
    if (!user) { res.status(401).json(SIGN_IN); return null; }
    const userId = String(user.id);
    if (await overLimit(`season-place-${bucket}:${userId}`, ASKS, ASK_WINDOW_MS)) { res.status(429).json(TOO_MANY); return null; }
    const id = String(req.params.id ?? "");
    const place = PLACE_ID.test(id) ? await readPlace(getPool(), id) : null;
    if (!place) { res.status(404).json(NOT_FOUND); return null; }
    const candidates = await candidatesOf(getPool(), lapse(), place.subjectKind, place.subjectId);
    const rule = await decideRule(user);
    const decider = rule.who === "live-holders" && rule.holders.includes(userId) && !candidates.includes(userId);
    return { user, userId, place, candidates, rule, decider };
  }

  const notWaiting = (p: StoredPlace) => ({ error: "not_waiting", message: `This proposal is ${STATUS_WORDS[p.status].toLowerCase()}, so there is nothing to decide.`, status: p.status });
  const DECIDERS_ONLY = { error: "not_a_holder", message: "A proposal is decided by a live holder of the power to place people in roles who is not in the circle it is for." };

  app.post("/api/season-places/:id/adopt", async (req, res) => {
    const got = await loadFor(req, res, "decide");
    if (!got) return;
    if (!got.decider) return res.status(403).json(DECIDERS_ONLY);
    if (got.place.status !== "proposed") return res.status(409).json(notWaiting(got.place));
    const out = await admit(placeDeps, got.place.id, ["proposed"], got.userId);
    if (out.result === "moved") return res.status(409).json({ error: "moved", message: "Somebody decided this proposal a moment ago." });
    res.json({ success: true, status: out.result, position: out.position });
  });

  app.post("/api/season-places/:id/decline", async (req, res) => {
    const got = await loadFor(req, res, "decide");
    if (!got) return;
    if (!got.decider) return res.status(403).json(DECIDERS_ONLY);
    const pool = getPool();
    if (!(await setStatus(pool, got.place.id, ["proposed"], "declined", { decidedBy: got.userId, decided: true }))) {
      return res.status(409).json(notWaiting((await readPlace(pool, got.place.id)) ?? got.place));
    }
    await tellCrew(placeDeps, got.place, "declined", PLACE_NOTICES.declined(await subjectOf(pool, got.place), seasonName(placeDeps, got.place.seasonId)), `declined:${got.userId}`);
    res.json({ success: true, status: "declined" });
  });

  app.post("/api/season-places/:id/put-to-village", async (req, res) => {
    const got = await loadFor(req, res, "decide");
    if (!got) return;
    const crewMayOpen = got.candidates.includes(got.userId) && placeAdoptionPath(got.rule, got.candidates) === "ballot";
    if (!got.decider && !crewMayOpen) {
      return res.status(403).json({ error: "not_a_holder", message: "A holder of the power to place people puts a proposal to the village. When nobody outside the circle holds it, the circle's own role holders do." });
    }
    if (got.place.status !== "proposed") return res.status(409).json(notWaiting(got.place));
    const opened = await openPlaceVote(got.place, got.userId, ["proposed"]);
    if (!opened.ok) return res.status(opened.status).json({ error: "vote_not_opened", message: opened.error });
    res.json({ success: true, status: "voting", ballot: { id: opened.ballotId, closesAt: opened.closesAt } });
  });

  app.post("/api/season-places/:id/withdraw", async (req, res) => {
    const got = await loadFor(req, res, "withdraw");
    if (!got) return;
    if (!got.candidates.includes(got.userId)) {
      return res.status(403).json({ error: "not_crew", message: "Only the circle's own role holders can withdraw it." });
    }
    const pool = getPool();
    const p = got.place;
    if (!["proposed", "voting", "waitlisted", "taking_part"].includes(p.status)) {
      return res.status(409).json({ error: "nothing_to_withdraw", message: `This is ${STATUS_WORDS[p.status].toLowerCase()}, so there is nothing to withdraw.` });
    }
    if (p.status === "voting") {
      /*
       * THE VOTE GOES WITH THE PROPOSAL, as a role application's does: a crew
       * may always take its own proposal back, and votes already cast are set
       * aside. A vote the village already carried cannot be withdrawn, and the
       * ballot's own rule says so.
       */
      const ballot = await openBallotFor(pool, SEASON_PLACE, p.id);
      if (ballot) {
        const out = await withdrawBallot(pool, {
          ballotId: ballot.id,
          withdrawnBy: PLACE_BALLOT_ACTOR,
          reason: "The circle withdrew its proposal for this season.",
          withdrawerMayDiscardVotes: true,
        });
        if (!out.ok) return res.status(409).json({ error: "vote_stands", message: out.error });
      }
    }
    const freed = p.status === "taking_part";
    const moved = await withSeasonLock(pool, p.seasonId, (conn) => setStatus(conn, p.id, [p.status], "withdrawn", { decided: true }));
    // The ballot's withdrawal may already have moved a voting row (the closer's onWithdraw).
    const now = moved ? null : await readPlace(pool, p.id);
    if (!moved && now?.status !== "withdrawn") return res.status(409).json({ error: "moved", message: "This moved a moment ago. Read it again." });
    const promoted = freed ? await promoteSeason(placeDeps, p.seasonId) : [];
    res.json({ success: true, status: "withdrawn", placeWentTo: promoted.length });
  });
}
