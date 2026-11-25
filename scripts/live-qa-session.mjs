#!/usr/bin/env node
/**
 * THE LIVE QA PROBE (the lead, 25 Nov 2026): look at the live game past the
 * entrance, signed in as yourself, for reading only.
 *
 *   LIVE_QA_URL=https://your-village.example LIVE_QA_TOKEN=... \
 *     node scripts/live-qa-session.mjs / /roles /circles --out ./live-qa
 *
 * WHAT IT NEEDS. Your own `live.view` token (Profile, Your agent, Mint a token,
 * offered only while your seat carries the live view for QA). Keep it in your
 * own secrets store and let it reach this script as LIVE_QA_TOKEN, for example
 * `infisical run -- node scripts/live-qa-session.mjs /roles`. The script
 * refuses to run without it, never prints it, and never writes it to a file.
 * There is no shared pass anywhere in this path.
 *
 * WHAT IT DOES.
 *   1. Asks the server who the token is (GET /api/me/profile) and stops unless
 *      the answer is a signed-in member AND the response is marked
 *      `X-Live-View: read-only`, which proves the server is treating the
 *      token as a read-only live view.
 *   2. Opens Chromium with the token in the slot the app keeps its sign-in
 *      in, so every page loads as you, past the entrance. It also puts the
 *      token on every read of the village's own /api/, because some of the
 *      app's reads use a bare fetch that never attaches the stored sign-in,
 *      and without it those reads meet the entrance (401) and the page draws
 *      with parts missing. The page itself is loaded without it: the server
 *      answers a page request carrying an agent token with 401.
 *   3. Visits each path, saves a full-page screenshot, and reports what went
 *      wrong: uncaught errors, console errors, failed API reads, and every
 *      write the page tried (a page that writes on load is worth knowing
 *      about).
 *
 * WHAT IT CANNOT DO. Change anything. Every request to the village other than
 * a read is stopped in the browser before it leaves, and reported. The server
 * refuses them too (server/lib/liveView.ts), whatever the token's holder may
 * do signed in by hand.
 *
 * WHEN THE TOKEN IS A NETWORK SECRET (whole-app QA, 25 Nov 2026). A cloud
 * session can hold the token as a secret its egress proxy adds to every request
 * for the village's host, so no process in the session ever sees it. Pass
 * --proxy-auth (or LIVE_QA_PROXY_AUTH=1) and the script reads no token at all.
 * It checks the live view from INSIDE the browser it will crawl with, because
 * that is the path the proxy has to cover: a page on the village asks
 * /api/me/profile with no Authorization of its own, and the run goes on only
 * for a signed-in answer marked `X-Live-View: read-only`. Then it asks once more
 * with a placeholder bearer. If the proxy puts the real token in place of it,
 * the placeholder goes into the app's sign-in slot so pages draw as a member
 * (the client reads that slot to decide it is signed in); if not, the run says
 * so and goes on, and parts the client draws only for a signed-in reader will
 * look signed out. The placeholder is not a credential: the server refuses it.
 *
 * Options (flag, or env):
 *   --url <origin>        LIVE_QA_URL        the village's game site (required)
 *   --out <dir>           LIVE_QA_OUT        where screenshots go (default ./live-qa-out)
 *   --phone                                  draw at iPhone 13 size as well as desktop
 *   --proxy-auth          LIVE_QA_PROXY_AUTH=1  the token is a network secret the proxy adds; read none
 *   --admin               LIVE_QA_ADMIN=1    read Admin through a live.view.admin token (see ADMIN MODE below)
 *   --json                                   print the report as JSON
 *   PLAYWRIGHT_MODULE                        a path to the playwright package, when not resolvable
 *
 * ADMIN MODE (--admin; the lead's second pass over Admin, 25 Nov 2026). A `live.view.admin` token reads Admin as its
 * holder's own admin access, still read-only, and the server marks every answer `X-Live-View: read-only; admin`
 * (server/lib/liveView.ts). The mode is chosen on purpose, both ways: without --admin the run needs the member mark and
 * refuses an admin token, and with it the run needs the admin mark and refuses a member token, so an admin crawl never
 * starts by accident. Admin pages carry people's names, addresses, answers and money, so in admin mode every
 * screenshot is taken with the page's text in tables, fields, lists and paragraphs blurred (ADMIN_MASK_CSS): headings,
 * tabs and buttons stay legible for a layout review, and no person's details land in a file.
 *
 * Exit codes: 0 every page drew clean, 1 a page had problems, 2 it could not start.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

/** The localStorage key the app keeps its sign-in under (TOKEN_KEY, client/src/lib/gameApi.ts). */
export const TOKEN_KEY = "village-auth-token";
/** The header the server sets on every read it served as a live view. */
export const LIVE_VIEW_HEADER = "x-live-view";
/** The mark the server sets on a member live view's reads, and on the admin live view's. */
export const MEMBER_VIEW_MARK = "read-only";
export const ADMIN_VIEW_MARK = "read-only; admin";

/**
 * What an admin-mode screenshot blurs: the page's own text where people's details live. Headings, tabs, buttons and
 * labels stay sharp, so the layout can still be judged.
 */
export const ADMIN_MASK_CSS = [
  "main td, main dd, main li, main p, main input, main textarea, main select, main [contenteditable],",
  "main a:not([role=tab]):not(nav a), main [data-person], main img:not([aria-hidden=true]),",
  // The holder's own name on the account button, in Admin's header and the site's.
  "button[aria-label^='Your settings'], button[aria-label^='Your account']",
  "{ filter: blur(6px) !important; }",
].join(" ");
/** What the admin live view answers a read it never makes: exports, downloads, secrets, tokens (server/lib/liveViewAdmin.ts). */
export const ADMIN_REFUSED_ERROR = "live_view_admin_refused";
/** The refusal a write meets. */
export const READ_ONLY_ERROR = "live_view_read_only";
/** Put in the sign-in slot under --proxy-auth when the proxy replaces it with the real token. Not a credential. */
export const PROXY_PLACEHOLDER = "vat_live_view_by_proxy";

export function parseArgs(argv, env = process.env) {
  const paths = [];
  const opts = { url: env.LIVE_QA_URL ?? "", out: env.LIVE_QA_OUT ?? "live-qa-out", phone: false, json: false, proxyAuth: env.LIVE_QA_PROXY_AUTH === "1", admin: env.LIVE_QA_ADMIN === "1" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") opts.url = argv[++i] ?? "";
    else if (a === "--out") opts.out = argv[++i] ?? opts.out;
    else if (a === "--phone") opts.phone = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--proxy-auth") opts.proxyAuth = true;
    else if (a === "--admin") opts.admin = true;
    else if (a.startsWith("/")) paths.push(a);
    else throw new Error(`Unknown argument: ${a}. Paths start with a slash.`);
  }
  opts.url = opts.url.replace(/\/+$/, "");
  opts.paths = paths.length ? paths : ["/"];
  return opts;
}

/** Why this run cannot start, or null. The token is read here and nowhere else. */
export function startProblem(opts, env = process.env) {
  if (opts.proxyAuth) {
    if (!/^https?:\/\/[^/]+$/.test(opts.url)) return "Say which village to look at: --url https://your-village.example, or LIVE_QA_URL.";
    return null;
  }
  const token = String(env.LIVE_QA_TOKEN ?? "").trim();
  if (!token) return "LIVE_QA_TOKEN is not set. Mint a live.view token on your own profile (Your agent), keep it in your own secrets store, and run this through it, for example `infisical run -- node scripts/live-qa-session.mjs`.";
  if (!token.startsWith("vat_")) return "LIVE_QA_TOKEN does not look like a personal token (they start vat_). Check you copied the whole value.";
  if (!/^https?:\/\/[^/]+$/.test(opts.url)) return "Say which village to look at: --url https://your-village.example, or LIVE_QA_URL.";
  return null;
}

/** Ask the server who this token is. Resolves to the member, or throws a sentence. */
export async function whoAmI(origin, token, fetchImpl = fetch, { admin = false } = {}) {
  // A null token sends no Authorization at all: under --proxy-auth the proxy supplies it.
  const headers = token ? { authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" };
  const res = await fetchImpl(`${origin}/api/me/profile`, { headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  if (res.status !== 200) {
    const why = body?.error ? `${body.error}${body.message ? `: ${body.message}` : ""}` : `status ${res.status}`;
    throw new Error(`The server refused the token (${why}). A token ends when it expires, when you revoke it, when your password changes, and when your seat no longer carries the live view.`);
  }
  const mark = String(res.headers.get(LIVE_VIEW_HEADER) ?? "");
  if (mark === ADMIN_VIEW_MARK && !admin) {
    throw new Error("This token reads Admin (live.view.admin). Run with --admin if that is what you mean to do; without it the run only takes a member live view.");
  }
  if (mark === MEMBER_VIEW_MARK && admin) {
    throw new Error("This is the member live view. --admin needs a live.view.admin token, minted on its own by an admin who holds the QA seat.");
  }
  if (mark !== (admin ? ADMIN_VIEW_MARK : MEMBER_VIEW_MARK)) {
    throw new Error("The server did not mark this as a read-only live view. Either it runs a release from before the live view, or this token is not a live.view token. Stopping, so nothing can write.");
  }
  if (!body || typeof body !== "object") throw new Error("The server answered without a profile. Stopping.");
  return body;
}

/**
 * A fetch that runs inside a page of the village, so it takes the browser's own
 * network path (and its proxy). Answers with the little of a Response whoAmI reads.
 */
export function pageFetch(page) {
  return async (url, init = {}) => {
    const r = await page.evaluate(async ([u, h]) => {
      const res = await fetch(u, { headers: h, credentials: "omit" });
      return { status: res.status, live: res.headers.get("x-live-view"), text: await res.text() };
    }, [url, init.headers ?? {}]);
    return {
      status: r.status,
      headers: { get: (k) => (String(k).toLowerCase() === LIVE_VIEW_HEADER ? r.live : null) },
      json: async () => JSON.parse(r.text),
    };
  };
}

function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return createRequire(import.meta.url)(path.resolve(process.env.PLAYWRIGHT_MODULE));
  for (const from of [path.join(process.cwd(), "noop.js"), import.meta.url]) {
    try {
      return createRequire(from)("playwright");
    } catch {
      /* next */
    }
  }
  return null;
}

/**
 * The browser's rule for every request to the village: a read of /api/ carries
 * the token (when this run holds one; under --proxy-auth the proxy adds it), any other read goes as it is, and anything that is not a read is
 * written down in `stopped` and never leaves. Requests to other origins are not
 * touched and never see the token.
 */
export function readOnlyRoute(origin, token, stopped) {
  return (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.origin !== origin) return route.continue();
    const method = req.method();
    if (method !== "GET" && method !== "HEAD") {
      stopped.push(`${method} ${u.pathname}`);
      return route.abort();
    }
    if (token && u.pathname.startsWith("/api/")) return route.continue({ headers: { ...req.headers(), authorization: `Bearer ${token}` } });
    return route.continue();
  };
}

/** Whether a failed load is one of the writes this script stopped. */
export function stoppedHere(stopped, url) {
  if (!url) return false;
  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }
  return stopped.some((w) => w.slice(w.indexOf(" ") + 1) === pathname);
}

async function drawOne(context, origin, p, file, token, { admin = false } = {}) {
  const page = await context.newPage();
  const problems = [];
  const refusedWrites = [];
  // In admin mode the server refuses a few reads on purpose (exports, secrets, tokens). They are reported on their
  // own line, never as the page's problem, and neither is the failed load the browser logs for each.
  const byDesign = new Set();
  const loadErrors = [];
  await page.route(`${origin}/**`, readOnlyRoute(origin, token, refusedWrites));
  page.on("pageerror", (err) => problems.push(`uncaught error: ${String(err?.message ?? err).split("\n")[0].slice(0, 300)}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // A write this script stopped shows up as a failed load too; it is reported once, as a write.
    if (m.text().includes("net::ERR_FAILED") && stoppedHere(refusedWrites, m.location()?.url)) return;
    if (admin && m.text().includes("status of 403")) return void loadErrors.push({ text: m.text(), url: m.location()?.url });
    problems.push(`console error: ${m.text().slice(0, 300)}`);
  });
  page.on("response", async (r) => {
    const u = new URL(r.url());
    if (u.origin !== origin || !u.pathname.startsWith("/api/")) return;
    const method = r.request().method();
    if (r.status() >= 500) problems.push(`${method} ${u.pathname} answered ${r.status()}`);
    else if ((r.status() === 401 || r.status() === 403) && method === "GET") {
      const body = admin && r.status() === 403 ? await r.json().catch(() => null) : null;
      if (body?.error === ADMIN_REFUSED_ERROR) byDesign.add(u.pathname);
      else problems.push(`${method} ${u.pathname} refused (${r.status()})`);
    }
  });
  let status = 0;
  try {
    const res = await page.goto(origin + p, { waitUntil: "networkidle", timeout: 45_000 });
    status = res?.status() ?? 0;
    // Admin pages carry people's details: blur them before anything is saved (ADMIN MODE above).
    if (admin) await page.addStyleTag({ content: ADMIN_MASK_CSS });
    await page.screenshot({ path: file, fullPage: true });
  } catch (e) {
    problems.push(`did not load: ${String(e?.message ?? e).split("\n")[0].slice(0, 300)}`);
  }
  await page.close();
  for (const e of loadErrors) if (!stoppedHere([...byDesign].map((x) => `GET ${x}`), e.url)) problems.push(`console error: ${e.text.slice(0, 300)}`);
  return { path: p, status, screenshot: file, problems, refusedWrites, refusedByDesign: [...byDesign] };
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  let opts;
  try {
    opts = parseArgs(argv, env);
  } catch (e) {
    console.error(`live-qa: ${e.message}`);
    return 2;
  }
  const problem = startProblem(opts, env);
  if (problem) {
    console.error(`live-qa: ${problem}`);
    return 2;
  }
  const pw = loadPlaywright();
  if (!pw) {
    console.error("live-qa: the playwright package is not installed here. Run it from a Village OS checkout after pnpm install, or set PLAYWRIGHT_MODULE.");
    return 2;
  }
  let token = opts.proxyAuth ? null : String(env.LIVE_QA_TOKEN).trim();
  let me;
  const browser = await pw.chromium.launch();
  if (opts.proxyAuth) {
    // Check the live view on the path the crawl will use: a page of the village, in this browser.
    const probe = await browser.newContext();
    const page = await probe.newPage();
    try {
      await page.goto(`${opts.url}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      me = await whoAmI(opts.url, null, pageFetch(page), { admin: opts.admin });
    } catch (e) {
      await browser.close();
      console.error(`live-qa: --proxy-auth: ${e.message} With --proxy-auth that usually means the network secret did not reach this browser (no secret for this host, or the session started before it was saved).`);
      return 2;
    }
    try {
      await whoAmI(opts.url, PROXY_PLACEHOLDER, pageFetch(page), { admin: opts.admin });
      token = PROXY_PLACEHOLDER;
    } catch {
      console.error("live-qa: --proxy-auth: the proxy adds the token but does not replace an Authorization the page sends, so the app's sign-in slot stays empty. Pages are read as you by the server, and anything the client draws only for a signed-in reader will look signed out.");
    }
    await probe.close();
  } else {
    try {
      me = await whoAmI(opts.url, token, fetch, { admin: opts.admin });
    } catch (e) {
      await browser.close();
      console.error(`live-qa: ${e.message}`);
      return 2;
    }
  }
  fs.mkdirSync(opts.out, { recursive: true });
  const report = { origin: opts.url, as: String(me.displayName ?? me.firstName ?? me.name ?? "the token's holder"), admin: opts.admin, pages: [] };
  try {
    const shapes = [["desktop", { viewport: { width: 1280, height: 900 } }]];
    if (opts.phone) shapes.push(["phone", { ...pw.devices["iPhone 13"] }]);
    for (const [label, shape] of shapes) {
      const context = await browser.newContext(shape);
      // The sign-in, where the app reads it. Set before any page script runs, never logged.
      if (token) await context.addInitScript(([k, v]) => { try { window.localStorage.setItem(k, v); } catch { /* storage closed */ } }, [TOKEN_KEY, token]);
      for (const p of opts.paths) {
        const name = `${label}${p === "/" ? "-home" : p.replace(/[^A-Za-z0-9]+/g, "-")}.png`;
        report.pages.push({ shape: label, ...(await drawOne(context, opts.url, p, path.join(opts.out, name), token, { admin: opts.admin })) });
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  const bad = report.pages.filter((r) => r.problems.length || !r.status || r.status >= 400);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`live-qa: ${report.pages.length} page(s) on ${report.origin}, read-only${opts.admin ? ", admin view, screenshots masked" : ""}, as ${report.as}`);
    for (const r of report.pages) {
      const mark = r.problems.length || !r.status || r.status >= 400 ? "PROBLEM" : "ok";
      console.log(`  ${mark.padEnd(7)} ${r.shape.padEnd(7)} ${r.path}  (${r.status || "no answer"})  ${r.screenshot}`);
      for (const p of r.problems) console.log(`          ${p}`);
      for (const w of r.refusedWrites) console.log(`          the page tried a write, stopped before it left: ${w}`);
      for (const d of r.refusedByDesign ?? []) console.log(`          refused by design in the admin view: GET ${d}`);
    }
  }
  return bad.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then((code) => process.exit(code), (e) => {
    console.error(`live-qa: ${e?.message ?? e}`);
    process.exit(2);
  });
}
