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
import { DEFAULT_ROUTES, applyBoxProblems, entranceDoorProblems, longAnswer, parseArgs } from "./browser-smoke.mjs";

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

// The role page's Apply on a phone (the lead, after 1.3.42): whole on the screen AND nothing over it.
const clear = { top: 300, bottom: 348, left: 20, right: 370, vw: 390, vh: 664, covered: false, hit: "<a>", inBar: false };
expect("a whole, uncovered Apply passes", applyBoxProblems(clear).length === 0, JSON.stringify(applyBoxProblems(clear)));
// 1.3.42 exactly: top edge at 606, inside the 664 screen, under the tab bar. The box alone passes; the hit test does not.
const under = applyBoxProblems({ ...clear, top: 606, bottom: 654, covered: true, hit: "<nav>" });
expect("the 1.3.42 Apply under the tab bar fails as covered", under.length === 1 && /covers the Apply/.test(under[0]) && /<nav>/.test(under[0]), JSON.stringify(under));

// The entrance's Come in on an iPhone 13 (1.3.77): the door at 580 to 624 of 664, the tab bar from 599.
const doorOk = { vh: 664, barTop: 599, headerBottom: 97, door: { top: 470, bottom: 514, covered: false, hit: "" }, field: null };
expect("a door above the tab bar passes", entranceDoorProblems(doorOk).length === 0, JSON.stringify(entranceDoorProblems(doorOk)));
const doorUnder = entranceDoorProblems({ ...doorOk, door: { top: 580, bottom: 624, covered: true, hit: "<nav> at 195,602" } });
expect("the 1.3.77 door under the tab bar fails", doorUnder.some((p) => p.includes("runs under the tab bar")) && doorUnder.some((p) => p.includes("covers Come in")), JSON.stringify(doorUnder));
const fieldOk = { ...doorOk, field: { name: "name", top: 160, bottom: 204, covered: false, hit: "" } };
expect("a focused name field below the header passes", entranceDoorProblems(fieldOk).length === 0, JSON.stringify(entranceDoorProblems(fieldOk)));
const fieldUnder = entranceDoorProblems({ ...doorOk, field: { name: "name", top: 40, bottom: 84, covered: true, hit: "<header>" } });
expect("a focused field under the sticky header fails", fieldUnder.some((p) => p.includes("under the sticky header")), JSON.stringify(fieldUnder));
expect("focus left elsewhere fails", entranceDoorProblems({ ...doorOk, field: { name: "email", top: 160, bottom: 204, covered: false, hit: "" } }).some((p) => p.includes("not the name field")));
expect("no door drawn fails", entranceDoorProblems(null).length === 1);
expect("an Apply cut off at the foot fails", /not whole/.test(applyBoxProblems({ ...clear, top: 640, bottom: 688 }).join()));
expect("an Apply that is only the bar along the foot fails", /bar along the foot/.test(applyBoxProblems({ ...clear, inBar: true }).join()));
expect("no Apply fails", /no Apply/.test(applyBoxProblems(null).join()));

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
    if (typeof body === "object") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));
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
  // A role page whose Apply's lower edge sits under a fixed tab bar fails, though its centre is clear; the same page with the Apply clear of it passes.
  const roleSite = (applyTop) =>
    serve({
      "/roles": `<script>document.getElementById("root").innerHTML = "<h1>Roles</h1>";</script>`,
      "/api/open-proposals/form": { open: true, roles: [{ id: "gate" }] },
      "/roles/gate": `<meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style><script>document.getElementById("root").innerHTML = '<a href="/apply" data-apply-role="gate" style="position:absolute;top:${applyTop}px;left:20px;width:350px;height:48px;display:block">Apply for this role</a><nav style="position:fixed;bottom:0;left:0;right:0;height:100px;background:#000"></nav>';</script>`,
    });
  const covered = await roleSite(560);
  const hidden = await run(["--base-url", covered.base, "--browsers", "chromium", "--routes", "/roles"]);
  expect("a role page whose Apply is under the tab bar fails (1) and says what covers it", hidden.status === 1 && /role page Apply \(chromium, iPhone 13\): FAILED.*covers the Apply.*<nav>/.test(hidden.out), hidden.out);
  covered.server.close();
  const uncovered = await roleSite(300);
  const shown = await run(["--base-url", uncovered.base, "--browsers", "chromium", "--routes", "/roles"]);
  expect("a role page whose Apply is clear of the tab bar passes (0)", shown.status === 0 && /role page Apply \(chromium, iPhone 13\): ok/.test(shown.out), shown.out);
  uncovered.server.close();
  const noToken = await run(["--base-url", site.base, "--browsers", "chromium", "--routes", "/good", "--require-apply"], { SMOKE_TEST_TOKEN: "" });
  expect("--require-apply without a token fails", noToken.status === 1 && /SMOKE_TEST_TOKEN is not set/.test(noToken.out), noToken.out);
}

site.server.close();
console.log(`browser-smoke.test: ${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
