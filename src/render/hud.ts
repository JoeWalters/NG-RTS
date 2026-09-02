import type { Unit } from '../sim/unit.js';
import type { Player } from '../sim/player.js';

/** Pure selection/resource readout string (headless-testable). */
export function formatSelection(units: Unit[], player: Player): string {
  const u = units[0];
  const head = u
    ? `#${u.id} ${u.kind} HP ${Math.round(u.hp)}/${u.maxHp} @ ${u.pos.x.toFixed(1)},${u.pos.y.toFixed(1)}`
    : 'No selection';
  const rest = units.length > 1 ? ` (+${units.length - 1} more)` : '';
  const power = player.atPowerDeficit ? 'LOW POWER' : `${player.powerProduced}/${player.powerConsumed}`;
  return `${head}${rest} | Credits ${player.credits} | Gas ${player.gas} | Power ${power}`;
}

/** Minimal DOM overlay (full HUD comes in Chunk 7). */
export class HUD {
  constructor(private el: HTMLElement) {}

  update(units: Unit[], player: Player): void {
    this.el.textContent = formatSelection(units, player);
  }
}
