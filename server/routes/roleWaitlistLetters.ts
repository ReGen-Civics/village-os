/**
 * LETTERS TO THE COMING-SOON WAITLIST (the lead, 20 Nov 2026; shared/roleWaitlistLetters.ts
 * holds the contract). Registered from server/routes/comms.ts.
 *
 *   GET  /api/admin/roles/waitlist-letters        the letters sent so far, and whether this village can send
 *   POST /api/admin/roles/waitlist-letters/send   one letter to everyone waiting for one role
 *
 * NOTHING HERE SENDS BY ITSELF. There is no job, no schedule and no agent door: the one
 * route that sends takes `confirm: true` and the count the person was shown, from a person
 * the capability gate passed (`comms.manage`, the village's letters to people who agreed to
 * hear from it). The letter's words come from that person's own screen.
 *
 * Each letter goes as essential mail, because the person asked to hear about this role, and
 * essential mail has no permission ledger to ask. So this route asks the questions essential
 * mail skips: an address on the suppression list is skipped, a village that paused its email or
 * is rehearsing sends nothing, and every letter carries a one-click link off the waitlist
 * (purpose `waitlist_remove`, below).
 *
 * The log keeps who sent, which role, the subject, when and how many. It keeps no address.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { post } from "../lib/comms/postOffice";
import { registerAction, type ActionHandler } from "../lib/comms/actions";
import { signLink } from "../lib/comms/links";
import { isSuppressed } from "../lib/comms/suppressions";
import { dressLetter } from "../lib/comms/villageLetter";
import { recentEvents, recordEvent } from "../lib/events";
import { listOrgRoles } from "../lib/orgChart";
import { removeWaitlistAddressOf, waitlistForRole, waitlistRowById } from "../repos/roleWaitlist";
import { createHash } from "node:crypto";
import {
  oneRowPerAddress,
  readWaitlistLetter,
  REMOVE_PAGE_WORDS,
  UNSUBSCRIBE_LINES,
  WAITLIST_LETTER_EVENT,
  WAITLIST_LETTER_LIMITS,
  WAITLIST_LETTER_PROBLEMS,
  waitlistLetterLogLine,
} from "../../shared/roleWaitlistLetters";
import type { PostResult } from "../../shared/comms/contracts";

type Deps = Pick<AppDeps, "authedUser" | "guardCapability" | "mayStillSee" | "getPool" | "commsPostOffice" | "members" | "projectName">;

const REFUSAL = { status: 403, body: { error: "Sending the village's letters is an appointment" } };
const WENT: ReadonlySet<PostResult["status"]> = new Set<PostResult["status"]>(["sending", "sent", "delivered", "duplicate"]);
const LINK_DAYS = 365;
/** Sends in the air at once. */
const AT_ONCE = 8;

/** The window's presses, per person, kept in memory: a restart forgets them, and the capability gate is the real door. */
const presses = new Map<string, number[]>();
function pressedTooOften(userId: string, now = Date.now()): boolean {
  const recent = (presses.get(userId) ?? []).filter((t) => now - t < WAITLIST_LETTER_LIMITS.windowMs);
  recent.push(now);
  presses.set(userId, recent);
  return recent.length > WAITLIST_LETTER_LIMITS.perWindow;
}

/** The one-click removal's page: describes first, acts only on the press. */
export function waitlistRemoveAction(deps: { getPool: Deps["getPool"] }): ActionHandler {
  const rowId = (p: Record<string, unknown>) => (typeof p.w === "string" ? p.w : "");
  const words = (p: Record<string, unknown>) => REMOVE_PAGE_WORDS[p.l === "es" ? "es" : "en"];
  return {
    purpose: "waitlist_remove",
    async describe(payload, ctx) {
      const w = words(payload);
      const row = await waitlistRowById(deps.getPool(), rowId(payload));
      if (!row) return { purpose: "waitlist_remove", title: w.doneTitle, paragraphs: [w.gone], choices: [], current: null };
      return {
        purpose: "waitlist_remove",
        title: w.title(ctx.village),
        paragraphs: [w.ask],
        choices: [
          { value: "remove", label: w.button, primary: true },
          { value: "keep", label: w.keep },
        ],
        current: null,
      };
    },
    async act(payload, body, ctx) {
      const w = words(payload);
      if (body.choice === "keep") return { ok: true, outcome: { ok: true, title: w.keep, paragraphs: [], description: null } };
      if (body.choice !== "remove") return { ok: false, status: 400, error: "Choose to come off the waitlist or to stay on it." };
      await removeWaitlistAddressOf(deps.getPool(), rowId(payload));
      return { ok: true, outcome: { ok: true, title: w.doneTitle, paragraphs: [w.done], description: null } };
    },
  };
}

export function register(app: Express, deps: Deps): void {
  const { authedUser, guardCapability, mayStillSee, getPool, commsPostOffice, members } = deps;
  registerAction(waitlistRemoveAction({ getPool }));

  /** Whether this village can send real letters right now, and the sentence when it cannot. */
  async function blocker(): Promise<string | null> {
    if (!commsPostOffice.hasApiKey() || commsPostOffice.sender() === "") return "This village has no email sender set up yet. Set it up under Email settings first.";
    try {
      const mode = commsPostOffice.mode ? await commsPostOffice.mode() : null;
      if (mode?.paused) return "The village's email is paused. Take the pause off first.";
      if (mode?.lifecycle === "preview") return "The village's email is rehearsing, so no real letter goes out. Switch it live first.";
    } catch {
      return "The village's email state could not be read, so nothing is sent.";
    }
    return null;
  }

  app.get("/api/admin/roles/waitlist-letters", async (req, res) => {
    if (!(await authedUser(req))) return res.status(401).json({ error: "auth_required" });
    if (!(await mayStillSee(req, "comms.manage"))) return res.status(REFUSAL.status).json(REFUSAL.body);
    const events = (await recentEvents(getPool(), "admin", 500)).filter((e) => e.kind === WAITLIST_LETTER_EVENT).slice(0, 30);
    const names = new Map<string, string>();
    for (const e of events) {
      if (e.actorUserId && !names.has(e.actorUserId)) {
        const m: any = await members.byId(e.actorUserId);
        names.set(e.actorUserId, String(m?.name ?? "").trim() || "A member");
      }
    }
    res.set("Cache-Control", "no-store").json({
      blocked: await blocker(),
      sent: events.map((e) => ({ id: e.id, at: e.at, by: e.actorUserId ? names.get(e.actorUserId) ?? "A member" : "A member", line: e.text, roleId: e.entityRef })),
    });
  });

  app.post("/api/admin/roles/waitlist-letters/send", async (req, res) => {
    if (!(await guardCapability(req, res, "comms.manage", REFUSAL))) return;
    const user = await authedUser(req);
    if (!user?.id) return res.status(401).json({ error: "auth_required" });
    const read = readWaitlistLetter(req.body);
    if (!read.ok) return res.status(400).json({ error: "invalid", field: read.field, message: read.problem });
    const ask = read.value;
    if (pressedTooOften(String(user.id))) return res.status(429).json({ error: "too_many", message: "Too many letters this hour. Try again later." });
    const why = await blocker();
    if (why) return res.status(409).json({ error: "cannot_send", message: why });

    const pool = getPool();
    const role = (await listOrgRoles(pool)).find((r) => r.id === ask.roleId);
    if (!role) return res.status(404).json({ error: "no_role", message: WAITLIST_LETTER_PROBLEMS.role });
    const rows = oneRowPerAddress((await waitlistForRole(pool, ask.roleId)).map((r) => ({ ...r, email: r.emailKey })));
    if (!rows.length) return res.status(409).json({ error: "nobody", message: WAITLIST_LETTER_PROBLEMS.nobody });
    if (rows.length > WAITLIST_LETTER_LIMITS.recipients) return res.status(409).json({ error: "too_many_people", message: WAITLIST_LETTER_PROBLEMS.tooMany, count: rows.length });
    if (ask.expectedCount !== rows.length) return res.status(409).json({ error: "count_changed", message: WAITLIST_LETTER_PROBLEMS.count, count: rows.length });

    const origin = commsPostOffice.origin();
    const village = String(deps.projectName() ?? "").trim() || "the village";
    // One id for this press, so the same press twice is one letter per person.
    const pressId = createHash("sha256").update(`${user.id}|${ask.roleId}|${ask.subject}|${ask.body}|${Date.now()}`).digest("hex").slice(0, 16);
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    async function one(row: (typeof rows)[number]): Promise<void> {
      if (await isSuppressed(pool, row.emailKey)) {
        skipped += 1;
        return;
      }
      const token = signLink("waitlist_remove", { w: row.id, l: ask.lang }, LINK_DAYS);
      const link = `${origin.replace(/\/$/, "")}/email/a?t=${encodeURIComponent(token)}`;
      const text = `${ask.body}\n\n${UNSUBSCRIBE_LINES[ask.lang](village, link)}`;
      const dressed = await dressLetter(pool, origin, { subject: ask.subject, text }, { lang: ask.lang, comeAndPlay: false, villageName: village });
      const result = await post(commsPostOffice, {
        idempotencyKey: `waitlist-letter:${pressId}:${row.id}`,
        kind: "essential",
        origin: "role_waitlist.letter",
        to: { email: row.emailKey },
        subject: ask.subject,
        html: dressed.html,
        text: dressed.text,
        preheader: dressed.preheader,
      });
      if (WENT.has(result.status)) sent += 1;
      else if (result.status === "skipped") skipped += 1;
      else failed += 1;
    }

    for (let i = 0; i < rows.length; i += AT_ONCE) await Promise.all(rows.slice(i, i + AT_ONCE).map(one));

    await recordEvent(pool, {
      kind: WAITLIST_LETTER_EVENT,
      text: waitlistLetterLogLine({ role: role.name, subject: ask.subject, sent, skipped, failed }),
      actorUserId: String(user.id),
      actorKind: "human",
      entityType: "role",
      entityRef: ask.roleId,
      audience: "admin",
    });
    res.json({ ok: true, sent, skipped, failed });
  });
}
