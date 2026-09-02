import * as THREE from 'three';
import type { Game } from '../core/game.js';
import { buildTerrain } from './terrain.js';
import { UnitMeshRegistry } from './unitmesh.js';
import { SelectionManager } from './selection.js';
import { RTSController } from './camera.js';

/**
 * Renderer: owns the Three.js scene, orthographic top-down camera, lights,
 * terrain, unit meshes, and selection. The WebGL renderer is constructed here
 * (browser-only); the scene graph itself is headless-testable.
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly controller: RTSController;
  readonly units: UnitMeshRegistry;
  readonly selection: SelectionManager;
  readonly terrain;

  constructor(container: HTMLElement, game: Game) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0e12);
    this.scene.fog = new THREE.Fog(0x0b0e12, 90, 200);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);

    // lights
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(20, 40, 10);
    this.scene.add(dir);

    this.terrain = buildTerrain(game.map, this.scene);
    this.units = new UnitMeshRegistry(this.scene);
    for (const e of game.registry.all()) this.units.add(e);
    this.selection = new SelectionManager(this.scene, this.units);
    this.controller = new RTSController(game.map.size, game.map.size / 2, game.map.size / 2);

    this.setSize(container.clientWidth, container.clientHeight);
  }

  /** Sync every live entity into meshes (adds new, removes dead, applies fog). */
  sync(game: Game): void {
    for (const e of game.registry.all()) {
      if (!e.alive) {
        this.units.remove(e.id);
        continue;
      }
      if (!this.units.has(e.id)) this.units.add(e);
      else {
        this.units.sync(e);
        const m = this.units.get(e.id);
        if (m) m.group.visible = e.team === 0 || game.fog.isVisible(0, e.pos.x, e.pos.y);
      }
    }
  }

  beginTick(): void {
    this.units.beginTick();
  }

  render(alpha: number, viewW: number, viewH: number): void {
    this.units.render(alpha);
    this.selection.render();
    this.controller.apply(this.camera, viewW, viewH);
    this.renderer.setSize(viewW, viewH);
    this.renderer.render(this.scene, this.camera);
  }

  setSize(w: number, h: number): void {
    this.renderer.setSize(w, h);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
