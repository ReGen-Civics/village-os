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
 *
 * THE ENGLISH SHIPS ONCE (dist budget, 26 Nov 2026). Where the client already ships a table's English for its own
 * use (the role sheet's builders take ROLE_SHEET_WORDS as their default), the mirror's `message` is a second copy.
 * Such a mirror is declared through `mirrorOf(() => SHARED, {...})`, and a production build drops each `message`
 * inside that call (stripMirrorMessages in precompileEnglish.ts). A descriptor left with only its id draws from
 * the catalog when the catalog has that id, and otherwise from the shared entry at the same path: a function entry
 * falls back whole, so a line is never half one language and half another. The English is a thunk so a mirror
 * never evaluates its shared table while a module cycle is still loading.
 *
 * Only there. A table the client otherwise never uses as a value (most of them: the server's English) is shaken
 * out of the bundle, so its mirror's `message` is the ONLY copy and stripping it would just bring the table back:
 * measured on 26 Nov 2026, converting the task, decide and onboarding mirrors too cost 3 KB more than it saved.
 * Such a mirror stays a plain `WordMirror` constant and keeps its English.
 *
 * A map keyed by its own English (`englishKeyed({ "Roles": msg({ message: "Roles" }) })`, the shape #1714 gave the
 * site menu) always ships the English in its keys, so the build drops its messages too, and `drawKeyed` falls
 * back to the key.
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

/** Each mirror's shared English, by mirror, for the fallback (see THE ENGLISH SHIPS ONCE above). */
const ENGLISH = new WeakMap<object, () => unknown>();

/**
 * Declare a mirror of the shared table `english` returns. The mirror is returned as it is; the table is
 * remembered so `drawWords` can fall back to it entry by entry.
 */
export function mirrorOf<T>(english: () => T, mirror: WordMirror<T>): WordMirror<T> {
  ENGLISH.set(mirror as object, english);
  return mirror;
}

/** The shared English a mirror was declared with, or undefined for one declared without `mirrorOf`. For tests. */
export function englishOf(mirror: object): unknown {
  return ENGLISH.get(mirror)?.();
}

/**
 * Declare a map from each English string to its descriptor. The keys are the English, so a production build drops
 * each `message` inside this call; draw an entry with `drawKeyed`.
 */
export function englishKeyed<K extends string>(map: Record<K, MessageDescriptor>): Readonly<Record<K, MessageDescriptor>> {
  return map;
}

/**
 * `english` in `i18n`'s language through a map declared with `englishKeyed`: the catalog's word when the catalog
 * has it, else the English itself, which is also what a string missing from the map draws as.
 */
export function drawKeyed(map: Readonly<Record<string, MessageDescriptor>>, english: string, i18n: I18n = appI18n): string {
  const d = Object.prototype.hasOwnProperty.call(map, english) ? map[english] : undefined;
  return d && drawable(d, i18n) ? i18n._(d) : english;
}

/** Whether `i18n` can draw this descriptor: it still carries its English, or the catalog has its id. */
function drawable(d: MessageDescriptor, i18n: I18n): boolean {
  return d.message !== undefined || Object.prototype.hasOwnProperty.call(i18n.messages, d.id);
}

/** Whether every descriptor in a function entry's line is drawable. */
function lineDrawable(line: MirrorLine | null | undefined, i18n: I18n): boolean {
  if (line === null || line === undefined) return true;
  if (Array.isArray(line)) return line.every((d) => !isDescriptor(d) || drawable(d, i18n));
  return drawable(line as MessageDescriptor, i18n);
}

/** One function entry's result in `i18n`'s language: a list of parts is drawn part by part and joined. */
function drawLine(line: MirrorLine | null | undefined, i18n: I18n): string | null | undefined {
  if (line === null || line === undefined) return line;
  if (Array.isArray(line)) return line.map((d) => (typeof d === "string" ? d : d ? i18n._(d) : "")).join("");
  return i18n._(line as MessageDescriptor);
}

/** The value at the same key in the shared English, or undefined where there is none. */
function englishAt(english: unknown, key: string): unknown {
  return english !== null && typeof english === "object" ? (english as Record<string, unknown>)[key] : undefined;
}

/**
 * The table in `i18n`'s language. A function entry translates whatever it returns, and passes a null through.
 * Where the catalog lacks an id whose English the build dropped, the shared English entry is drawn instead.
 */
export function drawWords<T>(mirror: WordMirror<T>, i18n: I18n = appI18n): Drawn<T> {
  const draw = (node: unknown, english: unknown): unknown => {
    if (isDescriptor(node)) return drawable(node, i18n) || typeof english !== "string" ? i18n._(node) : english;
    if (typeof node === "function") {
      return (...args: unknown[]) => {
        const line = (node as (...a: unknown[]) => MirrorLine)(...args);
        if (lineDrawable(line, i18n) || typeof english !== "function") return drawLine(line, i18n);
        return (english as (...a: unknown[]) => unknown)(...args);
      };
    }
    if (node === null || typeof node !== "object" || Array.isArray(node)) return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = draw(v, englishAt(english, k));
    return out;
  };
  return draw(mirror, ENGLISH.get(mirror as object)?.()) as Drawn<T>;
}

/** The table in the reader's language, drawn again when the language changes. */
export function useWords<T>(mirror: WordMirror<T>): Drawn<T> {
  const { i18n } = useLingui();
  const locale = i18n.locale;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the locale is what changes the words
  return useMemo(() => drawWords(mirror, i18n), [mirror, i18n, locale]);
}
