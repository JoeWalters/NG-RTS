import type { Game } from '../core/game.js';
import { Unit } from './unit.js';

/**
 * Hero / race ability effects — deterministic and headless-testable.
 * Marshal (Forgefolk): Steam-Strike (AoE artillery call-in).
 * Warden (Thornkin): Root-Grasp (root an enemy in place).
 */
export function steamStrike(game: Game, x: number, y: number, team: number, damage = 40, radius = 3): number {
  let hit = 0;
  for (const e of game.registry.entitiesInRange(x, y, radius)) {
    if (!(e instanceof Unit) || e.team === team || !e.alive) continue;
    e.hp -= damage;
    if (e.hp <= 0) e.alive = false;
    hit++;
  }
  return hit;
}

export function rootGrasp(game: Game, targetId: number, duration = 3): boolean {
  const t = game.registry.get(targetId);
  if (!(t instanceof Unit)) return false;
  (t as Unit).rooted = duration;
  return true;
}
