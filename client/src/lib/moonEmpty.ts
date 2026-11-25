/**
 * WHETHER A WHOLE MOON HAS NOTHING ON IT (UNFINISHED-AREAS 5a; the every-page audit, 24 Nov 2026).
 *
 * The moon view drew its spiral and "Nothing is on this day yet." under every day of a moon nobody had put a
 * thing in, which read as a broken calendar. The page says one coming-soon line instead when this is true. What
 * the platform marks on its own (the season, the sky, the moon's own turnings) and the standing examples do not
 * count as something on: a gathering, a festival, a quest window, a call or anything a module mirrors in does.
 */
import type { CalendarItem } from "@shared/gatherings";

const NOT_SOMETHING_ON: ReadonlySet<string> = new Set(["season", "sky", "cycle-mark"]);

export function moonIsEmpty(dayKeys: readonly string[], byDay: ReadonlyMap<string, readonly Pick<CalendarItem, "kind" | "isExample">[]>): boolean {
  return dayKeys.every((key) => (byDay.get(key) ?? []).every((i) => NOT_SOMETHING_ON.has(i.kind) || i.isExample === true));
}
