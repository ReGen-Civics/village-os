/**
 * ONE DOOR INTO MAKE THIS YOURS (the lead, 26 Nov 2026).
 *
 * Every way into the setup page lands on a step, never just the top of a long
 * page:
 *
 *   /admin?tab=setup&step=<id>   that step (a launch row, the AI banner, the map)
 *   /admin?tab=setup             the first step that is not done yet
 *
 * A step is found by its element id, `setup-step-<id>`: SetupSection gives
 * every numbered step one, and a panel between steps (the purpose statement)
 * carries its own. `step` leaves the address once it has been used, so a later
 * reload or a shared link does not keep jumping.
 *
 * WAITING FOR THE READINGS. The guide and the needs steps are read from other
 * endpoints, and before those answer they read `unknown`. Landing on the first
 * unknown row would put a village whose guide is connected on step 1 for the
 * half second before the read lands, so with no `step` asked for, the landing
 * waits until both have answered. An asked-for step lands as soon as the steps
 * are drawn: before the brand record arrives the page is only "Loading...",
 * and there is no step to scroll to.
 */
import { useEffect, useRef } from "react";
import type { SetupRow, SetupStepKey } from "./setupProgress";

/** The element id a step, or a panel between steps, carries. */
export const setupStepId = (step: string) => `setup-step-${step}`;

/** The steps read from elsewhere, which must answer before "first not done" means anything. */
const READ_ELSEWHERE: readonly SetupStepKey[] = ["guide", "needs"];

/**
 * Where to land, or null when there is nowhere to go yet (`wait`) or nowhere
 * at all (every step done and none asked for).
 */
export function landingStep(rows: readonly SetupRow[] | null, asked: string | null): { step: string | null; wait: boolean } {
  // Nothing is drawn until the record arrives, so even an asked-for step waits for it.
  if (!rows) return { step: null, wait: true };
  if (asked) return { step: asked, wait: false };
  if (rows.some((r) => READ_ELSEWHERE.includes(r.key) && r.state === "unknown")) return { step: null, wait: true };
  return { step: rows.find((r) => r.state !== "done")?.key ?? null, wait: false };
}

/** Takes `step` out of the address, keeping everything else. */
function dropStepParam(): void {
  const p = new URLSearchParams(window.location.search);
  if (!p.has("step")) return;
  p.delete("step");
  const q = p.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`);
}

/** Lands the setup page once per visit: on the asked-for step, or the first one not done. */
export function useSetupLanding(rows: readonly SetupRow[] | null): void {
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current) return;
    const asked = new URLSearchParams(window.location.search).get("step");
    const { step, wait } = landingStep(rows, asked);
    if (wait) return;
    landed.current = true;
    dropStepParam();
    if (!step) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const go = (smooth: boolean) => {
      const el = document.getElementById(setupStepId(step));
      el?.scrollIntoView?.({ block: "start", behavior: smooth && !still ? "smooth" : "auto" });
    };
    // After the tab change's own scroll to the top, and after the step has drawn.
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => go(true));
    else go(true);
    holdWhileSettling(() => go(false));
  });
}

/** How long the landing keeps its step in view while panels above it finish loading. */
export const SETTLE_MS = 2000;

/**
 * THE PAGE GROWS AFTER THE LANDING. The panels above a late step (the look,
 * typography, sounds) load their own data and get taller after the scroll, so
 * a landing on Map ended inside Pictures. For a short while, each time the page
 * changes size the step is brought back into view, and the hold lets go the
 * moment the person scrolls, taps or types: their hand always wins.
 */
function holdWhileSettling(again: () => void): void {
  if (typeof ResizeObserver === "undefined") return;
  const grow = new ResizeObserver(() => again());
  const stop = () => {
    grow.disconnect();
    for (const e of HANDS) window.removeEventListener(e, stop);
  };
  grow.observe(document.body);
  for (const e of HANDS) window.addEventListener(e, stop, { once: true, passive: true });
  setTimeout(stop, SETTLE_MS);
}

/** What counts as the person taking over the scroll. */
const HANDS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/** Opens the setup page on one step, for a door inside Admin. */
export function openSetupStep(onOpenTab: (tab: string) => void, step: string): void {
  const p = new URLSearchParams(window.location.search);
  p.set("step", step);
  window.history.replaceState(window.history.state, "", `${window.location.pathname}?${p.toString()}`);
  onOpenTab("setup");
}
