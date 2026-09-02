/**
 * Procedural Web Audio synth + mixer (Chunk 9). No samples, no assets.
 * In headless (Node) there is no AudioContext, so every call is a safe no-op —
 * the mixer is fully testable without a browser.
 */
export type SoundKind =
  | 'click'
  | 'fire'
  | 'death'
  | 'build'
  | 'harvest'
  | 'trap'
  | 'hero'
  | 'victory'
  | 'defeat';

export class SoundMixer {
  private ctx: AudioContext | null = null;
  enabled = true;
  private master: GainNode | null = null;

  constructor() {
    if (typeof AudioContext !== 'undefined') {
      try {
        this.ctx = new AudioContext();
        this.initMaster();
      } catch {
        this.ctx = null;
      }
    } else if (typeof window !== 'undefined') {
      const wk = (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
      if (wk && typeof wk === 'function') {
        try {
          this.ctx = new (wk as { new (): AudioContext })();
          this.initMaster();
        } catch {
          this.ctx = null;
        }
      }
    }
  }

  private initMaster(): void {
    if (!this.ctx) return;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  play(kind: SoundKind): void {
    if (!this.ctx || !this.enabled || !this.master) return;
    const t = this.ctx.currentTime;
    this.synth(kind, this.ctx, this.master, t);
  }

  /** Short, deterministic one-shot synth voices per kind. */
  private synth(kind: SoundKind, ctx: AudioContext, out: GainNode, t: number): void {
    const osc = (type: OscillatorType, f0: number, f1: number, dur: number, gain: number, when = t) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, when);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), when + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g);
      g.connect(out);
      o.start(when);
      o.stop(when + dur + 0.01);
    };
    const noise = (dur: number, gain: number, when = t) => {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      src.connect(g);
      g.connect(out);
      src.start(when);
    };

    switch (kind) {
      case 'click':
        osc('square', 900, 400, 0.06, 0.25);
        break;
      case 'fire':
        noise(0.08, 0.4);
        osc('sawtooth', 220, 80, 0.1, 0.3);
        break;
      case 'death':
        osc('sawtooth', 320, 40, 0.4, 0.4);
        noise(0.3, 0.3, t + 0.05);
        break;
      case 'build':
        osc('square', 400, 900, 0.3, 0.3);
        osc('triangle', 200, 450, 0.3, 0.2, t + 0.1);
        break;
      case 'harvest':
        osc('sine', 700, 900, 0.15, 0.25);
        break;
      case 'trap':
        noise(0.25, 0.5);
        osc('sawtooth', 120, 30, 0.25, 0.35);
        break;
      case 'hero':
        osc('sine', 500, 1000, 0.5, 0.35);
        osc('sine', 750, 1500, 0.5, 0.2, t + 0.15);
        break;
      case 'victory':
        [523, 659, 784, 1046].forEach((f, i) => osc('triangle', f, f, 0.6, 0.3, t + i * 0.18));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => osc('triangle', f, f * 0.9, 0.7, 0.3, t + i * 0.22));
        break;
    }
  }
}
