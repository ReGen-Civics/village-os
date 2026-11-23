/**
 * IN-PAGE ANCHORS THAT LAND (the lead, 23 Nov 2026): "Join the team" and "Start a venture" at the top of /roles
 * scroll down to the founding team and the open ventures on the same page, and from anywhere else they link to
 * `/roles#founding-team` and `/roles#open-ventures`.
 *
 * Going to a section scrolls it to the top (smoothly, or at once when the reader asks for less motion) and moves
 * focus to its heading, so a keyboard or screen-reader user arrives where the eye does. The heading carries
 * `data-section-focus` and `tabIndex={-1}`; a section with none takes focus itself.
 */
import { useEffect, useRef } from "react";
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

/**
 * Arriving on /roles#founding-team or /roles#open-ventures (from the home page, a thank-you page or the footer): once
 * `ready` and the section is drawn, scroll to it and focus its heading, as a press on the page does. Once per visit.
 */
export function useLandOnSection(ready: boolean, deps: readonly unknown[]): void {
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !ready) return;
    const h = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (h !== ROLES_SECTIONS.team && h !== ROLES_SECTIONS.venture) {
      landed.current = true;
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (goToSection(h, { push: false })) landed.current = true;
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ...deps]);
}

/** What an old in-page link to one role named, read once on arrival on /roles: `?seat=`, `?role=`, or the hash. */
export function oldLink(): { seat: string | null; hash: string | null } {
  if (typeof window === "undefined") return { seat: null, hash: null };
  const q = new URLSearchParams(window.location.search);
  const h = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  return { seat: q.get("seat") || q.get("role") || null, hash: h || null };
}

/** The role an old link names: by id for `?seat=`, by id, `role-<id>` or slug for a hash. */
export function roleForOldLink(link: { seat: string | null; hash: string | null }, roles: ReadonlyArray<{ id: string; path: string }>): { id: string; path: string } | null {
  if (link.seat) return roles.find((r) => r.id === link.seat) ?? null;
  const h = link.hash;
  // A waitlist hash and the page's own sections (#founding-team, #open-ventures...) are anchors on the page, never a role.
  if (!h || h.startsWith("waitlist-") || ROLES_PAGE_ANCHORS.has(h)) return null;
  const id = h.startsWith("role-") ? h.slice(5) : h;
  return roles.find((r) => r.id === id || r.id === h || r.path === `/roles/${h}`) ?? null;
}
