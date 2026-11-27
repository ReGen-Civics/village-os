/**
 * A wall of photographs: each tile is the picture and the one line saying who
 * took it and when, and a press opens it large in the viewer, where every act
 * lives. The place page and the all-photos tab both draw this.
 *
 * `lead` makes the first tile twice the size from `sm` up, so a place opens
 * on its cover the way a listing does. The all-photos tab is a record in
 * time and gives every tile one size.
 */
import { useState } from "react";
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
  onChanged,
}: {
  photos: PlacePhoto[];
  canCurate: boolean;
  signedIn: boolean;
  viewerId: string | null;
  showPlace?: boolean;
  lead?: boolean;
  onChanged: () => void;
}) {
  const { t } = useLingui();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {photos.map((photo, i) => {
          const big = lead && i === 0 && photos.length > 2;
          const where = placeName(photo.structureKey);
          const described = photo.altText;
          return (
            <li key={photo.id} className={big ? "col-span-2 flex sm:row-span-2" : "flex"}>
              <button
                type="button"
                onClick={() => setOpen(i)}
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
                      sizes={big ? "(min-width: 1024px) 560px, (min-width: 640px) 66vw, 100vw" : "(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"}
                      ratio={1}
                      imgClassName="transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                    />
                  )}
                  {(photo.heroAt || photo.hiddenAt) && (
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
        photos={photos}
        index={open}
        onIndex={setOpen}
        canCurate={canCurate}
        signedIn={signedIn}
        viewerId={viewerId}
        showPlace={showPlace}
        onChanged={onChanged}
      />
    </>
  );
}
