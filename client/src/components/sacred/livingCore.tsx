/**
 * THE LIVING GLYPHS THE FIRST PAGE DRAWS: the menu and the tab bar. The rest of
 * the family is in living.tsx, which re-exports these, so a page imports every
 * glyph from one place.
 *
 * Split out for the bundle, not for meaning. A module lands in one chunk whole,
 * so while the tab bar imported living.tsx, every glyph any page used rode on
 * the first page with it. The first page now carries these ten and nothing
 * else; the others stay in the lazy chunks of the pages that draw them.
 * living.tsx says how they are drawn and holds the test of the house style.
 */
import { forwardRef, type ReactElement } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { Svg, type GlyphProps } from "./glyphs";

/**
 * A drawing made a drop-in for a lucide icon: the same props (size, color,
 * strokeWidth) and lucide's default 24px box, so a page swaps the import and
 * nothing else. Our 1.5 stroke stays unless the page asks for another.
 */
export function asIcon(name: string, Drawing: (props: GlyphProps) => ReactElement): LucideIcon {
  // Like lucide's `lucide lucide-<name>`, so a test or a stylesheet can find a glyph by what it draws.
  const named = `living living-${name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
  const Icon = forwardRef<SVGSVGElement, LucideProps>(function LivingGlyph({ size = 24, color, strokeWidth, absoluteStrokeWidth: _unused, className, ...rest }, ref) {
    void _unused;
    return (
      <Drawing
        ref={ref}
        width={size}
        height={size}
        className={className ? `${named} ${className}` : named}
        {...(color ? { stroke: color } : {})}
        {...(strokeWidth !== undefined ? { strokeWidth } : {})}
        {...rest}
      />
    );
  });
  Icon.displayName = name;
  return Icon as unknown as LucideIcon;
}

export const Dot = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

/** A soft wash inside a shape (a petal, a leaf), still in currentColor so any tint reaches it. */
export const WASH = { fill: "currentColor", fillOpacity: 0.18 } as const;


/** A living cell, its membrane uneven and reaching: a role, a living unit of the village with its own purpose (the lead, 24 Nov 2026: not a shield). */
function CellDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path data-part="membrane" d="M11.6 3.4c3.2-.3 5.6 1.3 6.6 3.4.5 1.1 1.8 1.4 2.4 2.6.8 1.6-.4 2.8-.4 4.4 0 3.8-3.4 6.9-7.8 6.9-4.6 0-8.4-3-8.4-7.6 0-1.8.9-3 1-4.4.3-2.8 3-5 6.6-5.3z" />
      <ellipse data-part="nucleus" cx="12.8" cy="11.2" rx="3.2" ry="2.7" transform="rotate(-18 12.8 11.2)" />
      <Dot cx={13.5} cy={10.7} r={1} />
      <ellipse cx="7.6" cy="15.4" rx="1.6" ry="0.9" transform="rotate(-30 7.6 15.4)" />
      <Dot cx={16.6} cy={16.2} r={0.8} />
      <Dot cx={8.6} cy={8.2} r={0.65} />
    </Svg>
  );
}
/** A leaf turned to the sun, with a few rays: a livelihood from sunlight (prosperity, energy, a milestone marked). */
function SunLeafDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M6 19.6c-.6-6.4 3.4-11.6 10.6-12.4.8 7.2-4.2 12.2-10.6 12.4z" />
      <path d="M6 19.6l7.6-8M18.6 4.4l.6-1.6M20.4 6.2l1.6-.6M16.6 3.6l-.2-1.4" />
    </Svg>
  );
}
/** An egg-shaped home grown from the ground, a sprout on top, the sun beside it: a resident's home. */
function SeedPodHomeDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3 20h18" />
      <path {...WASH} d="M12 5.6c3.6 0 6 3.8 6 8.2 0 3.4-1.4 6.2-6 6.2s-6-2.8-6-6.2c0-4.4 2.4-8.2 6-8.2z" />
      <path d="M12 5.6V3.4M12 4.4c-1-1-2.2-1.1-2.8-.6.6.9 1.7 1.1 2.8.6zM12 4c.9-.9 2-1 2.6-.6-.5.8-1.6 1-2.6.6z" />
      <circle cx="12" cy="11.4" r="2" />
      <path d="M10.8 20v-2.6a1.2 1.2 0 0 1 2.4 0V20M19.6 6.4l1.4-.8M20 9.2h1.6" />
    </Svg>
  );
}
/** Stepping stones along a curving path toward a light, each smaller as it goes: the walk ahead (quests). */
function SteppingStonesDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <ellipse cx="5.6" cy="19.4" rx="2.8" ry="1.15" />
      <ellipse cx="11.6" cy="17.2" rx="2.4" ry="1" transform="rotate(-8 11.6 17.2)" />
      <ellipse cx="15.6" cy="13.2" rx="2" ry="0.85" transform="rotate(-18 15.6 13.2)" />
      <ellipse cx="17.2" cy="8.8" rx="1.6" ry="0.7" transform="rotate(-30 17.2 8.8)" />
      <Dot cx={16.6} cy={4.6} r={1.1} />
    </Svg>
  );
}
/** Six cells around a shared centre: many roles, one circle. Pairs with Cell (circles). */
function CellRingDrawing(props: GlyphProps) {
  const ring: [number, number, number, number][] = [
    [12, 5.4, 12.4, 5.1],
    [17.7, 8.7, 17.9, 8.4],
    [17.7, 15.3, 17.4, 15.6],
    [12, 18.6, 11.6, 18.9],
    [6.3, 15.3, 6.1, 15],
    [6.3, 8.7, 6.6, 8.4],
  ];
  return (
    <Svg {...props}>
      {ring.map(([x, y, nx, ny]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={2.4} />
          <Dot cx={nx} cy={ny} r={0.7} />
        </g>
      ))}
      <circle cx="12" cy="12" r="1.6" />
    </Svg>
  );
}

/** A tree's crown on a branching, tapering trunk: leadership that shelters (the steward). */
function TreeCrownDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M3.4 12.2c-.6-2.2.8-4 2.8-4.2.6-2.4 2.8-4 5.4-3.8 1.8-1.2 4.4-.8 5.6.8 2.2.2 3.6 1.8 3.4 3.8.8.6 1.2 1.6 1 2.6-.1.4-.3.6-.6.8z" />
      <path d="M11.2 20.6c.3-2.4.4-5 .2-8.4M12.8 20.6c-.3-2.4-.4-5-.2-8.4M11.6 15.4c-1.2-.6-2.6-1.6-3.4-3.2M12.4 14.6c1.2-.4 2.4-1.2 3.4-2.4M9.4 20.6h5.2" />
    </Svg>
  );
}
/** A seed with its seam: an idea, something to plant. */
function SeedDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M12 3.6c3.5 3.2 5 6.6 5 9.9s-2.2 6.7-5 6.7-5-3.3-5-6.7 1.5-6.7 5-9.9z" />
      <path d="M12 8.2v8.6" />
    </Svg>
  );
}
/** A hand holding a heap of seeds: value you can hold and plant (money, where a price must be clear). */
function SeedHandDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 14.4c2.2 0 3.6.6 5 1.6h3c1 0 1.4 1.3.4 1.6l-3.2.4M3.6 19.4h4.8c2.4 0 4.6-.6 6.6-1.8l4.2-2.8c.9-.6.2-2-.9-1.6l-4.6 2" />
      {[
        [10.8, 13.3, -20],
        [13.3, 13.5, 10],
        [15.8, 12.8, 35],
        [12, 11.1, 60],
        [14.6, 10.7, -30],
        [13.2, 8.8, 15],
      ].map(([x, y, a]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={1.3} ry={0.9} transform={`rotate(${a} ${x} ${y})`} fill="currentColor" stroke="none" />
      ))}
    </Svg>
  );
}

/** An earthship dome: a rounded home bermed into the earth, its glass front to the sun, a living roof (home). */
function EarthshipDomeDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3 19.6h18" />
      {/* The earth it is bermed into, held against both sides. */}
      <path {...WASH} d="M3 19.6c.6-3 1.8-5.2 3.6-6.2-.9 1.9-1.4 3.9-1.4 6.2zM21 19.6c-.6-3-2-5.2-3.8-6.2.9 1.9 1.4 3.9 1.4 6.2z" />
      <path d="M5.2 19.6C5.2 12.8 8.2 8 12 8s6.8 4.8 6.8 11.6" />
      <path d="M8.8 19.6v-3.4a3.2 3.2 0 0 1 6.4 0v3.4M12 13v6.6M8.8 16.6h6.4" />
      <path d="M12 8V6.2M12 6.8c.7-1 1.8-1.3 2.6-1-.4.9-1.5 1.3-2.6 1z" />
    </Svg>
  );
}
/** Two leaves that meet as a heart on one stem: thanks that grows between two people (gratitude). */
function HeartLeafDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M12 19.4C7.6 16.4 4.2 13.2 4.4 9.4c.2-2.8 3-4.2 5.2-3.2 1.2.5 2 1.4 2.4 2.4" />
      <path {...WASH} d="M12 19.4c4.4-3 7.8-6.2 7.6-10-.2-2.8-3-4.2-5.2-3.2-1.2.5-2 1.4-2.4 2.4z" />
      <path d="M12 17.2c-1.8-1.6-3.6-3.6-5-6.2M12 19.4v1.8" />
    </Svg>
  );
}
/* The four paths' glyphs and the seed: the menu draws each path by one, and the bar draws the reader's (config/nav.ts, config/mobileNav.ts PATH_GLYPHS). */
export const Cell = /* @__PURE__ */ asIcon("Cell", CellDrawing);
export const CellRing = /* @__PURE__ */ asIcon("CellRing", CellRingDrawing);
export const SteppingStones = /* @__PURE__ */ asIcon("SteppingStones", SteppingStonesDrawing);
export const SeedPodHome = /* @__PURE__ */ asIcon("SeedPodHome", SeedPodHomeDrawing);
export const SunLeaf = /* @__PURE__ */ asIcon("SunLeaf", SunLeafDrawing);
export const TreeCrown = /* @__PURE__ */ asIcon("TreeCrown", TreeCrownDrawing);
export const Seed = /* @__PURE__ */ asIcon("Seed", SeedDrawing);
export const SeedHand = /* @__PURE__ */ asIcon("SeedHand", SeedHandDrawing);
export const EarthshipDome = /* @__PURE__ */ asIcon("EarthshipDome", EarthshipDomeDrawing);
export const HeartLeaf = /* @__PURE__ */ asIcon("HeartLeaf", HeartLeafDrawing);
