import type { Player } from './player.js';

/** gas cost to advance to each tech tier (index = tier) */
export const TECH_GAS_COST = [0, 100, 300];

/** Advance a player's tech tier, spending gas for the gap. Returns success. */
export function advanceTech(p: Player, targetTier: number): boolean {
  if (targetTier > 2 || targetTier <= p.techTier) return false;
  let cost = 0;
  for (let t = p.techTier + 1; t <= targetTier; t++) cost += TECH_GAS_COST[t];
  if (p.gas < cost) return false;
  p.gas -= cost;
  p.techTier = targetTier;
  return true;
}
