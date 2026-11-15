/**
 * PAID ON WHAT WE TRULY ACCOMPLISH (Rye, 14 Nov 2026).
 *
 * Every role holder reads these words: before seating on the goals step of a
 * proposal (both doors), and after seating under the My moon header. They
 * say how pay works at each moon's end: goals guide the moon, the project
 * needs us to be responsive, and the End of Moon review sets what was agreed
 * beside what was delivered (progress on the member's own goals, and the
 * other tasks they took on, including work outside their roles). When the two
 * are far apart, the Treasurer may propose a different amount with a reason,
 * the member sees it and can reply, and nothing pays until the Treasurer
 * confirms. People decide any change; nothing here scores anyone.
 *
 * Kept in its own small file so the proposal form can carry it without
 * loading the End of Moon module.
 */

export const ACCOMPLISHED_PAY_WORDS = {
  title: "Goals guide us. Pay follows what you truly accomplish.",
  goals:
    "Your goals for the moon are what we agree to, and we work toward them, because that's what we're here for. This is an early-stage project, and what it needs can change mid-moon. So we stay responsive, and we're paid on what we truly accomplish.",
  review:
    "At each moon's end we look at two things together: your progress on your own goals, and the other tasks you took on, including ones outside your roles. If that's far from what you agreed, your pay can change to match, up or down.",
  confirm: "The Treasurer proposes any change with a reason. You see it and can reply, and nothing is paid until the Treasurer confirms.",
  /** The toggle under the My moon header. */
  show: "How pay works",
} as const;
