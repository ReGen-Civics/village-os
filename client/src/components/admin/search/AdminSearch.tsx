/**
 * ADMIN SEARCH: one search bar at the top of every Admin page (Admin
 * evolution, PR 3). The lead's words: "I should be able to search for 'mail
 * settings' and then find the send me a test button."
 *
 * Opened by its field in the header, by "/" (outside a text field), or by
 * Ctrl K / Cmd K. Ctrl / stays with the guide (AdminHelperHost).
 *
 *   before typing   recent places on this device
 *   typing          pages, controls, dials and steward pages, best first
 *                   (rankAdminSearch, shared/adminSearch.ts); under the best
 *                   page, the controls that live on it
 *   Enter           goes to the highlighted result's address. A control's
 *                   page opens with that control focused; a page that names
 *                   its first act (Mail settings: Send me a test) focuses it
 *   nothing found   the words stay, the areas stay one click away, and the
 *                   guide is offered with the same words
 *
 * SEARCHING NEVER ACTS. A result is an address. Pressing the button there is
 * the person's own, separate act. The index comes from
 * GET /api/admin/search-index, which asked the one gate, so a control this
 * person cannot use is never offered.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Search, X, ArrowRight, Clock } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { adminSearchHref, controlsOn, rankAdminSearch, type AdminSearchEntry } from "@shared/adminSearch";
import { API_BASE, authHeaders } from "../adminApi";
import type { NavGroup } from "../adminNavGroups";
import { goTo, isSearchShortcut, readRecent, rememberPlace, searchEntries, type RecentPlace } from "./adminSearchModel";

type Row =
  | { type: "entry"; entry: AdminSearchEntry }
  | { type: "recent"; place: RecentPlace }
  | { type: "guide" };

export default function AdminSearch({
  password,
  groups,
  onHelper,
}: {
  password: string;
  /** The menu this person sees, already filtered by the modules that are on. */
  groups: readonly NavGroup[];
  /** Opens the guide's panel. Absent, no guide row. */
  onHelper?: () => void;
}) {
  const { t } = useLingui();
  const kindWord: Record<AdminSearchEntry["kind"], string> = {
    page: t({ message: "Page", context: "admin search, kind of result" }),
    control: t({ message: "Button or field", context: "admin search, kind of result" }),
    dial: t({ message: "Dial", context: "admin search, kind of result" }),
    outside: t({ message: "Page", context: "admin search, kind of result" }),
  };
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [served, setServed] = useState<AdminSearchEntry[] | null>(null);
  const [recent, setRecent] = useState<RecentPlace[]>(() => readRecent());
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // The keys that open it, anywhere in Admin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open || !isSearchShortcut(e)) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // The index, fetched the first time search opens. A failure leaves the pages.
  useEffect(() => {
    if (!open || served) return;
    const ctrl = new AbortController();
    fetch(`${API_BASE}/admin/search-index`, { headers: authHeaders(password), signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => setServed(Array.isArray(d?.entries) ? d.entries : []))
      .catch(() => {
        if (!ctrl.signal.aborted) setServed([]);
      });
    return () => ctrl.abort();
  }, [open, served, password]);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  const all = useMemo(() => searchEntries(groups, served ?? []), [groups, served]);
  const ranked = useMemo(() => (query.trim() ? rankAdminSearch(query, all, 12) : []), [query, all]);
  const best = ranked[0]?.kind === "page" ? ranked[0] : null;
  const jumps = useMemo(() => (best?.tab ? controlsOn(best.tab, all) : []), [best, all]);

  const rows: Row[] = useMemo(() => {
    if (!query.trim()) return recent.map((place) => ({ type: "recent" as const, place }));
    const list: Row[] = ranked.map((entry) => ({ type: "entry" as const, entry }));
    if (onHelper) list.push({ type: "guide" });
    return list;
  }, [query, ranked, recent, onHelper]);

  useEffect(() => setActive(0), [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => opener.current?.focus());
  }, []);

  // Escape closes it wherever the focus is while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const choose = useCallback(
    (row: Row) => {
      if (row.type === "guide") {
        setOpen(false);
        setQuery("");
        onHelper?.();
        return;
      }
      if (row.type === "recent") {
        setOpen(false);
        setQuery("");
        goTo(row.place.href);
        return;
      }
      setRecent(rememberPlace(row.entry));
      setOpen(false);
      setQuery("");
      goTo(adminSearchHref(row.entry));
    },
    [onHelper],
  );

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) choose(row);
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;
  const shortcut = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? "") ? "⌘K" : "Ctrl K";

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t({ message: "Search Admin", context: "admin search, opens the search" })}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground hover:border-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-[15rem] sm:justify-start"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline"><Trans context="admin search, field placeholder">Search Admin</Trans></span>
        <span className="ml-auto hidden items-center gap-1 sm:inline-flex" aria-hidden="true">
          <kbd className="rounded border border-border px-1.5 text-xs">/</kbd>
          <kbd className="rounded border border-border px-1.5 text-xs">{shortcut}</kbd>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={close} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t({ message: "Search Admin", context: "admin search, dialog name" })}
            className="absolute inset-x-0 top-0 flex max-h-full flex-col bg-card text-card-foreground shadow-sm sm:inset-x-auto sm:left-1/2 sm:top-[10vh] sm:max-h-[75vh] sm:w-[40rem] sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:border-border"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                ref={input}
                // The field takes the focus the moment it mounts, so the first
                // key typed after "/" or Ctrl K is already a search.
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                role="combobox"
                aria-expanded={rows.length > 0}
                aria-controls={listId}
                aria-activedescendant={rows.length ? optionId(active) : undefined}
                aria-autocomplete="list"
                aria-label={t({ message: "Search Admin", context: "admin search, input name" })}
                placeholder={t({ message: "Search settings, pages and buttons", context: "admin search, input placeholder" })}
                className="min-h-11 w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={close}
                aria-label={t({ message: "Close search", context: "admin search, close" })}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              {!query.trim() && (
                <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {recent.length ? <Trans context="admin search, heading">Recent places</Trans> : <Trans context="admin search, heading">Type what you are looking for</Trans>}
                </p>
              )}
              {!query.trim() && !recent.length && (
                <p className="px-4 pb-3 text-sm text-muted-foreground">
                  <Trans context="admin search, empty hint">A page, a setting or a button: “mail settings”, “send test”, “who runs comms”.</Trans>
                </p>
              )}

              <ul id={listId} role="listbox" aria-label={t({ message: "Results", context: "admin search, results list" })} className="px-2">
                {rows.map((row, i) => {
                  const selected = i === active;
                  const base = `flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${selected ? "bg-muted ring-1 ring-ring" : ""}`;
                  if (row.type === "recent") {
                    return (
                      <li key={row.place.id} id={optionId(i)} role="option" aria-selected={selected} className={base} onMouseEnter={() => setActive(i)} onClick={() => choose(row)}>
                        <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-foreground">{row.place.title}</span>
                      </li>
                    );
                  }
                  if (row.type === "guide") {
                    return (
                      <li key="guide" id={optionId(i)} role="option" aria-selected={selected} className={base} onMouseEnter={() => setActive(i)} onClick={() => choose(row)}>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0 flex-1 text-foreground">
                          <Trans context="admin search, ask the guide row">Ask your guide about “{query}”</Trans>
                        </span>
                      </li>
                    );
                  }
                  const e = row.entry;
                  return (
                    <li key={e.id} id={optionId(i)} role="option" aria-selected={selected} className={`${base} flex-wrap`} onMouseEnter={() => setActive(i)} onClick={() => choose(row)}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium text-foreground">{e.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{e.help}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-border px-2 text-xs text-muted-foreground">{kindWord[e.kind]}</span>
                      {i === 0 && best && jumps.length > 0 && (
                        <span className="flex w-full flex-wrap gap-1.5 pt-1" aria-hidden="true">
                          {jumps.slice(0, 4).map((j) => (
                            <span key={j.id} className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground">{j.title}</span>
                          ))}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {query.trim() && ranked.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground" role="status">
                  <Trans context="admin search, no results">Nothing in Admin matches “{query}”. Try another word, or open the menu for every area.</Trans>
                </p>
              )}
            </div>

            <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <span><Trans context="admin search, footer">↑ ↓ to move, Enter to open, Esc to close.</Trans></span>
              <span><Trans context="admin search, footer">Search only takes you there. Nothing runs from here.</Trans></span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
