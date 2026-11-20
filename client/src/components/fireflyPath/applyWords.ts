/**
 * THE APPLICATION'S OWN STEP WORDS (pages/ProposeARole.tsx): each step's name, the line under its heading, the
 * starters for "Why you, and why now", and About you's pane names. Kept here so the page stays under the
 * file-lines ratchet (scripts/check-file-lines.mjs) and the words sit in one place.
 */
import { useLingui } from "@lingui/react/macro";

export function useApplyWords() {
  const { t } = useLingui();
  const labels = [
    t({ message: "Get to know us", context: "founding application step" }),
    t({ message: "About you", context: "founding application step" }),
    t({ message: "Your value", context: "founding application step" }),
    t({ message: "The terms", context: "founding application step" }),
    t({ message: "Your first moon", context: "founding application step" }),
    t({ message: "Review & submit", context: "founding application step" }),
  ] as const;
  const intro = [
    t({ message: "Before you apply, come and meet us.", context: "founding application intro" }),
    t({ message: "Who you are, and why this role, now. A few honest lines is enough: the people who decide read every word.", context: "founding application intro" }),
    t({ message: "The value you would bring in your first months, item by item.", context: "founding application intro" }),
    t({ message: "A starting point we agree together.", context: "founding application intro" }),
    t({ message: "What your first moon with us would look like, step by step, and when you could begin.", context: "founding application intro" }),
    t({ message: "Read it through once, then send. Nothing reaches us until you confirm your email.", context: "founding application intro" }),
  ];
  const starters = [
    t({ message: "What I have built before:", context: "founding application why starter" }),
    t({ message: "Why this role:", context: "founding application why starter" }),
    t({ message: "Why now:", context: "founding application why starter" }),
    t({ message: "What I would bring in my first month:", context: "founding application why starter" }),
  ];
  const paneNames = [
    t({ message: "You", context: "founding application about pane" }),
    t({ message: "Your story", context: "founding application about pane" }),
    t({ message: "Who can speak for you", context: "founding application about pane" }),
  ] as const;
  return { labels, intro, starters, paneNames };
}
