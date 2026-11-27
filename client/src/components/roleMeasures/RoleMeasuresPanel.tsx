/**
 * HOW ROLES ARE GOING, where the roles live (the fold of /role-measures into
 * Circles & Roles, 27 Nov 2026).
 *
 * The measures were their own page, reached by one small link on /roles. They
 * are a circle's numbers (the server groups them by season and by the circle
 * each application's first role sits in), so they now sit with the circle:
 *
 *   - on a circle's page (`circleId` given): that circle's two chains, the
 *     applying chain and the holding chain, for the season picked;
 *   - on the circles page (no `circleId`): every circle for the season picked,
 *     one row each with its three headline numbers, opening to both chains,
 *     and the roles in no circle last.
 *
 * Each chain is drawn as stones on a thread (five for applying, four for holding the role):
 * on a phone the thread runs down the screen, from `sm` up it runs across.
 *
 * WHO SEES IT (the lead, 27 Nov 2026): an administrator sees every circle; a
 * circle's lead sees their own circle, on the circles page and on that circle's
 * page, and never another's. The server decides (server/routes/roleMeasures.ts):
 * a visitor asks nothing, and a signed-in member the server refuses sees
 * nothing at all, not even an empty panel. No names.
 *
 * 0 AND NO DATA. Every number we have shows, however few people it counts. A
 * real zero reads 0. A measure with nothing recorded arrives as null
 * (`NO_DATA`) and reads "no data".
 *
 * `#role-measures` lands here: the old address redirects to
 * `/circles#role-measures`, and a circle's own row links to
 * `/circles/<id>#role-measures`.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useLingui } from "@lingui/react/macro";
import { plural } from "@lingui/core/macro";
import { ArrowRight, ChevronDown } from "lucide-react";
import { BreathingLoader } from "@/components/natural";
import { useIsAdmin, useOptionalAuth } from "@/contexts/AuthContext";
import { gameFetch, useSeason } from "@/lib/gameApi";
import { failureWords } from "@/lib/failureWords";
import { goToSection, holdSection } from "@/lib/sectionAnchor";
import { BTN_SECONDARY, CARD, CHIP_SOFT, EYEBROW, H2, HINT, LINK, RING, TILE } from "@/components/journey/look";
import { SeedOfLife } from "@/components/sacred/glyphs";
import { GROUP_BREAK } from "@/components/roleCard/groupLook";
import type { Share } from "@shared/roleMeasures";
import { isEmptyRow, percent, rowsFor, seasonsOf, span, type ServedRow } from "./measuresView";

/** The chosen season: BTN_SECONDARY's shape, held in a gold ring (a gold fill would read as earned). */
const SEASON_ON =
  "jw-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-notice bg-notice/10 px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50";

/** The section's id, which the old address and each circle's row land on. */
export const MEASURES_ANCHOR = "role-measures";

/**
 * `chapter`: drawn as a page's own chapter (the circles page), under the gold
 * rule. The rule belongs to the panel, so a reader the server refuses sees no
 * empty wrapper either.
 */
export default function RoleMeasuresPanel({ circleId, chapter = false }: { circleId?: string; chapter?: boolean }) {
  const user = useOptionalAuth()?.user;
  return user ? <Measures circleId={circleId} chapter={chapter} /> : null;
}

/** What the server let this reader see: the village (an admin) or the circles they lead. */
type Scope = "village" | "circles";

function Measures({ circleId, chapter }: { circleId?: string; chapter: boolean }) {
  const { t } = useLingui();
  const admin = useIsAdmin();
  const [rows, setRows] = useState<ServedRow[] | null>(null);
  const [scope, setScope] = useState<Scope>(admin ? "village" : "circles");
  // Refused: a member who leads no circle here. They see nothing, and nothing says why.
  const [refused, setRefused] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const season = useSeason();

  useEffect(() => {
    let live = true;
    setProblem(null);
    gameFetch(circleId === undefined ? "/api/role-measures" : `/api/role-measures?circle=${encodeURIComponent(circleId)}`)
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) return null;
        if (!r.ok) throw new Error(t({ message: "Could not read the measures.", context: "role measures, failed" }));
        return r.json();
      })
      .then((j) => {
        if (!live) return;
        if (j === null) return setRefused(true);
        setScope(j?.scope === "village" ? "village" : "circles");
        setRows(Array.isArray(j?.rows) ? j.rows : []);
      })
      .catch((e) => {
        if (!live) return;
        // Only an admin is told a read failed. Anybody else may lead nothing here, so a failure draws nothing for them.
        if (!admin) return setRefused(true);
        setProblem(failureWords(e));
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, circleId]);

  // Arriving on #role-measures: land once the numbers are drawn, and hold while the page above finishes drawing.
  const ready = rows !== null || problem !== null;
  useEffect(() => {
    if (!ready || typeof window === "undefined" || window.location.hash !== `#${MEASURES_ANCHOR}`) return;
    let release = () => {};
    const frame = requestAnimationFrame(() => {
      if (goToSection(MEASURES_ANCHOR, { push: false })) release = holdSection(MEASURES_ANCHOR);
    });
    return () => {
      cancelAnimationFrame(frame);
      release();
    };
  }, [ready]);

  const mine = useMemo(() => (rows ?? []).filter((r) => circleId === undefined || r.circleId === circleId), [rows, circleId]);
  const seasons = useMemo(() => seasonsOf(mine, season?.current?.id ?? null), [mine, season?.current?.id]);
  const shown = picked !== undefined && seasons.includes(picked) ? picked : (seasons[0] ?? null);
  const names = new Map((season?.seasons ?? []).map((s) => [s.id, s.name]));
  const seasonName = (id: string | null) => (id === null ? t({ message: "No season", context: "role measures, a season chip" }) : (names.get(id) ?? id));
  const list = rowsFor(mine, shown, circleId);

  if (refused || (!admin && rows === null && problem === null)) return null;

  const panel = (
    <section id={MEASURES_ANCHOR} aria-labelledby="role-measures-heading" className={`${CARD} @container scroll-mt-44`} data-testid="role-measures-panel">
      <div className="flex items-center gap-4">
        <span className={RING} aria-hidden="true">
          <SeedOfLife className="size-6" />
        </span>
        <div className="min-w-0">
          <p className={EYEBROW}>
            {circleId === undefined
              ? t({ message: "Administrators see every circle; each lead sees their own", context: "role measures, eyebrow on the circles page" })
              : t({ message: "Only this circle's lead and administrators see this", context: "role measures, eyebrow for a circle's lead" })}
          </p>
          <h2 id="role-measures-heading" tabIndex={-1} data-section-focus="" className={`${H2} mt-1 outline-none`}>
            {circleId === undefined ? t`How roles are going` : t({ message: "How roles are going here", context: "role measures, a circle's page" })}
          </h2>
        </div>
      </div>
      <ul className={`${HINT} mt-3 list-disc space-y-1 pl-5`}>
        <li>{t({ message: "Counts and medians from stamped times. No names.", context: "role measures, how to read" })}</li>
        <li>{t({ message: "No data means nothing has been recorded yet. 0 means none.", context: "role measures, how to read" })}</li>
      </ul>

      {problem ? (
        <div role="alert" className={`${TILE} mt-5 flex flex-wrap items-center justify-between gap-3`}>
          <p className="text-foreground">{problem}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className={BTN_SECONDARY}>
            {t({ message: "Try again", context: "role measures, failed read" })}
          </button>
        </div>
      ) : rows === null ? (
        <div className="mt-5">
          <BreathingLoader />
        </div>
      ) : mine.length === 0 ? (
        <p className={`${HINT} mt-5`} data-testid="measures-empty">
          {circleId === undefined
            ? t({ message: "Nothing has been stamped yet.", context: "role measures, empty" })
            : t({ message: "Nothing has been stamped for this circle yet.", context: "role measures, empty circle" })}
        </p>
      ) : (
        <>
          {seasons.length > 1 ? (
            <div role="group" aria-label={t({ message: "Season", context: "role measures, season picker" })} className="mt-5 flex flex-wrap gap-2">
              {seasons.map((s) => (
                <button
                  key={s ?? "none"}
                  type="button"
                  aria-pressed={s === shown}
                  onClick={() => setPicked(s)}
                  className={s === shown ? SEASON_ON : BTN_SECONDARY}
                >
                  {seasonName(s)}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-5">
              <span className={CHIP_SOFT}>{seasonName(shown)}</span>
            </p>
          )}

          {circleId !== undefined ? (
            list[0] ? (
              <Chains row={list[0]} />
            ) : null
          ) : (
            <ul className="mt-5 grid gap-3" data-testid="measures-circles">
              {list.map((r) => (
                <CircleRow key={r.circleId ?? "none"} row={r} open={scope === "circles" && list.length === 1} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
  return chapter ? <div className={`mx-auto mt-16 max-w-4xl ${GROUP_BREAK}`}>{panel}</div> : panel;
}

/** One circle on the circles page: its name and three headline numbers, opening to both chains (open from the start for a lead's one circle). */
function CircleRow({ row, open = false }: { row: ServedRow; open?: boolean }) {
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
              <Headline label={t({ message: "Seated", context: "role measures, holding chain" })} value={String(row.holders.count)} />
            </span>
            <ChevronDown className="hidden size-5 shrink-0 text-notice motion-safe:transition-transform group-open:rotate-180 sm:block" aria-hidden="true" />
          </span>
        </summary>
        <div className="border-t border-border px-4 pb-4">
          {isEmptyRow(row) ? null : <Chains row={row} />}
          {row.circleId !== null ? (
            <p className="mt-4">
              <Link href={`/circles/${encodeURIComponent(row.circleId)}#${MEASURES_ANCHOR}`} className={`${LINK} inline-flex min-h-11 items-center gap-1`}>
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

/** A circle's row on the circles page: a tile that opens. */
const ROW = "rounded-xl border border-border bg-muted";

/** Numerals that line up and never read as letters (the display face's old-style "1" reads as "I"). */
const NUM = "lining-nums tabular-nums";

/** What a measure with nothing recorded shows (NO_DATA, null). A real zero never reaches here: it reads 0. */
function NoData() {
  const { t } = useLingui();
  return <span className={CHIP_SOFT} data-no-data="">{t({ message: "no data", context: "role measures, nothing recorded" })}</span>;
}

/** One headline number on a circle's row, read as "Applied 7": its name small, the numeral large under it. */
function Headline({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="block min-w-0">
      <span className="block text-xs text-muted-foreground">{label}</span>{" "}
      <span className="mt-0.5 block">
        {value === null ? <NoData /> : <span className={`font-display text-2xl leading-none text-foreground ${NUM}`}>{value}</span>}
      </span>
    </span>
  );
}

interface Step {
  label: string;
  /** The number as read (0 included), or null where nothing was recorded. */
  value: string | null;
  /** The size it was measured on ("9 of 12"), or a word on what kind of number it is. */
  sub?: string;
}

/** The two chains: from applying to a decision, and from a seat to a renewal. */
function Chains({ row }: { row: ServedRow }) {
  const { t } = useLingui();
  const of = ({ yes, eligible: all }: Share) => (all === 0 ? undefined : t({ message: `${yes} of ${all}`, context: "role measures, the size a share was measured on" }));
  const share = (s: Share): Pick<Step, "value" | "sub"> => {
    const p = percent(s);
    return { value: p === null ? null : `${p}%`, sub: of(s) };
  };
  const time = (h: number | null): Step["value"] => {
    const s = span(h);
    if (!s) return null;
    const n = s.n;
    if (s.unit === "under-an-hour") return t({ message: "under an hour", context: "role measures, a median shorter than an hour" });
    return s.unit === "hours" ? plural(n, { one: "# hour", other: "# hours" }) : plural(n, { one: "# day", other: "# days" });
  };
  const median = t({ message: "median", context: "role measures, a kind of number" });
  const a = row.applications;
  const h = row.holders;
  const timed = (hours: number | null): Pick<Step, "value" | "sub"> => ({ value: time(hours), sub: median });
  const applying: Step[] = [
    { label: t({ message: "Applied", context: "role measures, applying chain" }), value: String(a.count) },
    { label: t({ message: "Answered", context: "role measures, applying chain" }), ...share(a.answered) },
    { label: t({ message: "First reply", context: "role measures, applying chain" }), ...timed(a.medianHoursToReply) },
    { label: t({ message: "First interview", context: "role measures, applying chain" }), ...timed(a.medianHoursToInterview) },
    { label: t({ message: "Decision", context: "role measures, applying chain" }), ...timed(a.medianHoursToDecision) },
  ];
  const holding: Step[] = [
    { label: t({ message: "Seated", context: "role measures, holding chain" }), value: String(h.count) },
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

/** Across, the thread runs from the first stone's centre to the last: five stones for applying, four for holding the role. */
const ACROSS = {
  4: { cols: "@2xl:grid-cols-4", thread: "@2xl:left-[12.5%] @2xl:right-[12.5%]" },
  5: { cols: "@2xl:grid-cols-5", thread: "@2xl:left-[10%] @2xl:right-[10%]" },
} as const;

/** A stone whose number was withheld: the ring's shape in the quiet edge. */
const STONE_DIM = "inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-border text-muted-foreground";

/**
 * Stones on a thread: down the screen while the panel is narrow (a phone, or a circle's page's
 * reading column on a desktop), across once the panel itself is 42rem wide (`@2xl`, the section's container).
 */
function Chain({ title, steps }: { title: string; steps: readonly Step[] }) {
  return (
    <div>
      {/* The span carries the kicker's face (`font-body`, the village's body face): the sheet sets every heading in the display face (index.css). */}
      <h3>
        <span className={`font-body ${EYEBROW}`}>{title}</span>
      </h3>
      <div className="relative mt-3">
      <span aria-hidden="true" className={`absolute bottom-6 left-[21px] top-6 w-px bg-border @2xl:bottom-auto @2xl:top-[21px] @2xl:h-px @2xl:w-auto ${ACROSS[steps.length === 4 ? 4 : 5].thread}`} />
      <ol className={`relative grid gap-3 @2xl:gap-2 ${ACROSS[steps.length === 4 ? 4 : 5].cols}`}>
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex items-center gap-3 @2xl:flex-col @2xl:items-center @2xl:gap-2 @2xl:text-center">
            <span className={`${s.value === null ? STONE_DIM : RING} bg-card text-sm font-semibold ${NUM}`} aria-hidden="true">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 text-sm text-muted-foreground @2xl:order-3 @2xl:flex-none">{s.label}</span>
            <span className="shrink-0 text-right @2xl:order-2 @2xl:text-center">
              {s.value === null ? (
                <NoData />
              ) : (
                <span className={`block font-display text-2xl leading-tight text-foreground ${NUM}`}>{s.value}</span>
              )}
              {s.sub && s.value !== null ? <span className="block text-xs text-muted-foreground">{s.sub}</span> : null}
            </span>
          </li>
        ))}
      </ol>
      </div>
    </div>
  );
}
