/**
 * A SHARED WORD TABLE IN THE READER'S LANGUAGE (lane ES-A, 26 Nov 2026: "the whole site in Spanish").
 *
 * Many fixed strings live in `shared/` as plain English tables (`SHEET_WORDS`, `TASK_COPY`, ...), because the
 * server prints some of them too and the server is English-only. Lingui never reads `shared/`, so those words
 * never reached a catalog. The fix has the shape #1714 gave the site menu: the client keeps a MIRROR of each
 * table, every entry a `msg()` descriptor (or a function returning one), and draws it through `i18n._` at the
 * moment it is drawn. The shared English table stays exactly as it was for the server.
 *
 * `WordMirror<T>` is typed off the shared table, so a key added there and not here fails the compiler, and
 * `expectMirrorMatches` (client/src/i18n/wordTableTesting.ts) fails a test when the mirror's English drifts
 * from the shared English or an entry is drawn without going through the catalog.
 *
 * A mirror file holds `msg()` calls, so it carries a VALUE import of `@lingui/core` as well: precompileEnglish
 * compiles the messages of a file that imports the runtime and skips one that only uses `msg`
 * (client/src/components/roleCard/payBandWords.ts says the same).
 */
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { useMemo } from "react";
import { useLingui } from "@/i18n/runtime";
import type { Widened } from "@shared/wordTableTypes";

/** The drawn table's type: every literal string widened to `string`, functions keep their arguments. */
export type Drawn<T> = Widened<T>;

/**
 * What a function entry returns in the mirror: one descriptor, or for a sentence built from parts, a list drawn
 * part by part and joined: a descriptor is translated, a plain string (a name, a list the village wrote) is kept
 * as it is, and a null or false part is left out. A function the shared table lets return null may return null.
 */
export type MirrorLine = MessageDescriptor | readonly (MessageDescriptor | string | null | false)[];

/**
 * The mirror of a shared table: a descriptor for each string, a function returning one for each function, and
 * each other value (a null, a boolean, a number) exactly as the shared table has it.
 */
export type WordMirror<T> = {
  [K in keyof T]: T[K] extends string
    ? MessageDescriptor
    : T[K] extends (...args: infer A) => infer R
      ? (...args: A) => R extends string ? MirrorLine : MirrorLine | Extract<R, null>
      : T[K] extends readonly unknown[]
        ? T[K]
        : T[K] extends object
          ? WordMirror<T[K]>
          : T[K];
};

function isDescriptor(v: unknown): v is MessageDescriptor {
  return typeof v === "object" && v !== null && typeof (v as MessageDescriptor).id === "string";
}

/** One function entry's result in `i18n`'s language: a list of parts is drawn part by part and joined. */
function drawLine(line: MirrorLine | null | undefined, i18n: I18n): string | null | undefined {
  if (line === null || line === undefined) return line;
  if (Array.isArray(line)) return line.map((d) => (typeof d === "string" ? d : d ? i18n._(d) : "")).join("");
  return i18n._(line as MessageDescriptor);
}

/** The table in `i18n`'s language. A function entry translates whatever it returns, and passes a null through. */
export function drawWords<T>(mirror: WordMirror<T>, i18n: I18n = appI18n): Drawn<T> {
  const draw = (node: unknown): unknown => {
    if (isDescriptor(node)) return i18n._(node);
    if (typeof node === "function") return (...args: unknown[]) => drawLine((node as (...a: unknown[]) => MirrorLine)(...args), i18n);
    if (node === null || typeof node !== "object" || Array.isArray(node)) return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = draw(v);
    return out;
  };
  return draw(mirror) as Drawn<T>;
}

/** The table in the reader's language, drawn again when the language changes. */
export function useWords<T>(mirror: WordMirror<T>): Drawn<T> {
  const { i18n } = useLingui();
  const locale = i18n.locale;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the locale is what changes the words
  return useMemo(() => drawWords(mirror, i18n), [mirror, i18n, locale]);
}
