// A voiced, breathy scream: glottal harmonics through three vocal formants,
// rough subharmonics and turbulent air. One persistent voice, never overlapping
// per-frame sound instances. The game master volume controls its final output.
export class SeekerVoice {
  constructor(context, destination) {
    this.ctx = context;
    this.level = 0;
    this.sources = [];
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.pan = context.createStereoPanner();
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.006;
    limiter.release.value = 0.12;
    this.output.connect(limiter).connect(this.pan).connect(destination);
    const throat = context.createGain();
    throat.gain.value = 0.48;
    this.vocal = context.createOscillator();
    this.vocal.type = "sawtooth";
    this.vocal.frequency.value = 380;
    this.vocal.connect(throat);
    this.undertone = context.createOscillator();
    this.undertone.type = "triangle";
    this.undertone.frequency.value = 190;
    const underGain = context.createGain();
    underGain.gain.value = 0.32;
    this.undertone.connect(underGain).connect(throat);
    const noise = context.createBufferSource();
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 7819;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = (seed / 4294967296 * 2 - 1) * 0.18;
    }
    noise.buffer = buffer;
    noise.loop = true;
    noise.connect(throat);
    this.formants = [
      [850, 6, 1.0], [1450, 7, 0.8], [2900, 5, 0.32],
    ].map(([frequency, q, level]) => {
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = frequency;
      filter.Q.value = q;
      const gain = context.createGain();
      gain.gain.value = level;
      throat.connect(filter).connect(gain).connect(this.output);
      return filter;
    });
    for (const source of [this.vocal, this.undertone, noise]) {
      source.start();
      this.sources.push(source);
    }
  }

  update(intensity, pan = 0) {
    const level = Math.max(0, Math.min(1, Number.isFinite(intensity) ? intensity : 0));
    this.level = level;
    const now = this.ctx.currentTime;
    const tremor = Math.sin(now * 39) * 11 + Math.sin(now * 17.3) * 6;
    const wail = Math.sin(now * 3.9) * (22 + level * 38);
    const pitch = 340 + level * 290 + tremor + wail;
    this.vocal.frequency.setTargetAtTime(pitch, now, 0.035);
    this.undertone.frequency.setTargetAtTime(pitch * 0.497, now, 0.065);
    this.formants[0].frequency.setTargetAtTime(700 + level * 480, now, 0.1);
    this.formants[1].frequency.setTargetAtTime(1300 + level * 520, now, 0.1);
    const strain = 0.78 + 0.22 * Math.sin(now * 8.5) ** 2;
    this.output.gain.setTargetAtTime(0.6 * level ** 1.35 * strain, now, level ? 0.09 : 0.05);
    this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.08);
  }

  silence() {
    this.level = 0;
    const now = this.ctx.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(0, now);
  }

  dispose() {
    this.silence();
    this.sources.forEach((source) => source.stop());
    this.output.disconnect();
    this.pan.disconnect();
  }
}
