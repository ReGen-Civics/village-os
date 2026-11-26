/**
 * THE CROWN BAR'S PLATFORM WORDS, in the reader's language (the lead, 26 Nov 2026: the whole site in Spanish).
 *
 * `GET /api/map/chips` resolves every chip in English (shared/mapStatChips.ts, `resolveChips`): a source's label,
 * the line under its number and the sentence saying what it counts, and the fixed sentences of an example chip and
 * a manual one. The shell carries them into the map as they are (statChips.ts). They are translated HERE, before
 * they are posted, keyed by the source and by the chip's state, never by its English.
 *
 * A chip's LABEL is the village's own once a founder types one, so it is translated only while it still reads as
 * the source's default, or as one of the five examples' defaults. A unit is written by the founder and is left
 * as it is, and so is a number. An English reader gets the chips exactly as the server sent them.
 *
 * statChipWords.test.ts derives every source from shared/mapStatChips.ts and every fixed sentence from
 * `resolveChips` itself, and fails on one this file lacks or has stale, or one with no Spanish.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { DEFAULT_MAP_CHIPS, STAT_SOURCES, isDay, isStatSource, type ResolvedChip, type StatSourceKey } from "@shared/mapStatChips";

export const STAT_SOURCE_WORDS: Readonly<Record<StatSourceKey, { label: MessageDescriptor; sub: MessageDescriptor; how: MessageDescriptor }>> = {
  members: {
    label: msg({ message: "Members", context: "map chip members, label" }),
    sub: msg({ message: "members", context: "map chip members, under the number" }),
    how: msg({ message: "Accounts in the village. Closed accounts and examples are not counted.", context: "map chip members, what it counts" }),
  },
  members_active: {
    label: msg({ message: "Active", context: "map chip members_active, label" }),
    sub: msg({ message: "active this cycle", context: "map chip members_active, under the number" }),
    how: msg({ message: "Members who did something the village heard about since this cycle began.", context: "map chip members_active, what it counts" }),
  },
  quests_open: {
    label: msg({ message: "Open quests", context: "map chip quests_open, label" }),
    sub: msg({ message: "quests open on the board", context: "map chip quests_open, under the number" }),
    how: msg({ message: "Quests on the board that are not closed. Examples are not counted.", context: "map chip quests_open, what it counts" }),
  },
  quests_done_cycle: {
    label: msg({ message: "Quests done", context: "map chip quests_done_cycle, label" }),
    sub: msg({ message: "quests done this cycle", context: "map chip quests_done_cycle, under the number" }),
    how: msg({ message: "Quest work the village consented to since this cycle began.", context: "map chip quests_done_cycle, what it counts" }),
  },
  quests_done_season: {
    label: msg({ message: "Quests done", context: "map chip quests_done_season, label" }),
    sub: msg({ message: "quests done this season", context: "map chip quests_done_season, under the number" }),
    how: msg({ message: "Quest work the village consented to since the current season began.", context: "map chip quests_done_season, what it counts" }),
  },
  gratitude_cycle: {
    label: msg({ message: "Hearts", context: "map chip gratitude_cycle, label" }),
    sub: msg({ message: "gratitude given this cycle", context: "map chip gratitude_cycle, under the number" }), // village-ok: the server's own words from shared/mapStatChips.ts, mirrored here to translate them
    how: msg({ message: "Gratitude members gave since this cycle began, less anything taken back.", context: "map chip gratitude_cycle, what it counts" }), // village-ok: the server's own words from shared/mapStatChips.ts, mirrored here to translate them
  },
  seats_open: {
    label: msg({ message: "Openings", context: "map chip seats_open, label" }),
    sub: msg({ message: "openings waiting for someone", context: "map chip seats_open, under the number" }),
    how: msg({
      message: "Places on the village's live roles that nobody holds. A place whose holder's term ran out counts as open.",
      context: "map chip seats_open, what it counts",
    }),
  },
  circles: {
    label: msg({ message: "Circles", context: "map chip circles, label" }),
    sub: msg({ message: "active and forming circles", context: "map chip circles, under the number" }),
    how: msg({
      message: "The village's circles that are active or forming. Dormant circles and examples are not counted.",
      context: "map chip circles, what it counts",
    }),
  },
  gatherings_ahead: {
    label: msg({ message: "Gatherings", context: "map chip gatherings_ahead, label" }),
    sub: msg({ message: "gatherings in the next 30 days", context: "map chip gatherings_ahead, under the number" }),
    how: msg({
      message: "Gatherings and festivals on the public calendar in the next 30 days, each date of a repeating one counted.",
      context: "map chip gatherings_ahead, what it counts",
    }),
  },
  trees_planted: {
    label: msg({ message: "Trees", context: "map chip trees_planted, label" }),
    sub: msg({ message: "trees planted", context: "map chip trees_planted, under the number" }),
    how: msg({
      message: "Plantings the village's stewards recorded in Village Health, withdrawn readings left out.",
      context: "map chip trees_planted, what it counts",
    }),
  },
  food_produced: {
    label: msg({ message: "Food", context: "map chip food_produced, label" }),
    sub: msg({ message: "harvest recorded", context: "map chip food_produced, under the number" }),
    how: msg({ message: "Harvest weighed and recorded in Village Health, withdrawn readings left out.", context: "map chip food_produced, what it counts" }),
  },
  water_protected: {
    label: msg({ message: "Water", context: "map chip water_protected, label" }),
    sub: msg({ message: "liters of water protected", context: "map chip water_protected, under the number" }),
    how: msg({ message: "Storage and springflow recorded in Village Health, withdrawn readings left out.", context: "map chip water_protected, what it counts" }),
  },
  hectares_restored: {
    label: msg({ message: "Restoring", context: "map chip hectares_restored, label" }),
    sub: msg({ message: "hectares in restoration", context: "map chip hectares_restored, under the number" }), // village-ok: the server's own words from shared/mapStatChips.ts, mirrored here to translate them
    how: msg({ message: "Land under active regeneration, as recorded in Village Health.", context: "map chip hectares_restored, what it counts" }),
  },
  carbon_sequestered: {
    label: msg({ message: "Carbon", context: "map chip carbon_sequestered, label" }),
    sub: msg({ message: "carbon sequestered", context: "map chip carbon_sequestered, under the number" }),
    how: msg({
      message: "Estimated sequestration from plantings and soil work, as recorded in Village Health.",
      context: "map chip carbon_sequestered, what it counts",
    }),
  },
  treasury: {
    label: msg({ message: "Treasury", context: "map chip treasury, label" }),
    sub: msg({ message: "held in the village treasury", context: "map chip treasury, under the number" }),
    how: msg({
      message: "What the village treasury holds of the token the cycle pool pays out, in whole tokens.",
      context: "map chip treasury, what it counts",
    }),
  },
};

/** The five examples' default labels, by chip id. */
export const EXAMPLE_CHIP_WORDS: Readonly<Record<string, MessageDescriptor>> = {
  people: msg({ message: "People", context: "map chip example people, label" }),
  food: msg({ message: "Food", context: "map chip example food, label" }),
  water: msg({ message: "Water", context: "map chip example water, label" }),
  canopy: msg({ message: "Canopy", context: "map chip example canopy, label" }),
  hearts: msg({ message: "Hearts", context: "map chip example hearts, label" }),
};

/** The sentences `resolveChips` writes for a chip's state, whatever it reads. */
export const CHIP_STATE_WORDS = {
  exampleHow: msg({ message: "An example. The founder has not chosen what this chip reads yet.", context: "map chip, an example's sentence" }),
  manualSub: msg({ message: "set by the founder", context: "map chip, a founder's number with no date" }),
  manualHow: msg({ message: "Set by the founder in Village settings.", context: "map chip, a founder's number with no date, its sentence" }),
  manualSubOn: msg({ message: "as of {day}", context: "map chip, a founder's number and its date" }),
  manualHowOn: msg({ message: "Set by the founder in Village settings. True as of {day}.", context: "map chip, a founder's number and its date, its sentence" }),
} as const;

const own = <T,>(table: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;

/** A founder's date, as the reader's language writes a day. */
function dayIn(day: string, locale: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** The chips as the server resolved them, with the platform's words in the reader's language. */
export function localizeChips(chips: readonly ResolvedChip[], i18n: I18n = appI18n): ResolvedChip[] {
  // English is the source: the server's words, and its date format, stand exactly as sent.
  if (!i18n.locale || i18n.locale === "en") return [...chips];
  return chips.map((c) => {
    const source = isStatSource(c.source) ? c.source : null;
    const words = source ? STAT_SOURCE_WORDS[source] : undefined;
    const example = DEFAULT_MAP_CHIPS.find((d) => d.id === c.id);
    let label = c.label;
    if (source && c.label === STAT_SOURCES[source].label) label = i18n._(words!.label);
    else if (example && c.label === example.label) label = i18n._(own(EXAMPLE_CHIP_WORDS, c.id)!);
    if (c.state === "example") return { ...c, label, how: i18n._(CHIP_STATE_WORDS.exampleHow) };
    if (c.state === "manual") {
      const dated = isDay(c.asOf);
      const day = dated ? dayIn(c.asOf, i18n.locale) : "";
      return {
        ...c,
        label,
        sub: dated ? i18n._({ ...CHIP_STATE_WORDS.manualSubOn, values: { day } }) : i18n._(CHIP_STATE_WORDS.manualSub),
        how: dated ? i18n._({ ...CHIP_STATE_WORDS.manualHowOn, values: { day } }) : i18n._(CHIP_STATE_WORDS.manualHow),
      };
    }
    if (!source || !words) return { ...c, label };
    const def = STAT_SOURCES[source];
    // A reading may write its own line under the number; only the source's own is the platform's to translate.
    return { ...c, label, sub: c.sub === def.sub ? i18n._(words.sub) : c.sub, how: c.how === def.how ? i18n._(words.how) : c.how };
  });
}
