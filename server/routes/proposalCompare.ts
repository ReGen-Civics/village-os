/**
 * COMPARE PROPOSALS, THE DOORS (the lead, 20 Nov 2026). Registered by the open proposals module
 * (server/routes/openProposals.ts), so server/index.ts keeps one line for the whole feature.
 *
 *   GET  /api/admin/proposal-compare             every proposal waiting for a decision, for the admin Compare section
 *   POST /api/admin/proposal-compare/split       save which deliverables each person holds in one role
 *   GET  /api/admin/proposal-compare/held/:ref   the saved split on one person's proposal, for their proposal's page
 *
 * WHO MAY READ IT, through the one gate:
 *   - `intake.moderate`, the open proposals desk's key: everything, the saved splits included, and pay asks only for a
 *     reader who also may read pay (`terms.read`, the form's own check).
 *   - `quest.approve` alone (the lead, 20 Nov 2026): the quest part only. No proposal for a role is read for them, no
 *     pay, no saved split.
 *   - anybody else: 401, and nothing is read.
 * Saving a split and reading one person's saved split ask `intake.moderate`, and the person a split names never reads
 * their own here: it is for the people who decide.
 *
 * NEVER A DECISION. Nothing here adopts, declines, seats or sends. No agent token reaches any of these paths:
 * `admin_request` refuses them whatever a village's list holds (`compare` in shared/agentAdmin.ts).
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { buildComparison, type CompareSources } from "../lib/proposalCompare";
import { listOpenProposals, readOpenProposal, type StoredOpenProposal } from "../repos/openProposals";
import { listApplications, liveSeatingsOf, readApplication, type StoredApplication } from "../repos/seatApplications";
import { villageCircles } from "../repos/roleProposals";
import { questProposalQueue } from "../lib/questProposals";
import { listOrgRoles } from "../lib/orgChart";
import { recordEvent } from "../lib/events";
import { stampApplication, stampOpenProposal } from "../repos/proposalStamps";
import { emailKeyOf } from "../../shared/comms/address";
import { OPEN_STATUSES } from "../../shared/seatApplications";
import { parseSplitToSave, SAVE_SPLIT_WORDS, type CompareScope, type HeldSplit } from "../../shared/proposalCompare";

export const COMPARE_PATH = "/api/admin/proposal-compare";

export type CompareRouteDeps = Pick<AppDeps, "guardCapability" | "getPool" | "members" | "authedUser"> & {
  /** The read-side gate. Absent: only `intake.moderate` opens Compare, through `guardCapability`. */
  mayStillSee?: AppDeps["mayStillSee"];
  /** Whether this reader may read pay (`terms.read`). Absent reads as no. */
  mayReadPay?: (req: any) => Promise<boolean>;
  /** A suite's own reads and writes. Absent: the database. */
  compareSources?: Partial<CompareSources>;
  compareStore?: Partial<SplitStore>;
  now?: () => Date;
};

/** The reads and writes the saved split needs, so a suite can hand in its own. */
export interface SplitStore {
  openProposal(id: string): Promise<StoredOpenProposal | null>;
  application(id: string): Promise<StoredApplication | null>;
  stampOpen(id: string, held: HeldSplit[]): Promise<boolean>;
  stampApplication(id: string, held: HeldSplit[]): Promise<boolean>;
  audit(text: string, actorUserId: string, ref: string): Promise<void>;
}

const CLOSED_OPEN = new Set(["declined", "withdrawn", "unconfirmed"]);

export function registerProposalCompare(app: Express, deps: CompareRouteDeps): void {
  const now = deps.now ?? (() => new Date());
  const sources = (): CompareSources => {
    // Asked for at the read, so a suite's own reads never touch it.
    const pool = () => deps.getPool();
    return {
      openProposals: () => listOpenProposals(pool(), ["confirmed", "adopted"]),
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
  const store = (): SplitStore => ({
    openProposal: (id) => readOpenProposal(deps.getPool(), id),
    application: (id) => readApplication(deps.getPool(), id),
    stampOpen: (id, held) => stampOpenProposal(deps.getPool(), id, "heldSplit", held),
    stampApplication: (id, held) => stampApplication(deps.getPool(), id, "heldSplit", held),
    audit: (text, actorUserId, ref) => recordEvent(deps.getPool(), { kind: "audit", text, actorUserId, entityType: "proposal_split", entityRef: ref, audience: "admin" }),
    ...(deps.compareStore ?? {}),
  });

  /** What this reader may see, or null with the 401 sent. */
  async function scopeOf(req: any, res: any): Promise<CompareScope | null> {
    if (deps.mayStillSee) {
      if (await deps.mayStillSee(req, "intake.moderate")) return "all";
      if (await deps.mayStillSee(req, "quest.approve")) return "quests";
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    return (await deps.guardCapability(req, res, "intake.moderate")) ? "all" : null;
  }

  app.get(COMPARE_PATH, async (req, res) => {
    const scope = await scopeOf(req, res);
    if (!scope) return;
    try {
      const readsPay = scope === "all" && !!deps.mayReadPay && (await deps.mayReadPay(req));
      res.set("Cache-Control", "no-store").json(await buildComparison(sources(), readsPay, scope));
    } catch (e) {
      console.error("[proposal-compare] the list could not be read", e);
      res.status(500).json({ error: "The proposals could not be read just now. Try again in a moment." });
    }
  });

  /** The proposal a comparison key names, when it may be split: still waiting, or adopted. */
  async function proposalOf(key: string): Promise<{ kind: "op"; p: StoredOpenProposal } | { kind: "sa"; a: StoredApplication } | null> {
    const [kind, id, roleId] = key.split(":");
    if (kind === "op") {
      const p = await store().openProposal(id);
      return p && !CLOSED_OPEN.has(p.status) && p.body.roles.some((r) => r.roleId === roleId) ? { kind, p } : null;
    }
    const a = await store().application(id);
    const live = a && ((OPEN_STATUSES as readonly string[]).includes(a.status) || a.status === "adopted" || a.status === "held-full");
    return a && live && a.seatIds.includes(roleId) ? { kind: "sa", a } : null;
  }

  app.post(`${COMPARE_PATH}/split`, async (req, res) => {
    if (!(await deps.guardCapability(req, res, "intake.moderate"))) return;
    const me = await deps.authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    const parsed = parseSplitToSave(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const { roleId, rows } = parsed.value;
    const found = await Promise.all(rows.map((r) => proposalOf(r.key)));
    if (found.some((f) => !f)) return res.status(400).json({ error: SAVE_SPLIT_WORDS.key });
    const at = now().toISOString();
    const by = String(me.id);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const f = found[i]!;
      const record: HeldSplit = { roleId, holds: r.holds, with: rows.filter((x) => x.key !== r.key).map((x) => x.key), by, at };
      // One record per role on each proposal: a later save for the same role replaces the earlier one.
      const keep = (f.kind === "op" ? f.p.held : f.a.held) ?? [];
      const next = [...keep.filter((h) => h.roleId !== roleId), record];
      const ok = f.kind === "op" ? await store().stampOpen(f.p.id, next) : await store().stampApplication(f.a.id, next);
      if (!ok) return res.status(409).json({ error: "A proposal in the split changed a moment ago. Read it again and save once more." });
    }
    await store().audit(`proposal-split:saved:${roleId}: a split of ${rows.length} for the role was saved`, by, roleId);
    res.json({ success: true, saved: { roleId, at, rows: rows.map((r) => ({ key: r.key, holds: r.holds })) } });
  });

  app.get(`${COMPARE_PATH}/held/:ref`, async (req, res) => {
    if (!(await deps.guardCapability(req, res, "intake.moderate"))) return;
    const me = await deps.authedUser(req);
    const ref = String(req.params.ref ?? "");
    const isOpen = /^op-[0-9a-f]{20}$/.test(ref);
    const isMember = /^sa-[0-9a-f]{16}$/.test(ref);
    if (!isOpen && !isMember) return res.status(404).json({ error: "not_found" });
    const p = isOpen ? await store().openProposal(ref) : null;
    const a = isMember ? await store().application(ref) : null;
    if (!p && !a) return res.status(404).json({ error: "not_found" });
    // The person a split names never reads it here, decider or not: it is about them, for the people who decide.
    const mine = a ? !!me && a.candidateUserId === String(me.id) : !!me && !!p?.email && !!me.email && emailKeyOf(String(me.email)) === emailKeyOf(p.email);
    if (mine) return res.set("Cache-Control", "no-store").json({ held: [] });
    const held = (p?.held ?? a?.held ?? []) as HeldSplit[];
    const roles = held.length ? await (deps.compareSources?.roles ?? (() => listOrgRoles(deps.getPool())))() : [];
    const src = sources();
    const whoOf = async (key: string): Promise<string> => {
      const [kind, id] = key.split(":");
      if (kind === "op") return (await store().openProposal(id))?.name ?? "";
      const other = await store().application(id);
      return other ? ((await src.nameOf(other.candidateUserId)) ?? "") : "";
    };
    const out = [];
    for (const h of held) {
      out.push({
        roleId: h.roleId,
        roleName: roles.find((r) => r.id === h.roleId)?.name ?? h.roleId,
        holds: h.holds,
        with: (await Promise.all(h.with.map(whoOf))).filter(Boolean),
        by: (await src.nameOf(h.by)) ?? "",
        at: h.at,
      });
    }
    res.set("Cache-Control", "no-store").json({ held: out });
  });
}
