// Web Audio synthesis: engine hum (pitch tied to speed), turbine whine, wind, boost surge, drift hiss,
// impacts, rain bed by surface/cover, neon buzz (positional) and an original synthwave bed.
export interface AudioFrame {
  speed: number; boosting: boolean; drifting: boolean; slip: number; grounded: boolean; onWater: boolean;
  rain: number; covered: boolean; cam: { x: number; y: number; z: number; fx: number; fz: number };
  buzzAt: { x: number; y: number; z: number } | null;
  tramAt?: { x: number; y: number; z: number } | null;
}

export class GameAudio {
  ctx: AudioContext | null = null;
  master!: GainNode; sfx!: GainNode; musicBus!: GainNode;
  private noise!: AudioBuffer;
  private eng: { o1: OscillatorNode; o2: OscillatorNode; sub: OscillatorNode; whine: OscillatorNode; f: BiquadFilterNode; g: GainNode; wg: GainNode } | null = null;
  private wind!: { f: BiquadFilterNode; g: GainNode };
  private rain!: { f: BiquadFilterNode; g: GainNode };
  private hiss!: { g: GainNode };
  private boostL!: { o: OscillatorNode; g: GainNode };
  private water!: { g: GainNode };
  private buzz!: { p: PannerNode; g: GainNode };
  private city!: { f: BiquadFilterNode; g: GainNode };
  private tram: PannerNode | null = null;
  private nextSiren = 0;
  private nextBeat = 0; private step = 0;
  musicOn = true; volume = 0.8;

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master = ctx.createGain(); this.master.gain.value = this.volume;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.32; this.musicBus.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.2; }
    // engine
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0; f.connect(g).connect(this.sfx);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; const o2 = ctx.createOscillator(); o2.type = 'square'; o2.detune.value = 9;
    const sub = ctx.createOscillator(); sub.type = 'sine';
    const og = ctx.createGain(); og.gain.value = 0.5; o1.connect(og); o2.connect(og); og.connect(f);
    const sg = ctx.createGain(); sg.gain.value = 0.9; sub.connect(sg).connect(g);
    const whine = ctx.createOscillator(); whine.type = 'sine'; const wg = ctx.createGain(); wg.gain.value = 0; whine.connect(wg).connect(this.sfx);
    [o1, o2, sub, whine].forEach((o) => o.start());
    this.eng = { o1, o2, sub, whine, f, g, wg };
    this.wind = this.noiseVoice('bandpass', 700, 0.7);
    this.rain = this.noiseVoice('lowpass', 2600, 0.4);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400; this.rain.f.disconnect(); this.rain.f.connect(hp).connect(this.rain.g);
    this.hiss = this.noiseVoice('highpass', 3500, 0.8);
    this.water = this.noiseVoice('bandpass', 1200, 1.4);
    const bo = ctx.createOscillator(); bo.type = 'sawtooth'; const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 900; bf.Q.value = 2;
    const bg = ctx.createGain(); bg.gain.value = 0; bo.connect(bf).connect(bg).connect(this.sfx); bo.start();
    this.boostL = { o: bo, g: bg };
    // neon buzz, positional
    const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 1.4;
    const bzg = ctx.createGain(); bzg.gain.value = 0.05;
    for (const [fr, a] of [[120, 1], [240, 0.5], [360, 0.3], [600, 0.12]]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; const og2 = ctx.createGain(); og2.gain.value = a * 0.15; o.connect(og2).connect(bzg); o.start(); }
    const bzf = ctx.createBiquadFilter(); bzf.type = 'lowpass'; bzf.frequency.value = 900;
    bzg.connect(bzf).connect(p).connect(this.sfx);
    this.buzz = { p, g: bzg };
    // tram: positional electric hum + wheel rumble
    const tp = ctx.createPanner(); tp.panningModel = 'HRTF'; tp.distanceModel = 'inverse'; tp.refDistance = 8; tp.rolloffFactor = 1.2;
    const tg = ctx.createGain(); tg.gain.value = 0.18;
    for (const [fr, a] of [[55, 1], [110, 0.5], [165, 0.25]]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; const g2 = ctx.createGain(); g2.gain.value = a * 0.2; o.connect(g2).connect(tg); o.start(); }
    const tf = ctx.createBiquadFilter(); tf.type = 'lowpass'; tf.frequency.value = 400;
    tg.connect(tf).connect(tp).connect(this.sfx); this.tram = tp;
    // distant city: low traffic rumble (always on, ducks under cover)
    this.city = this.noiseVoice('lowpass', 160, 0.5);
    this.nextSiren = ctx.currentTime + 8;
    this.nextBeat = ctx.currentTime + 0.2;
  }

  private noiseVoice(type: BiquadFilterType, freq: number, q: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true; src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.sfx); src.start();
    return { f, g };
  }

  private set(p: AudioParam, v: number, t = 0.06) { p.setTargetAtTime(v, this.ctx!.currentTime, t); }

  update(a: AudioFrame) {
    const ctx = this.ctx; if (!ctx || !this.eng) return;
    const sp = a.speed, e = this.eng;
    const base = 42 + sp * 2.6 + (a.boosting ? 14 : 0);
    this.set(e.o1.frequency, base); this.set(e.o2.frequency, base * 1.005); this.set(e.sub.frequency, base / 2);
    this.set(e.f.frequency, 260 + sp * 55 + (a.boosting ? 900 : 0));
    this.set(e.g.gain, 0.09 + Math.min(0.08, sp * 0.003));
    this.set(e.whine.frequency, 900 + sp * 55); this.set(e.wg.gain, Math.min(0.02, sp * 0.0007) + (a.boosting ? 0.012 : 0));
    this.set(this.wind.f.frequency, 400 + sp * 45); this.set(this.wind.g.gain, Math.min(0.35, (sp / 35) ** 2 * 0.35));
    this.set(this.rain.g.gain, a.rain * (a.covered ? 0.05 : 0.16), 0.3);
    this.set(this.hiss.g.gain, a.drifting ? Math.min(0.22, Math.abs(a.slip) * 0.025) : 0, 0.04);
    this.set(this.water.g.gain, a.onWater && a.grounded ? Math.min(0.25, sp * 0.012) : 0, 0.1);
    this.set(this.boostL.o.frequency, 180 + sp * 6); this.set(this.boostL.g.gain, a.boosting ? 0.05 : 0, 0.08);
    const L = ctx.listener as any;
    if (L.positionX) { L.positionX.value = a.cam.x; L.positionY.value = a.cam.y; L.positionZ.value = a.cam.z; L.forwardX.value = a.cam.fx; L.forwardY.value = 0; L.forwardZ.value = a.cam.fz; }
    if (a.tramAt && this.tram) { const p = this.tram as any; p.positionX.value = a.tramAt.x; p.positionY.value = a.tramAt.y; p.positionZ.value = a.tramAt.z; }
    if (a.buzzAt) { const p = this.buzz.p as any; p.positionX.value = a.buzzAt.x; p.positionY.value = a.buzzAt.y; p.positionZ.value = a.buzzAt.z; }
    this.set(this.city.g.gain, a.covered ? 0.05 : 0.09, 1.0);
    // a far siren or hover-traffic swell now and then, panned somewhere in the city
    if (ctx.currentTime > this.nextSiren) { this.distant(); this.nextSiren = ctx.currentTime + 14 + Math.random() * 20; }
    this.music();
  }

  private distant() {
    const ctx = this.ctx!; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle';
    const base = 600 + Math.random() * 300;
    for (let i = 0; i < 6; i++) { o.frequency.setValueAtTime(base, t + i * 0.9); o.frequency.linearRampToValueAtTime(base * 1.3, t + i * 0.9 + 0.45); }
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 2 - 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.012, t + 1.5); g.gain.linearRampToValueAtTime(0.0001, t + 5.4);
    o.connect(f).connect(pan).connect(g).connect(this.sfx); o.start(t); o.stop(t + 5.5);
  }

  /** One-shot: boost surge. */
  boost() { this.burst(0.35, 300, 2400, 0.5, 'bandpass'); this.sweep(110, 440, 0.4, 0.12); }
  impact(v: number) { const k = Math.min(1, v / 15); this.thump(70, 0.25 * k + 0.05); this.burst(0.12, 1800, 600, 0.3 * k, 'lowpass'); }
  hop() { this.burst(0.25, 500, 1500, 0.18, 'bandpass'); }
  land(v: number) { this.thump(55, Math.min(0.3, v * 0.03)); }
  driftKick() { this.sweep(220, 660, 0.25, 0.08); }
  blip(pitch = 1) { this.sweep(880 * pitch, 990 * pitch, 0.05, 0.05, 'square'); }

  private burst(dur: number, f0: number, f1: number, vol: number, type: BiquadFilterType) {
    const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.sfx); s.start(t); s.stop(t + dur + 0.05);
  }
  private sweep(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sawtooth') {
    const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  private thump(f: number, vol: number) {
    const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(f * 2, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.25);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.35);
  }

  // ---- synthwave bed: A minor, 92 BPM, 16-step sequencer with lookahead scheduling ----
  private music() {
    const ctx = this.ctx!; if (!this.musicOn) { this.musicBus.gain.value = 0; return; }
    this.musicBus.gain.value = 0.32;
    const spb = 60 / 92 / 4; // 16th notes
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
    while (this.nextBeat < ctx.currentTime + 0.25) {
      const t = this.nextBeat, s = this.step % 16, bar = Math.floor(this.step / 16) % 4, ch = chords[bar];
      const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
      if (s === 0) for (const n of ch) this.note(hz(n), t, spb * 16, 'sawtooth', 0.025, 900, 0.6);
      if (s % 2 === 0) this.note(hz(ch[0] - 24 + (s % 8 === 6 ? 12 : 0)), t, spb * 1.6, 'square', 0.05, 380, 0.01);
      if (s % 4 === 2 || s % 4 === 3) this.note(hz(ch[(s + bar) % 3] + 12), t, spb * 0.9, 'triangle', 0.018, 3000, 0.005);
      if (s % 8 === 0) this.kick(t);
      if (s % 8 === 4) this.snare(t);
      if (s % 2 === 1) this.hat(t);
      this.nextBeat += spb; this.step++;
    }
  }
  private note(f: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff: number, attack: number) {
    const ctx = this.ctx!; const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = type; o2.frequency.value = f; o2.detune.value = 12;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); o2.connect(fl); fl.connect(g).connect(this.musicBus); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  private kick(t: number) { const ctx = this.ctx!; const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + 0.35); }
  private snare(t: number) { const ctx = this.ctx!; const s = ctx.createBufferSource(); s.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); s.connect(f).connect(g).connect(this.musicBus); s.start(t); s.stop(t + 0.25); }
  private hat(t: number) { const ctx = this.ctx!; const s = ctx.createBufferSource(); s.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f).connect(g).connect(this.musicBus); s.start(t); s.stop(t + 0.08); }
}
