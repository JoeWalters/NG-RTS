/**
 * Fixed-timestep simulation loop (Chunk 0 stub).
 *
 * The simulation is pure and render-agnostic: it steps in discrete ticks so it
 * is deterministic and can be driven headlessly in Node tests. Rendering later
 * interpolates between ticks. Chunks 1+ will own the real `Game`; this is the
 * accumulator skeleton the harness exercises now.
 */
export const DEFAULT_TICK = 1 / 30; // 30 ticks/second

export interface FixedLoopOptions {
  tick?: number;
  maxFrame?: number; // clamp accumulated time to avoid spiral-of-death
}

export class FixedLoop {
  private accumulator = 0;
  private tick: number;
  private maxFrame: number;
  private ticks = 0;
  private running = false;

  constructor(
    private readonly step: (dt: number, tick: number) => void,
    opts: FixedLoopOptions = {}
  ) {
    this.tick = opts.tick ?? DEFAULT_TICK;
    this.maxFrame = opts.maxFrame ?? 0.1;
  }

  /** Feed a frame's elapsed seconds; steps 0..n fixed ticks. Returns ticks run. */
  frame(dt: number): number {
    if (!this.running) return 0;
    this.accumulator += Math.min(dt, this.maxFrame);
    let n = 0;
    while (this.accumulator >= this.tick) {
      this.step(this.tick, this.ticks);
      this.accumulator -= this.tick;
      this.ticks++;
      n++;
    }
    return n;
  }

  /** Run `seconds` of simulated time synchronously (headless). Returns tick count. */
  run(seconds: number): number {
    const wasRunning = this.running;
    this.running = true;
    this.accumulator = 0;
    let total = 0;
    // advance in tick-sized slices so determinism matches frame() exactly
    const n = Math.floor(seconds / this.tick);
    for (let i = 0; i < n; i++) {
      this.step(this.tick, this.ticks);
      this.ticks++;
      total++;
    }
    this.running = wasRunning;
    return total;
  }

  start(): void {
    this.running = true;
    this.accumulator = 0;
  }

  stop(): void {
    this.running = false;
  }

  reset(): void {
    this.accumulator = 0;
    this.ticks = 0;
  }

  get tickCount(): number {
    return this.ticks;
  }
}
