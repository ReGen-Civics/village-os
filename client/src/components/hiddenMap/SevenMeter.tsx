/**
 * The meter on a closed map: one slot per pin the map needs before it opens
 * (`hiddenmap.unlock_pins`, so the count is the village's dial, never a
 * constant). A slot is vouched, waiting for a vouch, or still to log.
 *
 * Colours are theme slots only: vouched in `chart-3` (the design's success
 * token falls back to it), waiting in `primary`, empty dashed in `border`.
 */
import { Sprout } from "lucide-react";
import { useLingui } from "@lingui/react/macro";

export type SlotState = "vouched" | "waiting" | "empty";

/** The slots, vouched first, then waiting, then empty. More than twelve draws as a number instead. */
export function slotsFor(needed: number, vouched: number, logged: number): SlotState[] {
  const n = Math.max(0, Math.min(12, needed));
  const v = Math.min(n, vouched);
  const w = Math.min(n - v, Math.max(0, logged - vouched));
  return [...Array(v).fill("vouched"), ...Array(w).fill("waiting"), ...Array(n - v - w).fill("empty")];
}

export default function SevenMeter({ needed, vouched, logged, glow = false }: { needed: number; vouched: number; logged: number; glow?: boolean }) {
  const { t } = useLingui();
  if (needed > 12) {
    return <p className="font-display text-3xl text-card-foreground">{t`${vouched} of ${needed}`}</p>;
  }
  const slots = slotsFor(needed, vouched, logged);
  return (
    <ol className="flex gap-2" aria-label={t`${vouched} of ${needed} vouched`}>
      {slots.map((s, i) => (
        <li
          key={i}
          className={`flex aspect-square min-w-0 flex-1 items-center justify-center rounded-xl border-2 ${
            s === "vouched"
              ? `border-chart-3 bg-chart-3/15 text-chart-3 ${glow ? "ring-4 ring-chart-3/30" : ""}`
              : s === "waiting"
                ? "border-primary bg-primary/10"
                : "border-dashed border-border"
          }`}
        >
          {s === "vouched" && <Sprout className="size-5" aria-hidden="true" />}
          {s === "waiting" && <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />}
          <span className="sr-only">{s === "vouched" ? t`vouched` : s === "waiting" ? t`waiting for a vouch` : t`still to log`}</span>
        </li>
      ))}
    </ol>
  );
}
