/**
 * EACH MODULE'S MENU ENTRY: ITS DEFAULT NAME AND PLACE, AND THE RULES A VILLAGE'S OWN CHOICE IS HELD TO (the lead,
 * 27 Nov 2026: "when you turn a module on, you actually say what its name is going to be we give it a default name
 * and where in the menu it will show up").
 *
 * MENU_SHAPE is the platform's menu as the server needs it to judge a place: every entry's address, folder and module
 * gates, in client/src/config/nav.ts's order, and a module entry's own default name. The shell draws nav.ts; this
 * copy exists because the server and the proposal path cannot load nav.ts (its icons are React). client/src/config/
 * moduleMenu.test.ts holds the two equal, so a menu change that forgets this file fails by name.
 *
 * A module entry's default place is where MENU_SHAPE puts it: its group, its folder and its position. A village that
 * never chooses anything gets exactly that menu. Its choices live in its menu document (shared/menuDoc.ts `places`),
 * and `placesProblem` is the content route's and the proposal path's one check of them.
 *
 * THE RULES (client/src/config/navNest.test.ts holds the platform's own menu to the same):
 *   - a group shows five rows at most, Village six (the lead, 27 Nov 2026: "Allow six rows"); the account menu five;
 *   - a folder holds five entries at most;
 *   - a place names a group the menu has, and a folder that group has;
 *   - the Module Library stays at the bottom of the menu.
 * They are counted with every module on, every page served and every audience at once, which is the most any reader
 * can ever be shown, so a place that passes today cannot break the menu when the village turns on one more module.
 *
 * Pure: no React, no i18n, no database. The sentences are the content route's refusals, in plain English; the editors
 * show their own translated words for the same checks.
 */
import { TASK_BOARD_PATH, TASK_MENU } from "./taskMenu";
import { MENU_ACCOUNT, MENU_AT_MAX, MENU_PINNED_LAST, placeItems, placesOf, positionIn, rowStarts, type MenuPlace } from "./menuPlace";

export interface ShapeEntry {
  href: string;
  sub?: string;
  module?: string;
  unlessModule?: string;
  /** A module entry's default name, in the platform's English (translated where it is drawn, navWords.ts). */
  label?: string;
}

export interface ShapeGroup {
  /** The platform's group name (NavGroup.label), or MENU_ACCOUNT for the account menu. */
  key: string;
  items: readonly ShapeEntry[];
}

const e = (href: string, sub?: string, module?: string, label?: string): ShapeEntry => ({
  href,
  ...(sub ? { sub } : {}),
  ...(module ? { module } : {}),
  ...(label ? { label } : {}),
});

export const MENU_SHAPE: readonly ShapeGroup[] = [
  {
    key: "Join",
    items: [
      e("/investor", "Choose your path"),
      e("/steward", "Choose your path"),
      e("/resident", "Choose your path"),
      e("/prosperity", "Choose your path"),
      e("/roles"),
      e("/visit"),
      e("/partner", "Build with us"),
      e("/propose-quest", "Build with us"),
      e("/opportunities", "Build with us"),
      e("/work-with-us", "Build with us"),
      e("/contribute", "Fund the village", "commerce", "Contribute"),
      e("/campaigns", "Fund the village", "crowdpool", "Crowd pooling"),
    ],
  },
  {
    key: "Village",
    items: [
      e("/map", "Maps", "map", "Living Map"),
      e("/hidden-map", "Maps", "hidden-map", "Hidden map"),
      e("/quests"),
      e("/housing", "Places and homes"),
      e("/stay", "Places and homes", "stays", "Stay"),
      e("/rights#good-neighbor", "Places and homes"),
      e("/places", "Places and homes", "map", "Places"),
      e("/library", undefined, "library", "Library"),
      e("/village-health", undefined, "health", "Village Health"),
      e("/tools", "Tools", "tools", "Village Tools"),
    ],
  },
  {
    key: "Community",
    items: [
      e("/team", "Our story"),
      e("/master-plan", "Our story"),
      e("/love-letter", "Our story"),
      e("/network", "Our story", "network", "Village Network"),
      e("/feed", "Conversations", "feed", "Feed"),
      e("/forum", "Conversations", "forum", "Forum"),
      e("/feedback", "Conversations"),
      e("/gratitude"),
      e("/events", "Gatherings", "events", "Events"),
      e("/sessions", "Gatherings", "sessions", "Live Sessions"),
      e("/seasonal-festivals", "Gatherings"),
      e("/rites", "Welcoming", "rites", "Rites"),
      e("/introductions", "Welcoming", "introductions", "Introductions"),
    ],
  },
  {
    key: "Govern",
    items: [
      e("/governance", "Decide"),
      e("/governance/decisions", "Decide", "governance", "Decisions"),
      e("/governance/treasury", "Decide"),
      e("/propose", "Decide", "governance", "Make a Proposal"),
      e("/map/circles", "Circles & Roles", "map", "Circles"),
      { href: "/circles", sub: "Circles & Roles", unlessModule: "map" },
      e("/roles", "Circles & Roles"),
      e("/powers", "Circles & Roles"),
      e("/circles#role-measures", "Circles & Roles"),
      e("/season", "This season"),
      e("/funding-rounds", "This season", "funding-rounds", "Funding Rounds"),
      e("/quests", "This season"),
      e("/co-creators-guide", "Guides"),
      e("/training", "Guides"),
      e("/rights", "Guides"),
      e("/rights#leaving-well", "Guides"),
      e("/protocols", "Guides", "protocols", "Protocols"),
      e("/governance/how", "How we work"),
      e("/governance/how#game-mechanics", "How we work"),
      e("/how-we-create", "How we work"),
      e("/village-email", "How we work", "comms", "Village Email"),
      e(MENU_PINNED_LAST, "How we work"),
    ],
  },
  {
    key: MENU_ACCOUNT,
    items: [
      e("/profile"),
      e("/messages", undefined, "messaging", "Messages"),
      e(TASK_BOARD_PATH, undefined, "sessions", TASK_MENU.label),
      e("/governance/work", "Your things"),
      e("/wallet", "Your things", "exchange", "Wallet"),
      e("/pay", "Your things"),
      e("/journal", "Your things", "journal", "Journal"),
      e("/badges", "Your things", "badges", "Badges"),
      e("/journey-to-launch", "Running the village"),
      e("/governance/treasury#desks", "Running the village"),
      e("/project-history", "Running the village"),
      e("/admin/review", "Running the village"),
      e("/admin", "Running the village"),
    ],
  },
];

/** The most rows a group shows. Village six (the lead, 27 Nov 2026: "Allow six rows"); every other five. */
export const ROWS_ALLOWED: Readonly<Record<string, number>> = { Village: 6 };
export const ROWS_DEFAULT = 5;
export const FOLDER_MAX = 5;

export const rowsAllowed = (group: string): number => ROWS_ALLOWED[group] ?? ROWS_DEFAULT;

export interface ModuleMenuEntry {
  module: string;
  href: string;
  /** The default name, in the platform's English. */
  label: string;
  /** The default place: where the platform's menu puts it. */
  place: MenuPlace & { at: number };
}


/** Every module's menu entries, with the name and place each ships with, in the menu's order. */
export function moduleMenuEntries(shape: readonly ShapeGroup[] = MENU_SHAPE): ModuleMenuEntry[] {
  return shape.flatMap((g) =>
    g.items.flatMap((it, i) =>
      it.module
        ? [{ module: it.module, href: it.href, label: it.label ?? it.href, place: { group: g.key, ...(it.sub ? { sub: it.sub } : {}), at: positionIn(g.items, i) } }]
        : [],
    ),
  );
}

export const MODULE_MENU: readonly ModuleMenuEntry[] = moduleMenuEntries();

/** A module's own menu entries (most have one; the map has three). */
export function moduleMenuFor(moduleId: string): ModuleMenuEntry[] {
  return MODULE_MENU.filter((m) => m.module === moduleId);
}

/** The platform folders a group holds, in the menu's order. */
export function foldersOf(group: string, shape: readonly ShapeGroup[] = MENU_SHAPE): string[] {
  const g = shape.find((x) => x.key === group);
  return g ? Array.from(new Set(g.items.map((i) => i.sub).filter((s): s is string => !!s))) : [];
}

/** A group's name in a refusal: the account menu by what it is, a group by the platform's word. */
export const groupWords = (group: string): string => (group === MENU_ACCOUNT ? "your account menu" : group);

/**
 * What a reader could ever be shown at once, for counting: every module on and every entry a gate could open, with
 * one module off at a time for the entries that stand in for a module (`unlessModule`), and the hidden left out.
 */
function scenarios(shape: readonly ShapeGroup[]): ((it: ShapeEntry) => boolean)[] {
  const swaps = Array.from(new Set(shape.flatMap((g) => g.items.map((i) => i.unlessModule).filter((m): m is string => !!m))));
  return [(it) => !it.unlessModule, ...swaps.map((m) => (it: ShapeEntry) => it.module !== m && (!it.unlessModule || it.unlessModule === m))];
}

export interface PlaceProblem {
  /** The entry the problem is about, or null for one about a group. */
  href: string | null;
  code: "not-module" | "no-group" | "no-folder" | "at" | "rows" | "folder-full" | "library-last";
  /** The group or folder it is about, by the platform's name. */
  group?: string;
  folder?: string;
  /** The count it would reach, and the most allowed. */
  count?: number;
  max?: number;
  sentence: string;
}

/**
 * Every rule a set of places breaks, against the platform's menu with the village's hidden entries left out.
 * Empty when the menu they make is one the rules allow.
 */
export function placeProblems(rawPlaces: unknown, hidden: readonly string[] = [], shape: readonly ShapeGroup[] = MENU_SHAPE): PlaceProblem[] {
  const out: PlaceProblem[] = [];
  const raw = rawPlaces && typeof rawPlaces === "object" && !Array.isArray(rawPlaces) ? (rawPlaces as Record<string, unknown>) : {};
  const places = placesOf(raw);
  const groups = shape.map((g) => g.key);
  const entries = new Map(shape.flatMap((g) => g.items.filter((i) => i.module).map((i) => [i.href, i] as const)));
  for (const [href, p] of Object.entries(places)) {
    const it = entries.get(href);
    if (!it) {
      out.push({ href, code: "not-module", sentence: `${href} is not a module's entry in the menu. Only a module's own entries move.` });
      continue;
    }
    const name = it.label ?? href;
    if (!groups.includes(p.group)) {
      out.push({ href, code: "no-group", group: p.group, sentence: `There is no "${p.group}" group in the menu. Choose Join, Village, Community, Govern or your account menu for ${name}.` });
      continue;
    }
    if (p.sub && !foldersOf(p.group, shape).includes(p.sub)) {
      out.push({ href, code: "no-folder", group: p.group, folder: p.sub, sentence: `${groupWords(p.group)} has no "${p.sub}" folder. Choose one of its folders for ${name}, or a row of its own.` });
    }
  }
  for (const [href, v] of Object.entries(raw)) {
    const at = v && typeof v === "object" ? (v as Record<string, unknown>).at : undefined;
    if (at !== undefined && !(typeof at === "number" && Number.isInteger(at) && at >= 0 && at <= MENU_AT_MAX)) {
      out.push({ href, code: "at", sentence: `The position for ${href} must be a whole number from 0 to ${MENU_AT_MAX}.` });
    }
  }
  if (out.length) return out;

  const placed = placeItems(shape, places);
  for (const href of placed.past) {
    out.push({ href, code: "library-last", sentence: `The Module Library stays at the bottom of the menu. Choose a place above it for ${entries.get(href)?.label ?? href}.` });
  }
  const reported = new Set<string>();
  for (const shows of scenarios(shape)) {
    for (const g of placed.groups) {
      const items = g.items.filter((i) => shows(i) && !hidden.includes(i.href));
      const rows = rowStarts(items).length;
      const max = rowsAllowed(g.key);
      if (rows > max && !reported.has(`rows:${g.key}`)) {
        reported.add(`rows:${g.key}`);
        const groupName = groupWords(g.key);
        out.push({
          href: null,
          code: "rows",
          group: g.key,
          count: rows,
          max,
          sentence: `${groupName.charAt(0).toUpperCase()}${groupName.slice(1)} would show ${rows} rows once every module is on, and it shows ${max} at most. Put the entry in one of its folders, or choose another group.`,
        });
      }
      for (const sub of Array.from(new Set(items.map((i) => i.sub).filter((s): s is string => !!s)))) {
        const n = items.filter((i) => i.sub === sub).length;
        if (n > FOLDER_MAX && !reported.has(`folder:${g.key}:${sub}`)) {
          reported.add(`folder:${g.key}:${sub}`);
          out.push({
            href: null,
            code: "folder-full",
            group: g.key,
            folder: sub,
            count: n,
            max: FOLDER_MAX,
            sentence: `The "${sub}" folder in ${groupWords(g.key)} would hold ${n} entries once every module is on, and a folder holds ${FOLDER_MAX} at most. Choose another folder, or a row of its own.`,
          });
        }
      }
    }
  }
  return out;
}

/** The content route's refusal for a set of places, or null. */
export function placesProblem(rawPlaces: unknown, hidden: readonly string[] = []): string | null {
  if (rawPlaces === undefined) return null;
  if (!rawPlaces || typeof rawPlaces !== "object" || Array.isArray(rawPlaces)) return "Places come as { address: { group, sub, at } }.";
  return placeProblems(rawPlaces, hidden)[0]?.sentence ?? null;
}

/** A name and a place for one module entry, as an editor holds it. */
export interface MenuChoice {
  href: string;
  /** The village's own name; blank keeps the default. */
  label: string;
  place: MenuPlace;
}

const samePlaceAs = (a: MenuPlace, b: MenuPlace) => a.group === b.group && (a.sub ?? "") === (b.sub ?? "") && (a.at ?? -1) === (b.at ?? -1);

/** The choice a village holds now for an entry: its own name or blank, and its own place or the default. */
export function choiceOf(entry: ModuleMenuEntry, doc: { labels: Readonly<Record<string, string>>; places?: Readonly<Record<string, MenuPlace>> }): MenuChoice {
  return { href: entry.href, label: doc.labels[entry.href] ?? "", place: doc.places?.[entry.href] ?? entry.place };
}

/**
 * The menu document with these choices in it. A name equal to the default, or blank, keeps the default, and a place
 * equal to the default is no place at all, so keeping the defaults writes nothing.
 */
export function withChoices<D extends { labels: Record<string, string>; places?: Record<string, MenuPlace> }>(doc: D, choices: readonly MenuChoice[]): D {
  const labels = { ...doc.labels };
  const places: Record<string, MenuPlace> = { ...(doc.places ?? {}) };
  for (const c of choices) {
    const entry = MODULE_MENU.find((m) => m.href === c.href);
    if (!entry) continue;
    const name = c.label.replace(/\s+/g, " ").trim();
    if (name && name !== entry.label) labels[c.href] = name;
    else delete labels[c.href];
    if (samePlaceAs(c.place, entry.place)) delete places[c.href];
    else places[c.href] = { group: c.place.group, ...(c.place.sub ? { sub: c.place.sub } : {}), ...(c.place.at !== undefined ? { at: c.place.at } : {}) };
  }
  const { places: _drop, ...rest } = doc;
  return { ...(rest as D), labels, ...(Object.keys(places).length ? { places } : {}) };
}

/** True when the choices change nothing the document says, so keeping the defaults writes nothing. */
export function choicesChangeNothing(doc: { labels: Record<string, string>; places?: Record<string, MenuPlace> }, choices: readonly MenuChoice[]): boolean {
  const said = (d: { labels: Record<string, string>; places?: Record<string, MenuPlace> }) =>
    JSON.stringify([Object.entries(d.labels).sort(), Object.entries(d.places ?? {}).sort().map(([k, p]) => [k, p.group, p.sub ?? "", p.at ?? -1])]);
  return said(withChoices(doc, choices)) === said(doc);
}
