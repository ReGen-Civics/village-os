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
import { FINAL_CALL_ROLE_VARIABLE, FOLLOWUP_ROLE_VARIABLE, mayGoToCircle, trackStates } from "../../shared/applicantOnboarding";
import { bookingNudgeKey, bookingNudgeLetter, stageLetter, stageLetterKey, STAGE_LETTER_STAGES, type StageLetterKind, type StageLetterStage } from "../../shared/applicantStageLetters";
import { finalFreezes, mayRefine } from "../../shared/proposalRefine";
import { ROLE_SHORT_LABELS_VARIABLE, roleShortLabel } from "../../shared/roleShortLabel";
import * as proposals from "../repos/openProposals";
import * as review from "../repos/applicationReview";
import { trustedAccountFor } from "./applicantAccount";
import { languageOf } from "./applicantLanguage";
import { applicantTrackFactsOf } from "./applicantOnboarding";
import { stepBookingOf } from "./applicationReview";
import { framedLetter, framedLetterWithButton, statusLinkFor, statusLinkIn, withoutStatusLink, type LetterLink, type TellDeps } from "./applicantUpdates";
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

/** A pending attempt this old is taken as lost (a restart mid-send) and tried again. */
const PENDING_LOST_MS = 15 * 60_000;

/** One attempt at a stage's letter: whether it went (null while its post has not answered), and when it began. */
type Attempt = { went: boolean | null; at: number };

/** The attempts at one stage's letter, oldest first. */
async function attemptsOf(deps: Pick<TellDeps, "getPool">, ref: string, kind: StageLetterKind): Promise<Attempt[]> {
  const steps = (await review.stepsOf(deps.getPool(), ref)).filter((s) => s.kind === "stage_mail" && s.subject.startsWith(`${kind}:`));
  return steps
    .sort((a, b) => Number(a.subject.split(":")[1]) - Number(b.subject.split(":")[1]))
    .map((s) => ({ went: s.detail?.went === true ? true : s.detail?.went === false ? false : null, at: s.at.getTime() }));
}

/** The one booking reminder's key, per conversation (shared/applicantStageLetters.ts `bookingNudgeKey`, written here so the economics reader can follow it). */
function nudgeKey(ref: string, interviewId: number): string {
  return `open-proposal:${ref}:nudge:book:${interviewId}`;
}

/** The key of one attempt: the stage's own key first, then one of its own for each retry. */
function attemptKey(ref: string, kind: StageLetterKind, attempt: number): string {
  return attempt ? `open-proposal:${ref}:stage:${kind}:r${attempt}` : `open-proposal:${ref}:stage:${kind}`;
}

/**
 * Send one letter (and ring the bell). True when the letter went now. `attempt` 0 is the first; a retry keys its own.
 * THE ATTEMPT IS WRITTEN BEFORE THE POST (QA round 5): a pending row first, so two triggers at once post once (the
 * second finds the row and stops), and a restart mid-send leaves a row the retry pass can see. The row is updated with
 * the post's answer; an answer of `duplicate` means this key went before, and counts as gone, never as a new attempt.
 */
async function send(deps: TellDeps, p: proposals.StoredOpenProposal, kind: StageLetterKind, words: { subject: string; text: string }, attempt = 0, links: readonly LetterLink[] = []): Promise<boolean> {
  if (!p.email) return false;
  const pool = deps.getPool();
  const recorded = STAGE_LETTER_STAGES.includes(kind as StageLetterStage);
  const subject = `${kind}:${attempt}`;
  if (recorded && !(await review.stampStep(pool, { ref: p.id, kind: "stage_mail", subject, at: new Date(), detail: { went: null, status: "pending" } }))) return false;
  const name = greetingName(p.name);
  const lang = languageOf(p);
  // The page by its words, wherever the letter names it, and each booking as a button (QA round 5, item 9).
  const page = statusLinkIn(words.text) ?? (/https?:\/\/\S+\/application-status\/\S+/.exec(words.text)?.[0] ?? null);
  const framed = await framedLetter(deps, lang, words, statusLinkIn(words.text), [...(page ? [{ url: page, label: wordsIn(lang).shape.seePage }] : []), ...links]);
  let status: PostResult["status"] | "error" = "error";
  try {
    status = (
      await deps.postEmail({
        idempotencyKey: attemptKey(p.id, kind, attempt),
        kind: "essential",
        origin: "open_proposal.stage",
        to: { email: p.email, ...(name ? { name } : {}) },
        subject: words.subject,
        ...framed,
        // `html` by name: the economics reader tells an email from a ledger posting by it.
        html: framed.html,
      })
    ).status;
  } finally {
    const went = status !== "error" && (WENT_NOW.has(status) || status === "queued" || status === "rehearsed" || status === "duplicate");
    if (recorded) await review.setStepDetail(pool, p.id, "stage_mail", subject, { went, status });
  }
  const went = WENT_NOW.has(status as PostResult["status"]) || status === "queued" || status === "rehearsed";
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
  return went;
}

/** The roles the application is for, by name, for "your application to hold ...". */
async function roleNamesOf(deps: Pick<TellDeps, "getPool">, p: proposals.StoredOpenProposal): Promise<string[]> {
  const names = await review.roleNamesById(deps.getPool(), p.body.roles.map((r) => r.roleId));
  return p.body.roles.map((r) => names.get(r.roleId) ?? "").filter(Boolean);
}

/**
 * The stage's letter, when the application stands at a stage that has one and its letter has not gone. Never throws:
 * a letter that did not go is logged, and the act it follows has already happened.
 *
 * WHAT IT ANSWERS (QA round 5): whether the stage's letter COVERS this moment, so the caller sends no other letter
 * beside it. True when it went now, when it was already tried (the retry pass owns it then), and when References and
 * proposal's letter is held for what it must carry. A retry (`attempt` above 0) answers whether it went.
 *
 * ONE LETTER AT REFERENCES, IN EITHER ORDER: its letter carries the references ask AND the conversation after Ops,
 * so it waits until the references are asked for and the first conversation is written up. Whichever comes second
 * sends it; nothing else goes at this stage.
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
    if (attempt === 0 && (await attemptsOf(deps, ref, now)).length > 0) return true;
    if (now === "references") {
      const talks = read.facts.interviews.filter((i) => !i.final);
      const firstDone = !talks.length || talks[0].state === "scored" || talks[0].state === "skipped";
      if (!(read.facts.refsAsked || read.facts.refsGiven) || !firstDone) return attempt === 0;
    }
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
    const bookNow = step ? wordsIn(languageOf(p)).status.booking.bookNow(step.label) : "";
    const went = await send(deps, p, now, words, attempt, step ? step.links.map((l) => ({ url: l.url, label: bookNow, pill: true })) : []);
    // The first attempt covers the moment whether or not the provider took it: a fault is the retry pass's.
    return attempt === 0 ? (await attemptsOf(deps, ref, now)).length > 0 : went;
  } catch (e) {
    console.error(`[open-proposals] the stage letter for ${ref} was not sent`, e);
    return attempt === 0 ? (await attemptsOf(deps, ref, (await stageNowOf(deps, ref)) ?? "references").catch(() => [])).length > 0 : false;
  }
}

/** The letter stage an application stands at, or null. */
async function stageNowOf(deps: TellDeps, ref: string): Promise<StageLetterStage | null> {
  const read = await applicantTrackFactsOf(deps, ref);
  if (!read) return null;
  const { now } = trackStates(read.facts);
  return isLetterStage(now) ? now : null;
}

/** The ready letter's words (QA round 5, item 8), in the applicant's language. */
const READY: Record<ApplicantLanguage, { subject: string; line(circle: string): string; button: string }> = {
  en: {
    subject: "Your final conversation is written up",
    line: (circle) => `Refine your proposal, then send it to ${circle}. It's fixed once you send it, and ${circle} reviews it from there.`,
    button: "Refine and send it",
  },
  es: {
    subject: "Su conversación final está escrita", // needs-native-review: QA round 5
    line: (circle) => `Mejore su propuesta y luego envíela a ${circle}. Queda fija una vez que la envíe, y ${circle} la revisa desde ahí.`, // needs-native-review: QA round 5
    button: "Mejorarla y enviarla", // needs-native-review: QA round 5
  },
};

/** The ready letter's key: once per application. */
function readyKey(ref: string): string {
  return `open-proposal:${ref}:to-circle-ready`;
}

/**
 * RULING 7'S LETTER (QA round 5, item 8): once the final conversation is written up, "Refine your proposal, then send
 * it to the Anchor Circle", with its page as the button. Once; only while the proposal may still go.
 */
export async function tellReadyToSend(deps: TellDeps, ref: string): Promise<boolean> {
  try {
    const pool = deps.getPool();
    const p = await proposals.readOpenProposal(pool, ref);
    if (!p || !p.email || p.status !== "confirmed") return false;
    const read = await applicantTrackFactsOf(deps, ref);
    if (!read || !mayGoToCircle(read.facts)) return false;
    const lang = languageOf(p);
    const anchor = await review.anchorCircleName(pool);
    const circle = anchor ? (/^the\s/i.test(anchor) ? anchor : lang === "es" ? `el ${anchor}` : `the ${anchor}`) : lang === "es" ? "el círculo ancla" : "the anchor circle";
    const w = READY[lang];
    const link = await statusLinkFor(deps, ref);
    const text = [wordsIn(lang).hello(greetingName(p.name)), "", w.line(circle), ""].join("\n");
    const name = greetingName(p.name);
    const framed = await framedLetter(deps, lang, { subject: w.subject, text }, null);
    const dressed = link ? await framedLetterWithButton(deps, lang, w.subject, text, { label: w.button, url: link }) : framed;
    const sent = await deps.postEmail({ idempotencyKey: readyKey(ref), kind: "essential", origin: "open_proposal.stage", to: { email: p.email, ...(name ? { name } : {}) }, subject: w.subject, ...dressed, html: dressed.html });
    return WENT_NOW.has(sent.status);
  } catch (e) {
    console.error(`[open-proposals] the ready letter for ${ref} was not sent`, e);
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
      // Gone once: never again. Still pending and recent: its post may yet answer. Pending and old: lost in a restart.
      const lost = (t: Attempt) => t.went === false || (t.went === null && Date.now() - t.at > PENDING_LOST_MS);
      if (!tries.length || tries.some((t) => t.went === true) || !tries.every(lost) || tries.length > STAGE_LETTER_RETRIES) continue;
      if (await tellStageLetter(deps, ref, tries.length)) resent++;
    } catch (e) {
      console.error(`[open-proposals] the stage letter for ${ref} could not be tried again`, e);
    }
  }
  return resent;
}

/** The open conversation's booking, as a letter's buttons ("Book with Ops"): for the Received letter. */
export async function openBookingLinks(pool: Pool, ref: string, lang: ApplicantLanguage): Promise<LetterLink[]> {
  const open = (await review.interviewsOf(pool, ref)).find((i) => i.state === "open" && !i.final);
  if (!open) return [];
  const step = await stepBookingOf(pool, ref, open.roleId);
  const label = wordsIn(lang).status.booking.bookNow(step.label);
  return step.links.map((l) => ({ url: l.url, label, pill: true }));
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
    // Nothing to book yet: they write with times, so "you book the time" is not said beside it (QA round 5).
    return [w.shape.next, `- ${links ? w.shape.receivedBook(step.label, links) : w.shape.receivedWrite(step.label)}`, `- ${w.shape.refineAnyTime(await review.anchorCircleName(pool))}`, "", w.shape.who, links ? w.shape.youBook(step.label) : w.shape.receivedWho(step.label)];
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
    const bookNow = wordsIn(languageOf(p)).status.booking.bookNow(step.label);
    const framed = await framedLetter(deps, languageOf(p), words, statusLinkIn(words.text), step.links.map((l) => ({ url: l.url, label: bookNow, pill: true })));
    const sent = await deps.postEmail({
      idempotencyKey: nudgeKey(ref, interviewId),
      kind: "essential",
      origin: "open_proposal.nudge",
      to: { email: p.email, ...(name ? { name } : {}) },
      subject: words.subject,
      ...framed,
      html: framed.html,
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
