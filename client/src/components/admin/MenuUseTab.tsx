/**
 * HOW THE MENU IS USED (an admin page, wayfinding lane, 27 Nov 2026: "the menu shaped by real use").
 *
 * The visits the responsive bar already counts (POST /api/nav/visit, migration 0431), read for a season through
 * GET /api/admin/nav/usage, and set against the menu (config/nav.ts): the most and least visited pages, the pages
 * nobody opened, and a short "What this suggests" worked out by plain rules (menuUsage.ts). Counts only, never names:
 * the table holds no person.
 *
 * What is NOT recorded is said on the page: visitors are never counted, members and admins are counted together, and a
 * count is a page's (from the menu, a link or a typed address alike). Splitting by audience needs the count to carry
 * one, which is a migration, so it waits for the coordinator.
 *
 * Seasons are the village's civil days and the counts are UTC days, so a season's edge can be a few hours off.
 *
 * Light only, like every admin surface, in the palette tokens the Admin palette reaches (scripts/check-tailwind-palette.mjs).
 */
import { useEffect, useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import { navWord, type NavLink } from "@/config/nav";
import { menuPages } from "@/lib/nearestPages";
import { usePlaceLine } from "@/lib/placeLine";
import { fetchSeasonCached, useGameConfig, useSeason } from "@/lib/gameApi";
import { useModules } from "@/modules/ModuleProvider";
import { useVillageMenu } from "@/hooks/useVillageMenu";
import { storyPageShown } from "@/lib/brochure";
import { pageTitleFor } from "@shared/pageTitles";
import { menuUsage, type PathCount, type Suggestion, type UsagePage } from "./menuUsage";

interface UsageAnswer {
  from: string;
  to: string;
  today: string;
  recordedSince: string | null;
  totals: PathCount[];
}

const BOX = "rounded-xl border border-border bg-card p-5";
const H3 = "text-base font-semibold text-foreground";
const NOTE = "text-sm text-muted-foreground";

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export default function MenuUseTab({ password }: { password: string }) {
  const { t, i18n } = useLingui();
  const season = useSeason();
  const cfg = useGameConfig();
  const { modules } = useModules();
  const menu = useVillageMenu();
  const [choice, setChoice] = useState<string>("current");
  const [answer, setAnswer] = useState<UsageAnswer | null>(null);
  const [problem, setProblem] = useState("");
  // The calendar answered (a season, none, or a failed read): only then is "this season" known.
  const [calendarRead, setCalendarRead] = useState(false);
  useEffect(() => {
    let alive = true;
    void fetchSeasonCached().finally(() => alive && setCalendarRead(true));
    return () => {
      alive = false;
    };
  }, []);

  const currentName = season?.current?.name ?? "";
  const today = season?.today ?? new Date().toISOString().slice(0, 10);
  const seasons = (season?.seasons ?? []).filter((s) => s.startsOn && s.startsOn <= today);
  const picked = choice === "current" ? season?.current ?? null : seasons.find((s) => s.id === choice) ?? null;
  // "current": this season; "past": a season that has ended or is not the running one; "days": the last 90 days.
  const span = picked
    ? { from: picked.startsOn, to: picked.endsOn || addDays(today, 1), kind: picked.id === season?.current?.id ? ("current" as const) : ("past" as const), name: picked.name }
    : { from: addDays(today, -89), to: addDays(today, 1), kind: "days" as const, name: "" };
  const seasonName = span.name;
  // The window has ended once its last day (the day before `to`) is behind today: nothing more will be counted in it.
  const ended = span.to <= today;
  // The window's days, in the reader's language and in UTC, since the counts are UTC days ("1 Aug to 31 Oct 2026" in English).
  const day = (d: string, withYear: boolean) =>
    new Intl.DateTimeFormat(!i18n.locale || i18n.locale === "en" ? "en-GB" : i18n.locale, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const windowFrom = day(span.from, span.from.slice(0, 4) !== addDays(span.to, -1).slice(0, 4));
  const windowTo = day(addDays(span.to, -1), true);

  useEffect(() => {
    if (!calendarRead) return; // wait for the calendar, so the first read is the season's
    let alive = true;
    setProblem("");
    fetch(`${API_BASE}/admin/nav/usage?from=${span.from}&to=${span.to}`, { headers: authHeaders(password) })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!alive) return;
        if (res.ok && body) setAnswer(body as UsageAnswer);
        else {
          setAnswer(null);
          setProblem(refusal(body, t({ message: "The visit counts could not be read.", context: "admin, how the menu is used" })));
        }
      })
      .catch(() => {
        if (alive) setProblem(t({ message: "The visit counts could not be read. Check your connection, then reload.", context: "admin, how the menu is used" }));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, span.from, span.to, calendarRead]);

  const moduleOn = (id?: string) => !id || modules.some((m) => m.id === id);
  // In the menu for somebody: shown by the village, its module on (or off, for unlessModule), its story page served.
  const live = (l: NavLink) =>
    !menu.hidden.includes(l.href) && moduleOn(l.module) && (!l.unlessModule || !moduleOn(l.unlessModule)) && (!l.brochure || storyPageShown(cfg, l.story ?? l.href));

  const usage = useMemo(
    () => (answer ? menuUsage(menuPages(), answer.totals, { live, from: answer.from, to: answer.to, today: answer.today, recordedSince: answer.recordedSince }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answer, modules, menu, cfg],
  );

  const recordedSince = answer?.recordedSince ?? "";
  const countedDays = usage?.daysCounted ?? 0;
  const menuVisits = usage?.total ?? 0;
  const unopenedCount = usage?.unopened.length ?? 0;
  // A page by the row the menu shows for it: its own row ("Rights and agreements", not its chapters too) when that is
  // shown, else the first shown row (/circles with the map on reads "How roles are going"), else its first row.
  const nameOf = (p: UsagePage) => {
    const rows = p.shown.length ? p.shown : p.links;
    const own = rows.find((l) => l.href === p.path) ?? rows[0];
    return menu.labels[own.href] || navWord(own.label, i18n);
  };
  const placeWord = (w: string | null) => (w ? menu.groups[w] || navWord(w, i18n) : t({ message: "Your account", context: "admin, how the menu is used: the account menu" }));
  const placeLine = usePlaceLine((w) => menu.groups[w] || navWord(w, i18n));
  const whereOf = (p: UsagePage) => placeLine(p.places);
  const byPath = new Map((usage?.pages ?? []).map((p) => [p.path, p]));
  const pageName = (path: string) => (byPath.has(path) ? nameOf(byPath.get(path)!) : pageTitleFor(path) || path);
  const notJudged = usage ? usage.notInMenu.map((p) => nameOf(p)).join(", ") : "";

  const say = (s: Suggestion): string => {
    const { visits, days, minDays, minVisits, more, pct, median } = s.values;
    const name = s.path ? pageName(s.path) : "";
    const group = placeWord(String(s.values.group ?? ""));
    const folder = navWord(String(s.values.folder ?? ""), i18n);
    switch (s.rule) {
      case "too-few":
        return ended
          ? t({ message: `Only ${visits} visits over ${days} days. Suggestions need ${minDays} days and ${minVisits} visits to read.`, context: "admin, how the menu is used: suggestion" })
          : t({ message: `Only ${visits} visits over ${days} days so far. Suggestions start once there are ${minDays} days and ${minVisits} visits to read.`, context: "admin, how the menu is used: suggestion" });
      case "unopened":
        if (!s.path) return t({ message: `And ${more} more pages nobody opened.`, context: "admin, how the menu is used: suggestion" });
        if (span.kind === "current") return t({ message: `No one opened ${name} this season: consider folding it.`, context: "admin, how the menu is used: suggestion" });
        if (span.kind === "past") return t({ message: `No one opened ${name} in ${seasonName}: consider folding it.`, context: "admin, how the menu is used: suggestion" });
        return t({ message: `No one opened ${name} in the last 90 days: consider folding it.`, context: "admin, how the menu is used: suggestion" });
      case "lift-out":
        return t({ message: `${name} draws ${pct}% of the visits in ${group} from inside the ${folder} folder: consider giving it a row of its own.`, context: "admin, how the menu is used: suggestion" });
      case "fold-in":
        return t({ message: `${name} has a row of its own in ${group} and ${visits} visits, against ${median} for a typical page there: consider moving it into a folder.`, context: "admin, how the menu is used: suggestion" });
      case "add-entry":
        return t({ message: `${name} was opened ${visits} times and has no menu entry: consider giving it one.`, context: "admin, how the menu is used: suggestion" });
    }
  };

  // Two columns, the menu's place under each name: admin tables keep their cells on one line and scroll
  // (components/admin/adminNight.css, .admin-fit), so a third column would push the counts out of sight.
  const table = (rows: UsagePage[], label: string) => (
    <div className="mt-3">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{label}</caption>
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">{t({ message: "Page", context: "admin, how the menu is used: column" })}</th>
            <th scope="col" className="py-1 text-right font-medium">{t({ message: "Visits", context: "admin, how the menu is used: column" })}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((p) => (
            <tr key={p.path} data-usage-row={p.path}>
              <td className="py-2 pr-3 text-foreground">
                <span className="block whitespace-normal">{nameOf(p)}</span>
                <span className="block whitespace-normal text-xs text-muted-foreground">{whereOf(p)}</span>
              </td>
              <td className="py-2 text-right tabular-nums text-foreground">
                {p.count}
                <span className="ml-2 text-xs text-muted-foreground">{Math.round(p.share * 100)}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="menu-use">
      <div className={BOX}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold text-foreground">{t({ message: "How the menu is used", context: "admin, how the menu is used: h2" })}</h2>
            <p className={`mt-2 ${NOTE}`}>
              {t({ message: "How often each page in the menu was opened, from the visits the phone bar already counts. Counts only: no visit carries a name.", context: "admin, how the menu is used" })}
            </p>
          </div>
          <label className="text-sm text-foreground">
            <span className="block text-xs font-medium text-muted-foreground">{t({ message: "Season", context: "admin, how the menu is used: picker" })}</span>
            <select value={choice} onChange={(e) => setChoice(e.target.value)} className="mt-1 min-h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground">
              {currentName && <option value="current">{t({ message: `This season (${currentName})`, context: "admin, how the menu is used: picker" })}</option>}
              {seasons.filter((s) => s.id !== season?.current?.id).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              {!currentName && <option value="current">{t({ message: "The last 90 days", context: "admin, how the menu is used: picker" })}</option>}
            </select>
            <span className="mt-1 block text-xs text-muted-foreground" data-testid="menu-use-window">
              {t({ message: `${windowFrom} to ${windowTo}, counted in UTC days`, context: "admin, how the menu is used: the window's dates" })}
            </span>
          </label>
        </div>
        <ul className="mt-4 list-disc space-y-1 rounded-lg border border-notice/40 bg-amber-light py-2 pl-8 pr-3 text-sm text-foreground" data-testid="menu-use-limits">
          <li>{t({ message: "Only signed-in visits are counted. A visitor's visits are not recorded at all.", context: "admin, how the menu is used: what is not recorded" })}</li>
          <li>{t({ message: "Members and admins are counted together. The count carries no audience, so it cannot be split into visitor, member and admin without a change to what is stored.", context: "admin, how the menu is used: what is not recorded" })}</li>
          <li>{t({ message: "A count is a page's. Opening it from the menu, a link or a typed address counts the same, and a page with two rows in the menu has one count.", context: "admin, how the menu is used: what is not recorded" })}</li>
          {answer && (
            <li>
              {answer.recordedSince
                ? t({ message: `Counting began on ${recordedSince}. This window counted ${countedDays} days.`, context: "admin, how the menu is used" })
                : t({ message: "Nothing has been counted yet.", context: "admin, how the menu is used" })}
            </li>
          )}
        </ul>
      </div>

      {problem && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-card px-3 py-2 text-sm text-destructive">
          {problem}
        </p>
      )}

      {usage && (
        <>
          <div className={BOX}>
            <h3 className={H3}>{t({ message: "What this suggests", context: "admin, how the menu is used: h3" })}</h3>
            {usage.suggestions.length ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-foreground" data-testid="menu-use-suggestions">
                {usage.suggestions.map((s, i) => (
                  <li key={`${s.rule}-${s.path ?? i}`}>{say(s)}</li>
                ))}
              </ul>
            ) : (
              <p className={`mt-2 ${NOTE}`}>{t({ message: "Nothing stands out: every page in the menu was opened, and none is out of step with its group.", context: "admin, how the menu is used" })}</p>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={`${BOX} min-w-0`}>
              <h3 className={H3}>{t({ message: "Most visited", context: "admin, how the menu is used: h3" })}</h3>
              <p className={`mt-1 ${NOTE}`}>{t({ message: `${menuVisits} visits to pages in the menu.`, context: "admin, how the menu is used" })}</p>
              {usage.most.length ? table(usage.most, t({ message: "Most visited", context: "admin, how the menu is used: h3" })) : <p className={`mt-2 ${NOTE}`}>{t({ message: "No page in the menu was opened.", context: "admin, how the menu is used" })}</p>}
            </div>
            <div className={`${BOX} min-w-0`}>
              <h3 className={H3}>{t({ message: "Least visited", context: "admin, how the menu is used: h3" })}</h3>
              <p className={`mt-1 ${NOTE}`}>{t({ message: "Opened at least once, fewest first.", context: "admin, how the menu is used" })}</p>
              {usage.least.length ? table(usage.least, t({ message: "Least visited", context: "admin, how the menu is used: h3" })) : <p className={`mt-2 ${NOTE}`}>{t({ message: "Every page that was opened is in the list beside this one.", context: "admin, how the menu is used" })}</p>}
            </div>
          </div>

          <div className={BOX}>
            <h3 className={H3}>
              {span.kind === "past"
                ? t({ message: `No one opened these in ${seasonName} (${unopenedCount})`, context: "admin, how the menu is used: h3" })
                : span.kind === "current"
                ? t({ message: `No one opened these this season (${unopenedCount})`, context: "admin, how the menu is used: h3" })
                : t({ message: `No one opened these in the last 90 days (${unopenedCount})`, context: "admin, how the menu is used: h3" })}
            </h3>
            {usage.unopened.length ? (
              <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm text-foreground sm:grid-cols-2" data-testid="menu-use-unopened">
                {usage.unopened.map((p) => (
                  <li key={p.path}>
                    {nameOf(p)} <span className="text-xs text-muted-foreground">{whereOf(p)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`mt-2 ${NOTE}`}>{t({ message: "Every page in the menu was opened at least once.", context: "admin, how the menu is used" })}</p>
            )}
          </div>

          {(usage.unlisted.length > 0 || usage.notInMenu.length > 0) && (
            <details className={BOX}>
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                {t({ message: "Pages outside the menu", context: "admin, how the menu is used: summary" })}
              </summary>
              {usage.unlisted.length > 0 && (
                <>
                  <p className={`mt-3 ${NOTE}`}>{t({ message: "Opened, with no menu entry, most first:", context: "admin, how the menu is used" })}</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-foreground">
                    {usage.unlisted.slice(0, 10).map((u) => (
                      <li key={u.path}>
                        {pageName(u.path)} <span className="tabular-nums text-muted-foreground">{u.count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {usage.notInMenu.length > 0 && (
                <p className={`mt-3 ${NOTE}`}>
                  {t({ message: `Not shown in the menu now, so not judged: ${notJudged}.`, context: "admin, how the menu is used" })}
                </p>
              )}
            </details>
          )}
        </>
      )}
    </div>
  );
}
