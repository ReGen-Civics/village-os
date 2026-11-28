/**
 * The pieces the role progress page draws with (client/src/pages/RoleProgress.tsx): the stones on a thread, a
 * circle's row, a headline number and the "no data" chip. The look is the sheet's (journey/look.ts): gold rings for
 * a number we have, a quiet ring for one with nothing recorded.
 *
 * 0 AND NO DATA. Every number we have shows, however few people it counts. A real zero reads 0. A measure with
 * nothing recorded arrives as null (`NO_DATA` in shared/roleMeasures.ts) and reads "no data".
 */
import { Link } from "wouter";
import { useLingui } from "@lingui/react/macro";
import { plural } from "@lingui/core/macro";
import { ArrowRight, ChevronDown } from "lucide-react";
import { CHIP_SOFT, EYEBROW, LINK, RING } from "@/components/journey/look";
import type { Share } from "@shared/roleMeasures";
import { isEmptyRow, percent, span, type ServedRow } from "./measuresView";

/** Numerals that line up and never read as letters (the display face's old-style "1" reads as "I"). */
export const NUM = "lining-nums tabular-nums";

/** What a measure with nothing recorded shows (NO_DATA, null). A real zero never reaches here: it reads 0. */
export function NoData() {
  const { t } = useLingui();
  return <span className={CHIP_SOFT} data-no-data="">{t({ message: "no data", context: "role measures, nothing recorded" })}</span>;
}

/** The ways a number is said: a share with what it was measured on, a median length of time. */
export function useReadings() {
  const { t } = useLingui();
  const of = ({ yes, eligible: all }: Share) => (all === 0 ? undefined : t({ message: `${yes} of ${all}`, context: "role measures, the size a share was measured on" }));
  const share = (s: Share): { value: string | null; sub?: string } => {
    const p = percent(s);
    return { value: p === null ? null : `${p}%`, sub: of(s) };
  };
  const time = (h: number | null): string | null => {
    const s = span(h);
    if (!s) return null;
    const n = s.n;
    if (s.unit === "under-an-hour") return t({ message: "under an hour", context: "role measures, a median shorter than an hour" });
    return s.unit === "hours" ? plural(n, { one: "# hour", other: "# hours" }) : plural(n, { one: "# day", other: "# days" });
  };
  const median = t({ message: "median", context: "role measures, a kind of number" });
  const timed = (hours: number | null): { value: string | null; sub?: string } => ({ value: time(hours), sub: median });
  return { share, time, timed, median };
}

/** One headline number on a circle's row, read as "Applied 7": its name small, the numeral large under it. */
export function Headline({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="block min-w-0">
      <span className="block text-xs text-muted-foreground">{label}</span>{" "}
      <span className="mt-0.5 block">
        {value === null ? <NoData /> : <span className={`font-display text-2xl leading-none text-foreground ${NUM}`}>{value}</span>}
      </span>
    </span>
  );
}

export interface Step {
  label: string;
  /** The number as read (0 included), or null where nothing was recorded. */
  value: string | null;
  /** The size it was measured on ("9 of 12"), or a word on what kind of number it is. */
  sub?: string;
}

/** The two chains of one circle: from applying to a decision, and from a seat to a renewal (no quest step). */
export function Chains({ row }: { row: ServedRow }) {
  const { t } = useLingui();
  const { share, timed } = useReadings();
  const a = row.applications;
  const h = row.holders;
  const applying: Step[] = [
    { label: t({ message: "Applied", context: "role measures, applying chain" }), value: String(a.count) },
    { label: t({ message: "Answered", context: "role measures, applying chain" }), ...share(a.answered) },
    { label: t({ message: "First reply", context: "role measures, applying chain" }), ...timed(a.medianHoursToReply) },
    { label: t({ message: "First interview", context: "role measures, applying chain" }), ...timed(a.medianHoursToInterview) },
    { label: t({ message: "Decision", context: "role measures, applying chain" }), ...timed(a.medianHoursToDecision) },
  ];
  const holding: Step[] = [
    { label: t({ message: "Seated now (current holders)", context: "role measures, holding chain" }), value: String(h.count) },
    { label: t({ message: "Path done by day 30", context: "role measures, holding chain" }), ...share(h.pathCompleteBy30) },
    { label: t({ message: "Still in the role at day 90", context: "role measures, holding chain" }), ...share(h.stillInRoleAt90) },
    { label: t({ message: "Renewed at each moon", context: "role measures, holding chain" }), ...share(h.renewed) },
  ];
  return (
    <div className="mt-5 grid gap-6">
      <Chain title={t({ message: "Applying", context: "role measures, chain heading" })} steps={applying} />
      <Chain title={t({ message: "Holding the role", context: "role measures, chain heading" })} steps={holding} />
    </div>
  );
}

/** Across, the thread runs from the first stone's centre to the last: five stones, or four. */
const ACROSS = {
  4: { cols: "@2xl:grid-cols-4", thread: "@2xl:left-[12.5%] @2xl:right-[12.5%]" },
  5: { cols: "@2xl:grid-cols-5", thread: "@2xl:left-[10%] @2xl:right-[10%]" },
} as const;

/** A stone with nothing recorded: the ring's shape in the quiet edge. */
const STONE_DIM = "inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-border text-muted-foreground";

/**
 * Stones on a thread: down the screen while the panel is narrow (a phone), across once the panel itself is 42rem
 * wide (`@2xl`, the nearest `@container`).
 */
export function Chain({ title, steps }: { title: string; steps: readonly Step[] }) {
  const across = ACROSS[steps.length === 4 ? 4 : 5];
  return (
    <div>
      {/* The span carries the kicker's face (`font-body`, the village's body face): the sheet sets every heading in the display face (index.css). */}
      <h3>
        <span className={`font-body ${EYEBROW}`}>{title}</span>
      </h3>
      <div className="relative mt-3">
        <span aria-hidden="true" className={`absolute bottom-6 left-[21px] top-6 w-px bg-border @2xl:bottom-auto @2xl:top-[21px] @2xl:h-px @2xl:w-auto ${across.thread}`} />
        <ol className={`relative grid gap-3 @2xl:gap-2 ${across.cols}`}>
          {steps.map((s, i) => (
            <li key={s.label} className="relative flex items-center gap-3 @2xl:flex-col @2xl:items-center @2xl:gap-2 @2xl:text-center">
              <span className={`${s.value === null ? STONE_DIM : RING} bg-card text-sm font-semibold ${NUM}`} aria-hidden="true">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm text-muted-foreground @2xl:order-3 @2xl:flex-none">{s.label}</span>
              <span className="shrink-0 whitespace-nowrap text-right @2xl:order-2 @2xl:text-center">
                {s.value === null ? <NoData /> : <span className={`block font-display text-2xl leading-tight text-foreground ${NUM}`}>{s.value}</span>}
                {s.sub && s.value !== null ? <span className="block text-xs text-muted-foreground">{s.sub}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** A circle's row: a tile that opens. */
const ROW = "rounded-xl border border-border bg-muted";

/**
 * One circle: its name and three headline numbers, opening to both chains (open from the start when it is the
 * reader's only circle), with doors to the circle's own page and to this page filtered to it.
 */
export function CircleRow({ row, open = false, onPick }: { row: ServedRow; open?: boolean; onPick?: (circleId: string) => void }) {
  const { t } = useLingui();
  const answered = percent(row.applications.answered);
  const name = row.circleId === null ? t({ message: "Roles not in a circle", context: "role measures, a row" }) : (row.circleName ?? row.circleId);
  return (
    <li>
      <details className={`${ROW} group`} open={open} data-circle-measures={row.circleId ?? ""}>
        <summary className="grid cursor-pointer list-none gap-3 rounded-xl p-4 hover:bg-card/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center [&::-webkit-details-marker]:hidden">
          <span className="flex min-h-11 items-center justify-between gap-3">
            <span className="min-w-0 font-display text-xl text-foreground">{name}</span>
            <ChevronDown className="size-5 shrink-0 text-notice motion-safe:transition-transform group-open:rotate-180 sm:hidden" aria-hidden="true" />
          </span>
          <span className="flex items-center gap-4">
            <span className="grid flex-1 grid-cols-3 gap-2 sm:w-80 sm:flex-none sm:gap-4">
              <Headline label={t({ message: "Applied", context: "role measures, applying chain" })} value={String(row.applications.count)} />
              <Headline label={t({ message: "Answered", context: "role measures, applying chain" })} value={answered === null ? null : `${answered}%`} />
              <Headline label={t({ message: "Seated now (current holders)", context: "role measures, holding chain" })} value={String(row.holders.count)} />
            </span>
            <ChevronDown className="hidden size-5 shrink-0 text-notice motion-safe:transition-transform group-open:rotate-180 sm:block" aria-hidden="true" />
          </span>
        </summary>
        <div className="border-t border-border px-4 pb-4">
          {isEmptyRow(row) ? null : <Chains row={row} />}
          {row.circleId !== null ? (
            <p className="mt-4 flex flex-wrap gap-x-6">
              {onPick ? (
                <button type="button" onClick={() => onPick(row.circleId as string)} className={`${LINK} inline-flex min-h-11 items-center gap-1`}>
                  {t({ message: "Show only this circle", context: "role measures, filter to one circle" })}
                </button>
              ) : null}
              <Link href={`/circles/${encodeURIComponent(row.circleId)}`} className={`${LINK} inline-flex min-h-11 items-center gap-1`}>
                {t({ message: "Open this circle", context: "role measures, door to a circle" })}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </p>
          ) : null}
        </div>
      </details>
    </li>
  );
}
