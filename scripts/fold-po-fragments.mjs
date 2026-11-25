#!/usr/bin/env node
/**
 * Fold every language's fragments into its catalog, then delete the fragments.
 *
 *   node scripts/fold-po-fragments.mjs            (main's generated-docs workflow, after a merge)
 *   node scripts/fold-po-fragments.mjs --check    (fold in memory and change nothing)
 *
 * A pull request never runs this: it adds `client/src/locales/<tag>.d/<name>.po`
 * and main folds it after the merge. The rule and the fold are in
 * scripts/lib/poFragments.mjs; the flow is docs/GENERATED_DOCS.md.
 * With no fragments it changes nothing, so a second run is a no-op.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogLocales, conflicts, fragmentFiles, mergedPoText } from "./lib/poFragments.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function foldAll(dir, { write = true } = {}) {
  const folded = [];
  for (const locale of catalogLocales(dir)) {
    const frags = fragmentFiles(dir, locale);
    if (!frags.length) continue;
    const named = frags.map((f) => ({ name: path.relative(dir, f).split(path.sep).join("/"), text: fs.readFileSync(f, "utf8") }));
    for (const c of conflicts(named)) console.log(`::warning::${locale}: "${c.key}" differs between ${c.files.join(" and ")}; the later file wins`);
    const text = mergedPoText(dir, locale);
    if (write) {
      fs.writeFileSync(path.join(dir, `${locale}.po`), text);
      for (const f of frags) fs.rmSync(f);
      const d = path.join(dir, `${locale}.d`);
      // Keep the folder's README (or anything that is not a fragment); drop it when empty.
      if (fs.readdirSync(d).length === 0) fs.rmdirSync(d);
    }
    folded.push({ locale, fragments: frags.length });
  }
  return folded;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf("--locales-dir");
  const dir = path.resolve(at > -1 ? process.argv[at + 1] : path.join(ROOT, "client", "src", "locales"));
  const check = process.argv.includes("--check");
  try {
    const folded = foldAll(dir, { write: !check });
    if (!folded.length) console.log("No catalog fragments to fold.");
    for (const f of folded) console.log(`${check ? "would fold" : "folded"} ${f.fragments} fragment(s) into ${f.locale}.po`);
  } catch (err) {
    console.error(`::error::${err.message}`);
    process.exit(1);
  }
}
