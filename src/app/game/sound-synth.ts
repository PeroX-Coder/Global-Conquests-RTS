class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private masterVolume = 0.35;
  private userHasInteracted = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.userHasInteracted = true;
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('click', unlock);
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
      window.addEventListener('click', unlock, { passive: true });
    }
  }

  private initContext(): AudioContext | null {
    if (!this.userHasInteracted) return null;
    if (this.ctx) return this.ctx;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch {
      // Audio not available (e.g. headless)
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  /** Tactical Click / Select */
  public playClick() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(this.masterVolume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  /** Territory Selection Blip */
  public playSelectTerritory() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(this.masterVolume * 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  /** Attack Launch Drum / Pulse */
  public playAttackDeploy() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(this.masterVolume * 0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  }

  /** Combat Clash */
  public playCombatClash() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    // Noise buffer + low oscillator for punchy battle impact
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.masterVolume * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  }

  /** Successful Conquest Fanfare */
  public playConquestFanfare() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.06);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.06);
      gain.gain.linearRampToValueAtTime(this.masterVolume * 0.25, ctx.currentTime + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.06 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.06);
      osc.stop(ctx.currentTime + idx * 0.06 + 0.28);
    });
  }

  /** Building Construction Sound */
  public playBuildingConstruct() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(this.masterVolume * 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  }

  /** Warning: Territory under attack */
  public playWarningAlarm() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(330, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(this.masterVolume * 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }

  /** Victory */
  public playVictory() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const chord = [261.63, 329.63, 392.00, 523.25]; // C major
    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(this.masterVolume * 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.25);
    });
  }

  /** Defeat */
  public playDefeat() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const notes = [311.13, 293.66, 277.18, 261.63];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.2);

      gain.gain.setValueAtTime(this.masterVolume * 0.2, ctx.currentTime + idx * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.2 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.2);
      osc.stop(ctx.currentTime + idx * 0.2 + 0.38);
    });
  }
}

export const soundSynth = new SoundSynthesizer();
