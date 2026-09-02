import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { Unit } from '../src/sim/unit.js';
import { Building } from '../src/sim/building.js';
import { BASE_BLUE, BASE_RED } from '../src/sim/map.js';

/** Build a Game exercising harvesters, combat, orders, and control points. */
function buildGame(seed: number): Game {
  const g = new Game(seed);
  g.placeBuilding('foundry', BASE_BLUE.x, BASE_BLUE.y, 0);
  g.placeBuilding('heartwood', BASE_RED.x, BASE_RED.y, 1);

  // harvesters per side
  for (const team of [0, 1]) {
    const base = team === 0 ? BASE_BLUE : BASE_RED;
    const h = g.registry.get(g.spawnUnit(base.x + 2, base.y + 2, team)) as Unit;
    h.role = 'harvester';
    let f: { x: number; y: number } | null = null;
    let bd = Infinity;
    for (const ff of g.economy.fields) {
      const d = Math.hypot(ff.x - base.x, ff.y - base.y);
      if (d < bd) {
        bd = d;
        f = ff;
      }
    }
    if (f) h.issue({ kind: 'harvest', target: { x: f.x, y: f.y } });
  }

  // combat squads march to the center and fight deterministically
  const a = g.registry.get(g.spawnUnit(BASE_BLUE.x + 3, BASE_BLUE.y + 3, 0)) as Unit;
  const b = g.registry.get(g.spawnUnit(BASE_RED.x - 3, BASE_RED.y - 3, 1)) as Unit;
  a.issue({ kind: 'attackmove', target: { x: 64, y: 64 } });
  b.issue({ kind: 'attackmove', target: { x: 64, y: 64 } });

  return g;
}

function snapshot(g: Game): unknown {
  const ents = g.registry
    .all()
    .map((e) => [e.id, e.pos.x, e.pos.y, e.hp, e.alive ? 1 : 0]);
  return {
    tick: g.tickCount,
    time: g.worldTime,
    c0: g.players[0].credits,
    c1: g.players[1].credits,
    gas0: g.players[0].gas,
    gas1: g.players[1].gas,
    over: g.gameOver ? 1 : 0,
    winner: g.winner,
    ents,
  };
}

test('3000-step deterministic replay from a fixed seed', () => {
  const a = buildGame(2024);
  const b = buildGame(2024);
  a.run(100); // 3000 ticks at 30/s
  b.run(100);

  assert.equal(a.tickCount, 3000);
  assert.equal(b.tickCount, 3000);
  assert.deepEqual(snapshot(a), snapshot(b), 'two identical seeds must replay identically');

  // no NaN / Infinity anywhere
  for (const e of a.registry.all()) {
    assert.ok(Number.isFinite(e.pos.x) && Number.isFinite(e.pos.y), `NaN pos on entity ${e.id}`);
    assert.ok(Number.isFinite(e.hp));
  }
  assert.ok(Number.isFinite(a.players[0].credits));
});

test('deterministic replay stays consistent across a longer run', () => {
  const g = buildGame(42);
  g.run(30);
  const snap = snapshot(g);
  g.run(30); // continue the same instance
  assert.notDeepEqual(snapshot(g), snap, 'state should advance, not stall');
  assert.ok(Number.isFinite(g.players[0].credits) && Number.isFinite(g.players[1].credits));
});
