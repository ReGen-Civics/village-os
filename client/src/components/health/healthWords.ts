/**
 * THE HEALTH METRICS' NAMES, in the reader's language (the lead, 26 Nov 2026: the whole site in Spanish).
 *
 * Each metric's label and unit are defined in English in shared/healthMetrics.ts, and the server sends them as
 * they are (the doughnut's wedges, the regeneration ledger). They are translated HERE, keyed by the metric's
 * key, and a unit by its English word. A key or a unit this file does not know is drawn as the server sent it,
 * so a unit a village typed for its own entries stays as written.
 *
 * healthWords.test.ts derives the keys, labels and units from shared/healthMetrics.ts and fails on one this file
 * lacks or has stale, or one with no Spanish.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";


export const HEALTH_METRIC_WORDS: Readonly<Record<string, { label: MessageDescriptor }>> = {
  "members_total": {
    label: msg({ message: "Members", context: "health metric members_total, label" }),
  },
  "members_active_cycle": {
    label: msg({ message: "Active this cycle", context: "health metric members_active_cycle, label" }),
  },
  "events_total_cycle": {
    label: msg({ message: "Village events", context: "health metric events_total_cycle, label" }),
  },
  "gratitude_senders_distinct": {
    label: msg({ message: "Members who gave recognition", context: "health metric gratitude_senders_distinct, label" }),
  },
  "gratitude_recipients_distinct": {
    label: msg({ message: "Members who were recognized", context: "health metric gratitude_recipients_distinct, label" }),
  },
  "gratitude_allowance_total": {
    label: msg({ message: "Recognition the village could give", context: "health metric gratitude_allowance_total, label" }),
  },
  "gratitude_allowance_given": {
    label: msg({ message: "Recognition the village gave", context: "health metric gratitude_allowance_given, label" }),
  },
  "gratitude_allowance_unspent": {
    label: msg({ message: "Recognition allowance unspent", context: "health metric gratitude_allowance_unspent, label" }),
  },
  "quests_consented_cycle": {
    label: msg({ message: "Quests consented", context: "health metric quests_consented_cycle, label" }),
  },
  "decisions_opened_cycle": {
    label: msg({ message: "Decisions opened", context: "health metric decisions_opened_cycle, label" }),
  },
  "library_utilization_pct": {
    label: msg({ message: "Library in use", context: "health metric library_utilization_pct, label" }),
  },
  "stay_occupancy_nights": {
    label: msg({ message: "Nights stayed", context: "health metric stay_occupancy_nights, label" }),
  },
  "treasury_balance": {
    label: msg({ message: "Treasury holdings", context: "health metric treasury_balance, label" }),
  },
  "gratitude_pool_issued": {
    label: msg({ message: "Recognition issued to date", context: "health metric gratitude_pool_issued, label" }),
  },
  "trees_planted": {
    label: msg({ message: "Trees planted", context: "health metric trees_planted, label" }),
  },
  "hectares_restored": {
    label: msg({ message: "Hectares in restoration", context: "health metric hectares_restored, label" }), // village-ok: the server's own metric words from shared/healthMetrics.ts, mirrored here to translate them
  },
  "food_produced_kg": {
    label: msg({ message: "Food produced", context: "health metric food_produced_kg, label" }),
  },
  "water_protected_liters": {
    label: msg({ message: "Water protected", context: "health metric water_protected_liters, label" }),
  },
  "carbon_sequestered_kg": {
    label: msg({ message: "Carbon sequestered", context: "health metric carbon_sequestered_kg, label" }),
  },
};

export const HEALTH_UNIT_WORDS: Readonly<Record<string, { unit: MessageDescriptor }>> = {
  "people": {
    unit: msg({ message: "people", context: "health metric unit, people" }),
  },
  "events": {
    unit: msg({ message: "events", context: "health metric unit, events" }),
  },
  "tokens": {
    unit: msg({ message: "tokens", context: "health metric unit, tokens" }),
  },
  "quests": {
    unit: msg({ message: "quests", context: "health metric unit, quests" }),
  },
  "decisions": {
    unit: msg({ message: "decisions", context: "health metric unit, decisions" }),
  },
  "nights": {
    unit: msg({ message: "nights", context: "health metric unit, nights" }),
  },
  "trees": {
    unit: msg({ message: "trees", context: "health metric unit, trees" }),
  },
  "liters": {
    unit: msg({ message: "liters", context: "health metric unit, liters" }),
  },
};

/** A metric's label in the reader's language, or the server's own when this file has none. */
export function metricLabel(key: string, label: string, i18n: I18n = appI18n): string {
  const w = HEALTH_METRIC_WORDS[key];
  return w ? i18n._(w.label) : label;
}

/** A unit in the reader's language when it is one the platform defines; any other is drawn as written. */
export function metricUnit(unit: string, i18n: I18n = appI18n): string {
  const w = Object.prototype.hasOwnProperty.call(HEALTH_UNIT_WORDS, unit) ? HEALTH_UNIT_WORDS[unit] : undefined;
  return w ? i18n._(w.unit) : unit;
}

type Row = { key?: unknown; label?: unknown; unit?: unknown };
const named = <T extends Row>(r: T, i18n: I18n): T => ({
  ...r,
  ...(typeof r.key === "string" && typeof r.label === "string" ? { label: metricLabel(r.key, r.label, i18n) } : {}),
  ...(typeof r.unit === "string" ? { unit: metricUnit(r.unit, i18n) } : {}),
});
const each = <T extends Row>(rows: unknown, i18n: I18n): T[] | unknown => (Array.isArray(rows) ? rows.map((r: T) => named(r, i18n)) : rows);

/**
 * The /api/health/summary payload with the platform's metric words in the reader's language: the regeneration
 * metrics, their totals and recent entries, and the doughnut's wedges. Numbers and a village's own notes are
 * untouched.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the page reads this payload untyped
export function localizeHealth(data: any, i18n: I18n = appI18n): any {
  if (!data || typeof data !== "object") return data;
  const out = { ...data };
  if (data.regen && typeof data.regen === "object") {
    const totals = data.regen.totals && typeof data.regen.totals === "object" ? data.regen.totals : null;
    out.regen = {
      ...data.regen,
      metrics: each(data.regen.metrics, i18n),
      latest: each(data.regen.latest, i18n),
      ...(totals ? { totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, named(v as Row, i18n)])) } : {}),
    };
  }
  if (data.doughnut && typeof data.doughnut === "object") {
    out.doughnut = { ...data.doughnut, foundation: each(data.doughnut.foundation, i18n), regen: each(data.doughnut.regen, i18n) };
  }
  return out;
}
