/**
 * A CHAT DRAFT THAT OUTLIVES THE PANEL (the lead, 27 Nov 2026): close a
 * companion's chat halfway through a long message, open it again, and the
 * words are still in the box. One draft per conversation, kept in this tab's
 * session storage (./draftStore.ts) and dropped the moment it is sent or emptied.
 *
 * WHOSE DRAFT. Every draft is kept under the signed-in member's id, and a
 * visitor's is kept nowhere, so the next person on the same tab never reads
 * it (QA round 1 on #1885). Sign-out clears them all (AuthContext.logout).
 */
import { useCallback, useState } from "react";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { readDraft, writeDraft } from "./draftStore";

export { readDraft, writeDraft } from "./draftStore";

type SetDraft = (next: string | ((was: string) => string)) => void;

/** The storage key for one member's conversation, or null for a visitor, whose draft is never stored. */
export function draftKeyFor(userId: string | null | undefined, conversation: string): string | null {
  return userId ? `${userId}:${conversation}` : null;
}

/** The draft for one conversation, read once and written on every change. A new member or conversation reads its own. */
export function useChatDraft(conversation: string): [string, SetDraft] {
  const userId = useOptionalAuth()?.user?.id;
  const key = draftKeyFor(userId, conversation);
  const [held, setHeld] = useState(() => ({ key, value: key ? readDraft(key) : "" }));
  let current = held;
  if (held.key !== key) {
    current = { key, value: key ? readDraft(key) : "" };
    setHeld(current);
  }
  const set = useCallback<SetDraft>(
    (next) =>
      setHeld((was) => {
        const value = typeof next === "function" ? next(was.value) : next;
        if (was.key) writeDraft(was.key, value);
        return { key: was.key, value };
      }),
    [],
  );
  return [current.value, set];
}
