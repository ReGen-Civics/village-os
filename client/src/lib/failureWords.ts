/**
 * The sentence a person reads when a request fails (surface audit, 19 Nov 2026).
 *
 * Pages caught a failed request and showed the error's own message. When the
 * phone has no signal, fetch rejects with a TypeError whose message is the
 * browser's, not ours: "Failed to fetch" in Chrome, "Load failed" in Safari,
 * "NetworkError when attempting to fetch resource." in Firefox. A person on
 * the sign-in page with one bar of signal read "Load failed" and nothing about
 * what to do. A proxy's HTML error page makes res.json() throw a SyntaxError
 * with a parser's message, and a timed-out request an AbortError.
 *
 * So the three the browser writes get plain words, and a message the village
 * wrote itself (an Error thrown with the server's own sentence) comes through
 * as written. With nothing to say, the caller's fallback.
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";

const NOTHING_ANSWERED = msg({ message: "Nothing answered. Check your connection and try again.", context: "a request failed with no connection" });
const ODD_ANSWER = msg({ message: "The village did not answer properly. Try again in a moment.", context: "a request got an unreadable answer" });
const TOO_LONG = msg({ message: "That took too long. Check your connection and try again.", context: "a request timed out" });
const DID_NOT_GO = msg({ message: "That did not go through. Try again.", context: "a request failed, no detail" });

type Words = typeof DID_NOT_GO;

export function failureWords(err: unknown, fallback?: string): string {
  // A failure path must never throw: with no locale active yet, the words as written.
  const say = (w: Words) => {
    try {
      return i18n._(w);
    } catch {
      return w.message ?? fallback ?? "";
    }
  };
  if (err instanceof TypeError) return say(NOTHING_ANSWERED);
  if (err instanceof SyntaxError) return say(ODD_ANSWER);
  const name = (err as { name?: unknown } | null)?.name;
  if (name === "AbortError" || name === "TimeoutError") return say(TOO_LONG);
  const said = err instanceof Error ? err.message.trim() : "";
  return said || fallback || say(DID_NOT_GO);
}
