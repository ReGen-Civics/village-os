/**
 * GET /api/admin/search-index: Admin is the door, the one gate decides each
 * control, and a module that is off takes its entries with it.
 */
import { describe, expect, it } from "vitest";
import { register, visibleEntries } from "./adminSearch";
import type { AdminSearchEntry } from "../../shared/adminSearch";
import { STAGE_ACTS } from "../../shared/adminActs/stage";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function harness(opts: { admin: boolean; holds: string[]; off?: string[]; story?: boolean }) {
  const handlers = new Map<string, Handler>();
  const asked: string[] = [];
  const app: any = { get: (path: string, h: Handler) => handlers.set(`GET ${path}`, h) };
  register(app, {
    isAdmin: async () => opts.admin,
    mayStillSee: async (_req: any, cap: any) => {
      asked.push(cap);
      return opts.holds.includes(cap);
    },
    dials: () => [{ key: "comms.quiet_hours", label: "Quiet hours", description: "When nothing is sent.", category: "Comms" }],
    lifecycle: (id) => ((opts.off ?? []).includes(id) ? "off" : "members"),
    storyServed: () => !!opts.story,
  });
  const out: { status: number; body: any } = { status: 200, body: undefined };
  const res: any = {
    status(c: number) { out.status = c; return res; },
    json(b: any) { out.body = b; return res; },
    set() { return res; },
  };
  return { run: async () => { await handlers.get("GET /api/admin/search-index")!({}, res); return out; }, asked };
}

describe("GET /api/admin/search-index", () => {
  it("refuses anybody who is not an admin", async () => {
    const out = await harness({ admin: false, holds: [] }).run();
    expect(out.status).toBe(401);
  });

  it("offers the test email to an admin who holds comms.manage", async () => {
    const out = await harness({ admin: true, holds: ["comms.manage"] }).run();
    const ids = out.body.entries.map((e: AdminSearchEntry) => e.id);
    expect(ids).toContain("comms.test-email");
    expect(ids).toContain("dial.comms.quiet_hours");
  });

  it("hides every control whose key the gate refuses, even from an admin", async () => {
    const out = await harness({ admin: true, holds: [] }).run();
    const ids = out.body.entries.map((e: AdminSearchEntry) => e.id);
    expect(ids).not.toContain("comms.test-email");
    expect(ids).not.toContain("comms.api-key");
    expect(ids).not.toContain("page.mint");
    expect(ids).toContain("season.timezone");
  });

  it("offers the board's acts only while the village serves the board (its story pages)", async () => {
    const onBoard = STAGE_ACTS.filter((a) => a.path === "/project-history" && !a.tab).map((a) => a.id);
    expect(onBoard.length).toBeGreaterThan(0);
    const off = (await harness({ admin: true, holds: [], story: false }).run()).body.entries.map((e: AdminSearchEntry) => e.id);
    expect(onBoard.filter((id) => off.includes(id))).toEqual([]);
    const on = (await harness({ admin: true, holds: [], story: true }).run()).body.entries.map((e: AdminSearchEntry) => e.id);
    expect(onBoard.filter((id) => !on.includes(id))).toEqual([]);
  });

  it("asks the gate once per capability, however many entries name it", async () => {
    const h = harness({ admin: true, holds: ["comms.manage"] });
    await h.run();
    expect(h.asked.filter((c) => c === "comms.manage")).toHaveLength(1);
  });
});

describe("visibleEntries", () => {
  it("drops an entry whose module is off", async () => {
    const e: AdminSearchEntry = { id: "x", kind: "control", tab: "events-admin", title: "X", help: "", synonyms: [], module: "events" };
    expect(await visibleEntries([e], async () => true, () => "off")).toEqual([]);
    expect(await visibleEntries([e], async () => true, () => "public")).toEqual([e]);
    // A tab that follows two modules shows while either is on, and hides only when both are off.
    const two = { ...e, module: undefined, modulesAny: ["forum", "messaging"] };
    expect(await visibleEntries([two], async () => true, () => "off")).toEqual([]);
    expect(await visibleEntries([two], async () => true, (id) => (id === "messaging" ? "members" : "off"))).toEqual([two]);
  });
});
