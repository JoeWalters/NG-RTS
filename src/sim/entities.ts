import { SpatialHash } from './collision.js';

/** Entity base: position in tile/world units, radius, team, facing, alive. */
export class Entity {
  id = 0; // assigned by EntityRegistry on add
  pos: { x: number; y: number };
  radius: number;
  team: number; // 0 = Forgefolk (blue), 1 = Thornkin (red)
  facing = 0; // radians
  alive = true;
  hp = 100;
  maxHp = 100;
  /** render/type discriminator: 'unit' | 'building' (set by subclasses) */
  kind?: string;
  /** display/procedural model name (e.g. 'rifleman', 'foundry') */
  kindName = '';

  constructor(pos: { x: number; y: number }, radius: number, team: number, facing = 0) {
    this.pos = { ...pos };
    this.radius = radius;
    this.team = team;
    this.facing = facing;
  }

  /** Move by delta (no collision here — collision.ts applies rules). */
  translate(dx: number, dy: number): void {
    this.pos.x += dx;
    this.pos.y += dy;
  }
}

/**
 * Entity registry: id lookup + spatial-hash broad-phase.
 * Pure and headless-testable.
 */
export class EntityRegistry {
  private byId = new Map<number, Entity>();
  private hash = new SpatialHash<Entity>();
  private nextId = 1;

  add(e: Entity): number {
    e.id = this.nextId++;
    this.byId.set(e.id, e);
    this.hash.insert(e);
    return e.id;
  }

  remove(e: Entity): void {
    this.byId.delete(e.id);
    this.hash.remove(e);
  }

  get(id: number): Entity | undefined {
    return this.byId.get(id);
  }

  all(): Entity[] {
    return Array.from(this.byId.values());
  }

  entitiesInRange(x: number, y: number, radius: number): Entity[] {
    return this.hash.query(x, y, radius);
  }

  /** Call after an entity's position changed (keeps hash cells in sync). */
  updatePos(e: Entity): void {
    this.hash.update(e);
  }

  get size(): number {
    return this.byId.size;
  }

  clear(): void {
    this.byId.clear();
    this.hash.clear();
  }
}
