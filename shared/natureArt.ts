/**
 * THE NATURE ART LIBRARY: 48 PAINTED ANIMALS AND PLANTS OF COSTA RICA (Rye, 20 Nov 2026).
 *
 * "Change all the pictures and images for all the roles ... a suite of 48 different animal and plant
 * cards that are found in Costa Rica, using the same stylistic design as our profile and our character
 * cards." Every role card, upcoming role and venture card shows one, an admin can choose which, and the
 * same paintings stand for the role cards' Digital Companions.
 *
 * The files ship with the platform in server/assets/nature (server/routes/natureArt.ts serves them at
 * NATURE_ART_URL), 3:4 portraits painted full bleed: no white edge, the scene reaches every side.
 *
 * Pure: no pool, no clock, no Node builtins.
 */

export const NATURE_ART_URL = "/images/nature";

export type NatureKind = "animal" | "plant";

export interface NatureArt {
  /** The file name without .webp, and the id stored when an admin picks this painting. */
  slug: string;
  /** English common name. */
  name: string;
  /** The name used in Costa Rica. */
  es: string;
  kind: NatureKind;
  /** Words a role card's Digital Companion may be named with that mean this painting, lower case. */
  words: readonly string[];
}

const a = (slug: string, name: string, es: string, words: string[]): NatureArt => ({ slug, name, es, kind: "animal", words });
const p = (slug: string, name: string, es: string, words: string[]): NatureArt => ({ slug, name, es, kind: "plant", words });

/** The whole library, animals then plants. The order is the admin grid's and the auto-assignment's. */
export const NATURE_ART: readonly NatureArt[] = [
  a("scarlet-macaw", "Scarlet macaw", "Lapa roja", ["scarlet macaw", "macaw", "lapa roja", "lapa", "parrot"]),
  a("howler-monkey", "Mantled howler monkey", "Mono congo", ["howler monkey", "howler", "congo", "monkey"]),
  a("three-toed-sloth", "Three-toed sloth", "Perezoso de tres dedos", ["sloth", "perezoso"]),
  a("red-eyed-tree-frog", "Red-eyed tree frog", "Rana calzonuda", ["red-eyed tree frog", "tree frog", "frog", "rana"]),
  a("resplendent-quetzal", "Resplendent quetzal", "Quetzal", ["quetzal"]),
  a("keel-billed-toucan", "Keel-billed toucan", "Tucán pico iris", ["toucan", "tucán", "tucan"]),
  a("white-faced-capuchin", "White-faced capuchin", "Mono carablanca", ["capuchin", "carablanca"]),
  a("squirrel-monkey", "Squirrel monkey", "Mono tití", ["squirrel monkey", "tití", "titi"]),
  a("jaguar", "Jaguar", "Jaguar", ["jaguar"]),
  a("ocelot", "Ocelot", "Manigordo", ["ocelot", "manigordo", "wildcat", "cat"]),
  a("bairds-tapir", "Baird's tapir", "Danta", ["tapir", "danta"]),
  a("white-nosed-coati", "White-nosed coati", "Pizote", ["coati", "pizote"]),
  a("blue-morpho", "Blue morpho butterfly", "Morpho azul", ["blue morpho", "morpho", "butterfly", "mariposa"]),
  a("strawberry-poison-dart-frog", "Strawberry poison dart frog", "Rana blue jeans", ["poison dart frog", "dart frog", "blue jeans"]),
  a("glass-frog", "Glass frog", "Rana de vidrio", ["glass frog"]),
  a("leatherback-turtle", "Leatherback sea turtle", "Tortuga baula", ["leatherback", "baula", "sea turtle", "turtle", "tortuga"]),
  a("olive-ridley-turtle", "Olive ridley sea turtle", "Tortuga lora", ["olive ridley", "tortuga lora"]),
  a("humpback-whale", "Humpback whale", "Ballena jorobada", ["humpback", "whale", "ballena"]),
  a("american-crocodile", "American crocodile", "Cocodrilo", ["crocodile", "cocodrilo", "croc", "caiman"]),
  a("green-iguana", "Green iguana", "Iguana verde", ["iguana"]),
  a("emerald-basilisk", "Emerald basilisk", "Basilisco verde", ["basilisk", "basilisco", "lizard"]),
  a("violet-sabrewing", "Violet sabrewing hummingbird", "Colibrí ala de sable", ["hummingbird", "colibrí", "colibri", "sabrewing"]),
  a("great-green-macaw", "Great green macaw", "Lapa verde", ["great green macaw", "green macaw", "lapa verde"]),
  a("roseate-spoonbill", "Roseate spoonbill", "Garza rosada", ["spoonbill", "garza", "heron", "flamingo"]),
  a("kinkajou", "Kinkajou", "Martilla", ["kinkajou", "martilla"]),
  a("turquoise-browed-motmot", "Turquoise-browed motmot", "Momoto cejiceleste", ["motmot", "momoto"]),
  a("clay-colored-thrush", "Clay-colored thrush", "Yigüirro", ["thrush", "yigüirro", "yiguirro", "songbird", "bird"]),
  a("leafcutter-ants", "Leafcutter ants", "Zompopas", ["leafcutter", "ant", "ants", "zompopa"]),
  a("eyelash-viper", "Eyelash viper", "Bocaracá", ["viper", "snake", "serpent", "bocaracá"]),
  a("hammerhead-shark", "Scalloped hammerhead shark", "Tiburón martillo", ["hammerhead", "shark", "tiburón"]),
  p("mango-tree", "Mango tree", "Árbol de mango", ["mango"]),
  p("guanacaste-tree", "Guanacaste tree", "Árbol de guanacaste", ["guanacaste"]),
  p("guaria-morada", "Guaria morada orchid", "Guaria morada", ["guaria", "orchid", "orquídea"]),
  p("ceiba-tree", "Ceiba tree", "Ceiba", ["ceiba", "kapok"]),
  p("almendro-tree", "Almendro tree", "Almendro de montaña", ["almendro"]),
  p("strangler-fig", "Strangler fig", "Matapalo", ["strangler fig", "fig", "matapalo"]),
  p("heliconia", "Heliconia", "Platanilla", ["heliconia", "platanilla"]),
  p("bromeliad", "Bromeliad", "Bromelia", ["bromeliad", "bromelia"]),
  p("cacao-tree", "Cacao tree", "Árbol de cacao", ["cacao", "cocoa"]),
  p("coffee-plant", "Coffee plant", "Cafeto", ["coffee", "café", "cafeto"]),
  p("peach-palm", "Peach palm", "Pejibaye", ["peach palm", "pejibaye"]),
  p("coconut-palm", "Coconut palm", "Palma de coco", ["coconut", "palm", "coco"]),
  p("red-mangrove", "Red mangrove", "Mangle rojo", ["mangrove", "mangle"]),
  p("cecropia", "Cecropia tree", "Guarumo", ["cecropia", "guarumo"]),
  p("passion-flower", "Passion flower", "Granadilla", ["passion flower", "passion fruit", "granadilla"]),
  p("monstera", "Monstera", "Mano de tigre", ["monstera"]),
  p("tree-fern", "Tree fern", "Helecho arborescente", ["fern", "helecho"]),
  p("corteza-amarilla", "Golden trumpet tree", "Corteza amarilla", ["corteza amarilla", "trumpet tree"]),
];

const BY_SLUG = new Map(NATURE_ART.map((x) => [x.slug, x]));

export function isNatureSlug(v: unknown): v is string {
  return typeof v === "string" && BY_SLUG.has(v);
}

export function natureArt(slug: string | null | undefined): NatureArt | null {
  return slug ? (BY_SLUG.get(slug) ?? null) : null;
}

/** A painting's public URL. */
export function natureArtUrl(slug: string): string {
  return `${NATURE_ART_URL}/${encodeURIComponent(slug)}.webp`;
}

/** FNV-1a, so a role's painting is the same on every server and every reload. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Every role's painting. A role an admin chose for keeps that painting; every other role draws one from its
 * id, stepping past paintings already taken so no two roles share one while the library has paintings left.
 * Roles are visited in id order, so the answer depends only on the roles and the choices, never on a page.
 *
 * `shownFirst` names the roles a visitor can see (listed and active). They draw before every other role, so
 * a hidden or rested role never takes a painting a shown one needed (live QA, 21 Nov 2026: 79 roles for 48
 * paintings put the same painting on several cards on /roles).
 */
export function assignNatureArt(roleIds: readonly string[], chosen: Readonly<Record<string, string>>, shownFirst: Iterable<string> = []): Record<string, string> {
  const out: Record<string, string> = {};
  const taken = new Set<string>();
  const all = Array.from(new Set(roleIds)).sort();
  const first = new Set(shownFirst);
  const ids = [...all.filter((id) => first.has(id)), ...all.filter((id) => !first.has(id))];
  for (const id of ids) {
    const pick = chosen[id];
    if (isNatureSlug(pick)) {
      out[id] = pick;
      taken.add(pick);
    }
  }
  const n = NATURE_ART.length;
  for (const id of ids) {
    if (out[id]) continue;
    const start = hash(id) % n;
    let slug = NATURE_ART[start]!.slug;
    for (let step = 0; step < n; step++) {
      const s = NATURE_ART[(start + step) % n]!.slug;
      if (!taken.has(s)) {
        slug = s;
        break;
      }
    }
    out[id] = slug;
    taken.add(slug);
  }
  return out;
}

/**
 * The painting a Digital Companion's name points at ("Sloth", "a hummingbird", "Tucán"), or null. The
 * longest matching word wins, so "great green macaw" beats "macaw" and "poison dart frog" beats "frog".
 */
export function companionArt(name: string | null | undefined): NatureArt | null {
  const text = ` ${String(name ?? "").toLowerCase().replace(/[.,;:!?()"'\/]/g, " ")} `;
  if (!text.trim()) return null;
  let best: { art: NatureArt; len: number } | null = null;
  for (const art of NATURE_ART) {
    for (const w of art.words) {
      if (text.includes(` ${w} `) || text.includes(` ${w}s `)) {
        if (!best || w.length > best.len) best = { art, len: w.length };
      }
    }
  }
  return best?.art ?? null;
}

/** The admin's choices as stored: role id to slug, unknown slugs dropped. */
export function readChosenArt(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [id, slug] of Object.entries(v as Record<string, unknown>)) {
    if (typeof id === "string" && id.length > 0 && id.length <= 120 && isNatureSlug(slug)) out[id] = slug;
  }
  return out;
}
