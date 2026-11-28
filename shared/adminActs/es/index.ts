/**
 * THE REGISTRY OF ACTS IN SPANISH: every entry that is not a dial, by its id. The Spanish is awaiting a native reader.
 *
 * One file per place, as the English has (shared/adminActs/<place>.ts), and `shipped.ts` for the entries nobody
 * types in a place file: the Admin tabs, the controls and the pages beside Admin that admin search shipped, and the
 * keys a village plants. shared/adminActsWords.ts lays these over an entry for a reader of Spanish, and
 * shared/adminActsWords.test.ts fails by name on an id with no Spanish or a Spanish row with no act.
 *
 * WRITING A ROW. Costa Rican Spanish, `usted`, warm and plain (docs/I18N.md). A title is a short name or an action.
 * The line is one plain sentence. The synonyms are what a founder who reads Spanish would TYPE to find it, two to
 * five of them, everyday words included; the English title and synonyms are added behind them when it is served.
 * A tab's title is the Spanish its own Admin page already shows (client/src/locales/es.po).
 *
 * Dials are not here: their Spanish is the Game Mechanics page's (client/src/pages/gameMechanicsDialWords.ts).
 *
 * Pure: no I/O, no clock. Only the server reads it.
 */
import type { AdminPlace } from "../../adminTabs";
import type { ActWords } from "../types";
import { CEIBA_WORDS_ES } from "./ceiba";
import { FIRE_WORDS_ES } from "./fire";
import { GATE_WORDS_ES } from "./gate";
import { GREENHOUSE_WORDS_ES } from "./greenhouse";
import { GUIDE_WORDS_ES } from "./guide";
import { HALL_WORDS_ES } from "./hall";
import { LIBRARY_WORDS_ES } from "./library";
import { STAGE_WORDS_ES } from "./stage";
import { STORE_WORDS_ES } from "./store";
import { TOWER_WORDS_ES } from "./tower";

/** No native reader has read this table yet. It turns false, by a person's hand, the day one has. */
export const ES_AWAITING_NATIVE_READ = true;

/** The written acts' Spanish, place by place. A place with no file yet holds none. */
export const ES_PLACE_WORDS: Readonly<Partial<Record<AdminPlace, Readonly<Record<string, ActWords>>>>> = {
  fire: FIRE_WORDS_ES,
  hall: HALL_WORDS_ES,
  gate: GATE_WORDS_ES,
  library: LIBRARY_WORDS_ES,
  greenhouse: GREENHOUSE_WORDS_ES,
  store: STORE_WORDS_ES,
  tower: TOWER_WORDS_ES,
  stage: STAGE_WORDS_ES,
  ceiba: CEIBA_WORDS_ES,
  guide: GUIDE_WORDS_ES,
};

/** The Spanish of the tabs, the shipped controls, the pages beside Admin and the keys. */
export const ES_SHIPPED_WORDS: Readonly<Record<string, ActWords>> = {};

/** Every act's Spanish words, by act id. */
export const ADMIN_ACT_WORDS_ES: Readonly<Record<string, ActWords>> = Object.assign({}, ES_SHIPPED_WORDS, ...Object.values(ES_PLACE_WORDS));
