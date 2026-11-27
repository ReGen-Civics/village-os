/**
 * THREE APPLICANT FOLLOW-UPS (the Operations lead's approval, 15 Nov 2026).
 *
 * 1. THE NEW-INVITATION DOOR. An adopted applicant whose invitation expired
 *    unused sees "send me a new invitation" on their status page. Pressing it
 *    records the ask once and tells the holders who make invitations, by a
 *    stable key per application and holder. It NEVER makes an invitation: a
 *    holder does that on the proposal's page (POST /api/governance/open-proposals/:id/invitation).
 *
 * 2. THE CLOSED LETTER. The tidy job already closes an application nobody
 *    decided in time (server/routes/openProposals.ts `tidyOpenProposals`). Before
 *    the close takes the address off, this sends one letter through the post
 *    office, keyed `open-proposal:<id>:closed`, so a retried run is a duplicate
 *    and never a second letter. After the close it stamps the review's
 *    "decided" step as withdrawn and quiet, so the status page says "closed"
 *    and never "you withdrew". The job asks nothing and decides no value: the
 *    close was already the rule, and this only says so to the person.
 *
 * (3, the draft remembered on the visitor's device, is client-only:
 * client/src/components/fireflyPath/applyRemember.ts.)
 *
 * This file imports repositories only, never server/lib/openProposalDecide.ts,
 * which imports the review lib that reads `invitationDoorOf`: the holders'
 * rule is handed in.
 */
import type { Pool } from "mysql2/promise";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { closedLetter, DECIDE_WORDS, greetingName, openInviteId, openProposalHref } from "../../shared/openProposalDecide";
import type { HandOpenerRule } from "../../shared/powerHands";
import { inviteById } from "../repos/memberInvites";
import * as store from "../repos/openProposals";
import * as review from "../repos/applicationReview";
import { languageOf } from "./applicantLanguage";
import { statusLinkFor } from "./applicantUpdates";
import { escapeHtml } from "./comms/mailer";
import { plainLetterHtml } from "./letterHtml";
import type { NotifyInput } from "./notify";
import { WENT } from "./openProposalKept";

// ── 1. The new-invitation door ──────────────────────────────────────────────

/** What the status page offers about the invitation: nothing, the door, or the kind confirmation once asked. */
export type InvitationDoor = "none" | "expired" | "asked";

/**
 * The door shows only for an adopted proposal that made an invitation, still
 * holds its address, and whose invitation expired unused and was never
 * withdrawn by a holder. A used, open or withdrawn invitation shows nothing.
 */
export async function invitationDoorOf(pool: Pool, p: Pick<store.StoredOpenProposal, "id" | "status" | "email">): Promise<InvitationDoor> {
  if (p.status !== "adopted" || !p.email) return "none";
  const inv = await inviteById(pool, openInviteId(p.id));
  if (!inv || inv.usedByUserId || inv.revokedAt || !inv.expired) return "none";
  return (await store.newInvitationAskedOf(pool, p.id)) ? "asked" : "expired";
}

export interface AskDeps {
  getPool(): Pool;
  notify(input: NotifyInput): Promise<unknown>;
  notifyAdmins(type: string, title: string, dedupeKey: string, link?: string): Promise<void>;
  now(): Date;
  /** Who may make a new invitation: the adopting power's rule (server/lib/openProposalDecide.ts `decideRule`). */
  rule(): Promise<HandOpenerRule>;
}

export type AskOutcome = { ok: true; door: "asked" } | { ok: false; status: 404 | 409 };

/**
 * The applicant asks. Recorded once, and the holders told with one stable key
 * per application and holder, so pressing twice, or a retry after a fault
 * between the two writes, tells nobody twice. No live holder (the village holds
 * the power, or nobody is in the role): the admins hear it instead.
 */
export async function askForNewInvitation(deps: AskDeps, ref: string): Promise<AskOutcome> {
  const pool = deps.getPool();
  const p = await store.readOpenProposal(pool, ref);
  if (!p) return { ok: false, status: 404 };
  const door = await invitationDoorOf(pool, p);
  if (door === "none") return { ok: false, status: 409 };
  await store.noteNewInvitationAsked(pool, p.id, deps.now());
  const names = await review.roleNamesById(pool, p.body.roles.map((r) => r.roleId));
  const roles = p.body.roles.map((r) => names.get(r.roleId) ?? r.roleId);
  const title = DECIDE_WORDS.newInvitationAskedNotice(roles.join(", "));
  const link = openProposalHref(p.id);
  const key = `open-proposal:${p.id}:new-invitation-asked`;
  const rule = await deps.rule();
  if (rule.who === "live-holders" && rule.holders.length) {
    for (const userId of rule.holders) {
      await deps.notify({ userId, type: "application_new_invitation_asked", title, link, actorUserId: null, dedupeKey: `${key}:${userId}` });
    }
  } else {
    await deps.notifyAdmins("application_new_invitation_asked", title, key, link);
  }
  return { ok: true, door: "asked" };
}

// ── 2. The closed letter ────────────────────────────────────────────────────

export interface ClosingDeps {
  postEmail(email: OutgoingEmail): Promise<PostResult>;
  projectName(): string;
  siteUrl(): string;
  /** The role that welcomes people (`org.onboarding_role`), whose team signs the letter. Empty: the village's name signs. */
  onboardingRole(): string;
  /**
   * THE ONE HOOK FOR THE "COME AND PLAY" BLOCK: the tidy job passes
   * `comeAndPlayFor` (server/lib/comms/villageLetter.ts), which returns
   * `{ html, text }`, placed under the letter's own words. It may answer a
   * promise, because the block reads the village's look. Absent: the letter
   * goes without it.
   */
  footer?(ctx: { village: string; site: string; lang: ReturnType<typeof languageOf> }): { html: string; text: string } | null | Promise<{ html: string; text: string } | null>;
}

/** The letter's idempotency key: one per application, whatever runs it again. */
export const closedLetterKey = (id: string): string => `open-proposal:${id}:closed`;

/**
 * THE CLOSED LETTER'S ONE TEMPLATE, as the post office takes it: the words are
 * `closedLetter` (shared/openProposalDecide.ts), the shared "come and play"
 * block drops in through `deps.footer`. Null when there is no address to write to.
 */
export async function closedEmailFor(pool: Pool, deps: ClosingDeps, p: store.StoredOpenProposal): Promise<OutgoingEmail | null> {
  if (!p.email) return null;
  const roleIds = p.body.roles.map((r) => r.roleId);
  const teamRole = deps.onboardingRole().trim();
  const names = await review.roleNamesById(pool, teamRole ? [...roleIds, teamRole] : roleIds);
  const village = deps.projectName();
  const site = deps.siteUrl().replace(/\/+$/, "");
  const firstName = greetingName(p.name);
  const words = closedLetter({
    firstName,
    village,
    roleNames: roleIds.map((id) => names.get(id) ?? "").filter(Boolean),
    site,
    team: (teamRole && names.get(teamRole)) || village,
    // The page closes with the application (its details go now), so the letter points nowhere it cannot keep.
    statusLink: null,
    lang: languageOf(p),
  });
  const block = (await deps.footer?.({ village, site, lang: languageOf(p) })) ?? null;
  const footer = block && block.html ? block : null;

  const text = footer ? `${words.text}\n${footer.text}\n` : words.text;
  return {
    idempotencyKey: closedLetterKey(p.id),
    kind: "essential",
    origin: "open_proposal.closed",
    to: { email: p.email, ...(firstName ? { name: firstName } : {}) },
    subject: words.subject,
    // Every address a link (server/lib/letterHtml.ts), the footer block after.
    html: plainLetterHtml(words.text, { after: footer ? footer.html : "" }),
    text,
  };
}

/**
 * Send the closed letter to each proposal about to be closed. A send that does
 * not go is logged and the close still happens: the form promised the name and
 * address go at this age, and that promise is kept first. How many went.
 */
export async function sendClosedLetters(pool: Pool, deps: ClosingDeps, due: readonly store.StoredOpenProposal[]): Promise<number> {
  let went = 0;
  for (const p of due) {
    try {
      const email = await closedEmailFor(pool, deps, p);
      if (!email) continue;
      const r = await deps.postEmail(email);
      if (WENT.has(r.status)) went += 1;
      else console.warn(`[open-proposals] the closed letter for ${p.id} did not go: ${r.status}`);
    } catch (e) {
      console.warn(`[open-proposals] the closed letter for ${p.id} did not go: ${String((e as Error)?.message ?? e)}`);
    }
  }
  return went;
}

/**
 * After the close: the review's "decided" step, as withdrawn and quiet, so the
 * status page shows the closed card. Stamped once (the step's unique key), and
 * only where the review began, as `stampDecided` does.
 */
export async function stampQuietClose(pool: Pool, ids: readonly string[], at: Date): Promise<void> {
  for (const ref of ids) {
    try {
      if (!(await review.stepsOf(pool, ref)).some((s) => s.kind === "confirmed")) continue;
      await review.stampStep(pool, { ref, kind: "decided", at, detail: { how: "withdrawn", quiet: true } });
    } catch (e) {
      console.warn(`[open-proposals] the closed step for ${ref} was not stamped: ${String((e as Error)?.message ?? e)}`);
    }
  }
}
