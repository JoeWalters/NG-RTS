/**
 * Spatial hash for broad-phase queries. Cell-indexed buckets keyed by cell coords.
 * Positions are in tile/world units.
 */
export class SpatialHash<T extends { pos: { x: number; y: number } }> {
  private buckets = new Map<string, Set<T>>();
  readonly cellSize: number;

  constructor(cellSize = 8) {
    this.cellSize = cellSize;
  }

  private key(cx: number, cy: number): string {
    return cx + ':' + cy;
  }

  private cellOf(v: number): number {
    return Math.floor(v / this.cellSize);
  }

  clear(): void {
    this.buckets.clear();
  }

  insert(e: T): void {
    const cx = this.cellOf(e.pos.x);
    const cy = this.cellOf(e.pos.y);
    const key = this.key(cx, cy);
    let set = this.buckets.get(key);
    if (!set) {
      set = new Set();
      this.buckets.set(key, set);
    }
    set.add(e);
  }

  remove(e: T): void {
    const cx = this.cellOf(e.pos.x);
    const cy = this.cellOf(e.pos.y);
    const set = this.buckets.get(this.key(cx, cy));
    if (set) set.delete(e);
  }

  /** Re-insert after an entity moved cells (or just call insert/remove). */
  update(e: T): void {
    this.remove(e);
    this.insert(e);
  }

  /** All entities whose hash cells overlap the query circle. */
  query(x: number, y: number, radius: number): T[] {
    const out: T[] = [];
    const r = radius + this.cellSize;
    const minCx = this.cellOf(x - r);
    const maxCx = this.cellOf(x + r);
    const minCy = this.cellOf(y - r);
    const maxCy = this.cellOf(y + r);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const set = this.buckets.get(this.key(cx, cy));
        if (!set) continue;
        for (const e of set) {
          const dx = e.pos.x - x;
          const dy = e.pos.y - y;
          if (dx * dx + dy * dy <= radius * radius) out.push(e);
        }
      }
    }
    return out;
  }

  get size(): number {
    return this.buckets.size;
  }
}

// --- moveEntity: tile-blocking + entity-blocking ---

export interface MoveResult {
  moved: boolean;
  blockedByTile: boolean;
  blockedByEntity: boolean;
}

/** Minimal structural contract for the things moveEntity needs. */
export interface MoveWorld {
  map: { isBlocked(x: number, y: number): boolean };
  registry: {
    entitiesInRange(x: number, y: number, r: number): Array<{
      pos: { x: number; y: number };
      radius: number;
      alive: boolean;
    }>;
    updatePos(e: unknown): void;
  };
}

export interface Moveable {
  pos: { x: number; y: number };
  radius: number;
  alive: boolean;
}

/**
 * Attempt to move `e` by (dx,dy). Applies tile blocking and entity blocking;
 * on success updates position and the spatial hash. Returns what happened.
 */
export function moveEntity(e: Moveable, dx: number, dy: number, world: MoveWorld): MoveResult {
  const nx = e.pos.x + dx;
  const ny = e.pos.y + dy;

  if (world.map.isBlocked(nx, ny)) {
    return { moved: false, blockedByTile: true, blockedByEntity: false };
  }

  const neighbors = world.registry.entitiesInRange(nx, ny, e.radius + 0.5);
  for (const o of neighbors) {
    if (o === (e as unknown)) continue;
    if (!o.alive) continue;
    const dxo = o.pos.x - nx;
    const dyo = o.pos.y - ny;
    if (dxo * dxo + dyo * dyo < (o.radius + e.radius) * (o.radius + e.radius)) {
      return { moved: false, blockedByTile: false, blockedByEntity: true };
    }
  }

  e.pos.x = nx;
  e.pos.y = ny;
  world.registry.updatePos(e);
  return { moved: true, blockedByTile: false, blockedByEntity: false };
}

// --- same-team separation (soft push-apart within radius) ---

export interface SepWorld {
  map: { isBlocked(x: number, y: number): boolean };
  registry: {
    all(): Array<{ pos: { x: number; y: number }; radius: number; team: number }>;
    updatePos(e: unknown): void;
  };
}

function pushEntity(e: { pos: { x: number; y: number } }, ux: number, uy: number, dist: number, world: SepWorld): boolean {
  const nx = e.pos.x + ux * dist;
  const ny = e.pos.y + uy * dist;
  if (world.map.isBlocked(Math.round(nx), Math.round(ny))) return false;
  e.pos.x = nx;
  e.pos.y = ny;
  world.registry.updatePos(e);
  return true;
}

/**
 * Resolve overlaps between same-team entities: each pair within (a.radius+b.radius)
 * pushes apart along the separating axis, respecting tile blocking.
 */
export function applySeparation(world: SepWorld): void {
  const all = world.registry.all();
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (a.team !== b.team || !a.radius || !b.radius) continue;
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const rr = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < rr * rr) {
        const d = Math.sqrt(d2);
        const dist = (rr - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        pushEntity(a, -ux, -uy, dist, world);
        pushEntity(b, ux, uy, dist, world);
      }
    }
  }
}
