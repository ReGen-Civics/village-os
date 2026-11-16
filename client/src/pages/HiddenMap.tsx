/**
 * The hidden map: a members-only map of the places the members log.
 *
 * Built to the onboarding lane's screens: 08 (a closed map: your own pins, the
 * meter, the one count), 09 (log a place) and 10 (the moment it opens).
 *
 * A member sees only their own pins until enough of them are vouched for by
 * somebody else; then the whole map opens. The server decides what reaches
 * this page (shared/hiddenMap.ts `visiblePin`), so nothing here hides
 * anything: what a member may not see never arrives.
 *
 * The page's name, the layer names and the kinds are the village's own
 * (module settings), so no village's words live in this file.
 */
import { useCallback, useEffect, useState } from "react";
import { Lock, Sprout } from "lucide-react";
import { msg, plural } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { Trans, useLingui } from "@lingui/react/macro";
import type { ExportState, Layer, PinDot, PinView, Precision } from "@shared/hiddenMap";
import Layout from "@/components/Layout";
import BreathingLoader from "@/components/natural/BreathingLoader";
import ModuleGate, { SignInToSee } from "@/components/modules/ModuleGate";
import { useAuth } from "@/contexts/AuthContext";
import { useModules } from "@/modules/ModuleProvider";
import WorldMap from "@/components/hiddenMap/WorldMap";
import PinPanel from "@/components/hiddenMap/PinPanel";
import SevenMeter from "@/components/hiddenMap/SevenMeter";
import OpeningMoment, { openingSeen } from "@/components/hiddenMap/OpeningMoment";
import CaptureForm, { PRECISION_WORDS, type Capture, type SendAnswer } from "@/components/hiddenMap/CaptureForm";
import Thumb from "@/components/hiddenMap/Thumb";
import {
  addPhotos, answerExport, askExport, createPin, downloadExport, getExports, getMe, getPins, getQueue, Refused,
  type ExportView, type MapMe,
} from "@/lib/hiddenMapApi";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, H1, H2, HINT, NOTE, WORLD } from "@/components/journey/look";

type View = "map" | "log" | "vouch" | "export";

const STATE_WORDS: Record<ExportState, MessageDescriptor> = {
  pending: msg`Waiting for a second person`,
  approved: msg({ message: `Approved`, context: "hidden map page" }),
  declined: msg({ message: `Declined`, context: "hidden map page" }),
  withdrawn: msg({ message: `Withdrawn`, context: "hidden map page" }),
  expired: msg({ message: `Expired`, context: "hidden map page" }),
  downloaded: msg({ message: `Downloaded`, context: "hidden map page" }),
};

export default function HiddenMap() {
  const { t } = useLingui();
  const { user } = useAuth();
  const modules = useModules();
  const on = (modules.modules ?? []).some((m) => m.id === "hidden-map" && m.lifecycle !== "off");
  const [me, setMe] = useState<MapMe | null>(null);
  const [pins, setPins] = useState<Array<PinView | PinDot>>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [view, setView] = useState<View>("map");
  const [selected, setSelected] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<Layer, boolean>>({ planting: true, partner: true, stop: true });
  const [moment, setMoment] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([getMe(), getPins()]);
      setMe(m);
      setPins(p.pins);
      setProblem(null);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : t`The map could not be read.`);
    }
  }, [t]);

  useEffect(() => {
    if (on && user) void load();
  }, [on, user, load]);

  // The opening moment, once per member and opening, on this device.
  useEffect(() => {
    if (me?.open && user && !openingSeen(String(user.id), me.openedAt)) setMoment(true);
  }, [me?.open, me?.openedAt, user]);

  if (!modules.loaded) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center"><BreathingLoader label={t({ message: `Opening the map`, context: "hidden map page" })} /></div>
      </Layout>
    );
  }
  if (!on) return <ModuleGate moduleId="hidden-map" name={t({ message: `Hidden map`, context: "hidden map page" })} />;
  if (!user) return <SignInToSee moduleId="hidden-map" name={t({ message: `Hidden map`, context: "hidden map page" })} />;
  if (!me) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          {problem ? <p className={NOTE}>{problem}</p> : <BreathingLoader label={t({ message: `Opening the map`, context: "hidden map page" })} />}
        </div>
      </Layout>
    );
  }

  const mine = pins.filter((p): p is PinView => !("dot" in p) && p.mine);
  const myPlantings = mine.filter((p) => p.layer === "planting");
  // What the server counts toward opening: nothing before admission, and nothing at all while not admitted (QA P3-w-1).
  const admitted = me.admitted !== false;
  const counts = (p: PinView) => admitted && (!me.countsFrom || p.createdAt >= me.countsFrom);
  const countingPlantings = myPlantings.filter(counts);
  const plantings = me.labels.planting;
  const meWithCounts: MapMe = { ...me, ownPlantings: myPlantings.length };

  const send = async (c: Capture): Promise<SendAnswer> => {
    try {
      const made = await createPin(c.draft);
      if (c.photos.length) await addPhotos(made.pin.id, c.photos);
      await load();
      setSelected(made.pin.id);
      setView("map");
      return { kept: true, said: t`Saved. It is on your map.` };
    } catch (e) {
      return { kept: false, said: e instanceof Refused ? e.message : t`That was not saved. Check your signal and try again.` };
    }
  };

  if (moment) {
    return <OpeningMoment me={me} userId={String(user.id)} pins={pins} onDone={() => setMoment(false)} />;
  }

  const views: Array<{ id: View; label: string }> = [
    { id: "map", label: t({ message: `Map`, context: "hidden map page" }) },
    { id: "log", label: t({ message: `Log a place`, context: "hidden map page" }) },
    ...(me.open || me.keeper ? [{ id: "vouch" as View, label: t({ message: `Vouch`, context: "hidden map page" }) }] : []),
    ...(me.open ? [{ id: "export" as View, label: t({ message: `Copies`, context: "hidden map page" }) }] : []),
  ];
  const visible = pins.filter((p) => shown[p.layer]);

  return (
    <Layout>
      <div className={WORLD}>
        <div className="container max-w-3xl space-y-6 py-8 md:py-12">
          <header>
            <h1 className={H1}>{me.title}</h1>
          </header>

          {!me.open && (
            <section aria-labelledby="hm-meter" className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="hm-meter" className={H2}>{t({ message: `Your first ${me.needed}`, context: "hidden map page" })}</h2>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-chart-3">{t({ message: `${me.vouchedCount} vouched`, context: "hidden map page" })}</span> · {t({ message: `${countingPlantings.length} logged`, context: "hidden map page" })}
                </p>
              </div>
              <SevenMeter needed={me.needed} vouched={me.vouchedCount} logged={countingPlantings.length} />
              {!admitted && <p className={HINT}><Trans>Your places start counting once you are admitted to the village.</Trans></p>}
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground" aria-hidden="true">
                <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-chart-3" /><Trans context="hidden map page">vouched</Trans></li>
                <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary" /><Trans>waiting for a vouch</Trans></li>
                <li className="flex items-center gap-2"><span className="size-2.5 rounded-full border border-dashed border-muted-foreground" /><Trans context="hidden map page">still to log</Trans></li>
              </ul>
            </section>
          )}

          <div role="tablist" aria-label={t({ message: `The map`, context: "hidden map page" })} className="flex flex-wrap gap-2">
            {views.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={view === x.id} onClick={() => setView(x.id)} className={`${BTN_SECONDARY} ${view === x.id ? "border-primary" : ""}`}>
                {x.label}
              </button>
            ))}
          </div>

          {view === "map" && (
            <div className="space-y-4">
              {me.open && (
                <div className="flex flex-wrap gap-2" aria-label={t({ message: `Layers`, context: "hidden map page" })}>
                  {(Object.keys(me.labels) as Layer[]).map((l) => (
                    <label key={l} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm ${shown[l] ? "border-primary" : "border-border"}`}>
                      <input type="checkbox" checked={shown[l]} onChange={() => setShown((s) => ({ ...s, [l]: !s[l] }))} />
                      {me.labels[l]}
                    </label>
                  ))}
                </div>
              )}
              <WorldMap pins={visible} basemap={me.basemap} maxTileZoom={me.maxZoom} labels={me.labels} vouchesPerPin={me.vouchesPerPin} selectedId={selected} onSelect={setSelected} height={me.open ? 460 : 360} />
              {selected && <PinPanel key={selected} id={selected} me={me} onChanged={() => void load()} onClose={() => setSelected(null)} />}

              {!me.open && (
                <>
                  <section className="flex items-start gap-4 rounded-2xl border border-primary/50 p-5">
                    <Lock className="mt-1 size-6 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-foreground"><Trans>The rest of the map is secret.</Trans></p>
                      <p className={HINT}>{t`It opens to you once ${me.needed} of yours are vouched.`}</p>
                      {me.keeper && <p className={`${HINT} mt-1`}><Trans>You keep this map, so you can vouch for members' places now.</Trans></p>}
                    </div>
                  </section>
                  <section className="flex items-center gap-4 rounded-2xl bg-muted p-5">
                    <span className="font-display text-4xl text-primary">{me.allPins}</span>
                    <p className="text-foreground">{t`${plantings} logged by members so far. Where they are opens with your map.`}</p>
                  </section>
                </>
              )}

              {mine.length > 0 && (
                <section aria-labelledby="hm-mine">
                  <h2 id="hm-mine" className={H2}>{t({ message: `Your ${plantings.toLowerCase()}`, context: "hidden map page" })}</h2>
                  <ul className="mt-3 divide-y divide-border">
                    {mine.map((p) => {
                      const vouched = p.vouches >= me.vouchesPerPin;
                      return (
                        <li key={p.id}>
                          <button type="button" onClick={() => setSelected(p.id)} className="flex min-h-11 w-full items-center gap-4 py-3 text-left">
                            <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${vouched ? "bg-chart-3/15 text-chart-3" : "bg-primary/15"}`}>
                              {vouched ? <Sprout className="size-5" aria-hidden="true" /> : <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-foreground">{p.title || p.whatWentIn || p.kind}</span>
                              <span className={HINT}>
                                {p.hidden ? t`Hidden by a keeper` : p.layer === "planting" && !me.open && !counts(p) ? t`From before your admission, so it does not count toward opening the map` : vouched ? t`${plural(p.vouches, { one: "Vouched", other: "Vouched by # members" })}` : t`Waiting for a vouch`}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              {pins.length === 0 && <p className={HINT}><Trans>Nothing here yet. Log your first place and it appears on your map.</Trans></p>}

              <button type="button" className={`${BTN_PRIMARY} w-full`} onClick={() => setView("log")}><Trans context="hidden map page">Log a place</Trans></button>
            </div>
          )}

          {view === "log" && <CaptureForm me={meWithCounts} onSend={send} ownPins={mine} />}
          {view === "vouch" && <VouchQueue me={me} onOpen={(id) => { setSelected(id); setView("map"); }} />}
          {view === "export" && <Copies me={me} />}
        </div>
      </div>
    </Layout>
  );
}

function VouchQueue({ me, onOpen }: { me: MapMe; onOpen: (id: string) => void }) {
  const { t } = useLingui();
  const [pins, setPins] = useState<PinView[] | null>(null);
  useEffect(() => {
    getQueue().then((q) => setPins(q.pins)).catch(() => setPins([]));
  }, []);
  return (
    <section className={CARD} aria-labelledby="hm-queue">
      <h2 id="hm-queue" className={H2}><Trans>Waiting for a vouch</Trans></h2>
      <p className={`${HINT} mt-1`}>{me.vouchRule}</p>
      {pins === null && <p className={`${HINT} mt-4`}><Trans context="hidden map page">Reading the queue</Trans></p>}
      {pins?.length === 0 && <p className={`${NOTE} mt-4`}><Trans context="hidden map page">Nothing is waiting.</Trans></p>}
      <ul className="mt-4 space-y-3">
        {(pins ?? []).map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            {p.photoIds[0] ? <Thumb id={p.photoIds[0]} alt={t`A photo of this place`} className="size-16" /> : <span className="size-16 rounded-lg bg-muted" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{p.title || p.kind}</p>
              <p className={HINT}>{me.labels[p.layer]} · {p.lat}, {p.lng}</p>
            </div>
            <button type="button" className={BTN_SECONDARY} onClick={() => onOpen(p.id)}><Trans context="hidden map page">Open</Trans></button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Copies({ me }: { me: MapMe }) {
  const { t, i18n } = useLingui();
  const [rows, setRows] = useState<ExportView[] | null>(null);
  const [precision, setPrecision] = useState<Precision>("region");
  const [said, setSaid] = useState<string | null>(null);
  const load = useCallback(() => getExports().then((r) => setRows(r.exports)).catch(() => setRows([])), []);
  useEffect(() => { void load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      setSaid(done);
    } catch (e) {
      setSaid(e instanceof Error ? e.message : t`That did not go through.`);
    }
    void load();
  };
  const yours = t({ message: `yours`, context: "hidden map page" });
  return (
    <section className={CARD} aria-labelledby="hm-copies">
      <h2 id="hm-copies" className={H2}><Trans>A copy of the map</Trans></h2>
      <p className={`${HINT} mt-1`}><Trans>A copy takes two people: you ask, and a different member who may approve says yes. You can then download it once. It carries no names and no photos.</Trans></p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select className="min-h-11 rounded-lg border border-border bg-background px-3 text-foreground" value={precision} onChange={(e) => setPrecision(e.target.value as Precision)} aria-label={t({ message: `How exactly`, context: "hidden map page" })}>
          {me.precisions.map((p) => <option key={p} value={p}>{i18n._(PRECISION_WORDS[p])}</option>)}
        </select>
        <button type="button" className={BTN_PRIMARY} onClick={() => void run(() => askExport(precision), t`Asked. A second member can approve it now.`)}><Trans>Ask for a copy</Trans></button>
      </div>
      {said && <p className={`${HINT} mt-2`} role="status">{said}</p>}
      <ul className="mt-5 space-y-2">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {STATE_WORDS[r.status as ExportState] ? i18n._(STATE_WORDS[r.status as ExportState]) : r.status}
            </span>
            <span className={HINT}>{i18n._(PRECISION_WORDS[r.precision])} · {new Date(r.createdAt).toLocaleString()} {r.mine ? `· ${yours}` : ""}</span>
            <span className="flex-1" />
            {r.mine && r.status === "approved" && <button type="button" className={BTN_PRIMARY} onClick={() => void run(() => downloadExport(r.id), t({ message: `Downloaded.`, context: "hidden map page" }))}><Trans context="hidden map page">Download</Trans></button>}
            {r.mine && (r.status === "pending" || r.status === "approved") && <button type="button" className={BTN_SECONDARY} onClick={() => void run(() => answerExport(r.id, "withdraw"), t({ message: `Withdrawn.`, context: "hidden map page" }))}><Trans context="hidden map page">Withdraw</Trans></button>}
            {!r.mine && r.status === "pending" && me.mayApproveExports && (
              <>
                <button type="button" className={BTN_PRIMARY} onClick={() => void run(() => answerExport(r.id, "approve"), t({ message: `Approved.`, context: "hidden map page" }))}><Trans context="hidden map page">Approve</Trans></button>
                <button type="button" className={BTN_SECONDARY} onClick={() => void run(() => answerExport(r.id, "decline"), t({ message: `Declined.`, context: "hidden map page" }))}><Trans context="hidden map page">Decline</Trans></button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
