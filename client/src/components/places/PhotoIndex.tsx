/**
 * Every photo in the village, newest first, whatever place it is filed under:
 * the "All photos" view of /places (it was /photographs).
 *
 * ── WHAT IT IS FOR ───────────────────────────────────────────────────────
 *
 * Somebody who wants a picture of themselves taken down has to be able to
 * find it without knowing which place it was filed under. The cheap way would
 * be to work out who is in every photograph and let a person search for their
 * own face, which leaves the village holding a record of who appears in every
 * picture of it, forever. A list a person can scroll answers the same question
 * and leaves nothing behind that can be turned on anyone later. That is why
 * this is a list and never a search box.
 *
 * ── HOW IT LOADS ─────────────────────────────────────────────────────────
 *
 * Sixty at a time, then a button. The server hands back the exact row the page
 * ended on and the next press carries on from there, so a photo coming down
 * between two presses cannot make the list skip one. An act on a picture
 * re-reads every page the reader has open, because a takedown shifts what sits
 * above it too.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import BreathingLoader from "@/components/natural/BreathingLoader";
import LoadFailed from "@/components/LoadFailed";
import PhotoGrid from "@/components/places/PhotoGrid";
import { jsonHeaders } from "@/components/places/placesApi";
import { BTN_SECONDARY, HINT, TILE } from "@/components/journey/look";
import type { PlacePhoto } from "@shared/placePhotos";
import { Trans, useLingui } from "@lingui/react/macro";

interface IndexPage {
  photos: PlacePhoto[];
  nextBefore: string | null;
  canCurate: boolean;
  viewerId: string | null;
  signedIn: boolean;
}

export default function PhotoIndex({ onLocked }: { onLocked: () => void }) {
  const { t } = useLingui();
  const [pages, setPages] = useState<IndexPage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [say, setSay] = useState("");
  const line = useRef<HTMLParagraphElement | null>(null);
  const focusLine = useCallback(() => line.current?.focus(), []);

  /** One page of the index, or null when the read did not land. */
  const fetchPage = useCallback(
    async (before: string | null): Promise<IndexPage | null> => {
      const suffix = before ? `?before=${encodeURIComponent(before)}` : "";
      try {
        const res = await fetch(`/api/places/photos${suffix}`, { headers: jsonHeaders() });
        if (res.status === 401) {
          onLocked();
          return null;
        }
        if (!res.ok) {
          setFailed(true);
          return null;
        }
        return (await res.json()) as IndexPage;
      } catch {
        setFailed(true);
        return null;
      }
    },
    [onLocked],
  );

  /** The first page, then as many more as the reader already had open. */
  const loadRun = useCallback(
    async (depth: number) => {
      const run: IndexPage[] = [];
      let before: string | null = null;
      for (let i = 0; i < Math.max(1, depth); i += 1) {
        const page: IndexPage | null = await fetchPage(before);
        if (!page) return;
        run.push(page);
        if (!page.nextBefore) break;
        before = page.nextBefore;
      }
      setPages(run);
      setFailed(false);
    },
    [fetchPage],
  );

  useEffect(() => {
    void loadRun(1);
  }, [loadRun]);

  const showOlder = async () => {
    const tail = pages?.[pages.length - 1];
    if (!tail?.nextBefore || busy) return;
    setBusy(true);
    try {
      const page = await fetchPage(tail.nextBefore);
      if (page) setPages([...(pages ?? []), page]);
    } finally {
      setBusy(false);
    }
  };

  if (failed && !pages) return <LoadFailed onRetry={() => { setFailed(false); void loadRun(1); }} />;
  if (!pages) return <BreathingLoader label={t({ message: "Opening every photo", context: "all photos view" })} />;

  const photos = pages.flatMap((p) => p.photos);
  const head = pages[0];
  const tail = pages[pages.length - 1];

  return (
    <div className="space-y-5">
      <div className={`${TILE} space-y-1`}>
        <p className="text-sm font-semibold text-foreground">
          <Trans context="all photos view">Is one of these of you?</Trans>
        </p>
        <ul className={`${HINT} m-0 list-disc space-y-1 pl-5`}>
          <li><Trans context="all photos view">Open it and press "This is me, take it down".</Trans></li>
          <li><Trans context="all photos view">It hides at once, and the curators get your request.</Trans></li>
        </ul>
      </div>

      <p ref={line} tabIndex={-1} role="status" aria-live="polite" className="min-h-5 rounded-lg text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">{say}</p>

      {photos.length === 0 ? (
        <p className={HINT}><Trans context="all photos view">No photos yet.</Trans></p>
      ) : (
        <>
          <PhotoGrid
            photos={photos}
            canCurate={head.canCurate}
            signedIn={head.signedIn}
            viewerId={head.viewerId}
            showPlace
            say={say}
            onSay={setSay}
            focusLine={focusLine}
            onChanged={() => void loadRun(pages.length)}
          />
          {tail.nextBefore ? (
            <button type="button" onClick={showOlder} disabled={busy} className={BTN_SECONDARY}>
              {busy ? (
                <Trans context="all photos view">Opening...</Trans>
              ) : (
                <Trans context="all photos view">Show older photos</Trans>
              )}
            </button>
          ) : (
            <p className={HINT}><Trans context="all photos view">That is every photo, back to the first.</Trans></p>
          )}
        </>
      )}
    </div>
  );
}
