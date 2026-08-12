// Tiny WebAudio synth — no asset files. Every sound is shaped from an
// oscillator or a noise burst. Lazily created so we never trip the browser's
// autoplay policy before the player clicks Start.

let ac = null;
let master = null;
let noiseBuf = null;
export let enabled = true;

function ctx() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0.32;
    master.connect(ac.destination);

    const len = ac.sampleRate * 1.2;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

export function unlock() { ctx(); }
export function setEnabled(v) { enabled = v; if (master) master.gain.value = v ? 0.32 : 0; }

function tone({ freq = 220, to = null, dur = 0.18, type = 'square', gain = 0.3, delay = 0, sweepAt = 0 }) {
  if (!enabled) return;
  const a = ctx();
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur * (sweepAt || 1));
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.2, gain = 0.25, filter = 1200, q = 1, type = 'lowpass', delay = 0, sweepTo = null }) {
  if (!enabled) return;
  const a = ctx();
  const t0 = a.currentTime + delay;
  const s = a.createBufferSource();
  s.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(filter, t0); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t0); s.stop(t0 + dur + 0.02);
}

export const sfx = {
  swing:    () => noise({ dur: 0.13, gain: 0.16, filter: 900, sweepTo: 2600, type: 'bandpass', q: 1.4 }),
  hit:      () => { noise({ dur: 0.1, gain: 0.3, filter: 2200, type: 'bandpass', q: 0.8 }); tone({ freq: 180, to: 70, dur: 0.1, type: 'square', gain: 0.16 }); },
  hitWood:  () => { noise({ dur: 0.15, gain: 0.28, filter: 420, q: 2 }); tone({ freq: 130, to: 60, dur: 0.14, type: 'triangle', gain: 0.14 }); },
  break:    () => { noise({ dur: 0.5, gain: 0.34, filter: 700, sweepTo: 180, q: 1.2 }); tone({ freq: 90, to: 35, dur: 0.45, type: 'sawtooth', gain: 0.14 }); },
  hurt:     () => { tone({ freq: 300, to: 90, dur: 0.26, type: 'sawtooth', gain: 0.2 }); noise({ dur: 0.16, gain: 0.16, filter: 800 }); },
  pickup:   () => { tone({ freq: 620, dur: 0.07, type: 'square', gain: 0.13 }); tone({ freq: 930, dur: 0.1, type: 'square', gain: 0.11, delay: 0.06 }); },
  ui:       () => tone({ freq: 480, dur: 0.05, type: 'square', gain: 0.08 }),
  uiBig:    () => { tone({ freq: 330, dur: 0.1, type: 'triangle', gain: 0.14 }); tone({ freq: 495, dur: 0.16, type: 'triangle', gain: 0.12, delay: 0.07 }); },
  denied:   () => tone({ freq: 160, to: 110, dur: 0.16, type: 'square', gain: 0.13 }),
  smelt:    () => noise({ dur: 0.9, gain: 0.1, filter: 340, q: 0.7 }),
  forge:    () => { for (let i = 0; i < 3; i++) { noise({ dur: 0.13, gain: 0.26, filter: 2800, type: 'bandpass', q: 1.5, delay: i * 0.13 }); tone({ freq: 900 - i * 90, to: 400, dur: 0.16, type: 'square', gain: 0.1, delay: i * 0.13 }); } },
  unlock:   () => { tone({ freq: 700, dur: 0.09, type: 'square', gain: 0.12 }); tone({ freq: 1050, dur: 0.18, type: 'square', gain: 0.1, delay: 0.09 }); },
  fire:     () => noise({ dur: 0.34, gain: 0.16, filter: 700, sweepTo: 220, q: 0.9 }),
  laser:    () => { tone({ freq: 70, to: 240, dur: 0.6, type: 'sawtooth', gain: 0.16 }); noise({ dur: 0.6, gain: 0.16, filter: 500, sweepTo: 2400, q: 1.6 }); },
  charge:   () => tone({ freq: 90, to: 420, dur: 0.5, type: 'sawtooth', gain: 0.09 }),
  dash:     () => noise({ dur: 0.24, gain: 0.2, filter: 300, sweepTo: 1800, q: 1.1 }),
  roar:     () => { tone({ freq: 110, to: 48, dur: 0.85, type: 'sawtooth', gain: 0.24 }); noise({ dur: 0.85, gain: 0.2, filter: 380, q: 0.8 }); },
  vanish:   () => { tone({ freq: 520, to: 1400, dur: 0.3, type: 'sine', gain: 0.12 }); noise({ dur: 0.3, gain: 0.1, filter: 3000, type: 'highpass' }); },
  appear:   () => { tone({ freq: 1400, to: 300, dur: 0.26, type: 'sine', gain: 0.13 }); noise({ dur: 0.22, gain: 0.12, filter: 2400, type: 'highpass' }); },
  death:    () => { tone({ freq: 220, to: 40, dur: 1.3, type: 'sawtooth', gain: 0.22 }); noise({ dur: 1.1, gain: 0.14, filter: 500, sweepTo: 120 }); },
  bookOpen: () => { noise({ dur: 0.42, gain: 0.16, filter: 1400, sweepTo: 400, q: 0.8 }); tone({ freq: 420, to: 620, dur: 0.4, type: 'sine', gain: 0.09 }); },
  // ---- book two: everything wet is filtered noise rather than a tone,
  // which is what keeps it from sounding like the dragon's fire ----
  splash:   () => { noise({ dur: 0.26, gain: 0.2, filter: 2600, sweepTo: 500, q: 0.9, type: 'bandpass' }); tone({ freq: 420, to: 150, dur: 0.2, type: 'sine', gain: 0.09 }); },
  wave:     () => { noise({ dur: 0.55, gain: 0.24, filter: 300, sweepTo: 2200, q: 1.2, type: 'bandpass' }); tone({ freq: 140, to: 320, dur: 0.5, type: 'sine', gain: 0.11 }); },
  tide:     () => { noise({ dur: 1.1, gain: 0.26, filter: 180, sweepTo: 1400, q: 0.8 }); tone({ freq: 60, to: 130, dur: 1, type: 'sawtooth', gain: 0.14 }); },
  undertow: () => { tone({ freq: 300, to: 70, dur: 0.7, type: 'sine', gain: 0.16 }); noise({ dur: 0.7, gain: 0.14, filter: 1600, sweepTo: 220, q: 1.4, type: 'bandpass' }); },

  victory:  () => [0, 0.13, 0.26, 0.46].forEach((d, i) => tone({ freq: [392, 494, 587, 784][i], dur: 0.42, type: 'triangle', gain: 0.15, delay: d })),
};
