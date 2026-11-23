/**
 * IN-PAGE ANCHORS THAT LAND (the lead, 23 Nov 2026): "Join the team" and "Start a venture" at the top of /roles
 * scroll down to the founding team and the open ventures on the same page, and from anywhere else they link to
 * `/roles#founding-team` and `/roles#open-ventures`.
 *
 * Going to a section scrolls it to the top (smoothly, or at once when the reader asks for less motion) and moves
 * focus to its heading, so a keyboard or screen-reader user arrives where the eye does. The heading carries
 * `data-section-focus` and `tabIndex={-1}`; a section with none takes focus itself.
 */
import { prefersReducedMotion } from "@/components/natural/useReducedMotion";

/** The stable ids of the /roles sections the four ways point at. */
export const ROLES_SECTIONS = { team: "founding-team", venture: "open-ventures" } as const;
/** Every in-page anchor /roles answers itself, so an old one-role link never reads one of them as a role's slug. */
export const ROLES_PAGE_ANCHORS: ReadonlySet<string> = new Set([ROLES_SECTIONS.team, ROLES_SECTIONS.venture, "four-ways", "open-now-heading", "opening-next", "coming-soon", "future-ventures"]);

/** Scroll to the section with this id and focus its heading. False when the page has no such section. */
export function goToSection(id: string, { push = true }: { push?: boolean } = {}): boolean {
  if (typeof document === "undefined") return false;
  const section = document.getElementById(id);
  if (!section) return false;
  section.scrollIntoView?.({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  const target = section.querySelector<HTMLElement>("[data-section-focus]") ?? section;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  if (push && window.location.hash !== `#${id}`) window.history.pushState(window.history.state, "", `${window.location.pathname}${window.location.search}#${id}`);
  return true;
}

/** The hash of a link that stays on this page ("/roles#founding-team" read on /roles), or null for one that leaves it. */
export function samePageHash(href: string, here: string = typeof window === "undefined" ? "" : window.location.pathname): string | null {
  if (href.startsWith("#")) return href.slice(1) || null;
  const at = href.indexOf("#");
  if (at < 0) return null;
  const path = href.slice(0, at) || here;
  return path === here ? href.slice(at + 1) || null : null;
}
