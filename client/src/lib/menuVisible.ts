/**
 * THE MENU'S OWN TEST, for a surface that is not the menu (the helpful not-found page, wayfinding lane).
 *
 * A page that suggests where to go must suggest only what the reader may open, and the menu already knows that
 * exactly: a link shows when the village has not hidden it, the front door lets this reader through
 * (`newcomers`), its module is on (or, for `unlessModule`, off), its story page is served, the reader holds one of
 * its `roles`, the sign-in state matches, and a treasury door is open to them. This is that test, read from the same
 * hooks Layout.tsx reads, so a suggestion and the menu agree. The names come the same way too: the village's own
 * name for an entry, its token's word, its story page's name, or the platform word in the reader's language.
 *
 * Layout.tsx still writes the same predicate inline (the menu lane owns that file); moving it onto this hook is a
 * follow-up for that lane, so the two cannot drift.
 */
import { useLingui } from "@lingui/react/macro";
import { useAuth } from "@/contexts/AuthContext";
import { useModules } from "@/modules/ModuleProvider";
import { anyTreasuryDoor, useTreasuryDoors } from "@/components/treasury/useTreasuryDoors";
import { useGameConfig } from "@/lib/gameApi";
import { navWord, platformWords, type NavLink } from "@/config/nav";
import { useVillageMenu } from "@/hooks/useVillageMenu";
import { useSiteMenuWords } from "@/hooks/useSiteMenuWords";
import { useTokenName } from "@/hooks/useTokenNames";
import { storyPageShown } from "@/lib/brochure";
import { useNewcomerShows } from "@/lib/newcomer";

export interface MenuView {
  /** True when this reader's menu would draw the link. */
  visible: (link: NavLink) => boolean;
  /** The link's name as this reader's menu draws it. */
  label: (link: NavLink) => string;
  /** A group's or a folder's name as this reader's menu draws it. */
  place: (platformLabel: string) => string;
  /** Someone is signed in, so the account menu is drawn for them. */
  signedIn: boolean;
}

export function useMenuVisible(): MenuView {
  const { user, token } = useAuth();
  const { i18n } = useLingui();
  const cfg = useGameConfig();
  const { modules } = useModules();
  const moduleOn = (id?: string) => !id || modules.some((m) => m.id === id);
  const role = user?.role;
  const treasuryOpen = anyTreasuryDoor(useTreasuryDoors(user ? token : null));
  const menu = useVillageMenu();
  const siteMenu = useSiteMenuWords(cfg?.site?.menu, cfg?.paths);
  const tokenName = useTokenName("Recognition");
  const { shows: forNewcomer } = useNewcomerShows();
  const visible = (item: NavLink) =>
    !menu.hidden.includes(item.href) &&
    forNewcomer(item) &&
    moduleOn(item.module) &&
    (!item.unlessModule || !moduleOn(item.unlessModule)) &&
    (!item.brochure || storyPageShown(cfg, item.story ?? item.href)) &&
    (!item.roles || (!!role && item.roles.includes(role))) &&
    (item.signedIn === undefined || item.signedIn === !!user) &&
    (!item.door || (item.door === "treasury" && !!user && treasuryOpen));
  const label = (link: NavLink) => {
    const own = menu.labels[link.href];
    if (own) return own;
    if (link.token) return tokenName;
    const named = link.brochure ? siteMenu?.[link.story ?? link.href] : undefined;
    return platformWords(link, i18n, named?.subtitle, named?.label).label;
  };
  const place = (platformLabel: string) => menu.groups[platformLabel] || navWord(platformLabel, i18n);
  return { visible, label, place, signedIn: !!user };
}
