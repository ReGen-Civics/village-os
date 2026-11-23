/**
 * The admin roster: who is in the village, and what stage they are at.
 *
 * Two routes, lifted out of server/index.ts unchanged, and one added beside them:
 *
 *   GET /api/admin/players                the roster, sorted by name
 *   PUT /api/admin/players/:id/stage      grant or clear a stage by hand
 *   PUT /api/admin/players/:id/ops-email  turn a member's operations report email off or back on
 *
 * WHAT STAYED BEHIND, and why that is safe. `DELETE /api/admin/players/:id`
 * sits immediately after these two in server/index.ts and is still there. It
 * reaches the departure machinery (stranding refusals, the anonymiser, the
 * exit ledger), which is a much wider slice than anything here, so taking it
 * would have widened this module's dependency list several times over for one
 * route. Express matches on method as well as path, so a DELETE registered
 * later than this module's GET and PUT resolves exactly as it did before.
 *
 * FOUR HELPERS COME IN THROUGH `deps` AND ARE NOT IMPORTED. `computeStage`,
 * `stageOf`, `hasMembership` and `recordStageEvent` are declared at module
 * scope in server/index.ts and read game variables, quest claims and the
 * capability registry. Importing them from here would mean exporting them
 * from the file this work exists to shrink, and would make server/index.ts
 * and this module import each other. Passing them keeps the arrow pointing
 * one way. Same argument as the gates: see server/lib/appDeps.ts.
 *
 * THE THREE BATCHED READS BESIDE THEM are `claimsRepo.consentedCounts`,
 * `trainingCompletions` and `paidByVillage`, and they are the three facts the
 * ladder wants for a whole roster. Each answers for every member in ONE query.
 * That is not an optimisation to preserve politely: this route lists the whole
 * village, so a per-member form of any of them turns one page into N queries,
 * and `paidByVillage` was added here in 2026-09 because the rung it carries
 * was simply missing from the answer.
 *
 * REGISTERED WHERE IT WAS, because Express matches in registration order.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { sortMembersByName } from "../../shared/memberOrder";
import { grantStage } from "../lib/stageGrant";
import { roleHoldersNow } from "../repos/pathLadders";
import { recordEvent } from "../lib/events";
import { resolveNotifyPrefs } from "../lib/notify";

type Deps = Pick<
  AppDeps,
  | "isAdmin"
  | "authedUser"
  | "members"
  | "claimsRepo"
  | "computeStage"
  | "trainingCompletions"
  | "paidByVillage"
  | "hasMembership"
  | "stageOf"
  | "recordStageEvent"
  | "getPool"
  | "lapseContext"
> & {
  /** Sheet 19: the power groups that give this member admin access right now, by name. */
  adminGroupsFor(userId: string): string[];
};

export function register(app: Express, deps: Deps): void {
  const { isAdmin, authedUser, members, claimsRepo, computeStage, trainingCompletions, paidByVillage, hasMembership, stageOf, recordStageEvent, getPool, lapseContext, adminGroupsFor } = deps;

  // Players admin: list + stage grants
  app.get("/api/admin/players", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    // Standing-example identities author example threads; they are content,
    // not people, and have no password_hash. They do not belong on the roster.
    // SORTED BY NAME, and this is the one place that decides it for nine
    // client surfaces. `members.all()` answers in join order, which is total
    // and never moves under a write, so nothing here is chasing stability.
    // Join order is simply unsearchable: this payload feeds the roster, the
    // seat picker on /admin org chart, and six member dropdowns, and every one
    // of them listed people in registration sequence. Sorting at the route
    // rather than in each caller keeps admin to ONE order.
    const allMembers = sortMembersByName((await members.all()).filter((u: any) => !u.isExample));
    // One grouped COUNT for the whole roster, not one query per member.
    const consented = await claimsRepo.consentedCounts();
    // Same reason as the line above: one query for the whole roster.
    const trained = await trainingCompletions(allMembers.map((u: any) => String(u.id)));
    // THE FOURTH FACT THE LADDER WANTS, and the one this roster used to drop.
    // Contributor is the rung the village pays you onto, and it opens
    // `member.vouch`, so a steward deciding whether somebody may speak for a
    // newcomer was reading a rung too low for everybody the village had paid.
    // Third read of the same shape as the two above, and batched for the same
    // reason: a per-member ledger question inside the map below would cost one
    // query per member on a page that lists all of them.
    const paid = await paidByVillage(allMembers.map((u: any) => String(u.id)));
    // The fifth: who holds an org-chart role right now, which lifts Role Holder
    // on its own (Rye, 2026-10-31). One query for the roster, same as the others.
    const holders = await roleHoldersNow(getPool(), lapseContext());
    res.json(
      allMembers.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        handle: u.handle ?? null,
        role: u.role ?? "member",
        paths: u.paths ?? [],
        joinedAt: u.joinedAt,
        balance: u.recognitionBalance ?? 0,
        stageGranted: u.stageGranted ?? null,
        stageComputed: computeStage(u, consented.get(u.id) ?? 0, trained.get(String(u.id)) ?? [], paid.has(String(u.id)), holders.has(String(u.id))),
        membership: hasMembership(u),
        adminVia: adminGroupsFor(String(u.id)),
        // The operations report email (server/lib/notify.ts, `opsEmail`), so the roster can show and change it.
        opsEmail: resolveNotifyPrefs(u.prefs).opsEmail,
      }))
    );
  });

  // The one path a stage is granted by (server/lib/stageGrant.ts), which an adopted open role proposal takes too.
  app.put("/api/admin/players/:id/stage", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const { stageId } = req.body ?? {};
    const out = await grantStage({ members, stageOf, recordStageEvent }, req.params.id, stageId, stageId ? "granted by an admin" : "grant removed");
    if (!out.ok) return res.status(out.status).json(out.body);
    res.json({ success: true, stageComputed: out.stageComputed });
  });

  /*
   * THE OPERATIONS REPORT EMAIL, SET BY AN ADMIN FOR SOMEBODY ELSE.
   *
   * The daily failed-actions report goes to every admin and founder. A member
   * whose seat is not operational can switch its email off on their own
   * profile; this is the same preference, written by an admin, so it can stop
   * today without that member signing in. It writes `prefs.notify.opsEmail`
   * and nothing else: the bell row still lands, every other email preference
   * is untouched, and no steward pin reads this key.
   *
   * The audit row names no one in its text. The member is the entity it is
   * about, and the admin is its actor.
   */
  app.put("/api/admin/players/:id/ops-email", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const actor = await authedUser(req);
    const value = (req.body as { opsEmail?: unknown } | undefined)?.opsEmail;
    if (value !== "daily" && value !== "off") return res.status(400).json({ error: "opsEmail is daily or off." });
    const userId = String(req.params.id ?? "").slice(0, 64);
    const updated = await members.update(userId, (u: any) => {
      u.prefs = { ...(u.prefs ?? {}), notify: { ...(u.prefs?.notify ?? {}), opsEmail: value } };
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    await recordEvent(getPool(), {
      kind: "audit",
      text: value === "off" ? "turned a member's operations report email off" : "turned a member's operations report email back on",
      actorUserId: actor?.id ? String(actor.id) : null,
      entityType: "user",
      entityRef: userId,
      audience: "admin",
    });
    res.json({ userId, opsEmail: resolveNotifyPrefs(updated.prefs).opsEmail });
  });
}
