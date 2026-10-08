/*
 * Service worker of the installable web app.
 *
 * - The page itself (index.html) is fetched from the network first, so a new deploy shows up
 *   on the next launch; the last copy is kept to open the app offline.
 * - Built files (JS bundles, fonts, images) have their hash in their name: they are served
 *   from the cache first, and stored the first time they are fetched.
 * - Nothing outside this site is touched: calls to the game server (Supabase) always go to
 *   the network and are never cached.
 *
 * Bump VERSION when this file's caching rules change, to start from fresh caches.
 */
const VERSION = 'v2';
const SHELL_CACHE = `jeux-shell-${VERSION}`;
const STATIC_CACHE = `jeux-static-${VERSION}`;
const SCOPE = new URL(self.registration.scope);
const SHELL_URL = SCOPE.href; // e.g. https://myrag36.github.io/appli-poker/
const EXTRA_FILES = [
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];
const NETWORK_TIMEOUT_MS = 5000;

/** Same-site files linked from the page (scripts, styles, icons), as absolute URLs. */
function linkedFiles(html) {
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = new URL(match[1], SHELL_URL);
    if (url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname) && url.href !== SHELL_URL) {
      urls.add(url.href);
    }
  }
  return [...urls];
}

/** Downloads the page and stores it, with the files it needs, so the app opens offline. */
async function refreshShell() {
  const response = await fetch(SHELL_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Page indisponible (${response.status})`);
  const html = await response.clone().text();
  const shell = await caches.open(SHELL_CACHE);
  await shell.put(SHELL_URL, response.clone());

  const needed = linkedFiles(html);
  const files = await caches.open(STATIC_CACHE);
  await Promise.all(
    needed.map(async (url) => {
      if (await files.match(url)) return;
      try {
        const res = await fetch(url);
        if (res.ok) await files.put(url, res);
      } catch {
        // Fetched again later, when the page asks for it.
      }
    }),
  );
  // Drop the bundles of older deploys that the new page no longer loads.
  for (const request of await files.keys()) {
    if (request.url.includes('/_expo/static/') && !needed.includes(request.url)) {
      await files.delete(request);
    }
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await refreshShell();
      const files = await caches.open(STATIC_CACHE);
      await files.addAll(EXTRA_FILES.map((f) => new URL(f, SHELL_URL).href)).catch(() => {});
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [SHELL_CACHE, STATIC_CACHE];
      for (const name of await caches.keys()) {
        if (name.startsWith('jeux-') && !keep.includes(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** The page: network first (to get new deploys), the saved copy when offline. */
async function openPage(event) {
  const network = (async () => {
    const isShell = new URL(event.request.url).pathname.replace(/index\.html$/, '') === SCOPE.pathname;
    if (isShell) return refreshShell();
    return fetch(event.request);
  })();
  // Keep updating the saved copy even if the timeout answers first.
  event.waitUntil(network.catch(() => {}));
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    const saved = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE });
    if (saved) return saved;
    return network;
  }
}

/** Built files: from the cache when we have them, otherwise from the network (and kept). */
async function openFile(request) {
  const files = await caches.open(STATIC_CACHE);
  const saved = await files.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') await files.put(request, response.clone());
  return response;
}

/** Small files that can change between deploys (manifest, icons): network first. */
async function openFresh(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone());
    return response;
  } catch (error) {
    const saved = await caches.match(request, { cacheName: STATIC_CACHE });
    if (saved) return saved;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Other sites (the Supabase game server, fonts...) are left to the browser, never cached.
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  if (url.pathname === `${SCOPE.pathname}sw.js`) return;

  if (request.mode === 'navigate') {
    event.respondWith(openPage(event));
  } else if (url.pathname.includes('/_expo/static/') || url.pathname.startsWith(`${SCOPE.pathname}assets/`)) {
    event.respondWith(openFile(request));
  } else {
    event.respondWith(openFresh(request));
  }
});
