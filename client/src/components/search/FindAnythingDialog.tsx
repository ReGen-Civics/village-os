/**
 * FIND ANYTHING's dialog (the door is FindAnything.tsx; the rules and the ranking are shared/findAnything.ts).
 *
 *   on open          the reader's own index, read once a session from GET /api/search/index: only what the
 *                    server says this reader may open, so nothing here filters who sees what
 *   typing           pages, Admin's settings, roles, circles, quests and (members) people, grouped, best first,
 *                    forgiving one typo a word
 *   few or no hits   "Ask <guide> where to find it": POST /api/search/guide sends only the typed words, and the
 *                    server keeps only the places on this reader's own list
 *   no key           the search's own results, and one gentle line
 *
 * A proper modal: the focus stays inside, Escape closes it, and the focus goes back to what opened it. Arrows move
 * through every result, Enter opens one. Every row is at least 44px tall, and the whole dialog fits 320px.
 *
 * Member pages draw it in the member look (journey/look.ts), which follows light (the Weathered map paper) and
 * dark through the semantic tokens. On an Admin page it takes the admin light look, by ruling.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useLocation } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import { plural } from "@lingui/core/macro";
import { ArrowRight, Search, X } from "lucide-react";
import { LeafCompass } from "@/components/sacred/livingCore";
import { useGuideName } from "@/hooks/useGuideName";
import { openVillageMenu, useVillageMenuReady } from "./findAnythingDoor";
import { authToken } from "@/lib/gameApi";
import { guideNameAtSentenceStart } from "@shared/guideName";
import { EYEBROW, HINT } from "@/components/journey/look";
import { groupFind, rankFind, weakFind, type FindEntry, type FindGuideAnswer, type FindGuideLimit, type FindIndex, type FindKind, type FindPick } from "@shared/findAnything";

export const INDEX_URL = "/api/search/index";
export const GUIDE_URL = "/api/search/guide";

const auth = (): Record<string, string> => {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/** The index, kept for the session per account, so a second open draws at once. */
let cached: { token: string | null; index: FindIndex } | null = null;

async function readIndex(): Promise<FindIndex | null> {
  const token = authToken();
  if (cached && cached.token === token) return cached.index;
  try {
    const r = await fetch(INDEX_URL, { headers: auth() });
    if (!r.ok) return null;
    const index = (await r.json()) as FindIndex;
    if (!Array.isArray(index?.entries)) return null;
    cached = { token, index };
    return index;
  } catch {
    return null;
  }
}

/** For tests: forget the session's index. */
export function forgetFindIndex(): void {
  cached = null;
}

type Guide =
  | { phase: "idle" }
  | { phase: "asking"; query: string }
  | { phase: "answered"; query: string; picks: FindPick[] }
  | { phase: "unavailable" }
  | { phase: "resting"; limit: FindGuideLimit["limit"] };

type Row =
  | { type: "entry"; entry: FindEntry }
  | { type: "pick"; pick: FindPick }
  | { type: "ask" };

/**
 * The two looks, both in the semantic tokens, so a village's own palette reaches them. A member page takes the
 * member look and follows light and dark. An Admin page wraps the dialog in `admin-root`, the scope that hands the
 * tokens back their light values in dark mode (client/src/index.css), because Admin is light-only by ruling; there
 * its headings are Admin's quiet ink, never the member gold.
 */
function lookFor(admin: boolean) {
  // CARD's panel (look.ts) without its padding, so the field and the list sit flush to its edges. `bg-popover` and
  // the dialog's own data-slot: the Weathered map paper draws a dialog as an opaque sheet (client/src/seaChart.css),
  // where `bg-card` would take the see-through paper a panel lying on the page wears.
  const panel = "rounded-2xl border border-border bg-popover text-popover-foreground shadow-sm";
  return {
    // `sheet-night` carries the member look's day and night palettes onto the portal, outside any page's world.
    panel: admin ? `admin-root ${panel}` : `sheet-night ${panel}`,
    field: "min-h-11 min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none",
    eyebrow: admin ? "text-xs font-semibold uppercase tracking-widest text-muted-foreground" : EYEBROW,
    hint: HINT,
    title: "text-foreground",
    rowOn: "bg-muted ring-1 ring-ring",
    edge: "border-border",
    icon: "text-muted-foreground",
    close: "text-muted-foreground hover:bg-muted",
    // The guide's own mark: a small gold ring (look.ts RING, at row size). Admin's quiet ink there.
    ring: admin
      ? "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-border text-muted-foreground"
      : "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-notice text-notice",
    // The guide's picks lie on a warm tile under the gold heading (look.ts TILE, edged in gold).
    picks: admin ? "rounded-xl border border-border bg-muted p-1" : "rounded-xl border border-notice/50 bg-muted p-1",
    // A second act, edged (look.ts BTN_SECONDARY), full width so it reads as the other way out.
    door: "jw-btn inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted",
  };
}

export default function FindAnythingDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLingui();
  const [location, setLocation] = useLocation();
  const look = lookFor(location === "/admin" || location.startsWith("/admin/"));
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<FindIndex | null | "failed">(cached && cached.token === authToken() ? cached.index : null);
  const [guide, setGuide] = useState<Guide>({ phase: "idle" });
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    let live = true;
    void readIndex().then((i) => live && setIndex(i ?? "failed"));
    return () => {
      live = false;
    };
  }, []);

  const entries = index && index !== "failed" ? index.entries : [];
  // The guide's name the way every surface reads it (hooks/useGuideName.ts), worded for this reader.
  const guideName = useGuideName().name;
  // "Open the menu" only while the shell listens for it (findAnythingDoor.ts): never a door that does not open.
  const menuReady = useVillageMenuReady();

  // ESCAPE CLOSES THIS AND NOTHING UNDER IT. The phone's More sheet closes on Escape from a window listener, and the
  // search opens over it, so Escape is taken here first, at the window's capture, and goes no further: the dialog
  // closes and the reader is back on the sheet they came from.
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [onClose]);
  const guideOn = !!(index && index !== "failed" && index.guide.available);
  const people = !!(index && index !== "failed" && index.people);
  const Guide = guideNameAtSentenceStart(guideName);

  const q = query.trim();
  const ranked = useMemo(() => (q ? rankFind(q, entries, 30) : []), [q, entries]);
  const groups = useMemo(() => groupFind(ranked), [ranked]);
  const weak = !!q && weakFind(ranked);
  const answeredHere = guide.phase === "answered" && guide.query === q ? guide : null;
  const askable = weak && guideOn && q.length >= 2 && guide.phase !== "unavailable" && guide.phase !== "resting" && !answeredHere;

  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];
    // The guide's answer leads: it is an answer to these very words.
    if (answeredHere) for (const pick of answeredHere.picks) list.push({ type: "pick", pick });
    for (const g of groups) for (const entry of g.entries) list.push({ type: "entry", entry });
    if (askable) list.push({ type: "ask" });
    return list;
  }, [answeredHere, groups, askable]);

  useEffect(() => setActive(0), [q, answeredHere]);
  // A new query is a new question: an answer about other words, or a refusal, does not carry over.
  useEffect(() => {
    setGuide((g) => (g.phase === "answered" && g.query !== q ? { phase: "idle" } : g));
  }, [q]);

  const go = useCallback(
    (path: string) => {
      onClose();
      setLocation(path);
      const hash = path.split("#")[1];
      if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
    },
    [onClose, setLocation],
  );

  const ask = useCallback(async () => {
    if (!q) return;
    setGuide({ phase: "asking", query: q });
    try {
      const r = await fetch(GUIDE_URL, { method: "POST", headers: { "Content-Type": "application/json", ...auth() }, body: JSON.stringify({ query: q }) });
      if (r.status === 429) {
        const limit = ((await r.json().catch(() => null)) as FindGuideLimit | null)?.limit === "day" ? "day" : "hour";
        return setGuide({ phase: "resting", limit });
      }
      const body = (r.ok ? await r.json() : null) as FindGuideAnswer | null;
      if (body?.state !== "answered") return setGuide({ phase: "unavailable" });
      // The server kept only places on this reader's list; the dialog keeps only places in its own index too.
      const mine = new Set(entries.map((e) => e.path));
      setGuide({ phase: "answered", query: q, picks: (body.picks ?? []).filter((p) => mine.has(p.path)) });
    } catch {
      setGuide({ phase: "unavailable" });
    }
  }, [q, entries]);

  const choose = (row: Row | undefined) => {
    if (!row) return;
    if (row.type === "ask") void ask();
    else go(row.type === "pick" ? row.pick.path : row.entry.path);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(rows[active]);
    }
  };

  const groupName: Record<FindKind, string> = {
    page: t({ message: "Pages", context: "find anything: a group of results" }),
    setting: t({ message: "Village settings", context: "find anything: a group of results" }),
    role: t({ message: "Roles", context: "find anything: a group of results" }),
    circle: t({ message: "Circles", context: "find anything: a group of results" }),
    quest: t({ message: "Quests", context: "find anything: a group of results" }),
    person: t({ message: "People", context: "find anything: a group of results" }),
  };

  const optionId = (i: number) => `${listId}-o${i}`;
  const rowClass = (i: number) => `flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${i === active ? look.rowOn : ""}`;
  let n = -1;
  const option = (row: Row, key: string, body: ReactNode) => {
    n += 1;
    const i = n;
    return (
      <div key={key} id={optionId(i)} role="option" aria-selected={i === active} className={rowClass(i)} onMouseEnter={() => setActive(i)} onClick={() => choose(row)}>
        {body}
      </div>
    );
  };
  const entryBody = (title: string, line: string) => (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className={`truncate font-medium ${look.title}`}>{title}</span>
      {line && <span className={`truncate text-xs ${look.icon}`}>{line}</span>}
    </span>
  );

  const resultCount = rows.filter((r) => r.type !== "ask").length;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/50" /* design-ok: the scrim behind a modal, as the More and Paths sheets draw theirs */ />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          // The opener takes the focus back (FindAnything.tsx), so Radix's own return is not wanted.
          onCloseAutoFocus={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            input.current?.focus();
          }}
          className={`fixed inset-x-0 top-0 z-[80] flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-none sm:inset-x-auto sm:left-1/2 sm:top-[10vh] sm:max-h-[75vh] sm:w-[40rem] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:rounded-2xl ${look.panel}`}
        >
          <DialogPrimitive.Title className="sr-only"><Trans context="find anything: the dialog's name">Find anything</Trans></DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {people
              ? <Trans context="find anything: what it searches, for a member">Search pages, roles, circles, quests and people. Arrows move, Enter opens, Escape closes.</Trans>
              : <Trans context="find anything: what it searches">Search pages, roles, circles and quests. Arrows move, Enter opens, Escape closes.</Trans>}
          </DialogPrimitive.Description>

          <div className={`flex items-center gap-2 border-b px-3 py-2 focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring ${look.edge}`}>
            <Search aria-hidden="true" className={`size-5 shrink-0 ${look.icon}`} />
            <input
              ref={input}
              type="text"
              enterKeyHint="go"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded={rows.length > 0}
              aria-controls={listId}
              aria-activedescendant={rows.length ? optionId(active) : undefined}
              aria-autocomplete="list"
              aria-label={t({ message: "Find anything", context: "find anything: the search field's name" })}
              placeholder={t({ message: "Find a page, a role, a quest...", context: "find anything: the search field's hint" })}
              className={look.field}
            />
            <DialogPrimitive.Close
              aria-label={t({ message: "Close search", context: "find anything: close button" })}
              className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${look.close}`}
            >
              <X aria-hidden="true" className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <p role="status" className="sr-only">
              {q && index !== null ? t({ message: plural(resultCount, { one: "# result", other: "# results" }), context: "find anything: the count a screen reader hears" }) : ""}
            </p>

            {index === "failed" && (
              <p className={`px-2 py-3 ${look.hint}`}><Trans context="find anything: the index could not load">Search could not load just now. The menu still has every page.</Trans></p>
            )}
            {!q && index !== "failed" && (
              <p className={`px-2 py-3 ${look.hint}`}>
                {people
                  ? <Trans context="find anything: before typing, for a member">Type a page, a role, a circle, a quest or a person.</Trans>
                  : <Trans context="find anything: before typing">Type a page, a role, a circle or a quest.</Trans>}
              </p>
            )}

            <div id={listId} role="listbox" aria-label={t({ message: "Results", context: "find anything: the results list" })} className="space-y-1">
              {answeredHere && answeredHere.picks.length > 0 && (
                <div role="group" aria-label={t({ message: `${Guide} suggests`, context: "find anything: the guide's answer, a group heading" })} className={look.picks}>
                  <div aria-hidden="true" className={`px-3 pb-1 pt-2 ${look.eyebrow}`}>{t({ message: `${Guide} suggests`, context: "find anything: the guide's answer, a group heading" })}</div>
                  {answeredHere.picks.map((pick) =>
                    option({ type: "pick", pick }, `pick:${pick.path}`, (
                      <>
                        <span aria-hidden="true" className={look.ring}><LeafCompass className="size-4" /></span>
                        {entryBody(pick.title, pick.why)}
                      </>
                    )),
                  )}
                </div>
              )}
              {groups.map((g) => (
                <div key={g.kind} role="group" aria-label={groupName[g.kind]}>
                  <div aria-hidden="true" className={`px-3 pb-1 pt-2 ${look.eyebrow}`}>{groupName[g.kind]}</div>
                  {g.entries.map((e) => option({ type: "entry", entry: e }, e.id, entryBody(e.title, e.help)))}
                </div>
              ))}
              {askable &&
                option({ type: "ask" }, "ask", (
                  <>
                    <span aria-hidden="true" className={look.ring}><LeafCompass className="size-4" /></span>
                    <span className={`min-w-0 flex-1 font-medium ${look.title}`}>
                      {ranked.length === 0
                        ? <Trans context="find anything: nothing matches, the guide's row">Nothing here matches. Ask {guideName} where to find it.</Trans>
                        : <Trans context="find anything: ask the guide, the row's words">Ask {guideName} where to find it</Trans>}
                    </span>
                    <ArrowRight aria-hidden="true" className={`size-4 shrink-0 ${look.icon}`} />
                  </>
                ))}
            </div>
            {askable && (
              <p className={`px-3 pt-1 text-xs ${look.icon}`}>
                <Trans context="find anything: under the ask row, what is sent">Only the words you typed go to {guideName}.</Trans>
              </p>
            )}

            {q && index !== null && index !== "failed" && ranked.length === 0 && !answeredHere?.picks.length && !askable && (
              <p className={`px-3 py-2 ${look.hint}`}>
                <Trans context="find anything: no results">Nothing here matches “{q}”. Try another word.</Trans>
              </p>
            )}
            {/* The second door when nothing matches: the whole menu, opened by the shell over the page. */}
            {q && index !== null && ranked.length === 0 && menuReady && (
              <div className="px-1 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openVillageMenu();
                  }}
                  className={look.door}
                >
                  <Trans context="find anything: nothing matches, the menu's door">Open the menu</Trans>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </button>
              </div>
            )}
            <div aria-live="polite" className="px-3">
              {guide.phase === "asking" && (
                <p className={`py-2 ${look.hint}`}><Trans context="find anything: the guide is looking">{Guide} is looking...</Trans></p>
              )}
              {answeredHere && answeredHere.picks.length === 0 && (
                <p className={`py-2 ${look.hint}`}><Trans context="find anything: the guide found nothing either">{Guide} found no place for that either. Try other words.</Trans></p>
              )}
              {guide.phase === "unavailable" && (
                <p className={`py-2 ${look.hint}`}><Trans context="find anything: the guide is not answering">{Guide} can't answer right now, so these are the search's own results.</Trans></p>
              )}
              {guide.phase === "resting" && guide.limit === "hour" && (
                <p className={`py-2 ${look.hint}`}><Trans context="find anything: the guide's hour is spent">That's a lot of asking for one hour. The search still works on its own.</Trans></p>
              )}
              {guide.phase === "resting" && guide.limit === "day" && (
                <p className={`py-2 ${look.hint}`}><Trans context="find anything: the guide's day is spent">{Guide} has rested for today. The search still works on its own.</Trans></p>
              )}
              {weak && !guideOn && index !== null && index !== "failed" && ranked.length > 0 && (
                <p className={`py-2 ${look.hint}`}><Trans context="find anything: weak results, no guide">These are the closest matches. A shorter word often finds more.</Trans></p>
              )}
            </div>
          </div>

          <p className={`hidden flex-wrap gap-x-4 border-t px-4 py-2 text-xs sm:flex ${look.edge} ${look.icon}`}>
            <Trans context="find anything: the footer's keys">↑ ↓ to move, Enter to open, Esc to close.</Trans>
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
