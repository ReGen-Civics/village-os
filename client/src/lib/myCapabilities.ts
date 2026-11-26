/**
 * MAY THIS PAGE ASK THAT ROUTE AT ALL (live QA pass, 25 Nov 2026; server/routes/myCapabilities.ts).
 *
 * Some member pages asked an admin or power-holder route to learn whether it was theirs, and read the refusal as
 * "not yours". `mayAsk` lets a page ask first, from the viewer's own keys, read once per session.
 *
 * FAILS CLOSED, which here means it skips nothing: signed out, a read that fails, or an answer of the wrong shape
 * all return true, and the page asks the route the way it always did and keeps its honest refusal text. Only an
 * answer the server actually gave can stop a request. It decides what the browser asks and nothing else: every
 * route still guards itself.
 */
import { authToken, gameFetch } from "@/lib/gameApi";

let cached: { token: string; answer: Promise<ReadonlySet<string> | null> } | null = null;

/** The viewer's own keys, or null when they could not be read (then nothing is skipped). */
export function heldCapabilities(): Promise<ReadonlySet<string> | null> {
  const token = authToken();
  if (!token) return Promise.resolve(null);
  if (cached?.token === token) return cached.answer;
  // Started inside the chain, so even a throw before the request leaves reads as "unknown" and skips nothing.
  const answer = Promise.resolve()
    .then(() => gameFetch("/api/me/capabilities"))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (Array.isArray(d?.capabilities) && d.capabilities.every((c: unknown) => typeof c === "string") ? new Set<string>(d.capabilities) : null))
    .catch(() => null)
    .then((held) => {
      // A failed read is not remembered: the next page tries again.
      if (held === null && cached?.answer === answer) cached = null;
      return held;
    });
  cached = { token, answer };
  return answer;
}

/** True when the viewer holds any of these keys, or when their keys are not known. */
export async function mayAsk(...caps: readonly string[]): Promise<boolean> {
  const held = await heldCapabilities();
  return held === null || caps.some((c) => held.has(c));
}

/** For tests: forget the read. */
export function forgetCapabilities(): void {
  cached = null;
}
