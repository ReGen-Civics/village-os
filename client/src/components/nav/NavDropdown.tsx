// Moved out of components/Layout.tsx whole (26 Nov 2026), when lighting the page's branch took the shell past the
// 1000-line ratchet (scripts/check-file-lines.mjs).
import { Link } from "wouter";
import { m, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { navMenuId, type NavGroup, type NavLink } from "@/config/nav";
import { currentFor, type Lit } from "@/config/navBearings";
import MenuIcon from "@/components/nav/MenuIcon";
import LitRule from "@/components/nav/LitRule";

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
export default function NavDropdown({
  group,
  items,
  open,
  setOpen,
  lifecycleOf,
  lit,
}: {
  group: NavGroup;
  items: readonly NavLink[];
  open: boolean;
  setOpen: (open: boolean) => void;
  lifecycleOf: (id?: string) => string | undefined;
  lit: Lit | null;
}) {
  const here = lit?.group === group.label;
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
        aria-current={here ? "true" : undefined}
        className={`relative flex min-h-6 items-center gap-1 text-white hover:underline transition-colors text-sm whitespace-nowrap rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-deep ${here ? "font-semibold" : ""}`}
      >
        {group.label}
        {here ? <LitRule /> : null}
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
                aria-current={currentFor(lit, item.href)}
                className={`flex items-start gap-3 border-l-2 px-4 py-2.5 hover:bg-muted transition-colors group ${currentFor(lit, item.href) ? "border-notice bg-muted" : "border-transparent"}`}
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
