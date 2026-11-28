// Moved out of components/Layout.tsx whole (26 Nov 2026), when lighting the page's branch took the shell past the
// 1000-line ratchet (scripts/check-file-lines.mjs).
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { m, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { navMenuId, navWord, type NavGroup, type NavLink } from "@/config/nav";
import MenuRows from "@/components/nav/MenuRows";
import { currentFor, type Lit } from "@/config/navBearings";
import MenuIcon from "@/components/nav/MenuIcon";
import LitRule from "@/components/nav/LitRule";
import { Firefly, SeasonMark } from "@/components/nav/joyDoors";
import { warmOnHover } from "@/lib/warmRoute";

// Its own chunk, so the first page's scripts do not grow (nav/WaitingCount.tsx).
const WaitingCount = lazy(() => import("@/components/nav/WaitingCount"));

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
 *
 * HELD ONCE CLICKED (the menu's QA, round 2, 27 Nov 2026). A dropdown opened
 * by a click, or one the reader clicked inside, no longer closes when the
 * pointer leaves it: a folder shutting above the pointer shrank the panel out
 * from under it, and the whole menu vanished mid-choice. Held, it closes on a
 * click outside, Escape, or choosing a link. A dropdown only hovered open still
 * closes when the pointer leaves.
 */
export default function NavDropdown({
  group,
  items,
  open,
  setOpen,
  lifecycleOf,
  lit,
  opens = null,
  waitingFor = null,
}: {
  group: NavGroup;
  items: readonly NavLink[];
  open: boolean;
  setOpen: (open: boolean) => void;
  lifecycleOf: (id?: string) => string | undefined;
  lit: Lit | null;
  /** The folder this reader meets open (Join's paths, for a newcomer). */
  opens?: string | null;
  /** The member whose waiting count this group carries as a dot (Govern's), or null for none. */
  waitingFor?: string | null;
}) {
  const { i18n } = useLingui();
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);
  // Shut is shut: the next opening starts unheld.
  useEffect(() => {
    if (!open) setHeld(false);
  }, [open]);
  // Held, a press anywhere outside the dropdown closes it.
  useEffect(() => {
    if (!open || !held) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, held, setOpen]);
  const here = lit?.group === group.label;
  // The join paths carry a second line; the rest are one word. A single width
  // for both leaves either the paths cramped or the short menus floating. The
  // short one is w-64 since the menu's QA round 2 (27 Nov 2026; it was w-48,
  // then w-56), so "Places and homes", "What's happening now", "How we work
  // together", "Sign the Love Letter" and "What We Look After" each sit on one
  // line inside their indented folders.
  const wide = items.some((i) => i.subtitle);
  const menuId = navMenuId(group.label);
  // One link of the dropdown, at the top level or inside a folder (config/navNest.ts).
  const drawLink = (item: NavLink) => (
    <Link
      href={item.href}
      {...warmOnHover(item.href)}
      aria-current={currentFor(lit, item.href)}
      className={`flex min-h-11 items-center gap-3 border-l-2 px-4 py-1.5 hover:bg-muted transition-colors group ${currentFor(lit, item.href) ? "border-notice bg-muted" : "border-transparent"}`}
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
      <Firefly href={item.href} />
    </Link>
  );

  return (
    <div
      ref={box}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!held) setOpen(false); }}
      // Escape closes the menu and gives focus back to its group's button (the menu's QA, 27 Nov 2026).
      onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}
    >
      <button
        ref={trigger}
        type="button"
        // A click opens it held; a click on one the pointer only hovered open holds it there; a click on a held one
        // shuts it. Decided here, in the button's own handler: a capture-phase handler re-renders before this one runs
        // (React flushes a discrete event's updates between the two phases), so it would read the hold it just set.
        onClick={() => {
          if (open && !held) setHeld(true);
          else {
            setOpen(!open);
            setHeld(!open);
          }
        }}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        aria-current={here ? "true" : undefined}
        className={`relative flex min-h-6 items-center gap-1 text-white hover:underline transition-colors text-sm whitespace-nowrap rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-deep ${here ? "font-semibold" : ""}`}
      >
        {group.label}
        {here ? <LitRule /> : null}
        {waitingFor ? <Suspense fallback={null}><WaitingCount who={waitingFor} variant="dot" /></Suspense> : null}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            id={menuId}
            data-nav-dropdown=""
            // A click inside (a folder, a link) holds it open; a link's own click has already closed it.
            onClick={() => setHeld(true)}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 ${wide ? "w-72" : "w-64"} bg-card border border-border rounded-xl shadow-sm overflow-hidden z-50`}
          >
            {/* What the group holds, as the More sheet heads its sections (the menu's QA, round 2). Words only. */}
            {group.holds ? (
              <p data-menu-eyebrow="" className="pl-15 pr-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest text-notice"><SeasonMark />{navWord(group.holds, i18n)}</p>
            ) : null}
            <MenuRows
              links={items}
              opens={opens}
              here={lit?.href}
              renderLink={drawLink}
              gutter={<span aria-hidden="true" className="w-8 shrink-0" />}
              rowClassName="flex min-h-11 w-full items-center gap-3 border-l-2 border-transparent px-4 py-1.5 text-left text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              // Indented, with the rule at the icon gutter, as the drawer and the phone sheet nest (the menu's QA, round 2).
              listClassName="ml-4 border-l-2 border-border [&_a]:pl-3 [&_a]:pr-3"
            />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
