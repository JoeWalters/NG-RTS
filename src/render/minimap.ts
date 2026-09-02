import type { GridMap } from '../sim/map.js';
import { Tile, MAP_SIZE } from '../sim/map.js';
import type { FogSystem } from '../sim/fog.js';
import type { EntityRegistry } from '../sim/entities.js';
import { Unit } from '../sim/unit.js';

const TILE_COLOR: Record<number, string> = {
  [Tile.Ground]: '#3f7f4a',
  [Tile.Water]: '#2f6db3',
  [Tile.Trees]: '#2e5c3a',
  [Tile.Ore]: '#d9c14a',
  [Tile.Gems]: '#8fd6ff',
  [Tile.Gas]: '#7fe0c0',
};

export interface MinimapSample {
  terrain: number;
  fogged: number;
  dots: number;
}

/**
 * Pure minimap data pass (headless-testable): counts painted tiles, fogged
 * tiles, and unit dots for a player. drawMinimap() uses this to paint.
 */
export function sampleMinimap(
  map: GridMap,
  fog: FogSystem,
  entities: EntityRegistry,
  player: number
): MinimapSample {
  let terrain = 0;
  let fogged = 0;
  let dots = 0;
  for (let y = 0; y < map.size; y++) {
    for (let x = 0; x < map.size; x++) {
      if (map.tileAt(x, y) !== Tile.Ground) terrain++;
      if (!fog.isExplored(player, x, y)) fogged++;
    }
  }
  for (const e of entities.all()) {
    if (!e.alive) continue;
    if (e.team === player || fog.isVisible(player, e.pos.x, e.pos.y)) dots++;
  }
  return { terrain, fogged, dots };
}

/**
 * 2D minimap: paints terrain + shroud/fog + unit dots on a canvas, and
 * click-to-move the camera. Updated at ~10Hz.
 */
export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private lastUpdate = 0;
  private scale: number;

  constructor(
    private canvas: HTMLCanvasElement,
    private map: GridMap,
    private fog: FogSystem,
    private entities: EntityRegistry,
    private onJump: (x: number, y: number) => void
  ) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    this.ctx = canvas.getContext('2d')!;
    this.scale = canvas.width / MAP_SIZE;
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / canvas.width) * MAP_SIZE;
      const y = ((e.clientY - r.top) / canvas.height) * MAP_SIZE;
      this.onJump(x, y);
    });
  }

  /** Throttled render (10Hz). player = which side to show shroud/fog for. */
  update(player: number, nowMs: number): void {
    if (nowMs - this.lastUpdate < 100) return;
    this.lastUpdate = nowMs;
    this.draw(player);
  }

  private draw(player: number): void {
    const ctx = this.ctx;
    const s = this.scale;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < this.map.size; y++) {
      for (let x = 0; x < this.map.size; x++) {
        const t = this.map.tileAt(x, y);
        ctx.fillStyle = TILE_COLOR[t] ?? '#3f7f4a';
        ctx.fillRect(x * s, y * s, s + 0.5, s + 0.5);
      }
    }

    // shroud/fog overlay
    for (let y = 0; y < this.map.size; y++) {
      for (let x = 0; x < this.map.size; x++) {
        if (!this.fog.isExplored(player, x, y)) {
          ctx.fillStyle = 'rgba(0,0,0,0.85)';
          ctx.fillRect(x * s, y * s, s + 0.5, s + 0.5);
        } else if (!this.fog.isVisible(player, x, y)) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x * s, y * s, s + 0.5, s + 0.5);
        }
      }
    }

    // unit dots (own team solid, visible enemies red-ish)
    for (const e of this.entities.all()) {
      if (!e.alive) continue;
      const show = e.team === player || this.fog.isVisible(player, e.pos.x, e.pos.y);
      if (!show) continue;
      ctx.fillStyle = e.team === player ? '#00e0ff' : '#ff5555';
      ctx.fillRect(e.pos.x * s, e.pos.y * s, e instanceof Unit ? 2.2 : 3.2, e instanceof Unit ? 2.2 : 3.2);
    }
  }
}
