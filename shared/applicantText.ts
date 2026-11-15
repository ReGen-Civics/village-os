/**
 * WHAT A STRANGER TYPES INTO THE APPLICATION, made safe to keep and to show
 * (hostile-edges QA, 15 Nov 2026). The public form trimmed its fields and
 * nothing else, so on a local 1.3.9 boot all of these were accepted and stored:
 *
 *   - a name of two zero-width spaces, which reads as a blank row on the desk;
 *   - a "Why you" of three invisible characters, past the "Say why you" check;
 *   - a name carrying NUL, BEL and ESC;
 *   - a name opening with a right-to-left override, so the deciders' list and
 *     the emails show the letters in an order the applicant chose.
 *
 * So the fields lose the characters that only hide or disguise text (controls
 * other than tab and newline, the zero-width space, the word joiner and
 * invisible operators, bidi overrides and isolates, the byte-order mark, the
 * tag characters), and a field with nothing visible left is empty, which the
 * form's own "Add your name" and "Say why you" then answer.
 *
 * KEPT ON PURPOSE: the zero-width joiner and non-joiner, which Persian, the
 * Indic scripts and emoji sequences need inside a word, and the left-to-right
 * and right-to-left marks; they count as invisible only when they are all a
 * field holds. Built from code points, so no such character sits in this file,
 * and each pattern is one character class with no anchor, linear on any input.
 *
 * Pure, so the page and the server can share it.
 */

const range = (pairs: ReadonlyArray<readonly [number, number]>): string =>
  pairs.map(([a, b]) => (a === b ? String.fromCodePoint(a) : `${String.fromCodePoint(a)}-${String.fromCodePoint(b)}`)).join("");

/** Removed wherever they are: they carry no letter of anybody's name or answer. */
const HIDDEN = new RegExp(
  `[${range([[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x9f], [0x200b, 0x200b], [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x2069], [0xfeff, 0xfeff], [0xe0000, 0xe007f]])}]`,
  "gu",
);

/** Kept inside text, but nothing a reader can see when they are all there is. */
const INVISIBLE = new RegExp(`[${range([[0x00ad, 0x00ad], [0x034f, 0x034f], [0x180e, 0x180e], [0x200c, 0x200f], [0xfe00, 0xfe0f]])}\\s]`, "gu");

/** True when a reader would see nothing at all. */
export function looksEmpty(s: string): boolean {
  return s.replace(INVISIBLE, "").length === 0;
}

/**
 * A field as kept: hidden characters out, line ends as "\n", trimmed, and cut
 * one past `max` so "too long" can still be told from "at the cap". `oneLine`
 * folds every run of whitespace to one space, for a name. Empty when nothing
 * visible is left. Never throws.
 */
export function applicantText(v: unknown, max: number, oneLine = false): string {
  if (typeof v !== "string") return "";
  let s = v.replace(/\r\n?/g, "\n").replace(HIDDEN, "");
  if (oneLine) s = s.replace(/\s+/g, " ");
  s = s.trim().slice(0, max + 1);
  return looksEmpty(s) ? "" : s;
}
