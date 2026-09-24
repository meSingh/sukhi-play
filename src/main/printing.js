'use strict';

/**
 * Printing, for the apps Sukhi Play made itself, and nobody else.
 *
 * A page's window.print() never opens the system print dialog here: Save as
 * PDF there is a file browser, and on a Mac "Open in Preview" launches another
 * application, both ways out of the kiosk. The guest preload sends the request
 * to the main process instead, and this decides it:
 *
 *   a website                      refused
 *   an official app (ours: true)   printed on the default printer, silently,
 *                                  on A4 with no margins, backgrounds on
 *
 * Silent is the only way to print without a dialog, so it goes to whatever
 * printer the computer already uses. Jazz's Studio draws every sheet in
 * millimetres on an A4 page with its own 10 mm margin, so the paper size and
 * margins here are the ones it was drawn for.
 *
 * Two presses within a few seconds print once. A child who is not sure the
 * first tap worked should not get two sheets for it.
 */

const GAP_MS = 4000;

const OPTIONS = Object.freeze({
  silent: true,
  printBackground: true,
  pageSize: 'A4',
  margins: { marginType: 'none' }
});

/** The official bundled app a URL belongs to, or null. */
function officialFor (url, apps, belongsTo) {
  if (typeof url !== 'string') return null;
  return apps.find((a) => a.official && belongsTo(url, a.id)) || null;
}

/**
 * Makes the handler. `apps` is a function so a later reload of the bundled
 * list is seen; `now` is there for the tests.
 */
function createPrinter ({ apps, belongsTo, now = Date.now }) {
  const last = new WeakMap();

  return function print (contents) {
    const app = officialFor(contents.getURL(), apps(), belongsTo);
    if (!app) return Promise.resolve({ ok: false, reason: 'not-allowed' });

    const t = now();
    if (t - (last.get(contents) || 0) < GAP_MS) {
      return Promise.resolve({ ok: false, reason: 'too-soon' });
    }
    last.set(contents, t);

    return new Promise((resolve) => {
      try {
        contents.print({ ...OPTIONS, margins: { ...OPTIONS.margins } }, (ok, reason) => {
          resolve({ ok: Boolean(ok), app: app.id, reason: ok ? '' : String(reason || 'failed') });
        });
      } catch (err) {
        resolve({ ok: false, app: app.id, reason: String(err && err.message || 'failed') });
      }
    });
  };
}

module.exports = { createPrinter, officialFor, GAP_MS, OPTIONS };
