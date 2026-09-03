import * as THREE from 'three';
import type { Entity } from '../sim/entities.js';

export interface UnitMesh {
  group: THREE.Group;
  prevX: number;
  prevY: number;
  curX: number;
  curY: number;
  progress: number; // 0..1 construction progress (buildings)
  isBuilding: boolean;
  baseScale: number;
}

const TEAM = [0x55bbff, 0xff6b5b]; // bright Forgefolk blue, Thornkin red
const DARK = 0x23262b;
const STEEL = 0x8a9099;

function mat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.55, metalness: 0.1 });
}
function add(g: THREE.Group, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, rz = 0): void {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  if (rx) mesh.rotation.x = rx;
  if (rz) mesh.rotation.z = rz;
  g.add(mesh);
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r: number, rr: number, h: number, seg = 8) => new THREE.CylinderGeometry(r, rr, h, seg);
const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg);

/** Distinct low-poly models per unit/building kind — Warcraft-II-style silhouettes. */
function makeMesh(e: Entity): THREE.Group {
  const g = new THREE.Group();
  g.userData.entityId = e.id;
  const team = e.team % TEAM.length;
  const tc = mat(TEAM[team]);
  const dark = mat(DARK);
  const steel = mat(STEEL);
  const kind = e.kindName || '';
  const isBuilding = e.kind === 'building';

  if (isBuilding) {
    switch (kind) {
      case 'foundry':
        add(g, box(3, 2.4, 3), tc, 0, 1.2);
        add(g, cone(2, 1.6, 4), dark, 0, 2.6);
        add(g, cyl(0.18, 0.18, 2.6, 6), steel, 1.2, 2.2, -0.9);
        add(g, box(0.9, 1.4, 0.5), steel, 0.6, 1.2, 1.5);
        break;
      case 'heartwood':
        add(g, cyl(1.7, 2.1, 2.4, 8), tc, 0, 1.2);
        add(g, cone(2.4, 2.2, 6), dark, 0, 3.0);
        add(g, cone(1.8, 1.6, 6), dark, 0.9, 2.6, 0.3);
        add(g, cone(1.8, 1.6, 6), dark, -0.9, 2.6, 0.3);
        break;
      case 'boiler':
      case 'bloodflower':
        add(g, box(2.4, 1.8, 2.4), tc, 0, 0.9);
        add(g, cyl(0.9, 0.9, 1.4, 10), steel, 0, 2.1);
        add(g, cyl(0.1, 0.1, 0.9, 4), steel, 0.9, 2.6, 0.3);
        break;
      case 'smeltery':
        add(g, box(2.6, 2.2, 2.6), tc, 0, 1.1);
        add(g, cyl(0.22, 0.22, 2.8, 6), steel, 0, 2.4);
        add(g, box(0.8, 1.0, 0.5), steel, 0.8, 1.1, 1.3);
        break;
      case 'barracks':
      case 'behemothpit':
        add(g, box(3.4, 2.2, 2.8), tc, 0, 1.1);
        add(g, box(3.6, 1.3, 3.0), dark, 0, 2.3);
        add(g, box(1.0, 1.6, 0.4), steel, 1.2, 1.1, 1.4);
        break;
      case 'weaponsfactory':
        add(g, box(3.8, 2.2, 3.0), tc, 0, 1.1);
        add(g, box(4.0, 1.4, 3.2), dark, 0, 2.3);
        add(g, cyl(0.9, 0.9, 1.0, 10), steel, 0, 2.8);
        break;
      case 'hollow':
        add(g, new THREE.SphereGeometry(2.2, 10, 8), dark, 0, 0.2);
        add(g, box(1.1, 1.0, 0.6), tc, 0, 0.4, 1.4);
        break;
      case 'gunnext':
      case 'thornbriar':
        add(g, box(1.8, 1.4, 1.8), tc, 0, 0.7);
        add(g, cone(0.6, 1.0, 4), dark, 0, 1.6);
        break;
      case 'wall':
        add(g, box(2.0, 0.7, 0.6), steel, 0, 0.35, 0);
        break;
      default:
        add(g, box(3, 2.2, 3), tc, 0, 1.1);
    }
    return g;
  }

  // units
  switch (kind) {
    case 'rifleman':
      add(g, box(0.5, 0.6, 0.5), tc, 0, 0.55);
      add(g, new THREE.SphereGeometry(0.28, 6, 5), tc, 0, 1.15);
      add(g, box(0.06, 0.06, 1.0), dark, 0.2, 0.95, 0.35);
      add(g, box(0.5, 0.18, 0.3), dark, 0, 0.85);
      break;
    case 'axethrall':
      add(g, box(0.55, 0.7, 0.55), tc, 0, 0.55);
      add(g, new THREE.SphereGeometry(0.3, 6, 5), tc, 0, 1.2);
      add(g, box(0.5, 0.16, 0.12), dark, 0.3, 1.05, 0.2, 0, Math.PI / 2);
      add(g, box(0.5, 0.16, 0.12), dark, 0.3, 1.05, -0.2, 0, Math.PI / 2);
      break;
    case 'scraplorry':
    case 'marrowtender':
      add(g, box(1.2, 0.5, 1.7), tc, 0, 0.35);
      add(g, box(0.7, 0.5, 0.7), tc, 0, 0.7, 0.1);
      add(g, cone(0.5, 0.6, 4), steel, 0, 0.55, -1.0);
      add(g, cyl(0.28, 0.28, 0.2, 8), dark, -0.6, 0.2, 0.7, 0, Math.PI / 2);
      add(g, cyl(0.28, 0.28, 0.2, 8), dark, 0.6, 0.2, 0.7, 0, Math.PI / 2);
      break;
    case 'forgetank':
      add(g, box(1.4, 0.6, 2.1), tc, 0, 0.4);
      add(g, cyl(0.5, 0.5, 0.6, 10), tc, 0, 0.85);
      add(g, cyl(0.12, 0.12, 1.4, 6), steel, 0, 0.85, 1.4);
      add(g, cyl(0.4, 0.4, 0.3, 8), dark, 0, 0.25, -0.6);
      break;
    case 'barkbehemoth':
      add(g, box(1.7, 1.9, 1.7), tc, 0, 1.0);
      add(g, box(0.3, 1.4, 0.3), dark, 1.1, 1.2, 0.2);
      add(g, box(0.3, 1.4, 0.3), dark, -1.1, 1.2, 0.2);
      add(g, cone(1.1, 1.4, 6), dark, 0, 2.3);
      break;
    case 'blightgrub':
      add(g, new THREE.SphereGeometry(0.4, 6, 5), tc, 0, 0.4);
      add(g, box(0.2, 0.2, 0.7), dark, 0, 0.2, -0.5);
      break;
    case 'marshal':
      add(g, box(0.5, 0.7, 0.5), tc, 0, 0.6);
      add(g, new THREE.SphereGeometry(0.3, 6, 5), tc, 0, 1.25);
      add(g, box(0.8, 0.1, 0.6), steel, 0, 1.3, -0.4);
      add(g, box(0.06, 0.6, 0.06), steel, 0, 1.5, -0.5);
      break;
    case 'warden':
      add(g, box(0.5, 0.7, 0.5), tc, 0, 0.6);
      add(g, new THREE.SphereGeometry(0.3, 6, 5), tc, 0, 1.25);
      add(g, cone(0.3, 0.7, 4), dark, 0, 1.5);
      add(g, box(0.06, 0.5, 0.06), dark, 0.2, 1.3, 0.1);
      break;
    default:
      add(g, box(0.8, 0.6, 0.8), tc, 0, 0.3);
      add(g, cone(0.28, 0.5, 5), tc, 0, 0.85);
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
      progress: 1,
      isBuilding: e.kind === 'building',
      baseScale: e.kind === 'building' ? 1 : 2.0, // units scaled up for legibility
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
      if (m.isBuilding) {
        const b = e as unknown as { buildProgress: number; buildTime: number; active: boolean };
        m.progress = b.active ? 1 : Math.min(1, Math.max(0, b.buildProgress / b.buildTime));
      }
    }
  }

  /** Position meshes at lerp(prev, cur, alpha); scale buildings by progress. */
  render(alpha: number, time = 0): void {
    for (const m of this.byId.values()) {
      m.group.position.set(
        m.prevX + (m.curX - m.prevX) * alpha,
        0,
        m.prevY + (m.curY - m.prevY) * alpha
      );
      if (m.isBuilding) {
        const s = 0.4 + 0.6 * m.progress;
        m.group.scale.set(s, s, s);
      } else {
        m.group.scale.set(m.baseScale, m.baseScale, m.baseScale);
        m.group.position.y = Math.sin(time * 8) * 0.04; // idle bob
      }
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
