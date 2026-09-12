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
