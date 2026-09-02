import * as THREE from 'three';
import type { UnitMeshRegistry } from './unitmesh.js';

const RING = new THREE.RingGeometry(0.72, 1.0, 24);
const RING_MAT = new THREE.MeshBasicMaterial({
  color: 0x00ff88,
  transparent: true,
  opacity: 0.75,
  side: THREE.DoubleSide,
});

/**
 * Selection: tracks selected entity ids and renders a ground ring under each.
 * Headless-testable (scene-graph only).
 */
export class SelectionManager {
  readonly ids: Set<number> = new Set();
  private rings: THREE.Mesh[] = [];

  constructor(
    private scene: THREE.Scene,
    private meshes: UnitMeshRegistry
  ) {}

  select(id: number): void {
    this.ids.add(id);
    this.rebuild();
  }

  deselect(id: number): void {
    this.ids.delete(id);
    this.rebuild();
  }

  clear(): void {
    this.ids.clear();
    this.rebuild();
  }

  private rebuild(): void {
    for (const r of this.rings) this.scene.remove(r);
    this.rings.length = 0;
    for (const _id of this.ids) {
      const ring = new THREE.Mesh(RING, RING_MAT);
      ring.position.y = 0.03;
      this.scene.add(ring);
      this.rings.push(ring);
    }
  }

  /** Reposition rings under the selected entities each frame. */
  render(): void {
    let i = 0;
    for (const id of this.ids) {
      const m = this.meshes.get(id);
      if (m) this.rings[i]?.position.set(m.group.position.x, 0.03, m.group.position.z);
      i++;
    }
  }
}
