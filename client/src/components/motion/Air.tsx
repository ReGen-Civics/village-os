/**
 * AIR: the hero's atmosphere (LIVING MOTION, motion lane). Two movements in one
 * quiet layer, drawn between the photograph and the words:
 *
 *   CANOPY LIGHT. Three soft pools of light drift under a leaf shade on 19 to
 *   27 second loops. Their colour comes from the VILLAGE'S OWN HOUR
 *   (config.season.timezone): cool at first light, white at noon, amber at
 *   golden hour, a moonlit teal at night. A visitor anywhere sees the light it
 *   is on the land right now. This file only names the part of the day
 *   (data-day); the colours are tokens in motion.css, so a village re-tunes
 *   its own light there.
 *
 *   SPORE DRIFT and FIREFLIES. The same few points of light, read by the mode:
 *   in a light (day) world they are pollen and spores rising slowly through
 *   the light; in the night world they are fireflies that glow and fade on 7 to
 *   12 second cycles, far below any flash threshold.
 *
 * Cost and care, because this is the one ambient layer on the site:
 *   - Home loads this lazily, after first paint, and only on a capable device
 *     (lib/airWelcome.ts). Home is already a lazy page, so the first page pays
 *     nothing for it.
 *   - Transform and opacity only; blur is baked into gradients, never a live
 *     filter. Twelve motes on a desk, eight on a phone.
 *   - It pauses off screen (lib/inView.ts), in a hidden tab, and RESTS after
 *     twenty seconds without input (useRest), waking on the next.
 *   - Reduce motion: Home never loads it. It is decoration (aria-hidden) and
 *     the hero reads the same without it.
 */
import { useEffect, useRef, useState } from "react";
import { useRest } from "@/components/journey/nature/useRest";
import { observeInView } from "@/lib/inView";
import "./motion.css";

/** The parts of the village's day, by the hour they begin (0 to 24). motion.css colours each one. */
export const DAY_PARTS = [
  { at: 0, part: "night" },
  { at: 5.5, part: "dawn" },
  { at: 8, part: "morning" },
  { at: 12, part: "noon" },
  { at: 16.5, part: "golden" },
  { at: 18.2, part: "dusk" },
  { at: 19.5, part: "night" },
] as const;

export type DayPart = (typeof DAY_PARTS)[number]["part"];

/** The part of the day an hour falls in. */
export function partOfDay(hour: number): DayPart {
  const h = ((hour % 24) + 24) % 24;
  let pick: DayPart = "night";
  for (const k of DAY_PARTS) if (h >= k.at) pick = k.part;
  return pick;
}

/** The hour it is now in `timeZone`, as a decimal (17.5 is half past five). Falls back to the device's hour. */
export function villageHour(timeZone: string | undefined, now: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timeZone || undefined, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    const m = Number(parts.find((p) => p.type === "minute")?.value);
    if (Number.isFinite(h) && Number.isFinite(m)) return h + m / 60;
  } catch {
    /* an unknown zone: the device's own hour below */
  }
  return now.getHours() + now.getMinutes() / 60;
}

/** Twelve motes, placed by a stable hash so the air is the same each visit. */
const MOTES = Array.from({ length: 12 }, (_, i) => {
  const r = (n: number) => {
    const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  return {
    x: `${(r(1) * 88 + 6).toFixed(1)}%`,
    y: `${(r(2) * 60 + 25).toFixed(1)}%`,
    s: `${(2.5 + r(3) * 2.5).toFixed(1)}px`,
    t: `${(7 + r(4) * 5).toFixed(1)}s`,
    dl: `-${(r(5) * 10).toFixed(1)}s`,
    dx: `${Math.round((r(6) - 0.5) * 50)}px`,
  };
});

export default function Air({ timeZone }: { timeZone?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  const resting = useRest(true);
  const [hour, setHour] = useState(() => villageHour(timeZone));

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    return observeInView(el, setOnScreen);
  }, []);

  useEffect(() => {
    setHour(villageHour(timeZone));
    const id = window.setInterval(() => setHour(villageHour(timeZone)), 5 * 60_000);
    return () => window.clearInterval(id);
  }, [timeZone]);

  return (
    <div
      ref={root}
      className="m-air"
      aria-hidden="true"
      data-motion="air"
      data-paused={!onScreen || resting || undefined}
      data-day={partOfDay(hour)}
    >
      <div className="m-dapple" style={{ ["--x" as string]: "52%", ["--y" as string]: "-8%", ["--dx" as string]: "18px", ["--dy" as string]: "10px", ["--t" as string]: "19s" }} />
      <div className="m-dapple" style={{ ["--x" as string]: "72%", ["--y" as string]: "18%", ["--dx" as string]: "-14px", ["--dy" as string]: "16px", ["--t" as string]: "23s" }} />
      <div className="m-dapple" style={{ ["--x" as string]: "38%", ["--y" as string]: "42%", ["--dx" as string]: "12px", ["--dy" as string]: "-12px", ["--t" as string]: "27s" }} />
      <div className="m-leafshade" />
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="m-mote"
          style={{ ["--x" as string]: m.x, ["--y" as string]: m.y, ["--s" as string]: m.s, ["--t" as string]: m.t, ["--dl" as string]: m.dl, ["--dx" as string]: m.dx }}
        />
      ))}
    </div>
  );
}
