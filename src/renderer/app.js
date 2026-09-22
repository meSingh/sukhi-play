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
// True once a grown-up has answered, so a later message from main does not
// put the question back up over the screen they just opened.
let gatePassed = false;
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

    // A white coin with our own shape on it. Sites' own icons are not used:
    // a favicon is someone else's mark, and this app has no licence for one.
    const badge = document.createElement('span');
    badge.className = 'tile-badge';
    badge.appendChild(shapeIcon(entry.shape));

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

/**
 * The waiting screen, between pressing a tile and the page being ready.
 *
 * It wears the tile's own colour and picture, so the wait belongs to the thing
 * the child just pressed rather than being a generic spinner they have no
 * reason to connect with it.
 */
function paintLoading (state) {
  const on = Boolean(state.loading);
  app.classList.toggle('is-loading', on);
  if (!on) return;

  const info = state.loadingApp || {};
  const badge = el('loading-badge');
  const name = el('loading-name');
  if (!badge || !name) return;

  // Only repaint when it is a different app, so the bob does not restart on
  // every state push while a slow site is still coming.
  if (badge.dataset.for === (info.title || '')) return;
  badge.dataset.for = info.title || '';

  badge.style.setProperty('--load-color', info.color || '');
  app.style.setProperty('--load-color', info.color || '');
  badge.textContent = '';
  badge.appendChild(shapeIcon(info.shape));
  name.textContent = info.title || 'Opening';
}


function applyState (state) {
  if (!state) return;
  app.dataset.mode = state.mode;
  if (state.gateIntent) gateIntent = state.gateIntent;
  if (state.mode === 'gate' && !gatePassed) describeGate();

  paintLoading(state);

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

  applyClock(state.clock);

  if (state.mode !== 'gate') resetGate();
}

/**
 * Moves between the four places in the grown-up screen.
 *
 * Without a script there are no tabs to press and every panel is simply on the
 * page, which is the old behaviour and still usable.
 */
function showPortalTab (name) {
  // The form is a panel like any other, but it is not a tab: it opens from a
  // card and the tab it came from stays lit, so a parent can see where they
  // are and get back with one press.
  if (name !== 'form') portalTab = name;
  for (const tab of document.querySelectorAll('#portal-tabs button')) {
    tab.classList.toggle('on', tab.dataset.tab === portalTab);
  }
  for (const panel of document.querySelectorAll('.portal-panel')) {
    panel.hidden = panel.dataset.panel !== name;
  }
}
let portalTab = 'time';

/** Lights the way in that is set. Each card already says what it does. */
function paintGateMode () {
  const mode = (config && config.settings.gateMode) || 'hold';
  for (const b of document.querySelectorAll('#gate-mode .way')) {
    b.classList.toggle('on', b.dataset.mode === mode);
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  }
}

/* ---------------- the play clock ---------------- */

/**
 * The countdown a child can watch, and the session controls a parent uses.
 *
 * Main owns the time and sends the state; this only counts the seconds down
 * between those messages so the display does not sit still for half a minute.
 * Every message from main resets it, so the two cannot drift apart.
 */
let clockLeft = null;
let clockLimit = 0;
let clockTimer = 0;

/**
 * When the countdown appears.
 *
 * A clock on screen all session is a thing to watch and then argue about, so
 * it stays away until the end is close enough to mean something: the last ten
 * seconds of a short session, the last thirty of a longer one.
 */
function showFrom (limitSeconds) {
  return limitSeconds <= 300 ? 10 : 30;
}

function paintClock () {
  const show = clockLeft !== null && clockLeft <= showFrom(clockLimit);
  for (const id of ['bar-time', 'top-time']) {
    const pill = el(id);
    if (!pill) continue;
    pill.hidden = !show;
    if (!show) continue;
    pill.querySelector('b').textContent = formatLeft(clockLeft);
    pill.classList.toggle('is-last', clockLeft <= 10);
  }
}

function formatLeft (seconds) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/** "45 minutes", "1 hour", "1 hour 30 minutes". Plain, for a parent to read. */
function describeMinutes (total) {
  const n = Number(total) || 0;
  const hours = Math.floor(n / 60);
  const mins = n % 60;
  const parts = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (mins) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);
  return parts.join(' ') || '0 minutes';
}

function applyClock (clock) {
  const timeUp = Boolean(clock && clock.timeUp);
  app.classList.toggle('is-timeup', timeUp);

  clearInterval(clockTimer);
  clockTimer = 0;

  // A grown-up waved the rest of the day through. The rule is still set, and
  // the chips still show it, but nothing is counting down today.
  const freeToday = Boolean(clock && clock.unlimited);
  const limited = Boolean(clock && clock.limitSeconds) && !freeToday;
  clockLimit = limited ? clock.limitSeconds : 0;
  clockLeft = limited && !timeUp ? Math.max(0, clock.leftSeconds || 0) : null;
  paintClock();

  if (clockLeft !== null) {
    clockTimer = setInterval(() => {
      if (clockLeft === null || clockLeft <= 0) return;
      clockLeft -= 1;
      paintClock();
      // Main is the authority and its message is milliseconds behind, but a
      // countdown that sits on 0:00 while play carries on looks broken.
      if (clockLeft === 0) {
        clockLeft = null;
        paintClock();
        app.classList.add('is-timeup');
      }
    }, 1000);
  }

  const state = el('time-state');
  if (state && clock) {
    state.textContent = freeToday
      ? 'No limit for the rest of today'
      : !limited
        ? 'No limit set'
        : timeUp
          ? 'Time is up'
          : `${Math.ceil((clock.leftSeconds || 0) / 60)} min left in this session`;
  }
  paintChips(clock ? Math.round((clock.limitSeconds || 0) / 60) : 0);
}

/** Shows which session length is the current one, preset or not. */
function paintChips (minutes) {
  let matched = false;
  for (const chip of document.querySelectorAll('#time-chips button')) {
    const on = Number(chip.dataset.min) === minutes;
    chip.classList.toggle('is-on', on);
    matched = matched || on;
  }
  const input = el('time-input');
  if (input) input.value = matched || !minutes ? '' : String(minutes);
}

/** One way in for the presets and the number field alike. */
async function setSessionMinutes (value) {
  const minutes = Math.round(Number(value));
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 240) {
    return showToast('Pick anything from 1 to 240 minutes.');
  }
  const r = await api.setSessionMinutes(minutes);
  if (!r || !r.ok) return showToast((r && r.message) || 'Could not save that.');
  config.settings.sessionMinutes = r.sessionMinutes;
  applyClock(r.clock);
  showToast(r.sessionMinutes
    ? `Play stops after ${r.sessionMinutes} minutes.`
    : 'Play time is not limited.');
}

/* ---------------- the grown-up gate ---------------- */

/**
 * Says what the gate is guarding.
 *
 * Pressing Close and being asked "Grown-ups only" tells a parent nothing about
 * what is about to happen. Quitting now asks to confirm quitting.
 */
async function describeGate () {
  const quitting = gateIntent === 'quit';
  const seconds = config ? config.settings.holdSeconds : 3;

  // When the way in is a sum, the sum is the way in: there is no hold first.
  if (config && config.settings.gateMode === 'sum') {
    el('gate-step-hold').hidden = true;
    el('gate-answer-title').textContent = quitting ? 'Close Sukhi Play?' : 'Grown-ups only';
    const r = await api.gateQuestion();
    el('gate-prompt').textContent = (r && r.prompt) || (r && r.message) || 'One moment.';
    el('gate-step-answer').hidden = false;
    el('gate-input').value = '';
    el('gate-input').focus();
    return;
  }

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
  gatePassed = false;
  clearInterval(holdTimer);
  holdTimer = null;
  el('hold-fill').style.height = '0%';
  el('gate-step-hold').hidden = false;
  el('gate-step-answer').hidden = true;
  el('gate-step-library').hidden = true;
  el('gate-step-time').hidden = true;
  el('gate-step-form').hidden = true;
  libCard().classList.remove('is-portal');
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

  if (result.needsAnswer || result.needsPin) {
    el('gate-answer-title').textContent = 'Enter your PIN';
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
    if (sug.official) meta.appendChild(officialBadge());
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

/**
 * The badge on an app Sukhi Play made itself.
 *
 * It answers the question a parent has about an app they did not choose: who
 * made this, and is it safe. Official, a shield, and the two promises that
 * matter most -- no adverts, no tracking -- in words rather than in a tooltip,
 * because a tooltip is not there on a touch screen.
 */
function officialBadge () {
  const b = document.createElement('span');
  b.className = 'lib-official';
  b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2 2.6 3.3v4.1c0 3.3 2.3 6.2 5.4 7.4 3.1-1.2 5.4-4.1 5.4-7.4V3.3z" fill="currentColor"/><path d="m5.4 8 1.8 1.8 3.4-3.6" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  b.append('Official');
  b.title = 'Made by Sukhi Play. No adverts, no tracking.';
  return b;
}

/** The line under an official app's name, where other apps show an address. */
// Non-breaking inside each phrase, so a narrow card wraps between them and
// never leaves "No" at the end of one line and "tracking" on the next.
const OFFICIAL_LINE = ['By Sukhi Play', 'No ads', 'No tracking']
  .map((p) => p.replace(/ /g, '\u00a0')).join(' · ');

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
  // The tab stays whether or not anything is left to add, because a tab that
  // comes and goes is a tab a parent stops trusting.
  el('catalog-empty').hidden = data.suggestions.length > 0;
}

/* --- what is set up --- */

function appArtwork (entry, size) {
  const art = document.createElement('span');
  art.className = 'art';
  art.style.setProperty('--art', entry.color);
  if (size) art.style.setProperty('--art-size', size + 'px');

  const coin = document.createElement('span');
  coin.className = 'art-coin';
  coin.appendChild(shapeIcon(entry.shape));
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

    // Top row: whether adverts will reach the child, and whether the app is
    // on the tiles at all. Both are things a parent scans for, so neither is
    // buried in the body of the card.
    const top = document.createElement('div');
    top.className = 'app-top';

    if (entry.official) {
      top.appendChild(officialBadge());
    } else if (!entry.blockAds) {
      const flag = document.createElement('span');
      flag.className = 'app-flag';
      flag.textContent = 'Ads showing';
      flag.title = 'Adverts on this site are not filtered';
      top.appendChild(flag);
    } else {
      top.appendChild(document.createElement('span'));
    }

    const toggle = visibilitySwitch(entry);
    toggle.classList.add('app-toggle');
    // The switch sits inside the card, so its clicks must not also open the
    // editor behind it.
    toggle.addEventListener('click', (e) => e.stopPropagation());
    top.appendChild(toggle);

    const name = document.createElement('div');
    name.className = 'app-name';
    name.textContent = entry.title;

    const host = document.createElement('div');
    host.className = 'app-host';
    if (entry.official) {
      host.classList.add('app-host--official');
      host.textContent = OFFICIAL_LINE;
    } else {
      try { host.textContent = new URL(entry.url).hostname; } catch { host.textContent = entry.url; }
    }

    const state = document.createElement('div');
    state.className = 'app-state';
    state.textContent = entry.enabled ? 'On the tiles' : 'Hidden from your child';

    box.append(top, appArtwork(entry, 76), name, host, state);

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
    // The site's own name, because that is what a parent recognises.
    name.textContent = sug.siteName || sug.title;

    const meta = document.createElement('span');
    meta.className = 'card-meta';
    meta.textContent = sug.category;
    if (sug.official) meta.appendChild(officialBadge());
    // "no ads" is true of a bundled app but says the wrong thing: there is
    // nowhere for an advert to come from, and the fact worth showing is that
    // it needs no connection at all.
    meta.appendChild(sug.bundled
      ? tag('works offline', 'lib-tag--inside')
      : sug.adSupported
        ? tag(sug.blockAds === false ? 'ads showing' : 'ads filtered', 'lib-tag--ads')
        : tag('no ads', 'lib-tag--free'));

    const blurb = document.createElement('span');
    blurb.className = 'card-blurb';
    blurb.textContent = sug.blurb || sug.notes || '';

    // Where it actually goes. A parent choosing between two similar names
    // should not have to open the form to find out which site this is.
    const addr = document.createElement('span');
    addr.className = 'card-addr';
    if (sug.bundled) {
      // A bundled app has no address worth printing; its id would just be a
      // word with no meaning to anyone. Say where it came from instead.
      addr.classList.add('card-addr--inside');
      if (sug.official) addr.classList.add('card-addr--official');
      // The same attribution the website carries: whose work it is. The
      // licence is not here -- a parent choosing an app for their child has no
      // use for "MIT", and the notice that actually matters legally lives in
      // NOTICE and in vendor/<app>/LICENSE, where it travels with the code.
      //
      // Except for our own. The catalogue is where a parent decides what to
      // put in front of their child, and for an app made here the thing worth
      // saying is who made it and what it will never do. Where it came from
      // is said on its own page and in NOTICE; it is not a reason to choose it.
      addr.textContent = sug.official ? OFFICIAL_LINE : (sug.credit || 'Included with Sukhi Play');
    } else {
      try { addr.textContent = new URL(sug.url).hostname; } catch { addr.textContent = sug.url; }
    }

    body.append(name, meta);

    // No button: the whole card is the button. A card with one action on it
    // that is not the card itself asks a parent to aim at a small target for
    // no reason.
    const head = document.createElement('span');
    head.className = 'card-head';
    head.append(badge, body);

    card.append(head, blurb, addr);
    // A suggestion is a starting point, not a decision: choosing one opens the
    // same form as anything else so every value can be changed first.
    //
    // Except a bundled app, which has nothing to decide. Its address, hosts
    // and ad setting are all fixed by the fact that it is on this disk, so
    // picking it just installs it.
    card.addEventListener('click', async () => {
      if (!sug.bundled) return openForm('add', sug);
      card.disabled = true;
      const r = await api.addSite({
        title: sug.title, url: sug.url, shape: sug.shape, color: sug.color,
        allowHosts: sug.allowHosts, denyHosts: [], blockAds: true,
        notes: sug.notes, enabled: true
      });
      card.disabled = false;
      if (!r || !r.ok) return showToast((r && r.message) || 'Could not add that.');
      showToast(`${sug.title} added.`);
      await loadLibrary();
      showPortalTab('apps');
    });
    wrap.appendChild(card);
  }
}

/* ---------------- the app form ---------------- */


let form = null;
let probeTimer = null;

const BLANK = {
  id: null, title: '', url: '', shape: 'star', color: '#3B6BFF',
  allowHosts: [], denyHosts: [], blockAds: true, enabled: true
};

function openForm (mode, entry) {
  form = { mode, ...BLANK, ...(entry || {}) };
  if (!form.color) form.color = catalogue.colors[0] || BLANK.color;
  if (!form.shape) form.shape = 'star';

  showPortalTab('form');

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
  // A bundled app is files on this disk. Showing an address field, a host
  // allowlist and an ad-filtering switch for one invites a parent to change
  // settings that mean nothing, and to wonder why they cannot.
  const inside = BUNDLED_URL.test(String(form.url || ''));
  el('form-addr-field').hidden = inside;
  el('form-ads-field').hidden = inside;
  el('form-adv').hidden = inside;
  el('form-inside').hidden = !inside;
  if (inside) {
    el('form-inside').textContent = form.notes ||
      'This app is part of Sukhi Play. It works with no internet connection.';
  }

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
  showPortalTab(portalTab);
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

  for (const shape of (catalogue.shapes.length ? catalogue.shapes : [form.shape])) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (shape === form.shape ? ' is-on' : '');
    b.title = shape;
    b.setAttribute('aria-label', shape);
    b.appendChild(shapeIcon(shape));
    b.addEventListener('click', () => {
      form.shape = shape;
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
  badge.appendChild(shapeIcon(form.shape));

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

// An app that ships inside the download. It has no address to type and no
// hosts to allow, so the checks that apply to a site do not apply to it.
const BUNDLED_URL = /^sukhiplay:\/\/[a-z0-9][a-z0-9-]*\//;

function validateForm () {
  const name = el('form-name').value.trim();
  const url = el('form-addr').value.trim();
  const hosts = linesOf(el('form-allow').value);
  const address = BUNDLED_URL.test(url) || (/^https?:\/\/.+\..+/.test(url) && hosts.length > 0);
  const ok = Boolean(name) && address;
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

  // Any icon an older catalog file still carries is dropped on the next save.
  payload.icon = null;

  const result = form.mode === 'edit'
    ? await api.updateSite(form.id, payload)
    : await api.addSite(payload);

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
  gatePassed = true;
  el('gate-error').textContent = '';

  if (gateIntent === 'quit') {
    const r = await api.quitApp();
    if (r && r.ok) return;
    showToast((r && r.message) || 'Could not quit.');
  }

  el('gate-step-hold').hidden = true;
  el('gate-step-answer').hidden = true;

  // Asking for more time is its own small screen. Dropping a parent into the
  // whole grown-up screen to grant five minutes is a detour.
  if (gateIntent === 'time') {
    // Read the rule off the clock rather than the settings copy: the clock is
    // where the limit actually lives, and it is in every state push.
    const mins = Math.round(clockLimit / 60);
    el('more-standing').textContent = mins
      ? `Your usual play time stays at ${describeMinutes(mins)} a session.`
      : '';
    el('gate-step-time').hidden = false;
    const first = document.querySelector('#more-chips button');
    if (first) first.focus();
    startPortalHeartbeat();
    return;
  }

  el('gate-step-library').hidden = false;
  libCard().classList.add('is-portal');
  showPortalTab('time');
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
  // A wrong answer gets a different pair, so guessing the same number twice
  // cannot work.
  if (result && result.prompt) el('gate-prompt').textContent = result.prompt;
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

  // Two taps, because this throws away every app the parent has set up.
  on('reset-all', 'click', async () => {
    const btn = el('reset-all');
    if (btn.dataset.armed !== 'yes') {
      btn.dataset.armed = 'yes';
      btn.textContent = 'Erase everything?';
      btn.classList.add('is-armed');
      el('update-note').textContent =
        'This removes every app and setting and starts the walkthrough again. It cannot be undone.';
      setTimeout(() => {
        btn.dataset.armed = 'no';
        btn.textContent = 'Start over';
        btn.classList.remove('is-armed');
        el('update-note').textContent = '';
      }, 6000);
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Starting over…';
    const r = await api.resetEverything();
    if (!r || !r.ok) {
      btn.disabled = false;
      btn.dataset.armed = 'no';
      btn.textContent = 'Start over';
      btn.classList.remove('is-armed');
      showToast((r && r.message) || 'Could not reset.');
    }
  });

  on('check-update', 'click', async () => {
    const note = el('update-note');
    note.className = 'update-note';
    note.textContent = 'Checking…';
    const r = await api.checkUpdate();
    if (!r || !r.ok) {
      note.textContent = (r && r.message) || 'Could not check.';
      return;
    }
    if (!r.newer) {
      note.textContent = `You have the latest version (${r.current}).`;
      return;
    }
    note.className = 'update-note is-new';
    note.textContent = `Version ${r.latest} is out. You have ${r.current}. `;
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'link-btn';
    link.textContent = 'Open the download page';
    link.addEventListener('click', () => api.openReleases());
    note.appendChild(link);
  });
  on('gate-cancel-pin', 'click', () => api.closeGate());
  on('add-new', 'click', () => openForm('address'));

  on('timeup-gate', 'click', () => api.openGate('time'));
  // Asking to close goes through the ordinary quit gate, so a child pressing
  // it finds the same hold or sum as anywhere else.
  on('timeup-quit', 'click', () => api.openGate('quit'));

  on('more-quit', 'click', async () => {
    const r = await api.quitApp();
    if (!r || !r.ok) showToast((r && r.message) || 'Could not quit.');
  });

  for (const chip of document.querySelectorAll('#more-chips button')) {
    chip.addEventListener('click', async () => {
      const r = await api.moreTime(chip.dataset.min);
      if (!r || !r.ok) return showToast((r && r.message) || 'Could not add that.');
      applyClock(r.clock);
      api.closeGate();
      showToast(r.whole ? 'No limit for the rest of today.' : `${r.minutes} more minutes.`);
    });
  }

  on('more-cancel', 'click', () => api.closeGate());

  for (const tab of document.querySelectorAll('#portal-tabs button')) {
    tab.addEventListener('click', () => showPortalTab(tab.dataset.tab));
  }

  for (const b of document.querySelectorAll('#gate-mode .way')) {
    b.addEventListener('click', async () => {
      const r = await api.setGateMode(b.dataset.mode);
      if (!r || !r.ok) return showToast((r && r.message) || 'Could not save that.');
      config.settings.gateMode = r.gateMode;
      paintGateMode();
      showToast(r.gateMode === 'sum'
        ? 'A sum is asked after the hold.'
        : 'Holding the button is the whole check.');
    });
  }


  for (const chip of document.querySelectorAll('#time-chips button')) {
    chip.addEventListener('click', () => setSessionMinutes(chip.dataset.min));
  }

  on('time-set', 'click', () => setSessionMinutes(el('time-input').value));
  on('time-input', 'keydown', (e) => {
    if (e.key === 'Enter') setSessionMinutes(el('time-input').value);
  });



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

  // Reachable so the screenshot and demo tooling can drive the portal before
  // capturing it. Nothing in the app itself uses these.
  window.__loadLibrary = loadLibrary;
  window.__showPortalTab = showPortalTab;
  window.__markGatePassed = () => { gatePassed = true; };
  window.__afterUnlock = afterUnlock;
  // Fills the editor with a finished-looking app, so the capture and scroll
  // tooling can see the whole form without a network probe.
  window.__fillDemoForm = () => {
    if (!form) return;
    form.title = 'Demo';
    form.url = 'https://example.com/';
    form.allowHosts = ['example.com'];
    el('form-address').hidden = true;
    el('form-fields').hidden = false;
    fillFormFields();
    buildShapePicker();
    buildColorPicker();
    updatePreview();
    validateForm();
  };

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
  el('check-update').hidden = Boolean(config.storeBuild);
  el('settings-version').textContent = `Sukhi Play v${config.version}`;
  paintChips(config.settings.sessionMinutes || 0);
  paintGateMode();
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
