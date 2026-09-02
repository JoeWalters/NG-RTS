import type { Game } from '../core/game.js';
import { Unit } from './unit.js';

/**
 * Fog of war: per-player shroud + visibility grids.
 * - explored: cleared permanently once seen (shroud lifted)
 * - visible: only tiles currently in an allied unit/building's sight
 * Enemy units are hidden unless their tile is currently visible.
 */
export class FogSystem {
  readonly size: number;
  private explored: Uint8Array[]; // per player
  private visible: Uint8Array[];

  constructor(private game: Game) {
    this.size = game.map.size;
    const n = this.size * this.size;
    this.explored = [new Uint8Array(n), new Uint8Array(n)];
    this.visible = [new Uint8Array(n), new Uint8Array(n)];
  }

  /** Recompute visibility from all entities each tick. */
  update(): void {
    this.visible[0].fill(0);
    this.visible[1].fill(0);
    for (const e of this.game.registry.all()) {
      if (!e.alive) continue;
      const r = e instanceof Unit ? (e as Unit).sightRadius : 10; // buildings see further
      const team = e.team;
      const vis = this.visible[team];
      const exp = this.explored[team];
      const xi = Math.round(e.pos.x);
      const yi = Math.round(e.pos.y);
      const r2 = r * r;
      const loX = Math.max(0, xi - r);
      const hiX = Math.min(this.size - 1, xi + r);
      const loY = Math.max(0, yi - r);
      const hiY = Math.min(this.size - 1, yi + r);
      for (let y = loY; y <= hiY; y++) {
        for (let x = loX; x <= hiX; x++) {
          const dx = x - xi;
          const dy = y - yi;
          if (dx * dx + dy * dy <= r2) {
            const idx = y * this.size + x;
            vis[idx] = 1;
            exp[idx] = 1;
          }
        }
      }
    }
  }

  isVisible(player: number, x: number, y: number): boolean {
    if (!this.game.map.inBounds(x, y)) return false;
    return this.visible[player][Math.floor(y) * this.size + Math.floor(x)] === 1;
  }

  isExplored(player: number, x: number, y: number): boolean {
    if (!this.game.map.inBounds(x, y)) return false;
    return this.explored[player][Math.floor(y) * this.size + Math.floor(x)] === 1;
  }

  /** Test/debug helper: reveal everything for a player. */
  revealAll(player: number): void {
    this.visible[player].fill(1);
    this.explored[player].fill(1);
  }
}
