/**
 * A dial in search, in the reader's language (dialSearchWords.ts).
 *
 *   - a reader of Spanish sees the Game Mechanics page's own Spanish label and description on a dial entry, read
 *     here from the real catalog, and still finds the dial by its English label, its key and its category;
 *   - both searches are covered: Admin search's `dial.<key>` and Find anything's `setting:dial.<key>`;
 *   - a reader of English is handed the served list back untouched, and the words are never fetched for them;
 *   - anything that is not a dial, and a dial the page has no words for, is untouched.
 */
import path from "node:path";
import { setupI18n } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { describe, expect, it, vi } from "vitest";
import { dialEntry, rankAdminSearch, type AdminSearchEntry } from "@shared/adminSearch";
import { rankFind, type FindEntry } from "@shared/findAnything";
import { VARIABLES } from "@shared/gameVariables";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { DIAL_CATEGORY_WORDS, DIAL_WORDS } from "@/pages/gameMechanicsDialWords";
import { DIAL_HELP_MAX, dialKeyOf, dialWordsReader, loadDialWords, localizeDialEntries, readsEnglish, type DialWordsModule } from "./dialSearchWords";

const PAGE: DialWordsModule = { DIAL_WORDS, DIAL_CATEGORY_WORDS };

/** The Spanish catalog as the build reads it: es.po with the fragments folded in. */
async function spanishCatalog(): Promise<Record<string, { translation?: string }>> {
  const dir = path.resolve(__dirname, "../../locales");
  return (await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") })) as Record<string, { translation?: string }>;
}

/** Find anything's form of an Admin search entry (server/routes/search.ts, `findEntryOf`). */
const asFind = (e: AdminSearchEntry): FindEntry => ({ id: `setting:${e.id}`, kind: "setting", title: e.title, help: e.help, path: `/admin?tab=variables&variable=${e.id}`, synonyms: e.synonyms });

/** Every dial's label as "ES <label>" and every category as "CAT <name>": a stand-in language for the whole set. */
const standIn = () => {
  const messages: Record<string, string> = {};
  for (const v of VARIABLES) {
    messages[DIAL_WORDS[v.key].label.id] = `ES ${v.label}`;
    messages[DIAL_WORDS[v.key].description.id] = `ES ${v.description}`;
  }
  for (const [name, d] of Object.entries(DIAL_CATEGORY_WORDS)) messages[d.id] = `CAT ${name}`;
  return setupI18n({ locale: "es", messages: { es: messages } });
};

describe("a reader of Spanish", () => {
  it("sees the Game Mechanics page's Spanish label and description on a dial, and still finds it by its English label", async () => {
    const es = await spanishCatalog();
    const plain = (s: string | undefined): s is string => !!s && !/[{<#]/.test(s);
    // A real dial whose Spanish is plain words (no ICU), so the catalog's text is the drawn text.
    const def = VARIABLES.find((v) => {
      const w = DIAL_WORDS[v.key];
      const label = es[w.label.id]?.translation;
      return plain(label) && plain(es[w.description.id]?.translation) && label !== v.label && plain(es[DIAL_CATEGORY_WORDS[v.category].id]?.translation);
    })!;
    expect(def, "a dial with plain Spanish words").toBeTruthy();
    const w = DIAL_WORDS[def.key];
    const label = es[w.label.id].translation!;
    const description = es[w.description.id].translation!;
    const category = es[DIAL_CATEGORY_WORDS[def.category].id].translation!;
    const i18n = setupI18n({ locale: "es", messages: { es: { [w.label.id]: label, [w.description.id]: description, [DIAL_CATEGORY_WORDS[def.category].id]: category } } });
    const read = dialWordsReader(PAGE, i18n);

    const served = dialEntry(def);
    const [admin] = localizeDialEntries([served], read);
    expect(admin.title).toBe(label);
    expect(admin.help).toBe(description.slice(0, DIAL_HELP_MAX));
    expect(admin.synonyms).toContain(def.label);
    expect(admin.synonyms).toContain(def.key);
    expect(admin.synonyms).toContain(def.category);
    // Its id, its kind and its tab are the served entry's own, so it lands where it landed.
    expect({ ...admin, title: "", help: "", synonyms: [] }).toEqual({ ...served, title: "", help: "", synonyms: [] });

    // Admin search: found by the Spanish label and by the English one, among every dial.
    const others = VARIABLES.filter((v) => v.key !== def.key).map(dialEntry);
    expect(rankAdminSearch(label, [...others, admin], 3).map((e) => e.id)).toContain(served.id);
    expect(rankAdminSearch(def.label, [...others, admin], 8).map((e) => e.id)).toContain(served.id);

    // Find anything: the same dial as `setting:dial.<key>`, by the dialog's own ranking.
    const [found] = localizeDialEntries([asFind(served)], read);
    expect(found.title).toBe(label);
    const list = [...others.map(asFind), found];
    expect(rankFind(label, list, 3).map((r) => r.entry.id)).toContain(found.id);
    expect(rankFind(def.label, list, 8).map((r) => r.entry.id)).toContain(found.id);
    expect(rankFind(def.key, list, 8).map((r) => r.entry.id)).toContain(found.id);
  });

  it("keeps every dial findable by its English label, its key and its category, with the category in Spanish too", () => {
    const read = dialWordsReader(PAGE, standIn());
    const served = VARIABLES.map(dialEntry);
    const spanish = localizeDialEntries(served, read);
    const lost: string[] = [];
    spanish.forEach((e, i) => {
      const v = VARIABLES[i];
      if (e.title !== `ES ${v.label}`) lost.push(`${v.key}: title`);
      if (!e.synonyms.includes(v.label)) lost.push(`${v.key}: English label`);
      if (!e.synonyms.includes(v.key)) lost.push(`${v.key}: key`);
      if (!e.synonyms.includes(v.category)) lost.push(`${v.key}: English category`);
      if (!e.synonyms.includes(`CAT ${v.category}`)) lost.push(`${v.key}: category in the reader's language`);
      if (e.help.length > DIAL_HELP_MAX) lost.push(`${v.key}: line too long`);
      if (new Set(e.synonyms.map((s) => s.toLowerCase())).size !== e.synonyms.length) lost.push(`${v.key}: a synonym twice`);
    });
    expect(lost, lost.join("; ")).toEqual([]);
    // Each one is in the first results for its English label, as it is in English.
    const missed = VARIABLES.filter((v) => !rankFind(v.label, spanish.map(asFind), 8).some((r) => r.entry.id === `setting:dial.${v.key}`)).map((v) => v.key);
    expect(missed, missed.join(", ")).toEqual([]);
  });

  it("leaves a dial the page has no words for, and anything that is not a dial, exactly as served", () => {
    const read = dialWordsReader(PAGE, standIn());
    const ours = dialEntry({ key: "a.village.dial", label: "Our own dial", description: "Only this village has it.", category: "Ours" });
    const control: AdminSearchEntry = { id: "comms.test-email", kind: "control", tab: "comms-settings", title: "Enviarme un correo de prueba", help: "Una prueba.", synonyms: ["Send me a test email"] };
    const odd = dialEntry({ key: "toString", label: "Odd", description: "", category: "constructor" });
    const out = localizeDialEntries([ours, control, odd], read);
    expect(out[0]).toBe(ours);
    expect(out[1]).toBe(control);
    expect(out[2]).toBe(odd);
  });

  it("where the language keeps the English word, the label is still a synonym", () => {
    const def = VARIABLES[0];
    const same = setupI18n({ locale: "es", messages: { es: { [DIAL_WORDS[def.key].label.id]: def.label, [DIAL_WORDS[def.key].description.id]: "Una descripción." } } });
    const [e] = localizeDialEntries([dialEntry(def)], dialWordsReader(PAGE, same));
    expect(e.title).toBe(def.label);
    expect(e.synonyms).toContain(def.label);
  });
});

describe("a reader of English", () => {
  it("gets the served list back, the same array, with no words", () => {
    const served = VARIABLES.slice(0, 5).map(dialEntry);
    expect(localizeDialEntries(served, null)).toBe(served);
  });

  it("never fetches the words: the loader is not called for English, and is for Spanish", async () => {
    const i18n = standIn();
    const loader = vi.fn(async () => PAGE);
    for (const locale of ["en", "en-GB", ""]) expect(await loadDialWords(locale, i18n, loader)).toBeNull();
    expect(loader).not.toHaveBeenCalled();
    const read = await loadDialWords("es", i18n, loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(read!.dial(VARIABLES[0].key)!.label).toBe(`ES ${VARIABLES[0].label}`);
    expect(read!.category("Not a category")).toBeNull();
    expect(readsEnglish("es")).toBe(false);
  });

  it("a load that fails leaves search on the English it was served", async () => {
    const read = await loadDialWords("es", standIn(), async () => {
      throw new Error("offline");
    });
    expect(read).toBeNull();
  });
});

describe("dialKeyOf", () => {
  it("reads the key from either search's id, and nothing from any other entry", () => {
    expect(dialKeyOf("dial.comms.quiet_hours")).toBe("comms.quiet_hours");
    expect(dialKeyOf("setting:dial.comms.quiet_hours")).toBe("comms.quiet_hours");
    for (const id of ["comms.test-email", "setting:comms.test-email", "tab.variables", "page:tab.variables", "setting:gate.players.set-stage", "person:dial.x", "dial."]) {
      expect(dialKeyOf(id), id).toBeNull();
    }
  });
});
