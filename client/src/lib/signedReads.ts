/**
 * EVERY READ OF THE VILLAGE'S OWN API CARRIES THE SIGN-IN.
 *
 * Hundreds of reads across the client use a bare `fetch("/api/...")` that never
 * attaches the stored sign-in (gameFetch does; a bare fetch does not). While the
 * village keeps an entrance (shared/entrance.ts), the server lets a read through
 * for a signed-in member OR for a device holding the visitor entry cookie.
 * Signing in does not set that cookie, so a member who signed in on a device
 * that never filled the visitor form got 401 on every bare read: on home, the
 * season band and the build progress were simply missing, and the roles page
 * lost its archetypes. The live view for QA met the same thing.
 *
 * Installed once at boot, before the first read, this adds the stored sign-in to
 * a GET or HEAD of the village's own /api/ that names no Authorization of its
 * own. It never touches:
 *   - another origin (the token stays home);
 *   - a request that says `credentials: "omit"` (the crash report, the language
 *     catalog: anonymous on purpose, so they cache);
 *   - a request that already carries Authorization (gameFetch and friends);
 *   - a write. A write is a deliberate act and chooses its own sign-in.
 * With no stored sign-in, nothing changes. A stale token is harmless here: the
 * entrance asks for the member first and falls back to the entry cookie.
 */
import { authToken } from "@/lib/gameApi";

type FetchInput = RequestInfo | URL;

/** The Authorization header to add to this request, or null to send it as it is. */
export function signInFor(input: FetchInput, init: RequestInit | undefined, token: string | null, origin: string): string | null {
  if (!token) return null;
  const req = input instanceof Request ? input : null;
  const method = String(init?.method ?? req?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;
  if ((init?.credentials ?? req?.credentials) === "omit") return null;
  let url: URL;
  try {
    url = new URL(req ? req.url : String(input), origin);
  } catch {
    return null;
  }
  if (url.origin !== origin || !url.pathname.startsWith("/api/")) return null;
  const own = new Headers(init?.headers ?? req?.headers ?? undefined);
  if (own.has("authorization")) return null;
  return `Bearer ${token}`;
}

/** Wrap window.fetch. Returns the undo, for tests. */
export function installSignedReads(token: () => string | null = authToken): () => void {
  const original = window.fetch;
  const signed = (input: FetchInput, init?: RequestInit) => {
    const auth = signInFor(input, init, token(), window.location.origin);
    if (!auth) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set("Authorization", auth);
    return original(input, { ...init, headers });
  };
  window.fetch = signed as typeof window.fetch;
  return () => {
    if (window.fetch === (signed as typeof window.fetch)) window.fetch = original;
  };
}
