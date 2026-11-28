/**
 * GET /api/admin/search-index: Admin is the door, the one gate decides each
 * control, and a module that is off takes its entries with it.
 */
import { describe, expect, it } from "vitest";
import { SERVED_ACT_ENTRIES, TAB_ACT_ENTRIES, register, visibleEntries, type AdminPageWords } from "./adminSearch";
import { dialEntry, type AdminSearchEntry } from "../../shared/adminSearch";
import { ADMIN_ACT_WORDS_ES } from "../../shared/adminActs/es";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function harness(opts: { admin: boolean; holds: string[]; off?: string[]; locale?: string }) {
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
  });
  const out: { status: number; body: any; headers: Record<string, string> } = { status: 200, body: undefined, headers: {} };
  const res: any = {
    status(c: number) { out.status = c; return res; },
    json(b: any) { out.body = b; return res; },
    set(k: string, v: string) { out.headers[k.toLowerCase()] = v; return res; },
  };
  // A read with no language sends no header at all, as the browser does for English.
  const req = opts.locale ? { headers: { "x-village-locale": opts.locale } } : {};
  return { run: async () => { await handlers.get("GET /api/admin/search-index")!(req, res); return out; }, asked };
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

  it("asks the gate once per capability, however many entries name it", async () => {
    const h = harness({ admin: true, holds: ["comms.manage"] });
    await h.run();
    expect(h.asked.filter((c) => c === "comms.manage")).toHaveLength(1);
  });
});

describe("GET /api/admin/search-index in the reader's language", () => {
  const byId = (body: any) => new Map<string, AdminSearchEntry>(body.entries.map((e: AdminSearchEntry) => [e.id, e]));
  const HOLDS = ["comms.manage", "operator.secrets", "token.mint", "intake.moderate"];

  it("with no language answers exactly what it answered before: the English entries and nothing else", async () => {
    const out = await harness({ admin: true, holds: HOLDS }).run();
    expect(Object.keys(out.body)).toEqual(["entries"]);
    const dial = dialEntry({ key: "comms.quiet_hours", label: "Quiet hours", description: "When nothing is sent.", category: "Comms" });
    const english = await visibleEntries([...SERVED_ACT_ENTRIES, dial], async (cap) => HOLDS.includes(cap), () => "members");
    expect(out.body.entries).toEqual(english);
    // The registry's own objects, untouched: nothing was copied or reworded on the way out.
    for (const e of out.body.entries as AdminSearchEntry[]) if (e.kind !== "dial") expect(SERVED_ACT_ENTRIES).toContain(e);
  });

  it("answers the same English for a language the village does not translate into, and for English", async () => {
    const english = JSON.stringify((await harness({ admin: true, holds: HOLDS }).run()).body);
    for (const locale of ["fr", "en", "en-GB", "zz", "es-CR", " "]) {
      expect(JSON.stringify((await harness({ admin: true, holds: HOLDS, locale }).run()).body), locale).toBe(english);
    }
  });

  it("with X-Village-Locale: es serves the entries in Spanish, with the English words kept as synonyms", async () => {
    const out = await harness({ admin: true, holds: HOLDS, locale: "es" }).run();
    const got = byId(out.body);
    const test = got.get("comms.test-email")!;
    expect(test.title).toBe(ADMIN_ACT_WORDS_ES["comms.test-email"].title);
    expect(test.help).toBe(ADMIN_ACT_WORDS_ES["comms.test-email"].help);
    expect(test.synonyms).toContain("Send me a test email");
    expect(test.synonyms).toContain("send me a test");
    // Its address, its key and its kind are the registry's own.
    expect(test).toMatchObject({ kind: "control", tab: "comms-settings", capability: "comms.manage" });
    const act = got.get("gate.players.set-stage")!;
    expect(act.title).toBe(ADMIN_ACT_WORDS_ES["gate.players.set-stage"].title);
    // Every served entry that is not a dial is in Spanish.
    const english = (out.body.entries as AdminSearchEntry[]).filter((e) => e.kind !== "dial" && e.title !== ADMIN_ACT_WORDS_ES[e.id]?.title).map((e) => e.id);
    expect(english, english.join(", ")).toEqual([]);
    // A dial stays as the server reads it: its Spanish is the Game Mechanics page's, laid on in the browser.
    expect(got.get("dial.comms.quiet_hours")).toEqual(dialEntry({ key: "comms.quiet_hours", label: "Quiet hours", description: "When nothing is sent.", category: "Comms" }));
  });

  it("serves the same entries in either language: the language never changes who sees what", async () => {
    for (const holds of [HOLDS, [], ["comms.manage"]]) {
      const en = (await harness({ admin: true, holds, off: ["events"] }).run()).body.entries.map((e: AdminSearchEntry) => e.id);
      const es = (await harness({ admin: true, holds, off: ["events"], locale: "es" }).run()).body.entries.map((e: AdminSearchEntry) => e.id);
      expect(es).toEqual(en);
    }
    const refused = await harness({ admin: false, holds: HOLDS, locale: "es" }).run();
    expect(refused.status).toBe(401);
    expect(refused.body.entries).toBeUndefined();
    expect(refused.body.pages).toBeUndefined();
  });

  it("with X-Village-Locale: es also serves the tabs' words, for the pages the browser builds from its menu", async () => {
    const out = await harness({ admin: true, holds: HOLDS, locale: "es", off: ["stays"] }).run();
    const pages = new Map<string, AdminPageWords>(out.body.pages.map((p: AdminPageWords) => [p.id, p]));
    expect(pages.get("tab.game-roles")).toEqual({
      id: "tab.game-roles",
      title: ADMIN_ACT_WORDS_ES["tab.game-roles"].title,
      help: ADMIN_ACT_WORDS_ES["tab.game-roles"].help,
      synonyms: expect.arrayContaining(["grupos de poder", "Power groups", "permissions"]),
    });
    // Words only: no address, no key, nothing the menu does not already hold.
    for (const p of out.body.pages) expect(Object.keys(p).sort()).toEqual(["help", "id", "synonyms", "title"]);
    // A tab whose module is off is left out, as the menu leaves it out.
    expect(pages.has("tab.stays-admin")).toBe(false);
    expect(pages.size).toBe(TAB_ACT_ENTRIES.filter((e) => e.module !== "stays").length);
  });

  it("is never stored and is keyed on the reader's language, in either language", async () => {
    for (const locale of [undefined, "es"]) {
      const out = await harness({ admin: true, holds: HOLDS, locale }).run();
      expect(out.headers["cache-control"]).toBe("private, no-store");
      expect(out.headers.vary).toBe("X-Village-Locale");
    }
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
