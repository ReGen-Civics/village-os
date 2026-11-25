/**
 * THE SACRED-GEOMETRY GLYPHS: the platform's own icons where a stock icon was
 * arbitrary (the lead, 24 Nov 2026: "any icons like these that are arbitrary
 * should follow sacred geometry").
 *
 * One hand for all of them, after the brand's icon rule: a fine monoline in
 * currentColor, round caps and joins, no fill, drawn on a 24 grid so each one
 * drops in wherever a lucide icon sat (same `className` sizing). The geometry is
 * the structure, never decoration, as docs/DESIGN_RULE.md's organic art
 * direction asks: circles on a hexagon, the vesica, the golden spiral.
 *
 * Original drawings, computed here; nothing is copied from anywhere.
 */
import type { SVGProps } from "react";

export type GlyphProps = { className?: string } & Omit<SVGProps<SVGSVGElement>, "children">;

/** The one hand every glyph is drawn in; components/sacred/living.tsx draws with it too. */
export function Svg({ className, children, ...rest }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

const hex = (r: number, phase = -90) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = ((phase + k * 60) * Math.PI) / 180;
    return [12 + r * Math.cos(a), 12 + r * Math.sin(a)] as const;
  });

/** Seed of Life: seven circles of one radius, six on a hexagon around the seventh. A circle of the village. */
export function SeedOfLife(props: GlyphProps) {
  const r = 3.9;
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r={r} />
      {hex(r).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={r} />
      ))}
    </Svg>
  );
}

/** The vesica: two circles, each through the other's centre. Something begun, still growing. */
export function Vesica(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="9.5" cy="12" r="5.5" />
      <circle cx="14.5" cy="12" r="5.5" />
    </Svg>
  );
}

/** Three circles meeting at the centre: roles held together. */
export function Triad(props: GlyphProps) {
  const r = 4.6;
  return (
    <Svg {...props}>
      {[-90, 30, 150].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return <circle key={deg} cx={12 + 3.4 * Math.cos(a)} cy={12.6 + 3.4 * Math.sin(a)} r={r} />;
      })}
    </Svg>
  );
}

/** The lotus, opening: three vesica petals on a still line of water. Home. */
export function Lotus(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M12 4.5c-3 3.6-3 9.4 0 13.5 3-4.1 3-9.9 0-13.5Z" />
      <path d="M12 18c-4.3-.6-7.2-3.9-7.3-8.4 3.6.6 6.4 3.4 7.3 8.4Z" />
      <path d="M12 18c4.3-.6 7.2-3.9 7.3-8.4-3.6.6-6.4 3.4-7.3 8.4Z" />
      <path d="M5.5 20.5h13" />
    </Svg>
  );
}

/** A small labyrinth: three rings, each opened toward the next. A quest is walked, not taken. */
export function Labyrinth(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M12 3a9 9 0 1 1-8.2 5.3" />
      <path d="M12 6a6 6 0 1 0 5.4 3.4" />
      <path d="M12 9a3 3 0 1 1-2.6 1.5" />
    </Svg>
  );
}

/** Three points on the circle's triangle: more to find. */
export function Tripoint(props: GlyphProps) {
  return (
    <Svg {...props}>
      {hex(5.2).filter((_, i) => i % 2 === 0).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y + 1} r="1.7" />
      ))}
    </Svg>
  );
}

/** The golden spiral (growth by the golden ratio), opening from the centre. The guide, the way on. */
const SPIRAL = (() => {
  const b = Math.log((1 + Math.sqrt(5)) / 2) / (Math.PI / 2);
  const pts: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = (i / 80) * 3.3 * Math.PI;
    const r = 0.32 * Math.exp(b * t);
    pts.push(`${(12 + r * Math.cos(t + 1.2)).toFixed(2)} ${(12 + r * Math.sin(t + 1.2)).toFixed(2)}`);
  }
  return `M${pts.join("L")}`;
})();
export function GoldenSpiral(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d={SPIRAL} />
    </Svg>
  );
}

/** Day: a still centre with six points of light on its hexagon. */
export function DaySun(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.6" />
      {hex(7.2).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.1" />
      ))}
    </Svg>
  );
}

/** Night: the crescent left where one circle passes over another. */
export function NightMoon(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M15.6 4.3a8 8 0 1 0 4.1 11.4 6.4 6.4 0 0 1-4.1-11.4Z" />
    </Svg>
  );
}
