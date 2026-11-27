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
 *   3. the village's own default, the dial look.default_mode, which the server
 *      writes onto <html> as data-village-mode in every page it sends
 *      (server/routes/brandTheme.ts), once MODES_LIVE;
 *   4. DEFAULT_MODE, once MODES_LIVE.
 */

export type Mode = "light" | "dark";

/** The localStorage key. The first-paint script in client/index.html names the same string. */
export const MODE_KEY = "village-mode";

/** The window event applyMode sends, so every control showing the mode stays in step. */
export const MODE_CHANGED = "village-mode-changed";

/**
 * The platform default when nobody has chosen, the device says nothing and the
 * village has set no default of its own (the lead, 26 Nov 2026: light for the
 * platform, and a village picks its own with look.default_mode).
 */
export const DEFAULT_MODE: Mode = "light";

/** The attribute the server puts on <html> carrying the village's default mode. The first-paint script reads the same name. */
export const VILLAGE_MODE_ATTR = "data-village-mode";

/**
 * Whether modes are switched on for everybody: the header shows the switch,
 * and steps 2 and 3 above apply. On since 1.3.66, after the contrast audits of
 * every public and signed-in page in both modes (24 Nov 2026). Off, a stored
 * choice (step 1) still applies and nothing else does, which is how a tester
 * previews a change. The first-paint script carries the same flag as `live`.
 */
export const MODES_LIVE = true;

/**
 * Whether a first visit follows the device's light or dark setting. Off: a
 * first visit opens in the village's default (or DEFAULT_MODE) whatever the
 * device says, and the visitor's own choice is the only thing that changes it. One line to turn on; the
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

/** The village's own default, as the server wrote it onto <html>, or null when it wrote none. */
export function villageMode(): Mode | null {
  try {
    const v = document.documentElement.getAttribute(VILLAGE_MODE_ATTR);
    return isMode(v) ? v : null;
  } catch {
    return null;
  }
}

/** The mode this visitor should see, or null for the look from before modes. */
export function resolveMode(live: boolean = MODES_LIVE, followDevice: boolean = FOLLOW_DEVICE): Mode | null {
  const stored = storedMode();
  if (stored) return stored;
  if (!live) return null;
  return (followDevice ? deviceMode() : null) ?? villageMode() ?? DEFAULT_MODE;
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
  // Every control showing the mode (the header's switch, the settings page's choice) hears it change.
  try {
    window.dispatchEvent(new Event(MODE_CHANGED));
  } catch {
    /* an old browser without Event construction: the controls catch up on their next draw */
  }
  if (!remember) return;
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* refused: the choice holds until the page is left */
  }
}
