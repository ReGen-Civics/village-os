/**
 * One photograph, large, with every control a person can act on it with.
 *
 * The place page and the all-photos view both open this same viewer, so
 * SunLeaf and "This is me" mean one thing everywhere. It replaced the old
 * card, which carried five buttons under every thumbnail: the grid is for
 * looking, and the acts live here, one press away.
 *
 * The grid owns which photo is open (by id, so a reload that reorders the
 * list keeps the viewer on its picture) and the page owns the line that says
 * what an act did, so the line outlives the viewer when the picture leaves
 * the list. Taking a photo down for good is a real second question, asked in
 * its own row, and a confirm that lands inside half a second of the first
 * press is ignored, so a double click cannot delete.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, EyeOff, Pin, Trash2, Undo2, UserRound, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SunLeaf } from "@/components/sacred/living";
import { Image } from "@/components/Image";
import CuratorImage from "@/components/places/CuratorImage";
import { jsonHeaders, placeName } from "@/components/places/placesApi";
import { BTN_DANGER, BTN_SECONDARY, CHIP_SOFT, EYEBROW, HINT, LINK, TILE } from "@/components/journey/look";
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

/** The round buttons over the picture (back, next, close); each adds its place. */
const ROUND =
  "absolute inline-flex size-11 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A confirm pressed sooner than this after the first press is a double click, not an answer. */
const CONFIRM_AFTER_MS = 500;

/** The edged act, faded while an act is on its way (aria-disabled keeps focus on it, where disabled would drop it). */
const ACT = `${BTN_SECONDARY} aria-disabled:opacity-50`;

export interface PhotoViewerProps {
  /** The open photo, or null when the viewer is shut. */
  photo: PlacePhoto | null;
  /** Where the open photo sits in the set (1-based), and how many there are: the reader's "2 of 7". */
  position: number;
  total: number;
  onStep: (delta: number) => void;
  onClose: () => void;
  /** Where focus goes once the viewer has shut (the grid sends it to the tile or the page's line). */
  onClosedFocus: () => void;
  /** A photo taken down for good: the grid shuts the viewer and the page's line takes the word. */
  onDropped: () => void;
  canCurate: boolean;
  signedIn: boolean;
  viewerId: string | null;
  /** The all-photos view sets this, so each picture says which place it is filed under. */
  showPlace?: boolean;
  /** The page's line: what the last act did. */
  say: string;
  onSay: (line: string) => void;
  /** Read the list again after an act. */
  onChanged: () => void;
}

export default function PhotoViewer({
  photo,
  position,
  total,
  onStep,
  onClose,
  onClosedFocus,
  onDropped,
  canCurate,
  signedIn,
  viewerId,
  showPlace = false,
  say,
  onSay,
  onChanged,
}: PhotoViewerProps) {
  const { t } = useLingui();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const askedAt = useRef(0);
  const keep = useRef<HTMLButtonElement | null>(null);
  const dropBtn = useRef<HTMLButtonElement | null>(null);
  /** "Keep it" hands focus back to the button that asked. */
  const backToDrop = useRef(false);

  // A new picture starts with no half-asked takedown.
  useEffect(() => {
    setAsking(false);
  }, [photo?.id]);

  // The second question takes focus on its safe answer; "Keep it" gives it back to the button that asked.
  useEffect(() => {
    if (asking) keep.current?.focus();
    else if (backToDrop.current) {
      backToDrop.current = false;
      dropBtn.current?.focus();
    }
  }, [asking]);

  if (!photo) return null;
  const mine = !!viewerId && viewerId === photo.contributorId;
  const many = total > 1;
  const id = encodeURIComponent(photo.id);
  /** The second question, asked in its row and said in the line. */
  const question = canCurate
    ? t({ message: "Take it down for good?", context: "place photo viewer" })
    : t({ message: "Remove it for good?", context: "place photo viewer" });
  const coverSet = t({ message: "This place opens with that one now.", context: "place photo viewer" });
  const failedDrop = t({ message: "That did not come down. Try again in a moment.", context: "place photo viewer" });

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
        onSay(payload?.error || REPORT_FAILED);
        return;
      }
      onSay(payload?.fresh === false ? already : ok);
      onChanged();
    } catch {
      onSay(REPORT_FAILED);
    } finally {
      setBusy(false);
    }
  };

  const ask = () => {
    if (busy || asking) return;
    askedAt.current = Date.now();
    setAsking(true);
    onSay(question);
  };

  const drop = async () => {
    if (busy || Date.now() - askedAt.current < CONFIRM_AFTER_MS) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/places/photo/${id}`, { method: "DELETE", headers: jsonHeaders() });
      if (!res.ok) {
        onSay(failedDrop);
        return;
      }
      setAsking(false);
      onSay(t({ message: "Taken down. The file and its description are gone.", context: "place photo viewer" }));
      onDropped();
      onChanged();
    } catch {
      onSay(failedDrop);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!many || asking) return;
    if (e.key === "ArrowRight") { e.preventDefault(); onStep(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); onStep(-1); }
  };

  const where = placeName(photo.structureKey);
  const why = photo.hiddenReason ?? "";
  const here = window.location.pathname + window.location.hash;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* A photo of the land is a place, not a box of words: data-scene keeps it in the night (index.css, "Dialogue is sand"). */}
      <DialogContent
        data-scene=""
        showCloseButton={false}
        onKeyDown={onKey}
        onCloseAutoFocus={(e) => { e.preventDefault(); onClosedFocus(); }}
        className="sheet-night max-h-[90vh] gap-0 overflow-y-auto rounded-lg bg-card p-0 text-foreground sm:max-w-3xl"
      >
        <div className="relative bg-muted">
          {photo.hiddenAt ? (
            <CuratorImage src={photo.url} alt={photo.altText} className="w-full max-h-[50vh]" />
          ) : (
            <Image src={photo.url} alt={photo.altText} ratio={4 / 3} fit="contain" priority className="w-full max-h-[50vh]" />
          )}
          <DialogClose className={`${ROUND} right-2 top-2`} aria-label={t({ message: "Close the photo", context: "place photo viewer" })}>
            <X className="size-5" />
          </DialogClose>
          {many && (
            <>
              <button type="button" onClick={() => onStep(-1)} className={`${ROUND} left-2 top-1/2 -translate-y-1/2`} aria-label={t({ message: "The photo before", context: "place photo viewer" })}>
                <ChevronLeft className="size-5" />
              </button>
              <button type="button" onClick={() => onStep(1)} className={`${ROUND} right-2 top-1/2 -translate-y-1/2`} aria-label={t({ message: "The next photo", context: "place photo viewer" })}>
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            {showPlace ? (
              <Link href={`/places/${encodeURIComponent(photo.structureKey)}`} className={`${EYEBROW} inline-flex min-h-11 items-center underline-offset-2 hover:underline`} onClick={onClose}>
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
                <Pin className="size-3" />
                <Trans context="place photo viewer">Cover</Trans>
              </span>
            )}
            {photo.hiddenAt && (
              <span className={CHIP_SOFT}>
                <EyeOff className="size-3" />
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

          {asking ? (
            <div className={`${TILE} space-y-3`}>
              <p className="text-sm font-semibold text-foreground">
                {question}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-disabled={busy || undefined} className={BTN_DANGER} onClick={drop}>
                  <Trash2 className="size-4" />
                  {canCurate ? (
                    <Trans context="place photo viewer">Yes, take it down</Trans>
                  ) : (
                    <Trans context="place photo viewer">Yes, remove it</Trans>
                  )}
                </button>
                <button ref={keep} type="button" className={BTN_SECONDARY} onClick={() => { backToDrop.current = true; setAsking(false); onSay(""); }}>
                  <Trans context="place photo viewer">Keep it</Trans>
                </button>
              </div>
            </div>
          ) : (
            <>
              {signedIn ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-disabled={busy || undefined}
                    className={ACT}
                    onClick={() => post(`/api/places/photo/${id}/subject-request`, SUBJECT_FILED, SUBJECT_ALREADY, { reason: "" })}
                  >
                    <UserRound className="size-4" />
                    <Trans context="place photo viewer">This is me, take it down</Trans>
                  </button>
                  <button
                    type="button"
                    aria-disabled={busy || undefined}
                    className={ACT}
                    onClick={() => post(`/api/places/photo/${id}/report`, CONCERN_FILED, CONCERN_ALREADY, { reason: "" })}
                  >
                    <SunLeaf className="size-4" aria-hidden="true" />
                    <Trans context="place photo viewer">SunLeaf this</Trans>
                  </button>
                  {mine && !canCurate && (
                    <button ref={dropBtn} type="button" aria-disabled={busy || undefined} className={BTN_DANGER} onClick={ask}>
                      <Trash2 className="size-4" />
                      <Trans context="place photo viewer">Remove my photo</Trans>
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm">
                  <Link href={`/login?next=${encodeURIComponent(here)}`} className={`${LINK} inline-flex min-h-11 items-center`}>
                    <Trans context="place photo viewer">Sign in to ask for a photo of you to come down</Trans>
                  </Link>
                </p>
              )}

              {canCurate && (
                <div className="space-y-2 border-t border-border pt-4">
                  <p className={EYEBROW}><Trans context="place photo viewer">Curator</Trans></p>
                  <div className="flex flex-wrap gap-2">
                    {photo.hiddenAt ? (
                      <button
                        type="button"
                        aria-disabled={busy || undefined}
                        className={ACT}
                        onClick={() => post(`/api/places/photo/${id}/restore`, t({ message: "Back on the place.", context: "place photo viewer" }), t({ message: "Already showing.", context: "place photo viewer" }), {})}
                      >
                        <Undo2 className="size-4" />
                        <Trans context="place photo viewer">Put back</Trans>
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-disabled={busy || undefined}
                        className={ACT}
                        onClick={() => post(`/api/places/photo/${id}/hide`, t({ message: "Hidden. The file stopped answering too.", context: "place photo viewer" }), t({ message: "Already hidden.", context: "place photo viewer" }), { reason: "" })}
                      >
                        <EyeOff className="size-4" />
                        <Trans context="place photo viewer">Hide</Trans>
                      </button>
                    )}
                    {!photo.hiddenAt && !photo.heroAt && (
                      <button
                        type="button"
                        aria-disabled={busy || undefined}
                        className={ACT}
                        onClick={() =>
                          post(
                            `/api/places/${encodeURIComponent(photo.structureKey)}/hero`,
                            coverSet,
                            coverSet,
                            { photoId: photo.id },
                            "PUT",
                          )
                        }
                      >
                        <Pin className="size-4" />
                        <Trans context="place photo viewer">Make it the cover</Trans>
                      </button>
                    )}
                    <button ref={dropBtn} type="button" aria-disabled={busy || undefined} className={BTN_DANGER} onClick={ask}>
                      <Trash2 className="size-4" />
                      <Trans context="place photo viewer">Take down</Trans>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
