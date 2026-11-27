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
 *   The village   the menu's sections, as Layout filtered them.
 *   Foot          language, light or dark, and sign out (or sign in).
 *
 * Roles is not here: it is a tab. It is a whole scene rather than a box of
 * words, so dark mode keeps it in the night (`data-scene`, index.css's
 * DIALOGUE IS SAND), and it is modal, so the corner button steps aside while it
 * is open (index.css hides [data-mobile-fab] under an md:hidden aria-modal).
 */
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link, useLocation } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import { ChevronDown, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LanguagePicker } from "@/i18n/LanguagePicker";
import ThemeSwitch from "@/components/ThemeSwitch";
import MenuIcon from "@/components/nav/MenuIcon";
import MenuRows from "@/components/nav/MenuRows";
import { useNewcomer } from "@/lib/newcomer";
import { isGroup, type NavEntry, type NavGroup, type NavLink } from "@/config/nav";
import { currentFor, type Lit } from "@/config/navBearings";
import { DEFAULT_ORDER } from "@/lib/speedCards/registry";
import SpeedCards from "./SpeedCards";

type AccountLink = NavLink & { count?: "tasks" | "messages" };

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
  const { t } = useLingui();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  // The branch the page belongs to opens with the sheet, so the reader sees where they are before they choose.
  const [openGroup, setOpenGroup] = useState<string | null>(() => lit?.group ?? null);
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
    const here = panel.current?.querySelector<HTMLElement>("#more-village ~ ul a[aria-current]");
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
          <span aria-hidden="true" className="mx-auto h-1.5 w-11 rounded-full bg-border" />
          <button type="button" onClick={close} aria-label={t({ message: "Close More", context: "the phone's More sheet: close button" })} className="absolute right-2 top-0 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

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
                    </Link>
                  )}
                />
              </ul>
            ) : null}
          </section>
        ) : (
          // One tile for a visitor: Work With Us is in Join's Build with us, so it is not drawn twice (QA, 27 Nov 2026).
          <section className="mt-2 grid grid-cols-1 gap-2">
            <Tile href="/login" label={t({ message: "Sign in or join", context: "the phone's More sheet: a visitor's tile" })} onGo={close} />
          </section>
        )}

        <section aria-labelledby="more-village" className="mt-4">
          <h2 id="more-village" className={eyebrow}><Trans context="the phone's More sheet: heading">The village</Trans></h2>
          <ul className="mt-1 divide-y divide-border/60" data-wayfinding="menu">
            {entries.map((e) =>
              isGroup(e) ? (
                <li key={e.label}>
                  <button
                    type="button"
                    onClick={() => setOpenGroup(openGroup === e.label ? null : e.label)}
                    aria-expanded={openGroup === e.label}
                    aria-current={lit?.group === e.label ? "true" : undefined}
                    data-lit={lit?.group === e.label ? "" : undefined}
                    className={`flex min-h-11 w-full items-center justify-between py-2 text-left text-base text-foreground ${lit?.group === e.label ? "font-semibold" : ""}`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {lit?.group === e.label ? <span aria-hidden="true" data-lit-dot="" className="size-2 rounded-full bg-notice" /> : null}
                      {e.label}
                    </span>
                    <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${openGroup === e.label ? "rotate-180" : ""}`} />
                  </button>
                  {openGroup === e.label ? (
                    <ul className="mb-2 ml-1 border-l border-border pl-3">
                      <MenuRows
                        asListItems
                        links={itemsOf(e)}
                        opens={newcomer || !user ? e.opens : null}
                        here={lit?.href}
                        gutter={<span aria-hidden="true" className="size-5 shrink-0" />}
                        rowClassName="flex min-h-11 w-full items-center gap-2 py-1.5 text-left text-sm text-foreground hover:underline"
                        listClassName="mb-1 ml-1 border-l border-border pl-3"
                        renderLink={(l) => (
                          <Link href={l.href} onClick={close} aria-current={currentFor(lit, l.href)} data-lit={currentFor(lit, l.href) ? "" : undefined} className={`flex min-h-11 items-center gap-2 py-1.5 text-sm text-foreground hover:underline ${currentFor(lit, l.href) ? LIT_ON : ""}`}>
                            <MenuIcon href={l.href} fallback={l.icon} />
                            {l.label}
                          </Link>
                        )}
                      />
                    </ul>
                  ) : null}
                </li>
              ) : (
                <li key={e.href}>
                  <Link href={e.href} onClick={close} aria-current={currentFor(lit, e.href)} data-lit={currentFor(lit, e.href) ? "" : undefined} className={`flex min-h-11 items-center gap-2 py-2 text-base text-foreground hover:underline ${currentFor(lit, e.href) ? LIT_TOP : ""}`}>
                    <MenuIcon href={e.href} fallback={e.icon} bare />
                    {e.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </section>

        <div className="mt-4 flex items-center gap-2 text-foreground" data-more-foot="">
          <LanguagePicker villageDefault={villageDefault ?? null} tone="onSheet" />
          <ThemeSwitch />
          {user ? (
            <button type="button" onClick={() => { close(); logout(); }} className="ml-auto inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">
              <Trans context="the phone's More sheet: sign out">Sign out</Trans>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
