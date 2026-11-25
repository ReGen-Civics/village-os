import { describe, expect, it } from "vitest";
import { digest, runEngine, valueDigestOf, type EngineContext, type Staged } from "./engine";
import { aimOf, aimsMeet, keysMeet, keysOfAim, mixedScript, needsOf, skeleton } from "./keys";

const ctx = (over: Partial<EngineContext> = {}): EngineContext => ({
  now: "2026-11-21T12:00:00.000Z",
  rediscardDays: 30,
  caps: { perFilerPerDay: 50, optionsPerThing: 5 },
  alreadyLive: new Set(),
  targetGone: new Set(),
  liveRefs: new Set(["role:water"]),
  discarded: [],
  openVotes: [],
  decisions: [],
  released: new Set(),
  ...over,
});

const staged = (id: string, purpose: string, over: Partial<Staged> = {}): Staged => ({
  id,
  stream: "sera",
  filer: "p-sera",
  kind: "role_card",
  target: { roleId: "water" },
  body: { words: { purpose } },
  receivedAt: `2026-11-20T10:0${id.slice(-1)}:00.000Z`,
  ...over,
});

describe("skeleton", () => {
  it("folds Cyrillic and Greek lookalikes, full-width letters and invisible characters onto the Latin name", () => {
    expect(skeleton("Seed swap")).toBe("seed swap");
    expect(skeleton("Ѕееԁ ѕԝар")).toBe("seed swap");
    expect(skeleton("Ｓｅｅｄ swap")).toBe("seed swap");
    expect(skeleton("Seed​ sw­ap")).toBe("seed swap");
    expect(skeleton("  Seed   swap ")).toBe("seed swap");
  });

  it("keeps letters that are genuinely different", () => {
    expect(skeleton("Señora")).not.toBe(skeleton("Senora"));
  });
});

describe("mixedScript", () => {
  it("catches a Latin word with one Cyrillic letter, and lets a whole word in one script through", () => {
    expect(mixedScript("Wаter Steward")).toBe(true);
    expect(mixedScript("Water Steward")).toBe(false);
    expect(mixedScript("Вода Steward")).toBe(false);
  });
});

describe("aims and keys", () => {
  it("reads a role card change field by field, as the review page's conflict flags do", () => {
    const purpose = aimOf("role_card", { roleId: "water" }, { words: { purpose: "a" } });
    const name = aimOf("role_card", { roleId: "water" }, { words: { name: "b" } });
    const purpose2 = aimOf("role_card", { roleId: "water" }, { words: { purpose: "c" } });
    expect(aimsMeet(purpose, name)).toBe(false);
    expect(aimsMeet(purpose, purpose2)).toBe(true);
  });

  it("gives a creation a key from its name, so two different new things never collide", () => {
    const a = aimOf("setting", { method: "POST", path: "/api/admin/org/roles" }, { name: "Water Steward" });
    const b = aimOf("setting", { method: "POST", path: "/api/admin/org/roles" }, { name: "Fire Keeper" });
    const c = aimOf("setting", { method: "POST", path: "/api/admin/org/roles" }, { name: "water  steward" });
    expect(aimsMeet(a, b)).toBe(false);
    expect(aimsMeet(a, c)).toBe(true);
  });

  it("compares records kept as strings by the same rule, across every document they name", () => {
    const k = keysOfAim(aimOf("role_card", { roleId: "water" }, { words: { purpose: "a" } }));
    const doc = k[0].slice(0, k[0].lastIndexOf("#"));
    expect(keysMeet(k, [`${doc}#*`])).toBe(true);
    expect(keysMeet(k, ["/elsewhere#*", `${doc}#words.purpose`])).toBe(true);
    expect(keysMeet(k, [`${doc}#words.name`])).toBe(false);
  });

  it("knows what a change needs to exist first", () => {
    expect(needsOf("role_card", { roleId: "water" }, {})).toEqual(["role:water"]);
    expect(needsOf("role_listing", {}, { ids: ["a", "b"] })).toEqual(["role:a", "role:b"]);
    expect(needsOf("faq_add", { pathway: "x" }, {})).toEqual([]);
  });
});

describe("runEngine", () => {
  it("treats spacing and Unicode form as the same value, and a lookalike letter as a different one", () => {
    expect(valueDigestOf(staged("s1", "Tends the springs."))).toBe(valueDigestOf(staged("s2", " Tends  the springs.")));
    expect(valueDigestOf(staged("s1", "Tends the springs."))).not.toBe(valueDigestOf(staged("s2", "Tends the sprіngs.")));
  });

  it("a lookalike value becomes its own option and never borrows the real one's credit", () => {
    const out = runEngine([staged("s1", "Tends the springs."), staged("s2", "Tends the sprіngs.", { stream: "agent", filer: "p-x" })], ctx());
    expect(out.cards).toHaveLength(1);
    expect(out.cards[0].shape).toBe("choose");
    expect(out.cards[0].options.map((o) => o.credits.map((c) => c.stagedId))).toEqual([["s1"], ["s2"]]);
  });

  it("keeps a card's id when a new option joins it, and moves its version", () => {
    const one = runEngine([staged("s1", "A.")], ctx());
    const two = runEngine([staged("s1", "A."), staged("s2", "B.", { stream: "agent", filer: "p-x" })], ctx());
    expect(two.cards[0].id).toBe(one.cards[0].id);
    expect(two.cards[0].version).not.toBe(one.cards[0].version);
  });

  it("moves a card's version when what is live under it moves, so an accept against an old view is refused", () => {
    const before = runEngine([staged("s1", "A.")], ctx({ liveDigest: { s1: digest("old") } }));
    const after = runEngine([staged("s1", "A.")], ctx({ liveDigest: { s1: digest("new") } }));
    expect(after.cards[0].version).not.toBe(before.cards[0].version);
  });

  it("gives the same answer for the same input, whatever order it was staged in", () => {
    const list = [staged("s1", "A."), staged("s2", "B.", { stream: "agent", filer: "p-x" }), staged("s3", "A.", { stream: "connector", filer: "p-y" })];
    expect(runEngine([...list].reverse(), ctx())).toEqual(runEngine(list, ctx()));
  });

  it("uses the server's received time for a decision, never anything the filer sent", () => {
    const keys = keysOfAim(aimOf("role_card", { roleId: "water" }, { words: { purpose: "x" } }));
    const s = staged("s1", "A.", { body: { words: { purpose: "A." }, occurredAt: "2099-01-01T00:00:00.000Z" } });
    const out = runEngine([s], ctx({ decisions: [{ keys, at: "2026-11-21T00:00:00.000Z", code: "B-1.1" }] }));
    expect(out.held.map((h) => h.code)).toEqual(["decided_since"]);
  });
});
