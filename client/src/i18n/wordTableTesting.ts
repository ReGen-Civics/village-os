/**
 * The test every shared word table's mirror passes (client/src/i18n/wordTable.ts). Imported by tests only.
 *
 * 1. In English, the mirror draws EXACTLY the shared table's English, for every string and, through the
 *    sample arguments, every function. So the server and the client never say two different things.
 * 2. With a catalog that holds every one of the mirror's ids, every entry draws the catalog's word. So no
 *    entry ships drawn in English only, and a new key in the shared table that has no `msg()` fails the
 *    compiler first and this second.
 * 3. Every function entry has samples, so a new function cannot slip past the first two.
 */
import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { expect } from "vitest";
import { drawWords, type MirrorLine, type WordMirror } from "./wordTable";

/** Every id a function entry's result carries: one descriptor, or each part of a list. */
function idsOf(line: MirrorLine | null): string[] {
  if (!line) return [];
  return Array.isArray(line) ? line.flatMap((d) => (d && typeof d !== "string" ? [d.id] : [])) : [(line as MessageDescriptor).id];
}

/** For each function entry, by its dotted path, the argument lists to try it with. */
export type Samples = Record<string, readonly (readonly unknown[])[]>;

type Leaf = { path: string; english: unknown; mirror: unknown };

function leaves(english: unknown, mirror: unknown, path = ""): Leaf[] {
  if (english === null || typeof english !== "object" || Array.isArray(english)) return [{ path, english, mirror }];
  const out: Leaf[] = [];
  for (const k of Object.keys(english as object)) {
    out.push(...leaves((english as Record<string, unknown>)[k], (mirror as Record<string, unknown> | undefined)?.[k], path ? `${path}.${k}` : k));
  }
  return out;
}

function pick(node: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((n, k) => (n as Record<string, unknown>)?.[k], node);
}

export function expectMirrorMatches<T>(english: T, mirror: WordMirror<T>, samples: Samples = {}): void {
  const all = leaves(english, mirror);
  const ids = new Set<string>();
  const noSamples: string[] = [];
  for (const l of all) {
    if (typeof l.english === "string") {
      expect(typeof l.mirror === "object" && l.mirror !== null, `${l.path} has a msg() descriptor`).toBe(true);
      ids.add((l.mirror as MessageDescriptor).id);
      continue;
    }
    if (typeof l.english !== "function") {
      expect(l.mirror, `${l.path} is the shared table's own value`).toEqual(l.english);
      continue;
    }
    expect(typeof l.mirror, `${l.path} is a function in the mirror too`).toBe("function");
    const runs = samples[l.path];
    if (!runs?.length) {
      noSamples.push(l.path);
      continue;
    }
    for (const args of runs) {
      for (const id of idsOf((l.mirror as (...a: unknown[]) => MirrorLine | null)(...args))) ids.add(id);
    }
  }
  expect(noSamples, "give these function entries sample arguments").toEqual([]);

  const en = drawWords(mirror, setupI18n({ locale: "en", messages: { en: {} } }));
  const marked = drawWords(mirror, setupI18n({ locale: "xx", messages: { xx: Object.fromEntries(Array.from(ids).map((id) => [id, "XX"])) } }));
  for (const l of all) {
    if (typeof l.english === "string") {
      expect(pick(en, l.path), `${l.path} in English`).toBe(l.english);
      expect(pick(marked, l.path), `${l.path} goes through the catalog`).toBe("XX");
      continue;
    }
    if (typeof l.english !== "function") continue;
    for (const args of samples[l.path]) {
      const want = (l.english as (...a: unknown[]) => unknown)(...args);
      expect((pick(en, l.path) as (...a: unknown[]) => unknown)(...args), `${l.path}(${JSON.stringify(args)}) in English`).toBe(want);
      if (want !== null && want !== undefined) {
        expect((pick(marked, l.path) as (...a: unknown[]) => unknown)(...args), `${l.path}(${JSON.stringify(args)}) goes through the catalog`).toContain("XX");
      }
    }
  }
}
