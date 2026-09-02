import type { Unit } from '../sim/unit.js';
import type { Player } from '../sim/player.js';
import { BUILDINGS } from '../sim/races.js';

/** Pure resource readout (headless-testable). */
export function formatResources(player: Player): string {
  const power = player.atPowerDeficit ? 'LOW POWER' : `${player.powerProduced}/${player.powerConsumed}`;
  return `Credits ${player.credits} | Gas ${player.gas} | Power ${power}`;
}

/** Pure selection readout (kept from Chunk 4). */
export function formatSelection(units: Unit[], player: Player): string {
  const u = units[0];
  const head = u
    ? `#${u.id} ${u.kindName || u.kind} squad ${u.squadSize} HP ${Math.round(u.hp)}/${u.maxHp} @ ${u.pos.x.toFixed(1)},${u.pos.y.toFixed(1)}${u.pinned ? ' PINNED' : ''}`
    : 'No selection';
  const rest = units.length > 1 ? ` (+${units.length - 1} more)` : '';
  return `${head}${rest} | ${formatResources(player)}`;
}

export interface SidebarEntry {
  kind: string;
  name: string;
  cost: number;
  power: number;
  role: string;
}

/** Buildable sidebar entries for a race (pure, testable). */
export function sidebarEntries(team: number, player: Player): SidebarEntry[] {
  const entries: SidebarEntry[] = [];
  for (const b of BUILDINGS) {
    if (b.cost === 0) continue; // base is deployed, not built
    if (b.cost > player.credits) continue; // unaffordable
    entries.push({
      kind: b.kind,
      name: b.kind,
      cost: b.cost,
      power: b.power,
      role: b.role,
    });
  }
  void team;
  return entries;
}

/** Procedural portrait color per unit kind (no assets). */
export function portraitColor(kind: string): string {
  switch (kind) {
    case 'rifleman': return '#3a9cff';
    case 'axethrall': return '#d44a4a';
    case 'scraplorry':
    case 'marrowtender': return '#c9b83f';
    case 'forgetank': return '#2a6db3';
    case 'barkbehemoth': return '#6a9c3a';
    default: return '#888888';
  }
}

export interface HudState {
  player: Player;
  selection: Unit[];
  timer: number;
  fps: number;
  announce: string;
  gameOver: boolean;
  winner: number;
  buildMode: string | null;
}

/**
 * Full DOM HUD (Chunk 7): resource bar, sidebar, selection, announcements,
 * hero panel stub, pause/timer/FPS, and win/lose overlay. DOM is browser-only;
 * the formatting helpers above are pure and tested.
 */
export class HUD {
  private resourcesEl: HTMLElement;
  private sidebarEl: HTMLElement;
  private selectionEl: HTMLElement;
  private announceEl: HTMLElement;
  private metaEl: HTMLElement;
  private overlayEl: HTMLElement;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div id="hud-top-inner" style="display:flex;gap:12px;align-items:center;padding:4px;color:#dfe">
        <span id="hud-resources"></span>
        <span id="hud-meta"></span>
      </div>
      <div id="hud-side-inner" style="position:absolute;top:6px;right:6px;width:200px;color:#dfe;font-size:12px">
        <div id="hud-sidebar"></div>
        <div id="hud-hero" style="margin-top:6px;background:#0006;padding:3px">Hero: Q/W/E</div>
      </div>
      <div id="hud-bottom-inner" style="position:absolute;bottom:6px;left:6px;color:#dfe;font-size:13px;background:#0005;padding:4px">
        <div id="hud-selection"></div>
        <div id="hud-announce"></div>
      </div>
      <div id="hud-overlay" style="position:absolute;inset:0;display:none;place-items:center;color:#fff;font-size:34px;background:#000a"></div>`;

    this.resourcesEl = root.querySelector('#hud-resources')!;
    this.metaEl = root.querySelector('#hud-meta')!;
    this.sidebarEl = root.querySelector('#hud-sidebar')!;
    this.selectionEl = root.querySelector('#hud-selection')!;
    this.announceEl = root.querySelector('#hud-announce')!;
    this.overlayEl = root.querySelector('#hud-overlay')!;
  }

  /** Rebuild the sidebar once (buildable entries change rarely). */
  setSidebar(entries: SidebarEntry[], onPick: (kind: string) => void): void {
    this.sidebarEl.innerHTML = entries
      .map(
        (e) =>
          `<button data-kind="${e.kind}" style="display:block;width:100%;margin:2px 0;background:#0008;color:#dfe;border:1px solid #666;cursor:pointer" title="cost ${e.cost}">
            ${e.name} <span style="color:#c9b83f">${e.cost}c</span>${e.power > 0 ? ' <span style="color:#7fe0c0">+pwr</span>' : ''}
          </button>`
      )
      .join('');
    this.sidebarEl.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => onPick(btn.dataset.kind!));
    });
  }

  update(state: HudState): void {
    this.resourcesEl.textContent = formatResources(state.player);
    this.metaEl.textContent = `t ${Math.floor(state.timer)}s | ${Math.round(state.fps)}fps${state.buildMode ? ` | build:${state.buildMode}` : ''}`;
    this.selectionEl.textContent = formatSelection(state.selection, state.player);
    this.announceEl.textContent = state.announce;
    if (state.gameOver) {
      this.overlayEl.style.display = 'grid';
      this.overlayEl.textContent =
        state.winner === 0 ? 'VICTORY' : state.winner === 1 ? 'DEFEAT' : 'MATCH ENDED';
    } else {
      this.overlayEl.style.display = 'none';
    }
  }
}
