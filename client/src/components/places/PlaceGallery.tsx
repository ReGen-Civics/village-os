/**
 * One place: its name, how many photos it holds, the way to add one, and the
 * wall of photos itself.
 *
 * Ordering, attribution and the wording of a report all live in
 * `shared/placePhotos.ts`, shared with the server. Read that file's header for
 * why the cover leads and everything under it is newest first.
 *
 * THE UPLOAD KEEPS EVERY GUARD IT HAD. The picture is shrunk in the browser
 * first (`prepareImageForUpload`), the server strips every bit of metadata
 * and refuses to store a file whose location data survived, and alt text is
 * required at the door. Nothing on this page loosens any of them; it says
 * the location line out loud beside the file picker.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Camera } from "lucide-react";
import BreathingLoader from "@/components/natural/BreathingLoader";
import LoadFailed from "@/components/LoadFailed";
import Fireflies from "@/components/journey/nature/Fireflies";
import PhotoGrid from "@/components/places/PhotoGrid";
import { jsonHeaders, placeName } from "@/components/places/placesApi";
import { authToken } from "@/lib/gameApi";
import { prepareImageForUpload } from "@/lib/imagePrep";
import { scrollBehavior } from "@/components/natural/scrollBehavior";
import { ALT_TEXT_MAX, CAPTION_MAX, remainingForPlace, type PlacePhoto } from "@shared/placePhotos";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  CARD_FEATURED,
  CHIP_SOFT,
  EYEBROW,
  FIELD,
  H1,
  H2,
  HINT,
  LABEL,
  NOTE,
  QUIET,
} from "@/components/journey/look";
import { Plural, Trans, useLingui } from "@lingui/react/macro";

/**
 * The upload's headers. No Content-Type: the browser sets the multipart
 * boundary itself, and a hand-written header kills the parse on the far side.
 */
const uploadHeaders = (): Record<string, string> => {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export interface GalleryPayload {
  structureKey: string;
  photos: PlacePhoto[];
  canContribute: boolean;
  canCurate: boolean;
  viewerId: string | null;
  signedIn: boolean;
  perPlace: number;
  remaining: number;
  maxMb: number;
}

export default function PlaceGallery({ structureKey }: { structureKey: string }) {
  const { t } = useLingui();
  const [data, setData] = useState<GalleryPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [say, setSay] = useState("");
  const line = useRef<HTMLParagraphElement | null>(null);
  const focusLine = useCallback(() => line.current?.focus(), []);
  const addBtn = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/places/${encodeURIComponent(structureKey)}/photos`, { headers: jsonHeaders() });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      setData(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [structureKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = placeName(structureKey);
  const live = data ? data.photos.filter((p) => !p.hiddenAt).length : 0;
  const room = data ? remainingForPlace(live, data.perPlace) : 0;
  const mayAdd = !!data?.canContribute && (data?.remaining ?? 0) > 0;
  // The place's portrait beside its name: the picture it leads with.
  const cover = data?.photos.find((p) => !p.hiddenAt) ?? null;

  return (
    <div className="space-y-6">
      <Link href="/places" className="jw-btn -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-4" aria-hidden="true" />
        <Trans context="place page">All places</Trans>
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          {cover && (
            <span className="relative block aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-xl border border-notice/40 shadow-sm sm:w-16">
              <img src={cover.thumbUrl ?? cover.url} alt="" className="absolute inset-0 size-full object-cover" />
            </span>
          )}
          <div className="min-w-0 space-y-2">
          <p className={EYEBROW}><Trans context="place page">A place on the land</Trans></p>
          <h1 className={`${H1} break-words`}>{name}</h1>
          {data && (
            <div className="flex flex-wrap gap-2">
              <span className={CHIP_SOFT}>
                <Plural context="place page" value={live} one="# photo" other="# photos" />
              </span>
              <span className={CHIP_SOFT}>
                {room === 0 ? (
                  <Trans context="place page">Full</Trans>
                ) : (
                  <Trans context="place page">Room for {room} more</Trans>
                )}
              </span>
            </div>
          )}
          </div>
        </div>
        {mayAdd && !adding && (
          <Fireflies className="self-start sm:self-auto">
            <button ref={addBtn} type="button" className={BTN_PRIMARY} onClick={() => { setSay(""); setAdding(true); }}>
              <Camera className="size-5" aria-hidden="true" />
              <Trans context="place page">Add a photo</Trans>
            </button>
          </Fireflies>
        )}
      </header>

      {failed && !data ? (
        <LoadFailed onRetry={() => { setFailed(false); void load(); }} />
      ) : !data ? (
        <BreathingLoader label={t({ message: "Opening this place's photos", context: "place page" })} />
      ) : (
        <>
          {adding && mayAdd && (
            <AddPhoto
              structureKey={structureKey}
              maxMb={data.maxMb}
              onClose={() => {
                setAdding(false);
                requestAnimationFrame(() => addBtn.current?.focus());
              }}
              onAdded={() => {
                setAdding(false);
                setSay(t({ message: "Added. It is on this place now.", context: "place page" }));
                void load();
                requestAnimationFrame(focusLine);
              }}
            />
          )}
          {data.signedIn && !data.canContribute && (
            <p className={`${QUIET} ${NOTE}`}>
              <Trans context="place page">Adding photos opens at the member stage, or with a role or badge that grants it.</Trans>
            </p>
          )}

          <p ref={line} tabIndex={-1} role="status" aria-live="polite" className="min-h-5 rounded-lg text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">{say}</p>

          {data.photos.length === 0 ? (
            <section className={`${CARD} space-y-2 text-center`}>
              <h2 className={H2}><Trans context="place page">No photos yet</Trans></h2>
              <p className={NOTE}>
                {mayAdd ? (
                  <Trans context="place page">Be the first to add one.</Trans>
                ) : (
                  <Trans context="place page">Nobody has photographed this place yet.</Trans>
                )}
              </p>
            </section>
          ) : (
            <PhotoGrid
              photos={data.photos}
              canCurate={data.canCurate}
              signedIn={data.signedIn}
              viewerId={data.viewerId}
              lead
              say={say}
              onSay={setSay}
              focusLine={focusLine}
              onChanged={() => void load()}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * The upload form.
 *
 * Alt text is required, with a real label: it is a NOT NULL column the server
 * refuses to write without, and it is what the img tag renders, so a member
 * who cannot see the picture is told what is in it.
 */
function AddPhoto({ structureKey, maxMb, onAdded, onClose }: { structureKey: string; maxMb: number; onAdded: () => void; onClose: () => void }) {
  const { t } = useLingui();
  const [file, setFile] = useState<File | null>(null);
  const [shown, setShown] = useState(false);
  const [named, setNamed] = useState("");
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [takenOn, setTakenOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const input = useRef<HTMLInputElement | null>(null);
  const form = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    // On a phone the form starts under the thumb: bring its top into view first, then the picker.
    form.current?.scrollIntoView?.({ block: "start", behavior: scrollBehavior() });
    input.current?.focus({ preventScroll: true });
  }, []);

  /*
   * A local preview of the chosen file, painted as pixels on a canvas from an
   * ImageBitmap. No address is ever built from the file, so nothing the file
   * carries can reach the page as markup or a URL (CodeQL js/xss-through-dom).
   * A picture the browser cannot decode (HEIC on most desktops) keeps the
   * "Choose a picture" face; the upload itself is unaffected.
   */
  useEffect(() => {
    setShown(false);
    setNamed(file?.name ?? "");
    if (!file || typeof createImageBitmap !== "function") return;
    let live = true;
    createImageBitmap(file)
      .then((bitmap) => {
        const c = canvas.current;
        const ctx = c?.getContext("2d");
        if (live && c && ctx) {
          const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
          c.width = Math.max(1, Math.round(bitmap.width * scale));
          c.height = Math.max(1, Math.round(bitmap.height * scale));
          ctx.drawImage(bitmap, 0, 0, c.width, c.height);
          setShown(true);
        }
        bitmap.close();
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [file]);

  const failedLine = t({ message: "That did not save. Try again in a moment.", context: "place page" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setProblem("");
    try {
      // Shrunk in the browser first, the house pipeline. On a 50 KB/s link an
      // untouched phone photo is three minutes of upload that can fail at 95%.
      const prepared = await prepareImageForUpload(file, { maxEdge: 2000, quality: 82 });
      const body = new FormData();
      body.append("photo", prepared.file);
      body.append("altText", altText);
      if (caption.trim()) body.append("caption", caption.trim());
      if (takenOn) body.append("takenOn", takenOn);
      const res = await fetch(`/api/places/${encodeURIComponent(structureKey)}/photos`, {
        method: "POST",
        headers: uploadHeaders(),
        body,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProblem(payload?.error || failedLine);
        return;
      }
      onAdded();
    } catch {
      setProblem(failedLine);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form ref={form} onSubmit={submit} className={`${CARD_FEATURED} scroll-mt-28 space-y-5`} aria-labelledby="add-photo-h">
      <div className="space-y-1">
        <p className={EYEBROW}><Trans context="add a photo form">Add to the record</Trans></p>
        <h2 id="add-photo-h" className={H2}><Trans context="add a photo form">Add a photo</Trans></h2>
      </div>

      <ul className={`${NOTE} m-0 list-disc space-y-1 pl-5`}>
        <li><Trans context="add a photo form">Location data is removed before it is stored. Your name and the month stay with it.</Trans></li>
        <li><Trans context="add a photo form">Up to {maxMb} MB.</Trans></li>
      </ul>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="block space-y-2">
          <span className={LABEL}><Trans context="add a photo form">Picture</Trans></span>
          {/* The native picker stays the control (keyboard, screen reader, a phone's camera); the box is what a person sees and presses. */}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="peer sr-only"
          />
          <span className="relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted hover:border-notice peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
            <canvas ref={canvas} aria-hidden="true" className={shown ? "absolute inset-0 size-full object-cover" : "hidden"} />
            {!shown && (
              <span className="flex flex-col items-center gap-1 p-4 text-center text-sm text-muted-foreground">
                <Camera className="size-7 text-notice" aria-hidden="true" />
                {named || <Trans context="add a photo form">Choose a picture</Trans>}
              </span>
            )}
          </span>
        </label>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className={LABEL}><Trans context="add a photo form">What is in it?</Trans></span>
            <span className={`block ${HINT}`}><Trans context="add a photo form">For someone who cannot see it. Required.</Trans></span>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              maxLength={ALT_TEXT_MAX}
              required
              placeholder={t({ message: "The north wall of the kitchen, half built", context: "add a photo form" })}
              className={`${FIELD} min-h-11`}
            />
          </label>
          <label className="block space-y-1.5">
            <span className={LABEL}><Trans context="add a photo form">A line about it</Trans></span>
            <span className={`block ${HINT}`}><Trans context="add a photo form">Optional.</Trans></span>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={CAPTION_MAX}
              className={`${FIELD} min-h-11`}
            />
          </label>
          <label className="block space-y-1.5">
            <span className={LABEL}><Trans context="add a photo form">When was it taken?</Trans></span>
            <span className={`block ${HINT}`}><Trans context="add a photo form">Left blank, it says when it was added.</Trans></span>
            <input type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} className={`${FIELD} min-h-11`} />
          </label>
        </div>
      </div>

      {problem && (
        <p role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{problem}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || !file || !altText.trim()} className={BTN_PRIMARY}>
          {busy ? (
            <Trans context="add a photo form">Adding...</Trans>
          ) : (
            <Trans context="add a photo form">Add it to this place</Trans>
          )}
        </button>
        <button type="button" onClick={onClose} className={BTN_SECONDARY}>
          <Trans context="add a photo form">Not now</Trans>
        </button>
      </div>
    </form>
  );
}
