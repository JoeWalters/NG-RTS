import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { Unit } from '../src/sim/unit.js';
import { Building } from '../src/sim/building.js';

// coordinates within the generated blue-base clearing (walkable, no trees/water)
const SX = 21;
const SY = 22;

test('order: move order drives a unit to its goal via OrderSystem', () => {
  const g = new Game(7);
  const u = g.registry.get(g.spawnUnit(SX, SY, 0)) as Unit;
  assert.equal(g.map.isBlocked(SX, SY), false);
  assert.equal(g.map.isBlocked(SX, 28), false);

  u.issue({ kind: 'move', target: { x: SX, y: 28 } });
  g.run(4.0); // 6 tiles at speed 2 = 3s + margin

  assert.ok(Math.hypot(u.pos.x - SX, u.pos.y - 28) < 1.0, `did not reach (${u.pos.x},${u.pos.y})`);
  assert.equal(u.orderState, 'idle');
  assert.equal(u.orders.length, 0);
});

test('order: move order reaches goal within tolerance and stops', () => {
  const g = new Game(7);
  const u = g.registry.get(g.spawnUnit(SX, SY, 0)) as Unit;
  u.issue({ kind: 'move', target: { x: SX, y: 26 } });
  g.run(2.0);
  assert.ok(Math.hypot(u.pos.x - SX, u.pos.y - 26) < 1.0);
  assert.equal(u.moving, false, 'unit should stop at goal');
});

test('order: attack order acquires an explicit target', () => {
  const g = new Game(7);
  const attacker = g.registry.get(g.spawnUnit(SX, SY, 0)) as Unit;
  const target = g.registry.get(g.spawnUnit(SX + 2, SY + 2, 1)) as Unit;

  attacker.issue({ kind: 'attack', targetId: target.id });
  g.run(1.0);

  assert.equal(attacker.attackTargetId, target.id);
  assert.equal(attacker.orderState, 'attacking');
});

test('order: attack order acquires nearest enemy when no targetId given', () => {
  const g = new Game(7);
  const attacker = g.registry.get(g.spawnUnit(SX, SY, 0)) as Unit;
  const enemy = g.registry.get(g.spawnUnit(SX + 2, SY + 2, 1)) as Unit;

  attacker.issue({ kind: 'attack', target: { x: SX + 3, y: SY + 3 } });
  g.run(1.0);

  assert.equal(attacker.attackTargetId, enemy.id);
});

test('order: attack order ends when target dies', () => {
  const g = new Game(7);
  const attacker = g.registry.get(g.spawnUnit(SX, SY, 0)) as Unit;
  const target = g.registry.get(g.spawnUnit(SX + 2, SY + 2, 1)) as Unit;

  attacker.issue({ kind: 'attack', targetId: target.id });
  g.run(0.5);
  assert.equal(attacker.orderState, 'attacking');

  target.alive = false; // simulate death (combat in Chunk 6)
  g.run(0.5);
  assert.equal(attacker.orderState, 'idle');
  assert.equal(attacker.orders.length, 0);
});

test('order: harvest order sets harvester state and moves to the field', () => {
  const g = new Game(7);
  const u = g.registry.get(g.spawnUnit(SX, SY, 0)) as Unit;

  u.issue({ kind: 'harvest', target: { x: SX + 4, y: SY } });
  g.run(1.0);

  assert.equal(u.orderState, 'harvesting');
  assert.ok(u.harvestPoint);
  assert.ok(u.pos.x > SX, 'harvester should move toward the field');
});

test('order: deploy order converts a deployable unit into a building', () => {
  const g = new Game(7);
  const mule = g.registry.get(g.spawnUnit(SX, SY, 0)) as Unit;
  mule.deployable = true;
  const muleId = mule.id;

  mule.issue({ kind: 'deploy' });
  g.run(1.0);

  assert.equal(g.registry.get(muleId), undefined, 'deployable unit should be gone');
  const buildings = g.registry.all().filter((e) => e instanceof Building);
  assert.equal(buildings.length, 1);
  assert.ok(Math.abs(buildings[0].pos.x - SX) < 0.5);
  assert.equal(mule.orderState, 'deploying');
});

test('order: deploy is rejected when not deployable', () => {
  const g = new Game(7);
  const u = g.registry.get(g.spawnUnit(SX, SY, 0)) as Unit;
  u.issue({ kind: 'deploy' });
  g.run(0.5);
  assert.equal(u.alive, true, 'non-deployable unit stays a unit');
});

test('order: queue executes orders in sequence', () => {
  const g = new Game(7);
  const u = g.registry.get(g.spawnUnit(SX, SY, 0)) as Unit;
  u.issue({ kind: 'move', target: { x: SX, y: 25 } });
  u.issue({ kind: 'move', target: { x: SX, y: 28 } });
  g.run(3.0);

  assert.ok(Math.hypot(u.pos.x - SX, u.pos.y - 28) < 1.0, 'should reach the final waypoint');
  assert.equal(u.orders.length, 0);
  assert.equal(u.orderState, 'idle');
});

test('order: stop order halts movement', () => {
  const g = new Game(7);
  const u = g.registry.get(g.spawnUnit(SX, SY, 0)) as Unit;
  u.issue({ kind: 'move', target: { x: SX, y: 28 } });
  g.run(0.3);
  u.issue({ kind: 'stop' });
  g.run(0.5);
  assert.equal(u.moving, false);
  assert.equal(u.orders.length, 0);
});
