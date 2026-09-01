import * as THREE from 'three';
import type { Entity } from '../sim/entities.js';

export interface UnitMesh {
  group: THREE.Group;
  prevX: number;
  prevY: number;
  curX: number;
  curY: number;
}

const TEAM_COLORS = [0x3a9cff, 0xd44a4a]; // Forgefolk blue, Thornkin red

function makeMesh(e: Entity): THREE.Group {
  const g = new THREE.Group();
  g.userData.entityId = e.id;
  const mat = new THREE.MeshStandardMaterial({
    color: TEAM_COLORS[e.team % TEAM_COLORS.length] ?? 0x888888,
    flatShading: true,
  });

  if (e.kind === 'building') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 3), mat);
    body.position.y = 1.1;
    g.add(body);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), mat);
    body.position.y = 0.3;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.5, 5),
      new THREE.MeshStandardMaterial({ color: TEAM_COLORS[e.team % TEAM_COLORS.length] ?? 0x888888 })
    );
    head.position.y = 0.85;
    g.add(head);
  }
  return g;
}

/**
 * Maps entityId -> rendered mesh and interpolates sim positions (prev/cur)
 * for smooth rendering between fixed ticks. Headless-testable (no GL needed
 * to build the scene graph).
 */
export class UnitMeshRegistry {
  private byId = new Map<number, UnitMesh>();
  readonly targets: THREE.Object3D[] = []; // raycast targets

  constructor(private scene: THREE.Scene) {}

  add(e: Entity): void {
    if (this.byId.has(e.id)) return;
    const group = makeMesh(e);
    group.position.set(e.pos.x, 0, e.pos.y);
    this.scene.add(group);
    this.byId.set(e.id, {
      group,
      prevX: e.pos.x,
      prevY: e.pos.y,
      curX: e.pos.x,
      curY: e.pos.y,
    });
    this.targets.push(group);
  }

  remove(id: number): void {
    const m = this.byId.get(id);
    if (!m) return;
    this.scene.remove(m.group);
    m.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) (mesh.material as THREE.Material).dispose();
    });
    this.byId.delete(id);
    const i = this.targets.indexOf(m.group);
    if (i >= 0) this.targets.splice(i, 1);
  }

  /** Snapshot current positions as the new interpolation start (call pre-step). */
  beginTick(): void {
    for (const m of this.byId.values()) {
      m.prevX = m.curX;
      m.prevY = m.curY;
    }
  }

  /** Read an entity's live sim position into `cur` (call post-step). */
  sync(e: Entity): void {
    const m = this.byId.get(e.id);
    if (m) {
      m.curX = e.pos.x;
      m.curY = e.pos.y;
    }
  }

  /** Position meshes at lerp(prev, cur, alpha). */
  render(alpha: number): void {
    for (const m of this.byId.values()) {
      m.group.position.set(
        m.prevX + (m.curX - m.prevX) * alpha,
        0,
        m.prevY + (m.curY - m.prevY) * alpha
      );
    }
  }

  has(id: number): boolean {
    return this.byId.has(id);
  }

  get(id: number): UnitMesh | undefined {
    return this.byId.get(id);
  }

  get size(): number {
    return this.byId.size;
  }
}
