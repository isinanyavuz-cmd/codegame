// Ses efektleri: dosya yok, hepsi Web Audio ile üretilir.
let ctx = null, on = true;

function audio() {
  if (!on) return null;
  if (!ctx) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    try { ctx = new A(); } catch (e) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.1, slide = 0, delay = 0 } = {}) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
}

function noise(dur, vol) {
  const c = audio(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination); src.start();
}

export const sfx = {
  set enabled(v) { on = !!v; },
  get enabled() { return on; },
  click: () => tone(660, 0.05, { type: 'square', vol: 0.025 }),
  drop: () => tone(440, 0.07, { type: 'triangle', vol: 0.06, slide: 120 }),
  remove: () => tone(300, 0.09, { type: 'triangle', vol: 0.05, slide: -120 }),
  bad: () => tone(170, 0.2, { type: 'square', vol: 0.045, slide: -50 }),
  move: () => tone(210, 0.14, { type: 'triangle', vol: 0.06, slide: 110 }),
  dodge: () => tone(300, 0.18, { type: 'triangle', vol: 0.08, slide: 280 }),
  sense: (yes) => tone(yes ? 920 : 560, 0.08, { type: 'square', vol: 0.03 }),
  collect: () => { tone(988, 0.1, { vol: 0.09 }); tone(1319, 0.18, { vol: 0.09, delay: 0.08 }); },
  crash: () => { noise(0.55, 0.32); tone(110, 0.45, { type: 'sawtooth', vol: 0.12, slide: -70 }); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.1, delay: i * 0.09 })),
  star: (i) => tone(784 + i * 196, 0.22, { type: 'triangle', vol: 0.1 }),
};
