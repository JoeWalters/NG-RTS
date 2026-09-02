import type { Game } from '../core/game.js';
import { Unit } from './unit.js';
import { Building } from './building.js';
import { BASE_BLUE, BASE_RED } from './map.js';

/**
 * Scripted Thornkin (team 1) skirmish AI — deterministic:
 * grow a base, harvest, produce an army, then attack-move to the enemy base.
 */
export class AISystem {
  private t = 0;
  private nextHarvester = 0;
  private nextTrain = 0;
  private attacking = false;

  constructor(private game: Game) {}

  update(dt: number): void {
    this.t += dt;
    this.ensureBase();
    this.ensureHarvesters();
    this.ensureArmy();
    this.maybeAttack();
  }

  private ensureBase(): void {
    if (this.hasBase()) return;
    // no base yet: deploy a Worldroot once
    if (this.game.registry.all().some((e) => e instanceof Unit && e.team === 1 && e.deployable)) return;
    const u = this.game.registry.get(
      this.game.spawnUnit(BASE_RED.x - 2, BASE_RED.y - 2, 1)
    ) as Unit;
    u.deployable = true;
    u.issue({ kind: 'deploy' });
  }

  private hasBase(): boolean {
    return this.game.registry
      .all()
      .some((e) => e instanceof Building && e.team === 1 && e.role === 'base');
  }

  private countHarvesters(): number {
    let n = 0;
    for (const e of this.game.registry.all()) {
      if (e instanceof Unit && e.team === 1 && e.role === 'harvester') n++;
    }
    return n;
  }

  private ensureHarvesters(): void {
    if (!this.hasBase()) return;
    if (this.t < this.nextHarvester) return;
    if (this.countHarvesters() >= 2) return;
    const base = this.game.registry
      .all()
      .find((e) => e instanceof Building && e.team === 1 && e.role === 'base') as Building;
    const h = this.game.registry.get(
      this.game.spawnUnit(base.pos.x + 2, base.pos.y + 2, 1)
    ) as Unit;
    h.role = 'harvester';
    let f: { x: number; y: number } | null = null;
    let bd = Infinity;
    for (const ff of this.game.economy.fields) {
      const d = Math.hypot(ff.x - base.pos.x, ff.y - base.pos.y);
      if (d < bd) {
        bd = d;
        f = ff;
      }
    }
    if (f) h.issue({ kind: 'harvest', target: { x: f.x, y: f.y } });
    this.nextHarvester = this.t + 3;
  }

  private countArmy(): number {
    let n = 0;
    for (const e of this.game.registry.all()) {
      if (e instanceof Unit && e.team === 1 && e.role !== 'harvester' && e.alive) n++;
    }
    return n;
  }

  private ensureArmy(): void {
    if (!this.hasBase()) return;
    if (this.t < this.nextTrain) return;
    const bar = this.game.registry
      .all()
      .find(
        (e) => e instanceof Building && e.team === 1 && (e.role === 'barracks' || e.role === 'factory')
      );
    if (!bar) return;
    const b = bar as Building;
    if (this.countArmy() < 3 && b.canProduce) {
      b.enqueue('axethrall', this.game.players[1]);
      this.nextTrain = this.t + 2;
    }
  }

  private maybeAttack(): void {
    if (this.attacking) return;
    if (this.countArmy() < 3) return;
    this.attacking = true;
    for (const e of this.game.registry.all()) {
      if (e instanceof Unit && e.team === 1 && e.role !== 'harvester') {
        (e as Unit).issue({ kind: 'attackmove', target: { x: BASE_BLUE.x, y: BASE_BLUE.y } });
      }
    }
  }
}
