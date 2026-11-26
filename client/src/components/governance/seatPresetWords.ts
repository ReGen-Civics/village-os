/**
 * THE PLATFORM'S SEAT PRESETS, in the reader's language (the lead, 26 Nov 2026: the whole site in Spanish).
 *
 * Every `platform:` preset's label and blurb are English in shared/seatPresets.ts, and the term pickers drew them
 * as written. They are translated HERE, keyed by preset id. A village's own preset (`custom:<slug>`, served by
 * /api/seat-presets) is the village's words and is drawn as it wrote them, as is any id this file does not know.
 *
 * seatPresetWords.test.ts derives every preset from shared/seatPresets.ts and fails on one this file lacks or has
 * stale, or one with no Spanish.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";


export const SEAT_PRESET_WORDS: Readonly<Record<string, { label: MessageDescriptor; blurb: MessageDescriptor }>> = {
  "platform:until-season-end": {
    label: msg({ message: "Until the season ends", context: "role term preset platform:until-season-end, label" }),
    blurb: msg({ message: "The role runs to the end of the season it starts in.", context: "role term preset platform:until-season-end, blurb" }),
  },
  "platform:three-moons": {
    label: msg({ message: "Three moons", context: "role term preset platform:three-moons, label" }),
    blurb: msg({ message: "Three moons from the day of seating, then a review.", context: "role term preset platform:three-moons, blurb" }),
  },
  "platform:one-moon-trial": {
    label: msg({ message: "One moon trial", context: "role term preset platform:one-moon-trial, label" }),
    blurb: msg({ message: "One moon to try the role on, with a short notice either way.", context: "role term preset platform:one-moon-trial, blurb" }),
  },
  "platform:pay-month-work-moon": {
    label: msg({ message: "Paid monthly, works by the moon", context: "role term preset platform:pay-month-work-moon, label" }),
    blurb: msg({ message: "Money keeps the calendar month. The work keeps the moon.", context: "role term preset platform:pay-month-work-moon, blurb" }),
  },
  "platform:all-moon": {
    label: msg({ message: "Everything by the moon", context: "role term preset platform:all-moon, label" }),
    blurb: msg({ message: "Pay and work both keep the moon.", context: "role term preset platform:all-moon, blurb" }),
  },
  "platform:weekly-sync-plus-core-call": {
    label: msg({ message: "Weekly sync and a core call", context: "role term preset platform:weekly-sync-plus-core-call, label" }),
    blurb: msg({ message: "A short sync early in the week and a core call midweek.", context: "role term preset platform:weekly-sync-plus-core-call, blurb" }),
  },
  "platform:fortnightly": {
    label: msg({ message: "Fortnightly", context: "role term preset platform:fortnightly, label" }),
    blurb: msg({ message: "One gathering every other week.", context: "role term preset platform:fortnightly, blurb" }),
  },
  "platform:async-first": {
    label: msg({ message: "Async first", context: "role term preset platform:async-first, label" }),
    blurb: msg({ message: "No standing gatherings. The work is written down and picked up when it suits.", context: "role term preset platform:async-first, blurb" }),
  },
  "platform:unpaid": {
    label: msg({ message: "Unpaid", context: "role term preset platform:unpaid, label" }),
    blurb: msg({ message: "The role is held for the love of it. Nothing is owed.", context: "role term preset platform:unpaid, blurb" }),
  },
  "platform:honorary": {
    label: msg({ message: "Honorary", context: "role term preset platform:honorary, label" }),
    blurb: msg({ message: "An honour the village gives. Nothing is owed.", context: "role term preset platform:honorary, blurb" }),
  },
  "platform:fixed-monthly-stipend": {
    label: msg({ message: "Fixed monthly stipend", context: "role term preset platform:fixed-monthly-stipend, label" }),
    blurb: msg({ message: "One amount each month. The village writes in the amount.", context: "role term preset platform:fixed-monthly-stipend, blurb" }),
  },
  "platform:stipend-range": {
    label: msg({ message: "Stipend range", context: "role term preset platform:stipend-range, label" }),
    blurb: msg({ message: "A lowest and a highest amount each month, settled as the season goes.", context: "role term preset platform:stipend-range, blurb" }),
  },
  "platform:in-kind-or-deferred": {
    label: msg({ message: "In kind or deferred", context: "role term preset platform:in-kind-or-deferred, label" }),
    blurb: msg({ message: "Room, board or other support now, with any cash part owed for later.", context: "role term preset platform:in-kind-or-deferred, blurb" }),
  },
  "platform:no-allowance": {
    label: msg({ message: "No allowance", context: "role term preset platform:no-allowance, label" }),
    blurb: msg({ message: "Nothing on top of pay.", context: "role term preset platform:no-allowance, blurb" }),
  },
  "platform:flat-monthly-allowance": {
    label: msg({ message: "Flat monthly allowance", context: "role term preset platform:flat-monthly-allowance, label" }),
    blurb: msg({ message: "One amount each month for the costs of the role.", context: "role term preset platform:flat-monthly-allowance, blurb" }),
  },
  "platform:reimbursed": {
    label: msg({ message: "Costs reimbursed", context: "role term preset platform:reimbursed, label" }),
    blurb: msg({ message: "Agreed costs are paid back against receipts.", context: "role term preset platform:reimbursed, blurb" }),
  },
  "platform:no-bonus": {
    label: msg({ message: "No bonus", context: "role term preset platform:no-bonus, label" }),
    blurb: msg({ message: "No bonus on top.", context: "role term preset platform:no-bonus, blurb" }),
  },
  "platform:rated-equity-in-words": {
    label: msg({ message: "Rated equity, in words", context: "role term preset platform:rated-equity-in-words, label" }),
    blurb: msg({ message: "A share of equity, capped and rated in words the funders agree.", context: "role term preset platform:rated-equity-in-words, blurb" }),
  },
  "platform:three-to-five-done-when-by-consent": {
    label: msg({ message: "Three to five a moon, by consent", context: "role term preset platform:three-to-five-done-when-by-consent, label" }),
    blurb: msg({ message: "Three to five quests each moon, each with a done when, agreed by consent.", context: "role term preset platform:three-to-five-done-when-by-consent, blurb" }),
  },
  "platform:starter-measures": {
    label: msg({ message: "Starter measures", context: "role term preset platform:starter-measures, label" }),
    blurb: msg({ message: "Two plain measures of the work, each read from somewhere anyone can check.", context: "role term preset platform:starter-measures, blurb" }),
  },
  "platform:fourteen-days-notice": {
    label: msg({ message: "Fourteen days notice", context: "role term preset platform:fourteen-days-notice, label" }),
    blurb: msg({ message: "Either side gives fourteen days notice, and pay runs through it.", context: "role term preset platform:fourteen-days-notice, blurb" }),
  },
  "platform:whole-volunteer-seat": {
    label: msg({ message: "Volunteer role", context: "role term preset platform:whole-volunteer-seat, label" }),
    blurb: msg({ message: "Unpaid, async first, a few tasks a moon, until the season ends.", context: "role term preset platform:whole-volunteer-seat, blurb" }),
  },
  "platform:whole-stipend-seat": {
    label: msg({ message: "Stipend role", context: "role term preset platform:whole-stipend-seat, label" }),
    blurb: msg({ message: "A fixed monthly stipend and allowance for three moons, with a weekly rhythm.", context: "role term preset platform:whole-stipend-seat, blurb" }),
  },
  "platform:whole-core-team-seat": {
    label: msg({ message: "Core team role", context: "role term preset platform:whole-core-team-seat, label" }),
    blurb: msg({ message: "A stipend range, costs reimbursed and a rated equity bonus, for the season.", context: "role term preset platform:whole-core-team-seat, blurb" }),
  },
  "platform:whole-trial-moon": {
    label: msg({ message: "Trial moon", context: "role term preset platform:whole-trial-moon, label" }),
    blurb: msg({ message: "One honorary moon to try the role on before anything else is set.", context: "role term preset platform:whole-trial-moon, blurb" }),
  },
};

/** A preset's label and blurb in the reader's language; a village's own preset keeps its words. */
export function presetWords(preset: { id: string; label: string; blurb: string }, i18n: I18n = appI18n): { label: string; blurb: string } {
  const w = Object.prototype.hasOwnProperty.call(SEAT_PRESET_WORDS, preset.id) ? SEAT_PRESET_WORDS[preset.id] : undefined;
  return w ? { label: i18n._(w.label), blurb: i18n._(w.blurb) } : { label: preset.label, blurb: preset.blurb };
}
