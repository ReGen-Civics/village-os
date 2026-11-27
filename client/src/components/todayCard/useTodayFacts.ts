/**
 * WHAT THE MEMBER HAS GOING ON TODAY, for their card (shared/myCard.ts `TodayFacts`).
 *
 * Nothing here is new on the server: each line comes off a door the profile already reads for this member
 * (components/profileDash/useDashData.ts names them all), read once when the card opens. Two things come out:
 *
 *   facts  COUNTS ONLY, sent with the pull so the reading can speak to the day. A title never leaves the
 *          browser, so nothing another member wrote reaches the guide.
 *   rows   what the card's "Today in the village" list draws, titles and links included, for the member alone.
 *
 * Every read that fails or whose module is off simply adds nothing: an off module has no routes, so its read is
 * not even made. `ready` turns true once every read made has answered or failed.
 */
import { useEffect, useState } from "react";
import { gameFetch } from "@/lib/gameApi";
import { moduleIsOn, useModules } from "@/modules/ModuleProvider";
import { WAITING_URL } from "@shared/waitingOnYou";
import { ASKS_URL } from "@shared/memberAsks";
import { TASK_BOARD_PATH } from "@shared/taskMenu";
import { NO_FACTS, type TodayFacts } from "@shared/myCard";
import { localDate } from "@/lib/todayCardApi";

export type TodayRowKind = "decision" | "quest" | "task" | "ask" | "session" | "gathering";

export interface TodayRow {
  key: string;
  kind: TodayRowKind;
  /** The thing itself, in its own words: a quest's title, a circle's meeting. Absent for a row that only counts. */
  title: string | null;
  /** How many, for a row that stands for several. */
  count: number;
  /** A time today, for a session or a gathering. */
  at: string | null;
  href: string;
}

async function read<T>(url: string): Promise<T | null> {
  try {
    const r = await gameFetch(url);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

const DAY_MS = 86_400_000;
const sameDay = (iso: string, day: string): boolean => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) && localDate(d) === day;
};
const listLength = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

export function useTodayFacts(on: boolean): { facts: TodayFacts; rows: TodayRow[]; ready: boolean } {
  const modules = useModules();
  const sessionsOn = moduleIsOn(modules, "sessions");
  const [state, setState] = useState<{ facts: TodayFacts; rows: TodayRow[]; ready: boolean }>({ facts: NO_FACTS, rows: [], ready: false });

  useEffect(() => {
    if (!on || !modules.loaded) return;
    let live = true;
    const today = localDate();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + DAY_MS);
    type QuestRow = { questId: string; questTitle: string; status: string };
    type SessionRow = { circleName: string; nextTitle: string | null; mine: boolean; openRoom: { id: number } | null; next?: { at?: string } };
    type EventRow = { id: string; title: string; startsAt: string };
    Promise.all([
      read<{ quests?: QuestRow[] }>("/api/game/me"),
      read<Record<string, unknown>>(WAITING_URL),
      read<{ waitingOnYou?: unknown[] }>(ASKS_URL),
      sessionsOn ? read<{ waiting?: number }>("/api/sessions/tasks/count") : Promise.resolve(null),
      sessionsOn ? read<{ comingUp?: { rows?: SessionRow[] } }>("/api/sessions") : Promise.resolve(null),
      read<{ events?: EventRow[] }>(`/api/events?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}&kinds=gathering,festival`),
      read<{ cycleNumber?: number; startsAt?: string; endsAt?: string }>("/api/game/cycle"),
      read<{ current: { name: string; startsOn: string; endsOn?: string | null } | null; today: string }>("/api/season"),
    ]).then(([me, waiting, asks, tasks, sessions, events, cycle, season]) => {
      if (!live) return;
      const rows: TodayRow[] = [];
      // Every kind of decision the waiting board holds, counted together: a consent, an adoption, a tension raised with a role.
      const decisions = waiting
        ? ["applications", "drafts", "toAccept", "raisedWithYou", "toConsent", "openProposals"].reduce((n, k) => n + listLength(waiting[k]), 0)
        : 0;
      if (decisions) rows.push({ key: "decisions", kind: "decision", title: null, count: decisions, at: null, href: "/profile#waiting" });
      const inHand = (me?.quests ?? []).filter((q) => q && (q.status === "claimed" || q.status === "submitted") && typeof q.questTitle === "string");
      for (const q of inHand.slice(0, 3)) rows.push({ key: `quest-${q.questId}`, kind: "quest", title: q.questTitle, count: 1, at: null, href: `/quests/${encodeURIComponent(q.questId)}` });
      const taskCount = typeof tasks?.waiting === "number" && tasks.waiting > 0 ? tasks.waiting : 0;
      if (taskCount) rows.push({ key: "tasks", kind: "task", title: null, count: taskCount, at: null, href: TASK_BOARD_PATH });
      const askCount = listLength(asks?.waitingOnYou);
      if (askCount) rows.push({ key: "asks", kind: "ask", title: null, count: askCount, at: null, href: "/profile#waiting" });
      const meetings = (sessions?.comingUp?.rows ?? []).filter((r) => r?.mine && ((r.next?.at && sameDay(r.next.at, today)) || r.openRoom));
      for (const r of meetings.slice(0, 3)) {
        rows.push({
          key: `session-${r.circleName}`,
          kind: "session",
          title: r.nextTitle || r.circleName,
          count: 1,
          at: r.openRoom ? null : (r.next?.at ?? null),
          href: r.openRoom ? `/sessions/${r.openRoom.id}` : "/sessions",
        });
      }
      const gatherings = (events?.events ?? []).filter((e) => e && typeof e.title === "string" && sameDay(e.startsAt, today));
      for (const e of gatherings.slice(0, 3)) rows.push({ key: `gathering-${e.id}`, kind: "gathering", title: e.title, count: 1, at: e.startsAt, href: "/events" });

      const dayIn = (from: string, to: number) => Math.max(1, Math.floor((to - Date.parse(from)) / DAY_MS) + 1);
      const moon =
        cycle && typeof cycle.cycleNumber === "number" && cycle.startsAt && cycle.endsAt
          ? { n: cycle.cycleNumber, day: dayIn(cycle.startsAt, Date.now()), of: Math.max(1, Math.round((Date.parse(cycle.endsAt) - Date.parse(cycle.startsAt)) / DAY_MS)) }
          : null;
      const cur = season?.current;
      const seasonFacts = cur?.name
        ? {
            name: cur.name,
            day: season?.today ? dayIn(cur.startsOn.slice(0, 10), Date.parse(season.today.slice(0, 10))) : null,
            of: cur.endsOn ? dayIn(cur.startsOn.slice(0, 10), Date.parse(cur.endsOn.slice(0, 10))) : null,
          }
        : null;
      setState({
        ready: true,
        rows,
        facts: {
          quests: inHand.length,
          tasks: taskCount,
          decisions,
          asks: askCount,
          sessions: meetings.length,
          gatherings: gatherings.length,
          moon,
          season: seasonFacts,
        },
      });
    });
    return () => {
      live = false;
    };
  }, [on, modules.loaded, sessionsOn]);

  return state;
}
