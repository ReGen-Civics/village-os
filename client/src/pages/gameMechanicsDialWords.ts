/**
 * THE DIALS' WORDS, in the reader's language (the lead, 26 Nov 2026: the whole site in Spanish).
 *
 * Every dial's label, description, category, unit and choices are English in shared/gameVariables.ts, and
 * /api/game/mechanics serves them as they are. The public /game-mechanics page drew them as they arrived. They are
 * translated HERE, keyed by the dial's key (a choice by its value, a category and a unit by their English word), and
 * `localizeDials` swaps them in as the snapshot arrives, so search, grouping, the editors and the history all read
 * the reader's language. A key, a choice, a category or a unit this file does not know is drawn as the server sent
 * it. The stage ladder's names are one table by stage id (DIAL_STAGE_WORDS), shared by every "Stage that unlocks"
 * dial. The language picker's choices are each language's own name and stay as they are.
 *
 * gameMechanicsDialWords.test.ts derives every dial from shared/gameVariables.ts and fails on one this file lacks or
 * has stale, or one with no Spanish.
 *
 * Only /game-mechanics imports this, so its words ride that page's lazy chunk, and the long descriptions leave
 * dist/public with the rest of the long copy (client/src/i18n/copySplit.ts).
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
// The dials' own words, in three files so none passes the line limit (scripts/check-file-lines.mjs). Same chunk.
import { DIAL_WORDS_1 } from "./gameMechanicsDialWords1";
import { DIAL_WORDS_2 } from "./gameMechanicsDialWords2";
import { DIAL_WORDS_3 } from "./gameMechanicsDialWords3";

export interface DialWords {
  label: MessageDescriptor;
  description: MessageDescriptor;
  /** By choice value. */
  choices?: Readonly<Record<string, { label: MessageDescriptor; hint?: MessageDescriptor }>>;
}

export const DIAL_WORDS: Readonly<Record<string, DialWords>> = { ...DIAL_WORDS_1, ...DIAL_WORDS_2, ...DIAL_WORDS_3 };

/** The stage ladder's names, by stage id: the choices of every "Stage that unlocks" dial. */
export const DIAL_STAGE_WORDS: Readonly<Record<string, MessageDescriptor>> = {
  "visitor": msg({ message: "Visitor", context: "game variable stage choice visitor" }),
  "guest": msg({ message: "Guest", context: "game variable stage choice guest" }),
  "immersant": msg({ message: "Immersant", context: "game variable stage choice immersant" }),
  "participant": msg({ message: "Participant", context: "game variable stage choice participant" }),
  "member": msg({ message: "Member", context: "game variable stage choice member" }),
  "contributor": msg({ message: "Contributor", context: "game variable stage choice contributor" }),
  "quest-seeker": msg({ message: "Quest Seeker", context: "game variable stage choice quest-seeker" }),
  "initiate": msg({ message: "Initiate", context: "game variable stage choice initiate" }),
  "co-creator": msg({ message: "Co-Creator", context: "game variable stage choice co-creator" }),
  "role-holder": msg({ message: "Role Holder", context: "game variable stage choice role-holder" }),
  "guide": msg({ message: "Guide", context: "game variable stage choice guide" }),
  "sage": msg({ message: "Sage", context: "game variable stage choice sage" }),
};

/** A dial category by its English name. */
export const DIAL_CATEGORY_WORDS: Readonly<Record<string, MessageDescriptor>> = {
  "Membership": msg({ message: "Membership", context: "game variable category" }),
  "Season places": msg({ message: "Season places", context: "game variable category" }),
  "Governance": msg({ message: "Governance", context: "game variable category" }),
  "Village": msg({ message: "Village", context: "game variable category" }),
  "Gratitude": msg({ message: "Gratitude", context: "game variable category" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  "Ledger": msg({ message: "Ledger", context: "game variable category" }),
  "The Mint": msg({ message: "The Mint", context: "game variable category" }),
  "Progression": msg({ message: "Progression", context: "game variable category" }),
  "Quests": msg({ message: "Quests", context: "game variable category" }),
  "Tokens": msg({ message: "Tokens", context: "game variable category" }),
  "Hypha": msg({ message: "Hypha", context: "game variable category" }),
  "Tools": msg({ message: "Tools", context: "game variable category" }),
  "Accounts & sessions": msg({ message: "Accounts & sessions", context: "game variable category" }),
  "Email and reminders": msg({ message: "Email and reminders", context: "game variable category" }),
  "Abuse guards": msg({ message: "Abuse guards", context: "game variable category" }),
  "Data lifecycle": msg({ message: "Data lifecycle", context: "game variable category" }),
  "Automation": msg({ message: "Automation", context: "game variable category" }),
  "Village map": msg({ message: "Village map", context: "game variable category" }),
  "The village's people": msg({ message: "The village's people", context: "game variable category" }),
  "Companions": msg({ message: "Companions", context: "game variable category" }),
  "The founding team": msg({ message: "The founding team", context: "game variable category" }),
  "Events": msg({ message: "Events", context: "game variable category" }),
  "Forum": msg({ message: "Forum", context: "game variable category" }),
  "Messages": msg({ message: "Messages", context: "game variable category" }),
  "Feed": msg({ message: "Feed", context: "game variable category" }),
  "Stays": msg({ message: "Stays", context: "game variable category" }),
  "Exchange": msg({ message: "Exchange", context: "game variable category" }),
  "Library": msg({ message: "Library", context: "game variable category" }),
  "Payments": msg({ message: "Payments", context: "game variable category" }),
  "Health": msg({ message: "Health", context: "game variable category" }),
  "Badges": msg({ message: "Badges", context: "game variable category" }),
  "Platform": msg({ message: "Platform", context: "game variable category" }),
  "Calendar": msg({ message: "Calendar", context: "game variable category" }),
  "Introductions": msg({ message: "Introductions", context: "game variable category" }),
  "Exit": msg({ message: "Exit", context: "game variable category" }),
  "Needs": msg({ message: "Needs", context: "game variable category" }),
  "Journal": msg({ message: "Journal", context: "game variable category" }),
  "Hidden map": msg({ message: "Hidden map", context: "game variable category" }),
  "Connector": msg({ message: "Connector", context: "game variable category" }),
  "Live Sessions": msg({ message: "Live Sessions", context: "game variable category" }),
  "Language": msg({ message: "Language", context: "game variable category" }),
};

/** A dial's unit by its English word. A symbol (%, MB, USD, bps, h UTC) reads the same in every language. */
export const DIAL_UNIT_WORDS: Readonly<Record<string, MessageDescriptor>> = {
  "vouches": msg({ message: "vouches", context: "game variable unit" }),
  "seasons": msg({ message: "seasons", context: "game variable unit" }),
  "places": msg({ message: "places", context: "game variable unit" }),
  "Gratitude": msg({ message: "Gratitude", context: "game variable unit" }), // village-ok: the server's own words from shared/gameVariables.ts, mirrored here to translate them
  "tokens": msg({ message: "tokens", context: "game variable unit" }),
  "credits per cycle": msg({ message: "credits per cycle", context: "game variable unit" }),
  "per credit": msg({ message: "per credit", context: "game variable unit" }),
  "days": msg({ message: "days", context: "game variable unit" }),
  "per whole token": msg({ message: "per whole token", context: "game variable unit" }),
  "voice": msg({ message: "voice", context: "game variable unit" }),
  "equity": msg({ message: "equity", context: "game variable unit" }),
  "% a cycle": msg({ message: "% a cycle", context: "game variable unit" }),
  "full sends": msg({ message: "full sends", context: "game variable unit" }),
  "changes": msg({ message: "changes", context: "game variable unit" }),
  "members": msg({ message: "members", context: "game variable unit" }),
  "per cycle": msg({ message: "per cycle", context: "game variable unit" }),
  "supporters": msg({ message: "supporters", context: "game variable unit" }),
  "hours": msg({ message: "hours", context: "game variable unit" }),
  "cycles": msg({ message: "cycles", context: "game variable unit" }),
  "change requests": msg({ message: "change requests", context: "game variable unit" }),
  "per day": msg({ message: "per day", context: "game variable unit" }),
  "o'clock": msg({ message: "o'clock", context: "game variable unit" }),
  "minutes before": msg({ message: "minutes before", context: "game variable unit" }),
  "minutes": msg({ message: "minutes", context: "game variable unit" }),
  "months": msg({ message: "months", context: "game variable unit" }),
  "per second": msg({ message: "per second", context: "game variable unit" }),
  "per hour": msg({ message: "per hour", context: "game variable unit" }),
  "per 15 min": msg({ message: "per 15 min", context: "game variable unit" }),
  "% of the day": msg({ message: "% of the day", context: "game variable unit" }),
  "calls a day": msg({ message: "calls a day", context: "game variable unit" }),
  "messages": msg({ message: "messages", context: "game variable unit" }),
  "photos": msg({ message: "photos", context: "game variable unit" }),
  "reports": msg({ message: "reports", context: "game variable unit" }),
  "moons": msg({ message: "moons", context: "game variable unit" }),
  "clips": msg({ message: "clips", context: "game variable unit" }),
  "seconds": msg({ message: "seconds", context: "game variable unit" }),
  "questions": msg({ message: "questions", context: "game variable unit" }),
  "people": msg({ message: "people", context: "game variable unit" }),
  "characters": msg({ message: "characters", context: "game variable unit" }),
  "hearts": msg({ message: "hearts", context: "game variable unit" }),
  "nights": msg({ message: "nights", context: "game variable unit" }),
  "credits": msg({ message: "credits", context: "game variable unit" }),
  "entries": msg({ message: "entries", context: "game variable unit" }),
  "badges": msg({ message: "badges", context: "game variable unit" }),
  "visitors": msg({ message: "visitors", context: "game variable unit" }),
  "list": msg({ message: "list", context: "game variable unit" }),
  "introductions": msg({ message: "introductions", context: "game variable unit" }),
  "points": msg({ message: "points", context: "game variable unit" }),
  "% kept": msg({ message: "% kept", context: "game variable unit" }),
  "credits per Voice": msg({ message: "credits per Voice", context: "game variable unit" }),
  "in the pool token": msg({ message: "in the pool token", context: "game variable unit" }),
  "% of needs": msg({ message: "% of needs", context: "game variable unit" }),
  "% of members": msg({ message: "% of members", context: "game variable unit" }),
  "pins": msg({ message: "pins", context: "game variable unit" }),
  "zoom": msg({ message: "zoom", context: "game variable unit" }),
  "plantings": msg({ message: "plantings", context: "game variable unit" }),
  "line": msg({ message: "line", context: "game variable unit" }),
  "x base budget": msg({ message: "x base budget", context: "game variable unit" }),
  "consented quests": msg({ message: "consented quests", context: "game variable unit" }),
};

const own = <T,>(table: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;

/** A dial's label in the reader's language, or the server's own when this file has none. */
export function dialLabel(key: string, label: string, i18n: I18n = appI18n): string {
  const w = own(DIAL_WORDS, key);
  return w ? i18n._(w.label) : label;
}

interface ServedDial {
  key: string;
  category: string;
  label: string;
  description: string;
  unit: string | null;
  choices: Array<{ value: string; label: string; hint?: string }> | null;
}

/** The dials as the server served them, with the platform's words in the reader's language. Values are untouched. */
export function localizeDials<V extends ServedDial>(dials: readonly V[], i18n: I18n = appI18n): V[] {
  return dials.map((v) => {
    const w = own(DIAL_WORDS, v.key);
    const cat = own(DIAL_CATEGORY_WORDS, v.category);
    const unit = v.unit ? own(DIAL_UNIT_WORDS, v.unit) : undefined;
    return {
      ...v,
      label: w ? i18n._(w.label) : v.label,
      description: w ? i18n._(w.description) : v.description,
      category: cat ? i18n._(cat) : v.category,
      unit: unit ? i18n._(unit) : v.unit,
      choices:
        v.choices && w
          ? v.choices.map((c) => {
              const cw = w.choices ? own(w.choices, c.value) : undefined;
              if (!cw) {
                const stage = v.key.startsWith("progression.unlock.") ? own(DIAL_STAGE_WORDS, c.value) : undefined;
                return stage ? { ...c, label: i18n._(stage) } : c;
              }
              return { ...c, label: i18n._(cw.label), ...(c.hint && cw.hint ? { hint: i18n._(cw.hint) } : {}) };
            })
          : v.choices,
    };
  });
}
