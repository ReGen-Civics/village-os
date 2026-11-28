/**
 * THE ACTS NOBODY TYPES: every tab, every dial, every key a village plants, and the entries admin search already
 * shipped. Each list is made from the catalog that owns it, so it is complete the day that catalog grows:
 *
 *   a tab      shared/adminTabs.ts            `tab.<key>`    a page; reads only
 *   a dial     shared/gameVariables.ts        `dial.<key>`   writes through the one dial door
 *   a key      shared/guilds.ts (the seeds)   `key.<slot>`   writes one sealed slot; its consequence line is the seed's
 *   a control  shared/adminSearch.ts          its shipped id, with its route added from the table below
 *   a page beside Admin   shared/adminSearch.ts   its shipped id
 *
 * Pure: no I/O, no clock.
 */
import { CONTROL_ENTRIES, OUTSIDE_ENTRIES, TAB_SYNONYMS, dialEntry, type AdminSearchEntry } from "../adminSearch";
import { ADMIN_TABS, type AdminPlace, type AdminTabEntry } from "../adminTabs";
import { VARIABLES, type VariableDef, type VariableType } from "../gameVariables";
import { SEEDS, type GuildSeed } from "../guilds";
import { CONTROL_PARITY, DIAL_PARITY, KEY_ALSO, KEY_PARITY, MINT_DIAL_CATEGORY, MINT_DIAL_PARITY, OUTSIDE_PARITY, TAB_PAGE_ALSO, TAB_PARITY, tabParity } from "./parity";
import { POST, PUT, bool, list, long, secret, text, type ActField, type ActFieldKind, type ActPower, type ActRoute, type AdminAct } from "./types";

// ── Tabs ───────────────────────────────────────────────────────────────────

/** The tabs that are pages of their own. An old address that opens another tab's page is listed once, under that tab. */
export const TAB_PAGES: readonly AdminTabEntry[] = ADMIN_TABS.filter((t) => !t.sameAs);

/** A tab as a page act: its one name, its line, and the words it is also found by. */
export function tabAct(t: AdminTabEntry): AdminAct {
  const olds = ADMIN_TABS.filter((o) => o.sameAs === t.key);
  const old = olds.flatMap((o) => TAB_SYNONYMS[o.key] ?? []);
  // Its own row of the ledger, the row of each old address that opens it, and the rows that live on its page.
  const parity = [TAB_PARITY[t.key], ...olds.map((o) => TAB_PARITY[o.key]), ...(TAB_PAGE_ALSO[t.key] ?? [])].filter((id): id is string => !!id);
  return {
    id: `tab.${t.key}`,
    kind: "page",
    place: t.place,
    tab: t.key,
    title: t.name,
    help: t.help,
    synonyms: Array.from(new Set([...(TAB_SYNONYMS[t.key] ?? []), ...old])),
    power: "admin",
    ...(parity.length ? { parity } : {}),
  };
}

// ── Dials ──────────────────────────────────────────────────────────────────

const DIAL_KIND: Record<VariableType, ActFieldKind> = {
  integer: "number",
  decimal: "number",
  percentage: "number",
  boolean: "boolean",
  choice: "choice",
  text: "text",
  longtext: "longtext",
};

/** The one field a dial takes, read off its own definition: its kind, its bounds, its unit and its choices. Never a value. */
export function dialField(def: VariableDef): ActField {
  return {
    key: "value",
    label: def.label || def.key,
    kind: DIAL_KIND[def.type],
    ...(def.choices ? { choices: def.choices.map((c) => c.value) } : {}),
    ...(def.min !== undefined ? { min: def.min } : {}),
    ...(def.max !== undefined ? { max: def.max } : {}),
    ...(def.unit ? { unit: def.unit } : {}),
  };
}

/** The door every dial is written through (server/lib/dialWrite.ts asks the one gate for `dial.set`). */
export const DIAL_ROUTE = "/api/admin/variables/:key";

/** A dial as an act. Its search face is admin search's own `dialEntry`, so both read the same words. */
export function dialAct(def: VariableDef): AdminAct {
  return {
    ...dialEntry(def),
    place: "greenhouse",
    power: "dial.set",
    route: PUT(DIAL_ROUTE, { key: def.key }),
    fields: [dialField(def)],
    parity: def.category === MINT_DIAL_CATEGORY ? [DIAL_PARITY, MINT_DIAL_PARITY] : [DIAL_PARITY],
  };
}

// ── Keys: the setup seeds that land in a sealed slot ───────────────────────

/** The door every sealed slot is written through. */
export const SECRET_ROUTE = "/api/admin/integrations/:key";

/** The sealed slots a seed lands in. Empty when it lands somewhere a person plants by hand (the host, DNS). */
export function seedSlots(seed: GuildSeed): string[] {
  return seed.handles.flatMap((h) => (h.store === "village-secret" ? [h.slot] : []));
}

const slotWords = (slot: string) => slot.replace(/_/g, " ");

/** One sealed slot of a seed as an act: plant the key under Integrations. What it changes is the seed's own consequence line. */
export function seedAct(seed: GuildSeed, slot: string, alone: boolean): AdminAct {
  const title = alone ? seed.title : `${seed.title}: ${slotWords(slot)}`;
  return {
    id: `key.${slot}`,
    kind: "act",
    place: "spring",
    tab: "integrations",
    title,
    help: `Plant this key under Integrations. It comes from ${seed.provider.name}.`,
    synonyms: [seed.provider.name, slotWords(slot), "key", "connect"],
    power: "admin",
    holder: "operator.secrets",
    route: PUT(SECRET_ROUTE, { key: slot }),
    fields: [secret("value", title)],
    seed: seed.id,
    parity: [KEY_PARITY, ...(KEY_ALSO[slot] ?? [])],
  };
}

// ── The entries admin search already shipped ───────────────────────────────

interface Adopted {
  place: AdminPlace;
  /** What the act's own door asks, where that differs from the search entry's key. */
  power?: ActPower;
  holder?: AdminAct["holder"];
  route?: ActRoute;
  fields?: readonly ActField[];
  partial?: true;
}

/**
 * What the registry adds to each shipped control: its place and the route behind it. A control with no row here is
 * still an act, on its tab's place, marked partial until somebody reads its door.
 */
/** The door a person edits the mail settings through. Its fields are one list: PERSON_SETTINGS_FIELDS, shared/comms/settings.ts. */
const COMMS_SETTINGS = "/api/admin/comms/settings";

export const CONTROL_ROUTES: Readonly<Record<string, Adopted>> = {
  "comms.test-email": { place: "tower", route: POST("/api/admin/comms/settings/test") },
  // Read on 28 Nov 2026 (server/routes/commsSettings.ts): the door asks the gate for comms.manage, and each control
  // below writes one field of that list.
  "comms.pause-all": { place: "tower", route: PUT(COMMS_SETTINGS), fields: [bool("paused", "Pause all automated email")] },
  "comms.postal-address": { place: "tower", route: PUT(COMMS_SETTINGS), fields: [long("postalAddress", "Postal address for the footer")] },
  "comms.consent-words": { place: "tower", route: PUT(COMMS_SETTINGS), fields: [long("consentText", "Words beside the tick-box on forms")] },
  "comms.recap-questions": { place: "tower", route: PUT(COMMS_SETTINGS), fields: [list("recapQuestions", "The two recap questions")] },
  "comms.rehearsal-inbox": { place: "tower", route: PUT(COMMS_SETTINGS), fields: [text("rehearsalTo", "Rehearsal inbox")] },
  "comms.investor-words": { place: "tower", route: PUT(COMMS_SETTINGS), fields: [bool("investorWordsReviewed", "Investor emails reviewed")] },
  // Connecting delivery reports makes the webhook at the provider and seals its secret. It takes no fields.
  "comms.delivery-reports": { place: "tower", route: POST("/api/admin/comms/settings/webhook") },
  // The inbox for each path is kept in the email document (server/index.ts): the door asks for an admin, and the
  // widening map lets a holder of operator.secrets through.
  "comms.reply-to": {
    place: "tower",
    power: "admin",
    holder: "operator.secrets",
    route: PUT("/api/admin/email-config"),
    fields: [text("investor", "Inbox for the investor path"), text("steward", "Inbox for the steward path"), text("resident", "Inbox for the resident path"), text("prosperity", "Inbox for the prosperity path")],
  },
  // The one visit program editor writes the visit document. Its fields are the document's own and were not read.
  "visit.program": { place: "library", power: "admin", holder: "story.tell", route: PUT("/api/admin/visit-config"), partial: true },
  "comms.api-key": { place: "tower", power: "admin", holder: "operator.secrets", route: PUT(SECRET_ROUTE, { key: "resend_api_key" }), fields: [secret("value", "Sending key (Resend)")] },
  "comms.sender": { place: "tower", route: PUT("/api/admin/comms/settings/sender"), fields: [text("name", "Sender name"), text("address", "Sender address")] },
  "comms.domain": { place: "tower", route: POST("/api/admin/comms/settings/domain"), fields: [text("name", "Sending domain")] },
  "comms.path-contacts": { place: "tower", route: PUT("/api/admin/comms/settings"), fields: [{ key: "pathContacts", label: "Who writes back for each path", kind: "list" }] },
  "season.timezone": { place: "spring", power: "admin", holder: "dial.set", route: PUT("/api/admin/seasons"), fields: [text("timezone", "The village's timezone")] },
  "project.fiatCurrency": { place: "spring", power: "admin", holder: "story.tell", route: PUT("/api/admin/brand"), fields: [text("currency", "The village's currency")] },
  "exit.closing": { place: "store", power: "admin", route: PUT("/api/admin/exit-policy/closing"), partial: true },
};

const tabPlace = (tab: string | undefined): AdminPlace => ADMIN_TABS.find((t) => t.key === tab)?.place ?? "frame";

/** A shipped control as an act: its words and its key are the search entry's own, unchanged. */
export function controlAct(e: AdminSearchEntry): AdminAct {
  const more = CONTROL_ROUTES[e.id];
  const { capability, ...words } = e;
  const parity = CONTROL_PARITY[e.id] ?? tabParity(e.tab);
  return {
    ...words,
    ...(parity ? { parity } : {}),
    place: more?.place ?? tabPlace(e.tab),
    power: more?.power ?? capability ?? "admin",
    ...(more?.holder ? { holder: more.holder } : {}),
    ...(more?.route ? { route: more.route } : {}),
    ...(more?.fields ? { fields: more.fields } : {}),
    ...(!more?.route || more.partial ? { partial: true as const } : {}),
  };
}

/** Where each page beside Admin lives on the grounds. A page with no row here is the frame's. */
export const OUTSIDE_PLACES: Readonly<Record<string, AdminPlace>> = {
  "page.modules": "greenhouse",
  "page.review": "hall",
  "page.approvals": "hall",
  "page.proposals": "hall",
  "page.mint": "store",
  "page.treasury": "store",
  "page.pricing": "store",
  "page.budget": "store",
  "page.powers": "gate",
  "page.role-measures": "gate",
  "page.decisions": "hall",
  "page.changes": "hall",
  "page.launch": "ceiba",
  "page.setup-game": "ceiba",
  "page.network": "greenhouse",
};

/** A shipped page beside Admin as an act. A page reads; it calls nothing. */
export function outsideAct(e: AdminSearchEntry): AdminAct {
  const { capability, ...words } = e;
  const parity = OUTSIDE_PARITY[e.id];
  return { ...words, place: OUTSIDE_PLACES[e.id] ?? "frame", power: capability ?? "admin", ...(parity ? { parity } : {}) };
}

// ── The lists ──────────────────────────────────────────────────────────────

export const TAB_ACTS: readonly AdminAct[] = TAB_PAGES.map(tabAct);
export const DIAL_ACTS: readonly AdminAct[] = VARIABLES.map(dialAct);
export const SEED_ACTS: readonly AdminAct[] = SEEDS.flatMap((s) => {
  const slots = seedSlots(s);
  return slots.map((slot) => seedAct(s, slot, slots.length === 1));
});
export const CONTROL_ACTS: readonly AdminAct[] = CONTROL_ENTRIES.map(controlAct);
export const OUTSIDE_ACTS: readonly AdminAct[] = OUTSIDE_ENTRIES.map(outsideAct);
