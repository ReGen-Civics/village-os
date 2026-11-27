/**
 * THE NEXT-STEP LETTER AT EACH STAGE (the lead, 27 Nov 2026: "each step should come with an email for next steps as
 * well as show them clearly their next step in their profile"). The words are shared/applicantStageLetters.ts; this
 * decides which stage, which booking link and which roles, then sends through the post office every applicant letter
 * already uses (`TellDeps.postEmail`), and rings the applicant's own bell when their account is trusted.
 *
 * ONCE PER STAGE. Each letter's idempotency key is `open-proposal:<ref>:stage:<stage>` (`stageLetterKey`), and the bell
 * a stable dedupe key, so calling this after every act sends a stage's letter the first time only. It answers true
 * only when a letter went NOW, so a caller whose act already had a letter of its own (a conversation opening, the
 * references form) sends that one instead when the stage's letter had already gone.
 *
 * A LINK OPENS WHEN ITS STEP COMES. The booking carried is the one conversation open now at this stage: the final
 * conversation's link only at Final conversation, a community conversation's only before it (the same rule as the
 * applicant's page, shared/applicantWords.ts `statusView`). A later step's link is never read here.
 *
 * NOTHING PRIVATE. The letter is built from the stage, the roles' names, the booking links and the status link. No
 * note, score, reference or transcript is read by this file.
 */
import type { PostResult } from "../../shared/comms/contracts";
import { greetingName } from "../../shared/openProposalDecide";
import { FINAL_CALL_ROLE_VARIABLE, FOLLOWUP_ROLE_VARIABLE, trackStates } from "../../shared/applicantOnboarding";
import { bookingNudgeKey, bookingNudgeLetter, stageLetter, stageLetterKey, STAGE_LETTER_STAGES, type StageLetterKind, type StageLetterStage } from "../../shared/applicantStageLetters";
import { finalFreezes, mayRefine } from "../../shared/proposalRefine";
import { ROLE_SHORT_LABELS_VARIABLE, roleShortLabel } from "../../shared/roleShortLabel";
import * as proposals from "../repos/openProposals";
import * as review from "../repos/applicationReview";
import { trustedAccountFor } from "./applicantAccount";
import { languageOf } from "./applicantLanguage";
import { applicantTrackFactsOf } from "./applicantOnboarding";
import { stepBookingOf } from "./applicationReview";
import { framedLetter, statusLinkFor, statusLinkIn, withoutStatusLink, type TellDeps } from "./applicantUpdates";
import { stringVar } from "./variables";
import { referencesEditable } from "../repos/applicantOnboarding";
import { wordsIn, type ApplicantLanguage } from "../../shared/applicantWords";
import { bookingLinksText } from "../../shared/interviewBooking";
import type { Pool } from "mysql2/promise";

/** A letter that went now; a duplicate is a letter that had already gone. */
const WENT_NOW: ReadonlySet<PostResult["status"]> = new Set<PostResult["status"]>(["sending", "sent", "delivered"]);

const isLetterStage = (s: string): s is StageLetterStage => (STAGE_LETTER_STAGES as readonly string[]).includes(s);

/** A role's name as the applicant reads it: its short label, else its full name; null for no role. */
async function roleWord(deps: Pick<TellDeps, "getPool">, roleId: string): Promise<string | null> {
  const id = roleId.trim();
  if (!id) return null;
  const name = (await review.roleNamesById(deps.getPool(), [id])).get(id);
  return name ? roleShortLabel(id, name, stringVar(ROLE_SHORT_LABELS_VARIABLE)) : null;
}

/** How many times a stage letter is tried again after a provider fault, each under its own key. */
export const STAGE_LETTER_RETRIES = 3;

/** The attempts at one stage's letter, oldest first: whether each went. */
async function attemptsOf(deps: Pick<TellDeps, "getPool">, ref: string, kind: StageLetterKind): Promise<boolean[]> {
  const steps = (await review.stepsOf(deps.getPool(), ref)).filter((s) => s.kind === "stage_mail" && s.subject.startsWith(`${kind}:`));
  return steps.sort((a, b) => Number(a.subject.split(":")[1]) - Number(b.subject.split(":")[1])).map((s) => s.detail?.went === true);
}

/** Send one letter (and ring the bell). True when the letter went now. `attempt` 0 is the first; a retry keys its own. */
async function send(deps: TellDeps, p: proposals.StoredOpenProposal, kind: StageLetterKind, words: { subject: string; text: string }, attempt = 0): Promise<boolean> {
  if (!p.email) return false;
  const name = greetingName(p.name);
  const lang = languageOf(p);
  const framed = await framedLetter(deps, lang, words, statusLinkIn(words.text));
  const sent = await deps.postEmail({
    idempotencyKey: attempt ? `${stageLetterKey(p.id, kind)}:r${attempt}` : stageLetterKey(p.id, kind),
    kind: "essential",
    origin: "open_proposal.stage",
    to: { email: p.email, ...(name ? { name } : {}) },
    subject: words.subject,
    ...framed,
  });
  // Each attempt is written down, so a provider fault is tried again by the retry pass, and a letter that went is
  // never sent a second time (`retryStageLetters`).
  const went = WENT_NOW.has(sent.status) || sent.status === "queued" || sent.status === "rehearsed";
  if (STAGE_LETTER_STAGES.includes(kind as StageLetterStage)) {
    await review.stampStep(deps.getPool(), { ref: p.id, kind: "stage_mail", subject: `${kind}:${attempt}`, at: new Date(), detail: { went, status: sent.status } });
  }
  if (attempt > 0) return went;
  const account = await trustedAccountFor(deps.members, p, deps.getPool());
  if (account) {
    await deps.notify({
      userId: account,
      type: "applicant_update",
      title: words.subject,
      body: withoutStatusLink(words.text).slice(0, 1000),
      link: "/profile",
      actorUserId: null,
      dedupeKey: `op:${p.id}:stage:${kind}:${account}`,
    });
  }
  return WENT_NOW.has(sent.status);
}

/** The roles the application is for, by name, for "your application to hold ...". */
async function roleNamesOf(deps: Pick<TellDeps, "getPool">, p: proposals.StoredOpenProposal): Promise<string[]> {
  const names = await review.roleNamesById(deps.getPool(), p.body.roles.map((r) => r.roleId));
  return p.body.roles.map((r) => names.get(r.roleId) ?? "").filter(Boolean);
}

/**
 * The stage's letter, when the application stands at a stage that has one and its letter has not gone. True when a
 * letter went now. Never throws: a letter that did not go is logged, and the act it follows has already happened.
 */
export async function tellStageLetter(deps: TellDeps, ref: string, attempt = 0): Promise<boolean> {
  try {
    const pool = deps.getPool();
    const p = await proposals.readOpenProposal(pool, ref);
    if (!p || !p.email || p.status !== "confirmed") return false;
    const read = await applicantTrackFactsOf(deps, ref);
    if (!read || read.facts.decided) return false;
    const { now } = trackStates(read.facts);
    if (!isLetterStage(now)) return false;
    // Once per stage: a letter already tried is the retry pass's to try again, never a second first attempt.
    if (attempt === 0 && (await attemptsOf(deps, ref, now)).length > 0) return false;
    // The conversation open NOW at this stage: the final's only at Final conversation, a community one only before.
    const open = (await review.interviewsOf(pool, ref)).find((i) => i.state === "open" && (now === "final_interview" ? i.final : !i.final));
    const step = open && now !== "agreement" ? await stepBookingOf(pool, ref, open.roleId) : null;
    const account = await trustedAccountFor(deps.members, p, pool);
    const origin = deps.siteUrl?.().replace(/\/+$/, "");
    const words = stageLetter({
      kind: now,
      firstName: greetingName(p.name),
      roleNames: await roleNamesOf(deps, p),
      booking: step ? { role: step.label, links: step.links.map((l) => l.url) } : null,
      followupRole: await roleWord(deps, stringVar(FOLLOWUP_ROLE_VARIABLE)),
      finalCallRole: await roleWord(deps, stringVar(FINAL_CALL_ROLE_VARIABLE)),
      anchorCircle: await review.anchorCircleName(pool),
      referencesOpen: read.facts.refsAsked && !read.facts.refsGiven,
      // In already: never asked again (the lead, 27 Nov 2026). Only whether they are in and editable rides along.
      referencesIn: read.facts.refsGiven,
      referencesEditable: read.facts.refsGiven ? await referencesEditable(pool, ref) : false,
      refineOpen: mayRefine({ stage: now, decided: false, finalFrozen: finalFreezes({ sentToCircle: read.facts.sentToCircle ?? false }) }),
      statusLink: await statusLinkFor(deps, ref),
      profileLink: account && origin ? `${origin}/profile` : null,
      lang: languageOf(p),
    });
    return await send(deps, p, now, words, attempt);
  } catch (e) {
    console.error(`[open-proposals] the stage letter for ${ref} was not sent`, e);
    return false;
  }
}

/**
 * STAGE LETTERS SURVIVE A PROVIDER FAULT (QA pass 3): essential mail keeps no body for the post office to try again,
 * so each attempt is recorded here, and this pass (run with the review clock) sends the letter of the stage an
 * application stands at again, under a new key, only while every attempt so far failed, at most
 * `STAGE_LETTER_RETRIES` times. Still exactly once: a letter that went is never sent again.
 */
export async function retryStageLetters(deps: TellDeps, refs: readonly string[]): Promise<number> {
  let resent = 0;
  for (const ref of refs) {
    try {
      const read = await applicantTrackFactsOf(deps, ref);
      if (!read || read.facts.decided) continue;
      const { now } = trackStates(read.facts);
      if (!isLetterStage(now)) continue;
      const tries = await attemptsOf(deps, ref, now);
      if (!tries.length || tries.some(Boolean) || tries.length > STAGE_LETTER_RETRIES) continue;
      if (await tellStageLetter(deps, ref, tries.length)) resent++;
    } catch (e) {
      console.error(`[open-proposals] the stage letter for ${ref} could not be tried again`, e);
    }
  }
  return resent;
}

/**
 * THE CONFIRMATION LETTER'S NEXT STEP (Received), in the same shape as every stage letter: the next step, who acts by
 * role, and the booking link only when a conversation is open now (a village that opens the first conversation as
 * the address confirms). With our review first, nothing is open yet, and the letter says our review comes next.
 */
export async function receivedNextLines(pool: Pool, ref: string, lang: ApplicantLanguage): Promise<string[]> {
  const w = wordsIn(lang);
  const open = (await review.interviewsOf(pool, ref)).find((i) => i.state === "open" && !i.final);
  if (open) {
    const step = await stepBookingOf(pool, ref, open.roleId);
    const links = bookingLinksText(step.links);
    return [w.shape.next, `- ${links ? w.shape.receivedBook(step.label, links) : w.shape.receivedWrite(step.label)}`, `- ${w.shape.refineAnyTime(await review.anchorCircleName(pool))}`, "", w.shape.who, w.shape.youBook(step.label)];
  }
  const welcome = await roleWord({ getPool: () => pool }, stringVar("org.onboarding_role"));
  return [w.shape.next, `- ${w.shape.receivedReview}`, `- ${w.shape.refineAnyTime(await review.anchorCircleName(pool))}`, "", w.shape.who, w.shape.receivedWho(welcome)];
}

/**
 * THE ONE REMINDER TO BOOK (server/lib/applicantNudges.ts): a conversation still open, with its own booking link, once
 * per conversation. True when it went now. Never a later step's link: only the conversation named.
 */
export async function tellBookingNudge(deps: TellDeps, ref: string, interviewId: number): Promise<boolean> {
  try {
    const pool = deps.getPool();
    const p = await proposals.readOpenProposal(pool, ref);
    if (!p || !p.email || p.status !== "confirmed") return false;
    const iv = (await review.interviewsOf(pool, ref)).find((i) => i.id === interviewId);
    if (!iv || iv.state !== "open") return false;
    const step = await stepBookingOf(pool, ref, iv.roleId);
    const words = bookingNudgeLetter({ firstName: greetingName(p.name), role: step.label, links: step.links.map((l) => l.url), statusLink: await statusLinkFor(deps, ref), lang: languageOf(p) });
    const name = greetingName(p.name);
    const framed = await framedLetter(deps, languageOf(p), words, statusLinkIn(words.text));
    const sent = await deps.postEmail({
      idempotencyKey: bookingNudgeKey(ref, interviewId),
      kind: "essential",
      origin: "open_proposal.nudge",
      to: { email: p.email, ...(name ? { name } : {}) },
      subject: words.subject,
      ...framed,
    });
    return WENT_NOW.has(sent.status);
  } catch (e) {
    console.error(`[open-proposals] the booking reminder for ${ref} was not sent`, e);
    return false;
  }
}

/** The one letter after the applicant first refines their proposal. True when it went now. */
export async function tellRefinedLetter(deps: TellDeps, ref: string): Promise<boolean> {
  try {
    const pool = deps.getPool();
    const p = await proposals.readOpenProposal(pool, ref);
    if (!p || !p.email || p.status !== "confirmed") return false;
    const read = await applicantTrackFactsOf(deps, ref);
    if (!read || read.facts.decided) return false;
    const { now } = trackStates(read.facts);
    const words = stageLetter({
      kind: "refined",
      firstName: greetingName(p.name),
      roleNames: await roleNamesOf(deps, p),
      booking: null,
      followupRole: null,
      finalCallRole: null,
      anchorCircle: await review.anchorCircleName(pool),
      referencesOpen: false,
      refineOpen: mayRefine({ stage: now, decided: false, finalFrozen: finalFreezes({ sentToCircle: read.facts.sentToCircle ?? false }) }),
      statusLink: await statusLinkFor(deps, ref),
      lang: languageOf(p),
    });
    return await send(deps, p, "refined", words);
  } catch (e) {
    console.error(`[open-proposals] the refined letter for ${ref} was not sent`, e);
    return false;
  }
}
