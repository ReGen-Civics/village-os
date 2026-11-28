/**
 * WHAT THE GUIDE'S DOCK REMEMBERS, and how carefully.
 *
 * Two kinds of thing, kept apart on purpose:
 *
 *   PREFERENCES, in this browser's local storage: whether the dock is docked
 *   or expanded, and whether this village's dock was on the last time it was
 *   asked (so the next open draws the right surface at once). Harmless to the
 *   next person on the same browser, like the picked answerer.
 *
 *   A PERSON'S WORDS, the draft and the "You said" line: kept through
 *   `useChatDraft` (components/chat/chatDraft.ts), in this tab's session
 *   storage under its `chat-draft:` prefix, AND under a tag of the person's
 *   own session. A second person signing in on the same tab has another tag,
 *   so they never read the first person's words back, whichever sign-out the
 *   first one used.
 *
 * Every read and write goes through lib/safeStorage, which never throws: a
 * private window or blocked site data leaves the dock on its defaults.
 */
import { storedText, writeStored } from "@/lib/safeStorage";

export type DockShape = "docked" | "expanded";

const SHAPE_KEY = "guide-dock:shape";
const ON_KEY = "guide-dock:on";

/** The shape this person last chose, or `fallback` when they never chose. */
export function readDockShape(fallback: DockShape): DockShape {
  const v = storedText("local", SHAPE_KEY);
  return v === "docked" || v === "expanded" ? v : fallback;
}

export function rememberDockShape(shape: DockShape): void {
  writeStored("local", SHAPE_KEY, shape);
}

/** Whether this village's dock was on the last time this browser heard. A hint only: the server's answer decides. */
export function readDockHint(): boolean {
  return storedText("local", ON_KEY) === "1";
}

export function rememberDockHint(on: boolean): void {
  writeStored("local", ON_KEY, on ? "1" : "0");
}

/**
 * A short tag for one signed-in session, made from its token and saying
 * nothing about it (a 32-bit FNV-1a digest, in base 36). It only has to differ
 * between two people on one browser.
 */
export function personTag(token: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** The draft's key for one person and one of the dock's conversations. */
export const dockDraftKey = (token: string, mode: string): string => `guide-dock:${personTag(token)}:${mode}`;

/** The key for what was heard by voice in that same draft. */
export const dockSaidKey = (token: string, mode: string): string => `${dockDraftKey(token, mode)}:said`;
