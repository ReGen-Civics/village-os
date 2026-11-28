/**
 * THE REGISTRY OF ACTS IN SPANISH (shared/adminActsWords.ts, shared/adminActs/es/).
 *
 *   - every entry that is not a dial has Spanish, and no Spanish row names an act that does not exist;
 *   - each place's file holds that place's acts and nothing else;
 *   - every row has a title, a line and a word to find it by, inside the lengths a result row can draw;
 *   - the house voice holds in Spanish: no long dashes, no village's name, no guide's name;
 *   - `localizeEntry` hands English and an unknown id back untouched, and keeps the English words findable;
 *   - a reader of Spanish finds an act by Spanish words and still by the English ones, with the ranking the
 *     dialog uses, and the English list is what it was.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_ACTS, ADMIN_ACT_ENTRIES, WRITTEN_ACTS } from "./adminActs";
import { ADMIN_ACT_WORDS_ES, ES_AWAITING_NATIVE_READ, ES_PLACE_WORDS, ES_SHIPPED_WORDS } from "./adminActs/es";
import { ACT_WORD_LOCALES, ADMIN_ACT_WORDS, hasActWords, localizeEntry } from "./adminActsWords";
import { rankAdminSearch, type AdminSearchEntry } from "./adminSearch";
import { ADMIN_PLACES } from "./adminTabs";
import { rankFind, type FindEntry } from "./findAnything";

const NOT_DIALS = ADMIN_ACT_ENTRIES.filter((e) => e.kind !== "dial");
const ROWS = Object.entries(ADMIN_ACT_WORDS_ES);
const textOf = (id: string) => {
  const w = ADMIN_ACT_WORDS_ES[id];
  return `${w.title} ${w.help} ${w.synonyms.join(" ")}`;
};

describe("the Spanish table is whole", () => {
  it("has Spanish for every entry that is not a dial", () => {
    const missing = NOT_DIALS.filter((e) => !Object.prototype.hasOwnProperty.call(ADMIN_ACT_WORDS_ES, e.id)).map((e) => e.id);
    expect(missing, `no Spanish for: ${missing.join(", ")}. Add each to its place's file under shared/adminActs/es/.`).toEqual([]);
  });

  it("names no act that does not exist, and no dial", () => {
    const known = new Set(NOT_DIALS.map((e) => e.id));
    const stray = ROWS.map(([id]) => id).filter((id) => !known.has(id));
    expect(stray, `Spanish for an id the registry does not hold: ${stray.join(", ")}`).toEqual([]);
  });

  it("keeps each place's acts in that place's file, and the rest in shipped.ts", () => {
    const placeOf = new Map(WRITTEN_ACTS.map((a) => [a.id, a.place]));
    const wrong: string[] = [];
    for (const place of ADMIN_PLACES) {
      for (const id of Object.keys(ES_PLACE_WORDS[place] ?? {})) if (placeOf.get(id) !== place) wrong.push(`${id} is in ${place}.ts`);
    }
    for (const id of Object.keys(ES_SHIPPED_WORDS)) if (placeOf.has(id)) wrong.push(`${id} is in shipped.ts and belongs to ${placeOf.get(id)}.ts`);
    expect(wrong, wrong.join("; ")).toEqual([]);
    // No id in two files: the merged table is as long as its parts.
    const parts = [ES_SHIPPED_WORDS, ...ADMIN_PLACES.map((p) => ES_PLACE_WORDS[p] ?? {})];
    expect(parts.reduce((n, t) => n + Object.keys(t).length, 0)).toBe(ROWS.length);
  });

  it("gives every row a title, a line and at least one word to find it by", () => {
    const thin = ROWS.filter(([, w]) => !w.title.trim() || !w.help.trim() || w.synonyms.length < 1 || w.synonyms.some((s) => !s.trim())).map(([id]) => id);
    expect(thin, thin.join(", ")).toEqual([]);
  });

  it("keeps a title to 80 characters and a line to 200", () => {
    const long = ROWS.filter(([, w]) => w.title.length > 80 || w.help.length > 200).map(([id, w]) => `${id} (${w.title.length}, ${w.help.length})`);
    expect(long, long.join(", ")).toEqual([]);
  });

  it("writes the line as one sentence, and repeats no synonym", () => {
    const odd = ROWS.filter(([, w]) => /\n/.test(w.help) || !/[.?!]$/.test(w.help.trim()) || new Set(w.synonyms.map((s) => s.toLowerCase())).size !== w.synonyms.length).map(([id]) => id);
    expect(odd, odd.join(", ")).toEqual([]);
  });

  it("holds the house voice: no long dashes, no village's name, no guide's name", () => {
    for (const [id] of ROWS) {
      expect(textOf(id), id).not.toMatch(/[–—]/);
      expect(textOf(id), id).not.toMatch(/scarlet|maia/i);
      expect(textOf(id), id).not.toMatch(/amora|dominical/i); // brand-ok: proves the Spanish table names no village
    }
  });

  it("says in every file that the Spanish is awaiting a native reader", () => {
    const dir = path.resolve(__dirname, "adminActs/es");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(files.sort()).toEqual([...ADMIN_PLACES.map((p) => `${p}.ts`), "index.ts", "shipped.ts"].sort());
    for (const f of files) {
      const header = fs.readFileSync(path.join(dir, f), "utf8").split("*/")[0];
      expect(header, f).toMatch(/awaiting a native reader/i);
    }
    expect(ES_AWAITING_NATIVE_READ).toBe(true);
  });
});

describe("localizeEntry", () => {
  const act = ADMIN_ACT_ENTRIES.find((e) => e.id === "gate.players.set-stage")!;

  it("hands back the same object for English, for no language, and for a language with no table", () => {
    for (const locale of ["en", "en-GB", null, undefined, "", "fr", "toString", "__proto__"]) expect(localizeEntry(act, locale)).toBe(act);
    expect(hasActWords("en")).toBe(false);
    expect(hasActWords("es")).toBe(true);
    expect(ACT_WORD_LOCALES).toEqual(Object.keys(ADMIN_ACT_WORDS));
  });

  it("hands back the same object for an id the table does not hold", () => {
    const unknown: AdminSearchEntry = { id: "nowhere.thing.verb", kind: "act", title: "A thing", help: "It does a thing.", synonyms: ["thing"] };
    expect(localizeEntry(unknown, "es")).toBe(unknown);
    const dial = ADMIN_ACT_ENTRIES.find((e) => e.kind === "dial")!;
    expect(localizeEntry(dial, "es")).toBe(dial);
    for (const id of ["toString", "constructor", "__proto__"]) {
      const odd = { ...unknown, id };
      expect(localizeEntry(odd, "es")).toBe(odd);
    }
  });

  it("in Spanish gives the table's title and line, then the Spanish synonyms, the English title and the English synonyms", () => {
    const w = ADMIN_ACT_WORDS_ES[act.id];
    const es = localizeEntry(act, "es");
    expect(es).not.toBe(act);
    expect(es.title).toBe(w.title);
    expect(es.help).toBe(w.help);
    expect(es.synonyms.slice(0, w.synonyms.length)).toEqual(w.synonyms);
    expect(es.synonyms).toContain(act.title);
    for (const s of act.synonyms) expect(es.synonyms.map((x) => x.toLowerCase())).toContain(s.toLowerCase());
    // Everything else about the entry is the registry's own.
    const { title: _t, help: _h, synonyms: _s, ...rest } = es;
    const { title: _et, help: _eh, synonyms: _es, ...english } = act;
    expect(rest).toEqual(english);
    // A regional tag reads its language's table.
    expect(localizeEntry(act, "es-CR")).toEqual(es);
  });

  it("passes every other field through untouched for every entry: the address, the key, the module, `modulesAny`", () => {
    const moved: string[] = [];
    for (const e of NOT_DIALS) {
      const { title: _t, help: _h, synonyms: _s, ...spanish } = localizeEntry(e, "es");
      const { title: _et, help: _eh, synonyms: _es, ...english } = e;
      if (JSON.stringify(spanish) !== JSON.stringify(english) || Object.keys(spanish).join() !== Object.keys(english).join()) moved.push(e.id);
    }
    expect(moved, moved.join(", ")).toEqual([]);
    // The field the gate reads for a tab that answers for several modules is the registry's own list, not a copy.
    const several = NOT_DIALS.filter((e) => e.modulesAny);
    expect(several.length).toBeGreaterThan(0);
    for (const e of several) expect(localizeEntry(e, "es").modulesAny).toBe(e.modulesAny);
    const made: AdminSearchEntry = { id: "tab.reports", kind: "page", tab: "reports", title: "Reports", help: "x", synonyms: [], modulesAny: ["forum", "messaging"], module: "m", capability: "comms.manage", path: "/p" };
    expect(localizeEntry(made, "es")).toMatchObject({ kind: "page", tab: "reports", modulesAny: ["forum", "messaging"], module: "m", capability: "comms.manage", path: "/p" });
  });

  it("keeps every entry's English title among its synonyms", () => {
    const lost = NOT_DIALS.filter((e) => !localizeEntry(e, "es").synonyms.some((s) => s.toLowerCase() === e.title.toLowerCase())).map((e) => e.id);
    expect(lost, lost.join(", ")).toEqual([]);
  });

  it("leaves the English list exactly as it was", () => {
    const before = JSON.stringify(ADMIN_ACT_ENTRIES);
    const spanish = ADMIN_ACT_ENTRIES.map((e) => localizeEntry(e, "es"));
    const english = ADMIN_ACT_ENTRIES.map((e) => localizeEntry(e, "en"));
    expect(spanish.length).toBe(ADMIN_ACT_ENTRIES.length);
    english.forEach((e, i) => expect(e).toBe(ADMIN_ACT_ENTRIES[i]));
    expect(JSON.stringify(english)).toBe(before);
    expect(JSON.stringify(ADMIN_ACT_ENTRIES)).toBe(before);
    // An act is data in either language.
    expect(JSON.parse(JSON.stringify(spanish))).toEqual(spanish);
    expect(ADMIN_ACTS.length).toBe(ADMIN_ACT_ENTRIES.length);
  });
});

// ── Found in Spanish, with the ranking the dialog uses ─────────────────────

/** An entry as Find anything draws it (server/routes/search.ts, `findEntryOf`): a tab or a page beside Admin is a page. */
const asFind = (e: AdminSearchEntry): FindEntry => {
  const kind = e.kind === "page" || e.kind === "outside" ? "page" : "setting";
  return { id: `${kind}:${e.id}`, kind, title: e.title, help: e.help, path: `/${e.id}`, synonyms: e.synonyms };
};

describe("a reader of Spanish finds it", () => {
  const spanishEntries = ADMIN_ACT_ENTRIES.map((e) => localizeEntry(e, "es"));
  const spanish = spanishEntries.map(asFind);
  const english = ADMIN_ACT_ENTRIES.map(asFind);
  const top = (q: string, list: readonly FindEntry[], n = 6) => rankFind(q, list, n).map((r) => r.entry.id);

  /** [what a founder types in Spanish, what they typed in English, the entry both must find] across the places. */
  const CASES: ReadonlyArray<[string, string, string]> = [
    ["enviar correo de prueba", "send me a test", "setting:comms.test-email"],
    ["hacer administrador", "make admin", "setting:gate.players.set-access"],
    ["cerrar el ciclo", "close the cycle", "setting:store.cycles.close"],
    ["segunda firma", "second signature", "setting:hall.keys.cosign"],
    ["zona horaria", "timezone", "setting:season.timezone"],
    ["grupos de poder", "power groups", "page:tab.game-roles"],
    ["agregar un evento", "add an event", "setting:tower.calendar.add-event"],
    ["preguntarle a la guía", "ask the guide", "setting:guide.dock.ask"],
    ["cerrar sesión", "sign out", "setting:frame.account.sign-out"],
    ["clave de stripe", "stripe secret key", "setting:key.stripe_secret_key"],
    ["plan de lanzamiento", "launch plan", "page:page.launch"],
    ["cambiar la etapa", "set stage", "setting:gate.players.set-stage"],
  ];

  it.each(CASES)("%s / %s", (es, en, id) => {
    expect(top(es, spanish), `Spanish words, Spanish list: ${es}`).toContain(id);
    expect(top(en, spanish), `English words, Spanish list: ${en}`).toContain(id);
    expect(top(en, english), `English words, English list: ${en}`).toContain(id);
  });

  it("finds it with the accents left off, as people type", () => {
    expect(top("configuracion del correo", spanish)).toContain("page:tab.comms-settings");
    expect(top("mecanicas del juego", spanish)[0]).toBe("page:tab.variables");
  });

  it("every entry is in the first results for its own Spanish title", () => {
    const missed = NOT_DIALS.filter((e) => {
      const want = asFind(e).id;
      return !rankFind(ADMIN_ACT_WORDS_ES[e.id]?.title ?? "", spanish, 8).some((r) => r.entry.id === want);
    }).map((e) => `${e.id} (${ADMIN_ACT_WORDS_ES[e.id]?.title})`);
    expect(missed, missed.join("; ")).toEqual([]);
  });

  it("every tab's Spanish name opens a page of that name first", () => {
    for (const e of NOT_DIALS.filter((x) => x.kind === "page")) {
      const title = ADMIN_ACT_WORDS_ES[e.id].title;
      const first = rankFind(title, spanish, 3)[0].entry;
      expect(`${first.title}|${first.kind}`, e.id).toBe(`${title}|page`);
    }
  });

  it("Admin's own search finds it too, accents typed or left off", () => {
    const ids = (q: string) => rankAdminSearch(q, spanishEntries, 8).map((e) => e.id);
    expect(ids("enviar correo de prueba")).toContain("comms.test-email");
    expect(ids("configuración del correo")).toContain("tab.comms-settings");
    expect(ids("configuracion del correo")).toContain("tab.comms-settings");
    expect(ids("cerrar sesion")).toContain("frame.account.sign-out");
    expect(ids("send me a test")[0]).toBe("comms.test-email");
  });
});
