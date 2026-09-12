'use strict';

/* Launcher UI. Talks to the main process only through window.sukhi. */

const api = window.sukhi;

const el = (id) => document.getElementById(id);

/**
 * Binds a listener, and says so loudly if the element is not there.
 *
 * A single `on('missing', ...)` used to throw out of wire(),
 * which boot()'s catch answered by replacing the whole document with an error
 * message -- so one stale id blanked the entire interface. Now the rest of the
 * app still works and the console names the culprit.
 */
function on (id, event, handler) {
  const node = el(id);
  if (!node) {
    console.error(`[shell] no element #${id} to bind ${event} to`);
    return;
  }
  node.addEventListener(event, handler);
}
const app = el('app');

const MIN_SPLASH_MS = 1400; // long enough to read as "it is starting", not a flash

let config = null;
let gateIntent = 'portal';
let holdTimer = null;
let holdStart = 0;
let toastTimer = null;

/* ---------------- tiles ---------------- */

function renderTiles (apps) {
  const wrap = el('tiles');
  wrap.textContent = '';

  // An empty screen with no instruction is where a parent gets stuck, so the
  // empty state is a call to action rather than a note.
  const empty = el('launcher-empty');
  if (!apps.length) {
    empty.hidden = false;
    wrap.hidden = true;
    return;
  }
  empty.hidden = true;
  wrap.hidden = false;

  for (const entry of apps) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.setAttribute('role', 'listitem');
    tile.style.setProperty('--tile', entry.color);
    tile.style.setProperty('--tile-ink', inkFor(entry.color));
    tile.dataset.appId = entry.id;

    // The icon sits on a white coin: a site's own favicon and our flat shapes
    // both read cleanly against it, whatever colour the tile is.
    const badge = document.createElement('span');
    badge.className = 'tile-badge';

    if (entry.icon) {
      const img = document.createElement('img');
      img.src = entry.icon;
      img.alt = '';
      // If the favicon will not decode, fall back to the shape rather than
      // leaving an empty coin.
      img.addEventListener('error', () => {
        badge.textContent = '';
        badge.appendChild(shapeIcon(entry.shape));
      }, { once: true });
      badge.appendChild(img);
    } else {
      badge.appendChild(shapeIcon(entry.shape));
    }

    const label = document.createElement('span');
    label.className = 'tile-name';
    label.textContent = entry.title;

    tile.append(badge, label);
    tile.addEventListener('click', () => launch(tile, entry.id));
    wrap.appendChild(tile);
  }
}

/**
 * Picks black or white lettering for a tile, whichever is actually readable on
 * it. A yellow tile with white text looks fine in a palette and is unreadable
 * on screen, and every colour here is parent-chosen, so this cannot be left to
 * taste.
 *
 * Relative luminance per WCAG; the 0.55 threshold favours dark text, which
 * reads better at the weights used here.
 */
function inkFor (hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const channel = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * channel((n >> 16) & 255) +
              0.7152 * channel((n >> 8) & 255) +
              0.0722 * channel(n & 255);
  return lum > 0.55 ? '#16354F' : '#ffffff';
}

function shapeIcon (shape) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#shape-${shape || 'star'}`);
  svg.appendChild(use);
  return svg;
}

async function launch (tile, appId) {
  // Guard against a delighted 3-year-old hammering the tile.
  for (const t of document.querySelectorAll('.tile')) t.classList.add('is-busy');
  const result = await api.launch(appId);
  if (!result || !result.ok) {
    for (const t of document.querySelectorAll('.tile')) t.classList.remove('is-busy');
    showToast((result && result.message) || 'That did not open.');
  }
}

/* ---------------- state from main ---------------- */

function applyState (state) {
  if (!state) return;
  app.dataset.mode = state.mode;
  if (state.gateIntent) gateIntent = state.gateIntent;
  if (state.mode === 'gate') describeGate();

  // "Back" and "Stop this game" are only distinguishable if we know whether a
  // game is actually open. When none is, "stop" is meaningless and is hidden
  // rather than sitting there duplicating "back".

  if (state.mode === 'launcher') {
    for (const t of document.querySelectorAll('.tile')) t.classList.remove('is-busy');
  }

  el('bar-title').textContent = state.activeAppTitle || '';

  const badge = el('bar-blocked');
  if (config && config.settings.showBlockCounter && state.blocked > 0) {
    badge.hidden = false;
    badge.textContent = `${state.blocked} ads blocked`;
  } else {
    badge.hidden = true;
  }

  if (state.mode !== 'gate') resetGate();
}

/* ---------------- the grown-up gate ---------------- */

/**
 * Says what the gate is guarding.
 *
 * Pressing Close and being asked "Grown-ups only" tells a parent nothing about
 * what is about to happen. Quitting now asks to confirm quitting.
 */
function describeGate () {
  const quitting = gateIntent === 'quit';
  const seconds = config ? config.settings.holdSeconds : 3;

  el('gate-title').textContent = quitting ? 'Close Sukhi Play?' : 'Grown-ups only';
  el('gate-lead').textContent = quitting
    ? `Hold the button for ${seconds} seconds to confirm you are a grown-up.`
    : `Press and hold for ${seconds} seconds.`;

  const hold = el('hold-btn');
  const label = hold && hold.querySelector('.hold-label');
  if (label) label.textContent = quitting ? 'Hold to close' : 'Hold';
  hold.classList.toggle('hold-btn--quit', quitting);
}

function resetGate () {
  clearInterval(holdTimer);
  holdTimer = null;
  el('hold-fill').style.height = '0%';
  el('gate-step-hold').hidden = false;
  el('gate-step-answer').hidden = true;
  el('gate-step-library').hidden = true;
  el('gate-step-form').hidden = true;
  libCard().classList.remove('is-wide');
  el('gate-input').value = '';
  el('gate-error').textContent = '';
  describeGate();
}

function startHold () {
  if (holdTimer) return;
  const seconds = config ? config.settings.holdSeconds : 3;
  holdStart = Date.now();
  el('gate-error').textContent = '';

  holdTimer = setInterval(() => {
    const progress = Math.min(1, (Date.now() - holdStart) / (seconds * 1000));
    el('hold-fill').style.height = `${progress * 100}%`;
    if (progress >= 1) {
      clearInterval(holdTimer);
      holdTimer = null;
      revealChallenge();
    }
  }, 60);
}

function cancelHold () {
  if (!holdTimer) return;
  clearInterval(holdTimer);
  holdTimer = null;
  el('hold-fill').style.height = '0%';
}

async function revealChallenge () {
  const result = await api.completeHold();
  if (!result || !result.ok) {
    el('gate-error').textContent = (result && result.message) || 'Try the hold again.';
    el('hold-fill').style.height = '0%';
    return;
  }

  el('gate-step-hold').hidden = true;

  if (result.needsPin) {
    el('gate-prompt').textContent = result.prompt || 'Enter the parent PIN';
    el('gate-step-answer').hidden = false;
    el('gate-input').focus();
    return;
  }

  // Holding was the whole check.
  afterUnlock();
}

/* ---------------- first-run walkthrough ---------------- */

let obStep = 1;
let obAdded = 0;
let obHoldTimer = null;
let obKeepAlive = null;

function obShow (step) {
  obStep = step;
  for (const el2 of document.querySelectorAll('.ob-step')) {
    el2.hidden = Number(el2.dataset.step) !== step;
  }
  const card = document.querySelector('.ob-card');
  if (card) card.scrollTop = 0;
  if (step === 2) loadObSuggestions();
  if (step === 4) {
    el('ob-summary').textContent = obAdded
      ? `${obAdded} game${obAdded === 1 ? '' : 's'} ready. Press the button below and hand the computer over.`
      : 'You have not added anything yet. You can do it any time from the tile screen by pressing Grown-ups.';
  }
}

async function startOnboarding () {
  await api.beginOnboarding();
  obShow(1);
  // The walkthrough can easily take longer than the unlock window.
  clearInterval(obKeepAlive);
  obKeepAlive = setInterval(() => api.keepUnlocked(), 30_000);
}

async function loadObSuggestions () {
  const data = await api.library();
  const wrap = el('ob-suggestions');
  wrap.textContent = '';
  if (!data || !data.ok) {
    wrap.textContent = 'Could not load the suggestions.';
    return;
  }

  if (!data.suggestions.length) {
    const p = document.createElement('p');
    p.className = 'lib-empty';
    p.textContent = 'All set up. You can change any of it later.';
    wrap.appendChild(p);
    return;
  }

  // One tap here on purpose: this is the two-minute setup path. Everything is
  // editable afterwards from the parent portal, which the next step explains.
  for (const sug of data.suggestions) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.style.setProperty('--card', sug.color);

    const badge = document.createElement('span');
    badge.className = 'card-badge';
    badge.appendChild(shapeIcon(sug.shape));

    const body = document.createElement('span');
    body.className = 'card-body';

    const name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = sug.title;

    const meta = document.createElement('span');
    meta.className = 'card-meta';
    meta.textContent = sug.category;
    meta.appendChild(sug.adSupported
      ? tag('has ads', 'lib-tag--ads')
      : tag('no ads', 'lib-tag--free'));

    body.append(name, meta);

    const state = document.createElement('span');
    state.className = 'card-state';
    state.textContent = 'Add';

    card.append(badge, body, state);

    card.addEventListener('click', async () => {
      card.disabled = true;
      state.textContent = 'Adding…';
      const r = await api.addSite({
        title: sug.title, url: sug.url, shape: sug.shape, color: sug.color,
        allowHosts: sug.allowHosts, denyHosts: sug.denyHosts,
        blockAds: sug.blockAds, enabled: true
      });
      if (!r || !r.ok) {
        card.disabled = false;
        state.textContent = 'Add';
        showToast((r && r.message) || 'Could not add that.');
        return;
      }
      obAdded += 1;
      loadObSuggestions();
    });

    wrap.appendChild(card);
  }
}

/** A no-stakes run of the real exit gesture, so the parent knows the feel of it. */
function obPractiseHold () {
  if (obHoldTimer) return;
  const seconds = config ? config.settings.holdSeconds : 3;
  const started = Date.now();
  obHoldTimer = setInterval(() => {
    const progress = Math.min(1, (Date.now() - started) / (seconds * 1000));
    el('ob-hold-fill').style.height = `${progress * 100}%`;
    if (progress >= 1) {
      clearInterval(obHoldTimer);
      obHoldTimer = null;
      el('ob-hold-label').textContent = 'That’s it';
    }
  }, 60);
}

function obCancelHold () {
  if (!obHoldTimer) return;
  clearInterval(obHoldTimer);
  obHoldTimer = null;
  el('ob-hold-fill').style.height = '0%';
}

async function finishOnboarding () {
  clearInterval(obKeepAlive);
  obKeepAlive = null;
  await api.finishOnboarding();
}

/* ---------------- the parent portal ---------------- */

function libCard () { return document.querySelector('.gate-card'); }

function tag (text, cls) {
  const t = document.createElement('span');
  t.className = 'lib-tag' + (cls ? ' ' + cls : '');
  t.textContent = text;
  return t;
}

let catalogue = { mine: [], suggestions: [], shapes: [], colors: [] };

async function loadLibrary () {
  const data = await api.library();
  if (!data || !data.ok) return;
  catalogue = data;
  renderMine(data.mine);
  renderSuggestions(data.suggestions);

  const live = data.mine.filter((a) => a.enabled).length;
  el('mine-count').textContent = data.mine.length
    ? `${live} of ${data.mine.length} on the tiles`
    : '';
  // With nothing left to suggest there is nothing to show.
  el('sec-suggest').hidden = data.suggestions.length === 0;
}

/* --- what is set up --- */

function appArtwork (entry, size) {
  const art = document.createElement('span');
  art.className = 'art';
  art.style.setProperty('--art', entry.color);
  if (size) art.style.setProperty('--art-size', size + 'px');

  const coin = document.createElement('span');
  coin.className = 'art-coin';
  if (entry.icon) {
    const img = document.createElement('img');
    img.src = entry.icon;
    img.alt = '';
    img.addEventListener('error', () => {
      coin.textContent = '';
      coin.appendChild(shapeIcon(entry.shape));
    }, { once: true });
    coin.appendChild(img);
  } else {
    coin.appendChild(shapeIcon(entry.shape));
  }
  art.appendChild(coin);
  return art;
}

/**
 * Each app is a box that looks like the tile the child sees, so a parent can
 * match what is on this screen to what is on theirs at a glance.
 */
function renderMine (mine) {
  const wrap = el('lib-mine');
  wrap.textContent = '';

  if (!mine.length) {
    const p = document.createElement('p');
    p.className = 'lib-empty';
    p.textContent = 'Nothing set up yet. Add one below, or pick a ready-made one.';
    wrap.appendChild(p);
    return;
  }

  for (const entry of mine) {
    const box = document.createElement('div');
    // Not greyed out when hidden: a dimmed card reads as "you cannot touch
    // this", when in fact it is the one you most likely came to change.
    box.className = 'app' + (entry.enabled ? '' : ' is-hidden-app');

    box.appendChild(appArtwork(entry));

    const name = document.createElement('div');
    name.className = 'app-name';
    name.textContent = entry.title;
    if (!entry.blockAds) name.appendChild(tag('ads on', 'lib-tag--ads'));

    const host = document.createElement('div');
    host.className = 'app-host';
    try { host.textContent = new URL(entry.url).hostname; } catch { host.textContent = entry.url; }

    const toggle = visibilitySwitch(entry);
    toggle.classList.add('app-toggle');
    // The switch sits inside the card, so its clicks must not also open the
    // editor behind it.
    toggle.addEventListener('click', (e) => e.stopPropagation());

    box.append(toggle, name, host);

    // The whole card opens the editor. A separate Edit button was one more
    // thing to read on a card that is already a picture of the thing.
    box.setAttribute('role', 'button');
    box.tabIndex = 0;
    box.title = `Change ${entry.title}`;
    box.addEventListener('click', () => openForm('edit', entry));
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openForm('edit', entry);
      }
    });
    wrap.appendChild(box);
  }

  const hint = document.createElement('p');
  hint.className = 'apps-hint';
  hint.textContent = 'Tap an app to change its name, picture or address.';
  wrap.appendChild(hint);
}

function visibilitySwitch (entry) {
  const label = document.createElement('label');
  label.className = 'switch';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = entry.enabled;
  input.setAttribute('aria-label', `Show ${entry.title} to your child`);

  const track = document.createElement('span');
  track.className = 'switch-track';
  track.appendChild(document.createElement('span')).className = 'switch-knob';

  const text = document.createElement('span');
  text.className = 'switch-text';
  text.hidden = true;   // the switch itself says which way it is set

  input.addEventListener('change', async () => {
    input.disabled = true;
    text.hidden = true;
    const r = await api.updateSite(entry.id, { enabled: input.checked });
    if (!r || !r.ok) showToast((r && r.message) || 'Could not change that.');
    input.disabled = false;
    loadLibrary();
  });

  label.append(input, track, text);
  return label;
}

/* --- ready-made --- */

function renderSuggestions (list) {
  const wrap = el('lib-suggest-list');
  wrap.textContent = '';

  for (const sug of list) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.style.setProperty('--card', sug.color);
    card.title = sug.notes || sug.url;

    const badge = document.createElement('span');
    badge.className = 'card-badge';
    badge.appendChild(shapeIcon(sug.shape));

    const body = document.createElement('span');
    body.className = 'card-body';

    const name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = sug.title;

    const meta = document.createElement('span');
    meta.className = 'card-meta';
    meta.textContent = sug.category;
    meta.appendChild(sug.adSupported
      ? tag('has ads', 'lib-tag--ads')
      : tag('no ads', 'lib-tag--free'));

    body.append(name, meta);

    const state = document.createElement('span');
    state.className = 'card-state';
    state.textContent = 'Set up';

    card.append(badge, body, state);
    // A suggestion is a starting point, not a decision: choosing one opens the
    // same form as anything else so every value can be changed first.
    card.addEventListener('click', () => openForm('add', sug));
    wrap.appendChild(card);
  }
}

/* ---------------- the app form ---------------- */


let form = null;
let probeTimer = null;

const BLANK = {
  id: null, title: '', url: '', shape: 'star', color: '#3B6BFF',
  allowHosts: [], denyHosts: [], blockAds: true, enabled: true,
  iconUrls: [], icon: null, useIcon: false
};

function openForm (mode, entry) {
  form = { mode, ...BLANK, ...(entry || {}) };
  // An app that already wears the site's own icon keeps it selected.
  form.useIcon = Boolean(form.icon);
  if (!form.color) form.color = catalogue.colors[0] || BLANK.color;
  if (!form.shape) form.shape = 'star';

  el('gate-step-library').hidden = true;
  el('gate-step-form').hidden = false;

  const addingByAddress = mode === 'address';
  el('form-address').hidden = !addingByAddress;
  el('form-fields').hidden = addingByAddress;
  // Every bit of this button's state has to be reset, not just its visibility.
  // Leaving `disabled` set after a successful delete meant the first deletion
  // disabled the button for every app opened afterwards, which looked exactly
  // like certain apps being undeletable.
  const del = el('form-delete');
  del.hidden = mode !== 'edit';
  del.disabled = false;
  del.dataset.armed = 'no';
  del.textContent = 'Delete this app';
  del.classList.remove('is-armed');
  el('form-notice').hidden = true;
  el('form-found').hidden = true;
  el('form-progress').hidden = true;
  el('form-url').value = '';
  el('form-adv').open = false;

  el('form-title').textContent =
    mode === 'edit' ? `Edit ${entry.title}` : 'Add a new app';
  el('form-sub').textContent = addingByAddress
    ? 'Start with the address and change anything it suggests.'
    : 'Change anything here before you save.';

  el('form-badge').textContent = '';
  el('form-badge').appendChild(shapeIcon(form.shape));

  buildShapePicker();
  buildColorPicker();
  fillFormFields();
  updatePreview();
  validateForm();

  (addingByAddress ? el('form-url') : el('form-name')).focus();
}

function closeForm () {
  clearInterval(probeTimer);
  probeTimer = null;
  form = null;
  el('gate-step-form').hidden = true;
  el('gate-step-library').hidden = false;
  loadLibrary();
}

function fillFormFields () {
  el('form-name').value = form.title || '';
  el('form-addr').value = form.url || '';
  el('form-allow').value = (form.allowHosts || []).join('\n');
  el('form-deny').value = (form.denyHosts || []).join('\n');
  const ads = el('form-blockads');
  ads.checked = form.blockAds !== false;
  el('form-blockads-text').textContent = ads.checked ? 'Filtering ads' : 'Ads left on';
}

function buildShapePicker () {
  const wrap = el('form-shapes');
  wrap.textContent = '';

  // The site's own icon, when we have one, sits first and is the obvious pick.
  if (form.icon) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch swatch--icon' + (form.useIcon ? ' is-on' : '');
    b.title = "The site's own icon";
    b.setAttribute('aria-label', "The site's own icon");
    const img = document.createElement('img');
    img.src = form.icon;
    img.alt = '';
    b.appendChild(img);
    b.addEventListener('click', () => {
      form.useIcon = true;
      buildShapePicker();
      updatePreview();
    });
    wrap.appendChild(b);
  }

  for (const shape of (catalogue.shapes.length ? catalogue.shapes : [form.shape])) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (!form.useIcon && shape === form.shape ? ' is-on' : '');
    b.title = shape;
    b.setAttribute('aria-label', shape);
    b.appendChild(shapeIcon(shape));
    b.addEventListener('click', () => {
      form.shape = shape;
      form.useIcon = false;
      buildShapePicker();
      updatePreview();
    });
    wrap.appendChild(b);
  }
}

function buildColorPicker () {
  const wrap = el('form-colors');
  wrap.textContent = '';
  const palette = catalogue.colors.length ? catalogue.colors : [form.color];
  for (const color of palette) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch swatch--color' + (color === form.color ? ' is-on' : '');
    b.style.background = color;
    b.title = color;
    b.setAttribute('aria-label', `Colour ${color}`);
    b.addEventListener('click', () => {
      form.color = color;
      buildColorPicker();
      updatePreview();
    });
    wrap.appendChild(b);
  }
}

/** Shows the parent exactly the tile their child will see. */
function updatePreview () {
  const wrap = el('form-preview');
  wrap.textContent = '';

  const tile = document.createElement('div');
  tile.className = 'tile tile--preview';
  tile.style.setProperty('--tile', form.color);
  tile.style.setProperty('--tile-ink', inkFor(form.color));

  const badge = document.createElement('span');
  badge.className = 'tile-badge';
  if (form.useIcon && form.icon) {
    const img = document.createElement('img');
    img.src = form.icon;
    img.alt = '';
    badge.appendChild(img);
  } else {
    badge.appendChild(shapeIcon(form.shape));
  }

  const label = document.createElement('span');
  label.className = 'tile-name';
  label.textContent = el('form-name').value.trim() || 'Name';

  tile.append(badge, label);
  wrap.appendChild(tile);

  el('form-badge').textContent = '';
  el('form-badge').appendChild(shapeIcon(form.shape));
}

function linesOf (value) {
  return String(value || '')
    .split(/[\n,]/)
    .map((h) => h.trim())
    .filter(Boolean);
}

function validateForm () {
  const name = el('form-name').value.trim();
  const url = el('form-addr').value.trim();
  const hosts = linesOf(el('form-allow').value);
  const ok = Boolean(name) && /^https?:\/\/.+\..+/.test(url) && hosts.length > 0;
  el('form-save').disabled = !ok;
  return ok;
}

async function saveForm () {
  if (!validateForm()) return;

  const payload = {
    title: el('form-name').value.trim(),
    url: el('form-addr').value.trim(),
    shape: form.shape,
    color: form.color,
    allowHosts: linesOf(el('form-allow').value),
    denyHosts: linesOf(el('form-deny').value),
    blockAds: el('form-blockads').checked,
    enabled: true
  };

  const save = el('form-save');
  save.disabled = true;
  save.textContent = 'Saving…';

  if (form.mode === 'edit' && !form.useIcon) {
    // Dropping the site's icon in favour of a shape has to clear the stored
    // file. The icon we were handed is an inline copy for display, never a
    // path, so it is not sent back.
    payload.icon = null;
  }

  const result = form.mode === 'edit'
    ? await api.updateSite(form.id, payload)
    : await api.addSite({ ...payload, iconUrls: form.iconUrls, useIcon: form.useIcon });

  save.textContent = 'Save';
  if (!result || !result.ok) {
    save.disabled = false;
    showToast((result && result.message) || 'Could not save that.');
    return;
  }
  closeForm();
}

async function deleteFromForm () {
  const btn = el('form-delete');
  if (btn.dataset.armed !== 'yes') {
    btn.dataset.armed = 'yes';
    btn.textContent = 'Tap again to delete';
    btn.classList.add('is-armed');
    setTimeout(() => {
      btn.dataset.armed = 'no';
      btn.textContent = 'Delete this app';
      btn.classList.remove('is-armed');
    }, 4000);
    return;
  }
  btn.disabled = true;
  const r = await api.removeSite(form.id);
  if (!r || !r.ok) {
    btn.disabled = false;
    showToast((r && r.message) || 'Could not delete that.');
    return;
  }
  closeForm();
}

/* --- finding out what an address needs --- */

const PROBE_STEPS = [
  [0, 'Opening the page…'],
  [22, 'Watching what it loads…'],
  [70, 'Sorting the adverts from the rest…'],
  [90, 'Working out what it needs…']
];

function runProgress (seconds) {
  const fill = el('probe-fill');
  const step = el('probe-step');
  const started = Date.now();
  el('form-progress').hidden = false;
  fill.style.width = '0%';

  clearInterval(probeTimer);
  probeTimer = setInterval(() => {
    // Stops just short of full: the bar completes when the answer arrives.
    const pct = Math.min(96, ((Date.now() - started) / (seconds * 1000)) * 100);
    fill.style.width = pct + '%';
    for (const [at, text] of PROBE_STEPS) {
      if (pct >= at) step.textContent = text;
    }
  }, 120);
}

function stopProgress (done) {
  clearInterval(probeTimer);
  probeTimer = null;
  if (done) {
    el('probe-fill').style.width = '100%';
    el('probe-step').textContent = 'Done.';
  }
}

async function checkSite () {
  const raw = el('form-url').value.trim();
  if (!raw) return;

  const notice = el('form-notice');
  const go = el('form-check');
  notice.hidden = true;
  el('form-found').hidden = true;

  // Asked BEFORE the slow part. Being told "you already have this" after
  // twelve seconds of watching a progress bar is just rude.
  const dup = await api.siteExists(raw);
  if (!dup || !dup.ok) {
    notice.hidden = false;
    notice.className = 'form-notice is-bad';
    notice.textContent = (dup && dup.message) || 'That does not look like an address.';
    return;
  }
  if (dup.exists) {
    notice.hidden = false;
    notice.className = 'form-notice is-bad';
    notice.textContent = `You already have this one, as “${dup.title}”. Edit it from the list instead.`;
    return;
  }

  go.disabled = true;
  runProgress(13);

  const r = await api.probeSite(raw);

  go.disabled = false;
  stopProgress(Boolean(r && r.ok));

  if (!r || !r.ok) {
    notice.hidden = false;
    notice.className = 'form-notice is-bad';
    notice.textContent = (r && r.message) || 'That site could not be checked.';
    return;
  }

  // Suggestions, not decisions: every one of these is editable below.
  form.url = r.url;
  form.title = r.suggestedTitle;
  form.allowHosts = r.allowHosts;
  form.iconUrls = r.iconUrls || [];
  form.icon = r.icon ? r.icon.dataUri : null;
  form.useIcon = Boolean(form.icon);

  const found = el('form-found');
  found.textContent = '';
  found.hidden = false;

  const summary = document.createElement('p');
  summary.className = 'found-line';
  summary.textContent = r.warning
    ? r.warning
    : `Needs ${r.hostCount} host${r.hostCount === 1 ? '' : 's'}. ` +
      `${r.blockedCount} looked like advertising or tracking and will be blocked.`;
  found.appendChild(summary);

  if (r.allowHosts.length) {
    const hosts = document.createElement('div');
    hosts.className = 'lib-hosts';
    hosts.textContent = r.allowHosts.join('  ·  ');
    found.appendChild(hosts);
  }

  el('form-fields').hidden = false;
  fillFormFields();
  buildShapePicker();
  updatePreview();
  validateForm();
  el('form-name').focus();
}


/**
 * Unlocking opens the panel directly.
 *
 * Managing games is the only reason a parent comes here often, so a menu whose
 * two options were "manage games" and "quit" was a screen that existed to be
 * clicked through. Quit now lives at the bottom of the panel, separated.
 */
/**
 * What happens after unlocking depends on why the gate was opened.
 *
 * Close asked to quit, so it quits. Sending it to the portal to hunt for a quit
 * button was an extra step for no reason.
 */
async function afterUnlock () {
  el('gate-error').textContent = '';

  if (gateIntent === 'quit') {
    const r = await api.quitApp();
    if (r && r.ok) return;
    showToast((r && r.message) || 'Could not quit.');
  }

  el('gate-step-hold').hidden = true;
  el('gate-step-answer').hidden = true;
  el('gate-step-library').hidden = false;
  libCard().classList.add('is-wide');
  loadLibrary();
  el('lib-done').focus();
  startPortalHeartbeat();
}

/** Keeps the unlock alive while a parent is still on a parent screen. */
let portalBeat = null;
function startPortalHeartbeat () {
  clearInterval(portalBeat);
  portalBeat = setInterval(() => {
    if (app.dataset.mode !== 'gate') {
      clearInterval(portalBeat);
      portalBeat = null;
      return;
    }
    api.keepUnlocked();
  }, 25_000);
}

async function submitAnswer () {
  const value = el('gate-input').value.trim();
  if (!value) return;
  const result = await api.answerGate(value);
  if (result && result.ok) {
    // Unlocking decides nothing by itself. The grown-up picks what happens next.
    afterUnlock();
    return;
  }
  el('gate-input').value = '';
  el('gate-error').textContent = (result && result.message) || 'Not quite.';
  if (result && result.locked) {
    el('gate-step-hold').hidden = false;
    el('gate-step-answer').hidden = true;
    el('hold-fill').style.height = '0%';
  }
}

function buildKeypad () {
  const pad = el('keypad');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'ok'];

  for (const key of keys) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'key';

    if (key === 'clear') {
      btn.classList.add('key--wide');
      btn.textContent = 'Clear';
      btn.addEventListener('click', () => { el('gate-input').value = ''; });
    } else if (key === 'ok') {
      btn.classList.add('key--ok');
      btn.textContent = 'OK';
      btn.addEventListener('click', submitAnswer);
    } else {
      btn.textContent = key;
      btn.addEventListener('click', () => {
        const input = el('gate-input');
        if (input.value.length < 12) input.value += key;
      });
    }
    pad.appendChild(btn);
  }
}

/* ---------------- toast ---------------- */

function showToast (message) {
  const toast = el('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

/* ---------------- wiring ---------------- */

function wire () {
  on('home-btn', 'click', () => api.goHome());
  // Two controls, the same pair on both screens. Close means quit -- it does
  // not detour through the portal to find a quit button.
  on('parent-btn', 'click', () => api.openGate('portal'));
  on('close-btn', 'click', () => api.openGate('quit'));
  on('exit-btn', 'click', () => api.openGate('portal'));
  on('bar-close-btn', 'click', () => api.openGate('quit'));
  on('empty-add', 'click', () => api.openGate('portal'));

  on('ob-parent', 'click', () => obShow(2));
  on('ob-child', 'click', finishOnboarding);
  on('ob-next-2', 'click', () => obShow(3));
  on('ob-next-3', 'click', () => obShow(4));
  on('ob-back-1', 'click', () => obShow(1));
  on('ob-back-2', 'click', () => obShow(2));
  on('ob-done', 'click', finishOnboarding);

  const obHold = el('ob-hold');
  obHold.addEventListener('pointerdown', obPractiseHold);
  obHold.addEventListener('pointerup', obCancelHold);
  obHold.addEventListener('pointerleave', obCancelHold);
  obHold.addEventListener('pointercancel', obCancelHold);
  on('gate-cancel', 'click', () => api.closeGate());

  on('choice-quit', 'click', async () => {
    const btn = el('choice-quit');
    btn.disabled = true;
    btn.textContent = 'Quitting…';
    const r = await api.quitApp();
    if (!r || !r.ok) {
      btn.disabled = false;
      btn.textContent = 'Quit Sukhi Play';
      showToast((r && r.message) || 'Could not quit.');
    }
  });
  on('lib-done', 'click', () => api.closeGate());
  on('gate-cancel-pin', 'click', () => api.closeGate());
  on('add-new', 'click', () => openForm('address'));

  on('form-close', 'click', closeForm);
  on('form-cancel', 'click', closeForm);
  on('form-save', 'click', saveForm);
  on('form-delete', 'click', deleteFromForm);
  on('form-check', 'click', checkSite);
  on('form-url', 'keydown', (e) => { if (e.key === 'Enter') checkSite(); });

  on('form-name', 'input', () => { updatePreview(); validateForm(); });
  on('form-addr', 'input', validateForm);
  on('form-allow', 'input', validateForm);
  on('form-blockads', 'change', () => {
    el('form-blockads-text').textContent =
      el('form-blockads').checked ? 'Filtering ads' : 'Ads left on';
  });

  const hold = el('hold-btn');
  hold.addEventListener('pointerdown', startHold);
  hold.addEventListener('pointerup', cancelHold);
  hold.addEventListener('pointerleave', cancelHold);
  hold.addEventListener('pointercancel', cancelHold);

  on('gate-input', 'keydown', (e) => {
    if (e.key === 'Enter') submitAnswer();
  });

  buildKeypad();

  // Reachable so the screenshot tooling can populate the portal before
  // capturing it. Nothing in the app itself uses this.
  window.__loadLibrary = loadLibrary;

  api.on('state', applyState);
  api.on('apps', (payload) => renderTiles(payload.apps || []));
  api.on('toast', (payload) => showToast(payload.message));
}

async function boot () {
  const startedAt = Date.now();
  wire();

  config = await api.ready();
  renderTiles(config.apps);

  el('version').textContent = `v${config.version}`;
  el('hold-secs').textContent = String(config.settings.holdSeconds);

  // Hold the splash briefly so it reads as a loading screen rather than a blink.
  // Under --check the main process drives instead, so skip it entirely.
  const elapsed = Date.now() - startedAt;
  if (config.checkMode) {
    api.rendererIdle();
  } else if (config.needsOnboarding) {
    el('ob-chord').textContent =
      navigator.platform.toLowerCase().includes('mac') ? 'Cmd+Shift+X' : 'Ctrl+Shift+X';
    setTimeout(startOnboarding, Math.max(0, MIN_SPLASH_MS - elapsed));
  } else {
    setTimeout(() => api.goHome(), Math.max(0, MIN_SPLASH_MS - elapsed));
  }

  applyState(config.state);

  // Tell the main process the launcher is up. Until this arrives a watchdog is
  // waiting to tear the lockdown down.
  //
  // Deliberately NOT inside requestAnimationFrame: rAF does not fire while the
  // window is hidden or occluded, so tying this to a paint meant a backgrounded
  // start never reported ready and the watchdog released the lockdown on a
  // perfectly healthy app.
  api.rendererReady();
}

boot().catch((err) => {
  console.error('[shell] boot failed', err);
  // Show the failure over the interface rather than in place of it: wiping the
  // document also destroys every element, which turns one small fault into a
  // blank screen and a pile of null references.
  const note = document.createElement('div');
  note.className = 'boot-failure';
  note.textContent = 'Sukhi Play could not start properly. ' + (err && err.message ? err.message : '');
  document.body.appendChild(note);
});
