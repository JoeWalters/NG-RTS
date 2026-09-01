/**
 * Deterministic seeded PRNG for the pure simulation.
 * Mulberry32 — small, fast, reproducible across runs/platforms.
 * The simulation MUST use this RNG (never Math.random) so headless tests
 * can replay identical runs from a fixed seed.
 */
export class RNG {
  private s: number;

  constructor(seed: number) {
    this.s = (seed >>> 0) || 1;
  }

  /** Next float in [0, 1). */
  next(): number {
    let t = (this.s += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Random integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Random float in [min, max). */
  range(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Deterministic sequence of n draws. */
  sequence(n: number): number[] {
    const out: number[] = new Array(n);
    for (let i = 0; i < n; i++) out[i] = this.next();
    return out;
  }
}
