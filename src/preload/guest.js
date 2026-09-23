'use strict';

/**
 * Runs inside the game page, in an isolated world.
 *
 * The heavy lifting (popups, navigation, requests, dialogs) is all done in the
 * main process, where the page cannot reach it. This file only does the two
 * things that have to happen in the page itself:
 *
 *   1. collapse the empty boxes left behind where an ad was blocked
 *   2. defuse links that would try to leave, so the kid gets no dead clicks
 *
 * It deliberately does not try to patch window.open or friends: with context
 * isolation on it could not reach the page's real globals anyway, and Electron
 * has already refused those at a level the page cannot argue with.
 */

const { contextBridge } = require('electron');

/**
 * Answers a page's request for the whole screen with a prompt "no".
 *
 * Sukhi Play refuses fullscreen on purpose -- it would cover the top bar, the
 * one thing telling a child how to get back. The refusal happens in the main
 * process, but Electron never answers a denied fullscreen request: the page's
 * requestFullscreen() promise stays pending for ever. A page that awaits it
 * before carrying on is then stuck. Magic Smash's Start playing button did
 * exactly that -- it waits for fullscreen, then starts -- so the button did
 * nothing, while a key press, which does not ask, started the game.
 *
 * So the request is refused here, in the page's own world and before its
 * scripts run, with the rejection the Fullscreen API specifies. Every page that
 * handles a refusal carries on, and fullscreenEnabled reads false so a
 * well-behaved page does not offer a full screen button at all. The main
 * process still denies the permission behind this, for any frame this cannot
 * reach.
 */
function refuseFullscreen () {
  try {
    contextBridge.executeInMainWorld({
      func: () => {
        const refuse = function () {
          return Promise.reject(new TypeError('Full screen is not available here.'));
        };
        // The older prefixed forms return nothing rather than a promise.
        const refuseQuietly = function () {};
        if ('requestFullscreen' in Element.prototype) {
          Element.prototype.requestFullscreen = refuse;
        }
        for (const name of ['webkitRequestFullscreen', 'webkitRequestFullScreen']) {
          if (name in Element.prototype) Element.prototype[name] = refuseQuietly;
        }
        for (const name of ['fullscreenEnabled', 'webkitFullscreenEnabled']) {
          try {
            Object.defineProperty(Document.prototype, name, { get: () => false, configurable: true });
          } catch { /* not every engine lets this be redefined; the refusal still holds */ }
        }
      }
    });
  } catch {
    // Without the bridge the main process's denial still applies; the page
    // just waits on its own promise, as it did before this existed.
  }
}

refuseFullscreen();

const COSMETIC_SELECTORS = [
  'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]',
  'iframe[src*="/ads/"]', 'iframe[id^="google_ads"]', 'iframe[id^="aswift"]',
  'ins.adsbygoogle', '#adsBox',
  '[id^="div-gpt-ad"]', '[class^="ad-slot"]', '[class*="advertisement"]',
  '[data-ad-slot]', '[aria-label="Advertisement"]',
  '.adsbox', '.ad-banner', '.ad-container', '.ad-wrapper', '.adunit'
];

function injectCosmeticCss () {
  const declarations = [
    'display: none !important',
    'visibility: hidden !important',
    'height: 0 !important',
    'min-height: 0 !important',
    'max-height: 0 !important'
  ].join('; ');

  const css = COSMETIC_SELECTORS.join(',\n') + ' {\n  ' + declarations + ';\n}\n';

  const style = document.createElement('style');
  style.setAttribute('data-sukhi', 'cosmetic');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
}

/**
 * Rewrites target="_blank" to target="_self". The main process would refuse the
 * popup regardless; doing this means an allowed link still works on the first
 * click instead of appearing broken.
 */
function defuseTargets (root) {
  let changed = 0;
  const anchors = root.querySelectorAll ? root.querySelectorAll('a[target]') : [];
  for (const a of anchors) {
    const target = a.getAttribute('target');
    if (target && target !== '_self') {
      a.setAttribute('target', '_self');
      changed += 1;
    }
  }
  return changed;
}

function start () {
  try {
    injectCosmeticCss();
  } catch { /* page may be mid-teardown */ }

  try {
    defuseTargets(document);
  } catch { /* ignore */ }

  // Sites build their UI after load, so keep watching.
  try {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) {
            try { defuseTargets(node); } catch { /* ignore */ }
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch { /* ignore */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
