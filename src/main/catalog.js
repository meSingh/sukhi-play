'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SHAPES = new Set(['star', 'rocket', 'ball', 'blocks', 'note', 'leaf', 'drop', 'bolt']);
const HEX = /^#[0-9a-fA-F]{6}$/;

function sanitizeApp (raw, index) {
  if (!raw || typeof raw !== 'object') return null;

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `app-${index}`;
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : id;

  // Only http/https may ever be launched. This is the first of several places
  // that rule is enforced; see security.js for navigation and request checks.
  let url;
  try {
    url = new URL(String(raw.url));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  } catch {
    return null;
  }

  const allowHosts = Array.isArray(raw.allowHosts)
    ? raw.allowHosts.filter((h) => typeof h === 'string' && h.trim()).map((h) => h.trim())
    : [];
  // An app with no allowlist would be wide open, which defeats the point.
  // Fall back to "only the host it launches", which is the safest reading.
  if (allowHosts.length === 0) allowHosts.push(url.hostname);

  const denyHosts = Array.isArray(raw.denyHosts)
    ? raw.denyHosts.filter((h) => typeof h === 'string' && h.trim()).map((h) => h.trim())
    : [];

  return {
    id,
    title,
    url: url.toString(),
    shape: SHAPES.has(raw.shape) ? raw.shape : 'star',
    color: HEX.test(raw.color) ? raw.color : '#3b82f6',
    enabled: raw.enabled !== false,
    allowHosts,
    denyHosts
  };
}

function parse (rawText) {
  const data = JSON.parse(rawText);
  const list = Array.isArray(data.apps) ? data.apps : [];
  const apps = list.map(sanitizeApp).filter(Boolean);
  const seen = new Set();
  return apps.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

/**
 * Reads the parent-editable catalog from userData, seeding it from the bundled
 * copy on first run. Falls back to the bundled copy if the edited one is broken,
 * so a stray comma can never leave the kid staring at an empty screen.
 */
function load ({ userDataDir, bundledPath }) {
  const userPath = path.join(userDataDir, 'catalog.json');

  if (!fs.existsSync(userPath)) {
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.copyFileSync(bundledPath, userPath);
    } catch (err) {
      console.warn('[catalog] could not seed user catalog:', err.message);
    }
  }

  for (const [label, file] of [['user', userPath], ['bundled', bundledPath]]) {
    try {
      const apps = parse(fs.readFileSync(file, 'utf8'));
      if (apps.length) return { apps, file: userPath, source: label, error: null };
      console.warn(`[catalog] ${label} catalog has no usable apps`);
    } catch (err) {
      console.warn(`[catalog] ${label} catalog unreadable:`, err.message);
      if (label === 'bundled') {
        return { apps: [], file: userPath, source: 'none', error: err.message };
      }
    }
  }
  return { apps: [], file: userPath, source: 'none', error: 'no usable catalog' };
}

module.exports = { load, parse, sanitizeApp, SHAPES };
