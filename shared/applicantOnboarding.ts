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

export const ONBOARDING_REFERENCES_MAX = 5;
export const ONBOARDING_REFERENCES_MIN = 1;
export const REF_NAME_MAX = 80;
export const REF_CONTACT_MAX = 120;
export const REF_HOW_MAX = 300;
export const REF_ALLY_MAX = 400;
export const FOLLOWUP_NOTE_MAX = 2000;

/** One reference as the applicant gives it. */
export interface GivenReference {
  name: string;
  /** An email address or a phone number. */
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

const clean = (v: unknown): string => String(typeof v === "string" ? v : "").replace(/\s+/g, " ").trim();

/** The reasons a list is refused, in the applicant's language (shared/applicantWords.ts `status.referenceForm.errors`). */
export type ReferenceError = "none" | "too_many" | "needs_all" | "contact" | "twice" | "too_long";

export type ReferenceParse = { ok: true; value: GivenReference[] } | { ok: false; error: ReferenceError; row: number | null };

/**
 * The list as the form sent it. A wholly blank row is dropped; a row with some
 * of it needs a name, a way to reach them and how they know the applicant.
 * The first problem is answered, with the row it is on.
 */
export function parseReferenceList(raw: unknown): ReferenceParse {
  const rows = Array.isArray(raw) ? raw : [];
  const out: GivenReference[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Record<string, unknown> | null;
    const name = clean(r?.name);
    const contact = clean(r?.contact);
    const how = clean(r?.how);
    const ally = clean(r?.ally);
    if (!name && !contact && !how && !ally) continue;
    if (name.length > REF_NAME_MAX || contact.length > REF_CONTACT_MAX || how.length > REF_HOW_MAX || ally.length > REF_ALLY_MAX) return { ok: false, error: "too_long", row: i };
    if (!name || !contact || !how) return { ok: false, error: "needs_all", row: i };
    if (!reachable(contact)) return { ok: false, error: "contact", row: i };
    const key = contact.toLowerCase().replace(/[^a-z0-9@+.]/g, "");
    if (seen.has(key)) return { ok: false, error: "twice", row: i };
    seen.add(key);
    out.push({ name, contact, how, ally });
    if (out.length > ONBOARDING_REFERENCES_MAX) return { ok: false, error: "too_many", row: i };
  }
  if (out.length < ONBOARDING_REFERENCES_MIN) return { ok: false, error: "none", row: null };
  return { ok: true, value: out };
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

export const TRACK = ["received", "review", "shortlist", "references", "followups", "final_interview", "decision"] as const;
export type TrackStage = (typeof TRACK)[number];
export type TrackState = "done" | "now" | "later" | "skipped";

export const TRACK_WORDS: Record<TrackStage, string> = {
  received: "Received",
  review: "Our review",
  shortlist: "Shortlist",
  references: "References",
  followups: "Follow-ups and intuition conversations",
  final_interview: "Final conversation",
  decision: "Decision",
};

/** The one obvious act at a stage. `none` when the stage waits on somebody outside the team, or nothing is left. */
export const PRIMARY_ACTIONS = ["review", "shortlist", "ask_references", "wait_applicant", "follow_up", "add_final", "final_conversation", "decide", "none"] as const;
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
  /** The application's conversations, in order, with the final one marked. */
  interviews: ReadonlyArray<{ state: string; final: boolean }>;
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

/**
 * WHERE ONE APPLICATION STANDS, as a track of seven stages, with who acts next
 * and the one act that moves it. The intuition conversations and the reference
 * follow-ups run side by side in one stage: neither waits for the other.
 */
export function trackOf(f: TrackFacts, roles: TrackRoles): Track {
  const deciders = roles.finalCall ?? PLACING_POWER_WORDS;
  const reviewDone = f.reviewStage === "invited" || f.reviewStage === "not_invited" || (f.reviewStage === null && f.firstReplied) || f.shortlist !== null || f.decided !== null;
  const talks = f.interviews.filter((i) => !i.final);
  const finals = f.interviews.filter((i) => i.final);
  const talksDone = talks.every((i) => done(i.state));
  const followedUp = f.refsGiven && f.references.every((r) => r.followedUp);
  const finalDone = finals.length > 0 && finals.every((i) => done(i.state));
  const no = f.shortlist === "no" || f.reviewStage === "not_invited";
  const yes = f.shortlist === "yes";

  const state: Record<TrackStage, TrackState> = {
    received: "done",
    review: reviewDone ? "done" : "now",
    shortlist: f.shortlist ? "done" : f.reviewStage === "not_invited" ? "skipped" : reviewDone ? "now" : "later",
    references: no ? "skipped" : f.refsGiven ? "done" : yes ? "now" : "later",
    followups: no ? "skipped" : followedUp && talksDone ? "done" : f.refsGiven || (yes && talks.some((i) => i.state === "open" || done(i.state))) ? "now" : "later",
    final_interview: no ? "skipped" : finalDone ? "done" : yes && ((f.refsGiven && followedUp && talksDone) || finals.some((i) => i.state === "open")) ? "now" : "later",
    decision: f.decided ? "done" : no || finalDone ? "now" : "later",
  };
  if (f.decided) {
    // Once decided, a stage that never happened reads as skipped, and the decision is the last word.
    for (const k of TRACK) if (state[k] === "now" || state[k] === "later") state[k] = k === "decision" ? "done" : "skipped";
  }
  const stages = TRACK.map((key) => ({ key, label: TRACK_WORDS[key], state: state[key] }));
  const now: TrackStage = f.decided ? "decision" : (TRACK.find((k) => state[k] === "now") ?? "decision");

  if (f.decided) return { stages, now, who: "Nobody. The decision is made.", next: "Nothing is left to do here.", primary: "none" };
  switch (now) {
    case "review":
      return {
        stages,
        now,
        who: f.reviewStage === "review" ? PLACING_POWER_WORDS : (roles.welcome ?? PLACING_POWER_WORDS),
        next: f.reviewStage === "review" ? "Read the application, then invite the applicant to the conversations or send the not-invited letter." : "Send the applicant a first reply.",
        primary: "review",
      };
    case "shortlist":
      return { stages, now, who: PLACING_POWER_WORDS, next: "Shortlist this application, or say it is not shortlisted.", primary: "shortlist" };
    case "references":
      return f.refsAsked
        ? { stages, now, who: "The applicant", next: "The applicant adds their references from their status page.", primary: "wait_applicant" }
        : { stages, now, who: PLACING_POWER_WORDS, next: "Ask the applicant for references. The letter goes in their language.", primary: "ask_references" };
    case "followups":
      return {
        stages,
        now,
        who: `${roles.followup ? `${roles.followup} and the other follow-up owners` : "The follow-up owners"}, and the conversation roles`,
        next: "Each owner follows up with their reference and writes notes. The intuition conversations go on alongside.",
        primary: "follow_up",
      };
    case "final_interview":
      return finals.length
        ? { stages, now, who: deciders, next: "Hold the final conversation and write the scorecard.", primary: "final_conversation" }
        : { stages, now, who: deciders, next: "Add the final conversation, then hold it.", primary: "add_final" };
    case "decision":
    default:
      return {
        stages,
        now: "decision",
        who: deciders,
        next: no ? "Send the decline with its letter, or reopen by talking it through with the team." : "Read what is gathered here, then adopt or decline with the existing doors.",
        primary: "decide",
      };
  }
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
    ask_references: "Ask for references",
    wait_applicant: "Waiting on the applicant",
    follow_up: "Go to the follow-ups",
    add_final: "Add the final conversation",
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
  referencesPrivate: "Personal details of people who never signed up. Only the people who review this application, the role that makes the final call and each reference's owner read them. No AI reads them. They are deleted with the application.",
  referencesAsked: "References were asked for. The applicant adds them from their status page.",
  referencesAskedNow: "Asked. The letter went to the applicant in their language.",
  referencesAskedAlready: "References were already asked for.",
  referencesNeedShortlist: "Shortlist the application before asking for references.",
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
  howKnown: "How they know the applicant",
  ally: "Why they might be an ally or partner",
  contact: "How to reach them",
  gatheredHeading: "Gathered for the final call",
  gatheredIntro: (role: string) => `Everything ${role} reads before the final conversation and the decision: each reference's follow-up notes and each conversation's scorecard. Nothing is totalled or ranked.`,
  gatheredHidden: "This view is for the role that makes the final call and the people who decide.",
  scorecardsHidden: "Scorecards open to you once you have added your own.",
  finalAdded: "The final conversation is added. It opens once the conversations before it are written up.",
  finalExists: "This application already has a final conversation.",
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
} as const;
