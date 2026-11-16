/**
 * Log a place: where, what kind, what went in, and photos.
 *
 * The location comes from the first photo that carries one, from a pasted
 * place (coordinates, a maps link, a plus code), or from a tap on the map.
 * How exactly the pin is shown beyond the open members is the member's choice,
 * starting from the village's default.
 */
import { useState } from "react";
import { X } from "lucide-react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { Trans, useLingui } from "@lingui/react/macro";
import { PARTNER_STATES, validatePoint, type Layer, type PartnerState, type Point, type Precision } from "@shared/hiddenMap";
import { parseCoordinates } from "@shared/land";
import type { MapMe, PinDraft } from "@/lib/hiddenMapApi";
import { newClientId } from "@/lib/hiddenMapApi";
import PhotoPicker, { type SafePhoto } from "./PhotoPicker";
import WorldMap from "./WorldMap";
import { BTN_PRIMARY, CARD, FIELD, H2, HINT, LABEL } from "@/components/journey/look";

export const PRECISION_WORDS: Record<Precision, MessageDescriptor> = {
  exact: msg`Exact`,
  km: msg`About 1 km`,
  region: msg`Region, about 50 km`,
};

const PARTNER_WORDS: Record<PartnerState, MessageDescriptor> = {
  connected: msg`Connected`,
  visited: msg`Visited`,
  planted: msg`Planted`,
};

export interface Capture {
  draft: PinDraft;
  photos: Blob[];
}

/** What `onSend` answers: a sentence for the member, and whether the place was kept. */
export interface SendAnswer {
  kept: boolean;
  said: string;
}

export default function CaptureForm({ me, onSend }: { me: MapMe; onSend: (c: Capture) => Promise<SendAnswer> }) {
  const { t, i18n } = useLingui();
  const layers = Object.keys(me.labels) as Layer[];
  const [layer, setLayer] = useState<Layer>("planting");
  const [kind, setKind] = useState(me.kinds.planting[0] ?? "");
  const [partnerState, setPartnerState] = useState<PartnerState>("connected");
  const [point, setPoint] = useState<Point | null>(null);
  const [pasted, setPasted] = useState("");
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [precision, setPrecision] = useState<Precision>(me.defaultPrecision);
  const [title, setTitle] = useState("");
  const [what, setWhat] = useState("");
  const [notes, setNotes] = useState("");
  const [plantedOn, setPlantedOn] = useState("");
  const [photos, setPhotos] = useState<SafePhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const paste = (raw: string) => {
    setPasted(raw);
    if (!raw.trim()) return setPasteNote(null);
    const r = parseCoordinates(raw);
    if (r.ok) {
      const v = validatePoint(r.lat, r.lon);
      if (v.ok) {
        setPoint(v.point);
        setPasteNote(t`Placed at ${v.point.lat}, ${v.point.lng}.`);
        return;
      }
    }
    setPasteNote(t`That did not read as a place. Try two numbers, latitude first, or a maps link.`);
  };

  const reset = () => {
    setPoint(null);
    setPasted("");
    setPasteNote(null);
    setTitle("");
    setWhat("");
    setNotes("");
    setPlantedOn("");
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
  };

  const send = async () => {
    if (!point) return setSaid(t`Choose where this is first.`);
    setBusy(true);
    setSaid(null);
    const draft: PinDraft = {
      clientId: newClientId(),
      layer,
      kind,
      lat: point.lat,
      lng: point.lng,
      precision,
      title: title.trim() || undefined,
      whatWentIn: what.trim() || undefined,
      notes: notes.trim() || undefined,
      partnerState: layer === "partner" ? partnerState : null,
      plantedOn: plantedOn || null,
    };
    const answer = await onSend({ draft, photos: photos.map((p) => p.blob) });
    setBusy(false);
    setSaid(answer.said);
    if (answer.kept) reset();
  };

  return (
    <section className={CARD} aria-labelledby="hm-capture">
      <h2 id="hm-capture" className={H2}><Trans>Log a place</Trans></h2>
      <div className="mt-5 space-y-5">
        <fieldset>
          <legend className={LABEL}><Trans>Which layer</Trans></legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {layers.map((l) => (
              <label key={l} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${layer === l ? "border-notice" : "border-border"}`}>
                <input type="radio" name="hm-layer" checked={layer === l} onChange={() => { setLayer(l); setKind(me.kinds[l][0] ?? ""); }} />
                {me.labels[l]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}><Trans>Kind of place</Trans></span>
            <select className={`${FIELD} mt-1`} value={kind} onChange={(e) => setKind(e.target.value)}>
              {me.kinds[layer].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          {layer === "partner" && (
            <label className="block">
              <span className={LABEL}><Trans>How we know it</Trans></span>
              <select className={`${FIELD} mt-1`} value={partnerState} onChange={(e) => setPartnerState(e.target.value as PartnerState)}>
                {PARTNER_STATES.map((s) => <option key={s} value={s}>{i18n._(PARTNER_WORDS[s])}</option>)}
              </select>
            </label>
          )}
          {layer === "planting" && (
            <label className="block">
              <span className={LABEL}><Trans>Planted on</Trans></span>
              <input type="date" className={`${FIELD} mt-1`} value={plantedOn} onChange={(e) => setPlantedOn(e.target.value)} />
            </label>
          )}
        </div>

        <div>
          <span className={LABEL}><Trans>Photos</Trans></span>
          <div className="mt-2">
            <PhotoPicker onLocation={(p) => !point && setPoint({ lat: p.lat, lng: p.lng })} onAdd={(p) => setPhotos((all) => [...all, p])} />
          </div>
          {photos.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <li key={p.preview} className="relative">
                  <img src={p.preview} alt={t`Photo ${i + 1}, ready to go up`} className="size-20 rounded-lg object-cover" />
                  <button type="button" onClick={() => setPhotos((all) => all.filter((x) => x !== p))} className="absolute -right-2 -top-2 flex size-11 items-center justify-center" aria-label={t`Remove photo ${i + 1}`}>
                    <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-background"><X className="size-3" aria-hidden="true" /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <span className={LABEL}><Trans>Where</Trans></span>
          <p className={HINT}>{point ? `${point.lat}, ${point.lng}` : t`From the photo, a pasted place, or a tap on the map.`}</p>
          <input className={`${FIELD} mt-2`} value={pasted} onChange={(e) => paste(e.target.value)} placeholder={t`Paste coordinates or a maps link`} aria-label={t`Paste coordinates or a maps link`} />
          {pasteNote && <p className={HINT} aria-live="polite">{pasteNote}</p>}
          <div className="mt-3">
            <WorldMap pins={[]} basemap={me.basemap} maxTileZoom={me.maxZoom} labels={me.labels} onTap={setPoint} placing={point} height={280} />
          </div>
        </div>

        <fieldset>
          <legend className={LABEL}><Trans>How exactly anyone beyond the open members is ever shown it</Trans></legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {me.precisions.map((p) => (
              <label key={p} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${precision === p ? "border-notice" : "border-border"}`}>
                <input type="radio" name="hm-precision" checked={precision === p} onChange={() => setPrecision(p)} />
                {i18n._(PRECISION_WORDS[p])}
              </label>
            ))}
          </div>
          <p className={`${HINT} mt-1`}><Trans>Members whose map has opened always see the exact place.</Trans></p>
        </fieldset>

        <label className="block">
          <span className={LABEL}><Trans>A name for it (optional)</Trans></span>
          <input className={`${FIELD} mt-1`} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {layer === "planting" && (
          <label className="block">
            <span className={LABEL}><Trans>What went in</Trans></span>
            <textarea className={`${FIELD} mt-1`} rows={2} maxLength={2000} value={what} onChange={(e) => setWhat(e.target.value)} />
          </label>
        )}
        <label className="block">
          <span className={LABEL}><Trans>Notes</Trans></span>
          <textarea className={`${FIELD} mt-1`} rows={3} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <p className={HINT}><Trans>Your name is never shown beside a pin.</Trans></p>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BTN_PRIMARY} disabled={busy || !point || !kind} onClick={() => void send()}>
            {busy ? <Trans>Saving</Trans> : <Trans>Save this place</Trans>}
          </button>
          {said && <p className={HINT} role="status">{said}</p>}
        </div>
      </div>
    </section>
  );
}
