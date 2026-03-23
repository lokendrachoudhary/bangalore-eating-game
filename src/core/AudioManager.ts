/**
 * Procedural audio using Web Audio API - no external files needed.
 * Creates satisfying "gulp" and "whoosh" sounds that pitch-shift by object size.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** Satisfying gulp sound when consuming an object. Tier 0-4 shifts the pitch. */
  playEat(tier: number = 0): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Base frequency goes lower for bigger objects
    const baseFreq = 300 - tier * 40;

    // Oscillator for the "gulp" tone
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, now + 0.15);

    // Gain envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Big gulp for eating another hole */
  playBigEat(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Lower, meatier sound
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    // Add some distortion for impact
    const distortion = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = Math.tanh(x * 3);
    }
    distortion.curve = curve;

    osc.connect(distortion);
    distortion.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  /** Tier-up celebration sound */
  playTierUp(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Rising arpeggio
    const notes = [400, 500, 600, 800];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const start = now + i * 0.08;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  /** Game over sound */
  playGameOver(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(200, now + 0.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  /** Death / respawn sound */
  playDeath(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}
