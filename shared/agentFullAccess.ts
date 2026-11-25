/**
 * THE FULL-ACCESS SWITCH FOR ONE ROLE'S AGENT (the lead, 20 Nov 2026).
 *
 *   "For my role only (ops) I should have the power for agents to just about
 *   everything for me, and if not using the accept proposal route."
 *
 * The record of the ruling, what it opens and what it never opens, is the header of the lead-approved writes in
 * shared/agentAdmin.ts. This file is the mechanism, kept apart so the admin panel's chunk does not carry the game
 * variables it reads.
 *
 *   THE SETTING names ONE role (`agent-full-access`, an app_config document). It is off until a person names a role
 *   in Admin, Players, Agents, through `PUT /api/admin/agent-accounts/full-access`, which `ALWAYS_A_PERSON` keeps out
 *   of every agent's reach (the `agents` rule), so no agent sets, widens or keeps it.
 *
 *   WHO IT REACHES: an agent token whose holder holds a live seat in that role at the moment of the call, and is not
 *   an agent account. The seat is read at every call, so it drops off when the seat changes hands.
 *
 *   WHAT IT OPENS: `admin_request` reaches any `/api/admin/` path without the person-saved list and without the
 *   lead-approved list, and `accept_proposals` accepts or discards changes waiting on the review page, as the holder.
 *   Every write keeps the two-call confirm and carries approvedBy and approvalNote, and each is audited.
 *
 *   THE FLOOR, a person's act with the switch on: every path the existing `ALWAYS_A_PERSON` rules refuse for
 *   secrets, erasure, money, members leaving or being let in, a member's sign-in and admin flag, the agent accounts,
 *   voice recordings, comparing proposals and applicant data (read only with the Anchor's approval of AI agents,
 *   as before), plus the parts of the powers rule that are the veto and the break-glass, the part of the tier C
 *   rule that writes to an applicant, and the part of the settings rule that holds the email provider's keys and a
 *   person's own yes or no to letters (`FULL_ACCESS_SETTINGS_KEPT`).
 *
 *   24 NOVEMBER 2026 (the lead; the record is in shared/agentAdmin.ts): the village's modules, variables and
 *   settings, and sending email, opened to this role's agent. Each send is one of `FULL_ACCESS_EMAIL_SENDS`, and its
 *   preview states its recipients, and the count for a letter, read by the server at both calls, so the confirmToken
 *   covers exactly who it goes to. A write shaped like a send that is not on that list stays a person's
 *   (`isUnnamedSend`). `FULL_ACCESS_KEPT` says in plain words what the floor still keeps.
 *
 *   25 NOVEMBER 2026 (the lead; the record is in shared/agentAdmin.ts above READ_FLOOR): READS OPEN, a second switch
 *   on this same document (`readsOpen`), set by a person beside the first. With both on, `fullAccessDecision` opens
 *   any GET or HEAD under /api/ to the seat's agent under the read floor, marked `readOpen`, and `asMember` outside
 *   /api/admin/ when no list named the path. `READS_OPEN_KEPT` is the floor in plain words. The rules are reused, never copied, so a new route that
 *   matches one is covered on the day it lands. Beside the paths, the body of a write never names a capability an
 *   agent may not hand out (`isFloorCapability`), a game variable that moves money, sends email, guards sign-in
 *   or runs the connector stays a person's, and so does a write under an admin area that moves value under a name
 *   the money rule does not carry (`FULL_ACCESS_VALUE_AREAS`) or replaces the signing key.
 */

import {
  ALWAYS_A_PERSON,
  adminRequestDecision,
  isFloorCapability,
  leadApprovedEntry,
  MONEY_MODULE_IDS,
  SHIPPED_AGENT_READS,
  pathMatches,
  readFloor,
  READ_FLOOR,
  type AdminRequestDecision,
  type AgentAdminPathsDoc,
  type AgentDecisionOpts,
  type AllowedAdminPath,
} from "./agentAdmin";
import { BADGE_GRANTABLE } from "./capabilities";
import { VARIABLES_BY_KEY } from "./gameVariables";

/** A string that is one of the platform's capability keys. */
const isCapabilityKey = (v: string) => Object.prototype.hasOwnProperty.call(BADGE_GRANTABLE, v);

export const FULL_ACCESS_DOC = "agent-full-access";

/** The stored setting: the one role whose live holder's agent has full access, or null for off. */
export interface FullAccessDoc {
  roleId: string | null;
  setBy: string | null;
  setAt: string | null;
  /**
   * READS OPEN (the lead, 25 Nov 2026): the role's agent reads any `/api/` path without the list, under the read
   * floor. Off unless it is exactly `true`. A person sets it, beside the switch, and it means nothing while no role is named.
   */
  readsOpen: boolean;
  readsSetBy: string | null;
  readsSetAt: string | null;
}

export const FULL_ACCESS_OFF: FullAccessDoc = { roleId: null, setBy: null, setAt: null, readsOpen: false, readsSetBy: null, readsSetAt: null };

/** A stored document read safely: anything malformed reads as off. Reads open survives a role change, so turning it on is one act. */
export function parseFullAccessDoc(raw: unknown): FullAccessDoc {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const roleId = typeof r.roleId === "string" && /^[A-Za-z0-9._~-]{1,120}$/.test(r.roleId) ? r.roleId : null;
  const reads = {
    readsOpen: r.readsOpen === true,
    readsSetBy: typeof r.readsSetBy === "string" ? r.readsSetBy.slice(0, 64) : null,
    readsSetAt: typeof r.readsSetAt === "string" ? r.readsSetAt.slice(0, 40) : null,
  };
  if (!roleId) return { ...FULL_ACCESS_OFF, ...reads };
  return { roleId, setBy: typeof r.setBy === "string" ? r.setBy.slice(0, 64) : null, setAt: typeof r.setAt === "string" ? r.setAt.slice(0, 40) : null, ...reads };
}

/**
 * What the settings rule still keeps from the full-access role (the lead, 24 Nov 2026): the legacy email settings,
 * which can carry the provider's key, the provider's webhook secret, key check and domain, and a person's own yes or
 * no to letters (suppressing or restoring an address).
 */
export const FULL_ACCESS_SETTINGS_KEPT = /email-?config|\/comms\/settings\/(webhook|key-rights|domain)(\/|$)|\/comms\/people\//i;

/**
 * THE FLOOR, by `ALWAYS_A_PERSON` rule key. A rule with no `only` is in the floor whole; one with `only` is in the
 * floor where its own test AND `only` both match the path. Each rule keeps its own mode: an "always" rule refuses
 * every method, a "writes" rule refuses writes, and the "personal" rule answers a GET only with the Anchor's approval.
 */
export const FULL_ACCESS_FLOOR: ReadonlyArray<{ key: string; only?: RegExp; why: string }> = [
  { key: "erasure", why: "erasure" },
  { key: "money", why: "money" },
  { key: "members", why: "letting a member in, a member leaving, and removing one" },
  { key: "voice", why: "an applicant's voice" },
  { key: "compare", why: "comparing proposals" },
  { key: "personal", why: "applicant and member data" },
  { key: "secrets", why: "secrets" },
  { key: "accounts", why: "a member's sign-in and admin flag" },
  { key: "agents", why: "the agent accounts and tokens" },
  { key: "powers", only: /veto|break-?glass|override|admin-access/i, why: "the veto and the break-glass" },
  // The lead, 24 Nov 2026: the village's modules, variables and settings, and sending email with its recipients named,
  // are opened. What stays of this rule is the sending provider's keys, webhook and domain, the legacy email settings
  // that can carry a key, and a person's own yes or no to letters.
  { key: "settings", only: FULL_ACCESS_SETTINGS_KEPT, why: "the email provider's keys, and a person's own yes or no to letters" },
  { key: "tier_c", only: /first-?repl|decision-?letter|letter-?drafts?/i, why: "a first reply or a decision letter to an applicant" },
];

/** The rule keys whose whole rule is in the floor. */
export const FULL_ACCESS_FLOOR_WHOLE: readonly string[] = FULL_ACCESS_FLOOR.filter((f) => !f.only).map((f) => f.key);

/** Game variable categories that move money, guard sign-in or run the connector: a person sets them. Email and reminders opened on 24 Nov 2026. */
export const FULL_ACCESS_VARIABLE_CATEGORIES: readonly string[] = [
  "Gratitude", "Ledger", "The Mint", "Exchange", "Payments", "Stays", "Library", "Exit", "Hidden map",
  "Connector", "Accounts & sessions", "Abuse guards",
];

/**
 * Admin areas that move value under a name the money rule does not carry, found by walking every admin write the
 * server registers on 20 Nov 2026: stay credits and prices (stays), payment products (commerce), library credits,
 * the consent that releases a quest's value, the resource rules that move tokens, and applying a game mechanics
 * proposal, which writes the variables above. A write under one is money, so a person's act.
 */
export const FULL_ACCESS_VALUE_AREAS: readonly string[] = ["stays", "products", "library", "quest-claims", "resources", "mechanics"];
/** The village's signing key is a credential: replacing it is a person's act, as every secret is. */
export const FULL_ACCESS_KEY_AREAS: readonly string[] = ["identity"];

// ── Sending email, with its recipients named (the lead, 24 Nov 2026) ─────────

/** Who an email send reaches, as the platform reads it: the holder themselves, a letter's audience, and so on. */
export type FullAccessSendKind = "holder" | "letter" | "journey" | "message" | "waitlist";

/**
 * EVERY EMAIL SEND THE FULL-ACCESS ROLE'S AGENT MAY MAKE, by route. Each names a kind, and the server reads that
 * kind's recipients fresh at both calls of the two-call confirm (server/lib/agentFullAccess.ts), so the preview says
 * who the email goes to, and how many for a letter or a waitlist letter, and the confirmToken covers exactly those.
 * A write shaped like a send that is not on this list stays a person's (`isUnnamedSend`).
 */
export const FULL_ACCESS_EMAIL_SENDS: ReadonlyArray<{ path: string; kind: FullAccessSendKind; label: string }> = [
  { path: "/api/admin/comms/settings/test", kind: "holder", label: "A test email from Comms Settings" },
  { path: "/api/admin/comms/letters/:id/test", kind: "holder", label: "A test of a letter" },
  { path: "/api/admin/comms/journeys/:key/steps/:step/test", kind: "holder", label: "A test of one journey step's email" },
  { path: "/api/admin/comms/words/:key/test", kind: "holder", label: "A test of one email's words" },
  { path: "/api/admin/comms/letter-previews/send", kind: "holder", label: "A preview of an email's words" },
  { path: "/api/admin/comms/letters/:id/send", kind: "letter", label: "A letter to its audience" },
  { path: "/api/admin/comms/journeys/:key/state", kind: "journey", label: "A journey turned on or off" },
  { path: "/api/admin/comms/messages/:id/retry", kind: "message", label: "One failed email tried again" },
  { path: "/api/admin/roles/waitlist-letters/send", kind: "waitlist", label: "A letter to everyone waiting for a role" },
];

/** Segments of a route pattern matched against a path, with the `:name` segments read out, or null. */
function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split("/");
  const got = path.split("/");
  if (want.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i]!.startsWith(":")) {
      if (!got[i] || !SEGMENT.test(got[i]!)) return null;
      params[want[i]!.slice(1)] = got[i]!;
    } else if (want[i] !== got[i]) return null;
  }
  return params;
}

/** The email send this write is, with its route's parameters, or null. POST only, as every send route is. Pure. */
export function fullAccessEmailSend(method: string, path: string): { kind: FullAccessSendKind; label: string; params: Record<string, string> } | null {
  if (String(method ?? "").toUpperCase() !== "POST") return null;
  for (const e of FULL_ACCESS_EMAIL_SENDS) {
    const params = matchRoute(e.path, String(path ?? ""));
    if (params) return { kind: e.kind, label: e.label, params };
  }
  return null;
}

/** A write shaped like an email send: a send anywhere in admin, or a test, retry or run under Comms. */
const SEND_SHAPE = /\/send(\/|$)|\/comms\/(.+\/)?(test|retry|run)$/i;

/** A write shaped like a send that `FULL_ACCESS_EMAIL_SENDS` does not name, so nobody can say who it reaches first. Pure. */
export function isUnnamedSend(method: string, path: string): boolean {
  const m = String(method ?? "").toUpperCase();
  return m !== "GET" && SEND_SHAPE.test(String(path ?? "")) && !fullAccessEmailSend(m, path);
}

/** Who a send reaches, as the preview states it and the confirmToken covers it. */
export interface FullAccessRecipients {
  /** One plain line: who it goes to. */
  to: string;
  /** How many people it goes to now. */
  count: number;
  /** Up to twenty of them by name, where the platform has a name. Never an address but the holder's own. */
  names: string[];
}

/** Whether a recipients answer is one an informed yes can stand on: a line, a count, and somebody to send to for a letter. */
export function recipientsProblem(kind: FullAccessSendKind, r: FullAccessRecipients | null | undefined): string | null {
  if (!r || typeof r.to !== "string" || !r.to.trim() || !Number.isInteger(r.count) || r.count < 0 || !Array.isArray(r.names)) return FULL_ACCESS_WORDS.noRecipients;
  if ((kind === "letter" || kind === "waitlist" || kind === "holder" || kind === "message") && r.count < 1) return FULL_ACCESS_WORDS.noRecipients;
  return null;
}

/**
 * WHAT THE FLOOR STILL KEEPS from the full-access role's agent (the lead, 24 Nov 2026), in plain words, so the agent
 * can say what it cannot do. The connector shows it in the admin tool's description and with every floor refusal.
 */
export const FULL_ACCESS_KEPT: readonly string[] = [
  "Secrets and integration keys, including the email provider's key, webhook and domain: never read or written by an agent.",
  "Money and value: pay, payers, invoices, payments, the ledger, minting, the treasury, credits and prices, money modules and money variables.",
  "Erasing or anonymising a member.",
  "Letting a member in or out, invitations, and a member's sign-in, sessions and admin flag.",
  "The agent accounts, their tokens, the agent path list and the full-access switch itself.",
  "The steward's veto, the break-glass and the admin panel.",
  "Applicant data, read only with the Anchor's approval of AI agents and never changed; first replies and decision letters to applicants. No AI selects, ranks or judges applicants.",
  "Voice recordings, and comparing proposals side by side.",
  "A person's own yes or no to letters, and any email whose recipients the platform cannot name before it goes.",
];

export const FULL_ACCESS_WORDS = {
  variable: "That game variable moves money, guards sign-in or runs the connector. A person sets it in Admin, Variables.",
  unnamedSend: "This sends email, and the platform cannot name who it goes to before it goes. A person sends it in the app.",
  noRecipients: "The platform could not say who this email goes to, so it was not sent. For a letter, preview it first so its audience is fixed, then send.",
  module: "Turning a money module on or off, or changing its settings, is a person's act in the app.",
  valueArea: "This moves value: credits, prices, payments or a quest's release. A person makes it in the app.",
  keyArea: "The village's signing key is a credential. A person replaces it in the app.",
  body: "This write names a power an agent never hands out: the steward's veto, the break-glass, money, a power a badge may never carry, or the admin panel. A person makes it in the app.",
  self: "An agent never acts on its own account through the connector.",
  notOn: "Full access is not on for this connector. It reaches only the agent of whoever holds the role a person named in Admin, Players, Agents.",
} as const;

const SEGMENT = /^[A-Za-z0-9._~-]+$/;

/** The floor rule this call falls under, with that rule's own words, or null. Pure. */
export function fullAccessFloor(method: string, path: string, selfUserId?: string | null, opts: AgentDecisionOpts = {}): { key: string; words: string } | null {
  const m = String(method ?? "").toUpperCase();
  const p = String(path ?? "");
  for (const r of ALWAYS_A_PERSON) {
    const f = FULL_ACCESS_FLOOR.find((x) => x.key === r.key);
    if (!f || !r.test(m, p)) continue;
    if (f.only && !f.only.test(p)) continue;
    if (m === "GET" && r.mode === "writes") continue;
    if (m === "GET" && r.mode === "personal" && opts.applicantDataOpen === true) continue;
    return { key: r.key, words: r.words };
  }
  if (selfUserId && p.split("/").includes(selfUserId)) return { key: "agents", words: FULL_ACCESS_WORDS.self };
  if (isUnnamedSend(m, p)) return { key: "settings", words: FULL_ACCESS_WORDS.unnamedSend };
  if (m !== "GET") {
    const segs = p.split("/");
    // A game variable by key: a money, email, sign-in or connector variable, any key under `agents.`, an unknown key.
    if (segs.length === 5 && segs[2] === "admin" && segs[3] === "variables") {
      const key = segs[4] ?? "";
      const def = VARIABLES_BY_KEY[key];
      if (!def || key.startsWith("agents.") || FULL_ACCESS_VARIABLE_CATEGORIES.includes(def.category)) return { key: "money", words: FULL_ACCESS_WORDS.variable };
    }
    // A money module's lifecycle and settings.
    if (segs[2] === "admin" && segs[3] === "modules" && MONEY_MODULE_IDS.includes(segs[4] ?? "")) return { key: "money", words: FULL_ACCESS_WORDS.module };
    if (segs[2] === "admin" && FULL_ACCESS_VALUE_AREAS.includes(segs[3] ?? "")) return { key: "money", words: FULL_ACCESS_WORDS.valueArea };
    if (segs[2] === "admin" && FULL_ACCESS_KEY_AREAS.includes(segs[3] ?? "")) return { key: "secrets", words: FULL_ACCESS_WORDS.keyArea };
  }
  return null;
}

/**
 * The body half of the floor: a write that names a capability an agent never hands out, anywhere in its body, or
 * turns on the admin panel, the break-glass or the veto by a flag. Null when it may go ahead. Pure.
 */
export function fullAccessBodyProblem(body: unknown): string | null {
  const walk = (v: unknown, depth: number): boolean => {
    if (depth > 20) return true;
    if (typeof v === "string") return isCapabilityKey(v.trim()) && isFloorCapability(v.trim());
    if (Array.isArray(v)) return v.some((x) => walk(x, depth + 1));
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (/^(grantsAdmin|isAdmin|adminOverride|breakGlass|veto)$/i.test(k) && x !== false && x !== null && x !== undefined) return true;
        if (walk(x, depth + 1)) return true;
      }
    }
    return false;
  };
  return walk(body, 0) ? FULL_ACCESS_WORDS.body : null;
}

/** The entry a full-access call stands on when no list names its path. */
const FULL_ACCESS_ENTRY = (method: string, path: string): AllowedAdminPath => ({
  method: method as AllowedAdminPath["method"],
  path,
  confirm: "agent",
  label: "Full access: the operations role's agent, with the approval in the chat",
});

/** The entry an open read stands on when no list names its path. */
const READS_OPEN_ENTRY = (path: string): AllowedAdminPath => ({
  method: "GET",
  path,
  confirm: "agent",
  label: "Reads open: the operations role's agent reads as a plain member",
});

/** The read floor's categories, in plain words, for the agent and the admin panel. */
export const READS_OPEN_KEPT: readonly string[] = READ_FLOOR.map((r) => r.words);

/**
 * Whether an agent may call `method path` through `admin_request`, with full access as the caller read it.
 *
 * Full access off: exactly `adminRequestDecision`, nothing added (pinned by a regression test over the whole
 * `ALWAYS_A_PERSON` list). Full access on: a bad path is still refused, the floor is refused, a path outside
 * `/api/admin/` answers as it would without full access, and any other admin path opens with the agent confirming
 * and the approval required. A lead-approved route keeps its body check whatever the village's switch says, which
 * is what keeps a seating into a seat with the veto refused.
 */
export function fullAccessDecision(
  method: string,
  path: string,
  doc: AgentAdminPathsDoc,
  selfUserId: string | null | undefined,
  opts: AgentDecisionOpts & { fullAccess?: boolean; readsOpen?: boolean } = {},
): AdminRequestDecision {
  // HEAD is a read: it is decided exactly as the GET it mirrors.
  const asked = String(method ?? "").toUpperCase();
  const m = asked === "HEAD" ? "GET" : asked;
  // With full access off, HEAD is passed on as it was asked, so nothing changes for any other agent.
  const normal = adminRequestDecision(opts.fullAccess === true ? m : asked, path, doc, selfUserId, opts);
  if (opts.fullAccess !== true) return normal;
  if (!normal.ok && normal.code === "bad_path") return normal;
  const floor = fullAccessFloor(m, path, selfUserId, opts);
  if (floor) return { ok: false, code: "always_a_person", words: floor.words };
  // READS OPEN (the lead, 25 Nov 2026): any read under /api/, without the list, under the read floor. A read the
  // list or the shipped reads did not already open is made as a plain member (`asMember`) outside /api/admin/, so a
  // route that widens for an admin answers the agent as it answers a member.
  if (opts.readsOpen === true && m === "GET") {
    const readFloored = readFloor(path, opts);
    if (readFloored) return { ok: false, code: "always_a_person", words: readFloored.words };
    if (!path.startsWith("/api/") || path.startsWith("/api/agent/") || !path.split("/").every((s, i) => i === 0 || SEGMENT.test(s))) return normal;
    if (normal.ok) return { ...normal, fullAccess: true, readOpen: true };
    const admin = path.startsWith("/api/admin/");
    return { ok: true, entry: READS_OPEN_ENTRY(path), write: false, confirm: "agent", fullAccess: true, readOpen: true, ...(admin ? {} : { asMember: true }) };
  }
  const write = m !== "GET";
  if (!path.startsWith("/api/admin/") || !path.split("/").every((s, i) => i === 0 || SEGMENT.test(s))) {
    return normal.ok ? { ...normal, fullAccess: true } : normal;
  }
  const entry = normal.ok
    ? normal.entry
    : doc.paths.find((e) => e.method === m && pathMatches(e.path, path)) ?? (m === "GET" ? SHIPPED_AGENT_READS.find((e) => pathMatches(e.path, path)) : undefined) ?? FULL_ACCESS_ENTRY(m, path);
  const lead = write ? leadApprovedEntry(m, path) : null;
  return { ok: true, entry, write, confirm: "agent", fullAccess: true, ...(lead ? { leadApproved: lead.kind } : {}) };
}

// ── accept_proposals: the approval names what it covers ──────────────────────

/** Whether `note` names `code` as a whole code: B-66 is not named by B-660, and B-66.1 does not name B-66. */
export function namesCode(note: string, code: string): boolean {
  const c = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9])${c}(?![0-9]|\\.[0-9])`, "i").test(note);
}

/**
 * Whether an approval note covers a selection of waiting changes: it names the batch code, when every change is of
 * that one batch, or it names every change's own code. A change without a code can only be covered by its batch.
 */
export function approvalCovers(note: string, items: ReadonlyArray<{ code: string | null; batchCode: string | null }>): boolean {
  if (!items.length || typeof note !== "string") return false;
  const batches = Array.from(new Set(items.map((i) => i.batchCode)));
  if (batches.length === 1 && batches[0] && namesCode(note, batches[0])) return true;
  return items.every((i) => !!i.code && namesCode(note, i.code));
}

export const ACCEPT_PROPOSAL_WORDS = {
  note: "The second call carries approvalNote: the person's approval in this chat, naming the batch code (such as B-66) or the code of every change it covers, and approvedBy: who gave it.",
  notCovered: "The approval note does not name the batch code or the code of every change. Quote the person's approval with the codes in it, and call again.",
  nothing: "None of these is waiting on the review page, so nothing would be accepted or put aside.",
} as const;
