import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Game } from '../src/core/game.js';
import { buildTerrain } from '../src/render/terrain.js';
import { UnitMeshRegistry } from '../src/render/unitmesh.js';
import { SelectionManager } from '../src/render/selection.js';
import { RTSController, MIN_ZOOM, MAX_ZOOM } from '../src/render/camera.js';
import { BASE_BLUE } from '../src/sim/map.js';

test('render: buildTerrain creates ground + instanced trees/crystals (headless, no GL)', () => {
  const g = new Game(7);
  const scene = new THREE.Scene();
  const t = buildTerrain(g.map, scene);
  assert.ok(t.ground);
  assert.ok(t.counts.trees > 0, 'expected trees');
  assert.ok(t.counts.crystals > 0, 'expected crystals');
  assert.ok(t.trees.count >= t.counts.trees);
  assert.ok(t.crystals.count >= t.counts.crystals);
});

test('render: UnitMeshRegistry adds, syncs, and interpolates meshes', () => {
  const g = new Game(7);
  const scene = new THREE.Scene();
  const reg = new UnitMeshRegistry(scene);
  const id = g.spawnUnit(BASE_BLUE.x, BASE_BLUE.y, 0);
  const e = g.registry.get(id)!;
  reg.add(e);
  assert.equal(reg.size, 1);
  assert.equal(reg.has(id), true);

  // simulate a sim step: entity moved
  e.pos.x += 5;
  e.pos.y += 3;
  reg.beginTick(); // prev = old position
  reg.sync(e); // cur = new position
  reg.render(0.5);

  const m = reg.get(id)!;
  assert.ok(Math.abs(m.group.position.x - (BASE_BLUE.x + 2.5)) < 0.001, 'x not interpolated');
  assert.ok(Math.abs(m.group.position.z - (BASE_BLUE.y + 1.5)) < 0.001, 'z not interpolated');
  assert.equal(reg.targets.length, 1, 'raycast target missing');
});

test('render: UnitMeshRegistry removes and disposes', () => {
  const g = new Game(7);
  const scene = new THREE.Scene();
  const reg = new UnitMeshRegistry(scene);
  const id = g.spawnUnit(3, 3, 0);
  reg.add(g.registry.get(id)!);
  reg.remove(id);
  assert.equal(reg.size, 0);
  assert.equal(reg.targets.length, 0);
});

test('render: selection manager selects/deselects and renders rings', () => {
  const g = new Game(7);
  const scene = new THREE.Scene();
  const reg = new UnitMeshRegistry(scene);
  const id = g.spawnUnit(5, 5, 0);
  reg.add(g.registry.get(id)!);
  const sel = new SelectionManager(scene, reg);
  sel.select(id);
  assert.equal(sel.ids.size, 1);
  sel.render(); // positions ring, must not throw
  sel.deselect(id);
  assert.equal(sel.ids.size, 0);
  sel.select(id);
  sel.clear();
  assert.equal(sel.ids.size, 0);
});

test('render: camera controller clamps to bounds and zooms', () => {
  const c = new RTSController(128);
  c.setPosition(-100, -100);
  assert.equal(c.x, 0);
  assert.equal(c.y, 0);
  c.setPosition(1000, 1000);
  assert.equal(c.x, 128);
  assert.equal(c.y, 128);

  const base = {
    up: false, down: false, left: false, right: false,
    edgeLeft: false, edgeRight: false, edgeTop: false, edgeBottom: false,
  };
  c.update(0.1, { ...base, wheel: 99 });
  assert.equal(c.zoom, MAX_ZOOM);
  c.update(0.1, { ...base, wheel: -99 });
  assert.equal(c.zoom, MIN_ZOOM);
});

test('render: camera apply() sets ortho frustum and position', () => {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  const c = new RTSController(128, 20, 30);
  c.apply(cam, 800, 600);
  assert.ok(Math.abs(cam.position.x - 20) < 0.001);
  assert.ok(Math.abs(cam.position.z - 30) < 0.001);
  assert.ok(cam.left < -1, 'frustum not expanded for 800px width');
  assert.ok(cam.top > 1, 'frustum not expanded for 600px height');
});
