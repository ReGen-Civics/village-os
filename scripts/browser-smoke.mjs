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
 *  - a role's own page on an iPhone 13 in each engine: its Apply whole on the
 *    first screen, and the element at its centre and corners the button
 *    itself, so the phone's tab bar is not over it;
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
 *                           SMOKE_ENTRANCE_PASS the village's entrance pass (Admin, Integrations): every
 *                                               page is drawn past the portal entrance, as our own
 *                                               automation sees it, and nothing is recorded as a visitor
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
    entrancePass: env.SMOKE_ENTRANCE_PASS ?? "",
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
  // A built file the page asks for and the server does not have: a preload naming a chunk the build never wrote
  // (route-preload.js listed /assets/motion-*.js on every page, 24 Nov 2026), or a stale reference after a deploy.
  page.on("response", (res) => {
    const u = new URL(res.url());
    if (u.origin === new URL(url).origin && u.pathname.startsWith("/assets/") && res.status() >= 400) problems.push(`a built file is missing: HTTP ${res.status()} ${u.pathname}`);
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

/**
 * The portal entrance (shared/entrance.ts), passed the way a visitor passes it: the entrance draws in
 * front of /roles, and the visitor sends their name and an address. The smoke's address is the
 * reserved `.invalid` one and carries the smoke header, so the server keeps the entry as a TEST that
 * no list shows, and skips the human check a script cannot pass. The cookie it sets lives in this
 * browser context, so every later page in the context is past the entrance. A village that keeps
 * no entrance answers "none" and nothing is sent.
 */
export async function enterPortal(context, opts, engine) {
  // Carrying the village's pass, the smoke is our own automation: there is no entrance to walk.
  if (opts.entrancePass) return { status: "none", detail: "passed by the entrance pass header" };
  const page = await context.newPage();
  try {
    await page.goto(`${opts.baseUrl}/roles`, { waitUntil: "load", timeout: opts.timeoutMs });
    const read = await page.evaluate(() => fetch("/api/entrance").then(async (r) => ({ code: r.status, body: r.ok ? await r.json() : null })).catch(() => null));
    // A deploy from before the entrance has no such route, and so no entrance.
    if (read?.code === 404) return { status: "none", detail: "this deploy has no entrance" };
    const status = read?.body;
    if (!status) return { status: "failed", detail: "the entrance did not answer (/api/entrance)" };
    if (!status.required || status.entered) return { status: "none", detail: "the village keeps no entrance" };
    const drawn = await page.waitForSelector("[data-entrance] form", { state: "visible", timeout: Math.min(15000, opts.timeoutMs) }).then(() => true, () => false);
    if (!drawn) return { status: "failed", detail: "/roles drew no entrance for a visitor, while the village keeps one" };
    if (!opts.token) return { status: "failed", detail: "the village keeps an entrance and SMOKE_TEST_TOKEN is not set here, so the smoke cannot pass it as a test" };
    const email = `entrance-${Date.now().toString(36)}-${engine}${SMOKE_DOMAIN}`;
    const answer = await page.evaluate(
      async ({ email, header, token }) => {
        const res = await fetch("/api/entrance", { method: "POST", headers: { "content-type": "application/json", [header]: token }, body: JSON.stringify({ name: "Release Smoke", email, next: "/roles", locale: "en", website: "", shownAt: Date.now() - 10000 }) });
        return { status: res.status, body: await res.json().catch(() => ({})) };
      },
      { email, header: SMOKE_HEADER, token: opts.token },
    );
    if (answer.status !== 201) return { status: "failed", detail: `the entrance refused the smoke (${answer.status}): ${String(answer.body?.message ?? answer.body?.error ?? "").slice(0, 300)}` };
    if (answer.body?.next !== "/roles") return { status: "failed", detail: `the entrance would send the smoke to ${JSON.stringify(answer.body?.next)}, not back to /roles` };
    const after = await page.evaluate(() => fetch("/api/entrance").then((r) => (r.ok ? r.json() : null)).catch(() => null));
    if (!after?.entered) return { status: "failed", detail: "the entrance took the smoke and the device is still outside: the cookie did not hold" };
    // The keep-in-touch step, its own screen after the entry. A smoke answers No, so it never reaches a list.
    const kept = await page.evaluate(() => fetch("/api/entrance/updates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answer: "no", words: "release smoke" }) }).then((r) => r.status).catch(() => 0));
    // A deploy from before the step has no such route; anything else must take the answer.
    if (kept !== 200 && kept !== 404) return { status: "failed", detail: `the keep-in-touch step refused the smoke's answer (${kept})` };
    return { status: "passed", detail: "drew in front of /roles, let the smoke through, took its answer, and would send it back to /roles" };
  } catch (e) {
    return { status: "failed", detail: `the entrance did not load: ${String(e?.message ?? e).split("\n")[0].slice(0, 300)}` };
  } finally {
    await page.close();
  }
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

/** The phone the role page's Apply is measured on: 390x664 of page under Safari's own chrome, as the lead's iPhone 13. */
export const PHONE = "iPhone 13";

/**
 * Where a role page's Apply sits, read inside the page: its box, the screen, and what the browser would hit at the
 * button's centre and at each of its corners. `elementFromPoint` is the honest test for "nothing covers it": the
 * phone's fixed tab bar, a sticky bar or a toast over the button is what it returns, where the box alone says "on the
 * screen".
 */
export function applyBoxProblems(m) {
  if (!m) return ["no Apply was drawn"];
  const out = [];
  const box = `top ${m.top}, bottom ${m.bottom}, left ${m.left}, right ${m.right} in a ${m.vw}x${m.vh} screen`;
  if (m.top < 0 || m.left < 0 || m.bottom > m.vh || m.right > m.vw) out.push(`the Apply is not whole on the first screen (${box})`);
  if (m.covered) out.push(`something covers the Apply: ${m.hit || "nothing at all"} (${box})`);
  if (m.inBar) out.push("the Apply on the first screen is the bar along the foot, so the act in the flow is off the first screen");
  return out;
}

/**
 * A role's own page on a phone (the lead, after 1.3.42): Apply whole on the first screen and nothing over it. 1.3.42
 * drew it under the one-minute goal with its top edge at 606 of 664, behind the tab bar, and a box check alone that
 * ignored the tab bar passed it. It tries the roles the apply form offers, by id (/roles/<id> is a role's address too,
 * shared/roleSlug.ts), and measures the first one whose page offers Apply.
 */
/**
 * Measure the first Apply a reader can press, inside the page: its box, the screen, and what the browser hits at its
 * centre and corners. `scope` is a selector to look inside (one role's card on /roles), or null for the whole page
 * scrolled to the top (a role's own page).
 */
function measureApply(page, scope = null) {
  return page.evaluate((scope) => {
    if (scope === null) window.scrollTo(0, 0);
    const root = scope ? document.querySelector(scope) : document;
    if (!root) return null;
    const el = Array.from(root.querySelectorAll("[data-apply-role]")).find((e) => !e.closest("[inert]") && !e.closest("[hidden]") && e.getClientRects().length > 0);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const name = (n) => (n ? `<${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ""}${n.getAttribute("class") ? ` class="${String(n.getAttribute("class")).slice(0, 80)}"` : ""}>` : "");
    const r = (x) => Math.round(x);
    // The centre, and each corner two pixels in: a tab bar over the button's lower edge leaves the centre clear.
    const points = [
      ["centre", b.left + b.width / 2, b.top + b.height / 2],
      ["top left", b.left + 2, b.top + 2],
      ["top right", b.right - 2, b.top + 2],
      ["bottom left", b.left + 2, b.bottom - 2],
      ["bottom right", b.right - 2, b.bottom - 2],
    ];
    let covered = false;
    let hit = "";
    for (const [where, x, y] of points) {
      const n = document.elementFromPoint(x, y);
      if (n && (n === el || el.contains(n))) continue;
      covered = true;
      const bar = n?.closest("nav, [role=navigation]");
      hit = `${name(n) || "nothing"}${bar && bar !== n ? ` inside ${name(bar)}${bar.getAttribute("aria-label") ? ` "${bar.getAttribute("aria-label")}"` : ""}` : ""} at its ${where}`;
      break;
    }
    return { top: r(b.top), bottom: r(b.bottom), left: r(b.left), right: r(b.right), vw: window.innerWidth, vh: window.innerHeight, covered, hit, inBar: !!el.closest("[data-phone-apply-bar]") };
  }, scope);
}

async function checkRoleApply(context, opts) {
  const { page, problems, ms } = await checkPage(context, `${opts.baseUrl}/roles`, opts.timeoutMs);
  try {
    if (problems.length) return { status: "failed", detail: `the roles page: ${problems.join("; ")}`, ms };
    const ids = await page.evaluate(async () => {
      const form = await fetch("/api/open-proposals/form").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      return (Array.isArray(form?.roles) ? form.roles : []).map((r) => (r && typeof r.id === "string" ? r.id : "")).filter(Boolean).slice(0, 4);
    });
    if (!ids.length) return { status: "skipped", detail: "the village offers no role to apply for", ms };
    for (const id of ids) {
      const route = `/roles/${encodeURIComponent(id)}`;
      await page.goto(`${opts.baseUrl}${route}`, { waitUntil: "load", timeout: opts.timeoutMs });
      const shown = await page.waitForSelector("[data-apply-role]", { state: "visible", timeout: Math.min(15000, opts.timeoutMs) }).then(() => true, () => false);
      if (!shown) continue;
      // The card's words arrive after it mounts, and the bar decides on the next frame.
      await page.waitForLoadState("networkidle", { timeout: Math.min(15000, opts.timeoutMs) }).catch(() => {});
      await page.waitForTimeout(750);
      const m = await measureApply(page);
      const bad = [...problems, ...applyBoxProblems(m)];
      if (bad.length) return { status: "failed", detail: `${route}: ${bad.join("; ")}`, box: m, ms };
      return { status: "passed", detail: `${route}: Apply whole at ${m.top} to ${m.bottom} of ${m.vh}, nothing over it`, box: m, ms };
    }
    return { status: "failed", detail: `none of ${ids.length} role page(s) drew an Apply (${ids.join(", ")})`, ms };
  } catch (e) {
    return { status: "failed", detail: `the role page did not load: ${String(e?.message ?? e).split("\n")[0].slice(0, 300)}`, ms };
  } finally {
    await page.close();
  }
}

/**
 * /roles itself on a phone (the lead, 21 Nov 2026: the full role cards are back on /roles). The first founding role's
 * "Read the card" opens its full card inside its own frame and brings it into view; that card's Apply must then be
 * whole on the screen with nothing over it, as on the role's own page.
 */
async function checkRolesListApply(context, opts) {
  const { page, problems, ms } = await checkPage(context, `${opts.baseUrl}/roles`, opts.timeoutMs);
  try {
    if (problems.length) return { status: "failed", detail: `the roles page: ${problems.join("; ")}`, ms };
    const open = page.locator("[data-founding-role]").first();
    if ((await open.count()) === 0) return { status: "skipped", detail: "the village features no founding role on /roles", ms };
    const id = await open.getAttribute("data-founding-role");
    await open.click();
    const scope = `[data-role-frame="${id}"] [data-full-role-card]`;
    const shown = await page.waitForSelector(`${scope} [data-apply-role]`, { state: "visible", timeout: Math.min(15000, opts.timeoutMs) }).then(() => true, () => false);
    if (!shown) return { status: "failed", detail: `/roles: the card opened from "${id}" drew no Apply inside its frame`, ms };
    // The page scrolls the opened card into view; let that and the bar's next frame settle.
    await page.waitForLoadState("networkidle", { timeout: Math.min(15000, opts.timeoutMs) }).catch(() => {});
    await page.waitForTimeout(1200);
    const m = await measureApply(page, scope);
    const bad = [...problems, ...applyBoxProblems(m)];
    if (bad.length) return { status: "failed", detail: `/roles, ${id}: ${bad.join("; ")}`, box: m, ms };
    return { status: "passed", detail: `/roles, ${id}: Apply whole at ${m.top} to ${m.bottom} of ${m.vh} in its opened card, nothing over it`, box: m, ms };
  } catch (e) {
    return { status: "failed", detail: `/roles did not open a card: ${String(e?.message ?? e).split("\n")[0].slice(0, 300)}`, ms };
  } finally {
    await page.close();
  }
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

  const results = { baseUrl: opts.baseUrl, startedAt: new Date().toISOString(), engines: [], pages: [], entrance: [], apply: [], rolePage: [] };
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
    const passHeaders = opts.entrancePass ? { extraHTTPHeaders: { "x-entrance-pass": opts.entrancePass } } : {};
    const profile = engine === "webkit" ? { ...pw.devices["iPhone 14"], ...passHeaders } : { viewport: { width: 1280, height: 800 }, ...passHeaders };
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
    // Every apply context passes the portal entrance first, when the village keeps one.
    const through = async (context, what) => {
      const e = await enterPortal(context, opts, engine);
      if (e.status === "none") return true;
      results.entrance.push({ engine, for: what, ...e });
      log(`entrance (${engine}, ${what}): ${e.status === "passed" ? "ok" : e.status.toUpperCase()}, ${e.detail}`);
      if (e.status !== "passed") failed = true;
      return e.status === "passed";
    };
    if (opts.skipApply) {
      log(`apply (${engine}): skipped, --skip-apply`);
    } else if (!opts.token) {
      const line = `apply (${engine}): ${opts.requireApply ? "FAIL" : "skipped"}, SMOKE_TEST_TOKEN is not set here, so no test application can be sent`;
      log(line);
      results.apply.push({ engine, status: opts.requireApply ? "failed" : "skipped", detail: line });
      if (opts.requireApply) failed = true;
    } else {
      const context = await browser.newContext(profile);
      await through(context, "apply");
      const a = await checkApply(context, opts, engine);
      await context.close();
      if (a.status === "skipped" && opts.requireApply) a.status = "failed";
      results.apply.push({ engine, ...a });
      if (a.status === "failed") failed = true;
      log(`apply (${engine}): ${a.status === "passed" ? "ok" : a.status.toUpperCase()}, ${a.detail}`);
    }
    if (!opts.skipApply) {
      // In this engine on the phone either way, so WebKit and Chromium each measure the same 390x664 screen.
      const { defaultBrowserType: _ignored, ...phoneBare } = pw.devices[PHONE] ?? {};
      const phone = { ...phoneBare, ...passHeaders };
      const context = await browser.newContext(phone);
      await through(context, "role page");
      const r = await checkRoleApply(context, opts);
      await context.close();
      if (r.status === "skipped" && opts.requireApply) r.status = "failed";
      results.rolePage.push({ engine, device: PHONE, ...r });
      if (r.status === "failed") failed = true;
      log(`role page Apply (${engine}, ${PHONE}): ${r.status === "passed" ? "ok" : r.status.toUpperCase()}, ${r.detail}`);
      // The same Apply inside a card opened on /roles. A village with no founding team skips it, never fails it.
      const listContext = await browser.newContext(phone);
      await through(listContext, "/roles card");
      const l = await checkRolesListApply(listContext, opts);
      await listContext.close();
      results.rolePage.push({ engine, device: PHONE, page: "/roles", ...l });
      if (l.status === "failed") failed = true;
      log(`/roles card Apply (${engine}, ${PHONE}): ${l.status === "passed" ? "ok" : l.status.toUpperCase()}, ${l.detail}`);
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
  log(`${results.pages.length - bad} of ${results.pages.length} page renders clean; apply: ${results.apply.map((a) => `${a.engine} ${a.status}`).join(", ") || "not run"}; role page Apply: ${results.rolePage.map((a) => `${a.engine} ${a.status}`).join(", ") || "not run"}.`);
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
