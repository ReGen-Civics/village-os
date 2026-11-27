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
 * Each chain is drawn as five stones on a thread, the way a quest chain reads:
 * on a phone the thread runs down the screen, from `sm` up it runs across.
 *
 * ADMIN ONLY, as the page was. For anybody else this renders nothing and asks
 * the server for nothing; the server (server/routes/roleMeasures.ts) refuses
 * everybody else whatever the client does. No names: a number built from fewer
 * than three people arrives withheld and reads "too few".
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
import { useIsAdmin } from "@/contexts/AuthContext";
import { gameFetch, useSeason } from "@/lib/gameApi";
import { failureWords } from "@/lib/failureWords";
import { goToSection, holdSection } from "@/lib/sectionAnchor";
import { BTN_SECONDARY, CARD, CHIP_SOFT, EYEBROW, H2, HINT, LINK, RING, TILE } from "@/components/journey/look";
import { SeedOfLife } from "@/components/sacred/glyphs";
import type { Share } from "@shared/roleMeasures";
import { isEmptyRow, percent, rowsFor, seasonsOf, span, type ServedRow } from "./measuresView";

/** The chosen season: BTN_SECONDARY's shape, held in a gold ring (a gold fill would read as earned). */
const SEASON_ON =
  "jw-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-notice bg-notice/10 px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50";

/** The section's id, which the old address and each circle's row land on. */
export const MEASURES_ANCHOR = "role-measures";

export default function RoleMeasuresPanel({ circleId }: { circleId?: string }) {
  const admin = useIsAdmin();
  return admin ? <Measures circleId={circleId} /> : null;
}

function Measures({ circleId }: { circleId?: string }) {
  const { t } = useLingui();
  const [rows, setRows] = useState<ServedRow[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const season = useSeason();

  useEffect(() => {
    let live = true;
    setProblem(null);
    gameFetch("/api/role-measures")
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) throw new Error(t({ message: "Only administrators can see how roles are going.", context: "role measures, refused" }));
        if (!r.ok) throw new Error(t({ message: "Could not read the measures.", context: "role measures, failed" }));
        return r.json();
      })
      .then((j) => live && setRows(Array.isArray(j?.rows) ? j.rows : []))
      .catch((e) => live && setProblem(failureWords(e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

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

  return (
    <section id={MEASURES_ANCHOR} aria-labelledby="role-measures-heading" className={`${CARD} @container scroll-mt-44`} data-testid="role-measures-panel">
      <div className="flex items-center gap-4">
        <span className={RING} aria-hidden="true">
          <SeedOfLife className="size-6" />
        </span>
        <div className="min-w-0">
          <p className={EYEBROW}>{t({ message: "Only administrators see this", context: "role measures, eyebrow" })}</p>
          <h2 id="role-measures-heading" tabIndex={-1} data-section-focus="" className={`${H2} mt-1 outline-none`}>
            {circleId === undefined ? t`How roles are going` : t({ message: "How roles are going here", context: "role measures, a circle's page" })}
          </h2>
        </div>
      </div>
      <ul className={`${HINT} mt-3 list-disc space-y-1 pl-5`}>
        <li>{t({ message: "Counts and medians from stamped times. No names.", context: "role measures, how to read" })}</li>
        <li>{t({ message: "Too few means under three people, so the number stays hidden.", context: "role measures, how to read" })}</li>
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
                <CircleRow key={r.circleId ?? "none"} row={r} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** One circle on the circles page: its name and three headline numbers, opening to both chains. */
function CircleRow({ row }: { row: ServedRow }) {
  const { t } = useLingui();
  const answered = percent(row.applications.answered);
  const name = row.circleId === null ? t({ message: "Roles not in a circle", context: "role measures, a row" }) : (row.circleName ?? row.circleId);
  return (
    <li>
      <details className={`${ROW} group`} data-circle-measures={row.circleId ?? ""}>
        <summary className="grid cursor-pointer list-none gap-3 rounded-xl p-4 hover:bg-card/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center [&::-webkit-details-marker]:hidden">
          <span className="flex min-h-11 items-center justify-between gap-3">
            <span className="min-w-0 font-display text-xl text-foreground">{name}</span>
            <ChevronDown className="size-5 shrink-0 text-notice motion-safe:transition-transform group-open:rotate-180 sm:hidden" aria-hidden="true" />
          </span>
          <span className="flex items-center gap-4">
            <span className="grid flex-1 grid-cols-3 gap-2 sm:w-80 sm:flex-none sm:gap-4">
              <Headline label={t({ message: "Applied", context: "role measures, applying chain" })} value={String(row.applications.count)} />
              <Headline
                label={t({ message: "Answered", context: "role measures, applying chain" })}
                value={answered === null ? null : `${answered}%`}
                why={row.applications.answered.eligible === 0 ? "none" : "few"}
              />
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

/** Why a number is missing: nobody to count yet, or too few people to show it. */
type Why = "none" | "few";

/** The chip a missing number shows. */
function Missing({ why }: { why: Why }) {
  const { t } = useLingui();
  return (
    <span className={CHIP_SOFT}>
      {why === "none" ? t({ message: "not yet", context: "role measures, nobody to count yet" }) : t({ message: "too few", context: "role measures, a withheld number" })}
    </span>
  );
}

/** One headline number on a circle's row, read as "Applied 7": its name small, the numeral large under it. */
function Headline({ label, value, why = "few" }: { label: string; value: string | null; why?: Why }) {
  return (
    <span className="block min-w-0">
      <span className="block text-xs text-muted-foreground">{label}</span>{" "}
      <span className="mt-0.5 block">
        {value === null ? <Missing why={why} /> : <span className={`font-display text-2xl leading-none text-foreground ${NUM}`}>{value}</span>}
      </span>
    </span>
  );
}

interface Step {
  label: string;
  /** The number as read, or null where it was withheld. */
  value: string | null;
  /** The size it was measured on ("9 of 12"), or a word on what kind of number it is. */
  sub?: string;
  /** Why the value is missing, when it is. */
  why?: Why;
}

/** The two chains: from applying to a decision, and from a seat to a renewal. */
function Chains({ row }: { row: ServedRow }) {
  const { t } = useLingui();
  const of = ({ yes, eligible: all }: Share) => (all === 0 ? undefined : t({ message: `${yes} of ${all}`, context: "role measures, the size a share was measured on" }));
  const share = (s: Share): Pick<Step, "value" | "sub" | "why"> => {
    const p = percent(s);
    return { value: p === null ? null : `${p}%`, sub: of(s), why: s.eligible === 0 ? "none" : "few" };
  };
  const time = (h: number | null): Step["value"] => {
    const s = span(h);
    if (!s) return null;
    const n = s.n;
    return s.unit === "hours" ? plural(n, { one: "# hour", other: "# hours" }) : plural(n, { one: "# day", other: "# days" });
  };
  const median = t({ message: "median", context: "role measures, a kind of number" });
  const a = row.applications;
  const h = row.holders;
  // A median with no application to measure is "not yet"; with some, but under three, it is "too few".
  const timed = (hours: number | null): Pick<Step, "value" | "sub" | "why"> => ({ value: time(hours), sub: median, why: a.count === 0 ? "none" : "few" });
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
    { label: t({ message: "First quest by day 14", context: "role measures, holding chain" }), ...share(h.firstQuestBy14) },
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

/** A stone whose number was withheld: the ring's shape in the quiet edge. */
const STONE_DIM = "inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-border text-muted-foreground";

/**
 * Five stones on a thread: down the screen while the panel is narrow (a phone, or a circle's page's
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
      <span aria-hidden="true" className="absolute bottom-6 left-[21px] top-6 w-px bg-border @2xl:bottom-auto @2xl:left-[10%] @2xl:right-[10%] @2xl:top-[21px] @2xl:h-px @2xl:w-auto" />
      <ol className="relative grid gap-3 @2xl:grid-cols-5 @2xl:gap-2">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex items-center gap-3 @2xl:flex-col @2xl:items-center @2xl:gap-2 @2xl:text-center">
            <span className={`${s.value === null ? STONE_DIM : RING} bg-card text-sm font-semibold ${NUM}`} aria-hidden="true">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 text-sm text-muted-foreground @2xl:order-3 @2xl:flex-none">{s.label}</span>
            <span className="shrink-0 text-right @2xl:order-2 @2xl:text-center">
              {s.value === null ? (
                <Missing why={s.why ?? "few"} />
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
