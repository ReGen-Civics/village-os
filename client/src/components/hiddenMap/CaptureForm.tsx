/**
 * Log a place (the design's screen 09): the photo first, then what kind of
 * place, what went in, whether it belongs there, and one button.
 *
 * The location comes from the first photo that carries one, from a pasted
 * place (coordinates, a maps link, a plus code), or from a tap on the map.
 * How exactly the pin is shown beyond the open members, and its name, sit
 * under "More", starting from the village's default.
 *
 * Every word that names the village's things (the layers, the kinds, the
 * question above them) is the village's own setting.
 */
import { useEffect, useState } from "react";
import { Check, ChevronDown, Info, X } from "lucide-react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { Trans, useLingui } from "@lingui/react/macro";
import { PARTNER_STATES, validatePoint, type Layer, type PartnerState, type PinView, type Point, type Precision } from "@shared/hiddenMap";
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

const CHIP = "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 text-sm";

function useOnline(): boolean {
  const [on, setOn] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return on;
}

export default function CaptureForm({ me, onSend, ownPins = [] }: { me: MapMe; onSend: (c: Capture) => Promise<SendAnswer>; ownPins?: readonly PinView[] }) {
  const { t, i18n } = useLingui();
  const online = useOnline();
  const layers = Object.keys(me.labels) as Layer[];
  const [layer, setLayer] = useState<Layer>("planting");
  const [kind, setKind] = useState(me.kinds.planting[0] ?? "");
  const [partnerState, setPartnerState] = useState<PartnerState>("connected");
  const [point, setPoint] = useState<Point | null>(null);
  const [fromPhoto, setFromPhoto] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [precision, setPrecision] = useState<Precision>(me.defaultPrecision);
  const [title, setTitle] = useState("");
  const [what, setWhat] = useState("");
  const [native, setNative] = useState(false);
  const [notes, setNotes] = useState("");
  const [plantedOn, setPlantedOn] = useState("");
  const [photos, setPhotos] = useState<SafePhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [staged, setStaged] = useState(false);

  const ownPlantings = me.ownPlantings ?? 0;
  const counter = !me.open && layer === "planting" && ownPlantings < me.needed ? t`${ownPlantings + 1} of ${me.needed}` : null;

  const paste = (raw: string) => {
    setPasted(raw);
    if (!raw.trim()) return setPasteNote(null);
    const r = parseCoordinates(raw);
    if (r.ok) {
      const v = validatePoint(r.lat, r.lon);
      if (v.ok) {
        setPoint(v.point);
        setFromPhoto(false);
        setPasteNote(t`Placed at ${v.point.lat}, ${v.point.lng}.`);
        return;
      }
    }
    setPasteNote(t`That did not read as a place. Try two numbers, latitude first, or a maps link.`);
  };

  const reset = () => {
    setPoint(null);
    setFromPhoto(false);
    setPasted("");
    setPasteNote(null);
    setTitle("");
    setWhat("");
    setNative(false);
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
      native: layer === "planting" ? native : false,
    };
    const answer = await onSend({ draft, photos: photos.map((p) => p.blob) });
    setBusy(false);
    setSaid(answer.said);
    if (answer.kept) reset();
  };

  const hero = photos[0];

  return (
    <section className={CARD} aria-labelledby="hm-capture">
      <h2 id="hm-capture" className={H2}><Trans>Log a place</Trans></h2>
      <div className="mt-5 space-y-6">
        {layers.length > 1 && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t`Which layer`}>
            {layers.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={layer === l}
                onClick={() => { setLayer(l); setKind(me.kinds[l][0] ?? ""); }}
                className={`${CHIP} ${layer === l ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
              >
                {me.labels[l]}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {hero ? (
            <figure className="relative overflow-hidden rounded-2xl border border-border">
              <img src={hero.preview} alt={t`The photo, ready to go up`} className="block max-h-80 w-full object-cover" />
              {counter && <span className="absolute left-3 top-3 rounded-full bg-background/85 px-3 py-1 text-sm font-semibold text-foreground">{counter}</span>}
              <figcaption className="absolute inset-x-3 bottom-3 flex items-start gap-2 rounded-xl bg-background/85 px-3 py-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-chart-3" aria-hidden="true" />
                {fromPhoto
                  ? <Trans>Location read from the photo, then removed from it, with every other hidden detail.</Trans>
                  : <Trans>Every hidden detail is removed from the photo before it goes up.</Trans>}
              </figcaption>
            </figure>
          ) : counter ? (
            <p className={HINT}>{counter}</p>
          ) : null}
          <PhotoPicker
            label={hero ? t`Add another photo` : t`Add a photo`}
            onLocation={(p) => { if (!point) { setPoint({ lat: p.lat, lng: p.lng }); setFromPhoto(true); } }}
            onAdd={(p) => setPhotos((all) => [...all, p])}
            onStaged={setStaged}
          />
          {photos.length > 1 && (
            <ul className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <li key={p.preview} className="relative">
                  <img src={p.preview} alt={t`Photo ${i + 1}, ready to go up`} className="size-16 rounded-lg object-cover" />
                  <button type="button" onClick={() => setPhotos((all) => all.filter((x) => x !== p))} className="absolute -right-2 -top-2 flex size-11 items-center justify-center" aria-label={t`Remove photo ${i + 1}`}>
                    <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-background"><X className="size-3" aria-hidden="true" /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <fieldset>
          <legend className={LABEL}>{me.kindPrompts?.[layer] ?? t`What kind of place?`}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {me.kinds[layer].map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`${CHIP} ${kind === k ? "border-chart-3 bg-chart-3/15 text-foreground" : "border-border text-foreground"}`}>
                {k}
              </button>
            ))}
          </div>
        </fieldset>

        {layer === "planting" && (
          <>
            <label className="block">
              <span className="sr-only"><Trans>What went in</Trans></span>
              <textarea className={FIELD} rows={2} maxLength={2000} value={what} onChange={(e) => setWhat(e.target.value)} placeholder={t`What went in`} />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-xl border border-border p-4">
              <span>
                <span className="block font-semibold text-foreground"><Trans>It belongs here</Trans></span>
                <span className={HINT}><Trans>What went in is native to this place.</Trans></span>
              </span>
              <input type="checkbox" className="size-6 accent-chart-3" checked={native} onChange={(e) => setNative(e.target.checked)} />
            </label>
          </>
        )}
        {layer === "partner" && (
          <label className="block">
            <span className={LABEL}><Trans>How we know it</Trans></span>
            <select className={`${FIELD} mt-1`} value={partnerState} onChange={(e) => setPartnerState(e.target.value as PartnerState)}>
              {PARTNER_STATES.map((s) => <option key={s} value={s}>{i18n._(PARTNER_WORDS[s])}</option>)}
            </select>
          </label>
        )}

        <div>
          <span className={LABEL}><Trans>Where</Trans></span>
          <p className={HINT}>{point ? `${point.lat}, ${point.lng}` : t`From the photo, a pasted place, or a tap on the map.`}</p>
          {!fromPhoto && (
            <>
              <input className={`${FIELD} mt-2`} value={pasted} onChange={(e) => paste(e.target.value)} placeholder={t`Paste coordinates or a maps link`} aria-label={t`Paste coordinates or a maps link`} />
              {pasteNote && <p className={HINT} aria-live="polite">{pasteNote}</p>}
              <div className="mt-3">
                <WorldMap
                  // Framed on the member's own places, so a tap lands near where they plant, not on a whole-world grid.
                  pins={ownPins.slice(0, 50)}
                  basemap={me.basemap}
                  maxTileZoom={me.maxZoom}
                  labels={me.labels}
                  vouchesPerPin={me.vouchesPerPin}
                  onTap={(p) => { setPoint(p); setFromPhoto(false); }}
                  placing={point}
                  height={280}
                />
              </div>
            </>
          )}
        </div>

        <details className="group rounded-xl border border-border p-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold text-foreground">
            <Trans>More</Trans>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-4 space-y-4">
            <fieldset>
              <legend className={LABEL}><Trans>How exactly anyone beyond the open members is ever shown it</Trans></legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {me.precisions.map((p) => (
                  <button key={p} type="button" aria-pressed={precision === p} onClick={() => setPrecision(p)} className={`${CHIP} ${precision === p ? "border-primary bg-primary/10 text-foreground" : "border-border text-foreground"}`}>
                    {i18n._(PRECISION_WORDS[p])}
                  </button>
                ))}
              </div>
              <p className={`${HINT} mt-1`}><Trans>Members whose map has opened always see the exact place, and so does whoever keeps the map while they vouch for it.</Trans></p>
            </fieldset>
            <label className="block">
              <span className={LABEL}><Trans>A name for it</Trans></span>
              <input className={`${FIELD} mt-1`} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            {layer === "planting" && (
              <label className="block">
                <span className={LABEL}><Trans>Planted on</Trans></span>
                <input type="date" className={`${FIELD} mt-1`} value={plantedOn} onChange={(e) => setPlantedOn(e.target.value)} />
              </label>
            )}
            <label className="block">
              <span className={LABEL}><Trans>Notes</Trans></span>
              <textarea className={`${FIELD} mt-1`} rows={3} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
        </details>

        <p className={HINT}><Trans>A vouch comes from a member who knows the place is real. Nobody vouches for their own. Your name is never shown beside a pin.</Trans></p>

        {!online && (
          <div className="flex items-start gap-3 rounded-xl border border-primary/50 bg-muted p-4" role="status">
            <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm text-foreground">
              <span className="block font-semibold"><Trans>No signal here</Trans></span>
              <Trans>It is saved on your phone and sends when you are back in range.</Trans>
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={`${BTN_PRIMARY} flex-1`} disabled={busy || staged || !point || !kind} onClick={() => void send()}>
            {busy ? <Trans>Saving</Trans> : <Trans>Save it</Trans>}
          </button>
          {layer === "planting" && me.plantingPays && <p className={HINT}><Trans>Rewarded once vouched</Trans></p>}
        </div>
        {staged && <p className={HINT}><Trans>Use the photo or leave it out first.</Trans></p>}
        {said && <p className={HINT} role="status">{said}</p>}
      </div>
    </section>
  );
}
