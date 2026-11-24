/**
 * MobileTabBar: five-slot bottom nav, mobile only.
 *
 * Slots come from config/mobileNav.ts. The last one dispatches
 * "open-mobile-menu", which Layout listens for and opens the existing header
 * drawer, so there is one nav menu in the app rather than two that drift apart.
 *
 * Ported from regen-civics. Two details from that implementation are carried
 * over deliberately because both were bug fixes, not decoration:
 *
 *  - It portals to <body>. A `position: fixed` element is positioned against
 *    the nearest ancestor that has a transform, filter, backdrop-filter or
 *    contain, not against the viewport. Any of those on a parent silently turns
 *    this bar into an absolutely-positioned strip floating mid-page.
 *  - It pads for env(safe-area-inset-bottom) so the bar clears the iOS home
 *    indicator.
 */
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { BARE_ROUTES, NEWCOMER_SLOT, NEWCOMER_SWAPPED_TABS, TAB_SLOTS, type TabSlot } from "@/config/mobileNav";
import { NAV, ACCOUNT_MENU, isGroup, type NavLink } from "@/config/nav";
import { Compass } from "lucide-react";
import { useVillageMenu } from "@/hooks/useVillageMenu";
import { moduleIsOn, useModules } from "@/modules/ModuleProvider";
import { useTokenName } from "@/hooks/useTokenNames";
import { useLingui } from "@lingui/react/macro";
import { useNewcomerShows } from "@/lib/newcomer";
import { authToken } from "@/lib/gameApi";
import { routeIcon } from "@/config/routeIcons";
import { useEffect, useState } from "react";

/** The current route with query and trailing slash removed. */
export function normalisePath(location: string): string {
  return location.split("?")[0].replace(/\/$/, "") || "/";
}

/** True where the bottom bar and the FAB are suppressed (config/mobileNav.ts). */
export function isBareRoute(location: string): boolean {
  return BARE_ROUTES.includes(normalisePath(location));
}

/** Every menu entry, by address, so a chosen tab finds its label and its gate. */
const ENTRY_BY_HREF: ReadonlyMap<string, NavLink> = new Map(
  [...NAV.flatMap((e) => (isGroup(e) ? e.items : [e])), ...ACCOUNT_MENU].map((l) => [l.href, l] as const),
);

/**
 * The five slots: the village's four chosen tabs, each in its place, then More.
 * A chosen address that is no menu entry, is hidden, or whose module is off
 * keeps the platform's slot there. No choice at all is the platform's bar.
 */
export function villageSlots(tabs: readonly string[], labels: Readonly<Record<string, string>>, hidden: readonly string[], open: (module?: string) => boolean): TabSlot[] {
  if (!tabs.length) return TAB_SLOTS;
  const out = TAB_SLOTS.slice();
  tabs.slice(0, 4).forEach((href, i) => {
    const entry = ENTRY_BY_HREF.get(href);
    if (!entry || hidden.includes(href) || !open(entry.module) || (entry.unlessModule && open(entry.unlessModule))) return;
    const platform = TAB_SLOTS.find((s) => s.path === href);
    out[i] = platform ?? { path: href, label: labels[href] || entry.label, Icon: entry.icon ?? Compass, ...(entry.token ? { token: entry.token } : {}) };
  });
  return out;
}

/**
 * THE RESPONSIVE BAR (nav.responsive_bar, shared/navPopularity.ts): the four
 * page places it chose, drawn the way the village's own tabs are (a page whose
 * module is off, or that is hidden, keeps the platform's slot there), with no
 * page twice: a place left empty or doubled takes the next platform tab not on
 * the bar. Each place wears its page's own icon where one is drawn.
 */
export function responsiveSlots(tabs: readonly string[], labels: Readonly<Record<string, string>>, hidden: readonly string[], open: (module?: string) => boolean): TabSlot[] {
  const drawn = villageSlots(tabs, labels, hidden, open).slice(0, 4);
  const out: TabSlot[] = [];
  const taken = new Set<string>();
  for (const s of drawn) {
    if (s.path && !taken.has(s.path)) {
      taken.add(s.path);
      out.push({ ...s, Icon: routeIcon(s.path, s.Icon) });
    }
  }
  for (const s of TAB_SLOTS) {
    if (out.length >= 4) break;
    if (s.path && !taken.has(s.path)) {
      taken.add(s.path);
      out.push(s);
    }
  }
  return [...out, TAB_SLOTS[TAB_SLOTS.length - 1]];
}

/**
 * The responsive bar's places for a signed-in member, asked after the first
 * paint so the first page's scripts stay as they were; null is the village's
 * fixed bar (the setting off, signed out, or the server not answering).
 */
function useResponsiveTabs(path: string): string[] | null {
  const [tabs, setTabs] = useState<string[] | null>(null);
  useEffect(() => {
    const token = authToken();
    if (!token) {
      setTabs(null);
      return;
    }
    let live = true;
    const id = window.setTimeout(() => {
      void import("@/lib/navVisits")
        .then((m) => m.loadBar(token))
        .then((t) => live && setTabs(t))
        .catch(() => undefined);
    }, 800);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [path]);
  return tabs;
}

/**
 * A newcomer's bar (config/nav.ts, `newcomers`): a slot whose page is a member's
 * working area, or an area not in use yet, becomes the roles, once; a second
 * such slot keeps its place only if it is not already on the bar, else it goes
 * to the platform's Home, so the bar always holds five distinct slots.
 */
export function newcomerSlots(slots: readonly TabSlot[], shown: (entry: NavLink) => boolean): TabSlot[] {
  const out: TabSlot[] = [];
  const taken = new Set(slots.map((s) => s.path ?? s.event ?? ""));
  for (const s of slots) {
    const entry = s.path ? ENTRY_BY_HREF.get(s.path) : undefined;
    const swapped = !!s.path && NEWCOMER_SWAPPED_TABS.includes(s.path);
    if (!swapped && (!entry?.newcomers || shown(entry))) {
      out.push(s);
      continue;
    }
    const swap = [NEWCOMER_SLOT, ...TAB_SLOTS].find((c) => c.path && !taken.has(c.path) && !ENTRY_BY_HREF.get(c.path)?.newcomers && !NEWCOMER_SWAPPED_TABS.includes(c.path));
    if (swap?.path) {
      taken.add(swap.path);
      out.push(swap);
    }
  }
  return out;
}

export default function MobileTabBar() {
  const [location] = useLocation();
  const currentPath = normalisePath(location);
  // The token slot reads the village's word for its token; `path` never moves.
  const tokenName = useTokenName("Recognition");
  const { t } = useLingui();
  // The bar speaks the reader's language (go-live pass, M10). Keyed by the
  // slot's fixed path or event, so config/mobileNav.ts keeps its English as
  // the fallback for a slot this list does not know.
  const said: Record<string, string> = {
    "/": t({ message: "Home", context: "bottom tab bar" }),
    "/quests": t({ message: "Quests", context: "bottom tab bar" }),
    "/circles": t({ message: "Circles", context: "bottom tab bar" }),
    "/roles": t({ message: "Roles", context: "bottom tab bar" }),
    "open-mobile-menu": t({ message: "More", context: "bottom tab bar" }),
  };

  // The village's own four tabs (gap G5), each in the place it chose. A tab
  // whose page is not open (its module off, or hidden) keeps the platform's
  // tab in that place, so the bar never offers a door that does not open.
  const menu = useVillageMenu();
  const modules = useModules();
  const { newcomer, shows } = useNewcomerShows();
  const responsive = useResponsiveTabs(currentPath);
  const isOpen = (m?: string) => !m || moduleIsOn(modules, m);
  const chosen = responsive ? responsiveSlots(responsive, menu.labels, menu.hidden, isOpen) : villageSlots(menu.tabs, menu.labels, menu.hidden, isOpen);
  const slots = newcomer ? newcomerSlots(chosen, shows) : chosen;

  // Sign-in and the other focused, signed-out screens render no bar at all.
  // See BARE_ROUTES for why bottom padding could not close this.
  if (isBareRoute(location)) return null;

  const bar = (
    <nav
      data-mobile-tabbar=""
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-teal-band to-teal-deep backdrop-blur-xl border-t border-white/15 shadow-[0_-10px_30px_-12px_rgba(0,0,0,0.45)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label={t({ message: "Bottom navigation", context: "bottom tab bar" })}
    >
      {/* Seafoam accent hairline along the top edge */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-70"
        style={{ background: "linear-gradient(to right, transparent, var(--tone-brand-soft, #7fb8ac), transparent)" }}
      />
      <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] h-16 items-stretch max-w-2xl mx-auto min-w-0">
        {slots.map((s) => {
          const own = s.path ? menu.labels[s.path] : undefined;
          const slot = own ? { ...s, label: own } : s.token ? { ...s, label: tokenName } : { ...s, label: said[s.path ?? s.event ?? ""] ?? s.label };
          const active =
            !!slot.path &&
            (slot.path === "/"
              ? currentPath === "/"
              : currentPath === slot.path || currentPath.startsWith(slot.path + "/"));

          const inner = (
            <>
              <span
                className={`m-shoot pointer-events-none absolute top-0 h-0.5 w-8 rounded-full bg-amber transition-opacity duration-300 ${
                  active ? "opacity-100" : "opacity-0"
                }`}
                data-on={active}
              />
              <div
                className={`relative flex items-center justify-center rounded-2xl transition-all duration-300 ${
                  active ? "px-2.5 py-1 -translate-y-0.5 bg-white/15" : "px-1.5 py-1"
                }`}
              >
                <slot.Icon className="w-[22px] h-[22px]" />
                {/* A bud on the chosen tab (index.css, LIVING MOTION: Root). */}
                <span aria-hidden="true" className="m-bud bg-amber" data-on={active} />
              </div>
              {/* min-w-0 + truncate, because at a 320px viewport the five labels needed
                  325px of min-content and the bar itself became wider than the
                  screen. It is fixed, so it set the document width and every page
                  with it: /profile's entire 5px of overflow was this bar. */}
              {/* 12px, the one size under the 14px floor (M12): five labels share
                  a 320px bar, and at 14px "Gratitude" and its Spanish ran out. */}
              <span className={`text-xs leading-none min-w-0 truncate ${active ? "font-semibold" : "font-medium"}`}>
                {slot.label}
              </span>
            </>
          );

          // Both states are full-opacity text-white, on purpose: white is the
          // ONLY opacity level shared/brandTokens.ts actually guarantees here.
          // "brand" (teal-deep) is derived so white clears AA_BODY (4.5)
          // against it EXACTLY at the floor for the hardest seed (checked:
          // worst case 4.50:1 across all 54 CHARACTER_CARDS x seed
          // combinations), which means ANY dimming below full opacity can
          // drop under 4.5 for some village's colour - even white/90
          // measured as low as 3.80:1 on one. The old white/70 measured
          // 2.66:1 worst case (30 of 54 combinations failed outright), and
          // separately, on the platform's own former literal brand colour
          // (#157f7d, docs/AUDIT_2026-07-30_OPEN_QUESTIONS.md 1.1), white/70
          // measured 3.20:1 - a real, shipped failure, not a hypothetical
          // one. Active vs inactive is carried by the highlight pill
          // (bg-white/15), the translate-y lift and font-weight below
          // instead of by colour.
          const cls = "group relative flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 text-white";

          if (slot.path) {
            return (
              <Link
                key={slot.label}
                href={slot.path}
                aria-label={slot.label}
                aria-current={active ? "page" : undefined}
                className={cls}
              >
                {inner}
              </Link>
            );
          }

          return (
            <button
              key={slot.label}
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(slot.event!))}
              aria-label={slot.label}
              className={cls}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </nav>
  );

  if (typeof document === "undefined") return bar;
  return createPortal(bar, document.body);
}
