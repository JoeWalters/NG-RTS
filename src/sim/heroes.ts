import type { Game } from '../core/game.js';
import { Unit } from './unit.js';
import { Building } from './building.js';

const REVIVE_TIME = 5;

/**
 * Heroes are unique per-race units that revive after a timer when they die.
 * Abilities live in powers.ts; this system handles death/respawn only.
 */
export class HeroSystem {
  constructor(private game: Game) {}

  update(dt: number): void {
    for (const e of this.game.registry.all()) {
      if (!(e instanceof Unit) || !e.isHero) continue;
      const h = e as Unit;
      if (h.alive) continue;
      h.reviveTimer += dt;
      if (h.reviveTimer >= REVIVE_TIME) {
        const base = this.game.registry
          .all()
          .find((b) => b instanceof Building && b.role === 'base' && b.team === h.team);
        h.alive = true;
        h.hp = h.maxHp;
        h.reviveTimer = 0;
        if (base) {
          h.pos.x = base.pos.x + 2;
          h.pos.y = base.pos.y + 2;
        }
      }
    }
  }
}
