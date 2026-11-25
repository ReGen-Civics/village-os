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
import { INBOX_ORDER, INBOX_SOURCES, type InboxSource } from "@shared/reviewInboxSources";

export interface InboxAnswer {
  sections: { source: InboxSource; state: SectionState; count: number }[];
  items: InboxItem[];
}

export type InboxLoad = { phase: "loading" } | { phase: "failed" } | { phase: "ready"; answer: InboxAnswer };

/**
 * The kinds a row decides on the list itself, where this person may (the connector's cards, an org chart draft's
 * Publish). Every other kind's row is a door to the page it is decided on.
 */
export const DECIDED_ON_ROW: ReadonlySet<InboxSource> = new Set<InboxSource>(["connector", "structure"]);

/** A kind id from a link (`?kind=structure`), or null when it names no kind. */
export function kindOf(search: string): InboxSource | null {
  const k = new URLSearchParams(search).get("kind");
  return k && (INBOX_SOURCES as readonly string[]).includes(k) ? (k as InboxSource) : null;
}

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
      const body = (await r.json().catch(() => null)) as Partial<InboxAnswer> | null;
      // An answer without its two lists is not a list with nothing in it: say the read failed.
      if (!body || !Array.isArray(body.items) || !Array.isArray(body.sections)) return setLoad({ phase: "failed" });
      setLoad({ phase: "ready", answer: body as InboxAnswer });
    } catch {
      setLoad({ phase: "failed" });
    }
  }, []);
  useEffect(() => {
    if (enabled) void read();
  }, [enabled, read]);

  const answer = load.phase === "ready" ? load.answer : null;
  /**
   * The items by kind, in the order the page draws them, oldest first inside each kind (the server's order), each kind
   * with its count and whether its rows decide on the list. Kinds with nothing are left out.
   */
  const groups = useMemo(() => {
    const by = new Map<InboxSource, InboxItem[]>();
    for (const item of answer?.items ?? []) by.set(item.source, [...(by.get(item.source) ?? []), item]);
    return INBOX_ORDER.filter((s) => by.get(s)?.length).map((source) => ({ source, items: by.get(source)!, count: by.get(source)!.length, decidedOnRow: DECIDED_ON_ROW.has(source) }));
  }, [answer]);

  return {
    load,
    answer,
    /** Each queue's state: a queue that failed or refused says so, and is never read as an empty, quiet one. */
    sections: answer?.sections ?? [],
    /** Everything waiting on this person, across every kind. */
    total: answer?.items.length ?? 0,
    groups,
    /** Read again, after a decision, so every count drops without reloading the page. */
    read,
  };
}
