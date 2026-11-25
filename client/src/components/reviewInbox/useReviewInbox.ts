/**
 * THE ONE READ OF EVERYTHING WAITING ON A PERSON (`GET /api/admin/review/inbox`), for any page that shows it.
 *
 * /admin/review draws the whole list from it, and a page that shows only what needs a person now (the admin's "Needs
 * you now") reads the same hook for its counts, so there is one list and one read, never a second one built beside it.
 * Each section is that queue's own read made as this person (server/routes/reviewInbox.ts), so nothing here can show
 * more than the queue's own page.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { authToken } from "@/lib/gameApi";
import type { InboxItem, SectionState } from "@shared/reviewInbox";
import { INBOX_ORDER, type InboxSource } from "@shared/reviewInboxSources";

export interface InboxAnswer {
  sections: { source: InboxSource; state: SectionState; count: number }[];
  items: InboxItem[];
}

export type InboxLoad = { phase: "loading" } | { phase: "failed" } | { phase: "ready"; answer: InboxAnswer };

export function inboxHeaders(): Record<string, string> {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Read the inbox while `enabled` (signed in), and again on `read()`. */
export function useReviewInbox(enabled: boolean) {
  const [load, setLoad] = useState<InboxLoad>({ phase: "loading" });
  const read = useCallback(async () => {
    setLoad({ phase: "loading" });
    try {
      const r = await fetch("/api/admin/review/inbox", { headers: inboxHeaders() });
      if (!r.ok) return setLoad({ phase: "failed" });
      setLoad({ phase: "ready", answer: (await r.json()) as InboxAnswer });
    } catch {
      setLoad({ phase: "failed" });
    }
  }, []);
  useEffect(() => {
    if (enabled) void read();
  }, [enabled, read]);

  const answer = load.phase === "ready" ? load.answer : null;
  /** The items by kind, in the order the page draws them, each kind with its count. Kinds with nothing are left out. */
  const groups = useMemo(() => {
    const by = new Map<InboxSource, InboxItem[]>();
    for (const item of answer?.items ?? []) by.set(item.source, [...(by.get(item.source) ?? []), item]);
    return INBOX_ORDER.filter((s) => by.get(s)?.length).map((source) => ({ source, items: by.get(source)!, count: by.get(source)!.length }));
  }, [answer]);

  return { load, answer, groups, read };
}
