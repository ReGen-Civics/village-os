/**
 * A FRESH START FOR ONE DEVICE (/reset, pages/Reset.tsx).
 *
 * The link we hand to a member whose phone is stuck on an old version, or
 * holding something odd, when a reload has not fixed it. It clears what this
 * site keeps on the device:
 *
 *  - every service worker registered for this origin (client/public/sw.js is
 *    narrow on purpose, but an old one from an earlier build could still be
 *    installed);
 *  - all Cache Storage (the map copy the worker keeps, and anything older);
 *  - localStorage and sessionStorage for this site,
 *
 * EXCEPT WHAT THE MEMBER IS WRITING. A draft lives on the device and nowhere
 * else, so clearing it would throw away somebody's words to fix a page. Kept,
 * by key:
 *
 *  - `apply-draft:...`, the role application form's device draft
 *    (components/fireflyPath/applyDraft.ts `draftKey`, used by ProposeARole);
 *  - `village.journal.draft.<owner>` and `village.journal.outbox`, a journal
 *    sitting in progress and entries waiting to sync (components/journal);
 *  - `village.queue.<name>`, any page's offline queue (lib/offlineQueue.ts):
 *    requests a member made with no signal that have not reached the server;
 *  - any other key with "draft" in its name, so a draft added later is kept
 *    without anybody remembering this list (the work-with-us form's is one);
 *  - THE SIGN-IN (`TOKEN_KEY`, and `LEGACY_TOKEN_KEY` until it is moved).
 *    /reset is a link anybody can send, so a reset that signed people out
 *    would let anyone sign a member out with one link (security sweep on
 *    #1245). Signing out is a separate tap on the page (`logout` in
 *    contexts/AuthContext.tsx), which also ends the session on the server.
 *
 * Every step is wrapped: a browser that refuses one area must not stop the
 * others, and the page must still say what it did.
 */

import { LEGACY_TOKEN_KEY, TOKEN_KEY } from "./gameApi";
import { QUEUE_KEY_PREFIX } from "./offlineQueue";

/** The keys that hold the sign-in, which the reset leaves in place. */
export function isSignInKey(key: string): boolean {
  return key === TOKEN_KEY || key === LEGACY_TOKEN_KEY;
}

/** A key the reset never removes. */
export function isKeptKey(key: string): boolean {
  return /draft/i.test(key) || key === "village.journal.outbox" || key.startsWith(QUEUE_KEY_PREFIX) || isSignInKey(key);
}

export interface ResetResult {
  workers: number;
  caches: number;
  /** Keys removed across both storage areas. */
  cleared: number;
  /** Draft keys left in place (the sign-in is not counted here). */
  kept: number;
  /** A sign-in was on the device and is still there. */
  signedIn: boolean;
}

export interface ResetEnv {
  serviceWorker?: Pick<ServiceWorkerContainer, "getRegistrations"> | null;
  caches?: Pick<CacheStorage, "keys" | "delete"> | null;
  local?: () => Storage | null;
  session?: () => Storage | null;
}

function area(get: () => Storage): () => Storage | null {
  return () => {
    try {
      return get();
    } catch {
      return null;
    }
  };
}

function browserEnv(): ResetEnv {
  return {
    serviceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator ? navigator.serviceWorker : null,
    caches: typeof caches !== "undefined" ? caches : null,
    local: area(() => window.localStorage),
    session: area(() => window.sessionStorage),
  };
}

function clearArea(get: (() => Storage | null) | undefined, result: ResetResult): void {
  try {
    const store = get?.();
    if (!store) return;
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k !== null) keys.push(k);
    }
    for (const k of keys) {
      if (isSignInKey(k)) {
        result.signedIn = true;
        continue;
      }
      if (isKeptKey(k)) {
        result.kept++;
        continue;
      }
      try {
        store.removeItem(k);
        result.cleared++;
      } catch {
        /* one key refused; carry on with the rest */
      }
    }
  } catch {
    /* the area refused to be read; nothing more to do there */
  }
}

export async function resetDevice(env: ResetEnv = browserEnv()): Promise<ResetResult> {
  const result: ResetResult = { workers: 0, caches: 0, cleared: 0, kept: 0, signedIn: false };

  try {
    const regs = (await env.serviceWorker?.getRegistrations()) ?? [];
    const done = await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    result.workers = done.filter(Boolean).length;
  } catch {
    /* no worker API, or it refused */
  }

  try {
    const names = (await env.caches?.keys()) ?? [];
    const done = await Promise.all(names.map((n) => env.caches!.delete(n).catch(() => false)));
    result.caches = done.filter(Boolean).length;
  } catch {
    /* no Cache Storage, or it refused */
  }

  clearArea(env.local, result);
  clearArea(env.session, result);
  return result;
}
