/**
 * The browser smoke's own fixture suite (node scripts/browser-smoke.test.mjs).
 *
 * A smoke nobody has watched fail reports green either way. The first cases
 * need nothing installed: the option parsing, the long answer, and the exit
 * codes for a bad URL and for a missing Playwright. When Playwright and
 * Chromium are present (CI's browser-smoke job installs them, or set
 * PLAYWRIGHT_MODULE), it also serves a tiny site and proves the smoke FAILS a
 * page that throws, a page showing the crash screen and a page that draws
 * nothing, and PASSES a page that renders.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { DEFAULT_ROUTES, longAnswer, parseArgs } from "./browser-smoke.mjs";

const SMOKE = path.resolve(import.meta.dirname, "browser-smoke.mjs");
let checks = 0;
let failures = 0;
function expect(name, cond, detail = "") {
  checks++;
  if (cond) return;
  failures++;
  console.error(`FAIL ${name}\n${detail}\n`);
}

const o = parseArgs(["--base-url", "https://staging.example/", "--browsers", "webkit", "--require-apply"], { SMOKE_TEST_TOKEN: "t", SMOKE_WHY_CHARS: "3600" });
expect("parses the options", o.baseUrl === "https://staging.example" && o.browsers.join() === "webkit" && o.requireApply && o.token === "t" && o.whyChars === 3600, JSON.stringify(o));
const d = parseArgs([], {});
expect("defaults to both engines, every key route and a 7500-character why", d.browsers.join() === "chromium,webkit" && d.routes === DEFAULT_ROUTES && d.whyChars === 7500 && DEFAULT_ROUTES.includes("/propose-a-role"), JSON.stringify(d));
const a = longAnswer(7500);
expect("the long answer is exactly as long as asked and reads like a person", a.length === 7500 && /María/.test(a) && a.split(". ").length > 40);

/** Async on purpose: the fixture site below is served from this same process, so a blocking spawn would starve it. */
function run(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SMOKE, ...args], { env: { ...process.env, ...env } });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => child.kill(), 300_000);
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, out });
    });
  });
}

expect("no URL is a usage error (2)", (await run([])).status === 2);

function serve(pages) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/health") return res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
    if (url.pathname === "/api/client-crash") return res.writeHead(204).end();
    const body = pages[url.pathname];
    if (body === undefined) return res.writeHead(404).end("nope");
    res.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><html><body><div id="root"></div>${body}</body></html>`);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

const site = await serve({
  "/good": `<script>document.getElementById("root").innerHTML = "<h1>Welcome</h1>";</script>`,
  "/throws": `<script>document.getElementById("root").innerHTML = "<h1>Half</h1>"; setTimeout(() => { null.x; }, 10);</script>`,
  "/crash": `<script>document.getElementById("root").innerHTML = "<h2 role='alert'>This page didn't load. Reload to try again.</h2>";</script>`,
  "/blank": ``,
  "/reports": `<script>document.getElementById("root").innerHTML = "<p>ok</p>"; navigator.sendBeacon("/api/client-crash", JSON.stringify({ source: "error", message: "boom" }));</script>`,
});

const missing = await run(["--base-url", site.base, "--routes", "/good", "--skip-apply"], { PLAYWRIGHT_MODULE: "/nonexistent/playwright" });
expect("a missing Playwright exits 3", missing.status === 3 && /not installed/.test(missing.out), missing.out);

let havePlaywright = false;
try {
  const pw = process.env.PLAYWRIGHT_MODULE ? createRequire(import.meta.url)(path.resolve(process.env.PLAYWRIGHT_MODULE)) : createRequire(path.join(process.cwd(), "x.js"))("playwright");
  const b = await pw.chromium.launch();
  await b.close();
  havePlaywright = true;
} catch {
  console.log("browser-smoke.test: Playwright or Chromium is not available here, so the in-browser cases are skipped (CI's browser-smoke job runs them).");
}

if (havePlaywright) {
  const base = ["--base-url", site.base, "--browsers", "chromium", "--skip-apply"];
  const good = await run([...base, "--routes", "/good"]);
  expect("a page that renders passes (0)", good.status === 0, good.out);
  for (const [route, words] of [
    ["/throws", /uncaught error/],
    ["/crash", /crash screen/],
    ["/blank", /drew nothing/],
    ["/reports", /sent a crash report/],
    ["/missing", /HTTP 404/],
  ]) {
    const r = await run([...base, "--routes", route]);
    expect(`${route} fails (1) and says why`, r.status === 1 && words.test(r.out), r.out);
  }
  const noToken = await run(["--base-url", site.base, "--browsers", "chromium", "--routes", "/good", "--require-apply"], { SMOKE_TEST_TOKEN: "" });
  expect("--require-apply without a token fails", noToken.status === 1 && /SMOKE_TEST_TOKEN is not set/.test(noToken.out), noToken.out);
}

site.server.close();
console.log(`browser-smoke.test: ${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
