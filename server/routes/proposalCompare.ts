/**
 * COMPARE PROPOSALS, THE DOOR (the lead, 20 Nov 2026). Registered by the open proposals module
 * (server/routes/openProposals.ts), so server/index.ts keeps one line for the whole feature.
 *
 *   GET /api/admin/proposal-compare   every proposal waiting for a decision, for the admin Compare section
 *
 * WHO MAY READ IT: the people who already read these proposals at the admin desk, by the same key
 * (`intake.moderate`, the open proposals desk and the review queue's proposal half). Asked through the one gate,
 * `guardCapability`; nobody else learns the list exists. A price ask rides only for a reader who may read pay
 * (`terms.read`, the same check the form uses), so the view shows nobody money they could not already see.
 *
 * A READ, NEVER A DECISION. Nothing here adopts, declines, seats, sends or writes, and no agent token reaches it:
 * `admin_request` refuses the path whatever a village's list holds (`compare` in shared/agentAdmin.ts).
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { buildComparison, type CompareSources } from "../lib/proposalCompare";
import { listOpenProposals } from "../repos/openProposals";
import { listApplications, liveSeatingsOf } from "../repos/seatApplications";
import { villageCircles } from "../repos/roleProposals";
import { questProposalQueue } from "../lib/questProposals";
import { listOrgRoles } from "../lib/orgChart";

export const COMPARE_PATH = "/api/admin/proposal-compare";

export type CompareRouteDeps = Pick<AppDeps, "guardCapability" | "getPool" | "members"> & {
  /** Whether this reader may read pay (`terms.read`). Absent reads as no. */
  mayReadPay?: (req: any) => Promise<boolean>;
  /** A suite's own reads. Absent: the database. */
  compareSources?: Partial<CompareSources>;
};

export function registerProposalCompare(app: Express, deps: CompareRouteDeps): void {
  const sources = (): CompareSources => {
    // Asked for at the read, so a suite's own reads never touch it.
    const pool = () => deps.getPool();
    return {
      openProposals: () => listOpenProposals(pool(), ["confirmed"]),
      applications: () => listApplications(pool()),
      questProposals: () => questProposalQueue(pool(), "proposed"),
      roles: () => listOrgRoles(pool()),
      circles: () => villageCircles(pool()),
      taken: async (ids) => {
        const out = new Map<string, number>();
        for (const s of await liveSeatingsOf(pool(), ids)) out.set(s.orgRoleId, (out.get(s.orgRoleId) ?? 0) + 1);
        return out;
      },
      nameOf: async (id) => {
        const m = await deps.members.byId(id);
        // An erased account shows no name (its address ends anonymized.invalid, server/repos/users.ts).
        return m && typeof m.name === "string" && !String(m.email ?? "").endsWith("anonymized.invalid") ? m.name : null;
      },
      ...(deps.compareSources ?? {}),
    };
  };

  app.get(COMPARE_PATH, async (req, res) => {
    if (!(await deps.guardCapability(req, res, "intake.moderate"))) return;
    try {
      const readsPay = !!deps.mayReadPay && (await deps.mayReadPay(req));
      const payload = await buildComparison(sources(), readsPay);
      res.set("Cache-Control", "no-store").json(payload);
    } catch (e) {
      console.error("[proposal-compare] the list could not be read", e);
      res.status(500).json({ error: "The proposals could not be read just now. Try again in a moment." });
    }
  });
}
