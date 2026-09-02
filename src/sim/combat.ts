import type { Game } from '../core/game.js';
import { Unit } from './unit.js';
import { coverMultiplier } from './cover.js';
import { SUPPRESS_PER_HIT, MAX_SUPPRESSION } from './squads.js';
import type { Entity } from './entities.js';

export interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  attackerId: number;
  speed: number;
  damage: number;
  fromTeam: number;
}

const AGGRO = 12;
const REAR_ANGLE = Math.PI / 2;

/**
 * CombatSystem: attack orders fire projectiles that travel and apply damage on
 * arrival. Damage is modified by cover and directional (rear-hit) armor; firing
 * from squads applies suppression. Deterministic and headless-testable.
 */
export class CombatSystem {
  readonly projectiles: Projectile[] = [];
  private nextId = 1;

  constructor(private game: Game) {}

  update(dt: number): void {
    for (const e of this.game.registry.all()) {
      if (!(e instanceof Unit)) continue;
      const u = e as Unit;
      if (!u.alive) continue;
      u.cooldown = Math.max(0, u.cooldown - dt);
      u.suppression = Math.max(0, u.suppression - 30 * dt);
      u.slowTimer = Math.max(0, u.slowTimer - dt);
      u.rooted = Math.max(0, u.rooted - dt);

      if (u.attackMove && !u.attackTargetId) {
        const t = this.acquire(u);
        if (t) u.attackTargetId = t.id;
      }
      const t = u.attackTargetId ? this.game.registry.get(u.attackTargetId) : undefined;
      if (t && t.alive && this.visible(u.team, t)) {
        const d = Math.hypot(t.pos.x - u.pos.x, t.pos.y - u.pos.y);
        if (d <= u.weaponRange) {
          u.faceTowards(t.pos);
          if (u.cooldown <= 0) {
            this.fire(u, t);
            u.cooldown = (1 / u.fireRate) * (u.pinned ? 1.5 : 1);
          }
        }
      }
    }
    this.updateProjectiles(dt);
  }

  private fire(u: Unit, t: Entity): void {
    this.projectiles.push({
      id: this.nextId++,
      x: u.pos.x,
      y: u.pos.y,
      targetId: t.id,
      attackerId: u.id,
      speed: 12,
      damage: u.damage,
      fromTeam: u.team,
    });
  }

  private updateProjectiles(dt: number): void {
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      const t = this.game.registry.get(p.targetId);
      if (!t || !t.alive) {
        this.projectiles.splice(i, 1);
        i--;
        continue;
      }
      const dx = t.pos.x - p.x;
      const dy = t.pos.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= 0.3) {
        this.impact(p, t);
        this.projectiles.splice(i, 1);
        i--;
      } else {
        const step = p.speed * dt;
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }
  }

  private impact(p: Projectile, t: Entity): void {
    const attacker = this.game.registry.get(p.attackerId) ?? undefined;
    this.applyDamage(t, p.damage, attacker);
  }

  applyDamage(target: Entity, dmg: number, attacker: Entity | undefined): void {
    if (!target.alive) return;
    let d = dmg * coverMultiplier(this.game.map, target.pos.x, target.pos.y);

    if (target.radius >= 1.5 && attacker) {
      const ang = Math.atan2(target.pos.y - attacker.pos.y, target.pos.x - attacker.pos.x);
      let diff = ang - target.facing;
      diff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
      if (Math.abs(diff) > REAR_ANGLE) d *= 1.5; // rear hit bonus
    }
    if (attacker && target instanceof Unit && attacker instanceof Unit && attacker.squadSize > 1) {
      target.suppression = Math.min(MAX_SUPPRESSION, target.suppression + SUPPRESS_PER_HIT);
    }
    target.hp -= d;
    if (target.hp <= 0) target.alive = false;
  }

  /** nearest visible enemy within aggro range of u */
  acquire(u: Unit): Entity | null {
    let best: Entity | null = null;
    let bestD = AGGRO;
    for (const e of this.game.registry.all()) {
      if (e.team === u.team || !e.alive) continue;
      if (!this.visible(u.team, e)) continue;
      const d = Math.hypot(e.pos.x - u.pos.x, e.pos.y - u.pos.y);
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private visible(team: number, e: Entity): boolean {
    return this.game.fog.isVisible(team, e.pos.x, e.pos.y);
  }
}
