/**
 * THE PHONE'S FIVE TABS: Today, My work, My roles, My treasury, Sheet (approved
 * design, 2026-10-30; renamed in the menu's round 2, 27 Nov 2026, so the member's
 * own tabs never read as the village's Quests, Roles and Treasury pages, which the
 * site menu and the bottom bar carry under those names). The ids stay, so every
 * /profile#anchor still opens its tab.
 *
 * On a phone the sheet is five short pages instead of one long one. Every
 * section stays in the document, in the desktop order, and a section that
 * belongs to another tab is hidden below the `sm` breakpoint only
 * (`phoneTab`), so a desktop reader sees the whole sheet and nothing moves.
 *
 * THE STRIP SITS AT THE TOP, NOT THE BOTTOM. The design drew it along the
 * bottom edge, and on this app the bottom edge already belongs to the site's
 * own tab bar and its floating button (Layout: MobileTabBar, MobileFab), which
 * every page carries. A second bar there would cover the first. It is sticky
 * under the site header instead, which keeps the same five doors one tap away
 * from anywhere on the page.
 */
import { useEffect, useId } from "react";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

export const PROFILE_TABS = ["today", "quests", "roles", "treasury", "sheet"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

const LABEL: Record<ProfileTab, MessageDescriptor> = {
  today: msg({ message: "Today", context: "ProfileTabs: the member's own tab" }),
  quests: msg({ message: "My work", context: "ProfileTabs: the member's own tab, their quests, tasks and asks" }),
  roles: msg({ message: "My roles", context: "ProfileTabs: the member's own tab" }),
  treasury: msg({ message: "My treasury", context: "ProfileTabs: the member's own tab, what they hold" }),
  sheet: msg({ message: "Sheet", context: "ProfileTabs: the member's own tab, about them" }),
};

/** The class a section takes so it shows on its own phone tab and always on a desktop. */
export const phoneTab = (active: ProfileTab, mine: ProfileTab | readonly ProfileTab[]): string =>
  (Array.isArray(mine) ? mine.includes(active) : mine === active) ? "" : "max-sm:hidden";

/** Which tab an anchor in the address lives on, so /profile#cash-owed opens Treasury on a phone. */
export const TAB_OF_ANCHOR: Record<string, ProfileTab> = {
  "my-tasks": "quests",
  "your-quests": "quests",
  companions: "quests",
  treasury: "treasury",
  "cash-owed": "treasury",
  wallet: "treasury",
  ledger: "treasury",
  redeem: "treasury",
  ventures: "treasury",
  "venture-redemptions": "treasury",
  "send-tokens": "treasury",
  "my-needs": "sheet",
  "sheet-paths": "sheet",
  about: "sheet",
  invite: "sheet",
  "map-light": "sheet",
  roles: "roles",
  // The role cards (MyRoleCards): the section, and each role by `#role-<id>` (tabOfAnchor below).
  "sheet-roles": "roles",
  // The path's own doors (shared/yourPath.ts): each opens the tab its section lives on.
  "your-path": "today",
  "before-you-start": "today",
  onboarding: "today",
  "my-moon": "roles",
};

/** The tab an anchor opens: the table above, a path's card on the Sheet, a role's card on My roles. */
export function tabOfAnchor(hash: string): ProfileTab | undefined {
  return TAB_OF_ANCHOR[hash] ?? (hash.startsWith("path-") ? "sheet" : hash.startsWith("role-") ? "roles" : undefined);
}

/**
 * Bring the anchor into view once its tab shows it, and keep it there while the page fills in.
 *
 * A section on another phone tab is `display: none` until the tab opens, and the reads above it land
 * one by one after the jump, some seconds apart (QA round 2: on a desktop, /profile#my-moon ended 6,900px
 * off once the cards above it arrived). So this scrolls as soon as the target is drawn, and again each
 * time something above pushes it, for up to `withinMs`. A pause between reads proves nothing, so it does
 * not stop on one. The target's own scroll-margin (the sheet sets one under its sticky bars) decides
 * where it lands.
 *
 * THE READER ALWAYS WINS (QA round 3). It lets go the moment the reader takes the page: a wheel, a touch,
 * a key or a press (never one inside a dialog: closing the level-up moment with Escape is not a scroll),
 * or a scroll it did not make, before its first placement as well as after. On `arrival` (the page
 * opening on the hash, not a jump made on the page) a page already scrolled with nothing drawn yet means
 * the reader got there first: it does not follow at all.
 *
 * COMING BACK IS NOT ARRIVING (QA round 4). On a reload or a Back (`back`), the page's early moves are
 * the browser's, never the reader's, so they stop nothing; with the reader's saved place (`offset`, from
 * savePlace) it puts them back beside the anchor exactly where they were, and without one, onto it.
 *
 * Returns a stop, for a newer jump to cancel an older one.
 */
export function scrollWhenShown(
  id: string,
  {
    withinMs = 10000,
    stepMs = 100,
    arrival = false,
    offset,
    back = false,
    onDone,
  }: { withinMs?: number; stepMs?: number; arrival?: boolean; offset?: number; back?: boolean; onDone?: () => void } = {},
): () => void {
  const started = Date.now();
  const startY = window.scrollY;
  // Coming back (a reload, a Back, a saved place): the page's first moves are the browser putting the
  // reader back, never the reader, so they neither stop the follow nor keep it from starting. With a
  // saved place the reader goes back to it; without one, onto the anchor.
  const returning = back || offset !== undefined;
  const toPlace = offset !== undefined;
  let last: number | null = null;
  let placedAt: number | null = null;
  let timer = 0;
  let done = false;
  const drawn = () => {
    const el = document.getElementById(id);
    return el && el.getClientRects().length > 0 ? el : null;
  };
  if (arrival && !returning && startY > 2 && !drawn()) {
    onDone?.();
    return () => undefined;
  }
  const LET_GO = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  // The page keeps the reader's place itself (savePlace), so the browser's own restore is held off for
  // this entry: left on, it put a reloaded reader back late and wrong, after the follow had placed them.
  // ProfileTabs hands it back as the profile goes, so other pages keep theirs.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  // The browser's scroll anchoring is held off while this follows: it keeps the page on whatever it picks
  // as content lands, and once picked a node 5,600px below My moon (QA round 4), a move this then took
  // for the reader's. The follow is doing that job for the one node that matters.
  const root = document.documentElement;
  const anchoring = root.style.overflowAnchor;
  root.style.overflowAnchor = "none";
  const stop = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    root.style.overflowAnchor = anchoring;
    LET_GO.forEach((e) => window.removeEventListener(e, onInput));
    onDone?.();
  };
  const onInput = (e: Event) => {
    // A press or a key inside a dialog is about the dialog (Escape closing the level-up moment).
    if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return;
    stop();
  };
  LET_GO.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
  /** Where on the screen the target belongs: the reader's own place when coming back, else its scroll margin. */
  const wanted = (el: Element) => (toPlace ? -(offset as number) : parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
  const tick = () => {
    if (done) return;
    // Before the first placement, any move of the page is the reader's: none of it is ours yet.
    if (!returning && placedAt === null && Math.abs(window.scrollY - startY) > 2) {
      stop();
      return;
    }
    const el = drawn();
    if (el) {
      const top = el.getBoundingClientRect().top;
      const at = top + window.scrollY;
      const moved = last === null || Math.abs(at - last) >= 1;
      if (!moved && placedAt !== null && Math.abs(window.scrollY - placedAt) > 2) {
        // Somebody else put it exactly where it belongs (the page's own instant scroll): that is a placement.
        if (Math.abs(top - wanted(el)) <= 2) placedAt = window.scrollY;
        else {
          // The target held still and the page moved anyway: the reader scrolled it (a scrollbar drag fires none of the events above).
          stop();
          return;
        }
      }
      if (moved) {
        // Instant: the sheet scrolls smoothly, and a glide would still be moving at the next check.
        if (toPlace) window.scrollTo({ top: at + (offset as number), behavior: "instant" as ScrollBehavior });
        else el.scrollIntoView?.({ block: "start", behavior: "instant" as ScrollBehavior });
        last = at;
        placedAt = window.scrollY;
      }
    }
    if (Date.now() - started >= withinMs) {
      stop();
      return;
    }
    timer = window.setTimeout(tick, stepMs);
  };
  tick();
  return stop;
}

/**
 * THE READER'S PLACE, KEPT FOR A RELOAD OR A BACK (QA round 4: pull-to-refresh on #my-moon came back
 * 5,500px off). The page keeps, in its own history entry, where the reader sits relative to the anchor
 * the address names, so coming back puts them there again however the reads above it land.
 */
export const PLACE_KEY = "profileAnchorPlace";

export function savedPlace(id: string, state: unknown = history.state): number | undefined {
  const place = state && typeof state === "object" ? (state as Record<string, unknown>)[PLACE_KEY] : null;
  if (!place || typeof place !== "object") return undefined;
  const p = place as { id?: unknown; offset?: unknown };
  return p.id === id && typeof p.offset === "number" && Number.isFinite(p.offset) ? p.offset : undefined;
}

export function savePlace(id: string): void {
  const el = document.getElementById(id);
  if (!el || el.getClientRects().length === 0) return;
  try {
    const state = history.state && typeof history.state === "object" ? history.state : {};
    history.replaceState({ ...state, [PLACE_KEY]: { id, offset: Math.round(-el.getBoundingClientRect().top) } }, "");
  } catch {
    /* a browser that refuses the write keeps the old place; the next arrival still lands on the anchor */
  }
}

/** This very address was loaded by a reload, or a Back or Forward: the reader is coming back, not arriving. */
export function cameBack(): boolean {
  try {
    const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
    return (nav?.type === "reload" || nav?.type === "back_forward") && nav.name === window.location.href;
  } catch {
    return false;
  }
}

export default function ProfileTabs({ tab, onTab }: { tab: ProfileTab; onTab: (t: ProfileTab) => void }) {
  const { t, i18n } = useLingui();
  const id = useId();
  // A hash that names a section on another tab opens that tab first.
  useEffect(() => {
    let settling: (() => void) | null = null;
    // While a follow runs the page is ours, not the reader's: a scroll then is no place of theirs to keep.
    let following = false;
    // The first call is the page opening on its hash; every later one is a jump made on the page.
    let arrival = true;
    const go = () => {
      const first = arrival;
      arrival = false;
      const hash = window.location.hash.replace(/^#/, "");
      // A path's own card (/profile#path-<id>, the bar's path slot) lives on the Sheet.
      const t = tabOfAnchor(hash);
      if (!t) return;
      onTab(t);
      settling?.();
      const target = decodeURIComponent(hash);
      // Coming back to the page (its own saved place, or a reload or Back with none) follows like an arrival
      // that nobody scrolled first: the scroll the browser restores is not the reader's.
      const place = first ? savedPlace(target) : undefined;
      const back = first && cameBack();
      following = true;
      settling = scrollWhenShown(target, { arrival: first && !back, offset: place, back, onDone: () => (following = false) });
    };
    go();
    // Keep the reader's place beside the anchor once a scroll settles, and a save still waiting as the page
    // goes. Never a fresh read on the way out: the page measured 48px off then, on a phone (QA round 4).
    let saving = 0;
    const save = () => {
      const target = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (tabOfAnchor(target)) savePlace(target);
    };
    const onScroll = () => {
      window.clearTimeout(saving);
      saving = following ? 0 : window.setTimeout(() => {
        saving = 0;
        save();
      }, 250);
    };
    const onHide = () => {
      if (!saving) return;
      window.clearTimeout(saving);
      saving = 0;
      save();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onHide);
    window.addEventListener("hashchange", go);
    // wouter's own event: tapping the bar's path slot while already on the profile changes only the hash.
    window.addEventListener("pushState", go);
    return () => {
      window.removeEventListener("hashchange", go);
      window.removeEventListener("pushState", go);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onHide);
      // A save still waiting would write into the entry the reader is leaving for.
      window.clearTimeout(saving);
      settling?.();
      // By now the address is the next page's (a link inside the app): it gets the browser's restore back. Always
      // "auto", never what the profile found: on an entry the profile had already taken that was "manual", and
      // handing it on left a reload or Back on every later page at the top (QA round 5).
      if ("scrollRestoration" in history) history.scrollRestoration = "auto";
    };
  }, [onTab]);

  return (
    <nav
      aria-label={t({ message: "Profile sections", context: "ProfileTabs, aria-label" })}
      className="sticky top-24 z-30 -mx-4 mb-4 grid grid-cols-5 border-b border-dash-edge bg-card/95 backdrop-blur sm:hidden"
    >
      {PROFILE_TABS.map((t) => (
        <button
          key={t}
          id={`${id}-${t}`}
          type="button"
          aria-pressed={tab === t}
          onClick={() => {
            onTab(t);
            window.scrollTo({ top: 0 });
          }}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs ${tab === t ? "font-semibold text-dash-gold-lit" : "font-medium text-muted-foreground"}`}
        >
          <span aria-hidden="true" className={`h-1 w-7 rounded-sm ${tab === t ? "bg-dash-gold" : "bg-transparent"}`} />
          <span>{i18n._(LABEL[t])}</span>
        </button>
      ))}
    </nav>
  );
}
