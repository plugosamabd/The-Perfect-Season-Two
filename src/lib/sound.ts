// Tiny WebAudio sfx — no asset downloads, no deps.
// Safe on SSR (lazy AudioContext on first use).

let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (muted) return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => { /* noop */ });
  return ctx;
}

export const sfx = {
  setMuted(v: boolean) {
    muted = v;
    if (typeof localStorage !== "undefined") localStorage.setItem("sfx-muted", v ? "1" : "0");
  },
  isMuted() {
    if (muted) return true;
    if (typeof localStorage !== "undefined" && localStorage.getItem("sfx-muted") === "1") {
      muted = true;
      return true;
    }
    return false;
  },
  /** Generic tone */
  tone(freq: number, dur = 0.12, type: OscillatorType = "sine", gain = 0.08) {
    const a = ac();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, a.currentTime);
    g.gain.setValueAtTime(0.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, a.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur + 0.02);
  },
  click() { this.tone(880, 0.04, "square", 0.05); },
  tick() { this.tone(1200, 0.025, "square", 0.04); },
  spin() {
    // Quick falling whoosh of ticks
    let i = 0;
    const id = setInterval(() => {
      this.tone(900 + Math.random() * 400 - i * 12, 0.03, "square", 0.045);
      i++;
      if (i > 20) clearInterval(id);
    }, 90);
  },
  land() {
    this.tone(660, 0.08, "triangle", 0.09);
    setTimeout(() => this.tone(880, 0.14, "triangle", 0.09), 70);
  },
  swish() {
    const a = ac(); if (!a) return;
    const buf = a.createBuffer(1, a.sampleRate * 0.25, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      data[i] = (Math.random() * 2 - 1) * (1 - t) * 0.35;
    }
    const src = a.createBufferSource();
    src.buffer = buf;
    const filt = a.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 2000;
    src.connect(filt).connect(a.destination);
    src.start();
  },
  buzzer() {
    this.tone(220, 0.6, "sawtooth", 0.1);
  },
  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.18, "triangle", 0.09), i * 110)
    );
  },
};
