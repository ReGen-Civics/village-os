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
 * The sections a link from another page lands on: the two the four ways point at, and the four ways themselves (the
 * footer's "Work with us", `/roles#four-ways`).
 */
export const ROLES_LANDINGS: ReadonlySet<string> = new Set([ROLES_SECTIONS.team, ROLES_SECTIONS.venture, "four-ways"]);

/** The address's hash, decoded, without its `#`; empty when it has none or cannot be decoded. */
function hashNow(): string {
  if (typeof window === "undefined") return "";
  try {
    return decodeURIComponent(window.location.hash.replace(/^#/, ""));
  } catch {
    return "";
  }
}

/** Input that means the reader has taken the page over: from then on nothing moves it for them. */
const READER_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/**
 * HOLD A LANDED SECTION WHILE THE PAGE ABOVE IT IS STILL BEING DRAWN (production 1.3.56, home -> Start a venture).
 *
 * The section exists as soon as /roles has its two reads, but the founding team's cards, their lazy parts and their
 * art keep arriving for a second or more after that, all of it ABOVE the open ventures. A scroll taken at the first
 * moment the section exists lands where the section WAS: on production the reader was left at the top with the
 * heading some 4750px below, focus on a heading they could not see. So after landing, every time the page changes
 * height the section is brought back to the top of the screen, at once (never a second glide), until the page has
 * been still for `quietMs`, `maxMs` has passed, or the reader scrolls, taps, clicks or presses a key, whichever is
 * first. The observer's first report is the size the page already had, so it moves nothing.
 *
 * Returns the release. Without ResizeObserver (jsdom, a very old browser) it holds nothing.
 */
export function holdSection(id: string, { quietMs = 3000, maxMs = 10000 }: { quietMs?: number; maxMs?: number } = {}): () => void {
  if (typeof window === "undefined" || typeof ResizeObserver === "undefined" || !document.body) return () => {};
  let height = -1;
  let done = false;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  const realign = () => {
    const section = document.getElementById(id);
    if (!section) return;
    const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
    if (Math.abs(section.getBoundingClientRect().top - margin) > 2) section.scrollIntoView?.({ block: "start", behavior: "auto" });
  };
  const observer = new ResizeObserver((entries) => {
    const h = Math.round(entries[entries.length - 1]?.contentRect.height ?? 0);
    const first = height < 0;
    if (h === height) return;
    height = h;
    if (first) return;
    realign();
    clearTimeout(quiet);
    quiet = setTimeout(release, quietMs);
  });
  const cap = setTimeout(release, maxMs);
  function release() {
    if (done) return;
    done = true;
    observer.disconnect();
    clearTimeout(quiet);
    clearTimeout(cap);
    for (const e of READER_INPUT) window.removeEventListener(e, release, true);
  }
  for (const e of READER_INPUT) window.addEventListener(e, release, { capture: true, passive: true });
  observer.observe(document.body);
  quiet = setTimeout(release, quietMs);
  return release;
}

/**
 * Arriving on /roles#founding-team, /roles#open-ventures or /roles#four-ways (from the home page, a thank-you page or
 * the footer), on a direct load or a press inside the app: once `ready` and the section is drawn, scroll to it and
 * focus its heading, as a press on the page does, then hold it there while the page above it finishes drawing
 * (holdSection). Once per visit: a later re-render never moves the page.
 *
 * A change of hash while the page is open lands too: the address bar, Back and Forward (`hashchange`, `popstate`),
 * and a link inside the app to `/roles#...` followed from /roles itself, which the router makes a `pushState` that
 * the browser never scrolls for. A hash whose section already holds focus has landed, so a press on the four ways,
 * which lands first and then writes the hash, is never taken twice.
 */
export function useLandOnSection(ready: boolean, deps: readonly unknown[]): void {
  const landed = useRef(false);
  const release = useRef<() => void>(() => {});
  const land = (h: string): boolean => {
    if (!goToSection(h, { push: false })) return false;
    release.current();
    release.current = holdSection(h);
    return true;
  };
  useEffect(() => () => release.current(), []);
  useEffect(() => {
    if (landed.current || !ready) return;
    const h = hashNow();
    if (!ROLES_LANDINGS.has(h)) {
      landed.current = true;
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (land(h)) landed.current = true;
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ...deps]);
  useEffect(() => {
    let seen = hashNow();
    let frame = 0;
    const follow = () => {
      const h = hashNow();
      if (h === seen) return;
      seen = h;
      if (!ROLES_LANDINGS.has(h)) return;
      // A frame later: Chrome fires popstate in the middle of its own jump to a fragment, and that jump then takes
      // focus off whatever holds it, so a heading focused at once lost it again (measured, home -> address bar).
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (document.getElementById(h)?.contains(document.activeElement)) return;
        // Not drawn yet: the arrival above takes it once the page is ready.
        if (!land(h)) landed.current = false;
      });
    };
    const events = ["hashchange", "popstate", "pushState"] as const;
    for (const e of events) window.addEventListener(e, follow);
    return () => {
      cancelAnimationFrame(frame);
      for (const e of events) window.removeEventListener(e, follow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
