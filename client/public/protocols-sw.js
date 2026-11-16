/*
 * THE PROTOCOLS PAGES' OFFLINE SHELL, and nothing else.
 *
 * Registered only by the protocols page (client/src/lib/protocolsOffline.ts),
 * only when the village has the protocols module on, with the scope
 * `/protocols`. A service worker controls the pages under its scope and no
 * others, so this one can never answer for the map, the profile or Admin: a
 * village that never turns the module on never installs it, and on a village
 * that does, every page outside /protocols behaves exactly as before.
 * client/public/sw.js stays the worker for everything else.
 *
 * WHY IT CAN NOT STRAND A MEMBER ON AN OLD BUILD.
 *  - A page under /protocols is fetched from the network first, every time.
 *    The copy kept here is used only when the network fails or does not
 *    answer in time. Online, a member always gets today's page.
 *  - The scripts and styles it keeps are Vite's hashed `/assets/*` files.
 *    A name is its content, so a kept copy can never be the wrong bytes.
 *  - When a fresh page names a different entry script (a deploy happened),
 *    every kept asset from the build before is dropped. One build per device.
 *  - /reset unregisters every worker and empties Cache Storage, this one's
 *    included (client/src/lib/deviceReset.ts).
 *
 * WHAT IT NEVER KEEPS. Member data. API answers that carry who you are or
 * what you did are kept by the page itself, per member, in storage it owns
 * (lib/offlineQueue.ts snapshots), because a shared phone must not show one
 * member's runs to the next. The only API answers kept here are the public
 * look of the village (its theme stylesheet and its config), which every
 * visitor gets the same.
 */
const CACHE = "protocols-shell-v1";
const SHELL_KEY = "/protocols";
const BUILD_KEY = "/__protocols-shell-build";
const NAV_TIMEOUT_MS = 8000;

/* Public, the same for every visitor, and needed to draw the page at all. */
const PUBLIC_GETS = [
  /^\/api\/brand\/theme\.css$/,
  /^\/api\/config$/,
  /^\/api\/config\/public$/,
  /^\/api\/modules\/manifest$/,
  /^\/api\/protocols\/app\.webmanifest$/,
  /^\/manifest\.webmanifest$/,
];

const isAsset = (p) => p.startsWith("/assets/");
const isPublicGet = (p) => PUBLIC_GETS.some((re) => re.test(p));
const inScope = (p) => p === "/protocols" || p.startsWith("/protocols/");

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("protocols-shell-") && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

/** The entry script a page names, which is what identifies its build. */
function entryOf(html) {
  const m = /<script[^>]*type="module"[^>]*src="(\/assets\/[^"]+\.js)"/.exec(html) || /<script[^>]*src="(\/assets\/[^"]+\.js)"[^>]*type="module"/.exec(html);
  return m ? m[1] : null;
}

/** Keep a fresh page, and drop the previous build's assets if this is a new one. */
async function keepShell(res) {
  const html = await res.clone().text();
  const entry = entryOf(html);
  if (!entry) return;
  const cache = await caches.open(CACHE);
  const prev = await cache.match(BUILD_KEY);
  const prevEntry = prev ? await prev.text() : null;
  if (prevEntry !== entry) {
    for (const key of await cache.keys()) {
      if (isAsset(new URL(key.url).pathname)) await cache.delete(key);
    }
  }
  await cache.put(SHELL_KEY, new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
  await cache.put(BUILD_KEY, new Response(entry, { headers: { "Content-Type": "text/plain" } }));
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timed out")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function navigate(event) {
  const cache = await caches.open(CACHE);
  const network = fetch(event.request).then(async (res) => {
    if (res && res.status === 200 && res.type === "basic" && !res.redirected) {
      await keepShell(res.clone()).catch(() => {});
    }
    return res;
  });
  // Whatever happens below, let a slow answer still refresh the kept copy.
  event.waitUntil(network.catch(() => {}));
  if (self.navigator && self.navigator.onLine === false) {
    const kept = await cache.match(SHELL_KEY);
    if (kept) return kept;
  }
  try {
    return await withTimeout(network, NAV_TIMEOUT_MS);
  } catch {
    const kept = await cache.match(SHELL_KEY);
    if (kept) return kept;
    return network;
  }
}

async function asset(event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (res && res.status === 200 && res.type === "basic" && !res.redirected) {
    event.waitUntil(cache.put(event.request, res.clone()));
  }
  return res;
}

async function publicGet(event) {
  const cache = await caches.open(CACHE);
  const key = new URL(event.request.url);
  key.search = "";
  try {
    const res = await withTimeout(fetch(event.request), NAV_TIMEOUT_MS);
    if (res && res.status === 200 && res.type === "basic") event.waitUntil(cache.put(key.href, res.clone()));
    return res;
  } catch (err) {
    const kept = await cache.match(key.href);
    if (kept) return kept;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    if (inScope(url.pathname)) event.respondWith(navigate(event));
    return;
  }
  if (isAsset(url.pathname)) {
    event.respondWith(asset(event));
    return;
  }
  if (isPublicGet(url.pathname)) event.respondWith(publicGet(event));
  // Everything else, member data above all, goes to the network untouched.
});

/*
 * THE PAGE HANDS OVER WHAT IT LOADED BEFORE THIS WORKER WAS IN CHARGE.
 *
 * The first visit loads its scripts before the worker exists, so none of them
 * passed through it. The page sends the list (performance entries for this
 * origin) and the worker keeps the hashed assets and the public reads among
 * them, plus the page itself, so the very next visit works with no signal.
 */
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "protocols-warm" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      if (!(await cache.match(SHELL_KEY))) {
        try {
          const res = await fetch(SHELL_KEY, { credentials: "same-origin" });
          if (res.status === 200 && !res.redirected) await keepShell(res);
        } catch {
          /* offline already; the next visit tries again */
        }
      }
      for (const raw of data.urls.slice(0, 400)) {
        let u;
        try {
          u = new URL(raw, self.location.origin);
        } catch {
          continue;
        }
        if (u.origin !== self.location.origin) continue;
        const asAsset = isAsset(u.pathname);
        if (!asAsset && !isPublicGet(u.pathname)) continue;
        const key = asAsset ? u.href : (u.search = "", u.href);
        if (await cache.match(key)) continue;
        try {
          const res = await fetch(raw, { credentials: "same-origin" });
          if (res.status === 200 && res.type === "basic" && !res.redirected) await cache.put(key, res);
        } catch {
          /* one miss is fine; the page loads it through the worker next time */
        }
      }
    })(),
  );
});
