import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixedLoop, DEFAULT_TICK } from '../src/core/loop.js';

test('FixedLoop: runs exactly seconds/tick steps synchronously', () => {
  let steps = 0;
  const loop = new FixedLoop((_dt: number, _tick: number) => steps++);
  const n = loop.run(1.0); // 1 second at 30 ticks/s
  assert.equal(n, Math.round(1.0 / DEFAULT_TICK));
  assert.equal(steps, n);
});

test('FixedLoop: frame() accumulates and steps deterministically', () => {
  const ticks: number[] = [];
  const loop = new FixedLoop((_dt, tick) => ticks.push(tick));
  loop.start();
  // Feed 3 partial frames totaling exactly one tick
  const partial = DEFAULT_TICK / 3;
  loop.frame(partial);
  loop.frame(partial);
  loop.frame(partial);
  assert.equal(ticks.length, 1);
  assert.equal(ticks[0], 0);
  loop.stop();
});

test('FixedLoop: run() is reproducible (same result twice)', () => {
  const make = () => {
    let count = 0;
    const loop = new FixedLoop(() => count++);
    loop.run(2.5);
    return count;
  };
  assert.equal(make(), make());
});

test('FixedLoop: reset() clears tick counter', () => {
  let count = 0;
  const loop = new FixedLoop(() => count++);
  loop.run(0.5);
  const before = loop.tickCount;
  assert.ok(before > 0);
  loop.reset();
  assert.equal(loop.tickCount, 0);
});
