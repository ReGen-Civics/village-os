/**
 * THE PICTURES ON THE LANDING PAGE'S PATH CARDS, AND WHERE EACH ONE IS CUT.
 *
 * The cards used to draw a 112px strip, asked the server for a 3:1 band cut
 * around the centre (shared/uploadVariants.ts, `crop=band`), and the photos a
 * village uploads are portraits. A 4:5 portrait cut to 3:1 keeps a quarter of
 * its height: one card showed only sky, others cut people off at the eyes.
 *
 * Now the frame is near the photos' own shape (square on a phone, 4:5 in the
 * desktop row), the browser gets the whole picture at the width it needs, and
 * `object-position` decides what the frame keeps. That point is the village's
 * to tune, one optional value per picture in the brand overlay
 * (`<imageKey>Focus`, "x% y%"), and without one it is a top-weighted centre,
 * because faces sit in the upper half of most photographs of people.
 *
 * Every picture fills its frame (the lead, 27 Nov 2026: "Fix the cropping in
 * the resident picture"). A rule here used to show a picture far from the
 * frame's shape whole instead, and on a phone the Resident portrait crossed
 * that line and sat as a narrow column between two bands of the card's colour.
 * The focal point is the one knob now.
 *
 * Pure: no DOM, no pool, no clock.
 */
/*
 * The nature library's URL, written here and NOT imported from ./natureArt: the
 * landing page is on the first page, and that module brings the whole library
 * table and the role listing with it. pathCardArt.test.ts holds the two equal.
 */
const NATURE_ART_URL = "/images/nature";

/** The brand image keys a path card draws, each with its optional focal point beside it. */
export const PATH_ART_KEYS = ["investorHero", "stewardHero", "residentHero", "prosperityHero"] as const;
export type PathArtKey = (typeof PATH_ART_KEYS)[number];
export type PathArtFocusKey = `${PathArtKey}Focus`;

/** Where the frame looks when the village has said nothing: the middle across, a little above the middle down. */
export const DEFAULT_ART_FOCUS = "50% 40%";

const FOCUS = /^\s*(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%\s*$/;

/**
 * A focal point as CSS `object-position`, or null for anything else. Two
 * percentages, across then down, each from 0 to 100. Only this shape is
 * accepted because the value lands in a style attribute.
 */
export function parseArtFocus(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = FOCUS.exec(value);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (!(x >= 0 && x <= 100 && y >= 0 && y <= 100)) return null;
  return `${x}% ${y}%`;
}

/** The focal point a card uses: the village's own when it is well formed, the default otherwise. */
export function artFocusOr(value: unknown, fallback: string = DEFAULT_ART_FOCUS): string {
  return parseArtFocus(value) ?? fallback;
}

/**
 * The focal points a brand overlay holds, well formed only, for the public
 * config. `/api/game/config` rebuilds `images` from named keys, so these have
 * to be named somewhere, and this is the one place.
 */
export function pathArtFocus(images: Record<string, unknown> | null | undefined): Partial<Record<PathArtFocusKey, string>> {
  const out: Partial<Record<PathArtFocusKey, string>> = {};
  for (const key of PATH_ART_KEYS) {
    const focus = parseArtFocus(images?.[`${key}Focus`]);
    if (focus) out[`${key}Focus`] = focus;
  }
  return out;
}

/**
 * The founding team card's picture, a painting from the platform's own nature
 * library (shared/natureArt.ts), so the card sits in the row with a picture
 * like the others on every village from the first deploy. The half-size copy
 * is 360 wide, the full painting 720.
 */
export const FOUNDING_CARD_ART = {
  src: `${NATURE_ART_URL}/sm/scarlet-macaw.webp`,
  srcSet: `${NATURE_ART_URL}/sm/scarlet-macaw.webp 360w, ${NATURE_ART_URL}/scarlet-macaw.webp 720w`,
  focus: "50% 30%",
} as const;

/** One nature library painting as a card picture: the half-size copy, the full painting for wide screens. */
const natureCard = (slug: string, focus: string) =>
  ({ src: `${NATURE_ART_URL}/sm/${slug}.webp`, srcSet: `${NATURE_ART_URL}/sm/${slug}.webp 360w, ${NATURE_ART_URL}/${slug}.webp 720w`, focus }) as const;

/**
 * THE FOUR WAYS' PICTURES ON THE LANDING PAGE (the lead, 24 Nov 2026: "redesign the other 3 cards to look more like
 * the team card and add animals to them"). The founding team keeps its scarlet macaw; the other three are paintings
 * from the same library, chosen for what each way is and so no animal repeats on the page: leafcutter ants farm and
 * carry what they build (a venture), two dolphins swim together (a partnership), a blue morpho is one bright journey
 * (a quest).
 */
export const FOUR_WAYS_ART = {
  venture: natureCard("leafcutter-ants", "50% 35%"),
  partner: natureCard("bottlenose-dolphin", "50% 55%"),
  quest: natureCard("blue-morpho", "60% 40%"),
} as const;

