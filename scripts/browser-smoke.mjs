#!/usr/bin/env node
/**
 * BROWSER SMOKE FOR A RELEASE (19 Nov 2026).
 *
 * Release 1.3.27 shipped a page that crashed for every iOS Safari visitor of
 * /propose-a-role. The deploy's smoke only asked whether signed-out routes
 * answered something other than 404 or 5xx, and a page that answers 200 and
 * then throws in the browser passes that. This renders the pages in real
 * engines and fails on what a visitor would see:
 *
 *  - every key signed-out page in Chromium (desktop) and WebKit (an iPhone
 *    profile, the engine iOS Safari runs), failing on any uncaught page error,
 *    the app's crash screen, a crash report sent to /api/client-crash, a
 *    document status of 400 or more, or a page that drew nothing at all;
 *  - the apply flow: /propose-a-role rendered, its form read, and an
 *    application sent from inside the page with a realistic long answer,
 *    flagged as a TEST so the server judges it fully and then mails nobody and
 *    lists it for no reviewer (server/lib/smokeTest.ts).
 *
 * Standalone against any URL: it needs Node 18+, the `playwright` package and
 * its browsers, nothing from this repository's install.
 *
 *   node scripts/browser-smoke.mjs --base-url https://staging.example.org
 *
 * Options (each also an environment variable):
 *   --base-url URL          SMOKE_BASE_URL      the deploy to test (required)
 *   --browsers a,b          SMOKE_BROWSERS      chromium,webkit (default both)
 *   --routes /a,/b          SMOKE_ROUTES        replaces the default page list
 *   --require-webkit        SMOKE_REQUIRE_WEBKIT=1   a WebKit that will not launch fails the run
 *   --require-apply         SMOKE_REQUIRE_APPLY=1    an apply flow that cannot run fails the run
 *   --skip-apply            SMOKE_SKIP_APPLY=1
 *   --json FILE             SMOKE_JSON          also write the results as JSON
 *                           SMOKE_TEST_TOKEN    the server's token; without it the apply step is skipped
 *                           SMOKE_WHY_CHARS     length of the "why" answer (default 7500)
 *                           SMOKE_TIMEOUT_MS    per page (default 30000)
 *                           PLAYWRIGHT_MODULE   a path to the playwright package, when it is not resolvable
 *
 * Exit codes: 0 every check passed; 1 a page or the apply flow failed;
 * 2 bad usage or the base URL did not answer; 3 Playwright or a required
 * browser is missing.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** The pages a signed-out visitor reaches first, the apply flow's among them. */
export const DEFAULT_ROUTES = [
  "/",
  "/roles",
  "/propose-a-role",
  "/steward",
  "/work-with-us",
  "/visit",
  "/stay",
  "/team",
  "/love-letter",
  "/master-plan",
  "/how-we-create",
  "/good-neighbor",
  "/co-creators-guide",
  "/investor",
  "/resident",
  "/prosperity",
  "/resident-rights",
  "/steward-rights",
  "/opportunities",
  "/pricing",
  "/request-membership",
  "/login",
  "/register",
  "/forgot-password",
  "/welcome",
];

export const SMOKE_HEADER = "x-village-smoke-test";
export const SMOKE_DOMAIN = "@smoke.example.invalid";
/** The crash screen's words (client/src/components/ErrorBoundary.tsx). */
export const CRASH_WORDS = ["This page didn't load", "This page didn’t load"];

const EXIT = { ok: 0, failed: 1, usage: 2, missing: 3 };

export function parseArgs(argv, env = process.env) {
  const flag = (name) => argv.includes(`--${name}`);
  const value = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const list = (s) => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return {
    baseUrl: String(value("base-url") ?? env.SMOKE_BASE_URL ?? "").replace(/\/+$/, ""),
    browsers: list(value("browsers") ?? env.SMOKE_BROWSERS ?? "chromium,webkit"),
    routes: value("routes") ?? env.SMOKE_ROUTES ? list(value("routes") ?? env.SMOKE_ROUTES) : DEFAULT_ROUTES,
    requireWebkit: flag("require-webkit") || env.SMOKE_REQUIRE_WEBKIT === "1",
    requireApply: flag("require-apply") || env.SMOKE_REQUIRE_APPLY === "1",
    skipApply: flag("skip-apply") || env.SMOKE_SKIP_APPLY === "1",
    json: value("json") ?? env.SMOKE_JSON ?? "",
    token: env.SMOKE_TEST_TOKEN ?? "",
    whyChars: Math.max(1, Number(env.SMOKE_WHY_CHARS ?? 7500) || 7500),
    timeoutMs: Math.max(5000, Number(env.SMOKE_TIMEOUT_MS ?? 30000) || 30000),
  };
}

/**
 * A long, ordinary answer: varied sentences, accents and one emoji, so a limit,
 * a column or an encoding that cannot hold a real person's words fails here.
 */
export function longAnswer(chars) {
  const sentences = [
    "I grew up two valleys over, where my grandmother kept bees and a seed library in a cedar chest.",
    "For eleven years I have coordinated volunteers for a watershed group, mostly on Saturdays and in the rain.",
    "María taught me to read a creek by its sound, and I still check the culverts after every storm.",
    "I keep careful notes, I answer messages within a day, and I say so early when I cannot do something.",
    "What draws me here is living near people who share the work of land, meals and children. 🌱",
    "I would bring a steady hand with schedules, a truck, and patience for long meetings that end in a decision.",
  ];
  let out = "";
  for (let i = 0; out.length < chars; i++) out += (out ? " " : "") + sentences[i % sentences.length];
  return out.slice(0, chars);
}

function loadPlaywright() {
  const here = createRequire(import.meta.url);
  if (process.env.PLAYWRIGHT_MODULE) {
    try {
      return here(path.resolve(process.env.PLAYWRIGHT_MODULE));
    } catch {
      return null;
    }
  }
  const from = [path.join(process.cwd(), "noop.js"), import.meta.url];
  try {
    from.push(path.join(execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(), "noop.js"));
  } catch {
    /* no npm on PATH */
  }
  for (const f of from) {
    try {
      return createRequire(f)("playwright");
    } catch {
      /* next */
    }
  }
  return null;
}

/** Render one page and return what went wrong on it, or [] when nothing did. */
async function checkPage(context, url, timeoutMs) {
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (err) => problems.push(`uncaught error: ${String(err?.message ?? err).split("\n")[0].slice(0, 300)}`));
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/client-crash") problems.push(`the page sent a crash report: ${(req.postData() ?? "").slice(0, 300)}`);
  });
  const started = Date.now();
  try {
    const res = await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
    if (!res) problems.push("no response");
    else if (res.status() >= 400) problems.push(`HTTP ${res.status()}`);
    await page.waitForLoadState("networkidle", { timeout: Math.min(15000, timeoutMs) }).catch(() => {});
    // Lazy pages draw after their chunk arrives; give them a moment beyond the network going quiet.
    await page.waitForTimeout(750);
    const body = (await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")) ?? "";
    if (CRASH_WORDS.some((w) => body.includes(w))) problems.push("the crash screen is showing");
    const drawn = await page.evaluate(() => (document.getElementById("root")?.childElementCount ?? document.body.childElementCount) > 0).catch(() => false);
    if (!drawn) problems.push("the page drew nothing");
  } catch (e) {
    problems.push(`did not load: ${String(e?.message ?? e).split("\n")[0].slice(0, 300)}`);
  }
  return { page, problems, ms: Date.now() - started };
}

/** The apply flow: the page, its form, and one TEST application sent from inside the page. */
async function checkApply(context, opts, engine) {
  const { page, problems, ms } = await checkPage(context, `${opts.baseUrl}/propose-a-role`, opts.timeoutMs);
  if (problems.length) {
    await page.close();
    return { status: "failed", detail: `the apply page: ${problems.join("; ")}`, ms };
  }
  const email = `release-${Date.now().toString(36)}-${engine}${SMOKE_DOMAIN}`;
  const outcome = await page.evaluate(
    async ({ email, why, header, token }) => {
      const form = await fetch("/api/open-proposals/form").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!form) return { status: "failed", detail: "the apply form did not load (/api/open-proposals/form)" };
      const roles = Array.isArray(form.roles) ? form.roles : [];
      // A role a plain application can take: no minimum commitment to answer, open now.
      const role = roles.find((r) => r && r.commitmentMin == null && !r.opensLater) ?? roles[0];
      if (!form.open || !role) return { status: "skipped", detail: form.open ? "the village offers no role to apply for" : "the apply form is closed" };
      const body = { name: "Release Smoke", email, roles: [{ roleId: role.id, note: "A release smoke test. Never a real application." }], why, aim: "Every page loads for every visitor, on every phone.", hp: "", locale: "en" };
      const res = await fetch("/api/open-proposals", { method: "POST", headers: { "content-type": "application/json", [header]: token }, body: JSON.stringify(body) });
      const answer = await res.json().catch(() => ({}));
      if (!res.ok) return { status: "failed", detail: `the application was refused (${res.status}${answer.field ? `, ${answer.field}` : ""}): ${String(answer.error ?? "").slice(0, 300)}` };
      if (answer.test !== true) return { status: "failed", detail: "the server took the smoke application as a REAL one: its SMOKE_TEST_TOKEN is unset or differs, so it was kept and a confirmation was attempted" };
      return { status: "passed", detail: `sent for ${role.name ?? role.id}, ${why.length} characters in the why, judged and discarded by the server` };
    },
    { email, why: longAnswer(opts.whyChars), header: SMOKE_HEADER, token: opts.token },
  );
  // An error the send itself raised in the page counts too.
  if (outcome.status === "passed" && problems.length) outcome.status = "failed";
  await page.close();
  return { ...outcome, ms };
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const opts = parseArgs(argv, env);
  const log = (s) => console.log(`browser-smoke: ${s}`);
  if (!/^https?:\/\//.test(opts.baseUrl)) {
    console.error("browser-smoke: give the deploy to test, --base-url https://... or SMOKE_BASE_URL.");
    return EXIT.usage;
  }
  try {
    const res = await fetch(`${opts.baseUrl}/health`, { signal: AbortSignal.timeout(15000) });
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error(`browser-smoke: ${opts.baseUrl}/health did not answer (${e?.message ?? e}).`);
    return EXIT.usage;
  }
  const pw = loadPlaywright();
  if (!pw) {
    console.error("browser-smoke: the playwright package is not installed. `npm i -g playwright` (or set PLAYWRIGHT_MODULE), then `npx playwright install --with-deps chromium webkit`.");
    return EXIT.missing;
  }

  const results = { baseUrl: opts.baseUrl, startedAt: new Date().toISOString(), engines: [], pages: [], apply: [] };
  let failed = false;
  let ran = 0;
  for (const engine of opts.browsers) {
    const type = pw[engine];
    if (!type) {
      console.error(`browser-smoke: unknown browser "${engine}" (chromium, webkit, firefox).`);
      return EXIT.usage;
    }
    let browser;
    try {
      browser = await type.launch();
    } catch (e) {
      const why = String(e?.message ?? e).split("\n")[0];
      if (engine === "webkit" && !opts.requireWebkit) {
        log(`webkit: SKIPPED, it would not launch here (${why}). Install it with \`npx playwright install --with-deps webkit\`; CI passes --require-webkit.`);
        results.engines.push({ engine, status: "skipped", why });
        continue;
      }
      console.error(`browser-smoke: ${engine} would not launch (${why}).`);
      results.engines.push({ engine, status: "missing", why });
      writeJson(opts.json, results);
      return EXIT.missing;
    }
    ran++;
    const profile = engine === "webkit" ? { ...pw.devices["iPhone 14"] } : { viewport: { width: 1280, height: 800 } };
    const label = engine === "webkit" ? `webkit (iPhone 14, WebKit ${browser.version()})` : `${engine} ${browser.version()}`;
    results.engines.push({ engine, status: "ran", version: browser.version() });
    log(`${label}: ${opts.routes.length} page(s)`);
    for (const route of opts.routes) {
      const context = await browser.newContext(profile);
      const { page, problems, ms } = await checkPage(context, `${opts.baseUrl}${route}`, opts.timeoutMs);
      await page.close();
      await context.close();
      results.pages.push({ engine, route, ok: problems.length === 0, problems, ms });
      if (problems.length) {
        failed = true;
        log(`FAIL ${engine} ${route}: ${problems.join("; ")}`);
      } else {
        log(`ok   ${engine} ${route} (${ms} ms)`);
      }
    }
    if (opts.skipApply) {
      log(`apply (${engine}): skipped, --skip-apply`);
    } else if (!opts.token) {
      const line = `apply (${engine}): ${opts.requireApply ? "FAIL" : "skipped"}, SMOKE_TEST_TOKEN is not set here, so no test application can be sent`;
      log(line);
      results.apply.push({ engine, status: opts.requireApply ? "failed" : "skipped", detail: line });
      if (opts.requireApply) failed = true;
    } else {
      const context = await browser.newContext(profile);
      const a = await checkApply(context, opts, engine);
      await context.close();
      if (a.status === "skipped" && opts.requireApply) a.status = "failed";
      results.apply.push({ engine, ...a });
      if (a.status === "failed") failed = true;
      log(`apply (${engine}): ${a.status === "passed" ? "ok" : a.status.toUpperCase()}, ${a.detail}`);
    }
    await browser.close();
  }
  if (ran === 0) {
    console.error("browser-smoke: no browser ran.");
    writeJson(opts.json, results);
    return EXIT.missing;
  }
  results.finishedAt = new Date().toISOString();
  writeJson(opts.json, results);
  const bad = results.pages.filter((p) => !p.ok).length;
  log(`${results.pages.length - bad} of ${results.pages.length} page renders clean; apply: ${results.apply.map((a) => `${a.engine} ${a.status}`).join(", ") || "not run"}.`);
  return failed ? EXIT.failed : EXIT.ok;
}

function writeJson(file, results) {
  if (file) fs.writeFileSync(file, JSON.stringify(results, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("browser-smoke.mjs")) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error("browser-smoke: crashed", e);
      process.exit(EXIT.failed);
    },
  );
}
