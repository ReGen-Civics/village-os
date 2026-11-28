/**
 * THE WAY ON FROM AN ADDRESS THAT HAS NO PAGE (the helpful not-found page, wayfinding lane, 27 Nov 2026).
 *
 * The real pages nearest the address the reader typed or followed, by name, each with the menu group it lives in
 * (lib/nearestPages.ts does the matching), and a way to search. Only pages the reader's own menu would draw are
 * offered (lib/menuVisible.ts), so a module that is off, a role they do not hold or a member's area shown to a
 * newcomer never appears here.
 *
 * Search: a button that opens Find anything (the search lane) by an event, drawn only once that dialog says it is
 * listening (SearchLink below).
 */
import { Component, useEffect, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { Link, useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { BTN_SECONDARY, DOOR, EYEBROW, HINT } from "@/components/journey/look";
import { nearestPages } from "@/lib/nearestPages";
import { useMenuVisible } from "@/lib/menuVisible";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { usePlaceLine } from "@/lib/placeLine";

/** The suggestions are a kindness on a page that must never fail: if they cannot be worked out, the page goes on without them. */
class WithoutIfBroken extends Component<{ children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  render() {
    return this.state.broken ? null : this.props.children;
  }
}

/**
 * Drawn only inside the app's providers. Outside them (a page test, a crash screen) nobody can say what the reader may
 * open, so nothing is offered: the door home and search still are.
 */
export function NearestPageList() {
  return useOptionalAuth() ? (
    <WithoutIfBroken>
      <NearestList />
    </WithoutIfBroken>
  ) : null;
}

function NearestList() {
  const { t } = useLingui();
  const [location] = useLocation();
  const { visible, label, place, signedIn } = useMenuVisible();
  const placeLine = usePlaceLine(place);
  const near = nearestPages(location, { visible, label, signedIn });
  if (!near.length) return null;
  return (
    <nav aria-labelledby="nearest-pages-title" className="w-full max-w-md" data-testid="nearest-pages">
      {/* The menu bar's gold kicker (NavDropdown's eyebrow, look.ts EYEBROW), in the body face as it is there: every h2 takes
          the display face by default (index.css). */}
      <h2 id="nearest-pages-title" className={`${EYEBROW} font-body`}>
        {t({ message: "Perhaps you were looking for", context: "404 page: the nearest real pages" })}
      </h2>
      <ul className="mt-2 space-y-2 sm:mt-3">
        {near.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className={DOOR} data-nearest={p.href}>
              <span className="flex min-w-0 flex-col text-left">
                <span className="truncate">{label(p.link)}</span>
                {/* One line on a phone, so three suggestions keep the gold door on the first screen (QA round 2). */}
                <span className={`${HINT} font-normal max-sm:truncate`} title={placeLine(p.places)}>
                  {placeLine(p.places)}
                </span>
              </span>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-notice" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * FIND ANYTHING, opened by an event so this page never imports the dialog. THE SEARCH LANE OWNS THE OTHER SIDE
 * (client/src/components/search/: `openFindAnything()` and `useFindAnythingReady()`); this branch does not have those
 * files, so this is a tiny local copy of the same contract, by its names:
 *   - opening: `window.dispatchEvent(new Event("village:find-anything"))`;
 *   - listening: `window.__findAnythingReady` is true only while search is mounted, and it dispatches
 *     "village:find-anything-ready" whenever that changes, so a page drawn before or after it knows.
 * Until search says it is there, the button is not drawn: a search button that opens nothing is worse than none.
 */
export const FIND_ANYTHING_EVENT = "village:find-anything";
export const FIND_ANYTHING_READY_EVENT = "village:find-anything-ready";
export const FIND_ANYTHING_READY = "__findAnythingReady";

const findAnythingReady = () => typeof window !== "undefined" && (window as unknown as Record<string, unknown>)[FIND_ANYTHING_READY] === true;

/** The second act beside the door home, while Find anything is there to open. */
export function SearchLink() {
  const { t } = useLingui();
  const [ready, setReady] = useState(findAnythingReady);
  useEffect(() => {
    const heard = () => setReady(findAnythingReady());
    window.addEventListener(FIND_ANYTHING_READY_EVENT, heard);
    heard();
    return () => window.removeEventListener(FIND_ANYTHING_READY_EVENT, heard);
  }, []);
  if (!ready) return null;
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(FIND_ANYTHING_EVENT))} className={BTN_SECONDARY} data-testid="search-link">
      {t({ message: "Search the village", context: "404 page: a link to search" })}
    </button>
  );
}
