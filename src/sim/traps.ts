import { Entity } from './entities.js';
import type { Game } from '../core/game.js';
import { Unit } from './unit.js';

export type TrapKind = 'bramble' | 'tar' | 'steam';

/** Ground trap: fog-hidden until an enemy unit steps within its radius. */
export class Trap extends Entity {
  readonly kind = 'trap';
  trapKind: TrapKind;
  armed = true;
  radius = 1.0;

  constructor(pos: { x: number; y: number }, team: number, trapKind: TrapKind) {
    super(pos, 1.0, team);
    this.trapKind = trapKind;
  }
}

/**
 * TrapSystem: armed traps trigger once on the first enemy unit to enter their
 * radius. Effects are deterministic and applied to the unit's HP pool / slow.
 */
export class TrapSystem {
  constructor(private game: Game) {}

  update(): void {
    for (const e of this.game.registry.all()) {
      if (!(e instanceof Trap)) continue;
      const tr = e as Trap;
      if (!tr.armed) continue;
      for (const o of this.game.registry.entitiesInRange(tr.pos.x, tr.pos.y, tr.radius)) {
        if (!(o instanceof Unit)) continue;
        if (o.team === tr.team || !o.alive) continue;
        this.trigger(tr, o);
        break;
      }
    }
  }

  private trigger(tr: Trap, u: Unit): void {
    switch (tr.trapKind) {
      case 'bramble':
        u.hp -= 15;
        u.slowTimer = Math.max(u.slowTimer, 2);
        break;
      case 'tar':
        u.slowTimer = Math.max(u.slowTimer, 3);
        break;
      case 'steam':
        u.hp -= 20;
        break;
    }
    tr.armed = false;
  }
}
