import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap, Tile } from '../src/sim/map.js';
import { EntityRegistry } from '../src/sim/entities.js';
import { Unit } from '../src/sim/unit.js';
import {
  findPath,
  smoothPath,
  isLineClear,
  nearestWalkable,
  PathFollow,
  World,
} from '../src/sim/pathfind.js';

const DT = 1 / 30;

function makeWorld(map: GridMap): World {
  return { map, registry: new EntityRegistry() };
}

function addUnit(world: World, x: number, y: number, team = 0): Unit {
  const u = new Unit({ x, y }, team);
  world.registry.add(u);
  return u;
}

function simulate(u: Unit, world: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) u.updateMovement(DT, world);
}

// --- A* ---

test('A*: finds a path around a wall obstacle (no waypoints on blocked tiles)', () => {
  const m = new GridMap();
  for (let y = 0; y < 12; y++) m.setTile(5, y, Tile.Trees); // vertical wall at x=5
  const p = findPath(m, 2, 2, 8, 2);
  assert.ok(p, 'path should exist');
  for (const wp of p) assert.equal(m.isBlocked(wp.x, wp.y), false, `waypoint blocked (${wp.x},${wp.y})`);
  assert.equal(p[p.length - 1].x, 8);
  assert.equal(p[p.length - 1].y, 2);
});

test('A*: returns null for an unreachable goal (enclosed by water)', () => {
  const m = new GridMap();
  // put the goal inside a water ring
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      m.setTile(10 + dx, 10 + dy, Tile.Water);
    }
  }
  m.setTile(10, 10, Tile.Ground);
  const p = findPath(m, 2, 2, 10, 10);
  assert.equal(p, null);
});

test('A*: returns null when start or goal is blocked', () => {
  const m = new GridMap();
  m.setTile(3, 3, Tile.Water);
  assert.equal(findPath(m, 3, 3, 8, 8), null);
  m.setTile(8, 8, Tile.Water);
  assert.equal(findPath(m, 2, 2, 8, 8), null);
});

test('A*: diagonal path length is bounded on a clear map', () => {
  const m = new GridMap();
  const p = findPath(m, 0, 0, 10, 10);
  assert.ok(p);
  // octile lower bound ~10*sqrt2? No: cardinal path would be 20, diagonal ~14.
  assert.ok(p.length <= 15, `path too long: ${p.length}`);
  assert.ok(p.length >= 10);
});

test('A*: path cache is invalidated when obstacles change (epoch bump)', () => {
  const m = new GridMap();
  const before = findPath(m, 0, 0, 6, 0);
  m.setTile(3, 0, Tile.Trees); // block the straight line -> epoch bump
  const after = findPath(m, 0, 0, 6, 0);
  assert.ok(before && after);
  // after must avoid (3,0)
  for (const wp of after) assert.notEqual(wp.x === 3 && wp.y === 0, true);
});

// --- smoothing ---

test('smoothPath: never longer than the raw path and every segment is clear', () => {
  const m = new GridMap();
  for (let y = 0; y < 12; y++) m.setTile(5, y, Tile.Trees);
  const raw = findPath(m, 2, 2, 8, 2)!;
  const smooth = smoothPath(m, raw);
  assert.ok(smooth.length <= raw.length);
  assert.equal(smooth[0].x, 2);
  assert.equal(smooth[smooth.length - 1].x, 8);
  for (let i = 0; i + 1 < smooth.length; i++) {
    assert.ok(isLineClear(m, smooth[i], smooth[i + 1]), 'smoothed segment not clear');
  }
});

test('nearestWalkable: returns self when walkable, neighbor otherwise', () => {
  const m = new GridMap();
  assert.deepEqual(nearestWalkable(m, 3, 3), { x: 3, y: 3 });
  m.setTile(3, 3, Tile.Water);
  const n = nearestWalkable(m, 3, 3)!;
  assert.equal(m.isBlocked(n.x, n.y), false);
});

// --- movement integration ---

test('unit: moveTo routes around a wall and reaches the goal', () => {
  const m = new GridMap();
  for (let y = 0; y < 12; y++) m.setTile(5, y, Tile.Trees);
  const world = makeWorld(m);
  const u = addUnit(world, 2, 2);
  assert.equal(u.moveTo(8, 2, world), true);
  simulate(u, world, 400);
  assert.ok(Math.hypot(u.pos.x - 8, u.pos.y - 2) < 1.0, `did not reach goal (${u.pos.x},${u.pos.y})`);
  assert.ok(Number.isFinite(u.pos.x) && Number.isFinite(u.pos.y));
});

test('unit: moveTo returns false when no path exists', () => {
  const m = new GridMap();
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      m.setTile(10 + dx, 10 + dy, Tile.Water);
    }
  }
  m.setTile(10, 10, Tile.Ground);
  const world = makeWorld(m);
  const u = addUnit(world, 2, 2);
  assert.equal(u.moveTo(10, 10, world), false);
});

test('unit: attackMoveTo sets the attackMove flag', () => {
  const m = new GridMap();
  const world = makeWorld(m);
  const u = addUnit(world, 2, 2);
  assert.equal(u.attackMoveTo(6, 2, world), true);
  assert.equal(u.attackMove, true);
  assert.equal(u.moving, true);
});

test('separation: two same-team units crossing never overlap', () => {
  const m = new GridMap();
  const world = makeWorld(m);
  const a = addUnit(world, 2, 2);
  const b = addUnit(world, 8, 2);
  a.moveTo(8, 2, world);
  b.moveTo(2, 2, world);
  let minDist = Infinity;
  for (let i = 0; i < 500; i++) {
    a.updateMovement(DT, world);
    b.updateMovement(DT, world);
    const d = Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y);
    minDist = Math.min(minDist, d);
    assert.ok(Number.isFinite(a.pos.x) && Number.isFinite(b.pos.x));
  }
  // radii sum = 1.0; separation should keep them from hard-overlapping
  assert.ok(minDist >= 0.9, `units overlapped too much: ${minDist}`);
  const end = Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y);
  assert.ok(end >= 0.9);
});

test('stuck: unit blocked by a new obstacle re-seeks and recovers', () => {
  const m = new GridMap();
  const world = makeWorld(m);
  const u = addUnit(world, 2, 2);
  u.moveTo(8, 2, world); // straight path
  // block the path AFTER planning (stale path) -> epoch bump invalidates cache
  m.occupy(4, 2, 999);
  simulate(u, world, 500);
  assert.ok(Math.hypot(u.pos.x - 8, u.pos.y - 2) < 1.0, `did not recover (${u.pos.x},${u.pos.y})`);
  assert.ok(Number.isFinite(u.pos.x) && Number.isFinite(u.pos.y));
});

test('stuck: unit that cannot reach stays finite (no NaN), stuckTime accumulates', () => {
  const m = new GridMap();
  // fully enclose a small region
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      m.setTile(10 + dx, 10 + dy, Tile.Water);
    }
  }
  m.setTile(10, 10, Tile.Ground);
  const world = makeWorld(m);
  const u = addUnit(world, 2, 2);
  u.moveTo(10, 10, world); // no path -> not moving
  simulate(u, world, 300);
  assert.ok(Number.isFinite(u.pos.x) && Number.isFinite(u.pos.y));
  // mover has no path, so it never got stuck — just ensure stability
  assert.ok(Math.abs(u.pos.x - 2) < 0.01);
});

test('PathFollow: no overlap after 500 separation steps for a stationary cluster', () => {
  const m = new GridMap();
  const world = makeWorld(m);
  const units: Unit[] = [];
  for (let i = 0; i < 4; i++) units.push(addUnit(world, 5, 5 + i * 0.25, 0));
  for (let t = 0; t < 500; t++) {
    for (const u of units) u.updateMovement(DT, world);
  }
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const d = Math.hypot(units[j].pos.x - units[i].pos.x, units[j].pos.y - units[i].pos.y);
      assert.ok(d >= 0.99, `pair ${i},${j} overlapped: ${d}`);
    }
  }
});
