/*
 * Moteur audio 100 % génératif (Web Audio) : aucun fichier à télécharger,
 * donc fonctionne hors-ligne et en mode avion. Chaque son est synthétisé
 * une fois en mémoire puis joué en boucle sans couture.
 */

export const CATS = {
  noise: { name: 'Bruits blancs', icon: 'noise' },
  nature: { name: 'Pluie & Nature', icon: 'drop' },
  heart: { name: 'Battements de cœur', icon: 'heart' },
  lullaby: { name: 'Berceuses', icon: 'music' },
};

export const SOUNDS = [
  { id: 'white', cat: 'noise', name: 'Bruit blanc', desc: 'Doux et continu' },
  { id: 'pink', cat: 'noise', name: 'Bruit rose', desc: 'Plus feutré, très apaisant' },
  { id: 'brown', cat: 'noise', name: 'Bruit brun', desc: 'Grave et enveloppant' },
  { id: 'fan', cat: 'noise', name: 'Ventilateur', desc: 'Souffle régulier' },
  { id: 'rain', cat: 'nature', name: 'Pluie douce', desc: 'Gouttes sur le toit' },
  { id: 'waves', cat: 'nature', name: 'Vagues', desc: 'Ressac lent de l’océan' },
  { id: 'wind', cat: 'nature', name: 'Vent léger', desc: 'Brise dans les arbres' },
  { id: 'heart', cat: 'heart', name: 'Cœur de maman', desc: '66 battements par minute' },
  { id: 'womb', cat: 'heart', name: 'In utero', desc: 'Cœur et flux, comme dans le ventre' },
  { id: 'lune', cat: 'lullaby', name: 'Au clair de la lune', desc: 'Boîte à musique' },
  { id: 'brahms', cat: 'lullaby', name: 'Berceuse de Brahms', desc: 'Boîte à musique' },
  { id: 'twinkle', cat: 'lullaby', name: 'Ah ! vous dirai-je, maman', desc: 'Boîte à musique' },
  { id: 'jacques', cat: 'lullaby', name: 'Frère Jacques', desc: 'Boîte à musique' },
];

/* ---------- État public du lecteur ---------- */
export const player = { soundId: null, playing: false, loading: false, startedAt: 0, endsAt: 0, timerMin: 0, fade: true, volume: 0.7 };
const listeners = new Set();
const emit = () => listeners.forEach((f) => f(player));
export const onPlayer = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

let ctx, master, fader, current = null, stopTimer = null;
const cache = new Map();

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = player.volume;
    fader = ctx.createGain();
    fader.connect(master).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

/* ---------- Générateurs ---------- */
const white = () => Math.random() * 2 - 1;
function pinkGen() {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => {
    const w = white();
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    const p = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
    return p * 0.11;
  };
}
function brownGen() { let l = 0; return () => { l = (l + 0.02 * white()) / 1.02; return l * 3.5; }; }
function lowpass(a) { let y = 0; return (x) => (y += a * (x - y)); }
function highpass(a) { let y = 0, px = 0; return (x) => { y = a * (y + x - px); px = x; return y; }; }

/** Construit un buffer bouclable : fondu enchaîné à puissance constante entre fin et début. */
function loopBuffer(seconds, makeGen, stereo = true) {
  const sr = ctx.sampleRate, N = Math.floor(seconds * sr), F = Math.floor(0.6 * sr);
  const buf = ctx.createBuffer(2, N, sr);
  for (let ch = 0; ch < 2; ch++) {
    const gen = ch === 0 || stereo ? makeGen() : null;
    const out = buf.getChannelData(ch);
    if (!gen) { out.set(buf.getChannelData(0)); continue; }
    const tmp = new Float32Array(N + F);
    for (let i = 0; i < N + F; i++) tmp[i] = gen(i / sr);
    for (let i = 0; i < N; i++) {
      if (i < F) { const k = i / F; out[i] = tmp[i] * Math.sqrt(k) + tmp[N + i] * Math.sqrt(1 - k); }
      else out[i] = tmp[i];
    }
  }
  return buf;
}

const TAU = Math.PI * 2;
const GENERATORS = {
  white: () => loopBuffer(8, () => { const lp = lowpass(0.55); return () => lp(white()) * 0.32; }),
  pink: () => loopBuffer(8, () => { const p = pinkGen(); return () => p() * 0.75; }),
  brown: () => loopBuffer(8, () => { const b = brownGen(); return () => b() * 0.55; }),
  fan: () => loopBuffer(8, () => { const b = brownGen(), p = pinkGen(), lp = lowpass(0.18); return (t) => (b() * 0.35 + lp(p()) * 0.9) * (1 + 0.05 * Math.sin(TAU * 4 * t)); }),
  rain: () => loopBuffer(12, () => {
    const p = pinkGen(), b = brownGen(), hp = highpass(0.92), hp2 = highpass(0.8);
    let drop = 0; const sr = ctx.sampleRate, decay = Math.exp(-1 / (0.006 * sr));
    return () => {
      if (Math.random() < 30 / sr) drop = Math.random() * 0.45 + 0.05;
      drop *= decay;
      return hp(p()) * 0.45 + b() * 0.12 + hp2(white() * drop) * 0.9;
    };
  }),
  waves: () => loopBuffer(24, () => {
    const b = brownGen(), p = pinkGen(), hp = highpass(0.95);
    return (t) => {
      const env = 0.12 + 0.88 * Math.pow(Math.sin((Math.PI * t) / 8), 2);
      return b() * env * 0.55 + hp(p()) * Math.pow(env, 3) * 0.5;
    };
  }),
  wind: () => loopBuffer(20, () => {
    const p = pinkGen(); let y = 0;
    return (t) => {
      const m = 0.5 + 0.3 * Math.sin((TAU * t) / 10) + 0.2 * Math.sin((TAU * t) / 4 + 1);
      const a = 0.01 + 0.05 * m;
      y += a * (p() - y);
      return y * (2.2 / Math.sqrt(a / 0.03)) * (0.55 + 0.45 * m);
    };
  }),
  heart: () => heartbeat(false),
  womb: () => heartbeat(true),
  lune: () => melody(LULLABIES.lune, 84),
  brahms: () => melody(LULLABIES.brahms, 96),
  twinkle: () => melody(LULLABIES.twinkle, 80),
  jacques: () => melody(LULLABIES.jacques, 92),
};

function heartbeat(womb) {
  const T = 60 / 66;
  const thump = (p, f, dur, amp) => (p < 0 || p > dur ? 0 : Math.sin(TAU * (f * p - 18 * p * p)) * Math.exp(-p / (dur / 4)) * (1 - Math.exp(-p / 0.004)) * amp);
  return loopBuffer(T * 8, () => {
    const b = brownGen(), lp = lowpass(0.02), lp2 = lowpass(0.08);
    return (t) => {
      const ph = t % T;
      const beat = thump(ph, 58, 0.16, 1) + thump(ph - 0.3, 72, 0.13, 0.62);
      const whoosh = womb ? lp(b()) * 6 * (0.55 + 0.45 * Math.exp(-ph / 0.35)) : lp(b()) * 1.2;
      return lp2(beat) * 2.2 + whoosh * 0.5;
    };
  }, false);
}

/* Berceuses du domaine public, timbre « boîte à musique ». */
const seq = (...parts) => parts.flat();
const LULLABIES = (() => {
  const A = [['C5', 1], ['C5', 1], ['C5', 1], ['D5', 1], ['E5', 2], ['D5', 2], ['C5', 1], ['E5', 1], ['D5', 1], ['D5', 1], ['C5', 4]];
  const B = [['D5', 1], ['D5', 1], ['D5', 1], ['D5', 1], ['A4', 2], ['A4', 2], ['D5', 1], ['C5', 1], ['B4', 1], ['A4', 1], ['G4', 4]];
  const tw1 = [['C5', 1], ['C5', 1], ['G5', 1], ['G5', 1], ['A5', 1], ['A5', 1], ['G5', 2], ['F5', 1], ['F5', 1], ['E5', 1], ['E5', 1], ['D5', 1], ['D5', 1], ['C5', 2]];
  const tw2 = [['G5', 1], ['G5', 1], ['F5', 1], ['F5', 1], ['E5', 1], ['E5', 1], ['D5', 2]];
  const j1 = [['C5', 1], ['D5', 1], ['E5', 1], ['C5', 1]];
  const j2 = [['E5', 1], ['F5', 1], ['G5', 2]];
  const j3 = [['G5', 0.5], ['A5', 0.5], ['G5', 0.5], ['F5', 0.5], ['E5', 1], ['C5', 1]];
  const j4 = [['C5', 1], ['G4', 1], ['C5', 2]];
  return {
    lune: seq(A, A, B, A, [[null, 2]]),
    twinkle: seq(tw1, tw2, tw2, tw1, [[null, 2]]),
    jacques: seq(j1, j1, j2, j2, j3, j3, j4, j4, [[null, 2]]),
    brahms: [['E4', .5], ['E4', .5], ['G4', 2], ['E4', .5], ['E4', .5], ['G4', 2], ['E4', .5], ['G4', .5], ['C5', 1], ['B4', 1.5], ['A4', .5], ['A4', 1], ['G4', 1],
      ['D4', .5], ['E4', .5], ['F4', 1], ['D4', 1], ['D4', .5], ['E4', .5], ['F4', 2], ['D4', .5], ['F4', .5], ['B4', .5], ['A4', .5], ['G4', 1], ['B4', 1], ['C5', 3], [null, 2]],
  };
})();

function freq(note) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(note);
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, ((+m[3] + 1) * 12 + semi - 69) / 12);
}

async function melody(notes, bpm) {
  const beat = 60 / bpm;
  const total = notes.reduce((a, [, d]) => a + d, 0) * beat;
  const sr = ctx.sampleRate;
  const oc = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
  const bus = oc.createGain(); bus.gain.value = 0.55;
  const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800;
  const delay = oc.createDelay(2); delay.delayTime.value = beat * 0.75;
  const fb = oc.createGain(); fb.gain.value = 0.3;
  const wet = oc.createGain(); wet.gain.value = 0.32;
  bus.connect(lp); lp.connect(oc.destination); lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(oc.destination);
  let t = 0.03;
  for (const [n, d] of notes) {
    if (n) {
      const f0 = freq(n), len = Math.max(1.6, d * beat * 1.8);
      const g = oc.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
      g.connect(bus);
      for (const [mult, amp] of [[1, 1], [2, 0.22], [3, 0.06], [4.2, 0.04]]) {
        const o = oc.createOscillator(); o.frequency.value = f0 * mult;
        const og = oc.createGain(); og.gain.value = amp;
        o.connect(og).connect(g); o.start(t); o.stop(t + len);
      }
      // Douce note grave en soutien, une octave plus bas.
      const pad = oc.createOscillator(); pad.type = 'triangle'; pad.frequency.value = f0 / 2;
      const pg = oc.createGain(); pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(0.05, t + 0.08); pg.gain.exponentialRampToValueAtTime(0.0008, t + len);
      pad.connect(pg).connect(bus); pad.start(t); pad.stop(t + len);
    }
    t += d * beat;
  }
  return oc.startRendering();
}

async function getBuffer(id) {
  if (!cache.has(id)) cache.set(id, Promise.resolve(GENERATORS[id]()));
  return cache.get(id);
}

/* ---------- Contrôle ---------- */
function stopSource(fadeSec = 0.5) {
  if (!current) return;
  const { src, gain } = current;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + fadeSec);
  src.stop(now + fadeSec + 0.05);
  current = null;
}

export async function play(id = player.soundId || 'white') {
  ensureCtx();
  const wasPlaying = player.playing;
  player.soundId = id; player.loading = true; emit();
  const buf = await getBuffer(id);
  if (player.soundId !== id) return;
  stopSource(0.8);
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
  src.connect(gain).connect(fader);
  src.start();
  current = { src, gain };
  player.loading = false; player.playing = true;
  if (!wasPlaying) { player.startedAt = Date.now(); armTimer(); }
  updateMediaSession();
  emit();
}

export function pause() {
  if (ctx) stopSource(0.6);
  clearTimeout(stopTimer);
  player.playing = false; player.loading = false; player.endsAt = 0;
  if (fader) { fader.gain.cancelScheduledValues(ctx.currentTime); fader.gain.setValueAtTime(1, ctx.currentTime); }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  emit();
}

export const toggle = () => (player.playing || player.loading ? pause() : play());
export function step(dir) {
  const i = SOUNDS.findIndex((s) => s.id === player.soundId);
  const next = SOUNDS[(i + dir + SOUNDS.length) % SOUNDS.length];
  if (player.playing) play(next.id); else { player.soundId = next.id; emit(); }
  return next.id;
}

export function setVolume(v) { player.volume = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); }
export function setTimer(min) { player.timerMin = min; if (player.playing) { player.startedAt = Date.now(); armTimer(); } emit(); }
export function setFade(on) { player.fade = on; if (player.playing) armTimer(true); emit(); }

/** Minuteur : la descente de volume est planifiée sur l'horloge audio (fiable écran verrouillé). */
function armTimer(keepStart = false) {
  clearTimeout(stopTimer);
  const now = ctx.currentTime;
  fader.gain.cancelScheduledValues(now);
  fader.gain.setValueAtTime(1, now);
  if (!player.timerMin) { player.endsAt = 0; return; }
  const total = player.timerMin * 60 - (keepStart ? (Date.now() - player.startedAt) / 1000 : 0);
  player.endsAt = Date.now() + total * 1000;
  const fadeSec = player.fade ? Math.min(180, player.timerMin * 60 * 0.2) : 2;
  const fadeStart = Math.max(0, total - fadeSec);
  fader.gain.setValueAtTime(1, now + fadeStart);
  fader.gain.linearRampToValueAtTime(0.0001, now + Math.max(total, 0.1));
  stopTimer = setTimeout(pause, Math.max(0, total * 1000) + 300);
}

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const s = SOUNDS.find((x) => x.id === player.soundId);
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: s.name, artist: CATS[s.cat].name, album: 'AppBébé · Détente & Sommeil' });
    navigator.mediaSession.playbackState = 'playing';
    navigator.mediaSession.setActionHandler('play', () => play());
    navigator.mediaSession.setActionHandler('pause', pause);
    navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
    navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
  } catch { /* non supporté */ }
}
