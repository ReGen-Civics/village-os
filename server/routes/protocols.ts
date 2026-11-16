/**
 * The protocols module's routes: a village's checklists, and the runs its
 * members walk (shared/protocols.ts is the contract, server/repos/protocols.ts
 * the store, docs/modules/protocols.md the design).
 *
 * EVERY WRITE IS SAFE TO REPEAT. A member's phone makes the id of each run and
 * each tick, and the shared offline queue (client/src/lib/offlineQueue.ts) may
 * send the same request more than once when the signal comes and goes. A
 * repeat answers 200 with what is already recorded.
 *
 * A REFUSAL THE QUEUE SHOULD NOT RETRY IS A 422, with a sentence: a step that
 * is not this member's, a required step still open, a run already ended. The
 * queue marks those refused and carries on; a 401, 403, 404 or 429 makes it
 * stop and keep everything for later, which is right for a session that ended
 * or a module that is switched off, and wrong for these.
 *
 * Who may tick a role step is read from the org chart at the moment the tick
 * arrives, through `listOrgAssignments` with the lapse context, so a lapsed
 * term ticks nothing. The phone applied the same rule offline from the role
 * list it was last given; the server's answer is the one that stands.
 */
import type { Express, Request, Response } from "express";
import type { AppDeps } from "../lib/appDeps";
import { requireModule, effectiveLifecycle, moduleConfig } from "../lib/modules";
import { listOrgAssignments, listOrgRoles } from "../lib/orgChart";
import {
  checkProtocolDraft,
  clampToNow,
  completionRefusal,
  isClientId,
  isProtocolSlug,
  mayTick,
  openRequiredSteps,
  readProtocolImport,
  type ProtocolStep,
  type RunView,
  type TickEvent,
} from "../../shared/protocols";
import * as repo from "../repos/protocols";

type Deps = Pick<
  AppDeps,
  "authedUser" | "isAdmin" | "getPool" | "lapseContext" | "overLimit" | "projectName" | "brandColour" | "appIcon"
>;

export const PROTOCOLS_MODULE = "protocols";
/** Ended runs a member sees on the page, newest first. */
export const RECENT_RUNS = 30;
const HOUR_MS = 60 * 60 * 1000;
/** Writes one member may make in an hour. A long list ticked and unticked twice over fits. */
const WRITES_PER_HOUR = 1200;

/** The module card's settings (module_settings config JSON). */
export interface ProtocolsConfig {
  /** Show the "add to your phone" card by itself on the protocols page. */
  showInstallCard: boolean;
}

export const DEFAULT_PROTOCOLS_CONFIG: ProtocolsConfig = { showInstallCard: true };

export function protocolsConfig(): ProtocolsConfig {
  const c = moduleConfig<Partial<ProtocolsConfig>>(PROTOCOLS_MODULE) ?? {};
  return { showInstallCard: c.showInstallCard !== false };
}

function refuse(res: Response, error: string, code: string) {
  return res.status(422).json({ error, code });
}

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
}

export function register(app: Express, deps: Deps): void {
  const { authedUser, isAdmin, getPool, lapseContext, overLimit, projectName, brandColour, appIcon } = deps;

  /** Live seatings: a member seated, not ended, not lapsed, not an example, in an active role. */
  async function liveSeatings(): Promise<Array<{ userId: string; roleId: string }>> {
    const pool = getPool();
    const [assignments, roles] = await Promise.all([listOrgAssignments(pool, lapseContext()), listOrgRoles(pool)]);
    const active = new Set(roles.filter((r) => r.active).map((r) => r.id));
    return assignments
      .filter((a) => a.userId && a.holderKind === "member" && !a.isExample && !a.lapsed && active.has(a.orgRoleId))
      .map((a) => ({ userId: String(a.userId), roleId: a.orgRoleId }));
  }

  /** The org-chart roles this member holds live now. */
  async function liveRoleIds(userId: string): Promise<string[]> {
    return Array.from(new Set((await liveSeatings()).filter((s) => s.userId === userId).map((s) => s.roleId)));
  }

  /**
   * First names of the live holders of each role a step is kept for, so a run
   * can say "Role (Name) ticks this one" (role first, holder in parentheses,
   * signed-in views only). Read at request time; stored nowhere.
   */
  async function roleHolders(protocols: readonly { steps: ProtocolStep[] }[]): Promise<Record<string, string[]>> {
    const wanted = new Set<string>();
    for (const p of protocols) for (const s of p.steps) if (s.who.kind === "role") wanted.add(s.who.roleId);
    if (wanted.size === 0) return {};
    const seats = (await liveSeatings()).filter((s) => wanted.has(s.roleId));
    const names = await repo.memberNames(getPool(), seats.map((s) => s.userId));
    const out: Record<string, string[]> = {};
    for (const s of seats) {
      const first = (names.get(s.userId) ?? "").trim().split(/\s+/)[0] ?? "";
      if (!first) continue;
      const list = (out[s.roleId] ??= []);
      if (!list.includes(first)) list.push(first);
    }
    return out;
  }

  async function roleTitles(): Promise<Map<string, string>> {
    const roles = await listOrgRoles(getPool());
    return new Map(roles.filter((r) => r.active).map((r) => [r.id, r.name]));
  }

  /** Whole run views for these rows, with names filled. */
  async function views(rows: repo.RunRow[]): Promise<RunView[]> {
    const pool = getPool();
    const ticks = await repo.ticksFor(pool, rows.map((r) => r.id));
    const versions = new Map<string, { title: string; image: string; steps: ProtocolStep[] } | null>();
    for (const r of rows) {
      const k = `${r.protocolId}@${r.version}`;
      if (!versions.has(k)) versions.set(k, await repo.getVersion(pool, r.protocolId, r.version));
    }
    const ids: string[] = [];
    for (const r of rows) {
      ids.push(r.startedBy);
      if (r.endedBy) ids.push(r.endedBy);
      for (const t of ticks.get(r.id) ?? []) ids.push(t.by);
    }
    const names = await repo.memberNames(pool, ids);
    return rows.map((r) => {
      const v = versions.get(`${r.protocolId}@${r.version}`);
      return {
        id: r.id,
        protocolId: r.protocolId,
        version: r.version,
        title: v?.title ?? r.protocolId,
        image: v?.image ?? "",
        steps: v?.steps ?? [],
        startedBy: r.startedBy,
        startedByName: names.get(r.startedBy) ?? "",
        startedAt: r.startedAt,
        status: r.status,
        endedAt: r.endedAt,
        endedBy: r.endedBy,
        endedByName: r.endedBy ? names.get(r.endedBy) ?? "" : null,
        ticks: (ticks.get(r.id) ?? []).map((t): TickEvent => ({ ...t, byName: names.get(t.by) ?? "" })),
      };
    });
  }

  async function oneView(id: string): Promise<RunView | null> {
    const row = await repo.getRun(getPool(), id);
    return row ? (await views([row]))[0] ?? null : null;
  }

  /*
   * THE INSTALLED APP'S MANIFEST, outside the module gate on purpose: a
   * browser fetches a manifest with no Authorization header, so behind the
   * members gate it would read 401 and nothing could ever be installed. It
   * still answers 404 while the module is off, and carries nothing but the
   * village's public name, colour and icon.
   */
  app.get("/api/protocols-app.webmanifest", (_req, res) => {
    if (effectiveLifecycle(PROTOCOLS_MODULE) === "off") return res.status(404).json({ error: "module_disabled" });
    const name = `${projectName()} Protocols`;
    const icon = appIcon();
    res.type("application/manifest+json");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      id: "/protocols",
      name,
      short_name: "Protocols",
      start_url: "/protocols",
      scope: "/protocols",
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: brandColour(),
      icons: [{ src: icon, sizes: "any", type: icon.endsWith(".svg") ? "image/svg+xml" : "image/png", purpose: "any" }],
    });
  });

  app.use("/api/protocols", requireModule(PROTOCOLS_MODULE));

  /** Everything the page needs, which is also everything it keeps for when there is no signal. */
  app.get("/api/protocols", async (req, res) => {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    const pool = getPool();
    const [protocols, rows, roleIds] = await Promise.all([
      repo.listProtocols(pool),
      repo.listRuns(pool, { recentLimit: RECENT_RUNS }),
      liveRoleIds(String(me.id)),
    ]);
    const runs = await views(rows);
    res.json({
      protocols,
      runs,
      roleHolders: await roleHolders([...protocols, ...runs]),
      viewer: { id: String(me.id), name: String(me.name ?? ""), roleIds },
      settings: protocolsConfig(),
      at: new Date().toISOString(),
    });
  });

  app.get("/api/protocols/runs/:id", async (req, res) => {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    const run = await oneView(String(req.params.id));
    if (!run) return res.status(404).json({ error: "No such run." });
    res.json({ run });
  });

  app.post("/api/protocols/runs", async (req, res) => {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    if (await overLimit(`protocols:${me.id}`, WRITES_PER_HOUR, HOUR_MS)) return res.status(429).json({ error: "Too many changes in an hour. Try again soon." });
    const b = bodyOf(req);
    const id = b.id;
    const protocolId = b.protocolId;
    const version = Number(b.version);
    if (!isClientId(id)) return refuse(res, "That run has no usable id.", "bad_id");
    if (!isProtocolSlug(protocolId) || !Number.isInteger(version) || version < 1) return refuse(res, "Name the protocol and its version.", "bad_protocol");
    const pool = getPool();
    const existing = await repo.getRun(pool, id);
    if (existing) {
      if (existing.protocolId !== protocolId || existing.startedBy !== String(me.id)) return refuse(res, "That run id is already in use.", "id_taken");
      return res.json({ run: await oneView(id), repeat: true });
    }
    const status = await repo.protocolStatus(pool, protocolId);
    if (!status || status.status !== "active") return refuse(res, "That protocol is no longer in use.", "protocol_gone");
    if (!(await repo.getVersion(pool, protocolId, version))) return refuse(res, "That version of the protocol does not exist.", "bad_version");
    const now = new Date();
    const startedAt = new Date(clampToNow(String(b.startedAt ?? ""), now.getTime()));
    await repo.insertRun(pool, { id, protocolId, version, startedBy: String(me.id), startedAt }, now);
    res.status(201).json({ run: await oneView(id) });
  });

  app.post("/api/protocols/runs/:id/ticks", async (req, res) => {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    if (await overLimit(`protocols:${me.id}`, WRITES_PER_HOUR, HOUR_MS)) return res.status(429).json({ error: "Too many changes in an hour. Try again soon." });
    const b = bodyOf(req);
    const runId = String(req.params.id);
    const tickId = b.id;
    if (!isClientId(tickId)) return refuse(res, "That tick has no usable id.", "bad_id");
    const pool = getPool();
    const prior = await repo.getTick(pool, tickId);
    if (prior) {
      if (prior.runId !== runId || prior.by !== String(me.id)) return refuse(res, "That tick id is already in use.", "id_taken");
      return res.json({ run: await oneView(runId), repeat: true });
    }
    const run = await repo.getRun(pool, runId);
    if (!run) return refuse(res, "That run has not reached the server. It was refused or never started.", "no_run");
    if (run.status !== "open") return refuse(res, "This run has already ended.", "run_ended");
    const version = await repo.getVersion(pool, run.protocolId, run.version);
    const step = version?.steps.find((s) => s.id === b.stepId);
    if (!step) return refuse(res, "That step is not on this protocol.", "no_step");
    if (!mayTick(step, { id: String(me.id), roleIds: await liveRoleIds(String(me.id)) })) {
      const whose = step.who.kind === "role" ? step.who.roleTitle : "another member";
      return refuse(res, `Only the ${whose} can tick "${step.text}".`, "not_your_step");
    }
    const now = new Date();
    await repo.insertTick(
      pool,
      { id: tickId, runId, stepId: step.id, done: b.done !== false, by: String(me.id), at: new Date(clampToNow(String(b.at ?? ""), now.getTime())) },
      now,
    );
    res.status(201).json({ run: await oneView(runId) });
  });

  async function end(req: Request, res: Response, status: "complete" | "set-aside") {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    if (await overLimit(`protocols:${me.id}`, WRITES_PER_HOUR, HOUR_MS)) return res.status(429).json({ error: "Too many changes in an hour. Try again soon." });
    const runId = String(req.params.id);
    const pool = getPool();
    const run = await repo.getRun(pool, runId);
    if (!run) return refuse(res, "That run has not reached the server. It was refused or never started.", "no_run");
    if (run.status === status) return res.json({ run: await oneView(runId), repeat: true });
    if (run.status !== "open") return refuse(res, "This run has already ended.", "run_ended");
    if (status === "complete") {
      const view = await oneView(runId);
      const open = openRequiredSteps(view?.steps ?? [], view?.ticks ?? []);
      if (open.length) return refuse(res, completionRefusal(open), "steps_open");
    }
    const now = new Date();
    const at = new Date(clampToNow(String(bodyOf(req).at ?? ""), now.getTime()));
    await repo.endRun(pool, runId, status, String(me.id), at);
    res.json({ run: await oneView(runId) });
  }

  app.post("/api/protocols/runs/:id/complete", (req, res) => end(req, res, "complete"));
  app.post("/api/protocols/runs/:id/set-aside", (req, res) => end(req, res, "set-aside"));

  // ── Admin: the editor on the module's card ─────────────────────────────────
  // Not behind the module gate, so a founder can write the lists before
  // switching the module on for members.

  app.get("/api/admin/protocols", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const roles = await listOrgRoles(getPool());
    res.json({
      protocols: await repo.listProtocols(getPool(), { includeArchived: true }),
      roles: roles.filter((r) => r.active).map((r) => ({ id: r.id, title: r.name })),
      settings: protocolsConfig(),
    });
  });

  app.put("/api/admin/protocols/:id", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const b = bodyOf(req);
    const checked = checkProtocolDraft({ ...b, id: String(req.params.id) }, await roleTitles());
    if (!checked.ok) return res.status(400).json({ error: checked.problems[0], problems: checked.problems });
    const me = await authedUser(req);
    const saved = await repo.saveProtocol(getPool(), checked.value, String(me?.id ?? "admin"), new Date());
    res.json({ ...saved, protocols: await repo.listProtocols(getPool(), { includeArchived: true }) });
  });

  app.post("/api/admin/protocols/:id/status", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const status = bodyOf(req).status;
    if (status !== "active" && status !== "archived") return res.status(400).json({ error: "Say active or archived." });
    const ok = await repo.setProtocolStatus(getPool(), String(req.params.id), status, new Date());
    if (!ok) return res.status(404).json({ error: "No such protocol." });
    res.json({ protocols: await repo.listProtocols(getPool(), { includeArchived: true }) });
  });

  /**
   * Import a `village-protocols/1` file. `dryRun` (the default) says what
   * would be saved and every problem, and saves nothing; a real run saves
   * only when the whole file is clean, so a half-imported file never exists.
   */
  app.post("/api/admin/protocols/import", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const b = bodyOf(req);
    const roles = (await listOrgRoles(getPool())).filter((r) => r.active).map((r) => ({ id: r.id, title: r.name }));
    const read = readProtocolImport(b.file, roles);
    const existing = new Map((await repo.listProtocols(getPool(), { includeArchived: true })).map((p) => [p.id, p]));
    const plan = read.drafts.map((d) => ({ id: d.id, title: d.title, steps: d.steps.length, action: existing.has(d.id) ? "update" : "create" }));
    if (b.dryRun !== false || read.problems.length) {
      return res.status(read.problems.length ? 400 : 200).json({ plan, problems: read.problems, missingRoles: read.missingRoles, saved: false });
    }
    const me = await authedUser(req);
    const now = new Date();
    const results = [];
    for (const d of read.drafts) results.push({ id: d.id, ...(await repo.saveProtocol(getPool(), d, String(me?.id ?? "admin"), now)) });
    res.json({ plan, problems: [], missingRoles: [], saved: true, results, protocols: await repo.listProtocols(getPool(), { includeArchived: true }) });
  });
}
