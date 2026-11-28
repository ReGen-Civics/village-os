/**
 * ONE READ OF EACH LAUNCH PAYLOAD PER SCREEN.
 *
 * Two things sit on every admin screen and both asked the server for the whole
 * launch checklist on their own: the strip above the header and the "only this
 * village can answer this" prompt. `GET /api/admin/launch` resolves every
 * launch requirement, some of which ask a mail provider, so that was the most
 * expensive admin read made twice per page for one answer.
 *
 * Callers that mount in the same moment now share one request. The answer is
 * kept for a few seconds and no longer: this is about one screen drawing, and
 * a page that has just changed something asks again with `fresh`.
 *
 * `readLaunchFacts` is the small read beside it (`shared/launchFacts.ts`): what
 * is true about where the village stands, with no checks run. A control reads
 * the fact its own server door reads, so no screen offers what the server
 * refuses.
 */
import { useEffect, useState } from "react";
import type { LaunchFactsAnswer } from "@shared/launchFacts";

/** How long one answer is shared. Long enough for a screen to draw, short enough that nobody reads an old village. */
const SHARE_MS = 5000;

interface Held {
  at: number;
  token: string;
  answer: Promise<unknown | null>;
}

const held = new Map<string, Held>();

function read<T>(path: string, token: string, fresh: boolean): Promise<T | null> {
  const now = Date.now();
  const last = held.get(path);
  if (!fresh && last && last.token === token && now - last.at < SHARE_MS) return last.answer as Promise<T | null>;
  const answer: Promise<unknown | null> = fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.ok ? r.json() : null))
    // A reading that could not be taken is null. Each caller decides what to show for that.
    .catch(() => null);
  held.set(path, { at: now, token, answer });
  return answer as Promise<T | null>;
}

/** One checklist row, as far as the admin frame reads it. */
export interface LaunchRowRead {
  id: string;
  title: string;
  detail: string;
  state: string;
  fixAt: string;
}

/** The part of `GET /api/admin/launch` the admin frame reads. The journey page draws the rest. */
export interface LaunchStatusRead {
  items?: LaunchRowRead[];
  blockingOpen?: number;
  recommendedOpen?: number;
  launchedAt?: string | null;
}

/** The whole launch checklist, shared between callers on one screen. Null when it could not be read. */
export function readLaunchStatus(token: string, opts: { fresh?: boolean } = {}): Promise<LaunchStatusRead | null> {
  return read<LaunchStatusRead>("/admin/launch", token, opts.fresh === true);
}

/** The launch facts and their display label. Null when they could not be read. */
export function readLaunchFacts(token: string, opts: { fresh?: boolean } = {}): Promise<LaunchFactsAnswer | null> {
  return read<LaunchFactsAnswer>("/admin/launch/facts", token, opts.fresh === true);
}

/** Drop what is held, for a test or a sign-out. */
export function forgetLaunchReads(): void {
  held.clear();
}

/** The launch facts for a signed-in admin, or null until they arrive or when they cannot be read. */
export function useLaunchFacts(token: string | null | undefined): LaunchFactsAnswer | null {
  const [answer, setAnswer] = useState<LaunchFactsAnswer | null>(null);
  useEffect(() => {
    if (!token) {
      setAnswer(null);
      return;
    }
    let live = true;
    void readLaunchFacts(token).then((a) => {
      if (live) setAnswer(a);
    });
    return () => {
      live = false;
    };
  }, [token]);
  return answer;
}
