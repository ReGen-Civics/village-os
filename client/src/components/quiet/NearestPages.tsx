/**
 * THE WAY ON FROM AN ADDRESS THAT HAS NO PAGE (the helpful not-found page, wayfinding lane, 27 Nov 2026).
 *
 * The real pages nearest the address the reader typed or followed, by name, each with the menu group it lives in
 * (lib/nearestPages.ts does the matching), and a way to search. Only pages the reader's own menu would draw are
 * offered (lib/menuVisible.ts), so a module that is off, a role they do not hold or a member's area shown to a
 * newcomer never appears here.
 *
 * Search: the Find anything lane is building one. Until the coordinator says how to open it, this link goes home,
 * and FIND_ANYTHING_HREF is the one place to change.
 */
import { Component, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { Link, useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { BTN_SECONDARY, DOOR, HINT } from "@/components/journey/look";
import { nearestPages } from "@/lib/nearestPages";
import { useMenuVisible } from "@/lib/menuVisible";
import { useOptionalAuth } from "@/contexts/AuthContext";

/** Where "Search the village" goes until the search lane's way to open it is known. */
export const FIND_ANYTHING_HREF = "/";

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
  const { visible, label, place } = useMenuVisible();
  const near = nearestPages(location, { visible, label });
  if (!near.length) return null;
  return (
    <nav aria-labelledby="nearest-pages-title" className="w-full max-w-md" data-testid="nearest-pages">
      <h2 id="nearest-pages-title" className="text-sm font-semibold text-foreground">
        {t({ message: "Perhaps you were looking for", context: "404 page: the nearest real pages" })}
      </h2>
      <ul className="mt-3 space-y-2">
        {near.map((p) => {
          const where = p.places
            .map((at) => [at.group ? place(at.group) : t({ message: "Your account", context: "404 page: where a page sits in the menu" }), at.folder ? place(at.folder) : null].filter(Boolean).join(", "))
            .filter((w, i, all) => all.indexOf(w) === i)
            .join("; ");
          return (
            <li key={p.href}>
              <Link href={p.href} className={DOOR} data-nearest={p.href}>
                <span className="flex min-w-0 flex-col text-left">
                  <span className="truncate">{label(p.link)}</span>
                  <span className={`${HINT} truncate font-normal`}>{t({ message: `In ${where}`, context: "404 page: the menu group a suggested page lives in" })}</span>
                </span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-notice" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The second act beside the door home. */
export function SearchLink() {
  const { t } = useLingui();
  return (
    <Link href={FIND_ANYTHING_HREF} className={BTN_SECONDARY} data-testid="search-link">
      {t({ message: "Search the village", context: "404 page: a link to search" })}
    </Link>
  );
}
