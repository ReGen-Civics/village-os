/**
 * `/admin/role-progress`: HOW ROLES ARE GOING, its own page (the lead, 27 Nov 2026: "this should just be it's own
 * page in admin that looks like this and is actively tracking things ... Let's also bring in some other key metrics
 * to track about this process").
 *
 * WHO SEES WHAT is the server's (server/routes/roleMeasures.ts): an administrator sees every circle, a circle's lead
 * sees their own circle (their live, kept lead seat), and anybody else is refused and sees one sentence. The
 * `/admin/` path names the page and gates nothing, as with /admin/review: a circle's lead who is not an admin opens it.
 *
 * ACTIVELY TRACKING. The page reads again every minute while it is in view, and whenever the window comes back into
 * focus, and says when it last read ("Updated 14:05").
 *
 * WHAT IT SHOWS, in the order a reader asks:
 *   1. Right now: how many applications stand at each stage today, with how long the oldest has waited. Counts only;
 *      each count links to the review queue that lists them by name, for those allowed to read it.
 *   2. Key measures for the season and circle picked: replies, conversations booked and held, references followed
 *      up, offers, counter-offers, how applications end, adoption to start, and who is still in the role.
 *   3. Days at each stage (shared/applicationStageTiming.ts, the one stage clock).
 *   4. Each circle, opening to its two chains.
 *
 * No names anywhere on the page. Every count shows, 1s and 2s included; "no data" only where nothing was recorded.
 * `?circle=<id>` filters to one circle (a circle's page links here that way); `#role-measures` lands on the title,
 * for the old addresses (/role-measures, /circles#role-measures).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { BreathingLoader } from "@/components/natural";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { gameFetch, useSeason } from "@/lib/gameApi";
import { goToSection, holdSection } from "@/lib/sectionAnchor";
import { BTN_SECONDARY, CARD, CARD_FEATURED, CHIP_SOFT, EYEBROW, FIELD, H1, H2, HINT, LABEL, LINK, NOTE, RING, TILE, WORLD } from "@/components/journey/look";
import { SeedOfLife } from "@/components/sacred/glyphs";
import type { MeasureRow, StageNowRow } from "@shared/roleMeasures";
import { TIMED_STAGES, type TimedStage } from "@shared/applicationStageTiming";
import { rowsFor, seasonsOf, type ServedRow } from "@/components/roleMeasures/measuresView";
import { Chain, Chains, CircleRow, NUM, NoData, useReadings } from "@/components/roleMeasures/parts";

/** The title's id: the old addresses land here. */
export const MEASURES_ANCHOR = "role-measures";
/** How often the page reads again while it is in view. */
export const REFRESH_MS = 60_000;

/** The chosen season: BTN_SECONDARY's shape, held in a gold ring (a gold fill would read as earned). */
const SEASON_ON =
  "jw-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-notice bg-notice/10 px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50";

interface Answer {
  rows: ServedRow[];
  totals: MeasureRow[];
  rightNow: Array<StageNowRow & { circleName: string | null }>;
  scope: "village" | "circles";
  at: string;
  /** The circle asked for is not one this reader leads: the answer is read without it. */
  outside: boolean;
}
type Load = { phase: "loading" } | { phase: "refused" } | { phase: "failed"; message: string } | { phase: "ready"; answer: Answer };

/** A read the window's return asks for is skipped when one started this recently (focus and visibility both fire). */
export const READ_GAP_MS = 10_000;

/** Read the measures, and again every minute while the page is in view and whenever it comes back into focus. */
export function useRoleProgress(circle: string | null, enabled: boolean) {
  const { t } = useLingui();
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const lastStart = useRef(0);
  const read = useCallback(async () => {
    lastStart.current = Date.now();
    try {
      let outside = false;
      let r = await gameFetch(circle ? `/api/role-measures?circle=${encodeURIComponent(circle)}` : "/api/role-measures");
      // A circle this reader does not lead: read what they may see instead, and say so, never "not for you".
      if (circle && r.status === 403) {
        outside = true;
        r = await gameFetch("/api/role-measures");
      }
      const body = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) return setLoad({ phase: "refused" });
      // The server's own words when it gave some (a 429 says to slow down), ours otherwise.
      if (!r.ok) return setLoad((was) => (was.phase === "ready" ? was : { phase: "failed", message: typeof body?.error === "string" && body.error ? body.error : t({ message: "Could not read the measures.", context: "role measures, failed" }) }));
      setLoad({
        phase: "ready",
        answer: {
          rows: Array.isArray(body?.rows) ? body.rows : [],
          totals: Array.isArray(body?.totals) ? body.totals : [],
          rightNow: Array.isArray(body?.rightNow) ? body.rightNow : [],
          scope: body?.scope === "village" ? "village" : "circles",
          at: typeof body?.at === "string" ? body.at : new Date().toISOString(),
          outside,
        },
      });
    } catch {
      setLoad((was) => (was.phase === "ready" ? was : { phase: "failed", message: t({ message: "Could not read the measures.", context: "role measures, failed" }) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circle]);

  useEffect(() => {
    if (!enabled) return;
    setLoad({ phase: "loading" });
    void read();
    const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";
    const tick = setInterval(() => visible() && void read(), REFRESH_MS);
    const back = () => visible() && Date.now() - lastStart.current >= READ_GAP_MS && void read();
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", back);
    return () => {
      clearInterval(tick);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", back);
    };
  }, [read, enabled]);
  return { load, read };
}

export default function RoleProgress() {
  const { t, i18n } = useLingui();
  const auth = useOptionalAuth();
  const signedIn = !!auth?.user;
  const search = useSearch();
  const [, navigate] = useLocation();
  const asked = new URLSearchParams(search).get("circle") || null;
  const { load, read } = useRoleProgress(asked, signedIn);
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const season = useSeason();

  const answer = load.phase === "ready" ? load.answer : null;
  // The circle the page shows: the one asked for, unless it is not this reader's to see.
  const circle = answer?.outside ? null : asked;
  const seasons = useMemo(() => seasonsOf(answer?.totals.map((r) => ({ ...r, circleName: null })) ?? [], season?.current?.id ?? null), [answer, season?.current?.id]);
  const shown = picked !== undefined && seasons.includes(picked) ? picked : (seasons[0] ?? null);
  const names = new Map((season?.seasons ?? []).map((s) => [s.id, s.name]));
  const seasonName = (id: string | null) => (id === null ? t({ message: "No season", context: "role measures, a season chip" }) : (names.get(id) ?? id));
  const total = answer?.totals.find((r) => r.seasonId === shown) ?? null;
  const here = answer && seasons.length ? seasonName(shown) : (season?.current?.name ?? null);
  const list = answer ? rowsFor(answer.rows, shown, circle ?? undefined) : [];
  // Every circle this reader may see, from every season, for the filter.
  const circles = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of answer?.rows ?? []) if (r.circleId) seen.set(r.circleId, r.circleName ?? r.circleId);
    for (const r of answer?.rightNow ?? []) if (r.circleId) seen.set(r.circleId, r.circleName ?? r.circleId);
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [answer]);
  const pick = (id: string | null) => navigate(id ? `/admin/role-progress?circle=${encodeURIComponent(id)}` : "/admin/role-progress", { replace: true });

  // Arriving on #role-measures (the old addresses): land on the title once the page has drawn.
  const ready = load.phase !== "loading";
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

  const updated = answer ? i18n.date(new Date(answer.at), { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <Layout>
      <div className={`${WORLD} py-8 sm:py-12`}>
        <div className="@container mx-auto max-w-5xl space-y-6 px-4">
          <header id={MEASURES_ANCHOR} className="scroll-mt-28">
            <div className="flex items-center gap-4">
              <span className={RING} aria-hidden="true">
                <SeedOfLife className="size-6" />
              </span>
              <div className="min-w-0">
                <p className={EYEBROW}>
                  {here
                    ? t({ message: `Roles · ${here}`, context: "role progress, where you are: roles and the season" })
                    : t({ message: "Roles", context: "role progress, where you are" })}
                </p>
                <h1 tabIndex={-1} data-section-focus="" className={`${H1} mt-1 outline-none`}>
                  {t`How roles are going`}
                </h1>
              </div>
            </div>
            {answer ? (
              <ul className={`${HINT} mt-3 list-disc space-y-1 pl-5`} data-testid="progress-how-to-read">
                <li>{t({ message: "Administrators see every circle; each lead sees their own.", context: "role progress, who sees it" })}</li>
                <li>{t({ message: "Counts and medians from stamped times. No names.", context: "role measures, how to read" })}</li>
                <li>{t({ message: "No data means nothing has been recorded yet. 0 means none.", context: "role measures, how to read" })}</li>
              </ul>
            ) : null}
            {updated ? (
              <p className={`${HINT} mt-2`} data-testid="progress-updated">
                {t({ message: `Updated ${updated}. It reads again every minute while open.`, context: "role progress, when it last read" })}
              </p>
            ) : null}
          </header>

          {!signedIn ? (
            <p className={NOTE}>
              {t({ message: "Sign in to see how roles are going.", context: "role progress, signed out" })}{" "}
              <Link href={`/login?next=${encodeURIComponent("/admin/role-progress")}`} className={LINK}>
                {t({ message: "Sign in", context: "role progress, signed out" })}
              </Link>
            </p>
          ) : load.phase === "refused" ? (
            <p className={NOTE} data-testid="progress-refused">
              {t({ message: "This page is for administrators and circle leads.", context: "role progress, refused" })}{" "}
              <Link href="/roles" className={LINK}>
                {t({ message: "See the roles", context: "role progress, refused: a door to the roles" })}
              </Link>
            </p>
          ) : load.phase === "loading" ? (
            <BreathingLoader />
          ) : load.phase === "failed" ? (
            <div role="alert" className={`${TILE} flex flex-wrap items-center justify-between gap-3`}>
              <p className="text-foreground">{load.message}</p>
              <button type="button" onClick={() => void read()} className={BTN_SECONDARY}>
                {t({ message: "Try again", context: "role measures, failed read" })}
              </button>
            </div>
          ) : (
            <>
              {answer!.outside ? (
                <p className={`${TILE} ${NOTE}`} data-testid="progress-outside">
                  {t({ message: "You can see the circles you lead, so these are yours.", context: "role progress, a circle the reader does not lead was asked for" })}{" "}
                  <button type="button" onClick={() => pick(null)} className={`${LINK} inline-flex min-h-11 items-center`}>
                    {t({ message: "Show the circles you lead", context: "role progress, clear a circle the reader does not lead" })}
                  </button>
                </p>
              ) : null}
              <RightNow rows={answer!.rightNow} admin={answer!.scope === "village"} />

              <section aria-label={t({ message: "Season and circle", context: "role progress, filters" })} className="flex flex-wrap items-end gap-x-6 gap-y-3">
                {seasons.length > 1 ? (
                  <div role="group" aria-label={t({ message: "Season", context: "role measures, season picker" })} className="flex flex-wrap gap-2">
                    {seasons.map((s) => (
                      <button key={s ?? "none"} type="button" aria-pressed={s === shown} onClick={() => setPicked(s)} className={s === shown ? SEASON_ON : BTN_SECONDARY}>
                        {seasonName(s)}
                      </button>
                    ))}
                  </div>
                ) : seasons.length === 1 ? (
                  <span className={CHIP_SOFT}>{seasonName(shown)}</span>
                ) : null}
                {circles.length > 1 || circle ? (
                  <label className="grid gap-1">
                    <span className={LABEL}>{t({ message: "Circle", context: "role progress, circle filter" })}</span>
                    <select value={circle ?? ""} onChange={(e) => pick(e.target.value || null)} className={`${FIELD} min-h-11 sm:w-64`}>
                      <option value="">
                        {answer!.scope === "village" ? t({ message: "Every circle", context: "role progress, circle filter" }) : t({ message: "Every circle you lead", context: "role progress, circle filter" })}
                      </option>
                      {circles.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </section>

              {total ? <KeyMeasures row={total} season={seasonName(shown)} /> : <p className={HINT} data-testid="measures-empty">{t({ message: "Nothing has been stamped yet.", context: "role measures, empty" })}</p>}
              {total ? <StageDays row={total} /> : null}

              {list.length ? (
                <section className={CARD} aria-labelledby="progress-circles">
                  <p className={EYEBROW}>{t({ message: "Circle by circle", context: "role progress, eyebrow" })}</p>
                  <h2 id="progress-circles" className={`${H2} mt-1`}>
                    {circle || (answer!.scope === "circles" && list.length === 1)
                      ? (list[0]?.circleName ?? circle)
                      : t({ message: "Each circle", context: "role progress, the circles section" })}
                  </h2>
                  {(circle || (answer!.scope === "circles" && list.length === 1)) && list[0] ? (
                    <Chains row={list[0]} />
                  ) : (
                    <ul className="mt-5 grid gap-3" data-testid="measures-circles">
                      {list.map((r) => (
                        <CircleRow key={r.circleId ?? "none"} row={r} onPick={pick} />
                      ))}
                    </ul>
                  )}
                  {circle ? (
                    <p className="mt-4">
                      <button type="button" onClick={() => pick(null)} className={`${LINK} inline-flex min-h-11 items-center`}>
                        {answer!.scope === "village" ? t({ message: "Show every circle", context: "role progress, clear the circle filter" }) : t({ message: "Show every circle you lead", context: "role progress, clear the circle filter" })}
                      </button>
                    </p>
                  ) : null}
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

/** The stage names, said the same way the applicant's track says them. */
function useStageNames(): Record<TimedStage, string> {
  const { t } = useLingui();
  return {
    review: t({ message: "Our review", context: "role progress, a stage" }),
    references: t({ message: "References and proposal", context: "role progress, a stage" }),
    final_interview: t({ message: "Final conversation", context: "role progress, a stage" }),
    agreement: t({ message: "Agreement", context: "role progress, a stage" }),
  };
}

/** The review queue that lists these applications by name: proposals from outside, members' applications, or both. */
export function reviewHrefFor(open: number, member: number): string {
  if (open > 0 && member === 0) return "/admin/review?kind=open";
  if (member > 0 && open === 0) return "/admin/review?kind=application";
  return "/admin/review";
}

/**
 * Right now: each stage's count today, in the track's order (review to agreement), with how long the oldest has
 * waited, the stage holding the longest wait marked. An admin's counts are doors to the review queue that lists
 * them; a circle's lead gets a door only to members' applications, the queue a lead can read.
 */
/** The tile of the stage holding the longest wait: TILE's shape, edged in gold. */
const OLDEST_TILE = "rounded-xl border-2 border-notice/70 bg-muted p-4";

function RightNow({ rows, admin }: { rows: ReadonlyArray<StageNowRow>; admin: boolean }) {
  const { t } = useLingui();
  const names = useStageNames();
  const { time } = useReadings();
  const stages = TIMED_STAGES.map((stage) => {
    const here = rows.filter((r) => r.stage === stage);
    const oldest = here.reduce((m, r) => Math.max(m, r.oldestHours), 0);
    const waited = time(oldest) ?? "";
    return {
      stage,
      count: here.reduce((n, r) => n + r.count, 0),
      open: here.reduce((n, r) => n + r.open, 0),
      member: here.reduce((n, r) => n + r.member, 0),
      oldest,
      waitedLine: t({ message: `The oldest has waited ${waited}`, context: "role progress, how long the oldest at a stage has waited" }),
    };
  });
  const longest = Math.max(0, ...stages.filter((s) => s.count > 0).map((s) => s.oldest));
  const doorFor = (s: (typeof stages)[number]): string | null => (admin ? reviewHrefFor(s.open, s.member) : s.member > 0 ? "/admin/review?kind=application" : null);
  return (
    <section className={CARD_FEATURED} aria-labelledby="progress-now" data-testid="progress-right-now">
      <p className={EYEBROW}>{t({ message: "Today", context: "role progress, eyebrow" })}</p>
      <h2 id="progress-now" className={`${H2} mt-1`}>
        {t({ message: "Right now", context: "role progress, applications at each stage today" })}
      </h2>
      <ol className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stages.map((s) => {
          const oldestHere = s.count > 0 && s.oldest === longest;
          const door = s.count > 0 ? doorFor(s) : null;
          return (
            <li key={s.stage} className={oldestHere ? OLDEST_TILE : TILE} data-stage={s.stage} data-oldest={oldestHere ? "" : undefined}>
              <p className="text-sm text-muted-foreground">{names[s.stage]}</p>
              <p className={`font-display text-3xl leading-tight text-foreground ${NUM}`}>{s.count}</p>
              {s.count > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">{s.waitedLine}</p>
                  {oldestHere ? <span className={`${CHIP_SOFT} mt-1`}>{t({ message: "Longest wait", context: "role progress, the stage holding the longest wait" })}</span> : null}
                  {door ? (
                    <Link href={door} className={`${LINK} mt-1 flex min-h-11 items-center text-sm`}>
                      {t({ message: "See them in Review", context: "role progress, door to the review queue" })}
                    </Link>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t({ message: "Nobody waiting here", context: "role progress, an empty stage" })}</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface Tile {
  label: string;
  value: string | null;
  sub?: string;
}

/** A group of key measures: an eyebrow and tiles, each a numeral with what it was measured on. */
function Tiles({ title, tiles }: { title: string; tiles: readonly Tile[] }) {
  return (
    <div>
      <h3>
        <span className={`font-body ${EYEBROW}`}>{title}</span>
      </h3>
      <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((x) => (
          <li key={x.label} className={TILE}>
            <p className="text-sm text-muted-foreground">{x.label}</p>
            <div className="mt-1">{x.value === null ? <NoData /> : <p className={`font-display text-2xl leading-tight text-foreground ${NUM}`}>{x.value}</p>}</div>
            {x.sub && x.value !== null ? <p className="text-xs text-muted-foreground">{x.sub}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The key measures of the season and circle picked. */
function KeyMeasures({ row, season }: { row: MeasureRow; season: string }) {
  const { t } = useLingui();
  const { share, timed } = useReadings();
  const o = row.outcomes;
  return (
    <section className={CARD} aria-labelledby="progress-key" data-testid="progress-key-measures">
      <p className={EYEBROW}>{season}</p>
      <h2 id="progress-key" className={`${H2} mt-1`}>
        {t({ message: "Key measures", context: "role progress, the measures section" })}
      </h2>
      <div className="mt-5 grid gap-6">
        <Tiles
          title={t({ message: "Moving through", context: "role progress, a group of measures" })}
          tiles={[
            { label: t({ message: "Applications", context: "role progress, a measure" }), value: String(row.applications.count) },
            { label: t({ message: "First reply", context: "role measures, applying chain" }), ...timed(row.applications.medianHoursToReply) },
            { label: t({ message: "Conversations booked", context: "role progress, a measure" }), ...share(row.conversations.booked) },
            { label: t({ message: "Held and written up", context: "role progress, a measure" }), ...share(row.conversations.held) },
            { label: t({ message: "References followed up", context: "role progress, a measure" }), ...timed(row.references.medianHoursToFollowUp) },
            { label: t({ message: "Final conversations adopted", context: "role progress, a measure" }), ...share(o.offer) },
            { label: t({ message: "Agreements countered first", context: "role progress, a measure" }), ...share(o.countered) },
          ]}
        />
        <Tiles
          title={t({ message: "How applications end", context: "role progress, a group of measures" })}
          tiles={[
            { label: t({ message: "Withdrawn", context: "role progress, a measure" }), ...share(o.withdrawn) },
            { label: t({ message: "Declined", context: "role progress, a measure" }), ...share(o.declined) },
            { label: t({ message: "Closed after 90 quiet days", context: "role progress, a measure" }), ...share(o.closed) },
          ]}
        />
        <Tiles
          title={t({ message: "After adoption", context: "role progress, a group of measures" })}
          tiles={[
            { label: t({ message: "Adoption to start", context: "role progress, a measure" }), ...timed(row.start.medianHoursToStart) },
            { label: t({ message: "Path done by day 30", context: "role measures, holding chain" }), ...share(row.holders.pathCompleteBy30) },
            { label: t({ message: "Still in the role at day 30", context: "role progress, a measure" }), ...share(row.holders.stillInRoleAt30) },
            { label: t({ message: "Still in the role at day 90", context: "role measures, holding chain" }), ...share(row.holders.stillInRoleAt90) },
          ]}
        />
      </div>
    </section>
  );
}

/** Days at each stage: four stones, each the median length of the stage over the applications that finished it. */
function StageDays({ row }: { row: MeasureRow }) {
  const { t } = useLingui();
  const names = useStageNames();
  const { timed } = useReadings();
  return (
    <section className={CARD} aria-labelledby="progress-stages">
      <p className={EYEBROW}>{t({ message: "Median time at each stage", context: "role progress, eyebrow" })}</p>
      <h2 id="progress-stages" className={`${H2} mt-1`}>
        {t({ message: "Time at each stage", context: "role progress, the stage timing section" })}
      </h2>
      <div className="mt-5">
        <Chain title={t({ message: "From review to agreement", context: "role progress, the stage chain" })} steps={TIMED_STAGES.map((s) => ({ label: names[s], ...timed(row.stages[s]) }))} />
      </div>
    </section>
  );
}
