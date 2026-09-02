import { Game } from './core/game.js';
import { Renderer } from './render/renderer.js';
import { Unit } from './sim/unit.js';
import { Building } from './sim/building.js';
import { BASE_BLUE, BASE_RED, MAP_SIZE, Tile } from './sim/map.js';
import { DEFAULT_TICK } from './core/loop.js';
import type { CameraInput } from './render/camera.js';
import type { Order } from './sim/order.js';
import type { Entity } from './sim/entities.js';
import { HUD } from './render/hud.js';
import * as THREE from 'three';

const app = document.getElementById('app')!;
if (!app) throw new Error('missing #app mount');

// --- game + renderer ---
const seed = Number(new URLSearchParams(location.search).get('seed') ?? 12345);
const game = new Game(seed);
game.aiEnabled = true; // skirmish: Thornkin opponent
const renderer = new Renderer(app, game);

// spawn two harvesters that walk toward each other so movement is visible
const idA = game.spawnUnit(BASE_BLUE.x + 2, BASE_BLUE.y + 2, 0);
const idB = game.spawnUnit(BASE_RED.x - 2, BASE_RED.y - 2, 1);
const uA = game.registry.get(idA) as Unit;
const uB = game.registry.get(idB) as Unit;
uA.moveTo(BASE_RED.x, BASE_RED.y, { map: game.map, registry: game.registry });
uB.moveTo(BASE_BLUE.x, BASE_BLUE.y, { map: game.map, registry: game.registry });

const hud = new HUD(document.getElementById('hud-bottom')!);

// --- input state ---
const keys: Record<string, boolean> = {};
let mouseX = 0;
let mouseY = 0;
let wheelDelta = 0;
let dragStart: { x: number; y: number; btn: number } | null = null;
let panning = false;
let panLast: { x: number; y: number } | null = null;
const groups = new Map<number, number[]>();
const raycaster = new THREE.Raycaster();
const CLICK_DRAG_THRESHOLD = 6;

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (e.ctrlKey && /^[1-9]$/.test(k)) {
    groups.set(Number(k), [...renderer.selection.ids]);
    return;
  }
  if (!e.ctrlKey && /^[1-9]$/.test(k) && groups.has(Number(k))) {
    renderer.selection.clear();
    for (const id of groups.get(Number(k))!) renderer.selection.select(id);
    return;
  }
  switch (k) {
    case 'a': attackMoveAtCursor(); break;
    case 's': stopSelected(); break;
    case 'g': gatherAtCursor(); break;
    case 'd': deploySelected(); break;
    case 'escape': renderer.selection.clear(); break;
    case 'h': spawnHarvesterAtCamera(); break;
    case 'm': spawnDeployableAtCamera(); break;
    case 'n': spawnWorldrootAtCamera(); break;
    case 'e': startEconomy(0); startEconomy(1); break;
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});
window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (panning && panLast) {
    const s = renderer.controller.pixelScale / renderer.controller.zoom;
    renderer.controller.setPosition(
      renderer.controller.x - (e.clientX - panLast.x) * s,
      renderer.controller.y - (e.clientY - panLast.y) * s
    );
  }
  panLast = { x: e.clientX, y: e.clientY };
});
window.addEventListener('wheel', (e) => {
  wheelDelta += e.deltaY > 0 ? 1 : -1;
  e.preventDefault();
}, { passive: false });
window.addEventListener('mousedown', (e) => {
  dragStart = { x: e.clientX, y: e.clientY, btn: e.button };
  if (e.button === 1 || e.button === 2) {
    panning = true;
    panLast = { x: e.clientX, y: e.clientY };
  }
});
window.addEventListener('mouseup', (e) => {
  if (panning) {
    panning = false;
    dragStart = null;
    return;
  }
  if (!dragStart) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  if (Math.hypot(dx, dy) <= CLICK_DRAG_THRESHOLD) {
    clickSelect(dragStart.x, dragStart.y);
  } else {
    boxSelect(dragStart.x, dragStart.y, e.clientX, e.clientY);
  }
  dragStart = null;
});
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  issueContextOrder(e.clientX, e.clientY);
});

function ndc(clientX: number, clientY: number): THREE.Vector2 {
  return new THREE.Vector2(
    (clientX / window.innerWidth) * 2 - 1,
    1 - (clientY / window.innerHeight) * 2
  );
}

function pickEntity(clientX: number, clientY: number): Entity | null {
  raycaster.setFromCamera(ndc(clientX, clientY), renderer.camera);
  const hits = raycaster.intersectObjects(renderer.units.targets, true);
  if (hits.length === 0) return null;
  let obj: THREE.Object3D | null = hits[0].object;
  while (obj && obj.userData.entityId === undefined) obj = obj.parent;
  if (!obj) return null;
  return game.registry.get(obj.userData.entityId as number) ?? null;
}

function clickSelect(clientX: number, clientY: number): void {
  const picked = pickEntity(clientX, clientY);
  if (!picked) {
    renderer.selection.clear();
    return;
  }
  renderer.selection.clear();
  renderer.selection.select(picked.id);
}

function groundPoint(nx: number, ny: number): THREE.Vector3 | null {
  raycaster.setFromCamera(new THREE.Vector2(nx, ny), renderer.camera);
  const hit = raycaster.intersectObject(renderer.terrain.ground);
  return hit.length > 0 ? hit[0].point : null;
}

function boxSelect(x0: number, y0: number, x1: number, y1: number): void {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const corners = [
    groundPoint(ndc(minX, minY).x, ndc(minX, minY).y),
    groundPoint(ndc(maxX, maxY).x, ndc(maxX, maxY).y),
  ];
  if (!corners[0] || !corners[1]) return;
  const loX = Math.min(corners[0].x, corners[1].x);
  const hiX = Math.max(corners[0].x, corners[1].x);
  const loZ = Math.min(corners[0].z, corners[1].z);
  const hiZ = Math.max(corners[0].z, corners[1].z);
  renderer.selection.clear();
  for (const id of renderer.units.targets.map((g) => g.userData.entityId as number)) {
    const m = renderer.units.get(id);
    if (!m) continue;
    const px = m.group.position.x;
    const pz = m.group.position.z;
    if (px >= loX && px <= hiX && pz >= loZ && pz <= hiZ) {
      renderer.selection.select(id);
    }
  }
}

// --- order issuing ---
function selectedUnits(): Unit[] {
  const out: Unit[] = [];
  for (const id of renderer.selection.ids) {
    const e = game.registry.get(id);
    if (e instanceof Unit) out.push(e);
  }
  return out;
}

function issueToSelected(order: Order): void {
  for (const u of selectedUnits()) u.issue(order);
}

function issueContextOrder(clientX: number, clientY: number): void {
  const sel = selectedUnits();
  if (sel.length === 0) return;
  const picked = pickEntity(clientX, clientY);
  const ground = groundPoint(ndc(clientX, clientY).x, ndc(clientX, clientY).y);
  const team = sel[0].team;

  let order: Order;
  if (picked && picked.team !== team && picked.alive) {
    order = { kind: 'attack', targetId: picked.id };
  } else if (ground) {
    const gx = Math.floor(ground.x);
    const gz = Math.floor(ground.z);
    const t = game.map.tileAt(gx, gz);
    if (t === Tile.Ore || t === Tile.Gems) {
      order = { kind: 'harvest', target: { x: ground.x, y: ground.z } };
    } else if (sel[0].deployable) {
      order = { kind: 'deploy', target: { x: ground.x, y: ground.z } };
    } else {
      order = { kind: 'move', target: { x: ground.x, y: ground.z } };
    }
  } else {
    return;
  }
  issueToSelected(order);
}

function cursorGround(): { x: number; y: number } | null {
  const g = groundPoint(ndc(mouseX, mouseY).x, ndc(mouseX, mouseY).y);
  return g ? { x: g.x, y: g.z } : null;
}

function attackMoveAtCursor(): void {
  const g = cursorGround();
  if (!g) return;
  issueToSelected({ kind: 'attackmove', target: g });
}
function stopSelected(): void {
  issueToSelected({ kind: 'stop' });
}
function gatherAtCursor(): void {
  const g = cursorGround();
  if (!g) return;
  issueToSelected({ kind: 'harvest', target: g });
}
function deploySelected(): void {
  const sel = selectedUnits();
  if (sel.some((u) => u.deployable)) issueToSelected({ kind: 'deploy' });
}

// --- dev spawns ---
function spawnHarvesterAtCamera(): void {
  const x = Math.max(1, Math.min(MAP_SIZE - 1, Math.round(renderer.controller.x)));
  const y = Math.max(1, Math.min(MAP_SIZE - 1, Math.round(renderer.controller.y)));
  const u = game.registry.get(game.spawnUnit(x, y, 0)) as Unit;
  u.moveTo(MAP_SIZE - x, MAP_SIZE - y, { map: game.map, registry: game.registry });
}

function spawnDeployableAtCamera(): void {
  const x = Math.max(1, Math.min(MAP_SIZE - 1, Math.round(renderer.controller.x)));
  const y = Math.max(1, Math.min(MAP_SIZE - 1, Math.round(renderer.controller.y)));
  const u = game.registry.get(game.spawnUnit(x, y, 0)) as Unit;
  u.deployable = true; // debug Foundry-Mule (races in Chunk 5)
}

function spawnWorldrootAtCamera(): void {
  const x = Math.max(1, Math.min(MAP_SIZE - 1, Math.round(renderer.controller.x)));
  const y = Math.max(1, Math.min(MAP_SIZE - 1, Math.round(renderer.controller.y)));
  const u = game.registry.get(game.spawnUnit(x, y, 1)) as Unit;
  u.deployable = true; // debug Worldroot (Thornkin)
}

/** Browser economy demo: ensure a base, spawn a harvester, auto-harvest a field. */
function startEconomy(team: number): void {
  const basePos = team === 0 ? BASE_BLUE : BASE_RED;
  const hasBase = game.registry.all().some(
    (e) => e instanceof Building && e.team === team && e.role === 'base'
  );
  if (!hasBase) {
    game.placeBuilding(team === 0 ? 'foundry' : 'heartwood', basePos.x, basePos.y, team);
  }
  const h = game.registry.get(game.spawnUnit(basePos.x + 2, basePos.y + 2, team)) as Unit;
  h.role = 'harvester';
  let f: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const ff of game.economy.fields) {
    const d = Math.hypot(ff.x - basePos.x, ff.y - basePos.y);
    if (d < bestD) {
      bestD = d;
      f = ff;
    }
  }
  if (f) h.issue({ kind: 'harvest', target: { x: f.x, y: f.y } });
}

// --- fixed-step loop with interpolation + camera input ---
function buildCameraInput(): CameraInput {
  const input: CameraInput = {
    up: !!keys['arrowup'],
    down: !!keys['arrowdown'],
    left: !!keys['arrowleft'],
    right: !!keys['arrowright'],
    edgeLeft: mouseX < 40,
    edgeRight: mouseX > window.innerWidth - 40,
    edgeTop: mouseY < 40,
    edgeBottom: mouseY > window.innerHeight - 40,
    wheel: wheelDelta,
  };
  wheelDelta = 0;
  return input;
}

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= DEFAULT_TICK) {
    renderer.beginTick();
    game.step(DEFAULT_TICK);
    renderer.sync(game);
    acc -= DEFAULT_TICK;
  }
  const alpha = acc / DEFAULT_TICK;
  renderer.controller.update(dt, buildCameraInput());
  renderer.render(alpha, app.clientWidth, app.clientHeight);
  hud.update(selectedUnits(), game.players[0]);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight);
});

console.log('[ng-rts] Chunk 4 ready — seed', seed);
