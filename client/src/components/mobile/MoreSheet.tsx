/**
 * MORE, THE PHONE'S ONE MENU (phone doors v4; the lead approved it 25 Nov 2026,
 * https://claude.ai/artifact/ADtgLo9i5uu5DLNrRz2mXL).
 *
 * The bar's More used to open the header's drawer, the same one the header's
 * menu button opened. Below `md` More opens this sheet, rising from the bar where
 * the thumb already is, and since 27 Nov 2026 the header's menu button opens this
 * same sheet too (the lead: "another button for menu to then open up the same
 * thing that the bottom right more button opens up"), beside the header's Paths
 * (PathsSheet.tsx). One sheet, two doors, so the two can never differ. From `md`
 * up nothing here draws: there is no bar, and the header keeps its drawer
 * (Layout.tsx).
 *
 *   Yours         six speed cards, the member's own to choose (SpeedCards.tsx, 27 Nov 2026): by default Profile,
 *                 Messages and My tasks with their counts, Journal, then Pull a card once Human Design or Gene Keys
 *                 is on and Pay once credits are in use, and "+" slots for the rest. Any page the menu offers this
 *                 member can be a card (lib/speedCards/registry.ts), so a card shows exactly when its menu entry
 *                 would. Hold a card, right-click it, or press Edit to rearrange them.
 *   Also yours    the account entries that are not on the cards, in their folders (config/navNest.ts).
 *   Recent        the last few pages this member opened, kept on this device only (lib/navVisits.ts).
 *   The village   the menu's sections, as Layout filtered them: one group at a time, its rows above and the group
 *                 tabs at the bottom of the sheet, where the thumb is (27 Nov 2026, the lead: "phone reach"). A
 *                 sideways swipe over the rows moves to the next or the previous group.
 *   Foot          language, light or dark, and sign out (or sign in).
 *
 * Roles is not here: it is a tab. It is a whole scene rather than a box of
 * words, so dark mode keeps it in the night (`data-scene`, index.css's
 * DIALOGUE IS SAND), and it is modal, so the corner button steps aside while it
 * is open (index.css hides [data-mobile-fab] under an md:hidden aria-modal).
 */
import { useContext, useEffect, useRef, useState, type ComponentType, type TouchEvent } from "react";
import { Link, useLocation } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LanguagePicker } from "@/i18n/LanguagePicker";
import ThemeSwitch from "@/components/ThemeSwitch";
import MenuIcon from "@/components/nav/MenuIcon";
import MenuRows from "@/components/nav/MenuRows";
import { useNewcomer } from "@/lib/newcomer";
import { isGroup, type NavEntry, type NavGroup, type NavLink } from "@/config/nav";
import { currentFor, type Lit } from "@/config/navBearings";
import { DEFAULT_ORDER } from "@/lib/speedCards/registry";
import { recentPages } from "@/lib/navVisits";
import { usePathState } from "@/lib/usePath";
import { sayPath } from "@shared/yourPath";
import { pageTitleFor } from "@shared/pageTitles";
import { Firefly, SeasonMark } from "@/components/nav/joyDoors";
import AccountCount from "@/components/nav/AccountCount";
import { MenuFirefly } from "@/components/nav/menuFolders";
import SearchSlot from "@/components/search/SearchSlot";
import SpeedCards from "./SpeedCards";

type AccountLink = NavLink;

export interface MoreSheetProps {
  /** The menu, as Layout filtered it (modules, roles, the brochure switch). */
  entries: readonly NavEntry[];
  /** A group's visible items, as Layout reads them. */
  itemsOf: (group: NavGroup) => NavLink[];
  /** The account entries, as Layout filtered them. */
  account: readonly AccountLink[];
  onClose: () => void;
  villageDefault?: string | null;
  /** Where the page sits in the menu (config/navBearings.ts): its group opens with the sheet, and both are marked. */
  lit?: Lit | null;
}

/** A visitor's tile. A member's are their speed cards (SpeedCards.tsx). */
function Tile({ href, label, onGo, children, Icon }: { href: string; label: string; onGo: () => void; children?: React.ReactNode; Icon?: ComponentType<{ className?: string }> }) {
  return (
    <Link
      href={href}
      onClick={onGo}
      data-more-tile={href}
      className="relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl bg-muted px-1.5 py-2.5 text-center text-sm font-medium text-foreground hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {Icon ? <Icon aria-hidden="true" className="size-6 shrink-0" /> : <MenuIcon href={href} className="size-6 shrink-0" />}
      <span className="leading-tight">{label}</span>
      {children}
    </Link>
  );
}

/** The entry the page is at or under wears a gold edge on its left (the accent on the panel, measured 3:1 in modePalettes.test.ts). */
// Pulled left by what it pads, so the words stay where they were and only the edge appears.
const LIT_ON = "-ml-3 border-l-2 border-notice pl-2.5 font-semibold";
// A top-level entry has no group rule to sit on, so its edge stands on the text column and the words step in after it
// (the live check, 27 Nov 2026: pulled left, the edge sat at the sheet's own edge, outside the list).
const LIT_TOP = "border-l-2 border-notice pl-3 font-semibold";

/** Below `md`, where the bar and its More exist. From `md` up the header's drawer answers the same open state (Layout.tsx). */
const PHONE = "(max-width: 767.98px)";

export default function MoreSheet(props: MoreSheetProps) {
  const [phone] = useState(() => (typeof window.matchMedia === "function" ? window.matchMedia(PHONE).matches : false));
  return phone ? <Sheet {...props} /> : null;
}

function Sheet({ entries, itemsOf, account, onClose, villageDefault, lit = null }: MoreSheetProps) {
  const { t, i18n } = useLingui();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  // The group the page belongs to is the one shown, so the reader sees where they are before they choose; else the first.
  const groups = entries.filter(isGroup);
  const [openGroup, setOpenGroup] = useState<string | null>(() => lit?.group ?? groups[0]?.label ?? null);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  // Layout passes a fresh closure each render; the effects below read the latest through a ref and run once.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = () => closeRef.current();

  // Focus moves in on open and goes back to whatever opened it (the bar's More) on close.
  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.querySelector<HTMLElement>("a[href], button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
    };
  }, []);
  // The entry the page belongs to is brought into view, so its open branch is never below the sheet's fold.
  useEffect(() => {
    const here = panel.current?.querySelector<HTMLElement>("#more-group-panel a[aria-current]");
    if (typeof here?.scrollIntoView === "function") here.scrollIntoView({ block: "nearest" });
  }, []);
  // A new page closes it.
  const first = useRef(location);
  useEffect(() => {
    if (location !== first.current) closeRef.current();
  }, [location]);

  // The addresses on the member's cards, so the list under them leaves those out (SpeedCards reports them).
  const [onCards, setOnCards] = useState<readonly string[]>(DEFAULT_ORDER);
  // The rest of the member's own entries. The hidden map is not added here any more: it sits in Village's Maps folder,
  // and a page shows once in the sheet (the menu's QA, 27 Nov 2026).
  const newcomer = useNewcomer();
  const rest: AccountLink[] = account.filter((a) => !onCards.includes(a.href));
  // Recent: the last pages opened here, named as the menu names them, else by the page's own title.
  const named = new Map<string, string>();
  for (const e of entries) for (const l of isGroup(e) ? itemsOf(e) : [e]) named.set(l.href, l.label);
  for (const a of account) named.set(a.href, a.label);
  const [recent] = useState(() => (user ? recentPages([location.split(/[?#]/)[0] || "/", ...onCards], 4) : []));
  const recentRows = recent.map((href) => ({ href, label: named.get(href) ?? pageTitleFor(href) })).filter((r) => r.label);
  // The greeting: the member's first name and their one next step (shared/yourPath.ts), as the root strip says it.
  const { path } = usePathState();
  const step = user && path && !path.visitor ? sayPath(path, i18n.locale).step : null;
  const firstName = user?.name.split(" ")[0] ?? "";
  // A sideways swipe over the rows moves between the groups, as the tabs below do.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    swipe.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const from = swipe.current;
    swipe.current = null;
    const t0 = e.changedTouches[0];
    if (!from || !t0) return;
    const dx = t0.clientX - from.x;
    if (Math.abs(dx) < 56 || Math.abs(dx) < 2 * Math.abs(t0.clientY - from.y)) return;
    const at = groups.findIndex((g) => g.label === openGroup);
    const next = groups[at + (dx < 0 ? 1 : -1)];
    if (next) setOpenGroup(next.label);
  };
  const shown = groups.find((g) => g.label === openGroup) ?? null;
  const firefly = useContext(MenuFirefly);

  const eyebrow = "text-xs font-semibold uppercase tracking-widest text-notice";
  return (
    <div className="md:hidden" data-more-sheet="">
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={close} className="fixed inset-0 z-[65] cursor-default bg-black/45" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t({ message: "More", context: "the phone's More sheet, read aloud" })}
        data-scene=""
        className="fixed inset-x-0 z-[70] max-h-[calc(100svh-var(--tabbar-h,4rem)-4rem)] overflow-y-auto rounded-t-2xl border-t border-border bg-card px-4 pb-4 pt-2 text-card-foreground shadow-sm"
        style={{ bottom: "var(--tabbar-h, 4rem)" }}
      >
        <div className="sticky top-0 -mx-4 flex items-center justify-between bg-card px-4 pb-1 pt-1">
          <SearchSlot place="sheet" />
          <span aria-hidden="true" className="mx-auto h-1.5 w-11 rounded-full bg-border" />
          <button type="button" onClick={close} aria-label={t({ message: "Close More", context: "the phone's More sheet: close button" })} className="absolute right-2 top-0 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {step ? (
          <p data-more-greeting="" className="mt-1 text-sm text-foreground">
            <Trans context="the phone's More sheet: the greeting, with the member's next step">Hello, {firstName}. Next:</Trans>{" "}
            {path?.step.href ? <Link href={path.step.href} onClick={close} className="font-semibold underline underline-offset-4">{step}</Link> : <span className="font-semibold">{step}</span>}
          </p>
        ) : null}
        {user ? (
          <section aria-labelledby="more-yours" className="mt-2">
            <SpeedCards who={String(user.id)} entries={entries} itemsOf={itemsOf} account={account} here={location} onClose={close} onShown={setOnCards} />
            {rest.length ? (
              <ul className="mt-3 divide-y divide-border/60" aria-label={t({ message: "Also yours", context: "the phone's More sheet: the rest of the account links" })}>
                <MenuRows
                  asListItems
                  links={rest}
                  here={lit?.href}
                  gutter={<span aria-hidden="true" className="size-5 shrink-0" />}
                  rowClassName="flex min-h-11 w-full items-center gap-2 py-2 text-left text-sm text-foreground hover:underline"
                  listClassName="mb-2 ml-1 border-l border-border pl-3"
                  renderLink={(a) => (
                    <Link href={a.href} onClick={close} className="flex min-h-11 items-center gap-2 py-2 text-sm text-foreground hover:underline">
                      <MenuIcon href={a.href} fallback={a.icon} />
                      {a.label}
                      {user ? <AccountCount count={a.count} who={user.id} /> : null}
                    </Link>
                  )}
                />
              </ul>
            ) : null}
            {recentRows.length ? (
              <div className="mt-3" data-more-recent="">
                <h3 id="more-recent" className="text-xs font-semibold text-muted-foreground"><Trans context="the phone's More sheet: the pages opened last">Recent</Trans></h3>
                <ul aria-labelledby="more-recent" className="mt-1 flex flex-wrap gap-2">
                  {recentRows.map((r) => (
                    <li key={r.href}>
                      <Link href={r.href} onClick={close} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-3 text-sm text-foreground hover:bg-muted">
                        <MenuIcon href={r.href} bare />
                        {r.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : (
          // One tile for a visitor: Work With Us is in Join's Build with us, so it is not drawn twice (QA, 27 Nov 2026).
          <section className="mt-2 grid grid-cols-1 gap-2">
            <Tile href="/login" label={t({ message: "Sign in or join", context: "the phone's More sheet: a visitor's tile" })} onGo={close} Icon={ProfileGlyph} />
          </section>
        )}

        <section aria-labelledby="more-village" className="mt-4">
          <h2 id="more-village" className={eyebrow}><SeasonMark hang={false} /><Trans context="the phone's More sheet: heading">The village</Trans></h2>
          {entries.filter((e) => !isGroup(e)).length ? (
            <ul className="mt-1 divide-y divide-border/60">
              {entries.filter((e): e is NavLink => !isGroup(e)).map((e) => (
                <li key={e.href}>
                  <Link href={e.href} onClick={close} aria-current={currentFor(lit, e.href)} data-lit={currentFor(lit, e.href) ? "" : undefined} className={`flex min-h-11 items-center gap-2 py-2 text-base text-foreground hover:underline ${currentFor(lit, e.href) ? LIT_TOP : ""}`}>
                    <MenuIcon href={e.href} fallback={e.icon} bare />
                    {e.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {shown ? (
            <div role="tabpanel" id="more-group-panel" aria-labelledby={`more-tab-${groups.indexOf(shown)}`} data-more-panel="" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <ul key={shown.label} className="mt-1 divide-y divide-border/60">
                <MenuRows
                  asListItems
                  links={itemsOf(shown)}
                  opens={newcomer || !user ? shown.opens : null}
                  here={lit?.href}
                  gutter={<span aria-hidden="true" className="size-5 shrink-0" />}
                  rowClassName="flex min-h-11 w-full items-center gap-2 py-1.5 text-left text-sm text-foreground hover:underline"
                  listClassName="mb-1 ml-1 border-l border-border pl-3"
                  renderLink={(l) => (
                    <Link href={l.href} onClick={close} aria-current={currentFor(lit, l.href)} data-lit={currentFor(lit, l.href) ? "" : undefined} className={`flex min-h-11 items-center gap-2 py-1.5 text-sm text-foreground hover:underline ${currentFor(lit, l.href) ? LIT_ON : ""}`}>
                      <MenuIcon href={l.href} fallback={l.icon} />
                      {l.label}
                      <Firefly href={l.href} />
                    </Link>
                  )}
                />
              </ul>
            </div>
          ) : null}
        </section>

        <div className="mt-4 flex items-center gap-2 pb-16 text-foreground" data-more-foot="">
          <LanguagePicker villageDefault={villageDefault ?? null} tone="onSheet" />
          <ThemeSwitch />
          {user ? (
            <button type="button" onClick={() => { close(); logout(); }} className="ml-auto inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">
              <Trans context="the phone's More sheet: sign out">Sign out</Trans>
            </button>
          ) : null}
        </div>
        {/*
          The group tabs: the sheet's own sticky footer, so they stay at its bottom edge, where the thumb is, at every
          height (the menu's QA, round 1: inside their section they were cut off at 320 by 640). One Tab stop: the
          arrows, Home and End move between them (roving focus).
        */}
        <div role="tablist" aria-label={t({ message: "The menu's groups", context: "the phone's More sheet: the group tabs, read aloud" })} data-wayfinding="menu" className="sticky -bottom-4 -mx-4 -mb-4 mt-3 flex gap-1 border-t border-border bg-card px-2 pb-3 pt-2">
          {groups.map((g, i) => (
            <button
              key={g.label}
              type="button"
              role="tab"
              id={`more-tab-${i}`}
              aria-selected={openGroup === g.label}
              aria-controls="more-group-panel"
              tabIndex={openGroup === g.label ? 0 : -1}
              aria-current={lit?.group === g.label ? "true" : undefined}
              data-lit={lit?.group === g.label ? "" : undefined}
              onClick={() => setOpenGroup(g.label)}
              onKeyDown={(e) => {
                const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? groups.length - 1 : -1;
                const next = groups[to];
                if (to < 0 || !next) return;
                e.preventDefault();
                setOpenGroup(next.label);
                (e.currentTarget.parentElement?.children[to] as HTMLElement | undefined)?.focus();
              }}
              className={`relative inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm ${openGroup === g.label ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {lit?.group === g.label ? <span aria-hidden="true" data-lit-dot="" className="size-2 rounded-full bg-notice" /> : null}
              {g.label}
              {firefly && itemsOf(g).some((l) => l.href === firefly) ? <Firefly href={firefly} /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The Profile tile's glyph, for a visitor's Sign in or join: /login has no glyph of its own, and its words sat under an
 * empty slot at the bottom of a 72px tile (the menu's QA, round 4). Kept down here, apart from the tiles above, which
 * the speed cards (#1860) replace.
 */
function ProfileGlyph({ className }: { className?: string }) {
  return <MenuIcon href="/profile" className={className} />;
}
