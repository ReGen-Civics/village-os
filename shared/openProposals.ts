/**
 * OPEN ROLE PROPOSALS: somebody with no account proposes to hold roles next
 * season (Rye, 2026-10-30; master coordinator's calls of 2026-10-31 and sheet
 * 19i). PURE, so the page and the server read one spelling.
 *
 *   /propose-a-role           the village's public link, on unless an admin
 *                             switches it off
 *   /propose-a-role/<token>   a link an admin made for one person, which they
 *                             can switch off
 *
 * The person picks one to three of next season's roles, says what they bring
 * to each and why, and gives their name and address. Nothing reaches anybody
 * until the address answers a confirmation email: an unconfirmed proposal is
 * deleted after 48 hours. Once confirmed it waits for the village, and only an
 * adoption makes an account, with its roles waiting. Member comes with the
 * signed Love Letter, never with an adoption (shared/openProposalDecide.ts).
 *
 * In the 2026-10-02 voice: the next step, never the machinery.
 */

/** The village's public link. */
import { APPLY_COUNTS, APPLY_TEXT } from "./applyLimits";
import { parsePieceSuggestions, pieceSuggestionsOf, type PieceSuggestion } from "./pieceSuggestions";
import { storedVoiceOf, type StoredVoice } from "./voiceNotes";
import { payAskOf, readPayAsk, type PayAsk } from "./commitmentRange";
import { proposalSplitOf, type ProposalSplit } from "./proposalSplitStored";
import { applicantSteps, cleanNote, isApplicantLanguage, wordsIn, type ApplicantLanguage } from "./applicantWords";
import { termOf, type OpenProposalTerm } from "./openProposalTerm";
import { cardOf, parseCard, type OpenProposalCard } from "./openProposalCard";
import { counterOfferOf, type CounterOffer } from "./counterOffer";
import { aboutOf, backgroundCheckOf, parseAboutYou, referencesOf, type BackgroundCheck, type ProposalAbout, type ProposalReference } from "./proposalAbout";
import { filesOf, linksOf, parseProposalLinks, type ProposalFile, type ProposalLink } from "./proposalAttachments";
import type { TermKey } from "./termsWords";
import { agentPartOf, type AgentProposalPart } from "./agentHolders";
import { applicantText } from "./applicantText";

export const OPEN_PROPOSAL_PATH = "/propose-a-role";

/** The public link with one role already picked: the door a visitor or a guest is offered on a role. */
export function openProposalHref(roleId?: string | null): string {
  const id = String(roleId ?? "").trim();
  return id ? `${OPEN_PROPOSAL_PATH}?role=${encodeURIComponent(id)}` : OPEN_PROPOSAL_PATH;
}

/** The most roles a stored proposal is read with (an older one may name up to three). */
export const OPEN_PROPOSAL_MAX_ROLES = 3;
/**
 * SEVERAL ROLES IN ONE PROPOSAL (the lead, 17 Nov 2026, confirmed 18 Nov, replacing the 11 Nov "one role per
 * application"): one person may propose for several roles, across circles, in one collective proposal, with a
 * commitment for each. Each role keeps its own price, split and agreement, and the prices add up ("two roles at 50%
 * are rewarded like one whole role"). The form starts from the role card's Apply link and the applicant may add
 * more, up to this many; `parseOpenProposal` refuses a send that names more.
 */
export const OPEN_APPLY_ROLES = OPEN_PROPOSAL_MAX_ROLES;
/** "Get to know us": how many ways the village may list, and how long each may be. */
export const KNOW_US_MAX = APPLY_COUNTS.knowUs;
export const KNOW_US_TEXT_MAX = APPLY_TEXT.knowUsText;
/** Human Design or Gene Keys, in the applicant's own words: optional, and never served to the people who decide. */
export const SELF_KNOWLEDGE_MAX = APPLY_TEXT.selfKnowledge;
export const OPEN_NAME_MAX = 120;
export const OPEN_NOTE_MAX = APPLY_TEXT.roleNote;
/**
 * "Why you, and why now" asks four things in one box (what they have built, why this role, why now, and their
 * first month), so it holds about a thousand characters for each (the lead, 19 Nov 2026: 1200 did not fit
 * honest answers). The one name the form, the drafting helpers and the server all read. A member's application
 * keeps it as its note, so shared/seatApplications.ts WORDS_MAX is held at least this long.
 */
export const OPEN_WHY_MAX = APPLY_TEXT.why;
export const OPEN_AIM_MAX = APPLY_TEXT.aim;
/** How long a confirmation link works, and how long an unconfirmed proposal is kept. */
export const OPEN_CONFIRM_HOURS = 48;

/**
 * THE GATES A PUBLIC FORM NEEDS WHEN A ROLE IS SHARED WIDELY (red team, 9 Nov
 * 2026: "the village can be made to email any address you name, at scale").
 * Every confirmation is an email the village sends to an address a stranger
 * typed, so the caps are on what reaches inboxes:
 *   - an overall hourly cap, whatever the connections and addresses;
 *   - the per-address cap counts an address without its "+tag", so
 *     victim+1@, victim+2@ ... share one allowance;
 *   - the per-connection cap counts an IPv6 address by its /64, the block
 *     one household or one server is handed.
 */
export const OPEN_GLOBAL_HOURLY = 60;

/**
 * One person's address, however they dressed it: folded to lower case,
 * without a "+tag", and for Gmail without the dots it ignores and with
 * googlemail.com read as gmail.com. Used where "the same person" matters: the
 * per-address flood cap, and the rule that an approver is never the applicant.
 */
export function identityKey(email: string): string {
  const e = String(email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0) return e;
  let local = e.slice(0, at).split("+")[0] || e.slice(0, at);
  let domain = e.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** The address as the per-address cap counts it (see identityKey). */
export function limiterAddressKey(emailKey: string): string {
  return identityKey(emailKey);
}

/** The connection as the per-connection cap counts it: IPv4 as is, IPv6 by its /64. */
export function ipBucket(ip: string): string {
  const raw = String(ip ?? "").trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(raw);
  if (mapped) return mapped[1];
  if (!raw.includes(":")) return raw;
  const [head, tail = ""] = raw.split("::");
  const h = head ? head.split(":") : [];
  const t = raw.includes("::") ? (tail ? tail.split(":") : []) : [];
  const groups = raw.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return `${groups.slice(0, 4).map((g) => (parseInt(g || "0", 16) || 0).toString(16)).join(":")}::/64`;
}

/** Letters in any script (Unicode classes, so the pattern is built at runtime), apostrophes and hyphens. */
const GREETING = new RegExp("^[\\p{L}\\p{M}'\\u2019-]{1,40}$", "u");

/** A first name safe to greet with: letters (any script), apostrophes and hyphens, never a link or an address. */
export function safeGreeting(name: string): string | null {
  const first = String(name ?? "").trim().split(/\s+/)[0] ?? "";
  return GREETING.test(first) ? first : null;
}
/**
 * How long a declined or withdrawn proposal keeps its name and address, and an
 * adopted one whose invitation nobody used (open proposals part B), counted
 * from the decision.
 */
export const OPEN_ANONYMISE_DAYS = 90;

export const OPEN_PROPOSAL_STATUSES = ["unconfirmed", "confirmed", "adopted", "declined", "withdrawn"] as const;
export type OpenProposalStatus = (typeof OPEN_PROPOSAL_STATUSES)[number];

/**
 * One role in a proposal. On a proposal naming several roles, each carries its own commitment, price ask and split
 * (the lead, 17 Nov 2026); the first role's are also kept where a one-role proposal keeps them (`card.commitmentPct`,
 * `payAsk`, `paySplit`), so a release that reads one role per proposal still reads the first one whole. A one-role
 * proposal carries none of the three here. Read them with `roleTermsOf`, never by hand.
 */
export interface OpenProposalRole {
  roleId: string;
  note: string;
  commitmentPct?: number;
  payAsk?: PayAsk;
  paySplit?: ProposalSplit;
}

export interface OpenProposalBody {
  roles: OpenProposalRole[];
  why: string;
  aim: string;
  /** Set by the server when the village's proposals are for the moon (shared/openProposalTerm.ts). Absent: next season. */
  term?: OpenProposalTerm;
  /** The applicant's own role card (shared/openProposalCard.ts). Absent on a proposal sent before it existed. */
  card?: OpenProposalCard;
  /**
   * The membership letter the applicant aligned with on the form, by the
   * version the form drew (Rye's answer 8, 9 Nov 2026). Recorded against the
   * address once it confirms (server/lib/applicationMembership.ts). Absent:
   * they did not align on the form, and are asked before their role starts.
   */
  membership?: { letterVersion: string };
  /** Labelled https links to the applicant's work, for the deciders only, never fetched (shared/proposalAttachments.ts). */
  links?: ProposalLink[];
  /** Files the applicant attached, for the deciders only; the bytes are in a private folder (server/lib/proposalFiles.ts). */
  files?: ProposalFile[];
  /** About you (joining lane PR 2): references and the background check are third-party data, for the deciders only, never read by an AI (shared/proposalAbout.ts). */
  references?: ProposalReference[];
  backgroundCheck?: BackgroundCheck;
  about?: ProposalAbout;
  /** The language this person's emails, notices and status page use (shared/applicantLanguage.ts). Chosen once, when they proposed. */
  locale?: ApplicantLanguage;
  /** A note a decider wrote for the applicant. The applicant's own data: shown to them on the status page and in the email, never to anybody else, never to an AI, removed when the proposal is anonymised or deleted. */
  note?: string;
  /** The steward's counter-offer on the terms, appended revision by revision (shared/counterOffer.ts). Written only by the decider door, never by the form. */
  counterOffer?: CounterOffer;
  /**
   * An agent proposed by its keeper (0374, shared/agentHolders.ts). Written only by the member door's agent
   * route, never by the public form. Absent on every person's proposal.
   */
  agent?: AgentProposalPart;
  /**
   * "Get to know us" (step 1 of the application): the ways the applicant
   * ticked, in the village's words as they read when it was sent. Never
   * required: the step never locks (build list 1.12).
   */
  knowUs?: string[];
  /** The ramp-up option on The terms: partial pay while building to full capacity (build list 6.8). */
  rampUp?: true;
  /**
   * Human Design or Gene Keys, in the applicant's own words (About you). Kept
   * for the person's own profile; the decider routes never serve it.
   */
  selfKnowledge?: string;
  /**
   * What the applicant would change, finds missing or would deliver on each piece of the role card
   * (shared/pieceSuggestions.ts). For the deciders, read-only, beside each piece; never given to an AI.
   */
  pieceSuggestions?: PieceSuggestion[];
  /**
   * The applicant's voice note, kept only with their tick (shared/voiceNotes.ts): the recordings and the
   * words the browser heard. For the deciders only, never to an AI. Removed when the proposal is
   * anonymised, and 90 days after the decision in every case.
   */
  voice?: StoredVoice;
  /** Their optional pay ask (Rye, 14 Nov 2026, shared/commitmentRange.ts): a monthly amount, or negotiate. For the deciders; the contract sets the pay. */
  payAsk?: PayAsk;
  /**
   * The cash, equity and credits split (the lead, 17 Nov 2026, shared/proposalSplit.ts): what the village offered at
   * their commitment, worked by the server, beside what they proposed. For the deciders; the contract sets the pay.
   */
  paySplit?: ProposalSplit;
}

export interface OpenProposalInput {
  name: string;
  email: string;
  body: OpenProposalBody;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; field: string; error: string };

/**
 * Trimmed, and cut one past the cap so "too long" can still be told from "at the cap", with the characters that only
 * hide or disguise text taken out and a field with nothing visible left read as empty (shared/applicantText.ts).
 * `trim()` for the ends, never an anchored regex: `\s+$` runs slow on a long run of spaces.
 */
const text = (v: unknown, max: number): string => applicantText(v, max);

/** A stored or sent membership alignment: a letter version, or nothing. */
export function membershipOf(raw: unknown): { letterVersion: string } | null {
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>).letterVersion : null;
  return typeof v === "string" && /^lv-[0-9a-f]{16}$/.test(v) ? { letterVersion: v } : null;
}

/** What a stored body reads as, whatever was stored. Never throws. */
export function openBodyOf(raw: unknown): OpenProposalBody {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const roles = Array.isArray(o.roles) ? o.roles : [];
  return {
    roles: roles
      .map((r: any): OpenProposalRole => ({
        roleId: String(r?.roleId ?? "").trim(),
        note: text(r?.note, OPEN_NOTE_MAX).slice(0, OPEN_NOTE_MAX),
        ...(isProposedCommitment(r?.commitmentPct) ? { commitmentPct: r.commitmentPct as number } : {}),
        ...(payAskOf(r?.payAsk) ? { payAsk: payAskOf(r?.payAsk) as PayAsk } : {}),
        ...(proposalSplitOf(r?.paySplit) ? { paySplit: proposalSplitOf(r?.paySplit) as ProposalSplit } : {}),
      }))
      .filter((r) => r.roleId)
      .slice(0, OPEN_PROPOSAL_MAX_ROLES),
    why: text(o.why, OPEN_WHY_MAX).slice(0, OPEN_WHY_MAX),
    aim: text(o.aim, OPEN_AIM_MAX).slice(0, OPEN_AIM_MAX),
    ...(termOf(o.term) ? { term: termOf(o.term) } : {}),
    ...(cardOf(o.card) ? { card: cardOf(o.card) } : {}),
    ...(membershipOf(o.membership) ? { membership: membershipOf(o.membership) as { letterVersion: string } } : {}),
    ...(linksOf(o.links).length ? { links: linksOf(o.links) } : {}),
    ...(filesOf(o.files).length ? { files: filesOf(o.files) } : {}),
    ...(referencesOf(o.references).length ? { references: referencesOf(o.references) } : {}),
    ...(backgroundCheckOf(o.backgroundCheck) ? { backgroundCheck: backgroundCheckOf(o.backgroundCheck) as BackgroundCheck } : {}),
    ...(Object.keys(aboutOf(o.about)).length ? { about: aboutOf(o.about) } : {}),
    ...(isApplicantLanguage(o.locale) ? { locale: o.locale } : {}),
    ...(cleanNote(o.note) ? { note: cleanNote(o.note) as string } : {}),
    ...(counterOfferOf(o.counterOffer) ? { counterOffer: counterOfferOf(o.counterOffer) as CounterOffer } : {}),
    ...(agentPartOf(o.agent) ? { agent: agentPartOf(o.agent) as AgentProposalPart } : {}),
    ...(knowUsOf(o.knowUs).length ? { knowUs: knowUsOf(o.knowUs) } : {}),
    ...(o.rampUp === true ? { rampUp: true as const } : {}),
    ...(text(o.selfKnowledge, SELF_KNOWLEDGE_MAX).slice(0, SELF_KNOWLEDGE_MAX) ? { selfKnowledge: text(o.selfKnowledge, SELF_KNOWLEDGE_MAX).slice(0, SELF_KNOWLEDGE_MAX) } : {}),
    ...(pieceSuggestionsOf(o.pieceSuggestions).length ? { pieceSuggestions: pieceSuggestionsOf(o.pieceSuggestions) } : {}),
    ...(storedVoiceOf(o.voice) ? { voice: storedVoiceOf(o.voice) as StoredVoice } : {}),
    ...(payAskOf(o.payAsk) ? { payAsk: payAskOf(o.payAsk) as PayAsk } : {}),
    ...(proposalSplitOf(o.paySplit) ? { paySplit: proposalSplitOf(o.paySplit) as ProposalSplit } : {}),
  };
}

/** A commitment one person may propose: a whole step of ten from 10 to 100 (the terms' steps). */
export function isProposedCommitment(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 10 && v <= 100 && v % 10 === 0;
}

/** One role's own terms in a proposal: the commitment proposed, the price asked and the split proposed. */
export interface RoleTerms {
  roleId: string;
  commitmentPct: number | null;
  payAsk: PayAsk | null;
  paySplit: ProposalSplit | null;
}

/** Whether a proposal carries terms for each of several roles (the lead, 17 Nov 2026): each role is then its own agreement. */
export function termsPerRole(body: { roles: OpenProposalRole[] }): boolean {
  return body.roles.length > 1 && body.roles.slice(1).some((r) => typeof r.commitmentPct === "number");
}

/**
 * EACH ROLE'S OWN TERMS, whatever shape the body was stored in. A role's own keys first; the first role falls back to
 * where a one-role proposal keeps them. On an older proposal naming several roles with one commitment (before 17 Nov
 * 2026) every role reads that one commitment and the one ask, as it always did.
 */
export function roleTermsOf(body: { roles: OpenProposalRole[]; card?: { commitmentPct?: number }; payAsk?: PayAsk; paySplit?: ProposalSplit }): RoleTerms[] {
  const perRole = termsPerRole(body);
  const shared = { commitmentPct: typeof body.card?.commitmentPct === "number" ? body.card.commitmentPct : null, payAsk: body.payAsk ?? null, paySplit: body.paySplit ?? null };
  return body.roles.map((r, i) => {
    if (!perRole || i === 0) {
      return {
        roleId: r.roleId,
        commitmentPct: typeof r.commitmentPct === "number" ? r.commitmentPct : shared.commitmentPct,
        payAsk: r.payAsk ?? shared.payAsk,
        paySplit: r.paySplit ?? (i === 0 ? shared.paySplit : null),
      };
    }
    return { roleId: r.roleId, commitmentPct: r.commitmentPct ?? null, payAsk: r.payAsk ?? null, paySplit: r.paySplit ?? null };
  });
}

/** The "Get to know us" ticks as stored: plain lines, deduplicated, capped. */
export function knowUsOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    const line = typeof v === "string" ? v.trim().slice(0, KNOW_US_TEXT_MAX) : "";
    if (line && !out.includes(line)) out.push(line);
    if (out.length >= KNOW_US_MAX) break;
  }
  return out;
}

/**
 * A proposal as the form sent it, checked against the roles the village is
 * offering. `address` decides whether an address is one (shared/comms/address.ts
 * on the server). The first problem is answered, with the field it is on.
 */
export function parseOpenProposal(
  raw: unknown,
  ctx: {
    roleIds: ReadonlySet<string>;
    address: (s: string) => string | null;
    accountabilitiesOf?: (roleId: string) => readonly string[];
    goalIds?: ReadonlySet<string>;
    today?: string;
    alwaysChecked?: (roleId: string) => boolean;
    writtenTerms?: (roleIds: readonly string[]) => readonly TermKey[];
    now?: Date;
    /** The ways to get to know the village it lists now; a tick for one no longer listed is dropped, never refused. Absent: none are kept. */
    knowUs?: readonly string[];
    /**
     * A role not open yet (coming soon): it may not be ADDED to an application after the first (the lead, 19 Nov
     * 2026); its waitlist is on the roles page. Absent: nothing is refused for it.
     */
    notYetOpen?: (roleId: string) => boolean;
  },
): Parsed<OpenProposalInput> {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  // A name is one line: a newline or tab in it reads as a space.
  const name = applicantText(o.name, OPEN_NAME_MAX, true);
  if (!name) return { ok: false, field: "name", error: OPEN_WORDS.needName };
  if (name.length > OPEN_NAME_MAX) return { ok: false, field: "name", error: OPEN_WORDS.tooLong("Your name", OPEN_NAME_MAX) };
  const email = ctx.address(String(o.email ?? ""));
  if (!email) return { ok: false, field: "email", error: String(o.email ?? "").trim() ? OPEN_WORDS.badEmail : OPEN_WORDS.needEmail };
  const picked = Array.isArray(o.roles) ? o.roles : [];
  if (picked.length === 0) return { ok: false, field: "roles", error: OPEN_WORDS.needRole };
  if (picked.length > OPEN_APPLY_ROLES) return { ok: false, field: "roles", error: OPEN_WORDS.tooManyRoles };
  const roles: OpenProposalBody["roles"] = [];
  for (let i = 0; i < picked.length; i++) {
    const r = picked[i] as any;
    const roleId = String(r?.roleId ?? "").trim();
    if (!ctx.roleIds.has(roleId)) return { ok: false, field: "roles", error: OPEN_WORDS.unknownRole };
    if (roles.some((x) => x.roleId === roleId)) return { ok: false, field: "roles", error: OPEN_WORDS.sameRoleTwice };
    if (i > 0 && ctx.notYetOpen?.(roleId)) return { ok: false, field: `roles.${i}`, error: OPEN_WORDS.addedRoleNotOpen };
    const note = text(r?.note, OPEN_NOTE_MAX);
    if (note.length > OPEN_NOTE_MAX) return { ok: false, field: "roles", error: OPEN_WORDS.tooLong("What you bring to a role", OPEN_NOTE_MAX) };
    // Each role after the first carries its own commitment and price ask (the lead, 17 Nov 2026). The first role's
    // are where a one-role proposal sends them (`card.commitmentPct`, `payAsk`), copied onto it below.
    if (i > 0) {
      if (!isProposedCommitment(r?.commitmentPct)) return { ok: false, field: `roles.${i}`, error: OPEN_WORDS.needRoleCommitment };
      const own = readPayAsk(r?.payAsk);
      if (!own.ok) return { ok: false, field: `roles.${i}`, error: own.problem };
      roles.push({ roleId, note, commitmentPct: r.commitmentPct, ...(own.value ? { payAsk: own.value } : {}) });
      continue;
    }
    roles.push({ roleId, note });
  }
  const why = text(o.why, OPEN_WHY_MAX);
  if (!why) return { ok: false, field: "why", error: OPEN_WORDS.needWhy };
  if (why.length > OPEN_WHY_MAX) return { ok: false, field: "why", error: OPEN_WORDS.tooLong("Why you", OPEN_WHY_MAX) };
  const aim = text(o.aim, OPEN_AIM_MAX);
  if (aim.length > OPEN_AIM_MAX) return { ok: false, field: "aim", error: OPEN_WORDS.tooLong("Your aim", OPEN_AIM_MAX) };
  // Links to their work (Rye, 10 Nov 2026): checked for shape, never fetched.
  const linked = parseProposalLinks(o.links);
  if (!linked.ok) return { ok: false, field: "links", error: linked.error };
  const links = linked.links.length ? { links: linked.links } : {};
  // The application's own answers (the lead, 11 Nov 2026): the ticks, the ramp-up, and Human Design or Gene Keys.
  const listed = new Set((ctx.knowUs ?? []).map((l) => l.trim()));
  const knowUs = knowUsOf(o.knowUs).filter((l) => listed.has(l));
  const selfKnowledge = text(o.selfKnowledge, SELF_KNOWLEDGE_MAX);
  if (selfKnowledge.length > SELF_KNOWLEDGE_MAX) return { ok: false, field: "selfKnowledge", error: OPEN_WORDS.tooLong("Human Design or Gene Keys", SELF_KNOWLEDGE_MAX) };
  // What they would make of the role card, piece by piece (Rye, 14 Nov 2026): optional, for the roles picked.
  const suggested = parsePieceSuggestions(o.pieceSuggestions, new Set(roles.map((r) => r.roleId)));
  if (!suggested.ok) return { ok: false, field: "pieceSuggestions", error: suggested.error };
  const asked = readPayAsk(o.payAsk);
  if (!asked.ok) return { ok: false, field: "payAsk", error: asked.problem };
  // Several roles: the first carries its own terms too, from where a one-role proposal sends them.
  const firstTerms = (card: OpenProposalCard | undefined): OpenProposalBody["roles"] =>
    roles.length > 1
      ? [{ ...roles[0], ...(isProposedCommitment(card?.commitmentPct) ? { commitmentPct: card?.commitmentPct } : {}), ...(asked.value ? { payAsk: asked.value } : {}) }, ...roles.slice(1)]
      : roles;
  const own = {
    ...(asked.value ? { payAsk: asked.value } : {}),
    ...(suggested.value.length ? { pieceSuggestions: suggested.value } : {}),
    ...(knowUs.length ? { knowUs } : {}),
    ...(o.rampUp === true ? { rampUp: true as const } : {}),
    ...(selfKnowledge ? { selfKnowledge } : {}),
  };
  // About you (joining lane PR 2): only when the form sent the section, so a form from before it still goes through.
  let aboutYou: Pick<OpenProposalBody, "references" | "about" | "backgroundCheck"> = {};
  if (o.references !== undefined || o.about !== undefined || o.checkConsent !== undefined) {
    const judged = parseAboutYou(
      { references: o.references, about: o.about, consent: o.checkConsent },
      { alwaysChecked: roles.some((r) => ctx.alwaysChecked?.(r.roleId) === true), at: ctx.now ?? new Date() },
    );
    if (!judged.ok) return { ok: false, field: judged.field, error: judged.error };
    aboutYou = {
      ...(judged.value.references.length ? { references: judged.value.references } : {}),
      ...(Object.keys(judged.value.about).length ? { about: judged.value.about } : {}),
      backgroundCheck: judged.value.backgroundCheck,
    };
  }
  // The applicant's own card, when the form sent one (shared/openProposalCard.ts).
  if (o.card !== undefined && o.card !== null) {
    // Form v2 (brief v2, 5.4): the aim is required once the applicant writes their card.
    if (!aim) return { ok: false, field: "aim", error: OPEN_WORDS.needAim };
    const card = parseCard(o.card, {
      roleIds: new Set(roles.map((r) => r.roleId)),
      accountabilitiesOf: ctx.accountabilitiesOf ?? (() => []),
      goalIds: ctx.goalIds ?? new Set(),
      today: ctx.today,
      writtenTerms: ctx.writtenTerms?.(roles.map((r) => r.roleId)),
    });
    if (!card.ok) return { ok: false, field: card.field, error: card.error };
    return { ok: true, value: { name, email, body: { roles: firstTerms(card.card), why, aim, card: card.card, ...links, ...aboutYou, ...own } } };
  }
  return { ok: true, value: { name, email, body: { roles: firstTerms(undefined), why, aim, ...links, ...aboutYou, ...own } } };
}

/** "A", "A and B", "A, B and C". */
export function andList(items: readonly string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? "";
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

/**
 * THE DATA PROMISE ON AI DRAFTING (Rye, 9 Nov 2026: the Anchor approved the
 * connector's `draft_letter`). On the form's privacy note, where the page
 * renders it through Lingui with these same words, and in the confirmation
 * email. Village-neutral, so it is platform copy.
 */
export const OPEN_AI_DRAFTS = "An AI may help draft our replies to you; a person always reads and sends them, and no AI takes part in choosing.";

/**
 * "APPLICATION" FOR A LISTED ROLE (Phase A vocabulary: Apply is for a listed
 * role, Propose only for a new one). The confirmation email and the status
 * email for an application say "application"; every other line comes from
 * the applicant's words (shared/applicantWords.ts, lane A2). When A2's table
 * carries these lines itself, the integrator points `confirmLetter` and the
 * status email at it and deletes this table.
 */
export const APPLY_EMAIL_WORDS: Record<ApplicantLanguage, {
  subject(village: string): string;
  applied(roles: string, village: string, when: string | null): string;
  ask: string;
  /** The ask in a confirmation email sent later, to an application we kept when the first one failed. */
  keptAsk: string;
  /** The link's line in that later email: ignoring it never loses the application. */
  keptValidFor(hours: number): string;
  statusSubject: string;
  statusText(link: string, replyPromise: string): string;
}> = {
  en: {
    subject: (v) => `Confirm your application to ${v}`,
    applied: (roles, v, when) => `You applied for ${roles} in ${v}${when ? ` for ${when}` : ""}.`,
    ask: "Confirm it's you, and your application reaches us:",
    keptAsk: "We already have your application. Our first email to you didn't go out, so please confirm this address is yours:",
    keptValidFor: (h) => `The link works for ${h} hours. If you didn't apply, you can ignore this email.`,
    statusSubject: "Where your application is",
    statusText: (link, promise) => `Your application is with us. Follow where it is, who acts next and by when:\n\n${link}\n\n${promise} Keep this link to yourself: it is how we know it is you.`,
  },
  es: {
    subject: (v) => `Confirma tu solicitud a ${v}`,
    applied: (roles, v, when) => `Postulaste a ${roles} en ${v}${when ? ` para ${when}` : ""}.`,
    ask: "Confirma que eres tú, y tu solicitud nos llega:",
    keptAsk: "Ya tenemos tu solicitud. Nuestro primer correo no salió, así que confirma que esta dirección es tuya:", // check: "correo" for email
    keptValidFor: (h) => `El enlace funciona durante ${h} horas. Si no postulaste, puedes ignorar este correo.`,
    statusSubject: "Dónde está tu solicitud",
    statusText: (link, promise) => `Tu solicitud está con nosotros. Sigue dónde está, quién actúa ahora y para cuándo:\n\n${link}\n\n${promise} Guarda este enlace para ti: es la forma en que sabemos que eres tú.`,
  },
};

/** One step after submit, in the applicant's language: its key, its name and its time line. */
export interface StepAfterSubmit {
  key: string;
  name: string;
  when: string;
}

/**
 * The applicant's steps after submit, in one language: the one list in
 * shared/applicantWords.ts (`APPLICANT_STEPS`: received, review, invitation,
 * conversations, decision, first_cycle), so the confirmed page, the status
 * email and the status page never drift apart.
 *
 * Its readers: the status email (server/routes/openProposals.ts) and the
 * confirmed page (`steps` on the confirm route's answer, drawn by
 * components/fireflyPath/Thresholds.tsx).
 */
export function stepsAfterSubmit(lang: ApplicantLanguage | null | undefined, replyDays: number | null): StepAfterSubmit[] {
  return applicantSteps(lang, replyDays);
}

/** The steps as lines of an email: "Name: when". */
export function stepsAsLines(steps: readonly StepAfterSubmit[]): string {
  return steps.map((s, i) => `${i + 1}. ${s.name}: ${s.when}`).join("\n");
}

/**
 * The email that asks the address to confirm. Nothing else reaches anybody until it is answered. `when` is already in the reader's language.
 * `kind: "application"` (the form for a listed role) says application; a proposal for a new role keeps its own words.
 */
export function confirmLetter(i: { firstName: string | null; village: string; roleNames: readonly string[]; link: string; when?: string; lang?: ApplicantLanguage; kind?: "application" | "proposal"; kept?: boolean }): { subject: string; text: string } {
  const w = wordsIn(i.lang);
  const a = i.kind === "application" ? APPLY_EMAIL_WORDS[isApplicantLanguage(i.lang) ? i.lang : "en"] : null;
  const roles = w.list(i.roleNames) || w.aRole;
  return {
    subject: a ? a.subject(i.village) : w.confirm.subject(i.village),
    text: [
      w.hello(i.firstName),
      "",
      a ? a.applied(roles, i.village, i.when ?? null) : w.confirm.proposed(roles, i.village, i.when ?? null),
      "",
      a ? (i.kept ? a.keptAsk : a.ask) : w.confirm.ask,
      i.link,
      "",
      a && i.kept ? a.keptValidFor(OPEN_CONFIRM_HOURS) : w.confirm.validFor(OPEN_CONFIRM_HOURS),
      "",
      w.confirm.aiDrafts,
      "",
    ].join("\n"),
  };
}

export const OPEN_WORDS = {
  // The page (the founding-team application since Phase A, 11 Nov 2026).
  heading: (roleName: string) => `Apply: ${roleName}`,
  chooseHeading: "Join the founding team",
  lede: (season: string) => `Pick up to ${OPEN_PROPOSAL_MAX_ROLES} roles for ${season}, say what you bring, and send it. You don't need an account.`,
  noSeason: "The village hasn't set its next season yet, so there's nothing to propose for right now. Check back soon.",
  /** The lede when the village's proposals are for the moon. */
  ledeMoon: (from: string, to: string) => `Pick up to ${OPEN_PROPOSAL_MAX_ROLES} roles for this moon, from ${from} to the next new moon on ${to}, say what you bring, and send it. You don't need an account.`,
  noCurrentSeason: "The village has no season running right now, so there's nothing to propose for this moon. Check back soon.",
  closed: "This page isn't taking proposals right now.",
  pickRoles: `Pick up to ${OPEN_PROPOSAL_MAX_ROLES} roles`,
  noteLabel: "What you bring to this role",
  whyLabel: "Why you, and why now",
  aimLabel: "Your aim in this role, in a line",
  nameLabel: "Your name",
  emailLabel: "Your email",
  emailNote: "We'll only write to you about this application.",
  /** The retention, in one plain line on the form (sheet 19i). */
  keptFor: `If you don't confirm within ${OPEN_CONFIRM_HOURS} hours, we delete what you sent. If the village says no, or says yes and you never make your account, we remove your name and email ${OPEN_ANONYMISE_DAYS} days later.`,
  send: "Send my application",
  sent: (email: string) => `Check ${email}. We sent a link to confirm it's you. Your application reaches us once you open it.`,
  confirmed: "Confirmed. Your application is with us now, and you'll hear back by email.",
  confirmGone: "That link has run out or was already used. Send your application again, and open the new link within 48 hours.",
  // Refusals, each with what to do.
  needName: "Add your name.",
  needEmail: "Add an email address we can reach you at.",
  /** An address was typed, and it is not one (applicant journey QA, 15 Nov 2026). */
  badEmail: "That doesn't look like an email address. Check it, like name@example.com, and try again.",
  needRole: "Choose the role you are applying for.",
  tooManyRoles: `One application takes up to ${OPEN_PROPOSAL_MAX_ROLES} roles. Remove one, and apply for it separately.`,
  /** A role added after the first, sent without its own commitment. */
  needRoleCommitment: "Choose your commitment for each role you added.",
  unknownRole: "One of those roles isn't open any more. Reload the page and pick again.",
  addedRoleNotOpen: "A role you added isn't open yet, so it can't be part of this application. Remove it, and join its waitlist on the roles page.",
  sameRoleTwice: "You picked the same role twice.",
  needWhy: "Say why you, and why now.",
  needAim: "Say your aim in this role, in a line.",
  tooLong: (what: string, max: number) => `${what} is too long. Keep it under ${max} characters.`,
  notSent: "We couldn't send the confirmation email just now. Try again later.",
  /**
   * The confirmation email did not go, and the application is kept anyway (Rye, 14 Nov 2026:
   * "we still get the application even if the email is broken"). Said to the applicant, as a success.
   */
  keptNotSent: (email: string) => `We have your application. Our confirmation email didn't go out, so we'll write to you at ${email} soon.`,
  /** Beside a kept application, for the people who review it and the desk. */
  addressUnconfirmed: "Email address not confirmed. Our confirmation email to it failed, so we don't know yet that the address is theirs.",
  /** A kept application's address matches an account here: nobody is placed on that account until the address answers. */
  addressUnconfirmedAccount: "This address belongs to an account here and isn't confirmed yet, because our confirmation email to it failed. It can be adopted onto that account once the address is confirmed.",
  /** In the bell, to the admins, when an application is kept because its confirmation email failed. */
  keptAlertTitle: "An application came in, but its confirmation email failed. We kept it, marked as not confirmed, and will try the email again every hour.",
  /** A kept application's address opened the link sent later. */
  addressConfirmed: "Thanks, your email address is confirmed. We already had your application.",
  /** The sending connection already had its five accepted proposals this hour. Refused tries never count toward it. */
  tooMany: "We've already received five proposals from this connection in the last hour, so we can't take another one yet. Nothing you wrote is lost on this page. Please try again in about an hour, or send from a different connection.",
  /** Many tries in a short while, valid or not: the generous outer bucket. */
  tooManyTries: "That's a lot of tries from this connection in a short while. Please wait about an hour and try again.",
  /** The same address already has three proposals in a day. */
  tooManyForAddress: "This email address already has three proposals waiting today. Check your inbox for the confirmation links, or try again tomorrow.",
  /** The village-wide hourly cap on confirmation email. */
  tooBusy: "We're receiving a lot of proposals right now and can't send another confirmation email yet. Please try again in about an hour.",
  /** The confirm link opened too many times from one connection. */
  tooManyOpens: "That link has been opened many times from this connection. Please wait about an hour and try again.",
  // The desk.
  linkMade: "Link made. Copy it now: it won't be shown again.",
  linkOff: "That link is switched off. It no longer opens the form.",
  publicOn: "The public link is on. Anyone with it can propose.",
  publicOff: "The public link is off. Only links you make for one person open the form.",
} as const;
