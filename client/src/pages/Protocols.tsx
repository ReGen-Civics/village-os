/**
 * /protocols, /protocols/run/:id and /protocols/practice/:protocolId: the
 * village's checklists, a run, and a practice run.
 *
 * A PRACTICE RUN never leaves this page. It is walked in memory, from the
 * same snapshot, so it works with no signal; nothing is queued, sent or kept,
 * no quest is claimed, and every step may be ticked, a role's included, with
 * the role named as the one who ticks it in a real run. It says it is practice
 * at the top and again at the end.
 *
 * WORKS WITH NO SIGNAL. With no network the app's own boot cannot say who is
 * signed in (AuthProvider keeps the token and has no user) or which modules are
 * on (ModuleProvider ends `failed`). So this page does not wait for either:
 * it reads the token's owner, and that owner's last copy of GET /api/protocols
 * (a snapshot, which also proves the module was on at the last visit), draws
 * from it at once, and lays every change still in the offline queue on top
 * (lib/protocolsState.ts). Online, the fresh answer replaces the copy.
 *
 * Every start, tick and ending goes through the shared offline queue
 * (lib/offlineQueue.ts) first, so a change made with no signal is the same
 * change as one made with it, sent when the signal comes back.
 *
 * The rules the server holds (a role step, a required step still open) are
 * applied here too, from shared/protocols.ts, so the phone says no at once.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Check, WifiOff } from "lucide-react";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import {
  completionRefusal,
  mayTick,
  openRequiredSteps,
  progress,
  stepStates,
  type ProtocolStep,
  type ProtocolView,
  type RunView,
} from "@shared/protocols";
import Layout from "@/components/Layout";
import BreathingLoader from "@/components/natural/BreathingLoader";
import ModuleGate, { SignInToSee } from "@/components/modules/ModuleGate";
import { useAuth } from "@/contexts/AuthContext";
import { useModules } from "@/modules/ModuleProvider";
import { authToken, gameFetch } from "@/lib/gameApi";
import { flushWhenOnline, readSnapshot, tokenOwner, writeSnapshot, type QueuedRequest } from "@/lib/offlineQueue";
import {
  PROTOCOLS_SNAPSHOT,
  kindOf,
  pendingForRun,
  protocolsQueue,
  queueEnd,
  queueStart,
  queueTick,
  withPending,
  type ProtocolsPayload,
} from "@/lib/protocolsState";
import { keepProtocolsOffline, pointManifestAtProtocols } from "@/lib/protocolsOffline";
import InstallCard from "@/components/protocols/InstallCard";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, EYEBROW, H1, H2, HINT, LEDE, LINK, NOTE, WORLD } from "@/components/journey/look";

type Load =
  | { state: "loading" }
  | { state: "ready"; data: ProtocolsPayload; fresh: boolean }
  | { state: "signed-out" }
  | { state: "off" }
  | { state: "none" };

function usePending(owner: string | null): QueuedRequest[] {
  const q = protocolsQueue();
  const subscribe = useCallback((fn: () => void) => q.subscribe(fn), [q]);
  const read = useCallback(() => JSON.stringify(owner ? q.pending(owner) : []), [q, owner]);
  const raw = useSyncExternalStore(subscribe, read, read);
  return useMemo(() => JSON.parse(raw) as QueuedRequest[], [raw]);
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

const when = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
};

export default function Protocols() {
  const { t } = useLingui();
  const { user } = useAuth();
  const modules = useModules();
  const params = useParams<{ id?: string; protocolId?: string }>();
  const [, navigate] = useLocation();
  const online = useOnline();
  const token = authToken();
  const owner = user?.id ? String(user.id) : token ? tokenOwner(token) : null;
  const pending = usePending(owner);
  const [load, setLoad] = useState<Load>(() => {
    if (!owner) return { state: "loading" };
    const kept = readSnapshot<ProtocolsPayload>(PROTOCOLS_SNAPSHOT, owner);
    return kept ? { state: "ready", data: kept.value, fresh: false } : { state: "loading" };
  });
  const [note, setNote] = useState<string | null>(null);

  const moduleKnownOff = modules.loaded && !modules.failed && !(modules.modules ?? []).some((m) => m.id === "protocols" && m.lifecycle !== "off");

  const refresh = useCallback(async () => {
    if (!owner) {
      setLoad({ state: "signed-out" });
      return;
    }
    try {
      const res = await gameFetch("/api/protocols");
      if (res.status === 401) return setLoad({ state: "signed-out" });
      if (res.status === 404) return setLoad({ state: "off" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as ProtocolsPayload;
      writeSnapshot(PROTOCOLS_SNAPSHOT, owner, data);
      setLoad({ state: "ready", data, fresh: true });
    } catch {
      const kept = readSnapshot<ProtocolsPayload>(PROTOCOLS_SNAPSHOT, owner);
      setLoad(kept ? { state: "ready", data: kept.value, fresh: false } : { state: "none" });
    }
  }, [owner]);

  const sync = useCallback(
    async (byHand = false) => {
      if (!owner) return;
      const r = await protocolsQueue().flush(owner);
      if (r.sent.length) await refresh();
      if (!byHand) return;
      if (r.offline) setNote(t({ message: `No signal yet. Everything you ticked is safe on this phone.`, context: "protocols page" }));
      else if (r.sessionEnded) setNote(t({ message: `Sign in again to send what you ticked. It stays on this phone until then.`, context: "protocols page" }));
      else if (r.refused.length) setNote(t({ message: `The village did not take every change. Each one says why, on its run.`, context: "protocols page" }));
      else setNote(r.sent.length ? t({ message: `Everything is sent.`, context: "protocols page" }) : t({ message: `Nothing was waiting.`, context: "protocols page" }));
    },
    [owner, refresh, t],
  );

  useEffect(() => {
    void refresh().then(() => sync());
    return flushWhenOnline(protocolsQueue(), () => owner, (r) => {
      if (r.sent.length) void refresh();
    });
  }, [owner, refresh, sync]);

  // The offline shell and the installed app's manifest, only once the module is known to be on here.
  const ready = load.state === "ready";
  useEffect(() => {
    if (!ready) return;
    keepProtocolsOffline();
    return pointManifestAtProtocols();
  }, [ready]);

  if (moduleKnownOff || load.state === "off") return <ModuleGate moduleId="protocols" name="Protocols" />;
  if (load.state === "signed-out" || (!owner && modules.loaded)) return <SignInToSee moduleId="protocols" name="Protocols" />;
  if (load.state === "none") {
    return modules.failed ? (
      <ModuleGate moduleId="protocols" name="Protocols" />
    ) : (
      <Layout>
        <div className={`${WORLD} container max-w-3xl py-10`}>
          <p className={NOTE}>
            <Trans context="protocols page">The protocols did not load. Check your signal and try again.</Trans>
          </p>
          <button type="button" className={`${BTN_SECONDARY} mt-4`} onClick={() => void refresh()}>
            <Trans context="protocols page">Try again</Trans>
          </button>
        </div>
      </Layout>
    );
  }
  if (load.state !== "ready") {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <BreathingLoader label={t({ message: `Opening the protocols`, context: "protocols page" })} />
        </div>
      </Layout>
    );
  }

  const view = withPending(load.data, pending);
  const waiting = pending.filter((p) => !p.refused).length;
  const runId = params.id ? decodeURIComponent(params.id) : null;
  const run = runId ? view.runs.find((r) => r.id === runId) ?? null : null;
  const practiceId = params.protocolId ? decodeURIComponent(params.protocolId) : null;
  const practiceOf = practiceId ? view.protocols.find((p) => p.id === practiceId) ?? null : null;
  const questTitleOf = (protocolId: string) => view.protocols.find((p) => p.id === protocolId)?.questTitle ?? "";

  const start = (p: ProtocolView) => {
    if (!owner) return;
    const id = queueStart(owner, p);
    navigate(`/protocols/run/${encodeURIComponent(id)}`);
    void sync();
  };

  return (
    <Layout>
      <div className={WORLD}>
        <div className="container max-w-xl space-y-5 py-6 md:py-10">
          <OfflineBanner
            online={online}
            fresh={load.fresh}
            title={run?.title ?? null}
            waiting={waiting}
            note={note}
            onSync={() => void sync(true)}
          />
          {runId && <InstallCard auto={load.data.settings?.showInstallCard !== false} quietLink={false} />}
          {practiceId ? (
            practiceOf ? (
              <PracticeRun key={practiceOf.id} protocol={practiceOf} viewer={view.viewer} holders={view.roleHolders ?? {}} />
            ) : (
              <section className={CARD}>
                <p className={NOTE}>
                  <Trans context="protocols page">That protocol is not on this phone. Open the list with signal once, then practise.</Trans>
                </p>
                <Link href="/protocols" className={`${LINK} mt-3 inline-block`}>
                  <Trans context="protocols page">All protocols</Trans>
                </Link>
              </section>
            )
          ) : runId ? (
            run ? (
              <RunPage
                run={run}
                viewer={view.viewer}
                holders={view.roleHolders ?? {}}
                owner={owner!}
                pending={pendingForRun(pending, run.id)}
                questTitle={questTitleOf(run.protocolId)}
                onTick={(stepId, done) => {
                  queueTick(owner!, run.id, stepId, done);
                  void sync();
                }}
                onEnd={(how) => {
                  queueEnd(owner!, run.id, how);
                  void sync();
                }}
              />
            ) : (
              <section className={CARD}>
                <p className={NOTE}>
                  <Trans context="protocols page">That run is not on this phone. It may have been started on another phone that has not sent it yet.</Trans>
                </p>
                <Link href="/protocols" className={`${LINK} mt-3 inline-block`}>
                  <Trans context="protocols page">All protocols</Trans>
                </Link>
              </section>
            )
          ) : (
            <ListPage data={view} onStart={start} />
          )}
          {!runId && !practiceId && <InstallCard auto={load.data.settings?.showInstallCard !== false} />}
        </div>
      </div>
    </Layout>
  );
}

/** The design's calm notice (`.banner`): never red, a success-tinted edge and an icon. */
const BANNER = "flex items-center gap-3 rounded-[14px] border border-open/25 bg-card px-3.5 py-3";
const BANNER_ICON = "grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-open/15 text-open";

/**
 * With no signal, or with changes still on the phone, the page says so once,
 * calmly: the work is kept and will be sent. Online with nothing waiting, it
 * says nothing at all.
 */
function OfflineBanner(props: { online: boolean; fresh: boolean; title: string | null; waiting: number; note: string | null; onSync: () => void }) {
  const { online, fresh, title, waiting, note, onSync } = props;
  if (online && fresh && waiting === 0 && !note) return null;
  const heading = !online || !fresh
    ? title
      ? <Trans context="protocols page">{title} works offline</Trans>
      : <Trans context="protocols page">The protocols work offline</Trans>
    : <Plural context="protocols page" value={waiting} one="# change to send" other="# changes to send" />;
  return (
    <div className={BANNER} role="status" aria-live="polite">
      <div className={BANNER_ICON} aria-hidden="true">
        {online ? <Check className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-foreground">{heading}</p>
        <p className="text-xs text-muted-foreground">
          {note ?? <Trans context="protocols page">Kept on your phone. It sends when you're back in signal.</Trans>}
        </p>
        {waiting > 0 && (!online || !fresh) && (
          <p className="text-xs text-muted-foreground">
            <Plural context="protocols page" value={waiting} one="# change is waiting to send." other="# changes are waiting to send." />
          </p>
        )}
      </div>
      {online && waiting > 0 && (
        <button type="button" className={BTN_SECONDARY} onClick={onSync}>
          <Trans context="protocols page">Send now</Trans>
        </button>
      )}
    </div>
  );
}

function ListPage({ data, onStart }: { data: ProtocolsPayload; onStart: (p: ProtocolView) => void }) {
  const open = data.runs.filter((r) => r.status === "open");
  const ended = data.runs.filter((r) => r.status !== "open").slice(0, 10);
  return (
    <>
      <header className="space-y-2">
        <p className={EYEBROW}>
          <Trans context="protocols page">Protocols</Trans>
        </p>
        <h1 className={H1}>
          <Trans context="protocols page">Do it the same careful way, every time</Trans>
        </h1>
        <p className={LEDE}>
          <Trans context="protocols page">Start a run, tick each step as it is done, and the village keeps who ticked what and when.</Trans>
        </p>
      </header>

      {open.length > 0 && (
        <section aria-labelledby="open-runs" className="space-y-3">
          <h2 id="open-runs" className={H2}>
            <Trans context="protocols page">Runs in progress</Trans>
          </h2>
          <ul className="space-y-3">
            {open.map((r) => (
              <RunRow key={r.id} run={r} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="all-protocols" className="space-y-3">
        <h2 id="all-protocols" className={H2}>
          <Trans context="protocols page">Protocols</Trans>
        </h2>
        {data.protocols.length === 0 ? (
          <p className={NOTE}>
            <Trans context="protocols page">No protocols yet. An admin writes them on the module's page.</Trans>
          </p>
        ) : (
          <ul className="space-y-4">
            {data.protocols.map((p) => {
              const required = p.steps.filter((s) => s.required).length;
              return (
                <li key={p.id} className="overflow-hidden rounded-[18px] border border-border bg-card/55">
                  {p.image ? <Photo src={p.image} title={p.title} /> : null}
                  <div className="space-y-3 p-4">
                    {!p.image && <h3 className="font-display text-2xl text-foreground">{p.title}</h3>}
                    {p.summary && <p className={HINT}>{p.summary}</p>}
                    <p className="text-xs text-muted-foreground">
                      <Plural context="protocols page" value={p.steps.length} one="# step" other="# steps" />,{" "}
                      <Trans context="protocols page">{required} required</Trans>
                    </p>
                    {p.questTitle && (
                      <p className="text-xs text-muted-foreground">
                        <Trans context="protocols page">Completing it hands in {p.questTitle} for a steward to confirm.</Trans>
                      </p>
                    )}
                    <button type="button" className={`${BTN_PRIMARY} w-full`} onClick={() => onStart(p)}>
                      <Trans context="protocols page">Start</Trans>
                    </button>
                    <Link href={`/protocols/practice/${encodeURIComponent(p.id)}`} className={`${LINK} block min-h-11 py-2 text-center text-sm`}>
                      <Trans context="protocols page">Practise it first (nothing is recorded)</Trans>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {ended.length > 0 && (
        <section aria-labelledby="recent-runs" className="space-y-3">
          <h2 id="recent-runs" className={H2}>
            <Trans context="protocols page">Recent runs</Trans>
          </h2>
          <ul className="space-y-3">
            {ended.map((r) => (
              <RunRow key={r.id} run={r} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** The design's photo header: the village's own picture, the title over its darkened foot. */
function Photo({ src, title }: { src: string; title: string }) {
  return (
    <div className="relative overflow-hidden">
      <img src={src} alt="" className="h-[150px] w-full object-cover" style={{ objectPosition: "50% 40%" }} loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/10 to-background/85" aria-hidden="true" />
      <h3 className="absolute bottom-3 left-4 right-4 font-display text-3xl leading-tight text-foreground">{title}</h3>
    </div>
  );
}

function RunRow({ run }: { run: RunView }) {
  const { t } = useLingui();
  const p = requiredProgress(run);
  const label =
    run.status === "complete"
      ? t({ message: `Complete`, context: "protocols page" })
      : run.status === "set-aside"
        ? t({ message: `Set aside`, context: "protocols page" })
        : t({ message: `${p.done} of ${p.total} done`, context: "protocols page" });
  const starter = run.startedByName || t({ message: `a member`, context: "protocols page" });
  const started = when(run.startedAt);
  return (
    <li>
      <Link
        href={`/protocols/run/${encodeURIComponent(run.id)}`}
        className="flex min-h-11 items-center justify-between gap-3 rounded-[14px] border border-border bg-card/55 px-4 py-3 hover:border-notice"
      >
        <span className="min-w-0">
          <span className="block font-medium text-foreground">{run.title}</span>
          <span className="text-xs text-muted-foreground">
            <Trans context="protocols page">
              Started by {starter}, {started}
            </Trans>
          </span>
        </span>
        <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      </Link>
    </li>
  );
}

/** Progress counts the required steps, the ones that decide whether a run can be completed. */
function requiredProgress(run: RunView): { done: number; total: number } {
  const states = stepStates(run.steps, run.ticks);
  const req = run.steps.filter((s) => s.required);
  return { done: req.filter((s) => states.get(s.id)?.done).length, total: req.length };
}

const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** "Role (Ana, Ben)", or the role alone when nobody holds it. Role first, holders in parentheses. */
function roleWithHolders(roleTitle: string, names: readonly string[] | undefined): string {
  const list = (names ?? []).slice(0, 3);
  if (list.length === 0) return roleTitle;
  const more = (names?.length ?? 0) - list.length;
  return `${roleTitle} (${list.join(", ")}${more > 0 ? ` +${more}` : ""})`;
}

/**
 * A practice run: the protocol's steps, ticked in this page's memory only.
 * Nothing is queued or sent, so nothing is recorded and no quest is claimed.
 */
function PracticeRun({ protocol, viewer, holders }: { protocol: ProtocolView; viewer: ProtocolsPayload["viewer"]; holders: Record<string, string[]> }) {
  const [ticks, setTicks] = useState<RunView["ticks"]>([]);
  const [finished, setFinished] = useState<string | null>(null);
  const run: RunView = {
    id: `practice-${protocol.id}`,
    protocolId: protocol.id,
    version: protocol.version,
    title: protocol.title,
    image: protocol.image,
    steps: protocol.steps,
    questId: "",
    questClaimed: false,
    startedBy: viewer.id,
    startedByName: viewer.name,
    startedAt: "",
    status: finished ? "complete" : "open",
    endedAt: finished,
    endedBy: finished ? viewer.id : null,
    endedByName: finished ? viewer.name : null,
    ticks,
  };
  return (
    <RunPage
      run={run}
      viewer={viewer}
      holders={holders}
      owner={viewer.id}
      pending={[]}
      questTitle=""
      practice
      onTick={(stepId, done) =>
        setTicks((list) => [
          ...list,
          { clientId: `p${String(list.length).padStart(8, "0")}`, stepId, done, by: viewer.id, byName: viewer.name, at: new Date().toISOString() },
        ])
      }
      onEnd={(how) => (how === "complete" ? setFinished(new Date().toISOString()) : undefined)}
      onPracticeAgain={() => {
        setTicks([]);
        setFinished(null);
      }}
    />
  );
}

function RunPage(props: {
  run: RunView;
  viewer: ProtocolsPayload["viewer"];
  holders: Record<string, string[]>;
  owner: string;
  pending: QueuedRequest[];
  /** The linked quest's title, for the line a completed run shows. */
  questTitle: string;
  onTick: (stepId: string, done: boolean) => void;
  onEnd: (how: "complete" | "set-aside") => void;
  /** A practice run: every step is the member's to tick, and nothing is recorded. */
  practice?: boolean;
  onPracticeAgain?: () => void;
}) {
  const { run, viewer, holders, owner, pending, questTitle, onTick, onEnd, practice = false, onPracticeAgain } = props;
  const { t } = useLingui();
  const [confirmAside, setConfirmAside] = useState(false);
  const ended = when(run.endedAt);
  const ender = run.endedByName || t({ message: `a member`, context: "protocols page" });
  const states = stepStates(run.steps, run.ticks);
  const openSteps = openRequiredSteps(run.steps, run.ticks);
  const p = requiredProgress(run);
  const isOpen = run.status === "open";
  const refused = pending.filter((x) => x.refused);
  const me = { id: viewer.id, roleIds: viewer.roleIds };
  const mine = (s: ProtocolStep) => practice || mayTick(s, me);

  // The one step in front of this member now: the first open required step
  // they may tick, else the first open optional one.
  const now =
    run.steps.find((s) => s.required && !states.get(s.id)?.done && mine(s)) ??
    run.steps.find((s) => !s.required && !states.get(s.id)?.done && mine(s)) ??
    null;
  const waitingOn = openSteps.find((s) => !mine(s)) ?? null;

  // Who else has ticked in this run, by first name, for "with Ana".
  const others = Array.from(new Set(run.ticks.filter((x) => x.by !== viewer.id).map((x) => firstName(x.byName)).filter(Boolean)));

  const toggle = (stepId: string, done: boolean) => onTick(stepId, done);
  const end = (how: "complete" | "set-aside") => {
    onEnd(how);
    setConfirmAside(false);
  };

  const pct = p.total ? Math.round((p.done / p.total) * 100) : 100;
  const withOthers = others.join(", ");

  return (
    <>
      <Link href="/protocols" className={`${LINK} text-sm`}>
        <Trans context="protocols page">All protocols</Trans>
      </Link>

      {practice && (
        <div className={BANNER} role="note">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-foreground">
              <Trans context="protocols practice run">Practice run</Trans>
            </p>
            <p className="text-xs text-muted-foreground">
              <Trans context="protocols practice run">Nothing here is recorded or sent, and no quest is claimed. Tick every step to learn the list.</Trans>
            </p>
          </div>
        </div>
      )}

      {run.image ? (
        <div className="overflow-hidden rounded-[18px]">
          <Photo src={run.image} title={run.title} />
        </div>
      ) : (
        <h1 className={H1}>{run.title}</h1>
      )}

      <section aria-label={t({ message: `Progress`, context: "protocols page" })}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold text-foreground">
            <Trans context="protocols page">
              {p.done} of {p.total} done
            </Trans>
          </p>
          {withOthers && (
            <p className="text-sm text-muted-foreground">
              <Trans context="protocols page">with {withOthers}</Trans>
            </p>
          )}
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-lg bg-foreground/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={p.total}
          aria-valuenow={p.done}
          aria-label={t({ message: `Required steps done`, context: "protocols page" })}
        >
          <i className="block h-full bg-gradient-to-r from-open to-primary" style={{ width: `${pct}%` }} />
        </div>
        {practice && run.status === "complete" && (
          <div className="mt-3 space-y-3">
            <p className="text-base font-medium text-foreground">
              <Trans context="protocols practice run">Practice finished. Nothing was recorded.</Trans>
            </p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={BTN_SECONDARY} onClick={onPracticeAgain}>
                <Trans context="protocols practice run">Practise again</Trans>
              </button>
              <Link href="/protocols" className={BTN_SECONDARY}>
                <Trans context="protocols practice run">Back to the list</Trans>
              </Link>
            </div>
          </div>
        )}
        {!practice && run.status === "complete" && run.questClaimed && questTitle && (
          <p className="mt-2 text-sm text-muted-foreground">
            <Trans context="protocols page">Handed in for {questTitle}. A steward confirms it.</Trans>
          </p>
        )}
        {!practice && run.status !== "open" && (
          <p className="mt-3 text-base font-medium text-foreground">
            {run.status === "complete" ? (
              <Trans context="protocols page">
                Completed by {ender}, {ended}.
              </Trans>
            ) : (
              <Trans context="protocols page">
                Set aside by {ender}, {ended}.
              </Trans>
            )}
          </p>
        )}
      </section>

      {refused.length > 0 && (
        <section
          aria-label={t({ message: `Changes the village did not take`, context: "protocols page" })}
          className="rounded-[14px] border border-destructive/40 bg-destructive/5 px-4 py-3"
        >
          <p className="text-sm font-medium text-foreground">
            <Plural context="protocols page" value={refused.length} one="The village did not take # change on this run." other="The village did not take # changes on this run." />
          </p>
          <ul className="mt-2 space-y-2">
            {refused.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {kindOf(x) === "tick"
                    ? t({ message: `A tick`, context: "protocols page" })
                    : kindOf(x) === "start"
                      ? t({ message: `Starting the run`, context: "protocols page" })
                      : t({ message: `Ending the run`, context: "protocols page" })}
                  : {x.lastError}
                </span>
                <span className="flex gap-2">
                  <button type="button" className={BTN_SECONDARY} onClick={() => void protocolsQueue().retry(owner, x.id)}>
                    <Trans context="protocols page">Try again</Trans>
                  </button>
                  <button type="button" className={BTN_SECONDARY} onClick={() => protocolsQueue().remove(x.id)}>
                    <Trans context="protocols page">Remove</Trans>
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="m-0 list-none p-0" aria-label={t({ message: `Steps`, context: "protocols page" })}>
        {run.steps.map((s, i) => {
          const st = states.get(s.id);
          const done = !!st?.done;
          const allowed = mine(s);
          const isNow = isOpen && now?.id === s.id;
          const kept = s.who.kind === "role";
          const lock = kept && !done && (!allowed || openSteps.some((o) => o.id !== s.id));
          const who = done ? firstName(st?.byName) : !s.required ? t({ message: `optional`, context: "protocols page" }) : "";
          const keptFor = s.who.kind === "role" ? roleWithHolders(s.who.roleTitle, holders[s.who.roleId]) : "";
          return (
            <li
              key={s.id}
              className={`${i === 0 || isNow ? "" : "border-t border-border"} ${isNow ? "my-1 -mx-2 rounded-xl bg-primary/10" : ""} ${!done && !s.required && !isNow ? "opacity-60" : ""}`}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={s.text}
                disabled={!isOpen || !allowed}
                onClick={() => toggle(s.id, !done)}
                className={`flex w-full min-h-11 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default ${isNow ? "px-2.5 py-3.5" : "px-0.5 py-3"}`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border-2 ${
                    done ? "border-open bg-open text-background" : isNow ? "border-primary" : "border-foreground/40"
                  } ${lock ? "border-dashed" : ""}`}
                >
                  {done && <Check className="h-4 w-4" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1 text-[15.5px]">
                  <span className={done ? "text-muted-foreground line-through decoration-muted-foreground/50" : isNow ? "font-semibold text-foreground" : "text-foreground"}>
                    {s.text}
                  </span>
                  {isNow && s.detail && <span className="mt-0.5 block whitespace-pre-line text-sm text-muted-foreground">{s.detail}</span>}
                  {kept && !done && (
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {practice
                        ? t({ message: `In a real run, ${keptFor} ticks this one.`, context: "protocols practice run" })
                        : allowed
                          ? t({ message: `Yours to tick, as ${keptFor}.`, context: "protocols page" })
                          : t({ message: `${keptFor} ticks this one.`, context: "protocols page" })}
                    </span>
                  )}
                </span>
                {who && <span className="ml-auto shrink-0 whitespace-nowrap pl-2 text-xs text-muted-foreground">{who}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {isOpen && (
        <section className="space-y-3" aria-label={t({ message: `Finish`, context: "protocols page" })}>
          {openSteps.length === 0 ? (
            <button type="button" className={`${BTN_PRIMARY} min-h-[52px] w-full text-base`} onClick={() => end("complete")}>
              {practice ? <Trans context="protocols practice run">Finish practice</Trans> : <Trans context="protocols page">Mark complete</Trans>}
            </button>
          ) : now && now.required ? (
            <button type="button" className={`${BTN_PRIMARY} min-h-[52px] w-full text-base`} onClick={() => toggle(now.id, true)}>
              <Trans context="protocols page">Done: {now.text}</Trans>
            </button>
          ) : (
            <p className={NOTE}>
              {completionRefusal(openSteps)}{" "}
              {waitingOn && waitingOn.who.kind === "role" && (
                <Trans context="protocols page">
                  Waiting for {roleWithHolders(waitingOn.who.roleTitle, holders[waitingOn.who.roleId])}.
                </Trans>
              )}
            </p>
          )}
          <div className="text-center">
            {practice ? (
              <Link href="/protocols" className={`${LINK} inline-block min-h-11 py-2 text-sm`}>
                <Trans context="protocols practice run">Stop practising</Trans>
              </Link>
            ) : confirmAside ? (
              <span className="inline-flex flex-wrap justify-center gap-3">
                <button type="button" className={BTN_SECONDARY} onClick={() => end("set-aside")}>
                  <Trans context="protocols page">Yes, set it aside</Trans>
                </button>
                <button type="button" className={BTN_SECONDARY} onClick={() => setConfirmAside(false)}>
                  <Trans context="protocols page">Keep going</Trans>
                </button>
              </span>
            ) : (
              <button type="button" className={`${LINK} min-h-11 text-sm`} onClick={() => setConfirmAside(true)}>
                <Trans context="protocols page">Set this run aside</Trans>
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
