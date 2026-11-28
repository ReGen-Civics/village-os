/**
 * THE ADMIN GARDEN'S PAINTED ART (Rye, 27 Nov 2026: "painted buildings, lanterns and the
 * existing glyphs. No new icon set.").
 *
 * Ten places, each a painted building in two states: built, and under scaffolding for a part of
 * the village that is not built yet. The files ship with the platform in server/assets/garden
 * (server/routes/gardenArt.ts serves them at GARDEN_ART_URL), out of client/public for the same
 * reason the module cards and the stock characters are: the client budget never pays for them.
 *
 * The keys are the ten places of the garden and nothing else. Everything that looks a place up
 * is keyed by this union, so a table that misses one does not compile.
 *
 * Pure: no pool, no clock, no Node builtins.
 */

/** The public path. Stored nowhere; computed by gardenSpriteUrl. */
export const GARDEN_ART_URL = "/images/garden";

/** The ten places, in the order the garden lists them. */
export const GARDEN_PLACE_KEYS = ["fire", "hall", "gate", "library", "greenhouse", "store", "tower", "spring", "stage", "ceiba"] as const;

export type GardenPlaceKey = (typeof GARDEN_PLACE_KEYS)[number];

/** Every sprite is painted this tall, in CSS pixels. */
export const GARDEN_SPRITE_HEIGHT = 176;

/** Each sprite's own width at that height, built and under scaffolding, so a page can hold its place before it loads. */
export const GARDEN_SPRITE_WIDTHS: Record<GardenPlaceKey, { built: number; scaffold: number }> = {
  fire: { built: 251, scaffold: 262 },
  hall: { built: 201, scaffold: 192 },
  gate: { built: 164, scaffold: 175 },
  library: { built: 182, scaffold: 177 },
  greenhouse: { built: 193, scaffold: 178 },
  store: { built: 196, scaffold: 194 },
  tower: { built: 84, scaffold: 125 },
  spring: { built: 209, scaffold: 232 },
  stage: { built: 216, scaffold: 187 },
  ceiba: { built: 198, scaffold: 183 },
};

/** A place's file name: `<key>.webp` built, `<key>-scaffold.webp` under scaffolding. */
export function gardenSpriteFile(place: GardenPlaceKey, scaffolding = false): string {
  return `${place}${scaffolding ? "-scaffold" : ""}.webp`;
}

/** A place's painted building, built or under scaffolding. */
export function gardenSpriteUrl(place: GardenPlaceKey, scaffolding = false): string {
  return `${GARDEN_ART_URL}/${gardenSpriteFile(place, scaffolding)}`;
}

/** The guide's portrait, for her ring in the dock. */
export const GARDEN_GUIDE_FILE = "guide.webp";
export const GARDEN_GUIDE_URL = `${GARDEN_ART_URL}/${GARDEN_GUIDE_FILE}`;

/**
 * THE FOUR PAINTED GROUNDS (the founder, 28 Nov 2026: "Let users pick forest, valley, or terraced
 * hills and also a beachside"). The land behind the places, where a village has no land art of its
 * own. Each person picks one for their own screen, and only the picked one is ever fetched.
 *
 * Everything that looks a ground up is keyed by this union, so a table that misses one does not
 * compile. The names are plain: no village's name is in a file name.
 */
export const GARDEN_GROUND_KEYS = ["forest", "valley", "hills", "beach"] as const;

export type GardenGroundKey = (typeof GARDEN_GROUND_KEYS)[number];

/** The ground for a person who has not picked, and for a kept value that is no ground. */
export const DEFAULT_GARDEN_GROUND: GardenGroundKey = "forest";

/** Every ground is painted to the land's own shape, 10 wide to 9 tall, at this size in pixels. */
export const GARDEN_GROUND_WIDTH = 1280;
export const GARDEN_GROUND_HEIGHT = 1152;

/** Whether a value is one of the four grounds. */
export function isGardenGround(v: unknown): v is GardenGroundKey {
  return typeof v === "string" && (GARDEN_GROUND_KEYS as readonly string[]).includes(v);
}

/** A kept value read back as a ground. Anything unknown is the default. */
export function readGardenGround(v: unknown): GardenGroundKey {
  return isGardenGround(v) ? v : DEFAULT_GARDEN_GROUND;
}

/** A ground's file name: `ground-<key>.webp`. */
export function gardenGroundFile(ground: GardenGroundKey): string {
  return `ground-${ground}.webp`;
}

/** A painted ground, for the land behind the places. */
export function gardenGroundUrl(ground: GardenGroundKey): string {
  return `${GARDEN_ART_URL}/${gardenGroundFile(ground)}`;
}

/** Every file the folder must hold: twenty sprites, the guide's portrait and the four grounds. */
export function gardenArtFiles(): string[] {
  return [...GARDEN_PLACE_KEYS.flatMap((k) => [gardenSpriteFile(k), gardenSpriteFile(k, true)]), GARDEN_GUIDE_FILE, ...GARDEN_GROUND_KEYS.map(gardenGroundFile)];
}
