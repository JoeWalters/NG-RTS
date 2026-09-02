import type { Game } from '../core/game.js';
import { Unit } from './unit.js';

export class ControlPoint {
  readonly pos: { x: number; y: number };
  owner = -1; // -1 = neutral
  captureProgress = 0;
  holdTime = 0;
  readonly radius = 3;
  alive = true;
  readonly kind = 'controlpoint';
  id = 0;

  constructor(pos: { x: number; y: number }) {
    this.pos = { ...pos };
  }
}

const CAPTURE_TIME = 3;
const INCOME_PER_POINT = 3; // credits/s per owned point
const VICTORY_HOLD = 30; // hold REQUIRED_POINTS for this many seconds to win
const REQUIRED_POINTS = 2;

/**
 * Control points: captured by standing units, grant trickle income, and drive
 * a victory timer (hold 2 of 3 points for 30s to win).
 */
export class ControlPointSystem {
  readonly points: ControlPoint[] = [];
  private nextId = 1;

  constructor(private game: Game) {
    const pts = [
      { x: 64, y: 56 },
      { x: 64, y: 72 },
      { x: 54, y: 64 },
    ];
    for (const p of pts) {
      const cp = new ControlPoint(p);
      cp.id = this.nextId++;
      this.points.push(cp);
    }
  }

  update(dt: number): void {
    for (const cp of this.points) {
      let present = -1;
      for (const e of this.game.registry.entitiesInRange(cp.pos.x, cp.pos.y, cp.radius)) {
        if (e instanceof Unit && e.alive) {
          present = e.team;
          break;
        }
      }
      if (present >= 0 && present !== cp.owner) {
        cp.captureProgress += dt;
        if (cp.captureProgress >= CAPTURE_TIME) {
          cp.owner = present;
          cp.captureProgress = 0;
        }
      } else if (present === cp.owner) {
        cp.holdTime += dt;
      } else {
        cp.captureProgress = Math.max(0, cp.captureProgress - dt);
      }
    }

    // trickle income
    for (const p of this.game.players) {
      let n = 0;
      for (const cp of this.points) if (cp.owner === p.team) n++;
      if (n > 0) p.addCredits(n * INCOME_PER_POINT * dt);
    }

    // victory timer
    for (const p of this.game.players) {
      const n = this.points.filter((cp) => cp.owner === p.team).length;
      if (n >= REQUIRED_POINTS) {
        p.holdTimer += dt;
        if (p.holdTimer >= VICTORY_HOLD) this.game.triggerWin(p.team);
      } else {
        p.holdTimer = 0;
      }
    }
  }
}
