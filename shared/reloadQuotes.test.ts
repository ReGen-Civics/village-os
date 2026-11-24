import { describe, expect, it } from "vitest";
import { pickReloadQuote, RELOAD_QUOTES } from "./reloadQuotes";

describe("the refresh screen's quotes", () => {
  it("holds between twenty and thirty, each with words, an author, a source and Spanish", () => {
    expect(RELOAD_QUOTES.length).toBeGreaterThanOrEqual(20);
    expect(RELOAD_QUOTES.length).toBeLessThanOrEqual(30);
    for (const q of RELOAD_QUOTES) {
      for (const field of [q.text, q.by, q.source, q.es]) expect(field.trim().length).toBeGreaterThan(0);
    }
  });

  it("names a dated edition for every quote, so each one can be checked", () => {
    for (const q of RELOAD_QUOTES) expect(q.source).toMatch(/\(1[89]\d\d\)/);
  });

  it("carries no dash the house voice forbids", () => {
    for (const q of RELOAD_QUOTES) expect(`${q.text}${q.es}${q.source}`).not.toMatch(/[–—]/);
  });

  it("never repeats the last quote when there is another to give", () => {
    const zero = () => 0;
    expect(pickReloadQuote(RELOAD_QUOTES, zero, 0)?.index).toBe(1);
    expect(pickReloadQuote(RELOAD_QUOTES, zero, 5)?.index).toBe(0);
    expect(pickReloadQuote(RELOAD_QUOTES, () => 0.9999999, -1)?.index).toBe(RELOAD_QUOTES.length - 1);
  });

  it("returns nothing for an empty list, so a village that clears it gets no quote and no crash", () => {
    expect(pickReloadQuote([], Math.random, -1)).toBeNull();
  });
});

describe("nextReloadQuote", () => {
  it("remembers what it showed in this tab and shows another next time", async () => {
    const { nextReloadQuote, LAST_QUOTE_KEY } = await import("./reloadQuotes");
    const store = new Map<string, string>();
    const g = globalThis as { sessionStorage?: unknown };
    const before = g.sessionStorage;
    g.sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    try {
      const a = nextReloadQuote();
      const b = nextReloadQuote();
      expect(a).not.toBeNull();
      expect(b).not.toBe(a);
      expect(store.has(LAST_QUOTE_KEY)).toBe(true);
    } finally {
      g.sessionStorage = before;
    }
  });
});
