'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Apps that ship inside Sukhi Play and never touch the network.
 *
 * Two kinds, from two places. Other people's open-source work is vendored
 * under `vendor/`, each with its licence and the commit it was built from.
 * Ours is built out of `playground/` and lands under `apps/`; a manifest entry
 * says which by setting `ours`. Nothing else about them differs -- same
 * scheme, same isolation, same refusal to touch the network -- and the split
 * exists so that `vendor/` keeps meaning what it says.
 *
 * They exist for two reasons: a child on a train or in a house with no
 * broadband still has something to open, and there is nothing on the other end
 * of them -- no adverts to filter, no terms to read, no host that could serve
 * something different tomorrow.
 *
 * They are served over a scheme of our own rather than file:. A file: page has
 * an opaque origin, so localStorage throws and anything that wants a real
 * origin quietly breaks. `sukhiplay://<id>/` gives each app one origin of its
 * own, isolated from every other app and from the shell.
 */

const SCHEME = 'sukhiplay';

// Served straight to the renderer, so this is the list of things a bundled app
// is allowed to be made of. Anything else is refused rather than guessed at.
const TYPES = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webmanifest': 'application/manifest+json'
}));

/**
 * Reads the manifest of bundled apps and checks each one is actually there.
 *
 * A manifest entry whose files are missing is dropped rather than shown: a
 * tile that opens nothing is worse than a tile that is not there.
 */
function load (manifestPath, vendorDir, ourDir = vendorDir) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    console.warn('[bundled] could not read the manifest:', err.message);
    return [];
  }

  const list = Array.isArray(raw.apps) ? raw.apps : [];
  const out = [];
  const seen = new Set();

  for (const entry of list) {
    const app = clean(entry, vendorDir, ourDir);
    if (!app) continue;
    if (seen.has(app.id)) {
      console.warn(`[bundled] duplicate id ignored: ${app.id}`);
      continue;
    }
    seen.add(app.id);
    out.push(app);
  }
  return out;
}

function clean (raw, vendorDir, ourDir = vendorDir) {
  if (!raw || typeof raw !== 'object') return null;

  // The id becomes a hostname, so it may only hold what a hostname may hold.
  const id = String(raw.id || '').trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    console.warn(`[bundled] refused an id that is not hostname-safe: ${raw.id}`);
    return null;
  }

  // The folder keeps upstream's name so it is obvious whose code it is; the
  // id is ours, and is what the child's tile and the URL are built from.
  const folder = String(raw.dir || id).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(folder)) {
    console.warn(`[bundled] refused a folder name: ${raw.dir}`);
    return null;
  }
  // Ours or somebody else's. Two fixed roots chosen by a boolean, rather than
  // a path out of the manifest: the folder name is checked above and cannot
  // climb, and there is nowhere else a bundled app is ever allowed to live.
  const dir = path.join(raw.ours === true ? ourDir : vendorDir, folder, 'app');
  const entry = typeof raw.entry === 'string' && raw.entry.trim() ? raw.entry.trim() : 'index.html';
  if (!fs.existsSync(path.join(dir, entry))) {
    console.warn(`[bundled] ${id} is in the manifest but not on disk; skipping`);
    return null;
  }

  return {
    id,
    dir,
    entry,
    title: String(raw.title || id).trim(),
    siteName: String(raw.siteName || raw.title || id).trim(),
    blurb: String(raw.blurb || '').trim(),
    category: String(raw.category || 'Creative').trim(),
    shape: String(raw.shape || 'star').trim(),
    color: String(raw.color || '#3b82f6').trim(),
    credit: String(raw.credit || '').trim(),
    licence: String(raw.licence || '').trim(),
    sourceUrl: String(raw.sourceUrl || '').trim(),
    url: `${SCHEME}://${id}/${entry}`
  };
}

/**
 * Serves the bundled apps.
 *
 * Every path is resolved and then checked to be inside the app's own directory,
 * because `..` in a URL is the oldest way to read a file that was never meant
 * to be served.
 */
function serve (target, apps) {
  const byId = new Map(apps.map((a) => [a.id, a]));

  // `target` is a session's protocol, not the global one. The child's content
  // runs in its own partition, and a handler registered on the default session
  // is simply not there when that partition asks for the file.
  target.handle(SCHEME, async (request) => {
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return new Response('bad request', { status: 400 });
    }

    const app = byId.get(url.hostname);
    if (!app) return new Response('no such app', { status: 404 });

    const wanted = decodeURIComponent(url.pathname).replace(/^\/+/, '') || app.entry;
    const file = path.resolve(app.dir, wanted);

    // path.resolve happily walks out of the directory; this is where that stops.
    const root = path.resolve(app.dir) + path.sep;
    if (!file.startsWith(root)) {
      console.warn(`[bundled] refused a path outside ${app.id}: ${wanted}`);
      return new Response('forbidden', { status: 403 });
    }

    const type = TYPES.get(path.extname(file).toLowerCase());
    if (!type) return new Response('unsupported file type', { status: 415 });

    try {
      const body = await fs.promises.readFile(file);
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': type,
          // Nothing here is fetched from anywhere, so nothing here may be.
          'cache-control': 'no-store'
        }
      });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });

  console.log(`[bundled] serving ${apps.length} app(s) over ${SCHEME}://`);
}

/** True for a URL that belongs to the bundled app with this id. */
function belongsTo (url, id) {
  if (!id) return false;
  try {
    const u = new URL(url);
    return u.protocol === `${SCHEME}:` && u.hostname === id;
  } catch {
    return false;
  }
}

/** The bundle id inside a sukhiplay:// address, or null. */
function idOf (url) {
  try {
    const u = new URL(url);
    return u.protocol === `${SCHEME}:` ? u.hostname : null;
  } catch {
    return null;
  }
}

function isBundledUrl (url) {
  try {
    return new URL(url).protocol === `${SCHEME}:`;
  } catch {
    return false;
  }
}

module.exports = { SCHEME, load, serve, belongsTo, idOf, isBundledUrl };
