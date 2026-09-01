import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap, Tile } from '../src/sim/map.js';
import { Entity, EntityRegistry } from '../src/sim/entities.js';
import { moveEntity } from '../src/sim/collision.js';

function makeWorld() {
  const map = new GridMap();
  const registry = new EntityRegistry();
  return { map, registry };
}

test('collision: move onto water is blocked by tile', () => {
  const w = makeWorld();
  w.map.setTile(5, 5, Tile.Water);
  const e = new Entity({ x: 4, y: 5 }, 0.5, 0);
  w.registry.add(e);
  const res = moveEntity(e, 1, 0, w);
  assert.equal(res.moved, false);
  assert.equal(res.blockedByTile, true);
  assert.equal(e.pos.x, 4); // did not move
});

test('collision: move onto a tree is blocked by tile', () => {
  const w = makeWorld();
  w.map.setTile(6, 6, Tile.Trees);
  const e = new Entity({ x: 5, y: 6 }, 0.5, 0);
  w.registry.add(e);
  const res = moveEntity(e, 1, 0, w);
  assert.equal(res.blockedByTile, true);
  assert.equal(res.moved, false);
});

test('collision: move into another entity is blocked by entity', () => {
  const w = makeWorld();
  const a = new Entity({ x: 1, y: 1 }, 0.5, 0);
  const b = new Entity({ x: 2, y: 1 }, 0.5, 1);
  w.registry.add(a);
  w.registry.add(b);
  const res = moveEntity(a, 1, 0, w); // a tries to step onto b
  assert.equal(res.moved, false);
  assert.equal(res.blockedByEntity, true);
  assert.equal(a.pos.x, 1);
});

test('collision: free ground moves and updates hash', () => {
  const w = makeWorld();
  const e = new Entity({ x: 1, y: 1 }, 0.5, 0);
  w.registry.add(e);
  const res = moveEntity(e, 2, 3, w);
  assert.equal(res.moved, true);
  assert.equal(e.pos.x, 3);
  assert.equal(e.pos.y, 4);
  assert.equal(w.registry.entitiesInRange(3, 4, 1).length, 1);
  assert.equal(w.registry.entitiesInRange(1, 1, 1).length, 0);
});

test('collision: an entity can stay in place (dx=0,dy=0) without self-blocking', () => {
  const w = makeWorld();
  const e = new Entity({ x: 8, y: 8 }, 0.5, 0);
  w.registry.add(e);
  const res = moveEntity(e, 0, 0, w);
  assert.equal(res.moved, true);
  assert.equal(e.pos.x, 8);
  assert.equal(e.pos.y, 8);
});
