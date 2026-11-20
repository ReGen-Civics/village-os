/**
 * The lazy-chunk guard's own fixture suite (node scripts/check-lazy-chunk-tla.test.mjs).
 *
 * A guard nobody has watched refuse reports green either way. Each case below
 * is a tiny built tree in the exact shape Vite emits, and the first one is the
 * 1.3.27 crash: two lazy importers of one chunk that opens with the old copy
 * loader's top-level await and keeps a top-level `let`.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const GUARD = path.resolve(import.meta.dirname, "check-lazy-chunk-tla.mjs");
let checks = 0;
let failures = 0;

/** Write dist/public/{index.html, assets/*} and run the guard over the assets. */
function run(assets, entry = "index-E.js") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lazytla-"));
  const dir = path.join(root, "assets");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), `<!doctype html><script type="module" crossorigin src="/assets/${entry}"></script>`);
  for (const [name, body] of Object.entries(assets)) fs.writeFileSync(path.join(dir, name), body);
  const r = spawnSync(process.execPath, [GUARD, dir], { encoding: "utf8" });
  fs.rmSync(root, { recursive: true, force: true });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function expect(name, cond, detail) {
  checks++;
  if (cond) return;
  failures++;
  console.error(`FAIL ${name}\n${detail}\n`);
}

const MAP = (files) => `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=${JSON.stringify(files)})))=>i.map(i=>d[i]);\n`;
const HELPER = `export const p=function(e,t){return Promise.resolve().then(e)};`;

// 1. THE 1.3.27 SHAPE, as it was built: two lazy importers, a TLA, a top-level let.
const old = run({
  "index-E.js": `${MAP(["assets/VoiceInvite-a.js", "assets/VoiceClips-b.js"])}import{p as b}from"./helper-h.js";b(()=>import("./VoiceInvite-a.js"),__vite__mapDeps([0]));b(()=>import("./VoiceClips-b.js"),__vite__mapDeps([1]));`,
  "helper-h.js": HELPER,
  "VoiceInvite-a.js": `${MAP(["assets/VoiceStepMore-c.js"])}import{p as b}from"./helper-h.js";export const L=()=>b(()=>import("./VoiceStepMore-c.js"),__vite__mapDeps([0]));`,
  "VoiceClips-b.js": `${MAP(["assets/VoiceStepMore-c.js"])}import{p as b}from"./helper-h.js";export const L=()=>b(()=>import("./VoiceStepMore-c.js"),__vite__mapDeps([0]));`,
  "VoiceStepMore-c.js": `const e=await globalThis.__villageCopyLoad("abcdefghijkl");let t=null;export function s(){return t??(t=e.length)}`,
});
expect("the old two-importer pattern fails", old.status === 1, old.out);
expect("it is named as the race", /\[tla-race\] VoiceStepMore-c\.js/.test(old.out) && /2 import sites/.test(old.out), old.out);
expect("the old loader is named too", /\[old-loader\] VoiceStepMore-c\.js/.test(old.out), old.out);

// 2. The same race from a TLA that is not the copy loader: rule 1 is about the shape, whatever put the await there.
const anyAwait = run({
  "index-E.js": `${MAP(["assets/A-a.js", "assets/B-b.js"])}import{p as b}from"./helper-h.js";b(()=>import("./A-a.js"),__vite__mapDeps([0]));b(()=>import("./B-b.js"),__vite__mapDeps([1]));`,
  "helper-h.js": HELPER,
  "A-a.js": `import{v}from"./Shared-s.js";export{v};`,
  "B-b.js": `import{v}from"./Shared-s.js";export{v};`,
  "Shared-s.js": `const r=await fetch("/x");var v=1;export{v};`,
});
expect("two chunks sharing a static TLA chunk fail", anyAwait.status === 1 && /\[tla-race\] Shared-s\.js/.test(anyAwait.out), anyAwait.out);

// 3. One importer only: a TLA with state is not a race.
const one = run({
  "index-E.js": `${MAP(["assets/A-a.js"])}import{p as b}from"./helper-h.js";b(()=>import("./A-a.js"),__vite__mapDeps([0]));`,
  "helper-h.js": HELPER,
  "A-a.js": `const r=await fetch("/x");let v=1;export{v};`,
});
expect("a single importer passes", one.status === 0, one.out);

// 4. THE FIXED SHAPE: no TLA, the part named beside its file in every preload list.
const fixed = run({
  "index-E.js": `${MAP(["assets/VoiceInvite-a.js~invitePart01", "assets/VoiceClips-b.js~clipsPart001"])}import{p as b}from"./helper-h.js";b(()=>import("./VoiceInvite-a.js"),__vite__mapDeps([0]));b(()=>import("./VoiceClips-b.js"),__vite__mapDeps([1]));`,
  "helper-h.js": HELPER,
  "VoiceInvite-a.js": `globalThis.__villageCopyGet("invitePart01");${MAP(["assets/VoiceStepMore-c.js~morePart0001"])}import{p as b}from"./helper-h.js";export const L=()=>b(()=>import("./VoiceStepMore-c.js").then(e=>e.d),__vite__mapDeps([0]));`,
  "VoiceClips-b.js": `globalThis.__villageCopyGet("clipsPart001");${MAP(["assets/VoiceStepMore-c.js~morePart0001"])}import{p as b}from"./helper-h.js";export const L=()=>b(()=>import("./VoiceStepMore-c.js"),__vite__mapDeps([0]));`,
  "VoiceStepMore-c.js": `const e=globalThis.__villageCopyGet("morePart0001");let t=null;export function s(){return t??(t=e.length)}`,
});
expect("the fixed shape passes", fixed.status === 0 && /clean/.test(fixed.out), fixed.out);

// 5. A part read with no fetch in front of it: one import site forgot it.
const missing = run({
  "index-E.js": `${MAP(["assets/A-a.js~aPart0000001", "assets/B-b.js"])}import{p as b}from"./helper-h.js";b(()=>import("./A-a.js"),__vite__mapDeps([0]));b(()=>import("./B-b.js"),__vite__mapDeps([1]));`,
  "helper-h.js": HELPER,
  "A-a.js": `const e=globalThis.__villageCopyGet("aPart0000001");export const x=e;`,
  "B-b.js": `import"./A-a.js";export const y=1;`,
});
expect("a site that runs a part reader without fetching its part fails", missing.status === 1 && /\[copy-before-import\] A-a\.js reads copy part aPart0000001, but import\("\.\/B-b\.js"\)/.test(missing.out), missing.out);

// 6. An import outside the preload helper cannot fetch anything first.
const bare = run({
  "index-E.js": `import("./A-a.js");`,
  "A-a.js": `const e=globalThis.__villageCopyGet("aPart0000001");export const x=e;`,
});
expect("a bare import of a part reader fails", bare.status === 1 && /not wrapped by the preload helper/.test(bare.out), bare.out);

// 7. A boot chunk may not read a part: nothing fetched one before the entry ran.
const bootRead = run({
  "index-E.js": `import{x}from"./boot-b.js";${MAP(["assets/A-a.js"])}import{p as b}from"./helper-h.js";b(()=>import("./A-a.js"),__vite__mapDeps([0]));`,
  "helper-h.js": HELPER,
  "boot-b.js": `const e=globalThis.__villageCopyGet("bootPart0001");export const x=e;`,
  "A-a.js": `export const y=1;`,
});
expect("a boot chunk reading a part fails", bootRead.status === 1 && /boot-b\.js loads with the first page/.test(bootRead.out), bootRead.out);

// 8. An await inside a function is not top-level.
const inner = run({
  "index-E.js": `${MAP(["assets/A-a.js", "assets/B-b.js"])}import{p as b}from"./helper-h.js";b(()=>import("./A-a.js"),__vite__mapDeps([0]));b(()=>import("./B-b.js"),__vite__mapDeps([1]));`,
  "helper-h.js": HELPER,
  "A-a.js": `import"./S-s.js";`,
  "B-b.js": `import"./S-s.js";`,
  "S-s.js": `let n=0;export async function f(){await null;for await(const x of []){}return n}class K{async m(){await 1}}`,
});
expect("awaits inside functions are not top-level", inner.status === 0, inner.out);

// 10. THE SHAPES THE AUDIT FOUND (19 Nov 2026), named as built: smalls (one dynamic importer, many static
// importers, module-level lets and Maps), EditRoleButton (`let $`) and geneKeysSky (`let O`).
const audit = run({
  "index-E.js": `${MAP(["assets/smalls-a.js", "assets/PageA-a.js", "assets/PageB-b.js", "assets/PageC-c.js", "assets/EditRoleButton-e.js", "assets/geneKeysSky-g.js"])}import{p as b}from"./helper-h.js";b(()=>import("./smalls-a.js"),__vite__mapDeps([0]));b(()=>import("./PageA-a.js"),__vite__mapDeps([1]));b(()=>import("./PageB-b.js"),__vite__mapDeps([2]));b(()=>import("./PageC-c.js"),__vite__mapDeps([3]));b(()=>import("./EditRoleButton-e.js"),__vite__mapDeps([4]));b(()=>import("./geneKeysSky-g.js"),__vite__mapDeps([5]));`,
  "helper-h.js": HELPER,
  "smalls-a.js": `const e=await globalThis.__villageCopyLoad("smallsPart01");let U=0;const m=new Map,s=new Set;export{U,m,s};`,
  "PageA-a.js": `import{U}from"./smalls-a.js";import"./EditRoleButton-e.js";export{U};`,
  "PageB-b.js": `import{m}from"./smalls-a.js";import"./geneKeysSky-g.js";export{m};`,
  "PageC-c.js": `import{s}from"./smalls-a.js";export{s};`,
  "EditRoleButton-e.js": `const e=await globalThis.__villageCopyLoad("editPart0001");let $=null;export const x=()=>$;`,
  "geneKeysSky-g.js": `const e=await globalThis.__villageCopyLoad("skyPart00001");let O=0;export const y=()=>O;`,
});
for (const name of ["smalls-a.js", "EditRoleButton-e.js", "geneKeysSky-g.js"]) {
  expect(`the audit's ${name.split("-")[0]} shape is flagged`, audit.status === 1 && new RegExp(`\\[tla-race\\] ${name.replace(".", "\\.")}`).test(audit.out), audit.out);
}

// 9. The floor: a tree with no import sites means the walker read nothing.
const empty = run({ "index-E.js": `export const a=1;` });
expect("a tree with no dynamic import fails as unreadable", empty.status === 2, empty.out);

console.log(`check-lazy-chunk-tla.test: ${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
