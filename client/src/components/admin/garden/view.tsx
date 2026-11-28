/**
 * THE VIEW SWITCH: which leads this page, the guide or the dashboard.
 *
 * The founder, on the first photographs of the frame: "I don't see the toggle
 * to switch from AI first to the other dashboard." The small arrows in the
 * dock's corner were the only way, and he looked and did not find one. So the
 * band carries one clear, labelled, two-sided control, with the side you are
 * on marked:
 *
 *   Guide first   her conversation leads and what you see sits beside it
 *                 (the dock state `expanded`).
 *   Dashboard     the grounds or the desk leads, with her docked beside it
 *                 (`docked`). With her closed, this is the marked side too.
 *
 * It sets the same `useGardenDock` value the page already holds, so the
 * dock's own corner arrows and this switch never disagree; the arrows stay as
 * a second way. Pressing the side you are already on changes nothing: with
 * her closed, Dashboard leaves her closed.
 *
 * WHERE THE FRAME IS ONE COLUMN there is nothing to switch, because she is
 * first and the places follow in both states, so the switch steps back there
 * (a container rule in garden.css), as the lens toggle does on a phone.
 *
 * It sits in the band beside the lens toggle (`switches` on StatusBand), so a
 * person always sees where they are and where else they can go.
 */
import { Trans, useLingui } from "@lingui/react/macro";
import type { GardenDock } from "./frame";
import "./garden.css";

export interface ViewSwitchProps {
  /** Where the guide's dock stands and the way to move it: the page's own `useGardenDock` value. */
  dock: GardenDock;
  className?: string;
}

const VIEW_BUTTON = "jw-btn inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold";

export function ViewSwitch({ dock, className = "" }: ViewSwitchProps) {
  const { t } = useLingui();
  const guideFirst = dock.state === "expanded";
  return (
    <div role="group" aria-label={t({ message: "What leads this page", context: "garden view switch" })} className={`gd-lens gd-view w-fit gap-1 rounded-xl p-1 ${className}`.trim()}>
      <button type="button" aria-pressed={guideFirst} onClick={() => (guideFirst ? undefined : dock.setState("expanded"))} className={VIEW_BUTTON}>
        <Trans context="garden view switch">Guide first</Trans>
      </button>
      <button type="button" aria-pressed={!guideFirst} onClick={() => (guideFirst ? dock.setState("docked") : undefined)} className={VIEW_BUTTON}>
        <Trans context="garden view switch">Dashboard</Trans>
      </button>
    </div>
  );
}
