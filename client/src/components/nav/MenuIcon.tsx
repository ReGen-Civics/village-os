/**
 * A MENU ENTRY'S ICON, beside its label in the header's dropdowns, the phone
 * drawer and the More sheet (the lead, 25 Nov 2026). The page's own icon
 * (config/routeIcons.ts) wins, then the one the entry already carries
 * (config/nav.ts, `icon`).
 *
 * In a list, an entry with no icon keeps the same width empty, so every label
 * starts on one line; `bare` draws nothing at all instead, for a lone link.
 * Static: nothing here moves, so reduced motion has nothing to change.
 * Decorative: the glyphs are aria-hidden and the label names the link.
 */
import { routeIcon, useRouteIcons, type RouteIcon } from "@/config/routeIcons";

const NONE: RouteIcon = () => null;

export default function MenuIcon({ href, fallback, chip, bare, className = "size-4 shrink-0" }: { href: string; fallback?: RouteIcon; chip?: boolean; bare?: boolean; className?: string }) {
  useRouteIcons();
  const Icon = routeIcon(href, fallback ?? NONE);
  const drawn = Icon !== NONE;
  if (chip) {
    // The header's white sheet: the glyph in its soft tinted square, as the join paths had it.
    return drawn ? (
      <span data-menu-icon="" className="mt-0.5 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-4 h-4 text-primary" />
      </span>
    ) : null;
  }
  if (!drawn) return bare ? null : <span aria-hidden="true" className={className} />;
  return (
    <span data-menu-icon="" aria-hidden="true" className="inline-flex shrink-0">
      <Icon className={className} />
    </span>
  );
}
