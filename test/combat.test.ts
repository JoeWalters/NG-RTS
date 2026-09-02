import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { Unit } from '../src/sim/unit.js';
import { Building } from '../src/sim/building.js';
import { Trap } from '../src/sim/traps.js';
import { Tile, BASE_BLUE } from '../src/sim/map.js';
import { reinforce, PIN_THRESHOLD } from '../src/sim/squads.js';

function addUnit(g: Game, x: number, y: number, team: number, opts: Partial<Unit> = {}): Unit {
  const u = g.registry.get(g.spawnUnit(x, y, team)) as Unit;
  Object.assign(u, opts);
  return u;
}

const AX = BASE_BLUE.x + 1;
const AY = BASE_BLUE.y + 1;

test('combat: attack order deals damage and kills (projectiles fly)', () => {
  const g = new Game(7);
  const a = addUnit(g, AX, AY, 0, { damage: 10, fireRate: 2, weaponRange: 3 });
  const t = addUnit(g, AX, AY + 2, 1, { hp: 60, maxHp: 60 });
  a.issue({ kind: 'attack', targetId: t.id });
  g.run(8);
  assert.equal(t.alive, false, 'target should be dead');
  assert.ok(a.alive);
});

test('combat: DPS is fireRate * damage over time', () => {
  const g = new Game(7);
  const a = addUnit(g, AX, AY, 0, { damage: 10, fireRate: 2, weaponRange: 3 });
  const t = addUnit(g, AX, AY + 2, 1, { hp: 1000, maxHp: 1000 });
  a.issue({ kind: 'attack', targetId: t.id });
  g.run(2.0); // 4 attacks * 10 dmg = 40
  assert.ok(t.hp <= 1000 - 30, `expected ~40 damage, got ${1000 - t.hp}`);
});

test('combat: rear hit bonus applies to vehicles (directional armor)', () => {
  const g = new Game(7);
  const target = addUnit(g, AX, AY, 1, { radius: 1.5 });
  const attacker = addUnit(g, AX - 1, AY, 0);

  // attacker is WEST of target; facing EAST (toward attacker) is a rear hit
  target.facing = Math.PI;
  const before = target.hp;
  g.combat.applyDamage(target, 10, attacker);
  const rearDamage = before - target.hp;
  assert.equal(rearDamage, 15, `expected 15 rear damage, got ${rearDamage}`);

  // facing WEST (away from attacker) is a frontal hit
  target.facing = 0;
  target.hp = before;
  g.combat.applyDamage(target, 10, attacker);
  assert.equal(before - target.hp, 10, 'frontal hit should be normal damage');
});

test('combat: suppression pins a squad after repeated hits', () => {
  const g = new Game(7);
  const target = addUnit(g, AX, AY, 1, { hp: 500, maxHp: 500 });
  const attacker = addUnit(g, AX - 1, AY, 0, { squadSize: 4 });
  for (let i = 0; i < 5; i++) g.combat.applyDamage(target, 1, attacker);
  assert.ok(target.suppression >= PIN_THRESHOLD, `suppression ${target.suppression}`);
  assert.equal(target.pinned, true);
});

test('combat: cover reduces damage on/adjacent to trees', () => {
  const g = new Game(7);
  const attacker = addUnit(g, AX - 3, AY, 0);
  // high cover: target standing on a tree tile
  g.map.setTile(AX, AY, Tile.Trees);
  const t1 = addUnit(g, AX, AY, 1, { hp: 100, maxHp: 100 });
  g.combat.applyDamage(t1, 10, attacker);
  assert.equal(100 - t1.hp, 5, 'tree cover should halve damage');

  g.map.setTile(AX, AY, Tile.Ground);
  const t2 = addUnit(g, AX, AY, 1, { hp: 100, maxHp: 100 });
  g.combat.applyDamage(t2, 10, attacker);
  assert.equal(100 - t2.hp, 10, 'open ground takes full damage');
});

test('squads: reinforce adds a man, heals the pool, and costs credits', () => {
  const g = new Game(7);
  const u = addUnit(g, AX, AY, 0, { squadSize: 1, maxSquadSize: 3, hpPerMan: 100, hp: 100, maxHp: 100 });
  const before = g.players[0].credits;
  assert.equal(reinforce(u, g.players[0]), true);
  assert.equal(u.squadSize, 2);
  assert.equal(u.hp, 200);
  assert.equal(u.maxHp, 200);
  assert.equal(g.players[0].credits, before - 15);
  // at max, reinforce fails
  u.maxSquadSize = 2;
  assert.equal(reinforce(u, g.players[0]), false);
});

test('traps: trigger once on the first enemy in radius, then disarm', () => {
  const g = new Game(7);
  const trap = new Trap({ x: AX, y: AY }, 0, 'bramble');
  g.registry.add(trap);
  const e1 = addUnit(g, AX, AY + 0.5, 1, { hp: 100, maxHp: 100 });
  const e2 = addUnit(g, AX, AY + 0.5, 1, { hp: 100, maxHp: 100 });
  g.traps.update();
  assert.equal(trap.armed, false);
  assert.equal(100 - e1.hp, 15, 'bramble should damage + slow');
  assert.ok(e1.slowTimer > 0);
  // second enemy same tick: trap already disarmed
  assert.equal(100 - e2.hp, 0, 'disarmed trap should not fire again');
});

test('fog: enemy hidden until scouted; explored persists after leaving', () => {
  const g = new Game(7);
  const scout = addUnit(g, 30, 30, 0);
  const enemy = addUnit(g, 90, 90, 1);
  g.fog.update();
  assert.equal(g.fog.isVisible(0, 90, 90), false, 'enemy should be hidden at first');
  assert.equal(g.fog.isExplored(0, 90, 90), false);

  // move the scout near the enemy and update fog
  scout.pos.x = 90;
  scout.pos.y = 91;
  g.fog.update();
  assert.equal(g.fog.isVisible(0, 90, 90), true, 'enemy should be visible when scouted');
  assert.equal(g.fog.isExplored(0, 90, 90), true);

  // move scout away: no longer visible, but explored persists
  scout.pos.x = 30;
  scout.pos.y = 30;
  g.fog.update();
  assert.equal(g.fog.isVisible(0, 90, 90), false);
  assert.equal(g.fog.isExplored(0, 90, 90), true, 'explored should persist (shroud lifted)');
});

test('game: checkEnd declares a loser when a base is destroyed', () => {
  const g = new Game(7);
  g.placeBuilding('foundry', BASE_BLUE.x, BASE_BLUE.y, 0);
  g.placeBuilding('heartwood', BASE_BLUE.x + 10, BASE_BLUE.y + 10, 1);
  g.run(1);
  assert.equal(g.gameOver, false);
  const base0 = g.registry.all().find((e) => e instanceof Building && e.role === 'base' && e.team === 0) as Building;
  base0.alive = false;
  g.checkEnd();
  assert.equal(g.gameOver, true);
  assert.equal(g.winner, 1);
});

test('ai: scripted Thornkin grows a base and harvesters', () => {
  const g = new Game(7);
  g.aiEnabled = true;
  g.run(40);
  const hasBase = g.registry.all().some((e) => e instanceof Building && e.role === 'base' && e.team === 1);
  assert.equal(hasBase, true, 'AI should deploy a Thornkin base');
  const harvs = g.registry.all().filter((e) => e instanceof Unit && e.team === 1 && e.role === 'harvester');
  assert.ok(harvs.length >= 1, 'AI should field harvesters');
});
