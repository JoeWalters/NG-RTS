import * as THREE from 'three';
import { FixedLoop, DEFAULT_TICK } from './core/loop.js';

/**
 * Chunk 0 bootstrap: mount an empty Three.js scene with a spinning placeholder
 * cube and a game-loop stub. Later chunks replace the cube with real terrain
 * and the stub with the actual simulation-driven renderer.
 */
const app = document.getElementById('app');
if (!app) throw new Error('missing #app mount');

// Scene / camera / renderer (orthographic top-down will come in Chunk 3;
// for now a perspective view to see the placeholder cube).
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e12);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
camera.position.set(0, 5, 8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
app.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.0));
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(4, 6, 3);
scene.add(dir);

// Placeholder cube
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 1.5, 1.5),
  new THREE.MeshStandardMaterial({ color: 0x3a9cff, metalness: 0.4, roughness: 0.5 })
);
scene.add(cube);

// Fixed-step simulation stub: counts ticks; deterministic (no randomness).
let tickCount = 0;
const loop = new FixedLoop((_dt: number, tick: number) => {
  tickCount = tick;
});
loop.start();

// Render loop (rAF). Simulation steps at fixed dt; rendering interpolates later.
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  loop.frame(dt);

  // Placeholder spin (render-only, not sim state)
  cube.rotation.y += dt * 0.5;

  const aspect = app.clientWidth / app.clientHeight || 1;
  if (camera.aspect !== aspect) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  renderer.setSize(app.clientWidth, app.clientHeight);
  renderer.render(scene, camera);
});

// Resize handling
window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight);
  const aspect = app.clientWidth / app.clientHeight || 1;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
});

// Keep the stub referenced so tsc doesn't flag unused tickCount
void tickCount;
void DEFAULT_TICK;

console.log('[ng-rts] Chunk 0 bootstrap ready — sim tick rate', DEFAULT_TICK);
