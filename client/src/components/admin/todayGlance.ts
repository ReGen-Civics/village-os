/**
 * One sentence for today, and what changed since this person last looked on this device.
 *
 * THE NUMBER IS THE ONE COUNT: decisions waiting on you, as the server defines it for the person reading
 * (shared/reviewInbox.ts, `decisionCounts`). This file never works a count out; it is handed one, or null when the
 * count did not load, and a count that did not load is never said as nothing waiting.
 *
 * The last visit stays in the browser. Nothing here is sent to the server. THE COUNT IS NEVER CARRIED ACROSS PEOPLE:
 * the look this device remembers names whose it was, and somebody else's look is read as no look at all.
 */
import { storedText, writeStored } from "@/lib/safeStorage";

export const LAST_GLANCE_KEY = "admin.lastGlance";

export interface GlanceSnap {
  at: string;
  /** The one count at that look. */
  decisions: number;
  needs: number;
  /** Whose look it was. A look by anybody else is never compared against. */
  who: string;
}

export interface ConnCard {
  module?: string | null;
  key?: string | null;
  title?: string;
  health?: { verdict?: string }[];
}

export interface ConnInput {
  emailConfigured?: boolean;
  stripeConfigured?: boolean;
  cards?: ConnCard[];
  secrets?: { key?: string; configured?: boolean; present?: boolean }[];
}

export type ConnState = "working" | "needs" | "broken";

export interface ConnectionRow {
  id: string;
  name: string;
  state: ConnState;
  word: string;
  detail: string;
}

const WORD: Record<ConnState, string> = {
  working: "Working",
  needs: "Needs you",
  broken: "Broken right now",
};

function secretOn(input: ConnInput, key: string): boolean {
  const row = (input.secrets ?? []).find((s) => s.key === key);
  if (!row) return false;
  return row.configured === true || row.present === true;
}

function cardFor(input: ConnInput, moduleId: string): ConnCard | undefined {
  return (input.cards ?? []).find((c) => c.module === moduleId);
}

/** A saved key is not a check. Only these verdicts mean the last call was fine. */
const CONFIRMED = new Set(["working", "quiet"]);

function verdictsOf(card: ConnCard | undefined): string[] {
  return (card?.health ?? []).map((h) => h.verdict).filter((v): v is string => typeof v === "string" && v.length > 0);
}

/**
 * Failing wins. A mix, a stale reading, or a card with no reading is needs.
 * Listing the card is not the same as a check.
 */
function stateFrom(verdicts: string[]): ConnState {
  if (verdicts.includes("failing")) return "broken";
  if (verdicts.length > 0 && verdicts.every((v) => CONFIRMED.has(v))) return "working";
  return "needs";
}

export function connectionRows(input: ConnInput): ConnectionRow[] {
  const emailKey = input.emailConfigured === true || secretOn(input, "resend_api_key");
  const payKey = input.stripeConfigured === true || secretOn(input, "stripe_secret_key");
  const calendar = cardFor(input, "events");
  const sera = cardFor(input, "saberra");
  const seraKey = secretOn(input, "sera_api_secret");
  const rows: { id: string; name: string; state: ConnState; key: boolean }[] = [
    { id: "email", name: "Email", state: stateFrom(verdictsOf(cardFor(input, "email"))), key: emailKey },
    { id: "payments", name: "Payments", state: stateFrom(verdictsOf(cardFor(input, "payments"))), key: payKey },
    { id: "calendar", name: "Calendar", state: stateFrom(verdictsOf(calendar)), key: false },
    { id: "sera", name: "Sera", state: stateFrom(verdictsOf(sera)), key: seraKey },
  ];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    state: row.state,
    word: WORD[row.state],
    detail: row.state === "broken"
      ? "The last call failed."
      : row.state === "working"
        ? "The last check went through."
        : row.key
          ? "A key is saved. It has not been confirmed."
          : "It is not connected yet.",
  }));
}

/**
 * `decisions` is the one count, or null when it did not load: then the sentence says so and never "nothing".
 * `alsoListed` is what the list holds beside the count (blocked rows, applications): with any, "nothing is waiting"
 * is not said either.
 */
export function glanceSentence(decisions: number | null, rows: ConnectionRow[], alsoListed = 0): string {
  const requests = decisions === null ? -1 : decisions === 0 && alsoListed > 0 ? -1 : decisions;
  const req = decisions === null ? "The count of decisions did not load" : decisions === 1 ? "1 decision" : `${decisions} decisions`;
  const broken = rows.filter((r) => r.state === "broken").length;
  const needs = rows.filter((r) => r.state === "needs").length;
  if (broken > 0) {
    const c = broken === 1 ? "1 connection is broken right now" : `${broken} connections are broken right now`;
    return `${req}, ${c}.`;
  }
  if (needs > 0) {
    const c = needs === 1 ? "1 connection needs you" : `${needs} connections need you`;
    const all = needs === rows.length;
    if (requests === 0) return all ? "Every connection needs you." : `${c}. Everything else is fine.`;
    return all ? `${req}, and ${c}.` : `${req}, ${c}, everything else is fine.`;
  }
  if (requests === 0) return "Nothing is waiting, and every connection is fine.";
  return `${req}, everything else is fine.`;
}

/** The last look `who` took on this device. A look by somebody else, or one kept before the one count, is no look. */
export function readLastGlance(who: string): GlanceSnap | null {
  const raw = storedText("local", LAST_GLANCE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GlanceSnap;
    if (!parsed || typeof parsed.at !== "string" || typeof parsed.decisions !== "number" || parsed.who !== who) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sinceLastVisit(prev: GlanceSnap | null, decisions: number): string {
  if (!prev) return "First look on this device.";
  const when = new Date(prev.at);
  const label = Number.isNaN(when.getTime()) ? "your last look" : when.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const more = decisions - prev.decisions;
  if (more > 0) return `${more} more ${more === 1 ? "decision" : "decisions"} since ${label}.`;
  if (more < 0) {
    const n = -more;
    return `${n} fewer ${n === 1 ? "decision" : "decisions"} since ${label}.`;
  }
  return `Nothing new since ${label}.`;
}

export function rememberGlance(decisions: number, needs: number, who: string, now = new Date()): void {
  const snap: GlanceSnap = { at: now.toISOString(), decisions, needs, who };
  writeStored("local", LAST_GLANCE_KEY, JSON.stringify(snap));
}
