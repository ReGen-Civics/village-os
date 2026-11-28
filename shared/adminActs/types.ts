/**
 * The shape of one admin act (shared/adminActs.ts holds the registry and says how to add one).
 *
 * Pure: no I/O, no clock.
 */
import type { Capability } from "../capabilities";
import type { AdminSearchEntry } from "../adminSearch";
import type { AdminPlace } from "../adminTabs";
import { tabParity } from "./parity";

export type { AdminPlace };

/**
 * What the act's own server door asks for, as data.
 *
 *   a capability   the handler asks the one gate (shared/capabilities.ts) for this key
 *   "admin"        the handler asks only whether the person is an admin
 *   "founder"      the handler asks for the founder role
 *   "member"       any admitted member (the test run, the member pages the garden keeps)
 *   "signed-in"    anybody signed in; the door decides item by item what they see
 *   "anyone"       no sign-in at all; the page's own door decides (claiming a village that has no founder yet)
 *
 * THIS IS A DESCRIPTION AND NEVER A GATE. Nothing on the server may decide access by reading it.
 */
export type ActPower = Capability | "admin" | "founder" | "member" | "signed-in" | "anyone";

export type ActMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ActRoute {
  method: ActMethod;
  /** The path exactly as Express registers it, `:name` parts included. */
  path: string;
  /** Where one registered route serves many acts (one dial each, one key each): this act's own values for its `:name` parts. */
  params?: Readonly<Record<string, string>>;
}

export type ActFieldKind = "text" | "longtext" | "number" | "boolean" | "choice" | "date" | "person" | "role" | "file" | "list" | "secret";

/** One input the act takes: the key its route reads from the body, the words a person sees, and what kind of control fills it. */
export interface ActField {
  key: string;
  label: string;
  kind: ActFieldKind;
  /** For `choice`: the values the route accepts. */
  choices?: readonly string[];
  min?: number;
  max?: number;
  unit?: string;
}

/**
 * One admin act. It is a search entry (id, kind, title, help, synonyms, tab or path: shared/adminSearch.ts) and what
 * the guide needs beside it: its place, its power, its route and its fields. The class and the consequence line are
 * never typed here: `actClass` and `actConsequence` (shared/adminActs.ts) read them from the lists that own them.
 */
export interface AdminAct extends Omit<AdminSearchEntry, "capability"> {
  /** Where it lives on the garden's grounds. */
  place: AdminPlace;
  power: ActPower;
  /** Every other key the same door asks the gate for, where it asks for more than one. */
  also?: readonly Capability[];
  /** A holder of this power passes the door as well as an admin (server/lib/operatorRoutes.ts, which only widens). */
  holder?: Capability;
  /** The route it calls. Absent: a reading page, which calls nothing. */
  route?: ActRoute;
  fields?: readonly ActField[];
  /** The setup seed this act plants (shared/guilds.ts), whose consequence line it reads. */
  seed?: string;
  /** The rows of the parity ledger this act covers (shared/adminActs/parity.ts). */
  parity?: readonly string[];
  /** Real and registered, with its route or its fields still to finish. */
  partial?: true;
}

/**
 * The words of one act in another language: what a reader of that language sees and would type to find it. The
 * tables are under shared/adminActs/<language>/, keyed by the act's id; shared/adminActsWords.ts lays them over an entry.
 */
export interface ActWords {
  title: string;
  help: string;
  synonyms: readonly string[];
}

/** One row of a words table, so a row stays one readable line. */
export const words = (title: string, help: string, synonyms: readonly string[]): ActWords => ({ title, help, synonyms });

// ── Small builders, so a row of the registry stays one readable line ───────

const route = (method: ActMethod) => (path: string, params?: Readonly<Record<string, string>>): ActRoute => (params ? { method, path, params } : { method, path });
export const GET = route("GET");
export const POST = route("POST");
export const PUT = route("PUT");
export const PATCH = route("PATCH");
export const DELETE = route("DELETE");

const field = (kind: ActFieldKind) => (key: string, label: string): ActField => ({ key, label, kind });
export const text = field("text");
export const long = field("longtext");
export const num = field("number");
export const bool = field("boolean");
export const date = field("date");
export const person = field("person");
export const role = field("role");
export const file = field("file");
export const list = field("list");
export const secret = field("secret");
export const choice = (key: string, label: string, choices: readonly string[]): ActField => ({ key, label, kind: "choice", choices });

/** What a hand-written row gives. `kind` is "act" unless the row says otherwise. */
export type ActRow = Omit<AdminAct, "place" | "kind"> & { kind?: AdminAct["kind"] };

/** The rows of one place, stamped with it. A row on a tab covers that tab's row of the ledger unless it names its own. */
export function inPlace(place: AdminPlace, rows: readonly ActRow[]): AdminAct[] {
  return rows.map((r) => {
    const parity = r.parity ?? tabParity(r.tab);
    return { kind: "act", ...r, place, ...(parity ? { parity } : {}) };
  });
}
