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
import { stageLetter, stageLetterKey, STAGE_LETTER_STAGES, type StageLetterKind, type StageLetterStage } from "../../shared/applicantStageLetters";
import { finalFreezes, mayRefine } from "../../shared/proposalRefine";
import { ROLE_SHORT_LABELS_VARIABLE, roleShortLabel } from "../../shared/roleShortLabel";
import * as proposals from "../repos/openProposals";
import * as review from "../repos/applicationReview";
import { trustedAccountFor } from "./applicantAccount";
import { languageOf } from "./applicantLanguage";
import { applicantTrackFactsOf } from "./applicantOnboarding";
import { stepBookingOf } from "./applicationReview";
import { plainLetterHtml } from "./letterHtml";
import { statusLinkFor, withoutStatusLink, type TellDeps } from "./applicantUpdates";
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

/** Send one letter (and ring the bell). True when the letter went now. */
async function send(deps: TellDeps, p: proposals.StoredOpenProposal, kind: StageLetterKind, words: { subject: string; text: string }): Promise<boolean> {
  if (!p.email) return false;
  const name = greetingName(p.name);
  const sent = await deps.postEmail({
    idempotencyKey: stageLetterKey(p.id, kind),
    kind: "essential",
    origin: "open_proposal.stage",
    to: { email: p.email, ...(name ? { name } : {}) },
    subject: words.subject,
    html: plainLetterHtml(words.text),
    text: words.text,
  });
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
export async function tellStageLetter(deps: TellDeps, ref: string): Promise<boolean> {
  try {
    const pool = deps.getPool();
    const p = await proposals.readOpenProposal(pool, ref);
    if (!p || !p.email || p.status !== "confirmed") return false;
    const read = await applicantTrackFactsOf(deps, ref);
    if (!read || read.facts.decided) return false;
    const { now } = trackStates(read.facts);
    if (!isLetterStage(now)) return false;
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
      refineOpen: mayRefine({ stage: now, decided: false, finalFrozen: finalFreezes(read.finals) }),
      statusLink: statusLinkFor(deps, ref),
      profileLink: account && origin ? `${origin}/profile` : null,
      lang: languageOf(p),
    });
    return await send(deps, p, now, words);
  } catch (e) {
    console.error(`[open-proposals] the stage letter for ${ref} was not sent`, e);
    return false;
  }
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
    return [w.shape.next, links ? w.shape.receivedBook(step.label, links) : w.shape.receivedWrite(step.label), "", w.shape.who, w.shape.youBook(step.label)];
  }
  const welcome = await roleWord({ getPool: () => pool }, stringVar("org.onboarding_role"));
  return [w.shape.next, w.shape.receivedReview, "", w.shape.who, w.shape.receivedWho(welcome)];
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
      refineOpen: mayRefine({ stage: now, decided: false, finalFrozen: finalFreezes(read.finals) }),
      statusLink: statusLinkFor(deps, ref),
      lang: languageOf(p),
    });
    return await send(deps, p, "refined", words);
  } catch (e) {
    console.error(`[open-proposals] the refined letter for ${ref} was not sent`, e);
    return false;
  }
}
