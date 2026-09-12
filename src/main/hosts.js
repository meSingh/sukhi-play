'use strict';

/**
 * Host matching for the allow/deny lists.
 *
 * A pattern matches a host when it is the host itself or a parent domain of it,
 * so `poki.com` covers `a.poki.com` and `x.y.poki.com` but never `notpoki.com`.
 * Matching is done on labels, not on string suffixes, which is what stops
 * `evil-poki.com` from sneaking past a `poki.com` rule.
 */

function normalizeHost (host) {
  if (typeof host !== 'string') return '';
  let h = host.trim().toLowerCase();
  if (h.endsWith('.')) h = h.slice(0, -1); // fully-qualified trailing dot
  // Strip an IPv6 bracket pair so [::1] and ::1 compare equal.
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  return h;
}

function hostFromUrl (url) {
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return '';
  }
}

function matchesPattern (host, pattern) {
  const h = normalizeHost(host);
  const p = normalizeHost(pattern);
  if (!h || !p) return false;
  if (h === p) return true;
  return h.endsWith('.' + p);
}

function matchesAny (host, patterns) {
  if (!Array.isArray(patterns)) return false;
  for (const pattern of patterns) {
    if (matchesPattern(host, pattern)) return true;
  }
  return false;
}

/**
 * Builds the per-app gatekeeper. `deny` is checked first so an ad subdomain of
 * an otherwise-essential domain (ads.poki.com inside poki.com) still gets cut.
 */
function createHostGate ({ allow = [], deny = [] } = {}) {
  const allowList = allow.map(normalizeHost).filter(Boolean);
  const denyList = deny.map(normalizeHost).filter(Boolean);

  return {
    allowList,
    denyList,
    /** @returns {'allow'|'deny-explicit'|'deny-not-allowed'|'deny-no-host'} */
    verdict (host) {
      const h = normalizeHost(host);
      if (!h) return 'deny-no-host';
      if (matchesAny(h, denyList)) return 'deny-explicit';
      if (matchesAny(h, allowList)) return 'allow';
      return 'deny-not-allowed';
    },
    allows (host) {
      return this.verdict(host) === 'allow';
    }
  };
}

// Suffixes where the registrable name is the last THREE labels, not two.
// A short list covering what a family is realistically going to type. Anything
// missing just means a slightly tighter allowlist, which errs the safe way.
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'gov.uk', 'ac.uk', 'net.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'net.nz', 'org.nz', 'govt.nz',
  'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in',
  'co.za', 'org.za', 'net.za',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'com.mx', 'com.ar', 'com.tr', 'com.sg', 'com.hk', 'com.tw',
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp',
  'co.kr', 'or.kr',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn',
  'com.pl', 'com.ua', 'com.ph', 'com.my', 'com.vn',
  'co.il', 'org.il', 'ac.il'
]);

/**
 * Reduces a host to the name you would actually put on an allowlist.
 *
 *   a.cdn.example.com  -> example.com
 *   foo.example.co.uk  -> example.co.uk
 *
 * Used when turning the hosts a site really loaded into a compact allowlist.
 */
function registrableDomain (host) {
  const h = normalizeHost(host);
  if (!h || h.includes(':')) return h;            // empty, or an IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return h; // an IPv4 literal

  const parts = h.split('.');
  if (parts.length <= 2) return h;

  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

module.exports = {
  registrableDomain,
  MULTI_PART_SUFFIXES,
  normalizeHost,
  hostFromUrl,
  matchesPattern,
  matchesAny,
  createHostGate
};
