/**
 * A PLACE AND ITS LANTERN. Each admin area is a place you can see: a painted
 * building on the Grounds, or a compact row on the Desk. Same component, one
 * `lens` prop.
 *
 * The lantern is lit when something waits there and dark when it is quiet.
 * What waits is said as a plain number in words ("3 waiting"), never a badge.
 * A part of the village that is not built yet stands under scaffolding.
 *
 * It is a link (`href`) or a button (`onOpen`), and its accessible name says
 * the whole of it: "The Hall, 3 waiting".
 *
 * A REAL LANTERN IS NEVER MISTAKEN FOR A PAINTED ONE (the grounds behind the
 * places carry small painted lanterns, the founder, 28 Nov 2026: "We can keep
 * the lanterns"). Three things hold that, each with a test:
 *
 *   1. The real lantern lives on the place's own label: inside the plaque,
 *      with the name. It is never drawn on the land or on the building.
 *   2. It has exactly two states, lit and dark. A place under scaffolding has
 *      no lantern at all.
 *   3. Its state is said in words: lit is in the place's name ("3 waiting"),
 *      dark is in its description ("Nothing waiting."). A screen reader never
 *      has to see the light.
 */
import { useId, useState } from "react";
import { Link } from "wouter";
import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { GARDEN_SPRITE_HEIGHT, GARDEN_SPRITE_WIDTHS, gardenSpriteUrl } from "@shared/gardenArt";
import type { GardenLens } from "./lens";
import { usePlaceNames } from "./placeNames";
import { GARDEN_PLACES, type GardenPlaceKey } from "./places";
import "./garden.css";

export interface LanternProps {
  /** Lit: something waits here. Dark: it is quiet. */
  lit: boolean;
  /** Words for a lantern that stands alone (a legend). Without them it is decoration beside words that already say it. */
  label?: string;
  className?: string;
}

export function Lantern({ lit, label, className = "" }: LanternProps) {
  return <span className={`gd-lantern ${className}`.trim()} data-lit={lit ? "true" : "false"} {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} />;
}

export interface PlaceProps {
  /** Which of the ten places. */
  place: GardenPlaceKey;
  /** The name to show. Left out, it is the person's own name for the place, then the village's, then the platform's. */
  name?: string;
  /** "grounds": the painted building over its plaque. "desk": a compact row. */
  lens?: GardenLens;
  /** How many things wait here. Above zero lights the lantern. */
  waiting?: number;
  /** One line in the caller's own words. Left out, the place says what it holds. */
  note?: string;
  /** Not built yet: the building under scaffolding, and no lantern. */
  scaffolding?: boolean;
  /** Where the place leads. Given, the place is a link. */
  href?: string;
  /** What opening the place does. Given without `href`, the place is a button. */
  onOpen?: () => void;
  /** The place the person is in now. */
  current?: boolean;
  className?: string;
}

export default function Place({ place, name, lens = "grounds", waiting = 0, note, scaffolding = false, href, onOpen, current = false, className = "" }: PlaceProps) {
  const { t, i18n } = useLingui();
  const names = usePlaceNames();
  const detailId = useId();
  const lanternId = useId();
  const [missingArt, setMissingArt] = useState<string | null>(null);

  const shown = name ?? names.nameOf(place);
  const count = scaffolding || !Number.isFinite(waiting) ? 0 : Math.max(0, Math.floor(waiting));
  const lit = count > 0;
  const detail = note ?? i18n._(GARDEN_PLACES[place].holds);
  const waitingWords = lit ? t({ message: plural(count, { one: "# waiting", other: "# waiting" }), context: "garden place, things waiting" }) : "";
  const label = scaffolding
    ? t({ message: `${shown}, not built yet`, context: "garden place, its name read aloud" })
    : lit
      ? t({ message: `${shown}, ${plural(count, { one: "# waiting", other: "# waiting" })}`, context: "garden place, its name read aloud" })
      : shown;

  // A lantern that is there and not lit. Lit is already in the name ("3 waiting"); dark is said in the description.
  const dark = !scaffolding && !lit;

  // The second line is the detail when the first is taken by the count or the scaffolding; the Desk has room for it always, the Grounds only for the caller's own words.
  const firstIsDetail = dark;
  const showSecond = !firstIsDetail && (note !== undefined || lens === "desk");

  const src = gardenSpriteUrl(place, scaffolding);
  const width = GARDEN_SPRITE_WIDTHS[place][scaffolding ? "scaffold" : "built"];

  const inner = (
    <>
      {missingArt === src ? null : (
        <img className="gd-sprite" src={src} alt="" width={width} height={GARDEN_SPRITE_HEIGHT} loading="lazy" decoding="async" draggable={false} onError={() => setMissingArt(src)} />
      )}
      <span className="gd-plaque">
        <span className="gd-place-name font-display text-base">{shown}</span>
        <span className="gd-place-line text-xs">
          {scaffolding ? null : <Lantern lit={lit} />}
          {scaffolding ? <Trans context="garden place">Not built yet</Trans> : lit ? <span>{waitingWords}</span> : <span id={detailId}>{detail}</span>}
        </span>
        {showSecond ? (
          <span id={detailId} className="block text-xs text-muted-foreground">
            {detail}
          </span>
        ) : firstIsDetail ? null : (
          // The plaque on the Grounds has room for one line, and the count or the scaffolding took it. What the place
          // holds is still said: a screen reader hears it as the place's description.
          <span id={detailId} className="sr-only">
            {detail}
          </span>
        )}
        {dark ? (
          // Hidden from sight and from the reading order, and still what the description points at: a dark lantern, in words.
          <span id={lanternId} hidden>
            <Trans context="garden place, its lantern is dark">Nothing waiting.</Trans>
          </span>
        ) : null}
      </span>
    </>
  );

  const shared = {
    className: `gd-place ${className}`.trim(),
    "data-place": place,
    "data-lens": lens,
    "data-lit": lit ? "true" : "false",
    "data-scaffolding": scaffolding ? "true" : "false",
    "aria-label": label,
    "aria-describedby": dark ? `${detailId} ${lanternId}` : detailId,
    "aria-current": current ? ("page" as const) : undefined,
  };

  if (href) {
    return (
      <Link href={href} {...shared}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onOpen} disabled={!onOpen} {...shared}>
      {inner}
    </button>
  );
}
