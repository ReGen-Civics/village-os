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
 *   as before), plus the parts of the powers rule that are the veto and the break-glass, and the parts of the
 *   settings and tier C rules that send letters or email. The rules are reused, never copied, so a new route that
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
}

export const FULL_ACCESS_OFF: FullAccessDoc = { roleId: null, setBy: null, setAt: null };

/** A stored document read safely: anything malformed reads as off. */
export function parseFullAccessDoc(raw: unknown): FullAccessDoc {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const roleId = typeof r.roleId === "string" && /^[A-Za-z0-9._~-]{1,120}$/.test(r.roleId) ? r.roleId : null;
  if (!roleId) return FULL_ACCESS_OFF;
  return { roleId, setBy: typeof r.setBy === "string" ? r.setBy.slice(0, 64) : null, setAt: typeof r.setAt === "string" ? r.setAt.slice(0, 40) : null };
}

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
  { key: "settings", only: /\/letters?(\/|$)|\/send(\/|$)|e-?mail|\/comms(\/|$)/i, why: "sending letters and email" },
  { key: "tier_c", only: /first-?repl|decision-?letter|letter-?drafts?/i, why: "sending letters and email" },
];

/** The rule keys whose whole rule is in the floor. */
export const FULL_ACCESS_FLOOR_WHOLE: readonly string[] = FULL_ACCESS_FLOOR.filter((f) => !f.only).map((f) => f.key);

/** Game variable categories that move money, send email, guard sign-in or run the connector: a person sets them. */
export const FULL_ACCESS_VARIABLE_CATEGORIES: readonly string[] = [
  "Gratitude", "Ledger", "The Mint", "Exchange", "Payments", "Stays", "Library", "Exit", "Hidden map",
  "Connector", "Accounts & sessions", "Abuse guards", "Email and reminders",
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

export const FULL_ACCESS_WORDS = {
  variable: "That game variable moves money, sends email, guards sign-in or runs the connector. A person sets it in Admin, Variables.",
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
  opts: AgentDecisionOpts & { fullAccess?: boolean } = {},
): AdminRequestDecision {
  const normal = adminRequestDecision(method, path, doc, selfUserId, opts);
  if (opts.fullAccess !== true) return normal;
  if (!normal.ok && normal.code === "bad_path") return normal;
  const m = String(method ?? "").toUpperCase();
  const floor = fullAccessFloor(m, path, selfUserId, opts);
  if (floor) return { ok: false, code: "always_a_person", words: floor.words };
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
