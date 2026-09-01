import { Entity } from './entities.js';

/**
 * Building stub — Chunk 1 placeholder. Chunk 5 adds placement, build timers,
 * power consumption, and production.
 */
export class Building extends Entity {
  readonly kind = 'building';
  hp = 500;
  maxHp = 500;
  powerConsumed = 0;
  powerProvided = 0;

  constructor(pos: { x: number; y: number }, team: number, facing = 0) {
    super(pos, 2, team, facing); // buildings occupy ~2-tile footprint
  }
}
