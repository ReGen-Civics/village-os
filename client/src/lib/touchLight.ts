/**
 * TOUCH LIGHT: the point a press lands on, for `.m-touch` (client/src/index.css,
 * LIVING MOTION).
 *
 * A press on a card spreads a pool of light from the exact place the finger or
 * pointer landed. CSS draws it; this only says where. One delegated listener on
 * the document, so a card needs nothing but the class, and it is passive, so it
 * never delays a scroll that starts on a card.
 *
 * Each press flips `data-m-press` between "a" and "b". The two values run two
 * identical keyframes, which restarts the light without removing the attribute
 * and forcing a style flush to replay it.
 *
 * Reduced motion needs no check here: the CSS that draws the light sits inside
 * prefers-reduced-motion: no-preference, so with it the attribute changes and
 * nothing is drawn. main.tsx imports this lazily, so the first page pays only
 * for the import call.
 */
export function installTouchLight(doc: Document = document): () => void {
  const onDown = (e: PointerEvent) => {
    const target = e.target as Element | null;
    const card = target?.closest?.<HTMLElement>(".m-touch");
    if (!card) return;
    const box = card.getBoundingClientRect();
    card.style.setProperty("--m-x", `${Math.round(e.clientX - box.left)}px`);
    card.style.setProperty("--m-y", `${Math.round(e.clientY - box.top)}px`);
    card.dataset.mPress = card.dataset.mPress === "a" ? "b" : "a";
  };
  doc.addEventListener("pointerdown", onDown, { passive: true });
  return () => doc.removeEventListener("pointerdown", onDown);
}
