import type { Game } from '../core/game.js';
import { Unit } from './unit.js';

/**
 * Drives every unit's path-following + same-team separation each tick.
 * Runs after the OrderSystem (orders set paths; this moves along them).
 */
export class MovementSystem {
  constructor(private game: Game) {}

  update(dt: number): void {
    const world = { map: this.game.map, registry: this.game.registry };
    for (const e of this.game.registry.all()) {
      if (e instanceof Unit) e.updateMovement(dt, world);
    }
  }
}
