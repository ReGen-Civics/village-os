import { Link, useLocation } from "wouter";
import { announceMobileMenu } from "@/lib/mobileMenuState";
import { m, AnimatePresence } from "framer-motion";
import { TreePine, Menu, X, User, LogOut, ChevronDown, ExternalLink } from "lucide-react";
import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { LanguagePicker } from "@/i18n/LanguagePicker";
import ThemeSwitch, { useLogoMask } from "@/components/ThemeSwitch";
import { useAuth } from "@/contexts/AuthContext";
import { useModules } from "@/modules/ModuleProvider";
// A member's bell and counts load on their own: a visitor who is not signed in never draws them, so they stay off the first page's scripts (MAX_BOOT_JS_KB).
const NotificationBell = lazy(() => import("@/components/NotificationBell"));
const TaskCountBadge = lazy(() => import("@/components/tasks/TaskCountBadge"));
const MessageCountBadge = lazy(() => import("@/components/messages/MessageCountBadge"));
import { anyTreasuryDoor, useTreasuryDoors } from "@/components/treasury/useTreasuryDoors";
import { altOr, useGameConfig } from "@/lib/gameApi";
import { NAV, ACCOUNT_MENU, isGroup, navMenuId, navWord, platformWords, type NavLink, type NavGroup } from "@/config/nav";
import { useVillageMenu } from "@/hooks/useVillageMenu";
import { useTokenName } from "@/hooks/useTokenNames";
import MobileTabBar, { isBareRoute } from "./mobile/MobileTabBar";
const MobileFab = lazy(() => import("./mobile/MobileFab")); // the corner: companions and help (phone doors v4), fixed, so it arrives after the page and shifts nothing
const MoreSheet = lazy(() => import("./mobile/MoreSheet")); // the phone's one menu, opened by the bar's More (phone doors v4, 25 Nov 2026)
const MemberMoments = lazy(() => import("./MemberMoments")); // nothing on arrival, so off the first page (MemberMoments.tsx)
import NextStepTrail from "./NextStepTrail";
import { SITE_FOOTER_SIGNOFF } from "@shared/pageContent/site";
import { UPSTREAM_SOURCE_URL, servedVillageSourceUrl } from "@shared/sourceUrl";
import { storyPageShown } from "@/lib/brochure";
import { MachineTranslationNote } from "@/i18n/machineTranslation";
import { useNewcomerShows } from "@/lib/newcomer";
import FooterBlurb from "@/components/FooterBlurb";
import MenuIcon from "@/components/nav/MenuIcon";
import VisitorLink, { useVerifiedVisitor } from "@/components/VisitorLink";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();
  const bare = isBareRoute(location);
  const { user, token, logout } = useAuth();
  const visitor = useVerifiedVisitor(!!user); // a visitor with a profile, and no member account
  const { t, i18n } = useLingui();
  // Named, so the catalog reads "Your account, {firstName}" and not "{0}".
  const firstName = user?.name.split(" ")[0] ?? "";
  // The shell's identity — logo, name, outside links, footer copy — comes
  // from the live config, never from literals: this is what makes a fork's
  // shell the fork's without touching a component. While config is loading
  // the logo boxes reserve their height (64px header / 90px footer) so the
  // page never shifts on first paint, and outside links simply don't render.
  const cfg = useGameConfig();
  const logoMask = useLogoMask(cfg?.images?.logo);
  // The footer's sign-off is the village's own words (Admin, Pages, Whole site),
  // served inside the config. Unknown until the config answers.
  const signoff = cfg ? (cfg.site?.footerSignoff ?? SITE_FOOTER_SIGNOFF) : undefined;
  const siteUrl = String(cfg?.project?.siteUrl ?? "").trim();
  const eventsUrl = String(cfg?.project?.eventsUrl ?? "").trim();
  const villageName = String(cfg?.project?.name ?? "").trim();
  const villageSource = servedVillageSourceUrl(cfg?.villageSourceUrl); // https only; "" hides the link (shared/sourceUrl.ts)
  // One subscription for the whole shell instead of thirteen useModule calls.
  // The nav is data now (config/nav.ts), and a list cannot call a hook per row.
  const { modules } = useModules();
  const moduleOn = (id?: string) => !id || modules.some((m) => m.id === id);
  const lifecycleOf = (id?: string) => modules.find((m) => m.id === id)?.lifecycle;

  // A link survives when its module is on AND the viewer holds one of its
  // roles. Both absent means everyone sees it. The role is read once into a
  // local so a signed-out viewer (no user, no role) filters out by the same
  // test rather than a second branch.
  const tokenName = useTokenName("Recognition");
  const role = user?.role;
  // Asked of the gate once per sign-in (GET /api/treasury/doors); unknown or refused shows nothing.
  const treasuryOpen = anyTreasuryDoor(useTreasuryDoors(user ? token : null));
  // The brochure pages are the first village's own story (shared/brochure.ts).
  // A village that does not serve them gets none of their menu entries or
  // footer links, and a page it switched off on its own (Admin, Pages, "Show
  // this page") loses its entry and its link the same way. While the config
  // loads they stay out rather than flash in.
  const storyShown = (href: string) => storyPageShown(cfg, href);
  // The village's own menu (gap G5, shared/menuDoc.ts): a label and a hidden
  // flag per entry, its group names. Gates still decide who sees what.
  const menu = useVillageMenu();
  // The front door (24 Nov 2026): a newcomer is not offered a member's working areas (config/nav.ts, `newcomers`).
  const { shows: forNewcomer, showsHref, newcomer } = useNewcomerShows();
  const visible = (item: NavLink) =>
    !menu.hidden.includes(item.href) &&
    forNewcomer(item) &&
    moduleOn(item.module) &&
    (!item.unlessModule || !moduleOn(item.unlessModule)) &&
    (!item.brochure || storyShown(item.href)) &&
    (!item.roles || (!!role && item.roles.includes(role))) &&
    (item.signedIn === undefined || item.signedIn === !!user) &&
    (!item.door || (item.door === "treasury" && !!user && treasuryOpen));

  // An entry named after a token carries the village's word for it, and its
  // href stays put. Substituted HERE, once, because both the desktop dropdown
  // and the mobile drawer render their items through groupItems.
  const withTokenLabel = (link: NavLink): NavLink => {
    const own = menu.labels[link.href];
    if (own) return { ...link, label: own };
    if (link.token) return { ...link, label: tokenName };
    // A story page carries the village's own name for it (Admin, Pages, Whole site).
    const named = link.brochure ? cfg?.site?.menu?.[link.href] : undefined;
    return named?.label ? { ...link, label: named.label, subtitle: named.subtitle || undefined } : platformWords(link, i18n, named?.subtitle);
  };
  // The footer keeps its own wording for a story page until the village
  // renames that page; the commitment page always follows the village's word.
  const storyName = (href: string) => cfg?.site?.menu?.[href]?.label ?? "";
  const footerName = (href: string, fallback: string) =>
    cfg?.site?.menuChanged?.includes(href) ? storyName(href) || navWord(fallback, i18n) : navWord(fallback, i18n);

  // Groups collapse to nothing when every child is filtered out, so a fork with
  // its optional modules off never renders an empty dropdown.
  const groupItems = (group: NavGroup) => group.items.filter(visible).map(withTokenLabel);
  const navEntries = NAV.filter((e) => (isGroup(e) ? groupItems(e).length > 0 : visible(e))).map((e) =>
    isGroup(e) ? { ...e, label: menu.groups[e.label] || navWord(e.label, i18n) } : withTokenLabel(e),
  );
  const accountItems = ACCOUNT_MENU.filter(visible).map((l) => ({ ...l, label: menu.labels[l.href] || navWord(l.label, i18n) }));

  // Footer-only modules. A gated footer link would be a dead end on a fresh
  // fork, because every one of these pages renders NotFound with its module
  // off and every optional module ships off.
  const commerceModule = moduleOn("commerce");
  const networkModule = moduleOn("network");
  const crowdpoolModule = moduleOn("crowdpool");
  const staysModule = moduleOn("stays");
  const toolsModule = moduleOn("tools");
  const healthModule = moduleOn("health");
  const mapModule = moduleOn("map");

  // A click anywhere else closes the account menu. Without this the only way
  // out was to click the trigger again, and the menu covered the page beneath.
  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [accountOpen]);

  // The bottom tab bar's "More" slot opens this same drawer rather than being a
  // second, separately-maintained menu. No scrolling: the header is sticky, so
  // the drawer is already in view wherever the person is on the page. An earlier
  // version scrolled to the top first and the smooth scroll fought the drawer's
  // height animation, jumping the page a few hundred pixels down instead.
  //
  // More sits at the far end of the page and the drawer opens at the top, so a
  // keyboard user who pressed it was left on More and the next Tab left the
  // page (measured on all 69 routes with the bar). Opening from More now hands
  // focus to the drawer's first item. Escape closes the drawer from anywhere
  // and gives focus to the menu button, the control that owns it.
  const menuButton = useRef<HTMLButtonElement>(null);
  const focusDrawer = useRef(false);
  const focusDrawerIfAsked = () => {
    if (!focusDrawer.current) return;
    const first = document.getElementById("mobile-menu")?.querySelector<HTMLElement>("a[href], button");
    if (!first) return;
    focusDrawer.current = false;
    first.focus();
  };
  useEffect(() => {
    const openMenu = () => {
      focusDrawer.current = true;
      setMobileMenuOpen(true);
      // Covers More pressed while the drawer is already open, when the state
      // does not change and the effect below does not run again.
      requestAnimationFrame(focusDrawerIfAsked);
    };
    window.addEventListener("open-mobile-menu", openMenu);
    return () => window.removeEventListener("open-mobile-menu", openMenu);
  }, []);
  // The bar's More button reads this for its aria-expanded (lib/mobileMenuState.ts).
  useEffect(() => announceMobileMenu(mobileMenuOpen), [mobileMenuOpen]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    focusDrawerIfAsked();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMobileMenuOpen(false);
      setOpenMobileGroup(null);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  return (
    <div className="flex flex-col min-h-screen">
      {/*
       * Skip link. Measured before it existed: 40 to 63 focus stops between the
       * first Tab and the page content, on every route, because the header nav
       * and its dropdowns come first. A keyboard or switch user paid that toll
       * on every navigation.
       *
       * Visually hidden until focused rather than display:none, because a
       * display:none link is not focusable and the skip link would not exist
       * for exactly the people it is for.
       */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-white focus:text-teal-deep focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-deep"
      >
        <Trans context="site header">Skip to content</Trans>
      </a>

      {/* Navigation, inside the page's banner landmark: there was no <header>
          on any route, so a screen reader's landmark list had no banner. The
          header carries the sticky positioning now (a sticky child of a
          header only as tall as itself would scroll away with it). The
          contents keep their indentation so this stays a four-line change. */}
      <header className="sticky top-0 z-50">
      <nav className="bg-teal-deep text-white shadow-lg">
        <div className="container py-4 flex items-center justify-between">
          {/* One anchor, not two. wouter's Link renders the <a> itself, so a
              nested <a> is invalid markup: the browser closes the outer one
              early and leaves an EMPTY focusable link as the first stop in
              the tab order on every page, so a keyboard or screen-reader user
              meets an unnamed link before anything else on the site.

              THE HOME LINK IS NEVER EMPTY, BECAUSE AN EMPTY ONE IS NOT A LINK.

              A village with no uploaded logo used to get a bare 64px spacer
              here. An empty flex child gives the anchor a width of ZERO:
              measured 0px on the live deployment, with a click at the centre
              of the header landing on the surrounding div and never on the
              link. On a phone that left the entire header with no visible
              character in it. Every one of the thirteen deployments starts
              in that state and the one that is live is in it now.

              So the name is the wordmark. It is set in the village's own
              display face, so a village that has chosen a font gets its own
              lettering, and it re-themes with the rest of the shell rather
              than being a second thing to upload.

              The third branch is the one a falsiness check cannot tell apart
              from the second: config still in flight is not the same fact as
              a village with no name. While cfg is null nothing is known yet,
              so the box holds a width as well as its 64px height, and the
              home link stays clickable THROUGH the load instead of only
              after it. */}
          <Link
            href="/"
            aria-label={villageName ? t({ message: `${villageName} home`, context: "Layout, aria-label" }) : t({ message: "Home", context: "Layout, aria-label" })}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            style={{ minHeight: "64px" }}
          >
            {cfg?.images?.logo ? (
              /* `.village-logo`: in light mode index.css repaints the mark in the band's ink, through its own shape as a mask (useLogoMask). */
              <span className="village-logo" {...logoMask}>
                <img src={cfg.images.logo} alt={altOr(cfg.images.logoAlt, villageName || "Village logo")} style={{ height: "64px", width: "auto" }} draggable={false} />
              </span>
            ) : villageName ? (
              /* A flex item of the link above, which is already `items-center`
                 inside a 64px box, so the wordmark sits on the same baseline
                 the logo would have. A long name wraps to two lines, a step
                 smaller on a narrow screen, never pushing the menu off (25 Nov 2026). */
              <span className="font-display text-lg leading-tight min-[360px]:text-xl sm:text-2xl font-semibold tracking-wide text-white line-clamp-2 break-words max-w-[60vw] lg:max-w-[16rem]">
                {villageName}
              </span>
            ) : (
              <span
                aria-hidden="true"
                style={{ height: "64px", width: "7rem", display: "inline-block" }}
              />
            )}
          </Link>

          {/* Desktop Menu.
              Shown from `lg`. The old bar carried seventeen top-level links,
              measured ~1250px, and could only render from `xl`: every viewport
              between 768px and ~1310px got no desktop nav at all, and below xl
              some pages scrolled sideways. Six grouped entries fit in roughly
              half the width. This breakpoint and the mobile button's below are
              a matched pair and must always move together, or some viewport
              gets no navigation at all. */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-6">
            {navEntries.map((entry) =>
              isGroup(entry) ? (
                <NavDropdown
                  key={entry.label}
                  group={entry}
                  items={groupItems(entry)}
                  open={openGroup === entry.label}
                  setOpen={(v) => setOpenGroup(v ? entry.label : null)}
                  lifecycleOf={lifecycleOf}
                />
              ) : (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="inline-flex min-h-6 items-center gap-1.5 text-white hover:underline transition-colors text-sm whitespace-nowrap rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-deep"
                >
                  <MenuIcon href={entry.href} fallback={entry.icon} bare />{entry.label}
                </Link>
              )
            )}

            {/* The language selector (spec i18n US2; mock approved by Rye 2026-11-06). */}
            <ThemeSwitch /><LanguagePicker villageDefault={cfg?.defaultLocale ?? null} />

            {user ? (
              <div className="flex items-center gap-3">
                <Suspense fallback={<span aria-hidden="true" className="inline-block size-9 pointer-coarse:size-11 pointer-coarse:-m-1 max-md:size-11 max-md:-m-1" />}><NotificationBell memberId={user.id} /></Suspense>
                {/* The profile link and sign out used to sit side by side with
                    twelve pixels between them, and sign out was a bare icon
                    with no background of its own: at a glance the arrow read
                    as part of the name pill, so the bar said "Rye→". One stray
                    click ended the session on every device, because
                    tokenVersion is the only revocation lever there is. Sign
                    out now lives inside this menu, under a divider. */}
                <div
                  className="relative"
                  ref={accountRef}
                  onKeyDown={(e) => { if (e.key === "Escape") setAccountOpen(false); }}
                >
                  <button
                    type="button"
                    onClick={() => setAccountOpen((v) => !v)}
                    aria-expanded={accountOpen}
                    aria-haspopup="true"
                    aria-controls="account-menu"
                    // Named for a screen reader at every width, because the
                    // visible name below hides between lg and xl.
                    aria-label={t({ message: `Your account, ${firstName}`, context: "site header" })}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-deep"
                  >
                    <User className="w-4 h-4" />
                    {/* Icon only from lg to xl. Between 1024px and 1280px the
                        bar is at its fullest, and a member's first name was
                        what pushed the village name out of the header (it read
                        "A..." at 1024px with the bell beside it). */}
                    <span className="lg:hidden xl:inline">{user.name.split(" ")[0]}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${accountOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {accountOpen && (
                      <m.div
                        id="account-menu"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full right-0 mt-2 w-52 bg-card border border-border rounded-xl shadow-sm overflow-hidden z-50"
                      >
                        {accountItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-gray-50 transition-colors"
                            onClick={() => setAccountOpen(false)}
                          >
                            <MenuIcon href={item.href} fallback={item.icon} />{item.label}
                            {item.count === "tasks" && <Suspense fallback={null}><TaskCountBadge who={user.id} /></Suspense>}
                            {item.count === "messages" && <Suspense fallback={null}><MessageCountBadge who={user.id} /></Suspense>}
                          </Link>
                        ))}
                        <button
                          type="button"
                          onClick={() => { setAccountOpen(false); logout(); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-coral hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
                          // "Everywhere" is honest, not decorative: tokenVersion
                          // is the only revocation lever, so this ends the
                          // session on every device the member is signed in on.
                          title={t({ message: "Sign out everywhere", context: "site header" })}
                        >
                          <LogOut className="w-4 h-4" />
                          <Trans context="site header">Sign out everywhere</Trans>
                        </button>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : visitor ? <VisitorLink place="header" /> : (
              <Link href="/login" className="flex items-center gap-2 px-3 py-1.5 bg-black/10 hover:bg-black/20 rounded-lg text-sm transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-deep">
                <User className="w-4 h-4" />
                <Trans context="site header">Sign in</Trans>
              </Link>
            )}

            {siteUrl && (
              /* Edged, never gold (D-01): it leaves the app, so it is not the
                 page's main act, and the arrow says it opens elsewhere. */
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 px-3 py-2 border border-white/50 text-white rounded-lg font-medium hover:bg-white/10 transition-colors text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-deep"
              >
                <Trans context="site header">Main Site</Trans>
                <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Mobile Menu Button (bell beside it when signed in) */}
          <div className="lg:hidden flex items-center gap-2 text-white">
            <span className="hidden md:contents"><ThemeSwitch /><LanguagePicker villageDefault={cfg?.defaultLocale ?? null} /></span>
            {user && <Suspense fallback={<span aria-hidden="true" className="inline-block size-9 pointer-coarse:size-11 pointer-coarse:-m-1 max-md:size-11 max-md:-m-1" />}><NotificationBell memberId={user.id} /></Suspense>}
            {/* Icon-only, so it needs a spoken name and a state. Phones use the bar's More instead (MoreSheet). */}
            <button
              ref={menuButton}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? t({ message: "Close menu", context: "site header" }) : t({ message: "Open menu", context: "site header" })}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              className="text-white hidden md:inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg -m-2 focus-visible:outline-2 focus-visible:outline-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <m.div
              id="mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              // bg-teal-band, not bg-teal-deep: this drawer carries the
              // amber accent below as small TEXT, and shared/brandTokens.ts
              // only guarantees that pairing (--tone-sun-on-band vs
              // --tone-brand-band) against band. Checked across all 54
              // CHARACTER_CARDS x seed combinations: sun-on-band against
              // brand (teal-deep) fails 46 of them (worst 2.11:1); against
              // band it holds for all of them (brandTokens.test.ts's own
              // "accent on band" assertion). white text only gets safer on
              // the darker surface (band's own contrast floor for white is
              // 5.36:1 worst case vs brand's 4.50:1), so nothing else in
              // this drawer is put at risk by the change.
              className="max-md:hidden lg:hidden bg-teal-band/95 border-t border-white/10 overflow-hidden"
            >
              <div className="container py-4 space-y-1">
                {navEntries.map((entry) =>
                  isGroup(entry) ? (
                    <div key={entry.label}>
                      <button
                        type="button"
                        onClick={() => setOpenMobileGroup(openMobileGroup === entry.label ? null : entry.label)}
                        aria-expanded={openMobileGroup === entry.label}
                        className="flex items-center justify-between w-full text-white hover:underline transition-colors text-sm py-2"
                      >
                        <span>{entry.label}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openMobileGroup === entry.label ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {openMobileGroup === entry.label && (
                          <m.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden pl-3 border-l border-white/20 ml-1"
                          >
                            {groupItems(entry).map((item) => (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2 transition-colors text-sm py-1.5 ${item.accent ? "text-amber-on-band hover:underline" : "text-white hover:underline"}`}
                                onClick={() => { setMobileMenuOpen(false); setOpenMobileGroup(null); }}
                              >
                                <MenuIcon href={item.href} fallback={item.icon} />{item.label}
                                {lifecycleOf(item.module) === "preview" ? " (preview)" : ""}
                              </Link>
                            ))}
                          </m.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <Link
                      key={entry.href}
                      href={entry.href}
                      className="flex items-center gap-2 text-white hover:underline transition-colors text-sm py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <MenuIcon href={entry.href} fallback={entry.icon} bare />{entry.label}
                    </Link>
                  )
                )}

                {/* The account block sits under a rule of its own, so sign out
                    is never the neighbour of an ordinary destination. These
                    links also close the drawer now: the old pair did not, so
                    tapping "My Profile" navigated with the menu still open
                    over the page. */}
                <div className="pt-2 mt-2 border-t border-white/10 space-y-1">
                  {!user && visitor && <VisitorLink place="menu" onClick={() => setMobileMenuOpen(false)} />}
                  {user ? (
                    <>
                      {accountItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex min-h-11 items-center gap-2 text-white hover:underline transition-colors text-sm py-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <MenuIcon href={item.href} fallback={item.icon} />{item.href === "/profile" && !menu.labels[item.href] ? t({ message: `My Profile (${user.name.split(" ")[0]})`, context: "site menu, the drawer's profile link with the member's first name" }) : item.label}
                          {item.count === "tasks" && <Suspense fallback={null}><TaskCountBadge who={user.id} /></Suspense>}
                          {item.count === "messages" && <Suspense fallback={null}><MessageCountBadge who={user.id} /></Suspense>}
                        </Link>
                      ))}
                      <button
                        onClick={() => { setMobileMenuOpen(false); logout(); }}
                        className="block text-white hover:opacity-80 transition-opacity text-sm py-2 text-left"
                      >
                        <Trans context="site header">Sign out everywhere</Trans>
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      className="block text-white hover:underline transition-colors text-sm py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Trans context="site header">Sign in or join</Trans>
                    </Link>
                  )}
                </div>

                {siteUrl && (
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex min-h-11 items-center justify-center gap-1.5 px-4 py-2 border border-white/50 text-white rounded-lg font-medium hover:bg-white/10 transition-colors"
                  >
                    <Trans context="site header">Main Site</Trans>
                    <ExternalLink aria-hidden="true" className="w-4 h-4" />
                  </a>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </nav>
      </header>

      {/* Main Content */}
      {/* R47: the Trail, a member's one next step, on every page. */}
      <NextStepTrail />
      {/* The shortcuts button floats over the page's bottom-right corner on a
          phone. The page ends with room for it, so it never sits on the last
          words (go-live pass, M4). Founding pages draw no button (MobileFab). */}
      <main id="main" tabIndex={-1} className="flex-1 min-h-svh max-md:pb-[var(--fab-clear)]">
        {children}
        <MachineTranslationNote />
      </main>

      {/* Footer */}
      <footer className="bg-teal-deep text-white py-16">
        <div className="container">
          <div className="grid md:grid-cols-5 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              {/* The box is reserved WHILE THE CONFIG LOADS and only then, which
                  is the same three-way distinction the header link makes above.
                  It used to be unconditional, so a village that has uploaded no
                  heart mark published a 154x90 hole in its own footer, above
                  the blurb, forever. The header's defect was a link nobody
                  could click; this one is only dead space, but it comes from
                  the same place: `null` config and "no mark uploaded" are
                  different facts and the box was treating them as one. */}
              {cfg === null ? (
                <div aria-hidden="true" style={{ height: "90px" }} className="mb-4" />
              ) : cfg.images?.heartLogo ? (
                <div className="flex items-center gap-2 mb-4">
                  <img
                    src={cfg.images.heartLogo}
                    alt={altOr(cfg.images.heartLogoAlt, villageName || "Village mark")}
                    style={{ height: "90px", width: "auto" }}
                    draggable={false}
                  />
                </div>
              ) : null}
              <FooterBlurb text={cfg?.project?.footerBlurb} />
            </div>

            {/* Your Journey */}
            <div>
              <h2 className="font-display text-lg font-semibold mb-4"><Trans context="Layout, h2">Your Journey</Trans></h2>
              <ul className="space-y-0">
                {storyShown("/investor") && (
                  <li>
                    <Link href="/investor" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {footerName("/investor", "Investor")}
                    </Link>
                  </li>
                )}
                {storyShown("/steward") && (
                  <li>
                    <Link href="/steward" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {footerName("/steward", "Village Steward")}
                    </Link>
                  </li>
                )}
                {storyShown("/resident") && (
                  <li>
                    <Link href="/resident" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {footerName("/resident", "Resident")}
                    </Link>
                  </li>
                )}
                {storyShown("/prosperity") && (
                  <li>
                    <Link href="/prosperity" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {footerName("/prosperity", "Prosperity Creator")}
                    </Link>
                  </li>
                )}
                {storyShown("/love-letter") && (
                  <li>
                    <Link href="/love-letter" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {storyName("/love-letter")}
                    </Link>
                  </li>
                )}
                {storyShown("/visit") && (
                  <li>
                    <Link href="/visit" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {footerName("/visit", "Plan a Visit")}
                    </Link>
                  </li>
                )}
                <li hidden={!showsHref("/gratitude")}>
                  <Link href="/gratitude" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                    <Trans context="Layout, Link">{tokenName} Wall</Trans>
                  </Link>
                </li>
                {/* Work with us: the four ways to build, top of /roles, and the partner form (the lead, 23 Nov 2026). */}
                <li><Link href="/roles#four-ways" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center" data-footer-four-ways="">{footerName("/work-with-us", "Work With Us")}</Link></li>
                <li><Link href="/partner" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">{t({ message: "Become a partner", context: "four ways to build: a partnership" })}</Link></li>
              </ul>
            </div>

            {/* Governance & Structure */}
            <div>
              <h2 className="font-display text-lg font-semibold mb-4"><Trans context="Layout, h2">Governance</Trans></h2>
              <ul className="space-y-0">
                <li>
                  <Link href="/governance" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                    <Trans context="Layout, Link">How we work together</Trans>
                  </Link>
                </li>
                <li>
                  <Link href="/circles" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                    <Trans context="Layout, Link">Circles</Trans>
                  </Link>
                </li>
                <li>
                  <Link href="/roles" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                    <Trans context="Layout, Link">Roles & Leadership</Trans>
                  </Link>
                </li>
                {storyShown("/how-we-create") && (
                  <li>
                    <Link href="/how-we-create" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {footerName("/how-we-create", "How We Create")}
                    </Link>
                  </li>
                )}
                {storyShown("/good-neighbor") && (
                  <li>
                    <Link href="/good-neighbor" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {footerName("/good-neighbor", "Good Neighbor Criteria")}
                    </Link>
                  </li>
                )}
                {storyShown("/team") && (
                  <li>
                    <Link href="/team" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {footerName("/team", "Our Team")}
                    </Link>
                  </li>
                )}
                {/* Three pages the app mounted and then linked from nowhere.
                    The module-gated two must stay gated: both render NotFound
                    when their module is off, which is the default for every
                    optional module, so an ungated link would be a dead end on
                    a fresh fork. /exit-policy is core and always reachable. */}
                <li hidden={newcomer /* the rules are for members (the lead, 24 Nov 2026); the page stays reachable */}>
                  <Link href="/game-mechanics" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                    <Trans context="Layout, Link">Game Mechanics</Trans>
                  </Link>
                </li>
                <li>
                  <Link href="/exit-policy" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                    <Trans context="Layout, Link">Leaving Well</Trans>
                  </Link>
                </li>
                {networkModule && showsHref("/network") && (
                  <li>
                    <Link href="/network" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      <Trans context="Layout, Link">Village Network</Trans>
                    </Link>
                  </li>
                )}
                {/* The health dashboard had one door in the whole client, the
                    Village menu, and a menu reshuffle would have taken it. */}
                {healthModule && (
                  <li>
                    <Link href="/village-health" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      <Trans context="Layout, Link">Village Health</Trans>
                    </Link>
                  </li>
                )}
                {/* The review queue. Signed-in only, because a visitor has no
                    use for it, and NOT gated on admin here: the whole point of
                    that page is that a steward who is not an admin can open
                    it, and a door only admins can see would put it back where
                    it started. The page itself says plainly when the person
                    looking may not open it, so a member who follows this link
                    without the capability gets a sentence and never a blank
                    screen. */}
                {user && showsHref("/review") && (
                  <li>
                    <Link href="/review" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      <Trans context="Layout, Link">Review Queue</Trans>
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h2 className="font-display text-lg font-semibold mb-4"><Trans context="Layout, h2">Resources</Trans></h2>
              <ul className="space-y-0">
                {storyShown("/co-creators-guide") && (
                  <li>
                    <Link href="/co-creators-guide" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {footerName("/co-creators-guide", "Co-Creators Guide")}
                    </Link>
                  </li>
                )}
                <li>
                  <Link href="/feedback" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                    <Trans context="Layout, Link">Report a Bug / Share an Idea</Trans>
                  </Link>
                </li>
                <li>
                  <Link href="/quests" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                    <Trans context="Layout, Link">Quests</Trans>
                  </Link>
                </li>
                {commerceModule && (
                  <li>
                    <Link href="/contribute" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      <Trans context="Layout, Link">Contribute</Trans>
                    </Link>
                  </li>
                )}
                {/* Three module pages that lived behind exactly one menu entry
                    each. The footer is the second door: it is on every page, it
                    survives a nav reshuffle, and it costs a fork nothing when
                    the module is off. */}
                {crowdpoolModule && showsHref("/campaigns") && (
                  <li>
                    <Link href="/campaigns" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      <Trans context="Layout, Link">Crowd pooling</Trans>
                    </Link>
                  </li>
                )}
                {staysModule && (
                  <li>
                    <Link href="/stay" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      <Trans context="Layout, Link">Stay With Us</Trans>
                    </Link>
                  </li>
                )}
                {toolsModule && showsHref("/tools") && (
                  <li>
                    <Link href="/tools" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      <Trans context="Layout, Link">Village Tools</Trans>
                    </Link>
                  </li>
                )}
                {mapModule && showsHref("/places") && (
                  <li>
                    <Link href="/places" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      <Trans context="Layout, Link">Places, Photographed</Trans>
                    </Link>
                  </li>
                )}
                {storyShown("/housing") && (
                  <li>
                    <Link href="/housing" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {footerName("/housing", "Housing")}
                    </Link>
                  </li>
                )}
                {storyShown("/opportunities") && (
                  <li>
                    <Link href="/opportunities" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {footerName("/opportunities", "Business Opportunities")}
                    </Link>
                  </li>
                )}
                {storyShown("/master-plan") && (
                  <li>
                    <Link href="/master-plan" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                      {footerName("/master-plan", "Master Plan")}
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            {/* Connect */}
            <div>
              <h2 className="font-display text-lg font-semibold mb-4"><Trans context="Layout, h2">Connect</Trans></h2>
              <ul className="space-y-0">
                {siteUrl && (
                  <li>
                    <a
                      href={siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center"
                    >
                      <Trans context="Layout, a">Main Website</Trans>
                    </a>
                  </li>
                )}
                {eventsUrl && (
                  <li>
                    <a
                      href={eventsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center"
                    >
                      <Trans context="Layout, a">Events</Trans>
                    </a>
                  </li>
                )}
                {/* The licence (AGPL-3.0-or-later, section 13) says people who use a
                    changed version must be able to get its source. Every village
                    links it here; the address is the village's own setting. */}
                {cfg && (
                  <li>
                    <a
                      href={UPSTREAM_SOURCE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center"
                    >
                      <Trans context="site footer">Village OS source</Trans>
                    </a>
                  </li>
                )}
                {cfg && villageSource && (
                  <li>
                    <a
                      href={villageSource}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center"
                    >
                      {villageName ? <Trans context="site footer">{villageName}'s source</Trans> : <Trans context="site footer">Our source</Trans>}
                    </a>
                  </li>
                )}
                <li>
                  <Link href="/profile" className="text-white hover:underline transition-colors text-sm flex min-h-11 items-center">
                    <Trans context="Layout, Link">My Village Profile</Trans>
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Solid white, not a fade. --color-teal-deep is a mid-tone, so
                even 100% white lands at 4.81:1 and every step of opacity below
                that drops small text under AA. Fine print gets its quietness
                from size here, not from lightness. */}
            <p className="text-white text-sm">
              <Trans context="Layout, p">© {new Date().getFullYear()}{villageName ? ` ${villageName}.` : ""} All rights reserved.
            </Trans></p>
            <div className="flex items-center gap-2 text-white text-sm">
              <TreePine className="w-4 h-4" />
              <span>{signoff === undefined ? "\u00a0" : `${signoff ? `${signoff} ` : ""}ReGenCivics.Earth`}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Clearance so the fixed tab bar never covers the end of the footer.
          Height comes from --tabbar-h (index.css), which is the bar's own
          measurement and collapses to 0 from `md` up. It used to be spelled
          out here a second time, one border-width short of the truth, and a
          change to the bar's height would not have reached it. It is dropped
          entirely on the routes that render no bar. */}
      {!bare && <div aria-hidden="true" style={{ height: "var(--tabbar-h)" }} />}

      <MobileTabBar />
      {mobileMenuOpen && <Suspense fallback={null}><MoreSheet entries={navEntries} itemsOf={groupItems} account={accountItems} onClose={() => setMobileMenuOpen(false)} villageDefault={cfg?.defaultLocale ?? null} /></Suspense>}
      <Suspense fallback={null}><MobileFab /></Suspense>
      {/* ONCE, deliberately. The bell above renders twice (desktop bar, mobile
          bar) and CSS hides one of them; React mounts both. The celebration
          surface and the page's single polite live region live here so a
          member never sees the same moment twice. */}
      {user && <Suspense fallback={null}><MemberMoments /></Suspense>}
    </div>
  );
}

/**
 * One grouped menu in the desktop bar.
 *
 * Hover opens it for a mouse, click toggles it for a keyboard, and Escape
 * closes it. All three matter: the dropdown this replaces opened on hover
 * ONLY, because its trigger carried no onClick, so Enter and Space fired a
 * click with no listener and its children never entered the tab order at any
 * desktop width. Escape is the second way out that a click-toggle needs, since
 * a mouse user whose pointer is still inside the wrapper fires no fresh
 * mouseenter and could not otherwise reopen it.
 */
function NavDropdown({
  group,
  items,
  open,
  setOpen,
  lifecycleOf,
}: {
  group: NavGroup;
  items: readonly NavLink[];
  open: boolean;
  setOpen: (open: boolean) => void;
  lifecycleOf: (id?: string) => string | undefined;
}) {
  // The join paths carry a second line; the rest are one word. A single width
  // for both leaves either the paths cramped or the short menus floating.
  const wide = items.some((i) => i.subtitle);
  const menuId = navMenuId(group.label);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        className="flex min-h-6 items-center gap-1 text-white hover:underline transition-colors text-sm whitespace-nowrap rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-deep"
      >
        {group.label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            id={menuId}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 ${wide ? "w-60" : "w-48"} bg-card border border-border rounded-xl shadow-sm overflow-hidden z-50`}
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group"
                onClick={() => setOpen(false)}
              >
                <MenuIcon href={item.href} fallback={item.icon} chip />
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${item.accent ? "text-gold" : "text-foreground"}`}>
                    {item.label}
                    {/* Same badge the bar used to carry, in the ink the white
                        sheet needs: amber-200 on white measured below 2:1. */}
                    {lifecycleOf(item.module) === "preview" && (
                      <span className="ml-1.5 inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground align-middle"><Trans context="Layout, span">preview</Trans></span>
                    )}
                  </span>
                  {item.subtitle && <span className="block text-xs text-muted-foreground">{item.subtitle}</span>}
                </span>
              </Link>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
