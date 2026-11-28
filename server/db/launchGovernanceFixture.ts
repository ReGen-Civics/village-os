/**
 * THE GOVERNANCE ROWS, CLEARED THE WAY A FOUNDER CLEARS THEM (2026-09-27).
 *
 * For the e2e suites that open a launch vote. Every one of them builds a
 * village whose checklist reads done before it asks the village to start, and
 * the launch checklist gained three blocking rows that no earlier setup
 * satisfied: every canvas block on record, a door for a conflict with a
 * promised reply, and governance open to members. The last is already done by
 * each suite (it turns governance on for members first). This file does the
 * other two through the real routes, so a suite passing here passed the same
 * doors a founder walks through.
 *
 *   recordEveryCanvasBlock   switches the Governance Canvas module on for
 *                            members through the real lifecycle route (it is
 *                            an optional module, off by default, and its
 *                            launch row applies only while it is on: Rye's
 *                            module ruling, 2026-10-01), then one reading per
 *                            block, at Absent, with its sentence: "not decided
 *                            yet, because..." is a reading, and it is the
 *                            cheapest honest one.
 *   CONFLICT_DOOR_READY      spread into the exit policy's `restorative` body.
 *                            A named outside contact, which opens the door in
 *                            a village of any size, and a reply time the
 *                            village chose.
 *
 * The refusals themselves are not left unobserved by clearing them here: they
 * are driven row by row in server/lib/launchGovernance.db.test.ts.
 */
import { CANVAS_BLOCK_IDS } from "../../shared/governanceCanvas";
import { PURPOSE_EXAMPLE } from "../../shared/governingPurpose";

/** The call helper every launch e2e suite defines, as far as this file uses it. */
export type LaunchSuiteCall = (
  method: string,
  route: string,
  opts?: { body?: unknown; token?: string | null },
) => Promise<{ status: number; json: any }>;

/** The three conflict-door fields, answered. Spread into `restorative`. */
export const CONFLICT_DOOR_READY = {
  replyHours: 48,
  outsideContact: { name: "Jo Bell", organisation: "Cohort Care", howToReach: "ombuds@example.test" },
} as const;

/**
 * One reading of every canvas block, as the signed-in founder (who holds the
 * canvas pen before the handover). Throws naming the block on any refusal,
 * so a suite never proceeds on a checklist it believes is clear.
 */
export async function recordEveryCanvasBlock(call: LaunchSuiteCall): Promise<void> {
  const on = await call("PUT", "/api/admin/modules/canvas/lifecycle", { body: { lifecycle: "members" } });
  if (on.status !== 200) throw new Error(`switching the canvas on answered ${on.status}: ${JSON.stringify(on.json)}`);
  for (const blockId of CANVAS_BLOCK_IDS) {
    const r = await call("POST", "/api/canvas/readings", {
      body: {
        blockId,
        level: 1,
        sentence: "Not decided yet, because we have not sat down with it together.",
        moment: "baseline",
      },
    });
    if (r.status !== 201) {
      throw new Error(`recording a reading of "${blockId}" answered ${r.status}: ${JSON.stringify(r.json)}`);
    }
  }
}

/**
 * RAISE THESE ACCOUNTS TO FOUNDER, the way a founder does it before launch.
 *
 * Only founders vote on the launch, and it carries on three founder yeses
 * (Rye, 2026-11-27), so a suite that launches a village needs three of them.
 * Through the real route, as the suite's signed-in founder. A registered
 * account never proved its address by a claim link, and the route asks the
 * founder to say they know (R104), which `addressUnprovedOk` is.
 */
export async function makeFounders(call: LaunchSuiteCall, userIds: readonly string[]): Promise<void> {
  for (const id of userIds) {
    const r = await call("PUT", `/api/admin/users/${id}/role`, { body: { role: "founder", addressUnprovedOk: true } });
    if (r.status !== 200) throw new Error(`making ${id} a founder answered ${r.status}: ${JSON.stringify(r.json)}`);
  }
}

/**
 * PUT THEM BACK AS MEMBERS, after the launch has carried.
 *
 * For a suite whose later cases were written about ordinary members. After
 * launch any administrator may change a role, and the last-admin guard is met
 * while the suite's own founder keeps their reach.
 */
export async function standDown(call: LaunchSuiteCall, userIds: readonly string[]): Promise<void> {
  for (const id of userIds) {
    const r = await call("PUT", `/api/admin/users/${id}/role`, { body: { role: "member" } });
    if (r.status !== 200) throw new Error(`standing ${id} down answered ${r.status}: ${JSON.stringify(r.json)}`);
  }
}

/**
 * A VILLAGE WHOSE JOURNEY READS DONE, cleared the way a founder clears it.
 *
 * Every step a launch e2e suite runs before it may ask the vote, through the
 * real routes, as the suite's signed-in founder: governance on for members, a
 * name, an exit policy with its conflict door, closing named and adopted, the
 * backup drill confirmed, the village's clock confirmed, the issuance cap
 * answered (declined), the purpose statement written, and every canvas block
 * read. The older suites each carry their own copy of these steps; the suites
 * written from 2026-11-27 call this, so a new blocking row is added in one
 * place for them.
 *
 * Throws naming the step on any refusal, so a suite never proceeds on a
 * checklist it believes is clear.
 */
export async function clearTheJourney(call: LaunchSuiteCall, village: { name: string }): Promise<void> {
  const step = async (what: string, method: string, route: string, body: unknown, want = 200) => {
    const r = await call(method, route, { body });
    if (r.status !== want) throw new Error(`${what} answered ${r.status}: ${JSON.stringify(r.json)}`);
    return r;
  };
  await step("turning governance on for members", "PUT", "/api/admin/modules/governance/lifecycle", { lifecycle: "members", examples: false });
  await step("naming the village", "PUT", "/api/admin/brand", { project: { name: village.name, tagline: "A village on the fen", location: "Norfolk" } });
  await step("writing the exit policy", "PUT", "/api/admin/exit-policy", {
    placeholder: false,
    voluntary: {
      noticePeriodDays: 21,
      valuationMethod: `${village.name} pays out a leaving member at the value the last cycle settled, in full, within one lunation.`,
      unwindSteps: ["Bring back anything borrowed from the barn", "Finish or hand on the work you are holding", "The stewards settle what is owed and write it down"],
    },
    involuntary: {
      decidingDomainId: "",
      appealDomainId: "",
      process: "Two stewards sit with the person first. Nothing formal begins until that conversation has happened.",
    },
    restorative: {
      intakeContactRole: "",
      steps: ["Somebody who was not involved hears both people", "The village agrees what would put it right", "Whoever asked for this says whether it did"],
      ...CONFLICT_DOOR_READY,
    },
  });
  await step("naming what closing means", "PUT", "/api/admin/exit-policy/closing", {
    policyId: "own-words",
    statement: `If ${village.name} closes, the barn and the land pass to the parish trust and the cash is shared among the members still here.`,
    adopt: true,
  });
  await step("confirming the backup drill", "POST", "/api/admin/launch/confirm", { id: "backups-drilled", done: true });
  const zone = (await call("GET", "/api/admin/seasons")).json;
  await step("confirming the village's clock", "PUT", "/api/admin/seasons", {
    seasons: zone.seasons, cadence: zone.cadence, timezone: zone.timezone, confirmTimezone: true,
  });
  await step("answering the issuance cap", "POST", "/api/admin/launch/confirm", { id: "issuance-cap", done: "declined" });
  await step("writing the purpose statement", "PUT", "/api/admin/purpose", { statement: PURPOSE_EXAMPLE });
  await recordEveryCanvasBlock(call);
}
