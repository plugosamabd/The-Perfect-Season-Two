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

  /** Slow, gentle descending shimmer while the wheel spins. */
  spin() {
    const a = ac();
    if (!a) return;
    const base = [880, 740, 620, 520];
    let i = 0;
    const id = setInterval(() => {
      const f = base[i % base.length] - i * 4;
      note(f, { dur: 0.18, gain: 0.05, attack: 0.01, release: 0.15 });
      i++;
      if (i > 14) clearInterval(id);
    }, 160);
  },

  /** Warm major-triad arrival when the wheel lands. */
  land() {
    pad(523.25, { dur: 0.6, gain: 0.16, attack: 0.04, release: 0.4 }); // C5
    pad(659.25, { dur: 0.6, gain: 0.14, attack: 0.05, release: 0.4, delay: 0.05 }); // E5
    pad(783.99, { dur: 0.7, gain: 0.13, attack: 0.06, release: 0.5, delay: 0.1 }); // G5
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
