import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, uid, time, startOfDay, dayKey, dayLabel, toLocalInput, openSheet, toast, seg, emptyState, DAY } from '../ui.js';
import { appHeader } from '../profiles.js';

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

let month = null;     // 1er jour du mois affiché
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
  return { title: ev.title, tone: KINDS[ev.kind]?.tone || 'slate', text: `${ev.title} · ${rel}${!ev.allDay && s0 >= today && diff <= 1 ? ` à ${time(ev.start)}` : ''}` };
}

/* ---------- Rendu ---------- */
export function render(s) {
  const today = startOfDay();
  if (!month) month = monthStart(today);
  if (!selected) selected = today;
  const evs = s.agenda || [];

  const first = new Date(month);
  const offset = (first.getDay() + 6) % 7; // semaine du lundi
  const gridStart = addDays(month, -offset);
  const inMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((offset + inMonth) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));

  const cell = (d0) => {
    const day = evs.filter((e) => covers(e, d0)).sort(byStart);
    const out = new Date(d0).getMonth() !== first.getMonth();
    return `
      <button class="cal-day ${out ? 'is-out' : ''} ${d0 === today ? 'is-today' : ''} ${d0 === selected ? 'is-sel' : ''}" data-day="${d0}" aria-label="${esc(dayLabel(d0))}${day.length ? `, ${day.length} événement${day.length > 1 ? 's' : ''}` : ''}">
        <span class="cal-n">${new Date(d0).getDate()}</span>
        <span class="cal-dots">${day.slice(0, 3).map((e) => `<i class="tone-${KINDS[e.kind]?.tone || 'slate'}"></i>`).join('')}</span>
      </button>`;
  };

  const dayEvs = evs.filter((e) => covers(e, selected)).sort(byStart);
  const upcoming = evs.filter((e) => startOfDay(e.end ?? e.start) >= today && !covers(e, selected)).sort((a, b) => a.start - b.start).slice(0, 6);
  const mLabel = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return `
    ${appHeader(s)}
    <a class="back-link" href="#/home">${icon('chevronLeft', 16)} Accueil</a>
    <section class="hero"><p class="eyebrow">Agenda commun</p><h1 class="title">Rendez-vous &amp; vacances</h1></section>

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

    ${upcoming.length ? `<section class="section"><div class="section-head"><h2>À venir</h2></div>${upcoming.map(evCard).join('')}</section>` : ''}`;
}

function evCard(e) {
  const k = KINDS[e.kind] || KINDS.other;
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
  const ev = existing ? { ...existing } : { title: '', kind: 'rdv', allDay: false, start: nine, end: null, place: '', note: '' };
  const st = { kind: ev.kind, allDay: !!ev.allDay, start: ev.start, end: ev.end ?? null };

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
      <form class="js-form tone-${KINDS[st.kind].tone}">
        <label class="field"><span>Titre</span><input class="input" name="title" value="${esc(ev.title)}" maxlength="60" placeholder="Ex. Vaccin chez le pédiatre" required></label>
        <div class="field"><span>Type</span>
          <div class="chips mt-8" data-pick="kind">${Object.entries(KINDS).map(([k, v]) => `<button type="button" class="chip tone-${v.tone} ${k === st.kind ? 'is-on' : ''}" data-v="${k}">${v.label}</button>`).join('')}</div>
        </div>
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
      body.querySelectorAll('[data-pick=kind] .chip').forEach((b) => b.addEventListener('click', () => {
        st.kind = b.dataset.v;
        body.querySelectorAll('[data-pick=kind] .chip').forEach((x) => x.classList.toggle('is-on', x === b));
        form.className = `js-form tone-${KINDS[st.kind].tone}`;
        if (isNew) { // les départs / fêtes sont plutôt sur la journée entière
          readDates(); st.allDay = KINDS[st.kind].allDay;
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
        const title = String(f.get('title')).trim() || KINDS[st.kind].label;
        if (st.end !== null && st.end < st.start) { err.textContent = 'La fin ne peut pas être avant le début.'; err.hidden = false; return; }
        const data = { title, kind: st.kind, allDay: st.allDay, start: st.start, end: st.end, place: String(f.get('place')).trim(), note: String(f.get('note')).trim() };
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
  el.addEventListener('click', (e) => {
    const d = e.target.closest('[data-day]');
    if (d) { selected = +d.dataset.day; month = monthStart(selected); store.refresh(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'prev') { const m = new Date(month); m.setMonth(m.getMonth() - 1); month = startOfDay(m); store.refresh(); }
    else if (a === 'next') { const m = new Date(month); m.setMonth(m.getMonth() + 1); month = startOfDay(m); store.refresh(); }
    else if (a === 'today') { selected = startOfDay(); month = monthStart(selected); store.refresh(); }
    else if (a === 'add') openForm(null, selected);
    else if (a === 'open') openForm((store.state.agenda || []).find((x) => x.id === b.dataset.id));
  });
}
