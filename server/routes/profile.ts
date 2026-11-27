/**
 * A member's own account record: read it, change it, add a note to it.
 *
 *   GET  /api/profile               the signed-in member's own record
 *   PUT  /api/profile               name, bio, avatar, handle, paths
 *   POST /api/profile/contribution  a journal entry the member writes
 *   GET  /api/profile/leaving-notices  what deleting their account will cancel
 *   GET  /api/profile/booking-link     their own booking page link, or null
 *   PUT  /api/profile/booking-link     save it (https only), or clear it with ""
 *   GET  /api/profile/speed-cards      their own six quick cards on the phone's More sheet, or null
 *   PUT  /api/profile/speed-cards      save them (shared/speedCards.ts), or clear them with null
 *   GET  /api/profile/how-we-work-read when they ticked "I've read this" under How we work together, or null
 *   PUT  /api/profile/how-we-work-read tick it ({ read: true }) or clear it ({ read: false }) (shared/howWeWorkRead.ts)
 *
 * Lifted out of server/index.ts with the handlers unchanged apart from the
 * path validation named below. `HANDLE_RE` came with them: server/index.ts
 * held it at module scope and this was its only reader.
 *
 * WHY THESE THREE TOGETHER. One subject and one audience: the account behind
 * the bearer token, answering only to itself. Every one of them refuses a
 * stranger with the same 401. ONE OF THEM READS EVERY MEMBER: `PUT` checks a
 * new handle against every other member's handle through `members.all()`,
 * which is a read of the whole roll, and that is why the slice is `members`
 * and not a single-row getter. This header used to say none of them read
 * another member's row, and docs/modules/profiles.md picked the sentence up as
 * current. The neighbouring /api/profile/prefs routes stay where they are:
 * they resolve notification preferences, which is a different dependency slice.
 *
 * REGISTERED WHERE IT WAS. `register()` is called from startServer at exactly
 * the point these routes used to occupy, because Express matches in
 * registration order.
 *
 * THE ONE BEHAVIOUR CHANGE. `PUT /api/profile` accepted any JSON at all under
 * `paths` and wrote it to the column: a string, an object, ids nothing had
 * ever defined. It now runs `claimPaths` (shared/gameConfig.ts) and answers
 * 400 for anything the village does not offer. That route is the only door a
 * member can open onto their own paths, and until the profile grew a claim
 * control nothing in the client had ever sent the field.
 *
 * THE SESSION IS ASKED AGAIN UNDER THE LOCK. Both writes check the session
 * once, then wait for the row lock, and the handle check reads every member in
 * between. A save already past its check when the member was erased, or when
 * their password was reset or their sessions revoked, took the lock after
 * that and wrote anyway: onto a tombstone, the real name and handle came back
 * and every surface that de-attributes through the join printed them again.
 * So the mutator refuses a row that is a tombstone or whose session version
 * moved, and the route answers 401, the way set-password already rechecks.
 * `server/repos/users.ts` pins a tombstone's identity for every other writer.
 */
import type { Express } from "express";
import { claimPaths } from "../../shared/gameConfig";
import { MEMBER_BOOKING_PREF, memberBookingUrl, parseMemberBookingInput } from "../../shared/interviewBooking";
import { SPEED_CARDS_PREF, parseSpeedCardSlots, readSpeedCards } from "../../shared/speedCards";
import { HOW_WE_WORK_READ_PREF, parseReadInput, readHowWeWorkRead } from "../../shared/howWeWorkRead";
import type { AppDeps } from "../lib/appDeps";
import { isTombstone } from "../lib/oauthAccounts";
import { subscriptionsState } from "../lib/exit";
import { DEPARTED_HANDLE_REFUSAL, isDepartedHandle } from "../lib/profile";
import { FORMER_MEMBER_HOLD } from "../lib/exitResolve";
// Village Comms: the one door to the email system (server/lib/commsSink.ts).
import { commsSink } from "../lib/commsSink";
import { readsAsPlainMember } from "../lib/readAsMember";

type Deps = Pick<AppDeps, "authedUser" | "members" | "publicUser" | "getPool">;

/** A handle is 3 to 30 characters: letters, numbers, dashes, underscores. */
const HANDLE_RE = /^[a-z0-9][a-z0-9-_]{2,29}$/;

/** The row under the lock is no longer the session's: erased, or its sessions ended since the check. */
function sessionGone(row: any, authed: any): boolean {
  return isTombstone({ email: String(row.email ?? "") }) || Number(row.tokenVersion ?? 0) !== Number(authed.tokenVersion ?? 0);
}

/** The roles whose holder the client draws admin and founder surfaces for (useIsAdmin, client/src/contexts/AuthContext.tsx). */
const ADMIN_ROLES = new Set(["admin", "founder"]);

/**
 * A profile as a plain member's (the live view for QA reads as one, server/lib/readAsMember.ts). The server
 * already answers every other read as a plain member, so a profile still saying admin or founder made the
 * client draw admin surfaces whose reads the server then refused. Anything else in the profile is the
 * holder's own and stays.
 */
export function asPlainMember<T extends { role?: unknown; adminAccess?: unknown } | null>(profile: T): T {
  if (!profile) return profile;
  return {
    ...profile,
    role: ADMIN_ROLES.has(String(profile.role)) ? "member" : profile.role,
    adminAccess: false,
  };
}

export function register(app: Express, deps: Deps): void {
  const { authedUser, members, publicUser, getPool } = deps;

  // Auth: Get Profile
  app.get("/api/profile", async (req, res) => {
    // Through requireUser like everything else (S1): a second decode path here
    // silently bypassed the tokenVersion revocation check.
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const profile = publicUser(user);
    res.json(readsAsPlainMember(req) ? asPlainMember(profile) : profile);
  });

  // Auth: Update Profile
  app.put("/api/profile", async (req, res) => {
    const authed = await authedUser(req);
    if (!authed) return res.status(401).json({ error: "auth_required" });
    const { name, bio, avatar, paths, handle } = req.body;
    let wanted: string | undefined;
    if (handle !== undefined) {
      wanted = String(handle).toLowerCase().trim();
      if (!HANDLE_RE.test(wanted)) {
        return res.status(400).json({ error: "Handles are 3-30 characters: letters, numbers, dashes" });
      }
      // A member who already wears one, from before this rule, keeps saving
      // their profile with it; nobody moves onto one (server/lib/profile.ts).
      if (isDepartedHandle(wanted) && wanted !== String(authed.handle ?? "").toLowerCase()) {
        return res.status(400).json({ error: DEPARTED_HANDLE_REFUSAL });
      }
      const clash = (await members.all()).some(
        (u: any) => u.id !== authed.id && String(u.handle ?? "").toLowerCase() === wanted,
      );
      if (clash) return res.status(409).json({ error: "That handle is taken" });
    }
    const claimed = claimPaths(paths, authed.paths ?? []);
    if (!claimed.ok) return res.status(400).json({ error: claimed.error });
    // Copied BEFORE the update: the cached record can be the very object it mutates.
    const pathsBefore = new Set<string>(Array.isArray(authed.paths) ? authed.paths : []);
    let gone = false;
    const updated = await members.update(authed.id, (u: any) => {
      if ((gone = sessionGone(u, authed))) return;
      if (name) u.name = name;
      if (bio !== undefined) u.bio = bio;
      if (avatar !== undefined) u.avatar = avatar;
      if (claimed.paths !== undefined) u.paths = claimed.paths;
      if (wanted !== undefined) u.handle = wanted;
    });
    if (gone) return res.status(401).json({ error: "auth_required" });
    if (!updated) return res.status(404).json({ error: "User not found" });
    const pathsAfter = new Set<string>(Array.isArray(updated.paths) ? updated.paths : []);
    for (const pathId of Array.from(pathsAfter)) if (!pathsBefore.has(pathId)) commsSink.fire({ type: "path_joined", personKey: authed.id, userId: authed.id, pathId, source: "profile" });
    for (const pathId of Array.from(pathsBefore)) if (!pathsAfter.has(pathId)) commsSink.fire({ type: "path_left", personKey: authed.id, userId: authed.id, pathId, source: "profile" });
    res.json(publicUser(updated));
  });

  // Auth: Log Contribution
  app.post("/api/profile/contribution", async (req, res) => {
    const authed = await authedUser(req);
    if (!authed) return res.status(401).json({ error: "auth_required" });
    const { type, description } = req.body;
    if (!type || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    // A JOURNAL ENTRY, never a payment. This route used to add a
    // caller-supplied `recognitionEarned` straight onto the member's
    // balance: self-service minting, off-ledger, breaking the conservation
    // proof. Value only ever moves through postTransfer behind a human
    // consent gate (quest consent, gratitude send, admin mint). The note
    // itself is still worth keeping: it is the member's own record.
    const contribution = {
      id: `contrib-${Date.now()}`,
      type: String(type).slice(0, 120),
      description: String(description).slice(0, 2000),
      date: new Date().toISOString(),
    };
    let gone = false;
    const updated = await members.update(authed.id, (u: any) => {
      if ((gone = sessionGone(u, authed))) return;
      u.contributions = u.contributions ?? [];
      u.contributions.push(contribution);
    });
    if (gone) return res.status(401).json({ error: "auth_required" });
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, contribution });
  });

  /*
   * What deleting the account will cancel, read before the member confirms
   * (round 3, finding 5). Today that is their recurring payments: the erasure
   * cancels each one in Stripe, nothing in the app lets a member cancel one
   * themselves, and they should hear it before the delete and not on their
   * next card statement. The sentence is the exit desk's own
   * (`subscriptionsState`, server/lib/exit.ts), so the admin and the member
   * read the same words. Only the member's own, and only notices that say
   * something: a member with nothing to cancel gets an empty list.
   *
   * `?for=exit` is the departure page (ExitPolicy): a departure keeps a
   * member who holds tokens as a former member, and their payments keep
   * renewing, so that page reads the exit desk's sentence. Anything else is
   * the delete panel, where a delete always erases and cancels.
   */
  app.get("/api/profile/leaving-notices", async (req, res) => {
    const authed = await authedUser(req);
    if (!authed) return res.status(401).json({ error: "auth_required" });
    const path = req.query?.for === "exit" ? "exit" : "delete";
    const subscriptions = await subscriptionsState(getPool(), String(authed.id), path, FORMER_MEMBER_HOLD);
    res.json({ notices: subscriptions.count > 0 ? [subscriptions] : [] });
  });

  /**
   * THE MEMBER'S OWN BOOKING LINK (shared/interviewBooking.ts). An applicant
   * books a conversation with the person holding that step's role through this
   * link. https only, checked on the way in and again on every read; an empty
   * value clears it. Answers only for the signed-in member.
   */
  app.get("/api/profile/booking-link", async (req, res) => {
    const authed = await authedUser(req);
    if (!authed) return res.status(401).json({ error: "auth_required" });
    res.set("Cache-Control", "no-store").json({ bookingUrl: memberBookingUrl(authed.prefs) });
  });

  app.put("/api/profile/booking-link", async (req, res) => {
    const authed = await authedUser(req);
    if (!authed) return res.status(401).json({ error: "auth_required" });
    const parsed = parseMemberBookingInput(req.body?.bookingUrl);
    if (!parsed.ok) return res.status(400).json({ error: parsed.problem });
    let gone = false;
    const updated = await members.update(authed.id, (u: any) => {
      if ((gone = sessionGone(u, authed))) return;
      const prefs = { ...(u.prefs ?? {}) };
      if (parsed.value) prefs[MEMBER_BOOKING_PREF] = parsed.value;
      else delete prefs[MEMBER_BOOKING_PREF];
      u.prefs = prefs;
    });
    if (gone) return res.status(401).json({ error: "auth_required" });
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ bookingUrl: memberBookingUrl(updated.prefs) });
  });

  /**
   * THE MEMBER'S OWN SPEED CARDS (shared/speedCards.ts): the six quick cards on the phone's More sheet, kept in
   * their own prefs so the cards follow them to every device. Only the shape is checked here; which pages the member
   * may open is the menu's rule, and the client draws a saved card only while the menu offers it. Answers only for
   * the signed-in member, and writes only their own row.
   */
  app.get("/api/profile/speed-cards", async (req, res) => {
    const authed = await authedUser(req);
    if (!authed) return res.status(401).json({ error: "auth_required" });
    res.set("Cache-Control", "no-store").json({ slots: readSpeedCards(authed.prefs) });
  });

  app.put("/api/profile/speed-cards", async (req, res) => {
    const authed = await authedUser(req);
    if (!authed) return res.status(401).json({ error: "auth_required" });
    const parsed = parseSpeedCardSlots(req.body?.slots);
    if (!parsed.ok) return res.status(400).json({ error: parsed.problem });
    let gone = false;
    const updated = await members.update(authed.id, (u: any) => {
      if ((gone = sessionGone(u, authed))) return;
      const prefs = { ...(u.prefs ?? {}) };
      if (parsed.value) prefs[SPEED_CARDS_PREF] = parsed.value;
      else delete prefs[SPEED_CARDS_PREF];
      u.prefs = prefs;
    });
    if (gone) return res.status(401).json({ error: "auth_required" });
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ slots: readSpeedCards(updated.prefs) });
  });

  /**
   * "I'VE READ THIS" UNDER HOW WE WORK TOGETHER (shared/howWeWorkRead.ts; the lead, 27 Nov 2026). The moment a member
   * ticked it, kept in their own prefs so the first chapter folds for them on every device and their profile lists
   * it as read. The server stamps the moment; the member only says yes or no. Answers only for the signed-in member,
   * writes only their own row, and keeps every other pref they hold.
   */
  app.get("/api/profile/how-we-work-read", async (req, res) => {
    const authed = await authedUser(req);
    if (!authed) return res.status(401).json({ error: "auth_required" });
    res.set("Cache-Control", "no-store").json({ readAt: readHowWeWorkRead(authed.prefs) });
  });

  app.put("/api/profile/how-we-work-read", async (req, res) => {
    const authed = await authedUser(req);
    if (!authed) return res.status(401).json({ error: "auth_required" });
    const parsed = parseReadInput(req.body?.read);
    if (!parsed.ok) return res.status(400).json({ error: parsed.problem });
    let gone = false;
    const updated = await members.update(authed.id, (u: any) => {
      if ((gone = sessionGone(u, authed))) return;
      const prefs = { ...(u.prefs ?? {}) };
      if (parsed.read) prefs[HOW_WE_WORK_READ_PREF] = new Date().toISOString();
      else delete prefs[HOW_WE_WORK_READ_PREF];
      u.prefs = prefs;
    });
    if (gone) return res.status(401).json({ error: "auth_required" });
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ readAt: readHowWeWorkRead(updated.prefs) });
  });
}
