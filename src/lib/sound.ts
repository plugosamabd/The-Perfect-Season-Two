// Soothing WebAudio sfx — soft sine tones, gentle envelopes.
// Safe on SSR (lazy AudioContext on first use).

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;

const MASTER_VOLUME = 0.35;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (muted) return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = MASTER_VOLUME;
    // Gentle low-pass to take harshness off the top end.
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 4200;
    lp.Q.value = 0.7;
    masterGain.connect(lp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => { /* noop */ });
  return ctx;
}

function dest(): AudioNode | null {
  const a = ac();
  if (!a || !masterGain) return null;
  return masterGain;
}

/** Soft sine note with gentle attack/release. */
function note(
  freq: number,
  {
    dur = 0.45,
    type = "sine" as OscillatorType,
    gain = 0.18,
    attack = 0.04,
    release = 0.25,
    delay = 0,
    detune = 0,
  } = {},
) {
  const a = ac();
  const out = dest();
  if (!a || !out) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (detune) o.detune.setValueAtTime(detune, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** Two slightly detuned sines for a warmer pad-like tone. */
function pad(freq: number, opts: Parameters<typeof note>[1] = {}) {
  note(freq, opts);
  note(freq, { ...opts, detune: 6, gain: (opts?.gain ?? 0.18) * 0.6 });
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

  /** Generic soft tone (kept for backwards compat). */
  tone(freq: number, dur = 0.3, type: OscillatorType = "sine", gain = 0.15) {
    note(freq, { dur, type, gain, attack: 0.03, release: 0.18 });
  },

  /** Light, airy UI click. */
  click() {
    note(880, { dur: 0.12, gain: 0.08, attack: 0.005, release: 0.1 });
  },

  /** Soft wood-block-ish tick for spin ticking. */
  tick() {
    note(1320, { dur: 0.08, gain: 0.05, attack: 0.003, release: 0.07 });
  },

  /** Casino-style decelerating ticks — like a roulette/prize wheel slowing down.
   *  Each call generates a fresh tick cadence so consecutive spins don't sound identical. */
  spin() {
    const a = ac();
    const out = dest();
    if (!a || !out) return;
    // Total spin length ~3.4s, ticks accelerate-then-decelerate (ease-out).
    const total = 3.4;
    const tickCount = 28 + Math.floor(Math.random() * 6); // 28-33 ticks
    const start = a.currentTime;
    for (let i = 0; i < tickCount; i++) {
      // ease-out cubic — ticks bunch at start, slow toward end
      const t = i / tickCount;
      const eased = 1 - Math.pow(1 - t, 2.4);
      const when = start + eased * total;
      // tick = short noise burst through bandpass → wooden "tack"
      const dur = 0.045;
      const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) {
        const k = j / d.length;
        d[j] = (Math.random() * 2 - 1) * Math.pow(1 - k, 3);
      }
      const src = a.createBufferSource();
      src.buffer = buf;
      const bp = a.createBiquadFilter();
      bp.type = "bandpass";
      // pitch drops gently as wheel slows
      bp.frequency.value = 2400 - eased * 900 + (Math.random() - 0.5) * 200;
      bp.Q.value = 6;
      const g = a.createGain();
      // slight volume swell then fall
      const vol = 0.25 * (0.5 + Math.sin(t * Math.PI) * 0.6);
      g.gain.setValueAtTime(vol, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      src.connect(bp).connect(g).connect(out);
      src.start(when);
      src.stop(when + dur + 0.02);
    }
  },

  /** Casino "win" chime — varies between a few presets so it never feels repetitive. */
  land() {
    const variants: Array<() => void> = [
      // Bright triad ding
      () => {
        pad(659.25, { dur: 0.55, gain: 0.16, attack: 0.01, release: 0.45 });
        pad(987.77, { dur: 0.7,  gain: 0.13, attack: 0.02, release: 0.55, delay: 0.06 });
        pad(1318.5, { dur: 0.85, gain: 0.11, attack: 0.03, release: 0.7,  delay: 0.14 });
      },
      // Quick ascending arpeggio
      () => {
        note(523.25, { dur: 0.22, type: "triangle", gain: 0.14, attack: 0.005, release: 0.18 });
        note(659.25, { dur: 0.22, type: "triangle", gain: 0.14, attack: 0.005, release: 0.18, delay: 0.08 });
        note(880.00, { dur: 0.55, type: "triangle", gain: 0.14, attack: 0.01,  release: 0.45, delay: 0.16 });
      },
      // Warm dyad bloom
      () => {
        pad(440,    { dur: 0.7, gain: 0.16, attack: 0.04, release: 0.55 });
        pad(659.25, { dur: 0.8, gain: 0.13, attack: 0.05, release: 0.6, delay: 0.07 });
      },
      // Sparkly two-bell
      () => {
        note(1567.98, { dur: 0.35, type: "sine", gain: 0.10, attack: 0.002, release: 0.32 });
        note(1244.5,  { dur: 0.55, type: "sine", gain: 0.12, attack: 0.005, release: 0.5, delay: 0.09 });
        pad(622.25,   { dur: 0.6,  gain: 0.10, attack: 0.04, release: 0.5, delay: 0.05 });
      },
    ];
    const pick = variants[Math.floor(Math.random() * variants.length)];
    pick();
  },

  /** Soft "swish" — filtered noise, short and airy. */
  swish() {
    const a = ac();
    const out = dest();
    if (!a || !out) return;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * 0.35), a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      // Soft attack, long fade.
      const env = Math.min(1, t * 8) * Math.pow(1 - t, 2);
      data[i] = (Math.random() * 2 - 1) * env * 0.25;
    }
    const src = a.createBufferSource();
    src.buffer = buf;
    const bp = a.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400;
    bp.Q.value = 0.8;
    const g = a.createGain();
    g.gain.value = 0.6;
    src.connect(bp).connect(g).connect(out);
    src.start();
  },

  /** Gentle low chime instead of a harsh buzzer. */
  buzzer() {
    pad(329.63, { dur: 0.9, gain: 0.18, attack: 0.05, release: 0.7 }); // E4
    pad(246.94, { dur: 1.1, gain: 0.14, attack: 0.08, release: 0.9, delay: 0.08 }); // B3
  },

  /** Calm rising arpeggio. */
  fanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    notes.forEach((f, i) =>
      pad(f, { dur: 0.5, gain: 0.15, attack: 0.04, release: 0.35, delay: i * 0.14 }),
    );
  },
};
