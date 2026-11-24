/**
 * ONE SMALL REPORT PER CRASH SCREEN (crash guard, 19 Nov 2026).
 *
 * Release 1.3.27 fixed a page that crashed for every iOS Safari visitor of
 * /propose-a-role, and nobody on the village's side saw it happen: an
 * applicant wrote in. So every crash screen now tells the server, once: the
 * error boundary (components/ErrorBoundary.tsx), and the window's own `error`
 * and `unhandledrejection` events. The server stores it as an admin event
 * and forwards it to the village's error webhook (server/routes/clientCrash.ts).
 *
 * WHAT A REPORT HOLDS, and nothing else (CrashReport below): the error's
 * message, its top stack frames, the route path, the bundle the page booted,
 * the browser family, and the time. Never form content, never storage, never
 * a query string or a hash, never a cookie or a name. The message and frames
 * are scrubbed of anything shaped like an address, a phone number, a long
 * number or a token before they leave, and the server scrubs them again.
 *
 * RATE LIMITED HERE AND ON THE SERVER: the same error is reported once per
 * page, and a page sends at most MAX_PER_PAGE reports, at least
 * MIN_GAP_MS apart. A render loop that throws a thousand times sends one.
 */

import { isStaleBuildMessage } from "@shared/staleBuild";

export type CrashSource = "boundary" | "error" | "rejection";

/** The whole report. Adding a field here is a privacy decision: say why in the commit. */
export interface CrashReport {
  source: CrashSource;
  /** The error's message, scrubbed, at most MESSAGE_MAX characters. */
  message: string;
  /** The error's type name ("TypeError"), when it has one. */
  name: string;
  /** Up to FRAMES_MAX stack frames, scrubbed, URLs reduced to their path. */
  frames: string[];
  /** location.pathname: no query string, no hash. */
  route: string;
  /** The entry script the page booted ("index-B6yHa53f"), so a stale tab is told apart from a live bug. */
  bundle: string;
  /** "Safari 17 iOS", "Chrome 131 Android": the family and major version only. */
  browser: string;
  /** When it happened, ISO 8601. */
  at: string;
}

export const CRASH_REPORT_PATH = "/api/client-crash";
export const CRASH_REPORT_FIELDS = ["source", "message", "name", "frames", "route", "bundle", "browser", "at"] as const;
export const MESSAGE_MAX = 300;
export const FRAMES_MAX = 5;
export const FRAME_MAX = 200;
export const MAX_PER_PAGE = 5;
export const MIN_GAP_MS = 10_000;

/**
 * Anything that could be a person or a secret, replaced by a marker. Order
 * matters: addresses before the digit runs inside them.
 */
const SCRUBS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "<email>"],
  [/\b(?:eyJ[\w-]+\.[\w-]+\.[\w-]+|(?=[A-Za-z_-]*\d)[A-Za-z0-9_-]{24,})\b/g, "<token>"],
  [/\+?\d[\d\s().-]{7,}\d/g, "<number>"],
  [/\b\d{5,}\b/g, "<number>"],
];

export function scrub(text: string): string {
  let out = text;
  for (const [re, mark] of SCRUBS) out = out.replace(re, mark);
  return out;
}

/** A URL inside a stack frame, reduced to its path: no origin, no query, no hash. */
function framePath(frame: string): string {
  return frame.replace(/(?:https?|blob|webpack|file):\/\/[^\s)]+/g, (url) => {
    try {
      const u = new URL(url.replace(/:\d+:\d+$/, ""));
      const pos = /(:\d+:\d+)$/.exec(url)?.[1] ?? "";
      return `${u.pathname}${pos}`;
    } catch {
      return "<url>";
    }
  });
}

export function topFrames(stack: string | undefined, message: string): string[] {
  if (!stack) return [];
  return stack
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== message && !l.endsWith(`: ${message}`) && l !== `Error: ${message}`)
    .slice(0, FRAMES_MAX)
    .map((l) => scrub(framePath(l)).slice(0, FRAME_MAX));
}

/** The browser's family, major version and platform, from the user agent: nothing finer. */
export function browserFamily(ua: string): string {
  const platform = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "other";
  const pick: Array<[string, RegExp]> = [
    ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
    ["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
    ["Safari", /Version\/(\d+).*Safari/],
  ];
  for (const [name, re] of pick) {
    const m = re.exec(ua);
    if (m) return `${name} ${m[1]} ${platform}`;
  }
  if (/AppleWebKit/.test(ua) && platform === "iOS") return "WebKit iOS";
  return `other ${platform}`;
}

/** The entry script's name without its extension, read off the page; "" in tests and dev. */
function bootedBundle(doc: Document | undefined): string {
  const src = doc?.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.src ?? "";
  return /\/assets\/([\w-]+)\.js/.exec(src)?.[1] ?? "";
}

export function buildCrashReport(err: unknown, source: CrashSource, env: { path: string; ua: string; now: Date; bundle: string }): CrashReport {
  const e = (err && typeof err === "object" ? err : { message: String(err) }) as { message?: unknown; name?: unknown; stack?: unknown };
  const rawMessage = typeof e.message === "string" ? e.message : String(e.message ?? err ?? "unknown error");
  return {
    source,
    message: scrub(rawMessage).slice(0, MESSAGE_MAX),
    name: typeof e.name === "string" ? e.name.slice(0, 40) : "",
    frames: topFrames(typeof e.stack === "string" ? e.stack : undefined, rawMessage),
    route: scrub(env.path.split(/[?#]/)[0]).slice(0, 200) || "/",
    bundle: env.bundle.slice(0, 60),
    browser: browserFamily(env.ua),
    at: env.now.toISOString(),
  };
}

export interface CrashSender {
  send: (report: CrashReport) => void;
  now: () => number;
}

/** The page's own sender: a beacon when it can, a keepalive fetch otherwise, and never a throw. */
const browserSender: CrashSender = {
  now: () => Date.now(),
  send: (report) => {
    try {
      const body = JSON.stringify(report);
      const blob = new Blob([body], { type: "application/json" });
      if (typeof navigator !== "undefined" && navigator.sendBeacon?.(CRASH_REPORT_PATH, blob)) return;
      void fetch(CRASH_REPORT_PATH, /* save-ok: a crash report is fire and forget; nothing on the page waits on it */ { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "omit" }).catch(() => {});
    } catch {
      /* a report that fails must not become a second crash */
    }
  },
};

let sent = 0;
let lastAt = -Infinity;
const seen = new Set<string>();

/** Test seam: forget what this page has sent. */
export function resetCrashReportsForTests(): void {
  sent = 0;
  lastAt = -Infinity;
  seen.clear();
}

/** Report one crash, unless this page already reported it or has used its share. Returns whether it sent. */
export function reportCrash(err: unknown, source: CrashSource, sender: CrashSender = browserSender): boolean {
  try {
    const report = buildCrashReport(err, source, {
      path: typeof location !== "undefined" ? location.pathname : "/",
      ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      now: new Date(sender.now()),
      bundle: bootedBundle(typeof document !== "undefined" ? document : undefined),
    });
    const key = `${report.message}|${report.frames[0] ?? ""}`;
    const now = sender.now();
    if (seen.has(key) || sent >= MAX_PER_PAGE || now - lastAt < MIN_GAP_MS) return false;
    seen.add(key);
    sent++;
    lastAt = now;
    sender.send(report);
    return true;
  } catch {
    return false;
  }
}

/**
 * An error the page cannot act on: a cross-origin script that hides its
 * message ("Script error."), a browser extension, or ResizeObserver's
 * harmless loop notice. Reporting those would bury the real ones.
 */
export function isNoise(message: string, stack: string): boolean {
  if (!message || message === "Script error." || /ResizeObserver loop/.test(message)) return true;
  // A fetch the network dropped (offline, a tunnel, a tab put away mid-request): each engine's
  // whole message for it, and nothing about the page. Matched whole, so a real error that merely
  // mentions a fetch is still told.
  if (NETWORK_DROP.test(message)) return true;
  return /(?:chrome|moz|safari(?:-web)?)-extension:\/\//.test(stack);
}

/** "TypeError: Failed to fetch" (Chromium), "Load failed" (Safari), "NetworkError when attempting to fetch resource." (Firefox). */
const NETWORK_DROP = /^(?:TypeError: )?(?:Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|The network connection was lost\.?)$/;

/**
 * Listen for the window's own crashes. Called once from main.tsx.
 *
 * A CHUNK OR COPY PART THAT DID NOT ARRIVE is not told from here (public
 * launch QA, 24 Nov 2026). The page is already reloading itself for it
 * (lib/staleChunk.ts, on `vite:preloadError`), and when a reload is not
 * allowed the error boundary shows the card and reports it then. Told from
 * here as well, every deploy sent "Failed to fetch dynamically imported
 * module" from tabs that were about to come back on their own, and a report
 * that lands on a server still serving the same bundle (a deploy in flight)
 * passes the crash route's stale check and emails the admins.
 */
export function installCrashReporting(target: Pick<Window, "addEventListener"> = window, sender: CrashSender = browserSender): void {
  target.addEventListener("error", (ev: Event) => {
    const e = ev as ErrorEvent;
    // A failed <img> or <script> fires a plain Event with no message: not a crash.
    if (typeof e.message !== "string") return;
    const err = e.error ?? { message: e.message };
    if (isNoise(e.message, String(err?.stack ?? e.filename ?? ""))) return;
    if (isStaleBuildMessage(e.message)) return;
    reportCrash(err, "error", sender);
  });
  target.addEventListener("unhandledrejection", (ev: Event) => {
    const reason = (ev as PromiseRejectionEvent).reason;
    const message = String(reason?.message ?? reason ?? "");
    if (isNoise(message, String(reason?.stack ?? ""))) return;
    if (isStaleBuildMessage(message)) return;
    reportCrash(reason ?? { message: "unhandled rejection" }, "rejection", sender);
  });
}
