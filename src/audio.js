export class HouseAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.55;
    this.voices = false;
    this.lastStep = 0;
  }
  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.drone = this.ctx.createOscillator();
    this.drone.type = "sine";
    this.drone.frequency.value = 43;
    const g = this.ctx.createGain();
    g.gain.value = 0.09;
    this.drone.connect(g).connect(this.master);
    this.drone.start();
  }
  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }
  tone(freq, duration, level = 0.1, pan = 0, type = "sine") {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain(),
      p = this.ctx.createStereoPanner();
    o.type = type;
    o.frequency.setValueAtTime(freq, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(20, freq * 0.65),
      this.ctx.currentTime + duration,
    );
    g.gain.setValueAtTime(level, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    p.pan.value = Math.max(-1, Math.min(1, pan));
    o.connect(g).connect(p).connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + duration);
  }
  step(enemy = false, pan = 0) {
    this.tone(enemy ? 65 : 95, 0.17, enemy ? 0.3 : 0.07, pan, "triangle");
    this.tone(170, 0.045, enemy ? 0.035 : 0.014, pan, "sawtooth");
  }
  chime() {
    [430, 340, 270].forEach((f, i) =>
      setTimeout(() => this.tone(f, 1, 0.08), i * 150),
    );
  }
  whisper(text) {
    if (this.voices && "speechSynthesis" in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.73;
      u.pitch = 0.6;
      u.volume = this.volume * 0.65;
      speechSynthesis.speak(u);
    }
    this.tone(120, 1.7, 0.065, Math.random() - 0.5);
  }
  pause() {
    this.ctx?.suspend();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
  resume() {
    this.ctx?.resume();
  }
}
