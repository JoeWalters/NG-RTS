import { RNG } from '../util/rng.js';

/**
 * Chunk 1: the 128x128 tile grid.
 *
 * Tile semantics:
 * - Ground: walkable, buildable.
 * - Water / Trees: block ground movement (forest obstacle; water impassable).
 * - Ore / Gems: walkable resource fields (harvesters drive onto them in Chunk 5).
 * Buildings later occupy tiles via an occupancy grid (not stored as tile types).
 *
 * The map is generated deterministically from a seed via RNG (never Math.random).
 */
export const MAP_SIZE = 128;

export enum Tile {
  Ground = 0,
  Water = 1,
  Trees = 2,
  Ore = 3,
  Gems = 4,
}

export interface MapPos {
  x: number;
  y: number;
}

/** Named base anchors used by map gen and tests. */
export const BASE_BLUE = { x: 20, y: 20 };
export const BASE_RED = { x: 108, y: 108 };
export const CENTER = { x: 64, y: 64 };

export class GridMap {
  readonly size: number;
  private tiles: Uint8Array;
  /** building occupancy: tile index -> building entity id (0 = free). */
  private occupied: Int32Array;

  constructor(size = MAP_SIZE) {
    this.size = size;
    const n = size * size;
    this.tiles = new Uint8Array(n);
    this.occupied = new Int32Array(n);
  }

  idx(x: number, y: number): number {
    return y * this.size + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  tileAt(x: number, y: number): Tile {
    if (!this.inBounds(x, y)) return Tile.Water;
    return this.tiles[this.idx(x, y)];
  }

  setTile(x: number, y: number, t: Tile): void {
    if (this.inBounds(x, y)) this.tiles[this.idx(x, y)] = t;
  }

  /** Ground-movement blocking: water, trees, and building-occupied tiles. */
  isBlocked(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    const t = this.tiles[this.idx(x, y)];
    if (t === Tile.Water || t === Tile.Trees) return true;
    return this.occupied[this.idx(x, y)] !== 0;
  }

  // --- building occupancy ---
  occupy(x: number, y: number, buildingId: number): boolean {
    if (!this.inBounds(x, y) || this.occupied[this.idx(x, y)] !== 0) return false;
    this.occupied[this.idx(x, y)] = buildingId;
    return true;
  }

  release(x: number, y: number, buildingId: number): void {
    if (!this.inBounds(x, y)) return;
    if (this.occupied[this.idx(x, y)] === buildingId) this.occupied[this.idx(x, y)] = 0;
  }

  /** Serialize the tile grid (for determinism comparisons in tests). */
  serialize(): number[] {
    return Array.from(this.tiles);
  }
}

function fillCircle(
  map: GridMap,
  cx: number,
  cy: number,
  radius: number,
  tile: Tile,
  rng: RNG,
  jitter = 2
): void {
  const r2 = radius * radius;
  const lo = Math.max(0, Math.floor(cx - radius) - jitter);
  const hi = Math.min(map.size - 1, Math.ceil(cx + radius) + jitter);
  const loY = Math.max(0, Math.floor(cy - radius) - jitter);
  const hiY = Math.min(map.size - 1, Math.ceil(cy + radius) + jitter);
  for (let y = loY; y <= hiY; y++) {
    for (let x = lo; x <= hi; x++) {
      const jx = rng.range(-jitter, jitter);
      const jy = rng.range(-jitter, jitter);
      const dx = (x + jx) - cx;
      const dy = (y + jy) - cy;
      if (dx * dx + dy * dy <= r2) map.setTile(x, y, tile);
    }
  }
}

function clearCircle(map: GridMap, cx: number, cy: number, radius: number): void {
  const r2 = radius * radius;
  const lo = Math.max(0, Math.floor(cx - radius));
  const hi = Math.min(map.size - 1, Math.ceil(cx + radius));
  const loY = Math.max(0, Math.floor(cy - radius));
  const hiY = Math.min(map.size - 1, Math.ceil(cy + radius));
  for (let y = loY; y <= hiY; y++) {
    for (let x = lo; x <= hi; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) map.setTile(x, y, Tile.Ground);
    }
  }
}

/**
 * Deterministic map generation.
 * - Clears everything to ground.
 * - Base clearings at the two corners.
 * - A central lake + scattered ponds (water).
 * - A center forest ring + scattered trees.
 * - Ore fields near each base; a richer gem field at center.
 */
export function generateMap(seed: number): GridMap {
  const map = new GridMap();
  const rng = new RNG(seed);

  // Base clearings
  clearCircle(map, BASE_BLUE.x, BASE_BLUE.y, 10);
  clearCircle(map, BASE_RED.x, BASE_RED.y, 10);

  // Water: central lake + ponds
  fillCircle(map, 70, 45, 9, Tile.Water, rng);
  fillCircle(map, 58, 78, 7, Tile.Water, rng);
  for (let i = 0; i < 6; i++) {
    const px = rng.int(15, 110);
    const py = rng.int(15, 110);
    if (dist(px, py, BASE_BLUE) > 16 && dist(px, py, BASE_RED) > 16) {
      fillCircle(map, px, py, rng.int(2, 4), Tile.Water, rng);
    }
  }

  // Forest ring around center + scatter
  const ringLo = 18;
  const ringHi = 42;
  for (let y = 0; y < map.size; y++) {
    for (let x = 0; x < map.size; x++) {
      const d = dist(x, y, CENTER);
      if (d >= ringLo && d <= ringHi) map.setTile(x, y, Tile.Trees);
    }
  }
  for (let i = 0; i < 220; i++) {
    const tx = rng.int(6, 121);
    const ty = rng.int(6, 121);
    if (dist(tx, ty, BASE_BLUE) > 14 && dist(tx, ty, BASE_RED) > 14) {
      map.setTile(tx, ty, Tile.Trees);
    }
  }

  // Ore near each base
  fillCircle(map, BASE_BLUE.x + 9, BASE_BLUE.y + 9, 5, Tile.Ore, rng);
  fillCircle(map, BASE_RED.x - 9, BASE_RED.y - 9, 5, Tile.Ore, rng);

  // Richer gem field at center
  fillCircle(map, CENTER.x, CENTER.y, 6, Tile.Gems, rng, 3);

  return map;
}

function dist(ax: number, ay: number, b: { x: number; y: number }): number {
  const dx = ax - b.x;
  const dy = ay - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
