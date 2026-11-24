import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compileMessage } from "@lingui/message-utils/compileMessage";
import { describe, expect, it } from "vitest";
import { precompileMessages } from "./precompileEnglish";
import { bootChunks, CopyCollector, copyPartRead, LONG_MESSAGE_CHARS, partsBesideFiles, renderChunkCopy, SHORT_LITERAL_CHARS, wrapPreloadHelper, writeCopyParts } from "./copySplit";

/**
 * Long English leaves the lazy chunks for a per-chunk part in dist/i18n
 * (dist headroom lane, spec "long copy out of the bundle"). These hold the
 * build side: what moves, what stays, and what each chunk is given instead.
 */

const LONG = "Every member of the village can propose a change to how it runs.";
const SHORT = "Sign in";

describe("precompileMessages with a split collector", () => {
  it("moves a long message out of its descriptor and keeps the id", () => {
    const seen: Array<[string, string]> = [];
    const out = precompileMessages(`t({ id: "Ab12Cd", message: "${LONG}" })`, (id, compiled) => seen.push([id, compiled]));
    expect(out).toBe(`t({ id: "Ab12Cd" })`);
    expect(seen).toEqual([["Ab12Cd", JSON.stringify(compileMessage(LONG))]]);
  });

  it("leaves a short message inline and compiled", () => {
    const seen: string[] = [];
    const out = precompileMessages(`t({ id: "Ab12Cd", message: "${SHORT}" })`, (id) => seen.push(id));
    expect(out).toContain(`message: ${JSON.stringify(compileMessage(SHORT))}`);
    expect(seen).toEqual([]);
  });

  it("keeps values and any field after the message", () => {
    const msg = `${LONG} Ask {name} first.`;
    const out = precompileMessages(`e.jsx(t,{id:"224D8v",values:{name:o},message:"${msg}",context:"x"})`, () => {});
    expect(out).toBe(`e.jsx(t,{id:"224D8v",values:{name:o},context:"x"})`);
  });

  it("measures the threshold on the English as written", () => {
    const exact = "x".repeat(LONG_MESSAGE_CHARS);
    const seen: string[] = [];
    precompileMessages(`t({id:"Ab12Cd",message:"${exact}"}); t({id:"Ef34Gh",message:"${exact.slice(1)}"})`, (id) => seen.push(id));
    expect(seen).toEqual(["Ab12Cd"]);
  });

  it("moves nothing without a collector, which is how tests and dev run", () => {
    expect(precompileMessages(`t({ id: "Ab12Cd", message: "${LONG}" })`)).toContain(`message: ${JSON.stringify(compileMessage(LONG))}`);
  });
});

/** A chunk graph the shape rollup hands renderChunk: file name -> facts. */
function graph() {
  return {
    "assets/index.js": { fileName: "assets/index.js", isEntry: true, imports: ["assets/boot.js"], moduleIds: ["/src/main.tsx"] },
    "assets/boot.js": { fileName: "assets/boot.js", isEntry: false, imports: [], moduleIds: ["/src/Layout.tsx"] },
    "assets/Page.js": { fileName: "assets/Page.js", isEntry: false, imports: ["assets/boot.js", "assets/shared.js"], moduleIds: ["/src/pages/Page.tsx"] },
    "assets/shared.js": { fileName: "assets/shared.js", isEntry: false, imports: [], moduleIds: ["/src/lib/words.ts"] },
  };
}

function collector() {
  const c = new CopyCollector();
  c.record("/src/Layout.tsx", "Lay0ut", JSON.stringify(["Layout words that are long enough to move out"]));
  c.record("/src/pages/Page.tsx", "Pag3_1", JSON.stringify(["The page's own long paragraph of prose, moved."]));
  c.record("/src/pages/Page.tsx", "Pag3_2", JSON.stringify(["A second long paragraph that the page renders."]));
  return c;
}

describe("bootChunks", () => {
  it("is the entry and everything it imports statically, transitively", () => {
    expect([...bootChunks(graph())].sort()).toEqual(["assets/boot.js", "assets/index.js"]);
  });
});

describe("renderChunkCopy", () => {
  it("gives a lazy chunk one synchronous read of its own part, before any of its code runs, and no top-level await", () => {
    const c = collector();
    const out = renderChunkCopy("export const x=1;", graph()["assets/Page.js"], graph(), c);
    expect(out).not.toBeNull();
    const part = [...c.parts.keys()][0];
    expect(part).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(out!.startsWith(`globalThis.__villageCopyGet("${part}");`)).toBe(true);
    expect(out).not.toContain("await");
    expect(copyPartRead(out!)).toBe(part);
    expect(c.parts.get(part)).toEqual({
      messages: {
        Pag3_1: ["The page's own long paragraph of prose, moved."],
        Pag3_2: ["A second long paragraph that the page renders."],
      },
      texts: [],
    });
  });

  it("gives a boot chunk its English inline, so the first page never waits on a fetch", () => {
    const c = collector();
    const out = renderChunkCopy("export const y=2;", graph()["assets/boot.js"], graph(), c);
    expect(out).toContain(`.push({"Lay0ut":["Layout words that are long enough to move out"]})`);
    expect(out).not.toContain("await");
    expect(c.parts.size).toBe(0);
  });

  it("leaves a chunk with no moved message untouched", () => {
    expect(renderChunkCopy("export const z=3;", graph()["assets/shared.js"], graph(), collector())).toBeNull();
  });

  it("names a part by its content, so the same words always make the same file", () => {
    const a = collector();
    const b = collector();
    renderChunkCopy("", graph()["assets/Page.js"], graph(), a);
    renderChunkCopy("", graph()["assets/Page.js"], graph(), b);
    expect([...a.parts.keys()]).toEqual([...b.parts.keys()]);
  });
});

/**
 * Plain long strings (data files the server also reads, like shared/guilds.ts,
 * and any page copy not yet wrapped for translation) leave a lazy chunk the
 * same way, with no change to the source: the build swaps each literal for a
 * read from the part the chunk already awaits.
 */
describe("long string literals in a lazy chunk", () => {
  const PROSE = "Plant the key before the module can start working for the village.";
  const PROSE2 = "A founder reads this line on the consent screen before choosing.";
  /**
   * Run a rendered chunk body the way the browser would, with the part already
   * fetched (the preload helper did that before the import). A plain Function,
   * not an async one: a top-level await in the chunk would fail to parse here.
   */
  async function run(out: string, c: CopyCollector): Promise<unknown> {
    const g: Record<string, unknown> = {
      __villageCopyGet: (part: string) => c.parts.get(part)!.texts,
    };
    return new Function("globalThis", `${out}\nreturn globalThis.__out;`)(g); // module-review-ok: runs a chunk body this test just rendered from fixed literals, never remote code
  }

  const lazy = () => graph()["assets/shared.js"];

  it("moves a long literal out and the chunk computes the same value", async () => {
    const code = `function f(e){switch(e){case"${PROSE2}":return"${PROSE}"}return e}globalThis.__out=[f("${PROSE2}"),"${PROSE}".length,{note:\`${PROSE2}\`}.note];`;
    const c = new CopyCollector();
    const out = renderChunkCopy(code, lazy(), graph(), c)!;
    expect(out).not.toContain(PROSE);
    expect(out).not.toContain(PROSE2);
    const [part] = [...c.parts.keys()];
    expect(part).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(out).toContain(`globalThis.__villageCopyGet("${part}")`);
    // Each distinct string is stored once, however often the chunk uses it.
    expect([...c.parts.get(part)!.texts].sort()).toEqual([PROSE2, PROSE].sort());
    expect(await run(out, c)).toEqual([PROSE, PROSE.length, PROSE2]);
  });

  it("keeps every literal a value read cannot replace", () => {
    const code = [
      `"use strict";`,
      `import a from "./${"x".repeat(50)} y.js";`,
      `export { a as "${PROSE} export" };`,
      `const o = { "${PROSE} key": 1, ["${PROSE} computed"]: 2 };`,
      `class K { "${PROSE} method"() {} }`,
      `const t = String.raw\`${PROSE} tagged\`;`,
      `const v = \`${PROSE} \${o} templated\`;`,
      `const p = "__VITE_PRELOAD__ ${PROSE}";`,
      `const n = "${"y".repeat(60)}";`,
      `const s = "Short words.";`,
    ].join("\n");
    const c = new CopyCollector();
    const out = renderChunkCopy(code, lazy(), graph(), c)!;
    for (const kept of [`${PROSE} export`, `${PROSE} key`, `${PROSE} method`, `${PROSE} tagged`, `${PROSE} \${o} templated`, "__VITE_PRELOAD__", "y".repeat(60), "Short words.", `"use strict"`]) {
      expect(out).toContain(kept);
    }
    // The computed key is an expression, so it moves like any other value.
    expect(out).not.toContain(`${PROSE} computed`);
    expect([...c.parts.values()][0].texts).toEqual([`${PROSE} computed`]);
  });

  it("never touches a boot chunk: the first paint waits on nothing", () => {
    const code = `globalThis.__out="${PROSE}";`;
    expect(renderChunkCopy(code, graph()["assets/boot.js"], graph(), new CopyCollector())).toBeNull();
  });

  it("picks a name the chunk does not already use", async () => {
    const code = `const __vC=1,__vC0=2;globalThis.__out=["${PROSE}",__vC+__vC0];`;
    const c = new CopyCollector();
    const out = renderChunkCopy(code, lazy(), graph(), c)!;
    expect(await run(out, c)).toEqual([PROSE, 3]);
  });

  it("keeps characters JSON and the source spell differently", async () => {
    const tricky = "Quotes \" and ' and a backslash \\ then an emoji 🌱 and a line\nbreak, all moved.";
    const code = `globalThis.__out=${JSON.stringify(tricky)};`;
    const c = new CopyCollector();
    const out = renderChunkCopy(code, lazy(), graph(), c)!;
    const parsed = JSON.parse(JSON.stringify(c.parts.get([...c.parts.keys()][0])));
    c.parts.set([...c.parts.keys()][0], parsed);
    expect(await run(out, c)).toBe(tricky);
  });

  it("leaves a chunk with nothing long in it untouched", () => {
    expect(renderChunkCopy(`globalThis.__out="Short.";`, lazy(), graph(), new CopyCollector())).toBeNull();
  });

  /*
   * Shorter literals ride a part the chunk already reads (dist room pass): the
   * read costs the same however much the part holds, and a chunk with nothing
   * long gets no part, so no page waits on a read it did not wait on before.
   */
  const MID = "Hold the door open";
  it("moves a literal of SHORT_LITERAL_CHARS or more once the chunk reads a part", async () => {
    expect(SHORT_LITERAL_CHARS).toBeLessThan(LONG_MESSAGE_CHARS);
    const mid = "m".repeat(SHORT_LITERAL_CHARS - MID.length - 1) + " " + MID;
    expect(mid.length).toBe(SHORT_LITERAL_CHARS);
    const code = `globalThis.__out=["${PROSE}","${mid}","Short words."];`;
    const c = new CopyCollector();
    const out = renderChunkCopy(code, lazy(), graph(), c)!;
    expect(out).not.toContain(mid);
    expect(out).toContain("Short words.");
    expect([...c.parts.values()][0].texts).toEqual([PROSE, mid]);
    expect(await run(out, c)).toEqual([PROSE, mid, "Short words."]);
  });

  it("moves shorter literals beside the chunk's long messages too", () => {
    const c = collector();
    const mid = `${MID} for the next one`;
    const out = renderChunkCopy(`export const x="${mid}";`, graph()["assets/Page.js"], graph(), c)!;
    expect(out).not.toContain(mid);
    expect([...c.parts.values()][0].texts).toEqual([mid]);
  });

  it("gives no part to a chunk whose longest literal is under LONG_MESSAGE_CHARS", () => {
    const mid = `${MID} for the next one`;
    expect(mid.length).toBeLessThan(LONG_MESSAGE_CHARS);
    expect(mid.length).toBeGreaterThanOrEqual(SHORT_LITERAL_CHARS);
    const c = new CopyCollector();
    expect(renderChunkCopy(`globalThis.__out="${mid}";`, lazy(), graph(), c)).toBeNull();
    expect(c.parts.size).toBe(0);
  });
});

describe("writeCopyParts", () => {
  it("writes each part as {messages}, and clears parts a previous build left", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "copy-parts-"));
    fs.writeFileSync(path.join(dir, "stale0000000.json"), "{}");
    const c = collector();
    renderChunkCopy("", graph()["assets/Page.js"], graph(), c);
    writeCopyParts(c, dir);
    const files = fs.readdirSync(dir);
    expect(files).toEqual([`${[...c.parts.keys()][0]}.json`]);
    const body = JSON.parse(fs.readFileSync(path.join(dir, files[0]), "utf8"));
    expect(Object.keys(body.messages).sort()).toEqual(["Pag3_1", "Pag3_2"]);
  });
});

/**
 * The wait moved ahead of each lazy load (crash guard, 19 Nov 2026): the part
 * rides beside its chunk's file in Vite's dependency list, and the preload
 * helper fetches it before importing.
 */
describe("partsBesideFiles", () => {
  const partOf = (f: string) => ({ "assets/Page.js": "pagePart0001", "assets/shared.js": "sharedPart01" })[f] ?? null;

  it("names each dependency's part beside its file and leaves the rest alone", () => {
    expect(partsBesideFiles("assets/Page.js", ["assets/Page.js", "assets/shared.js", "assets/plain.js"], partOf)).toEqual([
      "assets/Page.js~pagePart0001",
      "assets/shared.js~sharedPart01",
      "assets/plain.js",
    ]);
  });

  it("adds the target when Vite left it out, which it does for a target that imports nothing", () => {
    expect(partsBesideFiles("assets/Page.js", [], partOf)).toEqual(["assets/Page.js~pagePart0001"]);
  });

  it("adds nothing for a target the importer already loaded", () => {
    expect(partsBesideFiles(null, [], partOf)).toEqual([]);
  });
});

describe("wrapPreloadHelper", () => {
  /** A stand-in with the same export line as Vite's helper: records what it was given, then imports. */
  const helper = `const seen = [];export const __vitePreload = function preload(baseModule, deps) { seen.push(deps); return Promise.resolve().then(baseModule); }`;

  function load(code: string, g: Record<string, unknown>) {
    const body = code.replace(/export const /g, "const ") + "\nreturn { __vitePreload, seen };";
    return new Function("globalThis", body)(g) as // module-review-ok: runs the wrapped helper this test built from a fixed stand-in, never remote code
       { __vitePreload: (m: () => Promise<unknown>, d?: string[]) => Promise<unknown>; seen: unknown[] };
  }

  it("fetches every part before the import runs, and passes plain file names on", async () => {
    const order: string[] = [];
    let release!: () => void;
    const g = {
      __villageCopyReady: (parts: string[]) => {
        order.push(`ready:${parts.join(",")}`);
        return new Promise<void>((r) => (release = r));
      },
    };
    const h = load(wrapPreloadHelper(helper), g);
    const done = h.__vitePreload(async () => order.push("import"), ["assets/Page.js~pagePart0001", "assets/a.css"]);
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(["ready:pagePart0001"]);
    release();
    await done;
    expect(order).toEqual(["ready:pagePart0001", "import"]);
    expect(h.seen).toEqual([["assets/Page.js", "assets/a.css"]]);
  });

  it("fails the import when a part cannot arrive", async () => {
    const h = load(wrapPreloadHelper(helper), { __villageCopyReady: () => Promise.reject(new Error("copy part x: 404")) });
    await expect(h.__vitePreload(async () => "module", ["assets/Page.js~pagePart0001"])).rejects.toThrow("404");
  });

  it("asks for nothing when no dependency carries a part", async () => {
    const h = load(wrapPreloadHelper(helper), {});
    expect(await h.__vitePreload(async () => "module", ["assets/plain.js"])).toBe("module");
    expect(await h.__vitePreload(async () => "bare")).toBe("bare");
  });

  it("refuses a helper whose shape changed, so an upgrade cannot drop the wait silently", () => {
    expect(() => wrapPreloadHelper("export function __vitePreload() {}")).toThrow(/changed shape/);
  });
});
