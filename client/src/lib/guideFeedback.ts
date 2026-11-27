/**
 * THE WAY INTO "SHARE FEEDBACK", wherever a page offers it (the fold of /feedback into the guide's
 * panel, 26 Nov 2026: "share with scarlet and that goes into our own queue").
 *
 * The form lives in the village guide's panel in the corner (components/mobile/MobileFab.tsx), on
 * the page the member is looking at, so the page they mean is the page a screenshot shows. Three
 * doors reach it:
 *
 *   - `openGuideFeedback()`, for a button on the page (the footer's "Report a bug / Share an idea");
 *   - `#feedback` on any address, read when the corner arrives;
 *   - `/feedback`, the old page's address, which goes back to the page the member came from with
 *     `#feedback` on it (App.tsx), so a bookmark or a link in an old email still lands.
 *
 * Tiny on purpose: it ships with the shell, and the form itself loads only when the door opens.
 */

export const FEEDBACK_HASH = "#feedback";
export const OPEN_FEEDBACK_EVENT = "guide:open-feedback";

/** Open the guide's panel on "Share feedback", over the page as it stands. */
export function openGuideFeedback(): void {
  window.dispatchEvent(new CustomEvent(OPEN_FEEDBACK_EVENT));
}

let lastPage: string | null = null;

/** The corner tells this module each page it stands on, so `/feedback` can send the member back. */
export function rememberPage(path: string): void {
  if (!path.startsWith("/feedback")) lastPage = path;
}

/**
 * Where `/feedback` sends a member: the page they were on in this tab, else the page that linked
 * here from this site, else the home page. Never Admin, which draws no corner. Pure over its inputs.
 */
export function feedbackReturnPath(o: { last: string | null; referrer: string; origin: string }): string {
  const usable = (p: string | null | undefined): p is string =>
    !!p && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/feedback") && p !== "/admin" && !p.startsWith("/admin/") && !p.startsWith("/admin?");
  if (usable(o.last)) return o.last;
  try {
    const ref = new URL(o.referrer);
    if (ref.origin === o.origin && usable(ref.pathname)) return ref.pathname;
  } catch {
    /* no referrer, or not one this site sent */
  }
  return "/";
}

/** The address `/feedback` redirects to, `#feedback` on the end. */
export function feedbackRedirectTarget(): string {
  return `${feedbackReturnPath({ last: lastPage, referrer: document.referrer, origin: window.location.origin })}${FEEDBACK_HASH}`;
}
