/**
 * /protocols and /protocols/run/:id: the village's checklists, and a run.
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
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import {
  completionRefusal,
  mayTick,
  openRequiredSteps,
  progress,
  stepStates,
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
import { BTN_PRIMARY, BTN_SECONDARY, CARD, EYEBROW, H1, H2, HINT, LEDE, LINK, NOTE, QUIET, TILE, WORLD } from "@/components/journey/look";

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
  const params = useParams<{ id?: string }>();
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

  const start = (p: ProtocolView) => {
    if (!owner) return;
    const id = queueStart(owner, p);
    navigate(`/protocols/run/${encodeURIComponent(id)}`);
    void sync();
  };

  return (
    <Layout>
      <div className={WORLD}>
        <div className="container max-w-3xl space-y-6 py-8 md:py-12">
          <SyncLine online={online} fresh={load.fresh} savedAt={load.data.at} waiting={waiting} note={note} onSync={() => void sync(true)} />
          {runId ? (
            run ? (
              <RunPage run={run} viewer={view.viewer} owner={owner!} pending={pendingForRun(pending, run.id)} onChange={() => void sync()} />
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
          {!runId && <InstallCard auto={load.data.settings?.showInstallCard !== false} />}
        </div>
      </div>
    </Layout>
  );
}

function SyncLine(props: { online: boolean; fresh: boolean; savedAt: string; waiting: number; note: string | null; onSync: () => void }) {
  const { online, fresh, savedAt, waiting, note, onSync } = props;
  const { t } = useLingui();
  const kept = when(savedAt);
  const status = !online
    ? kept
      ? t({ message: `No signal. Showing what this phone kept on ${kept}.`, context: "protocols page" })
      : t({ message: `No signal. Showing what this phone kept.`, context: "protocols page" })
    : fresh
      ? ""
      : t({ message: `Showing what this phone kept while it reaches the village.`, context: "protocols page" });
  if (!status && waiting === 0 && !note) return null;
  return (
    <div className={`${QUIET} flex flex-wrap items-center justify-between gap-3`} role="status" aria-live="polite">
      <div className="space-y-1">
        {status && <p className={HINT}>{status}</p>}
        {waiting > 0 && (
          <p className="text-sm font-medium text-foreground">
            <Plural context="protocols page" value={waiting} one="# change is waiting to send." other="# changes are waiting to send." />
          </p>
        )}
        {note && <p className={HINT}>{note}</p>}
      </div>
      {waiting > 0 && (
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
        <section className={CARD} aria-labelledby="open-runs">
          <h2 id="open-runs" className={H2}>
            <Trans context="protocols page">Runs in progress</Trans>
          </h2>
          <ul className="mt-4 space-y-3">
            {open.map((r) => (
              <RunRow key={r.id} run={r} />
            ))}
          </ul>
        </section>
      )}

      <section className={CARD} aria-labelledby="all-protocols">
        <h2 id="all-protocols" className={H2}>
          <Trans context="protocols page">Protocols</Trans>
        </h2>
        {data.protocols.length === 0 ? (
          <p className={`${NOTE} mt-3`}>
            <Trans context="protocols page">No protocols yet. An admin writes them on the module's page.</Trans>
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.protocols.map((p) => (
              <li key={p.id} className={`${TILE} flex flex-wrap items-center justify-between gap-3`}>
                <div className="min-w-0">
                  <p className="font-display text-lg text-foreground">{p.title}</p>
                  {p.summary && <p className={HINT}>{p.summary}</p>}
                  <p className={HINT}>
                    <Plural context="protocols page" value={p.steps.length} one="# step" other="# steps" />, <Trans context="protocols page">{p.steps.filter((s) => s.required).length} required</Trans>
                  </p>
                </div>
                <button type="button" className={BTN_PRIMARY} onClick={() => onStart(p)}>
                  <Trans context="protocols page">Start</Trans>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ended.length > 0 && (
        <section className={CARD} aria-labelledby="recent-runs">
          <h2 id="recent-runs" className={H2}>
            <Trans context="protocols page">Recent runs</Trans>
          </h2>
          <ul className="mt-4 space-y-3">
            {ended.map((r) => (
              <RunRow key={r.id} run={r} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function RunRow({ run }: { run: RunView }) {
  const { t } = useLingui();
  const p = progress(run.steps, run.ticks);
  const label = run.status === "complete" ? t({ message: `Complete`, context: "protocols page" }) : run.status === "set-aside" ? t({ message: `Set aside`, context: "protocols page" }) : t({ message: `${p.done} of ${p.total} done`, context: "protocols page" });
  const starter = run.startedByName || t({ message: `a member`, context: "protocols page" });
  const started = when(run.startedAt);
  return (
    <li>
      <Link href={`/protocols/run/${encodeURIComponent(run.id)}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-2 hover:border-notice">
        <span className="min-w-0">
          <span className="block font-medium text-foreground">{run.title}</span>
          <span className={HINT}>
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

function RunPage(props: {
  run: RunView;
  viewer: ProtocolsPayload["viewer"];
  owner: string;
  pending: QueuedRequest[];
  onChange: () => void;
}) {
  const { run, viewer, owner, pending, onChange } = props;
  const { t } = useLingui();
  const [confirmAside, setConfirmAside] = useState(false);
  const starter = run.startedByName || t({ message: `a member`, context: "protocols page" });
  const started = when(run.startedAt);
  const ended = when(run.endedAt);
  const ender = run.endedByName || t({ message: `a member`, context: "protocols page" });
  const someone = t({ message: `a member`, context: "protocols page" });
  const states = stepStates(run.steps, run.ticks);
  const openSteps = openRequiredSteps(run.steps, run.ticks);
  const p = progress(run.steps, run.ticks);
  const isOpen = run.status === "open";
  const refused = pending.filter((x) => x.refused);
  const me = { id: viewer.id, roleIds: viewer.roleIds };

  const toggle = (stepId: string, done: boolean) => {
    queueTick(owner, run.id, stepId, done);
    onChange();
  };
  const end = (how: "complete" | "set-aside") => {
    queueEnd(owner, run.id, how);
    setConfirmAside(false);
    onChange();
  };

  return (
    <>
      <header className="space-y-2">
        <Link href="/protocols" className={LINK}>
          <Trans context="protocols page">All protocols</Trans>
        </Link>
        <h1 className={H1}>{run.title}</h1>
        <p className={LEDE}>
          <Trans context="protocols page">
            Started by {starter}, {started}. {p.done} of {p.total} done.
          </Trans>
        </p>
        {run.status !== "open" && (
          <p className="text-base font-medium text-foreground">
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
      </header>

      {refused.length > 0 && (
        <section aria-label={t({ message: `Changes the village did not take`, context: "protocols page" })} className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            <Plural context="protocols page" value={refused.length} one="The village did not take # change on this run." other="The village did not take # changes on this run." />
          </p>
          <ul className="mt-2 space-y-2">
            {refused.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className={HINT}>
                  {kindOf(x) === "tick" ? t({ message: `A tick`, context: "protocols page" }) : kindOf(x) === "start" ? t({ message: `Starting the run`, context: "protocols page" }) : t({ message: `Ending the run`, context: "protocols page" })}: {x.lastError}
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

      <section className={CARD} aria-label={t({ message: `Steps`, context: "protocols page" })}>
        <ol className="space-y-3">
          {run.steps.map((s, i) => {
            const st = states.get(s.id);
            const allowed = mayTick(s, me);
            const done = !!st?.done;
            return (
              <li key={s.id} className={`${TILE} flex items-start gap-3`}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={s.text}
                  disabled={!isOpen || !allowed}
                  onClick={() => toggle(s.id, !done)}
                  className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${
                    done ? "border-notice bg-notice text-background" : "border-border bg-card text-transparent"
                  }`}
                >
                  <span aria-hidden="true">✓</span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-base text-foreground">
                    <span className="text-muted-foreground">{i + 1}. </span>
                    {s.text}
                    {!s.required && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        <Trans context="protocols page">(optional)</Trans>
                      </span>
                    )}
                  </p>
                  {s.detail && <p className={`${HINT} mt-1 whitespace-pre-line`}>{s.detail}</p>}
                  {s.who.kind === "role" && (
                    <p className="mt-1 text-sm text-notice">{allowed ? t({ message: `Your step as ${s.who.roleTitle}`, context: "protocols page" }) : t({ message: `For the ${s.who.roleTitle} to tick`, context: "protocols page" })}</p>
                  )}
                  {st?.by && (
                    <p className={`${HINT} mt-1`}>
                      {done
                        ? t({ message: `Ticked by ${st.byName || someone}, ${when(st.at)}`, context: "protocols page" })
                        : t({ message: `Unticked by ${st.byName || someone}, ${when(st.at)}`, context: "protocols page" })}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {isOpen && (
        <section className={`${CARD} space-y-3`} aria-label={t({ message: `Finish`, context: "protocols page" })}>
          {openSteps.length > 0 ? (
            <p className={NOTE}>
              {completionRefusal(openSteps)} <Trans context="protocols page">It can be completed once every required step is ticked.</Trans>
            </p>
          ) : (
            <p className={NOTE}>
              <Trans context="protocols page">Every required step is ticked.</Trans>
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={BTN_PRIMARY} disabled={openSteps.length > 0} onClick={() => end("complete")}>
              <Trans context="protocols page">Mark complete</Trans>
            </button>
            {confirmAside ? (
              <>
                <button type="button" className={BTN_SECONDARY} onClick={() => end("set-aside")}>
                  <Trans context="protocols page">Yes, set it aside</Trans>
                </button>
                <button type="button" className={BTN_SECONDARY} onClick={() => setConfirmAside(false)}>
                  <Trans context="protocols page">Keep going</Trans>
                </button>
              </>
            ) : (
              <button type="button" className={BTN_SECONDARY} onClick={() => setConfirmAside(true)}>
                <Trans context="protocols page">Set this run aside</Trans>
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
