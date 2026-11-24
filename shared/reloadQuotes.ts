/**
 * THE QUOTES ON THE REFRESH SCREEN (components/ErrorBoundary.tsx).
 *
 * When a page outlives a deploy and the one automatic reload did not bring it
 * back, or a page crashes, the visitor sees a card asking them to refresh. A
 * short line from the old nature writers and the Daoist classics sits under
 * the button, a different one each time, so the wait reads as a pause.
 *
 * RULES FOR THIS LIST. A village may replace it wholesale (it is plain data
 * with no village name in it), and whoever does keeps these rules:
 *
 *  - PUBLIC DOMAIN ONLY. The author and the translator are both long dead and
 *    the edition is out of copyright. No modern translation of the Tao Te
 *    Ching or Zhuangzi, however lovely, and no living author.
 *  - VERBATIM. Every English line below was checked word for word against the
 *    edition named in `source`, on Wikisource, on 24 Nov 2026. Legge's
 *    parentheses are his own and stay. A line may be an excerpt from a longer
 *    sentence, closed with a full stop where the excerpt ends mid-sentence and
 *    opened with a capital where it began mid-sentence (Muir's "But in every
 *    walk", Thoreau's "in Wildness"); the words themselves are never changed.
 *  - NO FOLK ATTRIBUTIONS. The widely shared "Indigenous proverbs" and the
 *    Chief Seattle speech have no documented source, so none are here. Add one
 *    only with a citable printed source.
 *  - `es` is our own Spanish rendering of the English line, marked for a native
 *    speaker to review before anybody treats it as settled (needsNativeReview).
 *
 * The list is its own small chunk, fetched only when the screen shows, so it
 * costs a visitor nothing until then. The screen keeps one standby quote of
 * its own for when even this file will not load.
 */

export interface ReloadQuote {
  /** The words, verbatim from `source`. */
  text: string;
  /** Who wrote or said it. */
  by: string;
  /** The work, chapter and edition the words were checked against. */
  source: string;
  /** Spanish, translated by us from the English above. */
  es: string;
}

/** Every `es` below is a first draft from the English and waits for a native speaker. */
export const RELOAD_QUOTES_ES_NEEDS_NATIVE_REVIEW = true;

const LEGGE = "Tao Te Ching, tr. James Legge (1891)";

export const RELOAD_QUOTES: readonly ReloadQuote[] = [
  {
    text: "The highest excellence is like (that of) water.",
    by: "Laozi",
    source: `${LEGGE}, ch. 8`,
    es: "La más alta excelencia es como (la del) agua.",
  },
  {
    text: "The thirty spokes unite in the one nave; but it is on the empty space (for the axle), that the use of the wheel depends.",
    by: "Laozi",
    source: `${LEGGE}, ch. 11`,
    es: "Los treinta rayos se unen en un solo cubo; pero del espacio vacío (para el eje) depende el uso de la rueda.",
  },
  {
    text: "Who can (make) the muddy water (clear)? Let it be still, and it will gradually become clear.",
    by: "Laozi",
    source: `${LEGGE}, ch. 15`,
    es: "¿Quién puede (aclarar) el agua turbia? Déjala quieta, y poco a poco se aclarará.",
  },
  {
    text: "When things (in the vegetable world) have displayed their luxuriant growth, we see each of them return to its root.",
    by: "Laozi",
    source: `${LEGGE}, ch. 16`,
    es: "Cuando las cosas (del mundo vegetal) han mostrado su crecimiento exuberante, vemos a cada una volver a su raíz.",
  },
  {
    text: "The partial becomes complete; the crooked, straight; the empty, full; the worn out, new.",
    by: "Laozi",
    source: `${LEGGE}, ch. 22`,
    es: "Lo parcial se vuelve completo; lo torcido, recto; lo vacío, lleno; lo gastado, nuevo.",
  },
  {
    text: "He who knows other men is discerning; he who knows himself is intelligent.",
    by: "Laozi",
    source: `${LEGGE}, ch. 33`,
    es: "Quien conoce a los demás es perspicaz; quien se conoce a sí mismo es inteligente.",
  },
  {
    text: "The softest thing in the world dashes against and overcomes the hardest.",
    by: "Laozi",
    source: `${LEGGE}, ch. 43`,
    es: "Lo más blando del mundo choca contra lo más duro y lo vence.",
  },
  {
    text: "Who is content / Needs fear no shame. / Who knows to stop / Incurs no blame.",
    by: "Laozi",
    source: `${LEGGE}, ch. 44`,
    es: "Quien está contento / no teme la vergüenza. / Quien sabe detenerse / no carga culpa.",
  },
  {
    text: "(The master of it) anticipates things that are difficult while they are easy, and does things that would become great while they are small.",
    by: "Laozi",
    source: `${LEGGE}, ch. 63`,
    es: "(Quien lo domina) atiende lo difícil mientras es fácil, y hace lo que llegará a ser grande mientras es pequeño.",
  },
  {
    text: "The tree which fills the arms grew from the tiniest sprout; the tower of nine storeys rose from a (small) heap of earth; the journey of a thousand li commenced with a single step.",
    by: "Laozi",
    source: `${LEGGE}, ch. 64`,
    es: "El árbol que llena los brazos creció del brote más diminuto; la torre de nueve pisos se alzó de un (pequeño) montón de tierra; el viaje de mil li comenzó con un solo paso.",
  },
  {
    text: "The first is gentleness; the second is economy; and the third is shrinking from taking precedence of others.",
    by: "Laozi",
    source: `${LEGGE}, ch. 67`,
    es: "El primero es la gentileza; el segundo, la frugalidad; y el tercero, no buscar ponerse por delante de los demás.",
  },
  {
    text: "Thus it is that firmness and strength are the concomitants of death; softness and weakness, the concomitants of life.",
    by: "Laozi",
    source: `${LEGGE}, ch. 76`,
    es: "Así, la rigidez y la fuerza acompañan a la muerte; la suavidad y la flexibilidad acompañan a la vida.",
  },
  {
    text: "The more that he expends for others, the more does he possess of his own; the more that he gives to others, the more does he have himself.",
    by: "Laozi",
    source: `${LEGGE}, ch. 81`,
    es: "Cuanto más gasta en los demás, más posee; cuanto más da a los demás, más tiene.",
  },
  {
    text: "Once upon a time, I, Chuang Tzŭ, dreamt I was a butterfly, fluttering hither and thither, to all intents and purposes a butterfly.",
    by: "Zhuangzi",
    source: "Chuang Tzŭ, tr. Herbert A. Giles (1889), ch. 2",
    es: "Una vez, yo, Chuang Tzŭ, soñé que era una mariposa, revoloteando de aquí para allá, una mariposa en todo sentido.",
  },
  {
    text: "In every walk with Nature one receives far more than he seeks.",
    by: "John Muir",
    source: "Steep Trails (1918), ch. 9",
    es: "En cada paseo con la Naturaleza uno recibe mucho más de lo que busca.",
  },
  {
    text: "Everybody needs beauty as well as bread, places to play in and pray in, where Nature may heal and cheer and give strength to body and soul alike.",
    by: "John Muir",
    source: "The Yosemite (1912), ch. 16",
    es: "Todos necesitamos belleza además de pan, lugares donde jugar y orar, donde la Naturaleza pueda sanar, alegrar y dar fuerza al cuerpo y al alma por igual.",
  },
  {
    text: "I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach.",
    by: "Henry David Thoreau",
    source: "Walden (1854), Where I Lived, and What I Lived For",
    es: "Fui a los bosques porque quería vivir con intención, enfrentar solo los hechos esenciales de la vida, y ver si podía aprender lo que tenía para enseñar.",
  },
  {
    text: "Simplicity, simplicity, simplicity!",
    by: "Henry David Thoreau",
    source: "Walden (1854), Where I Lived, and What I Lived For",
    es: "¡Sencillez, sencillez, sencillez!",
  },
  {
    text: "Heaven is under our feet as well as over our heads.",
    by: "Henry David Thoreau",
    source: "Walden (1854), The Pond in Winter",
    es: "El cielo está bajo nuestros pies tanto como sobre nuestras cabezas.",
  },
  {
    text: "In Wildness is the preservation of the World.",
    by: "Henry David Thoreau",
    source: "Walking (1862)",
    es: "En lo salvaje está la preservación del mundo.",
  },
  {
    text: "We need the tonic of wildness.",
    by: "Henry David Thoreau",
    source: "Walden (1854), Spring",
    es: "Necesitamos el tónico de lo salvaje.",
  },
  {
    text: "In the woods, we return to reason and faith.",
    by: "Ralph Waldo Emerson",
    source: "Nature (1836), ch. 1",
    es: "En los bosques volvemos a la razón y a la fe.",
  },
  {
    text: "I believe a leaf of grass is no less than the journey-work of the stars.",
    by: "Walt Whitman",
    source: "Song of Myself, Leaves of Grass (1882), 31",
    es: "Creo que una hoja de hierba no es menos que la obra de las estrellas.",
  },
];

/**
 * One quote, a different one from the last the visitor saw in this tab when
 * the list allows it. `random` and `last` are injectable for tests.
 */
export function pickReloadQuote(
  quotes: readonly ReloadQuote[] = RELOAD_QUOTES,
  random: () => number = Math.random,
  last = -1,
): { quote: ReloadQuote; index: number } | null {
  if (quotes.length === 0) return null;
  let index = Math.floor(random() * quotes.length) % quotes.length;
  if (quotes.length > 1 && index === last) index = (index + 1) % quotes.length;
  return { quote: quotes[index], index };
}

/** Where this tab remembers the last quote it showed. */
export const LAST_QUOTE_KEY = "village.refresh-quote";

/**
 * The quote for the screen showing now, remembered in this tab so the next
 * refresh screen shows another. It lives here, in the lazy chunk, so the boot
 * chunk pays only for the call. No storage (a private window) only means a
 * quote may repeat.
 */
export function nextReloadQuote(quotes: readonly ReloadQuote[] = RELOAD_QUOTES): ReloadQuote | null {
  let last = -1;
  try {
    last = Number(globalThis.sessionStorage?.getItem(LAST_QUOTE_KEY) ?? -1);
  } catch {
    // No storage.
  }
  const picked = pickReloadQuote(quotes, Math.random, last);
  try {
    if (picked) globalThis.sessionStorage?.setItem(LAST_QUOTE_KEY, String(picked.index));
  } catch {
    // No storage.
  }
  return picked ? picked.quote : null;
}
