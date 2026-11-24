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
 * bundle is a build that broke its own rule, and is reported like any crash, as
 * is any report when the current bundle cannot be read.
 *
 * Unauthenticated on purpose: a crash before sign-in (the apply flow) is the
 * one we most need to hear about. So it is limited per address and across
 * the instance, answers 204 whatever happens, and never echoes what it got.
 */
import fs from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import { recentEvents, recordEvent } from "../lib/events";
import { reportError } from "../lib/errors";
import { isStaleBuildMessage } from "../../shared/staleBuild";

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

export function register(app: Express, deps: Deps): void {
  const report = deps.report ?? reportError;
  const currentBundle = deps.currentBundle ?? bundleFromDisk(deps.publicDir);
  app.post(CLIENT_CRASH_PATH, async (req: Request, res: Response) => {
    // Always the same answer, so the route tells a prober nothing.
    res.status(204).end();
    try {
      const crash = sanitizeCrash(req.body, deps.buildMarker);
      if (!crash) return;
      if (await deps.overLimit(`client-crash:${deps.clientIp(req)}`, PER_ADDRESS, TEN_MINUTES)) return;
      if (await deps.overLimit("client-crash:instance", PER_INSTANCE, HOUR)) return;
      if (isStaleBuildMiss(crash, currentBundle())) {
        console.log("[client-crash] a page from before an update missed a file this release replaced (not a crash): %s", crashLine(crash));
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
      const err = Object.assign(new Error(crash.message), { name: crash.name || "Error", stack: [`${crash.name || "Error"}: ${crash.message}`, ...crash.frames.map((f) => `    ${f}`)].join("\n") });
      await report(err, {
        where: `browser on ${crash.route}`,
        detail: { source: crash.source, browser: crash.browser, build: crash.build, bundle: crash.bundle, at: crash.at },
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
    res.json({ crashes: rows.filter((r) => r.kind === "client_crash").slice(0, 20).map((r) => ({ id: r.id, at: r.at, route: r.entityRef, text: r.text })) });
  });
}
