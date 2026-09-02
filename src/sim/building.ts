import { Entity } from './entities.js';
import type { BuildingDef, BuildingRole } from './races.js';
import { buildingDef, unitDef, RACES } from './races.js';
import type { Game } from '../core/game.js';
import type { Player } from './player.js';

/**
 * Building — Chunk 5: role, construction (prefab vs growth), power, and a
 * sequential production queue (train infantry / build vehicles).
 */
export class Building extends Entity {
  readonly kind = 'building';
  kindName: string;
  role: BuildingRole;
  cost: number;
  buildTime: number;
  buildProgress = 0;
  /** becomes true once construction finishes (or instantly for bases) */
  active = false;
  powerConsumed = 0;
  powerProvided = 0;
  /** production queue: [{kind, progress, time}] */
  queue: Array<{ kind: string; progress: number; time: number }> = [];

  constructor(pos: { x: number; y: number }, team: number, def: BuildingDef) {
    super(pos, 2, team);
    this.kindName = def.kind;
    this.role = def.role;
    this.cost = def.cost;
    this.buildTime = def.buildTime;
    if (def.power > 0) this.powerProvided = def.power;
    else this.powerConsumed = -def.power;
    if (def.buildTime === 0) this.active = true; // base / instant structures
  }

  hp = 500;
  maxHp = 500;

  /** Queue a unit to be trained/built; deducts cost and respects tech tier. */
  enqueue(unitKind: string, player: Player): boolean {
    const def = unitDef(unitKind);
    if ((def.tier ?? 0) > player.techTier) return false; // gas-gated tech tier
    if (!player.spend(def.cost)) return false;
    this.queue.push({ kind: unitKind, progress: 0, time: def.buildTime });
    return true;
  }

  get canProduce(): boolean {
    return this.active && (this.role === 'barracks' || this.role === 'factory');
  }
}

/** Place a building at (x,y) for a team, validating tiles + construction range. */
export function placeBuilding(game: Game, kind: string, x: number, y: number, team: number): Building | null {
  const def = buildingDef(kind);
  const raceDef = RACES[team];

  if (!game.map.inBounds(x, y) || game.map.isBlocked(x, y)) return null;
  if (!game.players[team].spend(def.cost)) return null;

  // construction range (Root-Network global for Thornkin)
  const base = game.registry.all().find(
    (e) => e instanceof Building && e.team === team && e.role === 'base'
  );
  if (base) {
    const d = Math.hypot(base.pos.x - x, base.pos.y - y);
    if (d > raceDef.buildRange) return null;
  }

  const b = new Building({ x, y }, team, def);
  // prefab drop (Forgefolk) is faster than sapling growth (Thornkin)
  b.buildTime = raceDef.buildMode === 'prefab' ? Math.max(0.5, def.buildTime * 0.5) : def.buildTime;
  game.registry.add(b);
  if (!game.map.occupy(x, y, b.id)) {
    game.registry.remove(b);
    return null;
  }
  return b;
}
