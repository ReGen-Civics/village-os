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
 * Unauthenticated on purpose: a crash before sign-in (the apply flow) is the
 * one we most need to hear about. So it is limited per address and across
 * the instance, answers 204 whatever happens, and never echoes what it got.
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import { recentEvents, recordEvent } from "../lib/events";
import { reportError } from "../lib/errors";

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

type Deps = {
  getPool: () => Pool;
  overLimit: (bucket: string, max: number, windowMs: number) => Promise<boolean>;
  clientIp: (req: Request) => string;
  isAdmin: (req: Request) => Promise<boolean>;
  buildMarker: string;
  /** Test seam; defaults to reportError, which owns the webhook and the admin alert. */
  report?: typeof reportError;
};

export function register(app: Express, deps: Deps): void {
  const report = deps.report ?? reportError;
  app.post(CLIENT_CRASH_PATH, async (req: Request, res: Response) => {
    // Always the same answer, so the route tells a prober nothing.
    res.status(204).end();
    try {
      const crash = sanitizeCrash(req.body, deps.buildMarker);
      if (!crash) return;
      if (await deps.overLimit(`client-crash:${deps.clientIp(req)}`, PER_ADDRESS, TEN_MINUTES)) return;
      if (await deps.overLimit("client-crash:instance", PER_INSTANCE, HOUR)) return;
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
