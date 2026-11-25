/**
 * WHICH BROWSER CRASH EMAILS THE ADMINS (the lead, 25 Nov 2026: "fix that so we're not bogged down in noise").
 *
 * Every crash report used to email every admin on the crash alert list, once an hour per message, whatever it was.
 * Most of them were a wallet extension, an app's own browser, a dropped connection or a tab from before a deploy,
 * and the one real bug in a week was a line among seventy. Now, after the noise rules (shared/crashNoise.ts) have
 * dropped what nobody can act on, a report is RECORDED always and EMAILS only when it is ours and real:
 *
 *   1. OURS: a frame from our own /assets/ bundle. Our code was running when it broke, so the first one is worth
 *      hearing about straight away.
 *   2. SPREAD: the same signature from at least `ops.crash_spread_visitors` different visitors within
 *      `ops.crash_spread_minutes`. Not ours by its stack, but enough people that it is not one odd browser.
 *
 * And one email per signature per `ops.crash_email_every_hours` at most, saying how many times it has happened so
 * far, so a bug every visitor hits is one email a day with a running count. Everything recorded and not emailed is
 * counted in a daily digest (`digestGroups`), sent only when there is something in it. The admins read every
 * signature on Village Health.
 *
 * A VISITOR is a digest of the reporting address under a salt that changes every day (`visitorDigest`): it can
 * tell three people from one person three times today, and it cannot name anybody or follow them to tomorrow.
 */
import crypto from "node:crypto";
import { browserKind, crashSignature } from "../../shared/crashNoise";

/** The three dials, by key. Literal in shared/gameVariables.ts so the generated docs read them. */
export const CRASH_TRIAGE_DIALS = {
  spreadVisitors: "ops.crash_spread_visitors",
  spreadMinutes: "ops.crash_spread_minutes",
  emailEveryHours: "ops.crash_email_every_hours",
  keepDays: "ops.crash_keep_days",
} as const;

export interface TriageDials {
  spreadVisitors: number;
  spreadMinutes: number;
  emailEveryHours: number;
  /** How long a report is kept, in days (the retention sweep). */
  keepDays: number;
}

/** The platform's defaults, which the dials start at: three visitors in an hour, one email a day, kept 30 days. */
export const TRIAGE_DEFAULTS: TriageDials = { spreadVisitors: 3, spreadMinutes: 60, emailEveryHours: 24, keepDays: 30 };

/** The dials as a number reader gives them, each held to a sane range; a dial that cannot be read is its default. */
export function readTriageDials(read: (key: string) => number): TriageDials {
  const one = (key: string, fallback: number, min: number, max: number) => {
    let v = Number.NaN;
    try {
      v = Number(read(key));
    } catch {
      v = Number.NaN;
    }
    return Number.isFinite(v) && v > 0 ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  };
  return {
    spreadVisitors: one(CRASH_TRIAGE_DIALS.spreadVisitors, TRIAGE_DEFAULTS.spreadVisitors, 1, 50),
    spreadMinutes: one(CRASH_TRIAGE_DIALS.spreadMinutes, TRIAGE_DEFAULTS.spreadMinutes, 5, 1440),
    emailEveryHours: one(CRASH_TRIAGE_DIALS.emailEveryHours, TRIAGE_DEFAULTS.emailEveryHours, 1, 168),
    keepDays: one(CRASH_TRIAGE_DIALS.keepDays, TRIAGE_DEFAULTS.keepDays, 1, 365),
  };
}

/** A signature's id: 16 hex characters of its digest. */
export function signatureId(message: string, frames: readonly string[]): string {
  return crypto.createHash("sha256").update(crashSignature(message, frames)).digest("hex").slice(0, 16);
}

/** A visitor for today: the address under a salt and the UTC date, so it never links one day to the next. */
export function visitorDigest(salt: string, address: string, now: Date): string {
  return crypto.createHash("sha256").update(`${salt}|${now.toISOString().slice(0, 10)}|${address}`).digest("hex").slice(0, 16);
}

export type TriageWhy = "ours" | "spread" | "quiet" | "already_told";

export interface TriageInput {
  ours: boolean;
  /** Different visitors who reported this signature within the spread window, this report included. */
  visitorsInWindow: number;
  /** When this signature last emailed, or null for never. */
  emailedAt: Date | null;
  now: Date;
}

/** Whether this report emails, and why. Pure: the claim that makes it stick is `claimEmail`. */
export function decideEmail(input: TriageInput, dials: TriageDials): { email: boolean; why: TriageWhy } {
  const worth: TriageWhy | null = input.ours ? "ours" : input.visitorsInWindow >= dials.spreadVisitors ? "spread" : null;
  if (!worth) return { email: false, why: "quiet" };
  if (input.emailedAt && input.now.getTime() - input.emailedAt.getTime() < dials.emailEveryHours * 3600_000) {
    return { email: false, why: "already_told" };
  }
  return { email: true, why: worth };
}

/** One report, as the route has cleaned it. */
export interface Sighting {
  message: string;
  frames: readonly string[];
  browser: string;
  route: string;
  visitor: string;
  now: Date;
  /**
   * A chunk or copy part that did not arrive (shared/staleBuild.ts). Never ours by its frames, which are Vite's
   * preload helper in our own bundle: during a deploy a tab can load the new entry and miss a part on the old
   * server, so one report proves nothing. A build that really broke its own rule reaches every visitor, and the
   * spread rule emails it within the hour.
   */
  staleBuild?: boolean;
}

/** A signature as it stands after a sighting. */
export interface SignatureState {
  id: string;
  message: string;
  topFrame: string;
  ours: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  seenCount: number;
  emailedAt: Date | null;
  emailsSent: number;
  visitorsInWindow: number;
  sightingId: string;
}

/** Where an admin reads one signature: its card on Village Health. */
export function signatureLink(id: string): string {
  return `/village-health#crash-${id}`;
}

const when = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;

/** The alert a person triages at a glance: what, where, on what, how often, since when, and whether it is ours. */
export function alertWords(state: SignatureState, sighting: Pick<Sighting, "browser" | "route">, why: TriageWhy): { title: string; body: string; link: string } {
  const kind = browserKind(sighting.browser);
  const times = state.seenCount === 1 ? "once" : `${state.seenCount} times`;
  const reason =
    why === "ours"
      ? "It emailed because a frame is from our own code."
      : `It emailed because ${state.visitorsInWindow} different visitors hit it within the hour.`;
  const body = [
    `Page: ${sighting.route}. Browser: ${kind} (${sighting.browser || "unknown"}).`,
    `Seen ${times}, first ${when(state.firstSeenAt)}, last ${when(state.lastSeenAt)}.`,
    state.ours ? `Our code: yes, ${state.topFrame || "a frame from /assets/"}.` : "Our code: no frame from our bundle.",
    reason,
    "One email a day at most for this crash; the rest are counted on Village Health and in the daily digest.",
  ].join(" ");
  return { title: `Crash on ${sighting.route}: ${state.message}`.slice(0, 250), body, link: signatureLink(state.id) };
}

// ── The daily digest ───────────────────────────────────────────────────────

export interface DigestGroup {
  signatureId: string;
  message: string;
  browser: string;
  route: string;
  count: number;
}

/** The digest's words: one line per signature, browser and page, most first. */
export function digestWords(groups: readonly DigestGroup[]): { title: string; body: string } {
  const total = groups.reduce((n, g) => n + g.count, 0);
  const lines = groups.slice(0, 25).map((g) => `${g.count} x ${g.message.slice(0, 120)} (${g.route}, ${g.browser})`);
  const more = groups.length > 25 ? ` And ${groups.length - 25} more on Village Health.` : "";
  return {
    title: `Crash digest: ${total} report${total === 1 ? "" : "s"} recorded, none emailed`,
    body: `${lines.join(". ")}.${more} None of these had a frame from our code or reached enough visitors to email on their own.`,
  };
}

// ── Village Health ─────────────────────────────────────────────────────────

export interface SignatureView {
  id: string;
  message: string;
  topFrame: string;
  ours: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
  emailedAt: string | null;
  browsers: string[];
  routes: string[];
}
