/**
 * A VISITOR'S PROFILE: THE ROUTES (the contract is shared/visitorProfile.ts, the SQL is
 * server/repos/portalVisitors.ts and migration 0434). Registered by server/routes/entrance.ts,
 * which hands over its own code, cookie and list machinery, so a visitor signs back in by exactly
 * the rules the entrance uses.
 *
 *   POST   /api/visitor/sign-in                 { email }   a code to the address, when it has a visitor profile
 *   POST   /api/visitor/sign-in/code            { code }    the code: this device is the visitor again
 *   GET    /api/visitor/me                                  the profile
 *   PATCH  /api/visitor/me                      { name?, whatsapp?, link?, interest?, updates? }
 *   GET    /api/visitor/me/export                           everything kept, as a JSON file
 *   DELETE /api/visitor/me                      { confirm: "DELETE" }
 *   POST   /api/visitor/me/sign-out
 *   POST   /api/visitor/me/applications/:id/withdraw
 *   POST   /api/visitor/me/applications/:id/edit           withdraws it and answers a draft to reopen the form with
 *   POST   /api/visitor/me/invitation           { note? }   a request for an invitation to full membership
 *   GET    /api/admin/visitors/invitations                  the requests waiting (intake.moderate)
 *   POST   /api/admin/visitors/invitations/promote  { ids }  make each a member (member.superVouch)
 *   POST   /api/admin/visitors/invitations/decline  { ids, words? }  (member.superVouch)
 *
 * WHO IS A VISITOR. The device's entry cookie names an entry; the entry's address must be verified
 * (the code or Google). Nothing here makes an account except a promotion, which is the act of
 * joining, done by somebody the village lets admit members.
 *
 * EMAIL. A sign-in code, and the promotion letter, both through the one mail door. Nothing else.
 */
import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import type { Capability } from "../../shared/capabilities";
import { emailKeyOf } from "../../shared/comms/address";
import { cleanCode, cleanLink, cleanWhatsapp, isInterest, isUpdatesAnswer, LINK_MAX } from "../../shared/entrance";
import { askAgainFrom, DELETE_WORD, INVITE_NOTE_MAX, mayRequestInvite, type InviteRequest, type VisitorProfile } from "../../shared/visitorProfile";
import { ipBucket } from "../../shared/openProposals";
import { cookieValue, entryCookieHeader, readEntry, signEntry } from "../lib/entrance";
import { makeSetPasswordToken } from "../lib/memberTokens";
import { commsSink } from "../lib/commsSink";
import { removeFromBrevo, type BrevoDeps } from "../lib/portalSync";
import { codesSentTo, deletePortalCodesFor } from "../repos/portalCodes";
import { deletePortalEntriesFor, entryLook, journeysFor, portalEmailsFor, setUpdatesAnswer, viewsFor } from "../repos/portalEntries";
import {
  applicationsAt,
  decideInvite,
  deleteVisitorAt,
  entriesAt,
  latestVerifiedEntry,
  requestInvite,
  updateVisitorDetails,
  visitorAt,
  visitorById,
  waitingRequests,
  withdrawAllWaiting,
  withdrawByApplicant,
  type ApplicationRow, latestUpdatesAnswer } from "../repos/portalVisitors";
import { insertDraft } from "../repos/applicationDrafts";
import { recordVouch } from "../repos/vouches";
import { resumePath } from "../../shared/applicationDrafts";

/** The cookie that holds a sign-in waiting on its code: the entry the code was sent for, signed, short. */
export const SIGN_IN_COOKIE = "vos_visitor_signin";
const SIGN_IN_MS = 15 * 60 * 1000;

export interface VisitorContext {
  getPool(): Pool;
  secret: string;
  now(): number;
  clientIp(req: Request): string;
  overLimit(bucket: string, max: number, windowMs: number): Promise<boolean>;
  guardCapability(req: Request, res: Response, cap: Capability): Promise<boolean>;
  authedUser(req: Request): Promise<any | null>;
  secureOf(req: Request): boolean;
  ownEntry(req: Request): string | null;
  mailReady(): boolean;
  sendNewCode(entryId: string, email: string): Promise<boolean>;
  redeemCode(entryId: string, typed: string): Promise<{ ok: true; signedIn: { token: string; user: unknown } | null } | { ok: false; status: number; body: Record<string, unknown> }>;
  listIfYes(entryId: string): Promise<void>;
  brevo: BrevoDeps;
  /** The roles by id, for naming an application's roles. */
  roleNames(): Promise<Map<string, string>>;
  accounts: {
    byEmail(email: string): Promise<any | null>;
    update(id: string, mutate: (m: any) => void): Promise<any | null>;
    add?(member: any): Promise<any>;
    makeHandle?(name: string): Promise<string>;
    /** A new member arrived: the host records the join and greets, as every door in does. Never rejects. */
    joined?(member: any): void;
  };
  /** The promotion letter, through the one mail door. */
  sendEmail(opts: { to: string[]; subject: string; html: string; text?: string; origin?: string }): Promise<{ sent: boolean; reason?: string }>;
  escapeHtml(s: string): string;
  projectName(): string;
  origin(): string;
}

const NOT_A_VISITOR = { error: "visitor_required", message: "Sign in with your email first: we send a code to it." };

export function registerVisitor(app: Express, ctx: VisitorContext): void {
  const pool = () => ctx.getPool();

  /** The verified visitor behind this device, or null. */
  async function visitorOf(req: Request): Promise<{ entryId: string; emailKey: string; email: string } | null> {
    const id = ctx.ownEntry(req);
    if (!id) return null;
    const e = await entryLook(pool(), id);
    if (!e || !e.verified || e.isTest) return null;
    return { entryId: id, emailKey: e.emailKey, email: e.email };
  }

  const clearEntryCookie = (req: Request) => entryCookieHeader("", ctx.secureOf(req)).replace(/Max-Age=\d+/, "Max-Age=0");

  // ── Signing back in ───────────────────────────────────────────────────────

  app.post("/api/visitor/sign-in", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const key = emailKeyOf(email);
    if (!email || !email.includes("@")) return res.status(400).json({ error: "invalid", message: "That email address does not look right." });
    if (await ctx.overLimit(`visitor-sign-in:${ipBucket(ctx.clientIp(req))}`, 10, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "slow_down", message: "Too many tries from this connection. Try again in an hour." });
    }
    // The same answer whether or not we know the address, so this door names nobody.
    const answer = { ok: true, message: "If this address has a visitor profile here, a 6-digit code is on its way to it." };
    const entry = await latestVerifiedEntry(pool(), key);
    if (!entry || !ctx.mailReady()) return res.json(answer);
    if ((await codesSentTo(pool(), key, new Date(ctx.now() - 60 * 60 * 1000))) >= 6) return res.json(answer);
    await ctx.sendNewCode(entry.id, entry.email);
    res.setHeader("Set-Cookie", `${SIGN_IN_COOKIE}=${encodeURIComponent(signEntry(ctx.secret, entry.id, ctx.now()))}; Path=/api/visitor; HttpOnly; SameSite=Lax; Max-Age=${SIGN_IN_MS / 1000}${ctx.secureOf(req) ? "; Secure" : ""}`);
    res.json(answer);
  });

  app.post("/api/visitor/sign-in/code", async (req, res) => {
    if (await ctx.overLimit(`visitor-sign-in-code:${ipBucket(ctx.clientIp(req))}`, 30, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "slow_down", message: "Too many tries from this connection. Try again in an hour." });
    }
    // The pending sign-in, signed by us; its own expiry is the code's, so the cookie's is checked against the sign-in window.
    const raw = cookieValue(req, SIGN_IN_COOKIE);
    const entryId = raw ? readEntry(ctx.secret, raw, ctx.now()) : null;
    if (!entryId) return res.status(401).json({ error: "sign_in_expired", message: "Ask for a new code: the last one has run out or was for another device." });
    const typed = cleanCode(req.body?.code);
    if (!typed) return res.status(400).json({ error: "invalid", message: "The code is 6 digits." });
    const r = await ctx.redeemCode(entryId, typed);
    if (!r.ok) return res.status(r.status).json(r.body);
    res.setHeader("Set-Cookie", [
      entryCookieHeader(signEntry(ctx.secret, entryId, ctx.now()), ctx.secureOf(req)),
      `${SIGN_IN_COOKIE}=; Path=/api/visitor; HttpOnly; SameSite=Lax; Max-Age=0`,
    ]);
    res.json({ ok: true, ...(r.signedIn ?? {}) });
  });

  // ── The profile ───────────────────────────────────────────────────────────

  async function profileOf(v: { emailKey: string }): Promise<VisitorProfile | null> {
    const db = pool();
    const entry = await latestVerifiedEntry(db, v.emailKey);
    if (!entry) return null;
    const { ids, firstSeen, viaGoogle } = await entriesAt(db, v.emailKey);
    const names = await ctx.roleNames().catch(() => new Map<string, string>());
    const apps = await applicationsAt(db, v.emailKey);
    const journeys = await journeysFor(db, [v.emailKey]);
    const views = await viewsFor(db, ids, 200);
    const pages = Array.from(views.values())
      .flat()
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 200)
      .map((w) => ({ path: w.path, at: w.at }));
    const vr = await visitorAt(db, v.emailKey);
    const again = askAgainFrom(vr?.decidedAt ?? null, vr?.inviteStatus ?? null);
    // The keep-in-touch answer: the newest one given at this address.
    const updates = await latestUpdatesAnswer(db, v.emailKey);
    return {
      name: entry.name,
      email: entry.email,
      whatsapp: entry.whatsapp,
      link: entry.link,
      interest: entry.interest,
      updates,
      verifiedAt: entry.verifiedAt.toISOString(),
      firstSeen: (firstSeen ?? entry.createdAt).toISOString(),
      viaGoogle,
      applications: apps.map((a) => ({
        id: a.id,
        roles: a.roleIds.map((id) => names.get(id) ?? "A role"),
        status: a.status,
        sentAt: a.createdAt.toISOString(),
        decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
        open: a.status === "unconfirmed" || a.status === "confirmed",
      })),
      forms: journeys.get(v.emailKey)?.forms ?? [],
      pages,
      invite: vr?.inviteStatus
        ? {
            status: vr.inviteStatus,
            requestedAt: vr.requestedAt ? vr.requestedAt.toISOString() : null,
            note: vr.inviteNote,
            decidedAt: vr.decidedAt ? vr.decidedAt.toISOString() : null,
            declineWords: vr.declineWords,
            askAgainFrom: again ? again.toISOString() : null,
          }
        : null,
    };
  }

  app.get("/api/visitor/me", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const v = await visitorOf(req);
    if (!v) return res.status(401).json(NOT_A_VISITOR);
    const p = await profileOf(v);
    if (!p) return res.status(401).json(NOT_A_VISITOR);
    res.json({ profile: p });
  });

  app.patch("/api/visitor/me", async (req, res) => {
    const v = await visitorOf(req);
    if (!v) return res.status(401).json(NOT_A_VISITOR);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const d: { name?: string; whatsapp?: string | null; link?: string | null; interest?: string | null } = {};
    if (b.name !== undefined) {
      const name = typeof b.name === "string" ? b.name.replace(/\s+/g, " ").trim() : "";
      if (!name || name.length > 120) return res.status(400).json({ error: "invalid", field: "name", message: "Tell us your name." });
      d.name = name;
    }
    if (b.whatsapp !== undefined) {
      const w = cleanWhatsapp(b.whatsapp);
      if (w === false) return res.status(400).json({ error: "invalid", field: "whatsapp", message: "That WhatsApp number does not look right. Digits, spaces and a leading + are fine." });
      d.whatsapp = w;
    }
    if (b.link !== undefined) {
      const l = cleanLink(b.link);
      if (l === false) return res.status(400).json({ error: "invalid", field: "link", message: "That link does not look right. Paste a web address or a handle such as @yourname." });
      d.link = l ? l.slice(0, LINK_MAX) : null;
    }
    if (b.interest !== undefined) d.interest = isInterest(b.interest) ? b.interest : null;
    await updateVisitorDetails(pool(), v.emailKey, d);
    if (b.updates !== undefined) {
      if (!isUpdatesAnswer(b.updates)) return res.status(400).json({ error: "invalid", field: "updates", message: "Answer yes or no." });
      const words = typeof b.words === "string" ? b.words.trim().slice(0, 2000) : "Changed on the visitor profile.";
      await setUpdatesAnswer(pool(), v.entryId, b.updates, words);
      if (b.updates === "yes") await ctx.listIfYes(v.entryId);
      // A no takes the address off the village's email list too.
      else await removeFromBrevo(ctx.brevo, await portalEmailsFor(pool(), v.emailKey)).catch(() => null);
    }
    res.json({ profile: await profileOf(v) });
  });

  app.get("/api/visitor/me/export", async (req, res) => {
    const v = await visitorOf(req);
    if (!v) return res.status(401).json(NOT_A_VISITOR);
    const p = await profileOf(v);
    const day = new Date(ctx.now()).toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="my-visit-${day}.json"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(JSON.stringify({ exportedAt: new Date(ctx.now()).toISOString(), village: ctx.projectName(), profile: p }, null, 2));
  });

  app.delete("/api/visitor/me", async (req, res) => {
    const v = await visitorOf(req);
    if (!v) return res.status(401).json(NOT_A_VISITOR);
    if (req.body?.confirm !== DELETE_WORD) return res.status(400).json({ error: "confirm", message: `Type ${DELETE_WORD} to delete everything we keep about you.` });
    const db = pool();
    // Applications still waiting are withdrawn; the tidy job takes the name and address off them 90 days after,
    // as it does for every withdrawn or decided application (server/routes/openProposals.ts).
    const withdrawn = await withdrawAllWaiting(db, v.emailKey, new Date(ctx.now()));
    await removeFromBrevo(ctx.brevo, await portalEmailsFor(db, v.emailKey)).catch(() => null);
    await deletePortalCodesFor(db, v.emailKey);
    await deleteVisitorAt(db, v.emailKey);
    const removed = await deletePortalEntriesFor(db, v.emailKey);
    res.setHeader("Set-Cookie", clearEntryCookie(req));
    res.json({ ok: true, removed, withdrawn });
  });

  app.post("/api/visitor/me/sign-out", async (req, res) => { // limit-ok: it only clears this browser's own cookie, no database or mail work
    res.setHeader("Set-Cookie", clearEntryCookie(req));
    res.json({ ok: true });
  });

  // ── Applications ──────────────────────────────────────────────────────────

  const ownApplication = async (v: { emailKey: string }, id: string): Promise<ApplicationRow | null> =>
    (await applicationsAt(pool(), v.emailKey)).find((a) => a.id === id) ?? null;

  app.post("/api/visitor/me/applications/:id/withdraw", async (req, res) => {
    const v = await visitorOf(req);
    if (!v) return res.status(401).json(NOT_A_VISITOR);
    const ok = await withdrawByApplicant(pool(), String(req.params.id), v.emailKey, new Date(ctx.now()));
    if (!ok) return res.status(409).json({ error: "not_open", message: "That application is no longer waiting on a decision, so it cannot be withdrawn here." });
    res.json({ profile: await profileOf(v) });
  });

  /**
   * EDIT IS WITHDRAW AND SEND AGAIN (the lead, 25 Nov 2026). The application is withdrawn, its answers
   * become a saved draft (shared/applicationDrafts.ts), and the visitor reopens the form on it. Files
   * cannot be carried across and are attached again; the page says so before anything happens.
   */
  app.post("/api/visitor/me/applications/:id/edit", async (req, res) => {
    const v = await visitorOf(req);
    if (!v) return res.status(401).json(NOT_A_VISITOR);
    const a = await ownApplication(v, String(req.params.id));
    if (!a || !(a.status === "unconfirmed" || a.status === "confirmed")) {
      return res.status(409).json({ error: "not_open", message: "That application is no longer waiting on a decision, so it cannot be edited here." });
    }
    const entry = await latestVerifiedEntry(pool(), v.emailKey);
    const token = crypto.randomBytes(32).toString("base64url");
    const draft = draftFromApplication(a.body, { name: entry?.name ?? "", email: v.email }, new Date(ctx.now()));
    if (!(await withdrawByApplicant(pool(), a.id, v.emailKey, new Date(ctx.now())))) {
      return res.status(409).json({ error: "not_open", message: "That application changed while you were looking. Reload and try again." });
    }
    await insertDraft(pool(), {
      id: `ad-${crypto.randomBytes(10).toString("hex")}`,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      roleId: a.roleIds[0] ?? "",
      link: a.linkId,
      email: v.email,
      body: draft,
      files: [],
      step: 0,
      at: new Date(ctx.now()),
    });
    res.json({ ok: true, resume: resumePath(token, null) });
  });

  // ── An invitation to full membership ──────────────────────────────────────

  app.post("/api/visitor/me/invitation", async (req, res) => {
    const v = await visitorOf(req);
    if (!v) return res.status(401).json(NOT_A_VISITOR);
    const p = await profileOf(v);
    if (!p) return res.status(401).json(NOT_A_VISITOR);
    if (!mayRequestInvite(p.invite, ctx.now())) {
      return res.status(409).json({ error: "already", message: p.invite?.status === "declined" ? "You can ask again after the date on your profile." : "Your request is already with us." });
    }
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, INVITE_NOTE_MAX) || null : null;
    await requestInvite(pool(), v.emailKey, note, new Date(ctx.now()));
    res.json({ profile: await profileOf(v) });
  });

  // ── The admin half ────────────────────────────────────────────────────────

  app.get("/api/admin/visitors/invitations", async (req, res) => {
    if (!(await ctx.guardCapability(req, res, "intake.moderate"))) return;
    res.setHeader("Cache-Control", "no-store");
    const rows = await waitingRequests(pool());
    const requests: InviteRequest[] = [];
    for (const r of rows) {
      if (!r.entry) continue;
      requests.push({
        visitorId: r.id,
        name: r.entry.name,
        email: r.entry.email,
        note: r.inviteNote,
        requestedAt: (r.requestedAt ?? new Date(0)).toISOString(),
        interest: r.entry.interest,
        applications: r.applications,
        firstSeen: (r.firstSeen ?? r.entry.createdAt).toISOString(),
        hasAccount: !!(await ctx.accounts.byEmail(r.entry.email).catch(() => null)),
      });
    }
    res.json({ requests });
  });

  const idsOf = (req: Request): string[] => (Array.isArray(req.body?.ids) ? req.body.ids.filter((x: unknown) => typeof x === "string").slice(0, 100) : []);

  /**
   * PROMOTE: the act of joining, done by somebody the village lets admit members (`member.superVouch`,
   * the same key the super vouch asks). Each visitor's member account is made already verified (the
   * code or Google proved the address), or, when the address already has an account, that account is
   * the one admitted. Admitted through a super vouch on the promoter's name, then one letter: a link to
   * set a password and fill out their profile.
   */
  app.post("/api/admin/visitors/invitations/promote", async (req, res) => {
    if (!(await ctx.guardCapability(req, res, "member.superVouch"))) return;
    const actor = await ctx.authedUser(req);
    if (!actor) return res.status(401).json({ error: "auth_required" });
    const results: Array<{ id: string; ok: boolean; message?: string; emailed?: boolean }> = [];
    for (const id of idsOf(req)) results.push({ id, ...(await promoteOne(id, String(actor.id))) });
    res.json({ results });
  });

  async function promoteOne(visitorId: string, actorId: string): Promise<{ ok: boolean; message?: string; emailed?: boolean }> {
    const db = pool();
    const vr = await visitorById(db, visitorId);
    if (!vr || vr.inviteStatus !== "requested") return { ok: false, message: "That request has already been answered." };
    const entry = await latestVerifiedEntry(db, vr.emailKey);
    if (!entry) return { ok: false, message: "That visitor's address is no longer verified here." };
    let member = await ctx.accounts.byEmail(entry.email).catch(() => null);
    if (!member) {
      if (!ctx.accounts.add || !ctx.accounts.makeHandle) return { ok: false, message: "Accounts cannot be made from here." };
      const userId = `user-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      member = {
        id: userId,
        name: entry.name,
        email: entry.email,
        // No password yet: the letter carries a link to set one, as a Google member's account starts.
        passwordHash: "",
        handle: await ctx.accounts.makeHandle(entry.name),
        paths: [],
        contributions: [],
        quests: [],
        recognitionBalance: 0,
        joinedAt: new Date(ctx.now()).toISOString(),
        bio: "",
        avatar: null,
        // The visitor proved this address with a code or Google.
        emailVerifiedAt: entry.verifiedAt.toISOString(),
      };
      await ctx.accounts.add(member);
      ctx.accounts.joined?.(member);
    }
    const memberId = String(member.id);
    await recordVouch(db, { id: `vch-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`, voucherUserId: actorId, vouchedUserId: memberId, kind: "super", note: "Promoted from a portal visitor's request" });
    if (!member.membershipGranted) {
      await ctx.accounts.update(memberId, (m: any) => {
        m.membershipGranted = true;
      });
      commsSink.fire({ type: "member_admitted", userId: memberId });
    }
    if (!(await decideInvite(db, visitorId, { status: "promoted", by: actorId, at: new Date(ctx.now()), userId: memberId }))) {
      return { ok: false, message: "That request was answered by somebody else just now." };
    }
    const fresh = (await ctx.accounts.byEmail(entry.email).catch(() => null)) ?? member;
    const mail = await sendPromotionLetter(fresh, entry.name);
    return { ok: true, emailed: mail.sent };
  }

  async function sendPromotionLetter(member: any, name: string): Promise<{ sent: boolean }> {
    const village = ctx.escapeHtml(ctx.projectName());
    const token = makeSetPasswordToken(ctx.secret, String(member.id), Number(member.tokenVersion ?? 0));
    const setUrl = `${ctx.origin()}/set-password?token=${encodeURIComponent(token)}`;
    const profileUrl = `${ctx.origin()}/profile`;
    const first = ctx.escapeHtml(String(name).split(" ")[0] || "friend");
    try {
      const r = await ctx.sendEmail({
        to: [String(member.email)],
        origin: "visitor.promoted",
        subject: `Welcome to ${ctx.projectName()}: you are a member now`,
        html: `<p>Hi ${first},</p>
<p>You asked for an invitation, and you are now a member of ${village}. Your member account is ready.</p>
<p><a href="${ctx.escapeHtml(setUrl)}">Set your password</a>, then go to <a href="${ctx.escapeHtml(profileUrl)}">your profile</a> and fill it out, so the village can get to know you.</p>
<p>If the link has run out, ask for a new one on the sign-in page with this address.</p>`,
        text: `Hi ${String(name).split(" ")[0] || "friend"},\n\nYou asked for an invitation, and you are now a member of ${ctx.projectName()}. Your member account is ready.\n\nSet your password: ${setUrl}\nThen fill out your profile: ${profileUrl}\n\nIf the link has run out, ask for a new one on the sign-in page with this address.\n`,
      });
      return { sent: r.sent };
    } catch {
      return { sent: false };
    }
  }

  app.post("/api/admin/visitors/invitations/decline", async (req, res) => {
    if (!(await ctx.guardCapability(req, res, "member.superVouch"))) return;
    const actor = await ctx.authedUser(req);
    if (!actor) return res.status(401).json({ error: "auth_required" });
    const words = typeof req.body?.words === "string" ? req.body.words.trim().slice(0, 1000) || null : null;
    const results: Array<{ id: string; ok: boolean }> = [];
    for (const id of idsOf(req)) results.push({ id, ok: await decideInvite(pool(), id, { status: "declined", by: String(actor.id), at: new Date(ctx.now()), words }) });
    res.json({ results });
  });
}

/**
 * A sent application's answers as the form's saved draft (client/src/components/fireflyPath/applyDraft.ts
 * reads it back leniently: whatever is missing starts empty). The applicant's own words, the roles and
 * their terms; never references, consent, files or agreements, which the form asks again.
 */
export function draftFromApplication(raw: unknown, who: { name: string; email: string }, now: Date): Record<string, unknown> {
  const o = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const roles: any[] = Array.isArray(o.roles) ? o.roles : [];
  const termsOf = (r: any) => ({ answers: {}, commitmentPct: typeof r?.commitmentPct === "number" ? r.commitmentPct : null, payAsk: r?.payAsk ?? null });
  const cardRoles: any[] = Array.isArray(o.card?.roles) ? o.card.roles : [];
  const items = cardRoles.flatMap((cr) =>
    (Array.isArray(cr?.firstMoon) ? cr.firstMoon : []).map((g: any) => ({ title: String(g?.title ?? g?.text ?? ""), doneWhen: String(g?.doneWhen ?? ""), serves: String(g?.serves ?? ""), roleId: String(cr?.roleId ?? "") })),
  );
  return {
    savedAt: now.toISOString(),
    step: 0,
    reached: 0,
    knowUs: Array.isArray(o.knowUs) ? o.knowUs : [],
    why: typeof o.why === "string" ? o.why : "",
    name: who.name,
    email: who.email,
    about: { based: o.about?.based ?? "", languages: o.about?.languages ?? "", story: o.about?.story ?? "" },
    selfKnowledge: typeof o.selfKnowledge === "string" ? o.selfKnowledge : "",
    links: Array.isArray(o.links) ? o.links.map((l: any) => ({ label: String(l?.label ?? ""), url: String(l?.url ?? "") })) : [],
    aim: typeof o.aim === "string" ? o.aim : "",
    items,
    marks: {},
    terms: termsOf(roles[0]),
    rampUp: o.rampUp === true,
    practical: { timeZone: "", windows: [], earliestStart: "" },
    pieceSuggestions: Array.isArray(o.pieceSuggestions) ? o.pieceSuggestions : [],
    ...(roles.length > 1 ? { extras: roles.slice(1, 3).map((r) => ({ roleId: String(r.roleId), terms: termsOf(r) })) } : {}),
  };
}
