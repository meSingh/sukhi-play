'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createClock } = require('../src/main/playclock.js');

/** A clock whose "now" we control, so a test never waits for real time. */
function fake (limitMinutes, events = {}) {
  let t = 0;
  const clock = createClock({
    limitMinutes,
    now: () => t,
    onWarn: events.onWarn,
    onTimeUp: events.onTimeUp
  });
  return { clock, advance (seconds) { t += seconds * 1000; clock.tick(); } };
}

test('with no limit set, nothing ever runs out', () => {
  let up = 0;
  const { clock, advance } = fake(0, { onTimeUp: () => { up += 1; } });
  clock.setActive(true);
  advance(60 * 60 * 5);
  assert.equal(up, 0);
  assert.equal(clock.isTimeUp(), false);
  assert.equal(clock.state().leftSeconds, null);
});

test('time only counts while the child is using the app', () => {
  const { clock, advance } = fake(10);
  clock.setActive(true);
  advance(120);
  // The parent opens the gate: their reading time is not the child's.
  clock.setActive(false);
  advance(600);
  clock.setActive(true);
  advance(60);
  assert.equal(clock.state().usedSeconds, 180);
  assert.equal(clock.state().leftSeconds, 420);
  assert.equal(clock.isTimeUp(), false);
});

test('warnings fire once each, then time runs out', () => {
  const warns = [];
  let up = 0;
  const { clock, advance } = fake(10, {
    onWarn: (left) => warns.push(left),
    onTimeUp: () => { up += 1; }
  });
  clock.setActive(true);
  advance(299);          // 5m01s left, nothing yet
  assert.deepEqual(warns, []);
  advance(2);            // just under five minutes
  assert.equal(warns.length, 1);
  advance(120);          // 2m59s left, between the two warnings
  assert.equal(warns.length, 1);
  advance(120);          // 59s left
  assert.equal(warns.length, 2);
  assert.ok(warns[0] > warns[1], 'five minutes warns before one minute');
  assert.equal(up, 0);
  advance(59);
  assert.equal(up, 1);
  assert.equal(clock.isTimeUp(), true);
  advance(600);
  assert.equal(up, 1, 'time up fires once, not on every tick after');
});

test('a tick that jumps past the last warning still ends the session', () => {
  // A laptop lid closed over the warning point, or a long stall: the warning
  // is skipped rather than fired late, and the session still ends.
  const warns = [];
  let up = 0;
  const { clock, advance } = fake(10, { onWarn: (l) => warns.push(l), onTimeUp: () => { up += 1; } });
  clock.setActive(true);
  advance(600);
  assert.equal(up, 1);
  assert.deepEqual(warns, [], 'no warning fires for time already gone');
});

test('the clock stops dead once time is up', () => {
  const { clock, advance } = fake(1);
  clock.setActive(true);
  advance(60);
  assert.equal(clock.isTimeUp(), true);
  assert.equal(clock.isRunning(), false);
  clock.setActive(true);
  assert.equal(clock.isRunning(), false, 'nothing restarts it but a grown-up');
});

test('a grown-up starting a new session clears everything', () => {
  const warns = [];
  const { clock, advance } = fake(10, { onWarn: (l) => warns.push(l) });
  clock.setActive(true);
  advance(600);
  assert.equal(clock.isTimeUp(), true);

  clock.reset();
  clock.setActive(true);
  assert.equal(clock.isTimeUp(), false);
  assert.equal(clock.state().usedSeconds, 0);
  warns.length = 0;
  advance(540);
  assert.equal(warns.length, 1, 'warnings come again in the new session');
});

test('raising the limit gives back a session that had ended', () => {
  const { clock, advance } = fake(10);
  clock.setActive(true);
  advance(600);
  assert.equal(clock.isTimeUp(), true);

  clock.setLimit(20);
  assert.equal(clock.isTimeUp(), false);
  assert.equal(clock.state().leftSeconds, 600);

  clock.setLimit(0);
  assert.equal(clock.isTimeUp(), false);
  assert.equal(clock.state().leftSeconds, null, 'no limit means no countdown');
});

test('a limit set below the time already played ends the session', () => {
  let up = 0;
  const { clock, advance } = fake(60, { onTimeUp: () => { up += 1; } });
  clock.setActive(true);
  advance(1800);
  clock.setLimit(20);
  clock.tick();
  assert.equal(clock.isTimeUp(), true);
  assert.equal(up, 1);
});
