/**
 * What the protocols page draws: the last answer the server gave, with every
 * change still waiting in the offline queue laid on top.
 *
 * The server's answer is kept per member (`readSnapshot("protocols", …)`), and
 * the queue holds the member's own starts, ticks and endings in order. Laying
 * one on the other is pure and lives here, so the page draws the same run
 * whether the signal is there or not, and a test can hold it without a DOM.
 */
import type { ProtocolView, RunView, TickEvent } from "@shared/protocols";
import { newRequestId, offlineQueue, type QueuedRequest } from "./offlineQueue";

export const PROTOCOLS_QUEUE = "protocols";
export const PROTOCOLS_SNAPSHOT = "protocols";

/** GET /api/protocols, which is also what the page keeps for when there is no signal. */
export interface ProtocolsPayload {
  protocols: ProtocolView[];
  runs: RunView[];
  viewer: { id: string; name: string; roleIds: string[] };
  /** First names of each kept-for role's live holders, for "Role (Name) ticks this one". */
  roleHolders?: Record<string, string[]>;
  settings: { showInstallCard: boolean };
  at: string;
}

export function protocolsQueue() {
  return offlineQueue(PROTOCOLS_QUEUE, { ordered: true });
}

export type PendingKind = "start" | "tick" | "complete" | "set-aside";

export function kindOf(r: QueuedRequest): PendingKind | null {
  if (r.path === "/api/protocols/runs") return "start";
  if (r.path.endsWith("/ticks")) return "tick";
  if (r.path.endsWith("/complete")) return "complete";
  if (r.path.endsWith("/set-aside")) return "set-aside";
  return null;
}

/** The view to draw: the snapshot with the waiting changes applied, oldest first. */
export function withPending(base: ProtocolsPayload, pending: readonly QueuedRequest[]): ProtocolsPayload {
  const runs = base.runs.map((r) => ({ ...r, ticks: [...r.ticks] }));
  const byId = new Map(runs.map((r) => [r.id, r]));
  for (const p of pending) {
    if (p.refused) continue;
    const kind = kindOf(p);
    const b = (p.body ?? {}) as Record<string, unknown>;
    if (kind === "start") {
      const id = String(b.id ?? "");
      if (byId.has(id)) continue;
      const proto = base.protocols.find((x) => x.id === b.protocolId);
      if (!proto) continue;
      const run: RunView = {
        id,
        protocolId: proto.id,
        version: Number(b.version) || proto.version,
        title: proto.title,
        image: proto.image ?? "",
        steps: proto.steps,
        startedBy: base.viewer.id,
        startedByName: base.viewer.name,
        startedAt: String(b.startedAt ?? p.queuedAt),
        status: "open",
        endedAt: null,
        endedBy: null,
        endedByName: null,
        ticks: [],
      };
      runs.unshift(run);
      byId.set(id, run);
      continue;
    }
    const run = p.group ? byId.get(p.group) : undefined;
    if (!run) continue;
    if (kind === "tick") {
      if (run.ticks.some((t) => t.clientId === b.id)) continue;
      const t: TickEvent = {
        clientId: String(b.id),
        stepId: String(b.stepId),
        done: b.done !== false,
        by: base.viewer.id,
        byName: base.viewer.name,
        at: String(b.at ?? p.queuedAt),
      };
      run.ticks.push(t);
    } else if ((kind === "complete" || kind === "set-aside") && run.status === "open") {
      run.status = kind;
      run.endedAt = String(b.at ?? p.queuedAt);
      run.endedBy = base.viewer.id;
      run.endedByName = base.viewer.name;
    }
  }
  return { ...base, runs };
}

/** The waiting changes for one run, refused ones included. */
export function pendingForRun(pending: readonly QueuedRequest[], runId: string): QueuedRequest[] {
  return pending.filter((p) => p.group === runId || (kindOf(p) === "start" && (p.body as { id?: string })?.id === runId));
}

// ── Making the changes ──────────────────────────────────────────────────────

const now = () => new Date().toISOString();

export function queueStart(owner: string, protocol: ProtocolView): string {
  const id = newRequestId();
  protocolsQueue().enqueue(owner, {
    id,
    path: "/api/protocols/runs",
    group: id,
    body: { id, protocolId: protocol.id, version: protocol.version, startedAt: now() },
  });
  return id;
}

export function queueTick(owner: string, runId: string, stepId: string, done: boolean): void {
  const id = newRequestId();
  protocolsQueue().enqueue(owner, {
    id,
    path: `/api/protocols/runs/${encodeURIComponent(runId)}/ticks`,
    group: runId,
    body: { id, stepId, done, at: now() },
  });
}

export function queueEnd(owner: string, runId: string, how: "complete" | "set-aside"): void {
  const id = newRequestId();
  protocolsQueue().enqueue(owner, {
    id,
    path: `/api/protocols/runs/${encodeURIComponent(runId)}/${how}`,
    group: runId,
    body: { id, at: now() },
  });
}
