/**
 * A LANGUAGE'S CATALOG, PLUS THE FRAGMENTS PULL REQUESTS ADD TO IT.
 *
 * (The lead, 24 Nov 2026, through the coordinator: "Build the es.po fragments".)
 *
 * THE PROBLEM THIS ENDS. Every translation pull request edited
 * `client/src/locales/es.po`, and main rewrites that file after each merge
 * (`lingui extract` refreshes its origins and order). So every landing made every
 * open translation pull request conflict on it, and a conflicted pull request
 * gets no CI run.
 *
 * THE RULE. A pull request never edits `<tag>.po`. It adds a fragment,
 * `client/src/locales/<tag>.d/<name>.po`, holding only the entries it adds or
 * changes, as an ordinary PO file (comments such as `# needs-native-review`
 * included). Two pull requests write two files, so they never conflict.
 * After the merge, `.github/workflows/generated-docs.yml` runs
 * `scripts/fold-po-fragments.mjs`, which folds every fragment into `<tag>.po` and
 * deletes the fragments, then `lingui extract` tidies the result, and the bot
 * commits both as its one commit.
 *
 * Until then every reader sees the MERGED view (`mergedPoText`): the build that
 * compiles the catalogs, the catalog check and the coverage measure. So a fragment
 * is live in the pull request that adds it.
 *
 * THE FOLD. Entries are keyed by context and message (msgctxt + msgid). A fragment
 * entry replaces the catalog's entry with the same key, in place, keeping the
 * catalog's `#:` origin lines when the fragment carries none; a new key is
 * appended; an obsolete (`#~`) entry with the key is revived by it. Fragments fold
 * in filename order. Two fragments that give one key DIFFERENT text are a conflict:
 * `conflicts()` names it and the catalog check fails the pull request that holds
 * both. Main never stops for one: there the later file wins and the fold prints a
 * warning, because a red fold would stop every generated file from being written.
 */
import fs from "node:fs";
import path from "node:path";

const SEP = "\u0004";

function unquote(s) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/** One block of PO text: its key (null for the header or a comment-only block) and whether it is obsolete. */
export function blockKey(block) {
  let ctx = "";
  let id = null;
  let field = null;
  let obsolete = false;
  for (const raw of block.split("\n")) {
    let line = raw;
    if (line.startsWith("#~")) {
      obsolete = true;
      line = line.slice(2).trimStart();
    } else if (line.startsWith("#")) continue;
    if (line.startsWith("msgctxt ")) (field = "ctx"), (ctx = unquote(line.slice(8)));
    else if (line.startsWith("msgid_plural ")) field = null;
    else if (line.startsWith("msgid ")) (field = "id"), (id = unquote(line.slice(6)));
    else if (line.startsWith("msgstr")) field = null;
    else if (line.startsWith('"') && field === "ctx") ctx += unquote(line);
    else if (line.startsWith('"') && field === "id") id += unquote(line);
  }
  if (id === null || id === "") return { key: null, obsolete };
  return { key: `${ctx}${SEP}${id}`, obsolete };
}

/** Blocks of PO text, normalised to LF, without their separating blank lines. */
export function splitBlocks(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.replace(/^\n+|\n+$/g, ""))
    .filter((b) => b.trim());
}

/** Everything a block says, minus its origin and comment lines: what two fragments must agree on. */
const body = (block) => block.split("\n").filter((l) => !l.startsWith("#") || l.startsWith("#~") || l.startsWith("#,")).join("\n");
const origins = (block) => block.split("\n").filter((l) => l.startsWith("#:"));

/** The fragment files of `<dir>/<locale>.d`, sorted. */
export function fragmentFiles(dir, locale) {
  const d = path.join(dir, `${locale}.d`);
  if (!fs.existsSync(d)) return [];
  return fs
    .readdirSync(d)
    .filter((f) => f.endsWith(".po"))
    .sort()
    .map((f) => path.join(d, f));
}

/**
 * Keys two fragments give different text. `fragments` is [{ name, text }].
 * Returns [{ key, files: [a, b] }].
 */
export function conflicts(fragments) {
  const seen = new Map();
  const out = [];
  for (const { name, text } of fragments) {
    for (const block of splitBlocks(text)) {
      const { key } = blockKey(block);
      if (!key) continue;
      const prev = seen.get(key);
      if (prev && prev.body !== body(block)) out.push({ key: key.startsWith(SEP) ? key.slice(1) : key.split(SEP).join(" | "), files: [prev.name, name] });
      else if (!prev) seen.set(key, { name, body: body(block) });
    }
  }
  return out;
}

/** `base` (a PO file's text) with every fragment folded in. On a conflict the later file wins. */
export function foldPo(base, fragments) {
  const blocks = splitBlocks(base);
  const at = new Map();
  blocks.forEach((b, i) => {
    const { key } = blockKey(b);
    if (key && !at.has(key)) at.set(key, i);
  });
  for (const { text } of fragments) {
    for (const block of splitBlocks(text)) {
      const { key, obsolete } = blockKey(block);
      if (!key || obsolete) continue;
      const i = at.get(key);
      if (i === undefined) {
        at.set(key, blocks.length);
        blocks.push(block);
        continue;
      }
      const keep = blockKey(blocks[i]).obsolete ? [] : origins(blocks[i]);
      if (origins(block).length || !keep.length) {
        blocks[i] = block;
        continue;
      }
      // The fragment's comments, then the catalog's origins, then the entry itself.
      const lines = block.split("\n");
      const first = lines.findIndex((l) => !l.startsWith("#"));
      blocks[i] = [...lines.slice(0, first), ...keep, ...lines.slice(first)].join("\n");
    }
  }
  return `${blocks.join("\n\n")}\n`;
}

/** The text of `<dir>/<locale>.po` with its fragments folded in: what every reader reads. */
export function mergedPoText(dir, locale) {
  const file = path.join(dir, `${locale}.po`);
  const base = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const frags = fragmentFiles(dir, locale);
  if (!frags.length) return base;
  return foldPo(
    base,
    frags.map((f) => ({ name: path.relative(dir, f).split(path.sep).join("/"), text: fs.readFileSync(f, "utf8") })),
  );
}

/** The languages in `dir` that have a catalog or fragments (never the source). */
export function catalogLocales(dir, source = "en") {
  const tags = new Set();
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".po")) tags.add(f.slice(0, -3));
    else if (f.endsWith(".d") && fs.statSync(path.join(dir, f)).isDirectory()) tags.add(f.slice(0, -2));
  }
  tags.delete(source);
  return [...tags].sort();
}
