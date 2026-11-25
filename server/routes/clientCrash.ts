/**
 * A BROWSER'S CRASH SCREEN, TOLD TO THE VILLAGE (crash guard, 19 Nov 2026).
 *
 * client/src/lib/crashReport.ts sends one small report whenever a page shows
 * its crash screen or the window throws. This takes it in, keeps only the
 * fields that report defines, scrubs them again (a client is never trusted to
 * have done it), and then:
 *
 *  1. records it as an ADMIN event through recordEvent, kind `client_crash`,
 *     so it shows in the admin audit trail beside every other admin event;
 *     An admin also reads the latest ones on the Village Health page
 *     (GET /api/admin/client-crashes, admins only);
 *  2. hands it to reportError (server/lib/errors.ts), which notifies the
 *     admins in the app and posts to the error webhook when one is set
 *     (`error_webhook_url` in Admin, Integrations, or ERROR_WEBHOOK_URL).
 *     reportError dedupes by message and top frame for an hour, so a crash
 *     every visitor hits is one alert, and it never logs the webhook's
 *     address.
 *
 * EXCEPT A PAGE THAT OUTLIVED A DEPLOY (2026-11-24). A tab opened before a
 * release asks the new server for a chunk or copy part only the old build had,
 * and its crash screen reported "copy part <hash>: 404" as a crash, so every
 * deploy emailed every admin once per open tab. Such a report, a stale-build
 * message (shared/staleBuild.ts) from a bundle other than the one this server
 * serves, is a log line and nothing more: no event, no alert. The page itself
 * reloads once (client/src/lib/staleChunk.ts). The same miss from the CURRENT
 * bundle, or when the current bundle cannot be read, is recorded, and emails
 * once it reaches several visitors (25 Nov 2026): during a deploy a tab can load
 * the new entry and miss a part on the old server, so one report proves nothing,
 * and a build that really broke its own rule reaches everyone within the hour.
 *
 * NOISE, AND WHAT EMAILS (the lead, 25 Nov 2026). A report nobody can act on (shared/crashNoise.ts: an extension, an
 * injected global, a dropped connection, an opaque cross-origin error) is dropped here as well as in the page,
 * because a tab still running a bundle from before a deploy never learned the page's newer rules. Every other report
 * is recorded by signature and emails only when it is ours or has spread, once a day at most with a running count;
 * the rest go in a daily digest (server/lib/crashTriage.ts).
 *
 * Unauthenticated on purpose: a crash before sign-in (the apply flow) is the
 * one we most need to hear about. So it is limited per address and across
 * the instance, answers 204 whatever happens, and never echoes what it got.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import { recentEvents, recordEvent } from "../lib/events";
import { reportError } from "../lib/errors";
import { isStaleBuildMessage } from "../../shared/staleBuild";
import { isCrashNoise } from "../../shared/crashNoise";
import { alertWords, decideEmail, digestWords, readTriageDials, visitorDigest } from "../lib/crashTriage";
import { claimEmail, digestGroups, markDigested, recordSighting, signatureViews, sweepSightings } from "../repos/clientCrashes";

export const CLIENT_CRASH_PATH = "/api/client-crash";
/** Reports one address may send in ten minutes. A shared village address is several people. */
export const PER_ADDRESS = 20;
/** Reports the whole instance takes in an hour, so a broken release cannot flood the events table. */
export const PER_INSTANCE = 300;
const TEN_MINUTES = 10 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const SOURCES = new Set(["boundary", "error", "rejection"]);

/** The stored report: exactly these fields, each bounded. */
export interface StoredCrash {
  source: "boundary" | "error" | "rejection";
  message: string;
  name: string;
  frames: string[];
  route: string;
  bundle: string;
  browser: string;
  at: string;
  /** Stamped here from the running server, so it cannot be forged or stale. */
  build: string;
}

const SCRUBS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "<email>"],
  [/\b(?:eyJ[\w-]+\.[\w-]+\.[\w-]+|(?=[A-Za-z_-]*\d)[A-Za-z0-9_-]{24,})\b/g, "<token>"],
  [/\+?\d[\d\s().-]{7,}\d/g, "<number>"],
  [/\b\d{5,}\b/g, "<number>"],
];

function clean(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  let out = v.replace(/[\u0000-\u001f\u007f]/g, " ");
  for (const [re, mark] of SCRUBS) out = out.replace(re, mark);
  return out.slice(0, max);
}

/** The report as stored, or null when the body is not a crash report. Unknown fields are dropped, never kept. */
export function sanitizeCrash(body: unknown, build: string, now: Date = new Date()): StoredCrash | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const source = typeof b.source === "string" && SOURCES.has(b.source) ? (b.source as StoredCrash["source"]) : null;
  const message = clean(b.message, 300).trim();
  if (!source || !message) return null;
  const at = typeof b.at === "string" && !Number.isNaN(Date.parse(b.at)) ? new Date(b.at) : now;
  // A clock far off is the device's, not the crash's: keep the server's time then.
  const when = Math.abs(at.getTime() - now.getTime()) > 24 * HOUR ? now : at;
  return {
    source,
    message,
    name: clean(b.name, 40),
    frames: (Array.isArray(b.frames) ? b.frames : []).slice(0, 5).map((f) => clean(f, 200)).filter(Boolean),
    route: clean(b.route, 200).split(/[?#]/)[0] || "/",
    bundle: clean(b.bundle, 60).replace(/[^\w-]/g, ""),
    browser: clean(b.browser, 40),
    at: when.toISOString(),
    build,
  };
}

/** One line for the audit trail and the alert: what broke, where, on which browser and build. */
export function crashLine(c: StoredCrash): string {
  return `${c.name ? `${c.name}: ` : ""}${c.message} (on ${c.route}, ${c.browser}, build ${c.build}${c.bundle ? `, ${c.bundle}` : ""})`.slice(0, 600);
}

/**
 * The entry bundle a page names itself by ("index-B6yHa53f"), read off an
 * index.html the same way the browser reads it (client/src/lib/crashReport.ts,
 * `bootedBundle`). Null when there is none.
 */
export function entryBundleOf(indexHtml: string | null | undefined): string | null {
  if (!indexHtml) return null;
  for (const [tag] of Array.from(indexHtml.matchAll(/<script\b[^>]*>/gi))) {
    if (!/type=["']module["']/i.test(tag)) continue;
    const name = /src=["'][^"']*\/assets\/([\w-]+)\.js["']/.exec(tag)?.[1];
    if (name) return name;
  }
  return null;
}

/**
 * A report from a page that outlived a deploy: a chunk or part that did not
 * arrive, from a bundle this server does not serve. Unknown on either side
 * answers false, so the report is told like any other crash.
 */
export function isStaleBuildMiss(crash: Pick<StoredCrash, "message" | "bundle">, currentBundle: string | null): boolean {
  if (!isStaleBuildMessage(crash.message)) return false;
  if (!crash.bundle || !currentBundle) return false;
  return crash.bundle !== currentBundle;
}

type Deps = {
  getPool: () => Pool;
  overLimit: (bucket: string, max: number, windowMs: number) => Promise<boolean>;
  clientIp: (req: Request) => string;
  isAdmin: (req: Request) => Promise<boolean>;
  buildMarker: string;
  /** Test seam; defaults to reportError, which owns the webhook and the admin alert. */
  report?: typeof reportError;
  /** A dial's number (`numberVar`): the triage's three dials. Absent, the platform's defaults. */
  numberVar?: (key: string) => number;
  /** The salt a visitor's daily digest is made under. Absent, one per process, which still counts within a day. */
  visitorSalt?: () => string;
  /** The crash alert sinks, for the daily digest (`crashAlertNotifier`). Absent, no digest is sent. */
  alertAdmins?: (title: string, dedupeKey: string, extras?: { body?: string; link?: string }) => Promise<void>;
  /** The scheduler's `registerJob`, for the daily digest. Absent, no digest job is registered. */
  registerJob?: (name: string, everyMs: number, fn: () => Promise<string | void>) => void;
  /** Test seam: the clock. */
  now?: () => Date;
  /** Where the built index.html lives, to learn the bundle this server serves. */
  publicDir?: string;
  /** Test seam: the bundle this server serves, or null. Defaults to reading `publicDir`. */
  currentBundle?: () => string | null;
};

/** The served bundle, read once from disk. A read that fails is retried next time, never cached as null. */
function bundleFromDisk(publicDir: string | undefined): () => string | null {
  let found: string | null = null;
  return () => {
    if (found !== null || !publicDir) return found;
    try {
      found = entryBundleOf(fs.readFileSync(path.join(publicDir, "index.html"), "utf8"));
    } catch {
      found = null;
    }
    return found;
  };
}

/** The jobs' names in `scheduled_jobs`. */
export const CRASH_DIGEST_JOB = "client-crash-digest";
export const CRASH_RETENTION_JOB = "client-crash-retention";

/**
 * The daily digest: every report recorded and not emailed since the last one, by signature, browser and page. Sent
 * only when there is something in it, under one key a day, so a retried run sends nothing twice.
 */
export async function sendCrashDigest(pool: Pool, alertAdmins: NonNullable<Deps["alertAdmins"]>, now: Date): Promise<string> {
  const { groups, ids } = await digestGroups(pool, now);
  if (!groups.length) return "nothing to tell";
  const words = digestWords(groups);
  await alertAdmins(words.title, `client-crash-digest:${now.toISOString().slice(0, 10)}`, { body: words.body, link: "/village-health" });
  await markDigested(pool, ids, now);
  return `${ids.length} report(s) in ${groups.length} line(s)`;
}

export function register(app: Express, deps: Deps): void {
  const report = deps.report ?? reportError;
  const currentBundle = deps.currentBundle ?? bundleFromDisk(deps.publicDir);
  const now = deps.now ?? (() => new Date());
  const processSalt = crypto.randomBytes(16).toString("hex");
  const salt = () => {
    try {
      return deps.visitorSalt?.() || processSalt;
    } catch {
      return processSalt;
    }
  };
  const dials = () => readTriageDials(deps.numberVar ?? (() => Number.NaN));
  if (deps.registerJob && deps.alertAdmins) {
    const alertAdmins = deps.alertAdmins;
    deps.registerJob(CRASH_DIGEST_JOB, 24 * HOUR, () => sendCrashDigest(deps.getPool(), alertAdmins, now()));
  }
  // Reports are kept `ops.crash_keep_days` (default 30), then forgotten.
  deps.registerJob?.(CRASH_RETENTION_JOB, 24 * HOUR, async () => {
    const gone = await sweepSightings(deps.getPool(), now(), dials().keepDays);
    return `${gone.sightings} report(s) and ${gone.signatures} crash(es) older than ${dials().keepDays} days`;
  });
  app.post(CLIENT_CRASH_PATH, async (req: Request, res: Response) => {
    // Always the same answer, so the route tells a prober nothing.
    res.status(204).end();
    try {
      const crash = sanitizeCrash(req.body, deps.buildMarker);
      if (!crash) return;
      if (await deps.overLimit(`client-crash:${deps.clientIp(req)}`, PER_ADDRESS, TEN_MINUTES)) return;
      if (await deps.overLimit("client-crash:instance", PER_INSTANCE, HOUR)) return;
      const served = currentBundle();
      if (isStaleBuildMiss(crash, served)) {
        console.log("[client-crash] a page from before an update missed a file this release replaced (not a crash): %s", crashLine(crash));
        return;
      }
      if (isCrashNoise(crash.message, crash.frames)) {
        console.log("[client-crash] noise nobody can act on (not recorded): %s", crashLine(crash));
        return;
      }
      await recordEvent(deps.getPool(), {
        kind: "client_crash",
        text: crashLine(crash),
        actorKind: "system",
        entityType: "route",
        entityRef: crash.route,
        audience: "admin",
      });
      const at = now();
      const d = dials();
      const sighting = { message: crash.message, frames: crash.frames, browser: crash.browser, route: crash.route, visitor: visitorDigest(salt(), deps.clientIp(req), at), now: at,
        // A miss from the bundle this server serves (a deploy in flight, or a build that broke its rule) emails once it spreads.
        staleBuild: isStaleBuildMessage(crash.message) };
      const state = await recordSighting(deps.getPool(), sighting, d);
      const verdict = decideEmail({ ours: state.ours, visitorsInWindow: state.visitorsInWindow, emailedAt: state.emailedAt, now: at }, d);
      if (!verdict.email) return;
      const number = await claimEmail(deps.getPool(), state, d, at);
      if (number === null) return; // another report took this window's email
      const words = alertWords({ ...state, emailsSent: number, emailedAt: at }, sighting, verdict.why);
      const err = Object.assign(new Error(crash.message), { name: crash.name || "Error", stack: [`${crash.name || "Error"}: ${crash.message}`, ...crash.frames.map((f) => `    ${f}`)].join("\n") });
      await report(err, {
        where: `browser on ${crash.route}`,
        detail: { source: crash.source, browser: crash.browser, build: crash.build, bundle: crash.bundle, at: crash.at, signature: state.id, seen: state.seenCount, ours: state.ours },
        alert: { ...words, dedupeKey: `client-crash:${state.id}:${number}` },
      });
    } catch (e) {
      console.error("[client-crash] could not store a crash report (ignored)", e instanceof Error ? e.message : e);
    }
  });

  /** The latest browser crashes, for the admin card on Village Health. Admins only. */
  app.get(`/api/admin/client-crashes`, async (req: Request, res: Response) => {
    if (!(await deps.isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const rows = await recentEvents(deps.getPool(), "admin", 500);
    res.setHeader("Cache-Control", "no-store");
    // The signatures, each with its count and whether it emailed; read apart so a table a release has not made yet
    // leaves the plain list as it was.
    const signatures = await signatureViews(deps.getPool()).catch(() => []);
    res.json({ crashes: rows.filter((r) => r.kind === "client_crash").slice(0, 20).map((r) => ({ id: r.id, at: r.at, route: r.entityRef, text: r.text })), signatures });
  });
}
