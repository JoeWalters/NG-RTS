import type { GridMap } from './map.js';
import type { EntityRegistry } from './entities.js';
import { moveEntity } from './collision.js';
import type { Unit } from './unit.js';

/** World contract for pathfinding/movement: map + registry. */
export interface World {
  map: GridMap;
  registry: EntityRegistry;
}

export interface Waypoint {
  x: number;
  y: number;
}

const SQRT2 = Math.SQRT2;

// --- A* over the 128x128 grid (8-dir, prefers cardinal via octile cost) ---

const DIRS: Array<[number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

function octile(sx: number, sy: number, gx: number, gy: number): number {
  const dx = Math.abs(sx - gx);
  const dy = Math.abs(sy - gy);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

/** Simple binary min-heap keyed by node score. */
class MinHeap {
  private a: Array<{ idx: number; score: number }> = [];
  push(n: { idx: number; score: number }): void {
    this.a.push(n);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].score <= this.a[i].score) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  pop(): { idx: number; score: number } | undefined {
    const top = this.a[0];
    const last = this.a.pop()!;
    if (this.a.length > 0) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = (i << 1) + 1;
        const r = l + 1;
        let m = i;
        if (l < this.a.length && this.a[l].score < this.a[m].score) m = l;
        if (r < this.a.length && this.a[r].score < this.a[m].score) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.a[i], this.a[m]];
        i = m;
      }
    }
    return top;
  }
  get size(): number {
    return this.a.length;
  }
}

function computePath(map: GridMap, sx: number, sy: number, gx: number, gy: number): Waypoint[] | null {
  const n = map.size * map.size;
  const startIdx = map.idx(sx, sy);
  const goalIdx = map.idx(gx, gy);
  if (startIdx === goalIdx) return [{ x: sx, y: sy }];

  const g = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  g[startIdx] = 0;

  const heap = new MinHeap();
  heap.push({ idx: startIdx, score: octile(sx, sy, gx, gy) });

  while (heap.size > 0) {
    const cur = heap.pop()!;
    if (closed[cur.idx]) continue;
    closed[cur.idx] = 1;
    if (cur.idx === goalIdx) break;

    const cx = cur.idx % map.size;
    const cy = (cur.idx / map.size) | 0;
    for (let d = 0; d < DIRS.length; d++) {
      const [dx, dy, cost] = DIRS[d];
      const nx = cx + dx;
      const ny = cy + dy;
      if (!map.inBounds(nx, ny) || map.isBlocked(nx, ny)) continue;
      // forbid diagonal moves that cut through a blocked corner
      if (dx !== 0 && dy !== 0) {
        if (map.isBlocked(cx + dx, cy) || map.isBlocked(cx, cy + dy)) continue;
      }
      const nIdx = map.idx(nx, ny);
      if (closed[nIdx]) continue;
      const tg = g[cur.idx] + cost;
      if (tg < g[nIdx]) {
        g[nIdx] = tg;
        parent[nIdx] = cur.idx;
        heap.push({ idx: nIdx, score: tg + octile(nx, ny, gx, gy) });
      }
    }
  }

  if (parent[goalIdx] === -1) return null; // unreachable

  // reconstruct start -> goal
  const out: Waypoint[] = [];
  let idx = goalIdx;
  while (idx !== -1) {
    out.push({ x: idx % map.size, y: (idx / map.size) | 0 });
    idx = parent[idx];
  }
  out.reverse();
  return out;
}

// --- path cache, invalidated when the map's obstacle epoch changes ---

const pathCache = new Map<string, Waypoint[] | null>();
let cacheEpoch = -1;

export function findPath(map: GridMap, sx: number, sy: number, gx: number, gy: number): Waypoint[] | null {
  if (!map.inBounds(sx, sy) || !map.inBounds(gx, gy)) return null;
  if (map.isBlocked(sx, sy) || map.isBlocked(gx, gy)) return null;
  if (cacheEpoch !== map.epoch) {
    pathCache.clear();
    cacheEpoch = map.epoch;
  }
  const key = `${sx},${sy},${gx},${gy}`;
  const hit = pathCache.get(key);
  if (hit !== undefined) return hit;
  const p = computePath(map, sx, sy, gx, gy);
  pathCache.set(key, p);
  return p;
}

/** Nearest walkable tile to (x,y): self first, then 8 neighbors. */
export function nearestWalkable(map: GridMap, x: number, y: number): Waypoint | null {
  if (!map.isBlocked(x, y)) return { x, y };
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (map.inBounds(nx, ny) && !map.isBlocked(nx, ny)) return { x: nx, y: ny };
    }
  }
  return null;
}

/**
 * Line-of-sight: every tile the segment passes through must be walkable.
 * Dense-samples ~4x per tile so diagonal segments that cross a blocked corner
 * are rejected (prevents corner-cutting during smoothed movement).
 */
export function isLineClear(map: GridMap, a: Waypoint, b: Waypoint): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 4));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (map.isBlocked(Math.floor(x), Math.floor(y))) return false;
  }
  return true;
}

/** String-pulling: drop waypoints reachable in a straight line. */
export function smoothPath(map: GridMap, path: Waypoint[]): Waypoint[] {
  if (path.length <= 2) return path.slice();
  const out: Waypoint[] = [path[0]];
  let anchor = 0;
  let i = 1;
  while (i < path.length) {
    if (isLineClear(map, path[anchor], path[i])) {
      i++;
      continue;
    }
    const last = i - 1;
    out.push(path[last]);
    anchor = last;
    i = last + 1;
  }
  if (out[out.length - 1] !== path[path.length - 1]) out.push(path[path.length - 1]);
  return out;
}

/**
 * Path following with stuck detection + re-seek (flow-field-lite).
 * Drives a Unit along its waypoints; on a >1s block it recomputes the path.
 */
export class PathFollow {
  path: Waypoint[] = [];
  idx = 0;
  arrivalRadius = 0.4;
  stuckTime = 0;
  reached = false;

  setPath(p: Waypoint[]): void {
    this.path = p;
    this.idx = 0;
    this.reached = p.length === 0;
    this.stuckTime = 0;
  }

  update(dt: number, unit: Unit, world: World): void {
    if (this.reached) return;
    if (this.path.length === 0) {
      this.reached = true;
      return;
    }
    const wp = this.path[this.idx];
    const dx = wp.x - unit.pos.x;
    const dy = wp.y - unit.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= this.arrivalRadius) {
      // snap onto the waypoint so the next segment starts from a real tile
      // (avoids diagonal corner-cutting from a drifted position)
      unit.pos.x = wp.x;
      unit.pos.y = wp.y;
      world.registry.updatePos(unit);
      this.idx++;
      if (this.idx >= this.path.length) {
        this.reached = true;
        return;
      }
      this.update(dt, unit, world); // continue to next waypoint
      return;
    }

    const step = unit.moveSpeed * dt;
    const nx = unit.pos.x + (dx / dist) * step;
    const ny = unit.pos.y + (dy / dist) * step;
    const res = moveEntity(unit, nx - unit.pos.x, ny - unit.pos.y, world);
    if (res.moved) {
      unit.facing = Math.atan2(dy, dx);
      this.stuckTime = 0;
    } else {
      this.stuckTime += dt;
      if (this.stuckTime > 1.0) {
        const goal = this.path[this.path.length - 1];
        const sx = Math.round(unit.pos.x);
        const sy = Math.round(unit.pos.y);
        const start = nearestWalkable(world.map, sx, sy);
        if (start) {
          const p = findPath(world.map, start.x, start.y, goal.x, goal.y);
          if (p) this.setPath(smoothPath(world.map, p));
        }
        this.stuckTime = 0;
      }
    }
  }

  get remaining(): number {
    return this.reached ? 0 : this.path.length - this.idx;
  }
}
