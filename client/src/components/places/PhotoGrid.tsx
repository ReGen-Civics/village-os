/**
 * A wall of photographs: each tile is the picture and the one line saying who
 * took it and when, and a press opens it large in the viewer, where every act
 * lives. The place page and the all-photos view both draw this.
 *
 * THE OPEN PHOTO IS TRACKED BY ID. An act reloads the list, and the list can
 * reorder (a new cover leads) or lose the picture (a takedown, or "This is me"
 * for a reader who cannot see hidden photos). By id, the viewer stays on its
 * picture through a reorder and shuts when the picture is gone, and focus goes
 * back to the tile, or to the page's line when the tile has left with it.
 *
 * `lead` makes the first tile twice the size from `sm` up, so a place opens
 * on its cover the way a listing does. The all-photos view is a record in
 * time: every tile one size, and no cover mark.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { EyeOff, Pin } from "lucide-react";
import { Image, uploadSrcSet } from "@/components/Image";
import CuratorImage from "@/components/places/CuratorImage";
import PhotoViewer from "@/components/places/PhotoViewer";
import { placeName } from "@/components/places/placesApi";
import { attributionLine, type PlacePhoto } from "@shared/placePhotos";
import { Trans, useLingui } from "@lingui/react/macro";

export default function PhotoGrid({
  photos,
  canCurate,
  signedIn,
  viewerId,
  showPlace = false,
  lead = false,
  say,
  onSay,
  focusLine,
  onChanged,
}: {
  photos: PlacePhoto[];
  canCurate: boolean;
  signedIn: boolean;
  viewerId: string | null;
  showPlace?: boolean;
  lead?: boolean;
  /** The page's line, and how to set it and send focus to it. */
  say: string;
  onSay: (line: string) => void;
  focusLine: () => void;
  onChanged: () => void;
}) {
  const { t } = useLingui();
  const [openId, setOpenId] = useState<string | null>(null);
  const tiles = useRef(new Map<string, HTMLButtonElement>());
  /** The tile focus returns to when the viewer shuts; null sends it to the page's line. */
  const back = useRef<string | null>(null);

  const index = openId ? photos.findIndex((p) => p.id === openId) : -1;

  const focusBack = useCallback(() => {
    const id = back.current;
    requestAnimationFrame(() => {
      const tile = id ? tiles.current.get(id) : undefined;
      if (tile) tile.focus();
      else focusLine();
    });
  }, [focusLine]);

  // The picture left the list after a reload: shut the viewer, and the line says why.
  useEffect(() => {
    if (openId && index === -1) {
      back.current = null;
      setOpenId(null);
      focusBack();
    }
  }, [openId, index, focusBack]);

  const open = (id: string) => {
    back.current = id;
    onSay("");
    setOpenId(id);
  };

  const step = (delta: number) => {
    if (index < 0 || !photos.length) return;
    const next = photos[(index + delta + photos.length) % photos.length];
    back.current = next.id;
    onSay("");
    setOpenId(next.id);
  };

  return (
    <>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {photos.map((photo, i) => {
          const big = lead && i === 0 && photos.length > 2;
          const where = placeName(photo.structureKey);
          const described = photo.altText;
          const cover = !showPlace && !!photo.heroAt;
          return (
            <li key={photo.id} className={big ? "col-span-2 flex sm:row-span-2" : "flex"}>
              <button
                ref={(el) => {
                  if (el) tiles.current.set(photo.id, el);
                  else tiles.current.delete(photo.id);
                }}
                type="button"
                onClick={() => open(photo.id)}
                className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm hover:border-notice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t({ message: `Open the photo: ${described}`, context: "place photo tile" })}
              >
                <span className="relative block">
                  {photo.hiddenAt ? (
                    <CuratorImage src={photo.url} alt={photo.altText} ratio={1} />
                  ) : (
                    <Image
                      src={photo.url}
                      alt={photo.altText}
                      srcSet={uploadSrcSet(photo.url, photo.thumbUrl)}
                      sizes={big ? "(min-width: 640px) 50vw, 100vw" : "(min-width: 640px) 25vw, 50vw"}
                      ratio={1}
                      imgClassName="transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                    />
                  )}
                  {(cover || photo.hiddenAt) && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-semibold text-foreground shadow-sm">
                      {photo.hiddenAt ? (
                        <>
                          <EyeOff className="size-3" aria-hidden="true" />
                          <Trans context="place photo tile">Hidden</Trans>
                        </>
                      ) : (
                        <>
                          <Pin className="size-3 text-notice" aria-hidden="true" />
                          <Trans context="place photo tile">Cover</Trans>
                        </>
                      )}
                    </span>
                  )}
                </span>
                <span className="mt-auto block space-y-0.5 px-3 py-2">
                  {showPlace && <span className="block truncate text-sm font-semibold text-foreground">{where}</span>}
                  <span className="block text-xs leading-snug text-muted-foreground">{attributionLine(photo)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <PhotoViewer
        photo={index >= 0 ? photos[index] : null}
        total={photos.length}
        onStep={step}
        onClose={() => setOpenId(null)}
        onClosedFocus={focusBack}
        onDropped={() => {
          back.current = null;
          setOpenId(null);
          focusBack();
        }}
        canCurate={canCurate}
        signedIn={signedIn}
        viewerId={viewerId}
        showPlace={showPlace}
        say={say}
        onSay={onSay}
        onChanged={onChanged}
      />
    </>
  );
}
