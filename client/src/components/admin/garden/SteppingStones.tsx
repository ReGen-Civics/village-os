/**
 * STEPPING STONES: the quest log. A walked stone is a gold ring, the stone you
 * stand on is gold, a stone ahead waits as a dashed ring.
 *
 * An ordered list, with `aria-current="step"` on the stone you stand on. There
 * is only ever one: if a caller marks two as current, the first stands and the
 * rest wait. Each stone may be a link or a button.
 *
 * Fireflies may gather around the stone you stand on and nowhere else. They
 * are off unless `fireflies` is set, so a screen whose one next act is a
 * button elsewhere keeps its one light there.
 */
import { Link } from "wouter";
import { Trans } from "@lingui/react/macro";
import Fireflies from "./Fireflies";
import "./garden.css";

export type StoneState = "walked" | "current" | "ahead";

export interface Stone {
  /** A stable id, unique in the list. */
  id: string;
  /** The step, in plain words. */
  label: string;
  state: StoneState;
  /** One quiet line under the label, in the caller's words (where it is done, what it waits on). */
  detail?: string;
  /** Where the stone leads. Given, the stone is a link. */
  href?: string;
  /** What pressing the stone does. Given without `href`, the stone is a button. */
  onPress?: () => void;
}

export interface SteppingStonesProps {
  /** The stones, in the order they are walked. */
  stones: readonly Stone[];
  /** What the list is, for a screen reader ("The road to launch"). */
  label: string;
  /** Gather the fireflies around the stone you stand on. Only where that stone is the screen's one next act. */
  fireflies?: boolean;
  className?: string;
}

export default function SteppingStones({ stones, label, fireflies = false, className = "" }: SteppingStonesProps) {
  const standsAt = stones.findIndex((s) => s.state === "current");
  return (
    <ol aria-label={label} className={`m-0 flex list-none flex-col gap-1 p-0 ${className}`.trim()}>
      {stones.map((stone, i) => {
        const state: StoneState = stone.state === "current" && i !== standsAt ? "ahead" : stone.state;
        const here = state === "current";
        const shared = { className: "gd-stone-row", "data-state": state, "aria-current": here ? ("step" as const) : undefined };
        const inner = (
          <>
            <span className="gd-stone" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className={`block text-sm ${here ? "font-semibold" : "font-medium"}`}>{stone.label}</span>
              {stone.detail ? <span className="block text-xs text-muted-foreground">{stone.detail}</span> : null}
            </span>
            {state === "walked" ? (
              <span className="sr-only">
                <Trans context="garden stepping stone, said after a walked stone's name">Walked</Trans>
              </span>
            ) : null}
          </>
        );
        const row = stone.href ? (
          <Link href={stone.href} {...shared}>
            {inner}
          </Link>
        ) : stone.onPress ? (
          <button type="button" onClick={stone.onPress} {...shared}>
            {inner}
          </button>
        ) : (
          <span {...shared}>{inner}</span>
        );
        return <li key={stone.id}>{here && fireflies ? <Fireflies block>{row}</Fireflies> : row}</li>;
      })}
    </ol>
  );
}
