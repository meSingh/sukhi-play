/**
 * Keeps the app working with no connection.
 *
 * Inside Sukhi Play this file never runs: the app is already files on a disk,
 * served over a private scheme. It is here for the web, where "works with no
 * internet" has to be arranged, and where a child may well have added this to
 * a home screen on a tablet that spends its life in aeroplane mode.
 *
 * ## What it does, and what it deliberately does not
 *
 * Two strategies, chosen by what the file is:
 *
 *   the page      network first, cache as a fallback. The page is the one
 *                 thing that is not content-addressed, so asking the network
 *                 first is how a new version ever arrives. If the network is
 *                 not there, yesterday's page is a great deal better than an
 *                 error.
 *   everything    cache first. Vite puts a hash of the contents in each
 *   else          filename, so a given URL can only ever mean one file and
 *                 there is nothing to revalidate. Icons and the manifest are
 *                 not hashed, but they change about once a year.
 *
 * It caches only this app's own files, same origin and inside its own scope.
 * Nothing here talks to anywhere else, and a service worker that cached third
 * party responses would be a way for it to start.
 *
 * Nothing she makes goes near this. Her makes and doodles are in IndexedDB,
 * which this does not touch; clearing the cache costs a download, not a make.
 */

/* Bumping this drops every previous cache on the next activation. */
const CACHE = 'jazz-studio-v1';

/**
 * The shell, as far as it can be known without the build writing this file.
 * The hashed script and stylesheet are not listed because their names change
 * every build; they arrive in the cache on first visit instead, which is one
 * load earlier than it needs to be for anyone who installs before going
 * offline.
 */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Individually, so one 404 on an icon does not fail the whole install and
    // leave the app with no worker at all.
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL('./', self.location.href).pathname)) return;
  // Not this file. A browser fetches it itself to decide whether there is a new
  // version, and a cached copy of it is a cached copy of the thing that decides.
  if (url.pathname === self.location.pathname) return;

  const wantsPage = request.mode === 'navigate';

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    if (wantsPage) {
      try {
        const fresh = await fetch(request);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return (await cache.match(request))
          ?? (await cache.match('./index.html'))
          ?? Response.error();
      }
    }

    const hit = await cache.match(request);
    if (hit) return hit;

    try {
      const fresh = await fetch(request);
      // Opaque responses are not ours and have no business in here.
      if (fresh.ok && fresh.type === 'basic') cache.put(request, fresh.clone());
      return fresh;
    } catch {
      return Response.error();
    }
  })());
});
