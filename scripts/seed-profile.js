'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/**
 * Builds a throwaway profile for the screenshot and demo tools.
 *
 * Seeded from config/suggestions.json rather than a hand-written list, so the
 * pictures show real titles, colours and hosts and cannot drift from what the
 * app would actually produce. A throwaway profile also means a recording never
 * contains whoever ran it: their own list of sites stays theirs.
 */
function seedProfile ({ prefix = 'sukhi-seeded-', ids, settings = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'suggestions.json'), 'utf8'));
  const all = Array.isArray(raw) ? raw : raw.sites || raw.suggestions || [];

  const apps = [];
  for (const id of ids) {
    const s = all.find((x) => x.id === id);
    if (!s) {
      console.warn(`[seed] suggestion "${id}" is gone from config/suggestions.json, skipping`);
      continue;
    }
    apps.push({
      id: s.id,
      title: s.title,
      url: s.url,
      shape: s.shape,
      color: s.color,
      enabled: true,
      allowHosts: s.allowHosts,
      denyHosts: s.denyHosts || [],
      blockAds: s.blockAds !== false
    });
  }
  if (!apps.length) throw new Error('could not seed any apps from config/suggestions.json');

  // The catalog reader expects { apps: [...] }; a bare array parses to nothing
  // and produces pictures of an empty screen.
  fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify({ apps }, null, 2));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({
    kiosk: true, alwaysOnTop: false, refocusOnBlur: false, onboarded: true, ...settings
  }, null, 2));
  return { dir, count: apps.length };
}

function electronBin () {
  const local = path.join(ROOT, 'node_modules', '.bin', 'electron');
  if (fs.existsSync(local)) return local;
  throw new Error('electron is not installed. Run `npm install` first.');
}

module.exports = { seedProfile, electronBin, ROOT };
