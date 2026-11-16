/* Protocols offline shell, scope /protocols. Rules and why: docs/modules/protocols.md
 * "Offline". Kept under 4 KB: dist is charged in 4 KB blocks. */
const CACHE = "protocols-shell-v1";
const SHELL = "/protocols";
const BUILD = "/__protocols-shell-build";
const WAIT_MS = 8e3;
const PUBLIC = [/^\/api\/brand\/theme\.css$/, /^\/api\/game\/config$/, /^\/api\/i18n\/catalog\/[A-Za-z-]{2,16}$/, /^\/api\/protocols-app\.webmanifest$/, /^\/manifest\.webmanifest$/];
const isAsset = (p) => p.startsWith("/assets/");
const isPublic = (p) => PUBLIC.some((re) => re.test(p));
const inScope = (p) => p === SHELL || p.startsWith(SHELL + "/");
const ok = (r) => r && r.status === 200 && r.type === "basic" && !r.redirected;
const bare = (u) => { const x = new URL(u, self.location.origin); x.search = ""; return x.href; };

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const n of await caches.keys()) if (n.startsWith("protocols-shell-") && n !== CACHE) await caches.delete(n);
  await self.clients.claim();
})()));

const timed = (p) => new Promise((ok2, no) => { const t = setTimeout(() => no(Error("slow")), WAIT_MS); p.then((v) => { clearTimeout(t); ok2(v); }, (e) => { clearTimeout(t); no(e); }); });

/* A new entry script is a deploy: drop the old build's assets. */
async function keepShell(res) {
  const html = await res.text();
  const m = /<script[^>]*src="(\/assets\/[^"]+\.js)"/.exec(html);
  if (!m) return;
  const c = await caches.open(CACHE);
  const prev = await c.match(BUILD);
  if (!prev || (await prev.text()) !== m[1]) for (const k of await c.keys()) if (isAsset(new URL(k.url).pathname)) await c.delete(k);
  await c.put(SHELL, new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
  await c.put(BUILD, new Response(m[1]));
}

async function page(e) {
  const c = await caches.open(CACHE);
  const net = fetch(e.request).then(async (r) => { if (ok(r)) await keepShell(r.clone()).catch(() => {}); return r; });
  e.waitUntil(net.catch(() => {}));
  if (self.navigator && self.navigator.onLine === false) { const k = await c.match(SHELL); if (k) return k; }
  try { return await timed(net); } catch { return (await c.match(SHELL)) || net; }
}

async function asset(e) {
  const c = await caches.open(CACHE);
  const hit = await c.match(e.request);
  if (hit) return hit;
  const r = await fetch(e.request);
  if (ok(r)) e.waitUntil(c.put(e.request, r.clone()));
  return r;
}

async function publicRead(e) {
  const c = await caches.open(CACHE);
  const key = bare(e.request.url);
  try { const r = await timed(fetch(e.request)); if (ok(r)) e.waitUntil(c.put(key, r.clone())); return r; }
  catch (err) { const k = await c.match(key); if (k) return k; throw err; }
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  let u;
  try { u = new URL(e.request.url); } catch { return; }
  if (u.origin !== self.location.origin) return;
  if (e.request.mode === "navigate") { if (inScope(u.pathname)) e.respondWith(page(e)); return; }
  if (isAsset(u.pathname)) return e.respondWith(asset(e));
  if (isPublic(u.pathname)) e.respondWith(publicRead(e));
  // Member data and all else: network, untouched.
});

/* Files the first visit loaded before this worker existed. */
self.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || d.type !== "protocols-warm" || !Array.isArray(d.urls)) return;
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    if (!(await c.match(SHELL))) { try { const r = await fetch(SHELL); if (ok(r)) await keepShell(r); } catch {} }
    for (const raw of d.urls.slice(0, 400)) {
      let u;
      try { u = new URL(raw, self.location.origin); } catch { continue; }
      if (u.origin !== self.location.origin || !(isAsset(u.pathname) || isPublic(u.pathname))) continue;
      const key = isAsset(u.pathname) ? u.href : bare(u.href);
      if (await c.match(key)) continue;
      try { const r = await fetch(raw); if (ok(r)) await c.put(key, r); } catch {}
    }
  })());
});
