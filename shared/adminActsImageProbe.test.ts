/**
 * THE IMAGE BUILD'S PROBE READS PROSE AS IMPORTS, AND THE REGISTRY IS PROSE.
 *
 * The Dockerfile ends with a probe that reads the built server (`dist/index.js`) for
 * every module it imports at run time and fails the image when one does not resolve.
 * It finds imports with three patterns, and a pattern cannot tell code from a string:
 * the search words `"profile import", "profile file"` read to it as `import ", "`,
 * a module named `, ` that no image holds. That shipped red on #1895 (28 Nov 2026).
 *
 * WHY NO OTHER CHECK SAW IT. The image is built by `selfhost-smoke`, which runs only
 * when a pull request touches the compose path. A pull request that adds words to the
 * registry never does, so the probe first read these words when a merge brought a
 * compose file with it. This test reads them on every run.
 *
 * THE PATTERNS ARE THE PROBE'S OWN, read out of the Dockerfile, so this test cannot
 * drift from the check that decides. If the probe's line changes shape, the reader
 * below fails by name and says so.
 *
 * WHAT IT SCANS. Every act, printed the three ways a bundler may print a table of
 * strings: one array on a line with spaces, compact, and one string to a line.
 *
 * THE RULE FOR A WORD LIST: no entry may END in the word import or export after a
 * space, because the closing quote and the next entry's opening quote then read as a
 * module name. Put the word first ("import a profile") or use it alone ("import").
 *
 * THE WORDS IN ANOTHER LANGUAGE ARE PROSE TOO (shared/adminActsWords.ts). The same scan
 * reads every words table under shared/adminActs/<language>/, printed as its files
 * write it and the three ways above, and every entry as `localizeEntry` returns it.
 * That last one is an adjacency the English scan cannot see: the language's synonyms,
 * then the English title, then the English synonyms, in one list. An English title
 * ending in "import" would sit right before the English synonyms there.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_ACTS, ADMIN_ACT_ENTRIES } from "./adminActs";
import { ES_PLACE_WORDS, ES_SHIPPED_WORDS } from "./adminActs/es";
import { ACT_WORD_LOCALES, ADMIN_ACT_WORDS, localizeEntry } from "./adminActsWords";
import type { ActWords } from "./adminActs/types";

const DOCKERFILE = path.resolve(__dirname, "..", "Dockerfile");

/** The probe's three patterns, exactly as the image build runs them. */
function probePatterns(): RegExp[] {
  const line = fs
    .readFileSync(DOCKERFILE, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("RUN node -e") && l.includes("runtime imports"));
  if (!line) throw new Error("The Dockerfile's runtime-import probe was not found. Update this reader to its new shape.");
  const list = /for\(const re of \[(.+?)\]\)\{let m;/.exec(line);
  if (!list) throw new Error("The probe's list of patterns was not found on its line. Update this reader to its new shape.");
  // The Dockerfile is this repository's own file, and these are regular expression literals.
  const patterns = new Function(`return [${list[1]}];`)() as unknown[];
  if (patterns.length < 3 || !patterns.every((p) => p instanceof RegExp)) throw new Error("The probe's patterns did not read as regular expressions.");
  return patterns as RegExp[];
}

/** Every capture the probe would make in a text, with a little of what surrounds it. */
function captures(text: string, patterns: readonly RegExp[]): string[] {
  const found: string[] = [];
  for (const source of patterns) {
    const re = new RegExp(source.source, source.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      found.push(`${JSON.stringify(m[1])} in ...${text.slice(Math.max(0, m.index - 60), m.index + Math.min(m[0].length, 80)).replace(/\s+/g, " ")}...`);
    }
  }
  return found;
}

/** A table of strings the way a bundler prints it on one line: `key: "value", list: ["a", "b"]`. */
function printed(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(printed).join(", ")}]`;
  if (value && typeof value === "object") {
    return `{ ${Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${printed(v)}`).join(", ")} }`;
  }
  return JSON.stringify(value);
}

describe("the registry's words never read as an import to the image build's probe", () => {
  const patterns = probePatterns();

  it("reads the probe's own three patterns out of the Dockerfile", () => {
    expect(patterns).toHaveLength(3);
    // The patterns still do their job: a real import is seen by each of the three.
    expect(captures('import x from "express";', patterns)).toHaveLength(1);
    expect(captures(';import "dotenv/config"', patterns)).toHaveLength(1);
    expect(captures('await import("sharp")', patterns)).toHaveLength(1);
  });

  it("sees the shape that shipped red, so this test would have caught it", () => {
    const shipped = { synonyms: ["import", "profile import", "profile file"] };
    expect(captures(printed(shipped), patterns).length).toBeGreaterThan(0);
    expect(captures(JSON.stringify(shipped), patterns).length).toBeGreaterThan(0);
    expect(captures(JSON.stringify(shipped, null, 2), patterns).length).toBeGreaterThan(0);
  });

  it("finds nothing in any act, however the table is printed", () => {
    const found = [
      ...ADMIN_ACTS.flatMap((a) => captures(printed(a), patterns).map((c) => `${a.id}: ${c}`)),
      ...captures(JSON.stringify(ADMIN_ACTS), patterns),
      ...captures(JSON.stringify(ADMIN_ACTS, null, 2), patterns),
    ];
    expect(found, `These words read as an import to the image build's probe. Reword them (see this file's header):\n${found.join("\n")}`).toEqual([]);
  });
});

/** A words table the way its file writes it and the bundler keeps it: `"id": words("Title", "Line.", ["a", "b"]),` a row to a line. */
function printedAsWritten(table: Readonly<Record<string, ActWords>>): string {
  return Object.entries(table)
    .map(([id, w]) => `  ${printed(id)}: words(${printed(w.title)}, ${printed(w.help)}, ${printed(w.synonyms)}),`)
    .join("\n");
}

/** One table, every way it may be printed. */
const everyPrinting = (value: unknown): string[] => [printed(value), JSON.stringify(value), JSON.stringify(value, null, 2)];

describe("the registry's words in another language never read as an import either", () => {
  const patterns = probePatterns();

  it("sees the adjacency only a served entry has: an English title or synonym right after the language's own words", () => {
    // The language's synonyms, then the English title, then the English synonyms (`localizeEntry`).
    const title = { title: "Importar un perfil", synonyms: ["importar perfil", "Profile import", "profile file"] };
    expect(captures(printed(title), patterns).length).toBeGreaterThan(0);
    // A sentence that holds " export" or " import" after a space, and a later English synonym ending in "from":
    // everything between the two reads as one import statement. The patterns have no word boundary, so the
    // Spanish "exportar" and "importar" in the middle of a sentence start it exactly as the English words do.
    const sentence = { title: "Descargar la lista", help: "Una hoja para exportar los contactos.", synonyms: ["lista de contactos", "Sender name", "reply from", "from name"] };
    expect(captures(printed(sentence), patterns).length).toBeGreaterThan(0);
    expect(captures(JSON.stringify(sentence), patterns).length).toBeGreaterThan(0);
    // The same words as Spanish writes them are safe: the word leads, or stands alone, and nothing ends in "from".
    const safe = { title: "Importar un perfil", help: "Traiga un archivo para importar el perfil.", synonyms: ["importar", "importar perfil", "exportar visitantes", "import", "export"] };
    for (const text of everyPrinting(safe)) expect(captures(text, patterns)).toEqual([]);
    expect(captures(printedAsWritten({ "x.y.z": safe as ActWords }), patterns)).toEqual([]);
  });

  it("finds nothing in any words table, as its files write it and however it is printed", () => {
    expect(ACT_WORD_LOCALES).toContain("es");
    const found: string[] = [];
    // Each file is one statement in the built server, so each file's table is read whole, as written.
    for (const [file, table] of Object.entries({ shipped: ES_SHIPPED_WORDS, ...ES_PLACE_WORDS })) {
      for (const c of captures(printedAsWritten(table), patterns)) found.push(`es/${file}.ts: ${c}`);
      for (const text of everyPrinting(table)) for (const c of captures(text, patterns)) found.push(`es/${file}.ts: ${c}`);
    }
    for (const [locale, table] of Object.entries(ADMIN_ACT_WORDS)) {
      // Every row alone, and the merged table whole.
      for (const [id, w] of Object.entries(table)) for (const c of captures(printed(w), patterns)) found.push(`${locale} ${id}: ${c}`);
      for (const text of [printedAsWritten(table), ...everyPrinting(table)]) for (const c of captures(text, patterns)) found.push(`${locale}, the whole table: ${c}`);
    }
    expect(found, `These words read as an import to the image build's probe. Reword them (see this file's header):\n${found.join("\n")}`).toEqual([]);
  });

  it("finds nothing in any entry as a reader of another language is served it", () => {
    const found: string[] = [];
    for (const locale of ACT_WORD_LOCALES) {
      const served = ADMIN_ACT_ENTRIES.map((e) => localizeEntry(e, locale));
      // The list really is in that language: the scan below is not reading the English a second time.
      expect(served.filter((e, i) => e !== ADMIN_ACT_ENTRIES[i]).length).toBe(Object.keys(ADMIN_ACT_WORDS[locale]).length);
      for (const e of served) for (const c of captures(printed(e), patterns)) found.push(`${locale} ${e.id}: ${c}`);
      for (const text of everyPrinting(served)) for (const c of captures(text, patterns)) found.push(`${locale}, the whole served list: ${c}`);
    }
    expect(found, `These served words read as an import to the image build's probe. Reword them (see this file's header):\n${found.join("\n")}`).toEqual([]);
  });
});
