// Screen-time rules, with a simulated clock. Run with:  node --test tests/unit/usageTracker.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createUsageTracker, istDay, TICK_MS, ACTIVE_WINDOW_MS, NEW_VISIT_AFTER_MS } from '../../src/lib/usageTracker.js';

function rig(startMs = Date.UTC(2026, 10, 10, 6, 0, 0)) { // 11:30 IST, mid-day
  let t = startMs; let visible = true; const sent = [];
  const tr = createUsageTracker({ now: () => t, isVisible: () => visible, send: (b, o) => sent.push({ ...b, final: !!o.final }), getHints: () => ({ viewport_w: 390 }) });
  return {
    tr, sent,
    advance: (ms) => { t += ms; },
    setVisible: (v) => { visible = v; },
    // simulate `seconds` of real time in 5s ticks; `touch` = the person interacts every tick
    run(seconds, { touch = true } = {}) { for (let s = 0; s < seconds; s += TICK_MS / 1000) { t += TICK_MS; if (touch) tr.input(); tr.tick(); } },
    now: () => t,
  };
}

test('nothing is reported until the person actually uses the app', () => {
  const r = rig(); r.run(120, { touch: false });
  assert.equal(r.sent.length, 0);
  assert.equal(r.tr._state().sid, null);
  assert.equal(r.tr._state().activeMs, 0);
});

test('continuous use adds up second for second, first report goes out at once with the device facts, then every 30 s', () => {
  const r = rig(); r.tr.input();
  r.run(65);
  assert.equal(r.tr._state().activeMs, 65000);
  assert.deepEqual(r.sent.map((s) => s.active_s), [5, 35, 65]);       // after 5s, then each 30s
  assert.deepEqual(r.sent[0].hints, { viewport_w: 390 });              // facts only on the first report
  assert.equal(r.sent[1].hints, undefined);
  assert.equal(new Set(r.sent.map((s) => s.sid)).size, 1);             // one visit
});

test('a screen left on with nobody touching it stops counting after 60 s of silence', () => {
  const r = rig(); r.tr.input();
  r.run(20);                          // 20 s of real use
  r.run(300, { touch: false });       // then 5 minutes with no interaction
  // time counted = 20 s of use + the 60 s window after the last touch (each tick inside the window counts), never the rest
  const ms = r.tr._state().activeMs;
  assert.ok(ms >= 20000 + ACTIVE_WINDOW_MS - TICK_MS && ms <= 20000 + ACTIVE_WINDOW_MS + TICK_MS, `counted ${ms} ms`);
});

test('a hidden tab adds nothing, even if the person touched it a moment ago', () => {
  const r = rig(); r.tr.input(); r.run(10);
  r.setVisible(false); r.run(50);
  assert.equal(r.tr._state().activeMs, 10000);
  r.setVisible(true); r.run(10);
  assert.equal(r.tr._state().activeMs, 20000);
});

test('a device that slept is not credited the sleep: waking up adds one tick, never the hours', () => {
  const r = rig(); r.tr.input(); r.run(10);               // 10 s of real use
  r.advance(3 * 3600 * 1000);                              // lid closed for 3 hours
  r.tr.input(); r.tr.tick();                               // the person opens it and taps
  assert.equal(r.tr._state().activeMs, 10000 + TICK_MS);   // 10 s + one tick, not 3 hours
});

test('30 minutes of silence ends the visit (final report sent); the next use starts a new one', () => {
  const r = rig(); r.tr.input(); r.run(40);
  const firstSid = r.sent[0].sid;
  r.advance(NEW_VISIT_AFTER_MS + 1000); r.tr.tick();     // quiet, long
  assert.ok(r.sent[r.sent.length - 1].final === true || r.sent.at(-1).active_s === 40);
  assert.equal(r.tr._state().sid, null);
  r.tr.input(); r.run(10);
  assert.notEqual(r.tr._state().sid, firstSid);
  assert.equal(r.tr._state().activeMs, 10000);            // counting restarts from zero
});

test('at Indian midnight a new visit starts, so no time lands on the wrong day', () => {
  // 23:59:30 IST on 10 Nov = 18:29:30 UTC
  const r = rig(Date.UTC(2026, 10, 10, 18, 29, 30)); r.tr.input();
  r.run(20);
  const before = r.tr._state();
  assert.equal(before.day, '2026-11-10');
  r.run(20);                                              // crosses 00:00 IST
  const after = r.tr._state();
  assert.equal(after.day, '2026-11-11');
  assert.notEqual(after.sid, before.sid);
  assert.ok(after.activeMs <= 20000);
  const sids = [...new Set(r.sent.map((s) => s.sid))];
  assert.equal(sids.length, 2);
  // the old visit's last report is flagged final and carries only the pre-midnight time
  const oldFinal = r.sent.filter((s) => s.sid === before.sid).at(-1);
  assert.equal(oldFinal.final, true);
  assert.ok(oldFinal.active_s <= 30);
});

test('flush (tab hidden / page closing) sends the latest total once, and never repeats an unchanged one', () => {
  const r = rig(); r.tr.input(); r.run(12);
  const n = r.sent.length;
  r.tr.flush();
  assert.equal(r.sent.length, n + 1);
  assert.equal(r.sent.at(-1).final, true);
  assert.equal(r.sent.at(-1).active_s, 15);                // 3 ticks of 5 s had been counted, only 5 s was reported so far
  r.tr.flush();                                           // nothing changed
  assert.equal(r.sent.length, n + 1);
});

test('a failing sender never breaks the app or the counting', () => {
  let t = Date.UTC(2026, 10, 10, 6, 0, 0);
  const tr = createUsageTracker({ now: () => t, send: () => { throw new Error('network'); } });
  tr.input();
  for (let i = 0; i < 20; i += 1) { t += TICK_MS; tr.input(); assert.doesNotThrow(() => tr.tick()); }
  assert.equal(tr._state().activeMs, 100000);
});

test('istDay converts a UTC instant to the Indian calendar day', () => {
  assert.equal(istDay(Date.UTC(2026, 10, 10, 18, 29, 59)), '2026-11-10');
  assert.equal(istDay(Date.UTC(2026, 10, 10, 18, 30, 0)), '2026-11-11');
  assert.equal(istDay(Date.UTC(2026, 0, 1, 0, 0, 0)), '2026-01-01');
});
