/**
 * THE LIVING GLYPHS: the biological companions to the sacred geometry in
 * glyphs.tsx (motion lane, 24 Nov 2026; the lead: "I don't want roles to be a
 * shield, let's do something like a biological cell or mycelia").
 *
 * Drawn with glyphs.tsx's own Svg, by agreement with the lane that owns it: a fine
 * monoline in currentColor, 1.5 stroke, round caps and joins, on a 24 grid,
 * aria-hidden, so each drops in wherever a lucide or sacred glyph sat and takes
 * the tab bar's active tint. The only fills are a few small dots in
 * currentColor (a nucleolus, an organelle, a knot), which read at 22px where a
 * stroke ring would close up.
 *
 * Each one is the still form of a movement in the motion system (index.css,
 * LIVING MOTION): the cell's membrane breathes, the mycelium's threads draw,
 * the fern unfurls. Original drawings; nothing is copied from anywhere.
 */
import { Svg, type GlyphProps } from "./glyphs";

const Dot = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

/** A soft wash inside a shape (a petal, a leaf), still in currentColor so any tint reaches it. */
const WASH = { fill: "currentColor", fillOpacity: 0.18 } as const;

/** The cell: a membrane, a nucleus, a few organelles. A role: a living unit of the village with its own purpose. */
export function Cell(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path data-part="membrane" d="M12 3.3c4.7 0 8.5 3.5 8.5 8.6 0 5.1-3.9 8.8-8.6 8.8-4.8 0-8.5-3.7-8.5-8.6 0-5.1 3.9-8.8 8.6-8.8z" />
      <circle data-part="nucleus" cx="13.2" cy="10.6" r="3.1" />
      <Dot cx={13.9} cy={10} r={1} />
      <ellipse cx="7.9" cy="14.7" rx="1.7" ry="1.1" transform="rotate(-25 7.9 14.7)" />
      <Dot cx={16.3} cy={16.2} r={0.9} />
      <Dot cx={9.6} cy={7.6} r={0.7} />
    </Svg>
  );
}

/** A seed pod, three seeds showing: value as seed that grows (tokens, contributions, the investor's journey). */
export function SeedPod(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 13c2.6-4.6 14.2-4.6 16.8 0-2.6 4.6-14.2 4.6-16.8 0z" />
      <Dot cx={8.6} cy={13} r={1.4} />
      <Dot cx={12} cy={13} r={1.4} />
      <Dot cx={15.4} cy={13} r={1.4} />
      <path d="M20.4 13c.8-1.6 1.2-3 1-4.4" />
    </Svg>
  );
}

/** A leaf turned to the sun, with a few rays: a livelihood from sunlight (prosperity, energy, a milestone marked). */
export function SunLeaf(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M6 19.6c-.6-6.4 3.4-11.6 10.6-12.4.8 7.2-4.2 12.2-10.6 12.4z" />
      <path d="M6 19.6l7.6-8M18.6 4.4l.6-1.6M20.4 6.2l1.6-.6M16.6 3.6l-.2-1.4" />
    </Svg>
  );
}

/** A place marker shaped like a seed, a seedling inside: a place marked by what grows there. */
export function SeedPin(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M12 21c-3.6-4-6.1-7.3-6.1-10.6a6.1 6.1 0 0 1 12.2 0c0 3.3-2.5 6.6-6.1 10.6z" />
      <path d="M12 13.6V9M12 10.6c-1-1.3-2.4-1.5-3.1-1 .6 1 1.9 1.4 3.1 1zM12 9.8c.9-1.1 2.2-1.3 2.9-.8-.5.9-1.8 1.3-2.9.8z" />
    </Svg>
  );
}

const PETAL = "M12 10.2c-1.6-2.6-1.4-5.6 0-6.7 1.4 1.1 1.6 4.1 0 6.7z";

/** Five petals open around a centre: recognition as flowering (badges, awards, a pinned badge). */
export function Bloom(props: GlyphProps) {
  return (
    <Svg {...props}>
      {[0, 72, 144, 216, 288].map((deg) => (
        <path key={deg} d={PETAL} transform={deg ? `rotate(${deg} 12 12)` : undefined} />
      ))}
      <Dot cx={12} cy={12} r={1.5} />
    </Svg>
  );
}

/** A firefly carrying its light: an agent in a seat, a helper that carries light among the people. */
export function Firefly(props: GlyphProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="12.2" rx="2.1" ry="3.5" />
      <path d="M10.2 10.6C7.4 8.6 4.8 9 4.3 10.4c.6 1.7 3.6 2 5.9 1.2M13.8 10.6c2.8-2 5.4-1.6 5.9-.2-.6 1.7-3.6 2-5.9 1.2M11 8.8c-.5-1.6-1.4-2.6-2.4-3M13 8.8c.5-1.6 1.4-2.6 2.4-3" />
      <Dot cx={12} cy={17.8} r={1.3} />
      <path d="M12 20.4v.8M9.6 19.4l-.6.6M14.4 19.4l.6.6" />
    </Svg>
  );
}

/** The crown of a tree on its trunk: leadership that shelters. */
export function TreeCrown(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M12 20.8v-6.2M12 16.8l-2.4-1.6M12 18.2l2.2-1.4" />
      <path {...WASH} d="M6.8 14.6c-2.4 0-3.8-1.8-3.4-3.8.3-1.5 1.6-2.4 2.9-2.4.4-2.6 2.6-4.4 5.4-4.2 2.4.2 4.2 1.8 4.6 4 2 0 3.7 1.4 3.8 3.3.1 1.8-1.4 3.1-3.3 3.1z" />
    </Svg>
  );
}

/** Growth rings in a cut trunk: a goal reached ring by ring. */
export function GrowthRings(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M12 9.6c1.4 0 2.5 1.1 2.4 2.5-.1 1.3-1.2 2.3-2.5 2.2-1.3 0-2.3-1.1-2.2-2.4.1-1.3 1-2.3 2.3-2.3z" />
      <path d="M12.1 6.3c3.3 0 5.9 2.5 5.8 5.8-.1 3.1-2.7 5.6-5.9 5.6-3.2 0-5.7-2.6-5.6-5.8.1-3.1 2.6-5.6 5.7-5.6z" />
      <path d="M12.2 3.2c5 0 9 3.9 8.9 8.9-.1 4.8-4 8.7-9 8.7-4.9 0-8.8-4-8.7-8.9.1-4.8 4-8.7 8.8-8.7z" />
      <path d="M12.4 12.2l3.2 5.2" />
    </Svg>
  );
}

/** Six stones in a ring around a seedling: deciding in circle (votes, governance, decisions). */
export function CouncilCircle(props: GlyphProps) {
  return (
    <Svg {...props}>
      {[[12, 4.6], [18.4, 8.3], [18.4, 15.7], [12, 19.4], [5.6, 15.7], [5.6, 8.3]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} />
      ))}
      <path d="M12 14.2v-3M12 12c-1-1.3-2.4-1.5-3.1-1 .6 1 1.9 1.3 3.1 1zM12 11.4c.9-1.1 2.1-1.3 2.8-.8-.5.9-1.7 1.2-2.8.8z" />
    </Svg>
  );
}

/** A songbird: news carried by a song (announcements). */
export function Songbird(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4.4 14.2c2.4 3.6 7.4 4.6 10.4 2.6 2.3-1.5 3.1-4 2.7-6.3l2.9-.9-2.7-.8c-1-1.9-3.4-2.5-5.1-1.3-1.9 1.4-1.8 3.9-3.5 5.1-1.4 1-3.4 1.1-4.7 1.6z" />
      <path d="M10.4 12.4c1.6.6 3.4.3 4.4-.8M6.6 19.8l1.6-2.2M9.6 20.2l.8-2.4" />
      <Dot cx={15} cy={9.4} r={0.7} />
    </Svg>
  );
}

/** A woven basket with its handle: livelihood carried together (opportunities, work, a market). */
export function WovenBasket(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4 10.4h16l-1.7 9.2H5.7z" />
      <path d="M8 10.4c0-4.2 8-4.2 8 0M5 13.6h14M5.5 16.6h13M9 10.4l.8 9.2M12 10.4v9.2M15 10.4l-.8 9.2" />
    </Svg>
  );
}

/** A seed with its seam: an idea, something to plant. */
export function Seed(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M12 3.6c3.5 3.2 5 6.6 5 9.9s-2.2 6.7-5 6.7-5-3.3-5-6.7 1.5-6.7 5-9.9z" />
      <path d="M12 8.2v8.6" />
    </Svg>
  );
}

/** A taproot under the ground line, a sprout above: the anchor circle, what holds the village to its land. */
export function Taproot(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4 10h16" />
      <path d="M12 10V6.4M12 7.6c-1.2-1.6-2.9-1.9-3.8-1.3.7 1.3 2.3 1.8 3.8 1.3zM12 7c1.1-1.4 2.7-1.7 3.6-1.1-.6 1.2-2.2 1.6-3.6 1.1z" />
      <path d="M12 10v10.5M12 13.6l-2.6 2.1M12 16.2l2.8 2.3M9.4 15.7l-1.4.4M14.8 18.5l.4 1.3" />
    </Svg>
  );
}

/** A seed held between two leaves: rights held in care (the resident's rights and responsibilities). */
export function Held(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M12 20.5C6.6 19.6 4.3 15.2 5 9.3c4 .6 6.8 4.4 7 11.2z" />
      <path {...WASH} d="M12 20.5c5.4-.9 7.7-5.3 7-11.2-4 .6-6.8 4.4-7 11.2z" />
      <circle cx="12" cy="7.4" r="2.6" />
      <path d="M12 4.8V3.6" />
    </Svg>
  );
}
