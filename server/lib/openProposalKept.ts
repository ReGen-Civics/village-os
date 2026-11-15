/**
 * AN APPLICATION KEPT WHEN ITS CONFIRMATION EMAIL DID NOT GO (Rye, 14 Nov
 * 2026: "we still get the application even if the email is broken"). Email was
 * down for days in November and the intake deleted four real applications
 * because their confirmation could not be sent. Now:
 *
 *   1. The intake (server/routes/openProposals.ts) confirms the proposal
 *      itself, with the note `addressUnconfirmed` written in the same UPDATE
 *      (server/repos/openProposals.ts). It reaches the circle and the desk
 *      like any received application, flagged "email address not confirmed".
 *      The applicant is answered 200, in honest words, and the admins are told
 *      in the bell, never by email, because email may be what is broken.
 *   2. Every hour the tidy job's run tries the confirmation email again
 *      (`retryOwedConfirmations`), with a new link, for a kept proposal still
 *      waiting on the village. When one goes, `sentAt` is written and no more
 *      are sent. Opening that link clears the note.
 *
 * ONCE KEPT, NEVER AUTO-DELETED FOR BEING UNCONFIRMED. A kept proposal is
 * `confirmed`, which the 48-hour sweep never touches, and the sweep also skips
 * any row that carries the note. A retry that goes does not make it
 * unconfirmed again: the address simply stays not confirmed until it answers.
 * It then follows a received application's own retention (closed and
 * anonymised after 90 days undecided, or 90 days after its decision).
 *
 * WHAT THE UNCONFIRMED ADDRESS IS NOT TRUSTED FOR. Nobody has shown the
 * address is theirs, so until it answers: the membership letter is not carried
 * onto an account that has the address, the account is not told in its bell,
 * and the proposal is not adopted onto that account (DECIDE refuses it with
 * `OPEN_WORDS.addressUnconfirmedAccount`). An invitation still works: it is
 * emailed, so whoever uses it has the address.
 *
 * The abuse argument for confirmation still holds for every send that goes.
 * The honeypot and the rate limits are counted before the email is tried, so
 * an outage keeps no more proposals than the gates would have let through.
 */
import crypto from "node:crypto";
import type { Pool } from "mysql2/promise";

import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { wordsIn } from "../../shared/applicantWords";
import { confirmLetter, safeGreeting } from "../../shared/openProposals";
import type { OpenProposalTerm } from "../../shared/openProposalTerm";
import { languageOf } from "./applicantLanguage";
import { listOrgRoles } from "./orgChart";
import * as store from "../repos/openProposals";

/** A send the provider took, or one already taken under the same key. */
export const WENT: ReadonlySet<PostResult["status"]> = new Set<PostResult["status"]>(["sending", "sent", "delivered", "duplicate"]);

/** Why a skipped send may be a passing fault: the village's mail is not set up yet. */
const NOT_SET_UP: ReadonlySet<string> = new Set(["not_configured", "no_api_key", "no_sender"]);

/**
 * WHEN A SEND THAT DID NOT GO KEEPS THE APPLICATION (security sweep, 14 Nov
 * 2026). Only a fault on the village's side that can pass: the provider failed,
 * the row is queued, or mail is not set up. An address the post office refuses
 * (bounced, complained, erased, malformed) or a send that expired is the
 * address, so the application is refused as before: keeping it would confirm
 * an application to an address that can never answer.
 */
export function keepsWhenUnsent(sent: PostResult): boolean {
  if (sent.status === "failed" || sent.status === "queued") return true;
  return sent.status === "skipped" && NOT_SET_UP.has(String(sent.reason ?? ""));
}

/** How long the tidy job keeps trying the email for a kept application. After this it stays kept and flagged, and nobody is emailed. */
export const KEPT_RETRY_DAYS = 7;

export const confirmHashOf = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");
export const newConfirmToken = (): string => crypto.randomBytes(24).toString("base64url");

export interface LetterDeps {
  siteUrl(): string;
  projectName(): string;
  escapeHtml(s: string): string;
}

/** The confirmation email for one application, first time or later. `kept`: we already have it, and the words say so. */
export function confirmationEmail(
  deps: LetterDeps,
  p: { id: string; name: string; email: string; roleNames: readonly string[]; lang: ReturnType<typeof languageOf>; term: OpenProposalTerm | null | undefined },
  token: string,
  idempotencyKey: string,
  kept = false,
): OutgoingEmail {
  const w = wordsIn(p.lang);
  const firstName = safeGreeting(p.name);
  const words = confirmLetter({
    firstName,
    village: deps.projectName(),
    roleNames: p.roleNames,
    link: `${deps.siteUrl()}/propose-a-role/confirm?token=${encodeURIComponent(token)}`,
    lang: p.lang,
    // The form is for a listed role: an application (Phase A vocabulary).
    kind: "application",
    kept,
    ...(p.term ? { when: w.confirm.thisMoon(w.day(p.term.startsOn), w.day(p.term.endsOn)) } : {}),
  });
  return {
    idempotencyKey,
    kind: "essential",
    origin: "open_proposal.confirm",
    to: { email: p.email, ...(firstName ? { name: firstName } : {}) },
    subject: words.subject,
    html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f2937">${words.text
      .split("\n\n")
      .map((para) => `<p>${deps.escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
      .join("")}</body></html>`,
    text: words.text,
  };
}

/**
 * The tidy job's second half: for each kept application still waiting on the
 * village whose address has not had a confirmation email, a new link and one
 * more try. A try that does not go leaves it owed for the next hour. Never
 * throws for one application: the rest are still tried. How many went.
 */
export async function retryOwedConfirmations(
  deps: LetterDeps & { getPool(): Pool; postEmail(email: OutgoingEmail): Promise<PostResult> },
  at: Date,
): Promise<{ tried: number; went: number }> {
  const pool = deps.getPool();
  const owed = await store.owedConfirmations(pool, new Date(at.getTime() - KEPT_RETRY_DAYS * 24 * 60 * 60_000));
  if (!owed.length) return { tried: 0, went: 0 };
  const roleName = new Map((await listOrgRoles(pool)).map((r) => [r.id, r.name]));
  let went = 0;
  for (const p of owed) {
    try {
      if (!p.email) continue;
      const token = newConfirmToken();
      const hash = confirmHashOf(token);
      if (!(await store.setKeptConfirmHash(pool, p.id, hash))) continue;
      const email = confirmationEmail(
        deps,
        { id: p.id, name: p.name ?? "", email: p.email, roleNames: p.body.roles.map((r) => roleName.get(r.roleId) ?? "").filter(Boolean), lang: languageOf(p), term: p.body.term },
        token,
        // A key per try: the first try's failed row already holds the plain key, and would answer `duplicate`.
        `open-proposal:${p.id}:confirm-again:${hash.slice(0, 16)}`,
        true,
      );
      const sent = await deps.postEmail(email);
      if (WENT.has(sent.status)) {
        await store.noteKeptConfirmationSent(pool, p.id, at);
        went += 1;
      }
    } catch (e) {
      // No address in the log (the codebase keeps addresses out of logs): the id is enough to find it.
      console.error(`[open-proposals] the confirmation email for kept application ${p.id} could not be tried again`, e);
    }
  }
  return { tried: owed.length, went };
}
