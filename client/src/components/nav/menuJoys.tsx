/**
 * SMALL JOYS IN THE MENU (27 Nov 2026, the lead: "and small joys. Do these as well"). Calm, and none of their motion
 * under reduced motion. A LAZY CHUNK: the shell holds only the two small doors below (`SeasonMark`, `Firefly`,
 * `FireflyPicker`, which load this file when there is something to draw), so the first page carries none of it.
 *
 *   season   a small ring before each menu eyebrow in the colour of the village's OWN season (useSeason, the one
 *            cached read every season surface shares), named for a screen reader. No season running: nothing. A ring,
 *            never a filled dot, so it is never mistaken for the gold "you are here" dot.
 *   firefly  one firefly beside ONE entry new since the member last looked at the menu. The menu remembers, on this
 *            device only, the entries it has shown; on the very first look it remembers them all and shows none. It is
 *            chosen only once the modules, the config, the sign-in and the newcomer answer are all in, so a menu still
 *            filling in never reads as new entries. It leaves once its page is opened, or after a fortnight, and its
 *            glow rests after about twenty seconds.
 *   pick     the work of choosing the firefly, run by Layout once everything has loaded.
 */
import { useEffect } from "react";
import { useLingui } from "@lingui/react/macro";
import * as gameApi from "@/lib/gameApi";
import type { SeasonState } from "@/lib/gameApi";

/**
 * The season read, taken once as this chunk loads. A module double that has no `useSeason` (a test's mock of
 * lib/gameApi) gives a menu with no season mark rather than an error inside the menu. The choice is fixed for the life
 * of the page, so the hook order never changes.
 */
const noSeason = (): SeasonState | null => null;
const useVillageSeason: () => SeasonState | null = (() => {
  try {
    return (gameApi as { useSeason?: () => SeasonState | null }).useSeason ?? noSeason;
  } catch {
    return noSeason;
  }
})();

/** The season's ring colour, from the season itself: the same season keeps the same colour all through it. */
export function seasonRing(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SEASON_RINGS[h % SEASON_RINGS.length]!;
}
/** Palette inks for the ring: never the bar's brand ink, never the gold of the "you are here" dot. */
export const SEASON_RINGS = ["border-open", "border-coral"] as const;

function Season({ hang }: { hang: boolean }) {
  const { t } = useLingui();
  const season = useVillageSeason();
  const now = season?.current;
  if (!now) return null;
  const name = now.name;
  return (
    <span
      role="img"
      aria-label={t({ message: `Season: ${name}`, context: "the menu: the mark before a heading, the village's season, read aloud" })}
      data-season-mark=""
      className={`${hang ? "-ml-3.5" : ""} mr-2 inline-block size-2 rounded-full border-2 align-middle ${seasonRing(now.id)}`}
    />
  );
}

export const SEEN_KEY = "village-menu-seen";
const FIREFLY_DAYS = 14;

interface Seen {
  hrefs: string[];
  /** When each new entry was first noticed, so its firefly leaves after a fortnight. */
  noticed: Record<string, number>;
}

function readSeen(): Seen | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "null");
    if (raw && Array.isArray(raw.hrefs)) return { hrefs: raw.hrefs, noticed: raw.noticed && typeof raw.noticed === "object" ? raw.noticed : {} };
  } catch {
    /* unreadable or blocked: no firefly */
  }
  return null;
}

function writeSeen(s: Seen): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(s));
  } catch {
    /* refused: no firefly next time either */
  }
}

/**
 * The one entry that wears a firefly, or null. `hrefs` is every entry this reader's menu offers; `here` the page
 * being read (its entry, once opened, is seen). Pure on its inputs and the stored list, so it is tested on its own.
 */
export function chooseFirefly(hrefs: readonly string[], here: string, now: number = Date.now()): string | null {
  const seen = readSeen();
  if (!seen) {
    writeSeen({ hrefs: [...hrefs], noticed: {} });
    return null;
  }
  const known = new Set(seen.hrefs);
  const page = here.split(/[?#]/)[0] || "/";
  const noticed = { ...seen.noticed };
  let pick: string | null = null;
  const done: string[] = [];
  for (const h of hrefs) {
    if (known.has(h)) continue;
    noticed[h] ??= now;
    const opened = (h.split(/[?#]/)[0] || "/") === page;
    const old = now - noticed[h]! > FIREFLY_DAYS * 86_400_000;
    if (opened || old) done.push(h);
    else pick ??= h;
  }
  writeSeen({ hrefs: [...seen.hrefs, ...done], noticed });
  return pick;
}

function Pick({ hrefs, here, onPick }: { hrefs: readonly string[]; here: string; onPick: (href: string | null) => void }) {
  const key = hrefs.join("|");
  useEffect(() => {
    onPick(hrefs.length ? chooseFirefly(hrefs, here) : null);
    // `hrefs` is read through its key: the same entries in a new array are the same question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, here]);
  return null;
}

/** The glow pulses ten times (about twenty seconds) and rests; with reduced motion it never pulses. */
function Glow() {
  return (
    <span
      aria-hidden="true"
      data-firefly=""
      className="ml-2 inline-block size-2 shrink-0 rounded-full bg-notice ring-2 ring-notice/30 motion-safe:animate-pulse"
      style={{ animationIterationCount: 10 }}
    />
  );
}

export type MenuJoyProps =
  | { kind: "season"; hang?: boolean }
  | { kind: "firefly" }
  | { kind: "pick"; hrefs: readonly string[]; here: string; onPick: (href: string | null) => void };

export default function MenuJoy(props: MenuJoyProps) {
  if (props.kind === "season") return <Season hang={props.hang !== false} />;
  if (props.kind === "firefly") return <Glow />;
  return <Pick hrefs={props.hrefs} here={props.here} onPick={props.onPick} />;
}
