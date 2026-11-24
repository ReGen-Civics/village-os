/**
 * THE NATURAL INTERFACE KIT: one import for the whole vocabulary.
 *
 * The contract lives in docs/modules/natural-interface.md. Read the moon's
 * three rules there before using MoonProgress anywhere, and the celebration
 * intensity table before reaching for `moment`.
 *
 * The moon is not exported here: import MoonProgress and moonGeometry by path.
 * This barrel rides the first page, and re-exporting the moon pulled it and its
 * table of dates onto the first page for every visitor (vite.config.ts).
 */

export { default as BreathingLoader } from "./BreathingLoader";
export type { BreathingLoaderProps } from "./BreathingLoader";

export { default as Celebration, Blossom, Dawn, Fireflies, Ripples, Seeds } from "./Celebration";
export type { CelebrationProps } from "./Celebration";

export {
  CELEBRATION_INTENSITIES,
  CELEBRATION_KINDS,
  celebrationCount,
  celebrationDuration,
  celebrationPlan,
  STILL_STATE,
} from "./celebrationPlan";
export type { CelebrationElement, CelebrationIntensity, CelebrationKind, CelebrationPlan } from "./celebrationPlan";

export { prefersReducedMotion, useReducedMotion } from "./useReducedMotion";
export { scrollBehavior } from "./scrollBehavior";
