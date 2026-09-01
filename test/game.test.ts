import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { BASE_BLUE, BASE_RED } from '../src/sim/map.js';

test('game: constructed deterministically from a seed', () => {
  const a = new Game(2024);
  const b = new Game(2024);
  assert.deepEqual(a.map.serialize(), b.map.serialize());
  assert.equal(a.players.length, 2);
  assert.equal(a.players[0].team, 0);
  assert.equal(a.players[1].team, 1);
});

test('game: run() produces identical state for identical seeds (determinism)', () => {
  const run = (seed: number) => {
    const g = new Game(seed);
    g.spawnUnit(BASE_BLUE.x, BASE_BLUE.y, 0);
    g.spawnUnit(BASE_RED.x, BASE_RED.y, 1);
    g.run(33.33); // ~1000 ticks at 30/s
    return {
      ticks: g.tickCount,
      worldTime: g.worldTime,
      map: g.map.serialize(),
      units: g.registry.all().map((e) => ({ x: e.pos.x, y: e.pos.y, team: e.team, alive: e.alive })),
    };
  };
  const a = run(2024);
  const b = run(2024);
  assert.deepEqual(a, b);
});

test('game: run() advances the expected tick count and world time', () => {
  const g = new Game(42);
  const ticks = g.run(1.0);
  assert.equal(ticks, 30);
  assert.equal(g.tickCount, 30);
  assert.ok(Math.abs(g.worldTime - 1.0) < 1e-6);
});

test('game: no NaN/Infinity in entity transforms after a long run', () => {
  const g = new Game(7);
  g.spawnUnit(BASE_BLUE.x, BASE_BLUE.y, 0);
  g.spawnBuilding(BASE_RED.x, BASE_RED.y, 1);
  g.run(100);
  for (const e of g.registry.all()) {
    assert.ok(Number.isFinite(e.pos.x) && Number.isFinite(e.pos.y), `entity ${e.id} has NaN pos`);
    assert.ok(Number.isFinite(e.facing));
  }
});

test('game: spawn helpers assign distinct ids and register entities', () => {
  const g = new Game(1);
  const id1 = g.spawnUnit(5, 5, 0);
  const id2 = g.spawnBuilding(6, 6, 1);
  assert.ok(id1 !== id2);
  assert.equal(g.registry.size, 2);
  assert.equal(g.registry.get(id1)!.team, 0);
  assert.equal(g.registry.get(id2)!.team, 1);
});
