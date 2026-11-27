import { store, activeChild } from '../store.js';
import { icon } from '../icons.js';
import { esc, uid, dayKey, openSheet, toast, seg, emptyState, DAY } from '../ui.js';
import { appHeader } from '../profiles.js';
import { babyTabs } from './babytabs.js';

/*
 * Routine : la journée type de bébé et celle de chaque parent, à cocher au fil de la journée.
 *  - s.routines     : [{ id, who: 'baby' | 'Maman' | 'Papa', time: 'HH:MM', title }]   (partagé)
 *  - s.routineDone  : { 'AAAA-MM-JJ': { <id>: 'qui l'a coché' } }                      (partagé, 14 derniers jours)
 */

let tab = null;

const PRESETS = {
  baby: [['07:00', 'Réveil et câlin'], ['07:30', 'Biberon / tétée du matin'], ['09:30', 'Sieste du matin'], ['11:30', 'Repas de midi'], ['13:00', 'Sieste de l’après-midi'], ['15:30', 'Promenade'], ['16:30', 'Goûter / biberon'], ['18:30', 'Bain'], ['19:00', 'Dernier biberon'], ['19:30', 'Coucher']],
  Maman: [['07:30', 'Petit-déjeuner'], ['09:00', 'Prendre l’air avec bébé'], ['12:30', 'Déjeuner au calme'], ['14:00', 'Sieste ou repos'], ['17:00', 'Préparer le dîner'], ['20:30', 'Temps pour soi']],
  Papa: [['07:00', 'Biberon du matin'], ['08:00', 'Départ / relais'], ['18:30', 'Bain de bébé'], ['19:30', 'Coucher de bébé'], ['20:30', 'Ranger la maison']],
};
const TITLES = { baby: 'Routine de bébé', Maman: 'Routine de Maman', Papa: 'Routine de Papa' };

const itemsOf = (s, who) => (s.routines || []).filter((r) => r.who === who).sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function render(s) {
  tab ||= s.me === 'Papa' ? 'Papa' : s.me === 'Maman' ? 'Maman' : 'baby';
  const c = activeChild(s), items = itemsOf(s, tab), done = (s.routineDone || {})[dayKey()] || {};
  const nDone = items.filter((r) => done[r.id]).length, next = items.find((r) => !done[r.id] && r.time >= nowHM()) || items.find((r) => !done[r.id]);
  return `
    ${appHeader(s)}
    ${babyTabs('routine')}
    <section class="hero"><p class="eyebrow">Organiser sa journée</p><h1 class="title">${tab === 'baby' && c ? `La routine de ${esc(c.name)}` : esc(TITLES[tab])}</h1></section>
    ${seg('rwho', [['baby', 'Bébé'], ['Maman', 'Maman'], ['Papa', 'Papa']], tab, 'seg-lg')}
    ${items.length ? `
    <section class="card mt-16"><div class="row-between"><b>Aujourd’hui</b><span class="badge ${nDone === items.length ? 'tone-sage' : ''}">${nDone}/${items.length}</span></div>
      <div class="progress mt-12" style="height:8px;border-radius:99px;background:var(--seg-track);overflow:hidden"><i style="display:block;height:100%;width:${Math.round(100 * nDone / items.length)}%;background:var(--accent,#E07F62);transition:width .3s"></i></div>
      ${next ? `<p class="small muted mt-12">${icon('clock', 13)} Prochaine étape : <b>${esc(next.time.replace(':', ' h '))}</b> · ${esc(next.title)}</p>` : '<p class="small muted mt-12">Journée terminée, bravo !</p>'}
    </section>
    <section class="section"><div class="card" style="padding:4px 16px">${items.map((r) => `
      <div class="routine-row ${done[r.id] ? 'is-done' : ''} ${next && next.id === r.id ? 'is-next' : ''}">
        <button class="check ${done[r.id] ? 'is-done' : ''}" data-rcheck="${r.id}" aria-pressed="${!!done[r.id]}"><span class="check-box">${icon('check', 16)}</span><span class="check-text"><b class="num">${esc(r.time.replace(':', ' h '))}</b> ${esc(r.title)}${done[r.id] ? `<small>Fait par ${esc(done[r.id])}</small>` : ''}</span></button>
        <button class="icon-btn icon-btn-sm" data-redit="${r.id}" aria-label="Modifier">${icon('edit', 16)}</button>
      </div>`).join('')}</div>
      <button class="past-link" data-act="radd">${icon('plus', 18)} Ajouter une étape</button>
    </section>` : `
    <section class="card mt-16">${emptyState('clock', 'Aucune routine', tab === 'baby' ? 'Posez les grands repères de la journée de bébé : repas, siestes, bain, coucher.' : 'Notez ce qui vous fait du bien dans la journée : repas, repos, temps pour soi.')}
      <button class="btn btn-primary btn-block mt-12" data-act="rpreset">${icon('sparkle', 18)} Proposer une routine type</button>
      <button class="btn btn-ghost btn-block mt-8" data-act="radd">${icon('plus', 18)} Créer ma routine</button>
    </section>`}`;
}

function form(r) {
  const v = r || { time: nowHM().slice(0, 3) + '00', title: '', who: tab };
  openSheet({
    title: r ? 'Modifier l’étape' : 'Nouvelle étape',
    content: `<form class="js-form">
      <label class="field"><span>Heure</span><input class="input" type="time" name="time" value="${esc(v.time)}" required></label>
      <label class="field"><span>Étape</span><input class="input" name="title" value="${esc(v.title)}" maxlength="50" placeholder="Ex. Bain de bébé" required list="rt-sug"></label>
      <datalist id="rt-sug">${PRESETS[v.who].map(([, t]) => `<option value="${esc(t)}">`).join('')}</datalist>
      <div class="actions tone-salmon">${r ? `<button type="button" class="btn btn-danger" data-del>${icon('trash', 18)} Supprimer</button>` : '<span></span>'}<button class="btn btn-primary" type="submit">${r ? 'Enregistrer' : 'Ajouter'}</button></div></form>`,
    onMount(body, api) {
      body.querySelector('[data-del]')?.addEventListener('click', () => {
        const copy = { ...r };
        store.update((s) => { s.routines = (s.routines || []).filter((x) => x.id !== r.id); });
        api.close(); toast('Étape supprimée', { action: 'Annuler', onAction: () => store.update((s) => { (s.routines ||= []).push(copy); }) });
      });
      body.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault(); const f = new FormData(e.target), time = String(f.get('time')), title = String(f.get('title')).trim(); if (!title || !time) return;
        store.update((s) => { s.routines ||= []; if (r) Object.assign(s.routines.find((x) => x.id === r.id) || {}, { time, title }); else s.routines.push({ id: uid(), who: v.who, time, title }); });
        api.close();
      });
    },
  });
}

export function mount(el) {
  el.addEventListener('click', (e) => {
    const sg = e.target.closest('[data-seg="rwho"]'); if (sg) { tab = sg.dataset.v; store.refresh(); return; }
    const ck = e.target.closest('[data-rcheck]');
    if (ck) {
      const id = ck.dataset.rcheck;
      store.update((s) => {
        s.routineDone ||= {}; const k = dayKey(); const day = (s.routineDone[k] ||= {});
        if (day[id]) delete day[id]; else day[id] = s.me;
        for (const d of Object.keys(s.routineDone)) if (d < dayKey(Date.now() - 14 * DAY)) delete s.routineDone[d]; // on ne garde que 14 jours
      });
      return;
    }
    const ed = e.target.closest('[data-redit]'); if (ed) return form(store.state.routines.find((x) => x.id === ed.dataset.redit));
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'radd') form(null);
    else if (a === 'rpreset') store.update((s) => { s.routines ||= []; for (const [time, title] of PRESETS[tab]) s.routines.push({ id: uid(), who: tab, time, title }); });
  });
}
