/**
 * REMEMBERING AN APPLICATION ON THIS DEVICE, ONLY WHEN ASKED (the Operations
 * lead's approval, 15 Nov 2026).
 *
 * The saved draft (applyDraft.ts) and the words carried to a next role
 * (applyCarry.ts) are written to this browser only after the visitor ticks
 * "Remember my answers on this device". Unticking, or the "forget" button,
 * removes every application draft and carried answer this device keeps. Nothing
 * here ever goes to the server: the application is sent only when they press
 * Send.
 *
 * A device that already holds a draft from before the box existed reads as
 * ticked, so the person sees what is kept and can forget it.
 *
 * Every read and write is wrapped: a private window, blocked storage or a
 * quota error leaves the form working and simply remembers nothing.
 */

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
