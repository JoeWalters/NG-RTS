import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMap,
  GridMap,
  Tile,
  BASE_BLUE,
  BASE_RED,
  CENTER,
  MAP_SIZE,
} from '../src/sim/map.js';

test('map: generation is deterministic (same seed → same grid)', () => {
  const a = generateMap(2024);
  const b = generateMap(2024);
  assert.deepEqual(a.serialize(), b.serialize());
});

test('map: different seeds produce different grids', () => {
  const a = generateMap(2024);
  const b = generateMap(999);
  assert.notDeepEqual(a.serialize(), b.serialize());
});

test('map: base clearings are ground and walkable', () => {
  const m = generateMap(7);
  assert.equal(m.tileAt(BASE_BLUE.x, BASE_BLUE.y), Tile.Ground);
  assert.equal(m.tileAt(BASE_RED.x, BASE_RED.y), Tile.Ground);
  assert.equal(m.isBlocked(BASE_BLUE.x, BASE_BLUE.y), false);
  assert.equal(m.isBlocked(BASE_RED.x, BASE_RED.y), false);
});

test('map: has ore near each base and a gem field at center', () => {
  const m = generateMap(7);
  // search the vicinity for ore/gems
  let oreBlue = false;
  let oreRed = false;
  let gemsCenter = false;
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const t = m.tileAt(x, y);
      if (t === Tile.Ore) {
        if (Math.hypot(x - BASE_BLUE.x, y - BASE_BLUE.y) < 12) oreBlue = true;
        if (Math.hypot(x - BASE_RED.x, y - BASE_RED.y) < 12) oreRed = true;
      }
      if (t === Tile.Gems && Math.hypot(x - CENTER.x, y - CENTER.y) < 10) gemsCenter = true;
    }
  }
  assert.ok(oreBlue, 'expected ore near blue base');
  assert.ok(oreRed, 'expected ore near red base');
  assert.ok(gemsCenter, 'expected gem field near center');
});

test('map: water and trees block movement; ore/gems do not', () => {
  const m = generateMap(7);
  let sawWater = false;
  let sawTrees = false;
  let sawOre = false;
  let sawGems = false;
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const t = m.tileAt(x, y);
      if (t === Tile.Water) sawWater = true;
      if (t === Tile.Trees) sawTrees = true;
      if (t === Tile.Ore) sawOre = true;
      if (t === Tile.Gems) sawGems = true;
      if (sawWater && m.isBlocked(x, y) !== true) continue;
      if (sawTrees && m.isBlocked(x, y) !== true) continue;
    }
  }
  assert.ok(sawWater && sawTrees && sawOre && sawGems, 'map should contain all tile types');
  // direct assertions on specific known tiles
  const wm = new GridMap();
  wm.setTile(5, 5, Tile.Water);
  wm.setTile(6, 6, Tile.Trees);
  wm.setTile(7, 7, Tile.Ore);
  wm.setTile(8, 8, Tile.Gems);
  assert.equal(wm.isBlocked(5, 5), true);
  assert.equal(wm.isBlocked(6, 6), true);
  assert.equal(wm.isBlocked(7, 7), false);
  assert.equal(wm.isBlocked(8, 8), false);
});

test('map: out-of-bounds is blocked', () => {
  const m = new GridMap();
  assert.equal(m.isBlocked(-1, 0), true);
  assert.equal(m.isBlocked(0, MAP_SIZE), true);
});

test('map: building occupancy blocks tiles until released', () => {
  const m = new GridMap();
  assert.equal(m.occupy(3, 3, 99), true);
  assert.equal(m.isBlocked(3, 3), true);
  assert.equal(m.occupy(3, 3, 100), false, 'second occupy should fail');
  m.release(3, 3, 99);
  assert.equal(m.isBlocked(3, 3), false);
});
