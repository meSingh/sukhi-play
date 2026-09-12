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

module.exports = {
  normalizeHost,
  hostFromUrl,
  matchesPattern,
  matchesAny,
  createHostGate
};
