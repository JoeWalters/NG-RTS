/**
 * Player state — Chunk 1 stub. Chunks 5/8 fill in production, power, tech.
 * team: 0 = Forgefolk (blue), 1 = Thornkin (red).
 */
export class Player {
  team: number;
  credits = 0; // main currency (ore-derived)
  gas = 0; // secondary resource (vents) for tech/hero (Chunk 8)
  powerProduced = 0;
  powerConsumed = 0;
  siloCapacity = 1000;
  siloUsed = 0;
  /** number of harvesters owned (for idle-harvester selection later) */
  harvesterCount = 0;

  constructor(team: number) {
    this.team = team;
  }

  get powerSurplus(): number {
    return this.powerProduced - this.powerConsumed;
  }

  get atPowerDeficit(): boolean {
    return this.powerConsumed > this.powerProduced;
  }

  addCredits(n: number): void {
    this.credits += n;
  }

  spend(n: number): boolean {
    if (n > this.credits) return false;
    this.credits -= n;
    return true;
  }
}
