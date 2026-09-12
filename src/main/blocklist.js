'use strict';

/**
 * Global ad / tracker / popup denylist.
 *
 * The per-app allowlist in catalog.json is the primary defence and already cuts
 * every third-party host. This list is the second layer: it catches ad hosts
 * that live *inside* an otherwise-essential domain (ads.poki.com), and it means
 * any new site added to the catalog starts with sane blocking even if its
 * allowlist is written loosely.
 *
 * No network fetch, no external filter subscription: this ships with the app and
 * works offline and on first launch.
 */

// Ad networks, exchanges, trackers, and anti-adblock / popunder vendors.
const AD_HOSTS = [
  // --- Google ad stack ---
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'googletagservices.com', 'googletagmanager.com', 'google-analytics.com',
  'analytics.google.com', 'adservice.google.com', '2mdn.net', 'imasdk.googleapis.com',
  'pagead2.googlesyndication.com', 'partner.googleadservices.com',
  // --- Amazon ---
  'amazon-adsystem.com', 'assoc-amazon.com', 'media-amazon.com/ads',
  // --- Big exchanges / SSPs ---
  'adnxs.com', 'appnexus.com', 'rubiconproject.com', 'pubmatic.com',
  'openx.net', 'casalemedia.com', 'criteo.com', 'criteo.net', 'taboola.com',
  'outbrain.com', 'sharethrough.com', 'indexexchange.com', 'smartadserver.com',
  'adform.net', 'adsrvr.org', 'bidswitch.net', 'rlcdn.com', 'demdex.net',
  'everesttech.net', 'adroll.com', 'media.net', 'sovrn.com', 'lijit.com',
  'yieldmo.com', 'triplelift.com', 'teads.tv', 'spotxchange.com', 'spotx.tv',
  'unrulymedia.com', 'districtm.io', 'gumgum.com', 'rhombusads.com',
  'onetag-sys.com', 'pubnative.net', 'smaato.net', 'inmobi.com', 'applovin.com',
  'unityads.unity3d.com', 'ironsrc.com', 'vungle.com', 'chartboost.com',
  // --- Ad delivery / popunder / redirect vendors seen on game portals ---
  'ad-delivery.net', 'ay.delivery', 'btloader.com', 'dns-finder.com',
  'popads.net', 'popcash.net', 'propellerads.com', 'adsterra.com',
  'exoclick.com', 'exosrv.com', 'juicyads.com', 'trafficjunky.com',
  'clickadu.com', 'hilltopads.net', 'adcash.com', 'revcontent.com',
  'mgid.com', 'zedo.com', 'bidvertiser.com', 'adblade.com',
  // --- Analytics / session recording / fingerprinting ---
  'scorecardresearch.com', 'quantserve.com', 'quantcast.com', 'chartbeat.com',
  'hotjar.com', 'fullstory.com', 'mouseflow.com', 'crazyegg.com',
  'segment.io', 'segment.com', 'mixpanel.com', 'amplitude.com',
  'branch.io', 'appsflyer.com', 'adjust.com', 'kochava.com',
  'newrelic.com', 'nr-data.net', 'bugsnag.com', 'sentry.io',
  // --- Social trackers (also a navigation-away risk) ---
  'facebook.net', 'connect.facebook.net', 'facebook.com/tr',
  'ads-twitter.com', 'analytics.twitter.com', 'ct.pinterest.com',
  'snap.licdn.com', 'bat.bing.com', 'clarity.ms',
  // --- Consent / paywall / subscribe nags ---
  'onetrust.com', 'cookielaw.org', 'quantcast.mgr.consensu.org',
  'usercentrics.eu', 'trustarc.com', 'privacy-mgmt.com'
];

// URL path/query fragments that betray an ad or tracking call even on an
// allowlisted host. Kept deliberately narrow to avoid false positives.
const AD_PATH_PATTERNS = [
  '/ads/', '/adserver', '/adservice', '/advert', '/ad-request',
  '/pagead/', '/adsense/', '/doubleclick/', '/prebid',
  '/track/click', '/openrtb', '/vast?', '/vast/', '/vmap?',
  '/analytics/collect', '/collect?v=', '/pixel?', '/beacon?',
  'googlesyndication', 'popunder', 'interstitial-ad'
];

// Resource types that are never needed to make a game work.
const BLOCKED_RESOURCE_TYPES = new Set(['ping', 'cspReport']);

// Ad-slot containers to collapse visually if anything slips through.
// Matched as CSS selectors by the guest preload.
const COSMETIC_SELECTORS = [
  'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]',
  'iframe[src*="/ads/"]', 'iframe[id^="google_ads"]', 'iframe[id^="aswift"]',
  'ins.adsbygoogle', '#adsBox',
  '[id^="div-gpt-ad"]', '[class^="ad-slot"]', '[class*="advertisement"]',
  '[data-ad-slot]', '[aria-label="Advertisement"]',
  '.adsbox', '.ad-banner', '.ad-container', '.ad-wrapper', '.adunit'
];

const { matchesAny, normalizeHost } = require('./hosts');

/**
 * @returns {null | {reason: string, detail: string}} null means "not an ad".
 */
function inspect (url, host, resourceType) {
  if (BLOCKED_RESOURCE_TYPES.has(resourceType)) {
    return { reason: 'resource-type', detail: resourceType };
  }
  const h = normalizeHost(host);
  if (h && matchesAny(h, AD_HOSTS)) {
    return { reason: 'ad-host', detail: h };
  }
  const lower = String(url).toLowerCase();
  for (const fragment of AD_PATH_PATTERNS) {
    if (lower.includes(fragment)) {
      return { reason: 'ad-path', detail: fragment };
    }
  }
  return null;
}

module.exports = {
  AD_HOSTS,
  AD_PATH_PATTERNS,
  COSMETIC_SELECTORS,
  inspect
};
