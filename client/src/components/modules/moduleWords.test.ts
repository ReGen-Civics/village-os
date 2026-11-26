/**
 * The module library speaks the reader's language (moduleWords.ts). The ids and the English come from the shared
 * definitions the server sends, so a module added there, or a sentence changed there, fails here until the client
 * has the same words.
 */
import path from "node:path";
import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { describe, expect, it } from "vitest";
import { MODULES } from "@shared/modules";
import { MODULE_CATALOG, MODULE_GROUPS } from "@shared/moduleCatalog";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { MODULE_SHELF_WORDS, MODULE_WORDS, localizeCatalog } from "./moduleWords";
import type { CatalogPayload } from "./catalog";
import type { CatalogModule } from "./ModuleCard";

// The build precompiles each message (precompileEnglish.ts), so the English is read the way a page reads it.
const EN = setupI18n({ locale: "en", messages: { en: {} } });
const english = (d: MessageDescriptor | undefined) => (d ? EN._(d) : undefined);

/** Every descriptor in the file, with the server's English it must match. */
function pairs(): { where: string; d: MessageDescriptor | undefined; server: string }[] {
  const out: { where: string; d: MessageDescriptor | undefined; server: string }[] = [];
  for (const g of MODULE_GROUPS) {
    const w = MODULE_SHELF_WORDS[g.id];
    out.push({ where: `shelf ${g.id} label`, d: w?.label, server: g.label }, { where: `shelf ${g.id} gloss`, d: w?.gloss, server: g.gloss });
  }
  for (const m of MODULES) {
    const w = MODULE_WORDS[m.id];
    out.push({ where: `${m.id} name`, d: w?.name, server: m.name }, { where: `${m.id} description`, d: w?.description, server: m.description });
    const c = MODULE_CATALOG[m.id];
    if (!c) continue;
    out.push(
      { where: `${m.id} promise`, d: w?.promise, server: c.promise },
      { where: `${m.id} for whom`, d: w?.forWhom, server: c.forWhom },
      { where: `${m.id} setup`, d: w?.setupSummary, server: c.setupSummary },
      { where: `${m.id} data`, d: w?.dataSummary, server: c.dataSummary },
      ...c.benefits.map((b, i) => ({ where: `${m.id} benefit ${i + 1}`, d: w?.benefits[i], server: b })),
    );
  }
  return out;
}

describe("every module the server sends has the client's words for it", () => {
  it("each module, shelf and sentence in shared/ has an entry whose English is the server's, word for word", () => {
    const wrong = pairs()
      .filter((p) => english(p.d) !== p.server)
      .map((p) => `${p.where}: ${p.d ? "English differs from shared/" : "missing"}`);
    expect(wrong, "regenerate client/src/components/modules/moduleWords.ts from shared/modules.ts and shared/moduleCatalog.ts").toEqual([]);
  });

  it("holds no module or shelf the server no longer sends, and no extra benefit", () => {
    const ids = new Set(MODULES.map((m) => m.id));
    expect(Object.keys(MODULE_WORDS).filter((id) => !ids.has(id))).toEqual([]);
    const shelves = new Set<string>(MODULE_GROUPS.map((g) => g.id));
    expect(Object.keys(MODULE_SHELF_WORDS).filter((id) => !shelves.has(id))).toEqual([]);
    for (const m of MODULES) expect(MODULE_WORDS[m.id].benefits.length, m.id).toBe(MODULE_CATALOG[m.id]?.benefits.length ?? 0);
  });

  it("Spanish carries every one of them", async () => {
    const dir = path.resolve(__dirname, "../../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    const missing = pairs().filter((p) => !es[p.d!.id]?.translation).map((p) => p.where);
    expect(missing, "add them to a fragment in client/src/locales/es.d/").toEqual([]);
  });
});

const row = (over: Partial<CatalogModule>): CatalogModule => ({ ...(over as CatalogModule) });

describe("localizeCatalog", () => {
  const quests = MODULE_WORDS.quests;
  const payload: CatalogPayload = {
    groups: [{ id: "coordinate", label: "Coordinate", gloss: "x" }, { id: "a-village-shelf", label: "Our own", gloss: "ours" }],
    builder: { guideUrl: "", poolUrl: "" },
    modules: [
      row({ id: "quests", name: "Quests", description: "d", card: { ...MODULE_CATALOG.quests } }),
      row({ id: "not-a-platform-module", name: "Ours", description: "Our own words", card: null }),
    ],
  };

  it("in English reads exactly as the server sent it", () => {
    const en = setupI18n({ locale: "en", messages: { en: {} } });
    const out = localizeCatalog(payload, en);
    expect(out.modules[0].name).toBe("Quests");
    expect(out.modules[0].card?.benefits).toEqual(MODULE_CATALOG.quests.benefits);
    expect(out.modules[1]).toBe(payload.modules[1]);
    expect(out.groups[1]).toBe(payload.groups[1]);
  });

  it("draws a translated name, card and shelf, and leaves an id it does not know as written", () => {
    const es = setupI18n({
      locale: "es",
      messages: {
        es: {
          [quests.name.id]: "Misiones",
          [quests.benefits[0].id]: "Publique trabajo",
          [MODULE_SHELF_WORDS.coordinate.label.id]: "Coordinar",
        },
      },
    });
    const out = localizeCatalog(payload, es);
    expect(out.modules[0].name).toBe("Misiones");
    expect(out.modules[0].card?.benefits[0]).toBe("Publique trabajo");
    expect(out.modules[0].card?.hue).toBe(MODULE_CATALOG.quests.hue);
    expect(out.groups[0].label).toBe("Coordinar");
    expect(out.modules[1].name).toBe("Ours");
  });
});
