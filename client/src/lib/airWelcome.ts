/**
 * Whether a visit gets the hero's AIR (components/motion/Air.tsx): motion
 * allowed, a device with cores and memory to spare, and no request to save
 * data. Unknown counts as capable, so a browser that hides deviceMemory
 * (Safari, Firefox) still gets the air; reduced motion and save-data are the
 * hard stops. Here, not in Air.tsx, so the page can decide without loading it.
 */
export function airWelcome(env: { reduced: boolean; cores?: number; memoryGB?: number; saveData?: boolean }): boolean {
  if (env.reduced || env.saveData) return false;
  if (env.cores !== undefined && env.cores < 4) return false;
  if (env.memoryGB !== undefined && env.memoryGB < 4) return false;
  return true;
}

/** The same question, asked of this browser. */
export function airWelcomeHere(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  let reduced = true;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    /* no matchMedia: stay still */
  }
  return airWelcome({ reduced, cores: nav.hardwareConcurrency || undefined, memoryGB: nav.deviceMemory, saveData: nav.connection?.saveData });
}
