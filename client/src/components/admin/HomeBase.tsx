/**
 * Home: six areas and the one thing that needs you now.
 *
 * It reads lists the admin already loads. It does not change them. The time
 * is when this page finished reading. A switch on this device can make the
 * next visit open the form list instead.
 */
import { useEffect, useState } from "react";
import { API_BASE, authHeaders } from "@/components/admin/adminApi";
import type { NavGroup } from "@/components/admin/adminNavGroups";
import { ADMIN_AREAS, setHomeBaseOn, tabsInArea, type AreaId } from "./adminAreas";
import { connectionRows, glanceSentence, readLastGlance, rememberGlance, sinceLastVisit } from "./todayGlance";
import { waitingRequests } from "./waitingWork";
import UnifiedInbox from "./UnifiedInbox";
import RoleApplicationsList from "./RoleApplicationsList";
import { fetchWaitingRoleApplications, type RoleApplicationRow } from "./roleApplicationsWaiting";
import { AllClear, FeelSettings, GentleQuests, WeekRecap } from "./AdminFeel";
import { Trans, useLingui } from "@lingui/react/macro";

interface Needs {
  sentence: string;
  shape: "tick" | "dot" | "cross";
  word: string;
}

/**
 * Role applications count as requests (Rye, 16 Nov 2026), and the sentence says
 * how many of the waiting ones they are, so one is never folded out of sight.
 */
function needsFrom(submissions: number, blocking: number, roleApplications = 0): Needs {
  const total = submissions + roleApplications;
  if (total > 0) {
    const noun = total === 1 ? "request is" : "requests are";
    const roles = roleApplications === 0
      ? ""
      : total === roleApplications
        ? (roleApplications === 1 ? ", a role application" : ", all role applications")
        : roleApplications === 1 ? ", 1 of them a role application" : `, ${roleApplications} of them role applications`;
    return { sentence: `${total} ${noun} waiting${roles}.`, shape: "dot", word: "Waiting" };
  }
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
  const [needs, setNeeds] = useState<Needs | null>(null);
  const [glance, setGlance] = useState<string | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const [area, setArea] = useState<AreaId>("today");
  const [roleApps, setRoleApps] = useState<RoleApplicationRow[]>([]);
  const allowed = new Set(groups.flatMap((group) => group.items.map((item) => item.key)));

  const load = () => {
    setProblem(null);
    const signal = AbortSignal.timeout(12000);
    Promise.all([
      fetch(`${API_BASE}/admin/submissions`, { headers: authHeaders(password), signal }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/admin/launch`, { headers: authHeaders(password), signal }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/admin/integrations`, { headers: authHeaders(password), signal }).then((r) => (r.ok ? r.json() : {})),
      fetchWaitingRoleApplications(password, signal).catch((): RoleApplicationRow[] => []),
    ]).then(([subs, launch, integrations, apps]) => {
      const forms = waitingRequests(Array.isArray(subs) ? subs : []);
      const count = forms + apps.length;
      const blocking = Number(launch?.blockingOpen ?? 0);
      const rows = connectionRows(integrations ?? {});
      const prev = readLastGlance();
      setRoleApps(apps);
      setNeeds(needsFrom(forms, Number.isFinite(blocking) ? blocking : 0, apps.length));
      setGlance(glanceSentence(count, rows));
      setSince(sinceLastVisit(prev, count));
      rememberGlance(count, rows.filter((row) => row.state !== "working").length);
      setUpdated(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      window.dispatchEvent(new Event("admin:today-ready"));
    }).catch(() => {
      setProblem("This did not load. Try again in a moment.");
      window.dispatchEvent(new Event("admin:today-ready"));
    });
  };

  useEffect(() => { load(); }, [password]);

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
          <p className="mt-1 text-lg text-gray-900">{needs.sentence}</p>
        </section>
      ) : (
        <p className="text-base text-gray-600"><Trans context="HomeBase, p">Reading what is waiting...</Trans></p>
      )}
      {!problem && needs && <RoleApplicationsList rows={roleApps} heading="Role applications waiting" />}
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
