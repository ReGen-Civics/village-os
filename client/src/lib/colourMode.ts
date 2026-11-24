/**
 * THE VISITOR'S COLOUR MODE: light or dark, chosen in the header.
 *
 * One attribute carries it, `data-mode` on <html>, and index.css hangs both
 * worlds on it: `[data-mode="light"] .sheet-night` is the day palette and
 * `[data-mode="dark"]` promotes the night palette to the whole page. No
 * attribute at all is the look the site had before modes existed, so nothing
 * moves for a visitor until a mode is set.
 *
 * The same order is written twice, here and in the first-paint script in
 * client/index.html (which cannot import, because it must run before the
 * bundle to avoid a flash). colourMode.test.ts reads that script and holds
 * the two to each other.
 *
 *   1. the visitor's own choice, remembered in this browser;
 *   2. the device's preference (prefers-color-scheme), once MODES_LIVE, and
 *      only while FOLLOW_DEVICE is on;
 *   3. DEFAULT_MODE, once MODES_LIVE.
 */

export type Mode = "light" | "dark";

/** The localStorage key. The first-paint script in client/index.html names the same string. */
export const MODE_KEY = "village-mode";

/** The platform default when nobody has chosen and the device says nothing (the lead, 24 Nov 2026: light). */
export const DEFAULT_MODE: Mode = "light";

/**
 * Whether modes are switched on for everybody: the header shows the switch,
 * and steps 2 and 3 above apply. Off while the page families move to tokens,
 * so production looks as it did until every family is ready; a stored choice
 * (step 1) still applies, which is how a tester previews it. The first-paint
 * script carries the same flag as `live`.
 */
export const MODES_LIVE = false;

/**
 * Whether a first visit follows the device's light or dark setting. Off: the
 * lead asked for light as the default, so a first visit opens in light
 * whatever the device says, and the visitor's own choice is the only thing
 * that changes it (coordinator, 24 Nov 2026). One line to turn on; the
 * first-paint script carries the same flag as `device`.
 */
export const FOLLOW_DEVICE = false;

export function isMode(v: unknown): v is Mode {
  return v === "light" || v === "dark";
}

export function storedMode(): Mode | null {
  try {
    const v = window.localStorage.getItem(MODE_KEY);
    return isMode(v) ? v : null;
  } catch {
    return null;
  }
}

function deviceMode(): Mode | null {
  try {
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  } catch {
    /* no matchMedia */
  }
  return null;
}

/** The mode this visitor should see, or null for the look from before modes. */
export function resolveMode(live: boolean = MODES_LIVE, followDevice: boolean = FOLLOW_DEVICE): Mode | null {
  const stored = storedMode();
  if (stored) return stored;
  if (!live) return null;
  return (followDevice ? deviceMode() : null) ?? DEFAULT_MODE;
}

/** The mode on the page now, as the switch should show it. */
export function currentMode(): Mode {
  const set = document.documentElement.dataset.mode;
  return isMode(set) ? set : resolveMode(true) ?? DEFAULT_MODE;
}

/**
 * Apply a mode at once, with no reload. `remember` stores it as the visitor's
 * own choice; a private window that refuses storage keeps it for this page.
 */
export function applyMode(mode: Mode, remember: boolean): void {
  const root = document.documentElement;
  root.dataset.mode = mode;
  root.style.colorScheme = mode;
  if (!remember) return;
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* refused: the choice holds until the page is left */
  }
}
