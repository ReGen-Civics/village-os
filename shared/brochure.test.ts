/**
 * The two brochure switches as data: the master switch for every story page,
 * and one per page (shared/brochure.ts). The server and the client both ask
 * these functions, so this is where the rule itself is pinned.
 */
import { describe, expect, it } from "vitest";
import {
  BROCHURE_PATHS,
  SWITCHABLE_PAGES,
  applyBrochurePatch,
  brochureHidden,
  brochureOpen,
  brochurePatchProblem,
  brochurePathServed,
  brochureState,
  isBrochurePath,
} from "./brochure";
import { EDITED_PAGE_PATHS } from "./pageContent";

describe("which pages carry a switch of their own", () => {
  it("is every story page the Pages editor edits, and nothing else", () => {
    // The investor page counts: its spec is the server's (KEPT_PAGES), and the editor still edits it.
    const edited = EDITED_PAGE_PATHS.filter((p) => (BROCHURE_PATHS as readonly string[]).includes(p));
    expect([...SWITCHABLE_PAGES].sort()).toEqual([...new Set(edited)].sort());
  });
});

describe("the stored document", () => {
  it("reads an old document, with no list, as every page on", () => {
    expect(brochureState({ enabled: true })).toEqual({ enabled: true, hidden: [] });
    expect(brochureState(null)).toEqual({ enabled: false, hidden: [] });
  });

  it("keeps only real pages with a switch, once each, in menu order", () => {
    expect(brochureHidden({ hidden: ["/team", "/nowhere", 7, "/housing", "/team", "/project-history"] })).toEqual(["/housing", "/team"]);
    expect(brochureHidden({ hidden: "/housing" })).toEqual([]);
  });
});

describe("whether a page is served", () => {
  const on = { enabled: true, hidden: ["/housing"] };

  it("serves a story page while both switches are on", () => {
    expect(brochurePathServed(on, "/visit")).toBe(true);
    expect(brochurePathServed(on, "/housing")).toBe(false);
    expect(brochurePathServed(on, "/housing/")).toBe(false);
    expect(brochurePathServed(on, "/housing?from=menu")).toBe(false);
  });

  it("cannot be walked round by spelling the address in capitals, which the router still opens", () => {
    expect(brochurePathServed(on, "/HOUSING")).toBe(false);
    expect(brochurePathServed(on, "/Housing/")).toBe(false);
    expect(brochurePathServed({ enabled: false, hidden: [] }, "/Visit")).toBe(false);
  });

  it("serves no story page while the master switch is off, whatever the list says", () => {
    expect(brochurePathServed({ enabled: false, hidden: [] }, "/visit")).toBe(false);
  });

  it("always serves an address outside the story pages", () => {
    for (const p of ["/", "/quests", "/housing-guide", "/reserve"]) expect(brochurePathServed({ enabled: false, hidden: ["/housing"] }, p)).toBe(true);
  });
});

describe("a change to the switches", () => {
  it("accepts either switch, or both", () => {
    expect(brochurePatchProblem({ enabled: true })).toBeNull();
    expect(brochurePatchProblem({ pages: { "/housing": false } })).toBeNull();
    expect(brochurePatchProblem({ enabled: false, pages: { "/housing": true, "/team": false } })).toBeNull();
  });

  it("refuses a body it cannot read, with a sentence", () => {
    for (const body of [null, [], {}, { enabled: 1 }, { pages: [] }, { pages: { "/quests": false } }, { pages: { "/housing": 0 } }, { hide: ["/housing"] }]) {
      expect(typeof brochurePatchProblem(body), JSON.stringify(body)).toBe("string");
    }
  });

  it("changes only what it names", () => {
    const before = { enabled: true, hidden: ["/housing", "/team"] };
    expect(applyBrochurePatch(before, { pages: { "/team": true } })).toEqual({ enabled: true, hidden: ["/housing"] });
    expect(applyBrochurePatch(before, { enabled: false })).toEqual({ enabled: false, hidden: ["/housing", "/team"] });
    expect(applyBrochurePatch(before, { pages: { "/visit": false } })).toEqual({ enabled: true, hidden: ["/visit", "/housing", "/team"] });
  });
});

describe("a member door opened to visitors (gap G15)", () => {
  it("is read from the stored document, member doors only", () => {
    expect(brochureOpen({ open: ["/love-letter", "/housing", 3] })).toEqual(["/love-letter"]);
    expect(brochureOpen({})).toEqual([]);
    // No door opened: no `open` at all, so the stored and served shapes are as before.
    expect(brochureState({ enabled: false })).toEqual({ enabled: false, hidden: [] });
  });

  it("serves the letter with the master switch off, and nothing else", () => {
    const state = { enabled: false, hidden: [], open: ["/love-letter"] };
    expect(brochurePathServed(state, "/love-letter")).toBe(true);
    expect(brochurePathServed(state, "/housing")).toBe(false);
    expect(brochurePathServed({ ...state, hidden: ["/love-letter"] }, "/love-letter")).toBe(false);
    expect(brochurePathServed({ enabled: false, hidden: [] }, "/love-letter")).toBe(false);
  });

  it("is switched through the same route, and refuses a page that is not a member door", () => {
    expect(brochurePatchProblem({ open: { "/love-letter": true } })).toBeNull();
    expect(brochurePatchProblem({ open: { "/housing": true } })).toMatch(/cannot be opened to visitors/);
    expect(applyBrochurePatch({ enabled: false }, { open: { "/love-letter": true } }).open).toEqual(["/love-letter"]);
    expect(applyBrochurePatch({ enabled: false, open: ["/love-letter"] }, { open: { "/love-letter": false } })).toEqual({ enabled: false, hidden: [] });
  });
});


describe("a story page that became a chapter of /rights (the rights fold, 27 Nov 2026)", () => {
  it("follows its old page's switch under its anchor, in any case and with a query", () => {
    const state = { enabled: true, hidden: ["/good-neighbor"] };
    expect(brochurePathServed(state, "/rights#good-neighbor")).toBe(false);
    expect(brochurePathServed(state, "/Rights?x=1#Good-Neighbor")).toBe(false);
    expect(brochurePathServed(state, "/rights#resident-rights")).toBe(true);
    expect(brochurePathServed({ enabled: false, hidden: [] }, "/rights#steward-rights")).toBe(false);
  });

  it("leaves /rights itself, and Leaving Well, always served", () => {
    const off = { enabled: false, hidden: [] };
    expect(isBrochurePath("/rights")).toBe(false);
    expect(brochurePathServed(off, "/rights")).toBe(true);
    expect(brochurePathServed(off, "/rights#leaving-well")).toBe(true);
    expect(brochurePathServed(off, "/rights?focus=begin-departure#leaving-well")).toBe(true);
  });
});
