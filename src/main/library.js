'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { sanitizeApp } = require('./catalog');

/**
 * The parent's own list of sites, and the suggestions they can add from.
 *
 * Suggestions are bundled with the application, not fetched at runtime. A
 * children's kiosk that pulls a list of destinations off the network at start-up
 * is a configuration-injection path: whoever controls that list controls where
 * the child is sent. Suggestions ship with the release and change with it.
 *
 * `refreshFrom` exists for parents who want a newer list between releases, but
 * it is an explicit action, it validates everything it reads, and it can never
 * enable a site on its own.
 */

const SHAPES = ['star', 'rocket', 'ball', 'blocks', 'note', 'leaf', 'drop', 'bolt'];
// Sixteen, to pair with sixteen shapes. Each one is dark enough for white
// lettering or light enough for dark, which inkFor() in the renderer decides.
const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6',
                '#06b6d4', '#ef4444', '#84cc16', '#a855f7', '#1e40af',
                '#14b8a6', '#f97316', '#f43f5e', '#6366f1', '#65a30d', '#0ea5e9'];

function loadSuggestions (bundledPath) {
  try {
    const raw = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
    const list = Array.isArray(raw.suggestions) ? raw.suggestions : [];
    return list.map(clean).filter(Boolean);
  } catch (err) {
    console.warn('[library] could not read suggestions:', err.message);
    return [];
  }
}

/** A suggestion is a catalog entry plus a couple of fields for the picker. */
function clean (raw) {
  const app = sanitizeApp(raw, 0);
  if (!app) return null;
  return {
    ...app,
    enabled: false,                 // a suggestion is never on by itself
    adSupported: raw.adSupported === true,
    category: typeof raw.category === 'string' ? raw.category.trim() : 'Other'
  };
}

function readCatalogFile (file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return raw && typeof raw === 'object' ? raw : { apps: [] };
  } catch {
    return { apps: [] };
  }
}

function writeCatalogFile (file, data) {
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  // Replace in one step so a crash mid-write cannot leave a broken catalog and
  // a child staring at an empty screen.
  fs.renameSync(tmp, file);
}

function uniqueId (existing, base) {
  const seed = String(base || 'site').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 24) || 'site';
  const taken = new Set(existing.map((a) => a.id));
  if (!taken.has(seed)) return seed;
  for (let i = 2; i < 500; i += 1) {
    if (!taken.has(`${seed}-${i}`)) return `${seed}-${i}`;
  }
  return `${seed}-${Date.now()}`;
}

/** Picks a shape and colour that are not already on screen, so tiles stay distinct. */
function pickLook (existing) {
  const usedShapes = new Set(existing.map((a) => a.shape));
  const usedColors = new Set(existing.map((a) => a.color));
  return {
    shape: SHAPES.find((s) => !usedShapes.has(s)) || SHAPES[existing.length % SHAPES.length],
    color: COLORS.find((c) => !usedColors.has(c)) || COLORS[existing.length % COLORS.length]
  };
}

function addSite (file, entry) {
  const data = readCatalogFile(file);
  const apps = Array.isArray(data.apps) ? data.apps : [];

  const look = pickLook(apps);
  const candidate = sanitizeApp({
    ...entry,
    id: uniqueId(apps, entry.id || entry.title),
    shape: entry.shape || look.shape,
    color: entry.color || look.color,
    enabled: entry.enabled !== false
  }, apps.length);

  if (!candidate) return { ok: false, message: 'That address could not be used.' };

  const already = apps.find((a) => String(a.url) === candidate.url);
  if (already) return { ok: false, message: `Already added as "${already.title}".` };

  apps.push(candidate);
  data.apps = apps;
  writeCatalogFile(file, data);
  return { ok: true, app: candidate };
}

function updateSite (file, id, patch) {
  const data = readCatalogFile(file);
  const apps = Array.isArray(data.apps) ? data.apps : [];
  const i = apps.findIndex((a) => a.id === id);
  if (i === -1) return { ok: false, message: 'Not found.' };

  const merged = sanitizeApp({ ...apps[i], ...patch, id }, i);
  if (!merged) return { ok: false, message: 'Those settings could not be used.' };

  apps[i] = merged;
  data.apps = apps;
  writeCatalogFile(file, data);
  return { ok: true, app: merged };
}

function removeSite (file, id) {
  const data = readCatalogFile(file);
  const apps = Array.isArray(data.apps) ? data.apps : [];
  const next = apps.filter((a) => a.id !== id);
  if (next.length === apps.length) return { ok: false, message: 'Not found.' };
  data.apps = next;
  writeCatalogFile(file, data);
  return { ok: true };
}

/**
 * Replaces the bundled suggestions with a list fetched from a URL the parent
 * supplied. Everything is re-validated, and nothing arrives enabled.
 */
async function refreshFrom (url, fetchImpl) {
  try {
    const res = await fetchImpl(url, { credentials: 'omit' });
    if (!res.ok) return { ok: false, message: `That address returned ${res.status}.` };

    const text = await res.text();
    if (text.length > 512 * 1024) return { ok: false, message: 'That list is too large.' };

    const raw = JSON.parse(text);
    const list = Array.isArray(raw.suggestions) ? raw.suggestions : [];
    const cleaned = list.map(clean).filter(Boolean);
    if (!cleaned.length) return { ok: false, message: 'No usable suggestions in that file.' };

    return { ok: true, suggestions: cleaned };
  } catch (err) {
    return { ok: false, message: `Could not read that list: ${err.message}` };
  }
}

/**
 * The shape the tile screen needs. Kept here rather than inline in the IPC so
 * it can be tested: the launcher showing a stale list after a parent adds a
 * game is exactly the sort of bug that hides behind an untested payload.
 *
 * No picture travels with it. Tiles wear this project's own shapes, never a
 * site's favicon, which is someone else's mark and not ours to ship.
 */
function toTilePayload (apps) {
  return (apps || [])
    .filter((a) => a.enabled)
    .map(({ id, title, shape, color }) => ({ id, title, shape, color }));
}

module.exports = {
  toTilePayload,
  loadSuggestions, addSite, updateSite, removeSite, refreshFrom,
  readCatalogFile, writeCatalogFile, uniqueId, pickLook, SHAPES, COLORS
};
