/**
 * AGENT ACCOUNTS AND THE PATHS OPEN TO THEM (End of Moon addendum v6, B6).
 *
 *   GET /api/admin/agent-accounts          the accounts marked as an agent's
 *   PUT /api/admin/players/:id/agent       mark an account as an agent's, or as a person's again
 *   GET /api/admin/agent-admin-paths       the paths `admin_request` may call, and what is always a person's
 *   PUT /api/admin/agent-admin-paths       change that list
 *   GET /api/admin/agent-actions           what agents did through the admin and Sera scopes, newest first
 *   POST /api/admin/agent-actions/:id/undo put back one of Sera's actions (B7), within 30 days
 *   GET /api/admin/agent-accounts/full-access  the full-access switch: which role, if any, and the roles to pick from
 *   PUT /api/admin/agent-accounts/full-access  name one role, or none (the lead, 20 Nov 2026; shared/agentFullAccess.ts)
 *   PUT /api/admin/agent-accounts/full-access/reads-open  open or close that role's agent's reads (the lead, 25 Nov 2026)
 *
 * Every route is an admin's, and the two writes are a PERSON's: an agent
 * account is refused them even with a session, and `admin_request` can never
 * reach them (`ALWAYS_A_PERSON`, shared/agentAdmin.ts), so no agent widens its
 * own reach or marks another account.
 *
 * An account is marked an agent's only while it holds no role, because an
 * agent account holds none (server/lib/orgChart.ts refuses the seating).
 */
import type express from "express";
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { recordEvent } from "../lib/events";
import { revokeAllTokens } from "../lib/agentTokens";
import { agentAccountIds, isAgentAccount, listAgentActions, liveRoleCount, setAgentAccount, namesOf } from "../repos/agentAccounts";
import { readConfigDocument, writeConfigDocument } from "../repos/appConfigDocs";
import { undoSeraAction } from "../lib/seraAgent";
import { AGENT_ADMIN_PATHS_DOC, ALWAYS_A_PERSON, DEFAULT_AGENT_ADMIN_PATHS, effectiveAgentAdminPaths, LEAD_APPROVED_WRITES, LEAD_APPROVED_WRITES_VARIABLE, parseAgentAdminPaths } from "../../shared/agentAdmin";
import { boolVar } from "../lib/variables";
import { recentApprovedWrites } from "../lib/agentLeadApproval";
import { orgRoleForFullAccess } from "../repos/agentAccounts";
import { listOrgRoles } from "../lib/orgChart";
import { noticeFullAccessChange, noticeReadsOpenChange, readFullAccess } from "../lib/agentFullAccess";
import { FULL_ACCESS_DOC, FULL_ACCESS_FLOOR, READS_OPEN_KEPT, type FullAccessDoc } from "../../shared/agentFullAccess";

/** `notify` and `circlesRepo` tell the Anchor Circle when the full-access switch moves; without them it is only recorded. */
type Deps = Pick<AppDeps, "authedUser" | "getPool" | "isAdmin"> & Partial<Pick<AppDeps, "notify" | "circlesRepo">>;

export function register(app: Express, deps: Deps): void {
  const { authedUser, getPool, isAdmin } = deps;

  /** An admin who is a person, or an answer and null. */
  const person = async (req: express.Request, res: express.Response): Promise<{ id: string } | null> => {
    if (!(await isAdmin(req))) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    const user = await authedUser(req);
    if (!user) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    if (await isAgentAccount(getPool(), String(user.id))) {
      res.status(403).json({ error: "person_only", message: "A person makes this change, never an agent account." });
      return null;
    }
    return { id: String(user.id) };
  };

  app.get("/api/admin/agent-accounts", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    res.json({ agents: await agentAccountIds(getPool()) });
  });

  app.put("/api/admin/players/:id/agent", async (req, res) => {
    const actor = await person(req, res);
    if (!actor) return;
    const userId = String(req.params.id ?? "").slice(0, 64);
    const on = (req.body as { isAgent?: unknown } | undefined)?.isAgent === true;
    if (!userId) return res.status(400).json({ error: "Which account?" });
    if (userId === actor.id) return res.status(400).json({ error: "Mark another account, never your own." });
    if (on && (await liveRoleCount(getPool(), userId)) > 0) {
      return res.status(409).json({ error: "This account holds a role or a power. An agent account holds neither, so end them first." });
    }
    if (!(await setAgentAccount(getPool(), userId, on))) return res.status(404).json({ error: "Not found" });
    // A token never outlives what its account was when it was minted: both directions end every live token.
    const ended = await revokeAllTokens(getPool(), userId);
    await recordEvent(getPool(), {
      kind: "audit",
      text: `${on ? "marked an account as an agent's" : "marked an account as a person's"}, ending ${ended} agent token${ended === 1 ? "" : "s"}`,
      actorUserId: actor.id,
      entityType: "user",
      entityRef: userId,
      audience: "admin",
    });
    res.json({ userId, isAgent: on });
  });

  // The connector's approved writes, newest first: when, what, who approved it, their note, and whether the
  // organisational memory holds the record yet (server/lib/agentLeadApproval.ts). A person reads it, never an agent.
  app.get("/api/admin/agent-approvals", async (req, res) => {
    const actor = await person(req, res);
    if (!actor) return;
    res.json({ writes: await recentApprovedWrites(getPool(), 50) });
  });

  app.get("/api/admin/agent-admin-paths", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const stored = await readConfigDocument(getPool(), AGENT_ADMIN_PATHS_DOC);
    res.json({
      document: effectiveAgentAdminPaths(stored),
      shipped: DEFAULT_AGENT_ADMIN_PATHS,
      edited: stored !== null,
      alwaysAPerson: ALWAYS_A_PERSON.map((r) => ({ key: r.key, words: r.words })),
      // The lead-approved writes (shared/agentAdmin.ts): whether this village has them on, and which routes they reach.
      leadApprovedWrites: { on: boolVar(LEAD_APPROVED_WRITES_VARIABLE), routes: LEAD_APPROVED_WRITES.map((e) => ({ kind: e.kind, method: e.method, path: e.path })) },
    });
  });

  app.put("/api/admin/agent-admin-paths", async (req, res) => {
    const actor = await person(req, res);
    if (!actor) return;
    // With the village's opt-in on, a lead-approved write may be saved on the list (shared/agentAdmin.ts).
    const parsed = parseAgentAdminPaths((req.body as { document?: unknown } | undefined)?.document ?? req.body, { leadApprovedWrites: boolVar(LEAD_APPROVED_WRITES_VARIABLE) });
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    await writeConfigDocument(getPool(), AGENT_ADMIN_PATHS_DOC, parsed.value as unknown as Record<string, unknown>);
    await recordEvent(getPool(), {
      kind: "audit",
      text: `changed the agent paths list (${parsed.value.paths.length} paths)`,
      actorUserId: actor.id,
      entityType: "app_config",
      entityRef: AGENT_ADMIN_PATHS_DOC,
      audience: "admin",
    });
    res.json({ document: parsed.value });
  });

  // ── The full-access switch (the lead, 20 Nov 2026) ─────────────────────────
  // One role, never a person. A person sets it, never an agent account, and `ALWAYS_A_PERSON` keeps the connector off
  // this path (the `agents` rule reads agent-accounts). It reaches only the agent of whoever holds a live seat in it.

  app.get("/api/admin/agent-accounts/full-access", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const doc = await readFullAccess(getPool());
    const roles = (await listOrgRoles(getPool())).filter((r: any) => !r.isExample && r.active !== false).map((r: any) => ({ id: String(r.id), name: String(r.name ?? r.id) }));
    const role = doc.roleId ? await orgRoleForFullAccess(getPool(), doc.roleId) : null;
    const setByName = doc.setBy ? (await namesOf(getPool(), [doc.setBy]))[doc.setBy] ?? null : null;
    res.json({
      on: !!doc.roleId,
      roleId: doc.roleId,
      roleName: role?.name ?? null,
      setBy: setByName,
      setAt: doc.setAt,
      roles,
      floor: FULL_ACCESS_FLOOR.map((f) => f.why).filter((w, i, all) => all.indexOf(w) === i),
      readsOpen: doc.readsOpen,
      readsSetBy: doc.readsSetBy ? (await namesOf(getPool(), [doc.readsSetBy]))[doc.readsSetBy] ?? null : null,
      readsSetAt: doc.readsSetAt,
      readsKept: READS_OPEN_KEPT,
    });
  });

  // ── Reads open, beside the switch (the lead, 25 Nov 2026) ─────────────────
  // A person's act, as the switch is: `person` refuses an agent account, and the `agents` rule keeps the connector
  // off this path. It opens reads only for the agent the switch already names, under the read floor.
  app.put("/api/admin/agent-accounts/full-access/reads-open", async (req, res) => {
    const actor = await person(req, res);
    if (!actor) return;
    const raw = (req.body as { on?: unknown } | undefined)?.on;
    if (typeof raw !== "boolean") return res.status(400).json({ error: "Send on: true to open reads, or on: false to close them." });
    const before = await readFullAccess(getPool());
    if (before.readsOpen === raw) return res.json({ readsOpen: raw, unchanged: true });
    const after: FullAccessDoc = { ...before, readsOpen: raw, readsSetBy: actor.id, readsSetAt: new Date().toISOString() };
    await writeConfigDocument(getPool(), FULL_ACCESS_DOC, after as unknown as Record<string, unknown>);
    const told = await noticeReadsOpenChange(
      getPool(),
      { notify: deps.notify ? (n) => deps.notify!(n) : async () => undefined, circles: () => (deps.circlesRepo ? (deps.circlesRepo.all() as any[]) : []) },
      { actorUserId: actor.id, before, after },
    );
    res.json({ readsOpen: raw, anchorNotified: told.anchorNotified });
  });

  app.put("/api/admin/agent-accounts/full-access", async (req, res) => {
    const actor = await person(req, res);
    if (!actor) return;
    const raw = (req.body as { roleId?: unknown } | undefined)?.roleId;
    const roleId = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 120) : null;
    if (raw !== undefined && raw !== null && raw !== "" && typeof raw !== "string") return res.status(400).json({ error: "Send roleId: a role's id, or null to turn full access off." });
    if (roleId) {
      const role = await orgRoleForFullAccess(getPool(), roleId);
      if (!role) return res.status(404).json({ error: "There is no role by that id." });
      if (!role.usable) return res.status(409).json({ error: "Name a live role. A standing example or a retired role cannot carry full access." });
    }
    const before = await readFullAccess(getPool());
    if ((before.roleId ?? null) === roleId) return res.json({ on: !!roleId, roleId, unchanged: true });
    // Reads open is its own act, so naming or changing the role carries it over as it stands.
    const after: FullAccessDoc = { ...before, roleId, setBy: actor.id, setAt: new Date().toISOString() };
    await writeConfigDocument(getPool(), FULL_ACCESS_DOC, after as unknown as Record<string, unknown>);
    const told = await noticeFullAccessChange(
      getPool(),
      { notify: deps.notify ? (n) => deps.notify!(n) : async () => undefined, circles: () => (deps.circlesRepo ? (deps.circlesRepo.all() as any[]) : []) },
      { actorUserId: actor.id, before, after },
    );
    res.json({ on: !!roleId, roleId, anchorNotified: told.anchorNotified });
  });

  app.get("/api/admin/agent-actions", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const scope = typeof req.query.scope === "string" ? req.query.scope.slice(0, 32) : undefined;
    const actions = await listAgentActions(getPool(), { scope, limit: Number(req.query.limit ?? 100) });
    // Which member each action touched, by name, so a steward sees whom an Undo is for.
    const names = await namesOf(getPool(), actions.map((a) => a.subjectUserId ?? ""));
    res.json({ actions: actions.map((a) => ({ ...a, subjectName: a.subjectUserId ? names[a.subjectUserId] ?? null : null })) });
  });

  app.post("/api/admin/agent-actions/:id/undo", async (req, res) => {
    const actor = await person(req, res);
    if (!actor) return;
    const out = await undoSeraAction(getPool(), String(req.params.id ?? "").slice(0, 64), actor.id, null);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    res.json({ undone: true });
  });
}
