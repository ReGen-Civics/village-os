/**
 * Rites and invitations: `/api/rites/**`, behind `requireModule("rites")`.
 * The rules are shared/rites.ts, the store server/repos/rites.ts, and the
 * village's words, rites and look its `village-rites/1` document (the module
 * card's config).
 *
 * WHO READS WHAT. A visitor with no account reads only what a welcome, an
 * invitation letter and a door code show: the village's own words, a first
 * name, and counts with nothing attached. Those routes answer only while the
 * module is public (the gate's 401 says so otherwise), and each is rate
 * limited, because a yes-or-no about a code or a token is a guessing oracle.
 * Everything else asks for a session.
 *
 * WHO WITNESSES. A member who holds the village's admitting rite; while
 * nobody does, any admitted member (shared/rites.ts `refuseWitness`). Nobody
 * witnesses their own rite, and a rite is never stamped by the person it is
 * for.
 *
 * ADMISSION. When the admitting rite is stamped, the member is admitted the
 * way an arrival vouch admits (server/lib/inviteDoor.ts): the member row's
 * `membershipGranted`, and the `member_admitted` mail event. A village that
 * admits only by its rite sets `membership.vouches_required` to 0, so an
 * invitation brings a newcomer in and the rite lets them in.
 */
import { randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";

import {
  DOOR_CODE,
  GREETING_MAX,
  LETTER_LINE_MAX,
  MARK_PATH_SHAPE,
  RITES_MODULE,
  WHY_MAX,
  admittingRite,
  ceremonyStep,
  doorPath,
  fill,
  isPlainRite,
  makeDoorCode,
  markPath,
  parseRitesConfig,
  refuseConfirm,
  refuseSpoken,
  refuseWitness,
  ringOrder,
  stampedTogether,
  stampsFor,
  type CeremonyFacts,
  type RiteDef,
  type RitesConfig,
  type WitnessVia,
} from "../../shared/rites";
import { JOIN_REQUEST_TYPE } from "../../shared/joinAnswers";
import { formSubmittedTrigger } from "../../shared/comms/contracts";
import type { AppDeps } from "../lib/appDeps";
import { commsSink } from "../lib/commsSink";
import { recordEvent } from "../lib/events";
import type { InviteDoor } from "../lib/inviteDoor";
import { readInviteToken } from "../lib/invites";
import { entriesForMember, tokenDef } from "../lib/ledger";
import { moduleConfig, requireModule } from "../lib/modules";
import { singlePublicAddress } from "../lib/publicAddress";
import { stageName } from "../lib/villagePaths";
import { listOrgAssignments, listOrgRoles } from "../lib/orgChart";
import { inviteById, inviteTakenBy } from "../repos/memberInvites";
import * as repo from "../repos/rites";
import { joinAnswerDoor, type JoinAnswerDeps } from "./joinAnswers";

type Deps = Pick<
  AppDeps,
  "authedUser" | "isAdmin" | "getPool" | "members" | "mayAct" | "overLimit" | "clientIp" | "notify" | "firstName" | "projectName" | "deploymentOrigin" | "stageOf" | "submissionsRepo" | "loadRoles" | "roleIdsFor" | "lapseContext"
> &
  JoinAnswerDeps & { invites: InviteDoor };

const HOUR = 60 * 60 * 1000;

/** The card's word once a member holds the admitting rite: the village's own, else its member stage's name. */
const memberWordOf = (cfg: RitesConfig) => cfg.words.memberWord || stageName("member");
/** The card's word before it: the village's own, else its newcomer stage's name. */
const newcomerWordOf = (cfg: RitesConfig) => cfg.words.newcomerWord || stageName("guest");

export function ritesConfig(): RitesConfig {
  return parseRitesConfig(moduleConfig(RITES_MODULE)).config;
}

function body(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
}

function refuse(res: Response, status: number, error: string, code?: string) {
  return res.status(status).json(code ? { error, code } : { error });
}

const newId = (prefix: string) => `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function register(app: Express, deps: Deps): void {
  const { authedUser, isAdmin, getPool, members, mayAct, overLimit, clientIp, notify, firstName, projectName, stageOf, submissionsRepo, invites } = deps;
  const answers = joinAnswerDoor(deps);

  app.use("/api/rites", requireModule(RITES_MODULE));

  // ── Helpers ───────────────────────────────────────────────────────────────

  const first = (name: unknown) => firstName(String(name ?? "")) || "A member";

  /** Is this member sworn, and is anybody? The witness rule reads both. */
  async function standing(userId: string, cfg: RitesConfig) {
    const pool = getPool();
    const rite = admittingRite(cfg.rites);
    if (!rite) {
      const u: any = await members.byId(userId);
      return { sworn: !!u?.membershipGranted, anyoneSworn: false, admitted: !!u?.membershipGranted, admittingId: null as string | null };
    }
    const [sworn, anyone, u] = await Promise.all([repo.holds(pool, userId, rite.id), repo.anyHolder(pool, rite.id), members.byId(userId)]);
    return { sworn, anyoneSworn: anyone, admitted: !!(u as any)?.membershipGranted, admittingId: rite.id };
  }

  /** Whether `userId` may witness for somebody (the candidate check is the caller's). */
  async function mayWitness(userId: string, cfg: RitesConfig): Promise<boolean> {
    const s = await standing(userId, cfg);
    return s.anyoneSworn ? s.sworn : s.admitted;
  }

  function wordsFor(cfg: RitesConfig, user: any, extra: Record<string, string> = {}) {
    return { name: first(user?.name), member: memberWordOf(cfg), newcomer: newcomerWordOf(cfg), village: projectName(), buddy: cfg.words.buddy, ...extra };
  }

  async function counts(cfg: RitesConfig) {
    const n = await repo.publicCounts(getPool(), admittingRite(cfg.rites)?.id ?? null);
    return cfg.counts.map((c) => ({ label: c.label, n: n[c.source] }));
  }

  /** Admit, the way the arrival vouch does: the row's grant and the mail event. */
  async function admit(userId: string) {
    let changed = false;
    await members.update(userId, (m: any) => {
      if (!m.membershipGranted) {
        m.membershipGranted = true;
        changed = true;
      }
    });
    if (changed) commsSink.fire({ type: "member_admitted", userId });
  }

  /** Pair a newcomer with their inviter the first time it is asked, when the inviter is sworn. */
  async function pairWithInviter(userId: string, cfg: RitesConfig): Promise<void> {
    const pool = getPool();
    if (await repo.buddyOf(pool, userId)) return;
    const inviteId = await inviteTakenBy(pool, userId);
    if (!inviteId) return;
    const inv = await inviteById(pool, inviteId);
    if (!inv || inv.inviterUserId === userId) return;
    if (!(await mayWitness(inv.inviterUserId, cfg))) return;
    await repo.pairBuddy(pool, userId, inv.inviterUserId, inv.inviterUserId, new Date(), true);
  }

  async function tokenLine(slug: string, userId: string) {
    if (!slug) return null;
    const bal = await repo.balancesOfMany(getPool(), [userId], slug);
    return { slug, name: tokenDef(slug)?.name ?? slug, n: bal.get(userId) ?? 0 };
  }

  // ── Public: the welcome, the letter, the door ────────────────────────────

  app.get("/api/rites/public", async (req, res) => {
    if (await overLimit(`rites-public:${clientIp(req)}`, 120, HOUR)) return refuse(res, 429, "Too many requests. Try again in a few minutes.");
    const cfg = ritesConfig();
    let inviter: string | null = null;
    const token = readInviteToken(req.query.invite);
    if (token) {
      const found = await invites.resolve(token);
      if (found.ok) inviter = first(found.inviterName);
    }
    const vars = { village: projectName(), member: memberWordOf(cfg), newcomer: newcomerWordOf(cfg), buddy: cfg.words.buddy, inviter: inviter ?? "" };
    const fillAll = (o: object): Record<string, unknown> =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" && !/href|photo/i.test(k) ? fill(v, vars) : v]));
    res.json({
      village: projectName(),
      inviter,
      welcome: { ...fillAll(cfg.welcome), steps: cfg.welcome.steps.map(fillAll), road: cfg.welcome.road.map(fillAll), doors: cfg.welcome.doors.map(fillAll) },
      articles: { ...fillAll(cfg.articles), items: cfg.articles.items },
      counts: await counts(cfg),
      places: { phone: cfg.words.placePhone, site: cfg.words.placeSite, gathering: cfg.words.placeGathering },
      look: cfg.look,
      sigil: cfg.sigil,
      nav: cfg.nav,
      words: Object.fromEntries(Object.entries(cfg.words).map(([k, v]) => [k, /Href$/.test(k) ? v : fill(v, vars)])),
      steps: cfg.welcome.steps.map((s) => s.title),
    });
  });

  app.get("/api/rites/letter", async (req, res) => {
    if (await overLimit(`invite-check:${clientIp(req)}`, 60, HOUR)) return refuse(res, 429, "Too many attempts. Try again in a few minutes.");
    const token = readInviteToken(req.query.token);
    if (!token) return res.json({ valid: false });
    const found = await invites.resolve(token);
    if (!found.ok) return res.json({ valid: false, error: found.error });
    const cfg = ritesConfig();
    const inviter = first(found.inviterName);
    const vars = { inviter, village: projectName(), member: memberWordOf(cfg), newcomer: newcomerWordOf(cfg) };
    const l = cfg.letter;
    res.json({
      valid: true,
      inviter,
      line: await repo.letterLine(getPool(), found.id),
      letter: {
        kicker: fill(l.kicker, vars),
        photo: l.photo,
        photoAlt: l.photoAlt,
        title: fill(l.title, vars),
        about: fill(l.about, vars),
        seal: fill(l.seal, vars),
        sealLine: fill(l.sealLine, vars),
        signature: fill(l.signature, vars),
      },
      village: projectName(),
      counts: await counts(cfg),
      look: cfg.look,
      sigil: cfg.sigil,
      places: { phone: cfg.words.placePhone },
    });
  });

  async function doorOwner(code: string) {
    if (!DOOR_CODE.test(code)) return null;
    const userId = await repo.codeOwner(getPool(), code);
    if (!userId) return null;
    const u: any = await members.byId(userId);
    if (!u || String(u.email ?? "").endsWith("@anonymized.invalid")) return null;
    return u;
  }

  app.get("/api/rites/door/:code", async (req, res) => {
    if (await overLimit(`rites-door:${clientIp(req)}`, 60, HOUR)) return refuse(res, 429, "Too many attempts. Try again in a few minutes.");
    const owner = await doorOwner(String(req.params.code ?? ""));
    if (!owner) return res.status(404).json({ error: "This code isn't one of ours any more. Ask the member who gave it to you for a new one." });
    const cfg = ritesConfig();
    const vars = { inviter: first(owner.name), village: projectName(), member: memberWordOf(cfg) };
    const d = cfg.door;
    res.json({
      giver: first(owner.name),
      village: projectName(),
      door: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, fill(v, vars)])),
      look: cfg.look,
      sigil: cfg.sigil,
      places: { phone: cfg.words.placePhone },
    });
  });

  app.post("/api/rites/door/:code/request", async (req, res) => {
    if (await overLimit(`rites-door-ask:${clientIp(req)}`, 6, HOUR)) return refuse(res, 429, "Too many requests. Try again later.");
    const code = String(req.params.code ?? "");
    const owner = await doorOwner(code);
    if (!owner) return refuse(res, 404, "This code isn't one of ours any more. Ask the member who gave it to you for a new one.");
    const b = body(req);
    const name = text(b.name, 80);
    const email = singlePublicAddress(b.email);
    const why = text(b.why, WHY_MAX);
    if (!name) return refuse(res, 400, "Tell us the name you go by.", "name");
    if (!email) return refuse(res, 400, "Give an email address we can answer you at.", "email");
    const submitter = await authedUser(req);
    const entry: any = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: JOIN_REQUEST_TYPE,
      data: { name, email, message: why, viaMember: String(owner.id), viaCode: code },
      status: "new",
      rewarded: false,
      submittedAt: new Date().toISOString(),
    };
    if (submitter) {
      entry.userId = submitter.id;
      entry.userName = submitter.name;
    }
    await submissionsRepo.insert(entry);
    commsSink.fire(formSubmittedTrigger(JOIN_REQUEST_TYPE, entry.id, entry.data));
    await notify({
      userId: String(owner.id),
      type: "rite_door_request",
      title: `${name} asked to join with your code`,
      body: why || null,
      link: "/rites/requests",
      dedupeKey: `rite-door-request:${entry.id}`,
    });
    const cfg = ritesConfig();
    res.json({ success: true, message: fill(cfg.door.sent, { inviter: first(owner.name) }) });
  });

  app.post("/api/rites/interest", async (req, res) => {
    if (await overLimit(`rites-interest:${clientIp(req)}`, 6, HOUR)) return refuse(res, 429, "Too many requests. Try again later.");
    const cfg = ritesConfig();
    const b = body(req);
    const door = cfg.welcome.doors.find((d) => d.id === String(b.doorId ?? ""));
    if (!door || !door.interestOnly) return refuse(res, 404, "That door isn't taking names.");
    const name = text(b.name, 80);
    const email = singlePublicAddress(b.email);
    if (!name) return refuse(res, 400, "Tell us your name.", "name");
    if (!email) return refuse(res, 400, "Give an email address we can write to.", "email");
    if (!(await repo.interestAlready(getPool(), door.id, email))) await repo.leaveInterest(getPool(), { id: newId("int"), doorId: door.id, name, email, at: new Date() });
    res.json({ success: true });
  });

  app.get("/api/rites/interest", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    res.json({ interest: await repo.interestList(getPool()) });
  });

  // ── The member's own card ─────────────────────────────────────────────────

  async function signedIn(req: Request, res: Response): Promise<any | null> {
    const user = await authedUser(req);
    if (!user) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    return user;
  }

  async function buddyView(userId: string) {
    const pool = getPool();
    const pair = await repo.buddyOf(pool, userId);
    if (!pair) return null;
    const p = (await repo.people(pool, [pair.buddyUserId])).get(pair.buddyUserId);
    if (!p) return null;
    return { id: p.id, name: first(p.name), handle: p.handle, avatar: p.avatar, greeting: pair.greeting };
  }

  app.get("/api/rites/me", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const cfg = ritesConfig();
    const userId = String(user.id);
    await pairWithInviter(userId, cfg);
    const [held, mark, buddy, aboard, s, ceremonies, inviteId] = await Promise.all([
      repo.stampsOf(pool, userId),
      repo.markOf(pool, userId),
      buddyView(userId),
      repo.aboardOf(pool, userId),
      standing(userId, cfg),
      repo.ceremoniesOfCandidate(pool, userId),
      inviteTakenBy(pool, userId),
    ]);
    const stage = await stageOf(user);
    const word = s.admittingId ? (s.sworn ? memberWordOf(cfg) : newcomerWordOf(cfg)) : stageName(stage);
    let inviter: string | null = null;
    if (inviteId) {
      const inv = await inviteById(pool, inviteId);
      const u: any = inv ? await members.byId(inv.inviterUserId) : null;
      if (u) inviter = first(u.name);
    }
    const vars = wordsFor(cfg, user, { buddy: buddy?.name ?? cfg.words.buddy, inviter: inviter ?? "" });
    res.json({
      id: userId,
      name: first(user.name),
      stageWord: word,
      memberWord: memberWordOf(cfg),
      sworn: s.sworn,
      admitted: s.admitted,
      mayWitness: s.anyoneSworn ? s.sworn : s.admitted,
      mark: mark && MARK_PATH_SHAPE.test(mark.path) ? mark.path : null,
      buddy,
      inviter,
      aboard,
      stamps: stampsFor(cfg.rites, new Set(held.keys()), cfg.walk),
      rites: cfg.rites.map((r) => ({ id: r.id, todo: r.todo, done: r.done, spoken: !isPlainRite(r), admits: r.admits, place: r.place })),
      openCeremonies: ceremonies.filter((c) => c.status === "open").map((c) => ({ id: c.id, riteId: c.riteId })),
      tokens: { record: await tokenLine(cfg.tokens.record, userId), voice: await tokenLine(cfg.tokens.voice, userId) },
      words: Object.fromEntries(Object.entries(cfg.words).map(([k, v]) => [k, /Href$/.test(k) ? v : fill(v, vars)])),
      doors: cfg.welcome.doors.map((d) => ({ id: d.id, title: d.choiceTitle || d.title, line: d.choiceLine || d.line, place: d.place, interestOnly: d.interestOnly, href: d.href })),
      steps: cfg.welcome.steps.map((st) => st.title),
      look: cfg.look,
      sigil: cfg.sigil,
      nav: cfg.nav,
      village: projectName(),
    });
  });

  app.post("/api/rites/aboard", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const cfg = ritesConfig();
    const b = body(req);
    const doorId = b.doorId == null || b.doorId === "" ? null : String(b.doorId);
    if (doorId && !cfg.welcome.doors.some((d) => d.id === doorId)) return refuse(res, 400, "Choose one of the ways in.");
    const why = text(b.why, WHY_MAX) || null;
    await repo.setAboard(getPool(), String(user.id), doorId, why, new Date());
    res.json({ success: true });
  });

  app.get("/api/rites/record", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const cfg = ritesConfig();
    if (!cfg.tokens.record) return res.json({ token: null, entries: [] });
    const entries = (await entriesForMember(getPool(), String(user.id)))
      .filter((e) => e.tokenType === cfg.tokens.record && e.amount > 0)
      .slice(0, 8)
      .map((e) => ({ id: e.id, title: e.description || e.source.replace(/_/g, " "), n: e.amount, at: e.at }));
    res.json({ token: tokenDef(cfg.tokens.record)?.name ?? cfg.tokens.record, entries });
  });

  app.get("/api/rites/crew", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const cfg = ritesConfig();
    const rite = admittingRite(cfg.rites);
    const swornIds = rite ? await repo.holdersOf(pool, rite.id) : ((await members.all()) as any[]).filter((m) => m.membershipGranted).map((m) => String(m.id));
    const resting = cfg.tokens.voice ? await repo.formerHolders(pool, cfg.tokens.voice) : [];
    const ids = Array.from(new Set([...swornIds, ...resting]));
    const [people, voice] = await Promise.all([repo.people(pool, ids), repo.balancesOfMany(pool, ids, cfg.tokens.voice)]);
    const roleNames = new Map(deps.loadRoles().map((r) => [r.id, r.name]));
    const crew = ids
      .map((id) => people.get(id))
      .filter((p): p is repo.PersonRow => !!p)
      .map((p) => ({
        id: p.id,
        name: first(p.name),
        avatar: p.avatar,
        you: p.id === String(user.id),
        resting: !p.admitted && resting.includes(p.id),
        roles: deps.roleIdsFor(p.id).map((r) => roleNames.get(r)).filter(Boolean),
        voice: voice.get(p.id) ?? 0,
      }))
      .sort((a, b) => Number(a.resting) - Number(b.resting) || b.voice - a.voice || a.name.localeCompare(b.name))
      .slice(0, 60);
    res.json({ member: memberWordOf(cfg), voiceName: cfg.tokens.voice ? tokenDef(cfg.tokens.voice)?.name ?? cfg.tokens.voice : null, crew });
  });

  // ── The mark and the ring ─────────────────────────────────────────────────

  app.post("/api/rites/mark", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    if (await overLimit(`rites-mark:${user.id}`, 60, HOUR)) return refuse(res, 429, "Too many tries. Rest your hand a moment.");
    const got = markPath(body(req).strokes);
    if (!got.ok) return refuse(res, 400, got.error);
    const kept = await repo.setMark(getPool(), String(user.id), got.path, new Date());
    if (!kept) return refuse(res, 409, "Your mark is already on record. It stays as you made it.");
    res.json({ path: got.path });
  });

  app.get("/api/rites/ring", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const cfg = ritesConfig();
    const rite = cfg.rites.find((r) => r.mark) ?? admittingRite(cfg.rites);
    if (!rite) return res.json({ count: 0, marks: [], title: cfg.words.ringTitle });
    const holders = await repo.holdersOf(pool, rite.id);
    const paths = await repo.marksOf(pool, holders);
    const marks = ringOrder(
      holders.filter((id) => paths.has(id) && MARK_PATH_SHAPE.test(paths.get(id) as string)).map((userId) => ({ userId, path: paths.get(userId) as string })),
      projectName(),
    ).map((m) => ({ path: m.path, mine: m.userId === String(user.id) }));
    res.json({ count: holders.length, marks, title: cfg.words.ringTitle });
  });

  // ── Ceremonies ────────────────────────────────────────────────────────────

  function facts(c: repo.CeremonyRow, markMade: boolean, confirmed: number): CeremonyFacts {
    return { status: c.status, lineCount: c.lines.length, spoken: c.spoken, markNeeded: c.markNeeded, markMade, needed: c.witnessesNeeded, confirmed };
  }

  async function ceremonyView(id: string, viewerId: string) {
    const pool = getPool();
    const c = await repo.ceremonyById(pool, id);
    if (!c) return null;
    const cfg = ritesConfig();
    const rite = cfg.rites.find((r) => r.id === c.riteId) ?? null;
    const [ws, mark, pair] = await Promise.all([repo.witnessesOf(pool, id), repo.markOf(pool, c.candidateUserId), repo.buddyOf(pool, c.candidateUserId)]);
    const people = await repo.people(pool, [c.candidateUserId, ...ws.map((w) => w.userId)]);
    const confirmed = ws.filter((w) => w.confirmedAt).length;
    const f = facts(c, !!mark, confirmed);
    const isCandidate = c.candidateUserId === viewerId;
    const isWitness = ws.some((w) => w.userId === viewerId);
    const s = await standing(viewerId, cfg);
    const roleNames = new Map(deps.loadRoles().map((r) => [r.id, r.name]));
    return {
      id: c.id,
      rite: rite ? { id: rite.id, title: rite.title, todo: rite.todo, done: rite.done, callCounts: rite.callCounts, place: rite.place } : { id: c.riteId, title: c.riteId, todo: c.riteId, done: c.riteId, callCounts: true, place: null },
      photo: cfg.welcome.ceremonyPhoto,
      sigil: cfg.sigil,
      village: projectName(),
      place: c.place,
      lines: c.lines,
      answer: c.answer,
      spoken: c.spoken,
      step: ceremonyStep(f),
      needed: c.witnessesNeeded,
      confirmed,
      markNeeded: c.markNeeded,
      mark: mark && MARK_PATH_SHAPE.test(mark.path) ? mark.path : null,
      candidate: { id: c.candidateUserId, name: first(people.get(c.candidateUserId)?.name) },
      witnesses: ws.map((w) => {
        const roles = deps.roleIdsFor(w.userId).map((r) => roleNames.get(r)).filter(Boolean) as string[];
        const nm = first(people.get(w.userId)?.name);
        return {
          id: w.userId,
          name: roles.length ? `${roles[0]} (${nm})` : nm,
          initial: nm.slice(0, 1).toUpperCase(),
          isBuddy: pair?.buddyUserId === w.userId,
          via: w.via,
          confirmed: !!w.confirmedAt,
          you: w.userId === viewerId,
        };
      }),
      you: { isCandidate, isWitness, mayWitness: !isCandidate && (s.anyoneSworn ? s.sworn : s.admitted) },
      words: {
        ...Object.fromEntries(Object.entries(cfg.words).map(([k, v]) => [k, /Href$/.test(k) ? v : fill(v, { name: first(people.get(c.candidateUserId)?.name), member: memberWordOf(cfg), newcomer: newcomerWordOf(cfg), village: projectName(), buddy: cfg.words.buddy })])),
        member: memberWordOf(cfg),
        places: { phone: cfg.words.placePhone, site: cfg.words.placeSite, gathering: cfg.words.placeGathering },
      },
      look: cfg.look,
    };
  }

  app.post("/api/rites/ceremonies", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const cfg = ritesConfig();
    const b = body(req);
    const rite = cfg.rites.find((r) => r.id === String(b.riteId ?? ""));
    if (!rite) return refuse(res, 404, "There is no rite by that name here.");
    if (isPlainRite(rite)) return refuse(res, 400, "This rite is stamped by a witness. It has no ceremony.");
    const candidateId = b.candidateId ? String(b.candidateId) : String(user.id);
    const candidate: any = await members.byId(candidateId);
    if (!candidate) return refuse(res, 404, "There is no member by that name here.");
    if (candidateId !== String(user.id)) {
      const pair = await repo.buddyOf(pool, candidateId);
      if (pair?.buddyUserId !== String(user.id) && !(await mayWitness(String(user.id), cfg))) {
        return refuse(res, 403, "Only the member, their buddy or a witness opens a ceremony for them.");
      }
    }
    if (await repo.holds(pool, candidateId, rite.id)) return refuse(res, 409, `${first(candidate.name)} has already completed this rite.`);
    const place = b.place === "gathering" || b.place === "site" || b.place === "phone" ? String(b.place) : rite.place;
    const atGathering = place === "gathering" && rite.gatheringLines.length > 0;
    const c = await repo.openCeremony(pool, {
      id: newId("cer"),
      riteId: rite.id,
      candidateUserId: candidateId,
      openedBy: String(user.id),
      at: new Date(),
      place,
      lines: atGathering ? rite.gatheringLines : rite.lines,
      answer: place === "gathering" && rite.gatheringAnswer ? rite.gatheringAnswer : null,
      markNeeded: rite.mark,
      witnessesNeeded: rite.witnesses,
    });
    // The buddy is the first witness to ask.
    const pair = await repo.buddyOf(pool, candidateId);
    if (pair && pair.buddyUserId !== String(user.id)) {
      await notify({
        userId: pair.buddyUserId,
        type: "rite_witness_asked",
        title: `${first(candidate.name)} is ready to ${rite.todo.toLowerCase()}`,
        body: "Witness it from your phone.",
        link: `/rites/ceremony/${c.id}`,
        dedupeKey: `rite-witness-asked:${c.id}:${pair.buddyUserId}`,
      });
    }
    res.json({ id: c.id });
  });

  app.get("/api/rites/ceremonies", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const cfg = ritesConfig();
    const may = await mayWitness(String(user.id), cfg);
    const open = (await repo.openCeremonies(pool)).filter((c) => c.candidateUserId !== String(user.id));
    const people = await repo.people(pool, open.map((c) => c.candidateUserId));
    res.json({
      mayWitness: may,
      title: cfg.words.witnessPageTitle,
      look: cfg.look,
      ceremonies: may
        ? open.map((c) => ({ id: c.id, candidate: first(people.get(c.candidateUserId)?.name), rite: cfg.rites.find((r) => r.id === c.riteId)?.todo ?? c.riteId, openedAt: c.openedAt }))
        : [],
    });
  });

  app.get("/api/rites/ceremonies/:id", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const view = await ceremonyView(String(req.params.id ?? ""), String(user.id));
    if (!view) return refuse(res, 404, "There is no ceremony by that name here.");
    res.json(view);
  });

  app.post("/api/rites/ceremonies/:id/spoken", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const c = await repo.ceremonyById(pool, String(req.params.id ?? ""));
    if (!c) return refuse(res, 404, "There is no ceremony by that name here.");
    const line = Number(body(req).line);
    const no = refuseSpoken(facts(c, false, 0), c.candidateUserId === String(user.id), line);
    if (no) return refuse(res, 409, no);
    await repo.setSpoken(pool, c.id, line + 1);
    res.json(await ceremonyView(c.id, String(user.id)));
  });

  app.post("/api/rites/ceremonies/:id/witness", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const cfg = ritesConfig();
    const c = await repo.ceremonyById(pool, String(req.params.id ?? ""));
    if (!c) return refuse(res, 404, "There is no ceremony by that name here.");
    if (c.status !== "open") return refuse(res, 409, "This ceremony is no longer open.");
    const via: WitnessVia = body(req).via === "call" ? "call" : "present";
    const rite = cfg.rites.find((r) => r.id === c.riteId);
    const s = await standing(String(user.id), cfg);
    const no = refuseWitness({ candidateId: c.candidateUserId, witnessId: String(user.id), via, callCounts: rite?.callCounts ?? true, witnessSworn: s.sworn, anyoneSworn: s.anyoneSworn, witnessAdmitted: s.admitted });
    if (no) return refuse(res, 403, no);
    await repo.joinAsWitness(pool, c.id, String(user.id), via, new Date());
    res.json(await ceremonyView(c.id, String(user.id)));
  });

  /** Close the ceremony as sworn and stamp its rites, once, under the ceremony's row lock. */
  async function swearIfReady(id: string): Promise<{ sworn: boolean; candidateId: string; rite: RiteDef | null; fresh: string[] }> {
    const pool = getPool();
    const cfg = ritesConfig();
    const conn = await pool.getConnection();
    let out = { sworn: false, candidateId: "", rite: null as RiteDef | null, fresh: [] as string[] };
    try {
      await conn.beginTransaction();
      const c = await repo.ceremonyById(conn, id, true);
      if (!c || c.status !== "open") {
        await conn.rollback();
        return out;
      }
      const [ws, mark] = await Promise.all([repo.witnessesOf(conn, id), repo.markOf(conn, c.candidateUserId)]);
      const step = ceremonyStep(facts(c, !!mark, ws.filter((w) => w.confirmedAt).length));
      if (step !== "sworn") {
        await conn.rollback();
        return out;
      }
      const at = new Date();
      const rite = cfg.rites.find((r) => r.id === c.riteId) ?? null;
      const ids = rite ? stampedTogether(rite, cfg.rites) : [c.riteId];
      await repo.closeCeremony(conn, id, "sworn", at);
      const lead = ws.find((w) => w.confirmedAt)?.userId ?? null;
      const fresh = await repo.stamp(conn, c.candidateUserId, ids, at, id, lead);
      if (c.markNeeded) await repo.fixMark(conn, c.candidateUserId, at);
      await conn.commit();
      out = { sworn: true, candidateId: c.candidateUserId, rite, fresh };
    } catch (e) {
      await conn.rollback().catch(() => undefined);
      throw e;
    } finally {
      conn.release();
    }
    return out;
  }

  /** What follows a stamp: admission, the pulse, the bell. Never undoes the stamp if one of them fails. */
  async function afterStamp(candidateId: string, rite: RiteDef | null, fresh: string[]) {
    if (!rite || fresh.length === 0) return;
    const cfg = ritesConfig();
    const pool = getPool();
    const candidate: any = await members.byId(candidateId);
    try {
      if (fresh.some((id) => cfg.rites.find((r) => r.id === id)?.admits)) await admit(candidateId);
    } catch (e) {
      console.warn(`[rites] admitting ${candidateId} after their rite did not finish: ${String((e as Error)?.message ?? e)}`);
    }
    await recordEvent(pool, { kind: "rite_stamped", text: `${first(candidate?.name)} ${rite.done.charAt(0).toLowerCase()}${rite.done.slice(1)}`, actorUserId: candidateId, originModuleId: RITES_MODULE, audience: "public" });
    const pair = await repo.buddyOf(pool, candidateId);
    if (pair) {
      await notify({ userId: pair.buddyUserId, type: "rite_stamped", title: `${first(candidate?.name)} ${rite.done.charAt(0).toLowerCase()}${rite.done.slice(1)}`, link: "/card", dedupeKey: `rite-stamped:${candidateId}:${rite.id}:buddy` });
    }
    await notify({ userId: candidateId, type: "rite_stamped", title: rite.done, link: "/card", dedupeKey: `rite-stamped:${candidateId}:${rite.id}` });
  }

  app.post("/api/rites/ceremonies/:id/confirm", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const id = String(req.params.id ?? "");
    const c = await repo.ceremonyById(pool, id);
    if (!c) return refuse(res, 404, "There is no ceremony by that name here.");
    const [ws, mark] = await Promise.all([repo.witnessesOf(pool, id), repo.markOf(pool, c.candidateUserId)]);
    const no = refuseConfirm(facts(c, !!mark, ws.filter((w) => w.confirmedAt).length), ws.some((w) => w.userId === String(user.id)));
    if (no) return refuse(res, 409, no);
    await repo.confirmWitness(pool, id, String(user.id), new Date());
    const swore = await swearIfReady(id);
    if (swore.sworn) await afterStamp(swore.candidateId, swore.rite, swore.fresh);
    res.json(await ceremonyView(id, String(user.id)));
  });

  app.post("/api/rites/ceremonies/:id/set-aside", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const id = String(req.params.id ?? "");
    const c = await repo.ceremonyById(pool, id);
    if (!c) return refuse(res, 404, "There is no ceremony by that name here.");
    const ws = await repo.witnessesOf(pool, id);
    if (c.candidateUserId !== String(user.id) && !ws.some((w) => w.userId === String(user.id))) return refuse(res, 403, "Only the member or a witness sets a ceremony aside.");
    await repo.closeCeremony(pool, id, "set-aside", new Date());
    res.json(await ceremonyView(id, String(user.id)));
  });

  // ── A plain rite, stamped by one witness ──────────────────────────────────

  app.post("/api/rites/stamps", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const cfg = ritesConfig();
    const b = body(req);
    const rite = cfg.rites.find((r) => r.id === String(b.riteId ?? ""));
    if (!rite) return refuse(res, 404, "There is no rite by that name here.");
    if (!isPlainRite(rite)) return refuse(res, 400, "This rite is completed in a ceremony.");
    const memberId = String(b.userId ?? "");
    const target: any = await members.byId(memberId);
    if (!target) return refuse(res, 404, "There is no member by that name here.");
    const s = await standing(String(user.id), cfg);
    const no = refuseWitness({ candidateId: memberId, witnessId: String(user.id), via: "present", callCounts: true, witnessSworn: s.sworn, anyoneSworn: s.anyoneSworn, witnessAdmitted: s.admitted });
    if (no) return refuse(res, 403, no);
    const ids = stampedTogether(rite, cfg.rites);
    const fresh = await repo.stamp(pool, memberId, ids, new Date(), null, String(user.id));
    await afterStamp(memberId, rite, fresh);
    res.json({ stamped: fresh });
  });

  // ── Buddies ───────────────────────────────────────────────────────────────

  app.get("/api/rites/newcomers", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const cfg = ritesConfig();
    if (!(await mayWitness(String(user.id), cfg))) return res.json({ mayPair: false, newcomers: [], mine: [] });
    const rite = admittingRite(cfg.rites);
    const sworn = new Set(rite ? await repo.holdersOf(pool, rite.id) : []);
    const all = ((await members.all()) as any[]).filter((m) => !m.isExample && !String(m.email ?? "").endsWith("@anonymized.invalid"));
    const newcomers = all.filter((m) => (rite ? !sworn.has(String(m.id)) : !m.membershipGranted)).slice(-60);
    const rows = await Promise.all(
      newcomers.map(async (m) => {
        const [pair, aboard, held] = await Promise.all([repo.buddyOf(pool, String(m.id)), repo.aboardOf(pool, String(m.id)), repo.stampsOf(pool, String(m.id))]);
        const buddy = pair ? (await repo.people(pool, [pair.buddyUserId])).get(pair.buddyUserId) : null;
        return {
          id: String(m.id),
          name: first(m.name),
          buddy: buddy ? { id: buddy.id, name: first(buddy.name) } : null,
          mine: pair?.buddyUserId === String(user.id),
          why: pair?.buddyUserId === String(user.id) ? aboard?.why ?? null : null,
          greeting: pair?.buddyUserId === String(user.id) ? pair.greeting : null,
          stamps: stampsFor(cfg.rites, new Set(held.keys()), cfg.walk),
        };
      }),
    );
    const swornPeople = await repo.people(pool, Array.from(sworn));
    res.json({
      mayPair: true,
      buddyWord: cfg.words.buddy,
      sworn: Array.from(swornPeople.values()).map((p) => ({ id: p.id, name: first(p.name) })),
      newcomers: rows.reverse(),
      rites: cfg.rites.filter(isPlainRite).map((r) => ({ id: r.id, todo: r.todo })),
      look: cfg.look,
    });
  });

  app.post("/api/rites/buddies", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const cfg = ritesConfig();
    if (!(await mayWitness(String(user.id), cfg))) return refuse(res, 403, `Only a member who may witness pairs a ${cfg.words.buddy.toLowerCase()}.`);
    const b = body(req);
    const newcomerId = String(b.newcomerId ?? "");
    const buddyId = String(b.buddyId ?? user.id);
    if (newcomerId === buddyId) return refuse(res, 400, `Nobody is their own ${cfg.words.buddy.toLowerCase()}.`);
    const [newcomer, buddy] = await Promise.all([members.byId(newcomerId), members.byId(buddyId)]);
    if (!newcomer || !buddy) return refuse(res, 404, "There is no member by that name here.");
    const s = await standing(newcomerId, cfg);
    if (s.admittingId ? s.sworn : s.admitted) return refuse(res, 409, `${first((newcomer as any).name)} has already completed the village's rite.`);
    if (!(await mayWitness(buddyId, cfg))) return refuse(res, 409, `A ${cfg.words.buddy.toLowerCase()} is a member who may witness.`);
    await repo.pairBuddy(pool, newcomerId, buddyId, String(user.id), new Date());
    await notify({
      userId: buddyId,
      type: "rite_buddy_paired",
      title: `You walk beside ${first((newcomer as any).name)}`,
      body: "Write them a first word.",
      link: "/rites/newcomers",
      dedupeKey: `rite-buddy:${newcomerId}:${buddyId}`,
    });
    res.json({ success: true });
  });

  app.put("/api/rites/buddies/:newcomerId/greeting", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const greeting = text(body(req).greeting, GREETING_MAX);
    if (!greeting) return refuse(res, 400, "Write a word or two.");
    const ok = await repo.setGreeting(getPool(), String(req.params.newcomerId ?? ""), String(user.id), greeting);
    if (!ok) return refuse(res, 403, "Only their buddy writes their first word.");
    res.json({ success: true });
  });

  // ── The door code, and the requests it brings ─────────────────────────────

  app.get("/api/rites/door", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    if (!(await mayAct(req, "member.vouch")).ok) return res.json({ mayInvite: false, code: null, path: null });
    const pool = getPool();
    let code = await repo.liveCodeOf(pool, String(user.id));
    if (!code) {
      code = makeDoorCode((n) => randomBytes(n));
      await repo.replaceCode(pool, String(user.id), code, new Date());
    }
    const cfg = ritesConfig();
    res.json({ mayInvite: true, code, path: doorPath(code), giver: first(user.name), door: cfg.door, look: cfg.look, village: projectName() });
  });

  app.post("/api/rites/door/replace", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    if (!(await mayAct(req, "member.vouch")).ok) return refuse(res, 403, "Inviting somebody opens once you may vouch for them.");
    const code = makeDoorCode((n) => randomBytes(n));
    await repo.replaceCode(getPool(), String(user.id), code, new Date());
    res.json({ code, path: doorPath(code) });
  });

  const requestsFor = (userId: string) =>
    submissionsRepo
      .all()
      .filter((s: any) => s.type === JOIN_REQUEST_TYPE && String((s.data as any)?.viaMember ?? "") === userId)
      .sort((a: any, b: any) => String(b.submittedAt).localeCompare(String(a.submittedAt)));

  app.get("/api/rites/door-requests", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    res.json({
      requests: requestsFor(String(user.id)).map((s: any) => ({ id: String(s.id), name: String(s.data?.name ?? ""), message: String(s.data?.message ?? ""), status: String(s.status ?? "new"), at: s.submittedAt })),
    });
  });

  async function answerDoorRequest(req: Request, res: Response, yes: boolean) {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    if (!(await mayAct(req, "member.vouch")).ok) return res.status(403).json({ error: "Answering a request opens once you may vouch for somebody." });
    const got = answers.find(String(req.params.id ?? ""));
    if (!got.ok) return res.status(got.answer.status).json(got.answer.body);
    if (String((got.found.row.data as any)?.viaMember ?? "") !== String(user.id)) return refuse(res, 403, "This request was made at another member's door.");
    const answer = yes ? await answers.accept(user, got.found) : await answers.decline(got.found);
    res.status(answer.status).json(answer.body);
  }

  app.post("/api/rites/door-requests/:id/accept", (req, res) => answerDoorRequest(req, res, true));
  app.post("/api/rites/door-requests/:id/decline", (req, res) => answerDoorRequest(req, res, false));

  // ── The letter's line ────────────────────────────────────────────────────

  app.put("/api/rites/letters/:inviteId", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const inv = await inviteById(pool, String(req.params.inviteId ?? ""));
    if (!inv || inv.inviterUserId !== String(user.id)) return refuse(res, 404, "That invitation isn't one of yours.");
    if (inv.usedByUserId || inv.revokedAt || inv.expired) return refuse(res, 409, "That invitation is no longer open.");
    const line = text(body(req).line, LETTER_LINE_MAX);
    if (!line) return refuse(res, 400, "Write a line in your own words.");
    await repo.setLetterLine(pool, inv.id, line, new Date());
    res.json({ success: true, line });
  });

  app.get("/api/rites/letters", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const ids = Array.isArray(req.query.ids) ? (req.query.ids as string[]) : String(req.query.ids ?? "").split(",").filter(Boolean);
    const lines = await repo.lettersFor(getPool(), ids.slice(0, 50));
    const own: Record<string, string> = {};
    for (const [id, line] of Array.from(lines.entries())) {
      const inv = await inviteById(getPool(), id);
      if (inv?.inviterUserId === String(user.id)) own[id] = line;
    }
    res.json({ lines: own });
  });

  // ── The fleet page ────────────────────────────────────────────────────────

  /**
   * Every active circle with who leads it and how many hold its roles now, and
   * the village's words and photos for the page. Gatherings, the season and
   * open votes are read by the page from their own modules' routes.
   */
  app.get("/api/rites/fleet", async (req, res) => {
    const user = await signedIn(req, res);
    if (!user) return;
    const pool = getPool();
    const cfg = ritesConfig();
    const [circles, roles, assignments] = await Promise.all([repo.activeCircles(pool), listOrgRoles(pool), listOrgAssignments(pool, deps.lapseContext())]);
    const live = assignments.filter((a) => a.holderKind === "member" && a.userId && !a.isExample && !a.lapsed && !a.endedAt);
    const roleCircle = new Map(roles.filter((r) => r.active && !r.isExample).map((r) => [r.id, r.circleId]));
    const leadIds = circles.map((c) => (c.leadRoleId ? live.find((a) => a.orgRoleId === c.leadRoleId)?.userId ?? null : null)).filter((x): x is string => !!x);
    const people = await repo.people(pool, leadIds);
    const roleName = new Map(roles.map((r) => [r.id, r.name]));
    res.json({
      circles: circles.map((c) => {
        const crew = new Set(live.filter((a) => roleCircle.get(a.orgRoleId) === c.id).map((a) => a.userId as string));
        const leadId = c.leadRoleId ? live.find((a) => a.orgRoleId === c.leadRoleId)?.userId ?? null : null;
        const lead = leadId ? people.get(leadId) : null;
        return {
          id: c.id,
          name: c.name,
          photo: cfg.fleet.photos[c.id] ?? null,
          lead: lead && c.leadRoleId ? `${roleName.get(c.leadRoleId) ?? ""} (${first(lead.name)})`.trim() : null,
          crew: crew.size,
        };
      }),
      fleet: { ...cfg.fleet, photos: undefined },
      words: { title: cfg.words.fleetTitle, seasonKicker: cfg.words.fleetSeasonKicker, circlesTitle: cfg.words.circlesTitle, circleLive: cfg.words.circleLive, crewCount: cfg.words.crewCount, gatheringsTitle: cfg.words.gatheringsTitle, ballotsKicker: cfg.words.ballotsKicker },
      places: { phone: cfg.words.placePhone, site: cfg.words.placeSite, gathering: cfg.words.placeGathering },
      voice: cfg.tokens.voice ? { name: tokenDef(cfg.tokens.voice)?.name ?? cfg.tokens.voice, n: (await repo.balancesOfMany(pool, [String(user.id)], cfg.tokens.voice)).get(String(user.id)) ?? 0 } : null,
      sigil: cfg.sigil,
      nav: cfg.nav,
      look: cfg.look,
      village: projectName(),
    });
  });
}
