import { generateMap, GridMap } from '../sim/map.js';
import { EntityRegistry } from '../sim/entities.js';
import { Unit } from '../sim/unit.js';
import { Building, placeBuilding } from '../sim/building.js';
import { buildingDef } from '../sim/races.js';
import { Player } from '../sim/player.js';
import { FixedLoop, DEFAULT_TICK } from './loop.js';
import { OrderSystem } from '../sim/order.js';
import { MovementSystem } from '../sim/movement.js';
import { EconomySystem } from '../sim/economy.js';
import { CombatSystem } from '../sim/combat.js';
import { FogSystem } from '../sim/fog.js';
import { TrapSystem } from '../sim/traps.js';
import { AISystem } from '../sim/ai.js';
import { HeroSystem } from '../sim/heroes.js';
import { HollowSystem } from '../sim/hollow.js';
import { ControlPointSystem } from '../sim/controlpoints.js';

/**
 * Top-level Game (Chunk 1 skeleton): owns map, players, and entity registry,
 * and drives the fixed-timestep loop. Subsystems (orders, movement, economy,
 * power, combat, fog, ai) are placeholder no-ops now and are filled in by
 * Chunks 2/4/5/6/8.
 *
 * The Game is pure and deterministic: constructed from a seed, stepped with
 * fixed dt — usable directly from Node tests with no rendering.
 */
export class Game {
  readonly seed: number;
  readonly map: GridMap;
  readonly players: Player[];
  readonly registry = new EntityRegistry();
  readonly orders: OrderSystem;
  readonly movement: MovementSystem;
  readonly economy: EconomySystem;
  readonly combat: CombatSystem;
  readonly fog: FogSystem;
  readonly traps: TrapSystem;
  readonly ai: AISystem;
  readonly heroes: HeroSystem;
  readonly hollow: HollowSystem;
  readonly controlPoints: ControlPointSystem;
  /** AI opponent (Thornkin) only runs when enabled — skirmish in main.ts */
  aiEnabled = false;
  gameOver = false;
  winner = -1;
  worldTime = 0;
  tickCount = 0;

  private loop: FixedLoop;

  constructor(seed = 12345) {
    this.seed = seed;
    this.map = generateMap(seed);
    this.players = [new Player(0), new Player(1)];
    this.players[0].credits = 500;
    this.players[1].credits = 500;
    this.orders = new OrderSystem(this);
    this.movement = new MovementSystem(this);
    this.economy = new EconomySystem(this);
    this.combat = new CombatSystem(this);
    this.fog = new FogSystem(this);
    this.traps = new TrapSystem(this);
    this.ai = new AISystem(this);
    this.heroes = new HeroSystem(this);
    this.hollow = new HollowSystem(this);
    this.controlPoints = new ControlPointSystem(this);
    this.loop = new FixedLoop((dt: number) => this.step(dt), { tick: DEFAULT_TICK });
  }

  /** One fixed simulation tick. */
  step(dt: number): void {
    this.worldTime += dt;
    this.tickCount++;
    this.update(dt);
  }

  /** Subsystems run in a fixed order — order matters for determinism. */
  private update(dt: number): void {
    this.orders.update();
    this.movement.update(dt);
    this.economy.update(dt);
    this.combat.update(dt);
    this.fog.update();
    this.traps.update();
    this.heroes.update(dt);
    this.hollow.update(dt);
    this.controlPoints.update(dt);
    if (this.aiEnabled) this.ai.update(dt);
    this.checkEnd();
  }

  /** A player who loses their base (Construction Yard / Heartwood) is defeated. */
  checkEnd(): void {
    if (this.gameOver) return;
    const base0 = this.registry
      .all()
      .some((e) => e instanceof Building && e.team === 0 && e.role === 'base' && e.alive);
    const base1 = this.registry
      .all()
      .some((e) => e instanceof Building && e.team === 1 && e.role === 'base' && e.alive);
    if (!base0) {
      this.gameOver = true;
      this.winner = 1;
    } else if (!base1) {
      this.gameOver = true;
      this.winner = 0;
    }
  }

  /** Control-point victory (and future win conditions) route through here. */
  triggerWin(team: number): void {
    this.gameOver = true;
    this.winner = team;
  }

  /** Run `seconds` of simulated time synchronously (headless). Returns ticks. */
  run(seconds: number): number {
    return this.loop.run(seconds);
  }

  // --- test/dev helpers ---
  spawnUnit(x: number, y: number, team: number): number {
    return this.registry.add(new Unit({ x, y }, team));
  }

  spawnBuilding(x: number, y: number, team: number): number {
    return this.registry.add(new Building({ x, y }, team, buildingDef('wall')));
  }

  /** Place a building (validates cost, tiles, range). Returns it or null. */
  placeBuilding(kind: string, x: number, y: number, team: number): Building | null {
    return placeBuilding(this, kind, x, y, team);
  }

  // --- placeholder subsystems (implemented in later chunks) ---
}
