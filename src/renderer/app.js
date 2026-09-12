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

function resetGate () {
  clearInterval(holdTimer);
  holdTimer = null;
  el('hold-fill').style.height = '0%';
  el('gate-step-hold').hidden = false;
  el('gate-step-answer').hidden = true;
  el('gate-step-library').hidden = true;
  libCard().classList.remove('is-wide');
  el('gate-input').value = '';
  el('gate-error').textContent = '';
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
  showPanel();
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
      : 'You have not added anything yet. You can do that any time from the grown-up screen — press "For grown-ups" on the tile screen.';
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

  for (const sug of data.suggestions) {
    const name = document.createElement('span');
    name.textContent = sug.title;
    name.appendChild(sug.adSupported
      ? tag('has ads', 'lib-tag--ads')
      : tag('no ads', 'lib-tag--free'));

    const add = button(sug.added ? 'Added' : 'Add', sug.added ? '' : 'lib-btn--add', async (e) => {
      e.target.disabled = true;
      const r = await api.addSuggestion(sug.id);
      if (!r || !r.ok) {
        e.target.disabled = false;
        showToast((r && r.message) || 'Could not add that.');
        return;
      }
      obAdded += 1;
      loadObSuggestions();
    });
    add.disabled = sug.added;

    wrap.appendChild(row({ color: sug.color, name, sub: sug.url, note: sug.notes, actions: [add] }));
  }
  obAdded = data.suggestions.filter((x) => x.added).length;
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

/* ---------------- grown-up library ---------------- */

let probeResult = null;

function libCard () { return document.querySelector('.gate-card'); }

function switchTab (name) {
  for (const tab of document.querySelectorAll('.lib-tab')) {
    tab.classList.toggle('is-on', tab.dataset.tab === name);
  }
  el('lib-mine').hidden = name !== 'mine';
  el('lib-add').hidden = name !== 'add';
  el('lib-suggest').hidden = name !== 'suggest';
}

async function loadLibrary () {
  const data = await api.library();
  if (!data || !data.ok) return;
  renderMine(data.mine);
  renderSuggestions(data.suggestions);
}

function dot (color) {
  const d = document.createElement('div');
  d.className = 'lib-dot';
  d.style.background = color;
  return d;
}

function row ({ color, name, sub, note, actions }) {
  const item = document.createElement('div');
  item.className = 'lib-item';

  const body = document.createElement('div');
  body.className = 'lib-body';

  const title = document.createElement('div');
  title.className = 'lib-name';
  title.append(name);

  const subEl = document.createElement('div');
  subEl.className = 'lib-sub';
  subEl.textContent = sub;

  body.append(title, subEl);
  if (note) {
    const n = document.createElement('div');
    n.className = 'lib-note';
    n.textContent = note;
    body.appendChild(n);
  }

  const acts = document.createElement('div');
  acts.className = 'lib-actions';
  for (const a of actions) acts.appendChild(a);

  item.append(dot(color), body, acts);
  return item;
}

function button (label, cls, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'lib-btn' + (cls ? ' ' + cls : '');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function tag (text, cls) {
  const t = document.createElement('span');
  t.className = 'lib-tag' + (cls ? ' ' + cls : '');
  t.textContent = text;
  return t;
}

/**
 * A real switch for visibility, and a delete that asks first.
 *
 * A button reading "On" told a parent the current state but not what pressing
 * it would do, and "Remove" is the label every site on the internet uses for
 * everything. A switch shows state and affordance at once, and delete is
 * irreversible so it takes two taps.
 */
function visibilitySwitch (app) {
  const label = document.createElement('label');
  label.className = 'switch';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = app.enabled;
  input.setAttribute('aria-label', `Show ${app.title} to your child`);

  const track = document.createElement('span');
  track.className = 'switch-track';
  track.appendChild(document.createElement('span')).className = 'switch-knob';

  const text = document.createElement('span');
  text.className = 'switch-text';
  text.textContent = app.enabled ? 'On the tiles' : 'Hidden';

  input.addEventListener('change', async () => {
    input.disabled = true;
    text.textContent = input.checked ? 'On the tiles' : 'Hidden';
    const r = await api.updateSite(app.id, { enabled: input.checked });
    if (!r || !r.ok) {
      input.checked = !input.checked;
      text.textContent = input.checked ? 'On the tiles' : 'Hidden';
      showToast((r && r.message) || 'Could not change that.');
    }
    input.disabled = false;
    loadLibrary();
  });

  label.append(input, track, text);
  return label;
}

function deleteButton (app) {
  let armed = false;
  let timer = null;

  const btn = button('Delete', 'lib-btn--danger', async () => {
    if (!armed) {
      // Nothing here is recoverable, so ask before doing it.
      armed = true;
      btn.textContent = 'Tap to confirm';
      btn.classList.add('is-armed');
      timer = setTimeout(() => {
        armed = false;
        btn.textContent = 'Delete';
        btn.classList.remove('is-armed');
      }, 4000);
      return;
    }

    clearTimeout(timer);
    btn.disabled = true;
    const r = await api.removeSite(app.id);
    if (!r || !r.ok) {
      btn.disabled = false;
      armed = false;
      btn.textContent = 'Delete';
      btn.classList.remove('is-armed');
      showToast((r && r.message) || 'Could not delete that.');
      return;
    }
    loadLibrary();
  });

  btn.title = `Delete ${app.title}`;
  return btn;
}

function renderMine (mine) {
  const wrap = el('lib-mine');
  wrap.textContent = '';

  if (!mine.length) {
    const p = document.createElement('p');
    p.className = 'lib-empty';
    p.textContent = 'Nothing added yet. Pick something from Suggestions, or add a site by address.';
    wrap.appendChild(p);
    return;
  }

  for (const app of mine) {
    const name = document.createElement('span');
    name.textContent = app.title;
    if (!app.blockAds) name.appendChild(tag('ads allowed'));

    wrap.appendChild(row({
      color: app.color,
      name,
      sub: `${app.url}  ·  ${app.hostCount} host${app.hostCount === 1 ? '' : 's'} allowed`,
      actions: [visibilitySwitch(app), deleteButton(app)]
    }));
  }
}

function renderSuggestions (list) {
  const wrap = el('lib-suggest-list');
  wrap.textContent = '';

  const byCategory = new Map();
  for (const s of list) {
    if (!byCategory.has(s.category)) byCategory.set(s.category, []);
    byCategory.get(s.category).push(s);
  }

  for (const [category, items] of byCategory) {
    const head = document.createElement('div');
    head.className = 'lib-cat';
    head.textContent = category;
    wrap.appendChild(head);

    for (const s of items) {
      const name = document.createElement('span');
      name.textContent = s.title;
      name.appendChild(s.adSupported
        ? tag('has ads', 'lib-tag--ads')
        : tag('no ads', 'lib-tag--free'));
      if (!s.blockAds) name.appendChild(tag('left as-is'));

      const add = button(s.added ? 'Added' : 'Add', s.added ? '' : 'lib-btn--add', async (e) => {
        e.target.disabled = true;
        const r = await api.addSuggestion(s.id);
        if (!r || !r.ok) {
          e.target.disabled = false;
          showToast((r && r.message) || 'Could not add that.');
          return;
        }
        loadLibrary();
      });
      add.disabled = s.added;

      wrap.appendChild(row({
        color: s.color, name,
        sub: s.url,
        note: s.notes,
        actions: [add]
      }));
    }
  }
}

/* --- add a site by address --- */

async function checkSite () {
  const url = el('lib-url').value.trim();
  if (!url) return;

  const out = el('lib-result');
  const go = el('lib-check');
  go.disabled = true;
  out.textContent = '';

  const busy = document.createElement('p');
  busy.className = 'lib-spinner';
  busy.textContent = 'Opening the site and watching what it loads. About 15 seconds...';
  out.appendChild(busy);

  const r = await api.probeSite(url);
  go.disabled = false;
  out.textContent = '';

  if (!r || !r.ok) {
    out.textContent = (r && r.message) || 'That site could not be checked.';
    return;
  }

  probeResult = r;

  const summary = document.createElement('p');
  summary.textContent = r.warning
    ? r.warning
    : `Found ${r.hostCount} host${r.hostCount === 1 ? '' : 's'}. ` +
      `${r.blockedCount} looked like advertising or tracking and will be blocked.`;
  out.appendChild(summary);

  const hosts = document.createElement('div');
  hosts.className = 'lib-hosts';
  hosts.textContent = r.allowHosts.join('  ·  ') || '(nothing)';
  out.appendChild(hosts);

  if (!r.allowHosts.length) return;

  const nameRow = document.createElement('div');
  nameRow.className = 'lib-row';
  const nameInput = document.createElement('input');
  nameInput.className = 'lib-input';
  nameInput.value = r.suggestedTitle;
  nameInput.setAttribute('aria-label', 'Name for the tile');
  const addBtn = document.createElement('button');
  addBtn.className = 'lib-go';
  addBtn.type = 'button';
  addBtn.textContent = 'Add';
  addBtn.addEventListener('click', async () => {
    addBtn.disabled = true;
    const res = await api.addSite({
      title: nameInput.value.trim() || r.suggestedTitle,
      url: r.url,
      allowHosts: r.allowHosts,
      iconUrls: r.iconUrls,
      blockAds: true
    });
    if (!res || !res.ok) {
      addBtn.disabled = false;
      showToast((res && res.message) || 'Could not add that.');
      return;
    }
    el('lib-url').value = '';
    out.textContent = '';
    switchTab('mine');
    loadLibrary();
  });
  nameRow.append(nameInput, addBtn);
  out.appendChild(nameRow);
}

/**
 * Unlocking opens the panel directly.
 *
 * Managing games is the only reason a parent comes here often, so a menu whose
 * two options were "manage games" and "quit" was a screen that existed to be
 * clicked through. Quit now lives at the bottom of the panel, separated.
 */
function showPanel () {
  el('gate-error').textContent = '';
  el('gate-step-hold').hidden = true;
  el('gate-step-answer').hidden = true;
  el('gate-step-library').hidden = false;
  libCard().classList.add('is-wide');
  switchTab('mine');
  loadLibrary();
  el('lib-done').focus();
}

async function submitAnswer () {
  const value = el('gate-input').value.trim();
  if (!value) return;
  const result = await api.answerGate(value);
  if (result && result.ok) {
    // Unlocking decides nothing by itself. The grown-up picks what happens next.
    showPanel();
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
  on('exit-btn', 'click', () => api.openGate('quit'));
  on('parent-btn', 'click', () => api.openGate('quit'));
  on('close-btn', 'click', () => api.openGate('quit'));
  on('empty-add', 'click', () => api.openGate('quit'));

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
  on('open-config', 'click', () => api.openConfigFolder());

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
  on('lib-check', 'click', checkSite);
  on('lib-url', 'keydown', (e) => { if (e.key === 'Enter') checkSite(); });
  for (const tab of document.querySelectorAll('.lib-tab')) {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  }

  const hold = el('hold-btn');
  hold.addEventListener('pointerdown', startHold);
  hold.addEventListener('pointerup', cancelHold);
  hold.addEventListener('pointerleave', cancelHold);
  hold.addEventListener('pointercancel', cancelHold);

  on('gate-input', 'keydown', (e) => {
    if (e.key === 'Enter') submitAnswer();
  });

  buildKeypad();

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
  el('config-path').textContent = config.paths.userData;

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

  // Tell the main process the launcher is genuinely on screen. Until this
  // arrives, a watchdog is holding the lockdown open to be released.
  requestAnimationFrame(() => requestAnimationFrame(() => api.rendererReady()));
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
