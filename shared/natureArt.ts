/**
 * THE NATURE ART LIBRARY: PAINTED ANIMALS AND PLANTS OF COSTA RICA (Rye, 20 Nov 2026; 35 more of the south
 * Pacific coast around Dominical, 23 Nov 2026, so NATURE_ART.length is the count, never a number in prose).
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
import { isShown } from "./roleListing";
import { NATURE_ART_FILES } from "./natureArtFiles";

export const NATURE_ART_URL = "/images/nature";

export type NatureKind = "animal" | "plant";

/** Where an animal lives, for the admin library's filter. Plants are their own group. */
export type NatureGroup = "land" | "bird" | "ocean" | "plant";

export interface NatureArt {
  /** The file name without .webp, and the id stored when an admin picks this painting. */
  slug: string;
  /** English common name. */
  name: string;
  /** The name used in Costa Rica. */
  es: string;
  kind: NatureKind;
  group: NatureGroup;
  /** Words a role card's Digital Companion may be named with that mean this painting, lower case. */
  words: readonly string[];
}

const a = (slug: string, name: string, es: string, words: string[], group: NatureGroup = "land"): NatureArt => ({ slug, name, es, kind: "animal", group, words });
const b = (slug: string, name: string, es: string, words: string[]): NatureArt => a(slug, name, es, words, "bird");
const o = (slug: string, name: string, es: string, words: string[]): NatureArt => a(slug, name, es, words, "ocean");
const p = (slug: string, name: string, es: string, words: string[]): NatureArt => ({ slug, name, es, kind: "plant", group: "plant", words });

/** The whole library: land animals, birds, ocean, then plants. The order is the admin grid's and the auto-assignment's. */
export const NATURE_ART: readonly NatureArt[] = [
  a("howler-monkey", "Mantled howler monkey", "Mono congo", ["howler monkey", "howler", "congo", "monkey"]),
  a("three-toed-sloth", "Three-toed sloth", "Perezoso de tres dedos", ["sloth", "perezoso"]),
  a("red-eyed-tree-frog", "Red-eyed tree frog", "Rana calzonuda", ["red-eyed tree frog", "tree frog", "frog", "rana"]),
  a("white-faced-capuchin", "White-faced capuchin", "Mono carablanca", ["capuchin", "carablanca"]),
  a("squirrel-monkey", "Squirrel monkey", "Mono tití", ["squirrel monkey", "tití", "titi"]),
  a("jaguar", "Jaguar", "Jaguar", ["jaguar"]),
  a("ocelot", "Ocelot", "Manigordo", ["ocelot", "manigordo", "wildcat", "cat"]),
  a("bairds-tapir", "Baird's tapir", "Danta", ["tapir", "danta"]),
  a("white-nosed-coati", "White-nosed coati", "Pizote", ["coati", "pizote"]),
  a("blue-morpho", "Blue morpho butterfly", "Morpho azul", ["blue morpho", "morpho", "butterfly", "mariposa"]),
  a("strawberry-poison-dart-frog", "Strawberry poison dart frog", "Rana blue jeans", ["poison dart frog", "dart frog", "blue jeans"]),
  a("glass-frog", "Glass frog", "Rana de vidrio", ["glass frog"]),
  a("american-crocodile", "American crocodile", "Cocodrilo", ["crocodile", "cocodrilo", "croc"]),
  a("green-iguana", "Green iguana", "Iguana verde", ["iguana"]),
  a("emerald-basilisk", "Emerald basilisk", "Basilisco verde", ["basilisk", "basilisco", "lizard"]),
  a("kinkajou", "Kinkajou", "Martilla", ["kinkajou", "martilla"]),
  a("leafcutter-ants", "Leafcutter ants", "Zompopas", ["leafcutter", "ant", "ants", "zompopa"]),
  a("eyelash-viper", "Eyelash viper", "Bocaracá", ["viper", "snake", "serpent", "bocaracá"]),
  a("white-tailed-deer", "White-tailed deer", "Venado cola blanca", ["white-tailed deer", "deer", "venado"]),
  a("collared-peccary", "Collared peccary", "Saíno", ["peccary", "saíno", "saino"]),
  a("northern-tamandua", "Northern tamandua", "Oso hormiguero", ["tamandua", "anteater", "oso hormiguero"]),
  a("nine-banded-armadillo", "Nine-banded armadillo", "Armadillo", ["armadillo"]),
  a("tayra", "Tayra", "Tolomuco", ["tayra", "tolomuco"]),
  a("jaguarundi", "Jaguarundi", "León breñero", ["jaguarundi", "breñero"]),
  a("central-american-spider-monkey", "Central American spider monkey", "Mono araña", ["spider monkey", "mono araña"]),
  a("spectacled-caiman", "Spectacled caiman", "Caimán", ["caiman", "caimán"]),
  a("green-and-black-poison-frog", "Green-and-black poison frog", "Rana venenosa verde y negra", ["green and black poison frog", "poison frog"]),
  b("scarlet-macaw", "Scarlet macaw", "Lapa roja", ["scarlet macaw", "macaw", "lapa roja", "lapa", "parrot"]),
  b("resplendent-quetzal", "Resplendent quetzal", "Quetzal", ["quetzal"]),
  b("keel-billed-toucan", "Keel-billed toucan", "Tucán pico iris", ["toucan", "tucán", "tucan"]),
  b("violet-sabrewing", "Violet sabrewing hummingbird", "Colibrí ala de sable", ["hummingbird", "colibrí", "colibri", "sabrewing"]),
  b("great-green-macaw", "Great green macaw", "Lapa verde", ["great green macaw", "green macaw", "lapa verde"]),
  b("roseate-spoonbill", "Roseate spoonbill", "Garza rosada", ["spoonbill", "garza rosada", "flamingo"]),
  b("turquoise-browed-motmot", "Turquoise-browed motmot", "Momoto cejiceleste", ["motmot", "momoto"]),
  b("clay-colored-thrush", "Clay-colored thrush", "Yigüirro", ["thrush", "yigüirro", "yiguirro", "songbird", "bird"]),
  b("fiery-billed-aracari", "Fiery-billed aracari", "Cusingo", ["aracari", "cusingo"]),
  b("yellow-throated-toucan", "Yellow-throated toucan", "Dióstedé", ["yellow-throated toucan", "dióstedé", "diostede"]),
  b("spectacled-owl", "Spectacled owl", "Búho de anteojos", ["owl", "búho", "buho"]),
  b("king-vulture", "King vulture", "Zopilote rey", ["vulture", "zopilote"]),
  b("montezuma-oropendola", "Montezuma oropendola", "Oropéndola", ["oropendola", "oropéndola"]),
  b("orange-collared-manakin", "Orange-collared manakin", "Saltarín cuellinaranja", ["manakin", "saltarín"]),
  b("magnificent-frigatebird", "Magnificent frigatebird", "Tijereta de mar", ["frigatebird", "tijereta"]),
  b("brown-pelican", "Brown pelican", "Pelícano pardo", ["pelican", "pelícano"]),
  b("turquoise-cotinga", "Turquoise cotinga", "Cotinga turquesa", ["cotinga"]),
  b("bairds-trogon", "Baird's trogon", "Trogón vientrirrojo", ["trogon", "trogón"]),
  b("boat-billed-heron", "Boat-billed heron", "Pico cuchara", ["boat-billed heron", "heron", "pico cuchara"]),
  b("ringed-kingfisher", "Ringed kingfisher", "Martín pescador collarejo", ["kingfisher", "martín pescador"]),
  o("leatherback-turtle", "Leatherback sea turtle", "Tortuga baula", ["leatherback", "baula", "sea turtle", "turtle", "tortuga"]),
  o("olive-ridley-turtle", "Olive ridley sea turtle", "Tortuga lora", ["olive ridley", "tortuga lora"]),
  o("humpback-whale", "Humpback whale", "Ballena jorobada", ["humpback", "whale", "ballena"]),
  o("hammerhead-shark", "Scalloped hammerhead shark", "Tiburón martillo", ["hammerhead", "shark", "tiburón"]),
  o("bottlenose-dolphin", "Bottlenose dolphin", "Delfín nariz de botella", ["dolphin", "delfín", "delfin", "bottlenose"]),
  o("spotted-dolphin", "Pantropical spotted dolphin", "Delfín manchado", ["spotted dolphin", "delfín manchado"]),
  o("green-sea-turtle", "Green sea turtle", "Tortuga verde", ["green sea turtle", "green turtle", "tortuga verde"]),
  o("hawksbill-turtle", "Hawksbill sea turtle", "Tortuga carey", ["hawksbill", "carey"]),
  o("manta-ray", "Giant manta ray", "Manta gigante", ["manta", "ray", "mantarraya"]),
  o("spotted-eagle-ray", "Spotted eagle ray", "Raya águila", ["eagle ray", "raya águila"]),
  o("roosterfish", "Roosterfish", "Pez gallo", ["roosterfish", "pez gallo"]),
  o("parrotfish", "Parrotfish", "Pez loro", ["parrotfish", "pez loro"]),
  o("octopus", "Octopus", "Pulpo", ["octopus", "pulpo"]),
  o("sally-lightfoot-crab", "Sally lightfoot crab", "Cangrejo zapaya", ["crab", "cangrejo", "zapaya"]),
  o("sea-star", "Sea star", "Estrella de mar", ["starfish", "sea star", "estrella de mar"]),
  o("yellow-bellied-sea-snake", "Yellow-bellied sea snake", "Serpiente marina", ["sea snake", "serpiente marina"]),
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
  p("gumbo-limbo", "Gumbo limbo", "Indio desnudo", ["gumbo limbo", "indio desnudo"]),
  p("hot-lips", "Hot lips", "Labios de novia", ["hot lips", "labios de novia"]),
];

const BY_SLUG = new Map(NATURE_ART.map((x) => [x.slug, x]));

export function isNatureSlug(v: unknown): v is string {
  return typeof v === "string" && BY_SLUG.has(v);
}

export function natureArt(slug: string | null | undefined): NatureArt | null {
  return slug ? (BY_SLUG.get(slug) ?? null) : null;
}

export type NatureArtSize = "full" | "sm";

/**
 * A painting's public URL: the 720x960 file, or with "sm" the 360x480 copy for a thumbnail or a strip a few
 * centimetres wide. The file's fingerprint rides along as `?v=` (shared/natureArtFiles.ts, written by
 * scripts/nature-art-sizes.mjs), so a repainted file has a new address the moment it ships and the server can let
 * readers keep each one for a year. Until 21 Nov 2026 a hand-kept list did this, and a repaint nobody added to it
 * kept showing the old picture for a day.
 */
export function natureArtUrl(slug: string, size: NatureArtSize = "full"): string {
  const v = NATURE_ART_FILES[slug]?.[size];
  return `${NATURE_ART_URL}/${size === "sm" ? "sm/" : ""}${encodeURIComponent(slug)}.webp${v ? `?v=${v}` : ""}`;
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
 * The roles a visitor sees on /roles: active, and listed, coming soon or a future venture (isShown, the same
 * test /api/org puts a visitor's roles through). A coming-soon role or a venture is often unlisted, so
 * `listed` alone left them out (live QA on 1.3.48: two shown roles still shared a painting).
 */
export function shownRoleIds(roles: ReadonlyArray<{ id: string; active?: boolean; listed?: boolean | null; comingSoon?: boolean | null; futureVenture?: boolean | null }>): string[] {
  return roles.filter((r) => r.active !== false && isShown(r)).map((r) => r.id);
}

/**
 * Every role's painting. A role an admin chose for keeps that painting; every other role draws one from its
 * id, stepping past paintings already taken so no two roles share one while the library has paintings left.
 * Roles are visited in id order, so the answer depends only on the roles and the choices, never on a page.
 *
 * `shownFirst` names the roles a visitor can see (shownRoleIds). They draw before every other role, so a
 * hidden or rested role never takes a painting a shown one needed (live QA, 21 Nov 2026: 79 roles for 48
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
