import { Game } from './core/game.js';
import { Renderer } from './render/renderer.js';
import { Unit } from './sim/unit.js';
import { BASE_BLUE, BASE_RED, MAP_SIZE } from './sim/map.js';
import { DEFAULT_TICK } from './core/loop.js';
import type { CameraInput } from './render/camera.js';
import * as THREE from 'three';

const app = document.getElementById('app')!;
if (!app) throw new Error('missing #app mount');

// --- game + renderer ---
const seed = Number(new URLSearchParams(location.search).get('seed') ?? 12345);
const game = new Game(seed);
const renderer = new Renderer(app, game);

// spawn two harvesters that walk toward each other so movement is visible
const idA = game.spawnUnit(BASE_BLUE.x + 2, BASE_BLUE.y + 2, 0);
const idB = game.spawnUnit(BASE_RED.x - 2, BASE_RED.y - 2, 1);
const world = { map: game.map, registry: game.registry };
const uA = game.registry.get(idA) as Unit;
const uB = game.registry.get(idB) as Unit;
uA.moveTo(BASE_RED.x, BASE_RED.y, world);
uB.moveTo(BASE_BLUE.x, BASE_BLUE.y, world);

// --- input state ---
const keys: Record<string, boolean> = {};
let mouseX = 0;
let mouseY = 0;
let wheelDelta = 0;
let dragStart: { x: number; y: number; btn: number } | null = null;
let panning = false;
let panLast: { x: number; y: number } | null = null;
const raycaster = new THREE.Raycaster();
const CLICK_DRAG_THRESHOLD = 6;

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'h') spawnHarvesterAtCamera();
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

function ndc(clientX: number, clientY: number): THREE.Vector2 {
  return new THREE.Vector2(
    (clientX / window.innerWidth) * 2 - 1,
    1 - (clientY / window.innerHeight) * 2
  );
}

function clickSelect(clientX: number, clientY: number): void {
  raycaster.setFromCamera(ndc(clientX, clientY), renderer.camera);
  const hits = raycaster.intersectObjects(renderer.units.targets, true);
  if (hits.length === 0) {
    renderer.selection.clear();
    return;
  }
  // climb to the owning group to find its entity id
  let obj: THREE.Object3D | null = hits[0].object;
  while (obj && obj.userData.entityId === undefined) obj = obj.parent;
  if (obj) {
    renderer.selection.clear();
    renderer.selection.select(obj.userData.entityId as number);
  }
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

function spawnHarvesterAtCamera(): void {
  const x = Math.max(1, Math.min(MAP_SIZE - 1, Math.round(renderer.controller.x)));
  const y = Math.max(1, Math.min(MAP_SIZE - 1, Math.round(renderer.controller.y)));
  const id = game.spawnUnit(x, y, 0);
  const u = game.registry.get(id) as Unit;
  u.moveTo(MAP_SIZE - x, MAP_SIZE - y, { map: game.map, registry: game.registry });
}

// --- fixed-step loop with interpolation + camera input ---
function buildCameraInput(): CameraInput {
  const input: CameraInput = {
    up: !!keys['w'] || !!keys['arrowup'],
    down: !!keys['s'] || !!keys['arrowdown'],
    left: !!keys['a'] || !!keys['arrowleft'],
    right: !!keys['d'] || !!keys['arrowright'],
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
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight);
});

console.log('[ng-rts] Chunk 3 render ready — seed', seed);
