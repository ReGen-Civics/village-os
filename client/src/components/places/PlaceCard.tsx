/**
 * One place on the shelf: its cover photo filling the card, its name set on
 * the card's own ground at the foot, and how many photos it holds.
 *
 * The cover is whatever the place leads with, chosen by the same rule the
 * place page uses and computed on the server, so the shelf and the place never
 * open with different pictures. The fade at the foot is the card's own token
 * (`from-card`), so the name reads in light and dark mode on any photo.
 */
import { Link } from "wouter";
import { Image, uploadSrcSet } from "@/components/Image";
import { placeName } from "@/components/places/placesApi";
import { Plural, useLingui } from "@lingui/react/macro";

export interface PlaceCardData {
  structureKey: string;
  photoCount: number;
  coverUrl: string | null;
  coverThumbUrl: string | null;
  coverAltText: string | null;
  latestAt: string;
}

export default function PlaceCard({ place }: { place: PlaceCardData }) {
  const { t } = useLingui();
  const name = placeName(place.structureKey);
  const count = place.photoCount;
  return (
    <li>
      <Link
        href={`/places/${encodeURIComponent(place.structureKey)}`}
        className="group relative block overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:border-notice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {place.coverUrl ? (
          <Image
            src={place.coverUrl}
            alt={place.coverAltText ?? t({ message: `A photo of ${name}`, context: "places shelf" })}
            srcSet={uploadSrcSet(place.coverUrl, place.coverThumbUrl)}
            sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
            ratio={3 / 4}
            imgClassName="transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <span className="block aspect-[3/4] bg-muted" aria-hidden="true" />
        )}
        <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-card via-card/90 to-transparent px-3 pb-3 pt-10 sm:px-4 sm:pb-4">
          <span className="block font-display text-lg leading-tight text-foreground sm:text-2xl">{name}</span>
          <span className="mt-0.5 block text-xs font-medium text-muted-foreground sm:text-sm">
            <Plural context="places shelf" value={count} one="# photo" other="# photos" />
          </span>
        </span>
      </Link>
    </li>
  );
}
