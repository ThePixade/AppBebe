import { store, activeChild, eventsOf, addEvent, removeEvent, restoreEvent } from '../store.js';
import { icon } from '../icons.js';
import { esc, fmtClock, fmtDur, fmtNum, ago, time, startOfDay, dayLabel, openSheet, closeSheet, toast, seg, emptyState, toLocalInput, fromLocalInput, $, $$ } from '../ui.js';
import { appHeader } from '../profiles.js';
import { openGrowth } from './growth.js';

const SIDE = { L: 'gauche', R: 'droit' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const DIAPER = { wet: 'Mouillée', dirty: 'Sale', mixed: 'Mixte' };
const STOOL_COLORS = [
  { id: 'jaune', label: 'Jaune', c: '#E6C14F' },
  { id: 'moutarde', label: 'Moutarde', c: '#C99A2E' },
  { id: 'vert', label: 'Verte', c: '#7F9A4A' },
  { id: 'marron', label: 'Marron', c: '#8A5A3A' },
  { id: 'noir', label: 'Noire', c: '#2A2420', warn: 'Normal les premiers jours (méconium). Au-delà, parlez-en à votre médecin.' },
  { id: 'pale', label: 'Blanche / grise', c: '#DAD6CB', warn: 'Selles décolorées : contactez rapidement votre médecin (voir la carte de couleur des selles du carnet de santé).', urgent: true },
  { id: 'rouge', label: 'Rouge', c: '#B5473A', warn: 'Présence possible de sang : demandez un avis médical.', urgent: true },
];
const TEXTURES = ['Liquide', 'Grumeleuse', 'Molle', 'Pâteuse', 'Dure'];
const VACCINES = ['Hexavalent (DTCaP-Hib-HepB)', 'Pneumocoque', 'Méningocoque B', 'Méningocoque C', 'ROR', 'Rotavirus', 'Autre'];
const MEDS = ['Vitamine D', 'Paracétamol', 'Vitamine K', 'Fer'];

/* ---------- Description d'un événement ---------- */
export function describe(e) {
  switch (e.type) {
    case 'feed':
      if (e.kind === 'bottle') return { icon: 'bottle', tone: 'salmon', title: 'Biberon', detail: `${e.ml} ml · ${e.milk === 'maternel' ? 'lait maternel' : 'lait infantile'}` };
      return { icon: 'bottle', tone: 'salmon', title: 'Tétée', detail: [e.L ? `G ${fmtDur(e.L)}` : '', e.R ? `D ${fmtDur(e.R)}` : ''].filter(Boolean).join(' · ') };
    case 'diaper': {
      const col = STOOL_COLORS.find((c) => c.id === e.color);
      return { icon: e.kind === 'wet' ? 'drop' : 'stool', tone: 'peach', title: `Couche ${DIAPER[e.kind].toLowerCase()}`, detail: [col?.label, e.texture].filter(Boolean).join(' · ') };
    }
    case 'sleep': return { icon: 'moon', tone: 'slate', title: 'Sommeil', detail: `${time(e.at)} → ${time(e.end)} · ${fmtDur(e.end - e.at)}` };
    case 'growth': return { icon: 'growth', tone: 'sage', title: 'Mesure', detail: [e.weight && `${fmtNum(e.weight, 2)} kg`, e.height && `${fmtNum(e.height)} cm`, e.head && `PC ${fmtNum(e.head)} cm`].filter(Boolean).join(' · ') };
    case 'note': return { icon: 'note', tone: 'pearl', title: 'Note', detail: e.text };
    case 'vaccine': return { icon: 'syringe', tone: 'sage', title: 'Vaccin', detail: [e.name, e.text].filter(Boolean).join(' · ') };
    case 'med': return { icon: 'pill', tone: 'salmon', title: e.name, detail: e.dose || 'Médicament' };
    case 'temp': return { icon: 'thermo', tone: e.value >= 38 ? 'brick' : 'pearl', title: `${fmtNum(e.value)} °C`, detail: e.value >= 38 ? 'Fièvre' : 'Température' };
    default: return { icon: 'note', tone: 'pearl', title: 'Événement', detail: '' };
  }
}

function action(e, name) {
  switch (e.type) {
    case 'feed': return e.kind === 'bottle' ? `donné un biberon de ${e.ml} ml à ${name}` : `noté une tétée de ${name}`;
    case 'diaper': return `changé la couche de ${name}`;
    case 'sleep': return `noté une sieste de ${name} (${fmtDur(e.end - e.at)})`;
    case 'growth': return `mesuré ${name}`;
    case 'note': return 'ajouté une note';
    case 'vaccine': return `noté un vaccin pour ${name}`;
    case 'med': return `donné ${e.name} à ${name}`;
    case 'temp': return `pris la température de ${name}`;
    default: return 'ajouté un événement';
  }
}

/* ---------- Chronomètres ---------- */
const breastOf = (s, id) => s.timers.breast?.[id];
const sleepOf = (s, id) => s.timers.sleep?.[id];
function sideMs(t, side, now = Date.now()) { return (t.acc[side] || 0) + (t.side === side ? now - t.segStart : 0); }
const breastTotal = (t) => sideMs(t, 'L') + sideMs(t, 'R');

/* ---------- Rendu ---------- */
export function render(s) {
  const c = activeChild(s);
  const evs = eventsOf(s, c.id);
  const t0 = startOfDay();
  const today = evs.filter((e) => e.at >= t0);
  const feeds = today.filter((e) => e.type === 'feed');
  const ml = feeds.reduce((a, e) => a + (e.ml || 0), 0);
  const diapers = today.filter((e) => e.type === 'diaper').length;
  const sleepMs = evs.filter((e) => e.type === 'sleep' && e.end >= t0).reduce((a, e) => a + (e.end - Math.max(e.at, t0)), 0);

  const breast = breastOf(s, c.id);
  const sleeping = sleepOf(s, c.id);
  const lastFeed = evs.find((e) => e.type === 'feed');
  const lastDiaper = evs.find((e) => e.type === 'diaper');
  const lastSleep = evs.find((e) => e.type === 'sleep');
  const lastGrowth = evs.find((e) => e.type === 'growth' && e.weight);
  const lastBreast = evs.find((e) => e.type === 'feed' && e.kind === 'breast');
  const nextSide = lastBreast?.last === 'L' ? 'R' : 'L';

  const feedMeta = breast
    ? `<strong data-live="breast">${fmtClock(breastTotal(breast))}</strong> · côté ${breast.side ? SIDE[breast.side] : 'en pause'}`
    : lastFeed ? `${cap(ago(lastFeed.at))} · ${lastFeed.kind === 'bottle' ? `${lastFeed.ml} ml` : 'tétée'}${lastBreast ? `<br>Prochain côté : ${SIDE[nextSide]}` : ''}` : 'Aucun repas noté';
  const sleepMeta = sleeping
    ? `Dort depuis <strong data-live="sleep">${fmtClock(Date.now() - sleeping)}</strong>`
    : lastSleep ? `Éveillé·e depuis ${fmtDur(Date.now() - lastSleep.end)}` : 'Toucher pour lancer';
  const diaperMeta = lastDiaper ? `${cap(ago(lastDiaper.at))} · ${DIAPER[lastDiaper.kind].toLowerCase()}` : 'En 2 touches';
  const growthMeta = lastGrowth ? `${fmtNum(lastGrowth.weight, 2)} kg${lastGrowth.height ? ` · ${fmtNum(lastGrowth.height)} cm` : ''}` : 'Courbes poids & taille';

  const card = (act, tone, ic, title, meta, running) => `
    <button class="action-card tone-${tone} ${running ? 'is-running' : ''}" data-act="${act}">
      <span class="ac-icon">${icon(ic, 24)}</span>
      ${running ? '<span class="ac-live"><i></i>En cours</span>' : ''}
      <span class="ac-body"><span class="ac-title">${title}</span><span class="ac-meta">${meta}</span></span>
    </button>`;

  return `
    ${appHeader(s)}
    <section class="hero">
      <p class="eyebrow">${dayLabel()}</p>
      <h1 class="title">La journée de ${esc(c.name)}</h1>
    </section>

    <section class="card stats" aria-label="Résumé du jour">
      <div class="stat"><span class="stat-v num">${feeds.length}</span><span class="stat-l">Repas</span></div>
      <div class="stat"><span class="stat-v num">${ml}<small>ml</small></span><span class="stat-l">Lait</span></div>
      <div class="stat"><span class="stat-v num">${diapers}</span><span class="stat-l">Couches</span></div>
      <div class="stat"><span class="stat-v num" data-live="sleepTotal" data-base="${sleepMs}">${fmtDur(sleepMs + (sleeping ? Date.now() - Math.max(sleeping, t0) : 0)).replace('< 1 min', '0 min')}</span><span class="stat-l">Sommeil</span></div>
    </section>

    <section class="action-grid" aria-label="Actions rapides">
      ${card('feed', 'salmon', 'bottle', 'Tétée / Biberon', feedMeta, !!breast)}
      ${card('diaper', 'peach', 'diaper', 'Couches', diaperMeta)}
      ${card('sleep', 'slate', 'moon', 'Sommeil', sleepMeta, !!sleeping)}
      ${card('growth', 'sage', 'growth', 'Croissance', growthMeta)}
    </section>

    <section class="section">
      <div class="section-head"><h2>Aujourd'hui</h2><span class="small faint">${today.length} événement${today.length > 1 ? 's' : ''}</span></div>
      <div class="card timeline">
        ${today.length ? today.map((e) => eventRow(e)).join('') : emptyState('clock', 'Rien pour le moment', 'Les actions de la journée apparaîtront ici.')}
      </div>
    </section>
    ${feedBanner(s)}`;
}

function eventRow(e) {
  const d = describe(e);
  return `
    <button class="event tone-${d.tone}" data-act="event" data-id="${e.id}">
      <span class="ev-time num">${time(e.at)}</span>
      <span class="ev-dot">${icon(d.icon, 18)}</span>
      <span class="ev-main"><span class="ev-title">${esc(d.title)}</span>${d.detail ? `<span class="ev-detail" style="display:block">${esc(d.detail)}</span>` : ''}</span>
      <span class="ev-by">${esc(e.by)}</span>
    </button>`;
}

/** Dernière action du co-parent / de la nounou (sinon la dernière tout court). */
function feedBanner(s) {
  const recent = [...s.events].filter((e) => Date.now() - e.at < 2 * 864e5).sort((a, b) => b.at - a.at);
  const e = recent.find((x) => x.by !== s.me) || recent[0];
  if (!e) return '';
  const child = s.children.find((c) => c.id === e.childId);
  const mine = e.by === s.me;
  const tone = { Maman: 'salmon', Papa: 'slate', Nounou: 'sage' }[e.by] || 'pearl';
  return `
    <div class="feed-banner tone-${tone}" role="status">
      <span class="avatar-mini">${esc(e.by[0])}</span>
      <span class="fb-text"><b>${mine ? 'Vous avez' : `${esc(e.by)} a`}</b> ${esc(action(e, child?.name || 'bébé'))}</span>
      <span class="faint" data-live="banner" data-at="${e.at}">${ago(e.at)}</span>
    </div>`;
}

export function mount(el, scope) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const c = activeChild(store.state);
    ({ feed: () => openFeed(c), diaper: () => openDiaper(c), sleep: () => toggleSleep(c), growth: () => openGrowth(c), event: () => openEvent(b.dataset.id) })[b.dataset.act]?.();
  });
  scope.onTick(() => {
    const s = store.state, c = activeChild(s);
    const br = breastOf(s, c.id), sl = sleepOf(s, c.id);
    const bEl = $('[data-live="breast"]', el); if (bEl && br) bEl.textContent = fmtClock(breastTotal(br));
    const sEl = $('[data-live="sleep"]', el); if (sEl && sl) sEl.textContent = fmtClock(Date.now() - sl);
    const tEl = $('[data-live="sleepTotal"]', el);
    if (tEl && sl) tEl.textContent = fmtDur(+tEl.dataset.base + Date.now() - Math.max(sl, startOfDay())).replace('< 1 min', '0 min');
    const fb = $('[data-live="banner"]', el); if (fb) fb.textContent = ago(+fb.dataset.at);
  });
}

/* ---------- Repas ---------- */
function openFeed(c, initialMode) {
  const s0 = store.state;
  const lastBottle = eventsOf(s0, c.id).find((e) => e.type === 'feed' && e.kind === 'bottle');
  const lastBreast = eventsOf(s0, c.id).find((e) => e.type === 'feed' && e.kind === 'breast');
  let mode = initialMode || (breastOf(s0, c.id) ? 'breast' : lastBottle && (!lastBreast || lastBottle.at > lastBreast.at) ? 'bottle' : 'breast');
  let ml = '';
  let milk = lastBottle?.milk || 'infantile';
  const hint = lastBreast?.last === 'L' ? 'R' : 'L';

  openSheet({
    title: 'Repas', subtitle: c.name,
    onMount(body, api) {
      const draw = () => {
        const t = breastOf(store.state, c.id);
        body.innerHTML = `
          ${seg('mode', [['breast', 'Allaitement'], ['bottle', 'Biberon']], mode, 'seg-lg')}
          ${mode === 'breast' ? `
            <div class="timer-display">
              <span class="timer-big num" data-t="total">${fmtClock(t ? breastTotal(t) : 0)}</span>
              <span class="timer-sub">${t ? (t.side ? `Côté ${SIDE[t.side]} en cours` : 'En pause · touchez un côté pour reprendre') : `Conseillé : commencer côté ${SIDE[hint]}`}</span>
            </div>
            <div class="side-pick">
              ${['L', 'R'].map((sd) => `
                <button class="side ${t?.side === sd ? 'is-active' : ''}" data-act="side" data-side="${sd}" aria-pressed="${t?.side === sd}">
                  ${!t && sd === hint ? '<span class="badge tone-salmon side-hint">Conseillé</span>' : ''}
                  <span class="side-btn">${icon(t?.side === sd ? 'pause' : 'play', 20)}</span>
                  <span class="side-label">${sd === 'L' ? 'Gauche' : 'Droit'}</span>
                  <span class="side-time num" data-t="${sd}">${fmtClock(t ? sideMs(t, sd) : 0)}</span>
                </button>`).join('')}
            </div>
            <div class="actions tone-salmon">
              <button class="btn btn-ghost" data-act="cancel" ${t ? '' : 'disabled'}>Annuler</button>
              <button class="btn btn-primary" data-act="save-breast" ${t ? '' : 'disabled'}>${icon('check', 20)} Terminer</button>
            </div>` : `
            <div class="amount mt-20"><span class="amount-value num">${ml || '0'}</span><span class="amount-unit">ml</span></div>
            <div class="chips tone-salmon" style="justify-content:center">${[60, 90, 120, 150, 180, 210].map((v) => `<button class="chip ${+ml === v ? 'is-on' : ''}" data-act="preset" data-v="${v}">${v}</button>`).join('')}</div>
            <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="key num" data-act="key" data-v="${n}">${n}</button>`).join('')}
              <button class="key fn" data-act="clear">Effacer</button><button class="key num" data-act="key" data-v="0">0</button><button class="key fn" data-act="back" aria-label="Supprimer le dernier chiffre">⌫</button></div>
            ${seg('milk', [['infantile', 'Lait infantile'], ['maternel', 'Lait maternel']], milk)}
            <div class="tone-salmon mt-16"><button class="btn btn-primary btn-block btn-lg" data-act="save-bottle" ${+ml > 0 ? '' : 'disabled'}>Enregistrer${+ml > 0 ? ` ${ml} ml` : ''}</button></div>`}`;
      };

      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act],[data-seg]');
        if (!b) return;
        if (b.dataset.seg === 'mode') mode = b.dataset.v;
        else if (b.dataset.seg === 'milk') milk = b.dataset.v;
        else switch (b.dataset.act) {
          case 'side': tapSide(c.id, b.dataset.side); break;
          case 'cancel': store.update((s) => { delete s.timers.breast[c.id]; }); break;
          case 'save-breast': saveBreast(c); api.close(); return;
          case 'key': if (ml.length < 3) ml = (ml + b.dataset.v).replace(/^0+/, ''); break;
          case 'back': ml = ml.slice(0, -1); break;
          case 'clear': ml = ''; break;
          case 'preset': ml = b.dataset.v; break;
          case 'save-bottle':
            addEvent({ childId: c.id, type: 'feed', kind: 'bottle', ml: +ml, milk });
            api.close(); toast(`Biberon de ${ml} ml enregistré`); return;
        }
        draw();
      });
      api.onTick(() => {
        const t = breastOf(store.state, c.id);
        if (!t || mode !== 'breast') return;
        const set = (k, v) => { const n = $(`[data-t="${k}"]`, body); if (n) n.textContent = fmtClock(v); };
        set('total', breastTotal(t)); set('L', sideMs(t, 'L')); set('R', sideMs(t, 'R'));
      });
      draw();
    },
  });
}

function tapSide(childId, side) {
  const now = Date.now();
  store.update((s) => {
    const t = s.timers.breast[childId];
    if (!t) { s.timers.breast[childId] = { startedAt: now, side, segStart: now, acc: { L: 0, R: 0 }, last: side }; return; }
    if (t.side) t.acc[t.side] += now - t.segStart;
    if (t.side === side) t.side = null;
    else { t.side = side; t.segStart = now; t.last = side; }
  });
}

function saveBreast(c) {
  const t = breastOf(store.state, c.id);
  if (!t) return;
  const now = Date.now();
  const L = sideMs(t, 'L', now), R = sideMs(t, 'R', now);
  store.update((s) => { delete s.timers.breast[c.id]; }, { silent: true });
  addEvent({ childId: c.id, type: 'feed', kind: 'breast', at: t.startedAt, end: now, L, R, last: t.last });
  toast(`Tétée enregistrée · ${fmtDur(L + R)}`);
}

/* ---------- Couches ---------- */
function openDiaper(c) {
  let color = null, texture = null;
  openSheet({
    title: 'Couche', subtitle: `${c.name} · détails facultatifs, puis le type`,
    onMount(body, api) {
      const draw = () => {
        const col = STOOL_COLORS.find((x) => x.id === color);
        body.innerHTML = `
          <p class="label">Couleur des selles</p>
          <div class="chips mt-8 tone-peach">${STOOL_COLORS.map((x) => `<button class="chip ${color === x.id ? 'is-on' : ''}" data-color="${x.id}"><span class="swatch" style="--c:${x.c}"></span>${x.label}</button>`).join('')}</div>
          ${col?.warn ? `<div class="notice tone-${col.urgent ? 'brick' : 'yellow'} mt-12">${icon('alert', 20)}<span>${col.warn}</span></div>` : ''}
          <p class="label mt-20">Texture</p>
          <div class="chips mt-8 tone-peach">${TEXTURES.map((x) => `<button class="chip ${texture === x ? 'is-on' : ''}" data-texture="${x}">${x}</button>`).join('')}</div>
          <p class="label mt-24">Type de couche — enregistre directement</p>
          <div class="diaper-types mt-8">
            <button class="dtype tone-slate" data-kind="wet"><span class="ic">${icon('drop', 30)}</span>Mouillée</button>
            <button class="dtype tone-peach" data-kind="dirty"><span class="ic">${icon('stool', 30)}</span>Sale</button>
            <button class="dtype tone-salmon" data-kind="mixed"><span class="ic">${icon('drop', 24)}${icon('stool', 24)}</span>Mixte</button>
          </div>`;
      };
      body.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.color) { color = color === b.dataset.color ? null : b.dataset.color; draw(); }
        else if (b.dataset.texture) { texture = texture === b.dataset.texture ? null : b.dataset.texture; draw(); }
        else if (b.dataset.kind) {
          const kind = b.dataset.kind;
          const ev = addEvent({ childId: c.id, type: 'diaper', kind, ...(kind !== 'wet' ? { color, texture } : {}) });
          api.close();
          toast(`Couche ${DIAPER[kind].toLowerCase()} enregistrée`, { action: 'Annuler', onAction: () => removeEvent(ev.id) });
        }
      });
      draw();
    },
  });
}

/* ---------- Sommeil ---------- */
function toggleSleep(c) {
  if (sleepOf(store.state, c.id)) return openSleepRunning(c);
  store.update((s) => { s.timers.sleep[c.id] = Date.now(); });
  toast(`Bonne sieste, ${c.name} · chronomètre lancé`, { action: 'Annuler', onAction: () => store.update((s) => { delete s.timers.sleep[c.id]; }) });
}

function openSleepRunning(c) {
  openSheet({
    title: 'Sommeil en cours', subtitle: c.name,
    onMount(body, api) {
      const start = sleepOf(store.state, c.id);
      body.innerHTML = `
        <div class="timer-display tone-slate">
          <span class="timer-big num" data-t="sleep">${fmtClock(Date.now() - start)}</span>
          <span class="timer-sub">Endormi·e à ${time(start)}</span>
        </div>
        <label class="field"><span>Corriger l'heure d'endormissement</span><input class="input" type="datetime-local" name="start" value="${toLocalInput(start)}" max="${toLocalInput()}"></label>
        <div class="actions tone-slate">
          <button class="btn btn-ghost" data-act="cancel">Annuler</button>
          <button class="btn btn-primary btn-lg" data-act="stop">${icon('sun', 20)} Réveil</button>
        </div>`;
      body.querySelector('[name="start"]').addEventListener('change', (e) => {
        const ts = fromLocalInput(e.target.value);
        if (ts < Date.now()) store.update((s) => { s.timers.sleep[c.id] = ts; });
      });
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const st = sleepOf(store.state, c.id);
        store.update((s) => { delete s.timers.sleep[c.id]; }, { silent: b.dataset.act === 'stop' });
        if (b.dataset.act === 'stop') { addEvent({ childId: c.id, type: 'sleep', at: st, end: Date.now() }); toast(`Sieste de ${fmtDur(Date.now() - st)} enregistrée`); }
        api.close();
      });
      api.onTick(() => { const st = sleepOf(store.state, c.id); const n = $('[data-t="sleep"]', body); if (st && n) n.textContent = fmtClock(Date.now() - st); });
    },
  });
}

/* ---------- Détail d'un événement ---------- */
function openEvent(id) {
  const e = store.state.events.find((x) => x.id === id);
  if (!e) return;
  const d = describe(e);
  openSheet({
    title: d.title, subtitle: `${time(e.at)} · ajouté par ${e.by}`,
    content: `
      <div class="row tone-${d.tone}"><span class="ac-icon">${icon(d.icon, 24)}</span><p class="muted">${esc(d.detail) || '—'}</p></div>
      <button class="btn btn-danger btn-block mt-24" data-del>${icon('trash', 18)} Supprimer</button>`,
    onMount(body, api) {
      body.querySelector('[data-del]').addEventListener('click', () => {
        const ev = removeEvent(id);
        api.close();
        toast('Événement supprimé', { action: 'Annuler', onAction: () => restoreEvent(ev) });
      });
    },
  });
}

/* ---------- Bouton « + » : ajout rapide ---------- */
export function openQuickAdd() {
  const c = activeChild(store.state);
  if (!c) return;
  const items = [
    ['note', 'note', 'pearl', 'Note'],
    ['vaccine', 'syringe', 'sage', 'Vaccin'],
    ['med', 'pill', 'salmon', 'Médicament'],
    ['temp', 'thermo', 'brick', 'Température'],
    ['pastSleep', 'moon', 'slate', 'Sieste passée'],
    ['growth', 'growth', 'sage', 'Mesure'],
  ];
  openSheet({
    title: 'Ajout rapide', subtitle: c.name,
    content: `<div class="menu-grid">${items.map(([k, ic, tone, label]) => `<button class="menu-item tone-${tone}" data-k="${k}"><span class="ac-icon">${icon(ic, 22)}</span>${label}</button>`).join('')}</div>`,
    onMount(body) {
      body.addEventListener('click', (e) => {
        const k = e.target.closest('[data-k]')?.dataset.k;
        if (!k) return;
        if (k === 'growth') return openGrowth(c, 'add');
        openForm(c, k);
      });
    },
  });
}

function openForm(c, kind) {
  const whenField = (label = 'Quand ?') => `<label class="field"><span>${label}</span><input class="input" type="datetime-local" name="at" value="${toLocalInput()}" max="${toLocalInput()}"></label>`;
  const forms = {
    note: { title: 'Nouvelle note', html: `<label class="field"><span>Note</span><textarea class="input" name="text" placeholder="Premier sourire, rendez-vous pédiatre…" maxlength="500"></textarea></label>${whenField()}` },
    vaccine: { title: 'Vaccin', html: `<p class="label">Vaccin</p><div class="chips mt-8 tone-sage" data-pick="name">${VACCINES.map((v) => `<button type="button" class="chip" data-v="${v}">${v}</button>`).join('')}</div><label class="field mt-16"><span>Remarque</span><input class="input" name="text" placeholder="Lot, réaction éventuelle…"></label>${whenField('Date')}` },
    med: { title: 'Médicament', html: `<div class="chips tone-salmon" data-pick="name">${MEDS.map((v) => `<button type="button" class="chip" data-v="${v}">${v}</button>`).join('')}</div><label class="field mt-16"><span>Nom</span><input class="input" name="name" placeholder="Nom du médicament"></label><div class="js-last"></div><label class="field"><span>Dose</span><input class="input" name="dose" placeholder="Ex. 1 dose-poids, 2 gouttes"></label>${whenField()}<div class="notice tone-pearl">${icon('info', 18)}<span>Respectez toujours la posologie prescrite par votre médecin ou pharmacien.</span></div>` },
    temp: { title: 'Température', html: `<label class="field"><span>Température (°C)</span><input class="input num" name="value" type="number" inputmode="decimal" step="0.1" min="34" max="43" placeholder="37,2"></label><div class="js-fever"></div>${whenField()}` },
    pastSleep: { title: 'Sieste passée', html: `<label class="field"><span>Endormissement</span><input class="input" type="datetime-local" name="at" value="${toLocalInput(Date.now() - 3600e3)}" max="${toLocalInput()}"></label><label class="field"><span>Réveil</span><input class="input" type="datetime-local" name="end" value="${toLocalInput()}" max="${toLocalInput()}"></label>` },
  };
  const f = forms[kind];
  openSheet({
    title: f.title, subtitle: c.name,
    content: `<form class="js-form" novalidate>${f.html}<button class="btn btn-primary btn-block btn-lg mt-16" type="submit">Enregistrer</button></form>`,
    onMount(body, api) {
      const form = $('.js-form', body);
      const F = (n) => form.elements.namedItem(n);
      const picked = {};
      form.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-pick] .chip');
        if (!chip) return;
        const key = chip.parentElement.dataset.pick;
        picked[key] = chip.dataset.v;
        $$('.chip', chip.parentElement).forEach((x) => x.classList.toggle('is-on', x === chip));
        if (kind === 'med') { F("name").value = chip.dataset.v; showLastMed(); }
      });
      const showLastMed = () => {
        const name = F("name")?.value.trim().toLowerCase();
        const last = name && eventsOf(store.state, c.id).find((e) => e.type === 'med' && e.name.toLowerCase() === name);
        $('.js-last', form).innerHTML = last ? `<div class="notice tone-salmon" style="margin:-6px 0 16px">${icon('clock', 18)}<span>Dernière prise de <b>${esc(last.name)}</b> ${ago(last.at)} (${time(last.at)}).</span></div>` : '';
      };
      F("name")?.addEventListener('input', showLastMed);
      F("value")?.addEventListener('input', () => {
        const v = parseFloat(F("value").value.replace(',', '.'));
        $('.js-fever', form).innerHTML = v >= 38 ? `<div class="notice tone-brick" style="margin:-6px 0 16px">${icon('alert', 18)}<span><b>Fièvre.</b> Avant 3 mois, consultez un médecin sans attendre. En cas de doute ou de signe inquiétant, appelez le 15.</span></div>` : '';
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const at = fromLocalInput(F("at")?.value);
        let data;
        if (kind === 'note') { if (!F("text").value.trim()) return toast('Écrivez une note'); data = { type: 'note', text: F("text").value.trim() }; }
        if (kind === 'vaccine') { if (!picked.name) return toast('Choisissez un vaccin'); data = { type: 'vaccine', name: picked.name, text: F("text").value.trim() }; }
        if (kind === 'med') { const name = F("name").value.trim(); if (!name) return toast('Indiquez le médicament'); data = { type: 'med', name, dose: F("dose").value.trim() }; }
        if (kind === 'temp') { const v = parseFloat(F("value").value.replace(',', '.')); if (!(v > 30 && v < 45)) return toast('Température invalide'); data = { type: 'temp', value: v }; }
        if (kind === 'pastSleep') { const end = fromLocalInput(F("end").value); if (end <= at) return toast("Le réveil doit suivre l'endormissement"); data = { type: 'sleep', end }; }
        addEvent({ childId: c.id, at, ...data });
        api.close();
        toast('Ajouté au journal');
      });
    },
  });
}
