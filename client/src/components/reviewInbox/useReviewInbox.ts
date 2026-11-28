/**
 * THE ONE READ OF EVERYTHING WAITING ON A PERSON (`GET /api/admin/review/inbox`), for any page that shows it.
 *
 * /admin/review draws the whole list from it, and a page that shows only what needs a person now (the admin's "Needs
 * you now") reads the same hook for its counts, so there is one list and one read, never a second one built beside it.
 * Each section is that queue's own read made as this person (server/routes/reviewInbox.ts), so nothing here can show
 * more than the queue's own page.
 *
 * PAGED ON THE SERVER, PER QUEUE (the hall relief, 27 Nov 2026). The answer carries each queue's number and its first
 * rows; `showMore(queue)` asks the server for more of that queue (`?rows=`), and every read after it asks for the same,
 * so a decision made on a row never folds the list back. The numbers are the server's, never a count of the rows sent.
 * A queue that did not load has no number (`count: null`): a page says "unknown" there, never zero.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authToken } from "@/lib/gameApi";
import type { InboxItem, InboxSectionAnswer, SectionState } from "@shared/reviewInbox";
import { INBOX_ORDER, INBOX_PAGE, INBOX_SOURCES, type InboxSource } from "@shared/reviewInboxSources";

export interface InboxCounts {
  /** What waits on this person. With a queue in `unknown` it is a floor: say "at least". */
  waiting: number;
  /** The queues that did not load, whose numbers are not known. */
  unknown: InboxSource[];
  /** How many of the waiting rows cannot be applied as the village stands. */
  blocked: number;
}

export interface InboxAnswer {
  sections: InboxSectionAnswer[];
  items: InboxItem[];
  counts: InboxCounts;
}

export type InboxLoad = { phase: "loading" } | { phase: "failed" } | { phase: "ready"; answer: InboxAnswer };

/** One kind on the page: its rows so far, its number (null when its queue did not load), and whether more can be asked for. */
export interface InboxGroup {
  source: InboxSource;
  state: SectionState;
  items: InboxItem[];
  count: number | null;
  atLeast: number;
  blocked: number;
  more: boolean;
  decidedOnRow: boolean;
}

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

const isSource = (v: unknown): v is InboxSource => typeof v === "string" && (INBOX_SOURCES as readonly string[]).includes(v);

/**
 * The server's answer in one shape. A server one release behind sends no `atLeast`, `more`, `blocked` or `unknown`:
 * each is read from what it did send, so a rollback draws the list it has and never a broken page.
 */
export function readAnswer(body: unknown): InboxAnswer | null {
  const b = body as { sections?: unknown; items?: unknown; counts?: { waiting?: unknown; unknown?: unknown; blocked?: unknown } } | null;
  // An answer without its two lists is not a list with nothing in it: the read failed.
  if (!b || !Array.isArray(b.items) || !Array.isArray(b.sections)) return null;
  const items = b.items as InboxItem[];
  const sections = (b.sections as Partial<InboxSectionAnswer>[]).filter((s) => isSource(s.source)).map((s): InboxSectionAnswer => {
    const listed = items.filter((i) => i.source === s.source).length;
    const failed = s.state === "failed";
    return {
      source: s.source as InboxSource,
      state: (s.state ?? "failed") as SectionState,
      count: failed ? null : typeof s.count === "number" ? s.count : listed,
      atLeast: typeof s.atLeast === "number" ? s.atLeast : typeof s.count === "number" ? s.count : listed,
      blocked: typeof s.blocked === "number" ? s.blocked : 0,
      more: s.more === true,
    };
  });
  const unknown = Array.isArray(b.counts?.unknown) ? b.counts.unknown.filter(isSource) : sections.filter((s) => s.state === "failed").map((s) => s.source);
  return {
    sections,
    items,
    counts: {
      waiting: typeof b.counts?.waiting === "number" ? b.counts.waiting : items.length,
      unknown,
      blocked: typeof b.counts?.blocked === "number" ? b.counts.blocked : items.filter((i) => i.blocked).length,
    },
  };
}

/** Read the inbox while `enabled` (signed in), and again on `read()` or `refresh()`. */
export function useReviewInbox(enabled: boolean) {
  const [load, setLoad] = useState<InboxLoad>({ phase: "loading" });
  // How many rows of a queue this person asked to see, past the first page. Sent with every read.
  const rows = useRef(new Map<InboxSource, number>());

  const fetchOnce = useCallback(async (quiet: boolean) => {
    if (!quiet) setLoad({ phase: "loading" });
    const asked = Array.from(rows.current).map(([s, n]) => `${s}:${n}`).join(",");
    try {
      const r = await fetch(`/api/admin/review/inbox${asked ? `?rows=${encodeURIComponent(asked)}` : ""}`, { headers: inboxHeaders() });
      const answer = r.ok ? readAnswer(await r.json().catch(() => null)) : null;
      // A quiet read that failed keeps the list a person is working in; the next loud read says so.
      if (!answer) return quiet ? undefined : setLoad({ phase: "failed" });
      setLoad({ phase: "ready", answer });
    } catch {
      if (!quiet) setLoad({ phase: "failed" });
    }
  }, []);

  /** Read again from nothing: the page says it is reading. For the first read and "Try again". */
  const read = useCallback(() => fetchOnce(false), [fetchOnce]);
  /** Read again behind the list, after a decision, so every number drops and no open row is closed under a person. */
  const refresh = useCallback(() => fetchOnce(true), [fetchOnce]);
  /** Ask the server for the next page of one queue's rows. */
  const showMore = useCallback(
    (source: InboxSource) => {
      rows.current.set(source, (rows.current.get(source) ?? INBOX_PAGE) + INBOX_PAGE);
      return fetchOnce(true);
    },
    [fetchOnce],
  );

  useEffect(() => {
    if (enabled) void read();
  }, [enabled, read]);

  const answer = load.phase === "ready" ? load.answer : null;
  /**
   * The kinds in the order the page draws them, each with the rows sent so far (the server's order), its number and
   * whether its rows decide on the list. A kind with nothing waiting is left out; a kind whose queue did not load is
   * kept even with no rows, so the page can say its number is unknown.
   */
  const groups = useMemo((): InboxGroup[] => {
    const by = new Map<InboxSource, InboxItem[]>();
    for (const item of answer?.items ?? []) by.set(item.source, [...(by.get(item.source) ?? []), item]);
    const section = new Map((answer?.sections ?? []).map((s) => [s.source, s] as const));
    return INBOX_ORDER.flatMap((source) => {
      const s = section.get(source);
      const items = by.get(source) ?? [];
      const failed = s?.state === "failed";
      if (!items.length && !failed) return [];
      return [{
        source,
        state: s?.state ?? "ok",
        items,
        count: failed ? null : s?.count ?? items.length,
        atLeast: s?.atLeast ?? items.length,
        blocked: s?.blocked ?? 0,
        more: s?.more ?? false,
        decidedOnRow: DECIDED_ON_ROW.has(source),
      }];
    });
  }, [answer]);

  return {
    load,
    answer,
    /** Each queue's state: a queue that failed or refused says so, and is never read as an empty, quiet one. */
    sections: answer?.sections ?? [],
    /** The server's numbers: what waits, which queues are unknown, how many rows are blocked. */
    counts: answer?.counts ?? { waiting: 0, unknown: [], blocked: 0 },
    /** Everything waiting on this person, across every kind, by the server's count. A floor while a queue is unknown. */
    total: answer?.counts.waiting ?? 0,
    groups,
    read,
    refresh,
    showMore,
  };
}
