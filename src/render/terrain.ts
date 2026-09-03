import * as THREE from 'three';
import { GridMap, Tile } from '../sim/map.js';

export interface TerrainRender {
  ground: THREE.Mesh;
  trees: THREE.InstancedMesh;
  crystals: THREE.InstancedMesh;
  counts: { trees: number; crystals: number };
}

const TILE_COLORS: Record<number, number[]> = {
  // brighter, more saturated palette
  [Tile.Ground]: [
    0x4c8a52, 0x4c8a52, 0x4c8a52,
    0x58945e, 0x58945e, 0x58945e,
    0x3f7a48, 0x3f7a48, 0x3f7a48,
  ],
  [Tile.Water]: [0x3a86cc, 0x3a86cc, 0x3a86cc],
  [Tile.Trees]: [0x2f6b41, 0x2f6b41, 0x2f6b41],
  [Tile.Ore]: [0xe0c94f, 0xe0c94f, 0xe0c94f, 0xd0bf46, 0xd0bf46, 0xd0bf46],
  [Tile.Gems]: [0x9fe0ff, 0x9fe0ff, 0x9fe0ff, 0xb5ecff, 0xb5ecff, 0xb5ecff],
  [Tile.Gas]: [0x8ff2cf, 0x8ff2cf, 0x8ff2cf],
};

/**
 * Procedural ground texture: paints each map tile as a colored pixel onto a
 * canvas. In headless (no DOM) environments this returns a plain placeholder
 * texture so scene-graph tests can run without a browser.
 */
/**
 * Build a flat, per-tile colored ground as a single buffer-geometry grid.
 * Uses vertex colors (no texture upload) so colors render in every browser,
 * including software-rendered/headless contexts.
 */
function buildGroundGeometry(map: GridMap): THREE.BufferGeometry {
  const n = map.size * map.size;
  const positions = new Float32Array(n * 4 * 3);
  const colors = new Float32Array(n * 4 * 3);
  const indices = new Uint32Array(n * 6);
  let vi = 0;
  let ii = 0;
  for (let y = 0; y < map.size; y++) {
    for (let x = 0; x < map.size; x++) {
      const pal = TILE_COLORS[map.tileAt(x, y)] ?? TILE_COLORS[Tile.Ground];
      const nv = pal.length / 3;
      const variant = Math.abs((x * 7 + y * 13) ^ (x * y)) % nv;
      const shade = 0.92 + 0.08 * ((Math.abs(x * 31 + y * 57) % 100) / 100);
      const i = variant * 3;
      const r = pal[i] * shade / 255;
      const g = pal[i + 1] * shade / 255;
      const b = pal[i + 2] * shade / 255;
      const corners = [
        [x, y],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1],
      ];
      for (const [cx, cz] of corners) {
        positions[vi * 3] = cx;
        positions[vi * 3 + 1] = 0;
        positions[vi * 3 + 2] = cz;
        colors[vi * 3] = r;
        colors[vi * 3 + 1] = g;
        colors[vi * 3 + 2] = b;
        vi++;
      }
      const base = (ii / 6) * 4;
      indices[ii++] = base;
      indices[ii++] = base + 1;
      indices[ii++] = base + 2;
      indices[ii++] = base;
      indices[ii++] = base + 2;
      indices[ii++] = base + 3;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}


/**
 * Builds terrain into `scene`: a full-map ground quad + instanced tree cones
 * + instanced crystal mounds. Returns the pieces + counts for tests.
 */
export function buildTerrain(map: GridMap, scene: THREE.Scene): TerrainRender {
  // ground
  const ground = new THREE.Mesh(
    buildGroundGeometry(map),
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 })
  );
  ground.position.y = 0;
  scene.add(ground);

  // count instanced tiles
  let treeN = 0;
  let crysN = 0;
  for (let y = 0; y < map.size; y++) {
    for (let x = 0; x < map.size; x++) {
      const t = map.tileAt(x, y);
      if (t === Tile.Trees) treeN++;
      else if (t === Tile.Ore || t === Tile.Gems) crysN++;
    }
  }

  const dummy = new THREE.Object3D();

  const trees = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.5, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x2e5c3a, flatShading: true }),
    treeN
  );
  let ti = 0;
  for (let y = 0; y < map.size; y++) {
    for (let x = 0; x < map.size; x++) {
      if (map.tileAt(x, y) !== Tile.Trees) continue;
      const v = ((x * 7 + y * 13) % 100) / 100;
      dummy.position.set(x, 0.8, y);
      dummy.scale.set(0.8 + v * 0.7, 0.9 + v * 0.5, 0.8 + v * 0.7);
      dummy.rotation.y = v * Math.PI * 2;
      dummy.updateMatrix();
      trees.setMatrixAt(ti++, dummy.matrix);
    }
  }
  trees.instanceMatrix.needsUpdate = true;

  const crystals = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.45, 1.3, 4),
    new THREE.MeshStandardMaterial({
      color: 0x8fd6ff,
      emissive: 0x2266aa,
      emissiveIntensity: 0.5,
      flatShading: true,
    }),
    crysN
  );
  let ci = 0;
  for (let y = 0; y < map.size; y++) {
    for (let x = 0; x < map.size; x++) {
      const t = map.tileAt(x, y);
      if (t !== Tile.Ore && t !== Tile.Gems) continue;
      dummy.position.set(x, 0.65, y);
      dummy.scale.set(1, t === Tile.Gems ? 1.3 : 0.9, 1);
      dummy.updateMatrix();
      crystals.setMatrixAt(ci++, dummy.matrix);
    }
  }
  crystals.instanceMatrix.needsUpdate = true;

  scene.add(trees);
  scene.add(crystals);
  return { ground, trees, crystals, counts: { trees: treeN, crystals: crysN } };
}
