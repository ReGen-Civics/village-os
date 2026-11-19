/**
 * REMEMBERING AN APPLICATION ON THIS DEVICE (the Operations lead's approval,
 * 15 Nov 2026; ticked by default since the lead's decision of 19 Nov 2026).
 *
 * The saved draft (applyDraft.ts) and the words carried to a next role
 * (applyCarry.ts) are written to this browser while "Remember my answers on
 * this device" is ticked. It starts ticked, with a line beside it saying to
 * untick it on a shared device. Unticking, or the "forget" button, removes every
 * application draft and carried answer this device keeps, and this browser
 * remembers that choice (`REMEMBER_CHOICE_KEY`), so the box starts unticked here
 * from then on. Ticking it again clears the choice. Nothing here ever goes to
 * the server: the application is sent only when they press Send.
 *
 * A device that already holds a draft reads as ticked, so the person sees what
 * is kept and can forget it. Nothing here clears or reshapes a draft except the
 * person's own untick or forget.
 *
 * Every read and write is wrapped: a private window, blocked storage or a
 * quota error leaves the form working and simply remembers nothing.
 */

/**
 * This browser's own answer to the box, kept apart from the drafts: "off" once they untick or forget, removed when
 * they tick again. Its name starts with none of APPLY_KEY_PREFIXES (nor "apply-"), so forgetting the answers never forgets the choice and it is never read as one.
 */
export const REMEMBER_CHOICE_KEY = "propose-remember-choice";

/** Whether the box starts ticked in this browser: yes, unless the person unticked it here before. Never throws. */
export function remembersByDefault(): boolean {
  try {
    return typeof window === "undefined" || window.localStorage.getItem(REMEMBER_CHOICE_KEY) !== "off";
  } catch {
    // Blocked storage keeps nothing either way, so ticked costs nothing and the safety net reads the truth (kept: false).
    return true;
  }
}

/** Keep the person's own choice: unticked is remembered for this browser, ticked clears it. Never throws. */
export function keepRememberChoice(on: boolean): void {
  try {
    if (on) window.localStorage.removeItem(REMEMBER_CHOICE_KEY);
    else window.localStorage.setItem(REMEMBER_CHOICE_KEY, "off");
  } catch {
    // Blocked storage: the box still works for this page.
  }
}

/** The prefixes of every key the application form keeps on a device: the drafts and the carried words. */
export const APPLY_KEY_PREFIXES = ["apply-draft:", "apply-carried-draft:"] as const;

const isApplyKey = (k: string | null): k is string => !!k && APPLY_KEY_PREFIXES.some((p) => k.startsWith(p));

function keysOnDevice(): string[] {
  try {
    const store = typeof window === "undefined" ? null : window.localStorage;
    if (!store) return [];
    const out: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i);
      if (isApplyKey(k)) out.push(k);
    }
    return out;
  } catch {
    return [];
  }
}

/** Whether this device keeps any application draft or carried answers. */
export function remembersAnything(): boolean {
  return keysOnDevice().length > 0;
}

/** Forget every application draft and carried answer on this device. How many were removed. Never throws. */
export function forgetApplyAnswers(): number {
  let removed = 0;
  for (const k of keysOnDevice()) {
    try {
      window.localStorage.removeItem(k);
      removed += 1;
    } catch {
      // Blocked storage: nothing more this device can do, and nothing was sent anywhere.
    }
  }
  return removed;
}
