import type { Game } from '../core/game.js';
import { Unit } from './unit.js';
import { Building } from './building.js';
import type { World } from './pathfind.js';

export type OrderKind =
  | 'move'
  | 'attackmove'
  | 'attack'
  | 'harvest'
  | 'build'
  | 'stop'
  | 'deploy'
  | 'garrison'
  | 'trap';

export interface Order {
  kind: OrderKind;
  target?: { x: number; y: number }; // move / build / harvest point
  targetId?: number; // attack / harvest / garrison target entity
  building?: string; // build blueprint kind (Chunk 5)
  /** internal: has this order been started? */
  started?: boolean;
}

/** Simple FIFO order queue on a unit. */
export class OrderQueue {
  private q: Order[] = [];

  push(o: Order): void {
    this.q.push(o);
  }

  shift(): Order | undefined {
    return this.q.shift();
  }

  peek(): Order | undefined {
    return this.q[0];
  }

  clear(): void {
    this.q.length = 0;
  }

  get length(): number {
    return this.q.length;
  }
}

export type UnitOrderState =
  | 'idle'
  | 'moving'
  | 'attacking'
  | 'harvesting'
  | 'building'
  | 'deploying'
  | 'garrisoned';

const WEAPON_RANGE = 2.5;
const AGGRO_RANGE = 12;

/**
 * Drives each unit's current order to completion, then advances the queue.
 * Runs inside Game's fixed update (before movement) each tick.
 */
export class OrderSystem {
  constructor(private game: Game) {}

  update(): void {
    for (const e of this.game.registry.all()) {
      if (e instanceof Unit) this.stepUnit(e);
    }
  }

  private get world(): World {
    return { map: this.game.map, registry: this.game.registry };
  }

  private stepUnit(u: Unit): void {
    if (!u.alive) return;
    const order = u.orders.peek();
    if (!order) {
      u.orderState = 'idle';
      return;
    }
    switch (order.kind) {
      case 'move':
        this.doMove(u, order);
        break;
      case 'attackmove':
        this.doAttackMove(u, order);
        break;
      case 'attack':
        this.doAttack(u, order);
        break;
      case 'harvest':
        this.doHarvest(u, order);
        break;
      case 'build':
        this.doBuild(u, order);
        break;
      case 'deploy':
        this.doDeploy(u, order);
        break;
      case 'stop':
        u.orders.shift();
        u.stopMovement();
        u.orderState = 'idle';
        break;
      case 'garrison':
      case 'trap':
        // Chunk 6 fills these in; for now mark and finish the order
        u.orderState = 'garrisoned';
        u.orders.shift();
        break;
    }
  }

  private doMove(u: Unit, order: Order): void {
    if (!order.target) {
      u.orders.shift();
      u.orderState = 'idle';
      return;
    }
    if (!order.started) {
      order.started = true;
      u.orderState = 'moving';
      const ok = u.moveTo(order.target.x, order.target.y, this.world);
      if (!ok) {
        u.orders.shift();
        u.orderState = 'idle';
      }
    } else if (!u.moving) {
      u.orders.shift();
      u.orderState = 'idle';
    }
  }

  private doAttackMove(u: Unit, order: Order): void {
    if (!order.target) {
      u.orders.shift();
      u.orderState = 'idle';
      return;
    }
    if (!order.started) {
      order.started = true;
      u.orderState = 'moving';
      u.attackMove = true;
      const ok = u.attackMoveTo(order.target.x, order.target.y, this.world);
      if (!ok) {
        u.orders.shift();
        u.orderState = 'idle';
      }
    } else if (!u.moving) {
      u.orders.shift();
      u.orderState = 'idle';
    }
  }

  private acquireTarget(u: Unit, point: { x: number; y: number }): import('./entities.js').Entity | null {
    let best: import('./entities.js').Entity | null = null;
    let bestD = AGGRO_RANGE;
    for (const e of this.game.registry.all()) {
      if (e.team === u.team || !e.alive) continue;
      const d = Math.hypot(e.pos.x - point.x, e.pos.y - point.y);
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private doAttack(u: Unit, order: Order): void {
    if (!order.started) {
      order.started = true;
      u.orderState = 'attacking';
    }
    const target =
      order.targetId != null ? this.game.registry.get(order.targetId) : this.acquireTarget(u, order.target ?? u.pos);
    if (!target || !target.alive) {
      u.orders.shift();
      u.orderState = 'idle';
      u.attackTargetId = 0;
      return;
    }
    u.attackTargetId = target.id;
    const d = Math.hypot(target.pos.x - u.pos.x, target.pos.y - u.pos.y);
    if (d > WEAPON_RANGE) {
      if (u.reached) u.moveTo(target.pos.x, target.pos.y, this.world);
    } else {
      u.faceTowards(target.pos);
    }
    // order stays active while the target is alive; Chunk 6 adds damage
  }

  private doHarvest(u: Unit, order: Order): void {
    if (!order.started) {
      order.started = true;
      u.orderState = 'harvesting';
      u.harvestTargetId = order.targetId ?? 0;
      u.harvestPoint = order.target ? { ...order.target } : undefined;
    }
    const point = order.target;
    if (point) {
      const d = Math.hypot(point.x - u.pos.x, point.y - u.pos.y);
      if (d > 1.0 && u.reached) u.moveTo(point.x, point.y, this.world);
    }
    // stay harvesting while the field is valid; Chunk 5 does the economy
  }

  private doBuild(u: Unit, order: Order): void {
    if (!order.started) {
      order.started = true;
      u.orderState = 'building';
      u.buildKind = order.building ?? '';
      u.buildTarget = order.target ? { ...order.target } : { x: u.pos.x, y: u.pos.y };
    }
    const d = Math.hypot(u.buildTarget.x - u.pos.x, u.buildTarget.y - u.pos.y);
    if (d > 1.0) {
      if (u.reached) u.moveTo(u.buildTarget.x, u.buildTarget.y, this.world);
    } else {
      u.orders.shift();
      u.orderState = 'idle';
    }
  }

  private doDeploy(u: Unit, _order: Order): void {
    if (!u.deployable) {
      u.orders.shift();
      return;
    }
    const gx = Math.round(u.pos.x);
    const gy = Math.round(u.pos.y);
    if (this.game.map.isBlocked(gx, gy)) {
      u.orders.shift();
      u.orderState = 'idle';
      return;
    }
    u.orders.shift();
    this.game.registry.remove(u);
    const b = new Building({ x: u.pos.x, y: u.pos.y }, u.team);
    this.game.registry.add(b);
    u.orderState = 'deploying';
  }
}
