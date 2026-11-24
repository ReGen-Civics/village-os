/**
 * THE THANK-YOU, IN VIEW (public launch QA, 24 Nov 2026).
 *
 * A long form that answers with a short thank-you leaves a phone scrolled to
 * where the Send button was: past the end of the new, shorter page, so the
 * reader is left looking at the footer and never sees that it worked. Measured
 * on /propose-quest, /partner and /work-with-us at 390px.
 *
 * The heading of the thank-you takes this ref and `tabIndex={-1}`. When it
 * shows, the page goes back to the top and focus moves to the heading, so a
 * screen reader reads it too (the button that sent the form is gone, and focus
 * would otherwise fall to the body).
 */
import { useEffect, useRef } from "react";

export function useThanksInView<T extends HTMLElement = HTMLHeadingElement>(shown: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!shown) return;
    window.scrollTo?.({ top: 0 });
    ref.current?.focus({ preventScroll: true });
  }, [shown]);
  return ref;
}
