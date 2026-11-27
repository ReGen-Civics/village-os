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
 * Bring the anchor into view once its tab shows it. A section on another phone tab is `display: none`
 * until the tab opens, and some (My moon, a role's card) arrive after a read, so the browser's own jump
 * found nothing to land on. This waits, briefly, for the element to be drawn and visible, then scrolls.
 */
export function scrollWhenShown(id: string, tries = 30): void {
  const el = document.getElementById(id);
  if (el && el.getClientRects().length > 0) {
    el.scrollIntoView?.({ block: "start" });
    return;
  }
  if (tries > 0) window.setTimeout(() => scrollWhenShown(id, tries - 1), 100);
}

export default function ProfileTabs({ tab, onTab }: { tab: ProfileTab; onTab: (t: ProfileTab) => void }) {
  const { t, i18n } = useLingui();
  const id = useId();
  // A hash that names a section on another tab opens that tab first.
  useEffect(() => {
    const go = () => {
      const hash = window.location.hash.replace(/^#/, "");
      // A path's own card (/profile#path-<id>, the bar's path slot) lives on the Sheet.
      const t = tabOfAnchor(hash);
      if (!t) return;
      onTab(t);
      scrollWhenShown(decodeURIComponent(hash));
    };
    go();
    window.addEventListener("hashchange", go);
    // wouter's own event: tapping the bar's path slot while already on the profile changes only the hash.
    window.addEventListener("pushState", go);
    return () => {
      window.removeEventListener("hashchange", go);
      window.removeEventListener("pushState", go);
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
