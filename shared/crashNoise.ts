/**
 * WHICH BROWSER CRASH REPORTS ARE NOISE, AND WHICH ARE OURS (the lead, 25 Nov 2026: "we're getting noise for crash
 * logs ... fix that so we're not bogged down in noise").
 *
 * Shared, so the crash route applies the same rules the page does (client/src/lib/crashReport.ts, `isNoise`, reads
 * them from here). A
 * filter in the page alone can never catch a tab still running the bundle from before a deploy, and every release
 * that taught the page a new kind of noise left the old tabs sending it for days. The server reads these now.
 *
 * Three questions, each a pure function:
 *   - `isCrashNoise`: something the page cannot act on at all. Dropped on arrival, never recorded.
 *   - `framesAreOurs`: a stack with at least one frame from our own `/assets/` bundle. Our code was running, so it
 *     is worth an email the first time it is seen.
 *   - `crashSignature`: message plus top frame, with the build's hash and line numbers taken out, so one bug keeps
 *     one signature across deploys and one email a day says how many times it happened.
 */

/** A cross-origin script that hides its message. */
const OPAQUE = /^Script error\.?$/;
/** ResizeObserver's harmless notice, in any engine's words. */
const RESIZE_LOOP = /ResizeObserver loop/;

/**
 * A fetch the network dropped: each engine's whole message for it, and nothing about the page. Matched whole, so a
 * real error that merely mentions a fetch is still told.
 */
const NETWORK_DROP = /^(?:TypeError: )?(?:Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|The network connection was lost\.?)$/;

/** A frame from a browser extension's own files. */
const EXTENSION_FRAME = /(?:chrome|moz|safari(?:-web)?)-extension:\/\//;

/**
 * A global that a wallet extension or an in-app browser puts on the page, never ours: `window.ethereum` (wallets),
 * `__firefox__` (Firefox iOS), `__gCrWeb` and `__crWeb` (Chrome iOS), `webkit.messageHandlers` (in-app browsers).
 * Noise only while no frame is from our bundle: if our code reached for one of them, that is ours to fix.
 */
const INJECTED_GLOBAL = /\b(?:window\.)?(?:ethereum|__firefox__|__gCrWeb|__crWeb|webkit\.messageHandlers)\b/;

/** A frame from our own built bundle: `/assets/<name>-<hash>.js`, as the page reduces a frame's URL to its path. */
const OUR_BUNDLE = /\/assets\/[\w.-]+\.js/;

function joined(frames: string | readonly string[]): string {
  return typeof frames === "string" ? frames : frames.join("\n");
}

/** True when at least one frame ran in our own bundle. */
export function framesAreOurs(frames: string | readonly string[]): boolean {
  return OUR_BUNDLE.test(joined(frames));
}

/** True for a report nobody can act on: dropped by the page and, for older pages, by the server. */
export function isCrashNoise(message: string, frames: string | readonly string[]): boolean {
  const msg = (message ?? "").trim();
  if (!msg || OPAQUE.test(msg) || RESIZE_LOOP.test(msg) || NETWORK_DROP.test(msg)) return true;
  const stack = joined(frames);
  if (EXTENSION_FRAME.test(stack)) return true;
  if (INJECTED_GLOBAL.test(msg) && !OUR_BUNDLE.test(stack)) return true;
  return false;
}

/**
 * One frame with the build taken out: the content hash of the chunk (`index-B6yHa53f.js` reads `index.js`) and the
 * line and column, which move with every release. What is left is which function, in which of our files.
 */
export function stableFrame(frame: string | undefined): string {
  return String(frame ?? "")
    .trim()
    .replace(/(\/assets\/[\w.]+?)-[\w-]{6,}(\.js)/g, "$1$2")
    .replace(/:\d+(?::\d+)?(?=\)?$)/, "")
    .slice(0, 200);
}

/** The message with what varies between visitors taken out: numbers, and the scrubber's markers stay as they are. */
export function stableMessage(message: string): string {
  return String(message ?? "")
    .trim()
    .replace(/\b\d+(?:\.\d+)?\b/g, "N")
    .slice(0, 300);
}

/** The words a signature is made of. Hashed by the server into a short id (`crashSignatureId`). */
export function crashSignature(message: string, frames: readonly string[]): string {
  return `${stableMessage(message)}\n${stableFrame(frames[0])}`;
}

/**
 * The browser KIND for a person reading an alert, from the family the page sends ("Safari 17 iOS", "WebKit iOS",
 * "Chrome 131 Android"). A WebKit page on iOS with no Safari version is an app's own browser (Instagram, Facebook,
 * Gmail and the rest), which is where most noise has come from, so it says so.
 */
export function browserKind(browser: string): string {
  const b = String(browser ?? "").trim();
  if (!b) return "unknown browser";
  if (/^WebKit iOS$/.test(b)) return "in-app browser (iOS)";
  const m = /^(Edge|Firefox|Chrome|Safari|other)(?: \d+)? (iOS|Android|macOS|Windows|Linux|other)$/.exec(b);
  if (!m) return b.slice(0, 40);
  if (m[1] === "other") return `other browser (${m[2]})`;
  return `${m[1]} ${m[2]}`;
}
