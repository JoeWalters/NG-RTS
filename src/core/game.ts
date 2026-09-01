import { generateMap, GridMap } from '../sim/map.js';
import { EntityRegistry } from '../sim/entities.js';
import { Unit } from '../sim/unit.js';
import { Building } from '../sim/building.js';
import { Player } from '../sim/player.js';
import { FixedLoop, DEFAULT_TICK } from './loop.js';

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
  worldTime = 0;
  tickCount = 0;

  private loop: FixedLoop;

  constructor(seed = 12345) {
    this.seed = seed;
    this.map = generateMap(seed);
    this.players = [new Player(0), new Player(1)];
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
    this.orders.update(dt);
    this.movement.update(dt);
    this.economy.update(dt);
    this.power.update(dt);
    this.combat.update(dt);
    this.fog.update(dt);
    this.ai.update(dt);
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
    return this.registry.add(new Building({ x, y }, team));
  }

  // --- placeholder subsystems (implemented in later chunks) ---
  private orders = { update: (_dt: number) => {} };
  private movement = { update: (_dt: number) => {} };
  private economy = { update: (_dt: number) => {} };
  private power = { update: (_dt: number) => {} };
  private combat = { update: (_dt: number) => {} };
  private fog = { update: (_dt: number) => {} };
  private ai = { update: (_dt: number) => {} };
}
