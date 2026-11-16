/**
 * The page draws the server's last answer with the waiting queue laid on top.
 * A run started, ticked and completed with no signal must read exactly as it
 * will once the server has it.
 */
import { describe, expect, it } from "vitest";
import type { ProtocolView } from "@shared/protocols";
import type { QueuedRequest } from "./offlineQueue";
import { withPending, pendingForRun, type ProtocolsPayload } from "./protocolsState";

const protocol: ProtocolView = {
  id: "opening-up",
  title: "Opening up",
  summary: "",
  version: 2,
  status: "active",
  updatedAt: "2026-11-15T00:00:00.000Z",
  steps: [
    { id: "lights", text: "Lights on", detail: "", required: true, who: { kind: "member" } },
    { id: "unlock", text: "Door unlocked", detail: "", required: true, who: { kind: "role", roleId: "r1", roleTitle: "Keyholder" } },
  ],
};

const base: ProtocolsPayload = {
  protocols: [protocol],
  runs: [],
  viewer: { id: "u1", name: "Wren", roleIds: [] },
  settings: { showInstallCard: true },
  at: "2026-11-15T00:00:00.000Z",
};

const req = (id: string, path: string, body: Record<string, unknown>, group: string | null, refused = false): QueuedRequest => ({
  id,
  owner: "u1",
  method: "POST",
  path,
  body,
  group,
  queuedAt: "2026-11-15T10:00:00.000Z",
  attempts: 0,
  lastError: refused ? "no" : null,
  refused,
});

describe("withPending", () => {
  const start = req("run-0001", "/api/protocols/runs", { id: "run-0001", protocolId: "opening-up", version: 2, startedAt: "2026-11-15T10:00:00.000Z" }, "run-0001");
  const tick = req("tick-0001", "/api/protocols/runs/run-0001/ticks", { id: "tick-0001", stepId: "lights", done: true, at: "2026-11-15T10:01:00.000Z" }, "run-0001");
  const done = req("end-0001", "/api/protocols/runs/run-0001/complete", { id: "end-0001", at: "2026-11-15T10:02:00.000Z" }, "run-0001");

  it("shows a run started offline, with its ticks, as the viewer's", () => {
    const v = withPending(base, [start, tick]);
    expect(v.runs).toHaveLength(1);
    const r = v.runs[0]!;
    expect([r.id, r.version, r.startedBy, r.startedByName, r.status]).toEqual(["run-0001", 2, "u1", "Wren", "open"]);
    expect(r.ticks.map((t) => [t.stepId, t.done, t.by])).toEqual([["lights", true, "u1"]]);
    expect(r.steps).toEqual(protocol.steps);
  });

  it("an ending offline closes the run", () => {
    const r = withPending(base, [start, tick, done]).runs[0]!;
    expect(r.status).toBe("complete");
    expect(r.endedBy).toBe("u1");
  });

  it("a refused change is not drawn as done", () => {
    const r = withPending(base, [start, { ...tick, refused: true }]).runs[0]!;
    expect(r.ticks).toEqual([]);
  });

  it("a tick the server already has is not drawn twice", () => {
    const server: ProtocolsPayload = {
      ...base,
      runs: [
        {
          id: "run-0001",
          protocolId: "opening-up",
          version: 2,
          title: "Opening up",
          steps: protocol.steps,
          startedBy: "u1",
          startedByName: "Wren",
          startedAt: "2026-11-15T10:00:00.000Z",
          status: "open",
          endedAt: null,
          endedBy: null,
          endedByName: null,
          ticks: [{ clientId: "tick-0001", stepId: "lights", done: true, by: "u1", byName: "Wren", at: "2026-11-15T10:01:00.000Z" }],
        },
      ],
    };
    const r = withPending(server, [start, tick]).runs;
    expect(r).toHaveLength(1);
    expect(r[0]!.ticks).toHaveLength(1);
    // And the snapshot itself is never changed.
    expect(server.runs[0]!.ticks).toHaveLength(1);
  });

  it("pendingForRun finds a run's start and its later changes", () => {
    expect(pendingForRun([start, tick, done], "run-0001").map((p) => p.id)).toEqual(["run-0001", "tick-0001", "end-0001"]);
  });
});
