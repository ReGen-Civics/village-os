/**
 * THE TWO LENSES' COMPOSITIONS. Both take the same `places`.
 *
 * GROUNDS (lens A): the map is the dashboard. The land is the ground, and each
 * place stands on it where the GARDEN_PLACES table puts it, by percentage, so
 * the map never needs more room than it is given. Where there is no room for a
 * map (a phone), the same places are a plain stacked list: the switch is a
 * container query in garden.css, so it follows the room the Grounds has, not
 * the window.
 *
 * THE LAND (Rye, 27 Nov 2026): each village's own land image where it has one
 * (`landImageUrl`), and a painted default otherwise. The default is painted in
 * garden.css from the garden's own tokens and shows no geography: one
 * village's land is never drawn under another village.
 *
 * COMPACT: the same map, small, for a narrow column: every place on its own
 * spot, each plaque its lantern and its name and nothing more. Ask for it with
 * `compact`; the frame asks for it by itself while the guide's dock is
 * expanded (garden.css), so on a laptop the land is still seen as land beside
 * the conversation. What a plaque no longer shows is still in the place's
 * spoken name ("The Hall, 3 waiting").
 *
 * DESK (lens B): the same places as a dense list.
 *
 * A place the caller leaves out is not drawn: a new village starts as bare
 * land and one fire.
 */
import type { CSSProperties } from "react";
import { useLingui } from "@lingui/react/macro";
import Place from "./Place";
import { GARDEN_PLACES, type GardenPlaceKey } from "./places";
import "./garden.css";

/** One place as the caller knows it today. */
export interface GardenPlaceState {
  /** Which of the ten places. */
  place: GardenPlaceKey;
  /** How many things wait there. Above zero lights its lantern. */
  waiting?: number;
  /** One line in the caller's own words. Left out, the place says what it holds. */
  note?: string;
  /** Not built yet: drawn under scaffolding. */
  scaffolding?: boolean;
  /** Where it leads. Given, the place is a link. */
  href?: string;
  /** What opening it does. Given without `href`, the place is a button. */
  onOpen?: () => void;
}

export interface GroundsProps {
  /** The places to draw, in reading order. */
  places: readonly GardenPlaceState[];
  /** The village's own land image. Left out, the painted default. */
  landImageUrl?: string;
  /** What the map is, for a screen reader. Left out: "The grounds". */
  label?: string;
  /** The small map: each plaque its lantern and its name only. Left out, the frame still asks for it while the dock is expanded. */
  compact?: boolean;
  className?: string;
}

export interface DeskProps {
  /** The places to list, in reading order. */
  places: readonly GardenPlaceState[];
  /** The place the person is in now. */
  current?: GardenPlaceKey;
  /** What the list is, for a screen reader. Left out: "Places". */
  label?: string;
  className?: string;
}

/** A URL as a CSS `url()` value that cannot end its own string. */
export function cssUrl(url: string): string {
  return `url("${url.replace(/["\\\n\r\f]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`)}")`;
}

/** Each place once, the first time the caller names it. */
function once(places: readonly GardenPlaceState[]): GardenPlaceState[] {
  const seen = new Set<GardenPlaceKey>();
  return places.filter((p) => (seen.has(p.place) ? false : (seen.add(p.place), true)));
}

/** Where a path meets a place: the middle of its building, a little below its top. */
const foot = (place: GardenPlaceKey) => ({ x: GARDEN_PLACES[place].x, y: GARDEN_PLACES[place].y + 9 });

/** The stepping-stone paths from the fire out to every other place drawn, each bent a little so none is a ruled line. */
export function groundsPaths(places: readonly GardenPlaceKey[]): string[] {
  if (!places.includes("fire")) return [];
  const from = foot("fire");
  return places
    .filter((p) => p !== "fire")
    .map((p) => {
      const to = foot(p);
      const bend = (to.x - from.x) * 0.12;
      const cx = (from.x + to.x) / 2 - (to.y - from.y) * 0.12;
      const cy = (from.y + to.y) / 2 + bend;
      return `M${from.x} ${from.y}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x} ${to.y}`;
    });
}

export function Grounds({ places, landImageUrl, label, compact = false, className = "" }: GroundsProps) {
  const { t } = useLingui();
  const shown = once(places);
  const land = landImageUrl ? ({ "--gd-land-image": cssUrl(landImageUrl) } as CSSProperties) : undefined;
  return (
    <nav aria-label={label ?? t({ message: "The grounds", context: "garden lens" })} className={`gd-grounds ${className}`.trim()} data-compact={compact ? "true" : undefined}>
      <div className="gd-land rounded-2xl" data-land={landImageUrl ? "own" : "painted"} style={land}>
        <svg className="gd-paths" aria-hidden="true" focusable="false" viewBox="0 0 100 100" preserveAspectRatio="none">
          {groundsPaths(shown.map((p) => p.place)).map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
        <ul className="gd-places">
          {shown.map((p) => {
            const spot = GARDEN_PLACES[p.place];
            return (
              <li key={p.place} style={{ "--gd-x": spot.x, "--gd-y": spot.y, "--gd-w": spot.w } as CSSProperties}>
                <Place lens="grounds" {...p} />
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export function Desk({ places, current, label, className = "" }: DeskProps) {
  const { t } = useLingui();
  return (
    <nav aria-label={label ?? t({ message: "Places", context: "garden desk" })} className={`gd-panel rounded-2xl p-2 ${className}`.trim()}>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {once(places).map((p) => (
          <li key={p.place}>
            <Place lens="desk" current={current === p.place} {...p} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
