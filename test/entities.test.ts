import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Entity, EntityRegistry } from '../src/sim/entities.js';

test('registry: add assigns ids and get() retrieves', () => {
  const r = new EntityRegistry();
  const a = new Entity({ x: 1, y: 1 }, 0.5, 0);
  const b = new Entity({ x: 2, y: 2 }, 0.5, 1);
  const idA = r.add(a);
  const idB = r.add(b);
  assert.ok(idA > 0 && idB > idA);
  assert.equal(r.get(idA), a);
  assert.equal(r.get(idB), b);
});

test('registry: remove deletes from lookup and queries', () => {
  const r = new EntityRegistry();
  const e = r.add(new Entity({ x: 10, y: 10 }, 0.5, 0));
  assert.equal(r.size, 1);
  r.remove(r.get(e)!);
  assert.equal(r.size, 0);
  assert.equal(r.get(e), undefined);
  assert.equal(r.entitiesInRange(10, 10, 5).length, 0);
});

test('registry: entitiesInRange returns entities within radius only', () => {
  const r = new EntityRegistry();
  r.add(new Entity({ x: 10, y: 10 }, 0.5, 0)); // near
  r.add(new Entity({ x: 10.3, y: 10.2 }, 0.5, 1)); // very near
  r.add(new Entity({ x: 100, y: 100 }, 0.5, 1)); // far
  const near = r.entitiesInRange(10, 10, 3);
  assert.equal(near.length, 2);
  const far = r.entitiesInRange(10, 10, 0.1);
  assert.equal(far.length, 1); // only the exact-center one
});

test('registry: updatePos keeps hash in sync after movement', () => {
  const r = new EntityRegistry();
  const e = new Entity({ x: 0, y: 0 }, 0.5, 0);
  r.add(e);
  e.pos.x = 100;
  e.pos.y = 100;
  r.updatePos(e);
  assert.equal(r.entitiesInRange(100, 100, 1).length, 1);
  assert.equal(r.entitiesInRange(0, 0, 1).length, 0);
});

test('registry: all() lists every entity', () => {
  const r = new EntityRegistry();
  r.add(new Entity({ x: 1, y: 1 }, 0.5, 0));
  r.add(new Entity({ x: 2, y: 2 }, 0.5, 1));
  r.add(new Entity({ x: 3, y: 3 }, 0.5, 1));
  assert.equal(r.all().length, 3);
});
