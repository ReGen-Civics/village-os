/**
 * OPEN ROLE PROPOSALS, THE INTAKE: somebody with no account proposes to hold
 * roles next season (Rye, 2026-10-30; master coordinator's calls 1 to 3 of
 * 2026-10-31, sheet 19i). The words and the shape are shared/openProposals.ts,
 * the SQL is server/repos/openProposals.ts.
 *
 *   GET  /api/open-proposals/form?link=   next season's roles, when the page is open
 *   POST /api/open-proposals              the proposal; emails a confirmation link
 *   POST /api/open-proposals/confirm      the address answers; the proposal is confirmed
 *
 *   GET  /api/admin/open-proposals                    the switch, the links, the confirmed proposals
 *   PUT  /api/admin/open-proposals/settings           the public link on or off
 *   POST /api/admin/open-proposals/links              a link for one person, shown once
 *   POST /api/admin/open-proposals/links/:id/revoke   switch one off
 *
 * ── WHO CAN OPEN THE FORM ───────────────────────────────────────────────────
 *
 * The public link (`/propose-a-role`) is ON unless an admin switches it off
 * (sheet 19i). A link made for one person opens it whatever the switch says,
 * until it is switched off itself. Either way the governance module has to be
 * on, because the roles are its own.
 *
 * ── NOTHING UNCONFIRMED REACHES A PERSON ────────────────────────────────────
 *
 * A proposal is written UNCONFIRMED and the address is sent a link, as an
 * essential email through the one mail door. Until that link is opened the
 * proposal is visible to nobody, notifies nobody, and is deleted after 48
 * hours by the tidy job. A send that does not go KEEPS the application (Rye,
 * 14 Nov 2026: "we still get the application even if the email is broken"):
 * it is confirmed by us, marked "email address not confirmed", and the email
 * is tried again every hour (server/lib/openProposalKept.ts). Once kept it is
 * never deleted for being unconfirmed. The gates on the way in
 * are the honeypot field, a cap per connection and a cap per address; there is
 * no CAPTCHA (sheet 19i).
 *
 * The tidy job also takes the name and address off a declined or withdrawn
 * proposal 90 days after it was decided, and off an adopted one whose
 * invitation nobody used in those 90 days (part B, coordinator 2026-10-31).
 * A confirmed proposal nobody decided in those 90 days is closed, and gets one
 * kind letter first, keyed per application (server/lib/applicantFollowups.ts).
 *
 * Confirmed proposals wait on the admin's list here.
 *
 * ── CONFIRMING ASKS THE CIRCLE (part B) ─────────────────────────────────────
 *
 * The confirm step, and only the confirm step, asks every live holder of a
 * role in the proposed roles' circles to consent or object within 2 business
 * days, and tells the holders of the power that seats people it waits on them
 * (server/lib/openProposalDecide.ts). The members-only page where it is read,
 * answered, adopted or declined, and the account an adoption makes, are
 * server/routes/openProposalDecide.ts, registered from here.
 *
 * The desk side asks the gate on `intake.moderate`, as the other public queues do.
 */
import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import type { Pool } from "mysql2/promise";

import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { emailKeyOf } from "../../shared/comms/address";
import { civilDateKey } from "../../shared/lunar";
import {
  OPEN_ANONYMISE_DAYS,
  OPEN_CONFIRM_HOURS,
  OPEN_NAME_MAX,
  OPEN_WORDS,
  parseOpenProposal,
  membershipOf,
  OPEN_GLOBAL_HOURLY,
  ipBucket,
  limiterAddressKey,
  APPLY_EMAIL_WORDS,
  stepsAfterSubmit,
  stepsAsLines,
  safeGreeting,
} from "../../shared/openProposals";
import { againLetter } from "../../shared/applicationAgain";
import type { AppDeps } from "../lib/appDeps";
import { post } from "../lib/comms/postOffice";
import { effectiveLifecycle } from "../lib/modules";
import { listOrgRoles } from "../lib/orgChart";
import { sectionsForMany } from "../lib/roleCardSections";
import { readsCeiling, type PayReader } from "../../shared/roleCardSections";
import { aboveCap, askAboveCap, askPeriod, askPeriodWrong, belowMinimum, capAt, RANGE_WORDS } from "../../shared/commitmentRange";
import { moneyWords } from "../../shared/roleRewardWords";
import { singlePublicAddress } from "../lib/publicAddress";
import { registerJob } from "../lib/scheduler";
import { clearAboutYouDecidedBefore } from "../repos/seatApplications";
import { arrivalFor, confirmAndAsk, describeFor, tellTheCircle } from "../lib/openProposalDecide";
import { addressAccount } from "../lib/applicantAccount";
import { whenInviteDescribed, whenInvitedArrives } from "../lib/inviteDoor";
import { alignAtApplication, carryToAccount, type SigningDoor } from "../lib/applicationMembership";
import { currentLetter } from "../lib/membershipLetter";
import { LETTER_WORDS, type LetterSource } from "../../shared/membershipLetter";
import { inApplicationTransaction, liveSeatingsOf } from "../repos/seatApplications";
import { OPEN_INVITE_PREFIX, openInviteId, openProposalHref, replyPromise } from "../../shared/openProposalDecide";
import { confirmationEmail, keepsWhenUnsent, retryOwedConfirmations, WENT } from "../lib/openProposalKept";
import { inviteById } from "../repos/memberInvites";
import { dbDocument } from "../repos/store-db";
import { registerOpenProposalDecide, type DecideRouteDeps } from "./openProposalDecide";
import { registerAgentProposals } from "./agentRoleProposals";
import { registerApplicationReview } from "./applicationReview";
import { clearReviewOf, refsDueForClearing } from "../repos/applicationReview";
import { boolVar, numberVar, rawValue, stringVar } from "../lib/variables";
import { sendClosedLetters, stampQuietClose, type ClosingDeps } from "../lib/applicantFollowups";
import { loadEmailVillage } from "../lib/comms/render";
import { comeAndPlayFor } from "../lib/comms/villageLetter";
import { foundingSetupFrom, type FoundingSetup } from "../../shared/foundingApplication";
import { knowUsLinksFrom, NO_KNOW_US_LINKS, type KnowUsLinks } from "../../shared/knowUsLinks";
import { listCalendarItems } from "../lib/calendar";
import { VARIABLES_BY_KEY } from "../../shared/gameVariables";
import { languageForNewProposal, languageOf } from "../lib/applicantLanguage";
import { wordsIn } from "../../shared/applicantWords";
import { makeApplicantTeller } from "../lib/applicantUpdates";
import * as store from "../repos/openProposals";
import { voiceViewerOf } from "../lib/voiceForViewer";
import { villageCircles } from "../repos/roleProposals";
import { activeClock } from "../lib/gratitude-cycles";
import { isTermMode, moonTermFor, type OpenProposalTerm, type OpenProposalTermMode } from "../../shared/openProposalTerm";
import { isComingSoon, isFutureVenture, isShown } from "../../shared/roleListing";
import { opensAfterFounding } from "../../shared/foundingTeam";
import { foundingIdsOf, replyDaysFor } from "../lib/foundingFirst";
import { gateOf } from "../lib/roleCardProjection";
import { publicTermsOf } from "../../shared/seatTermsOffer";
import { writtenKeys } from "../../shared/termsWords";
import { ATTACHMENT_WORDS, PROPOSAL_FILES_MAX, PROPOSAL_FILE_MAX_BYTES } from "../../shared/proposalAttachments";
import { VOICE_CLIPS_CEILING, VOICE_NOTES_MAX, VOICE_NOTE_ID, VOICE_NOTE_MAX_BYTES, VOICE_NOTE_TYPES, VOICE_WORDS, clipFieldLabel, clipLimitsOf, parseSentVoice, voiceNoteHref } from "../../shared/voiceNotes";
import { registerVoiceDraft } from "./openProposalVoiceDraft";
import { limitState } from "../repos/rateHits";
import { checkProposalFiles, checkVoiceClips, checkVoiceNotes, readVoiceNote, removeProposalFiles, removeVoiceNotes, sweepProposalFiles, writeProposalFiles, writeVoiceClips, writeVoiceNotes, type UploadedFile } from "../lib/proposalFiles";

type Deps = Pick<
  AppDeps,
  "getPool" | "overLimit" | "clientIp" | "guardCapability" | "authedUser" | "commsPostOffice" | "deploymentOrigin" | "projectName" | "escapeHtml" | "seasonState"
> &
  Omit<DecideRouteDeps, "postEmail" | "now"> & {
  /** The one mail door. A suite hands in a fake to watch what would go out. */
  postEmail?: (email: OutgoingEmail) => Promise<PostResult>;
  /** The governance module's lifecycle; the roles are its own. */
  governanceLifecycle?: () => string;
  /**
   * The membership letter's inputs now (`letterSourceFrom`), so an applicant
   * aligns on the form with the words they read (Rye's answer 8). Absent: the
   * form's alignment is refused as unreadable and nothing is recorded.
   */
  letterSource?: () => LetterSource;
  /** The submissions collection's insert: an address that already has an account gets its signing request at confirm. */
  signings?: SigningDoor;
  now?: () => Date;
  /** A village variable read as a flag. Absent reads as off. */
  boolVar?: (key: string) => boolean;
  /**
   * Whether this request may read a role's pay ceiling while `org.show_pay_ranges` is off: an admin or a
   * holder of `terms.read`. Absent reads as no, so the form then carries no ceiling unless the setting is on.
   */
  mayReadPay?: (req: any) => Promise<boolean>;
  /** A text setting: the village's default track (`org.default_track`) for the card gate. */
  stringVar?: (key: string) => string;
  /** The application's village words. Absent: read from the village settings (shared/foundingApplication.ts). */
  founding?: () => FoundingSetup;
};

/** The admin's switch for the public link (sheet 19i: on unless switched off). */
export interface OpenProposalSettings {
  publicLink: boolean;
  /** What public proposals are for: next season (the default) or the moon (shared/openProposalTerm.ts). */
  term: OpenProposalTermMode;
}

export const OPEN_SETTINGS_KEY = "open-proposals";
export const TIDY_JOB = "open-proposals-tidy";
const TIDY_EVERY_MS = 60 * 60_000;

const hashOf = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");
const newToken = (): string => crypto.randomBytes(24).toString("base64url");

/** Every try from one connection, refused or accepted, per hour. A flood stopper, far above what an honest session needs. */
const OPEN_TRIES_HOURLY = 60;
/** Posts that carry files, per connection per hour, refused or accepted. */
const OPEN_UPLOAD_TRIES_HOURLY = 30;
/**
 * THE WHOLE POST, AND HOW MANY AT ONCE (security sweep, 14 Nov 2026). Each part
 * is capped by multer, but nothing capped their sum, and every byte is held in
 * memory until the post is judged. A post with no length, or over 45 MB, is
 * refused before a byte is read (three 10 MB files, three notes and the clips
 * fit); and this server reads no more than four such posts at a time, so the
 * most an upload can ever hold here is about 180 MB.
 */
export const OPEN_UPLOAD_MAX_BYTES = 45 * 1024 * 1024;
export const OPEN_UPLOADS_AT_ONCE = 4;

export function register(app: Express, deps: Deps): void {
  const { getPool, overLimit, clientIp, guardCapability, authedUser, deploymentOrigin, projectName, escapeHtml } = deps;
  const postEmail = deps.postEmail ?? ((email: OutgoingEmail) => post(deps.commsPostOffice, email));
  const governance = deps.governanceLifecycle ?? (() => effectiveLifecycle("governance"));
  const now = () => (deps.now ? deps.now() : new Date());
  const site = () => deploymentOrigin().replace(/\/+$/, "");
  /** What the decision's work reads (server/lib/openProposalDecide.ts). */
  const decide = {
    getPool,
    notify: deps.notify,
    notifyAdmins: deps.notifyAdmins,
    members: deps.members,
    stageOf: deps.stageOf,
    recordStageEvent: deps.recordStageEvent,
    liveHoldersOf: deps.liveHoldersOf,
    calendar: deps.seatCalendar,
    lapse: deps.lapse,
    now,
    projectName,
    /** The village setting `org.consent_after_interviews` (role journey L5), off unless the village turned it on. */
    consentAfterInterviews: () => boolVar("org.consent_after_interviews"),
  };

  const tellApplicant = makeApplicantTeller({ getPool, members: deps.members, notify: deps.notify, postEmail, projectName, siteUrl: site });
  /** What a confirmation email is written with (server/lib/openProposalKept.ts). */
  const letters = { siteUrl: site, projectName, escapeHtml };

  /**
   * THE CONFIRMATION EMAIL DID NOT GO, AND THE APPLICATION IS KEPT (Rye, 14 Nov
   * 2026). Confirmed by us with the note "address not confirmed", in the
   * transaction that asks the circle; the admins told in the bell, never by
   * email; the applicant answered 200 in honest words, with their status page.
   * The membership letter and the account bell wait for the address to answer
   * (server/lib/openProposalKept.ts says why).
   */
  async function keepUnsent(res: Response, k: { id: string; email: string; token: string; status: PostResult["status"] }) {
    const at = now();
    // No address in the log: the id and the mail door's answer are enough to find it.
    console.error(`[open-proposals] the confirmation email for ${k.id} did not go (${k.status}); the application is kept, marked not confirmed`);
    const kept = await confirmAndAsk(decide, hashOf(k.token), new Date(0), at, { addressUnconfirmed: true });
    if (!kept) {
      // The row it names is gone: there is nothing to keep, so say so as before.
      if (deps.proposalFileDir) await removeProposalFiles(deps.proposalFileDir, k.id);
      return res.status(503).json({ error: OPEN_WORDS.notSent });
    }
    try {
      await tellTheCircle(decide, kept);
    } catch (e) {
      console.error("[open-proposals] the circle could not all be told about a kept application", e);
    }
    try {
      await deps.notifyAdmins("governance", OPEN_WORDS.keptAlertTitle, `op:${k.id}:email-failed:admins`, openProposalHref(k.id));
    } catch (e) {
      console.error("[open-proposals] the admins could not be told about a kept application", e);
    }
    const statusPath = kept.review?.statusToken ? `/application-status/${encodeURIComponent(k.id)}?token=${encodeURIComponent(kept.review.statusToken)}` : null;
    const replyDays = await replyDaysFor(getPool(), kept.proposal.body.roles.map((r) => r.roleId));
    return res.json({ sent: true, kept: true, email: k.email, message: OPEN_WORDS.keptNotSent(k.email), statusPath, replyDays, afterFounding: replyDays === null });
  }

  /**
   * A KEPT APPLICATION'S ADDRESS ANSWERS the link the tidy job sent later. The
   * note goes, once; the link works for the same 48 hours from when it went.
   * Only then is the membership letter carried and the account told.
   */
  async function keptAddressAnswers(confirmHash: string, at: Date): Promise<store.StoredOpenProposal | null> {
    const pool = getPool();
    const p = await store.keptByConfirmHash(pool, confirmHash);
    const sentAt = p?.addressUnconfirmed?.sentAt;
    if (!p || !sentAt || at.getTime() - sentAt.getTime() > OPEN_CONFIRM_HOURS * 60 * 60_000) return null;
    if (!(await store.confirmKeptAddress(pool, p.id, confirmHash))) return null;
    await alignedAtApplication(p, at);
    await tellApplicant(p.id, "confirmed");
    return p;
  }

  /** The switch, read fresh: one small row, and an admin who just flipped it sees it at once. */
  async function settings(): Promise<OpenProposalSettings> {
    const doc = dbDocument(getPool(), OPEN_SETTINGS_KEY, { publicLink: true } as any);
    await doc.load();
    const term = (doc.get() as any).term;
    return { publicLink: doc.get().publicLink !== false, term: isTermMode(term) ? term : "season" };
  }

  /**
   * What a proposal sent now is for. "season": next season, as before. "moon":
   * the moon (from its new moon to the next) inside the season running now,
   * whose id the proposal carries so adoption finds the calendar it was made on.
   */
  type Target = { season: { id: string; name: string | null; startsOn: string; endsOn: string | null }; term: OpenProposalTerm | null; goals: Array<{ id: string; text: string }> };
  /** A season's goals for the village, as the Season tab writes them; done ones drop off. */
  const goalsOf = (s: any): Array<{ id: string; text: string }> =>
    (Array.isArray(s?.goals) ? s.goals : [])
      .filter((g: any) => g && g.id && typeof g.text === "string" && g.text.trim() && !g.done)
      .map((g: any) => ({ id: String(g.id), text: String(g.text).trim() }));
  function target(mode: OpenProposalTermMode): Target | null {
    if (mode !== "moon") {
      const s = nextSeason();
      const full = s ? (deps.seasonState().seasons ?? []).find((x: any) => x && String(x.id) === s.id) : null;
      return s ? { season: s, term: null, goals: goalsOf(full) } : null;
    }
    const state = deps.seasonState();
    const cur = state.current;
    if (!cur || !cur.id || !cur.startsOn) return null;
    return {
      season: { id: String(cur.id), name: String(cur.name ?? "").trim() || null, startsOn: String(cur.startsOn), endsOn: cur.endsOn ? String(cur.endsOn) : null },
      term: moonTermFor(now(), activeClock(), state.timezone || "UTC"),
      goals: goalsOf(cur),
    };
  }

  /**
   * The application's village words (shared/foundingApplication.ts): the ways
   * to get to know us, the pay shape the role cards show, the first cycle.
   * Read fresh on every request, so a change in Admin shows at once. A setting
   * the registry does not know yet (the pay shape is lane A3's) reads as empty.
   */
  const founding = (): FoundingSetup => (deps.founding ? deps.founding() : foundingSetupFrom((key) => (VARIABLES_BY_KEY[key] ? rawValue(key) : "")));

  /**
   * Step 1's acts (Rye, 15 Nov 2026, shared/knowUsLinks.ts): the next public call, land tour and
   * potluck on the calendar for the next 60 days, else the village's own links. A calendar that
   * cannot be read leaves the village's links standing.
   */
  async function knowUsLinks(): Promise<KnowUsLinks> {
    const at = now();
    let events: Awaited<ReturnType<typeof listCalendarItems>> = [];
    try {
      events = await listCalendarItems(getPool(), {
        from: at,
        to: new Date(at.getTime() + 60 * 86_400_000),
        viewer: { userId: null, isAdmin: false },
        timezone: deps.seasonState()?.timezone || "UTC",
        includeDrafts: false,
        limit: 300,
        now: at,
      });
    } catch (e) {
      console.error("[open-proposals] the calendar could not be read for step 1's links", e);
    }
    try {
      return knowUsLinksFrom((key) => (VARIABLES_BY_KEY[key] ? rawValue(key) : ""), events, at);
    } catch {
      return NO_KNOW_US_LINKS;
    }
  }

  /** Next season by the village's calendar: the first that starts after today, or null. */
  function nextSeason() {
    const state = deps.seasonState();
    const today = civilDateKey(now(), state.timezone || "UTC");
    const next = (state.seasons ?? [])
      .filter((s: any) => s && s.id && s.startsOn)
      .sort((a: any, b: any) => String(a.startsOn).localeCompare(String(b.startsOn)))
      .find((s: any) => String(s.startsOn) > today);
    return next ? { id: String(next.id), name: String(next.name ?? "").trim() || null, startsOn: String(next.startsOn), endsOn: next.endsOn ? String(next.endsOn) : null } : null;
  }

  /** The roles a stranger may propose for: live, listed, not an example, in a live circle. */
  async function offered() {
    const pool = getPool();
    const [roles, circles] = await Promise.all([listOrgRoles(pool), villageCircles(pool)]);
    const live = new Map(circles.filter((c) => c.live).map((c) => [c.id, c.name]));
    // Role journey PR-C: with the village setting on, a card that is not complete offers nothing to apply for.
    const needsCard = deps.boolVar?.("org.apply_needs_complete_card") === true;
    const nameOf = new Map(roles.map((r) => [r.id, r.name]));
    // Each role's pay ceiling for the full role, as its public card already shows it (Rye, 14 Nov 2026).
    const ceilings = await sectionsForMany(pool, roles.map((r) => r.id));
    // Hiring the founding team first (Rye, 14 Nov 2026): every other listed role opens after it.
    const foundingIds = foundingIdsOf(roles);
    // Held (Rye, 16 Nov 2026): a role whose places are all taken is marked, so the form's chooser offers no Apply for it.
    // A link straight to it still takes an application, adopted only for when a place opens (audit B3).
    const taken = new Map<string, number>();
    for (const s of await liveSeatingsOf(pool, roles.map((r) => r.id))) taken.set(s.orgRoleId, (taken.get(s.orgRoleId) ?? 0) + 1);
    return roles
      // A coming-soon role takes applications early, through this same form (Rye, 16 Nov 2026), even while
      // unlisted and before its card is complete: its card is short until its lead is in place.
      .filter((r) => r.active && !r.isExample && isShown(r) && r.circleId && live.has(r.circleId))
      .filter((r) => !needsCard || isComingSoon(r) || isFutureVenture(r) || gateOf(r, deps.stringVar?.("org.default_track") ?? null).gate.complete)
      .map((r) => ({
        id: r.id,
        name: r.name,
        circle: live.get(r.circleId as string) as string,
        aim: r.aim ?? null,
        // The open card's own sections, for the applicant to answer (shared/openProposalCard.ts).
        accountabilities: Array.isArray(r.accountabilities) ? r.accountabilities.map((a: unknown) => String(a ?? "").trim()).filter(Boolean) : [],
        whyItMatters: r.whyItMatters ?? null,
        timeCommitment: (r as any).timeCommitment ?? null,
        // The role's suggested wording for the eight settings and the commitment it asks (joining lane PR 3). Words only: no other term leaves here.
        terms: publicTermsOf(r.termsOffer),
        // A role always background-checked (0370): the form says a check happens whatever the references say.
        alwaysChecked: r.alwaysChecked === true,
        // The commitment range (Rye, 14 Nov 2026): the least one person may propose, and the full role's ceiling,
        // so the form offers only that range and says the most at each commitment. Display only.
        commitmentMin: r.commitmentMin ?? null,
        // Applied for now, answered once the founding team is in place (shared/foundingTeam.ts).
        opensLater: opensAfterFounding(foundingIds, [r.id]),
        // Coming soon (Rye, 16 Nov 2026): the form and its confirmation say interviews may take a while to start.
        ...(isComingSoon(r) ? { comingSoon: true } : {}),
        // A future venture: the form asks for a pitch, by its five prompts.
        ...(isFutureVenture(r) ? { futureVenture: true } : {}),
        ...((taken.get(r.id) ?? 0) >= r.seats ? { held: true } : {}),
        payCeiling: ceilings.get(r.id)?.payCeiling ?? null,
        // The card's own choice of who reads that ceiling (absent: the village decides). Read by `offeredTo`, never sent.
        payVisibility: ceilings.get(r.id)?.payVisibility,
        // The conversations in the role's order, as its public card shows them (role journey L5), so the
        // form and the board can say what happens next (role audit, 10 Nov 2026). The booking link is
        // not here: it is offered once the address is confirmed (L6).
        conversations: (Array.isArray(r.conversations) ? r.conversations : []).map((s) => ({
          role: nameOf.get(s.roleId) ?? s.roleId,
          minutes: s.minutes,
          ...(s.final ? { finalApproval: true } : {}),
        })),
      }));
  }

  /** Whether the form opens for this request, and through which link. */
  async function door(rawLink: unknown): Promise<{ open: false } | { open: true; linkId: string | null }> {
    if (governance() === "off") return { open: false };
    const token = typeof rawLink === "string" ? rawLink.trim() : "";
    if (token) {
      const link = token.length <= 100 ? await store.openLinkByHash(getPool(), hashOf(token)) : null;
      return link ? { open: true, linkId: link.id } : { open: false };
    }
    return (await settings()).publicLink ? { open: true, linkId: null } : { open: false };
  }

  /** The admin door for one recording (below). */
  const adminVoiceHref = (proposalId: string, noteId: string) => `/api/admin/open-proposals/${encodeURIComponent(proposalId)}/voice/${encodeURIComponent(noteId)}`;
  /** How many clips beside answers, and how long each (village settings; shared/voiceNotes.ts holds the ceilings). */
  const clipLimits = () => clipLimitsOf({ max: numberVar("org.voice_clips_max"), seconds: numberVar("org.voice_clip_seconds") });

  // ── The public side ───────────────────────────────────────────────────────

  /**
   * The offered roles as one reader may see them, each through the one ceiling gate (`readsCeiling`,
   * shared/roleCardSections.ts). A card that follows the village: while `org.show_pay_ranges` is off the
   * ceiling key is ABSENT for everyone but an admin or a holder of `terms.read`, the people the setting
   * says read the full terms either way. A card set to show: everyone. A card set to hide: nobody on this
   * form, which is an applicant's surface; its editors read the figure on the card and in the editor.
   * Without a ceiling the form offers no price ask, only negotiate.
   */
  async function payReaderOf(req: any): Promise<PayReader> {
    const readsTerms = !!deps.mayReadPay && (await deps.mayReadPay(req));
    return { villageShows: boolVar("org.show_pay_ranges"), readsTerms, edits: false };
  }
  async function offeredTo(req: any) {
    const [roles, reader] = await Promise.all([offered(), payReaderOf(req)]);
    return roles.map((r) => {
      const out: Partial<typeof r> = { ...r };
      if (!readsCeiling(r, reader)) delete out.payCeiling;
      delete out.payVisibility;
      return out;
    });
  }

  // "Draft my answers from what I said" (Rye, 14 Nov 2026): the same door, roles and season goals as the form.
  registerVoiceDraft(app, { door, offered, seasonGoals: async () => target((await settings()).term)?.goals.map((g) => g.text) ?? [], limitState: (key, max, windowMs) => limitState(getPool(), key, max, windowMs), authedUser, clientIp, ipBucket, villageName: projectName });

  app.get("/api/open-proposals/form", async (req, res) => {
    const d = await door(req.query.link);
    if (!d.open) return res.json({ open: false, message: OPEN_WORDS.closed });
    const mode = (await settings()).term;
    const t = target(mode);
    res.json({
      open: true,
      village: projectName(),
      season: t?.season ?? null,
      term: t?.term ?? null,
      goals: t?.goals ?? [],
      // The clips beside answers this village takes (Rye, 14 Nov 2026).
      voice: clipLimits(),
      ...(t ? {} : { message: mode === "moon" ? OPEN_WORDS.noCurrentSeason : OPEN_WORDS.noSeason }),
      roles: t ? await offeredTo(req) : [],
      founding: { ...founding(), knowUsLinks: await knowUsLinks() },
    });
  });

  /*
   * FILES COME AS multipart/form-data: the proposal as JSON in one field,
   * `proposal`, up to three files in `files` and up to three recordings in
   * `voice` (shared/voiceNotes.ts). Held in memory, capped by size and count
   * before a byte reaches disk, and checked by their own first bytes
   * (shared/proposalAttachments.ts). A plain JSON post still works.
   */
  // Clips are capped at the village's own count (org.voice_clips_max), read for each post, never at the platform ceiling.
  const uploadFor = (clipsMax: number, clipCap = Math.max(1, Math.min(VOICE_CLIPS_CEILING, clipsMax))) =>
    multer({
      storage: multer.memoryStorage(),
      defParamCharset: "utf8",
      limits: { fileSize: Math.max(PROPOSAL_FILE_MAX_BYTES, VOICE_NOTE_MAX_BYTES), files: PROPOSAL_FILES_MAX + VOICE_NOTES_MAX + clipCap, fields: 1, fieldSize: 512 * 1024 },
    }).fields([
      { name: "files", maxCount: PROPOSAL_FILES_MAX },
      { name: "voice", maxCount: VOICE_NOTES_MAX },
      // multer refuses a maxCount of 0, and a village with clips off is refused by parseSentVoice below.
      { name: "clips", maxCount: clipCap },
    ]);
  let uploadsReading = 0;

  app.post("/api/open-proposals", async (req, res) => {
    if (!req.is("multipart/form-data")) return intake(req, res, req.body ?? {}, []);
    // Before any file is read: the per-connection cap on posts that carry files.
    // Generous on purpose: this counts every post that carries files, refused or not. The strict five an hour is counted in `intake`, on accepted proposals only.
    if (await overLimit(`open-proposal:upload:ip:${ipBucket(clientIp(req))}`, OPEN_UPLOAD_TRIES_HOURLY, 60 * 60_000)) return res.status(429).json({ error: OPEN_WORDS.tooManyTries });
    // Node reads exactly Content-Length bytes of a body that names one, so the header is the total. No length (chunked) is refused.
    const length = Number(req.headers["content-length"] ?? NaN);
    if (!Number.isFinite(length) || length > OPEN_UPLOAD_MAX_BYTES) {
      res.setHeader("Connection", "close");
      return res.status(Number.isFinite(length) ? 413 : 411).json({ error: ATTACHMENT_WORDS.uploadTooBig, field: "files" });
    }
    if (uploadsReading >= OPEN_UPLOADS_AT_ONCE) return res.status(503).json({ error: ATTACHMENT_WORDS.uploadBusy });
    uploadsReading += 1;
    let released = false;
    const release = () => {
      if (!released) uploadsReading -= 1;
      released = true;
    };
    // Held until the answer is sent (or the connection drops), so the buffers are counted while they are in memory.
    res.on("finish", release);
    res.on("close", release);
    const clipsMax = clipLimits().max;
    uploadFor(clipsMax)(req, res, (err: any) => {
      if (err) {
        const code = String(err?.code ?? "");
        if (err?.field === "clips" && code === "LIMIT_UNEXPECTED_FILE") return void res.status(400).json({ error: VOICE_WORDS.tooManyClips(clipsMax), field: "voice" });
        // A recording refused by the upload's own caps is named as the voice note's.
        if (err?.field === "voice" || err?.field === "clips") return void res.status(code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: code === "LIMIT_FILE_SIZE" ? VOICE_WORDS.tooBig : VOICE_WORDS.tooMany, field: "voice" });
        const error = code === "LIMIT_FILE_SIZE" ? ATTACHMENT_WORDS.fileTooBig : code === "LIMIT_FILE_COUNT" || code === "LIMIT_UNEXPECTED_FILE" ? ATTACHMENT_WORDS.tooManyFiles : ATTACHMENT_WORDS.fileUnreadable;
        return void res.status(code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error, field: "files" });
      }
      let body: unknown;
      try {
        body = JSON.parse(String((req.body as Record<string, unknown> | undefined)?.proposal ?? ""));
      } catch {
        return void res.status(400).json({ error: OPEN_WORDS.notSent });
      }
      const sent = (req as Request & { files?: Record<string, Express.Multer.File[] | undefined> }).files ?? {};
      const files = (sent.files ?? []).map((f) => ({ originalname: f.originalname, buffer: f.buffer }));
      const voiceNotes = (sent.voice ?? []).map((f) => ({ originalname: f.originalname, buffer: f.buffer }));
      const clips = (sent.clips ?? []).map((f) => ({ originalname: f.originalname, buffer: f.buffer }));
      void intake(req, res, body && typeof body === "object" ? (body as Record<string, any>) : {}, files, voiceNotes, clips).catch((e) => {
        console.error("[open-proposals] a proposal with files was not taken", e);
        if (!res.headersSent) res.status(500).json({ error: OPEN_WORDS.notSent });
      });
    });
  });

  async function intake(req: Request, res: Response, body: Record<string, any>, files: UploadedFile[], voiceNotes: UploadedFile[] = [], clips: UploadedFile[] = []) {
    // Honeypot: a hidden field only a bot fills. Pretend it went, keep nothing.
    if (body.hp) return res.json({ sent: true });
    // Two buckets per connection. This one counts every try, refused or not, and is generous: it only stops a flood.
    // The strict five an hour is counted below, once the proposal has been judged and would be accepted, so a person
    // who meets three honest mistakes is never locked out for them (audit B1).
    if (await overLimit(`open-proposal:tries:ip:${ipBucket(clientIp(req))}`, OPEN_TRIES_HOURLY, 60 * 60_000)) return res.status(429).json({ error: OPEN_WORDS.tooManyTries });
    const d = await door(body.link);
    if (!d.open) return res.status(403).json({ error: OPEN_WORDS.closed });
    const mode = (await settings()).term;
    const t = target(mode);
    if (!t) return res.status(409).json({ error: mode === "moon" ? OPEN_WORDS.noCurrentSeason : OPEN_WORDS.noSeason });
    const season = t.season;
    const roles = await offered();
    const outcomes = new Map(roles.map((r) => [r.id, r.accountabilities]));
    const alwaysChecked = new Set(roles.filter((r) => r.alwaysChecked).map((r) => r.id));
    const termsOf = new Map(roles.map((r) => [r.id, r.terms]));
    const parsed = parseOpenProposal(body, {
      writtenTerms: (ids) => writtenKeys(ids.map((id) => termsOf.get(id))),
      roleIds: new Set(roles.map((r) => r.id)),
      address: singlePublicAddress,
      accountabilitiesOf: (id) => outcomes.get(id) ?? [],
      goalIds: new Set(t.goals.map((g) => g.id)),
      // A goal's date must fall in this moon (shared/proposalGoals.ts).
      today: new Date().toISOString().slice(0, 10),
      alwaysChecked: (id) => alwaysChecked.has(id),
      now: now(),
      // A tick is kept only for a way the village lists now, in its words as they read today.
      knowUs: founding().knowUs,
    });
    if (!parsed.ok) return res.status(400).json({ error: parsed.error, field: parsed.field });
    // A commitment below what the role takes from one person is refused, in words (Rye, 14 Nov 2026, ruling 2).
    // A post with no commitment at all (no card, as only an edited request sends) is below it too (hostile-edges QA, 15 Nov 2026).
    const pct = parsed.value.body.card?.commitmentPct;
    // A poster who may not read the ceiling meets the role as one with no listed price, so no refusal names the figure.
    const priceReader = await payReaderOf(req);
    for (const picked of parsed.value.body.roles) {
      const offeredRole = roles.find((r) => r.id === picked.roleId);
      const min = offeredRole?.commitmentMin;
      if (typeof min === "number" && (typeof pct !== "number" || pct < min)) return res.status(400).json({ error: belowMinimum(min), field: "terms" });
      // A price ask goes up to 120% of the listed price at their commitment, and no higher (Rye, 15 Nov 2026).
      const ask = parsed.value.body.payAsk;
      const ceiling = offeredRole && readsCeiling(offeredRole, priceReader) ? (offeredRole.payCeiling ?? null) : null;
      // A role with no listed price has no cap to read a figure against: an amount is refused, never kept unchecked.
      if (!ceiling && ask?.kind === "amount") return res.status(400).json({ error: RANGE_WORDS.askNoPrice, field: "payAsk" });
      if (ceiling && ask?.kind === "amount") {
        if (askPeriod(ask) !== ceiling.per) return res.status(400).json({ error: askPeriodWrong(ceiling.per), field: "payAsk" });
        const at = typeof pct === "number" && pct > 0 ? pct : 100;
        if (askAboveCap(ask, ceiling.amount, at)) return res.status(400).json({ error: aboveCap(moneyWords(capAt(ceiling.amount, at), ceiling.currency), at), field: "payAsk" });
      }
    }
    // The files, every one checked before any is kept (Rye, 10 Nov 2026).
    if (files.length && !deps.proposalFileDir) return res.status(400).json({ error: ATTACHMENT_WORDS.fileUnreadable, field: "files" });
    const checked = checkProposalFiles(files);
    if (!checked.ok) return res.status(400).json({ error: checked.error, field: "files" });
    // The voice note, only with the applicant's tick, every recording checked by its own bytes (Rye, 14 Nov 2026).
    const voice = parseSentVoice(body.voice, voiceNotes.length, clips.length, clipLimits());
    if (!voice.ok) return res.status(400).json({ error: voice.error, field: "voice" });
    if ((voiceNotes.length || clips.length) && !deps.proposalFileDir) return res.status(400).json({ error: ATTACHMENT_WORDS.fileUnreadable, field: "voice" });
    const heardOk = checkVoiceNotes(voiceNotes);
    if (!heardOk.ok) return res.status(400).json({ error: heardOk.error, field: "voice" });
    const clipsOk = checkVoiceClips(clips);
    if (!clipsOk.ok) return res.status(400).json({ error: clipsOk.error, field: "voice" });
    const { name, email } = parsed.value;
    // The term is the village's, set here and never taken from the form.
    // The goals' words are kept with the card as they read when it was sent, never taken from the form.
    const goalText = new Map(t.goals.map((g) => [g.id, g.text]));
    const card = parsed.value.body.card ? { ...parsed.value.body.card, serves: parsed.value.body.card.serves.map((x) => ({ ...x, goal: goalText.get(x.goalId) ?? "" })) } : undefined;
    /*
     * MEMBERSHIP AT APPLICATION (Rye's answer 8). The form names the letter
     * version it drew; it must be the letter as the village renders it now,
     * or nothing is sent and the form shows the letter again. Recorded only
     * once the address confirms. No payment is asked here or anywhere after.
     */
    let membership: { letterVersion: string } | null = null;
    if (body.membership !== undefined && body.membership !== null) {
      const asked = membershipOf(body.membership);
      const letter = deps.letterSource ? currentLetter(deps.letterSource()) : null;
      if (!letter) return res.status(409).json({ error: LETTER_WORDS.unreadable, field: "membership" });
      if (!asked || asked.letterVersion !== letter.version) return res.status(409).json({ error: LETTER_WORDS.changed, field: "membership", letter });
      membership = asked;
    }
    // The language their emails come in: chosen once, here, by the rule in shared/applicantLanguage.ts.
    const locale = await languageForNewProposal({ getPool, members: deps.members }, { clientLocale: body.locale, email, acceptLanguage: req.headers["accept-language"] });
    const proposal = { ...parsed.value.body, ...(card ? { card } : {}), ...(t.term ? { term: t.term } : {}), ...(membership ? { membership } : {}), locale };
    const emailKey = emailKeyOf(email);
    // Every refusal above has been given. Only now, with the proposal acceptable, does this connection spend one of its five an hour.
    if (await overLimit(`open-proposal:ip:${ipBucket(clientIp(req))}`, 5, 60 * 60_000)) return res.status(429).json({ error: OPEN_WORDS.tooMany });
    if (await overLimit(`open-proposal:email:${limiterAddressKey(emailKey)}`, 3, 24 * 60 * 60_000)) return res.status(429).json({ error: OPEN_WORDS.tooManyForAddress });
    // The last gate before an email goes: the village's overall hourly cap on confirmations.
    if (await overLimit("open-proposal:global", OPEN_GLOBAL_HOURLY, 60 * 60_000)) return res.status(429).json({ error: OPEN_WORDS.tooBusy });

    const pool = getPool();
    // The same application again while one for the same role waits (shared/applicationAgain.ts): nothing new is kept,
    // the address alone is told, and the sender reads what any send reads. After the caps, so it spends what a send spends.
    const waiting = await store.waitingFromAddress(pool, emailKey, proposal.roles.map((r) => r.roleId));
    if (waiting) return answerAgain(res, { waiting, email, name, locale, roles });
    const id = `op-${crypto.randomBytes(10).toString("hex")}`;
    const token = newToken();
    // The files go on disk BEFORE the row, so a row never names a file that is not there.
    const fileDir = deps.proposalFileDir;
    try {
      const kept = files.length && fileDir ? await writeProposalFiles(fileDir, id, files) : [];
      const heard = voice.value && voiceNotes.length && fileDir ? await writeVoiceNotes(fileDir, id, voiceNotes, voice.value.seconds) : [];
      const clipped = voice.value?.clips && clips.length && fileDir ? await writeVoiceClips(fileDir, id, clips, voice.value.clips) : [];
      const spoken = voice.value ? { voice: { consent: true as const, notes: heard, transcript: voice.value.transcript, ...(clipped.length ? { clips: clipped } : {}) } } : {};
      await store.insertOpenProposal(pool, { id, name: name.slice(0, OPEN_NAME_MAX), email, emailKey, targetSeasonId: season.id, body: { ...proposal, ...(kept.length ? { files: kept } : {}), ...spoken }, confirmHash: hashOf(token), linkId: d.linkId, now: now() });
    } catch (e) {
      if (fileDir) await removeProposalFiles(fileDir, id);
      throw e;
    }

    const byId = new Map(roles.map((r) => [r.id, r.name]));
    const roleNames = proposal.roles.map((r) => byId.get(r.roleId) ?? "").filter(Boolean);
    // A mail door that throws is a send that did not go: the application is kept all the same.
    const sent = await postEmail(confirmationEmail(letters, { id, name, email, roleNames, lang: locale, term: t.term }, token, `open-proposal:${id}:confirm`)).catch((): PostResult => ({ status: "failed", messageId: null }));
    if (!WENT.has(sent.status)) {
      if (keepsWhenUnsent(sent)) return keepUnsent(res, { id, email, token, status: sent.status });
      // The address itself is refused (suppressed, malformed, expired): nobody can confirm it, so nothing is kept.
      console.error(`[open-proposals] the confirmation email for ${id} was refused (${sent.status}${sent.reason ? `: ${sent.reason}` : ""}); the application is not kept`);
      await store.deleteOpenProposal(pool, id);
      if (fileDir) await removeProposalFiles(fileDir, id);
      return res.status(503).json({ error: OPEN_WORDS.notSent });
    }
    // The days the village gives itself to first reply: the "sent" page dates its next steps with it (the firefly path).
    const replyDays = await replyDaysFor(pool, proposal.roles.map((r) => r.roleId));
    res.json({ sent: true, email, message: OPEN_WORDS.sent(email), replyDays, afterFounding: replyDays === null });
  }

  /**
   * THE SAME APPLICATION SENT AGAIN (hostile-edges QA, 15 Nov 2026). The waiting one stands; one short email goes to
   * the address, at most once a day for that application; the answer has the shape and words of an ordinary send, so
   * the public form tells nobody whether an address has applied.
   */
  async function answerAgain(
    res: Response,
    a: { waiting: store.StoredOpenProposal; email: string; name: string; locale: Parameters<typeof againLetter>[0]["lang"]; roles: Array<{ id: string; name: string }> },
  ) {
    const byId = new Map(a.roles.map((r) => [r.id, r.name]));
    const words = againLetter({ firstName: safeGreeting(a.name), roleNames: a.waiting.body.roles.map((r) => byId.get(r.roleId) ?? "").filter(Boolean), lang: a.locale });
    const sent = await postEmail({
      idempotencyKey: `open-proposal:${a.waiting.id}:again:${now().toISOString().slice(0, 10)}`,
      kind: "essential",
      origin: "open_proposal.again",
      to: { email: a.email },
      subject: words.subject,
      html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f2937">${words.text
        .split("\n\n")
        .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
        .join("")}</body></html>`,
      text: words.text,
    }).catch((): PostResult => ({ status: "failed", messageId: null }));
    console.log(`[open-proposals] ${a.waiting.id} was sent again while it waits; nothing new kept (${sent.status})`);
    const replyDays = await replyDaysFor(getPool(), a.waiting.body.roles.map((r) => r.roleId));
    if (WENT.has(sent.status)) return res.json({ sent: true, email: a.email, message: OPEN_WORDS.sent(a.email), replyDays, afterFounding: replyDays === null });
    return res.json({ sent: true, kept: true, email: a.email, message: OPEN_WORDS.keptNotSent(a.email), statusPath: null, replyDays, afterFounding: replyDays === null });
  }

  /**
   * The applicant's alignment with the letter, against the address that just
   * confirmed, when the form carried one and the letter still reads as it did.
   * Changed words since: nothing is recorded, and the role start gate asks
   * them to align from their account. A failure is logged, never the person's.
   */
  async function alignedAtApplication(p: { id: string; email: string | null; body: { membership?: { letterVersion: string } } }, at: Date): Promise<void> {
    const asked = p.body.membership;
    if (!asked || !p.email || !deps.letterSource) return;
    try {
      const letter = currentLetter(deps.letterSource());
      if (letter.version !== asked.letterVersion) return;
      await inApplicationTransaction(getPool(), (conn) => alignAtApplication(conn, { letter, email: p.email as string, proposalId: p.id, now: at }));
      // An account already here with this address: carried now, with the signing request a steward accepts.
      const account = await addressAccount(deps.members, p.email, getPool());
      if (account && deps.signings) {
        const m: any = await deps.members.byId(account);
        await carryToAccount(getPool(), deps.signings, { userId: account, name: String(m?.name ?? ""), email: p.email, now: at });
      }
    } catch (e) {
      console.error("[open-proposals] the membership alignment at application was not recorded", e);
    }
  }

  app.post("/api/open-proposals/confirm", async (req, res) => {
    if (await overLimit(`open-proposal:confirm:${clientIp(req)}`, 30, 60 * 60_000)) return res.status(429).json({ error: OPEN_WORDS.tooManyOpens });
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const at = now();
    // Confirmed, and the circle asked, in one transaction (part B). A used, old or unknown token asks nobody.
    const confirmed = token && token.length <= 100 ? await confirmAndAsk(decide, hashOf(token), new Date(at.getTime() - OPEN_CONFIRM_HOURS * 60 * 60_000), at) : null;
    if (!confirmed) {
      // A kept application's later link (server/lib/openProposalKept.ts): the address is confirmed, the application was already in.
      const kept = token && token.length <= 100 ? await keptAddressAnswers(hashOf(token), at) : null;
      if (!kept) return res.status(410).json({ error: OPEN_WORDS.confirmGone });
      const lang = languageOf(kept);
      const replyDays = await replyDaysFor(getPool(), kept.body.roles.map((r) => r.roleId));
      const steps = stepsAfterSubmit(lang, replyDays);
      return res.json({ confirmed: true, message: OPEN_WORDS.addressConfirmed, statusPath: null, locale: lang, replyDays, afterFounding: replyDays === null, ...(steps.length ? { steps } : {}) });
    }
    await alignedAtApplication(confirmed.proposal, at);
    try {
      await tellTheCircle(decide, confirmed);
    } catch (e) {
      // The asks are written and wait under Tasks; a notice that did not go is not the person's problem.
      console.error("[open-proposals] the circle could not all be told", e);
    }
    // The applicant's own page: the step, who acts next, by when. The link is shown once and mailed; only its hash is kept.
    let statusPath: string | null = null;
    // The village's days, or null while every role applied for opens after the founding team.
    const replyDays = await replyDaysFor(getPool(), confirmed.proposal.body.roles.map((r) => r.roleId));
    if (confirmed.review?.statusToken) {
      statusPath = `/application-status/${encodeURIComponent(confirmed.proposal.id)}?token=${encodeURIComponent(confirmed.review.statusToken)}`;
      if (confirmed.proposal.email) {
        const lang = languageOf(confirmed.proposal);
        const apply = APPLY_EMAIL_WORDS[lang];
        // The steps after submit (lane A2's one list, through the slot in shared/openProposals.ts), when there are any.
        const steps = stepsAsLines(stepsAfterSubmit(lang, replyDays));
        const text = `${apply.statusText(`${site()}${statusPath}`, wordsIn(lang).replyPromise(replyDays))}${steps ? `\n\n${steps}` : ""}`;
        try {
          await postEmail({
            idempotencyKey: `open-proposal:${confirmed.proposal.id}:status`,
            kind: "essential",
            origin: "open_proposal.status",
            to: { email: confirmed.proposal.email },
            subject: apply.statusSubject,
            html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f2937">${text
              .split("\n\n")
              .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
              .join("")}</body></html>`,
            text,
          });
        } catch (e) {
          console.error("[open-proposals] the status link could not be mailed", e);
        }
      }
    }
    // Somebody who already has an account reads it on their profile too; the email above is theirs either way.
    await tellApplicant(confirmed.proposal.id, "confirmed");
    // The language the applicant proposed in, so the confirmed page can speak it, and the first-reply window to date the next step.
    const steps = stepsAfterSubmit(languageOf(confirmed.proposal), replyDays);
    res.json({ confirmed: true, message: OPEN_WORDS.confirmed, statusPath, locale: languageOf(confirmed.proposal), replyDays, afterFounding: replyDays === null, ...(steps.length ? { steps } : {}) });
  });

  // ── The desk ──────────────────────────────────────────────────────────────

  app.get("/api/admin/open-proposals", async (req, res) => {
    if (!(await guardCapability(req, res, "intake.moderate"))) return;
    const pool = getPool();
    // Their voice plays here for the village's admins alone, never an agent (server/lib/voiceForViewer.ts).
    const hearer = await voiceViewerOf(req, pool, await authedUser(req));
    const [s, links, waiting, roles] = await Promise.all([settings(), store.listOpenLinks(pool), store.listOpenProposals(pool, ["confirmed"]), offered()]);
    const roleName = new Map(roles.map((r) => [r.id, `${r.name} (${r.circle})`]));
    const linkLabel = new Map(links.map((l) => [l.id, l.label]));
    res.json({
      publicLink: s.publicLink,
      term: s.term,
      publicPath: "/propose-a-role",
      links: links.map((l) => ({ id: l.id, label: l.label, createdAt: l.createdAt, on: !l.revokedAt })),
      proposals: waiting.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        seasonId: p.targetSeasonId,
        via: p.linkId ? (linkLabel.get(p.linkId) ?? null) : null,
        roles: p.body.roles.map((r) => ({ roleId: r.roleId, name: roleName.get(r.roleId) ?? null, note: r.note })),
        why: p.body.why,
        aim: p.body.aim,
        term: p.body.term ?? null,
        createdAt: p.createdAt,
        confirmedAt: p.confirmedAt,
        // Kept although our confirmation email failed (Rye, 14 Nov 2026): flagged, never hidden.
        addressUnconfirmed: p.addressUnconfirmed ? OPEN_WORDS.addressUnconfirmed : null,
        // Their voice (Rye, 14 Nov 2026: "I want to be able to hear the applicants voice"), played here through the admin door below.
        voice: hearer.admin && p.body.voice
          ? {
              notes: p.body.voice.notes.map((n) => ({ id: n.id, seconds: n.seconds, href: adminVoiceHref(p.id, n.id) })),
              clips: (p.body.voice.clips ?? []).map((c) => ({ id: c.id, field: c.field, label: clipFieldLabel(c.field), seconds: c.seconds, words: c.words, href: adminVoiceHref(p.id, c.id) })),
            }
          : null,
      })),
    });
  });

  /*
   * ONE RECORDING OF AN APPLICANT'S VOICE, for Admin's applications panel (Rye,
   * 14 Nov 2026). The village's admins may hear it (holding intake.moderate, and
   * admin or founder, and a person: the consent tick names them; security sweep,
   * 14 Nov 2026), a confirmed application only, as the panel lists. Inline audio the
   * panel fetches, never cached or indexed, sandboxed, checked against its fingerprint.
   */
  app.get("/api/admin/open-proposals/:id/voice/:noteId", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (!(await guardCapability(req, res, "intake.moderate"))) return;
    if (!(await voiceViewerOf(req, getPool(), await authedUser(req))).admin) return res.status(404).json({ error: "not_found" });
    const id = String(req.params.id ?? "");
    const noteId = String(req.params.noteId ?? "");
    const p = /^op-[0-9a-f]{20}$/.test(id) ? await store.readOpenProposal(getPool(), id) : null;
    const voice = p && p.status === "confirmed" ? p.body.voice : undefined;
    const note = VOICE_NOTE_ID.test(noteId) ? [...(voice?.notes ?? []), ...(voice?.clips ?? [])].find((n) => n.id === noteId) : undefined;
    const bytes = note && deps.proposalFileDir ? await readVoiceNote(deps.proposalFileDir, id, note) : null;
    if (!note || !bytes) return res.status(404).json({ error: "not_found" });
    res.setHeader("Content-Type", VOICE_NOTE_TYPES[note.kind]);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Content-Disposition", "inline");
    res.send(bytes);
  });

  app.put("/api/admin/open-proposals/settings", async (req, res) => {
    if (!(await guardCapability(req, res, "intake.moderate"))) return;
    const hasLink = req.body?.publicLink !== undefined;
    const hasTerm = req.body?.term !== undefined;
    if (!hasLink && !hasTerm) return res.status(400).json({ error: "Say whether the public link is on." });
    if (hasLink && typeof req.body.publicLink !== "boolean") return res.status(400).json({ error: "Say whether the public link is on." });
    if (hasTerm && !isTermMode(req.body.term)) return res.status(400).json({ error: "Proposals are for next season or this moon.", field: "term" });
    const standing = await settings();
    const next = { publicLink: hasLink ? req.body.publicLink : standing.publicLink, term: hasTerm ? req.body.term : standing.term };
    const doc = dbDocument(getPool(), OPEN_SETTINGS_KEY, { publicLink: true } as any);
    await doc.put(next as any);
    const message = hasTerm
      ? next.term === "moon" ? "Public proposals are now for this moon, from its new moon to the next." : "Public proposals are now for next season."
      : next.publicLink ? OPEN_WORDS.publicOn : OPEN_WORDS.publicOff;
    res.json({ ...next, message });
  });

  app.post("/api/admin/open-proposals/links", async (req, res) => {
    if (!(await guardCapability(req, res, "intake.moderate"))) return;
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const label = typeof req.body?.label === "string" ? req.body.label.trim().slice(0, OPEN_NAME_MAX) : "";
    if (!label) return res.status(400).json({ error: "Say who the link is for, so you can tell your links apart." });
    const id = `opl-${crypto.randomBytes(8).toString("hex")}`;
    const token = newToken();
    await store.insertOpenLink(getPool(), { id, tokenHash: hashOf(token), label, createdBy: String(user.id), now: now() });
    // The only answer that ever carries the token: only its hash is kept.
    res.json({ id, label, url: `${site()}/propose-a-role/${encodeURIComponent(token)}`, message: OPEN_WORDS.linkMade });
  });

  app.post("/api/admin/open-proposals/links/:id/revoke", async (req, res) => {
    if (!(await guardCapability(req, res, "intake.moderate"))) return;
    const off = await store.revokeOpenLink(getPool(), String(req.params.id ?? ""), now());
    if (!off) return res.status(404).json({ error: "There is no link by that id that is still on." });
    res.json({ success: true, message: OPEN_WORDS.linkOff });
  });

  // ── The tidy job (sheet 19i) ──────────────────────────────────────────────

  registerJob(TIDY_JOB, TIDY_EVERY_MS, async () => {
    // The closed letter carries the come-and-play block (server/lib/comms/villageLetter.ts): the open ways in for somebody with no account.
    const footer: ClosingDeps["footer"] = async ({ village, lang }) => {
      const look = await loadEmailVillage(getPool(), site());
      return comeAndPlayFor(getPool(), { ...look, name: village || look.name }, { audience: "public", lang, skip: ["quests"] });
    };
    const tidied = await tidyOpenProposals(getPool(), now(), deps.proposalFileDir, { postEmail, projectName, siteUrl: site, onboardingRole: () => stringVar("org.onboarding_role"), footer });
    // The kept applications' confirmation emails, tried again (server/lib/openProposalKept.ts).
    const again = await retryOwedConfirmations({ ...letters, getPool, postEmail }, now());
    return again.tried ? `${tidied}, ${again.went} of ${again.tried} owed confirmation emails sent` : tidied;
  });

  // ── The decision (part B) ─────────────────────────────────────────────────

  registerOpenProposalDecide(app, { ...deps, postEmail, now });
  // An agent proposed by its keeper (0374): the member door's agent side, the same proposal and the same decision.
  registerAgentProposals(app, deps, { target: async () => target((await settings()).term), offered, decide, now });
  /*
   * FIRST, THE MEMBERSHIP MADE AT APPLICATION (Rye's answer 8). An account made
   * through the invitation carries it, and queues the signing a steward accepts.
   * Registered before the placement below, because the hooks run in order and
   * the role start gate then reads the letter on the account.
   */
  if (deps.signings) {
    const signings = deps.signings;
    whenInvitedArrives(OPEN_INVITE_PREFIX, async ({ userId }) => {
      const m: any = await deps.members.byId(userId);
      if (!m?.email) return;
      await carryToAccount(getPool(), signings, { userId, name: String(m.name ?? ""), email: String(m.email), now: now() });
    });
  }
  // Review, interviews and selection (role journey L5): scorecards, recusal, the applicant's page and the ballot fallback.
  registerApplicationReview(app, { ...deps, postEmail, now });
  // A sign-up through an adopted proposal's invitation finishes the adoption, whichever door it came by.
  whenInvitedArrives(OPEN_INVITE_PREFIX, arrivalFor(decide));
  // The sign-up page names the roles and gives back the name and address sent (role audit, 10 Nov 2026).
  whenInviteDescribed(OPEN_INVITE_PREFIX, describeFor(decide));
}

/**
 * Delete what was never confirmed after 48 hours; take the name and address
 * off what was declined or withdrawn after 90 days, and off what was adopted 90
 * days ago when nobody arrived through its invitation. An adoption onto an
 * account already here made no invitation: that person is a member, and keeps
 * theirs.
 */
export async function tidyOpenProposals(pool: Pool, at: Date, fileDir?: string, closing?: ClosingDeps): Promise<string> {
  const deleted = await store.deleteUnconfirmedBefore(pool, new Date(at.getTime() - OPEN_CONFIRM_HOURS * 60 * 60_000));
  const cutoff = new Date(at.getTime() - OPEN_ANONYMISE_DAYS * 24 * 60 * 60_000);
  // Confirmed, and nobody decided it in 90 days: closed as withdrawn, and the name and address go now (red team, 9 Nov).
  // With a post office handed in, each one first gets its one closed letter (keyed per application), while the address is still here.
  let expired: number;
  let letters = 0;
  if (closing) {
    const due = await store.undecidedBefore(pool, cutoff);
    letters = await sendClosedLetters(pool, closing, due);
    const closed = await store.expireUndecided(pool, due.map((p) => p.id), cutoff, at);
    await stampQuietClose(pool, closed, at);
    expired = closed.length;
  } else {
    expired = await store.expireUndecidedBefore(pool, cutoff, at);
  }
  let anonymised = await store.anonymiseDecidedBefore(pool, cutoff, at);
  for (const p of await store.adoptedDecidedBefore(pool, cutoff)) {
    const invite = await inviteById(pool, openInviteId(p.id));
    if (!invite || invite.usedByUserId) continue;
    if (await store.anonymiseOpenProposal(pool, p.id, at)) anonymised += 1;
  }
  // The member door's applications lose the same three sections at the same age (withdrawn or not adopted).
  const doorCleared = await clearAboutYouDecidedBefore(pool, cutoff);
  // Scores and conversation notes follow the application's retention (role journey L5): cleared with the name and address.
  const cleared = await clearReviewOf(pool, await refsDueForClearing(pool, cutoff), at);
  if (cleared > 0) console.log(`[open-proposals] ${cleared} reviews cleared with their anonymised applications`);
  // Files follow the row (Rye, 10 Nov 2026): a deleted or anonymised proposal keeps none.
  const files = fileDir ? await sweepProposalFiles(fileDir, (ids) => store.proposalsKeepingFiles(pool, ids)) : 0;
  // A voice note goes 90 days after the decision in every case (shared/voiceNotes.ts): the recordings first, then the record of them.
  const voiced = await store.voiceDecidedBefore(pool, cutoff);
  if (fileDir) for (const id of voiced) await removeVoiceNotes(fileDir, id);
  const voices = await store.clearVoiceOf(pool, voiced);
  return `${deleted} unconfirmed deleted, ${expired} undecided closed${letters ? ` (${letters} closed letters sent)` : ""}, ${anonymised} anonymised${doorCleared ? `, ${doorCleared} member-door applications cleared of references` : ""}${files ? `, ${files} file folders removed` : ""}${voices ? `, ${voices} voice notes removed` : ""}`;
}
