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

type Level = 2 | 3 | 4;
const HEADING: Record<Level, "h2" | "h3" | "h4"> = { 2: "h2", 3: "h3", 4: "h4" };

export default function RolePieces({ pieces, level, after, initial = 0 }: { pieces: RolePiece[]; level: Level; after?: (key: string) => ReactNode; initial?: number }) {
  const { t } = useLingui();
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [at, setAt] = useState(Math.min(Math.max(initial, 0), Math.max(pieces.length - 1, 0)));
  const [all, setAll] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([at]));
  const moved = useRef(false);
  const headings = useRef<Array<HTMLElement | null>>([]);
  const H = HEADING[level];

  useEffect(() => {
    if (!moved.current || all) return;
    headings.current[at]?.focus();
  }, [at, all]);

  if (pieces.length === 0) return null;
  const i = Math.min(at, pieces.length - 1);
  const go = (n: number) => {
    if (n < 0 || n >= pieces.length) return;
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
  const next = pieces[i + 1];

  return (
    <div className="flex min-w-0 flex-col gap-5" onKeyDown={onKey} data-role-pieces="">
      <div className="flex flex-wrap items-center gap-2">
        {!all && (
          <nav aria-label={t({ message: "Pieces of this role", context: "role card piece rail" })} className="contents">
            <ul className="flex flex-wrap gap-1.5">
              {pieces.map((p, k) => {
                const Icon = p.icon;
                const here = k === i;
                return (
                  <li key={p.key}>
                    <button
                      type="button"
                      onClick={() => go(k)}
                      aria-current={here ? "step" : undefined}
                      aria-controls={`${base}-${p.key}`}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${here ? "border-notice bg-notice text-background" : seen.has(k) ? "border-border text-card-foreground hover:border-notice/60" : "border-border/60 text-muted-foreground hover:border-notice/60"}`}
                      data-piece-tab={p.key}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {p.tab}
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
          className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1 text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Rows3 className="size-4" aria-hidden="true" />
          {all ? t({ message: "One piece at a time", context: "role card: back to the stepped view" }) : t({ message: "Show every piece", context: "role card: open every piece at once" })}
        </button>
      </div>

      <div className="flex min-w-0 flex-col gap-8">
        {pieces.map((p, k) => {
          const open = all || k === i;
          const Icon = p.icon;
          return (
            <section
              key={p.key}
              id={`${base}-${p.key}`}
              hidden={!open}
              aria-labelledby={`${base}-${p.key}-h`}
              className={`flex min-w-0 flex-col gap-4 break-words ${open && !all ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500" : ""}`}
              data-piece={p.key}
            >
              <div className="flex items-center gap-3.5">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-notice/50 bg-muted text-notice" aria-hidden="true">
                  <Icon className="size-6" />
                </span>
                <div className="min-w-0">
                  <H
                    id={`${base}-${p.key}-h`}
                    ref={(el: HTMLElement | null) => {
                      headings.current[k] = el;
                    }}
                    tabIndex={-1}
                    className="font-display text-2xl leading-tight text-card-foreground outline-none sm:text-3xl"
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
        })}
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
          <span className="text-center text-sm tabular-nums text-muted-foreground" aria-live="polite">
            {t({ message: `${i + 1} of ${pieces.length}`, context: "role card: which piece is open, out of how many" })}
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
