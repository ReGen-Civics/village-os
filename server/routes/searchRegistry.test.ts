/**
 * FIND ANYTHING reads the registry of acts (shared/adminActs.ts) for an admin, and for nobody else.
 *
 *   - an admin's index holds every Admin tab, act and dial, each landing where admin search lands it;
 *   - a member's and a visitor's index holds none of it;
 *   - the one capability gate and the module switches still decide what an admin is offered;
 *   - acts that live on one page are all kept, though they share its address;
 *   - the guide's list is what it was before the registry: no tab, act or dial is sent to the provider;
 *   - every tab and every dial is found by its own name;
 *   - an admin who reads in Spanish gets the registry in Spanish, and everybody else gets exactly the English.
 *
 * Invented people and places only.
 */
import { describe, expect, it } from "vitest";
import { buildFindIndex, findEntryOf, register, type SearchDeps } from "./search";
import { ADMIN_ACT_ENTRIES, WRITTEN_ACTS, adminAct, actSearchEntry } from "../../shared/adminActs";
import { ADMIN_ACT_WORDS_ES } from "../../shared/adminActs/es";
import { TAB_ACTS } from "../../shared/adminActs/derived";
import { CONTROL_ENTRIES, OUTSIDE_ENTRIES, adminSearchHref } from "../../shared/adminSearch";
import { ADMIN_TABS } from "../../shared/adminTabs";
import { rankFind, type FindEntry, type FindIndex } from "../../shared/findAnything";
import { VARIABLES } from "../../shared/gameVariables";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

const MODULES: Record<string, string> = { map: "public", forum: "public", events: "members", stays: "off" };

function setup(viewer: any | null, opts: { admin?: boolean; holds?: string[] | "all" } = {}) {
  const handlers = new Map<string, Handler>();
  const app = { get: (p: string, h: Handler) => handlers.set(`GET ${p}`, h), post: (p: string, h: Handler) => handlers.set(`POST ${p}`, h) } as any;
  const deps = {
    entrancePasses: async () => true,
    authedUser: async () => viewer,
    isAdmin: async () => !!opts.admin,
    mayStillSee: async (_req: any, cap: string) => opts.holds === "all" || (opts.holds ?? []).includes(cap),
    clientIp: () => "203.0.113.9",
    overLimit: async () => false,
    lifecycle: (id: string) => MODULES[id] ?? "off",
    storyServed: () => false,
    villageName: () => "North Wind",
    commitmentName: () => "",
    villageGuideName: () => "Sol",
    noteAssistantUsage: async () => undefined,
    sources: { roles: async () => [], circles: async () => [], quests: async () => [], people: async () => [{ handle: "ana-example", name: "Ana Example" }] },
  } as unknown as SearchDeps;
  register(app, deps);
  /** One read of the index, in the language the read names (none: the browser sends no header for English). */
  const read = async (locale?: string): Promise<{ body: FindIndex; headers: Record<string, string> }> => {
    let body: any;
    const headers: Record<string, string> = {};
    const res: any = { set(k: string, v: string) { headers[k.toLowerCase()] = v; return res; }, status() { return res; }, json(b: any) { body = b; return res; } };
    await handlers.get("GET /api/search/index")!({ headers: locale ? { "x-village-locale": locale } : {} }, res);
    return { body, headers };
  };
  const index = async (locale?: string): Promise<FindIndex> => (await read(locale)).body;
  return { index, read, deps };
}

const admin = { id: "u-admin", role: "admin", name: "Ada Example" };
const member = { id: "u-member", role: "member", membershipGranted: true, name: "Mo Example" };
const ids = (body: FindIndex) => new Set(body.entries.map((e) => e.id));
const registryId = (id: string) => /^(page:tab\.|setting:)/.test(id);

describe("the registry in Find anything", () => {
  it("gives an admin every tab, act and dial, and says the reader is an admin", async () => {
    const body = await setup(admin, { admin: true, holds: "all" }).index();
    const got = ids(body);
    expect(body.admin).toBe(true);
    for (const t of TAB_ACTS) {
      // A tab whose module is off in this village is left out, exactly as the menu leaves it out.
      const off = actSearchEntry(t).module && (MODULES[actSearchEntry(t).module!] ?? "off") === "off";
      expect(got.has(`page:${t.id}`), t.id).toBe(!off);
    }
    expect(got.has("setting:gate.players.set-stage")).toBe(true);
    expect(got.has("setting:hall.forms.set-status")).toBe(true);
    expect(got.has(`setting:dial.${VARIABLES[0].key}`)).toBe(true);
    expect(got.has("setting:comms.test-email")).toBe(true);
    expect(body.entries.filter((e) => e.id.startsWith("setting:dial.")).length).toBe(VARIABLES.length);
  });

  it("gives a member and a visitor none of it", async () => {
    for (const viewer of [member, null]) {
      const body = await setup(viewer).index();
      expect(body.admin).toBe(false);
      expect(body.entries.filter((e) => registryId(e.id)).map((e) => e.id)).toEqual([]);
      expect(body.entries.some((e) => e.path.startsWith("/admin"))).toBe(false);
    }
  });

  it("asks the one gate: an act whose key this admin does not hold is not offered, and one that asks only for an admin is", async () => {
    const got = ids(await setup(admin, { admin: true, holds: [] }).index());
    expect(got.has("setting:hall.forms.set-status")).toBe(false);
    expect(got.has("setting:comms.test-email")).toBe(false);
    expect(got.has("setting:gate.players.set-stage")).toBe(true);
    expect(got.has("page:tab.players")).toBe(true);
    const holding = ids(await setup(admin, { admin: true, holds: ["intake.moderate"] }).index());
    expect(holding.has("setting:hall.forms.set-status")).toBe(true);
  });

  it("leaves out a tab and its acts while their module is off", async () => {
    const got = ids(await setup(admin, { admin: true, holds: "all" }).index());
    expect(got.has("page:tab.stays-admin")).toBe(false);
    expect(got.has("setting:greenhouse.stays.add-place")).toBe(false);
    expect(got.has("page:tab.events-admin")).toBe(true);
    expect(got.has("setting:tower.calendar.add-event")).toBe(true);
  });

  it("keeps every act on a page, though they share the page's address", async () => {
    const body = await setup(admin, { admin: true, holds: "all" }).index();
    const onPlayers = body.entries.filter((e) => e.path === "/admin?tab=players");
    expect(onPlayers.map((e) => e.id)).toEqual(expect.arrayContaining(["page:tab.players", "setting:gate.players.set-stage", "setting:gate.players.end-sessions"]));
    expect(new Set(body.entries.map((e) => e.id)).size).toBe(body.entries.length);
  });

  it("sends the guide the list it had before: an admin's pages and shipped controls, and no tab, act or dial", async () => {
    const { deps } = setup(admin, { admin: true, holds: "all" });
    const forGuide = await buildFindIndex(deps, { headers: {} } as any, admin, { signedIn: true, member: true, admin: true }, false, { registry: false });
    const got = new Set(forGuide.map((e) => e.id));
    expect(got.has("setting:comms.test-email")).toBe(true);
    expect(got.has("page:tab.players")).toBe(false);
    expect(got.has("setting:gate.players.set-stage")).toBe(false);
    expect(forGuide.some((e) => e.id.startsWith("setting:dial."))).toBe(false);
    expect(forGuide.some((e) => e.kind === "person")).toBe(false);
    const shipped = new Set([...CONTROL_ENTRIES, ...OUTSIDE_ENTRIES].map((e) => e.id));
    for (const e of forGuide.filter((x) => x.kind === "setting")) expect(shipped.has(e.id.replace(/^setting:/, "")), e.id).toBe(true);
  });
});

describe("found by its own name", () => {
  const found: FindEntry[] = ADMIN_ACT_ENTRIES.map(findEntryOf);

  it("draws a tab or a page beside Admin as a page, everything else as a setting, at admin search's own address", () => {
    expect(findEntryOf(actSearchEntry(adminAct("tab.players")!))).toMatchObject({ id: "page:tab.players", kind: "page", path: "/admin?tab=players" });
    expect(findEntryOf(actSearchEntry(adminAct("page.mint")!))).toMatchObject({ id: "page:page.mint", kind: "page", path: "/admin/mint" });
    expect(findEntryOf(actSearchEntry(adminAct("store.economy.rule")!))).toMatchObject({ kind: "setting", path: "/admin/mint" });
    expect(findEntryOf(actSearchEntry(adminAct("tower.mail.key-rights")!)).path).toBe("/admin?tab=comms-settings");
    for (const e of ADMIN_ACT_ENTRIES.slice(0, 200)) expect(findEntryOf(e).path).toBe(adminSearchHref(e));
  });

  it("every admin tab: a page of that name leads, and the tab is in the first three", () => {
    for (const t of ADMIN_TABS) {
      const want = `page:tab.${t.sameAs ?? t.key}`;
      const title = adminAct(`tab.${t.sameAs ?? t.key}`)!.title;
      const top = rankFind(title, found, 20);
      expect(`${top[0].entry.title}|${top[0].entry.kind}`, title).toBe(`${title}|page`);
      expect(top.slice(0, 3).map((r) => r.entry.id), title).toContain(want);
    }
  });

  it("a page's own name beats a dial that starts with the word and sits in a category of that name", () => {
    expect(rankFind("Library", found, 5)[0].entry.id).toBe("page:tab.library-admin");
    expect(rankFind("Introductions", found, 5)[0].entry.id).toBe("page:tab.intents-admin");
  });

  it("every dial is in the first results for its own name", () => {
    const missed = VARIABLES.filter((v) => !rankFind(v.label, found, 8).some((r) => r.entry.id === `setting:dial.${v.key}`)).map((v) => v.key);
    expect(missed, missed.join(", ")).toEqual([]);
  });

  it("every written act is in the first results for its own title", () => {
    const missed = WRITTEN_ACTS.filter((a) => !rankFind(a.title, found, 8).some((r) => r.entry.id === `setting:${a.id}`)).map((a) => a.id);
    expect(missed, missed.join(", ")).toEqual([]);
  });

  it("finds the words a founder would type", () => {
    const top = (q: string) => rankFind(q, found, 6).map((r) => r.entry.id);
    expect(top("make admin")).toContain("setting:gate.players.set-access");
    expect(top("close the cycle")).toContain("setting:store.cycles.close");
    expect(top("send me a test")[0]).toBe("setting:comms.test-email");
    expect(top("second signature")).toContain("setting:hall.keys.cosign");
  });
});

describe("the registry in the reader's language", () => {
  const entry = (body: FindIndex, id: string) => body.entries.find((e) => e.id === id)!;

  it("gives an admin who reads in Spanish the registry in Spanish, at the same addresses, with the English words kept", async () => {
    const { index } = setup(admin, { admin: true, holds: "all" });
    const en = await index();
    const es = await index("es");
    // The same entries at the same addresses, in the same order: the language changes words and nothing else.
    expect(es.entries.map((e) => `${e.id}|${e.kind}|${e.path}`)).toEqual(en.entries.map((e) => `${e.id}|${e.kind}|${e.path}`));
    const stage = entry(es, "setting:gate.players.set-stage");
    expect(stage.title).toBe(ADMIN_ACT_WORDS_ES["gate.players.set-stage"].title);
    expect(stage.help).toBe(ADMIN_ACT_WORDS_ES["gate.players.set-stage"].help);
    expect(stage.synonyms).toContain("Set a player's stage");
    expect(entry(es, "page:tab.game-roles").title).toBe(ADMIN_ACT_WORDS_ES["tab.game-roles"].title);
    expect(entry(es, "page:page.mint").title).toBe(ADMIN_ACT_WORDS_ES["page.mint"].title);
    expect(entry(es, "setting:comms.test-email").title).toBe(ADMIN_ACT_WORDS_ES["comms.test-email"].title);
    // Every registry entry that is not a dial is in Spanish.
    const english = es.entries
      .filter((e) => registryId(e.id) && !e.id.startsWith("setting:dial.") && e.title !== ADMIN_ACT_WORDS_ES[e.id.replace(/^(page|setting):/, "")]?.title)
      .map((e) => e.id);
    expect(english, english.join(", ")).toEqual([]);
    // A dial stays English here: its Spanish is the Game Mechanics page's, laid on in the browser.
    const dial = `setting:dial.${VARIABLES[0].key}`;
    expect(entry(es, dial)).toEqual(entry(en, dial));
    // The site's own pages, which are not the registry's, keep their own name and line.
    const site = (b: FindIndex) => b.entries.filter((e) => !registryId(e.id) && !e.id.startsWith("page:page.")).map(({ synonyms: _s, ...rest }) => rest);
    expect(site(es)).toEqual(site(en));
  });

  it("is found by Spanish words and still by English ones, with the dialog's own ranking", async () => {
    const es = await setup(admin, { admin: true, holds: "all" }).index("es");
    const top = (q: string) => rankFind(q, es.entries, 6).map((r) => r.entry.id);
    expect(top("hacer administrador")).toContain("setting:gate.players.set-access");
    expect(top("make admin")).toContain("setting:gate.players.set-access");
    expect(top("cerrar el ciclo")).toContain("setting:store.cycles.close");
    expect(top("close the cycle")).toContain("setting:store.cycles.close");
    expect(top("grupos de poder")[0]).toBe("page:tab.game-roles");
    expect(top("Power groups")).toContain("page:tab.game-roles");
    expect(top("enviar correo de prueba")[0]).toBe("setting:comms.test-email");
  });

  it("a page the site already lists at the same address keeps its name, and is still found by the Spanish words", async () => {
    const { index } = setup(admin, { admin: true, holds: "all" });
    const en = await index();
    const es = await index("es");
    const at = (b: FindIndex, path: string) => b.entries.filter((e) => e.path === path && e.kind === "page");
    // The launch plan is the site's own page for a member, so the registry's page for it is not listed twice.
    expect(at(en, "/journey-to-launch")).toHaveLength(1);
    expect(at(es, "/journey-to-launch")).toHaveLength(1);
    const kept = at(es, "/journey-to-launch")[0];
    expect(kept.id).toBe(at(en, "/journey-to-launch")[0].id);
    expect(kept.title).toBe(at(en, "/journey-to-launch")[0].title);
    expect(kept.synonyms).toEqual(expect.arrayContaining([...(at(en, "/journey-to-launch")[0].synonyms ?? []), ADMIN_ACT_WORDS_ES["page.launch"].title]));
    expect(rankFind("plan de lanzamiento", es.entries, 6).map((r) => r.entry.path)).toContain("/journey-to-launch");
    expect(rankFind("launch plan", es.entries, 6).map((r) => r.entry.path)).toContain("/journey-to-launch");
  });

  it("answers exactly the English with no language, with English, and with a language the village does not translate into", async () => {
    const { index } = setup(admin, { admin: true, holds: "all" });
    const english = JSON.stringify(await index());
    for (const locale of ["en", "fr", "zz", "es-CR"]) expect(JSON.stringify(await index(locale)), locale).toBe(english);
    // And the English registry entries are the registry's own words, as before this change.
    const body = await index();
    for (const e of ADMIN_ACT_ENTRIES.filter((x) => x.id === "gate.players.set-stage" || x.id === "tab.players")) {
      expect(body.entries.find((f) => f.id === findEntryOf(e).id)).toEqual(findEntryOf(e));
    }
  });

  it("gives a member and a visitor the same answer in either language: the registry is an admin's", async () => {
    for (const viewer of [member, null]) {
      const { index } = setup(viewer);
      expect(JSON.stringify(await index("es"))).toBe(JSON.stringify(await index()));
    }
  });

  it("asks the gate the same in Spanish: an act whose key this admin does not hold is not offered", async () => {
    const got = ids(await setup(admin, { admin: true, holds: [] }).index("es"));
    expect(got.has("setting:hall.forms.set-status")).toBe(false);
    expect(got.has("setting:comms.test-email")).toBe(false);
    expect(got.has("setting:gate.players.set-stage")).toBe(true);
  });

  it("is never stored and is keyed on the reader's language", async () => {
    const { read } = setup(admin, { admin: true, holds: "all" });
    for (const locale of [undefined, "es"]) {
      const { headers } = await read(locale);
      expect(headers["cache-control"]).toBe("private, no-store");
      expect(headers.vary).toBe("X-Village-Locale");
    }
  });

  it("keeps the guide's list English whatever language the read names", async () => {
    const { deps } = setup(admin, { admin: true, holds: "all" });
    const reader = { signedIn: true, member: true, admin: true };
    const plain = await buildFindIndex(deps, { headers: {} } as any, admin, reader, false, { registry: false });
    const spanish = await buildFindIndex(deps, { headers: { "x-village-locale": "es" } } as any, admin, reader, false, { registry: false });
    expect(spanish).toEqual(plain);
    expect(spanish.find((e) => e.id === "setting:comms.test-email")!.title).toBe("Send me a test email");
  });
});
