import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { Unit } from '../src/sim/unit.js';
import { Building } from '../src/sim/building.js';
import { RACES } from '../src/sim/races.js';
import { BASE_BLUE, BASE_RED } from '../src/sim/map.js';

function nearestField(g: Game, x: number, y: number, kind: 'ore' | 'gas') {
  let best = null;
  let bestD = Infinity;
  for (const f of g.economy.fields) {
    if (f.kind !== kind || f.amount <= 0) continue;
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best!;
}

function spawnHarvester(g: Game, x: number, y: number, team: number): Unit {
  const u = g.registry.get(g.spawnUnit(x, y, team)) as Unit;
  u.role = 'harvester';
  return u;
}

test('economy: harvester gather→drop cycle yields credits', () => {
  const g = new Game(7);
  g.placeBuilding('foundry', BASE_BLUE.x, BASE_BLUE.y, 0);
  const field = nearestField(g, BASE_BLUE.x, BASE_BLUE.y, 'ore');
  const h = spawnHarvester(g, BASE_BLUE.x + 4, BASE_BLUE.y + 4, 0);
  h.issue({ kind: 'harvest', target: { x: field.x, y: field.y } });

  const before = g.players[0].credits;
  g.run(30);
  assert.ok(g.players[0].credits > before, `credits did not increase (${g.players[0].credits})`);
  assert.ok(g.players[0].siloUsed > 0, 'silo should hold dumped ore');
});

test('economy: full silo blocks dumping (no credits)', () => {
  const g = new Game(7);
  g.placeBuilding('foundry', BASE_BLUE.x, BASE_BLUE.y, 0);
  g.players[0].siloUsed = g.players[0].siloCapacity; // silo full
  const field = nearestField(g, BASE_BLUE.x, BASE_BLUE.y, 'ore');
  const h = spawnHarvester(g, BASE_BLUE.x + 4, BASE_BLUE.y + 4, 0);
  h.issue({ kind: 'harvest', target: { x: field.x, y: field.y } });

  g.run(30);
  assert.equal(g.players[0].credits, 500, 'no credits should be dumped into a full silo');
});

test('economy: harvester can tap a gas field (adds gas, no credits)', () => {
  const g = new Game(7);
  g.placeBuilding('foundry', BASE_BLUE.x, BASE_BLUE.y, 0);
  const field = nearestField(g, BASE_BLUE.x, BASE_BLUE.y, 'gas');
  const h = spawnHarvester(g, BASE_BLUE.x + 4, BASE_BLUE.y + 4, 0);
  h.issue({ kind: 'harvest', target: { x: field.x, y: field.y } });

  g.run(30);
  assert.ok(g.players[0].gas > 0, 'gas should accumulate');
  assert.equal(g.players[0].siloUsed, 0, 'gas should not fill the ore silo');
});

test('economy: power deficit slows production', () => {
  // with power (boiler) — no deficit
  const g1 = new Game(7);
  g1.placeBuilding('foundry', BASE_BLUE.x, BASE_BLUE.y, 0);
  g1.placeBuilding('boiler', BASE_BLUE.x + 1, BASE_BLUE.y + 1, 0);
  g1.placeBuilding('barracks', BASE_BLUE.x + 2, BASE_BLUE.y + 2, 0);
  g1.run(6);
  const b1 = g1.registry.all().find((e) => e instanceof Building && e.role === 'barracks') as Building;
  b1.enqueue('rifleman', g1.players[0]);
  g1.run(1);
  const p1 = b1.queue[0].progress;

  // without power — deficit (barracks consumes 3)
  const g2 = new Game(7);
  g2.placeBuilding('foundry', BASE_BLUE.x, BASE_BLUE.y, 0);
  g2.placeBuilding('barracks', BASE_BLUE.x + 1, BASE_BLUE.y + 1, 0);
  g2.run(12); // barracks builds slower under deficit
  const b2 = g2.registry.all().find((e) => e instanceof Building && e.role === 'barracks') as Building;
  b2.enqueue('rifleman', g2.players[0]);
  g2.run(1);
  const p2 = b2.queue[0].progress;

  assert.ok(p1 > p2 + 0.05, `powered ${p1} should outpace deficit ${p2}`);
});

test('economy: Forgefolk prefab builds faster than Thornkin growth', () => {
  const g = new Game(7);
  g.placeBuilding('foundry', BASE_BLUE.x, BASE_BLUE.y, 0);
  g.placeBuilding('heartwood', BASE_RED.x, BASE_RED.y, 1);
  const b0 = g.placeBuilding('barracks', BASE_BLUE.x + 1, BASE_BLUE.y + 1, 0)!;
  const b1 = g.placeBuilding('barracks', BASE_RED.x - 1, BASE_RED.y - 1, 1)!;
  assert.ok(b0.buildTime < b1.buildTime, 'prefab should be faster than growth');
});

test('economy: root-network build range — Forgefolk limited, Thornkin global', () => {
  assert.equal(RACES[0].buildRange, 12);
  assert.ok(RACES[1].buildRange >= 1e6, 'Thornkin should grow anywhere');

  const g = new Game(7);
  g.placeBuilding('foundry', BASE_BLUE.x, BASE_BLUE.y, 0);
  g.placeBuilding('heartwood', BASE_RED.x, BASE_RED.y, 1);

  // Forgefolk: far placement rejected by range
  assert.equal(g.placeBuilding('boiler', BASE_BLUE.x + 40, BASE_BLUE.y, 0), null);

  // Thornkin: find a far walkable tile and confirm global build
  let far: { x: number; y: number } | null = null;
  for (let dx = -30; dx <= 30 && !far; dx++) {
    for (let dy = -30; dy <= 30 && !far; dy++) {
      const x = BASE_RED.x + dx;
      const y = BASE_RED.y + dy;
      const d = Math.hypot(x - BASE_RED.x, y - BASE_RED.y);
      if (d > 14 && g.map.inBounds(x, y) && !g.map.isBlocked(x, y)) {
        far = { x, y };
      }
    }
  }
  assert.ok(far, 'no far walkable tile found');
  const b = g.placeBuilding('boiler', far.x, far.y, 1);
  assert.ok(b, 'Thornkin should be able to grow far from base');
});

test('economy: production queue spawns a unit and deducts cost', () => {
  const g = new Game(7);
  g.placeBuilding('foundry', BASE_BLUE.x, BASE_BLUE.y, 0);
  g.placeBuilding('boiler', BASE_BLUE.x + 1, BASE_BLUE.y + 1, 0);
  const bar = g.placeBuilding('barracks', BASE_BLUE.x + 2, BASE_BLUE.y + 2, 0)!;
  g.run(8);
  assert.equal(bar.active, true);
  const afterPlace = g.players[0].credits; // 500 - 120 - 100
  bar.enqueue('rifleman', g.players[0]);
  g.run(3);
  const rifle = g.registry.all().find((e) => e instanceof Unit && e.kindName === 'rifleman');
  assert.ok(rifle, 'rifleman should be produced');
  assert.equal(g.players[0].credits, afterPlace - 60);
});

test('economy: deploy creates the race-specific base (Foundry / Heartwood)', () => {
  const g = new Game(7);
  const mule = g.registry.get(g.spawnUnit(25, 25, 0)) as Unit;
  mule.deployable = true;
  mule.issue({ kind: 'deploy' });
  g.run(1);
  const base0 = g.registry.all().find((e) => e instanceof Building && e.role === 'base') as Building;
  assert.equal(base0.kindName, 'foundry');

  const worldroot = g.registry.get(g.spawnUnit(30, 30, 1)) as Unit;
  worldroot.deployable = true;
  worldroot.issue({ kind: 'deploy' });
  g.run(1);
  const base1 = g.registry.all().find((e) => e instanceof Building && e.team === 1 && e.role === 'base') as Building;
  assert.equal(base1.kindName, 'heartwood');
});
