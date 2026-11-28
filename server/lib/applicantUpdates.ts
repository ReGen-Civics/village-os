/**
 * UPDATES ABOUT A ROLE PROPOSAL, TO THE PERSON WHO MADE IT.
 *
 * Every reply and update reaches them twice: as an email to the address they
 * gave, and, once the address has an account here, as a notice on their
 * profile (type `applicant_update`, bell only, because the email already went).
 * Before they have an account it is the email alone.
 *
 * ONE SEND PER MOMENT. The email carries a stable idempotency key
 * (`open-proposal:<id>:update:<kind>[:<part>]`) and the notice a stable dedupe
 * key, so a retried door sends nothing twice. A failure is logged and never
 * the decider's problem: the step it follows has already happened.
 *
 * WHEN THE ACCOUNT COMES LATER. A proposal is linked to the account its
 * invitation makes through the invitation's own id (`openInviteId`), so
 * `carryUpdatesToAccount` writes the earlier updates onto the new profile from
 * the review's recorded steps, under the same keys the live notices use. No
 * column is needed: the steps already say what happened and when.
 *
 * LANGUAGE AND NOTE. Each update is written in the language kept on the
 * proposal (server/lib/applicantLanguage.ts), and carries the decider's note
 * when they wrote one (the proposal's `note`, plain text, escaped in the email).
 */
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { applicantUpdate, greetingName, UPDATE_EMAILS, type ApplicantUpdateKind } from "../../shared/openProposalDecide";
import * as proposals from "../repos/openProposals";
import * as review from "../repos/applicationReview";
import type { DecideDeps } from "./openProposalDecide";
import { trustedAccountFor } from "./applicantAccount";
import { numberVar } from "./variables";
import { escapeHtml } from "./comms/mailer";
import { plainLetterHtml } from "./letterHtml";
import { languageOf } from "./applicantLanguage";
import { STATUS_LINK_STARTS, wordsIn, type ApplicantLanguage } from "../../shared/applicantWords";
import { dressLetter } from "./comms/villageLetter";
import { comeAndPlayWords } from "../../shared/comms/comeAndPlay";
import { APPLICATION_CLOSE_DAYS_VARIABLE } from "../../shared/openProposals";
import { signLink } from "./comms/links";
import { replyMoonsFor, replyMoonsNow } from "./foundingFirst";
import type { BookingLink } from "../../shared/interviewBooking";

const WENT: ReadonlySet<PostResult["status"]> = new Set<PostResult["status"]>(["sending", "sent", "delivered", "duplicate"]);

export interface TellDeps extends Pick<DecideDeps, "getPool" | "members" | "notify"> {
  postEmail(email: OutgoingEmail): Promise<PostResult>;
  projectName(): string;
  /** The deployment's origin, so a letter can carry a link. Absent: the letter points to the first email's link instead. */
  siteUrl?(): string;
}

/**
 * HOW LONG THE LINK IN A LETTER WORKS (the lead, 27 Nov 2026: "Yes! status link"): the application's whole life, the
 * village's close days (default 90) plus a margin, and never less than 120 days. Once the application is closed and
 * its details removed, the page refuses every link anyway (`statusByToken`).
 */
export const STATUS_LINK_MARGIN_DAYS = 30;
/**
 * The days a link signed `now` works: the close days plus the margin, counted from when the close's clock starts
 * (`closeClockStart`: arrival, or the role's review window opening, the lead's "Yes" of 27 Nov 2026), and never less
 * than 120.
 */
export function statusLinkDays(clockStartsAt: Date | null = null, now: Date = new Date()): number {
  const ahead = clockStartsAt ? Math.max(0, Math.ceil((clockStartsAt.getTime() - now.getTime()) / 86_400_000)) : 0;
  return Math.max(120, ahead + (Math.trunc(numberVar(APPLICATION_CLOSE_DAYS_VARIABLE)) || 90) + STATUS_LINK_MARGIN_DAYS);
}

/** A link a letter shows by its words, never as a raw address: the page ("See your page") or a call's booking ("Book with Ops", a button). */
export interface LetterLink {
  url: string;
  label: string;
  /** Drawn as a small button (a booking). */
  pill?: boolean;
}

/**
 * EVERY LINK BY ITS WORDS (QA round 5: a raw link wrapped over seven lines at 375 px, and booking links were bare
 * addresses). In a letter's HTML, the address the frame linked is shown as its label; a booking is a button in the
 * village's colour. The plain text keeps the address, for a reader without HTML.
 */
export function labelLinks(html: string, links: readonly LetterLink[]): string {
  let out = html;
  for (const l of links) {
    const shown = escapeHtml(l.url).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(<a href="[^"]*")([^>]*)>${shown}</a>`, "g");
    out = out.replace(re, (_m, open: string, rest: string) => {
      // The village's colour is the link's own (the frame wrote it); the button's classes carry its dark-mode pair.
      const brand = /color:(#[0-9a-fA-F]{3,8})/.exec(rest)?.[1] ?? null;
      const style = l.pill && brand ? ` class="vl-btn vl-btn-text" style="display:inline-block;margin:6px 0;padding:10px 20px;border-radius:999px;background-color:${brand};color:#ffffff;font-weight:bold;text-decoration:none;"` : rest;
      return `${open}${style}>${escapeHtml(l.label)}</a>`;
    });
  }
  return out;
}

/**
 * AN APPLICANT LETTER IN THE INVITATION'S FRAME (QA: 15 of 39 letters overflowed 375 px, and the stage letters had no
 * frame): the village's band, "With love, The <village> team", the footer, and the status link as a "See your page"
 * button in place of a raw link. Falls back to the plain letter when the deployment cannot say its address.
 */
export async function framedLetter(
  deps: Pick<TellDeps, "getPool" | "projectName" | "siteUrl">,
  lang: ApplicantLanguage,
  words: { subject: string; text: string },
  statusLink: string | null,
  links: readonly LetterLink[] = [],
): Promise<{ html: string; text: string; preheader?: string }> {
  const origin = deps.siteUrl?.().replace(/\/+$/, "") ?? "";
  if (!origin) return { html: plainLetterHtml(words.text), text: words.text };
  const labelled = [...(statusLink ? [{ url: statusLink, label: wordsIn(lang).shape.seePage }] : []), ...links];
  try {
    const dressed = await dressLetter(
      deps.getPool(),
      origin,
      { subject: words.subject, text: statusLink ? withoutStatusLink(words.text) : words.text, button: statusLink ? { label: wordsIn(lang).shape.seePage, url: statusLink } : null },
      { lang, comeAndPlay: false, villageName: deps.projectName?.() },
    );
    // The plain text keeps the link (a reader without HTML has no button): "See your page: <link>", before the sign-off.
    let text = dressed.text;
    if (statusLink && !text.includes(statusLink)) {
      const line = `${wordsIn(lang).shape.seePage}: ${statusLink}`;
      const at = text.indexOf(comeAndPlayWords(lang).signOff);
      text = at >= 0 ? `${text.slice(0, at)}${line}\n\n${text.slice(at)}` : `${text}\n\n${line}`;
    }
    return { html: labelLinks(dressed.html, labelled), text, ...(dressed.preheader ? { preheader: dressed.preheader } : {}) };
  } catch (e) {
    console.error("[open-proposals] a letter could not be framed, so it goes plain", e);
    return { html: plainLetterHtml(words.text), text: words.text };
  }
}

/** The same frame with a button of its own words (a letter whose act is not just "See your page"). */
export async function framedLetterWithButton(
  deps: Pick<TellDeps, "getPool" | "projectName" | "siteUrl">,
  lang: ApplicantLanguage,
  subject: string,
  text: string,
  button: { label: string; url: string },
): Promise<{ html: string; text: string; preheader?: string }> {
  const origin = deps.siteUrl?.().replace(/\/+$/, "") ?? "";
  if (!origin) return { html: plainLetterHtml(`${text}\n${button.label}: ${button.url}`), text: `${text}\n${button.label}: ${button.url}` };
  const dressed = await dressLetter(deps.getPool(), origin, { subject, text, button }, { lang, comeAndPlay: false, villageName: deps.projectName?.() });
  const at = dressed.text.indexOf(comeAndPlayWords(lang).signOff);
  const line = `${button.label}: ${button.url}`;
  const plain = at >= 0 ? `${dressed.text.slice(0, at)}${line}\n\n${dressed.text.slice(at)}` : `${dressed.text}\n\n${line}`;
  return { html: dressed.html, text: plain, ...(dressed.preheader ? { preheader: dressed.preheader } : {}) };
}

/** What one update may add: which part of a kind (the position of a conversation), and facts the words use. */
export interface UpdateFacts {
  part?: string;
  withRole?: string | null;
  minutes?: number | null;
  /** The opened conversation's first booking link, https or null. */
  bookingUrl?: string | null;
  /** Every way to book it (`stepBookingOf`): one link, or one per person holding the role. */
  bookingLinks?: readonly BookingLink[];
}

/**
 * Tell the applicant one update. Its two companions send the next-step letters (server/lib/applicantStageLetters.ts):
 * `stage` the letter of the stage the application stands at, once per stage; `refined` the one letter after a first
 * refinement. Each answers true when a letter went now. A test's plain function carries neither, and tells no stage.
 */
export type TellApplicant = ((ref: string, kind: ApplicantUpdateKind, facts?: UpdateFacts) => Promise<void>) & {
  stage?: (ref: string) => Promise<boolean>;
  refined?: (ref: string) => Promise<boolean>;
  /** The one reminder to book a conversation still open (server/lib/applicantNudges.ts). */
  nudge?: (ref: string, interviewId: number) => Promise<boolean>;
  /** Stage letters a provider fault stopped, tried again (server/lib/applicantStageLetters.ts `retryStageLetters`). */
  retry?: (refs: readonly string[]) => Promise<number>;
  /** The one letter once the final is written up: refine, then send it on (server/lib/applicantStageLetters.ts). */
  ready?: (ref: string) => Promise<boolean>;
};


const keyOf = (ref: string, kind: ApplicantUpdateKind, part?: string) => `${ref}:update:${kind}${part ? `:${part}` : ""}`;

/**
 * A link to the applicant's own status page, signed for this proposal alone, working until the close's clock has run
 * (`statusLinkDays`). Null when the deployment cannot say its address.
 */
export async function statusLinkFor(deps: Pick<TellDeps, "siteUrl"> & { getPool?: TellDeps["getPool"] }, ref: string): Promise<string | null> {
  const origin = deps.siteUrl?.().replace(/\/+$/, "");
  if (!origin) return null;
  const now = new Date();
  // A link is never lost to a deadline that cannot be read: it then lives the plain days.
  let opens: Date | null = null;
  try {
    opens = deps.getPool ? review.reviewWindowOpensAt(await review.applicationDeadline(deps.getPool(), ref)) : null;
  } catch {
    opens = null;
  }
  return `${origin}/application-status/${encodeURIComponent(ref)}?token=${encodeURIComponent(signLink("application_status", { ref }, statusLinkDays(opens, now)))}`;
}

async function wordsFor(deps: Pick<TellDeps, "getPool" | "projectName" | "siteUrl">, p: proposals.StoredOpenProposal, kind: ApplicantUpdateKind, facts: UpdateFacts) {
  const names = await review.roleNamesById(deps.getPool(), p.body.roles.map((r) => r.roleId));
  return applicantUpdate(kind, {
    firstName: greetingName(p.name),
    village: deps.projectName(),
    roleNames: p.body.roles.map((r) => names.get(r.roleId) ?? "").filter(Boolean),
    // The "with us" letter tells an application for a role that opens after the founding team that the reply waits (Rye, 14 Nov 2026).
    replyMoons: kind === "confirmed" ? await replyMoonsFor(deps.getPool(), p.body.roles.map((r) => r.roleId)) : replyMoonsNow(),
    withRole: facts.withRole ?? null,
    minutes: facts.minutes ?? null,
    bookingUrl: facts.bookingUrl ?? null,
    bookingLinks: facts.bookingLinks ?? [],
    lang: languageOf(p),
    note: p.body.note ?? null,
    // Only the letters that ask the applicant to open the page carry the link; the rest never pointed there.
    statusLink: kind === "conversation" || kind === "terms" || kind === "first_reply" || kind === "consent" || kind === "references" ? await statusLinkFor(deps, p.id) : null,
  });
}

export function makeApplicantTeller(deps: TellDeps): TellApplicant {
  const tell: TellApplicant = async (ref, kind, facts = {}) => {
    try {
      const p = await proposals.readOpenProposal(deps.getPool(), ref);
      // Anonymised or unconfirmed: nobody to tell.
      if (!p || !p.email || p.status === "unconfirmed") return;
      const words = await wordsFor(deps, p, kind, facts);
      if (UPDATE_EMAILS[kind]) {
        const book = facts.withRole ? wordsIn(languageOf(p)).status.booking.bookNow(facts.withRole) : null;
        const bookings: LetterLink[] = book ? (facts.bookingLinks?.length ? facts.bookingLinks.map((l) => l.url) : facts.bookingUrl ? [facts.bookingUrl] : []).map((url) => ({ url, label: book, pill: true })) : [];
        const framed = await framedLetter(deps, languageOf(p), { subject: words.title, text: words.text }, statusLinkIn(words.text), bookings);
        const sent = await deps.postEmail({
          idempotencyKey: `open-proposal:${keyOf(ref, kind, facts.part)}`,
          kind: "essential",
          origin: "open_proposal.update",
          to: { email: p.email, ...(greetingName(p.name) ? { name: greetingName(p.name) as string } : {}) },
          subject: words.title,
          ...framed,
        });
        if (!WENT.has(sent.status)) console.warn(`[open-proposals] the ${kind} update for ${ref} did not go by email: ${sent.status}`);
      }
      // The bell only for an account the proposal is trusted to be: never one matched on an address not yet confirmed.
      const account = await trustedAccountFor(deps.members, p, deps.getPool());
      if (account) await notifyAccount(deps, account, ref, kind, facts, words);
    } catch (e) {
      console.error(`[open-proposals] the ${kind} update for ${ref} was not sent`, e);
    }
  };
  // Loaded when first used: the stage letters read the review, which reads this file's type.
  tell.stage = async (ref) => (await import("./applicantStageLetters")).tellStageLetter(deps, ref);
  tell.refined = async (ref) => (await import("./applicantStageLetters")).tellRefinedLetter(deps, ref);
  tell.nudge = async (ref, interviewId) => (await import("./applicantStageLetters")).tellBookingNudge(deps, ref, interviewId);
  tell.retry = async (refs) => (await import("./applicantStageLetters")).retryStageLetters(deps, refs);
  tell.ready = async (ref) => (await import("./applicantStageLetters")).tellReadyToSend(deps, ref);
  return tell;
}

/** Drops the "Your status page link" line (the notice carries its own link) and the blank lines around it. Split, not a regex, so a long run of newlines costs one pass. */
/** The status page link a letter's text carries on its status-link line, or null. */
export function statusLinkIn(text: string): string | null {
  for (const line of text.split("\n")) {
    if (!STATUS_LINK_STARTS.some((start) => line.startsWith(start))) continue;
    const m = /https?:\/\/\S+/.exec(line);
    if (m) return m[0];
  }
  return null;
}

export function withoutStatusLink(text: string): string {
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    if (!STATUS_LINK_STARTS.some((start) => line.startsWith(start))) { kept.push(line); continue; }
    while (kept.length && kept[kept.length - 1].trim() === "") kept.pop();
  }
  return kept.join("\n").trim();
}

async function notifyAccount(deps: Pick<TellDeps, "notify">, userId: string, ref: string, kind: ApplicantUpdateKind, facts: UpdateFacts, words: { title: string; text: string }) {
  await deps.notify({
    userId,
    type: "applicant_update",
    title: words.title,
    body: withoutStatusLink(words.text).slice(0, 1000),
    link: "/profile",
    actorUserId: null,
    dedupeKey: `op:${keyOf(ref, kind, facts.part)}:${userId}`,
  });
}

/**
 * The account an invitation just made reads the earlier updates about the
 * proposal it came from: the steps the review recorded, under the keys the live
 * notices use, so none is written twice.
 */
export async function carryUpdatesToAccount(deps: Pick<TellDeps, "getPool" | "notify" | "projectName">, proposal: proposals.StoredOpenProposal, userId: string): Promise<void> {
  const steps = await review.stepsOf(deps.getPool(), proposal.id);
  const kinds: ApplicantUpdateKind[] = [];
  if (steps.some((s) => s.kind === "confirmed")) kinds.push("confirmed");
  if (steps.some((s) => s.kind === "first_reply")) kinds.push("first_reply");
  if (steps.some((s) => s.kind === "consent")) kinds.push("consent");
  if (proposal.status === "adopted") kinds.push("adopted");
  for (const kind of kinds) {
    const words = await wordsFor(deps, proposal, kind, {});
    await notifyAccount(deps, userId, proposal.id, kind, {}, words);
  }
}
