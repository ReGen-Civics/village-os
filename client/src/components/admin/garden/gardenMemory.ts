/**
 * WHAT THE GARDEN REMEMBERS FOR A PERSON, in their own browser and nowhere
 * else: which lens they left open, and their own names for the places. Nothing
 * here is ever sent to the server.
 *
 * Every read and write goes through lib/safeStorage, the one place the client
 * talks to Web Storage, so a browser with site data blocked never takes the
 * page down. When the browser refuses, the choice still holds for as long as
 * the page is open: it is kept in memory here, and every reader is told.
 *
 * A module-level store read with useSyncExternalStore, because the toggle and
 * the page it switches are siblings, never ancestor and child.
 */
import { removeStored, storedText, writeStored } from "@/lib/safeStorage";

const memory = new Map<string, string | null>();
const listeners = new Set<() => void>();

/** What is kept under a key: the page's own copy first, then the browser's. */
export function recall(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  const stored = storedText("local", key);
  memory.set(key, stored);
  return stored;
}

/** Keep a value (or forget it, with null), and tell every reader. */
export function remember(key: string, value: string | null): void {
  memory.set(key, value);
  if (value === null) removeStored("local", key);
  else writeStored("local", key, value);
  for (const l of Array.from(listeners)) l();
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** A person's own key: two people who share a browser each keep their own. */
export function personalKey(base: string, personKey?: string): string {
  return personKey ? `${base}:${personKey}` : base;
}

/** For tests: drop the page's copy, so the next read asks the browser again. */
export function forgetPageCopy(): void {
  memory.clear();
}
