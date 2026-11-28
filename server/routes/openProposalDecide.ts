/**
 * OPEN ROLE PROPOSALS, THE DECISION (part B): the members-only page's doors.
 * Registered by part A's module (server/routes/openProposals.ts), so
 * server/index.ts keeps one line for the whole feature. The words are
 * shared/openProposalDecide.ts and the work is server/lib/openProposalDecide.ts.
 *
 *   GET  /api/governance/open-proposals/:id              one confirmed proposal, with what the reader may do
 *   POST /api/governance/open-proposals/:id/consent      an asked holder consents or objects
 *   POST /api/governance/open-proposals/:id/adopt        a live holder of org.seat adopts it for the village
 *   POST /api/governance/open-proposals/:id/decline      the same holder declines it, kindly
 *   POST /api/governance/open-proposals/:id/invitation   a new invitation for an adopted one nobody used
 *   POST /api/governance/open-proposals/:id/invite       our review: invite to the conversations (Phase A)
 *   POST /api/governance/open-proposals/:id/not-invited  our review: the warm not-invited letter (Phase A)
 *
 * Mounted under /api/governance, so behind `requireModule("governance")`, and
 * every door asks the gate on `terms.read` first: the page is for members, as
 * an application's page is (`/role-applications/:id`). A proposal still
 * unconfirmed answers 404 everywhere: nothing unconfirmed reaches a person.
 *
 * ── WHAT A MEMBER READS ─────────────────────────────────────────────────────
 *
 * The roles, what the person wrote, where the circle's consent stands, and the
 * proposer's first name. Never their address, which only the desk reads
 * (`intake.moderate`, server/routes/openProposals.ts).
 *
 * ── WHO DECIDES (Rye, 2026-10-31, sheet 24a; coordinator's call 1) ──────────
 *
 * "The circle consents and a power holder records the adoption; nobody adopts
 * their own." The rule is `adoptRefusal` over `org.seat` read through
 * `whoMayPutHandToVillage`, the member door's own: a live holder of a role
 * carrying it adopts or declines, at any time or once the circle has consented
 * ("Record the adoption"); an admin with no such role does not; nobody acts on
 * a proposal from their own address. A proposal from a former member's address
 * is never adopted here (Rye, 2026-10-31: former members never invite), and
 * may still be declined. Once the village holds `org.seat`, or
 * nobody holds it live, nobody decides at the door: the page says so plainly,
 * and no other path is invented here (an open question for the pull request).
 *
 * ── NEVER A SILENT SUCCESS ──────────────────────────────────────────────────
 *
 * An adoption for an address with no account ALWAYS answers with the
 * invitation's link and whether the email went. Email not set up yet, an
 * address the provider refused: the proposal is still adopted, the link is
 * right there, and the sentence says to send it by hand. Each letter carries a
 * stable idempotency key, so the post office never sends one answer twice.
 *
 * ── THE INVITATION IS NAMED AFTER THE PROPOSAL ──────────────────────────────
 *
 * `inv-open-<proposal id>`, made under the adopting holder's row lock while
 * their session holds, in the same transaction that marks the proposal
 * adopted, so neither is ever written without the other. It is theirs, as a
 * link they made by hand is, and it does not count against their own cap. The
 * account it makes finishes the adoption at the welcome step
 * (server/lib/inviteDoor.ts).
 */
import { OVER_LIMIT_WORDS } from "../../shared/commitmentLimit";
import { auditOverLimit, overLimitRefusal, overLimitRoles } from "../lib/commitmentLimit";
import { stampOpenProposal } from "../repos/proposalStamps";
import { playableCopy, wantsMp4 } from "../lib/voicePlayback";
import { writeDownStored, type StoredTranscribeDeps } from "./openProposalVoiceWritten";
import { providersNow } from "../lib/voiceTranscription";
import { publicTermsOf } from "../../shared/seatTermsOffer";
import { listOrgRoles } from "../lib/orgChart";
import { commitmentReviewFor } from "../lib/commitmentReview";
import { membershipAlignedFor } from "../lib/applicationMembership";
import { identityKey, OPEN_NAME_MAX, OPEN_WORDS } from "../../shared/openProposals";
import type { Express } from "express";
import type { Pool } from "mysql2/promise";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { civilDateKey } from "../../shared/lunar";
import { type OpenProposalStatus } from "../../shared/openProposals";
import {
  adoptedAccountLetter,
  adoptedInviteLetter,
  declinedLetter,
  declinedWords,
  invitedLetter,
  notInvitedLetter,
  notInvitedWords,
  DECIDE_WORDS,
  greetingName,
  openInviteId,
  openProposalHref,
  OPEN_PROPOSAL_ID,
  roleStartsOn,
  whyNotSent,
  type NotSentWhy,
} from "../../shared/openProposalDecide";
import { consentState, shortDay } from "../../shared/roleProposalConsent";
import { ADOPTING_POWER, adoptRefusal, applicationHref } from "../../shared/seatApplications";
import { cleanNote, wordsIn, type ApplicantLanguage } from "../../shared/applicantWords";
import { dressLetter } from "../lib/comms/villageLetter";
import { languageOf } from "../lib/applicantLanguage";
import type { SeatCalendar } from "../../shared/seatTerms";
import type { AppDeps } from "../lib/appDeps";
import { makeApplicantTeller } from "../lib/applicantUpdates";
import { hashInviteToken, INVITE_DAYS, invitePath, mintInviteToken } from "../lib/invites";
import { anyAddressAccount } from "../lib/applicantAccount";
import { agreedOf, agreementParts, contractPriceFor, conversationsLeft, decideRule, isFormerMemberAccount, ownAccountOf, placeOnRoles, roomFor, startPlanOf, type DecideDeps, type StartPlan } from "../lib/openProposalDecide";
import type { LapseContext } from "../lib/orgChart";
import { answerAsk, askRolesFor, consentView, decisionFor, mayReadObjectionReasons, withoutObjectionReasons, type AskStanding } from "../lib/roleProposals";
import { whileSessionHolds } from "../lib/sessionHold";
import { effectiveLifecycle } from "../lib/modules";
import { answerNotInvited, conversationsOf, conversationsToName, hasRecused, interviewsAreIn, inviteToConversations, reviewWaits, stampDecided, stayCloseProgram } from "../lib/applicationReview";
import { currentMoonTerm, moonEnded, REVIEW_WORDS, reviewStageOf } from "../../shared/applicationReview";
import { labelLinks, statusLinkFor, type LetterLink } from "../lib/applicantUpdates";
import { anchorCircleName } from "../repos/applicationReview";
import { waitsForSend } from "../lib/applicantOnboarding";
/** Adopt and terms before the send (ruling 23). */
const SEND_FIRST = "Send it to the Anchor Circle first.";
import { stepsOf } from "../repos/applicationReview";
import { activeClock } from "../lib/gratitude-cycles";
import { createInviteOn, inviteById, reissueInviteOn, revokeInvite } from "../repos/memberInvites";
import crypto from "node:crypto";
import * as store from "../repos/openProposals";
import { asksFor, type StoredAsk } from "../repos/roleProposals";
import { PROPOSAL_FILE_ID, PROPOSAL_FILE_TYPES, proposalFileHref } from "../../shared/proposalAttachments";
import { readProposalFile, readVoiceNote } from "../lib/proposalFiles";
import { VOICE_NOTE_ID, VOICE_NOTE_TYPES, clipFieldLabel, voiceNoteHref } from "../../shared/voiceNotes";
import { seatsWithCircles } from "../repos/seatApplications";
import { baseOf, deciderOffer, loadSubject, openTalkLabels, saveOffer } from "../lib/counterOffer";
import { OFFER_WORDS } from "../../shared/counterOffer";
import { AGENT_PROPOSAL_WORDS, scopeWords } from "../../shared/agentHolders";
import { seatAdoptedAgent } from "../lib/agentRoleProposals";
import { agentsWithReach, isAgentAccount } from "../repos/agentAccounts";
import { voiceForViewer, voiceViewerOf } from "../lib/voiceForViewer";
import { declineNextStepsLines, DECLINE_STEPS_KEYS } from "../../shared/declineNextSteps";
import type { PlayDoor } from "../../shared/comms/comeAndPlay";
import { boolVar, stringVar } from "../lib/variables";
import { ALL_HANDS_VARIABLES, weekdayName, weekdayOfIso, zoneLabel } from "../../shared/startDay";
import { ROLE_SHORT_LABELS_VARIABLE, roleShortLabel } from "../../shared/roleShortLabel";
import { liveHoldersOfRole, roleNamesById, rolesHeldBy } from "../repos/applicationReview";
import { trustedAccountFor } from "../lib/applicantAccount";
import { allHandsInvite } from "../../shared/startDay";
import { emailKeyOf } from "../../shared/comms/address";
import { holderFirstName } from "../../shared/roleHolderLabel";

export type DecideRouteDeps = Pick<
  AppDeps,
  "authedUser" | "guardCapability" | "getPool" | "notify" | "notifyAdmins" | "overLimit" | "members" | "stageOf" | "recordStageEvent" | "deploymentOrigin" | "projectName" | "escapeHtml" | "seasonState"
> & {
  liveHoldersOf(capability: string): Promise<string[]>;
  /** The permission roles carrying a power, for the authority a holder adopts under. */
  rolesCarrying(capability: string): Array<{ id: string; name: string }>;
  loadRoleHolders(): Array<{ roleId: string; userId: string }>;
  seatCalendar(): SeatCalendar;
  lapse(): LapseContext;
  /** The one mail door, as part A's module holds it. */
  postEmail(email: OutgoingEmail): Promise<PostResult>;
  /** Whether Live Sessions is on, so an objection has a circle backlog to go to. Defaults to the live lifecycle. */
  sessionsOn?: () => boolean;
  now?: () => Date;
  /** Where a proposal's attached files live (server/lib/proposalFiles.ts). Absent: no file is served. */
  proposalFileDir?: string;
  /** "Write down the words" on a kept recording: a suite hands in its own provider, limiter and log (openProposalVoiceWritten.ts). */
  storedTranscribe?: Partial<Pick<StoredTranscribeDeps, "transcribe" | "limitState" | "log" | "providers" | "now">>;
};

const BASE = "/api/governance/open-proposals";
const MEMBERS_ONLY = { error: "auth_required", message: DECIDE_WORDS.membersOnly };
const MISSING = { error: "not_found", message: DECIDE_WORDS.missing };
/** Answers and decisions: ten of each in ten minutes per member, as the member door counts them. */
const ACTS_PER_WINDOW = 10;
const WINDOW_MS = 10 * 60 * 1000;

/** A send the provider took, or one already taken under the same key. */
/** The come-and-play cards the decline letter's next steps already say, so the letter names each way in once. */
const NEXT_STEP_DOORS: readonly PlayDoor[] = ["quests", "roles", "stayClose"];

const WENT: ReadonlySet<PostResult["status"]> = new Set<PostResult["status"]>(["sending", "sent", "delivered", "duplicate"]);

/** The status a member reads, for every status the page can show. */
const STATUS_WORDS = DECIDE_WORDS.status satisfies Record<Exclude<OpenProposalStatus, "unconfirmed">, string>;

export function registerOpenProposalDecide(app: Express, deps: DecideRouteDeps): void {
  const { authedUser, guardCapability, getPool, overLimit, members, deploymentOrigin, projectName, postEmail } = deps;
  const now = () => (deps.now ? deps.now() : new Date());
  const tz = () => deps.seatCalendar().timezone || "UTC";
  const site = () => deploymentOrigin().replace(/\/+$/, "");
  const work: DecideDeps = {
    getPool,
    notify: deps.notify,
    notifyAdmins: deps.notifyAdmins,
    members,
    stageOf: deps.stageOf,
    recordStageEvent: deps.recordStageEvent,
    liveHoldersOf: deps.liveHoldersOf,
    calendar: deps.seatCalendar,
    lapse: deps.lapse,
    now,
  };

  /** Whether our review came first on this application: its yes is then said as the circle's welcome. */
  const reviewedOf = async (id: string): Promise<boolean> => reviewStageOf(await stepsOf(getPool(), id)) !== null;

  /** Updates to the person who proposed: their bell, once they have an account (the email already has its own letter). */
  const tell = makeApplicantTeller({ getPool, members, notify: deps.notify, postEmail, projectName, siteUrl: site });

  /** The signed-in member holding `terms.read`, or null after answering 401. */
  async function reader(req: any, res: any): Promise<any | null> {
    if (!(await guardCapability(req, res, "terms.read", { status: 401, body: MEMBERS_ONLY }))) return null;
    const viewer = await authedUser(req);
    if (!viewer) {
      res.status(401).json(MEMBERS_ONLY);
      return null;
    }
    return viewer;
  }

  /** Over the member's count of decisions, answered, or false. */
  async function limited(res: any, bucket: string): Promise<boolean> {
    if (!(await overLimit(bucket, ACTS_PER_WINDOW, WINDOW_MS))) return false;
    res.status(429).json({ error: DECIDE_WORDS.tooMany });
    return true;
  }

  /** The proposal by id once its address confirmed it, or null after answering 404. */
  async function found(req: any, res: any): Promise<store.StoredOpenProposal | null> {
    const id = String(req.params.id ?? "");
    const p = OPEN_PROPOSAL_ID.test(id) ? await store.readOpenProposal(getPool(), id) : null;
    if (!p || p.status === "unconfirmed") {
      res.status(404).json(MISSING);
      return null;
    }
    return p;
  }

  /** The season a proposal is for, by the village's calendar, with its name. */
  const seasonOf = (p: store.StoredOpenProposal): { id: string; name?: unknown; startsOn: string } | null =>
    (deps.seasonState().seasons ?? []).find((s: any) => s && String(s.id) === p.targetSeasonId) ?? null;

  /** The roles by name and circle, as they read now. A role retired since keeps its place in the list. */
  async function rolesOf(pool: Pool, p: store.StoredOpenProposal) {
    const named = new Map((await seatsWithCircles(pool, p.body.roles.map((r) => r.roleId))).map((r) => [r.id, r]));
    // The open card's outcomes and time, read live, so the decider sees what the role asks beside what was offered.
    const live = new Map((await listOrgRoles(pool)).map((r) => [r.id, r]));
    return p.body.roles.map((r) => {
      const role: any = live.get(r.roleId);
      return {
        id: r.roleId,
        name: named.get(r.roleId)?.name ?? null,
        circle: named.get(r.roleId)?.circle ?? null,
        note: r.note,
        // An early application (the lead, 20 Nov 2026): the role was coming soon when it was sent.
        ...(r.early === true ? { early: true } : {}),
        accountabilities: Array.isArray(role?.accountabilities) ? role.accountabilities.map((a: unknown) => String(a ?? "").trim()).filter(Boolean) : [],
        commitmentPct: publicTermsOf(role?.termsOffer ?? null).commitmentPct,
      };
    });
  }
  const namesOf = (roles: Array<{ id: string; name: string | null }>) => roles.map((r) => r.name ?? r.id);

  /**
   * Whether this member may adopt or decline this proposal at the door, and
   * the proposer's own account here, if any. Refused, with the sentence.
   */
  /** The applicant themself: their own account, or the person behind the address (the same test `deciding` makes). */
  async function isTheApplicant(p: store.StoredOpenProposal, viewerId: string, own: string | null | undefined): Promise<boolean> {
    if (own && own === viewerId) return true;
    const viewer: any = await members.byId(viewerId);
    return !!viewer?.email && !!p.email && identityKey(String(viewer.email)) === identityKey(p.email);
  }

  async function deciding(p: store.StoredOpenProposal, actorId: string) {
    const rule = await decideRule(work);
    // An agent's keeper is its own (0374): they proposed it, so they never decide it.
    const own = await ownAccountOf(members, p, getPool());
    // Nobody adopts their own, matched by account AND by the person behind the
    // address: the actor's own address with a +tag, another case or Gmail's dots
    // is still the applicant (coordinator, 9 Nov 2026). A proposal from an
    // address nobody here holds, in any dress, is nobody's own.
    const actor: any = await members.byId(actorId);
    const actorIdentity = actor?.email ? identityKey(String(actor.email)) : null;
    const sameperson = !!actorIdentity && !!p.email && identityKey(p.email) === actorIdentity;
    const refusal = adoptRefusal(rule, actorId, sameperson ? actorId : (own ?? `open:${p.id}`));
    if (!refusal) return { ok: true as const, rule, own };
    const body =
      refusal.error === "own_terms"
        ? { error: "own_proposal", message: DECIDE_WORDS.ownProposal }
        : rule.who !== "live-holders"
          ? { error: "not_at_the_door", message: DECIDE_WORDS.door[rule.because] }
          : { error: "not_a_holder", message: DECIDE_WORDS.notAHolder };
    return { ok: false as const, status: refusal.status, body, rule, own };
  }

  /**
   * WHO SEES THE LINKS AND FILES (Rye, 10 Nov 2026: "deciders only"): the live
   * holders of the power that seats people, and the circle's holders asked to
   * consent or object. Never the applicant, never another member who can read
   * the page, never an admin for being one.
   */
  function decidesIt(may: Awaited<ReturnType<typeof deciding>>, asks: readonly StoredAsk[], viewerId: string): boolean {
    if (may.own === viewerId || (!may.ok && may.body.error === "own_proposal")) return false;
    const holds = may.rule.who === "live-holders" && may.rule.holders.includes(viewerId);
    return holds || asks.some((a) => a.userId === viewerId);
  }

  /**
   * A letter as an essential email: the person asked for this answer. Dressed
   * in the village's letter frame (server/lib/comms/villageLetter.ts), signed
   * by its team; a no carries the come-and-play block, so every answer that
   * closes a door also opens the village's other ones.
   */
  async function letter(
    key: string,
    origin: string,
    to: { email: string; name: string | null },
    words: { subject: string; text: string; button?: { label: string; url: string } },
    o: { lang?: ApplicantLanguage | null; comeAndPlay?: boolean; skip?: readonly PlayDoor[]; attachments?: OutgoingEmail["attachments"]; links?: readonly LetterLink[] } = {},
  ): Promise<OutgoingEmail> {
    const dressedRaw = await dressLetter(getPool(), site(), words, { lang: o.lang ?? null, comeAndPlay: o.comeAndPlay ? "public" : false, villageName: projectName(), skip: o.skip });
    // The page and each booking by their words, never a raw address (QA round 5, item 9).
    const page = /https?:\/\/\S+\/application-status\/[^\s<"]+/.exec(words.text)?.[0] ?? null;
    const dressed = { ...dressedRaw, html: labelLinks(dressedRaw.html, [...(page ? [{ url: page, label: wordsIn(o.lang ?? "en").shape.seePage }] : []), ...(o.links ?? [])]) };
    return {
      idempotencyKey: key,
      kind: "essential",
      origin,
      to: { email: to.email, ...(to.name ? { name: to.name } : {}) },
      subject: words.subject,
      html: dressed.html,
      text: dressed.text,
      preheader: dressed.preheader,
      ...(o.attachments?.length ? { attachments: o.attachments } : {}),
    };
  }

  /** The first season that begins after a day, by name and first day (ruling 12: they may apply again then). */
  const nextSeasonAfter = (dayIso: string): { name: string | null; startsOn: string } | null => {
    const next = (deps.seasonState().seasons ?? [])
      .map((x: any) => ({ name: typeof x?.name === "string" && x.name.trim() ? x.name.trim() : null, startsOn: String(x?.startsOn ?? "").slice(0, 10) }))
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.startsOn) && x.startsOn > dayIso)
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0];
    return next ?? null;
  };

  /** The first conversation's booking as the invitation's button ("Book with Ops"). */
  const firstBookingLinks = async (p: store.StoredOpenProposal): Promise<LetterLink[]> => {
    const first = (await conversationsToName(getPool(), p.id))[0];
    if (!first) return [];
    const label = wordsIn(languageOf(p)).status.booking.bookNow(first.label || first.role);
    const urls = first.bookingLinks?.length ? first.bookingLinks.map((l) => l.url) : first.bookingUrl ? [first.bookingUrl] : [];
    return urls.map((url) => ({ url, label, pill: true }));
  };

  /** Send, and say why not when it did not go. */
  async function sent(email: OutgoingEmail | null): Promise<NotSentWhy | null> {
    if (!email) return "no_address";
    const r = await postEmail(email);
    return WENT.has(r.status) ? null : whyNotSent(r);
  }

  /** When the roles start, from the one plan the seat is written by (server/lib/openProposalDecide.ts `startPlanOf`). */
  const planFor = (p: store.StoredOpenProposal, adoptedAt: Date): Promise<StartPlan> => startPlanOf(work, p, adoptedAt, adoptedAt);

  /** A date with the weekday it falls on ("Monday 21 December 2026"). The weekday is the date's own, never a setting's. */
  const dated = (iso: string, lang: ApplicantLanguage): string => `${weekdayName(weekdayOfIso(iso), lang)} ${wordsIn(lang).day(iso)}`;

  /**
   * THE LETTER'S DAYS. Outside the conversation flow they are the ones that letter always had: a moon role starts on
   * the day it is adopted, never before the moon's first day (audit: "from 9 November" for a role adopted on the
   * 11th), and a season role on the season's first day. In the flow every day comes from the plan, so the letter, the
   * seat and the invite name one day (e2e round 3).
   */
  const seasonWords = (p: store.StoredOpenProposal, adoptedAt: Date, plan: StartPlan) => {
    const s = seasonOf(p);
    const t = p.body.term;
    const lang = languageOf(p);
    const w = wordsIn(lang);
    const civilDayWords = w.day;
    const season = s?.name ? String(s.name) : null;
    if (plan.flow && plan.startIso) {
      return {
        season,
        startsOn: civilDayWords(plan.startIso),
        moon: t ? { from: civilDayWords(plan.startIso), to: civilDayWords(plan.moonEndsOn ?? t.endsOn) } : null,
        seasonSameDay: !t && !!s?.startsOn && String(s.startsOn).slice(0, 10) === plan.startIso,
        lang,
      };
    }
    const from = t ? roleStartsOn(t.startsOn, civilDateKey(adoptedAt, tz())) : null;
    return {
      season,
      startsOn: t && from ? civilDayWords(from) : s?.startsOn ? civilDayWords(String(s.startsOn)) : w.adopt.firstDay,
      moon: t && from ? { from: civilDayWords(from), to: civilDayWords(t.endsOn) } : null,
      lang,
    };
  };

  /**
   * THE DAY THEY START AND THE ALL-HANDS THEY JOIN (the lead, 27 Nov 2026), for the conversation flow only. By
   * default the start day is the all-hands day, and the welcoming role may start them sooner, which the letter says by
   * its name. With Ops's "start now" the roles start today, no "sooner" is said, and the all-hands is the next one by
   * its own date. The meeting's time, zone and link are the village's settings.
   */
  const startWords = async (p: store.StoredOpenProposal, plan: StartPlan) => {
    if (!plan.flow || !plan.startIso) return { flow: false as const };
    const lang = languageOf(p);
    const time = stringVar(ALL_HANDS_VARIABLES.time).trim();
    const zone = zoneLabel(stringVar(ALL_HANDS_VARIABLES.zone), lang);
    const link = stringVar(ALL_HANDS_VARIABLES.link).trim();
    const welcome = stringVar("org.onboarding_role").trim();
    const welcomeName = welcome ? (await roleNamesById(getPool(), [welcome])).get(welcome) : undefined;
    const meeting = plan.allHandsIso ?? plan.startIso;
    // Default: "That day ..., Monday at 12:00". Start now: "... our next all-hands meeting, Monday 30 November 2026 at 12:00".
    const meetingDay = plan.startNow ? dated(meeting, lang) : weekdayName(weekdayOfIso(meeting), lang);
    return {
      flow: true as const,
      startToday: plan.startNow,
      startDay: dated(plan.startIso, lang),
      soonerRole: plan.startNow ? null : welcome && welcomeName ? roleShortLabel(welcome, welcomeName, stringVar(ROLE_SHORT_LABELS_VARIABLE)) : null,
      allHands: time ? { when: [meetingDay, lang === "es" ? `a las ${time}` : `at ${time}`, zone].filter(Boolean).join(" "), link: /^https:\/\//.test(link) ? link : null } : null,
    };
  };

  /**
   * THE NEWCOMER'S BUDDY (the lead, 27 Nov 2026: "The buddy by default will be the Ops role unless I choose someone
   * else"): the member the adopter chose, else whoever holds the welcoming role (`org.onboarding_role`) now. Their
   * first name and the role's short label go in the start letter and on the newcomer's profile.
   */
  const buddyFor = async (p: store.StoredOpenProposal): Promise<{ name: string; role: string | null } | null> => {
    const pool = getPool();
    const welcome = stringVar("org.onboarding_role").trim();
    const chosen = await store.buddyOf(pool, p.id);
    const userId = chosen ?? (welcome ? ((await liveHoldersOfRole(pool, welcome))[0] ?? null) : null);
    if (!userId) return null;
    const row: any = await members.byId(userId);
    const name = holderFirstName(row?.name ?? null);
    if (!name) return null;
    const held = await rolesHeldBy(pool, userId);
    const roleId = welcome && held.includes(welcome) ? welcome : (held[0] ?? "");
    const roleName = roleId ? (await roleNamesById(pool, [roleId])).get(roleId) : undefined;
    return { name, role: roleId && roleName ? roleShortLabel(roleId, roleName, stringVar(ROLE_SHORT_LABELS_VARIABLE)) : null };
  };

  /** Everything the start letter adds: the day, the all-hands, the buddy. */
  const newcomer = async (p: store.StoredOpenProposal, plan: StartPlan) =>
    plan.flow ? { ...(await startWords(p, plan)), buddy: await buddyFor(p), anchorCircle: await anchorCircleName(getPool()), statusLink: await statusLinkFor({ siteUrl: site, getPool }, p.id) } : {};

  /** The adoption letter's start: its words and its invite file, from one plan. A role outside the flow adds nothing. */
  const startOfLetter = async (p: store.StoredOpenProposal, adoptedAt: Date) => {
    const plan = await planFor(p, adoptedAt);
    return { plan, words: { ...seasonWords(p, adoptedAt, plan), ...(await newcomer(p, plan)) }, attachments: await allHandsAttachment(p, plan) };
  };

  /** The all-hands as a calendar invite, attached to the start letter (the lead, 27 Nov 2026). */
  const allHandsAttachment = async (p: store.StoredOpenProposal, plan: StartPlan): Promise<OutgoingEmail["attachments"]> => {
    // The invite is for the all-hands the letter names: the start day's, or with "start now" the next one.
    const day = plan.flow ? (plan.allHandsIso ?? plan.startIso) : null;
    const time = stringVar(ALL_HANDS_VARIABLES.time).trim();
    const zone = stringVar(ALL_HANDS_VARIABLES.zone).trim();
    const link = stringVar(ALL_HANDS_VARIABLES.link).trim();
    if (!day || !time || !zone) return [];
    const ics = allHandsInvite({ uid: `all-hands-${p.id}@village`, dayIso: day, time, zone, title: wordsIn(languageOf(p)).adopt.allHandsTitle, link: /^https:\/\//.test(link) ? link : null, now: now() });
    return ics ? [{ filename: "all-hands.ics", contentType: "text/calendar; charset=utf-8; method=PUBLISH", contentBase64: Buffer.from(ics, "utf8").toString("base64") }] : [];
  };

  /**
   * THE NEWCOMER'S FIRST WEEK ON THEIR PROFILE (the lead, 27 Nov 2026): their buddy, their start day and the all-hands
   * they join, for the signed-in member's newest adopted proposal that this account is trusted to be. The page says the
   * meeting's time in the reader's own zone with the village's beside it. Nothing of anyone else's application.
   */
  app.get("/api/me/first-week", async (req, res) => {
    const viewer = await authedUser(req);
    if (!viewer) return res.status(401).json({ error: "auth_required" });
    if (await overLimit(`first-week:${String(viewer.id)}`, 60, 10 * 60_000)) return res.status(429).json({ error: "too_many" });
    const email = typeof (viewer as any).email === "string" ? (viewer as any).email : "";
    for (const p of email ? await store.adoptedFromAddress(getPool(), emailKeyOf(email)) : []) {
      if ((await trustedAccountFor(members, p, getPool())) !== String(viewer.id)) continue;
      const plan = await planFor(p, p.decidedAt ?? now());
      // The first week is the conversation flow's: a role adopted outside it has no start day to show.
      if (!plan.flow || !plan.startIso) continue;
      const sw = await startWords(p, plan);
      return res.set("Cache-Control", "no-store").json({
        firstWeek: {
          ref: p.id,
          startIso: plan.startIso,
          // The all-hands they join: the start day's, or with "start now" the next one.
          allHandsIso: plan.allHandsIso ?? plan.startIso,
          buddy: await buddyFor(p),
          allHands: sw.flow && sw.allHands ? { time: stringVar(ALL_HANDS_VARIABLES.time).trim(), zone: stringVar(ALL_HANDS_VARIABLES.zone).trim(), link: sw.allHands.link } : null,
        },
      });
    }
    res.set("Cache-Control", "no-store").json({ firstWeek: null });
  });

  // ── Read ──────────────────────────────────────────────────────────────────

  app.get(`${BASE}/:id`, async (req, res) => {
    const viewer = await reader(req, res);
    if (!viewer) return;
    const p = await found(req, res);
    if (!p) return;
    const pool = getPool();
    const viewerId = String(viewer.id);
    const at = now();
    const roles = await rolesOf(pool, p);
    const asks = (await asksFor(pool, [p.id])).get(p.id) ?? [];
    const open = p.status === "confirmed";
    const askRoles = await askRolesFor(pool, asks);
    const may = await deciding(p, viewerId);
    // The reasons for the circle asked and the applicant only (the lead, 27 Nov 2026); the count for everybody.
    const whole = consentView(asks, at, tz(), viewerId, askRoles);
    const view = mayReadObjectionReasons(asks, viewerId, askRoles, await isTheApplicant(p, viewerId, may.own)) ? whole : withoutObjectionReasons(whole);
    const holdsThePower = may.rule.who === "live-holders" && may.rule.holders.includes(viewerId);
    // The invitation's standing, for the holders of the power, on an adoption that made one.
    let invitation: { state: "open" | "used" | "closed"; sentAt: string | null; emailed: boolean | null; askedAt: string | null } | null = null;
    if (p.status === "adopted" && holdsThePower && !may.own) {
      const inv = await inviteById(pool, openInviteId(p.id));
      const sentNote = await store.invitationSentOf(pool, p.id);
      // The applicant asked for a new one from their status page (server/lib/applicantFollowups.ts). Said only while it still waits on a holder.
      const asked = await store.newInvitationAskedOf(pool, p.id);
      const state = !inv ? "closed" : inv.usedByUserId ? "used" : inv.revokedAt || inv.expired ? "closed" : "open";
      invitation = { state, sentAt: sentNote ? sentNote.at.toISOString() : null, emailed: sentNote ? sentNote.emailed : null, askedAt: asked && state === "closed" ? asked.toISOString() : null };
    }
    // A former member's address, told only to those who decide it (coordinator, 2026-10-31).
    const former = open && may.ok && !!may.own && (await isFormerMemberAccount(work, may.own));
    const season = seasonOf(p);
    // Links and files, for the deciders only (Rye, 10 Nov 2026). Gone once the proposal is anonymised.
    const attached = decidesIt(may, asks, viewerId)
      ? { links: p.body.links ?? [], files: (p.body.files ?? []).map((f) => ({ id: f.id, kind: f.kind, name: f.name, size: f.size, href: proposalFileHref(p.id, f.id) })) }
      : null;
    // About you (joining lane PR 2): the references, the check and its consent are third-party data. Same gate as the links and files, nobody else, gone once anonymised.
    const aboutYou = decidesIt(may, asks, viewerId)
      ? { references: p.body.references ?? [], about: p.body.about ?? {}, backgroundCheck: p.body.backgroundCheck ?? null }
      : null;
    // The founding application's own answers (Phase A): the ways they got to know us and whether they asked for a ramp-up.
    // Deciders only. Human Design or Gene Keys (`selfKnowledge`) is the applicant's own and never reaches a decider.
    const founding = decidesIt(may, asks, viewerId) && !p.body.agent
      ? { knowUs: p.body.knowUs ?? [], rampUp: p.body.rampUp === true }
      : null;
    // Never to an agent, whatever the "personal" rule opens to it (server/lib/voiceForViewer.ts).
    const hearer = await voiceViewerOf(req, pool, viewer);
    // What the applicant would make of each role card's pieces (Rye, 14 Nov 2026): deciders only, read-only, never to an AI.
    const pieceSuggestions = decidesIt(may, asks, viewerId) ? voiceForViewer(hearer, p.body.pieceSuggestions ?? []) : null;
    // Their voice note (Rye, 14 Nov 2026), kept only with their tick: the same gate as the files, never to an AI, gone 90 days after the decision.
    const voice = decidesIt(may, asks, viewerId) && !hearer.agent && p.body.voice
      ? {
          notes: p.body.voice.notes.map((n) => ({ id: n.id, seconds: n.seconds, size: n.size, href: voiceNoteHref(p.id, n.id) })),
          transcript: p.body.voice.transcript,
          // Clips beside answers (Rye, 14 Nov 2026), each with the answer it belongs to and the words heard while it ran.
          clips: (p.body.voice.clips ?? []).map((c) => ({ id: c.id, field: c.field, label: clipFieldLabel(c.field), seconds: c.seconds, words: c.words, href: voiceNoteHref(p.id, c.id) })),
          // AI transcripts of these recordings (the lead, 17 Nov 2026), marked as such on the page, and whether one can be asked for now.
          written: p.body.voice.written ?? {},
          transcribeOn: (await (deps.storedTranscribe?.providers ?? (() => providersNow(pool)))()).length > 0,
        }
      : null;
    // The commitment, what the role pays at it, the optional ask and the coverage arithmetic (Rye, 14 Nov 2026). Deciders only; never ranked.
    const commitment = decidesIt(may, asks, viewerId) && !p.body.agent ? await commitmentReviewFor(pool, p.body, await listOrgRoles(pool), may.own ?? null) : null;
    // The pay adopting would write into the contract, and where it comes from (QA-1115 P0-1). Deciders only.
    // One agreement per role when the proposal names several roles with a commitment for each (the lead, 17 Nov 2026).
    const parts = agreementParts(p.body);
    const pricedParts = commitment ? await Promise.all(parts.map(async (part) => {
      const agreed = await agreedOf(pool, p, part);
      const price = await contractPriceFor(pool, p, agreed, part);
      return price ? { amountMinor: price.amountMinor, currency: price.currency, per: price.per, source: price.source, capped: price.capped, pct: typeof agreed.commitmentPct === "number" && agreed.commitmentPct > 0 ? agreed.commitmentPct : 100 } : null;
    })) : undefined;
    const priced = pricedParts ? pricedParts[0] : undefined;
    const pricedEach = pricedParts && parts.length > 1 ? parts.map((part, i) => ({ roleId: part.roleIds[0], price: pricedParts[i] })) : undefined;
    // The terms we offer, with the history: for the deciders only (joining lane PR 4). The applicant reads the current offer at their status page, never the log.
    // An agent is never offered a person's pay, allowance or commitment (audit B8a), so its page carries no terms.
    const subject = !p.body.agent && decidesIt(may, asks, viewerId) ? await loadSubject(pool, p.id) : null;
    const offer = subject ? deciderOffer(subject, await baseOf(pool, subject.roleIds)) : null;
    // What is left before Adopt (audit M10, B3): the conversations not written up, and the roles with every seat taken. Deciders only.
    const deciderHere = open && may.ok && !former && holdsThePower;
    const left = deciderHere ? await conversationsLeft(pool, p.id) : [];
    const room = deciderHere ? await roomFor(work, p, may.own ?? null) : [];
    const full = room.filter((f) => !f.limit);
    const over = overLimitRoles(room);
    const beforeAdopt = deciderHere
      ? {
          conversations: left.map((c) => ({ roleId: c.roleId, role: c.role, unheld: c.unheld, words: c.unheld ? DECIDE_WORDS.conversationUnheld(c.role) : DECIDE_WORDS.conversationMissing(c.role) })),
          // Above the role's commitment limit (the lead, 20 Nov 2026): a confirm step before Adopt, with the numbers.
          overLimit: over.length ? { ask: OVER_LIMIT_WORDS.ask, roles: over.map((o) => ({ ...o, words: OVER_LIMIT_WORDS.role(o.name, o.used, o.adding, o.target) })) } : null,
          seatsFull: full.map((f) => ({ name: f.name, seats: f.seats, taken: f.taken })),
          seatsWords: full.length ? DECIDE_WORDS.seatsFull(full) : null,
        }
      : null;
    // Our review (Phase A): where it stands, and the conversations an invitation opens, in order. Deciders read the conversations.
    const stage = reviewStageOf(await stepsOf(pool, p.id));
    const review = stage
      ? { stage, conversations: decidesIt(may, asks, viewerId) ? (await conversationsOf(pool, p.id)).map((c) => ({ role: c.role, minutes: c.minutes })) : [] }
      : null;
    const reviewing = open && stage === "review";
    // An agent's proposal (0374): what it is, who keeps it, what it can reach (read live from its tokens) and how to switch it off.
    let agent: Record<string, unknown> | null = null;
    if (p.body.agent) {
      const a = p.body.agent;
      const keeperRow: any = await members.byId(a.keeperUserId);
      const [live] = await agentsWithReach(pool, a.agentUserId);
      agent = {
        name: a.name,
        what: a.what,
        keeper: String(keeperRow?.name ?? "").trim() || null,
        reach: live ? live.scopes.map((sc) => ({ scope: sc, words: scopeWords(sc) })) : [],
        stillAnAgent: !!live,
        switchOff: a.switchOff,
        switchOffPlatform: AGENT_PROPOSAL_WORDS.switchOffPlatform,
      };
    }
    res.set("Cache-Control", "no-store").json({
      proposal: {
        id: p.id,
        href: openProposalHref(p.id),
        status: p.status,
        statusWords: p.decision.words ?? (stage === "review" && open ? DECIDE_WORDS.review.inReview : stage === "invited" && open ? DECIDE_WORDS.review.invited : STATUS_WORDS[p.status as keyof typeof STATUS_WORDS] ?? ""),
        proposer: greetingName(p.name),
        season: season ? { id: String(season.id), name: String(season.name ?? "") || null, startsOn: String(season.startsOn) } : null,
        term: p.body.term ?? null,
        card: p.body.card ?? null,
        // "Start a conversation" (the lead, 20 Nov 2026): a short way in, to be invited to the full proposal later.
        kind: p.body.kind ?? null,
        // The membership letter, aligned with at application or from their account (Rye's answer 8): a yes or a no.
        membership: agent ? null : { aligned: await membershipAlignedFor(pool, p.email, may.own ?? null) },
        agent,
        roles,
        why: p.body.why,
        aim: p.body.aim,
        confirmedOn: p.confirmedAt ? civilDateKey(p.confirmedAt, tz()) : null,
        // Kept although our confirmation email failed (Rye, 14 Nov 2026): said to everyone who reads the page.
        addressUnconfirmed: p.addressUnconfirmed ? { words: OPEN_WORDS.addressUnconfirmed, account: !!may.own && !p.body.agent ? OPEN_WORDS.addressUnconfirmedAccount : null } : null,
        decidedOn: p.decidedAt ? civilDateKey(p.decidedAt, tz()) : null,
        decided: p.decision.words,
        // Answers close with the decision, so nobody reads that they may still give one.
        consent: open ? view : { ...view, record: null, you: { ...view.you, mayAnswer: false } },
        door: { because: may.rule.because, words: DECIDE_WORDS.door[may.rule.because] },
        invitation,
        attached,
        aboutYou: agent ? null : aboutYou,
        founding,
        pieceSuggestions,
        voice,
        commitment,
        ...(priced !== undefined ? { contractPrice: priced } : {}),
        ...(pricedEach ? { contractPrices: pricedEach } : {}),
        offer,
        beforeAdopt,
        review,
        you: {
          mayEditTerms: open && may.ok && !p.body.agent,
          holdsThePower,
          own: !!may.own && may.own === viewerId,
          // While our review waits, its two answers stand in place of adopt and decline.
          mayAdopt: open && may.ok && !former && !reviewing && !(p.addressUnconfirmed && may.own && !p.body.agent) && p.body.kind !== "conversation",
          mayDecline: open && may.ok && !reviewing,
          mayReview: reviewing && may.ok,
          formerMember: former,
          mayReissue: !!invitation && invitation.state !== "used",
        },
      },
    });
  });

  /*
   * ONE ATTACHED FILE, to a decider and nobody else. Read from the private
   * folder, checked against the fingerprint kept when it was sent, kept out of
   * every cache and every index, and always downloaded rather than opened in
   * the page, so a file can never run as this site. Anybody else is answered
   * as if there were no such file.
   */
  app.get(`${BASE}/:id/files/:fileId`, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    const viewer = await reader(req, res);
    if (!viewer) return;
    const viewerId = String(viewer.id);
    if (await overLimit(`open-proposal-file:${viewerId}`, 60, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "too_many_asks", message: "That is a lot of files in an hour. Try again in a little while." });
    }
    const p = await found(req, res);
    if (!p) return;
    const fileId = String(req.params.fileId ?? "");
    const file = PROPOSAL_FILE_ID.test(fileId) ? (p.body.files ?? []).find((f) => f.id === fileId) : undefined;
    const asks = (await asksFor(getPool(), [p.id])).get(p.id) ?? [];
    if (!file || !deps.proposalFileDir || !decidesIt(await deciding(p, viewerId), asks, viewerId)) return res.status(404).json(MISSING);
    const bytes = await readProposalFile(deps.proposalFileDir, p.id, file);
    if (!bytes) return res.status(404).json(MISSING);
    res.setHeader("Content-Type", PROPOSAL_FILE_TYPES[file.kind]);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Content-Disposition", `attachment; filename="${file.name.replace(/[^ -~]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.send(bytes);
  });

  /*
   * ONE RECORDING OF THEIR VOICE NOTE, by the same rule as the files: members
   * only, and only those who decide it; anybody else is answered as if there
   * were no such recording. Played in the page, so it is served inline as audio
   * the page fetches, never cached or indexed, and sandboxed. The page reads it
   * whole into the player, so no byte ranges are needed.
   */
  app.get(`${BASE}/:id/voice/:noteId`, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    const viewer = await reader(req, res);
    if (!viewer) return;
    const viewerId = String(viewer.id);
    if (await overLimit(`open-proposal-file:${viewerId}`, 60, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "too_many_asks", message: "That is a lot of listening in an hour. Try again in a little while." });
    }
    const p = await found(req, res);
    if (!p) return;
    const noteId = String(req.params.noteId ?? "");
    const note = VOICE_NOTE_ID.test(noteId) ? [...(p.body.voice?.notes ?? []), ...(p.body.voice?.clips ?? [])].find((n) => n.id === noteId) : undefined;
    const asks = (await asksFor(getPool(), [p.id])).get(p.id) ?? [];
    if (!note || !deps.proposalFileDir || !decidesIt(await deciding(p, viewerId), asks, viewerId)) return res.status(404).json(MISSING);
    // A person's ears only: never an agent's (server/lib/voiceForViewer.ts).
    if ((await voiceViewerOf(req, getPool(), viewer)).agent) return res.status(404).json(MISSING);
    const bytes = await readVoiceNote(deps.proposalFileDir, p.id, note);
    if (!bytes) return res.status(404).json(MISSING);
    // `?as=mp4`: an MP4/AAC copy, for Safari and every iPhone browser (server/lib/voicePlayback.ts). 415 where none can be made.
    const mp4 = wantsMp4(req.query.as);
    const served = mp4 ? await playableCopy(deps.proposalFileDir, p.id, note, bytes) : bytes;
    if (!served) return res.status(415).json({ error: "no_playable_copy" });
    res.setHeader("Content-Type", mp4 ? "audio/mp4" : VOICE_NOTE_TYPES[note.kind]);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Content-Disposition", "inline");
    res.send(served);
  });

  /*
   * WRITE DOWN ONE KEPT RECORDING, for the people who decide it (the lead, 17
   * Nov 2026: "Transcribe them! They've personally consented with me."). The
   * same people as the Listen door above, by the same checks; the words are
   * kept with the application as an AI transcript (openProposalVoiceWritten.ts).
   */
  app.post(`${BASE}/:id/voice/:noteId/transcribe`, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const viewer = await reader(req, res);
    if (!viewer) return;
    const viewerId = String(viewer.id);
    const p = await found(req, res);
    if (!p) return;
    const noteId = String(req.params.noteId ?? "");
    const note = VOICE_NOTE_ID.test(noteId) ? [...(p.body.voice?.notes ?? []), ...(p.body.voice?.clips ?? [])].find((n) => n.id === noteId) : undefined;
    const asks = (await asksFor(getPool(), [p.id])).get(p.id) ?? [];
    if (!note || !decidesIt(await deciding(p, viewerId), asks, viewerId)) return res.status(404).json(MISSING);
    if ((await voiceViewerOf(req, getPool(), viewer)).agent) return res.status(404).json(MISSING);
    const out = await writeDownStored({ getPool, proposalFileDir: deps.proposalFileDir, providers: () => providersNow(getPool()), ...(deps.storedTranscribe ?? {}) }, p, note, `user:${viewerId}`, "decider");
    res.status(out.status).json(out.body);
  });

  // ── The terms we offer: a counter-offer, one revision per save ─────────────
  /*
   * WHO MAY EDIT is whoever may adopt: the same `deciding` the adopt door asks, so no new power.
   * A visitor is answered 401 by the reader, a member who holds no seating power 403, the applicant
   * (by account or by address) 403. Each save appends one revision and tells the applicant once:
   * the update's key carries the revision number, and a retried save is refused by its stale
   * `expectedRevision`, so nothing is sent twice.
   */
  app.post(`${BASE}/:id/terms`, async (req, res) => {
    const viewer = await reader(req, res);
    if (!viewer) return;
    const actorId = String(viewer.id);
    if (await limited(res, `open-proposal-terms:${actorId}`)) return;
    const p = await found(req, res);
    if (!p) return;
    if (p.status !== "confirmed") return res.status(409).json({ error: DECIDE_WORDS.decided, status: p.status });
    const may = await deciding(p, actorId);
    if (!may.ok) return res.status(may.status).json(may.body);
    // Ruling 23: the terms are the anchor circle's answer, so they wait for the send too.
    if (await waitsForSend(work, p.id)) return res.status(409).json({ error: "send_first", message: SEND_FIRST });
    // An agent's proposal has no terms to offer: no pay, allowance or commitment (audit B8a).
    if (p.body.agent) return res.status(409).json({ error: "no_terms_for_an_agent", message: DECIDE_WORDS.noTermsForAnAgent });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const out = await saveOffer(getPool(), p.id, {
      edit: { words: body.words && typeof body.words === "object" && !Array.isArray(body.words) ? body.words : undefined, commitmentPct: body.commitmentPct, roles: body.roles },
      expectedRevision: body.expectedRevision,
      by: { id: actorId, name: String(viewer.name ?? "").trim() || "A holder" },
      now: now(),
    });
    if (!out.ok) return res.status(out.status).json({ error: "terms_not_saved", message: out.error, ...(out.key ? { field: out.key } : {}) });
    await tell(p.id, "terms", { part: String(out.revision.n) });
    res.json({ success: true, offer: deciderOffer(out.subject, await baseOf(getPool(), out.subject.roleIds)) });
  });

  // ── The circle answers ────────────────────────────────────────────────────

  app.post(`${BASE}/:id/consent`, async (req, res) => {
    const viewer = await reader(req, res);
    if (!viewer) return;
    const userId = String(viewer.id);
    if (await limited(res, `open-proposal-consent:${userId}`)) return;
    const p = await found(req, res);
    if (!p) return;
    const pool = getPool();
    const standing: AskStanding = p.status === "confirmed" ? "open" : p.status === "withdrawn" ? "withdrawn" : "decided";
    const sessionsOn = (deps.sessionsOn ?? (() => effectiveLifecycle("sessions") !== "off"))();
    const out = await answerAsk({ pool, notify: deps.notify, timeZone: tz(), sessionsOn, now: now() }, p.id, standing, userId, namesOf(await rolesOf(pool, p)), req.body);
    if (!out.ok) return res.status(out.status).json({ error: out.error, ...(out.field ? { field: out.field } : {}) });
    const asks = (await asksFor(pool, [p.id])).get(p.id) ?? [];
    const askRoles = await askRolesFor(pool, asks);
    const answered = consentView(asks, now(), tz(), userId, askRoles);
    res.json({ answer: out.answer, carried: out.carried, carriedWords: out.carriedWords, consent: mayReadObjectionReasons(asks, userId, askRoles, false) ? answered : withoutObjectionReasons(answered) });
  });

  // ── Adopt ─────────────────────────────────────────────────────────────────

  /*
   * "START A CONVERSATION", THEN THE FULL PROPOSAL (the lead, 20 Nov 2026). A decider makes a link for this one person,
   * the same kind of link Admin makes (open_proposal_links, only its hash kept), opening the full application for the
   * role they named. The answer is the only place the link appears: the decider sends it in their reply.
   */
  app.post(`${BASE}/:id/full-proposal-link`, async (req, res) => {
    const viewer = await reader(req, res);
    if (!viewer) return;
    const actorId = String(viewer.id);
    if (await limited(res, `open-proposal-decide:${actorId}`)) return;
    const p = await found(req, res);
    if (!p) return;
    if (p.status !== "confirmed" || p.body.kind !== "conversation") return res.status(409).json({ error: "not_a_conversation" });
    const may = await deciding(p, actorId);
    if (!may.ok) return res.status(may.status).json(may.body);
    const token = crypto.randomBytes(24).toString("base64url");
    const id = `opl-${crypto.randomBytes(8).toString("hex")}`;
    // Labelled so Admin's list of links says who it is for and where it came from.
    const label = `${p.name} (from a conversation)`.slice(0, OPEN_NAME_MAX);
    await store.insertOpenLink(getPool(), { id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), label, createdBy: actorId, now: now() });
    const role = p.body.roles[0]?.roleId;
    res.json({ url: `${site()}/propose-a-role/${encodeURIComponent(token)}${role ? `?role=${encodeURIComponent(role)}` : ""}` });
  });

  app.post(`${BASE}/:id/adopt`, async (req, res) => {
    const viewer = await reader(req, res);
    if (!viewer) return;
    const actorId = String(viewer.id);
    if (await limited(res, `open-proposal-decide:${actorId}`)) return;
    let p = await found(req, res);
    if (!p) return;
    if (p.status !== "confirmed") return res.status(409).json({ error: DECIDE_WORDS.decided, status: p.status });
    const may = await deciding(p, actorId);
    if (!may.ok) return res.status(may.status).json(may.body);
    // The buddy, when the adopter chose one (the lead, 27 Nov 2026): a member holding a role now.
    const buddyAsked = typeof req.body?.buddyUserId === "string" ? req.body.buddyUserId.trim().slice(0, 64) : "";
    if (buddyAsked && (await rolesHeldBy(getPool(), buddyAsked)).length === 0) return res.status(400).json({ error: "buddy", message: "Pick a buddy who holds a role now." });
    // Saved only once the adoption itself is recorded (QA pass 2: a refused adoption still kept the buddy).
    const keepBuddy = async () => {
      if (buddyAsked) await store.setBuddy(getPool(), p!.id, buddyAsked);
    };
    // Kept when our confirmation email failed (server/lib/openProposalKept.ts): an address nobody confirmed places nobody on the account that has it.
    if (p.addressUnconfirmed && may.own && !p.body.agent) return res.status(409).json({ error: "address_unconfirmed", message: OPEN_WORDS.addressUnconfirmedAccount });
    // "Start a conversation" carries no terms (the lead, 20 Nov 2026): nobody is placed on it; the full proposal comes first.
    if (p.body.kind === "conversation") return res.status(409).json({ error: "conversation_first", message: OPEN_WORDS.conversationFirst });
    /*
     * AN AGENT'S PROPOSAL (0374): deciding stays human, and seating an agent is
     * its own power. An agent account never adopts, and the adopter needs
     * `org.seatAgent` on top of the raised-hand rule over `org.seat`, as the
     * admin's agent seating asks both. Checked before anything is written.
     */
    if (p.body.agent) {
      if (await isAgentAccount(getPool(), actorId)) return res.status(403).json({ error: "person_only", message: AGENT_PROPOSAL_WORDS.agentNeverDecides });
      if (!(await guardCapability(req, res, "org.seatAgent"))) return;
    }
    // Role journey L5: nobody who stepped out adopts, and nothing is adopted while a conversation is still to be written up.
    if (await hasRecused({ getPool }, p.id, actorId)) return res.status(403).json({ error: "recused", message: REVIEW_WORDS.recused });
    // Phase A: our review answers first, so nobody is adopted who was never invited.
    if (await reviewWaits({ getPool }, p.id)) return res.status(409).json({ error: "review_first", message: DECIDE_WORDS.review.first });
    if (!(await interviewsAreIn({ getPool }, p.id))) {
      // Name whose conversation is missing, and say when nobody can hold it (audit M10).
      const left = await conversationsLeft(getPool(), p.id);
      const named = left.map((c) => (c.unheld ? DECIDE_WORDS.conversationUnheld(c.role) : DECIDE_WORDS.conversationMissing(c.role))).join(" ");
      return res.status(409).json({ error: "interviews_not_done", message: named || REVIEW_WORDS.interviewsNotDone, conversations: left });
    }
    // Ruling 23: nothing is adopted before the proposal is sent to the anchor circle.
    if (await waitsForSend(work, p.id)) return res.status(409).json({ error: "send_first", message: SEND_FIRST });

    const pool = getPool();
    const at = now();
    // Terms still being talked about: say so before adopting, and adopt on a second, deliberate click (joining lane PR 4).
    // An agent has no terms (audit B8a), so nothing about terms holds its adoption back.
    if (!p.body.agent) {
      const subject = await loadSubject(pool, p.id);
      // The proposal's settings, and each role's countered commitment and price (the lead, 18 Nov 2026).
      const talks = subject ? openTalkLabels(subject) : [];
      if (talks.length && req.body?.confirmOpenTalks !== true) {
        return res.status(409).json({ error: "terms_open", message: OFFER_WORDS.stillTalking(talks), settings: talks });
      }
    }
    // The moon this was proposed for has ended before the decision: the holder may adopt for the moon running now (Rye, role journey 4a).
    let theMoonNow = false;
    let moonNow: ReturnType<typeof currentMoonTerm> | null = null;
    // In the conversation flow the start rule names the moon the role takes (`startPlanOf`), so nothing is asked.
    const inFlow = (await planFor(p, at)).flow;
    if (!inFlow && moonEnded(p.body.term, at, tz())) {
      if (req.body?.forCurrentMoon !== true) {
        return res.status(409).json({ error: "moon_ended", message: DECIDE_WORDS.moonEnded, canAdoptForThisMoon: true });
      }
      moonNow = currentMoonTerm(at, activeClock(), tz());
    }
    // ABOVE THE ROLE'S LIMIT (the lead, 20 Nov 2026): the commitments would go above what the role needs. Refused with
    // the question, and taken only with the explicit flag from somebody who may adopt here, stamped and audited.
    {
      const read = await roomFor(work, moonNow ? { ...p, body: { ...p.body, term: moonNow } } : p, may.own ?? null);
      const over = overLimitRoles(read);
      if (over.length) {
        if (req.body?.confirmOverLimit !== true) return res.status(409).json(overLimitRefusal(over));
        const stamps = [...(p.overLimit ?? []), ...over.map((o) => ({ roleId: o.roleId, by: actorId, at: at.toISOString(), used: o.used, adding: o.adding, target: o.target }))];
        await stampOpenProposal(pool, p.id, "overLimit", stamps);
        await auditOverLimit(pool, p.id, "open_proposal", over, actorId);
        p = { ...p, overLimit: stamps };
      }
    }
    // Every seat taken (audit B3, 11 Nov 2026): refused, unless the holder chose to adopt for when a seat opens.
    // Counted for the term it would start on, before anything is written. A role held to its commitment limit is
    // answered above and never counted here as well.
    const full = (await roomFor(work, moonNow ? { ...p, body: { ...p.body, term: moonNow } } : p, may.own ?? null)).filter((f) => !f.limit);
    const waitsForSeat = full.length > 0;
    if (waitsForSeat && req.body?.whenASeatOpens !== true) {
      return res.status(409).json({ error: "seats_full", message: DECIDE_WORDS.seatsFull(full), seatsFull: full.map((f) => ({ name: f.name, seats: f.seats, taken: f.taken })), canAdoptForWhenASeatOpens: true });
    }
    if (moonNow) {
      if (!(await store.rewriteTerm(pool, p.id, moonNow))) return res.status(409).json({ error: DECIDE_WORDS.raced });
      p = { ...p, body: { ...p.body, term: moonNow } };
      theMoonNow = true;
    }
    const carrying = deps.rolesCarrying(ADOPTING_POWER);
    const seatedIn = deps.loadRoleHolders().find((h) => h.userId === actorId && carrying.some((r) => r.id === h.roleId))?.roleId ?? "badge";
    const asks = (await asksFor(pool, [p.id])).get(p.id) ?? [];
    // The record names a role, never a person: "after the circle consented", or "by the founder's power".
    const decidedBase = decisionFor(consentState(asks, at), at, tz(), carrying.find((r) => r.id === seatedIn)?.name ?? null);
    const decided = `${decidedBase}${theMoonNow ? ", for the moon running now" : ""}${waitsForSeat ? `, ${DECIDE_WORDS.forWhenASeatOpens}` : ""}`;
    const decision = { words: decided, authority: `${ADOPTING_POWER}@${seatedIn}`.slice(0, 64) };
    // A note for the applicant, when the decider wrote one: kept on the proposal, shown on their status page, in the letter.
    const note = cleanNote(req.body?.note);
    const roles = await rolesOf(pool, p);
    const firstName = greetingName(p.name);
    const village = projectName();
    // The Love Letter line only for somebody not aligned yet: an applicant who aligned on the form is not asked again (Rye's answer 8).
    const letterLine = await loveLetterLine(p, may.own ?? null);

    // An agent's proposal: adopted and the agent seated, together, through the one agent seating path.
    if (p.body.agent) {
      const agent = p.body.agent;
      if (!(await isAgentAccount(pool, agent.agentUserId))) return res.status(409).json({ error: "not_an_agent", message: AGENT_PROPOSAL_WORDS.noLongerAnAgent });
      if (!(await store.decideOpenProposal(pool, p.id, "adopted", decision, at, note))) return res.status(409).json({ error: DECIDE_WORDS.raced });
      let seated: Awaited<ReturnType<typeof seatAdoptedAgent>>;
      try {
        seated = await seatAdoptedAgent(pool, { proposal: p, adopterId: actorId, calendar: deps.seatCalendar(), now: at });
      } catch (e) {
        await store.undoAdoption(pool, p.id);
        throw e;
      }
      if (!seated.ok) {
        // Nothing stays seated, so the proposal waits on the village again.
        await store.undoAdoption(pool, p.id);
        return res.status(409).json({ error: seated.error });
      }
      await stampDecided(work, p.id, "adopted");
      await keepBuddy();
      await deps.notify({
        userId: agent.keeperUserId,
        type: "open_role_proposal_decided",
        title: AGENT_PROPOSAL_WORDS.keeperTold(agent.name, namesOf(roles)),
        body: decided,
        link: openProposalHref(p.id),
        actorUserId: actorId,
        dedupeKey: `op:${p.id}:adopted:keeper`,
      });
      return res.json({ success: true, status: "adopted", decided, account: false, agent: true, seated: seated.seated, invitation: null, application: null, message: AGENT_PROPOSAL_WORDS.adoptedSeated(seated.seated) });
    }

    // An address with an account here: the place is made now, and no invitation is needed.
    if (may.own) {
      // Somebody who left the village: welcoming them back is its own act. Nothing is granted, seated or sent.
      if (await isFormerMemberAccount(work, may.own)) return res.status(409).json({ error: "former_member", message: DECIDE_WORDS.formerMember });
      if (!(await store.decideOpenProposal(pool, p.id, "adopted", decision, at, note))) return res.status(409).json({ error: DECIDE_WORDS.raced });
      await stampDecided(work, p.id, "adopted");
      let placed: Awaited<ReturnType<typeof placeOnRoles>>;
      try {
        placed = await placeOnRoles(work, { account: may.own, proposal: p, adopterId: actorId, authority: decision.authority });
      } catch (e) {
        await store.undoAdoption(pool, p.id);
        throw e;
      }
      if (!placed.ok) {
        // Nothing was written for the account, so the proposal waits on the village again.
        await store.undoAdoption(pool, p.id);
        return res.status(409).json({ error: placed.code === "pending" ? DECIDE_WORDS.pending : placed.error, ...(placed.code === "pending" ? { applicationId: placed.applicationId } : {}) });
      }
      await keepBuddy();
      const start = await startOfLetter(p, at);
      const why = await sent(
        p.email
          ? await letter(`open-proposal:${p.id}:adopted`, "open_proposal.adopted", { email: p.email, name: firstName }, adoptedAccountLetter({ firstName, village, roleNames: namesOf(roles), reviewed: await reviewedOf(p.id), ...start.words, signIn: `${site()}/profile`, loveLetter: letterLine, note, waitsForSeat }), { lang: languageOf(p), attachments: start.attachments })
          : null,
      );
      await tell(p.id, "adopted");
      return res.json({
        success: true,
        status: "adopted",
        decided,
        account: true,
        invitation: null,
        application: { id: placed.applicationId, href: applicationHref(placed.applicationId) },
        // One agreement per role when it named several (the lead, 17 Nov 2026).
        ...(placed.applicationIds ? { applications: placed.applicationIds.map((id) => ({ id, href: applicationHref(id) })) } : {}),
        // In the flow, the one day the letter and the seat name; outside it, the words this message always had.
        message: `${waitsForSeat ? DECIDE_WORDS.adoptedAccountWaits : start.plan.flow && start.plan.startIso ? (start.plan.startNow ? DECIDE_WORDS.adoptedAccountNow : DECIDE_WORDS.adoptedAccountOn(dated(start.plan.startIso, "en"))) : p.body.term?.kind === "moon" ? DECIDE_WORDS.adoptedAccountMoon : DECIDE_WORDS.adoptedAccount} ${why === null ? DECIDE_WORDS.accountTold : DECIDE_WORDS.accountNotTold(why)}`,
      });
    }

    // No account that proved the address (server/lib/applicantAccount.ts). One only typed at it is still asked one thing:
    // somebody who left the village is welcomed back by its own act, here as on the account path above.
    const typedAt = await anyAddressAccount(members, p.email);
    if (typedAt && (await isFormerMemberAccount(work, typedAt))) return res.status(409).json({ error: "former_member", message: DECIDE_WORDS.formerMember });
    // No account: the invitation and the decision, one transaction under the holder's row lock.
    const token = mintInviteToken();
    const input = { id: openInviteId(p.id), tokenHash: hashInviteToken(token), inviterUserId: actorId, days: INVITE_DAYS };
    const RACED = "OPEN_PROPOSAL_RACED";
    let held: { ok: boolean };
    try {
      held = await whileSessionHolds(pool, actorId, Number(viewer.tokenVersion ?? 0), async (conn) => {
        if (!(await store.decideOpenProposal(conn, p.id, "adopted", decision, at, note))) throw Object.assign(new Error("decided a moment ago"), { code: RACED });
        try {
          await createInviteOn(conn, input);
        } catch (e: any) {
          if (e?.code !== "ER_DUP_ENTRY") throw e;
          // An invitation by this name from an adoption put back: given a new token, never a second row.
          if (!(await reissueInviteOn(conn, input))) throw Object.assign(new Error("its invitation is still out"), { code: RACED });
        }
      });
    } catch (e: any) {
      if (e?.code === RACED) return res.status(409).json({ error: DECIDE_WORDS.raced });
      throw e;
    }
    if (!held.ok) return res.status(401).json({ error: "auth_required" });
    await stampDecided(work, p.id, "adopted");
    await keepBuddy();

    const link = `${site()}${invitePath(token)}`;
    const inviteStart = await startOfLetter(p, at);
    // Keyed by the link, so a new invitation goes out again, and one link never goes twice.
    const why = await sent(
      p.email
        ? await letter(`open-proposal:${p.id}:adopted:${input.tokenHash.slice(0, 16)}`, "open_proposal.adopted", { email: p.email, name: firstName }, adoptedInviteLetter({ firstName, village, roleNames: namesOf(roles), reviewed: await reviewedOf(p.id), ...inviteStart.words, link, days: INVITE_DAYS, loveLetter: letterLine, note, waitsForSeat }), { lang: languageOf(p), attachments: inviteStart.attachments })
        : null,
    );
    await store.noteInvitationSent(pool, p.id, at, why === null);
    // The link goes to the address and to nobody else (audit, 15 Nov 2026): a link the adopter could open would let
    // them make the applicant's account as if they read the applicant's mail. Handed back only when the email did not
    // go, for the adopter to pass on, and such a link proves no address (`describeFor`, server/lib/openProposalDecide.ts).
    res.json({
      success: true,
      status: "adopted",
      decided,
      account: false,
      invitation: { link: why === null ? null : link, emailed: why === null },
      application: null,
      message: why === null ? DECIDE_WORDS.adoptedEmailed(INVITE_DAYS) : DECIDE_WORDS.adoptedNotEmailed(why),
    });
  });

  // ── Decline ───────────────────────────────────────────────────────────────

  app.post(`${BASE}/:id/decline`, async (req, res) => {
    const viewer = await reader(req, res);
    if (!viewer) return;
    const actorId = String(viewer.id);
    if (await limited(res, `open-proposal-decide:${actorId}`)) return;
    const p = await found(req, res);
    if (!p) return;
    if (p.status !== "confirmed") return res.status(409).json({ error: DECIDE_WORDS.decided, status: p.status });
    const may = await deciding(p, actorId);
    if (!may.ok) return res.status(may.status).json(may.body);
    // While our review waits, its answer is the not-invited letter, never the older no.
    if (await reviewWaits({ getPool }, p.id)) return res.status(409).json({ error: "review_first", message: DECIDE_WORDS.review.first });
    const pool = getPool();
    const at = now();
    const decided = declinedWords(shortDay(at, tz()));
    const note = cleanNote(req.body?.note);
    // decided_at is set here, so the tidy job takes the name and address off after 90 days.
    if (!(await store.decideOpenProposal(pool, p.id, "declined", { words: decided, authority: null }, at, note))) return res.status(409).json({ error: DECIDE_WORDS.raced });
    await stampDecided(work, p.id, "declined");
    if (p.body.agent) {
      // An agent's proposal has no address: its keeper hears it in the bell.
      await deps.notify({
        userId: p.body.agent.keeperUserId,
        type: "open_role_proposal_decided",
        title: AGENT_PROPOSAL_WORDS.keeperDeclined(p.body.agent.name, namesOf(await rolesOf(pool, p))),
        body: decided,
        link: openProposalHref(p.id),
        actorUserId: actorId,
        dedupeKey: `op:${p.id}:declined:keeper`,
      });
      return res.json({ success: true, status: "declined", decided, emailed: false, message: AGENT_PROPOSAL_WORDS.declined });
    }
    const firstName = greetingName(p.name);
    // The kind no's next steps, from the village's own settings (shared/declineNextSteps.ts). The person who pressed decline still sends it.
    const nextSteps = declineNextStepsLines((k) => stringVar(k), { site: site(), on: boolVar(DECLINE_STEPS_KEYS.on), lang: languageOf(p) });
    const why = await sent(
      p.email
        ? await letter(`open-proposal:${p.id}:declined`, "open_proposal.declined", { email: p.email, name: firstName }, declinedLetter({ firstName, statusLink: await statusLinkFor({ siteUrl: site, getPool }, p.id), nextSeason: nextSeasonAfter(civilDateKey(at, tz())), village: projectName(), roleNames: namesOf(await rolesOf(pool, p)), site: site(), lang: languageOf(p), note, doorsInBlock: true, nextSteps }), { lang: languageOf(p), comeAndPlay: true, skip: nextSteps.length ? NEXT_STEP_DOORS : undefined })
        : null,
    );
    await tell(p.id, "declined");
    res.json({ success: true, status: "declined", decided, emailed: why === null, message: why === null ? DECIDE_WORDS.declinedEmailed : DECIDE_WORDS.declinedNotEmailed(why) });
  });

  /**
   * THE LETTER'S LOVE LETTER LINE: the link to the membership door, or nothing
   * for somebody already aligned with the letter, on the form or from their
   * account. The door is served to anybody signed in (shared/brochure.ts,
   * MEMBER_DOORS), so the link never lands on not-found.
   */
  async function loveLetterLine(p: { email: string | null }, account: string | null): Promise<string | null> {
    return (await membershipAlignedFor(getPool(), p.email, account)) ? null : `${site()}/love-letter`;
  }

  // ── A new invitation ──────────────────────────────────────────────────────
  /*
   * For an adopted proposal whose invitation nobody used: lost, run out, or
   * never received (Amora has no mail provider yet, so the decider's copy may
   * be the only one). The old link is withdrawn and the same invitation is
   * given a new token, by a holder of the power, who becomes its maker.
   */
  // ── Our review (Phase A) ──────────────────────────────────────────────────
  /*
   * The same people who adopt and decline answer our review, by the same rule
   * (`deciding`), and nobody who stepped out. ONE answer per application: the
   * review step's unique key decides a race. Each answer sends its own letter,
   * keyed by the proposal, so a retry never sends it twice.
   */
  const reviewWork = {
    getPool,
    notify: deps.notify,
    notifyAdmins: deps.notifyAdmins,
    liveHoldersOf: deps.liveHoldersOf,
    calendar: deps.seatCalendar,
    now,
    members,
    tellApplicant: tell,
  };

  async function reviewer(req: any, res: any): Promise<{ p: store.StoredOpenProposal; actorId: string } | null> {
    const viewer = await reader(req, res);
    if (!viewer) return null;
    const actorId = String(viewer.id);
    if (await limited(res, `open-proposal-decide:${actorId}`)) return null;
    const p = await found(req, res);
    if (!p) return null;
    if (p.status !== "confirmed") {
      res.status(409).json({ error: DECIDE_WORDS.decided, status: p.status });
      return null;
    }
    const may = await deciding(p, actorId);
    if (!may.ok) {
      res.status(may.status).json(may.body);
      return null;
    }
    if (await hasRecused({ getPool }, p.id, actorId)) {
      res.status(403).json({ error: "recused", message: REVIEW_WORDS.recused });
      return null;
    }
    return { p, actorId };
  }

  app.post(`${BASE}/:id/invite`, async (req, res) => {
    const who = await reviewer(req, res);
    if (!who) return;
    const { p, actorId } = who;
    const pool = getPool();
    const out = await inviteToConversations(reviewWork, p.id, actorId);
    if (!out.ok) return res.status(out.status).json({ error: out.code === "done" ? "already_answered" : out.code === "gone" ? "decided" : "no_review", message: out.error });
    const note = cleanNote(req.body?.note);
    const firstName = greetingName(p.name);
    const why = await sent(
      p.email
        ? await letter(`open-proposal:${p.id}:invited`, "open_proposal.invited", { email: p.email, name: firstName }, invitedLetter({
            firstName,
            anchorCircle: await anchorCircleName(pool),
            village: projectName(),
            roleNames: namesOf(await rolesOf(pool, p)),
            // All three calls, the final one too (the lead, 27 Nov 2026), with only the first one's link.
            conversations: (await conversationsToName(pool, p.id)).map((c) => ({ role: c.role, label: c.label, minutes: c.minutes, bookingUrl: c.bookingUrl, bookingLinks: c.bookingLinks, ...(c.final ? { final: true } : {}) })),
            statusLink: await statusLinkFor({ siteUrl: site, getPool: () => pool }, p.id),
            lang: languageOf(p),
            note,
          }), { lang: languageOf(p), links: await firstBookingLinks(p) })
        : null,
    );
    await tell(p.id, "invited");
    res.json({ success: true, stage: "invited", emailed: why === null, message: why === null ? DECIDE_WORDS.review.invitedEmailed : DECIDE_WORDS.review.invitedNotEmailed(why) });
  });

  app.post(`${BASE}/:id/not-invited`, async (req, res) => {
    const who = await reviewer(req, res);
    if (!who) return;
    const { p, actorId } = who;
    const pool = getPool();
    const at = now();
    const out = await answerNotInvited(reviewWork, p.id, actorId);
    if (!out.ok) return res.status(out.status).json({ error: out.code === "done" ? "already_answered" : out.code === "gone" ? "decided" : "no_review", message: out.error });
    const note = cleanNote(req.body?.note);
    const decided = notInvitedWords(shortDay(at, tz()));
    // decided_at is set here, so the tidy job takes the name and address off after 90 days, as for any no.
    if (!(await store.decideOpenProposal(pool, p.id, "declined", { words: decided, authority: null }, at, note))) return res.status(409).json({ error: DECIDE_WORDS.raced });
    await stampDecided(work, p.id, "declined");
    const firstName = greetingName(p.name);
    const why = await sent(
      p.email
        ? await letter(`open-proposal:${p.id}:not-invited`, "open_proposal.not_invited", { email: p.email, name: firstName }, notInvitedLetter({
            firstName,
            village: projectName(),
            roleNames: namesOf(await rolesOf(pool, p)),
            site: site(),
            stayClose: { program: stayCloseProgram(), quests: true, events: effectiveLifecycle("events") === "public" },
            lang: languageOf(p),
            note,
            doorsInBlock: true,
            nextSeason: nextSeasonAfter(civilDateKey(at, tz())),
          }), { lang: languageOf(p), comeAndPlay: true })
        : null,
    );
    await tell(p.id, "not_invited");
    res.json({ success: true, status: "declined", stage: "not_invited", decided, emailed: why === null, message: why === null ? DECIDE_WORDS.review.notInvitedEmailed : DECIDE_WORDS.review.notInvitedNotEmailed(why) });
  });

  app.post(`${BASE}/:id/invitation`, async (req, res) => {
    const viewer = await reader(req, res);
    if (!viewer) return;
    const actorId = String(viewer.id);
    if (await limited(res, `open-proposal-decide:${actorId}`)) return;
    const p = await found(req, res);
    if (!p) return;
    const letterLine = await loveLetterLine(p, null);
    const rule = await decideRule(work);
    if (rule.who !== "live-holders" || !rule.holders.includes(actorId)) {
      return res.status(403).json({ error: "not_a_holder", message: rule.who === "live-holders" ? DECIDE_WORDS.notAHolder : DECIDE_WORDS.door[rule.because] });
    }
    const pool = getPool();
    const inv = p.status === "adopted" ? await inviteById(pool, openInviteId(p.id)) : null;
    if (!inv || inv.usedByUserId) return res.status(409).json({ error: DECIDE_WORDS.noInvitation });
    // Still open: withdrawn first. A link used a moment ago is read back as used.
    if (!inv.revokedAt && !inv.expired && !(await revokeInvite(pool, inv.id, inv.inviterUserId))) return res.status(409).json({ error: DECIDE_WORDS.noInvitation });
    const token = mintInviteToken();
    const input = { id: inv.id, tokenHash: hashInviteToken(token), inviterUserId: actorId, days: INVITE_DAYS };
    const held = await whileSessionHolds(pool, actorId, Number(viewer.tokenVersion ?? 0), (conn) => reissueInviteOn(conn, input));
    if (!held.ok) return res.status(401).json({ error: "auth_required" });
    if (!held.value) return res.status(409).json({ error: DECIDE_WORDS.noInvitation });
    const link = `${site()}${invitePath(token)}`;
    const firstName = greetingName(p.name);
    const resendStart = await startOfLetter(p, p.decidedAt ?? now());
    const why = await sent(
      p.email
        ? await letter(`open-proposal:${p.id}:adopted:${input.tokenHash.slice(0, 16)}`, "open_proposal.adopted", { email: p.email, name: firstName }, adoptedInviteLetter({ firstName, village: projectName(), roleNames: namesOf(await rolesOf(pool, p)), reviewed: await reviewedOf(p.id), ...resendStart.words, link, days: INVITE_DAYS, loveLetter: letterLine, note: p.body.note ?? null, waitsForSeat: (await roomFor(work, p, null)).length > 0 }), { lang: languageOf(p), attachments: resendStart.attachments })
        : null,
    );
    await store.noteInvitationSent(pool, p.id, now(), why === null);
    res.json({
      success: true,
      // Only when the email did not go: the same rule as the adoption above.
      link: why === null ? null : link,
      emailed: why === null,
      message: `${DECIDE_WORDS.reissued(INVITE_DAYS)} ${why === null ? DECIDE_WORDS.reissuedEmailed : DECIDE_WORDS.reissuedNotEmailed(why)}`,
    });
  });
}
