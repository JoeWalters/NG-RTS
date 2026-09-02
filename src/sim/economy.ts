import type { Game } from '../core/game.js';
import { Unit } from './unit.js';
import { Building } from './building.js';
import { Tile } from './map.js';
import { unitDef } from './races.js';

export interface Field {
  x: number;
  y: number;
  kind: 'ore' | 'gas';
  amount: number;
  maxAmount: number;
}

interface HarvState {
  state: 'toField' | 'harvesting' | 'carrying' | 'toDropoff' | 'dumping';
  field: Field;
  cargo: number;
}

const ORE_AMOUNT = 100;
const GAS_AMOUNT = 80;
const GEM_AMOUNT = 200;
const HARVEST_RATE: Record<'ore' | 'gas', number> = { ore: 6, gas: 3 };
const CARRY: Record<'ore' | 'gas', number> = { ore: 20, gas: 10 };
const DUMP_RATE = 10;
const REGEN_RATE = 1.5;
const LOW_POWER_FACTOR = 0.5;

/**
 * EconomySystem: resource fields, harvester gather→drop cycles, power grid,
 * building construction (prefab vs growth), and production queues.
 */
export class EconomySystem {
  readonly fields: Field[] = [];

  private harvs = new Map<number, HarvState>();

  constructor(private game: Game) {
    this.fields.push(...this.buildFields());
  }

  private buildFields(): Field[] {
    const map = this.game.map;
    const fields: Field[] = [];
    for (let y = 0; y < map.size; y++) {
      for (let x = 0; x < map.size; x++) {
        const t = map.tileAt(x, y);
        let kind: 'ore' | 'gas' | null = null;
        let amount = 0;
        if (t === Tile.Ore) { kind = 'ore'; amount = ORE_AMOUNT; }
        else if (t === Tile.Gas) { kind = 'gas'; amount = GAS_AMOUNT; }
        else if (t === Tile.Gems) { kind = 'ore'; amount = GEM_AMOUNT; }
        if (!kind) continue;
        // merge into a nearby field of the same kind
        let merged = false;
        for (const f of fields) {
          if (f.kind === kind && Math.hypot(f.x - x, f.y - y) <= 2.5) {
            f.amount += amount;
            f.maxAmount += amount;
            f.x = (f.x + x) / 2;
            f.y = (f.y + y) / 2;
            merged = true;
            break;
          }
        }
        if (!merged) fields.push({ x, y, kind, amount, maxAmount: amount });
      }
    }
    return fields;
  }

  update(dt: number): void {
    this.updateHarvesters(dt);
    this.updatePower();
    this.updateConstruction(dt);
    this.updateProduction(dt);
    this.regenerateFields(dt);
  }

  private world(): { map: Game['map']; registry: Game['registry'] } {
    return { map: this.game.map, registry: this.game.registry };
  }

  private powerFactor(team: number): number {
    return this.game.players[team].atPowerDeficit ? LOW_POWER_FACTOR : 1;
  }

  // --- harvesters ---
  private updateHarvesters(dt: number): void {
    for (const e of this.game.registry.all()) {
      if (!(e instanceof Unit) || e.role !== 'harvester' || !e.alive) continue;
      const u = e as Unit;
      let st = this.harvs.get(u.id);
      if (!st) {
        if (u.orderState === 'harvesting' && u.harvestPoint && !u.economyActive) {
          const f = this.nearestField(u.harvestPoint);
          if (f) {
            st = { state: 'toField', field: f, cargo: 0 };
            this.harvs.set(u.id, st);
            u.economyActive = true;
          } else {
            continue;
          }
        } else {
          continue;
        }
      }
      const f = st.field;
      switch (st.state) {
        case 'toField':
          if (Math.hypot(f.x - u.pos.x, f.y - u.pos.y) < 1.0) st.state = 'harvesting';
          else this.moveTo(u, f);
          break;
        case 'harvesting': {
          const rate = HARVEST_RATE[f.kind];
          st.cargo = Math.min(CARRY[f.kind], st.cargo + rate * dt);
          f.amount = Math.max(0, f.amount - rate * dt);
          if (st.cargo >= CARRY[f.kind] || f.amount <= 0) st.state = 'carrying';
          break;
        }
        case 'carrying':
          st.state = 'toDropoff';
          break;
        case 'toDropoff': {
          const drop = this.nearestDropoff(u.team, u.pos.x, u.pos.y);
          if (!drop) break;
          if (Math.hypot(drop.pos.x - u.pos.x, drop.pos.y - u.pos.y) < 1.6) {
            st.state = 'dumping';
          } else {
            this.moveTo(u, this.dropoffTile(drop));
          }
          break;
        }
        case 'dumping': {
          const p = this.game.players[u.team];
          const space = p.siloCapacity - p.siloUsed;
          const d = Math.min(st.cargo, DUMP_RATE * dt, Math.max(0, space));
          if (d > 0) {
            if (f.kind === 'ore') {
              p.siloUsed += d;
              p.addCredits(d);
            } else {
              p.gas += d;
            }
            st.cargo -= d;
          }
          if (st.cargo <= 0) {
            if (f.amount > 0) {
              st.state = 'toField';
            } else {
              this.harvs.delete(u.id);
              u.economyActive = false;
            }
          }
          break;
        }
      }
      u.carrying = st.cargo > 0;
    }
  }

  private moveTo(u: Unit, target: { x: number; y: number }): void {
    if (u.reached) u.moveTo(target.x, target.y, this.world());
  }

  /** A walkable tile adjacent to a building (buildings occupy their tile). */
  private dropoffTile(drop: Building): { x: number; y: number } {
    const offsets = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (const [dx, dy] of offsets) {
      const x = Math.round(drop.pos.x + dx);
      const y = Math.round(drop.pos.y + dy);
      if (this.game.map.inBounds(x, y) && !this.game.map.isBlocked(x, y)) return { x, y };
    }
    return { x: Math.round(drop.pos.x), y: Math.round(drop.pos.y) };
  }

  private nearestField(point: { x: number; y: number }): Field | null {
    let best: Field | null = null;
    let bestD = 3.0;
    for (const f of this.fields) {
      if (f.amount <= 0) continue;
      const d = Math.hypot(f.x - point.x, f.y - point.y);
      if (d <= bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  private nearestDropoff(team: number, fromX: number, fromY: number): Building | null {
    let best: Building | null = null;
    let bestD = Infinity;
    for (const e of this.game.registry.all()) {
      if (!(e instanceof Building)) continue;
      const b = e as Building;
      if (b.team !== team || !b.active) continue;
      if (b.role !== 'dropoff' && b.role !== 'base') continue;
      const d = Math.hypot(b.pos.x - fromX, b.pos.y - fromY);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  // --- power grid ---
  private updatePower(): void {
    for (const p of this.game.players) {
      let produced = 0;
      let consumed = 0;
      for (const e of this.game.registry.all()) {
        if (!(e instanceof Building)) continue;
        const b = e as Building;
        if (!b.active) continue;
        produced += b.powerProvided;
        consumed += b.powerConsumed;
      }
      p.powerProduced = produced;
      p.powerConsumed = consumed;
    }
  }

  // --- construction ---
  private updateConstruction(dt: number): void {
    for (const e of this.game.registry.all()) {
      if (!(e instanceof Building)) continue;
      const b = e as Building;
      if (b.active) continue;
      b.buildProgress += dt * this.powerFactor(b.team);
      if (b.buildProgress >= b.buildTime) b.active = true;
    }
  }

  // --- production queues ---
  private updateProduction(dt: number): void {
    for (const e of this.game.registry.all()) {
      if (!(e instanceof Building)) continue;
      const b = e as Building;
      if (!b.canProduce || b.queue.length === 0) continue;
      const item = b.queue[0];
      item.progress += dt * this.powerFactor(b.team);
      if (item.progress >= item.time) {
        b.queue.shift();
        this.spawnUnit(b, item.kind);
      }
    }
  }

  private spawnUnit(b: Building, kind: string): void {
    const def = unitDef(kind);
    const u = new Unit({ x: b.pos.x + 1.5, y: b.pos.y + 1.5 }, b.team);
    u.kindName = kind;
    u.role = def.role ?? 'unit';
    u.hp = def.hp;
    u.maxHp = def.hp;
    this.game.registry.add(u);
  }

  // --- field regen ---
  private regenerateFields(dt: number): void {
    for (const f of this.fields) {
      if (f.amount < f.maxAmount) f.amount = Math.min(f.maxAmount, f.amount + REGEN_RATE * dt);
    }
  }
}
