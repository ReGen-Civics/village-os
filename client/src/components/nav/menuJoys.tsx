/**
 * SMALL JOYS IN THE MENU (27 Nov 2026, the lead: "and small joys. Do these as well"). Calm, and none of it under
 * reduced motion: each one is drawn with `motion-reduce:hidden`, so a reader who asked for less motion sees the menu
 * exactly as it was.
 *
 *   SeasonMark  a small mark in the season's colour before each menu eyebrow. The season is the quarter of the year
 *               (December to February, and so on), in the palette's own inks. Decorative: hidden from a screen reader.
 *   Firefly     one firefly beside ONE entry that is new since the reader last looked at the menu. The menu
 *               remembers, on this device only, the entries it has shown; on the very first look it remembers them all
 *               and shows none. The firefly leaves once its page is opened, or after a fortnight.
 *
 * The greeting at the top of the phone's More sheet lives in MoreSheet.tsx, beside the sheet it greets.
 */
import { createContext, useContext, useEffect, useState } from "react";

/** The season's ink, by month: the palette's own tokens, so both modes are already measured. */
export function seasonInk(at: Date = new Date()): string {
  const m = at.getMonth();
  if (m === 11 || m <= 1) return "bg-teal-deep";
  if (m <= 4) return "bg-open";
  if (m <= 7) return "bg-notice";
  return "bg-coral";
}

/** `hang`: the mark sits in the gutter before the words, so they keep their edge (the dropdowns, the account menu). */
export function SeasonMark({ hang = true }: { hang?: boolean }) {
  return <span aria-hidden="true" data-season-mark="" className={`${hang ? "-ml-3.5" : ""} mr-2 inline-block size-1.5 rounded-full align-middle motion-reduce:hidden ${seasonInk()}`} />;
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

export const MenuFirefly = createContext<string | null>(null);

/** Layout's half: works out the firefly once per page for the entries this reader is offered. */
export function useFirefly(hrefs: readonly string[], here: string, on: boolean): string | null {
  const key = hrefs.join("|");
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => {
    if (!on || !hrefs.length) return setPick(null);
    setPick(chooseFirefly(hrefs, here));
    // `hrefs` is read through its key: the same entries in a new array are the same question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, here, on]);
  return pick;
}

/** Drawn beside an entry's words: a firefly when this entry is the new one, else nothing. */
export function Firefly({ href }: { href: string }) {
  const pick = useContext(MenuFirefly);
  if (pick !== href) return null;
  return <span aria-hidden="true" data-firefly="" className="ml-2 inline-block size-2 shrink-0 rounded-full bg-notice ring-2 ring-notice/30 motion-safe:animate-pulse motion-reduce:hidden" />;
}
