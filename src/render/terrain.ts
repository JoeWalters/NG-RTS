import * as THREE from 'three';
import { GridMap, Tile, MAP_SIZE } from '../sim/map.js';

export interface TerrainRender {
  ground: THREE.Mesh;
  trees: THREE.InstancedMesh;
  crystals: THREE.InstancedMesh;
  counts: { trees: number; crystals: number };
}

const TILE_COLORS: Record<number, number[]> = {
  // flat RGB triples per variant
  [Tile.Ground]: [
    0x3f7f4a, 0x3f7f4a, 0x3f7f4a,
    0x4a8a55, 0x4a8a55, 0x4a8a55,
    0x35713f, 0x35713f, 0x35713f,
  ],
  [Tile.Water]: [0x2f6db3, 0x2f6db3, 0x2f6db3],
  [Tile.Trees]: [0x2e5c3a, 0x2e5c3a, 0x2e5c3a],
  [Tile.Ore]: [0xd9c14a, 0xd9c14a, 0xd9c14a, 0xc9b83f, 0xc9b83f, 0xc9b83f],
  [Tile.Gems]: [0x8fd6ff, 0x8fd6ff, 0x8fd6ff, 0xa9e6ff, 0xa9e6ff, 0xa9e6ff],
};

/**
 * Procedural ground texture: paints each map tile as a colored pixel onto a
 * canvas. In headless (no DOM) environments this returns a plain placeholder
 * texture so scene-graph tests can run without a browser.
 */
function makeGroundTexture(map: GridMap): THREE.Texture {
  if (typeof document === 'undefined') {
    const t = new THREE.Texture();
    t.needsUpdate = true;
    return t;
  }
  const canvas = document.createElement('canvas');
  canvas.width = map.size;
  canvas.height = map.size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, map.size, map.size);
  for (let y = 0; y < map.size; y++) {
    for (let x = 0; x < map.size; x++) {
      const pal = TILE_COLORS[map.tileAt(x, y)];
      const n = pal.length / 3;
      const i = Math.abs((x * 7 + y * 13) ^ (x * y)) % n;
      const r = pal[i * 3];
      const g = pal[i * 3 + 1];
      const b = pal[i * 3 + 2];
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

/**
 * Builds terrain into `scene`: a full-map ground quad + instanced tree cones
 * + instanced crystal mounds. Returns the pieces + counts for tests.
 */
export function buildTerrain(map: GridMap, scene: THREE.Scene): TerrainRender {
  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(map) })
  );
  ground.rotation.x = -Math.PI / 2;
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
      dummy.position.set(x, 0.8, y);
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
