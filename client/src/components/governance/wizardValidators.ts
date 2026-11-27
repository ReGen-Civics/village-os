/**
 * The wizard's shared validators, each answering with a sentence or null.
 *
 * Moved out of wizardConfig.ts, unchanged, when that file reached the monolith
 * ratchet's 1000-line threshold (scripts/check-file-lines.mjs). A proposal type
 * that lives in its own file (roleSeatType.ts) speaks with the same sentences
 * as every type in the config, and neither file imports the other at runtime.
 *
 * IN THE READER'S LANGUAGE (lane ES-A, 26 Nov 2026). The sentences are drawn
 * through the catalog when a check runs, which is at render (problemsFor), so
 * they follow the language the page is in. The field each one names arrives in
 * English from the config ("A title"); FIELD_NAMES says it in the reader's
 * language, and a name it does not know is said as written.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { drawKeyed, englishKeyed } from "@/i18n/wordTable";

/** The fields the checks below name, keyed by the English the config passes. */
export const FIELD_NAMES = englishKeyed({
  "A badge": msg({ message: "A badge", context: "proposal wizard: a field a check names" }),
  "A member": msg({ message: "A member", context: "proposal wizard: a field a check names" }),
  "A power": msg({ message: "A power", context: "proposal wizard: a field a check names" }),
  "A quest": msg({ message: "A quest", context: "proposal wizard: a field a check names" }),
  "A role": msg({ message: "A role", context: "proposal wizard: a field a check names" }),
  "A title": msg({ message: "A title", context: "proposal wizard: a field a check names" }),
  "An agreement": msg({ message: "An agreement", context: "proposal wizard: a field a check names" }),
  "An amount": msg({ message: "An amount", context: "proposal wizard: a field a check names" }),
  "The account": msg({ message: "The account", context: "proposal wizard: a field a check names" }),
  "The case for it": msg({ message: "The case for it", context: "proposal wizard: a field a check names" }),
  "The case": msg({ message: "The case", context: "proposal wizard: a field a check names" }),
  "The reason": msg({ message: "The reason", context: "proposal wizard: a field a check names" }),
  "Your reasoning": msg({ message: "Your reasoning", context: "proposal wizard: a field a check names" }),
  '"Why you"': msg({ message: '"Why you"', context: "proposal wizard: a field a check names" }),
});

/** A field's name in the reader's language. */
const named = (what: string) => drawKeyed(FIELD_NAMES, what, i18n);

export const required = (what: string) => (v: unknown) => {
  if (String(v ?? "").trim()) return null;
  const field = named(what);
  return i18n._(msg({ message: `${field} is the part only you can write. It cannot be blank`, context: "proposal wizard: check" }));
};

export const atLeast = (n: number, what: string) => (v: unknown) => {
  if (String(v ?? "").trim().length >= n) return null;
  const field = named(what);
  return i18n._(msg({ message: `${field} needs at least ${n} characters so the village can weigh it`, context: "proposal wizard: check" }));
};

export const pct = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return i18n._(msg({ message: "That needs to be a number between 0 and 100", context: "proposal wizard: check" }));
  if (n < 0 || n > 100) return i18n._(msg({ message: "A percentage runs from 0 to 100", context: "proposal wizard: check" }));
  return null;
};

export const positive = (what: string) => (v: unknown) => {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return null;
  const field = named(what);
  return i18n._(msg({ message: `${field} has to be more than zero`, context: "proposal wizard: check" }));
};

export const changesPresent = (v: unknown) =>
  Array.isArray(v) && v.length > 0 ? null : i18n._(msg({ message: "Pick at least one dial to change, and say what it becomes", context: "proposal wizard: check" }));
