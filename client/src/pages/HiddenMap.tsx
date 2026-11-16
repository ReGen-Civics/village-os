/**
 * The hidden map: a members-only map of the places the members log.
 *
 * A member sees only their own pins until enough of them are vouched for by
 * somebody else; then the whole map opens. The server decides what reaches
 * this page (shared/hiddenMap.ts `visiblePin`), so nothing here hides
 * anything: what a member may not see never arrives.
 *
 * The page's name and the layer names are the village's own (module settings),
 * so no village's words live in this file.
 */
import { useCallback, useEffect, useState } from "react";
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
import CaptureForm, { PRECISION_WORDS, type Capture, type SendAnswer } from "@/components/hiddenMap/CaptureForm";
import Thumb from "@/components/hiddenMap/Thumb";
import { useOutbox } from "@/components/hiddenMap/useOutbox";
import { looksOffline, type OutboxItem } from "@/lib/hiddenMapOutbox";
import {
  addPhotos, answerExport, askExport, createPin, downloadExport, getExports, getMe, getPins, getQueue, Refused,
  type ExportView, type MapMe,
} from "@/lib/hiddenMapApi";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CARD_FEATURED, CHIP_SOFT, H1, H2, HINT, LEDE, NOTE, RING, WORLD } from "@/components/journey/look";

type Tab = "map" | "log" | "vouch" | "export";

const STATE_WORDS: Record<ExportState, MessageDescriptor> = {
  pending: msg`Waiting for a second person`,
  approved: msg`Approved`,
  declined: msg`Declined`,
  withdrawn: msg`Withdrawn`,
  expired: msg`Expired`,
  downloaded: msg`Downloaded`,
};

export default function HiddenMap() {
  const { t } = useLingui();
  const { user } = useAuth();
  const modules = useModules();
  const on = (modules.modules ?? []).some((m) => m.id === "hidden-map" && m.lifecycle !== "off");
  const [me, setMe] = useState<MapMe | null>(null);
  const [pins, setPins] = useState<Array<PinView | PinDot>>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("map");
  const [selected, setSelected] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<Layer, boolean>>({ planting: true, partner: true, stop: true });

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

  const owner = on && user ? String(user.id) : null;
  const box = useOutbox(owner, () => void load());

  if (!modules.loaded) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center"><BreathingLoader label={t`Opening the map`} /></div>
      </Layout>
    );
  }
  if (!on) return <ModuleGate moduleId="hidden-map" name={t`Hidden map`} />;
  if (!user) return <SignInToSee moduleId="hidden-map" name={t`Hidden map`} />;
  if (!me) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          {problem ? <p className={NOTE}>{problem}</p> : <BreathingLoader label={t`Opening the map`} />}
        </div>
      </Layout>
    );
  }

  const send = async (c: Capture): Promise<SendAnswer> => {
    let madeId: string | undefined;
    try {
      const made = await createPin(c.draft);
      madeId = made.pin.id;
      if (c.photos.length) await addPhotos(made.pin.id, c.photos);
      await load();
      setSelected(made.pin.id);
      return { kept: true, said: t`Saved. It is on your map.` };
    } catch (e) {
      if (owner && looksOffline(e)) {
        try {
          await box.add({ kind: "pin", clientId: c.draft.clientId, owner, createdAt: new Date().toISOString(), draft: c.draft, photos: c.photos, pinId: madeId });
          return { kept: true, said: t`Saved on this phone. It goes up when you have signal.` };
        } catch {
          return { kept: false, said: t`This phone could not keep it for later. Try again when you have signal.` };
        }
      }
      return { kept: false, said: e instanceof Refused ? e.message : t`That was not saved. Check your signal and try again.` };
    }
  };
  const queueVisit = async (item: OutboxItem) => box.add(item);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "map", label: t`Map` },
    { id: "log", label: t`Log a place` },
    ...(me.open || me.keeper ? [{ id: "vouch" as Tab, label: t`Vouch` }] : []),
    ...(me.open ? [{ id: "export" as Tab, label: t`Copies` }] : []),
  ];
  const visible = pins.filter((p) => shown[p.layer]);
  const plantings = me.labels.planting;

  return (
    <Layout>
      <div className={WORLD}>
        <div className="container max-w-5xl space-y-6 py-8 md:py-12">
          <header>
            <h1 className={H1}>{me.title}</h1>
            <p className={`${LEDE} mt-2`}>
              {me.open
                ? <Trans>Every place the members have logged. Nobody's name is shown beside a pin.</Trans>
                : <Trans>Your own places, kept here for you. The whole map opens once others have vouched for enough of yours.</Trans>}
            </p>
          </header>

          {!me.open && (
            <section className={CARD_FEATURED} aria-label={t`How your map opens`}>
              <div className="flex items-center gap-4">
                <span className={RING}>{me.vouchedCount}</span>
                <div>
                  <p className="font-display text-xl font-bold text-card-foreground">
                    <Trans>{me.vouchedCount} of {me.needed} vouched</Trans>
                  </p>
                  <p className={HINT}>
                    <Trans>Log your {plantings} with a photo. Each one counts once a member whose map has opened has vouched that it is real.</Trans>
                    {me.keeper ? <> <Trans>You keep this map, so you can vouch for members' pins now.</Trans></> : null}
                  </p>
                  <p className={`${HINT} mt-1`}>{t`${plural(me.allPins, { one: "# place is on the whole map.", other: "# places are on the whole map." })}`}</p>
                </div>
              </div>
            </section>
          )}

          {box.items.length > 0 && (
            <section className={CARD} aria-label={t`Waiting on this phone`}>
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex-1 font-semibold text-foreground">
                  {t`${plural(box.items.length, { one: "# capture is waiting on this phone.", other: "# captures are waiting on this phone." })}`}
                </p>
                <button type="button" className={BTN_PRIMARY} disabled={box.sending} onClick={() => void box.flush()}>
                  {box.sending ? <Trans>Sending</Trans> : <Trans>Send now</Trans>}
                </button>
              </div>
              {!box.durable && <p className={`${HINT} mt-1`}><Trans>This browser cannot keep captures after the page closes. Keep it open until they go up.</Trans></p>}
              <ul className="mt-3 space-y-2">
                {box.items.map((i) => (
                  <li key={i.clientId} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
                    <span className="flex-1 text-sm text-foreground">
                      {i.kind === "pin" ? (i.draft.title || i.draft.kind) : t`A return visit`}
                      {i.refused ? ` · ${i.refused}` : ""}
                    </span>
                    <button type="button" className={BTN_SECONDARY} onClick={() => void box.discard(i.clientId)}><Trans>Discard</Trans></button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div role="tablist" aria-label={t`The map`} className="flex flex-wrap gap-2">
            {tabs.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className={`${BTN_SECONDARY} ${tab === x.id ? "border-notice" : ""}`}>
                {x.label}
              </button>
            ))}
          </div>

          {tab === "map" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2" aria-label={t`Layers`}>
                {(Object.keys(me.labels) as Layer[]).map((l) => (
                  <label key={l} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${shown[l] ? "border-notice" : "border-border"}`}>
                    <input type="checkbox" checked={shown[l]} onChange={() => setShown((s) => ({ ...s, [l]: !s[l] }))} />
                    {me.labels[l]}
                  </label>
                ))}
              </div>
              <WorldMap pins={visible} basemap={me.basemap} maxTileZoom={me.maxZoom} labels={me.labels} selectedId={selected} onSelect={setSelected} height={460} />
              {pins.length === 0 && <p className={HINT}><Trans>Nothing here yet. Log your first place and it appears on your map.</Trans></p>}
              {selected && <PinPanel key={selected} id={selected} me={me} owner={owner} onQueueVisit={queueVisit} onChanged={() => void load()} onClose={() => setSelected(null)} />}
            </div>
          )}

          {tab === "log" && <CaptureForm me={me} onSend={send} />}
          {tab === "vouch" && <VouchQueue me={me} onOpen={(id) => { setSelected(id); setTab("map"); }} />}
          {tab === "export" && <Copies me={me} />}
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
      <p className={`${HINT} mt-1`}><Trans>Vouch only for a place you know is real: you were there, or the photos leave no doubt.</Trans></p>
      {pins === null && <p className={`${HINT} mt-4`}><Trans>Reading the queue</Trans></p>}
      {pins?.length === 0 && <p className={`${NOTE} mt-4`}><Trans>Nothing is waiting.</Trans></p>}
      <ul className="mt-4 space-y-3">
        {(pins ?? []).map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            {p.photoIds[0] ? <Thumb id={p.photoIds[0]} alt={t`A photo of this place`} className="size-16" /> : <span className="size-16 rounded-lg bg-muted" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{p.title || p.kind}</p>
              <p className={HINT}>{me.labels[p.layer]} · {p.lat}, {p.lng}</p>
            </div>
            <button type="button" className={BTN_SECONDARY} onClick={() => onOpen(p.id)}><Trans>Open</Trans></button>
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
  const yours = t`yours`;
  return (
    <section className={CARD} aria-labelledby="hm-copies">
      <h2 id="hm-copies" className={H2}><Trans>A copy of the map</Trans></h2>
      <p className={`${HINT} mt-1`}><Trans>A copy takes two people: you ask, and a different member who may approve says yes. You can then download it once. It carries no names and no photos.</Trans></p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select className="min-h-11 rounded-lg border border-border bg-background px-3 text-foreground" value={precision} onChange={(e) => setPrecision(e.target.value as Precision)} aria-label={t`How exactly`}>
          {me.precisions.map((p) => <option key={p} value={p}>{i18n._(PRECISION_WORDS[p])}</option>)}
        </select>
        <button type="button" className={BTN_PRIMARY} onClick={() => void run(() => askExport(precision), t`Asked. A second member can approve it now.`)}><Trans>Ask for a copy</Trans></button>
      </div>
      {said && <p className={`${HINT} mt-2`} role="status">{said}</p>}
      <ul className="mt-5 space-y-2">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
            <span className={CHIP_SOFT}>{STATE_WORDS[r.status as ExportState] ? i18n._(STATE_WORDS[r.status as ExportState]) : r.status}</span>
            <span className={HINT}>{i18n._(PRECISION_WORDS[r.precision])} · {new Date(r.createdAt).toLocaleString()} {r.mine ? `· ${yours}` : ""}</span>
            <span className="flex-1" />
            {r.mine && r.status === "approved" && <button type="button" className={BTN_PRIMARY} onClick={() => void run(() => downloadExport(r.id), t`Downloaded.`)}><Trans>Download</Trans></button>}
            {r.mine && (r.status === "pending" || r.status === "approved") && <button type="button" className={BTN_SECONDARY} onClick={() => void run(() => answerExport(r.id, "withdraw"), t`Withdrawn.`)}><Trans>Withdraw</Trans></button>}
            {!r.mine && r.status === "pending" && me.mayApproveExports && (
              <>
                <button type="button" className={BTN_PRIMARY} onClick={() => void run(() => answerExport(r.id, "approve"), t`Approved.`)}><Trans>Approve</Trans></button>
                <button type="button" className={BTN_SECONDARY} onClick={() => void run(() => answerExport(r.id, "decline"), t`Declined.`)}><Trans>Decline</Trans></button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
