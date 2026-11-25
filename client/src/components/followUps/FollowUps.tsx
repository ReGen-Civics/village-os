/**
 * FOLLOW-UPS, ONE LIST (profile overhaul, Direction D). The rows come from followUpRows.ts, which says what is
 * in each group and why; this file reads, draws and ticks.
 *
 * Three reads, in parallel, each the one the profile already made for its own card: the task board (only with
 * Live Sessions on), the asks between members, and the asks raised with a role. A read that is CLOSED to this
 * member (a module off, a guest) is simply absent. A read that FAILED says so with a retry, because a short list
 * would otherwise claim nothing waits.
 *
 * A row's tick closes it in one call where one call can: a task (`taskDoneUrl`, the server reads the version)
 * or an ask of you (the ask's `done`). The tick sprouts, the profile is told (`announceProfileChange`) and
 * every card that reads the same things reads again. A row with no tick opens where it lives in full.
 *
 * Absent, not empty: with nothing to follow up and nothing failed, the card draws nothing.
 */
import { useCallback, useEffect, useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Armchair, HandHeart, Hexagon, ListChecks, Send, Sprout } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { gameFetch } from "@/lib/gameApi";
import { announceProfileChange, onProfileRefresh } from "@/lib/profileRefresh";
import { CARD, EYEBROW, H2, HINT, LINK } from "@/components/journey/look";
import { TASKS_MINE_URL, taskDateWords, taskDoneUrl, type TaskBoardPayload } from "@shared/sessionTasks";
import { ASKS_URL, type AsksPayload } from "@shared/memberAsks";
import { RAISED_ASKS_API, readRaisedAsks, type RaisedAsk } from "@shared/priorities";
import { readerToday } from "@/components/profile/TasksWaitingCard";
import { FOLLOW_GROUPS, FOLLOW_SOURCES, followUpRows, inGroup, type FollowGroup, type FollowRow, type FollowSource } from "./followUpRows";

/** A read's outcome: the payload, closed to this member (null), or failed. */
type Read<T> = T | null | "failed";

async function read<T>(url: string, pick: (body: unknown) => T): Promise<Read<T>> {
  try {
    const res = await gameFetch(url, { cache: "no-store" });
    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
    if (!res.ok) return "failed";
    return pick(await res.json());
  } catch {
    return "failed";
  }
}

const ICON: Record<FollowSource, LucideIcon> = { task: ListChecks, seat: Armchair, asked: HandHeart, yours: Send, role: Hexagon };

export interface FollowUpsProps {
  sessionsOn: boolean;
  /** A row that opens somewhere on this page: the page shows the part it lives in (on a phone, its tab). */
  onGo?: (href: string) => void;
}

export default function FollowUps({ sessionsOn, onGo }: FollowUpsProps) {
  const { t } = useLingui();
  const base = useId();
  const [board, setBoard] = useState<Read<TaskBoardPayload>>(null);
  const [asks, setAsks] = useState<Read<AsksPayload>>(null);
  const [raised, setRaised] = useState<Read<RaisedAsk[]>>(null);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<FollowSource | "all">("all");
  const [ticking, setTicking] = useState<string | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    let live = true;
    void Promise.all([
      sessionsOn ? read(TASKS_MINE_URL, (b) => b as TaskBoardPayload) : Promise.resolve(null),
      read(ASKS_URL, (b) => b as AsksPayload),
      read(RAISED_ASKS_API, (b) => readRaisedAsks((b as { asks?: unknown })?.asks)),
    ]).then(([b, a, r]) => {
      if (!live) return;
      setBoard(b);
      setAsks(a);
      setRaised(r);
      setTicked([]);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [sessionsOn]);
  useEffect(() => load(), [load]);
  useEffect(() => onProfileRefresh(() => void load()), [load]);

  const label: Record<FollowSource, string> = {
    task: t({ message: "Your tasks", context: "follow-ups: a source" }),
    seat: t({ message: "Your roles' tasks", context: "follow-ups: a source" }),
    asked: t({ message: "Asked of you", context: "follow-ups: a source" }),
    yours: t({ message: "Your asks", context: "follow-ups: a source" }),
    role: t({ message: "Asked of a role", context: "follow-ups: a source" }),
  };
  const groupName: Record<FollowGroup, string> = {
    today: t({ message: "Today", context: "follow-ups: a group" }),
    later: t({ message: "Coming up", context: "follow-ups: a group" }),
    others: t({ message: "Waiting on others", context: "follow-ups: a group" }),
  };

  if (!loaded) return null;

  const ok = <T,>(r: Read<T>): T | null => (r === "failed" ? null : r);
  const failed = [board, asks, raised].some((r) => r === "failed");
  const rows = followUpRows({ board: ok(board), asks: ok(asks), raised: ok(raised), today: readerToday() });
  if (!rows.length && !failed) return null;

  const present = FOLLOW_SOURCES.filter((s) => rows.some((r) => r.source === s));
  const shown = filter === "all" || !present.includes(filter) ? rows : rows.filter((r) => r.source === filter);
  const mine = rows.filter((r) => r.group !== "others").length;

  const tick = async (row: FollowRow) => {
    if (!row.tick || ticking) return;
    setTicking(row.key);
    setError("");
    try {
      const url = row.tick.kind === "task" ? taskDoneUrl(row.tick.id) : `${ASKS_URL}/${encodeURIComponent(row.tick.id)}/done`;
      const res = await gameFetch(url, { method: "POST", body: "{}" });
      if (res.ok) {
        setTicked((k) => [...k, row.key]);
        announceProfileChange();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(typeof body?.error === "string" && /\s/.test(body.error) ? body.error : t({ message: "That did not save. Try again.", context: "follow-ups: a tick that failed" }));
      }
    } catch {
      setError(t({ message: "That did not save. Try again.", context: "follow-ups: a tick that failed" }));
    } finally {
      setTicking(null);
    }
  };

  const meta = (r: FollowRow) => {
    const when = r.dueOn ? taskDateWords(r.dueOn, readerToday()) : "";
    const parts: string[] = [];
    if (r.source === "asked") parts.push(t({ message: `From ${r.with}`, context: "follow-ups: who asked" }));
    else if (r.source === "yours") parts.push(t({ message: `Waiting on ${r.with}`, context: "follow-ups: who you asked" }));
    else if (r.source === "role") parts.push(t({ message: `With ${r.with}`, context: "follow-ups: the role you asked" }));
    else parts.push(r.with);
    if (r.blocking) parts.push(t({ message: "Someone is stuck until it is done", context: "follow-ups: a blocking ask" }));
    if (when) parts.push(r.source === "role" ? t({ message: `Around the week of ${when}`, context: "follow-ups: when a role expects to pick it up" }) : t({ message: `By ${when}`, context: "follow-ups: a date" }));
    return parts.join(" · ");
  };

  const row = (r: FollowRow) => {
    const Icon = ICON[r.source];
    const done = ticked.includes(r.key);
    const external = /^https?:/i.test(r.href);
    return (
      <li key={r.key} data-follow-row={r.source} data-follow-done={done ? "" : undefined} className="flex min-h-14 items-center gap-3 border-b border-border/60 py-2 last:border-b-0">
        {r.tick ? (
          <button
            type="button"
            onClick={() => void tick(r)}
            disabled={done || ticking !== null}
            aria-label={t({ message: `Mark done: ${r.title}`, context: "follow-ups: the tick, read aloud" })}
            aria-pressed={done}
            className={`jw-btn inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-notice bg-notice/15 text-notice" : "border-border text-transparent hover:border-notice"}`}
          >
            <Sprout className={`h-5 w-5 ${done ? "follow-sprout" : ""}`} aria-hidden="true" />
          </button>
        ) : (
          <span className="inline-flex size-11 shrink-0" aria-hidden="true" />
        )}
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-notice" title={label[r.source]} aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={r.href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            onClick={r.href.startsWith("#") ? () => onGo?.(r.href) : undefined}
            className={`block break-words font-medium text-foreground underline-offset-4 hover:underline ${done ? "line-through opacity-60" : ""}`}
          >
            {r.title}
          </a>
          <span className="block text-sm text-muted-foreground">
            <span className="sr-only">{label[r.source]}: </span>
            {meta(r)}
          </span>
        </div>
      </li>
    );
  };

  return (
    <section aria-labelledby={`${base}-h`} className={CARD} id="follow-ups" data-follow-ups="">
      <p className={EYEBROW}>{t({ message: "Follow-ups", context: "follow-ups: eyebrow" })}</p>
      <h2 id={`${base}-h`} className={`mt-1 ${H2}`}>
        {mine === 0
          ? t({ message: "Nothing is yours to do right now", context: "follow-ups: heading with nothing of yours" })
          : mine === 1
            ? t({ message: "One thing is yours to do", context: "follow-ups: heading" })
            : t({ message: `${mine} things are yours to do`, context: "follow-ups: heading" })}
      </h2>

      {present.length > 1 ? (
        <div role="group" aria-label={t({ message: "Show follow-ups from", context: "follow-ups: the filter, read aloud" })} className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {(["all", ...present] as const).map((s) => {
            const on = filter === s || (s === "all" && !present.includes(filter as FollowSource));
            const Icon = s === "all" ? null : ICON[s];
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(s)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${on ? "border-notice bg-notice text-background" : "border-border bg-card text-foreground hover:bg-muted"}`}
              >
                {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                {s === "all" ? t({ message: "All", context: "follow-ups: the filter" }) : label[s]}
              </button>
            );
          })}
        </div>
      ) : null}

      {FOLLOW_GROUPS.map((g) => {
        const list = inGroup(shown, g);
        if (!list.length) return null;
        return (
          <div key={g} className="mt-4" data-follow-group={g}>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{groupName[g]}</h3>
            <ul className="mt-1">{list.map(row)}</ul>
          </div>
        );
      })}

      {failed ? (
        <p role="alert" className={`mt-4 ${HINT}`}>
          {t({ message: "Some of your follow-ups did not load, so this list may be short.", context: "follow-ups: a read failed" })}{" "}
          <button type="button" onClick={() => void load()} className={`${LINK} inline-flex min-h-11 items-center`}>
            {t({ message: "Try again", context: "follow-ups: retry the reads" })}
          </button>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
