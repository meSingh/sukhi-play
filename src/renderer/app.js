'use strict';

/* Launcher UI. Talks to the main process only through window.sukhi. */

const api = window.sukhi;

const el = (id) => document.getElementById(id);
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

  if (!apps.length) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent =
      'No games are turned on yet. A grown-up can add them in catalog.json — ' +
      'use the "For grown-ups" button below to find the file.';
    wrap.appendChild(note);
    return;
  }

  for (const entry of apps) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.setAttribute('role', 'listitem');
    tile.style.setProperty('--tile', entry.color);
    tile.dataset.appId = entry.id;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#shape-${entry.shape}`);
    svg.appendChild(use);

    const label = document.createElement('span');
    label.textContent = entry.title;

    tile.append(svg, label);
    tile.addEventListener('click', () => launch(tile, entry.id));
    wrap.appendChild(tile);
  }
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
  el('gate-step-choice').hidden = true;
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
  showChoices();
}

function showChoices () {
  el('gate-error').textContent = '';
  el('gate-step-hold').hidden = true;
  el('gate-step-answer').hidden = true;
  el('gate-step-choice').hidden = false;
  el('choice-quit').focus();
}

async function submitAnswer () {
  const value = el('gate-input').value.trim();
  if (!value) return;
  const result = await api.answerGate(value);
  if (result && result.ok) {
    // Unlocking decides nothing by itself. The grown-up picks what happens next.
    showChoices();
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
  el('home-btn').addEventListener('click', () => api.goHome());
  el('exit-btn').addEventListener('click', () => api.openGate('quit'));
  el('parent-btn').addEventListener('click', () => api.openGate('quit'));
  el('gate-cancel').addEventListener('click', () => api.closeGate());
  el('open-config').addEventListener('click', () => api.openConfigFolder());

  el('choice-quit').addEventListener('click', async () => {
    el('choice-quit').textContent = 'Closing...';
    const r = await api.quitApp();
    if (!r || !r.ok) {
      el('choice-quit').textContent = 'Close Sukhi Play';
      el('gate-error').textContent = (r && r.message) || 'Could not close.';
    }
  });
  el('choice-home').addEventListener('click', () => api.goHomeUnlocked());

  const hold = el('hold-btn');
  hold.addEventListener('pointerdown', startHold);
  hold.addEventListener('pointerup', cancelHold);
  hold.addEventListener('pointerleave', cancelHold);
  hold.addEventListener('pointercancel', cancelHold);

  el('gate-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAnswer();
  });

  buildKeypad();

  api.on('state', applyState);
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
  } else {
    setTimeout(() => api.goHome(), Math.max(0, MIN_SPLASH_MS - elapsed));
  }

  applyState(config.state);
}

boot().catch((err) => {
  console.error('[shell] boot failed', err);
  document.body.textContent = 'Sukhi Play could not start.';
});
