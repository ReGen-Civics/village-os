/**
 * The `{words}` a page field may use, from the village's own settings.
 *
 * One function for both sides: the browser fills a page with it
 * (`usePageVars`), and the server fills the words it renders from page fields:
 * the Work With Us acknowledgement email, and the membership letter it
 * renders, fingerprints and stores (shared/membershipLetter.ts). Two copies of these rules
 * would drift, and a founder would see `{village}` filled one way on the page
 * and another way in the inbox.
 *
 * Every one of these was a setting a founder could already change that the
 * brochure pages never read: the audit of 2026-10-22 found "Love Letter" typed
 * twenty times beside a commitment name nobody used, and a member name that
 * was required in setup and shown nowhere.
 */
import type { PageVars } from "./types";

/** The slice of the public game config the words come from. */
export interface PageVarSource {
  project?: {
    name?: unknown;
    tagline?: unknown;
    location?: unknown;
    memberName?: unknown;
    commitmentName?: unknown;
    roleName?: unknown;
    catalystName?: unknown;
  } | null;
  currency?: { name?: unknown; collectiveName?: unknown; value?: { name?: unknown } | null } | null;
  /**
   * The village's own nouns (gap G4), ALREADY RESOLVED by shared/vocabulary.ts
   * `vocabularyOf` (the config serves them resolved, and the server passes
   * them resolved). Read here without importing that module, so the noun
   * table is not part of every page's first load.
   */
  vocabulary?: unknown;
}

/**
 * `{circle}`, `{circles}`, `{a-circle}` and the rest from a resolved
 * vocabulary; the village noun is `{village-noun}`, since `{village}` is the
 * name. Nothing for a slot the source lacks, so a page names it as typed.
 */
function nounWords(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [slot, n] of Object.entries(raw as Record<string, { one?: unknown; many?: unknown; a?: unknown }>)) {
    if (!n || typeof n.one !== "string" || typeof n.many !== "string") continue;
    const key = slot === "village" ? "village-noun" : slot;
    out[key] = n.one;
    out[`${key}s`] = n.many;
    out[`a-${key}`] = `${typeof n.a === "string" ? n.a : "a"} ${n.one}`;
  }
  return out;
}

export function pageVarsFrom(config: PageVarSource): PageVars {
  const word = (typed: unknown, fallback: string) => String(typed ?? "").trim() || fallback;
  const { project, currency } = config;
  const location = word(project?.location, "");
  const village = word(project?.name, "the village");
  return {
    village,
    // Never blank: the Home headline is `{tagline}` by default, and a
    // village that cleared its Tagline still needs a headline.
    tagline: word(project?.tagline, `Welcome to ${village}`),
    location,
    "in-location": location ? ` in ${location}` : "",
    member: word(project?.memberName, "member"),
    commitment: word(project?.commitmentName, "membership agreement"),
    role: word(project?.roleName, "role"),
    catalyst: word(project?.catalystName, "steward"),
    token: word(currency?.name, "recognition"),
    value: word(currency?.value?.name, "village tokens"),
    // The umbrella word for every token together, set in Admin then Tokens.
    tokens: word(currency?.collectiveName, "Village Tokens"),
    // The village's own nouns, `{circle}`, `{circles}`, `{a-circle}` and the
    // rest (gap G4). The platform's words when the village set none.
    ...nounWords(config.vocabulary),
  };
}
