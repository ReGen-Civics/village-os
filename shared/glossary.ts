/**
 * A VILLAGE'S OWN WORDS, EXPLAINED (the lead, 25 Nov 2026: "tooltips next to them!").
 *
 * A visitor met words the village uses for itself with nothing to say what they mean: a root, the formation, a
 * domain, a moon and its allowance, the village's credits and its voice, a quorum, a quest. Each one now carries a
 * small info mark beside it (client/src/components/GlossaryTip.tsx) that opens one plain sentence.
 *
 * THE MEANINGS ARE THE VILLAGE'S, never the platform's. This file names the slots, which words they stand beside and
 * what each slot is for (for the Admin box); the sentence itself lives in the content section `app-glossary`
 * (Admin, Make it yours, Identity, "Words you explain"), the same plane as the village's own nouns
 * (shared/vocabulary.ts). A slot with no sentence draws no mark at all, so a village that writes nothing reads what
 * it read before, and no fork is handed another village's meanings. The first village's sentences are a seed applied
 * by hand (server/seeds/amora/glossary-seed.json).
 *
 * Read on the page from the public content route and cleaned here, so a stored value that is not a short sentence
 * never reaches a page.
 */

export const GLOSSARY_SECTION = "app-glossary";
/** One plain sentence, a little room over. */
export const MEANING_MAX = 280;

/** The slots, each with what it explains (for the Admin box). The words a page shows are the page's own. */
export const GLOSSARY_SLOTS = {
  root: { what: "A root: the kind of contribution a member grows from, picked on the roles page" },
  formation: { what: "Formation: the view that draws the founding team in rings" },
  domain: { what: "A domain: the part of the work a role or circle looks after" },
  moon: { what: "A moon: the village's cycle, and its name (the November Moon)" },
  allowance: { what: "An allowance: what a member may give each cycle on the thanks wall" },
  credits: { what: "Your value token, the one each cycle's pool pays out (Village Credits)" },
  voice: { what: "Voice: the say a member has in the village's votes" },
  quorum: { what: "Quorum: how much of the village must take part before a vote counts" },
  quest: { what: "A quest: a piece of work the village needs, open to take up" },
} as const;

export type GlossarySlot = keyof typeof GLOSSARY_SLOTS;
export const GLOSSARY_SLOT_IDS = Object.keys(GLOSSARY_SLOTS) as GlossarySlot[];

/** The village's sentences, by slot. A slot it left blank is absent. */
export type Glossary = Partial<Record<GlossarySlot, string>>;

const clean = (v: unknown): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MEANING_MAX) : "";

/**
 * The stored section, cleaned: `{ root: "…" }` or `{ root: { meaning: "…" } }`, unknown slots and blanks dropped.
 * Anything else reads as no glossary at all.
 */
export function glossaryOf(raw: unknown): Glossary {
  const d = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Glossary = {};
  for (const slot of GLOSSARY_SLOT_IDS) {
    const v = d[slot];
    const meaning = clean(v && typeof v === "object" ? (v as Record<string, unknown>).meaning : v);
    if (meaning) out[slot] = meaning;
  }
  return out;
}
