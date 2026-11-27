import { store, moduleOn } from '../store.js';
import { icon } from '../icons.js';
import { esc, uid, time, startOfDay, dayKey, dayLabel, toLocalInput, openSheet, toast, seg, emptyState, DAY } from '../ui.js';
import { hubHeader } from './hub.js';
import { takePending } from '../premium/actions.js';
import { choreDates, assignee, showTab as maisonTab } from './maison.js';

/*
 * Agenda commun : rendez-vous, départs en vacances, fêtes de famille…
 * Partagé entre les parents via le NAS (comme le reste des données).
 * Un événement « toute la journée » a start = début du premier jour et end = début du dernier jour.
 */

export const KINDS = {
  rdv: { label: 'Rendez-vous', tone: 'salmon', allDay: false },
  trip: { label: 'Vacances / départ', tone: 'sage', allDay: true },
  family: { label: 'Famille / fête', tone: 'peach', allDay: true },
  other: { label: 'Autre', tone: 'slate', allDay: false },
};

/*
 * Catégorie d'un événement = le module auquel il se rattache (Santé, Vacances, Bébé…), pour retrouver
 * ses rendez-vous par module. `kind` (rdv / trip / family / other) est gardé pour la compatibilité.
 */
export const CATS = {
  sante: { label: 'Santé', tone: 'brick', icon: 'stetho', kind: 'rdv', allDay: false, module: 'medical' },
  vacances: { label: 'Vacances', tone: 'gold', icon: 'plane', kind: 'trip', allDay: true, module: 'vacation' },
  bebe: { label: 'Bébé', tone: 'salmon', icon: 'baby', kind: 'rdv', allDay: false, module: 'baby' },
  maison: { label: 'Maison', tone: 'peach', icon: 'home', kind: 'other', allDay: false, module: 'maison' },
  budget: { label: 'Budget', tone: 'sage', icon: 'wallet', kind: 'other', allDay: false, module: 'finance' },
  famille: { label: 'Famille & fêtes', tone: 'slate', icon: 'users', kind: 'family', allDay: true },
  autre: { label: 'Autre', tone: 'pearl', icon: 'calendar', kind: 'other', allDay: false },
};

/** Couleurs au choix pour un événement ou une tâche (sinon : la couleur de sa catégorie). */
export const COLORS = ['salmon', 'peach', 'gold', 'yellow', 'sage', 'mint', 'ocean', 'slate', 'lavender', 'rose', 'brick'];
export const colorLabel = { salmon: 'Corail', peach: 'Pêche', gold: 'Or', yellow: 'Jaune', sage: 'Vert sauge', mint: 'Menthe', ocean: 'Bleu', slate: 'Ardoise', lavender: 'Lavande', rose: 'Rose', brick: 'Rouge' };
export const toneOfEvent = (e, s) => (e.color && COLORS.includes(e.color) ? e.color : CATS[catOfEvent(e, s)].tone);
/** Pastilles de choix de couleur ; `data-color=""` = couleur automatique. */
export const colorPicker = (value, autoTone) => `<div class="color-pick" data-pick="color"><button type="button" class="swatch-btn tone-${autoTone} ${!value ? 'is-on' : ''}" data-color="" aria-label="Automatique" title="Automatique"><span>A</span></button>${COLORS.map((c) => `<button type="button" class="swatch-btn tone-${c} ${value === c ? 'is-on' : ''}" data-color="${c}" aria-label="${colorLabel[c]}" title="${colorLabel[c]}"></button>`).join('')}</div>`;

/** Catégorie d'un événement ; déduite pour les anciens événements (créés avant les catégories). */
export function catOfEvent(e, s = store.state) {
  if (e.cat && CATS[e.cat]) return e.cat;
  if (e.kind === 'trip' || (s.trips || []).some((t) => t.agendaId === e.id)) return 'vacances';
  if ((s.health || []).some((h) => h.agendaId === e.id)) return 'sante';
  if (e.kind === 'family') return 'famille';
  const t = String(e.title || '').toLowerCase();
  if (/vaccin|p[ée]diatre|m[ée]decin|dentiste|docteur|\bdr\b|h[ôo]pital|kin[ée]|prise de sang|analyse|ophtalmo|dermato|gyn[ée]co|sage-femme|pharmacie|radio|infirmi/.test(t)) return 'sante';
  if (/cr[èe]che|nounou|assistante maternelle|garderie/.test(t)) return 'bebe';
  return 'autre';
}
/** Catégories proposées : celles des modules activés, plus Famille et Autre. */
export const enabledCats = (s) => Object.entries(CATS).filter(([, c]) => !c.module || moduleOn(s, c.module)).map(([k]) => k);

const isUpcoming = (e) => startOfDay(e.end ?? e.start) >= startOfDay() && (e.allDay || (e.end ?? e.start) >= Date.now());
export function upcomingOf(s, cat, { exclude = [] } = {}) {
  return (s.agenda || []).filter((e) => catOfEvent(e, s) === cat && isUpcoming(e) && !exclude.includes(e.id)).sort((a, b) => a.start - b.start);
}
const relDay = (ts) => { const d = Math.round((startOfDay(ts) - startOfDay()) / DAY); return d === 0 ? "aujourd'hui" : d === 1 ? 'demain' : d < 0 ? 'en cours' : d < 7 ? `dans ${d} jours` : new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };

/** Carte « rendez-vous de ce module » à afficher dans Santé, Vacances, Bébé, Maison… (vide s'il n'y en a pas). */
export function agendaCardHtml(s, cat, { title = "Dans l'agenda", exclude = [], limit = 4 } = {}) {
  if (!moduleOn(s, 'agenda')) return '';
  const evs = upcomingOf(s, cat, { exclude });
  if (!evs.length) return '';
  const c = CATS[cat];
  return `<div class="card list-group mt-12"><p class="cat-title">${esc(title)}<small>${evs.length}</small></p>
    ${evs.slice(0, limit).map((e) => `<a class="entry" href="#/agenda" data-agenda-cat="${cat}" data-agenda-day="${startOfDay(e.start)}"><span class="dot-ic" style="--tone:var(--${c.tone})">${icon(c.icon, 18)}</span>
      <span class="entry-body"><b>${esc(e.title)}</b><small>${esc(relDay(e.start))}${e.allDay ? '' : ` · ${time(e.start)}`}${e.place ? ` · ${esc(e.place)}` : ''}</small></span></a>`).join('')}
    ${evs.length > limit ? `<a class="small" style="padding:8px 0;display:block" href="#/agenda" data-agenda-cat="${cat}">Voir les ${evs.length} dans l'agenda</a>` : ''}</div>`;
}

let month = null;     // 1er jour du mois affiché
let catFilter = 'all'; // catégorie affichée dans l'agenda
let selected = null;  // jour sélectionné (début de journée)

const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return startOfDay(d); };
const monthStart = (ts) => { const d = new Date(ts); d.setDate(1); return startOfDay(d); };
const covers = (ev, d0) => d0 >= startOfDay(ev.start) && d0 <= startOfDay(ev.end ?? ev.start);
const fmtDay = (ts, o = { day: 'numeric', month: 'short' }) => new Date(ts).toLocaleDateString('fr-FR', o);
const byStart = (a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || a.start - b.start;

function when(ev) {
  const s0 = startOfDay(ev.start), e0 = startOfDay(ev.end ?? ev.start);
  if (ev.allDay) return s0 === e0 ? 'Toute la journée' : `Du ${fmtDay(s0)} au ${fmtDay(e0)}`;
  if (s0 === e0) return ev.end ? `${time(ev.start)} – ${time(ev.end)}` : time(ev.start);
  return `Du ${fmtDay(s0)} ${time(ev.start)} au ${fmtDay(e0)} ${time(ev.end)}`;
}

/** Texte de la carte d'accueil : prochain événement. */
export function nextEventLine(s) {
  const today = startOfDay();
  const ev = (s.agenda || []).filter((e) => startOfDay(e.end ?? e.start) >= today && (e.allDay || (e.end ?? e.start) >= Date.now()))
    .sort((a, b) => Math.max(a.start, today) - Math.max(b.start, today) || byStart(a, b))[0];
  if (!ev) return null;
  const s0 = startOfDay(ev.start);
  const diff = Math.round((s0 - today) / DAY);
  const rel = s0 <= today ? (startOfDay(ev.end ?? ev.start) > today && s0 < today ? 'en cours' : 'aujourd\'hui') : diff === 1 ? 'demain' : diff < 7 ? `dans ${diff} jours` : fmtDay(s0);
  return { title: ev.title, tone: CATS[catOfEvent(ev, s)].tone, text: `${ev.title} · ${rel}${!ev.allDay && s0 >= today && diff <= 1 ? ` à ${time(ev.start)}` : ''}` };
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-agenda-cat]'); if (!a) return;
  catFilter = a.dataset.agendaCat;
  if (a.dataset.agendaDay) { selected = +a.dataset.agendaDay; month = monthStart(selected); }
});

/* ---------- Rendu ---------- */
export function render(s) {
  const today = startOfDay();
  if (!month) month = monthStart(today);
  if (!selected) selected = today;
  const first = new Date(month);
  const offset = (first.getDay() + 6) % 7; // semaine du lundi
  const gridStart = addDays(month, -offset);
  const inMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((offset + inMonth) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const evs = [...(s.agenda || []), ...choreEvents(s, cells[0], cells[cells.length - 1])].filter((e) => catFilter === 'all' || catOfEvent(e, s) === catFilter);

  const cell = (d0) => {
    const day = evs.filter((e) => covers(e, d0)).sort(byStart);
    const out = new Date(d0).getMonth() !== first.getMonth();
    return `
      <button class="cal-day ${out ? 'is-out' : ''} ${d0 === today ? 'is-today' : ''} ${d0 === selected ? 'is-sel' : ''}" data-day="${d0}" aria-label="${esc(dayLabel(d0))}${day.length ? `, ${day.length} événement${day.length > 1 ? 's' : ''}` : ''}">
        <span class="cal-n">${new Date(d0).getDate()}</span>
        <span class="cal-dots">${day.slice(0, 3).map((e) => `<i class="tone-${toneOfEvent(e, s)}"></i>`).join('')}</span>
      </button>`;
  };

  const dayEvs = evs.filter((e) => covers(e, selected)).sort(byStart);
  const upcoming = evs.filter((e) => !e.chore && startOfDay(e.end ?? e.start) >= today && !covers(e, selected)).sort((a, b) => a.start - b.start).slice(0, 6);
  const mLabel = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const cats = enabledCats(s);
  if (catFilter !== 'all' && !cats.includes(catFilter)) catFilter = 'all';
  const perModule = cats.map((k) => ({ k, list: upcomingOf(s, k) })).filter((x) => x.list.length);

  return `
    ${hubHeader(s, { back: true })}
    <section class="hero"><p class="eyebrow">Agenda commun</p><h1 class="title">Rendez-vous &amp; vacances</h1></section>
    <div class="chips-row" style="margin:-4px 0 14px">${[['all', 'Tout'], ...cats.map((k) => [k, CATS[k].label])].map(([k, l]) => `<button class="pill-btn ${catFilter === k ? 'is-on' : ''}" data-act="cat" data-v="${k}">${esc(l)}</button>`).join('')}</div>

    <section class="card cal">
      <div class="row-between cal-nav">
        <button class="icon-btn icon-btn-sm" data-act="prev" aria-label="Mois précédent">${icon('chevronLeft', 18)}</button>
        <b class="cal-title">${esc(mLabel.charAt(0).toUpperCase() + mLabel.slice(1))}</b>
        <button class="icon-btn icon-btn-sm" data-act="next" aria-label="Mois suivant">${icon('chevronRight', 18)}</button>
      </div>
      <div class="cal-grid cal-head" aria-hidden="true">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l) => `<span>${l}</span>`).join('')}</div>
      <div class="cal-grid">${cells.map(cell).join('')}</div>
      <button class="past-link" data-act="today">${icon('calendar', 18)} Aujourd'hui</button>
    </section>

    <section class="section">
      <div class="section-head"><h2>${esc(dayLabel(selected))}</h2><button class="pill-btn" data-act="add">${icon('plus', 16)} Ajouter</button></div>
      ${dayEvs.length ? dayEvs.map(evCard).join('') : `<div class="card">${emptyState('calendar', 'Rien de prévu ce jour', 'Ajoutez un rendez-vous ou un départ en vacances.')}</div>`}
    </section>

    ${catFilter === 'all' && perModule.length ? `
    <section class="card list-group section"><p class="cat-title">Par module</p>
      ${perModule.map(({ k, list }) => `<button class="entry" data-act="cat" data-v="${k}"><span class="dot-ic" style="--tone:var(--${CATS[k].tone})">${icon(CATS[k].icon, 18)}</span>
        <span class="entry-body"><b>${esc(CATS[k].label)} · ${list.length} à venir</b><small>${esc(list[0].title)} · ${esc(relDay(list[0].start))}</small></span>${icon('chevronRight', 16)}</button>`).join('')}
    </section>` : ''}

    ${upcoming.length ? `<section class="section"><div class="section-head"><h2>À venir${catFilter !== 'all' ? ` · ${esc(CATS[catFilter].label)}` : ''}</h2></div>${upcoming.map(evCard).join('')}</section>` : ''}`;
}

/** Tâches de la maison (récurrentes) vues comme des événements « toute la journée » : partagées avec tous, non modifiables ici. */
function choreEvents(s, from, to) {
  if (!moduleOn(s, 'maison')) return [];
  return (s.chores || []).flatMap((c) => choreDates(c, from, to).map((d) => ({ id: `chore:${c.id}:${d}`, chore: true, choreId: c.id, title: c.name, start: d, end: d, allDay: true, cat: 'maison', color: c.color || '', who: assignee(c) })));
}

function evCard(e) {
  if (e.chore) return `<button class="card ev-card tone-${e.color || 'peach'}" data-act="chore" data-id="${e.choreId}"><span class="ev-bar"></span><span class="ev-body"><b>${esc(e.title)}</b><small>Tâche de la maison${e.who ? ` · ${esc(e.who)}` : ''}${startOfDay() > e.start ? ' · en retard' : ''}</small></span>${icon('chevronRight', 16)}</button>`;
  const c = CATS[catOfEvent(e)], k = { tone: toneOfEvent(e), label: c.label };
  const multi = startOfDay(e.start) !== startOfDay(e.end ?? e.start);
  return `
    <button class="card ev-card tone-${k.tone}" data-act="open" data-id="${e.id}">
      <span class="ev-bar"></span>
      <span class="ev-body">
        <b>${esc(e.title)}</b>
        <small>${esc(k.label)} · ${when(e)}${!multi && e.allDay === false ? '' : ''}</small>
        ${e.place ? `<small>${icon('calendar', 12)} ${esc(e.place)}</small>` : ''}
        ${e.note ? `<small class="ev-note">${esc(e.note)}</small>` : ''}
        <small class="faint">Ajouté par ${esc(e.by || '—')}${e.editedBy ? ` · modifié par ${esc(e.editedBy)}` : ''}</small>
      </span>
      ${icon('edit', 16)}
    </button>`;
}

/* ---------- Formulaire ---------- */
function openForm(existing, day) {
  const isNew = !existing;
  const base = new Date(day || selected || startOfDay());
  const nine = base.getTime() + 9 * 3600e3;
  const cats0 = enabledCats(store.state);
  const ev = existing ? { ...existing } : { title: '', allDay: false, start: nine, end: null, place: '', note: '' };
  const startCat = existing ? catOfEvent(existing) : (catFilter !== 'all' ? catFilter : 'autre');
  const st = { color: ev.color || '', cat: startCat, allDay: existing ? !!ev.allDay : CATS[startCat].allDay, start: ev.start, end: ev.end ?? null };
  const catList = existing && !cats0.includes(startCat) ? [...cats0, startCat] : cats0;

  const dateFields = () => st.allDay
    ? `<div class="grid-2">
        <label class="field"><span>Du</span><input class="input" type="date" name="start" value="${dayKey(st.start)}" required></label>
        <label class="field"><span>Au (optionnel)</span><input class="input" type="date" name="end" value="${st.end ? dayKey(st.end) : ''}"></label>
      </div>`
    : `<label class="field"><span>Début</span><input class="input" type="datetime-local" name="start" value="${toLocalInput(st.start)}" required></label>
       <label class="field"><span>Fin (optionnel)</span><input class="input" type="datetime-local" name="end" value="${st.end ? toLocalInput(st.end) : ''}"></label>`;

  openSheet({
    title: isNew ? 'Nouvel événement' : 'Modifier l\'événement',
    subtitle: isNew ? '' : `Ajouté par ${ev.by || '—'}`,
    content: `
      <form class="js-form tone-${CATS[st.cat].tone}">
        <label class="field"><span>Titre</span><input class="input" name="title" value="${esc(ev.title)}" maxlength="60" placeholder="Ex. Vaccin chez le pédiatre" required></label>
        <div class="field"><span>Catégorie <small class="faint">(pour le retrouver dans le module)</small></span>
          <div class="chips mt-8" data-pick="cat">${catList.map((k) => `<button type="button" class="chip tone-${CATS[k].tone} ${k === st.cat ? 'is-on' : ''}" data-v="${k}">${esc(CATS[k].label)}</button>`).join('')}</div>
        </div>
        <div class="field"><span>Couleur dans le calendrier</span>${colorPicker(st.color, CATS[st.cat].tone)}</div>
        <div class="field"><span>Durée</span>${seg('allday', [['0', 'Heure précise'], ['1', 'Toute la journée']], st.allDay ? '1' : '0')}</div>
        <div class="js-dates">${dateFields()}</div>
        <label class="field"><span>Lieu (optionnel)</span><input class="input" name="place" value="${esc(ev.place || '')}" maxlength="60"></label>
        <label class="field"><span>Note (optionnel)</span><textarea class="input" name="note" maxlength="300" rows="2">${esc(ev.note || '')}</textarea></label>
        <p class="small" role="alert" data-err style="color:var(--brick)" hidden></p>
        <div class="actions tone-salmon">
          ${isNew ? '<button type="button" class="btn btn-ghost" data-close>Annuler</button>' : `<button type="button" class="btn btn-danger" data-del>${icon('trash', 18)} Supprimer</button>`}
          <button class="btn btn-primary" type="submit">${isNew ? 'Ajouter' : 'Enregistrer'}</button>
        </div>
      </form>`,
    onMount(body, api) {
      const form = body.querySelector('form');
      const dates = body.querySelector('.js-dates');
      const err = body.querySelector('[data-err]');
      const readDates = () => {
        const v = (n) => form.elements[n]?.value;
        if (st.allDay) {
          if (v('start')) st.start = new Date(v('start') + 'T00:00').getTime();
          st.end = v('end') ? new Date(v('end') + 'T00:00').getTime() : null;
        } else {
          if (v('start')) st.start = new Date(v('start')).getTime();
          st.end = v('end') ? new Date(v('end')).getTime() : null;
        }
      };
      body.querySelector('[data-close]')?.addEventListener('click', () => api.close());
      body.querySelectorAll('[data-pick=color] .swatch-btn').forEach((b) => b.addEventListener('click', () => {
        st.color = b.dataset.color;
        body.querySelectorAll('[data-pick=color] .swatch-btn').forEach((x) => x.classList.toggle('is-on', x === b));
      }));
      body.querySelectorAll('[data-pick=cat] .chip').forEach((b) => b.addEventListener('click', () => {
        st.cat = b.dataset.v;
        body.querySelectorAll('[data-pick=cat] .chip').forEach((x) => x.classList.toggle('is-on', x === b));
        form.className = `js-form tone-${CATS[st.cat].tone}`;
        body.querySelector('[data-color=""]').className = `swatch-btn tone-${CATS[st.cat].tone} ${st.color ? '' : 'is-on'}`;
        if (isNew) { // les départs / fêtes sont plutôt sur la journée entière
          readDates(); st.allDay = CATS[st.cat].allDay;
          if (st.allDay) { st.start = startOfDay(st.start); st.end = st.end ? startOfDay(st.end) : null; }
          body.querySelectorAll('[data-seg=allday]').forEach((x) => { const on = (x.dataset.v === '1') === st.allDay; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on); });
          dates.innerHTML = dateFields();
        }
      }));
      body.querySelectorAll('[data-seg=allday]').forEach((b) => b.addEventListener('click', () => {
        readDates();
        st.allDay = b.dataset.v === '1';
        if (st.allDay) { st.start = startOfDay(st.start); st.end = st.end ? startOfDay(st.end) : null; }
        else if (startOfDay(st.start) === st.start) st.start += 9 * 3600e3;
        body.querySelectorAll('[data-seg=allday]').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on); });
        dates.innerHTML = dateFields();
      }));
      body.querySelector('[data-del]')?.addEventListener('click', () => {
        const copy = JSON.parse(JSON.stringify(existing));
        store.update((s) => { s.agenda = s.agenda.filter((x) => x.id !== existing.id); });
        api.close();
        toast('Événement supprimé', { action: 'Annuler', onAction: () => store.update((s) => { s.agenda.push(copy); }) });
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        readDates();
        const f = new FormData(form);
        const title = String(f.get('title')).trim() || CATS[st.cat].label;
        if (st.end !== null && st.end < st.start) { err.textContent = 'La fin ne peut pas être avant le début.'; err.hidden = false; return; }
        const data = { title, color: st.color, cat: st.cat, kind: CATS[st.cat].kind, allDay: st.allDay, start: st.start, end: st.end, place: String(f.get('place')).trim(), note: String(f.get('note')).trim() };
        store.update((s) => {
          if (isNew) s.agenda.push({ id: uid(), by: s.me, created: Date.now(), ...data });
          else { const x = s.agenda.find((y) => y.id === existing.id); if (x) Object.assign(x, data, { editedBy: s.me }); }
        });
        selected = startOfDay(st.start);
        month = monthStart(st.start);
        api.close();
        store.refresh();
      });
    },
  });
}

/* ---------- Interactions ---------- */
export function mount(el) {
  if (takePending('agenda') === 'add') setTimeout(() => openForm(null, selected), 60);
  el.addEventListener('click', (e) => {
    const d = e.target.closest('[data-day]');
    if (d) { selected = +d.dataset.day; month = monthStart(selected); store.refresh(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'prev') { const m = new Date(month); m.setMonth(m.getMonth() - 1); month = startOfDay(m); store.refresh(); }
    else if (a === 'next') { const m = new Date(month); m.setMonth(m.getMonth() + 1); month = startOfDay(m); store.refresh(); }
    else if (a === 'today') { selected = startOfDay(); month = monthStart(selected); store.refresh(); }
    else if (a === 'cat') { catFilter = b.dataset.v; store.refresh(); }
    else if (a === 'chore') { maisonTab('chores'); location.hash = '#/maison'; }
    else if (a === 'add') openForm(null, selected);
    else if (a === 'open') openForm((store.state.agenda || []).find((x) => x.id === b.dataset.id));
  });
}
