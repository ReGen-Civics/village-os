/**
 * WHERE CHAT DRAFTS LIVE: this tab's session storage, under `chat-draft:<user id>:<conversation>`.
 *
 * Plain functions with no React and no auth import, so AuthContext's sign-out can clear them all
 * (QA round 1 on #1885, 27 Nov 2026: a journal draft showed to the next person who signed in on
 * the same tab). Session storage can be missing or refuse, so every call is wrapped and simply
 * keeps nothing where it cannot.
 */
export const DRAFT_PREFIX = "chat-draft:";

export function readDraft(key: string): string {
  try {
    return window.sessionStorage.getItem(DRAFT_PREFIX + key) ?? "";
  } catch {
    return "";
  }
}

export function writeDraft(key: string, value: string): void {
  try {
    if (value) window.sessionStorage.setItem(DRAFT_PREFIX + key, value);
    else window.sessionStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    // Nowhere to keep it: the draft lives only while the panel is open.
  }
}

/** Every chat draft in this tab, whoever wrote it. Called on sign-out. */
export function forgetChatDrafts(): void {
  try {
    const store = window.sessionStorage;
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k?.startsWith(DRAFT_PREFIX)) keys.push(k);
    }
    for (const k of keys) store.removeItem(k);
  } catch {
    // Nothing could be kept, so nothing is left to clear.
  }
}
