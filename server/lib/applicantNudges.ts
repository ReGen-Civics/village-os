/**
 * GENTLE NUDGES (the lead, 27 Nov 2026: "yes" to nudges). Reminders only: a nudge never moves an application, writes
 * no step, and decides nothing. Each goes once, under a stable key.
 *
 *   - the applicant: one reminder when a conversation has been open `org.nudge_book_days` (default 5) and is still
 *     open, with that conversation's booking link. Booking happens on the role's own calendar, so the platform knows
 *     only what somebody said with "I've booked it" (shared/callBooked.ts): once said, no reminder goes. Without it,
 *     the letter says "if you've booked already, thank you";
 *   - the team: a heads-up to the role up next when its step has sat `org.nudge_step_days` (default 3): a conversation
 *     open and not written up, or a reference given and not followed up. A notice on the bell, never an email;
 *   - the team: a last warning `org.close_warning_days` (default 75) after an application arrived, before the
 *     90-day close (`org.application_close_days`).
 *
 * The first reply's own reminder stays on its own clock (server/lib/applicationReview.ts `reviewClockTick`).
 */
import type { Pool } from "mysql2/promise";
import { kindOfRef } from "../../shared/applicationReview";
import { APPLICATION_CLOSE_DAYS_VARIABLE } from "../../shared/openProposals";
import * as repo from "../repos/applicationReview";
import { referencesOf } from "../repos/applicantOnboarding";
import { numberVar } from "./variables";
import { isApplicant, scorecardHref, type ReviewDeps } from "./applicationReview";

export const NUDGE_VARIABLES = { book: "org.nudge_book_days", step: "org.nudge_step_days", warn: "org.close_warning_days" } as const;

const DAY = 24 * 60 * 60 * 1000;
const daysOf = (key: string, fallback: number): number => Math.max(1, Math.trunc(numberVar(key)) || fallback);

/** The team's words: English, like every team notice, and by role. */
export const NUDGE_WORDS = {
  conversation: (roles: string, days: number) => `A conversation for ${roles} has been open ${days} days and is not written up yet`,
  reference: (roles: string, days: number) => `A reference for ${roles} has waited ${days} days for its follow-up`,
  closing: (roles: string, left: number) => `An application for ${roles} closes in ${left} days unless somebody decides it`,
} as const;

async function rolesOf(pool: Pool, ref: string): Promise<string> {
  const ids = (await repo.stepsOf(pool, ref)).find((s) => s.kind === "confirmed")?.detail as { roleIds?: unknown } | undefined;
  const list = Array.isArray(ids?.roleIds) ? (ids!.roleIds as unknown[]).map(String) : [];
  const names = await repo.roleNamesById(pool, list);
  return list.map((id) => names.get(id) ?? id).join(", ") || "a role";
}

export async function nudgeTick(deps: ReviewDeps): Promise<{ applicant: number; team: number; warned: number }> {
  const pool = deps.getPool();
  const now = deps.now();
  const bookDays = daysOf(NUDGE_VARIABLES.book, 5);
  const stepDays = daysOf(NUDGE_VARIABLES.step, 3);
  const warnDays = daysOf(NUDGE_VARIABLES.warn, 75);
  const closeDays = daysOf(APPLICATION_CLOSE_DAYS_VARIABLE, 90);
  const out = { applicant: 0, team: 0, warned: 0 };
  for (const r of await repo.openReviews(pool)) {
    // Before its role's review window opens, nothing waits on the team (the lead: "we review 1-2 weeks after the
    // application deadline so a stage that waits more than 3 days would nudge").
    const deadline = await repo.applicationDeadline(pool, r.ref).catch(() => null);
    const teamWaits = repo.reviewWindowOpen(deadline, now);
    const recused = new Set(await repo.recusedUsers(pool, r.ref));
    // A nudge never reaches the applicant's own account, even when they hold the role up next (QA pass 3).
    const isTheApplicant = async (userId: string) => isApplicant(deps, r.ref, userId).catch(() => false);
    const notifyRole = async (roleId: string, title: string, key: string) => {
      for (const userId of await repo.liveHoldersOfRole(pool, roleId)) {
        if (recused.has(userId) || (await isTheApplicant(userId))) continue;
        await deps.notify({ userId, type: "application_interview_turn", title, link: scorecardHref(r.ref), actorUserId: null, dedupeKey: `${key}:${userId}` });
      }
    };
    let roles: string | null = null;
    const rolesNow = async () => (roles ??= await rolesOf(pool, r.ref));
    for (const iv of await repo.interviewsOf(pool, r.ref)) {
      if (iv.state !== "open" || !iv.openedAt) continue;
      const age = Math.floor((now.getTime() - iv.openedAt.getTime()) / DAY);
      // The applicant: once per conversation, while it is still open and nobody has said it is booked ("I've booked
      // it", shared/callBooked.ts).
      if (age >= bookDays && !iv.bookedAt && kindOfRef(r.ref) === "open" && (await deps.tellApplicant?.nudge?.(r.ref, iv.id))) out.applicant++;
      // The role up next: once per conversation, and not while its booked call is still ahead.
      const callAhead = !!iv.bookedAt && iv.bookedAt.getTime() > now.getTime();
      if (age >= stepDays && teamWaits && !callAhead) {
        await notifyRole(iv.roleId, NUDGE_WORDS.conversation(await rolesNow(), age), `app:${r.ref}:nudge:conversation:${iv.id}`);
        out.team++;
      }
    }
    // A reference given and not followed up: its owner, else its owner role.
    if (kindOfRef(r.ref) === "open") {
      for (const ref of await referencesOf(pool, r.ref)) {
        if (ref.followedUpAt || !ref.addedAt) continue;
        const age = Math.floor((now.getTime() - ref.addedAt.getTime()) / DAY);
        if (age < stepDays || !teamWaits) continue;
        const key = `app:${r.ref}:nudge:reference:${ref.id}`;
        if (ref.ownerUserId && !recused.has(ref.ownerUserId) && !(await isTheApplicant(ref.ownerUserId))) {
          await deps.notify({ userId: ref.ownerUserId, type: "application_interview_turn", title: NUDGE_WORDS.reference(await rolesNow(), age), link: scorecardHref(r.ref), actorUserId: null, dedupeKey: `${key}:${ref.ownerUserId}` });
        } else if (ref.ownerRoleId) {
          await notifyRole(ref.ownerRoleId, NUDGE_WORDS.reference(await rolesNow(), age), key);
        }
        out.team++;
      }
    }
    // The last warning before the close: the people who place roles, once. From the close's own start (arrival, or
    // the review window's opening: `closeClockStart`).
    const age = Math.floor((now.getTime() - repo.closeClockStartOf(r.confirmedAt, deadline).getTime()) / DAY);
    if (age >= warnDays && age < closeDays && kindOfRef(r.ref) === "open") {
      const title = NUDGE_WORDS.closing(await rolesNow(), closeDays - age);
      const holders: string[] = [];
      for (const u of await deps.liveHoldersOf("org.seat")) if (!recused.has(u) && !(await isTheApplicant(u))) holders.push(u);
      if (holders.length) {
        for (const userId of holders) await deps.notify({ userId, type: "application_stale", title, link: scorecardHref(r.ref), actorUserId: null, dedupeKey: `app:${r.ref}:close-warning:${userId}` });
      } else {
        await deps.notifyAdmins("governance", title, `app:${r.ref}:close-warning`, scorecardHref(r.ref));
      }
      out.warned++;
    }
  }
  return out;
}
