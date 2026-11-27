/**
 * One photograph, large, with every control a person can act on it with.
 *
 * The place page and the all-photos tab both open this same viewer, so
 * SunLeaf and "This is me" mean one thing everywhere. It replaced the old
 * card, which carried five buttons under every thumbnail: the grid is for
 * looking, and the acts live here, one press away.
 *
 * Arrows (and the two buttons) walk the list the reader opened it from.
 * Taking a photograph down for good asks twice, because the file and its
 * description are gone the moment it lands.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, EyeOff, Pin, Trash2, Undo2, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SunLeaf } from "@/components/sacred/living";
import { Image } from "@/components/Image";
import CuratorImage from "@/components/places/CuratorImage";
import { ACT, ACT_DANGER, jsonHeaders, placeName } from "@/components/places/placesApi";
import { CHIP_SOFT, EYEBROW, HINT, LINK } from "@/components/journey/look";
import {
  CONCERN_ALREADY,
  CONCERN_FILED,
  REPORT_FAILED,
  SUBJECT_ALREADY,
  SUBJECT_FILED,
  attributionLine,
  type PlacePhoto,
} from "@shared/placePhotos";
import { Trans, useLingui } from "@lingui/react/macro";

/** The round step buttons over the picture; each adds its side. */
const STEP =
  "absolute top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface PhotoViewerProps {
  photos: PlacePhoto[];
  /** The open photograph's position in `photos`, or null when the viewer is shut. */
  index: number | null;
  onIndex: (i: number | null) => void;
  canCurate: boolean;
  signedIn: boolean;
  viewerId: string | null;
  /** The all-photos tab sets this, so each picture says which place it is filed under. */
  showPlace?: boolean;
  /** Read the list again after an act. */
  onChanged: () => void;
}

export default function PhotoViewer({ photos, index, onIndex, canCurate, signedIn, viewerId, showPlace = false, onChanged }: PhotoViewerProps) {
  const { t } = useLingui();
  const open = index !== null && index >= 0 && index < photos.length;
  const photo = open ? photos[index] : null;
  const [busy, setBusy] = useState(false);
  const [say, setSay] = useState("");
  const [confirmDrop, setConfirmDrop] = useState(false);

  // A new picture starts with a clean line and no half-asked takedown.
  useEffect(() => {
    setSay("");
    setConfirmDrop(false);
  }, [photo?.id]);

  // The list changed under the viewer (a takedown): shut it if the picture is gone.
  useEffect(() => {
    if (index !== null && index >= photos.length) onIndex(photos.length ? photos.length - 1 : null);
  }, [index, photos.length, onIndex]);

  if (!photo || index === null) return null;
  const mine = !!viewerId && viewerId === photo.contributorId;
  const step = (d: number) => onIndex((index + d + photos.length) % photos.length);
  const many = photos.length > 1;
  const id = encodeURIComponent(photo.id);

  /**
   * One press, one sentence back. `already` is a SUCCESS and not an error: a
   * second press is what a worried person does, the server stores one report
   * either way, and telling them it failed would read as the report lost.
   */
  const post = async (path: string, ok: string, already: string, body?: unknown, method = "POST") => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(path, { method, headers: jsonHeaders(), body: body === undefined ? undefined : JSON.stringify(body) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSay(payload?.error || REPORT_FAILED);
        return;
      }
      setSay(payload?.fresh === false ? already : ok);
      onChanged();
    } catch {
      setSay(REPORT_FAILED);
    } finally {
      setBusy(false);
    }
  };

  const drop = async () => {
    if (busy) return;
    if (!confirmDrop) {
      setConfirmDrop(true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/places/photo/${id}`, { method: "DELETE", headers: jsonHeaders() });
      if (!res.ok) {
        setSay(t({ message: "That did not come down. Try again in a moment.", context: "place photo viewer" }));
        return;
      }
      onIndex(null);
      onChanged();
    } catch {
      setSay(t({ message: "That did not come down. Try again in a moment.", context: "place photo viewer" }));
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!many) return;
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  };

  const where = placeName(photo.structureKey);
  const position = index + 1;
  const total = photos.length;
  const why = photo.hiddenReason ?? "";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onIndex(null); }}>
      <DialogContent
        onKeyDown={onKey}
        className="max-h-[90vh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-3xl"
      >
        <div className="relative bg-muted">
          {photo.hiddenAt ? (
            <CuratorImage src={photo.url} alt={photo.altText} />
          ) : (
            <Image src={photo.url} alt={photo.altText} ratio={4 / 3} fit="contain" priority />
          )}
          {many && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                className={`${STEP} left-2`}
                aria-label={t({ message: "The photo before", context: "place photo viewer" })}
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className={`${STEP} right-2`}
                aria-label={t({ message: "The next photo", context: "place photo viewer" })}
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            {showPlace ? (
              <Link href={`/places/${encodeURIComponent(photo.structureKey)}`} className={`${EYEBROW} inline-flex min-h-11 items-center underline-offset-2 hover:underline`} onClick={() => onIndex(null)}>
                {where}
              </Link>
            ) : (
              <p className={EYEBROW}>{where}</p>
            )}
            {many && (
              <span className={CHIP_SOFT}>
                <Trans context="place photo viewer">{position} of {total}</Trans>
              </span>
            )}
            {photo.heroAt && (
              <span className={CHIP_SOFT}>
                <Pin className="size-3" aria-hidden="true" />
                <Trans context="place photo viewer">Cover</Trans>
              </span>
            )}
            {photo.hiddenAt && (
              <span className={CHIP_SOFT}>
                <EyeOff className="size-3" aria-hidden="true" />
                <Trans context="place photo viewer">Hidden</Trans>
              </span>
            )}
          </div>

          <DialogTitle className="font-display text-xl font-normal leading-snug text-foreground">
            {photo.caption || photo.altText}
          </DialogTitle>
          <DialogDescription className={HINT}>{attributionLine(photo)}</DialogDescription>
          {photo.hiddenAt && photo.hiddenReason && (
            <p className={HINT}>
              <Trans context="place photo viewer">Hidden because: {why}</Trans>
            </p>
          )}

          <p role="status" aria-live="polite" className="min-h-5 text-sm font-medium text-foreground">{say}</p>

          {signedIn ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className={ACT}
                onClick={() => post(`/api/places/photo/${id}/subject-request`, SUBJECT_FILED, SUBJECT_ALREADY, { reason: "" })}
              >
                <UserRound className="size-4" aria-hidden="true" />
                <Trans context="place photo viewer">This is me, take it down</Trans>
              </button>
              <button
                type="button"
                disabled={busy}
                className={ACT}
                onClick={() => post(`/api/places/photo/${id}/report`, CONCERN_FILED, CONCERN_ALREADY, { reason: "" })}
              >
                <SunLeaf className="size-4" aria-hidden="true" />
                <Trans context="place photo viewer">SunLeaf this</Trans>
              </button>
              {mine && !canCurate && (
                <button type="button" disabled={busy} className={ACT_DANGER} onClick={drop}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  {confirmDrop ? (
                    <Trans context="place photo viewer">Press again to remove it for good</Trans>
                  ) : (
                    <Trans context="place photo viewer">Remove my photo</Trans>
                  )}
                </button>
              )}
            </div>
          ) : (
            <p className={HINT}>
              <Trans context="place photo viewer">
                <Link href={`/login?next=${encodeURIComponent("/places#photos")}`} className={LINK}>Sign in</Link> to ask for a photo of you to come down.
              </Trans>
            </p>
          )}

          {canCurate && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className={EYEBROW}><Trans context="place photo viewer">Curator</Trans></p>
              <div className="flex flex-wrap gap-2">
                {photo.hiddenAt ? (
                  <button
                    type="button"
                    disabled={busy}
                    className={ACT}
                    onClick={() => post(`/api/places/photo/${id}/restore`, t({ message: "Back on the place.", context: "place photo viewer" }), t({ message: "Already showing.", context: "place photo viewer" }), {})}
                  >
                    <Undo2 className="size-4" aria-hidden="true" />
                    <Trans context="place photo viewer">Put back</Trans>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    className={ACT}
                    onClick={() => post(`/api/places/photo/${id}/hide`, t({ message: "Hidden. The file stopped answering too.", context: "place photo viewer" }), t({ message: "Already hidden.", context: "place photo viewer" }), { reason: "" })}
                  >
                    <EyeOff className="size-4" aria-hidden="true" />
                    <Trans context="place photo viewer">Hide</Trans>
                  </button>
                )}
                {!photo.hiddenAt && !photo.heroAt && (
                  <button
                    type="button"
                    disabled={busy}
                    className={ACT}
                    onClick={() =>
                      post(
                        `/api/places/${encodeURIComponent(photo.structureKey)}/hero`,
                        t({ message: "This place opens with that one now.", context: "place photo viewer" }),
                        t({ message: "This place opens with that one now.", context: "place photo viewer" }),
                        { photoId: photo.id },
                        "PUT",
                      )
                    }
                  >
                    <Pin className="size-4" aria-hidden="true" />
                    <Trans context="place photo viewer">Make it the cover</Trans>
                  </button>
                )}
                <button type="button" disabled={busy} className={ACT_DANGER} onClick={drop}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  {confirmDrop ? (
                    <Trans context="place photo viewer">Press again to take it down for good</Trans>
                  ) : (
                    <Trans context="place photo viewer">Take down</Trans>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
