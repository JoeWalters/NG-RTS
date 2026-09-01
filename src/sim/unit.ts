import { Entity } from './entities.js';

/**
 * Unit (mobile) stub — Chunk 1 placeholder. Chunks 2/4 add pathfinding,
 * orders, squads, and combat.
 */
export class Unit extends Entity {
  readonly kind = 'unit';
  speed = 1; // tiles/second (stub)
  hp = 100;
  maxHp = 100;

  constructor(pos: { x: number; y: number }, team: number, facing = 0) {
    super(pos, 0.5, team, facing);
  }
}
