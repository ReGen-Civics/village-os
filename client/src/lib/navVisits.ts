/**
 * THE RESPONSIVE BOTTOM BAR, on the phone (shared/navPopularity.ts has the why).
 *
 * Loaded on its own after the first paint (App.tsx's NavVisits, MobileTabBar),
 * so the first page's scripts do not grow.
 *
 * Two things, and the line between them is the privacy line:
 *   - `visited` tells the server a page was visited, at most once per page per
 *     session, with the address and nothing else. The server counts pages, not
 *     people (server/routes/navBar.ts).
 *   - The member's own history stays on this device (localStorage) and is
 *     never sent. The personal place on the bar is chosen here from it, at most
 *     once a day.
 * Every storage read and write is wrapped: a private window or blocked
 * storage gives the village's bar, never an error.
 */
import { barTabs, choosePersonal, dayKey, PATH_PATH } from "@shared/navPopularity";
import { authToken } from "@/lib/gameApi";

export const HISTORY_KEY = "village-nav-history";
export const SENT_KEY = "village-nav-sent";
/** How long a fetched bar is trusted before the next page asks again. */
const BAR_KEEP_MS = 10 * 60_000;
/** The most pages the device remembers; the least visited are dropped first. */
const HISTORY_MAX = 60;

interface History {
  counts: Record<string, number>;
  personal?: { path: string; day: string } | null;
}

export interface BarAnswer {
  on: boolean;
  siteWide: string[];
  personal: boolean;
  excluded: string[];
}

const clean = (location: string) => location.split(/[?#]/)[0].replace(/\/$/, "") || "/";

function readHistory(): History {
  try {
    const raw = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "null");
    if (raw && typeof raw === "object" && raw.counts && typeof raw.counts === "object") return raw as History;
  } catch {
    /* unreadable or blocked: a fresh history */
  }
  return { counts: {} };
}

function writeHistory(h: History): void {
  const entries = Object.entries(h.counts).sort((a, b) => b[1] - a[1]).slice(0, HISTORY_MAX);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify({ ...h, counts: Object.fromEntries(entries) }));
  } catch {
    /* refused: the history holds for this page only */
  }
}

function sentThisSession(): Set<string> {
  try {
    return new Set(JSON.parse(window.sessionStorage.getItem(SENT_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/**
 * The prefix every agent token carries (TOKEN_PREFIX in server/lib/agentTokens.ts;
 * navVisits.test.ts holds the two together). A member signs in with a session
 * token, so a browser holding an agent token is the live view for QA
 * (server/lib/liveView.ts): it only reads, and an agent's look is not a member's
 * visit.
 */
export const AGENT_TOKEN_PREFIX = "vat_";

/**
 * A page was visited by a signed-in member. Counted once per page per session,
 * on the device and (the address alone) on the server. Home is not counted: its
 * place on the bar is fixed. A live view counts nothing and sends nothing, so
 * looking at a page never tries a write.
 */
export async function visited(location: string, token: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (token.startsWith(AGENT_TOKEN_PREFIX)) return;
  const path = clean(location);
  if (path === "/" || path === PATH_PATH || !/^\/[\w\-/]*$/.test(path)) return;
  const sent = sentThisSession();
  if (sent.has(path)) return;
  sent.add(path);
  try {
    window.sessionStorage.setItem(SENT_KEY, JSON.stringify(Array.from(sent)));
  } catch {
    /* refused: at worst a page counts twice in a session */
  }
  const h = readHistory();
  h.counts[path] = (h.counts[path] ?? 0) + 1;
  writeHistory(h);
  try {
    await fetchImpl("/api/nav/visit", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path }),
    });
  } catch {
    /* a missed count is not the member's problem */
  }
}

/** The personal place for today: kept all day once chosen, chosen again tomorrow. */
export function personalFor(bar: readonly string[], excluded: readonly string[], at: Date = new Date()): string | null {
  const h = readHistory();
  const today = dayKey(at);
  const kept = h.personal;
  if (kept && kept.day === today && !bar.includes(kept.path) && !excluded.includes(kept.path)) return kept.path;
  const path = choosePersonal(h.counts, bar, excluded);
  writeHistory({ ...h, personal: path ? { path, day: today } : null });
  return path;
}

let cached: { at: number; answer: BarAnswer } | null = null;

/**
 * The bar's moving places (the village's pages, then the member's own), or null for the village's fixed bar: the setting is off, the member is not
 * signed in, or the server could not be asked.
 */
export async function loadBar(token: string, fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<string[] | null> {
  let answer = cached && now - cached.at < BAR_KEEP_MS ? cached.answer : null;
  if (!answer) {
    try {
      const res = await fetchImpl("/api/nav/bar", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      answer = (await res.json()) as BarAnswer;
      cached = { at: now, answer };
    } catch {
      return null;
    }
  }
  if (!answer?.on) return null;
  const personal = answer.personal ? personalFor(answer.siteWide, answer.excluded ?? [], new Date(now)) : null;
  return barTabs(answer.siteWide, personal);
}

/** A page visited, for the session this browser holds; nothing when signed out. */
export async function visitedNow(location: string): Promise<void> {
  const token = authToken();
  if (token) await visited(location, token);
}

/** The bar for the session this browser holds; the fixed bar (null) when signed out. */
export async function loadBarNow(): Promise<string[] | null> {
  const token = authToken();
  return token ? loadBar(token) : null;
}

/** For tests: forget the fetched bar. */
export function forgetBar(): void {
  cached = null;
}
