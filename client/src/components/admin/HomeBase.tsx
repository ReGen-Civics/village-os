/**
 * Home: six areas and the one thing that needs you now.
 *
 * It reads lists the admin already loads. It does not change them. The time
 * is when this page finished reading. A switch on this device can make the
 * next visit open the form list instead.
 *
 * ONE COUNT (the Admin Garden plan, 27 Nov 2026). Until then Home said "23
 * requests" in its card and "184 things" in its list, counted two ways. Now
 * the number is the server's: decisions waiting on you, defined once
 * (shared/reviewInbox.ts, `decisionCounts`), read once here for the whole of
 * Home, and said by the one sentence /admin/review also says (DecisionsLine).
 * Forms are on that list now, so they are in the count. Role applications
 * are listed below and never counted. A count that did not load says so and
 * is never read as nothing waiting.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { API_BASE, authHeaders } from "@/components/admin/adminApi";
import type { NavGroup } from "@/components/admin/adminNavGroups";
import { ADMIN_AREAS, setHomeBaseOn, tabsInArea, type AreaId } from "./adminAreas";
import { connectionRows, glanceSentence, readLastGlance, rememberGlance, sinceLastVisit, type ConnectionRow } from "./todayGlance";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { useReviewInbox } from "@/components/reviewInbox/useReviewInbox";
import DecisionsLine from "@/components/reviewInbox/DecisionsLine";
import UnifiedInbox from "./UnifiedInbox";
import RoleApplicationsList from "./RoleApplicationsList";
import NeedsYouNow from "./NeedsYouNow";
import { fetchWaitingRoleApplications, type RoleApplicationRow } from "./roleApplicationsWaiting";
import { AllClear, FeelSettings, GentleQuests, WeekRecap } from "./AdminFeel";
import { Trans, useLingui } from "@lingui/react/macro";

interface Needs {
  /** Said only when the review list holds nothing for this person; otherwise the card says the one count. */
  sentence: string;
  shape: "tick" | "dot" | "cross";
  word: string;
}

/**
 * The card's mark and its quiet sentence. THE NUMBER IS NEVER WORKED OUT HERE:
 * `listed` is how many rows the review list holds for this person, or null
 * when the list did not load, which is never read as nothing waiting. Role
 * applications are listed under the card and are no longer counted (the plan
 * of 27 Nov 2026, which replaces the ruling of 16 Nov that counted them).
 */
function needsFrom(listed: number | null, blocking: number): Needs {
  if (listed === null || listed > 0) return { sentence: "", shape: "dot", word: "Waiting" };
  if (blocking > 0) {
    const noun = blocking === 1 ? "thing needs" : "things need";
    return { sentence: `${blocking} ${noun} you before the village can open.`, shape: "cross", word: "Needs you" };
  }
  return { sentence: "Nothing is waiting on you.", shape: "tick", word: "All clear" };
}

const MARK = "inline-block h-3 w-3 border-2 border-current";

function Mark({ shape }: { shape: Needs["shape"] }) {
  const form = shape === "tick" ? "rounded-sm" : shape === "dot" ? "rounded-full" : "rounded-sm rotate-45";
  return <span aria-hidden="true" className={`${MARK} ${form}`} />;
}

export default function HomeBase({
  password, onOpenTab, groups, role,
}: {
  password: string;
  onOpenTab: (tab: string) => void;
  groups: NavGroup[];
  role?: string;
}) {
  const { t } = useLingui();
  const auth = useOptionalAuth();
  const who = auth?.user?.id != null ? String(auth.user.id) : null;
  // THE ONE READ of everything waiting on this person, for the whole of Home: the count in the card, the sentence at
  // the top and the list below. One read per visit, because the read is limited per person.
  const inbox = useReviewInbox(true);
  const [facts, setFacts] = useState<{ blocking: number; rows: ConnectionRow[] } | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const looked = useRef(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const [area, setArea] = useState<AreaId>("today");
  const [roleApps, setRoleApps] = useState<RoleApplicationRow[]>([]);
  const allowed = new Set(groups.flatMap((group) => group.items.map((item) => item.key)));

  const load = () => {
    setProblem(null);
    const signal = AbortSignal.timeout(12000);
    Promise.all([
      fetch(`${API_BASE}/admin/launch`, { headers: authHeaders(password), signal }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/admin/integrations`, { headers: authHeaders(password), signal }).then((r) => (r.ok ? r.json() : {})),
      fetchWaitingRoleApplications(password, signal).catch((): RoleApplicationRow[] => []),
    ]).then(([launch, integrations, apps]) => {
      const blocking = Number(launch?.blockingOpen ?? 0);
      setRoleApps(apps);
      setFacts({ blocking: Number.isFinite(blocking) ? blocking : 0, rows: connectionRows(integrations ?? {}) });
      setUpdated(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      window.dispatchEvent(new Event("admin:today-ready"));
    }).catch(() => {
      setProblem("This did not load. Try again in a moment.");
      window.dispatchEvent(new Event("admin:today-ready"));
    });
  };

  useEffect(() => { load(); }, [password]);

  // The one count, or null while the list is being read or when it did not load.
  const counted = inbox.load.phase === "ready" ? inbox.counts : null;
  const settled = !!facts && inbox.load.phase !== "loading";
  const decisions = counted ? counted.decisions : null;
  // What the list holds beside the count: with any of it, Home does not say nothing is waiting.
  const beside = counted ? counted.blocked + counted.applications + counted.unknown.length : 0;
  const glance = settled ? glanceSentence(decisions, facts.rows, beside) : null;
  const needs = settled ? needsFrom(counted ? counted.waiting + counted.unknown.length : null, facts.blocking) : null;

  // What changed since THIS person last looked on this device, said once a visit. The look is kept with whose it
  // was, so a count is never carried from one person to the next on a shared device.
  useEffect(() => {
    if (looked.current || !facts || decisions === null || !who) return;
    looked.current = true;
    setSince(sinceLastVisit(readLastGlance(who), decisions));
    rememberGlance(decisions, facts.rows.filter((row) => row.state !== "working").length, who);
  }, [facts, decisions, who]);

  const tabs = tabsInArea(area).filter((tab) => tab.key === "home" || tab.key === "email-settings" || allowed.has(tab.key));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-gray-900"><Trans context="HomeBase, h2">Today</Trans></h2>
        {glance && <p className="w-full text-base text-gray-900">{glance}</p>}
        <AllClear show={glance === "Nothing is waiting, and every connection is fine."} />
        <WeekRecap />
        {since && <p className="w-full text-sm text-gray-700">{since}</p>}
        {updated && <p className="text-sm text-gray-600"><Trans context="HomeBase, p">Updated {updated}</Trans></p>}
      </div>
      {problem ? (
        <div role="alert" className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-base text-gray-900">{problem}</p>
          <button type="button" onClick={load} className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-teal-deep px-4 text-white"><Trans context="HomeBase, button">Try again</Trans></button>
        </div>
      ) : needs ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4" aria-label={t({ message: "What needs you now", context: "HomeBase, aria-label" })}>
          <p className="flex items-center gap-2 text-sm font-medium text-gray-900"><Mark shape={needs.shape} />{needs.word}</p>
          <p className="mt-1 text-lg text-gray-900" data-home-count="">
            {!counted ? (
              <Trans context="HomeBase, the one count did not load">The count of what is waiting on you did not load.</Trans>
            ) : needs.sentence ? (
              needs.sentence
            ) : (
              <DecisionsLine counts={counted} />
            )}
          </p>
          {!counted && (
            <button type="button" onClick={() => void inbox.read()} className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-teal-deep px-4 text-white"><Trans context="HomeBase, button">Try again</Trans></button>
          )}
        </section>
      ) : (
        <p className="text-base text-gray-600"><Trans context="HomeBase, p">Reading what is waiting...</Trans></p>
      )}
      {!problem && needs && <RoleApplicationsList rows={roleApps} heading="Role applications waiting" />}
      {/* How roles are going, its own page (the lead, 27 Nov 2026: "add this to admin here as a button to see this
          information"). Always offered, whether or not an application waits. */}
      <p>
        <Link
          href="/admin/role-progress"
          data-role-progress-door=""
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 text-base font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t({ message: "See how roles are going", context: "HomeBase, door to the role progress page" })}
          <span aria-hidden="true">→</span>
        </Link>
      </p>
      {/* The review lane's one list, read as this person (NeedsYouNow.tsx). */}
      <NeedsYouNow inbox={inbox} />
      <div className="grid gap-2 sm:grid-cols-2">
        {ADMIN_AREAS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={area === item.id}
            onClick={() => setArea(item.id)}
            className={`min-h-[44px] rounded-xl border px-3 py-3 text-left ${area === item.id ? "border-gray-900 bg-white" : "border-gray-200 bg-white"}`}
          >
            <span className="block text-base font-semibold text-gray-900">{item.name}</span>
            <span className="block text-sm text-gray-700">{item.plain}</span>
          </button>
        ))}
      </div>
      <div>
        {area === "inbox" && <UnifiedInbox password={password} onOpen={onOpenTab} />}
        <p className="text-sm text-gray-700">{ADMIN_AREAS.find((item) => item.id === area)?.help}</p>
        <ul className="mt-2 space-y-1">
          {tabs.filter((tab) => tab.key !== "home").map((tab) => (
            <li key={tab.key}>
              <button type="button" onClick={() => onOpenTab(tab.key)} className="flex min-h-[44px] w-full items-center rounded-lg px-2 text-left text-base text-gray-900 hover:bg-gray-50">
                <span className="font-medium">{tab.name}</span>
                <span className="sr-only">. {tab.help}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
        <GentleQuests />
        <FeelSettings role={role} onChanged={() => onOpenTab("home")} />
        <label className="flex min-h-11 w-full cursor-pointer items-center gap-3 py-2 text-sm text-gray-900">
        <input
          type="checkbox"
          className="h-6 w-6 shrink-0"
          onChange={(e) => {
            setHomeBaseOn(!e.target.checked);
            if (e.target.checked) onOpenTab("submissions");
          }}
        />
        Start on the form list instead
      </label>
    </div>
  );
}
