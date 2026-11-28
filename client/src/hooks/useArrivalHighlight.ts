/**
 * ARRIVAL HIGHLIGHT, the one hook (wayfinding lane, 27 Nov 2026). Mounted once, in the router (App.tsx), so every
 * page gets it: when the address lands on an anchor, the section it names glows briefly (lib/arrivalHighlight.ts has
 * the look and the rules).
 *
 * What counts as landing:
 *   - a page opened at a #hash (a link in an email or a notice, a bookmark, a typed address);
 *   - a move inside the app to a page with a hash (the menu's Leaving Well, Treasury desk, Game Mechanics);
 *   - a change of hash on the page: the address bar, Back and Forward, or a link on the page to its own anchor.
 * A tab or a switch that only writes the hash (Places' views, the season's tabs) is not a landing: a press on a link
 * is what lets a same-page move count.
 *
 * The router mounts it through React.lazy (the default export below), so the first page carries only the door and
 * this file arrives just after the first paint, with the work beside it.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import { arrive } from "@/lib/arrivalHighlight";

/** A move to the same place twice within this is one arrival: the router and the history event both report it. */
const SAME_ARRIVAL_MS = 600;
/** A same-page move counts when a link was pressed this recently. */
const LINK_PRESS_MS = 1000;

let last = { key: "", at: 0 };
let linkPressedAt = 0;

/** For tests: forget the last arrival and the last press. */
export function forgetArrival(): void {
  last = { key: "", at: 0 };
  linkPressedAt = 0;
}

function landed(): void {
  const { hash, pathname } = window.location;
  if (hash.length < 2) return;
  const key = pathname + hash;
  const now = Date.now();
  if (key === last.key && now - last.at < SAME_ARRIVAL_MS) return;
  last = { key, at: now };
  arrive(hash, pathname);
}

export function useArrivalHighlight(): void {
  const [location] = useLocation();
  useEffect(landed, [location]);
  useEffect(() => {
    const press = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('a[href*="#"]')) linkPressedAt = Date.now();
    };
    const pushed = () => {
      if (Date.now() - linkPressedAt < LINK_PRESS_MS) landed();
    };
    document.addEventListener("click", press, true);
    window.addEventListener("hashchange", landed);
    window.addEventListener("popstate", landed);
    window.addEventListener("pushState", pushed);
    return () => {
      document.removeEventListener("click", press, true);
      window.removeEventListener("hashchange", landed);
      window.removeEventListener("popstate", landed);
      window.removeEventListener("pushState", pushed);
    };
  }, []);
}

/** The router's one mount (App.tsx), lazy so the first page pays for none of this. */
export default function ArrivalHighlight(): null {
  useArrivalHighlight();
  return null;
}
