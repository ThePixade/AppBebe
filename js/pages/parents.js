import { store, activeChild, eventsOf, partnerOf, usesBreast, setBreastfeeding } from '../store.js';
import { icon } from '../icons.js';
import { esc, uid, dayKey, dateShort, ago, DAY, openSheet, toast, seg, emptyState, $ } from '../ui.js';
import { appHeader } from '../profiles.js';

let tab = null;

const MOODS = [
  { v: 5, e: '😊', F: 'Épanouie', M: 'Épanoui', c: '#F2CC6B' },
  { v: 4, e: '🙂', F: 'Sereine', M: 'Serein', c: '#EEB563' },
  { v: 3, e: '😴', F: 'Fatiguée', M: 'Fatigué', c: '#E99A5E' },
  { v: 2, e: '😟', F: 'Anxieuse', M: 'Anxieux', c: '#DF7A55' },
  { v: 1, e: '😣', F: 'Irritée', M: 'Irrité', c: '#CC5A4B' },
];

const CHECKLISTS = {
  Maman: {
    title: 'Mon post-partum', icon: 'heart', tone: 'salmon',
    items: [
      ['epnp', 'Entretien postnatal précoce', 'Entre la 4ᵉ et la 8ᵉ semaine, avec une sage-femme ou un médecin'],
      ['visite', 'Visite postnatale', 'Dans les 6 à 8 semaines après la naissance'],
      ['perinee', 'Bilan & rééducation du périnée', 'Prescrite lors de la visite postnatale'],
      ['cicatrice', 'Surveiller la cicatrice', 'Épisiotomie ou césarienne : rougeur, douleur, fièvre'],
      ['lochies', 'Suivi des saignements', 'Signalez des saignements abondants ou malodorants'],
      ['contraception', 'Faire le point contraception', 'Une ovulation peut revenir avant le retour de couches'],
      ['abdos', 'Rééducation abdominale', 'Seulement après celle du périnée'],
      ['repos', 'Dormir quand bébé dort', 'Au moins une sieste par jour, c’est un soin'],
    ],
  },
  Papa: {
    title: 'Mes démarches & relais', icon: 'check', tone: 'slate',
    items: [
      ['declaration', 'Déclarer la naissance', 'En mairie, dans les 5 jours'],
      ['conge', 'Poser le congé de paternité', '25 jours + 3 jours de naissance'],
      ['secu', 'Sécurité sociale & mutuelle', 'Rattacher bébé à votre couverture'],
      ['caf', 'Déclarer la naissance à la CAF', 'Pour les prestations familiales'],
      ['medecin', 'Choisir le médecin de bébé', 'Pédiatre ou généraliste'],
      ['nuits', 'Organiser le planning des nuits', 'Alterner pour que chacun dorme'],
      ['relais', 'Offrir un vrai temps de repos', 'Un créneau rien que pour l’autre parent'],
    ],
  },
};

const TASK_PRESETS = ['Prendre le relais pour la sieste', 'Acheter du liniment', 'Acheter des couches', 'Préparer les biberons', 'Lancer une machine', 'Faire les courses', 'Donner le bain'];
const FRIDGE_MS = 2 * DAY;      // 48 h au réfrigérateur (≤ 4 °C)
const FREEZER_MS = 120 * DAY;   // 4 mois au congélateur (-18 °C)

function moodSignal(moods) {
  const last7 = Array.from({ length: 7 }, (_, i) => moods[dayKey(Date.now() - i * DAY)]).filter(Boolean);
  return last7.length >= 4 && last7.filter((v) => v <= 2).length >= 4;
}

export function render(s) {
  tab ||= s.me === 'Papa' ? 'Papa' : 'Maman';
  const who = tab;
  const g = who === 'Maman' ? 'F' : 'M';
  const moods = s.moods[who] || {};
  const todayMood = moods[dayKey()];
  const list = CHECKLISTS[who];
  const done = list.items.filter(([id]) => s.checks[`${who}:${id}`]).length;
  const strip = Array.from({ length: 14 }, (_, i) => moods[dayKey(Date.now() - (13 - i) * DAY)]);

  return `
    ${appHeader(s)}
    <section class="hero">
      <p class="eyebrow">Espace parents</p>
      <h1 class="title">Prendre soin<br>de vous aussi</h1>
    </section>

    ${seg('who', [['Maman', 'Pour Maman'], ['Papa', 'Pour Papa']], who, 'seg-lg')}

    <section class="card mt-16">
      <div class="row-between"><h2 style="font-size:1rem">Comment vous sentez-vous ?</h2>${todayMood ? `<span class="badge tone-sage">${icon("check", 12)} Noté</span>` : ""}</div>
      <div class="mood-row mt-16">
        ${MOODS.map((m) => `<button class="mood ${todayMood === m.v ? 'is-on' : ''}" style="--mc:${m.c}" data-mood="${m.v}" aria-pressed="${todayMood === m.v}"><span class="e">${m.e}</span>${m[g]}</button>`).join('')}
      </div>
      <div class="mood-strip" aria-label="Humeur des 14 derniers jours">${strip.map((v) => `<span style="${v ? `--mc:${MOODS.find((m) => m.v === v).c}` : '--o:.6'}"></span>`).join('')}</div>
      <div class="mood-strip-legend"><span>Il y a 2 semaines</span><span>Aujourd’hui</span></div>
    </section>

    ${moodSignal(moods) ? `
    <div class="notice tone-salmon mt-12">${icon('heart', 20)}<span><b>Vous traversez des jours difficiles.</b> C’est fréquent et ce n’est pas un échec. Parlez-en à votre sage-femme ou à votre médecin : le baby-blues et la dépression post-partum se soignent. En cas de détresse, le <b>3114</b> répond 24 h/24.</span></div>` : ''}

    <section class="section">
      <div class="section-head tone-${list.tone}"><h2>${icon(list.icon, 20)} ${list.title}</h2><span class="badge">${done}/${list.items.length}</span></div>
      <div class="card" style="padding:4px 16px">
        ${list.items.map(([id, t, d]) => {
          const on = !!s.checks[`${who}:${id}`];
          return `<button class="check ${on ? 'is-done' : ''}" data-check="${id}" aria-pressed="${on}"><span class="check-box">${icon('check', 16)}</span><span class="check-text">${t}<small>${d}</small></span></button>`;
        }).join('')}
      </div>
    </section>

    ${who === 'Maman' ? breastToggle(s) + (usesBreast(s) && pumpEnabled(s) ? breastfeedingSection(s) : '') : relaySection(s)}

    <section class="section">
      <div class="section-head"><h2>${icon('breath', 20)} Espace mental</h2></div>
      <button class="card tool-card tone-slate" data-act="breath">
        <span class="ac-icon">${icon('breath', 24)}</span>
        <span class="grow"><span class="t" style="display:block">Cohérence cardiaque</span><span class="d">3 minutes pour apaiser le stress · 6 respirations / min</span></span>
        ${icon('chevronRight', 20)}
      </button>
      <button class="card tool-card tone-yellow" data-act="share">
        <span class="ac-icon">${icon('share', 22)}</span>
        <span class="grow"><span class="t" style="display:block">Partager une tâche</span><span class="d">Demander un coup de main en douceur à ${esc(partnerOf(s.me))}</span></span>
        ${icon('chevronRight', 20)}
      </button>
    </section>

    ${tasksSection(s)}`;
}

/** Le tirage est une option : affichée seulement si activée, ou si des tirages existent déjà. */
const pumpEnabled = (s) => s.pumpOn ?? (s.pumps.length > 0 || s.stock.length > 0);

function breastToggle(s) {
  const on = usesBreast(s);
  return `
    <section class="section">
      <div class="card">
        <div class="row-between">
          <span class="grow"><b style="display:block">Allaitement</b><span class="small muted">Tétées et suivi de l'allaitement</span></span>
          <label class="switch" aria-label="Activer l'allaitement"><input type="checkbox" data-breast-toggle ${on ? 'checked' : ''}><span class="track"></span></label>
        </div>
        ${on ? `<div class="field mt-16" style="margin-bottom:0"><span>Noter les tétées</span>${seg('binput', [['manual', 'Durée à la main'], ['timer', 'Chronomètre']], s.breastInput || '')}${s.breastInput ? '' : '<small class="faint">Ce choix vous sera demandé à la prochaine tétée.</small>'}</div>
          <div class="row-between mt-16">
            <span class="grow"><b style="display:block;font-size:.95rem">Tirage du lait</b><span class="small muted">Tire-lait et stock frigo / congélateur (option)</span></span>
            <label class="switch" aria-label="Activer le tirage du lait"><input type="checkbox" data-pump-toggle ${pumpEnabled(s) ? 'checked' : ''}><span class="track"></span></label>
          </div>` : '<p class="small faint mt-12">Désactivé : les tétées et le suivi de l’allaitement sont masqués.</p>'}
      </div>
    </section>`;
}

function breastfeedingSection(s) {
  const now = Date.now();
  const fridge = s.stock.filter((x) => x.place === 'fridge');
  const freezer = s.stock.filter((x) => x.place === 'freezer');
  const sum = (a) => a.reduce((t, x) => t + x.ml, 0);
  const todayPumps = s.pumps.filter((p) => dayKey(p.at) === dayKey());
  const sorted = [...s.stock].sort((a, b) => a.at - b.at);
  const expiry = (x) => x.at + (x.place === 'fridge' ? FRIDGE_MS : FREEZER_MS);
  return `
    <section class="section">
      <div class="section-head tone-salmon"><h2>${icon('bottle', 20)} Mon allaitement</h2><button class="link" data-act="pump">${icon('plus', 16)} Tirage</button></div>
      <div class="card">
        <div class="row-between"><span class="small muted">Tiré aujourd’hui</span><b class="num">${sum(todayPumps)} ml <span class="faint small">· ${todayPumps.length} tirage${todayPumps.length > 1 ? 's' : ''}</span></b></div>
        <div class="stock-tiles mt-16">
          <div class="stock-tile tone-slate"><div class="row">${icon('fridge', 16)} Réfrigérateur</div><div class="v num">${sum(fridge)} ml</div><div class="s">${fridge.length} pot${fridge.length > 1 ? "s" : ""} · 48 h</div></div>
          <div class="stock-tile tone-sage"><div class="row">${icon('snow', 16)} Congélateur</div><div class="v num">${sum(freezer)} ml</div><div class="s">${freezer.length} pot${freezer.length > 1 ? "s" : ""} · 4 mois</div></div>
        </div>
        ${sorted.length ? `<p class="label mt-20">À utiliser en premier</p>
          ${sorted.slice(0, 6).map((x) => {
            const left = expiry(x) - now;
            const tone = left < 0 ? 'brick' : left < (x.place === 'fridge' ? 12 * 3600e3 : 7 * DAY) ? 'yellow' : 'sage';
            return `<div class="stock-item">
              <span class="ev-dot tone-${x.place === 'fridge' ? 'slate' : 'sage'}">${icon(x.place === 'fridge' ? 'fridge' : 'snow', 16)}</span>
              <span class="grow" style="flex:1"><b class="num">${x.ml} ml</b><br><span class="small faint">${dateShort(x.at)}</span></span>
              <span class="badge tone-${tone}">${left < 0 ? 'Périmé' : `Avant ${dateShort(expiry(x))}`}</span>
              <button class="btn btn-sm" data-use="${x.id}">${left < 0 ? 'Jeter' : 'Utiliser'}</button>
            </div>`;
          }).join('')}` : `<p class="small faint mt-16">Notez un tirage pour constituer votre stock.</p>`}
      </div>
    </section>`;
}

function relaySection(s) {
  const since = Date.now() - 7 * DAY;
  const mine = s.events.filter((e) => e.by === 'Papa' && e.at >= since);
  const count = (t) => mine.filter((e) => e.type === t).length;
  const c = activeChild(s);
  const lastNight = eventsOf(s, c.id).find((e) => e.by === 'Papa' && (new Date(e.at).getHours() >= 22 || new Date(e.at).getHours() < 6));
  return `
    <section class="section">
      <div class="section-head tone-slate"><h2>${icon('users', 20)} Mes relais cette semaine</h2></div>
      <div class="card stats">
        <div class="stat"><span class="stat-v num">${count('feed')}</span><span class="stat-l">Repas</span></div>
        <div class="stat"><span class="stat-v num">${count('diaper')}</span><span class="stat-l">Couches</span></div>
        <div class="stat"><span class="stat-v num">${count('sleep')}</span><span class="stat-l">Siestes</span></div>
        <div class="stat"><span class="stat-v num">${s.tasks.filter((t) => t.to === 'Papa' && t.done).length}</span><span class="stat-l">Tâches</span></div>
      </div>
      <p class="small faint mt-8">${lastNight ? `Dernier relais de nuit : ${ago(lastNight.at)}.` : 'Astuce : un biberon de nuit sur deux permet à chacun de dormir 5 h d’affilée.'}</p>
    </section>`;
}

function tasksSection(s) {
  const tasks = [...s.tasks].sort((a, b) => a.done - b.done || b.at - a.at).slice(0, 8);
  return `
    <section class="section">
      <div class="section-head"><h2>Tâches partagées</h2>${s.tasks.some((t) => t.done) ? '<button class="link tone-pearl" data-act="clear-tasks">Effacer les terminées</button>' : ''}</div>
      <div class="card" style="padding:4px 16px">
        ${tasks.length ? tasks.map((t) => `
          <button class="check ${t.done ? 'is-done' : ''}" data-task="${t.id}">
            <span class="check-box">${icon('check', 16)}</span>
            <span class="check-text">${esc(t.text)}<small>${esc(t.from)} → ${esc(t.to)} · ${ago(t.at)}</small></span>
          </button>`).join('') : emptyState('share', 'Aucune tâche', 'Partagez une tâche pour vous répartir la charge.')}
      </div>
    </section>`;
}

export function mount(el) {
  el.addEventListener('change', (e) => {
    if (e.target.matches('[data-breast-toggle]')) setBreastfeeding(e.target.checked);
    else if (e.target.matches('[data-pump-toggle]')) store.update((s) => { s.pumpOn = e.target.checked; });
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const who = tab;
    if (b.dataset.seg === 'who') { tab = b.dataset.v; store.refresh(); }
    else if (b.dataset.seg === 'binput') store.update((s) => { s.breastInput = b.dataset.v; });
    else if (b.dataset.mood) {
      const v = +b.dataset.mood;
      store.update((s) => { const k = dayKey(); s.moods[who] ||= {}; s.moods[who][k] = s.moods[who][k] === v ? undefined : v; });
    }
    else if (b.dataset.check) store.update((s) => { const k = `${who}:${b.dataset.check}`; s.checks[k] = !s.checks[k]; });
    else if (b.dataset.task) store.update((s) => { const t = s.tasks.find((x) => x.id === b.dataset.task); t.done = !t.done; });
    else if (b.dataset.use) {
      const item = store.state.stock.find((x) => x.id === b.dataset.use);
      store.update((s) => { s.stock = s.stock.filter((x) => x.id !== item.id); });
      toast(`${item.ml} ml retirés du stock`, { action: 'Annuler', onAction: () => store.update((s) => { s.stock.push(item); }) });
    }
    else if (b.dataset.act === 'pump') openPump();
    else if (b.dataset.act === 'breath') openBreathing();
    else if (b.dataset.act === 'share') openShareTask();
    else if (b.dataset.act === 'clear-tasks') store.update((s) => { s.tasks = s.tasks.filter((t) => !t.done); });
  });
}

/* ---------- Tire-lait ---------- */
function openPump() {
  let side = 'both', place = 'fridge', ml = '';
  openSheet({
    title: 'Nouveau tirage', subtitle: 'Le lait est ajouté à votre stock',
    onMount(body, api) {
      const draw = () => {
        body.innerHTML = `
          <label class="field"><span>Quantité (ml)</span><input class="input num" type="number" inputmode="numeric" min="1" max="500" name="ml" value="${esc(ml)}" placeholder="120"></label>
          <div class="chips tone-salmon" style="margin:-4px 0 18px">${[60, 90, 120, 150].map((v) => `<button class="chip ${+ml === v ? 'is-on' : ''}" data-ml="${v}">${v} ml</button>`).join('')}</div>
          <div class="field"><span>Sein</span>${seg('side', [['L', 'Gauche'], ['R', 'Droit'], ['both', 'Les deux']], side)}</div>
          <div class="field"><span>Destination</span>${seg('place', [['fridge', 'Frigo'], ['freezer', 'Congélateur'], ['now', 'Donné']], place)}</div>
          <p class="small faint">Conservation : 48 h au réfrigérateur (≤ 4 °C), 4 mois au congélateur (-18 °C). Décongelé : 24 h au frigo, sans recongeler.</p>
          <div class="tone-salmon mt-16"><button class="btn btn-primary btn-block btn-lg" data-save>Enregistrer</button></div>`;
        $('[name="ml"]', body).addEventListener('input', (e) => { ml = e.target.value; });
      };
      body.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.ml) { ml = b.dataset.ml; draw(); }
        else if (b.dataset.seg === 'side') { side = b.dataset.v; draw(); }
        else if (b.dataset.seg === 'place') { place = b.dataset.v; draw(); }
        else if (b.hasAttribute('data-save')) {
          const v = parseInt(ml, 10);
          if (!(v > 0)) return toast('Indiquez la quantité');
          const at = Date.now();
          store.update((s) => {
            s.pumps.push({ id: uid(), at, ml: v, side });
            if (place !== 'now') s.stock.push({ id: uid(), at, ml: v, place });
          });
          api.close();
          toast(`${v} ml enregistrés`);
        }
      });
      draw();
    },
  });
}

/* ---------- Cohérence cardiaque ---------- */
function openBreathing() {
  const TOTAL = 180;
  openSheet({
    title: 'Cohérence cardiaque', subtitle: 'Inspirez 5 s · expirez 5 s',
    className: 'tone-slate',
    onMount(body, api) {
      let start = null;
      body.innerHTML = `
        <div class="breath tone-slate" data-breath>
          <span class="breath-ring"></span>
          <span class="breath-circle"></span>
          <span class="breath-label" data-label>Prêt·e ?<small>Installez-vous confortablement</small></span>
        </div>
        <div class="tone-slate"><button class="btn btn-primary btn-block btn-lg" data-go>${icon('play', 18)} Commencer · 3 min</button></div>`;
      const box = $('[data-breath]', body), label = $('[data-label]', body), btn = $('[data-go]', body);
      const step = () => {
        if (!start) return;
        const el = Math.floor((Date.now() - start) / 1000);
        if (el >= TOTAL) {
          start = null; box.classList.remove('is-in');
          label.innerHTML = 'Bravo 🌿<small>Revenez quand vous voulez</small>';
          btn.innerHTML = `${icon('play', 18)} Recommencer`; btn.hidden = false;
          return;
        }
        const inhale = el % 10 < 5;
        box.classList.toggle('is-in', inhale);
        const left = TOTAL - el;
        label.innerHTML = `${inhale ? 'Inspirez' : 'Expirez'}<small>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</small>`;
      };
      btn.addEventListener('click', () => { start = Date.now(); btn.hidden = true; step(); });
      api.onTick(step);
    },
  });
}

/* ---------- Partager une tâche ---------- */
function openShareTask() {
  const s0 = store.state;
  let text = '';
  let to = partnerOf(s0.me);
  openSheet({
    title: 'Partager une tâche', subtitle: 'Une demande douce, sans charge mentale',
    onMount(body, api) {
      const draw = () => {
        body.innerHTML = `
          <div class="chips tone-yellow">${TASK_PRESETS.map((p) => `<button class="chip ${text === p ? 'is-on' : ''}" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>
          <label class="field mt-16"><span>Ou écrivez la vôtre</span><input class="input" name="text" value="${esc(text)}" placeholder="Ex. Appeler la crèche" maxlength="120"></label>
          <div class="field"><span>Pour</span>${seg('to', ['Maman', 'Papa', 'Nounou'].filter((r) => r !== s0.me).map((r) => [r, r]), to)}</div>
          <div class="tone-yellow"><button class="btn btn-primary btn-block btn-lg" data-send>${icon('send', 18)} Envoyer</button></div>
          <p class="small faint mt-12">La tâche est ajoutée à la liste partagée et vous pouvez l’envoyer par SMS, WhatsApp…</p>`;
        $('[name="text"]', body).addEventListener('input', (e) => { text = e.target.value; });
      };
      body.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.p) { text = b.dataset.p; draw(); }
        else if (b.dataset.seg === 'to') { to = b.dataset.v; draw(); }
        else if (b.hasAttribute('data-send')) {
          const t = text.trim();
          if (!t) return toast('Choisissez une tâche');
          store.update((s) => { s.tasks.push({ id: uid(), text: t, from: s.me, to, at: Date.now(), done: false }); });
          api.close();
          const message = `💛 Petit coup de main ? ${t}`;
          try {
            if (navigator.share) await navigator.share({ title: 'AppBébé', text: message });
            else { await navigator.clipboard.writeText(message); toast('Message copié, prêt à être envoyé'); return; }
          } catch { /* partage annulé */ }
          toast(`Tâche partagée avec ${to}`);
        }
      });
      draw();
    },
  });
}
