/**
 * The catalog fragments fold the way docs/I18N.md says (scripts/lib/poFragments.mjs).
 *
 * Runs against scratch folders, never this repository's catalogs.
 *
 * Run: node scripts/fold-po-fragments.test.mjs
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { conflicts, foldPo, mergedPoText } from "./lib/poFragments.mjs";
import { foldAll } from "./fold-po-fragments.mjs";
import { checkCatalogs } from "./check-i18n-catalogs.mjs";
import { compileCatalogs } from "./build-i18n-catalogs.mjs";
import { GENERATED_FILES } from "./lib/generatedDocs.mjs";
import { findViolations } from "./check-generated-docs-untouched.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let run = 0;
const check = async (name, fn) => {
  await fn();
  run += 1;
  console.log(`  PASS  ${name}`);
};

const HEAD = 'msgid ""\nmsgstr ""\n"Language: es\\n"\n';
const entry = ({ id, str = "", ctx, origin, note }) =>
  `${note ? `# ${note}\n` : ""}${origin ? `#: ${origin}\n` : ""}${ctx ? `msgctxt "${ctx}"\n` : ""}msgid "${id}"\nmsgstr "${str}"\n`;
const po = (...entries) => [HEAD, ...entries.map(entry)].join("\n");

function scratch(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "po-frag-"));
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), body);
  }
  return dir;
}

console.log("catalog fragments: a pull request adds a file, main folds it in");

await check("a fragment fills an empty translation in place and keeps the catalog's origins", () => {
  const base = po({ id: "Welcome home", origin: "client/src/pages/Home.tsx" }, { id: "Leave", ctx: "nav" });
  const out = foldPo(base, [{ name: "es.d/a.po", text: po({ id: "Welcome home", str: "Bienvenida a casa", note: "needs-native-review" }) }]);
  assert.match(out, /# needs-native-review\n#: client\/src\/pages\/Home.tsx\nmsgid "Welcome home"\nmsgstr "Bienvenida a casa"/);
  assert.ok(out.indexOf("Welcome home") < out.indexOf('"Leave"'), "replaced where it stood");
  assert.equal(out.match(/msgid "Welcome home"/g).length, 1);
});

await check("context is part of the key: the same words in another context are a new entry", () => {
  const base = po({ id: "Open", ctx: "button", str: "Abrir" });
  const out = foldPo(base, [{ name: "a", text: po({ id: "Open", ctx: "proposal status", str: "Abierta" }) }]);
  assert.match(out, /msgctxt "button"\nmsgid "Open"\nmsgstr "Abrir"/);
  assert.match(out, /msgctxt "proposal status"\nmsgid "Open"\nmsgstr "Abierta"/);
});

await check("an obsolete entry is revived by a fragment, never duplicated", () => {
  const base = `${HEAD}\n#~ msgid "Old words"\n#~ msgstr "Palabras viejas"\n`;
  const out = foldPo(base, [{ name: "a", text: po({ id: "Old words", str: "Palabras" }) }]);
  assert.doesNotMatch(out, /#~/);
  assert.match(out, /msgid "Old words"\nmsgstr "Palabras"/);
});

await check("two fragments that agree are no conflict; two that differ are named, and the later file wins", () => {
  const a = { name: "es.d/a.po", text: po({ id: "Hello", str: "Hola" }) };
  const same = { name: "es.d/b.po", text: po({ id: "Hello", str: "Hola", origin: "x.tsx" }) };
  const other = { name: "es.d/c.po", text: po({ id: "Hello", str: "Buenas" }) };
  assert.deepEqual(conflicts([a, same]), []);
  const clash = conflicts([a, other]);
  assert.equal(clash.length, 1);
  assert.match(clash[0].key, /Hello$/);
  assert.deepEqual(clash[0].files, ["es.d/a.po", "es.d/c.po"]);
  assert.match(foldPo(HEAD, [a, other]), /msgstr "Buenas"/);
});

await check("CONTROL: the catalog check fails a pull request holding two fragments that disagree", async () => {
  const dir = scratch({
    "en.po": `msgid ""\nmsgstr ""\n"Language: en\\n"\n\n#: client/src/A.tsx\nmsgid "Hello there my good friend"\nmsgstr "Hello there my good friend"\n`,
    "es.po": HEAD,
    "es.d/a.po": po({ id: "Hello there my good friend", str: "Hola, mi buena amiga" }),
    "es.d/b.po": po({ id: "Hello there my good friend", str: "Hola, mi buen amigo" }),
  });
  const problems = await checkCatalogs({ dir, scope: [], skipExtract: true });
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], /es\.d\/a\.po and es\.d\/b\.po/);
});

await check("the catalog check reads the merged view: a fragment with a broken argument fails", async () => {
  const dir = scratch({
    "en.po": `msgid ""\nmsgstr ""\n"Language: en\\n"\n\nmsgid "You have gathered {count} seeds today"\nmsgstr "You have gathered {count} seeds today"\n`,
    "es.po": HEAD,
    "es.d/a.po": po({ id: "You have gathered {count} seeds today", str: "Hoy reunió {cuenta} semillas" }),
  });
  const problems = await checkCatalogs({ dir, scope: [], skipExtract: true });
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], /arguments/);
});

await check("the compiled catalog carries a fragment's translation before any fold", async () => {
  const dir = scratch({ "es.po": HEAD, "es.d/a.po": po({ id: "Plant a tree", str: "Plante un árbol" }) });
  const out = path.join(dir, "out");
  assert.deepEqual(await compileCatalogs({ srcDir: dir, outDir: out }), ["es"]);
  assert.match(fs.readFileSync(path.join(out, "es.json"), "utf8"), /Plante un árbol/);
});

await check("a language with only fragments still compiles and folds", async () => {
  const dir = scratch({ "pt.d/a.po": po({ id: "Plant a tree", str: "Plante uma árvore" }) });
  assert.match(mergedPoText(dir, "pt"), /Plante uma árvore/);
  assert.deepEqual(foldAll(dir), [{ locale: "pt", fragments: 1 }]);
  assert.ok(fs.existsSync(path.join(dir, "pt.po")));
});

await check("the fold writes the catalog, deletes the fragments, keeps a README, and a second run changes nothing", () => {
  const dir = scratch({ "es.po": po({ id: "Seed", ctx: "token", origin: "a.tsx" }), "es.d/a.po": po({ id: "Seed", ctx: "token", str: "Semilla" }), "es.d/README.md": "fragments" });
  assert.deepEqual(foldAll(dir), [{ locale: "es", fragments: 1 }]);
  const once = fs.readFileSync(path.join(dir, "es.po"), "utf8");
  assert.match(once, /#: a.tsx\nmsgctxt "token"\nmsgid "Seed"\nmsgstr "Semilla"/);
  assert.deepEqual(fs.readdirSync(path.join(dir, "es.d")), ["README.md"]);
  assert.deepEqual(foldAll(dir), []);
  assert.equal(fs.readFileSync(path.join(dir, "es.po"), "utf8"), once);
});

await check("CONTROL: a pull request that edits es.po is refused, and told where its Spanish goes", () => {
  assert.ok(GENERATED_FILES.some((g) => g.path === "client/src/locales/es.po" && g.kind === "whole"));
  const bad = findViolations({ changed: ["client/src/locales/es.po"], readBase: () => null, readHead: () => null });
  assert.equal(bad.length, 1);
  assert.match(bad[0].why, /es\.d\/<name>\.po/);
  assert.deepEqual(findViolations({ changed: ["client/src/locales/es.d/home.po"], readBase: () => null, readHead: () => null }), []);
});

await check("main's workflow folds before it extracts, in both runs", () => {
  const wf = fs.readFileSync(path.join(ROOT, ".github", "workflows", "generated-docs.yml"), "utf8");
  const folds = [...wf.matchAll(/fold-po-fragments\.mjs/g)].map((m) => m.index);
  const extracts = [...wf.matchAll(/pnpm i18n:extract/g)].map((m) => m.index);
  assert.equal(folds.length, 2);
  assert.ok(folds[0] < extracts[0] && folds[1] < extracts[1] && folds[1] > extracts[0]);
});

console.log(`\n${run} check(s) passed`);
