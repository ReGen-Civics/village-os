/**
 * One pin, opened: what it is, its photos and return visits, and the acts a
 * member may take on it. No name appears anywhere here, by design: a pin says
 * whether it is yours and how many have vouched for it.
 */
import { useCallback, useEffect, useState } from "react";
import { msg, plural } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { Trans, useLingui } from "@lingui/react/macro";
import { STAGES, type PinView, type Stage, type VouchWay } from "@shared/hiddenMap";
import type { MapMe, VisitView } from "@/lib/hiddenMapApi";
import { addVisit, getPin, hidePin, newClientId, unvouch, vouch } from "@/lib/hiddenMapApi";
import PhotoPicker, { type SafePhoto } from "./PhotoPicker";
import Thumb from "./Thumb";
import { PRECISION_WORDS } from "./CaptureForm";
import { BTN_NOTICE, BTN_PRIMARY, BTN_SECONDARY, CARD, CHIP_SOFT, FIELD, H2, HINT, LABEL, NOTE } from "@/components/journey/look";

export const STAGE_WORDS: Record<Stage, MessageDescriptor> = {
  seed: msg({ message: `Seed`, context: "hidden map, one place's details" }),
  sprout: msg({ message: `Sprout`, context: "hidden map, one place's details" }),
  sapling: msg({ message: `Sapling`, context: "hidden map, one place's details" }),
  tree: msg({ message: `Tree`, context: "hidden map, one place's details" }),
  lost: msg({ message: `Didn't make it`, context: "hidden map, one place's details" }),
};

/** How a voucher saw it, in words a member chooses between. */
export const WAY_WORDS: Record<VouchWay, MessageDescriptor> = {
  "in-person": msg({ message: `I was there`, context: "hidden map, one place's details" }),
  call: msg`I saw it on a live call`,
  photos: msg`The photos leave no doubt`,
};

export default function PinPanel({ id, me, onChanged, onClose }: { id: string; me: MapMe; onChanged: () => void; onClose: () => void }) {
  const { t, i18n } = useLingui();
  const [pin, setPin] = useState<PinView | null>(null);
  const [visits, setVisits] = useState<VisitView[]>([]);
  const [mayVisit, setMayVisit] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [visiting, setVisiting] = useState(false);
  const [stage, setStage] = useState<Stage | "">("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<SafePhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [visitNote, setVisitNote] = useState<string | null>(null);
  const [vouching, setVouching] = useState(false);
  const [way, setWay] = useState<VouchWay | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getPin(id);
      setPin(r.pin);
      setVisits(r.visits);
      setMayVisit(r.mayVisit);
      setProblem(null);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : t`That pin is not available.`);
    }
  }, [id, t]);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : t`That did not go through.`);
    } finally {
      setBusy(false);
    }
  };

  const sendVisit = () =>
    act(async () => {
      const r = await addVisit(id, { clientId: newClientId(), stageSeen: stage || null, note }, photos.map((p) => p.blob));
      setVisitNote(r.claimed ? t`Saved. Your visit is waiting for a member to confirm it on the quest board.` : t`Saved.`);
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setNote("");
      setStage("");
      setVisiting(false);
    });

  if (problem && !pin) return <section className={CARD}><p className={NOTE}>{problem}</p></section>;
  if (!pin) return <section className={CARD}><p className={HINT}><Trans context="hidden map, one place's details">Opening the pin</Trans></p></section>;

  const mayVouch = !pin.mine && (me.open || me.keeper);
  const ownPhotos = pin.photoIds.filter((p) => !visits.some((v) => v.photoIds.includes(p)));
  const yours = t({ message: `yours`, context: "hidden map, one place's details" });

  return (
    <section className={CARD} aria-labelledby="hm-pin">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="hm-pin" className={H2}>{pin.title || pin.kind}</h2>
          <p className={HINT}>
            {me.labels[pin.layer]} · {pin.kind}
            {pin.mine ? ` · ${yours}` : ""}
          </p>
        </div>
        <button type="button" className={BTN_SECONDARY} onClick={onClose}><Trans context="hidden map, one place's details">Close</Trans></button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {pin.stage && <span className={CHIP_SOFT}>{i18n._(STAGE_WORDS[pin.stage])}</span>}
        <span className={CHIP_SOFT}>{t`${plural(pin.vouches, { one: "# vouch", other: "# vouches" })}`}</span>
        <span className={CHIP_SOFT}><Trans>Shown beyond open members: {i18n._(PRECISION_WORDS[pin.precision])}</Trans></span>
        {pin.hidden && <span className={CHIP_SOFT}><Trans>Hidden by a keeper</Trans></span>}
      </div>

      <p className={`${NOTE} mt-4`}>
        {pin.lat}, {pin.lng}
      </p>
      {pin.whatWentIn && <p className={`${NOTE} mt-2`}><span className="font-semibold text-foreground"><Trans context="hidden map, one place's details">What went in:</Trans> </span>{pin.whatWentIn}</p>}
      {pin.notes && <p className={`${NOTE} mt-2 whitespace-pre-line`}>{pin.notes}</p>}

      {ownPhotos.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {ownPhotos.map((p) => <li key={p}><Thumb id={p} alt={t`A photo of this place`} className="aspect-square w-full" /></li>)}
        </ul>
      )}

      {visits.length > 0 && (
        <div className="mt-6">
          <h3 className={LABEL}><Trans context="hidden map, one place's details">Return visits</Trans></h3>
          <ol className="mt-2 space-y-3">
            {visits.map((v) => (
              <li key={v.id} className="rounded-lg border border-border p-3">
                <p className={HINT}>
                  {new Date(v.createdAt).toLocaleDateString()}
                  {v.stageSeen ? ` · ${i18n._(STAGE_WORDS[v.stageSeen])}` : ""}
                  {v.mine ? ` · ${yours}` : ""}
                </p>
                {v.note && <p className={`${NOTE} mt-1`}>{v.note}</p>}
                {v.photoIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {v.photoIds.map((p) => <Thumb key={p} id={p} alt={t`A photo from a return visit`} className="size-20" />)}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {mayVouch && !pin.vouchedByMe && (
          <button type="button" className={BTN_PRIMARY} disabled={busy || vouching} onClick={() => { setVouching(true); setWay(null); }}><Trans>Vouch: this is real</Trans></button>
        )}
        {pin.vouchedByMe && (
          <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void act(() => unvouch(id))}><Trans context="hidden map, one place's details">Withdraw my vouch</Trans></button>
        )}
        {mayVisit && !visiting && (
          <button type="button" className={BTN_NOTICE} onClick={() => setVisiting(true)}><Trans>Add a return visit</Trans></button>
        )}
        {me.keeper && !pin.mine && !pin.hidden && (
          <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void act(() => hidePin(id))}><Trans context="hidden map, one place's details">Hide this pin</Trans></button>
        )}
      </div>

      {vouching && (
        <fieldset className="mt-5 space-y-3 rounded-xl border border-border p-4">
          <legend className={`${LABEL} px-1`}><Trans>How did you see it?</Trans></legend>
          <p className={HINT}>{me.vouchRule}</p>
          <div className="flex flex-col gap-2">
            {me.vouchWays.map((w) => (
              <label key={w} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${way === w ? "border-primary bg-primary/10" : "border-border"}`}>
                <input type="radio" name="hm-way" checked={way === w} onChange={() => setWay(w)} />
                {i18n._(WAY_WORDS[w])}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={busy || !way}
              onClick={() => way && void act(async () => { await vouch(id, way); setVouching(false); })}
            >
              <Trans context="hidden map, one place's details">Vouch</Trans>
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setVouching(false)}><Trans context="hidden map, one place's details">Not now</Trans></button>
          </div>
        </fieldset>
      )}

      {visiting && (
        <div className="mt-5 space-y-4 rounded-xl border border-border p-4">
          <h3 className={LABEL}><Trans context="hidden map, one place's details">A return visit</Trans></h3>
          {pin.layer === "planting" && (
            <label className="block">
              <span className={LABEL}><Trans>How it is doing</Trans></span>
              <select className={`${FIELD} mt-1`} value={stage} onChange={(e) => setStage(e.target.value as Stage | "")}>
                <option value="">{t({ message: `Choose`, context: "hidden map, one place's details" })}</option>
                {STAGES.map((s) => <option key={s} value={s}>{i18n._(STAGE_WORDS[s])}</option>)}
              </select>
            </label>
          )}
          <PhotoPicker onAdd={(p) => setPhotos((all) => [...all, p])} label={t`Add a photo of it now`} />
          {photos.length > 0 && <p className={HINT}>{t`${plural(photos.length, { one: "# photo ready.", other: "# photos ready." })}`}</p>}
          <label className="block">
            <span className={LABEL}><Trans context="hidden map, one place's details">A note</Trans></span>
            <textarea className={`${FIELD} mt-1`} rows={2} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={busy || photos.length === 0} onClick={() => void sendVisit()}><Trans context="hidden map, one place's details">Save the visit</Trans></button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setVisiting(false)}><Trans context="hidden map, one place's details">Not now</Trans></button>
          </div>
        </div>
      )}
      {visitNote && <p className={`${HINT} mt-3`} role="status">{visitNote}</p>}
      {problem && <p className="mt-3 text-sm text-destructive" role="alert">{problem}</p>}
    </section>
  );
}
