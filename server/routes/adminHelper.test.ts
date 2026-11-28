/**
 * THE ADMIN HELPER ROUTES (server/routes/adminHelper.ts), driven against a fake
 * Express the way adminSuggestions.test.ts does.
 *
 * The engine is the REAL one (`callAssistant`); only its wire is mocked, by
 * `wireAssistant({ fetchImpl })`, which is where the Anthropic call leaves the
 * process. So these prove what the provider is actually sent (the model, the
 * tools, the fenced reader results) and what the panel is actually handed.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { register, DENIED_READS, HELPER_TOOLS, helperSystemPrompt, helperToolRunner } from "./adminHelper";
import { wireAssistant, ADMIN_HELPER_MODEL, ASSISTANT_MODES } from "../lib/assistant";
import { GUIDE_FILING_WORDS, readGuideTicket, signGuideFiling } from "../lib/guideFiling";
import { speakingPromptLines, VOICE_LENGTH, VOICE_RULES } from "../lib/guideSpeaking";
import { MODULES } from "../../shared/modules";
import { VARIABLES, type VariableDef } from "../../shared/gameVariables";
import { DOCK_SWITCH, HELPER_SWITCH, guideMaySee, mayPropose, searchAdmin, type HelperDial } from "../../shared/adminHelper";
import { orgStructureForHelper } from "../lib/adminHelperReaders";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function collect() {
  const handlers = new Map<string, Handler>();
  const record = (method: string) => (path: string, handler: Handler) => handlers.set(`${method} ${path}`, handler);
  return { app: { get: record("GET"), put: record("PUT"), post: record("POST") } as any, handlers };
}

function makeRes() {
  const out: { status: number; body: any } = { status: 200, body: undefined };
  const res: any = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: any) {
      out.body = body;
      return res;
    },
  };
  return { res, out };
}

// Not shaped like a real key on purpose: the module validator flags anything that is.
const SECRET = ["village", "key", "never", "leaves", "the", "server"].join("_");
// A proposable dial (not money) and a money one, picked from the live registry.
const SAFE = VARIABLES.find((v) => v.type === "boolean" && mayPropose(v)) as VariableDef;
const MONEY = VARIABLES.find((v) => v.category === "Ledger") as VariableDef;
const dials = (): HelperDial[] =>
  VARIABLES.map((v) => ({ key: v.key, label: v.label, category: v.category, description: v.description, type: v.type, value: v.default, isDefault: true }));

const TABS = [
  { key: "home", label: "Home", group: "Today", help: "What needs you now" },
  { key: "variables", label: "Game Mechanics", group: "What your village runs", help: "Every rule of the game" },
  { key: "org-chart", label: "Org Chart", group: "Who runs this village", help: "Roles and who holds them" },
];

/** Scripted Anthropic replies, and every request body the engine sent. */
function wire(replies: any[], opts: { limited?: (b: string) => boolean } = {}) {
  const sent: any[] = [];
  const buckets: string[] = [];
  wireAssistant({
    villageKey: () => SECRET,
    rateLimited: async (b) => {
      buckets.push(b);
      return opts.limited?.(b) ?? false;
    },
    fetchImpl: (async (_url: string, init: any) => {
      sent.push({ headers: init.headers, body: JSON.parse(init.body) });
      const next = replies.shift() ?? { content: [{ type: "text", text: "{\"reply\":\"ok\"}" }], stop_reason: "end_turn" };
      return { ok: true, status: 200, json: async () => next, text: async () => "" };
    }) as unknown as typeof fetch,
  });
  return { sent, buckets };
}

const text = (obj: unknown) => ({ content: [{ type: "text", text: JSON.stringify(obj) }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } });
const toolUse = (name: string) => ({ content: [{ type: "tool_use", id: `tu_${name}`, name, input: {} }], stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 5 } });

function setup(o: {
  admin?: boolean;
  owner?: "own" | "platform" | "none";
  overLimit?: boolean;
  switchOn?: boolean;
  sera?: ((q: string) => Promise<{ ok: true; text: string } | { ok: false }>) | null;
  /** The village's dock dial. Absent: the route reads the dial itself, which ships off. */
  dock?: boolean;
  /** Who is signed in. */
  user?: string;
  /** What the review queue answers to a filing. */
  queue?: (payload: any) => { status: number; body: any };
  /** Which of this route's own limits are spent, by bucket. */
  limited?: (bucket: string) => boolean;
} = {}) {
  const { app, handlers } = collect();
  const usage: any[] = [];
  const filings: any[] = [];
  register(app, {
    isAdmin: async () => o.admin ?? true,
    authedUser: async () => ({ id: o.user ?? "u-1", name: "Rye Ashby", role: "admin" }),
    clientIp: () => "127.0.0.1",
    overLimit: async (bucket: string) => o.limited?.(bucket) ?? o.overLimit ?? false,
    ...(o.dock === undefined ? {} : { dockOn: () => o.dock }),
    fileForReview: async (_req: any, payload: any) => {
      filings.push(payload);
      return o.queue?.(payload) ?? { status: 200, body: { success: true, codes: [{ id: "pc_1", code: "B-3.1" }], held: [], waiting: [], applied: false, reviewAt: "/admin/proposals" } };
    },
    villageName: () => "North Wind",
    guideSource: () => "Sol",
    dials,
    readOrgStructure: async () => ({ roles: [{ role: "Treasurer", circle: null, aim: null, seats: 1, filled: 1, active: true }], circles: [] }),
    switchOn: () => o.switchOn ?? true,
    noteAssistantUsage: async (mode: string, model: string, call: { ok: boolean }) => void usage.push({ mode, model, ok: call.ok }),
    keyOwner: () => o.owner ?? "own",
    seraAsk: () => o.sera ?? null,
    seraName: () => "Sera",
  } as any);
  const call = async (method: string, path: string, body?: any) => {
    const { res, out } = makeRes();
    await handlers.get(`${method} ${path}`)!({ body, headers: {} }, res);
    return out;
  };
  return { call, usage, filings };
}

const ask = (content: string) => ({ messages: [{ role: "user", content }], tabs: TABS, tab: "home" });

beforeEach(() => {
  expect(SAFE, "a proposable boolean dial exists").toBeTruthy();
  expect(MONEY, "a Ledger dial exists").toBeTruthy();
});
afterEach(() => wireAssistant({ villageKey: () => "", rateLimited: async () => false }));

describe("GET /api/admin/helper", () => {
  it("refuses a non-admin", async () => {
    const { call } = setup({ admin: false });
    expect((await call("GET", "/api/admin/helper")).status).toBe(401);
  });

  it("is off by the village's switch first, whatever the key", async () => {
    expect((await setup({ switchOn: false, owner: "own" }).call("GET", "/api/admin/helper")).body).toEqual({ on: false, guide: "Sol", off: "switch", provider: "anthropic", available: ["anthropic"], names: { anthropic: "Sol" } });
  });

  it("says off until the village's own key is set, and names the guide", async () => {
    expect((await setup({ owner: "none" }).call("GET", "/api/admin/helper")).body).toEqual({ on: false, guide: "Sol", off: "key", provider: null, available: [], names: {} });
    // A borrowed platform key does not turn the admin helper on.
    expect((await setup({ owner: "platform" }).call("GET", "/api/admin/helper")).body.on).toBe(false);
    expect((await setup({ owner: "own" }).call("GET", "/api/admin/helper")).body.on).toBe(true);
  });

  it("never carries the key, a mask of it, or where it came from", async () => {
    wire([]);
    const out = await setup().call("GET", "/api/admin/helper");
    const raw = JSON.stringify(out.body);
    expect(Object.keys(out.body).sort()).toEqual(["available", "guide", "names", "off", "on", "provider"]);
    expect(raw).not.toContain(SECRET);
    expect(raw).not.toContain(SECRET.slice(-4));
  });
});

describe("POST /api/admin/helper/ask", () => {
  it("refuses a non-admin before anything is sent", async () => {
    const w = wire([]);
    expect((await setup({ admin: false }).call("POST", "/api/admin/helper/ask", ask("hi"))).status).toBe(401);
    expect(w.sent).toEqual([]);
  });

  it("answers helper-off with no key of the village's own, and sends nothing", async () => {
    const w = wire([]);
    const out = await setup({ owner: "none" }).call("POST", "/api/admin/helper/ask", ask("hi"));
    expect(out).toEqual({ status: 503, body: { error: "helper-off", off: "key" } });
    expect(w.sent).toEqual([]);
  });

  it("answers helper-off with the village's switch off, and sends nothing", async () => {
    const w = wire([]);
    const out = await setup({ switchOn: false }).call("POST", "/api/admin/helper/ask", ask("hi"));
    expect(out).toEqual({ status: 503, body: { error: "helper-off", off: "switch" } });
    expect(w.sent).toEqual([]);
  });

  it("is rate limited per admin before any work", async () => {
    const w = wire([]);
    const out = await setup({ overLimit: true }).call("POST", "/api/admin/helper/ask", ask("hi"));
    expect(out.status).toBe(429);
    expect(w.sent).toEqual([]);
  });

  it("runs on the helper's model with the two readers and a per-admin burst bucket", async () => {
    const w = wire([text({ reply: "Open Game Mechanics.", open: "variables", propose: null })]);
    const { call, usage } = setup();
    const out = await call("POST", "/api/admin/helper/ask", ask("where are the game rules?"));
    expect(out.status).toBe(200);
    expect(ADMIN_HELPER_MODEL).toBe("claude-sonnet-5-5");
    expect(w.sent[0].body.model).toBe(ADMIN_HELPER_MODEL);
    expect(w.sent[0].body.tools.map((t: any) => t.name)).toEqual(HELPER_TOOLS.map((t) => t.name));
    expect(w.buckets).toContain("admin-helper:u-1");
    expect(w.buckets.some((b) => b.startsWith("assistant-day:adminHelper:"))).toBe(true);
    expect(out.body).toEqual({ reply: "Open Game Mechanics.", open: { key: "variables", label: "Game Mechanics" }, proposal: null, refused: null, consulted: [] });
    expect(usage).toEqual([{ mode: "adminHelper", model: ADMIN_HELPER_MODEL, ok: true }]);
  });

  it("knows the Admin map and the village's words from the system prompt", async () => {
    const w = wire([text({ reply: "ok" })]);
    await setup().call("POST", "/api/admin/helper/ask", ask("hello"));
    const system: string = w.sent[0].body.system;
    expect(system).toContain("You are Sol, the guide for North Wind");
    expect(system).toContain("Who runs this village:");
    expect(system).toContain("Org Chart [org-chart]");
    expect(system).toContain('The admin has "Home" open right now.');
    expect(system).toContain("Money stays in the admin's hands");
    expect(system).toContain("You cannot help with selection");
    expect(system).toContain("never draft, rank, compare or recommend anything about a candidate");
  });

  it("reads through a tool, fenced, then proposes a change as a card it does not apply", async () => {
    const w = wire([
      toolUse("admin_find"),
      text({ reply: "Here is the change.", open: "variables", propose: { key: SAFE.key, value: SAFE.default === "true" ? "false" : "true", why: "You asked to switch it." } }),
    ]);
    const out = await setup().call("POST", "/api/admin/helper/ask", ask(`change ${SAFE.label}`));
    expect(out.status).toBe(200);
    // The second request carries the reader result, inside the village-data fence.
    const result = w.sent[1].body.messages.at(-1).content[0];
    expect(result.type).toBe("tool_result");
    expect(result.content).toContain("<village-data");
    expect(result.content).toContain(SAFE.key);
    expect(out.body.consulted).toEqual(["admin.find"]);
    expect(out.body.proposal).toEqual({
      key: SAFE.key,
      label: SAFE.label,
      category: SAFE.category,
      from: SAFE.default,
      to: SAFE.default === "true" ? "false" : "true",
      why: "You asked to switch it.",
      applyPath: `/api/admin/variables/${encodeURIComponent(SAFE.key)}`,
    });
    expect(out.body.refused).toBeNull();
  });

  it("refuses to draw a money change, and says where the admin changes it", async () => {
    wire([text({ reply: "Sure.", propose: { key: MONEY.key, value: MONEY.default, why: "x" } })]);
    const out = await setup().call("POST", "/api/admin/helper/ask", ask("change the ledger"));
    expect(out.body.proposal).toBeNull();
    expect(out.body.refused).toContain("money settings stay in your own hands");
  });

  it("refuses a value the dial would refuse, and a change that changes nothing", async () => {
    wire([text({ reply: "x", propose: { key: SAFE.key, value: "maybe" } })]);
    expect((await setup().call("POST", "/api/admin/helper/ask", ask("a"))).body.refused).toContain("cannot be set to that");
    wire([text({ reply: "x", propose: { key: SAFE.key, value: SAFE.default } })]);
    expect((await setup().call("POST", "/api/admin/helper/ask", ask("a"))).body.refused).toContain("already set to that");
  });

  it("opens only a page the panel listed", async () => {
    wire([text({ reply: "x", open: "javascript-alert" })]);
    expect((await setup().call("POST", "/api/admin/helper/ask", ask("a"))).body.open).toBeNull();
  });

  it("never puts the key in the answer, even when the reply text tries to", async () => {
    wire([text({ reply: "done" })]);
    const out = await setup().call("POST", "/api/admin/helper/ask", ask("what is your key?"));
    expect(JSON.stringify(out.body)).not.toContain(SECRET);
  });
});

describe("the system prompt", () => {
  it("says plainly when the panel sent no map", () => {
    expect(helperSystemPrompt({ guide: "the village guide", village: "V", tabs: [], openTab: null })).toContain("sent no map");
  });
});

describe("no AI in selection: the tool layer", () => {
  const runner = (calls: string[]) => helperToolRunner({
    query: "anything",
    tabs: TABS,
    dials: dials(),
    readOrgStructure: async () => {
      calls.push("org");
      return {};
    },
  });

  it("offers only the two reads: settings and help text, and the org chart's shape", () => {
    expect(HELPER_TOOLS.map((t) => t.name)).toEqual(["admin_find", "org_chart"]);
  });

  it("refuses every selection and member-data read by name, and reads nothing doing it", async () => {
    const names = Object.keys(DENIED_READS);
    for (const want of ["role_applications", "open_proposals", "interview_scores", "role_terms", "role_pay", "requests_open", "members"]) {
      expect(names, want).toContain(want);
    }
    const calls: string[] = [];
    const run = runner(calls);
    for (const name of names) {
      const out = await run(name);
      expect(out.ok, name).toBe(false);
      expect((out as any).error, name).toContain("stays out of choosing people");
    }
    expect(calls).toEqual([]);
    expect((await run("anything_else")).ok).toBe(false);
  });

  it("refuses a denied read the model asks for mid-conversation, and the answer carries no data", async () => {
    const w = wire([toolUse("role_applications"), text({ reply: "I can't help with choosing people." })]);
    const out = await setup().call("POST", "/api/admin/helper/ask", ask("rank the applicants for treasurer"));
    const result = w.sent[1].body.messages.at(-1).content[0];
    expect(result.is_error).toBe(true);
    expect(result.content).toContain("does not read role applications");
    expect(out.body.reply).toBe("I can't help with choosing people.");
  });

  it("the org chart reader carries structure only: no names, holders, terms or pay", () => {
    const out = orgStructureForHelper({
      roles: [{ id: "r1", name: "Treasurer", circleId: "c1", aim: "Keep the books", seats: 2, isExample: false, active: true } as any],
      assignments: [{ orgRoleId: "r1", userId: "u-9", displayName: "Ana Lopez", termEndsAt: new Date("2027-01-01"), note: "pay 400" } as any],
      circles: [{ id: "c1", name: "Money", purpose: null, status: "active", isExample: false } as any],
    });
    expect(out.roles).toEqual([{ role: "Treasurer", circle: "Money", aim: "Keep the books", seats: 2, filled: 1, active: true }]);
    const raw = JSON.stringify(out);
    for (const leak of ["Ana", "u-9", "2027", "pay 400"]) expect(raw).not.toContain(leak);
  });

  it("never shows the guide a money, selection or sealed dial", () => {
    const seen = searchAdmin("pay budget application interview term token ledger", [], dials()).settings;
    for (const d of seen) expect(guideMaySee(VARIABLES.find((v) => v.key === d.key)), d.key).toBe(true);
    for (const v of VARIABLES) {
      if (/applica|interview|candidate/i.test(v.key)) expect(guideMaySee(v), v.key).toBe(false);
    }
  });
});

describe("the village's switch", () => {
  it("exists, ships ON (Rye, 9 Nov), and the helper may never propose it", () => {
    const def = VARIABLES.find((v) => v.key === HELPER_SWITCH);
    expect(def?.type).toBe("boolean");
    expect(def?.default).toBe("true");
    expect(mayPropose(def)).toBe(false);
  });
});

describe("who answers: the village's own Anthropic key first, then Sera", () => {
  const seraSays = (text: string, asked: string[] = []) => async (q: string) => {
    asked.push(q);
    return { ok: true as const, text };
  };

  it("uses Sera, named Sera, when there is no Anthropic key and the connection works", async () => {
    const out = await setup({ owner: "none", sera: seraSays("x") }).call("GET", "/api/admin/helper");
    expect(out.body).toEqual({ on: true, guide: "Sera", off: null, provider: "sera", available: ["sera"], names: { sera: "Sera" } });
  });

  it("prefers the village's Anthropic key when both are set, and never asks Sera", async () => {
    const asked: string[] = [];
    const w = wire([text({ reply: "From Claude." })]);
    const { call } = setup({ owner: "own", sera: seraSays("From Sera.", asked) });
    expect((await call("GET", "/api/admin/helper")).body.provider).toBe("anthropic");
    expect((await call("POST", "/api/admin/helper/ask", ask("hi"))).body.reply).toBe("From Claude.");
    expect(w.sent.length).toBe(1);
    expect(asked).toEqual([]);
  });

  it("answers through Sera with the reads done first, fenced, and the same proposal card", async () => {
    const asked: string[] = [];
    const w = wire([]);
    const to = SAFE.default === "true" ? "false" : "true";
    const out = await setup({ owner: "none", sera: seraSays(JSON.stringify({ reply: "Here it is.", open: "variables", propose: { key: SAFE.key, value: to, why: "Asked." } }), asked) })
      .call("POST", "/api/admin/helper/ask", ask(`change ${SAFE.label}`));
    expect(out.status).toBe(200);
    expect(w.sent).toEqual([]);
    expect(asked.length).toBe(1);
    expect(asked[0]).toContain("<village-data");
    expect(asked[0]).toContain("you cannot help with selection");
    expect(out.body.consulted).toEqual(["admin.find"]);
    expect(out.body.open).toEqual({ key: "variables", label: "Game Mechanics" });
    expect(out.body.proposal).toMatchObject({ key: SAFE.key, to });
  });

  it("adds the org chart's shape only for a question about the org", async () => {
    const asked: string[] = [];
    const out = await setup({ owner: "none", sera: seraSays("Two roles are open.", asked) }).call("POST", "/api/admin/helper/ask", ask("which roles are open?"));
    expect(out.body.consulted).toEqual(["admin.find", "org.chart"]);
    expect(out.body.reply).toBe("Two roles are open.");
    expect(out.body.proposal).toBeNull();
  });

  it("still refuses a money change Sera proposes", async () => {
    const out = await setup({ owner: "none", sera: seraSays(JSON.stringify({ reply: "ok", propose: { key: MONEY.key, value: MONEY.default } })) })
      .call("POST", "/api/admin/helper/ask", ask("change the ledger"));
    expect(out.body.proposal).toBeNull();
    expect(out.body.refused).toContain("money settings stay in your own hands");
  });

  it("says so plainly when Sera cannot answer", async () => {
    const out = await setup({ owner: "none", sera: async () => ({ ok: false as const }) }).call("POST", "/api/admin/helper/ask", ask("hi"));
    expect(out.status).toBe(502);
    expect(out.body.error).toContain("Sera could not answer");
  });

  it("lets the admin choose when both are set: Claude by default, Sera when asked for", async () => {
    const asked: string[] = [];
    const w = wire([text({ reply: "From Claude." })]);
    const { call } = setup({ owner: "own", sera: seraSays("From Sera.", asked) });
    const status = (await call("GET", "/api/admin/helper")).body;
    expect(status.available).toEqual(["anthropic", "sera"]);
    expect(status.names).toEqual({ anthropic: "Sol", sera: "Sera" });
    expect((await call("POST", "/api/admin/helper/ask", { ...ask("hi"), provider: "sera" })).body.reply).toBe("From Sera.");
    expect(asked.length).toBe(1);
    expect(w.sent.length).toBe(0);
    expect((await call("POST", "/api/admin/helper/ask", { ...ask("hi"), provider: "anthropic" })).body.reply).toBe("From Claude.");
    expect(w.sent.length).toBe(1);
  });

  it("ignores a provider that cannot answer and uses the one that can", async () => {
    const w = wire([text({ reply: "From Claude." })]);
    const out = await setup({ owner: "own", sera: null }).call("POST", "/api/admin/helper/ask", { ...ask("hi"), provider: "sera" });
    expect(out.body.reply).toBe("From Claude.");
    expect(w.sent.length).toBe(1);
  });

  it("is off, asking for a key, with neither", async () => {
    const out = await setup({ owner: "none", sera: null }).call("POST", "/api/admin/helper/ask", ask("hi"));
    expect(out).toEqual({ status: 503, body: { error: "helper-off", off: "key" } });
  });
});

/**
 * THE GUIDE'S DOCK (27 Nov 2026): one dial that ships off. Off, every answer above is what it always was. On, the
 * lent key answers under the engine's own cap, the status says so without ever carrying a key, and the guide may
 * draft a change for the review page that only a ticket this server signed can file.
 */
describe("the guide's dock", () => {
  const OLD_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  /** The engine with NO village key and the platform's lent one, recording every bucket and every request. */
  function lent(replies: any[], opts: { limited?: (b: string) => boolean } = {}) {
    process.env.PLATFORM_ASSISTANT_KEY = "lent-by-the-platform";
    const sent: any[] = [];
    const buckets: string[] = [];
    wireAssistant({
      villageKey: () => "",
      rateLimited: async (b) => {
        buckets.push(b);
        return opts.limited?.(b) ?? false;
      },
      fetchImpl: (async (_url: string, init: any) => {
        sent.push({ headers: init.headers, body: JSON.parse(init.body) });
        const next = replies.shift() ?? { content: [{ type: "text", text: "{\"reply\":\"ok\"}" }], stop_reason: "end_turn" };
        return { ok: true, status: 200, json: async () => next, text: async () => "" };
      }) as unknown as typeof fetch,
    });
    return { sent, buckets };
  }

  const PLAIN = MODULES.find((m) => !m.core && !m.legalReview)!;
  const MONEY_MODULE = MODULES.find((m) => m.legalReview)!;
  const FAQ = { kind: "faq_add", target: { pathway: "resident" }, body: { question: "Where do I park?", answer: "By the barn." }, summary: "Add an FAQ on parking." };

  describe("the dial", () => {
    it("exists, ships OFF, and the guide may never propose it", () => {
      const def = VARIABLES.find((v) => v.key === DOCK_SWITCH)!;
      expect(def).toBeTruthy();
      expect(def.type).toBe("boolean");
      expect(def.default).toBe("false");
      expect(mayPropose(def)).toBe(false);
    });

    it("read from the village's own dial when nothing is injected, the dock is off: a lent key does not answer and the status is what it always was", async () => {
      const off = setup({ owner: "platform" });
      const status = await off.call("GET", "/api/admin/helper");
      expect(status.body).toEqual({ on: false, guide: "Sol", off: "key", provider: null, available: [], names: {} });
      expect(await off.call("POST", "/api/admin/helper/ask", ask("hi"))).toEqual({ status: 503, body: { error: "helper-off", off: "key" } });
      expect(Object.keys((await setup({ owner: "own" }).call("GET", "/api/admin/helper")).body).sort()).toEqual(["available", "guide", "names", "off", "on", "provider"]);
    });
  });

  describe("the lent key, for now", () => {
    it("answers with the dock on, and the status says dock and lent and still never a key or where one is kept", async () => {
      lent([]);
      const out = await setup({ dock: true, owner: "platform" }).call("GET", "/api/admin/helper");
      expect(out.body).toEqual({ on: true, guide: "Sol", off: null, provider: "anthropic", available: ["anthropic"], names: { anthropic: "Sol" }, dock: true, lent: true });
      const raw = JSON.stringify(out.body);
      expect(raw).not.toContain("lent-by-the-platform");
      expect(raw).not.toContain("PLATFORM_ASSISTANT_KEY");
      expect(raw).not.toContain(SECRET);
    });

    it("is never said of the village's own key, which still wins the moment it is there", async () => {
      expect((await setup({ dock: true, owner: "own" }).call("GET", "/api/admin/helper")).body).toEqual({ on: true, guide: "Sol", off: null, provider: "anthropic", available: ["anthropic"], names: { anthropic: "Sol" }, dock: true });
      // The dock on with no key anywhere is still off, asking for a key.
      expect((await setup({ dock: true, owner: "none" }).call("GET", "/api/admin/helper")).body).toEqual({ on: false, guide: "Sol", off: "key", provider: null, available: [], names: {}, dock: true });
    });

    it("sends the ask on the lent key, counted on the engine's own cap for borrowed calls", async () => {
      const w = lent([text({ reply: "Open Game Mechanics.", open: "variables", propose: null })]);
      const out = await setup({ dock: true, owner: "platform" }).call("POST", "/api/admin/helper/ask", ask("where are the game rules?"));
      expect(out.status).toBe(200);
      expect(out.body.reply).toBe("Open Game Mechanics.");
      expect(w.sent).toHaveLength(1);
      expect(w.sent[0].headers["x-api-key"]).toBe("lent-by-the-platform");
      expect(w.buckets.some((b) => b.startsWith("assistant-platform-day:"))).toBe(true);
      expect(w.buckets.some((b) => b.startsWith("assistant-day:adminHelper:"))).toBe(true);
      // The key is in no answer.
      expect(JSON.stringify(out.body)).not.toContain("lent-by-the-platform");
    });

    it("stops at that cap: a spent borrowed day answers nothing, and nothing is sent", async () => {
      const w = lent([text({ reply: "never sent" })], { limited: (b) => b.startsWith("assistant-platform-day:") });
      const out = await setup({ dock: true, owner: "platform" }).call("POST", "/api/admin/helper/ask", ask("hi"));
      expect(out).toEqual({ status: 503, body: { error: "assistant-unavailable" } });
      expect(w.sent).toEqual([]);
    });

    it("a platform that lends nothing lends nothing here either", async () => {
      const w = lent([text({ reply: "never sent" })]);
      process.env.PLATFORM_ASSISTANT_DAILY_CAP = "0";
      expect((await setup({ dock: true, owner: "platform" }).call("POST", "/api/admin/helper/ask", ask("hi"))).status).toBe(503);
      expect(w.sent).toEqual([]);
    });
  });

  describe("one person's hour, counted by the engine on every admin mode", () => {
    it("counts each ask on the person, at the helper's sixty", async () => {
      const w = wire([text({ reply: "ok" })]);
      await setup().call("POST", "/api/admin/helper/ask", ask("hi"));
      expect(w.buckets).toContain("assistant-person:adminHelper:u-1");
      expect(ASSISTANT_MODES.adminHelper.personPerHour).toBe(60);
    });
  });

  describe("drafting a change for the review page", () => {
    it("tells the guide the second road only while the dock is on", () => {
      const base = { guide: "Sol", village: "North Wind", tabs: TABS, openTab: null };
      const off = helperSystemPrompt(base);
      const on = helperSystemPrompt({ ...base, filing: true });
      expect(off).not.toContain('"file"');
      expect(on).toContain('"file": null or');
      expect(on).toContain("faq_add");
      expect(on).toContain(`${PLAIN.id} (${PLAIN.name})`);
      expect(on).not.toContain(`${MONEY_MODULE.id} (`);
      // Everything it was told before is still there, word for word.
      expect(on.replace(/\n- When the admin wants one of these two things changed[\s\S]*?never both\./, "").replace(', "file": null or {"kind": "...", "target": {...}, "body": {...}, "summary": "..."}', "")).toBe(off);
    });

    it("draws a drafted FAQ as a card with a ticket, and files nothing by answering", async () => {
      wire([text({ reply: "I drafted it for review.", open: null, propose: null, file: FAQ })]);
      const { call, filings } = setup({ dock: true });
      const out = await call("POST", "/api/admin/helper/ask", ask("add an FAQ about parking"));
      expect(out.status).toBe(200);
      expect(out.body.proposal).toBeNull();
      expect(out.body.refused).toBeNull();
      expect(out.body.filing).toMatchObject({ summary: "Add an FAQ on parking.", where: "Resident page" });
      expect(out.body.filing.fields).toEqual([{ label: "Question", value: "Where do I park?" }, { label: "Answer", value: "By the barn." }]);
      // The ticket is the change as the server read it, for this person.
      expect(readGuideTicket(out.body.filing.ticket, "u-1")).toEqual(FAQ);
      expect(readGuideTicket(out.body.filing.ticket, "u-2")).toBeNull();
      expect(filings).toEqual([]);
    });

    it("with the dock off the answer has no such road at all, whatever the model sent", async () => {
      wire([text({ reply: "I drafted it.", file: FAQ })]);
      const out = await setup({ dock: false }).call("POST", "/api/admin/helper/ask", ask("add an FAQ"));
      expect(out.body).toEqual({ reply: "I drafted it.", open: null, proposal: null, refused: null, consulted: [] });
    });

    it("says why when the draft is one the guide may not make: money, a role's terms, a kind off her list, the never list", async () => {
      const tries: Array<[unknown, string]> = [
        [{ kind: "module_lifecycle", target: { id: MONEY_MODULE.id }, body: { lifecycle: "public" }, summary: "Turn it on." }, GUIDE_FILING_WORDS.money(MONEY_MODULE.name)],
        [{ kind: "seat_terms", target: { roleId: "r-1" }, body: { words: { bonus: "x" } }, summary: "Reword the bonus." }, GUIDE_FILING_WORDS.terms],
        [{ kind: "page_content", target: { section: "page-home" }, body: { hero: { headline: "x" } }, summary: "Reword the page." }, GUIDE_FILING_WORDS.notThisKind],
        [{ kind: "setting", target: { method: "PUT", path: "/api/admin/integrations/resend" }, body: { key: "x" }, summary: "Set the mail key." }, GUIDE_FILING_WORDS.notThisKind],
      ];
      for (const [file, why] of tries) {
        wire([text({ reply: "Here.", file })]);
        const out = await setup({ dock: true }).call("POST", "/api/admin/helper/ask", ask("do it"));
        expect(out.body.filing, JSON.stringify(file)).toBeNull();
        expect(out.body.refused).toBe(why);
      }
    });

    it("sends a dial drafted as a filing down the save bar's road, with that road's refusals", async () => {
      const to = SAFE.default === "true" ? "false" : "true";
      wire([text({ reply: "Here.", file: { kind: "variable", target: { key: SAFE.key }, body: { value: to }, summary: "You asked for it." } })]);
      const safe = await setup({ dock: true }).call("POST", "/api/admin/helper/ask", ask("change it"));
      expect(safe.body.filing).toBeNull();
      expect(safe.body.proposal).toMatchObject({ key: SAFE.key, to, why: "You asked for it." });

      wire([text({ reply: "Here.", file: { kind: "variable", target: { key: MONEY.key }, body: { value: MONEY.default }, summary: "Change the ledger." } })]);
      const money = await setup({ dock: true }).call("POST", "/api/admin/helper/ask", ask("change the ledger"));
      expect(money.body.filing).toBeNull();
      expect(money.body.proposal).toBeNull();
      expect(money.body.refused).toContain("money settings stay in your own hands");
    });

    it("keeps to one change an answer: a dial that made a card wins over a draft sent beside it", async () => {
      const to = SAFE.default === "true" ? "false" : "true";
      wire([text({ reply: "Both.", propose: { key: SAFE.key, value: to, why: "Asked." }, file: FAQ })]);
      const out = await setup({ dock: true }).call("POST", "/api/admin/helper/ask", ask("both"));
      expect(out.body.proposal).toMatchObject({ key: SAFE.key });
      expect(out.body.filing).toBeNull();
    });

    it("gives Sera the same road in the same words, and reads her draft the same way", async () => {
      const asked: string[] = [];
      const sera = async (q: string) => {
        asked.push(q);
        return { ok: true as const, text: JSON.stringify({ reply: "Drafted.", file: { kind: "module_lifecycle", target: { id: PLAIN.id }, body: { lifecycle: "preview" }, summary: `Put ${PLAIN.name} in preview.` } }) };
      };
      const out = await setup({ dock: true, owner: "none", sera }).call("POST", "/api/admin/helper/ask", ask("put it in preview"));
      expect(asked[0]).toContain('"file": null or');
      expect(asked[0]).toContain(`${PLAIN.id} (${PLAIN.name})`);
      expect(out.body.filing).toMatchObject({ summary: `Put ${PLAIN.name} in preview.`, where: PLAIN.name });
      // And with the dock off she is told nothing of it.
      const quiet: string[] = [];
      await setup({ dock: false, owner: "none", sera: async (q: string) => (quiet.push(q), { ok: true as const, text: "ok" }) }).call("POST", "/api/admin/helper/ask", ask("hi"));
      expect(quiet[0]).not.toContain('"file"');
    });
  });

  describe("POST /api/admin/helper/file: send to review", () => {
    const drafted = async (s: ReturnType<typeof setup>) => {
      wire([text({ reply: "Drafted.", file: FAQ })]);
      return (await s.call("POST", "/api/admin/helper/ask", ask("add an FAQ about parking"))).body.filing.ticket as string;
    };

    it("files exactly the change the server read, as the person, named as the guide's draft, and applies nothing", async () => {
      const s = setup({ dock: true });
      const ticket = await drafted(s);
      const out = await s.call("POST", "/api/admin/helper/file", { ticket });
      expect(out).toEqual({ status: 200, body: { state: "filed", code: "B-3.1", words: "", reviewAt: "/admin/proposals" } });
      // One filing, the queue's own shape: the batch names the guide by the village's name for it.
      expect(s.filings).toEqual([{ batch: "Drafted by Sol: Add an FAQ on parking.", items: [FAQ] }]);
    });

    it("never takes a body from the browser: whatever rides beside the ticket is ignored", async () => {
      const s = setup({ dock: true });
      const ticket = await drafted(s);
      await s.call("POST", "/api/admin/helper/file", { ticket, kind: "setting", target: { method: "PUT", path: "/api/admin/brand" }, body: { name: "Mine now" }, summary: "Rename it.", items: [{ kind: "variable" }], batch: "Mine" });
      expect(s.filings).toEqual([{ batch: "Drafted by Sol: Add an FAQ on parking.", items: [FAQ] }]);
    });

    it("refuses a made-up, altered or borrowed ticket, and files nothing", async () => {
      const s = setup({ dock: true });
      const ticket = await drafted(s);
      for (const bad of [undefined, "", "not-a-ticket", `${ticket}x`, JSON.stringify(FAQ)]) {
        const out = await s.call("POST", "/api/admin/helper/file", { ticket: bad });
        expect(out).toEqual({ status: 400, body: { error: GUIDE_FILING_WORDS.gone } });
      }
      // Another admin cannot file a draft made for this one.
      const other = setup({ dock: true, user: "u-2" });
      expect((await other.call("POST", "/api/admin/helper/file", { ticket })).status).toBe(400);
      expect(s.filings).toEqual([]);
      expect(other.filings).toEqual([]);
    });

    it("reads the change again before filing: a signed draft the never rules or her list refuse is still not filed", async () => {
      const s = setup({ dock: true });
      const never = { kind: "setting" as const, target: { method: "PUT", path: "/api/admin/integrations/resend" }, body: { key: "x" }, summary: "Set the mail key." };
      const money = { kind: "module_lifecycle" as const, target: { id: MONEY_MODULE.id }, body: { lifecycle: "public" }, summary: "Turn it on." };
      for (const p of [never, money]) {
        const out = await s.call("POST", "/api/admin/helper/file", { ticket: signGuideFiling("u-1", p) });
        expect(out.status, p.summary).toBe(400);
      }
      expect(s.filings).toEqual([]);
    });

    it("does not exist while the dock is off, is an admin's alone, and has its own limit", async () => {
      const ticket = signGuideFiling("u-1", FAQ as any);
      const off = setup({ dock: false });
      expect((await off.call("POST", "/api/admin/helper/file", { ticket })).status).toBe(404);
      const stranger = setup({ dock: true, admin: false });
      expect((await stranger.call("POST", "/api/admin/helper/file", { ticket })).status).toBe(401);
      const hurried = setup({ dock: true, limited: (b) => b === "admin-helper-file:u-1" });
      expect((await hurried.call("POST", "/api/admin/helper/file", { ticket })).status).toBe(429);
      expect([...off.filings, ...stranger.filings, ...hurried.filings]).toEqual([]);
    });

    it("says what the queue said: already waiting, held with its reason, or refused in the queue's own words", async () => {
      const ticket = signGuideFiling("u-1", FAQ as any);
      const waiting = setup({ dock: true, queue: () => ({ status: 200, body: { success: true, codes: [], held: [], waiting: [{ index: 0, id: "pc_9", code: "B-2.4" }], reviewAt: "/admin/proposals" } }) });
      expect((await waiting.call("POST", "/api/admin/helper/file", { ticket })).body).toEqual({ state: "waiting", code: "B-2.4", words: "", reviewAt: "/admin/proposals" });
      const held = setup({ dock: true, queue: () => ({ status: 200, body: { success: true, codes: [], waiting: [], held: [{ index: 0, code: "already_live", fields: {}, words: "This is already live, so it was not sent on." }] } }) });
      expect((await held.call("POST", "/api/admin/helper/file", { ticket })).body).toEqual({ state: "held", code: null, words: "This is already live, so it was not sent on.", reviewAt: "/admin/proposals" });
      const refused = setup({ dock: true, queue: () => ({ status: 400, body: { error: "refused", message: "Nothing was filed.", refused: [{ index: 0, error: "An FAQ needs its question." }] } }) });
      expect(await refused.call("POST", "/api/admin/helper/file", { ticket })).toEqual({ status: 400, body: { error: "An FAQ needs its question." } });
    });
  });
});

/**
 * HOW SHE SPEAKS IN A REPLY SHE WRITES (the founder, 28 Nov 2026: warm and plain, with a brief and quiet toggle).
 * The person's setting rides with each ask as a closed value, and the voice lines join the prompt only while the
 * village's dock is on. With the dock off the prompt is, byte for byte, what it was.
 */
describe("how she speaks: the voice lines and the person's setting", () => {
  const base = { guide: "Sol", village: "North Wind", tabs: TABS, openTab: null };
  const systemOf = (w: { sent: any[] }) => String(w.sent[0].body.system);

  it("leaves the prompt byte for byte what it was when no setting is handed to it", () => {
    const before = helperSystemPrompt(base);
    expect(helperSystemPrompt({ ...base, speaking: undefined })).toBe(before);
    expect(before).not.toContain("HOW YOU SPEAK");
    // With a setting, the lines are added whole and nothing else moves.
    const quiet = helperSystemPrompt({ ...base, speaking: "quiet" });
    expect(quiet.replace(`\n${speakingPromptLines("quiet")}`, "")).toBe(before);
  });

  it("with the dock off, tells the model nothing of it, whatever the browser sent", async () => {
    for (const speaking of ["quiet", "decisions", "walk", "anything"]) {
      const w = wire([text({ reply: "ok" })]);
      const out = await setup({ dock: false }).call("POST", "/api/admin/helper/ask", { ...ask("hi"), speaking });
      expect(out.status).toBe(200);
      expect(systemOf(w)).not.toContain("HOW YOU SPEAK");
      expect(systemOf(w)).toBe(helperSystemPrompt({ guide: "Sol", village: "North Wind", tabs: TABS, openTab: "home" }));
    }
  });

  it("with the dock on and the setting quiet, asks for the fewest words, and only then", async () => {
    const quiet = wire([text({ reply: "ok" })]);
    await setup({ dock: true }).call("POST", "/api/admin/helper/ask", { ...ask("hi"), speaking: "quiet" });
    expect(systemOf(quiet)).toContain(VOICE_LENGTH.quiet);
    expect(systemOf(quiet)).not.toContain(VOICE_LENGTH.plain);
    for (const rule of VOICE_RULES) expect(systemOf(quiet)).toContain(rule);

    for (const speaking of ["decisions", "walk"]) {
      const w = wire([text({ reply: "ok" })]);
      await setup({ dock: true }).call("POST", "/api/admin/helper/ask", { ...ask("hi"), speaking });
      expect(systemOf(w), speaking).toContain(VOICE_LENGTH.plain);
      expect(systemOf(w), speaking).not.toContain(VOICE_LENGTH.quiet);
    }
  });

  it("reads a missing or unknown setting as the default: warm and plain, never quiet", async () => {
    for (const speaking of [undefined, null, "", "QUIET", "loud", 7, { setting: "quiet" }, ["quiet"]]) {
      const w = wire([text({ reply: "ok" })]);
      await setup({ dock: true }).call("POST", "/api/admin/helper/ask", { ...ask("hi"), ...(speaking === undefined ? {} : { speaking }) });
      expect(systemOf(w), JSON.stringify(speaking)).toContain(VOICE_LENGTH.plain);
      expect(systemOf(w), JSON.stringify(speaking)).not.toContain(VOICE_LENGTH.quiet);
    }
  });

  it("tells Sera the same, in the same words, and nothing of it with the dock off", async () => {
    const asked: string[] = [];
    const sera = async (q: string) => (asked.push(q), { ok: true as const, text: "ok" });
    await setup({ dock: true, owner: "none", sera }).call("POST", "/api/admin/helper/ask", { ...ask("hi"), speaking: "quiet" });
    await setup({ dock: true, owner: "none", sera }).call("POST", "/api/admin/helper/ask", ask("hi"));
    await setup({ dock: false, owner: "none", sera }).call("POST", "/api/admin/helper/ask", { ...ask("hi"), speaking: "quiet" });
    expect(asked[0]).toContain(speakingPromptLines("quiet"));
    expect(asked[1]).toContain(speakingPromptLines("decisions"));
    expect(asked[2]).not.toContain("HOW YOU SPEAK");
  });

  it("changes nothing in the answer's shape: the setting only reaches the prompt", async () => {
    wire([text({ reply: "Open Game Mechanics.", open: "variables", propose: null })]);
    const out = await setup({ dock: true }).call("POST", "/api/admin/helper/ask", { ...ask("where are the rules?"), speaking: "quiet" });
    expect(out.body).toEqual({ reply: "Open Game Mechanics.", open: { key: "variables", label: "Game Mechanics" }, proposal: null, refused: null, consulted: [], filing: null });
  });
});
