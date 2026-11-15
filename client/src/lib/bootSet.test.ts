import { describe, expect, it } from "vitest";
import { allLazyInBoot, bootChunks, bootIntrudersMessage, judgeRoute, lazyModulesInBoot, pageChunk, routeFirstView, routeVerdictMessage, shortId, type BootChunkFacts, type RouteChunkFacts } from "./bootSet";

const ROOT = "/repo";
const chunk = (fileName: string, o: Partial<BootChunkFacts> = {}): BootChunkFacts => ({ fileName, imports: [], isEntry: false, moduleIds: [], ...o });

/** The shape of the real incident: a boot chunk that rollup grew with two modules only lazy pages import. */
const graph: BootChunkFacts[] = [
  chunk("index.js", { isEntry: true, imports: ["shared-boot.js"], moduleIds: ["/repo/client/src/main.tsx", "/repo/client/src/components/alignment/AlignButton.tsx"] }),
  chunk("shared-boot.js", { moduleIds: ["/repo/client/src/components/journey/look.ts", "/repo/shared/termsWords.ts", "/repo/shared/seatSettings.ts", "\0vite/preload-helper"] }),
  chunk("Propose.js", { moduleIds: ["/repo/client/src/pages/Propose.tsx"] }),
];
const eager = new Set(["/repo/client/src/main.tsx", "/repo/client/src/components/alignment/AlignButton.tsx", "/repo/client/src/components/journey/look.ts"]);

describe("the boot set guard", () => {
  it("counts the entry and everything it imports statically, and no lazy chunk", () => {
    expect(bootChunks(graph).map((c) => c.fileName).sort()).toEqual(["index.js", "shared-boot.js"]);
  });

  it("names the lazy-only modules that joined a boot chunk, and the chunk they joined", () => {
    expect(lazyModulesInBoot(graph, eager)).toEqual([{ chunk: "shared-boot.js", modules: ["/repo/shared/termsWords.ts", "/repo/shared/seatSettings.ts"] }]);
  });

  it("control: the same graph with those two modules in a lazy chunk passes", () => {
    const fixed = graph.map((c) => (c.fileName === "shared-boot.js" ? { ...c, moduleIds: c.moduleIds.filter((m) => !/termsWords|seatSettings/.test(m)) } : c));
    expect(lazyModulesInBoot(fixed, eager)).toEqual([]);
  });

  it("control: a module in the entry's own static closure is never an intruder, whichever chunk holds it", () => {
    const all = new Set([...eager, "/repo/shared/termsWords.ts", "/repo/shared/seatSettings.ts"]);
    expect(lazyModulesInBoot(graph, all)).toEqual([]);
  });

  it("never names rollup's own helpers", () => {
    expect(allLazyInBoot(graph, eager, (id) => shortId(id, ROOT)).some((m) => m.includes("preload-helper"))).toBe(false);
  });

  it("lets the known list through and names only what is new (a ratchet that can shrink, never grow)", () => {
    const known = new Set(["shared/termsWords.ts"]);
    const found = lazyModulesInBoot(graph, eager, known, (id) => shortId(id, ROOT));
    expect(found).toEqual([{ chunk: "shared-boot.js", modules: ["/repo/shared/seatSettings.ts"] }]);
  });

  it("says what to do and which files, as paths a person can open", () => {
    const text = bootIntrudersMessage(lazyModulesInBoot(graph, eager), ROOT);
    expect(text).toContain("2 module(s)");
    expect(text).toContain("shared-boot.js");
    expect(text).toContain("shared/termsWords.ts");
    expect(text).toContain("shared/seatSettings.ts");
    expect(text).not.toContain("/repo/");
  });

  it("shortens a pnpm package path to node_modules/<package>", () => {
    expect(shortId("/repo/node_modules/.pnpm/foo@1.0.0/node_modules/foo/index.js?x=1", ROOT)).toBe("node_modules/foo/index.js");
  });

  it("shortens a Windows module id against a Windows root, whichever slash each one uses", () => {
    // import.meta.dirname is C:\x on Windows and rollup's ids are C:/x: every module used to miss the baseline there.
    expect(shortId("C:/work/village-os/shared/moduleCatalog.ts", "C:\\work\\village-os")).toBe("shared/moduleCatalog.ts");
    expect(shortId("C:\\work\\village-os\\client\\src\\App.tsx", "C:\\work\\village-os")).toBe("client/src/App.tsx");
    expect(shortId("C:/work/village-os/node_modules/.pnpm/foo@1.0.0/node_modules/foo/index.js", "C:\\work\\village-os")).toBe("node_modules/foo/index.js");
  });
});

/** The shape of the page speed incident: a key page importing one member of a merged group gets every member. */
const rchunk = (fileName: string, o: Partial<RouteChunkFacts> = {}): RouteChunkFacts => ({ fileName, imports: [], isEntry: false, moduleIds: [], facadeModuleId: null, isDynamicEntry: false, ...o });
const routeGraph: RouteChunkFacts[] = [
  rchunk("index.js", { isEntry: true, moduleIds: ["/repo/client/src/main.tsx"] }),
  rchunk("Steward.js", { isDynamicEntry: true, facadeModuleId: "/repo/client/src/pages/Steward.tsx", imports: ["smallui.js"], moduleIds: ["/repo/client/src/pages/Steward.tsx"] }),
  rchunk("smallui.js", { moduleIds: ["/repo/client/src/components/NextAct.tsx", "/repo/client/src/components/MicButton.tsx", "/repo/client/src/components/voice/useVoiceRecorder.ts"] }),
  rchunk("Propose.js", { isDynamicEntry: true, facadeModuleId: "/repo/client/src/pages/Propose.tsx", imports: ["smallui.js"], moduleIds: ["/repo/client/src/pages/Propose.tsx"] }),
];
const stewardReach = new Set(["/repo/client/src/main.tsx", "/repo/client/src/pages/Steward.tsx", "/repo/client/src/components/NextAct.tsx"]);
const gz: Record<string, number> = { "index.js": 100 * 1024, "Steward.js": 4 * 1024, "smallui.js": 77 * 1024, "Propose.js": 20 * 1024 };
const judge = (chunks: RouteChunkFacts[], o: { known?: string[]; maxGzipKB?: number } = {}) =>
  judgeRoute({
    route: "/steward",
    chunks,
    page: pageChunk(chunks, "/repo/client/src/pages/Steward.tsx") as RouteChunkFacts,
    reach: stewardReach,
    known: new Set(o.known ?? []),
    maxGzipKB: o.maxGzipKB ?? 200,
    gzipOf: (f) => gz[f] ?? 0,
    name: (id) => shortId(id, ROOT),
  });

describe("the key route first view guard", () => {
  it("finds the page chunk by its module, with either slash", () => {
    expect(pageChunk(routeGraph, "/repo/client/src/pages/Steward.tsx")?.fileName).toBe("Steward.js");
    expect(pageChunk(routeGraph, "\\repo\\client\\src\\pages\\Steward.tsx")?.fileName).toBe("Steward.js");
    expect(pageChunk(routeGraph, "/repo/client/src/pages/Missing.tsx")).toBeUndefined();
  });

  it("counts the boot chunks, the page and its static imports, and never another page", () => {
    const page = pageChunk(routeGraph, "/repo/client/src/pages/Steward.tsx") as RouteChunkFacts;
    expect(routeFirstView(routeGraph, page).map((c) => c.fileName).sort()).toEqual(["Steward.js", "index.js", "smallui.js"]);
  });

  it("names the other pages' modules a merged chunk carried onto the route", () => {
    const v = judge(routeGraph);
    expect(v.intruders).toEqual([{ chunk: "smallui.js", modules: ["/repo/client/src/components/MicButton.tsx", "/repo/client/src/components/voice/useVoiceRecorder.ts"] }]);
    const text = routeVerdictMessage(v, ROOT) as string;
    expect(text).toContain("client/src/components/MicButton.tsx");
    expect(text).toContain("Raising a budget");
  });

  it("control: the same route with the voice modules in their own chunk passes", () => {
    const fixed = routeGraph.map((c) => (c.fileName === "smallui.js" ? { ...c, moduleIds: ["/repo/client/src/components/NextAct.tsx"] } : c));
    const v = judge(fixed);
    expect(v.intruders).toEqual([]);
    expect(routeVerdictMessage(v, ROOT)).toBeNull();
  });

  it("fails on size alone, and the gzipped total is every chunk in the view", () => {
    const v = judge(routeGraph, { known: ["client/src/components/MicButton.tsx", "client/src/components/voice/useVoiceRecorder.ts"], maxGzipKB: 150 });
    expect(v.intruders).toEqual([]);
    expect(v.gzipBytes).toBe(181 * 1024);
    expect(routeVerdictMessage(v, ROOT)).toContain("over its budget of 150 KB");
  });

  it("lets the known list through and still reports it, so a stale entry can be found", () => {
    const v = judge(routeGraph, { known: ["client/src/components/MicButton.tsx"] });
    expect(v.intruders.flatMap((f) => f.modules)).toEqual(["/repo/client/src/components/voice/useVoiceRecorder.ts"]);
    expect(v.allForeign).toEqual(["client/src/components/MicButton.tsx", "client/src/components/voice/useVoiceRecorder.ts"]);
  });
});
