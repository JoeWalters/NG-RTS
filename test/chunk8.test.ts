import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { Unit } from '../src/sim/unit.js';
import { Building } from '../src/sim/building.js';
import { advanceTech } from '../src/sim/tech.js';
import { steamStrike, rootGrasp } from '../src/sim/powers.js';
import { BASE_BLUE } from '../src/sim/map.js';

const B = BASE_BLUE;

test('tech: advanceTech spends gas and raises the tier', () => {
  const g = new Game(7);
  g.players[0].gas = 500;
  assert.equal(advanceTech(g.players[0], 1), true);
  assert.equal(g.players[0].techTier, 1);
  assert.equal(g.players[0].gas, 400);
  assert.equal(advanceTech(g.players[0], 1), false, 'no-op at same tier');
});

test('tech: production is gated by tech tier', () => {
  const g = new Game(7);
  g.placeBuilding('foundry', B.x, B.y, 0);
  g.placeBuilding('boiler', B.x + 1, B.y + 1, 0);
  const bar = g.placeBuilding('barracks', B.x + 2, B.y + 2, 0)!;
  g.run(8);
  // forgetank is tier 1 → blocked at tier 0
  assert.equal(bar.enqueue('forgetank', g.players[0]), false);
  g.players[0].gas = 300;
  assert.equal(advanceTech(g.players[0], 1), true);
  assert.equal(bar.enqueue('forgetank', g.players[0]), true, 'tier-1 unit allowed after tech');
});

test('powers: steam-strike is AoE and damages all enemies in radius', () => {
  const g = new Game(7);
  const a = g.registry.get(g.spawnUnit(5, 5, 1)) as Unit;
  const b = g.registry.get(g.spawnUnit(5.5, 5.2, 1)) as Unit;
  const far = g.registry.get(g.spawnUnit(50, 50, 1)) as Unit;
  a.hp = 50;
  a.maxHp = 50;
  b.hp = 50;
  b.maxHp = 50;
  const hits = steamStrike(g, 5, 5, 0);
  assert.equal(hits, 2, 'two enemies in radius');
  assert.equal(a.hp, 10);
  assert.equal(b.hp, 10);
  assert.equal(far.hp, 100, 'far enemy untouched');
});

test('powers: root-grasp roots an enemy and expires', () => {
  const g = new Game(7);
  const t = g.registry.get(g.spawnUnit(6, 6, 1)) as Unit;
  assert.equal(rootGrasp(g, t.id, 3), true);
  assert.equal(t.rooted, 3);
  assert.equal(t.moveSpeed, 0, 'rooted unit cannot move');
  g.combat.update(1.0);
  assert.equal(t.rooted, 2, 'root decays');
  g.combat.update(3.0);
  assert.equal(t.rooted, 0, 'root expires');
  assert.ok(t.moveSpeed > 0);
});

test('heroes: a dead hero revives at its base after the timer', () => {
  const g = new Game(7);
  g.placeBuilding('foundry', B.x, B.y, 0);
  const hero = g.registry.get(g.spawnUnit(B.x + 2, B.y + 2, 0)) as Unit;
  hero.isHero = true;
  hero.hp = 30;
  hero.alive = false;
  hero.pos.x = 90;
  hero.pos.y = 90;
  g.heroes.update(5);
  assert.equal(hero.alive, true, 'hero should revive');
  assert.equal(hero.hp, hero.maxHp, 'hero should be healed on revive');
  assert.ok(Math.hypot(hero.pos.x - B.x, hero.pos.y - B.y) < 4, 'hero should respawn near base');
});

test('hollow: spawns blight-grub minions up to a cap', () => {
  const g = new Game(7);
  g.placeBuilding('foundry', B.x, B.y, 0);
  g.placeBuilding('hollow', B.x + 1, B.y + 1, 0);
  g.run(12);
  const minions = g.registry
    .all()
    .filter((e) => e instanceof Unit && e.team === 0 && e.role === 'minion');
  assert.ok(minions.length >= 1, 'hollow should spawn minions');
  g.run(20);
  const after = g.registry
    .all()
    .filter((e) => e instanceof Unit && e.team === 0 && e.role === 'minion');
  assert.ok(after.length <= 8, 'minion cap should hold');
});

test('control points: captured by standing, grant income, and drive victory', () => {
  const g = new Game(7);
  const cp0 = g.controlPoints.points[0];
  const u = g.registry.get(g.spawnUnit(cp0.pos.x, cp0.pos.y, 0)) as Unit;
  const before = g.players[0].credits;
  g.run(6); // capture (3s) + hold
  assert.equal(cp0.owner, 0, 'point captured by team 0');
  assert.ok(g.players[0].credits > before, 'captured point grants trickle income');

  // victory: hold 2+ points for VICTORY_HOLD seconds
  for (const cp of g.controlPoints.points) cp.owner = 0;
  g.players[0].holdTimer = 29.5;
  g.run(1);
  assert.equal(g.gameOver, true);
  assert.equal(g.winner, 0);
});
