import { store, activeChild } from '../store.js';
import { icon } from '../icons.js';
import { esc, fmtClock, toast, $, $$ } from '../ui.js';
import { SOUNDS, CATS, player, onPlayer, play, toggle, step, setVolume, setTimer, setFade } from '../audio.js';

let cat = null;
let initialised = false;

function init(s) {
  if (initialised) return;
  initialised = true;
  player.soundId = s.audio.sound;
  player.timerMin = s.audio.timer;
  player.volume = s.audio.volume;
  player.fade = s.audio.fade;
}

const savePrefs = () => store.update((s) => { s.audio = { sound: player.soundId, timer: player.timerMin, volume: player.volume, fade: player.fade }; }, { silent: true });

export function render(s) {
  init(s);
  const c = activeChild(s);
  const sound = SOUNDS.find((x) => x.id === player.soundId) || SOUNDS[0];
  cat ||= sound.cat;
  const h = new Date().getHours();
  const greet = h >= 18 || h < 6 ? `Bonne nuit, ${esc(c.name)}` : `Douce sieste, ${esc(c.name)}`;

  return `
    <header class="night-head">
      <div><p class="eyebrow">Détente & Sommeil</p><h1 class="title" style="font-size:1.5rem">${greet}</h1></div>
      <button class="icon-btn glow-btn" data-act="veil" aria-label="Activer la veilleuse">${icon('lamp', 22)}</button>
    </header>

    <section class="player" aria-label="Lecteur">
      <div class="orb" data-p="orb">${icon(CATS[sound.cat].icon, 46)}</div>
      <h2 class="track-title" data-p="title">${esc(sound.name)}</h2>
      <p class="track-sub" data-p="sub">${CATS[sound.cat].name}</p>
      <div class="tl">
        <div class="tl-bar"><span data-p="bar"></span></div>
        <div class="tl-times num"><span data-p="elapsed">00:00</span><span data-p="remaining">—</span></div>
      </div>
      <div class="controls">
        <button class="ctrl" data-act="prev" aria-label="Son précédent">${icon('skipPrev', 22)}</button>
        <button class="ctrl ctrl-main" data-act="toggle" data-p="toggle" aria-label="Lecture">${icon('play', 32)}</button>
        <button class="ctrl" data-act="next" aria-label="Son suivant">${icon('skipNext', 22)}</button>
      </div>
      <label class="volume">${icon('volume', 20)}<span class="sr-only">Volume</span><input type="range" min="0" max="1" step="0.01" value="${player.volume}" style="--p:${player.volume * 100}%" data-volume></label>
    </section>

    <section class="card mt-24">
      <div class="row-between">
        <h2 class="row" style="font-size:1rem;gap:8px"><span style="color:var(--gold)">${icon('timer', 20)}</span> Minuteur intelligent</h2>
        <label class="switch"><input type="checkbox" data-fade ${player.fade ? 'checked' : ''}><span class="track"></span>Fondu</label>
      </div>
      <div class="chips timer-chips mt-16">
        ${[[0, '∞'], [15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 h'], [90, '1 h 30']].map(([v, l]) => `<button class="chip ${player.timerMin === v ? 'is-on' : ''}" data-timer="${v}">${l}</button>`).join('')}
      </div>
      <p class="small faint mt-12">${player.fade ? 'Le volume baisse progressivement à la fin pour ne pas réveiller bébé par un silence soudain.' : 'Arrêt en douceur à la fin du minuteur.'}</p>
    </section>

    <section class="section">
      <div class="section-head"><h2>Catalogue sonore</h2></div>
      <div class="cat-grid">
        ${Object.entries(CATS).map(([k, v]) => `
          <button class="cat ${cat === k ? 'is-on' : ''}" data-cat="${k}">
            <span class="ac-icon sm">${icon(v.icon, 20)}</span>
            <span><span class="cat-name" style="display:block">${v.name}</span><span class="cat-count">${SOUNDS.filter((x) => x.cat === k).length} sons</span></span>
          </button>`).join('')}
      </div>
      <div class="sound-list">
        ${SOUNDS.filter((x) => x.cat === cat).map((x) => `
          <button class="sound ${x.id === player.soundId ? 'is-current' : ''}" data-sound="${x.id}">
            <span class="ac-icon sm">${icon(CATS[x.cat].icon, 18)}</span>
            <span class="grow"><span class="sound-name" style="display:block">${esc(x.name)}</span><span class="sound-desc">${esc(x.desc)}</span></span>
            ${x.id === player.soundId ? `<span class="eq ${player.playing ? '' : 'paused'}" data-p="eq"><i></i><i></i><i></i></span>` : icon('play', 16)}
          </button>`).join('')}
      </div>
    </section>

    <p class="offline-note">${icon('check', 16)} Fonctionne hors-ligne et en mode avion</p>`;
}

function update(el) {
  const sound = SOUNDS.find((x) => x.id === player.soundId) || SOUNDS[0];
  const set = (k, fn) => { const n = $(`[data-p="${k}"]`, el); if (n) fn(n); };
  set('title', (n) => { n.textContent = sound.name; });
  set('sub', (n) => { n.textContent = player.loading ? 'Préparation du son…' : CATS[sound.cat].name; });
  set('orb', (n) => n.classList.toggle('is-playing', player.playing));
  set('toggle', (n) => {
    n.innerHTML = icon(player.playing ? 'pause' : 'play', 32);
    n.setAttribute('aria-label', player.playing ? 'Pause' : 'Lecture');
    n.classList.toggle('is-loading', player.loading);
  });
  set('eq', (n) => n.classList.toggle('paused', !player.playing));
  const elapsed = player.playing ? Date.now() - player.startedAt : 0;
  set('elapsed', (n) => { n.textContent = fmtClock(elapsed); });
  if (player.timerMin) {
    const total = player.timerMin * 60e3;
    const left = player.playing ? Math.max(0, player.endsAt - Date.now()) : total;
    set('remaining', (n) => { n.textContent = `-${fmtClock(left)}`; });
    set('bar', (n) => { n.style.width = `${((total - left) / total) * 100}%`; });
  } else {
    set('remaining', (n) => { n.textContent = 'Sans minuteur'; });
    set('bar', (n) => { n.style.width = player.playing ? '100%' : '0%'; n.style.opacity = player.playing ? '.35' : '1'; });
  }
}

export function mount(el, scope) {
  update(el);
  scope.add(onPlayer(() => update(el)));
  scope.onTick(() => update(el));

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'toggle') { toggle(); }
    else if (b.dataset.act === 'prev' || b.dataset.act === 'next') { step(b.dataset.act === 'next' ? 1 : -1); cat = SOUNDS.find((x) => x.id === player.soundId).cat; savePrefs(); store.refresh(); }
    else if (b.dataset.act === 'veil') openVeilleuse();
    else if (b.dataset.cat) { cat = b.dataset.cat; store.refresh(); }
    else if (b.dataset.sound) {
      const id = b.dataset.sound;
      if (id === player.soundId && player.playing) toggle(); else play(id);
      savePrefs(); store.refresh();
    }
    else if (b.dataset.timer) {
      setTimer(+b.dataset.timer); savePrefs(); store.refresh();
      if (+b.dataset.timer) toast(`Arrêt automatique dans ${b.textContent}`);
    }
  });
  const vol = $('[data-volume]', el);
  vol.addEventListener('input', () => { setVolume(+vol.value); vol.style.setProperty('--p', `${vol.value * 100}%`); });
  vol.addEventListener('change', savePrefs);
  $('[data-fade]', el).addEventListener('change', (e) => { setFade(e.target.checked); savePrefs(); store.refresh(); });
}

/* ---------- Veilleuse : écran quasi noir, lueur chaude ---------- */
async function openVeilleuse() {
  let level = 0.3;
  let lock = null;
  let hideTimer;
  const el = document.createElement('div');
  el.className = 'veilleuse';
  el.innerHTML = `
    <p class="veil-hint">Touchez l’écran pour afficher les réglages</p>
    <div class="veil-glow" style="--a:${level}"></div>
    <div class="veil-ui">
      <button class="veil-btn" data-v="-" aria-label="Moins lumineux">–</button>
      <button class="veil-btn" data-v="exit">${icon('x', 18)} Quitter</button>
      <button class="veil-btn" data-v="+" aria-label="Plus lumineux">+</button>
    </div>`;
  document.body.appendChild(el);
  try { await document.documentElement.requestFullscreen?.(); } catch { /* facultatif */ }
  try { lock = await navigator.wakeLock?.request('screen'); } catch { /* facultatif */ }

  const showUi = () => { el.classList.add('show-ui'); clearTimeout(hideTimer); hideTimer = setTimeout(() => el.classList.remove('show-ui'), 4000); };
  const close = () => {
    clearTimeout(hideTimer);
    lock?.release?.();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    el.remove();
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return showUi();
    showUi();
    if (b.dataset.v === 'exit') return close();
    level = Math.min(0.7, Math.max(0.06, level + (b.dataset.v === '+' ? 0.08 : -0.08)));
    $('.veil-glow', el).style.setProperty('--a', level);
  });
}
