/**
 * A WORD BEFORE AN AGENT'S PROPOSAL LAPSES (the review page audit, 26 Nov 2026).
 *
 * An agent's seating or setting lapses seven days after it was filed if nobody decides it (`expireOld`,
 * shared/approvalInbox.ts), and nothing said so first. Once an hour this tells whoever may decide it, one day before,
 * on the bell: "lapses tomorrow if nobody decides it", with the door to /approvals.
 *
 * Who hears: the people who may already open that inbox and nobody else (the coordinator: no new recipients). The
 * notice type is `approval_lapsing`, which is in-app only in `emailCadenceFor` (server/lib/notify.ts), so it sends no
 * new kind of email, and every person's notice preferences apply as they do to every notice.
 *
 * One notice per proposal and person, ever: the dedupe key is `approval-lapse:<proposal>:<person>`, and notify.ts's
 * unique key makes a second hourly pass a no-op. A seating's own words may name a person, so its notice says only that
 * a seating lapses; every other kind gives its title.
 */
import type { Pool } from "mysql2/promise";
import { EXPIRES_AFTER_MS } from "../../shared/approvalInbox";
import { listFiledBetween } from "../repos/agentProposals";
import { registerJob } from "./scheduler";
import { READERS } from "../routes/approvalInbox";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LapseNoticeDeps {
  pool: Pool;
  now(): Date;
  /** Everyone who may open the approval inbox: admins and live holders of its powers. */
  deciders(): Promise<string[]>;
  notify(input: { userId: string; type: string; title: string; link: string; dedupeKey: string }): Promise<unknown>;
}

/** The notice's words for one proposal. */
export function lapseNoticeTitle(p: { kind: string; title: string }): string {
  if (p.kind === "seating") return "A proposed seating lapses tomorrow if nobody decides it";
  const what = p.title.trim() || "A proposal";
  return `"${what.slice(0, 120)}" lapses tomorrow if nobody decides it`;
}

/** One pass: every proposal that lapses within the next day, told once to each person who may decide it. */
export async function noticeLapsingApprovals(deps: LapseNoticeDeps): Promise<number> {
  const now = deps.now().getTime();
  // Lapsing in (now, now + one day]: filed in (now - 7 days, now - 6 days].
  const lapsing = await listFiledBetween(deps.pool, new Date(now - EXPIRES_AFTER_MS), new Date(now - EXPIRES_AFTER_MS + DAY_MS));
  if (!lapsing.length) return 0;
  const people = Array.from(new Set(await deps.deciders()));
  let sent = 0;
  for (const p of lapsing) {
    for (const userId of people) {
      try {
        await deps.notify({ userId, type: "approval_lapsing", title: lapseNoticeTitle(p), link: "/approvals", dedupeKey: `approval-lapse:${p.id}:${userId}` });
        sent += 1;
      } catch (e) {
        // One person's bell failing never stops the rest hearing.
        console.error(`[approvals] the lapse notice for ${p.id} could not reach ${userId}:`, e);
      }
    }
  }
  return sent;
}

/**
 * Registers the hourly pass. Called once from server/index.ts, so the index carries one line: everything the pass
 * needs is handed in here, and who may decide is the inbox's own rule (an admin or founder, or a live holder of one of
 * its powers, `READERS` in server/routes/approvalInbox.ts).
 */
export function registerApprovalLapseNotice(deps: {
  getPool(): Pool;
  members: { all(): Promise<any[]> };
  liveHoldersOf(capability: string): Promise<string[]>;
  notify(input: { userId: string; type: string; title: string; link: string; dedupeKey: string }): Promise<unknown>;
}): void {
  registerJob("approval-lapse-notice", 60 * 60 * 1000, async () => {
    const sent = await noticeLapsingApprovals({
      pool: deps.getPool(),
      now: () => new Date(),
      deciders: async () => {
        const admins = (await deps.members.all()).filter((u: any) => u.role === "admin" || u.role === "founder").map((u: any) => String(u.id));
        const holders = (await Promise.all(READERS.map((c) => deps.liveHoldersOf(c)))).flat();
        return [...admins, ...holders];
      },
      notify: (input) => deps.notify(input),
    });
    return sent ? `${sent} lapse notice(s)` : undefined;
  });
}
