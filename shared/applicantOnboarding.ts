/**
 * TAKING AN APPLICANT FROM "PROPOSAL RECEIVED" TO A DECISION: the pure half of
 * the stages the review pipeline did not have yet (shortlist, references,
 * follow-up owners, the gathered view for the final call), and the one stage
 * track the admin walkthrough draws.
 *
 * It builds on shared/applicationReview.ts and adds no parallel pipeline:
 *
 *   - the SHORTLIST is one more `application_steps` row, kind `shortlist`, its
 *     answer in the detail ("yes" or "no"). The table's unique key admits one
 *     answer per application, so two answers pressed at once cannot both win.
 *   - the REQUEST for references and their ARRIVAL are steps too
 *     (`refs_asked`, `refs_given`).
 *   - the references themselves live in `application_references` (0412):
 *     third-party personal data, read only through `mayReadReference`.
 *   - REFERENCES ARE ASKED of an open proposal once shortlisted, and of a
 *     member's own application (`sa-` refs) when the member holds no live role
 *     seat, so it is their first long-term role (the lead, 19 Nov 2026:
 *     "someone could be a member for a minor contribution in another way and
 *     would still want references for holding a long-term role"). A member who
 *     already holds a role is not asked (`asksReferences`). A member application
 *     has no shortlist or conversations here, so its track is shorter
 *     (`memberTrackOf`), and the member gives the references on their own
 *     application's page.
 *   - the FINAL INTERVIEW is a conversation in the existing model
 *     (`application_interviews`, `is_final` = 1) held by the role that makes
 *     the final call. The DECISION is the existing adopt or decline.
 *
 * ── NO AI SELECTS, RANKS, SCORES OR JUDGES ──────────────────────────────────
 *
 * Nothing here orders applicants by anything but the stage they are on and the
 * day they arrived. Nothing counts a gut check or a follow-up note. No model
 * reads these tables: `SELECTION_IS_HUMAN` names them and the refusal test
 * (server/lib/applicationReview.refusal.test.ts) holds every model-facing
 * source to it.
 *
 * ── ROLES, NEVER PEOPLE ─────────────────────────────────────────────────────
 *
 * Who follows up with a reference defaults to a ROLE the village names
 * (`org.reference_followup_role`), resolved through the people holding it
 * now. The role that makes the final call is a setting too
 * (`org.final_call_role`). Neither names a person in code.
 */
import { APPLY_COUNTS, APPLY_TEXT } from "./applyLimits";

// ── The settings ────────────────────────────────────────────────────────────

/** The role every reference is first given to for follow-up: the village's human relations and operations role. */
export const FOLLOWUP_ROLE_VARIABLE = "org.reference_followup_role";
/** The role that holds the final conversation and makes the final call. */
export const FINAL_CALL_ROLE_VARIABLE = "org.final_call_role";

// ── The shortlist ───────────────────────────────────────────────────────────

export const SHORTLIST_ANSWERS = ["yes", "no"] as const;
export type ShortlistAnswer = (typeof SHORTLIST_ANSWERS)[number];

export function parseShortlistAnswer(raw: unknown): ShortlistAnswer | null {
  return raw === "yes" || raw === "no" ? raw : null;
}

/** The shortlist's answer from the stored steps, or null when nobody has answered. */
export function shortlistOf(steps: ReadonlyArray<{ kind: string; detail?: unknown }>): ShortlistAnswer | null {
  const d = steps.find((s) => s.kind === "shortlist")?.detail as { answer?: unknown } | null | undefined;
  return parseShortlistAnswer(d?.answer);
}

// ── The references ──────────────────────────────────────────────────────────

export const ONBOARDING_REFERENCES_MAX = APPLY_COUNTS.statusReferences;
/** The fewest references the applicant gives here (the lead, 19 Nov 2026: "at least 2, we prefer 3"). */
export const ONBOARDING_REFERENCES_MIN = APPLY_COUNTS.referencesMin;
export const REF_NAME_MAX = APPLY_TEXT.statusRefName;
export const REF_CONTACT_MAX = APPLY_TEXT.statusRefContact;
export const REF_HOW_MAX = APPLY_TEXT.statusRefHow;
export const REF_ALLY_MAX = APPLY_TEXT.statusRefAlly;
export const FOLLOWUP_NOTE_MAX = 2000;

/** One reference as the applicant gives it. */
export interface GivenReference {
  name: string;
  /**
   * How to reach them, as the team reads it: their email, then each number given, one per line ("Email: ...",
   * "WhatsApp: ...", "US phone: ...", "Signal: ..."), built by `contactLines`. Stored in the one contact column.
   */
  contact: string;
  /** How they know the applicant. */
  how: string;
  /** Why they might be an ally or partner of the village. Optional. */
  ally: string;
}

const EMAIL = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/;
const PHONE = /^\+?[0-9][0-9 ().-]{4,28}[0-9]$/;

/** Whether a contact is an email address or a phone number. */
export function reachable(contact: string): boolean {
  const c = contact.trim();
  if (EMAIL.test(c)) return true;
  return PHONE.test(c) && c.replace(/\D/g, "").length >= 6;
}

/**
 * HOW WE REACH A REFERENCE (the lead, 27 Nov 2026: "we need 1 of either whatsapp, US phones, or signal numbers to
 * reach out to references as well as email"). Every reference needs an email AND at least one of these three.
 */
export const REFERENCE_CHANNELS = ["whatsapp", "usPhone", "signal"] as const;
export type ReferenceChannel = (typeof REFERENCE_CHANNELS)[number];

/** A valid email address. */
export const isReferenceEmail = (v: string): boolean => EMAIL.test(v.trim());
/** An international phone number, as WhatsApp takes it: 8 to 15 digits, an optional leading +. */
export const isWhatsApp = (v: string): boolean => PHONE.test(v.trim()) && ((d) => d.length >= 8 && d.length <= 15)(v.replace(/\D/g, ""));
/** A US phone number: ten digits, with or without a leading +1 or 1. */
export const isUsPhone = (v: string): boolean => /^[0-9 ().+-]+$/.test(v.trim()) && /^1?[2-9][0-9]{2}[2-9][0-9]{6}$/.test(v.replace(/\D/g, ""));
/** A Signal number (a phone number) or a Signal username (name.01). */
export const isSignal = (v: string): boolean => isWhatsApp(v) || /^@?[a-z][a-z0-9_]{2,31}\.[0-9]{2,10}$/i.test(v.trim());

const CHANNEL_OK: Record<ReferenceChannel, (v: string) => boolean> = { whatsapp: isWhatsApp, usPhone: isUsPhone, signal: isSignal };
/** The label each way of reaching them carries in the stored contact, in the team's language. */
export const CHANNEL_LABELS: Record<"email" | ReferenceChannel, string> = { email: "Email", whatsapp: "WhatsApp", usPhone: "US phone", signal: "Signal" };

/** The stored contact: one labelled line each, the email first. */
export function contactLines(c: { email: string } & Partial<Record<ReferenceChannel, string>>): string {
  return [`${CHANNEL_LABELS.email}: ${c.email}`, ...REFERENCE_CHANNELS.filter((k) => c[k]).map((k) => `${CHANNEL_LABELS[k]}: ${c[k]}`)].join("\n");
}

const clean = (v: unknown): string => String(typeof v === "string" ? v : "").replace(/\s+/g, " ").trim();

/** The reasons a list is refused, in the applicant's language (shared/applicantWords.ts `status.referenceForm.errors`). */
export type ReferenceError = "none" | "too_few" | "too_many" | "needs_all" | "email" | "channel" | "contact" | "twice" | "too_long";

export type ReferenceParse = { ok: true; value: GivenReference[] } | { ok: false; error: ReferenceError; row: number | null };

/**
 * The list as the form sent it. A wholly blank row is dropped; a row with some of it needs a name, how they know the
 * applicant, their email AND at least one of a WhatsApp number, a US phone number or a Signal number (the lead,
 * 27 Nov 2026). The first problem is answered, with the row it is on. An older form that sends one `contact` reads it
 * as the email when it is one, so it still meets the same rule.
 */
export function parseReferenceList(raw: unknown): ReferenceParse {
  const rows = Array.isArray(raw) ? raw : [];
  const out: GivenReference[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Record<string, unknown> | null;
    const name = clean(r?.name);
    const legacy = clean(r?.contact);
    const email = clean(r?.email) || (isReferenceEmail(legacy) ? legacy : "");
    const channels = { whatsapp: clean(r?.whatsapp), usPhone: clean(r?.usPhone), signal: clean(r?.signal) };
    const how = clean(r?.how);
    const ally = clean(r?.ally);
    if (!name && !email && !legacy && !channels.whatsapp && !channels.usPhone && !channels.signal && !how && !ally) continue;
    const contact = contactLines({ email, ...channels });
    if (name.length > REF_NAME_MAX || contact.length > REF_CONTACT_MAX || how.length > REF_HOW_MAX || ally.length > REF_ALLY_MAX) return { ok: false, error: "too_long", row: i };
    if (!name || !how) return { ok: false, error: "needs_all", row: i };
    if (!email || !isReferenceEmail(email)) return { ok: false, error: "email", row: i };
    const given = REFERENCE_CHANNELS.filter((k) => channels[k]);
    if (!given.length) return { ok: false, error: "channel", row: i };
    if (given.some((k) => !CHANNEL_OK[k](channels[k]))) return { ok: false, error: "contact", row: i };
    const key = email.toLowerCase();
    if (seen.has(key)) return { ok: false, error: "twice", row: i };
    seen.add(key);
    out.push({ name, contact, how, ally });
    if (out.length > ONBOARDING_REFERENCES_MAX) return { ok: false, error: "too_many", row: i };
  }
  if (out.length === 0) return { ok: false, error: "none", row: null };
  if (out.length < ONBOARDING_REFERENCES_MIN) return { ok: false, error: "too_few", row: null };
  return { ok: true, value: out };
}

// ── Whose application asks for references ───────────────────────────────────

/**
 * WHETHER AN APPLICATION ASKS FOR REFERENCES (the lead, 19 Nov 2026). An open proposal always may (once shortlisted).
 * A member's own application only for a first long-term role: the member holds no live role seat now.
 */
export function asksReferences(kind: "open" | "member", liveRoleSeats: number): boolean {
  return kind === "open" || liveRoleSeats <= 0;
}

// ── Who reads a reference ───────────────────────────────────────────────────

export interface ReferenceReader {
  /** The reader is the applicant. Never reads the details back. */
  isApplicant: boolean;
  /** The reader stepped out of this application. */
  recused: boolean;
  /** The reader decides this application: a live holder of the power to place people in roles, or a circle holder asked to consent. */
  isReviewer: boolean;
  /** The reader holds the role that makes the final call. */
  isFinalCall: boolean;
  /** The reader is this reference's follow-up owner: the member named, or a holder of the role named when no member is. */
  isOwner: boolean;
}

/**
 * A REFERENCE'S CONTACT DETAILS are personal data of somebody who never signed
 * up. Read by the people who review the application, the role that makes the
 * final call, and the reference's own follow-up owner. Never the applicant,
 * never anyone who stepped out, never another member, never an AI.
 */
export function mayReadReference(f: ReferenceReader): boolean {
  if (f.isApplicant || f.recused) return false;
  return f.isReviewer || f.isFinalCall || f.isOwner;
}

/** Who may pick the follow-up owners: the reviewers and the role that makes the final call. */
export function mayAssignOwners(f: Pick<ReferenceReader, "isApplicant" | "recused" | "isReviewer" | "isFinalCall">): boolean {
  if (f.isApplicant || f.recused) return false;
  return f.isReviewer || f.isFinalCall;
}

// ── The stage track ─────────────────────────────────────────────────────────

/**
 * THE SIX STAGES, IN THE LEAD'S ORDER (27 Nov 2026): "Received: Our review (where I can review and then move to
 * shortlist, when I do they can book a meeting with me ... if it passes me we move to references and them refining
 * their proposal while they're doing their next conversation with community role ... they move to their final
 * conversation ... we'll either counter their proposal or accept it outright we'll counter until we find agreement
 * then they start."
 *
 * Folded from the seven stages before it: "Shortlist" is now part of Our review (shortlisting opens the first
 * conversation), and "Follow-ups and intuition conversations" is part of References and proposal. The stage is
 * DERIVED on every read from the steps and conversations the application already has, so an application in flight
 * keeps its place with no data change: shortlisted and in its first conversation reads Our review; references asked,
 * given or followed up, or a later conversation, reads References and proposal; the final conversation reads Final
 * conversation; a final conversation written up and no decision yet reads Agreement; adopted reads Start.
 */
export const TRACK = ["received", "review", "references", "final_interview", "agreement", "start"] as const;
export type TrackStage = (typeof TRACK)[number];
export type TrackState = "done" | "now" | "later" | "skipped";

export const TRACK_WORDS: Record<TrackStage, string> = {
  received: "Received",
  review: "Our review",
  references: "References and proposal",
  final_interview: "Final conversation",
  agreement: "Agreement",
  start: "Start",
};

/** The one obvious act at a stage. `none` when the stage waits on somebody outside the team, or nothing is left. */
export const PRIMARY_ACTIONS = ["review", "shortlist", "conversation", "ask_references", "wait_applicant", "follow_up", "add_final", "final_conversation", "decide", "none"] as const;
export type PrimaryAction = (typeof PRIMARY_ACTIONS)[number];

export interface TrackFacts {
  decided: "adopted" | "declined" | "withdrawn" | null;
  /** Our review, when the village reviews first (shared/applicationReview.ts `reviewStageOf`). Null on the older path. */
  reviewStage: "review" | "invited" | "not_invited" | null;
  firstReplied: boolean;
  shortlist: ShortlistAnswer | null;
  refsAsked: boolean;
  refsGiven: boolean;
  /** Each reference's follow-up: written up or still open. */
  references: ReadonlyArray<{ followedUp: boolean }>;
  /** The application's conversations, in order, with the final one marked, and the role holding each when known. */
  interviews: ReadonlyArray<{ state: string; final: boolean; role?: string | null }>;
}

export interface TrackRoles {
  /** The role that sends first replies (`org.onboarding_role`), by name, or null. */
  welcome: string | null;
  /** The role every reference defaults to, by name, or null. */
  followup: string | null;
  /** The role that makes the final call, by name, or null. */
  finalCall: string | null;
}

export interface Track {
  stages: Array<{ key: TrackStage; label: string; state: TrackState }>;
  now: TrackStage;
  /** Who acts next, said as a role. Never a person, never a score. */
  who: string;
  /** What happens next, one line. */
  next: string;
  primary: PrimaryAction;
}

const done = (s: string) => s === "scored" || s === "skipped";

/** The power that places people in roles, said the same way everywhere it stands for a role nobody named. */
export const PLACING_POWER_WORDS = "the holders of the power to place people in roles";

/** Where each stage stands, from the facts. Shared by the team's track and the applicant's own page. PURE. */
export function trackStates(f: TrackFacts): { state: Record<TrackStage, TrackState>; now: TrackStage } {
  const talks = f.interviews.filter((i) => !i.final);
  const finals = f.interviews.filter((i) => i.final);
  const firstTalkDone = talks.length === 0 || done(talks[0].state);
  const talksDone = talks.every((i) => done(i.state));
  const followedUp = f.refsGiven && f.references.every((r) => r.followedUp);
  const finalDone = finals.length > 0 && finals.every((i) => done(i.state));
  const no = f.shortlist === "no" || f.reviewStage === "not_invited";
  const yes = f.shortlist === "yes";
  // Our review ends when the first conversation is written up, or sooner when the team has already asked for references.
  const reviewDone = yes && (firstTalkDone || f.refsAsked);
  // THE FINAL CONVERSATION OPENS ONLY BY A PERSON'S ACT (the lead, 27 Nov 2026: "once they have their proposal solid
  // and they passed this step they move to their final conversation"). References and proposal ends when somebody
  // moves the application on, which opens the final conversation; nothing opens it by itself.
  const movedToFinal = finals.some((i) => i.state !== "waiting");
  /** Everything References and proposal asks is in: the moment to move on, never a move by itself. */
  const readyForFinal = reviewDone && talksDone && followedUp;

  const state: Record<TrackStage, TrackState> = {
    received: "done",
    review: reviewDone || movedToFinal ? "done" : "now",
    references: no ? "skipped" : movedToFinal ? "done" : reviewDone ? "now" : "later",
    final_interview: no ? "skipped" : finalDone ? "done" : movedToFinal ? "now" : "later",
    agreement: no ? "skipped" : f.decided === "adopted" ? "done" : finalDone ? "now" : "later",
    start: f.decided === "adopted" ? "done" : "later",
  };
  if (f.decided) {
    // Once decided, a stage that never happened reads as skipped. Adopted: they start. Declined or withdrawn: the
    // stage it ended at reads done, and Start never happened.
    const endedAt = TRACK.find((k) => state[k] === "now") ?? "agreement";
    for (const k of TRACK) if (state[k] === "now" || state[k] === "later") state[k] = "skipped";
    if (f.decided === "adopted") {
      state.agreement = "done";
      state.start = "done";
      return { state, now: "start" };
    }
    state[endedAt] = "done";
    return { state, now: endedAt };
  }
  return { state, now: TRACK.find((k) => state[k] === "now") ?? "agreement" };
}

/** Everything References and proposal asks is in, and the final conversation has not opened. */
export function readyForFinalOf(f: TrackFacts): boolean {
  const talks = f.interviews.filter((i) => !i.final);
  const followedUp = f.refsGiven && f.references.every((r) => r.followedUp);
  return f.shortlist === "yes" && talks.every((i) => done(i.state)) && followedUp && !f.interviews.some((i) => i.final && i.state !== "waiting");
}

/**
 * WHERE ONE APPLICATION STANDS, as a track of six stages, with who acts next and the one act that moves it. The
 * reference follow-ups, the applicant's refining of their proposal and the community conversation run side by side in
 * one stage: none waits for the others.
 */
export function trackOf(f: TrackFacts, roles: TrackRoles): Track {
  const deciders = roles.finalCall ?? PLACING_POWER_WORDS;
  const { state, now } = trackStates(f);
  const stages = TRACK.map((key) => ({ key, label: TRACK_WORDS[key], state: state[key] }));
  const talks = f.interviews.filter((i) => !i.final);
  const finals = f.interviews.filter((i) => i.final);
  const no = f.shortlist === "no" || f.reviewStage === "not_invited";

  if (f.decided) return { stages, now, who: "Nobody. The decision is made.", next: "Nothing is left to do here.", primary: "none" };
  switch (now) {
    case "review":
      if (no) return { stages, now, who: deciders, next: "Not shortlisted. Send the decline with its letter, or reopen by talking it through with the team.", primary: "decide" };
      if (f.reviewStage === "review")
        return { stages, now, who: PLACING_POWER_WORDS, next: "Read the application, then invite the applicant to the conversations or send the not-invited letter.", primary: "review" };
      if (f.reviewStage === null && !f.firstReplied) return { stages, now, who: roles.welcome ?? PLACING_POWER_WORDS, next: "Send the applicant a first reply.", primary: "review" };
      if (f.shortlist === null) return { stages, now, who: PLACING_POWER_WORDS, next: "Shortlist this application, or say it is not shortlisted. Shortlisting opens the first conversation to book.", primary: "shortlist" };
      return {
        stages,
        now,
        who: talks[0]?.role ? `${talks[0].role}` : PLACING_POWER_WORDS,
        next: "The applicant books the first conversation. Hold it, then write the notes and the scorecard.",
        primary: "conversation",
      };
    case "references":
      if (readyForFinalOf(f))
        return { stages, now, who: deciders, next: "The references are followed up and the conversations written up. When the proposal is solid, move the application to the final conversation. That fixes the proposal.", primary: "add_final" };
      if (!f.refsAsked) return { stages, now, who: PLACING_POWER_WORDS, next: "Ask the applicant for references. The letter goes in their language. They refine their proposal and book the next conversation meanwhile.", primary: "ask_references" };
      if (!f.refsGiven) return { stages, now, who: "The applicant", next: "The applicant adds their references, refines their proposal and books the next conversation, from their status page.", primary: "wait_applicant" };
      return {
        stages,
        now,
        who: `${roles.followup ? `${roles.followup} and the other follow-up owners` : "The follow-up owners"}, and the conversation roles`,
        next: "Each owner follows up with their reference and writes notes. The next conversation goes on alongside.",
        primary: "follow_up",
      };
    case "final_interview":
      return { stages, now, who: deciders, next: "Hold the final conversation, where the applicant delivers their proposal, then write the notes and the scorecard.", primary: "final_conversation" };
    case "agreement":
    default:
      return {
        stages,
        now: "agreement",
        who: deciders,
        next: "Accept the proposal as it is, or counter it. Counter until both sides agree, then adopt with the existing doors.",
        primary: "decide",
      };
  }
}

export interface MemberTrackFacts {
  decided: "adopted" | "declined" | "withdrawn" | null;
  refsAsked: boolean;
  refsGiven: boolean;
  references: ReadonlyArray<{ followedUp: boolean }>;
}

/** The stages a member's first-role application walks here: no review or conversations, which its own page holds. */
export const MEMBER_TRACK: readonly TrackStage[] = ["received", "references", "agreement", "start"];

/**
 * WHERE A MEMBER'S FIRST-ROLE APPLICATION STANDS on its references: asked, given, followed up, then the agreement on
 * the application's own page. Who acts is said as a role, never a person, never a score.
 */
export function memberTrackOf(f: MemberTrackFacts): Track {
  const followedUp = f.refsGiven && f.references.every((r) => r.followedUp);
  const state: Record<TrackStage, TrackState> = {
    received: "done",
    review: "skipped",
    references: followedUp ? "done" : "now",
    final_interview: "skipped",
    agreement: f.decided === "adopted" ? "done" : followedUp ? "now" : "later",
    start: f.decided === "adopted" ? "done" : "later",
  };
  if (f.decided) {
    for (const k of MEMBER_TRACK) if (state[k] === "now" || state[k] === "later") state[k] = "skipped";
    if (f.decided === "adopted") state.agreement = state.start = "done";
    else state.agreement = "done";
  }
  const stages = MEMBER_TRACK.map((key) => ({ key, label: TRACK_WORDS[key], state: state[key] }));
  if (f.decided) return { stages, now: f.decided === "adopted" ? "start" : "agreement", who: "Nobody. The decision is made.", next: "Nothing is left to do here.", primary: "none" };
  if (!f.refsGiven) {
    return f.refsAsked
      ? { stages, now: "references", who: "The applicant", next: "The member adds their references on their application's page.", primary: "wait_applicant" }
      : { stages, now: "references", who: PLACING_POWER_WORDS, next: "Ask the member for references. This is their first long-term role.", primary: "ask_references" };
  }
  if (!followedUp) return { stages, now: "references", who: "The follow-up owners", next: "Each owner follows up with their reference and writes notes.", primary: "follow_up" };
  return { stages, now: "agreement", who: "The people who adopt this application", next: "Read the follow-up notes, then adopt or decline on this page.", primary: "decide" };
}

/** The order of the admin list: by stage, then by the day the application arrived. Never by anything about the person. */
export function byStageThenDate<T extends { stage: TrackStage; confirmedAt: string | null }>(rows: readonly T[]): T[] {
  const at = (r: T) => (r.confirmedAt ? Date.parse(r.confirmedAt) : 0) || 0;
  return [...rows].sort((a, b) => TRACK.indexOf(a.stage) - TRACK.indexOf(b.stage) || at(a) - at(b));
}

// ── Words the admin side draws ──────────────────────────────────────────────

export const ONBOARDING_WORDS = {
  heading: "Where this application stands",
  intro: "One stage at a time. People decide every step: nothing here ranks, scores or judges the applicant.",
  whoActs: "Who acts next",
  whatNext: "What happens next",
  stateWords: { done: "Done", now: "Now", later: "Later", skipped: "Skipped" } as Record<TrackState, string>,
  primary: {
    review: "Go to our review",
    shortlist: "Shortlist",
    conversation: "Go to the conversation",
    ask_references: "Ask for references",
    wait_applicant: "Waiting on the applicant",
    follow_up: "Go to the follow-ups",
    add_final: "Move to the final conversation",
    final_conversation: "Go to the final conversation",
    decide: "Go to the decision",
    none: "Nothing to do",
  } as Record<PrimaryAction, string>,
  notShortlist: "Not shortlisted",
  shortlisted: "Shortlisted.",
  notShortlisted: "Not shortlisted. The decision stays with the people who decide: decline with its letter when you are ready.",
  shortlistDone: "This application already has a shortlist answer.",
  shortlistWaitsReview: "Our review comes first: invite the applicant to the conversations before the shortlist.",
  referencesHeading: "References and follow-ups",
  referencesKicker: "Who vouches for them",
  referencesShort: "Private to the team, and deleted with the application.",
  whoReads: "Who reads these",
  referencesPrivate: "Personal details of people who never signed up. Only the people who review this application, the role that makes the final call and each reference's owner read them. No AI reads them. They are deleted with the application.",
  referencesAsked: "References were asked for. The applicant adds them from their status page.",
  referencesAskedNow: "Asked. The letter went to the applicant in their language.",
  referencesAskedAlready: "References were already asked for.",
  referencesNeedShortlist: "Shortlist the application before asking for references.",
  referencesFirstRoleOnly: "References are asked of a member only for their first long-term role, and this member already holds a role.",
  referencesNone: "No references yet.",
  owner: "Follows up",
  ownerDefault: (role: string) => `${role} (the default)`,
  ownerNobody: "Nobody yet",
  ownerPick: "Pick who follows up",
  ownerRole: "A role",
  ownerMember: "A member",
  ownerSaved: "Saved. They have been told.",
  ownerGive: "Give it to them",
  notes: "Follow-up notes",
  notesSave: "Save my notes",
  notesSaved: "Saved.",
  followedUp: "Followed up",
  notFollowedUp: "Not followed up yet",
  notYours: "Only this reference's follow-up owner writes its notes.",
  claimTaken: "Somebody else is following this one up.",
  claim: "I'll follow up",
  claimed: "It's yours. Add your notes and mark it done.",
  referencesPage: "Open the references page",
  howKnown: "How they know the applicant",
  ally: "Why they might be an ally or partner",
  contact: "How to reach them",
  gatheredHeading: "Gathered for the final call",
  gatheredKicker: "Before the final conversation",
  gatheredShort: (role: string) => `Everything ${role} reads, as written.`,
  gatheredMore: "What this holds",
  decideBelow: "Adopt or decline below.",
  gatheredIntro: (role: string) => `Everything ${role} reads before the final conversation and the decision: each reference's follow-up notes and each conversation's scorecard. Nothing is totalled or ranked.`,
  gatheredHidden: "This view is for the role that makes the final call and the people who decide.",
  scorecardsHidden: "Scorecards open to you once you have added your own.",
  finalAdded: "The final conversation is open. The applicant books it now, and can keep refining their proposal until the final conversation is written up.",
  finalExists: "The final conversation is already open or done.",
  finalTalksFirst: "Write up the conversations before it first. Then move the application to the final conversation.",
  finalAtReferences: "The final conversation comes once References and proposal is done: the application shortlisted, its conversations written up, and each reference given and followed up.",
  finalNoRole: "No role is named for the final call. A founder names it in the village's settings.",
  notAllowed: "This is for the people who review this application.",
  notFound: "That application is not here.",
  decided: "This application has been decided.",
  listHeading: "Applications by stage",
  listIntro: "Every open application, by stage and then by the day it arrived. Nothing here is ranked.",
  listEmpty: "No application is waiting.",
  arrivedOn: (day: string) => `Arrived ${day}`,
} as const;

/** The notices this stage sends. Bell only; none carries a name, a contact or a note. */
export const ONBOARDING_NOTICES = {
  referencesIn: (roles: readonly string[]) => `References arrived for an application for ${roles.join(", ") || "a role"}. Pick who follows up with each.`,
  ownerTitle: (roles: readonly string[]) => `You follow up with a reference for an application for ${roles.join(", ") || "a role"}`,
  ownerBody: "Open the application to read how to reach them, then write your follow-up notes on the reference.",
  /** To the member, on their own application for a first long-term role. No name or contact rides on it. */
  memberAskedTitle: (roles: readonly string[]) => `References are asked for your application for ${roles.join(", ") || "a role"}`,
  memberAskedBody: "This is your first long-term role with us. Add the people who know your work on your application's page.",
} as const;
