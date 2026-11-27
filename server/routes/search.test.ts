/**
 * FIND ANYTHING's routes (server/routes/search.ts) against a fake Express. The assistant engine is real; only its
 * provider wire is mocked. Invented people and places only.
 *
 *   - a visitor never gets a member page, an admin page or a person; a member gets both, an admin gets settings;
 *   - a module that is off, or members-only to a visitor, hides its page; a story page follows the switches;
 *   - the guide's answer is held to the reader's own list, so an invented path is dropped;
 *   - with no key the guide answers `unavailable` (a 200 the dialog draws beside its own results), and nothing is sent.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { register, type SearchDeps } from "./search";
import { wireAssistant } from "../lib/assistant";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

const MODULES: Record<string, string> = { map: "public", forum: "public", library: "members", messaging: "members", "hidden-map": "members", governance: "members", journal: "members", stays: "off" };

function setup(viewer: any | null, opts: { admin?: boolean; holds?: string[]; story?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const app = {
    get: (p: string, h: Handler) => handlers.set(`GET ${p}`, h),
    post: (p: string, h: Handler) => handlers.set(`POST ${p}`, h),
  } as any;
  const usage: Array<{ mode: string; userId: string | null }> = [];
  const deps: SearchDeps = {
    authedUser: async () => viewer,
    isAdmin: async () => !!opts.admin,
    mayStillSee: async (_req: any, cap: string) => (opts.holds ?? []).includes(cap),
    clientIp: () => "203.0.113.9",
    overLimit: async () => false,
    lifecycle: (id: string) => MODULES[id] ?? "off",
    storyServed: () => !!opts.story,
    villageName: () => "North Wind",
    commitmentName: () => "",
    villageGuideName: () => "Sol",
    noteAssistantUsage: async (mode: string, _m: string, _c: unknown, userId: string | null) => void usage.push({ mode, userId }),
    sources: {
      roles: async () => [{ id: "garden-lead", name: "Garden Lead", aim: "Keeps the food forest growing.", path: "/roles/garden-lead" }],
      circles: async () => [{ id: "c-food", name: "Food Circle", purpose: "Feeds the village.", aliases: ["kitchen"] }],
      quests: async () => [
        { id: "q1", title: "Build the compost bays", subtitle: "Three bays.", status: "open" },
        { id: "q2", title: "An old quest", status: "closed" },
      ],
      people: async () => [{ handle: "ana-example", name: "Ana Example" }],
    } as any,
  } as any;
  register(app, deps);
  const run = async (key: string, body?: any) => {
    const out: { status: number; body: any } = { status: 200, body: undefined };
    const res: any = { set() { return res; }, status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
    await handlers.get(key)!({ body, headers: {} }, res);
    return out;
  };
  return { index: () => run("GET /api/search/index"), ask: (query: unknown) => run("POST /api/search/guide", { query }), usage };
}

const member = { id: "u-member", role: "member", membershipGranted: true, name: "Mo Example" };
const newcomer = { id: "u-new", role: "member", membershipGranted: false, stageGranted: null, name: "New Example" };

let reply = '{"picks":[]}';
const sent: any[] = [];
function wire(key: string) {
  wireAssistant({
    villageKey: () => key,
    rateLimited: async () => false,
    fetchImpl: (async (_u: string, init: any) => {
      sent.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: reply }], stop_reason: "end_turn" }), text: async () => "" };
    }) as unknown as typeof fetch,
  });
}
beforeEach(() => {
  sent.length = 0;
  reply = '{"picks":[]}';
  delete process.env.PLATFORM_ASSISTANT_KEY;
  wire("village-key");
});
afterEach(() => wireAssistant({ villageKey: () => "", rateLimited: async () => false }));

const paths = (body: any) => (body.entries as Array<{ path: string }>).map((e) => e.path);
const kinds = (body: any) => new Set((body.entries as Array<{ kind: string }>).map((e) => e.kind));

describe("GET /api/search/index: who sees what", () => {
  it("gives a visitor public pages, roles, circles and open quests, and never a member page or a person", async () => {
    const { body } = await setup(null).index();
    const p = paths(body);
    expect(p).toEqual(expect.arrayContaining(["/quests", "/roles", "/map", "/forum", "/login", "/roles/garden-lead", "/circles/c-food", "/quests/q1"]));
    for (const memberOnly of ["/library", "/messages", "/hidden-map", "/governance/decisions", "/profile", "/journal", "/admin", "/governance/work"]) expect(p, memberOnly).not.toContain(memberOnly);
    expect(p).not.toContain("/quests/q2");
    expect(kinds(body).has("person")).toBe(false);
    expect(kinds(body).has("setting")).toBe(false);
    expect(body.people).toBe(false);
    expect(JSON.stringify(body)).not.toContain("Ana Example");
  });

  it("keeps a module that is off out for everyone, and a story page out while the village does not serve it", async () => {
    expect(paths((await setup(member).index()).body)).not.toContain("/stay");
    expect(paths((await setup(null).index()).body)).not.toContain("/team");
    expect(paths((await setup(null, { story: true }).index()).body)).toContain("/team");
  });

  it("gives a signed-in account the village has not admitted its own pages and no member page or person", async () => {
    const { body } = await setup(newcomer).index();
    const p = paths(body);
    expect(p).toContain("/profile");
    expect(p).not.toContain("/login");
    expect(p).not.toContain("/governance/decisions");
    expect(kinds(body).has("person")).toBe(false);
  });

  it("gives a member the member pages and the village's people by handle", async () => {
    const { body } = await setup(member).index();
    const p = paths(body);
    expect(p).toEqual(expect.arrayContaining(["/library", "/messages", "/governance/decisions", "/profile/ana-example"]));
    expect(p).not.toContain("/admin");
    expect(body.people).toBe(true);
  });

  it("opens the treasury desk only to a holder of one of its powers, through the gate", async () => {
    expect(paths((await setup(member).index()).body)).not.toContain("/governance/treasury#desks");
    expect(paths((await setup(member, { holds: ["cash.pay"] }).index()).body)).toContain("/governance/treasury#desks");
  });

  it("gives an admin Admin's settings, filtered by the same gate admin search asks", async () => {
    const { body } = await setup({ ...member, role: "admin" }, { admin: true, holds: ["comms.manage"] }).index();
    const p = paths(body);
    expect(p).toContain("/admin");
    expect(p).toContain("/admin?tab=comms-settings&setting=comms.test-email");
    // operator.secrets is not held, so the key control is not offered.
    expect(p).not.toContain("/admin?tab=comms-settings&setting=comms.api-key");
  });

  it("names the guide as the village named it, and says whether it can answer", async () => {
    expect((await setup(null).index()).body.guide).toEqual({ name: "Sol", available: true });
    wire("");
    expect((await setup(null).index()).body.guide).toEqual({ name: "Sol", available: false });
  });
});

describe("POST /api/search/guide", () => {
  it("keeps only paths on the reader's own list: an invented path and a member page a visitor cannot open are dropped", async () => {
    reply = JSON.stringify({ picks: [{ path: "/secret-garden", why: "Made up." }, { path: "/library", why: "Members only." }, { path: "/roles/garden-lead", why: "The garden role." }] });
    const { status, body } = await setup(null).ask("someone who looks after plants");
    expect(status).toBe(200);
    expect(body).toEqual({ state: "answered", guide: "Sol", picks: [{ path: "/roles/garden-lead", title: "Garden Lead", kind: "role", why: "The garden role." }] });
  });

  it("sends only the typed words and the reader's places: no person, no member page for a visitor", async () => {
    const s = setup(null);
    await s.ask("plantas");
    const body = sent[0];
    expect(body.messages).toEqual([{ role: "user", content: "plantas" }]);
    expect(body.system).toContain("You are Sol, the guide of North Wind.");
    expect(body.system).toContain('"path":"/roles/garden-lead"');
    expect(body.system).not.toContain("/library");
    expect(body.system).not.toContain("Ana Example");
    expect(s.usage).toEqual([{ mode: "find", userId: null }]);
  });

  it("never sends a member's people either", async () => {
    const s = setup(member);
    await s.ask("ana");
    expect(sent[0].system).not.toContain("Ana Example");
    expect(sent[0].system).not.toContain("/profile/ana-example");
    expect(s.usage).toEqual([{ mode: "find", userId: "u-member" }]);
  });

  it("answers unavailable with no key, and sends nothing upstream", async () => {
    wire("");
    const { status, body } = await setup(member).ask("garden");
    expect(status).toBe(200);
    expect(body).toEqual({ state: "unavailable", guide: "Sol" });
    expect(sent).toEqual([]);
  });

  it("refuses an empty question, and names the limit with a 429", async () => {
    expect((await setup(null).ask("   ")).status).toBe(400);
    // overLimit says yes: a 429 the dialog turns into a gentle line.
    const handlers = new Map<string, Handler>();
    register({ get: () => undefined, post: (p: string, h: Handler) => handlers.set(p, h) } as any, {
      authedUser: async () => null, isAdmin: async () => false, mayStillSee: async () => false, clientIp: () => "203.0.113.9", overLimit: async () => true,
      lifecycle: () => "off", storyServed: () => false, villageName: () => "V", commitmentName: () => "", villageGuideName: () => "", noteAssistantUsage: async () => undefined,
      sources: { roles: async () => [], circles: async () => [], quests: async () => [], people: async () => [] },
    } as any);
    const out: any = {};
    const res: any = { set() { return res; }, status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
    await handlers.get("/api/search/guide")!({ body: { query: "garden" }, headers: {} }, res);
    expect(out.status).toBe(429);
    expect(sent).toEqual([]);
  });
});
