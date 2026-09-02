/**
 * Race definitions (Chunk 5): Forgefolk (Humans) vs Thornkin (Horde).
 * Encodes the asymmetric building/economy flavors. Aliens arrive in Chunk 11.
 */
export type RaceId = 0 | 1;

export interface RaceDef {
  id: RaceId;
  name: string;
  color: number;
  /** deployable base vehicle/entity */
  deployableKind: 'mule' | 'worldroot';
  baseKind: 'foundry' | 'heartwood';
  /** prefab instant-drop (Forgefolk) vs sapling growth (Thornkin) */
  buildMode: 'prefab' | 'growth';
  /** base build timer seconds; growth mode is slower */
  buildTimeBase: number;
  /** construction range: Forgefolk footprint-limited; Thornkin Root-Network global */
  buildRange: number;
  powerKind: 'boiler' | 'bloodflower';
  /** drop-off structure (base doubles as drop-off for Thornkin) */
  dropoffKind: 'smeltery' | 'heartwood';
}

export const RACES: RaceDef[] = [
  {
    id: 0,
    name: 'Forgefolk',
    color: 0x3a9cff,
    deployableKind: 'mule',
    baseKind: 'foundry',
    buildMode: 'prefab',
    buildTimeBase: 0.6,
    buildRange: 12,
    powerKind: 'boiler',
    dropoffKind: 'smeltery',
  },
  {
    id: 1,
    name: 'Thornkin',
    color: 0xd44a4a,
    deployableKind: 'worldroot',
    baseKind: 'heartwood',
    buildMode: 'growth',
    buildTimeBase: 3.0,
    buildRange: 1e9, // Root-Network: grow anywhere
    powerKind: 'bloodflower',
    dropoffKind: 'heartwood',
  },
];

export type BuildingRole =
  | 'base'
  | 'power'
  | 'dropoff'
  | 'barracks'
  | 'factory'
  | 'defense'
  | 'wall';

export interface BuildingDef {
  kind: string;
  role: BuildingRole;
  cost: number;
  /** positive = provides power, negative = consumes */
  power: number;
  buildTime: number; // seconds (0 = active immediately, e.g. base)
}

/** Shared building catalog; race flavor is cosmetic + build-mode driven. */
export const BUILDINGS: BuildingDef[] = [
  { kind: 'foundry', role: 'base', cost: 0, power: 0, buildTime: 0 },
  { kind: 'heartwood', role: 'base', cost: 0, power: 0, buildTime: 0 },
  { kind: 'boiler', role: 'power', cost: 100, power: 10, buildTime: 4 },
  { kind: 'bloodflower', role: 'power', cost: 100, power: 10, buildTime: 4 },
  { kind: 'smeltery', role: 'dropoff', cost: 150, power: -3, buildTime: 5 },
  { kind: 'barracks', role: 'barracks', cost: 120, power: -3, buildTime: 6 },
  { kind: 'weaponsfactory', role: 'factory', cost: 200, power: -5, buildTime: 8 },
  { kind: 'behemothpit', role: 'factory', cost: 200, power: -5, buildTime: 8 },
  { kind: 'gunnext', role: 'defense', cost: 80, power: -2, buildTime: 4 },
  { kind: 'thornbriar', role: 'defense', cost: 80, power: 0, buildTime: 4 },
  { kind: 'wall', role: 'wall', cost: 30, power: 0, buildTime: 1 },
];

export interface UnitDef {
  kind: string;
  cost: number;
  buildTime: number;
  from: 'barracks' | 'factory';
  role?: 'harvester';
  hp: number;
}

/** Shared trainable unit catalog (race-specific units are flavor). */
export const UNITS: UnitDef[] = [
  { kind: 'rifleman', cost: 60, buildTime: 2, from: 'barracks', hp: 100 },
  { kind: 'axethrall', cost: 55, buildTime: 2, from: 'barracks', hp: 110 },
  { kind: 'scraplorry', cost: 200, buildTime: 3, from: 'factory', role: 'harvester', hp: 150 },
  { kind: 'marrowtender', cost: 200, buildTime: 3, from: 'factory', role: 'harvester', hp: 150 },
  { kind: 'forgetank', cost: 250, buildTime: 4, from: 'factory', hp: 250 },
  { kind: 'barkbehemoth', cost: 250, buildTime: 4, from: 'factory', hp: 300 },
];

export function buildingDef(kind: string): BuildingDef {
  const d = BUILDINGS.find((b) => b.kind === kind);
  if (!d) throw new Error(`unknown building kind: ${kind}`);
  return d;
}

export function unitDef(kind: string): UnitDef {
  const d = UNITS.find((u) => u.kind === kind);
  if (!d) throw new Error(`unknown unit kind: ${kind}`);
  return d;
}
