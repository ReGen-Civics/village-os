/**
 * The doors for a task handed to a role (shared/roleTaskHandoff.ts holds the
 * contract; server/lib/roleTaskHandoffs.ts the rules).
 *
 *   POST /api/member-tasks/handoffs              a new task for a role
 *
 * One of your own goes to a role through the list's own redirect door
 * (POST /api/member-tasks/me/:id/redirect with `toRoleId`, plus `handoffNote`
 * and `handoffDueOn`), which lands it here the same way.
 *   GET  /api/member-tasks/handoffs/sent         what you sent, with its status
 *   GET  /api/member-tasks/handoffs/waiting      what waits on you, for Waiting on you
 *   POST /api/member-tasks/handoffs/:id/respond  accept, suggest a change, or decline
 *   POST /api/member-tasks/handoffs/:id/withdraw take it back while it waits
 *
 * Registered from server/routes/memberTaskBridge.ts, so server/index.ts gains
 * no line. Sending needs the sender's own list on; reading what waits needs
 * only a signed-in reader, since a role holder whose list is off still has to
 * see what waits on the role. Accepting needs the list on, because that is
 * where the accepted task lands.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { boolVar } from "../lib/variables";
import { registerJob } from "../lib/scheduler";
import { villageDayKey } from "../../shared/companionItems";
import {
  HANDOFF_ID, HANDOFF_LIMITS, HANDOFF_REFUSALS, HANDOFFS_SENT_URL, HANDOFFS_URL, HANDOFFS_WAITING_URL, parseHandoffWords,
} from "../../shared/roleTaskHandoff";
import { listIsOn } from "../repos/memberTasks";
import { activeRoles } from "../repos/memberTaskFeedback";
import { noticeDone, respondToHandoff, sendToRole, sentFrom, waitingFor, withdrawHandoff, type HandoffDeps } from "../lib/roleTaskHandoffs";

export type HandoffRouteDeps = Pick<AppDeps, "authedUser" | "getPool" | "overLimit" | "isAdmin"> & {
  timeZone: () => string;
  notify?: AppDeps["notify"];
};

const HOUR_MS = 60 * 60 * 1000;

export function register(app: Express, deps: HandoffRouteDeps): void {
  const { authedUser, getPool, overLimit, isAdmin, timeZone } = deps;
  const today = () => villageDayKey(new Date(), timeZone());
  const rules: HandoffDeps = {
    notify: async (input) => (deps.notify ? deps.notify(input) : undefined),
    today,
    timeZone,
  };
  const listOn = (uid: string) => listIsOn(getPool(), uid, boolVar("memberTasks.listDefault"));

  // The sender hears when the task someone accepted is marked done.
  registerJob("role-task-handoff-done", 15 * 60 * 1000, async () => `${await noticeDone(getPool(), rules)} done notice(s) asked for`);

  /** A signed-in reader, bounded when writing. Null after answering. */
  const reader = async (req: any, res: any, bucket: string | null, max = 0): Promise<string | null> => {
    const me = await authedUser(req);
    if (!me) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    const uid = String(me.id);
    if (bucket && (await overLimit(`${bucket}:${uid}`, max, HOUR_MS))) {
      res.status(429).json({ error: "That is a lot for one hour. Try again a little later." });
      return null;
    }
    return uid;
  };

  /** A sender: signed in, bounded, and their own list on. */
  const sender = async (req: any, res: any, write: boolean): Promise<string | null> => {
    const uid = await reader(req, res, write ? "role-handoff-send" : null, HANDOFF_LIMITS.sendsPerHour);
    if (!uid) return null;
    if (!(await listOn(uid))) {
      res.status(403).json({ error: "list_off" });
      return null;
    }
    return uid;
  };

  const liveRole = async (raw: unknown): Promise<string | null> => {
    const id = typeof raw === "string" ? raw : "";
    return id && (await activeRoles(getPool())).some((r) => r.id === id) ? id : null;
  };

  app.post(HANDOFFS_URL, async (req, res) => {
    const uid = await sender(req, res, true);
    if (!uid) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const roleId = await liveRole(body.roleId);
    if (!roleId) return res.status(400).json({ error: HANDOFF_REFUSALS.noRole });
    const words = parseHandoffWords(body, today());
    if (!words.ok) return res.status(400).json({ error: words.error });
    const id = await sendToRole(getPool(), rules, { senderId: uid, roleId, words: words.value });
    res.status(201).json({ id });
  });

  app.get(HANDOFFS_SENT_URL, async (req, res) => {
    const uid = await sender(req, res, false);
    if (!uid) return;
    res.set?.("Cache-Control", "no-store");
    res.json({ sent: await sentFrom(getPool(), uid, timeZone()) });
  });

  app.get(HANDOFFS_WAITING_URL, async (req, res) => {
    const uid = await reader(req, res, null);
    if (!uid) return;
    res.set?.("Cache-Control", "no-store");
    res.json({ waiting: await waitingFor(getPool(), { userId: uid, isAdmin: await isAdmin(req) }, timeZone()) });
  });

  app.post(`${HANDOFFS_URL}/:id/respond`, async (req, res) => {
    const uid = await reader(req, res, "role-handoff-respond", HANDOFF_LIMITS.respondsPerHour);
    if (!uid) return;
    const id = String(req.params.id ?? "");
    if (!HANDOFF_ID.test(id)) return res.status(404).json({ error: HANDOFF_REFUSALS.notFound });
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (body.action === "accept" && !(await listOn(uid))) return res.status(409).json({ error: HANDOFF_REFUSALS.listOff });
    const out = await respondToHandoff(getPool(), rules, { userId: uid, isAdmin: await isAdmin(req) }, id, body);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    res.json(out.value);
  });

  app.post(`${HANDOFFS_URL}/:id/withdraw`, async (req, res) => {
    const uid = await reader(req, res, "role-handoff-respond", HANDOFF_LIMITS.respondsPerHour);
    if (!uid) return;
    const id = String(req.params.id ?? "");
    if (!HANDOFF_ID.test(id)) return res.status(404).json({ error: HANDOFF_REFUSALS.notFound });
    const out = await withdrawHandoff(getPool(), uid, id);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    res.json({ withdrawn: true });
  });
}
