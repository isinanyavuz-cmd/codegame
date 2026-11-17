// Ses efektleri ve arka plan müziği. Ses dosyası yok; hepsi Web Audio ile üretilir.
let ctx = null, on = true;

/** Ses bağlamı; tarayıcı ilk dokunuştan önce ses çalmaya izin vermez. */
function context() {
  if (!ctx) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    try { ctx = new A(); } catch (e) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
const audio = () => (on ? context() : null);

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

/** Süzülmüş gürültü. Varsayılan sönen patlama; `swell` yükselip alçalan bir hışırtı verir. */
function noise(dur, vol, { from = 900, to = 900, type = 'lowpass', q = 0.7, swell = false } = {}) {
  const c = audio(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (swell ? Math.sin(Math.PI * i / n) : Math.pow(1 - i / n, 2.2));
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
  src.buffer = buf; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
  g.gain.value = vol;
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
  /** Kristal: aynı uçuşta toplanan her kristalde ses bir basamak incelir. */
  collect: (n = 0) => { const k = Math.pow(2, Math.min(n, 8) * 2 / 12); tone(988 * k, 0.1, { vol: 0.09 }); tone(1319 * k, 0.18, { vol: 0.09, delay: 0.08 }); },
  /** Dar bir aralıktan geçiş. */
  whoosh: () => { noise(0.28, 0.12, { from: 2600, to: 500, type: 'bandpass', q: 1.4, swell: true }); tone(1480, 0.16, { vol: 0.04, slide: 600, delay: 0.05 }); },
  crash: () => { noise(0.55, 0.32); tone(110, 0.45, { type: 'sawtooth', vol: 0.12, slide: -70 }); },
  win: () => {
    noise(0.5, 0.1, { from: 500, to: 5000, type: 'bandpass', q: 1.2, swell: true });
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.24, { type: 'triangle', vol: 0.09, delay: 0.1 + i * 0.085 }));
  },
  star: (i) => { tone(784 + i * 196, 0.22, { type: 'triangle', vol: 0.1 }); tone((784 + i * 196) * 2, 0.3, { vol: 0.035, delay: 0.03 }); },
  /** Kalkış: motorların yükselen sesi. */
  launch: () => { noise(0.45, 0.09, { from: 220, to: 2400, type: 'bandpass', q: 1.1, swell: true }); tone(120, 0.4, { type: 'sawtooth', vol: 0.04, slide: 260 }); },
  shield: () => { tone(520, 0.22, { type: 'sine', vol: 0.06, slide: 420 }); tone(1040, 0.3, { vol: 0.03, delay: 0.05 }); },
  /** Acil durum: iki tonlu kısa siren. */
  alarm: () => { for (let i = 0; i < 3; i++) { tone(740, 0.16, { type: 'square', vol: 0.04, delay: i * 0.34 }); tone(554, 0.16, { type: 'square', vol: 0.04, delay: i * 0.34 + 0.17 }); } },
  /** Rota ekranında gemi yol boyunca uçarken. */
  travel: (dur = 1) => { noise(dur, 0.07, { from: 300, to: 1800, type: 'bandpass', q: 1.5, swell: true }); tone(180, dur, { type: 'triangle', vol: 0.035, slide: 240 }); },
};

// ───────────── arka plan müziği ─────────────
// Sakin, dönen bir uzay ezgisi: uzun akorlar, bas ve hafif bir arpej. Notalar ses
// saatine göre biraz önceden sıraya konur; böylece sekme yoğunken bile ritim kaymaz.
const BPM = 88, SIXTEENTH = 60 / BPM / 4;
const CHORDS = [[57, 60, 64, 71], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 62, 66]];   // Am9, Fmaj7, Cmaj7, Gmaj7
const ARP = [0, 2, 1, 3, 2, 1, 3, 2];
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export const music = (() => {
  let wanted = true, started = false, bus = null, echo = null, timer = 0, step = 0, next = 0, mood = 'map';

  function build(c) {
    bus = c.createGain(); bus.gain.value = 0; bus.connect(c.destination);
    echo = c.createDelay(1); echo.delayTime.value = SIXTEENTH * 3;
    const fb = c.createGain(); fb.gain.value = 0.36;
    const wet = c.createGain(); wet.gain.value = 0.3;
    echo.connect(fb).connect(echo); echo.connect(wet).connect(bus);
  }
  function voice(c, t, midi, dur, { type, vol, attack, cutoff, detune = 0, send = false }) {
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.value = hz(midi); o.detune.value = detune;
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(bus);
    if (send) g.connect(echo);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function schedule() {
    const c = ctx;
    if (!c) return;
    // Tarayıcı sesi henüz açmadıysa (ilk dokunuş yeni işlendiyse) yeniden dene.
    if (c.state !== 'running') { if (c.state === 'suspended') c.resume(); return; }
    if (next < c.currentTime) next = c.currentTime + 0.05;
    while (next < c.currentTime + 0.4) {
      const bar = Math.floor(step / 16), s = step % 16, chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
      if (s === 0 && bar % 2 === 0) {
        for (const n of chord) for (const d of [-7, 7]) voice(c, next, n, SIXTEENTH * 34, { type: 'sawtooth', vol: 0.02, attack: 1.1, cutoff: 750, detune: d });
      }
      if (s === 0 || (mood === 'game' && s === 8)) voice(c, next, chord[0] - 24, SIXTEENTH * 7, { type: 'sine', vol: 0.11, attack: 0.03, cutoff: 400 });
      const every = mood === 'game' ? 2 : 4;
      if (s % every === 0) {
        const i = ARP[(step / every) % ARP.length], up = (Math.floor(step / every / 8) % 2) * 12;
        voice(c, next, chord[i] + 12 + up, SIXTEENTH * 3.2, { type: 'triangle', vol: mood === 'game' ? 0.05 : 0.04, attack: 0.008, cutoff: 2600, send: true });
      }
      step++; next += SIXTEENTH;
    }
  }
  function fade(to, secs) {
    if (!bus) return;
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(to, t + secs);
  }
  function run() {
    if (!wanted || !started || document.hidden) return;
    const c = context(); if (!c) return;
    if (!bus) build(c);
    if (timer) return;
    timer = setInterval(schedule, 120);
    fade(0.85, 1.5);
  }
  function halt() { clearInterval(timer); timer = 0; fade(0, 0.4); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) halt(); else run(); });

  return {
    get enabled() { return wanted; },
    set enabled(v) { wanted = !!v; if (wanted) run(); else halt(); },
    /** Her dokunuşta çağrılabilir; tarayıcı sesi ancak bir kullanıcı hareketinden sonra açar. */
    start() { started = true; run(); },
    /** 'map' daha sakin, 'game' biraz daha hareketli. */
    mood(m) { mood = m; },
  };
})();
