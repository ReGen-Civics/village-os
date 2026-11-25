/**
 * THE LIVING GLYPHS: the biological companions to the sacred geometry in
 * glyphs.tsx (motion lane, 24 Nov 2026; the lead: "I don't want roles to be a
 * shield, let's do something like a biological cell or mycelia").
 *
 * Drawn with glyphs.tsx's own Svg, by agreement with the lane that owns it: a fine
 * monoline in currentColor, 1.5 stroke, round caps and joins, on a 24 grid,
 * aria-hidden, so each drops in wherever a lucide or sacred glyph sat and takes
 * the tab bar's active tint.
 *
 * THE FAMILY'S RULES (the lead, 25 Nov 2026, from the QA pass):
 *   - Fills are small dots in currentColor (a nucleolus, a seed, a knot), which
 *     read at 22px where a stroke ring would close up, and the soft WASH, which
 *     is ONLY for what is held or nourishing: a seed, a leaf, a home, a heart,
 *     a hand's gift, a shelter. Anything else is line alone.
 *   - One optical size: a glyph fills about 14 to 17 units of the 24 box, so
 *     no one of them reads a size smaller in a row of them.
 *   - Biology for the everyday; the sacred geometry (glyphs.tsx) is for emblems
 *     and empty states.
 *
 * Each one is the still form of a movement in the motion system (index.css,
 * LIVING MOTION): the cell's membrane breathes, the mycelium's threads draw,
 * the fern unfurls. Original drawings; nothing is copied from anywhere.
 */
import { Svg, type GlyphProps } from "./glyphs";
import { asIcon, Dot, WASH } from "./livingCore";

export { Cell, CellRing, EarthshipDome, LeafCompass, ScarletMacaw, SeedHand, SeedPodHome, SteppingStones, SunLeaf, TreeCrown } from "./livingCore";

const PETAL = "M12 10.2c-1.6-2.6-1.4-5.6 0-6.7 1.4 1.1 1.6 4.1 0 6.7z";

/** A pea pod, split along its seam with three seeds showing: value as seed that grows (tokens, contributions). */
function SeedPodDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4.2 15.8c1.6-5.6 8-9.6 14.6-9 .6 6.6-4.4 12.2-11.2 12.4-1.4 0-2.6-.6-3.4-1.4z" />
      <path d="M5.8 17.6c3.6-1.6 8.2-5.6 11.8-10.2M18.8 6.8c.6-1 1.6-1.8 2.6-2" />
      <Dot cx={8.8} cy={14.4} r={1.25} />
      <Dot cx={11.6} cy={12.2} r={1.25} />
      <Dot cx={14.4} cy={10} r={1.25} />
    </Svg>
  );
}
/** A place marker shaped like a seed, a seedling inside: a place marked by what grows there. */
function SeedPinDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M12 21c-3.6-4-6.1-7.3-6.1-10.6a6.1 6.1 0 0 1 12.2 0c0 3.3-2.5 6.6-6.1 10.6z" />
      <path d="M12 13.6V9M12 10.6c-1-1.3-2.4-1.5-3.1-1 .6 1 1.9 1.4 3.1 1zM12 9.8c.9-1.1 2.2-1.3 2.9-.8-.5.9-1.8 1.3-2.9.8z" />
    </Svg>
  );
}
/** Five petals open around a centre: recognition as flowering (badges, awards, a pinned badge). */
function BloomDrawing(props: GlyphProps) {
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
function FireflyDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="12.2" rx="2.1" ry="3.5" />
      <path d="M10.2 10.6C7.4 8.6 4.8 9 4.3 10.4c.6 1.7 3.6 2 5.9 1.2M13.8 10.6c2.8-2 5.4-1.6 5.9-.2-.6 1.7-3.6 2-5.9 1.2M11 8.8c-.5-1.6-1.4-2.6-2.4-3M13 8.8c.5-1.6 1.4-2.6 2.4-3" />
      <Dot cx={12} cy={17.8} r={1.3} />
      <path d="M12 20.4v.8M9.6 19.4l-.6.6M14.4 19.4l.6.6" />
    </Svg>
  );
}
/** Growth rings in a cut trunk: a goal reached ring by ring. */
function GrowthRingsDrawing(props: GlyphProps) {
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
function CouncilCircleDrawing(props: GlyphProps) {
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
function SongbirdDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4.4 14.2c2.4 3.6 7.4 4.6 10.4 2.6 2.3-1.5 3.1-4 2.7-6.3l2.9-.9-2.7-.8c-1-1.9-3.4-2.5-5.1-1.3-1.9 1.4-1.8 3.9-3.5 5.1-1.4 1-3.4 1.1-4.7 1.6z" />
      <path d="M10.4 12.4c1.6.6 3.4.3 4.4-.8M6.6 19.8l1.6-2.2M9.6 20.2l.8-2.4" />
      <Dot cx={15} cy={9.4} r={0.7} />
    </Svg>
  );
}
/** A woven basket with its handle: livelihood carried together (opportunities, work, a market). */
function WovenBasketDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4 10.4h16l-1.7 9.2H5.7z" />
      <path d="M8 10.4c0-4.2 8-4.2 8 0M5 13.6h14M5.5 16.6h13M9 10.4l.8 9.2M12 10.4v9.2M15 10.4l-.8 9.2" />
    </Svg>
  );
}
/** A taproot under the ground line, a sprout above: the anchor circle, what holds the village to its land. */
function TaprootDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4 10h16" />
      <path d="M12 10V6.4M12 7.6c-1.2-1.6-2.9-1.9-3.8-1.3.7 1.3 2.3 1.8 3.8 1.3zM12 7c1.1-1.4 2.7-1.7 3.6-1.1-.6 1.2-2.2 1.6-3.6 1.1z" />
      <path d="M12 10v10.5M12 13.6l-2.6 2.1M12 16.2l2.8 2.3M9.4 15.7l-1.4.4M14.8 18.5l.4 1.3" />
    </Svg>
  );
}
/** A seed held between two leaves: rights held in care (the resident's rights and responsibilities). */
function HeldDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M12 20.5C6.6 19.6 4.3 15.2 5 9.3c4 .6 6.8 4.4 7 11.2z" />
      <path {...WASH} d="M12 20.5c5.4-.9 7.7-5.3 7-11.2-4 .6-6.8 4.4-7 11.2z" />
      <circle cx="12" cy="7.4" r="2.6" />
      <path d="M12 4.8V3.6" />
    </Svg>
  );
}
/** A seed with two small stars of light: something new and special, in place of the stock sparkle. */
function SeedGlintDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M10.6 5.8c3 2.8 4.3 5.7 4.3 8.6s-1.9 5.8-4.3 5.8-4.3-2.9-4.3-5.8 1.3-5.8 4.3-8.6z" />
      <path d="M10.6 9.8v7.4M17.2 3.6v2.6M15.9 4.9h2.6M19.8 8.4v1.6M19 9.2h1.6" />
    </Svg>
  );
}
/** Open hands under a seedling: the work is tending something alive (building, tools, tending). */
function TendingHandsDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 14.6c2.2 0 3.6.6 5 1.6h3c1 0 1.4 1.3.4 1.6l-3.2.4M3.6 19.6h4.8c2.4 0 4.6-.6 6.6-1.8l4.2-2.8c.9-.6.2-2-.9-1.6l-4.6 2" />
      <path d="M14.2 12.2V8M14.2 9.4c-1.2-1.4-2.7-1.6-3.5-1 .7 1.1 2.1 1.5 3.5 1zM14.2 8.8c1.1-1.3 2.5-1.5 3.3-1-.6 1.1-2 1.5-3.3 1z" />
    </Svg>
  );
}
/** A gourd filling with water: how well something fits, the fuller the better (quest fit). */
function GourdDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.4c1 0 1.6.8 1.6 1.8 0 1-.6 1.6-.6 2.4 0 .8 4 2 4 6.6 0 3.6-2.4 6.2-5 6.2s-5-2.6-5-6.2c0-4.6 4-5.8 4-6.6 0-.8-.6-1.4-.6-2.4 0-1 .6-1.8 1.6-1.8z" />
      <path {...WASH} d="M7.4 14.6c1.5-.8 3-.8 4.6 0s3.1.8 4.6 0c0 3.2-2.1 5.8-4.6 5.8s-4.6-2.6-4.6-5.8z" />
    </Svg>
  );
}
/** Two people under one tree: safety as shelter (safe, verified, protected). */
function CanopyDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M3.4 11.4c0-4.2 3.9-7.4 8.6-7.4s8.6 3.2 8.6 7.4z" />
      <path d="M12 11.4v8.8M5.4 20.2h13.2" />
      <Dot cx={8.2} cy={17.6} r={1.2} />
      <Dot cx={15.8} cy={17.6} r={1.2} />
    </Svg>
  );
}
/** Open hands offering a seed: giving, contributing. */
function OfferingHandsDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 14.4c2.2 0 3.6.6 5 1.6h3c1 0 1.4 1.3.4 1.6l-3.2.4M3.6 19.4h4.8c2.4 0 4.6-.6 6.6-1.8l4.2-2.8c.9-.6.2-2-.9-1.6l-4.6 2" />
      <path {...WASH} d="M14.6 4.4c1.8 1.6 2.6 3.3 2.6 5s-1.1 3.1-2.6 3.1-2.6-1.4-2.6-3.1.8-3.4 2.6-5z" />
    </Svg>
  );
}
/** A stone just landed in a pond: a splash crown, droplets thrown up, broken uneven rings. Sensing (the co-creator loop). */
function SplashDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M12 12.6l-1.3-2.7M12 12.6l1.5-2.9M12 12.6V9.2" />
      <Dot cx={9.6} cy={7.4} r={0.7} />
      <Dot cx={14.6} cy={7} r={0.8} />
      <Dot cx={12.2} cy={5.8} r={0.6} />
      <path d="M8.4 13.6c.4-1.1 1.8-1.8 3.6-1.9M14.6 12.1c1.1.3 1.6.9 1.4 1.6-.3 1-2.1 1.6-4.2 1.6-1.6 0-2.9-.4-3.4-1" />
      <path d="M5 14.6c-.6-1.8 2.6-3.6 6.6-3.8M15.6 11.2c2.6.4 4 1.6 3.4 3-.6 1.6-3.6 2.6-7.2 2.6M8.2 16.8c-1.2-.3-2.2-.8-2.8-1.4" />
      <path d="M2.4 15.6c.2 1.6 2.6 3 6 3.6M15.8 19c3.4-.6 5.8-2 5.8-3.6M20.6 12.6c-.6-.6-1.4-1-2.4-1.4" /> {/* village-ok: an SVG path command, not a unit */}
    </Svg>
  );
}
/** An eye whose pupil is a seed: seeing (the co-creator loop's "sense"). */
function SeedEyeDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M2.8 12c2.4-4 5.6-6 9.2-6s6.8 2 9.2 6c-2.4 4-5.6 6-9.2 6s-6.8-2-9.2-6z" /> {/* village-ok: an SVG path command, not a unit */}
      <path d="M12 8.6c1.8 1.6 2.6 3.1 2.6 4.4s-1.1 2.6-2.6 2.6-2.6-1.2-2.6-2.6.8-2.8 2.6-4.4z" />
    </Svg>
  );
}
/** A feather, the quill as it grew: writing it down (the co-creator loop's "propose"). */
function FeatherDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M19.4 4.2c-6.6.2-11.2 4.6-12 11.4 4.8 0 9.2-2.8 11.2-7.4z" />
      <path d="M7.4 15.6l-2.6 4.6M9.6 12.4l4.6-1.2M11.8 9.2l4-1.4" />
    </Svg>
  );
}
/** A sprout from the ground: making it real (the co-creator loop's "create"). */
function SproutDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M7 20.2h10M12 20.2v-7.4M12 14.2c-2.2-2.6-5-3-6.4-2 1.2 2.2 4 3 6.4 2zM12 12.8c1.8-2.6 4.4-3.2 5.8-2.4-1 2.2-3.6 3.2-5.8 2.4z" />
    </Svg>
  );
}

/** Three pines rising on one ground line: growth (the investor's path, prosperity). */
function PinesDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3 20.6h18M6 20.6v-1.6M12 20.6v-2M18 20.6v-2.4" />
      <path d="M6 13.8l2.4 5.2H3.6zM12 9.6l3.2 9H8.8zM18 4.6l3.8 13.8h-7.6z" />
    </Svg>
  );
}
/** Two mushrooms joined by threads under the ground: people connected, the network beneath (community, team). */
function MushroomNetworkDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 11.2a4 4 0 0 1 8 0zM7.6 11.2v5.2M13.8 13.4a3.2 3.2 0 0 1 6.4 0zM17 13.4v3.2" />
      <path d="M7.6 16.4c1.6 2.5 8 2.5 9.4.2M10.2 17.9l-.8 2M14.4 17.9l.9 1.9M12.3 18.4v2" />
    </Svg>
  );
}

/** A small fire in a ring of stones: people gathered (events). */
function GatheringDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M12 3c2.8 2.6 4.2 5 4.2 7.4a4.2 4.2 0 0 1-8.4 0c0-1.6.8-3 2-4.1.3 1.3 1 2.1 1.9 2.4-.5-2-.3-3.9.3-5.7z" />
      <path d="M8.2 17.2l7.6-2.4M8.2 14.8l7.6 2.4" />
      <Dot cx={4.4} cy={16.6} r={0.9} />
      <Dot cx={6.6} cy={19.4} r={0.9} />
      <Dot cx={12} cy={20.4} r={0.9} />
      <Dot cx={17.4} cy={19.4} r={0.9} />
      <Dot cx={19.6} cy={16.6} r={0.9} />
    </Svg>
  );
}
/** The sun rising over the land: the turn of a season (the seasonal festivals). */
function SunriseDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3 17h18M7 20.2h10" />
      <path {...WASH} d="M7 17a5 5 0 0 1 10 0z" />
      <path d="M12 6.4v2.4M5.6 9.2l1.6 1.6M18.4 9.2l-1.6 1.6M3.2 13.6h2.2M18.6 13.6h2.2" />
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
/** A seed with its seam: an idea, something to plant. */
function SeedDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M12 3.6c3.5 3.2 5 6.6 5 9.9s-2.2 6.7-5 6.7-5-3.3-5-6.7 1.5-6.7 5-9.9z" />
      <path d="M12 8.2v8.6" />
    </Svg>
  );
}
/* The glyphs, each a drop-in for a lucide icon. */
export const SeedPod = /* @__PURE__ */ asIcon("SeedPod", SeedPodDrawing);
export const SeedPin = /* @__PURE__ */ asIcon("SeedPin", SeedPinDrawing);
export const Bloom = /* @__PURE__ */ asIcon("Bloom", BloomDrawing);
export const Firefly = /* @__PURE__ */ asIcon("Firefly", FireflyDrawing);
export const GrowthRings = /* @__PURE__ */ asIcon("GrowthRings", GrowthRingsDrawing);
export const CouncilCircle = /* @__PURE__ */ asIcon("CouncilCircle", CouncilCircleDrawing);
export const Songbird = /* @__PURE__ */ asIcon("Songbird", SongbirdDrawing);
export const WovenBasket = /* @__PURE__ */ asIcon("WovenBasket", WovenBasketDrawing);
export const Taproot = /* @__PURE__ */ asIcon("Taproot", TaprootDrawing);
export const Held = /* @__PURE__ */ asIcon("Held", HeldDrawing);
export const SeedGlint = /* @__PURE__ */ asIcon("SeedGlint", SeedGlintDrawing);
export const TendingHands = /* @__PURE__ */ asIcon("TendingHands", TendingHandsDrawing);
export const Gourd = /* @__PURE__ */ asIcon("Gourd", GourdDrawing);
export const Canopy = /* @__PURE__ */ asIcon("Canopy", CanopyDrawing);
export const OfferingHands = /* @__PURE__ */ asIcon("OfferingHands", OfferingHandsDrawing);
export const Splash = /* @__PURE__ */ asIcon("Splash", SplashDrawing);
export const SeedEye = /* @__PURE__ */ asIcon("SeedEye", SeedEyeDrawing);
export const Feather = /* @__PURE__ */ asIcon("Feather", FeatherDrawing);
export const Sprout = /* @__PURE__ */ asIcon("Sprout", SproutDrawing);
export const Pines = /* @__PURE__ */ asIcon("Pines", PinesDrawing);
export const MushroomNetwork = /* @__PURE__ */ asIcon("MushroomNetwork", MushroomNetworkDrawing);
export const Gathering = /* @__PURE__ */ asIcon("Gathering", GatheringDrawing);
export const Sunrise = /* @__PURE__ */ asIcon("Sunrise", SunriseDrawing);
export const HeartLeaf = /* @__PURE__ */ asIcon("HeartLeaf", HeartLeafDrawing);
export const Seed = /* @__PURE__ */ asIcon("Seed", SeedDrawing);
