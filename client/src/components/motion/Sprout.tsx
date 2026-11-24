/**
 * SPROUT: the thank-you's drawing (LIVING MOTION, motion lane, 24 Nov 2026).
 *
 * A seed lands, roots reach down, a stem rises and two leaves unfurl, once,
 * in about two seconds, and then it holds still. It stands where a check mark
 * stood on a form's thank-you, because what was sent is something planted.
 *
 * The drawing is complete in the markup: no dash, offset or transform is set
 * here, so with "reduce motion", without the stylesheet, or before it loads,
 * this is a whole seedling. The growing lives in motion.css, inside
 * prefers-reduced-motion: no-preference. It is decorative (aria-hidden); the
 * words beside it carry the meaning and are there from the first frame.
 *
 * Colour: the line is currentColor, so the caller picks it with a text class
 * (text-open for the living green). The seed is the gold notice token. The
 * strokes are 1.6px at any size (non-scaling), the brand's monoline.
 */
import "./motion.css";

export default function Sprout({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" className={`m-sprout ${className}`} data-motion="sprout">
      <path className="m-line m-soil" d="M10 52C22 49 42 49 54 52" />
      <path className="m-line m-root" pathLength={1} d="M32 51C30 55 27 58 23 60M32 51C34 55 37 58 41 60M32 51V61" />
      <ellipse className="m-seed" cx="32" cy="50" rx="3.4" ry="2.6" />
      <path className="m-line m-stem" pathLength={1} d="M32 50C31.4 42 32.6 34 32 24" />
      <path className="m-leaf m-leaf-l" d="M32 33C26 32 18 27 15 19C23 19 30 24 32 33Z" />
      <path className="m-leaf m-leaf-r" d="M32 28C37 25 45 19 48 11C40 12 34 19 32 28Z" />
    </svg>
  );
}
