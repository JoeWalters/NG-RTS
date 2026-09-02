import type { Game } from '../core/game.js';
import { Unit } from './unit.js';
import { Building } from './building.js';

const MINION_CAP = 8;
const MINION_RATE = 1; // per second
const MINION_HP = 40;

/**
 * The Hollow: an underground burrow building that spawns Blight-Grub minion
 * swarms over time (up to a cap) and, in the full design, hosts trap-rooms.
 */
export class HollowSystem {
  private acc = 0;

  constructor(private game: Game) {}

  update(dt: number): void {
    this.acc += dt;
    if (this.acc < 1 / MINION_RATE) return;
    this.acc = 0;
    for (const e of this.game.registry.all()) {
      if (!(e instanceof Building) || e.role !== 'hollow' || !e.active) continue;
      const b = e as Building;
      const count = this.game.registry
        .all()
        .filter((u) => u instanceof Unit && u.team === b.team && u.role === 'minion').length;
      if (count >= MINION_CAP) continue;
      const m = new Unit({ x: b.pos.x + 1.5, y: b.pos.y + 1.5 }, b.team);
      m.kindName = 'blightgrub';
      m.role = 'minion';
      m.squadSize = 1;
      m.maxSquadSize = 1;
      m.hpPerMan = MINION_HP;
      m.hp = MINION_HP;
      m.maxHp = MINION_HP;
      this.game.registry.add(m);
      break;
    }
  }
}
