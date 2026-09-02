import type { GridMap } from './map.js';
import { Tile } from './map.js';

/**
 * Cover: incoming damage is reduced when the target sits in cover.
 * High cover = on a tree tile (0.5x); low cover = adjacent to trees (0.7x).
 */
export function coverMultiplier(map: GridMap, x: number, y: number): number {
  const t = map.tileAt(Math.floor(x), Math.floor(y));
  if (t === Tile.Trees) return 0.5;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (map.tileAt(Math.floor(x) + dx, Math.floor(y) + dy) === Tile.Trees) return 0.7;
    }
  }
  return 1.0;
}
