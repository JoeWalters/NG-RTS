import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { Unit } from '../src/sim/unit.js';
import { sampleMinimap } from '../src/render/minimap.js';
import {
  sidebarEntries,
  formatResources,
  formatSelection,
  portraitColor,
} from '../src/render/hud.js';
import { BASE_BLUE } from '../src/sim/map.js';

test('minimap: sample counts terrain, fogged tiles, and dots', () => {
  const g = new Game(7);
  g.placeBuilding('foundry', BASE_BLUE.x, BASE_BLUE.y, 0);
  g.fog.update();
  const s = sampleMinimap(g.map, g.fog, g.registry, 0);
  assert.ok(s.terrain > 0, 'expected non-ground terrain tiles');
  assert.ok(s.fogged > 0, 'expected unexplored (shroud) tiles');
  assert.equal(g.fog.isExplored(0, BASE_BLUE.x, BASE_BLUE.y), true, 'own base should be explored');
  assert.ok(s.dots >= 1, 'own building dot should show');
});

test('minimap: enemy is hidden in fog and appears when scouted', () => {
  const g = new Game(7);
  const enemy = g.registry.get(g.spawnUnit(90, 90, 1)) as Unit;
  const before = sampleMinimap(g.map, g.fog, g.registry, 0);
  assert.equal(g.fog.isVisible(0, 90, 90), false, 'enemy should be hidden');
  g.fog.revealAll(0);
  const after = sampleMinimap(g.map, g.fog, g.registry, 0);
  assert.ok(after.dots >= before.dots + 1, 'enemy dot appears once scouted');
  assert.ok(enemy.alive);
});

test('hud: sidebarEntries lists affordable buildings with costs', () => {
  const g = new Game(7);
  const entries = sidebarEntries(0, g.players[0]);
  const kinds = entries.map((e) => e.kind);
  assert.ok(kinds.includes('boiler'), 'power building in sidebar');
  assert.ok(kinds.includes('barracks'), 'barracks in sidebar');
  for (const e of entries) assert.ok(e.cost <= g.players[0].credits, 'only affordable entries');
});

test('hud: sidebar excludes the base (deployed, not built) and unaffordable', () => {
  const g = new Game(7);
  const entries = sidebarEntries(0, g.players[0]);
  assert.ok(!entries.some((e) => e.kind === 'foundry'), 'base should not be a sidebar entry');
  const poor = sidebarEntries(1, { ...g.players[1], credits: 10 } as never);
  for (const e of poor) assert.ok(e.cost <= 10);
});

test('hud: formatResources and formatSelection are stable', () => {
  const g = new Game(7);
  const p = g.players[0];
  assert.ok(formatResources(p).includes('Credits 500'));
  const u = g.registry.get(g.spawnUnit(5, 5, 0)) as Unit;
  u.kindName = 'rifleman';
  u.squadSize = 3;
  const s = formatSelection([u], p);
  assert.ok(s.includes('rifleman'));
  assert.ok(s.includes('squad 3'));
  assert.ok(portraitColor('rifleman').length > 0);
});
