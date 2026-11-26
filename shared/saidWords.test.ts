/**
 * The recorder a server-built model reads its words through (saidWords.ts): it changes nothing the table says, and
 * notes beside each sentence where it came from.
 */
import { describe, expect, it } from "vitest";
import { pruneSaid, sayRecorder } from "./saidWords";

const TABLE = {
  hello: "Hello",
  count: (n: number) => `${n} things`,
  maybe: (names: readonly string[]) => (names.length ? `With ${names.join(", ")}` : null),
  nested: { up: "Up", down: "Down" } as Record<string, string>,
};

describe("sayRecorder", () => {
  it("reads exactly like the table", () => {
    const { W } = sayRecorder(TABLE);
    expect([W.hello, W.count(3), W.maybe([]), W.nested.up]).toEqual(["Hello", "3 things", null, "Up"]);
  });

  it("notes each sentence by its English: the key, and the arguments a sentence took", () => {
    const { W, said } = sayRecorder(TABLE);
    void [W.hello, W.count(3), W.maybe(["Ana"]), W.maybe([]), W.nested.down];
    expect(said.words).toEqual({
      Hello: { k: "hello" },
      "3 things": { k: "count", a: [3] },
      "With Ana": { k: "maybe", a: [["Ana"]] },
      Down: { k: "nested.down" },
    });
  });

  it("notes a day it is handed, and returns it unchanged", () => {
    const { day, said } = sayRecorder(TABLE);
    expect(day("1 October 2026", "2026-10-01T10:00:00Z", "UTC", true)).toBe("1 October 2026");
    expect(day(null, "x", "UTC", true)).toBeNull();
    expect(said.days).toEqual({ "1 October 2026": { iso: "2026-10-01T10:00:00Z", tz: "UTC", year: true } });
  });
});

describe("pruneSaid", () => {
  it("keeps only what the model still shows, and the days its kept sentences name", () => {
    const { W, day, said } = sayRecorder({ on: (d: string) => `On ${d}`, gone: "Gone" });
    const d = day("1 October 2026", "2026-10-01", null, true)!;
    const model = { line: W.on(d), hidden: W.gone };
    const pruned = pruneSaid(said, { line: model.line });
    expect(Object.keys(pruned!.words)).toEqual(["On 1 October 2026"]);
    expect(Object.keys(pruned!.days)).toEqual(["1 October 2026"]);
    expect(pruneSaid(undefined, model)).toBeUndefined();
  });
});
