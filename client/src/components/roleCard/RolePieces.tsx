/**
 * THE ROLE, PIECE BY PIECE (Rye, 14 Nov 2026; approved mockup A,
 * https://claude.ai/artifact/NaavCsufyAEHKowgEdKFAX).
 *
 * A founding role card shows one piece of the role at a time: a rail of pieces, each with its own
 * icon, the open piece under it, and Back and Next below. A reader can also open every piece at
 * once ("Show every piece"), which is also how the card reads for someone who would rather scroll.
 *
 * EVERY PIECE IS IN THE PAGE. A closed piece carries `hidden`, so search, a screen reader's
 * find and the browser's own find-in-page are one button away, and nothing is fetched or built
 * later. Arrow keys move between pieces while focus is inside the card; moving puts focus on the
 * open piece's heading, so a screen reader hears where it landed. The entrance animation is
 * `motion-safe` only, and the platform's reduced-motion rule (client/src/index.css) stops it too.
 *
 * `after` lets a host add something under each piece (the applicant's suggestion layer).
 *
 * FIVE TABS, NOT ELEVEN (the lead, 20 Nov 2026; the roles lane's idea 2). A host may pass `tabs`, each naming
 * the pieces it holds, and the rail then shows the tabs: one tab opens every piece it holds, in order. Every
 * piece keeps its own section, heading, `data-piece` and `after`, so a suggestion still belongs to one piece
 * and a tab's chip carries the dot when any of its pieces is marked. With no `tabs`, each piece is its own tab.
 *
 * A LINK TO A PIECE OPENS ITS TAB: `#rewards` or `#piece-rewards` (a piece's key) and `#you` (a tab's key) open
 * the tab that holds it, on arrival and when the hash changes, and bring that piece's heading into view.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Rows3, type LucideIcon } from "lucide-react";
import { useLingui } from "@lingui/react/macro";

export interface RolePiece {
  key: string;
  /** The short name on the rail. */
  tab: string;
  icon: LucideIcon;
  /** The piece's heading. */
  title: string;
  /** One line under the heading. */
  sub?: string;
  body: ReactNode;
}

/** A tab on the rail and the pieces it opens, by key, in the order they are drawn. */
export interface PieceTab {
  key: string;
  tab: string;
  icon: LucideIcon;
  pieces: readonly string[];
}

type Level = 2 | 3 | 4;
const HEADING: Record<Level, "h2" | "h3" | "h4"> = { 2: "h2", 3: "h3", 4: "h4" };

interface Group {
  key: string;
  tab: string;
  icon: LucideIcon;
  items: RolePiece[];
}

/** The tabs the rail shows: the host's, holding only pieces the card drew, with any piece no tab names as its own. */
export function groupPieces(pieces: readonly RolePiece[], tabs?: readonly PieceTab[]): Group[] {
  if (!tabs) return pieces.map((p) => ({ key: p.key, tab: p.tab, icon: p.icon, items: [p] }));
  const named = new Set(tabs.flatMap((t) => t.pieces));
  const groups: Group[] = tabs
    .map((t) => ({ key: t.key, tab: t.tab, icon: t.icon, items: t.pieces.map((k) => pieces.find((p) => p.key === k)).filter((p): p is RolePiece => !!p) }))
    .filter((g) => g.items.length > 0);
  for (const p of pieces) if (!named.has(p.key)) groups.push({ key: p.key, tab: p.tab, icon: p.icon, items: [p] });
  return groups;
}

/** The tab a link names, by a piece's key (with or without "piece-") or a tab's key; -1 for none. */
export function tabForHash(groups: readonly Group[], hash: string): number {
  let h = "";
  try {
    h = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return -1;
  }
  h = h.replace(/^piece-/, "");
  if (!h) return -1;
  return groups.findIndex((g) => g.key === h || g.items.some((p) => p.key === h));
}

const hashNow = () => (typeof window === "undefined" ? "" : window.location.hash);

export default function RolePieces({ pieces, tabs, level, after, marks, initial = 0, initialAll = false }: { pieces: RolePiece[]; tabs?: readonly PieceTab[]; level: Level; after?: (key: string) => ReactNode; marks?: (key: string) => number; initial?: number; initialAll?: boolean }) {
  const { t } = useLingui();
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  // A host builds its pieces afresh on every render, so effects key on the tabs' shape, never on the array.
  const groups = groupPieces(pieces, tabs);
  const shape = groups.map((g) => `${g.key}:${g.items.map((p) => p.key).join(",")}`).join("|");
  const live = useRef(groups);
  live.current = groups;
  const linked = tabForHash(groups, hashNow());
  const [at, setAt] = useState(() => Math.min(Math.max(linked >= 0 ? linked : initial, 0), Math.max(groups.length - 1, 0)));
  const [all, setAll] = useState(initialAll);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([at]));
  const moved = useRef(false);
  // The piece a link named, to bring into view once its tab is open.
  const target = useRef<string | null>(linked >= 0 ? hashNow().replace(/^#(piece-)?/, "") : null);
  const headings = useRef<Record<string, HTMLElement | null>>({});
  const rail = useRef<HTMLUListElement | null>(null);
  const H = HEADING[level];

  useEffect(() => {
    if (target.current) {
      const key = target.current;
      target.current = null;
      const g = live.current[at];
      const piece = g?.items.find((p) => p.key === key) ?? g?.items[0];
      const el = piece ? headings.current[piece.key] : null;
      el?.scrollIntoView?.({ block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    if (!moved.current || all) return;
    const first = live.current[at]?.items[0];
    if (first) headings.current[first.key]?.focus();
  }, [at, all]);

  // A card's pieces can arrive after it mounts (its sections are read), so a link that named nothing yet is tried
  // again as the pieces change, until it lands or the reader moves.
  const waiting = useRef(linked < 0 && hashNow().length > 1);
  useEffect(() => {
    if (!waiting.current || moved.current) return;
    const k = tabForHash(live.current, hashNow());
    if (k < 0) return;
    waiting.current = false;
    target.current = hashNow().replace(/^#(piece-)?/, "");
    setAt(k);
    setSeen((s) => new Set(s).add(k));
  }, [shape]);

  // A link to a piece followed while the card is open (another link on the page, or Back) opens its tab too.
  useEffect(() => {
    const follow = () => {
      const k = tabForHash(live.current, hashNow());
      if (k < 0) return;
      target.current = hashNow().replace(/^#(piece-)?/, "");
      setAll(false);
      setAt(k);
      setSeen((s) => new Set(s).add(k));
    };
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [shape]);

  // The open tab stays in sight on a phone, where the rail scrolls sideways. Only the rail moves, never the page.
  useEffect(() => {
    const ul = rail.current;
    const here = ul?.querySelector<HTMLElement>("[aria-current]");
    if (!ul || !here || ul.scrollWidth <= ul.clientWidth) return;
    ul.scrollLeft = here.offsetLeft - (ul.clientWidth - here.offsetWidth) / 2;
  }, [at, all]);

  if (groups.length === 0) return null;
  const i = Math.min(at, groups.length - 1);
  const go = (n: number) => {
    if (n < 0 || n >= groups.length) return;
    moved.current = true;
    setAt(n);
    setSeen((s) => new Set(s).add(n));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (all) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
    if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else return;
    // The card has used the key: a host that also walks on arrows (the application's steps) must not.
    e.preventDefault();
    e.stopPropagation();
  };
  const next = groups[i + 1];
  const marked = (g: Group) => g.items.reduce((n, p) => n + (marks?.(p.key) ?? 0), 0);

  return (
    <div className="flex min-w-0 flex-col gap-5" onKeyDown={onKey} data-role-pieces="">
      {/* On a phone the rail is one row that scrolls sideways and stays under the site header while the card is read (QA F8).
          From sm up it wraps as it always did. The DOM order is the same at every width, so the tab order is too. */}
      <div className="flex items-center gap-2 max-sm:sticky max-sm:top-24 max-sm:z-10 max-sm:-mx-5 max-sm:border-b max-sm:border-border max-sm:bg-card max-sm:px-5 max-sm:py-2 sm:flex-wrap" data-piece-rail="">
        {!all && (
          <nav aria-label={t({ message: "Pieces of this role", context: "role card piece rail" })} className="min-w-0 flex-1 sm:contents">
            <ul ref={rail} className="relative flex gap-1.5 overflow-x-auto overscroll-x-contain sm:flex-wrap sm:overflow-visible" data-piece-scroll="">
              {groups.map((g, k) => {
                const Icon = g.icon;
                const here = k === i;
                const count = marked(g);
                return (
                  <li key={g.key} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => go(k)}
                      aria-current={here ? "step" : undefined}
                      aria-controls={g.items.map((p) => `${base}-${p.key}`).join(" ")}
                      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${here ? "border-notice bg-notice text-background" : seen.has(k) ? "border-border text-card-foreground hover:border-notice/60" : "border-border/60 text-muted-foreground hover:border-notice/60"}`}
                      data-piece-tab={g.key}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {g.tab}
                      {count > 0 && (
                        <>
                          <span className={`size-2 rounded-full ${here ? "bg-background" : "bg-notice"}`} aria-hidden="true" data-piece-marked="" />
                          <span className="sr-only">{t({ message: `, ${count} suggestions`, context: "role card rail: how many suggestions a piece carries" })}</span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          aria-pressed={all}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 py-1 sm:ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Rows3 className="size-4" aria-hidden="true" />
          <span className="max-sm:sr-only">{all ? t({ message: "One piece at a time", context: "role card: back to the stepped view" }) : t({ message: "Show every piece", context: "role card: open every piece at once" })}</span>
        </button>
      </div>

      <div className="flex min-w-0 flex-col gap-8">
        {groups.flatMap((g, k) =>
          g.items.map((p, n) => {
            const open = all || k === i;
            const Icon = p.icon;
            // A tab that holds several pieces draws them a step quieter, each under a rule, so the tab reads as one page.
            const several = g.items.length > 1;
            return (
              <section
                key={p.key}
                id={`${base}-${p.key}`}
                hidden={!open}
                aria-labelledby={`${base}-${p.key}-h`}
                className={`flex min-w-0 scroll-mt-40 flex-col gap-4 break-words ${several && n > 0 ? "border-t border-border pt-7" : ""} ${open && !all && n === 0 ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500" : ""}`}
                data-piece={p.key}
                data-piece-in={g.key}
              >
                <div className="flex items-center gap-3.5">
                  <span className={`grid shrink-0 place-items-center rounded-xl border border-notice/50 bg-muted text-notice ${several ? "size-10" : "size-12"}`} aria-hidden="true">
                    <Icon className={several ? "size-5" : "size-6"} />
                  </span>
                  <div className="min-w-0">
                    <H
                      id={`${base}-${p.key}-h`}
                      ref={(el: HTMLElement | null) => {
                        headings.current[p.key] = el;
                      }}
                      tabIndex={-1}
                      className={`font-display leading-tight text-card-foreground outline-none ${several ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}
                    >
                      {p.title}
                    </H>
                    {p.sub && <p className="mt-0.5 text-sm text-muted-foreground">{p.sub}</p>}
                  </div>
                </div>
                {p.body}
                {after?.(p.key)}
              </section>
            );
          }),
        )}
      </div>

      {!all && (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t border-border pt-4 sm:gap-3">
          <button
            type="button"
            onClick={() => go(i - 1)}
            disabled={i === 0}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 py-2 font-semibold text-card-foreground disabled:opacity-40 sm:gap-2 sm:px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t({ message: "Back", context: "role card: the previous piece" })}
          </button>
          <span className="sr-only text-center text-sm tabular-nums text-muted-foreground @md:not-sr-only" aria-live="polite">
            {t({ message: `${i + 1} of ${groups.length}`, context: "role card: which piece is open, out of how many" })}
          </span>
          {next ? (
            <button
              type="button"
              onClick={() => go(i + 1)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-notice bg-notice/15 px-3 py-2 text-left font-semibold sm:gap-2 sm:px-4 text-card-foreground hover:bg-notice/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              data-piece-next=""
            >
              {t({ message: `Next: ${next.tab}`, context: "role card: the next piece, by its short name" })}
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
