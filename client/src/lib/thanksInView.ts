/**
 * THE THANK-YOU, IN VIEW (public launch QA, 24 Nov 2026).
 *
 * A long form that answers with a short thank-you leaves a phone scrolled to
 * where the Send button was: past the end of the new, shorter page, so the
 * reader is left looking at the footer and never sees that it worked. Measured
 * on /propose-quest, /partner and /work-with-us at 390px.
 *
 * The heading of the thank-you takes this ref and `tabIndex={-1}`. When it
 * shows, the page goes back to the top (or, when the thank-you would still be
 * below the fold from there, to the thank-you) and focus moves to it, so a
 * screen reader reads it too (the button that sent the form is gone, and focus
 * would otherwise fall to the body).
 */
import { useEffect, useRef } from "react";

export function useThanksInView<T extends HTMLElement = HTMLHeadingElement>(shown: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!shown) return;
    const el = ref.current;
    // Instantly, never with the page's smooth scroll: the glide passed through the footer on its way
    // up (/propose-quest). To the top when the thank-you fits there with the tab bar's 80px clear;
    // otherwise to the thank-you itself, which on /feedback sits below a phone's fold, so its
    // celebration played under the tab bar (QA, 25 Nov 2026).
    const top = el ? el.getBoundingClientRect().bottom + window.scrollY : 0;
    if (!el || top <= window.innerHeight - 80) window.scrollTo?.({ top: 0, behavior: "instant" });
    else el.scrollIntoView?.({ block: "center", behavior: "instant" });
    el?.focus({ preventScroll: true });
  }, [shown]);
  return ref;
}
