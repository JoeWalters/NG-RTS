import { Entity } from './entities.js';
import { findPath, smoothPath, PathFollow, World, Waypoint } from './pathfind.js';
import { applySeparation } from './collision.js';
import { OrderQueue, Order, UnitOrderState } from './order.js';

/**
 * Unit (mobile) — Chunk 2 adds movement: moveTo / attackMoveTo / path following.
 * Chunks 4/6 add orders, squads, and combat.
 */
export class Unit extends Entity {
  readonly kind = 'unit';
  speed = 2; // tiles/second
  hp = 100;
  maxHp = 100;
  /** fight-while-moving flag (combat itself arrives in Chunk 6). */
  attackMove = false;

  // --- Chunk 5 economy roles ---
  role = 'unit'; // 'harvester' etc.
  kindName = '';
  /** true while the EconomySystem owns this unit's movement */
  economyActive = false;
  /** visual: harvester is carrying cargo */
  carrying = false;

  // --- ordering (Chunk 4) ---
  readonly orders = new OrderQueue();
  orderState: UnitOrderState = 'idle';
  attackTargetId = 0;
  harvestTargetId = 0;
  harvestPoint?: { x: number; y: number };
  buildKind = '';
  buildTarget: { x: number; y: number } = { x: 0, y: 0 };
  /** deployable bases (Mule/Worldroot) arrive with races in Chunk 5 */
  deployable = false;

  private mover = new PathFollow();

  constructor(pos: { x: number; y: number }, team: number, facing = 0) {
    super(pos, 0.5, team, facing);
  }

  /** Plan a path to (gx,gy); returns false if no path exists. */
  moveTo(gx: number, gy: number, world: World): boolean {
    const sx = Math.round(this.pos.x);
    const sy = Math.round(this.pos.y);
    const p = findPath(world.map, sx, sy, gx, gy);
    if (!p) return false;
    this.mover.setPath(smoothPath(world.map, p));
    this.attackMove = false;
    return true;
  }

  /** Same as moveTo but sets attack-move (fight while traveling). */
  attackMoveTo(gx: number, gy: number, world: World): boolean {
    const ok = this.moveTo(gx, gy, world);
    this.attackMove = ok;
    return ok;
  }

  /** Advance movement one tick: follow path + same-team separation. */
  updateMovement(dt: number, world: World): void {
    this.mover.update(dt, this, world);
    applySeparation({ map: world.map, registry: world.registry });
  }

  get moving(): boolean {
    return !this.mover.reached;
  }

  get reached(): boolean {
    return this.mover.reached;
  }

  get waypoints(): Waypoint[] {
    return this.mover.path;
  }

  /** Push an order onto the queue. `stop` preempts any pending orders. */
  issue(order: Order): void {
    if (order.kind === 'stop') this.orders.clear();
    this.orders.push(order);
  }

  clearOrders(): void {
    this.orders.clear();
    this.mover.setPath([]);
  }

  /** Stop moving and clear the path. */
  stopMovement(): void {
    this.mover.setPath([]);
  }

  faceTowards(p: { x: number; y: number }): void {
    this.facing = Math.atan2(p.y - this.pos.y, p.x - this.pos.x);
  }
}
