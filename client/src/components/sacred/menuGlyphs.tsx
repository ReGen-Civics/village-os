/**
 * THE MENU'S OWN GLYPHS (the lead, 27 Nov 2026: "getting each of the pages their own Menu icon ... regen,
 * nature, animals, organic, regenerative, healing, family, future, sexy, clean").
 *
 * Drawn in the living family's hand (livingCore.tsx): a 24 grid, round caps and joins, the family's
 * 1.75 line, no fill but the soft WASH, kept (living.tsx's rule) for what is held or nourishing: a seed, a
 * leaf, a heart, an egg, water, a shelter. Each one is a plain shape a
 * thumb can tell apart at 20px; the meaning comes from something alive.
 */
import { Svg, type GlyphProps } from "./glyphs";
import { asIcon, Dot, WASH } from "./livingCore";

/** A folded map, three panels, a river running across it: the living map. */
function MapLeafDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 6.6l5.5-2.1 6 2.1 5.5-2.1v12.9l-5.5 2.1-6-2.1-5.5 2.1z" />
      <path d="M9 4.5v12.9M15 6.6v12.9" />
      <path d="M4.6 14.4c1.6-.4 2.8.6 4.4.1s2.4-2.2 4.2-2.1 2.6 1.3 4.4.6" />
    </Svg>
  );
}
/** Three seed jars on one shelf, a sprout leaving the middle one: a library of things a village can grow. */
function SeedJarsDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 20h19" />
      <path d="M4 20v-5.6c0-.8.6-1.4 1.4-1.4h2.2c.8 0 1.4.6 1.4 1.4V20M4.6 13v-1.2h3.8V13" />
      <path {...WASH} d="M9.6 20v-7.4c0-.8.6-1.4 1.4-1.4h2c.8 0 1.4.6 1.4 1.4V20" />
      <path d="M10.2 11.2V10h3.6v1.2M12 10V6.6M12 7.8c-1.1-1.1-2.4-1.2-3.1-.7.7 1 1.9 1.2 3.1.7zM12 7.2c1-1 2.2-1.1 2.9-.6-.6.9-1.8 1.1-2.9.6z" />
      <path d="M15 20v-4.6c0-.8.6-1.4 1.4-1.4h2.2c.8 0 1.4.6 1.4 1.4V20M15.6 14v-1.2h3.8V14" />
      <Dot cx={6.5} cy={17.6} r={0.7} />
      <Dot cx={17.5} cy={17.8} r={0.7} />
    </Svg>
  );
}
/** A garden gate swung open under an arch of vine, the path running in: the way in (join). */
function OpenGateDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M5 20.5V9M19 20.5V9" />
      <path d="M5 9c0-3.4 3.1-5.6 7-5.6S19 5.6 19 9" />
      <path d="M8.2 4.6c.4.9.2 1.8-.6 2.4M15.8 4.6c-.4.9-.2 1.8.6 2.4M12 3.4v1.8" />
      <path d="M5 11.2l4.6-1.6v8.8L5 20.5z" />
      <path d="M9.6 20.5h9.4" />
    </Svg>
  );
}
/** A lantern with its flame: light carried ahead of you (the guides). */
function LanternDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M10 4.6a2 2 0 0 1 4 0M9 6.6h6" />
      <path d="M9.6 6.6C8 7.9 7.2 10 7.2 12.6s.8 4.7 2.4 6h4.8c1.6-1.3 2.4-3.4 2.4-6s-.8-4.7-2.4-6" />
      <path d="M9.6 18.6h4.8M10.6 20.6h2.8" />
      <path d="M12 9.6c1.3 1.3 1.9 2.5 1.9 3.4a1.9 1.9 0 0 1-3.8 0c0-.9.6-2.1 1.9-3.4z" />
    </Svg>
  );
}
/** An open book whose two pages are leaves, veined: what the village has written down (library). */
function LeafBookDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M12 6.6c-2.6-1.6-5.6-2-8.5-1.4v12.6c2.9-.6 5.9-.2 8.5 1.4 2.6-1.6 5.6-2 8.5-1.4V5.2c-2.9-.6-5.9-.2-8.5 1.4z" />
      <path d="M12 6.6v12.6" />
      <path d="M5.6 9.4c1.8-.2 3.6.2 4.8 1M5.6 12.6c1.8-.2 3.6.2 4.8 1M18.4 9.4c-1.8-.2-3.6.2-4.8 1M18.4 12.6c-1.8-.2-3.6.2-4.8 1" />
    </Svg>
  );
}
/** A speech bubble grown as a leaf, its midrib the line of talk, a small leaf answering: talking it through (forum). */
function LeafSpeechDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 17.6l1.6-3.1C4.4 13.4 4 12.1 4 10.7 4 7.3 7.1 4.5 11 4.5s7 2.8 7 6.2-3.1 6.2-7 6.2c-1.2 0-2.3-.2-3.3-.7z" />
      <path d="M7.6 13.2c2-2.4 4.6-3.8 7.4-4.2" />
      <path {...WASH} d="M16.6 20.6c-.2-2.4 1.2-4.2 3.8-4.4.2 2.4-1.2 4.2-3.8 4.4z" />
    </Svg>
  );
}
/** An envelope with a leaf tucked under its corner: a message between two people. */
function LeafLetterDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 8.4c0-.6.4-1 1-1h15c.6 0 1 .4 1 1v9.2c0 .6-.4 1-1 1h-15c-.6 0-1-.4-1-1z" />
      <path d="M3.9 8l8.1 5.8L20.1 8" />
      <path {...WASH} d="M15.4 7.4c.2-2.2 1.8-3.7 4.1-3.8-.2 2.3-1.8 3.7-4.1 3.8z" />
    </Svg>
  );
}
/** An envelope sealed with a heart of wax: a letter written with love. */
function SealedLetterDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 7.4c0-.6.4-1 1-1h15c.6 0 1 .4 1 1v10.2c0 .6-.4 1-1 1h-15c-.6 0-1-.4-1-1z" />
      <path d="M3.9 7l8.1 6.2L20.1 7" />
      <path {...WASH} d="M12 16.4c-1.7-1.1-2.7-2.1-2.7-3.2a1.35 1.35 0 0 1 2.7-.4 1.35 1.35 0 0 1 2.7.4c0 1.1-1 2.1-2.7 3.2z" />
    </Svg>
  );
}
/** Two small birds on one branch, turned to each other: meeting someone new (introductions). */
function PairedBirdsDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3 18.4c6-.9 12-.9 18 0" />
      <circle cx="8" cy="10.6" r="1.8" />
      <path d="M6.6 11.8c-1.8 1.2-2.6 3.4-1.8 5.6 2.6.2 4.8-.9 5.8-3.2" />
      <path d="M9.7 10.2l1.4.4-1.4.6" />
      <circle cx="16" cy="10.6" r="1.8" />
      <path d="M17.4 11.8c1.8 1.2 2.6 3.4 1.8 5.6-2.6.2-4.8-.9-5.8-3.2" />
      <path d="M14.3 10.2l-1.4.4 1.4.6" />
      <path d="M12 7.4c-.6-.4-1-.8-1-1.3a.6.6 0 0 1 1-.4.6.6 0 0 1 1 .4c0 .5-.4.9-1 1.3z" />
    </Svg>
  );
}
/** A hand drum, laced, its sound going out both ways: a circle meeting live (sessions). */
function HandDrumDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="7.4" rx="6" ry="2.1" />
      <path d="M6 7.4v8.2c0 1.7 2.7 3 6 3s6-1.3 6-3V7.4" />
      <path d="M6.6 11.2l2.2 3.8 2.2-3.8 2.2 3.8 2.2-3.8 2.2 3.8" />
      <path d="M20.4 4.8c.8.8 1.2 1.7 1.2 2.6M3.6 4.8c-.8.8-1.2 1.7-1.2 2.6" />
    </Svg>
  );
}
/** The moon rising and setting over the land, waxing as it goes: a season's moons (season plans). */
function MoonArcDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3 19.5h18" />
      <path d="M4.4 16.4a8 8 0 0 1 15.2 0" strokeDasharray="0.1 2.6" />
      <path d="M6.4 14.4a1.6 1.6 0 1 0 0-3.2 2 2 0 0 1 0 3.2z" />
      <circle cx="12" cy="8" r="2" />
      <circle cx="17.6" cy="12.8" r="1.6" />
    </Svg>
  );
}
/** A camera whose lens holds a leaf: pictures of the land (photographs). */
function LeafLensDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4.2 8.4h2.9l1.4-2.1h7l1.4 2.1h2.9c.6 0 1 .4 1 1V18c0 .6-.4 1-1 1H4.2c-.6 0-1-.4-1-1V9.4c0-.6.4-1 1-1z" />
      <circle cx="12" cy="13.4" r="3.4" />
      <path {...WASH} d="M10.4 15c-.2-1.8.9-3.2 3-3.3.2 1.8-.9 3.2-3 3.3z" />
    </Svg>
  );
}
/** An old map with a dotted way to a mark: the hidden map. */
function TreasureMapDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M5.2 4.6h12.6c.8 0 1.4.6 1.4 1.4v1.2l-.8 1.2.8 1.4V18c0 .8-.6 1.4-1.4 1.4H5.2c-.8 0-1.4-.6-1.4-1.4v-3.2l.8-1.2-.8-1.4V6c0-.8.6-1.4 1.4-1.4z" />
      <path d="M7.4 16.2c1.2-.6 1.4-2.2 2.8-2.6s2.6-1 3.4-2.6" strokeDasharray="0.1 2" />
      <path d="M14.6 7.6l2.4 2.4M17 7.6l-2.4 2.4" />
    </Svg>
  );
}
/** A hammock slung between two palms: a place to stay. */
function HammockDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4.6 20.5V8.4M19.4 20.5V8.4M2.5 20.5h19" />
      <path d="M4.6 8.4c-1.4-.6-2-2-1.4-3.4M4.6 8.4c.2-1.6 1.4-2.6 3-2.6M19.4 8.4c1.4-.6 2-2 1.4-3.4M19.4 8.4c-.2-1.6-1.4-2.6-3-2.6" />
      <path {...WASH} d="M4.6 11.4c3 4.8 11.8 4.8 14.8 0-3 2.4-11.8 2.4-14.8 0z" />
      <path d="M4.6 11.4c3 4.8 11.8 4.8 14.8 0" />
    </Svg>
  );
}
/** A garden trowel, its blade a leaf: the tools a village shares. */
function TrowelDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M13.6 10.4c-3.4-.6-7 .8-9.2 3.6-.8 1-.4 2.4.6 3.1l1.9 1.9c.7 1 2.1 1.4 3.1.6 2.8-2.2 4.2-5.8 3.6-9.2z" />
      <path d="M5.6 18.4l5.4-5.4" />
      <path d="M13.6 10.4l1.9-1.9M15.2 8.8l3.8-3.8a1.4 1.4 0 0 1 2 2l-3.8 3.8" />
    </Svg>
  );
}
/** A leaf with a cross of healing in its veins: the village's health. */
function HealingLeafDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M5 19.2c-.8-7.4 4.4-13.4 14.2-14.2.4 9.8-6.6 14.8-14.2 14.2z" />
      <path d="M12.6 9v5.2M10 11.6h5.2M5 19.2l-1.6 1.6" />
    </Svg>
  );
}
/** A river stone with a stone balanced on it and a sprout: something settled, that holds (decisions). */
function SettledStoneDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="16" rx="7.6" ry="3.8" />
      <ellipse cx="12" cy="9.6" rx="3.4" ry="2" />
      <path d="M12 7.6V5.2M12 6.2c-.9-.9-2-1-2.6-.5.6.8 1.6 1 2.6.5zM12 5.8c.8-.8 1.8-.9 2.4-.5-.5.7-1.5.9-2.4.5z" />
      <path d="M9 16.2l2 1.5 4-3.4" />
    </Svg>
  );
}
/** A branch with a new shoot grafted on and tied: a change taken into what is already growing (change requests). */
function GraftDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4 20.5c3.8-4 6.6-9 8-15.6" />
      <path d="M9.8 12.8c2.6.2 5-1 7-3.4" />
      <path {...WASH} d="M16.8 9.4c.4-2.2 2-3.6 4.2-3.6-.4 2.2-2 3.6-4.2 3.6z" />
      <path d="M8.8 11.8l2 1.8M9.6 10.8l2 1.8" />
    </Svg>
  );
}
/** Two bare footprints walking in: coming to visit. */
function FootprintsDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <ellipse cx="7.6" cy="16" rx="2.2" ry="3.4" transform="rotate(-14 7.6 16)" />
      <ellipse cx="15.8" cy="8.6" rx="2.2" ry="3.4" transform="rotate(-14 15.8 8.6)" />
      <Dot cx={5.6} cy={11.6} r={0.6} />
      <Dot cx={7.1} cy={11.1} r={0.6} />
      <Dot cx={8.6} cy={11.3} r={0.6} />
      <Dot cx={13.8} cy={4.2} r={0.6} />
      <Dot cx={15.3} cy={3.7} r={0.6} />
      <Dot cx={16.8} cy={3.9} r={0.6} />
    </Svg>
  );
}
/** Drops falling into one pool, its ripple: many small gifts, one fund (crowd pooling). */
function PoolDropsDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M6.8 4.2c1 1.3 1.6 2.3 1.6 3a1.6 1.6 0 0 1-3.2 0c0-.7.6-1.7 1.6-3zM12 2.8c1 1.3 1.6 2.3 1.6 3a1.6 1.6 0 0 1-3.2 0c0-.7.6-1.7 1.6-3zM17.2 4.6c1 1.3 1.6 2.3 1.6 3a1.6 1.6 0 0 1-3.2 0c0-.7.6-1.7 1.6-3z" />
      <ellipse {...WASH} cx="12" cy="17" rx="8" ry="3" />
      <path d="M8.6 17c1-.6 2.1-.9 3.4-.9s2.4.3 3.4.9" />
    </Svg>
  );
}
/** A letter given wings: the village's own mail, sent out to everyone. */
function WingedLetterDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M7.4 10.6c0-.5.4-.9.9-.9h7.4c.5 0 .9.4.9.9v6.8c0 .5-.4.9-.9.9H8.3c-.5 0-.9-.4-.9-.9z" />
      <path d="M7.7 10.2l4.3 3.6 4.3-3.6" />
      <path d="M7.4 12.6C4.6 12.2 2.8 10.4 2.4 7.6c2.2.2 4 1 5 2.4zM16.6 12.6c2.8-.4 4.6-2.2 5-5-2.2.2-4 1-5 2.4z" />
    </Svg>
  );
}
/** A sapling tied to its stake: learning held up while it grows (training). */
function SaplingDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 20.5h15M15.4 20.5V4.4" />
      <path d="M10.6 20.5c0-4 .6-7.4 2.2-10.2" />
      <path {...WASH} d="M12.8 10.3c-2.8-.2-4.6-2-4.8-4.6 2.8.2 4.6 2 4.8 4.6z" />
      <path d="M11.4 14.6c-1.6-1.6-3.6-1.8-5-1 1.2 1.6 3.2 2 5 1z" />
      <path d="M12.2 12.4c1.2.4 2.2.3 3.2-.4" />
    </Svg>
  );
}
/** A woven nest holding two eggs: what we look after together. */
function NestDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <ellipse cx="9.4" cy="11.6" rx="2.2" ry="2.8" />
      <ellipse {...WASH} cx="14.6" cy="11.8" rx="2.2" ry="2.8" />
      <path d="M3 13.4h18M3.8 13.4c.6 3.8 4 6.2 8.2 6.2s7.6-2.4 8.2-6.2" />
      <path d="M5 16c4.6 1.4 9.4 1.4 14 0" />
    </Svg>
  );
}
/** A leaf let go, drifting down: leaving well. */
function FallingLeafDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path {...WASH} d="M13.4 9.4c-.2-3.2 1.8-5.6 5.4-6 .2 3.6-1.8 5.8-5.4 6z" />
      <path d="M13.4 9.4l3-3" />
      <path d="M12.4 11.8c-3.2 1.2-3.2 3.4-.6 4.4s2.2 3.2-1.4 4.2" strokeDasharray="0.1 2.2" />
      <path d="M4 20.6h4" />
    </Svg>
  );
}
/** A hill cut into terraces, a tree at its crown: the land planned to the long view (master plan). */
function TerracesDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 19.6h19" />
      <path d="M3.4 19.6c2.6-5.4 5.4-8.4 8.6-8.4s6 3 8.6 8.4" />
      <path d="M6.2 16.2c1.8.6 3.8.9 5.8.9s4-.3 5.8-.9M8.6 13.4c1.1.4 2.2.5 3.4.5s2.3-.1 3.4-.5" />
      <path d="M12 11.2V8.6" />
      <circle {...WASH} cx="12" cy="6.4" r="2.2" />
    </Svg>
  );
}
/** Three birds flying together, one leading: the team. */
function FlockDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M7.2 8.8c1.6-2 3.2-2 4.8 0 1.6-2 3.2-2 4.8 0" />
      <path d="M2.6 15.2c1.3-1.6 2.6-1.6 3.9 0 1.3-1.6 2.6-1.6 3.9 0M13.6 16.4c1.3-1.6 2.6-1.6 3.9 0 1.3-1.6 2.6-1.6 3.9 0" />
    </Svg>
  );
}
/** Villages as stars, joined into one constellation: the village network. */
function ConstellationDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4.6 15.4L9.2 8l6 2.6L19.4 4.6M15.2 10.6l2 7" strokeOpacity="0.7" />
      <circle cx="9.2" cy="8" r="1.7" />
      <circle cx="4.6" cy="15.4" r="1.2" />
      <circle cx="15.2" cy="10.6" r="1.4" />
      <circle cx="19.4" cy="4.6" r="1" />
      <circle cx="17.2" cy="17.6" r="1.2" />
    </Svg>
  );
}
/** A person whose head is a seed with a sprout: you, growing (your profile). */
function SeedPersonDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="9" r="3.2" />
      <path d="M12 5.8V4M12 4.8c-.9-.9-2-1-2.6-.5.6.8 1.6 1 2.6.5z" />
      <path d="M5 20.5c.2-3.8 3.2-6.4 7-6.4s6.8 2.6 7 6.4z" />
    </Svg>
  );
}
/** A knotted cord, the way the old keepers remembered steps: the village's protocols. */
function KnotCordDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4 5c5.4 1.6 10.6 1.6 16 0" />
      <path d="M7.6 5.8c-.4 4 .4 8 0 12.6M12 6.4c.4 4.4-.4 9 0 14.2M16.4 5.8c-.4 3.4.4 6.6 0 10.2" />
      <Dot cx={7.7} cy={10} r={1.2} />
      <Dot cx={7.8} cy={14.6} r={1.2} />
      <Dot cx={12} cy={12.4} r={1.2} />
      <Dot cx={16.3} cy={9.4} r={1.2} />
      <Dot cx={16.4} cy={13.4} r={1.2} />
    </Svg>
  );
}
/** Three sprouts in a row, two grown and one still a seed: what you have done and what is next (tasks). */
function SproutRowDrawing(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 19.6h19" />
      <path d="M6 19.6v-5.4M6 15.6c-1.4-1.4-3-1.4-3.8-.8.8 1.2 2.4 1.4 3.8.8zM6 15c1.4-1.4 3-1.4 3.8-.8-.8 1.2-2.4 1.4-3.8.8z" />
      <path d="M12 19.6v-8.2M12 13c-1.6-1.6-3.4-1.6-4.4-.9 1 1.4 2.8 1.6 4.4.9z" />
      <path {...WASH} d="M12 12.4c1.6-1.6 3.4-1.6 4.4-.9-1 1.4-2.8 1.6-4.4.9z" />
      <ellipse cx="18.2" cy="18.4" rx="1.4" ry="1" />
    </Svg>
  );
}

export const MapLeaf = /* @__PURE__ */ asIcon("MapLeaf", MapLeafDrawing);
export const SeedJars = /* @__PURE__ */ asIcon("SeedJars", SeedJarsDrawing);
export const OpenGate = /* @__PURE__ */ asIcon("OpenGate", OpenGateDrawing);
export const Lantern = /* @__PURE__ */ asIcon("Lantern", LanternDrawing);
export const LeafBook = /* @__PURE__ */ asIcon("LeafBook", LeafBookDrawing);
export const LeafSpeech = /* @__PURE__ */ asIcon("LeafSpeech", LeafSpeechDrawing);
export const LeafLetter = /* @__PURE__ */ asIcon("LeafLetter", LeafLetterDrawing);
export const SealedLetter = /* @__PURE__ */ asIcon("SealedLetter", SealedLetterDrawing);
export const PairedBirds = /* @__PURE__ */ asIcon("PairedBirds", PairedBirdsDrawing);
export const HandDrum = /* @__PURE__ */ asIcon("HandDrum", HandDrumDrawing);
export const MoonArc = /* @__PURE__ */ asIcon("MoonArc", MoonArcDrawing);
export const LeafLens = /* @__PURE__ */ asIcon("LeafLens", LeafLensDrawing);
export const TreasureMap = /* @__PURE__ */ asIcon("TreasureMap", TreasureMapDrawing);
export const Hammock = /* @__PURE__ */ asIcon("Hammock", HammockDrawing);
export const Trowel = /* @__PURE__ */ asIcon("Trowel", TrowelDrawing);
export const HealingLeaf = /* @__PURE__ */ asIcon("HealingLeaf", HealingLeafDrawing);
export const SettledStone = /* @__PURE__ */ asIcon("SettledStone", SettledStoneDrawing);
export const Graft = /* @__PURE__ */ asIcon("Graft", GraftDrawing);
export const Footprints = /* @__PURE__ */ asIcon("Footprints", FootprintsDrawing);
export const PoolDrops = /* @__PURE__ */ asIcon("PoolDrops", PoolDropsDrawing);
export const WingedLetter = /* @__PURE__ */ asIcon("WingedLetter", WingedLetterDrawing);
export const Sapling = /* @__PURE__ */ asIcon("Sapling", SaplingDrawing);
export const Nest = /* @__PURE__ */ asIcon("Nest", NestDrawing);
export const FallingLeaf = /* @__PURE__ */ asIcon("FallingLeaf", FallingLeafDrawing);
export const Terraces = /* @__PURE__ */ asIcon("Terraces", TerracesDrawing);
export const Flock = /* @__PURE__ */ asIcon("Flock", FlockDrawing);
export const Constellation = /* @__PURE__ */ asIcon("Constellation", ConstellationDrawing);
export const SeedPerson = /* @__PURE__ */ asIcon("SeedPerson", SeedPersonDrawing);
export const KnotCord = /* @__PURE__ */ asIcon("KnotCord", KnotCordDrawing);
export const SproutRow = /* @__PURE__ */ asIcon("SproutRow", SproutRowDrawing);
