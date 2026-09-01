import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/util/rng.js';

test('RNG: same seed produces the identical sequence (determinism)', () => {
  const a = new RNG(42);
  const b = new RNG(42);
  const seqA = a.sequence(100);
  const seqB = b.sequence(100);
  assert.deepEqual(seqA, seqB);
});

test('RNG: different seeds diverge', () => {
  const a = new RNG(1);
  const b = new RNG(2);
  const seqA = a.sequence(50);
  const seqB = b.sequence(50);
  assert.notDeepEqual(seqA, seqB);
});

test('RNG: outputs stay in [0,1)', () => {
  const rng = new RNG(7);
  for (let i = 0; i < 1000; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('RNG: int() is in [min,max] inclusive', () => {
  const rng = new RNG(11);
  for (let i = 0; i < 1000; i++) {
    const v = rng.int(3, 9);
    assert.ok(v >= 3 && v <= 9, `out of range: ${v}`);
  }
});

test('RNG: deterministic across full replay (run twice, compare)', () => {
  const run = (seed: number) => {
    const rng = new RNG(seed);
    const out: number[] = [];
    for (let i = 0; i < 500; i++) {
      out.push(rng.next());
      out.push(rng.int(0, 100));
    }
    return out;
  };
  assert.deepEqual(run(2024), run(2024));
});
