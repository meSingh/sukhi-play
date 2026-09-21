'use strict';

/**
 * The play clock: how long a child may use the app before a grown-up is needed
 * again.
 *
 * Time is counted here, in the main process, and never in the page. A site
 * your child is playing shares that page's process, and a clock a game could
 * stop is not a clock.
 *
 * It counts only while the child is actually using the app. The grown-up gate
 * and the portal pause it, so a parent setting up a new site does not spend
 * their child's afternoon.
 *
 * The limit is a session, not a day. Nothing is stored between runs, because a
 * stored daily total invites the question "what counts as a day", and answering
 * it wrongly means telling a two-year-old their time is gone at breakfast.
 */

// Seconds remaining at which a warning fires, longest first. A parent hears
// these and can give a child the usual "two more minutes" before it ends.
const WARN_AT = [300, 60];

const MAX_MINUTES = 240;

function createClock ({ limitMinutes = 0, now = () => Date.now(), onWarn, onTimeUp } = {}) {
  let limit = clampMinutes(limitMinutes) * 60;
  // Time a grown-up granted for this session only. The standing rule in
  // settings is not touched: tomorrow starts from the rule again.
  let bonus = 0;
  // A grown-up who waved the rest of the day through. Only for this run: the
  // next launch starts from the standing rule again, like any other session.
  let unlimited = false;
  let used = 0;
  let since = null;
  let timeUp = false;
  const warned = new Set();

  function clampMinutes (minutes) {
    const n = Number.parseInt(minutes, 10);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(MAX_MINUTES, n);
  }

  /** Folds the time spent in the current active stretch into the total. */
  function settle () {
    if (since === null) return;
    const t = now();
    used += Math.max(0, t - since);
    since = t;
  }

  function usedSeconds () {
    const live = since === null ? 0 : Math.max(0, now() - since);
    return Math.floor((used + live) / 1000);
  }

  function leftSeconds () {
    if (!limit || unlimited) return null;
    return Math.max(0, limit + bonus - usedSeconds());
  }

  function check () {
    if (!limit || unlimited || timeUp) return;
    const left = leftSeconds();
    for (const at of WARN_AT) {
      if (left <= at && !warned.has(at)) {
        warned.add(at);
        // Only one warning per tick, and never one that is already overtaken.
        if (left > 0 && typeof onWarn === 'function') onWarn(left);
        break;
      }
    }
    if (left <= 0) {
      settle();
      since = null;
      timeUp = true;
      if (typeof onTimeUp === 'function') onTimeUp();
    }
  }

  return {
    /** Child is using the app (launcher or a site). The gate pauses it. */
    setActive (active) {
      if (active && !timeUp) {
        if (since === null) since = now();
      } else {
        settle();
        since = null;
      }
      check();
    },

    /** Called once a second while the app runs. */
    tick () { check(); },

    /** A grown-up granting another session from the beginning. */
    reset () {
      used = 0;
      bonus = 0;
      unlimited = false;
      since = null;
      timeUp = false;
      warned.clear();
    },

    /**
     * A grown-up granting more time to the session that just ran out.
     *
     * Only this session: the limit a parent set is the standing rule and stays
     * where it is, so granting ten minutes now does not quietly make every day
     * ten minutes longer.
     */
    extend (minutes) {
      if (!limit) return false;
      // 'day' is the grown-up deciding the clock is not the right tool today.
      // It is still only this session: closing the app puts the rule back.
      if (minutes === 'day') {
        unlimited = true;
        timeUp = false;
        if (since === null) since = now();
        warned.clear();
        return true;
      }
      const add = clampMinutes(minutes);
      if (!add) return false;
      bonus += add * 60;
      timeUp = false;
      // Running out stopped the clock, so granting time starts it again.
      // Waiting for something else to call setActive leaves a clock that looks
      // granted and is not counting.
      if (since === null) since = now();
      // The warnings belong to the new stretch, not the one that just ended.
      warned.clear();
      return true;
    },

    /** The parent changed the limit in the portal. */
    setLimit (minutes) {
      limit = clampMinutes(minutes) * 60;
      if (!limit) {
        timeUp = false;
        warned.clear();
        return;
      }
      if (timeUp && usedSeconds() < limit + bonus) {
        timeUp = false;
        warned.clear();
      }
    },

    isTimeUp: () => timeUp,
    isRunning: () => since !== null,

    state () {
      return {
        limitSeconds: limit,
        bonusSeconds: bonus,
        unlimited,
        usedSeconds: usedSeconds(),
        leftSeconds: leftSeconds(),
        timeUp
      };
    }
  };
}

module.exports = { createClock, WARN_AT, MAX_MINUTES };
