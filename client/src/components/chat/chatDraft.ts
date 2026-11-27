/**
 * A CHAT DRAFT THAT OUTLIVES THE PANEL (the lead, 27 Nov 2026): close a
 * companion's chat halfway through a long message, open it again, and the
 * words are still in the box. One draft per conversation, kept in this tab's
 * session storage and dropped the moment it is sent or emptied.
 *
 * Session storage can be missing or refuse (a private window, blocked site
 * data), so every read and write is wrapped, and the box simply starts empty
 * where it cannot remember.
 */
import { useCallback, useState } from "react";

const PREFIX = "chat-draft:";

export function readDraft(key: string): string {
  try {
    return window.sessionStorage.getItem(PREFIX + key) ?? "";
  } catch {
    return "";
  }
}

export function writeDraft(key: string, value: string): void {
  try {
    if (value) window.sessionStorage.setItem(PREFIX + key, value);
    else window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    // Nowhere to keep it: the draft lives only while the panel is open.
  }
}

type SetDraft = (next: string | ((was: string) => string)) => void;

/** The draft for one conversation (`key`), read once and written on every change. A new key reads its own draft. */
export function useChatDraft(key: string): [string, SetDraft] {
  const [held, setHeld] = useState(() => ({ key, value: readDraft(key) }));
  let current = held;
  if (held.key !== key) {
    current = { key, value: readDraft(key) };
    setHeld(current);
  }
  const set = useCallback<SetDraft>(
    (next) =>
      setHeld((was) => {
        const value = typeof next === "function" ? next(was.value) : next;
        writeDraft(was.key, value);
        return { key: was.key, value };
      }),
    [],
  );
  return [current.value, set];
}
