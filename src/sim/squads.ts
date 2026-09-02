import type { Unit } from './unit.js';

/** suppression meter threshold at which a squad is "pinned" */
export const PIN_THRESHOLD = 100;
export const MAX_SUPPRESSION = 150;
export const SUPPRESS_PER_HIT = 25;
export const REINFORCE_COST_PER_MAN = 15;

/**
 * Infantry squads share one HP pool. Reinforce adds men (healing) at cost.
 * maxSquadSize is set at spawn (e.g. 3-4 for infantry, 1 for vehicles).
 */
export function reinforce(u: Unit, player: { spend(n: number): boolean }): boolean {
  if (u.squadSize >= u.maxSquadSize) return false;
  if (!player.spend(REINFORCE_COST_PER_MAN)) return false;
  u.squadSize++;
  u.hp += u.hpPerMan;
  u.maxHp += u.hpPerMan;
  return true;
}
