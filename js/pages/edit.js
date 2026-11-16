import { store, eventsOf, updateEvent, removeEvent, restoreEvent, feedingOf } from '../store.js';
import { icon } from '../icons.js';
import { esc, fmtDur, time, dayLabel, startOfDay, openSheet, toast, seg, emptyState, toLocalInput, fromLocalInput, $, $$ } from '../ui.js';
import { takeFromFridge, giveBack, takenMl } from '../milk.js';
import { describe, eventRow, STOOL_COLORS, TEXTURES, VACCINES, MEDS } from './home.js';

/*
 * Détail, modification et historique des événements du journal.
 * Tout ce qui a été saisi (biberon, tétée, couche, sommeil, mesure, note, vaccin,
 * médicament, température) peut être corrigé après coup.
 */

const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const min = (ms) => Math.round((ms || 0) / 60000);
const chips = (key, list, cur, tone) => `<div class="chips mt-8 tone-${tone}" data-pick="${key}">${list.map(([v, label, sw]) => `<button type="button" class="chip ${cur === v ? 'is-on' : ''}" data-v="${esc(v)}">${sw ? `<span class="swatch" style="--c:${sw}"></span>` : ''}${esc(label)}</button>`).join('')}</div>`;
const dt = (name, label, value) => `<label class="field"><span>${label}</span><input class="input" type="datetime-local" name="${name}" value="${toLocalInput(value)}" max="${toLocalInput()}"></label>`;
const input = (name, label, value, attrs = '') => `<label class="field"><span>${label}</span><input class="input" name="${name}" value="${esc(value ?? '')}" ${attrs}></label>`;
const numIn = (name, label, value, attrs) => input(name, label, value ?? '', `type="number" inputmode="decimal" class="input num" ${attrs}`);

/* ---------- Détail ---------- */
export function openEvent(id) {
  const e = store.state.events.find((x) => x.id === id);
  if (!e) return;
  const d = describe(e);
  openSheet({
    title: d.title,
    subtitle: `${dayLabel(e.at)} · ${time(e.at)} · ajouté par ${e.by}${e.editedBy ? ` · modifié par ${e.editedBy}` : ''}`,
    content: `
      <div class="row tone-${d.tone}"><span class="ac-icon">${icon(d.icon, 24)}</span><p class="muted">${esc(d.detail) || '—'}</p></div>
      <div class="actions tone-${d.tone === 'pearl' ? 'salmon' : d.tone}">
        <button class="btn btn-danger" data-del>${icon('trash', 18)} Supprimer</button>
        <button class="btn btn-primary" data-edit>${icon('edit', 18)} Modifier</button>
      </div>`,
    onMount(body, api) {
      body.querySelector('[data-edit]').addEventListener('click', () => openEdit(id));
      body.querySelector('[data-del]').addEventListener('click', () => {
        const ev = removeEvent(id);
        if (ev?.taken?.length) giveBack(ev.taken); // le lait retiré du frigo y retourne
        api.close();
        toast('Événement supprimé', { action: 'Annuler', onAction: () => {
          restoreEvent(ev.taken?.length ? { ...ev, taken: takeFromFridge(takenMl(ev.taken)).taken } : ev);
        } });
      });
    },
  });
}

/* ---------- Modification ---------- */
/** Le choix du lait n'est proposé que s'il a un sens pour ce bébé (ou si la saisie existante le contredit). */
function milkChoice(e) {
  const f = feedingOf(store.state, store.state.children.find((c) => c.id === e.childId));
  const milk = e.milk || 'infantile';
  return !f || f === 'mixed' || (f === 'breast' && milk !== 'maternel') || (f === 'formula' && milk === 'maternel');
}
function fields(e) {
  switch (e.type) {
    case 'feed':
      if (e.kind === 'bottle') return `
        ${numIn('ml', 'Quantité (ml)', e.ml, 'min="1" max="500" step="5"')}
        ${milkChoice(e) ? `<div class="field"><span>Lait</span>${seg('milk', [['infantile', 'Lait infantile'], ['maternel', 'Lait maternel']], e.milk || 'infantile')}</div>` : ''}
        ${dt('at', 'Heure du biberon', e.at)}`;
      return `
        ${dt('at', 'Début de la tétée', e.at)}
        <div class="grid-2">
          ${numIn('L', 'Gauche (min)', min(e.L), 'min="0" max="120" step="1"')}
          ${numIn('R', 'Droit (min)', min(e.R), 'min="0" max="120" step="1"')}
        </div>
        <div class="field"><span>Terminée côté</span>${seg('last', [['L', 'Gauche'], ['R', 'Droit']], e.last || 'L')}</div>`;
    case 'diaper': return `
      <div class="field"><span>Type</span>${seg('kind', [['wet', 'Mouillée'], ['dirty', 'Sale'], ['mixed', 'Mixte']], e.kind)}</div>
      <div class="js-stool" ${e.kind === 'wet' ? 'hidden' : ''}>
        <p class="label">Couleur des selles</p>${chips('color', STOOL_COLORS.map((x) => [x.id, x.label, x.c]), e.color, 'peach')}
        <p class="label mt-16">Texture</p>${chips('texture', TEXTURES.map((x) => [x, x]), e.texture, 'peach')}
      </div>
      <div class="mt-16">${dt('at', 'Heure du change', e.at)}</div>`;
    case 'sleep': return `${dt('at', 'Endormissement', e.at)}${dt('end', 'Réveil', e.end)}`;
    case 'growth': return `
      <div class="grid-2">
        ${numIn('weight', 'Poids (kg)', e.weight, 'min="1" max="30" step="0.01"')}
        ${numIn('height', 'Taille (cm)', e.height, 'min="30" max="120" step="0.1"')}
      </div>
      ${numIn('head', 'Périmètre crânien (cm)', e.head, 'min="25" max="60" step="0.1"')}
      ${dt('at', 'Date', e.at)}`;
    case 'note': return `<label class="field"><span>Note</span><textarea class="input" name="text" maxlength="500">${esc(e.text || '')}</textarea></label>${dt('at', 'Quand ?', e.at)}`;
    case 'vaccine': return `
      <p class="label">Vaccin</p>${chips('name', VACCINES.map((v) => [v, v]), e.name, 'sage')}
      <div class="mt-16">${input('text', 'Remarque', e.text, 'placeholder="Lot, réaction éventuelle…"')}</div>${dt('at', 'Date', e.at)}`;
    case 'med': return `
      <div class="chips tone-salmon" data-pick="medName">${MEDS.map((v) => `<button type="button" class="chip ${e.name === v ? 'is-on' : ''}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>
      <div class="mt-16">${input('name', 'Nom', e.name)}</div>${input('dose', 'Dose', e.dose)}${dt('at', 'Quand ?', e.at)}`;
    case 'temp': return `${numIn('value', 'Température (°C)', e.value, 'min="34" max="43" step="0.1"')}${dt('at', 'Quand ?', e.at)}`;
    default: return dt('at', 'Quand ?', e.at);
  }
}

export function openEdit(id) {
  const e = store.state.events.find((x) => x.id === id);
  if (!e) return;
  const d = describe(e);
  const v = { milk: e.milk || 'infantile', last: e.last || 'L', kind: e.kind, color: e.color || null, texture: e.texture || null, name: e.name || null };
  const tone = d.tone === 'pearl' ? 'salmon' : d.tone;
  openSheet({
    title: `Modifier · ${d.title}`, subtitle: `Ajouté par ${e.by}`,
    content: `<form class="js-edit" novalidate>${fields(e)}<div class="tone-${tone}"><button class="btn btn-primary btn-block btn-lg mt-16" type="submit">${icon('check', 20)} Enregistrer</button></div></form>`,
    onMount(body, api) {
      const form = $('.js-edit', body);
      const F = (n) => form.elements.namedItem(n);
      form.addEventListener('click', (ev) => {
        const sg = ev.target.closest('[data-seg]');
        if (sg) {
          ev.preventDefault();
          v[sg.dataset.seg] = sg.dataset.v;
          $$('button', sg.parentElement).forEach((x) => { x.classList.toggle('is-on', x === sg); x.setAttribute('aria-selected', x === sg); });
          if (sg.dataset.seg === 'kind') $('.js-stool', form).hidden = sg.dataset.v === 'wet';
          return;
        }
        const chip = ev.target.closest('[data-pick] .chip');
        if (!chip) return;
        const key = chip.parentElement.dataset.pick;
        if (key === 'medName') { F('name').value = chip.dataset.v; }
        else v[key] = v[key] === chip.dataset.v && key !== 'name' ? null : chip.dataset.v; // couleur / texture : retouche = désélection
        $$('.chip', chip.parentElement).forEach((x) => x.classList.toggle('is-on', x === chip && (key === 'name' || key === 'medName' || v[key] === x.dataset.v)));
      });
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const at = F('at') ? fromLocalInput(F('at').value) : e.at;
        if (!at || Number.isNaN(at)) return toast('Date invalide');
        if (at > Date.now() + 60e3) return toast('La date ne peut pas être dans le futur');
        let patch = { at };
        switch (e.type) {
          case 'feed':
            if (e.kind === 'bottle') {
              const ml = num(F('ml').value);
              if (!(ml > 0 && ml <= 500)) return toast('Quantité invalide');
              patch = { ...patch, ml: Math.round(ml), milk: v.milk };
              // Bouteille déjà prélevée sur le stock : on rend l'ancien prélèvement puis on prélève le nouveau.
              if (e.taken?.length) {
                giveBack(e.taken);
                patch.taken = v.milk === 'maternel' ? takeFromFridge(patch.ml).taken : [];
              }
            } else {
              const L = Math.max(0, num(F('L').value) || 0) * 60e3, R = Math.max(0, num(F('R').value) || 0) * 60e3;
              if (!L && !R) return toast('Indiquez la durée d’au moins un côté');
              patch = { ...patch, L, R, end: at + L + R, last: !L ? 'R' : !R ? 'L' : v.last };
            }
            break;
          case 'diaper':
            patch = { ...patch, kind: v.kind, ...(v.kind === 'wet' ? { color: null, texture: null } : { color: v.color, texture: v.texture }) };
            break;
          case 'sleep': {
            const end = fromLocalInput(F('end').value);
            if (!(end > at)) return toast('Le réveil doit suivre l’endormissement');
            patch = { ...patch, end };
            break;
          }
          case 'growth': {
            const weight = num(F('weight').value), height = num(F('height').value), head = num(F('head').value);
            if (!weight && !height) return toast('Indiquez au moins le poids ou la taille');
            patch = { ...patch, weight, height, head };
            break;
          }
          case 'note':
            if (!F('text').value.trim()) return toast('Écrivez une note');
            patch = { ...patch, text: F('text').value.trim() };
            break;
          case 'vaccine': patch = { ...patch, name: v.name, text: F('text').value.trim() }; break;
          case 'med':
            if (!F('name').value.trim()) return toast('Indiquez le médicament');
            patch = { ...patch, name: F('name').value.trim(), dose: F('dose').value.trim() };
            break;
          case 'temp': {
            const value = num(F('value').value);
            if (!(value > 30 && value < 45)) return toast('Température invalide');
            patch = { ...patch, value };
            break;
          }
        }
        const before = { ...e };
        updateEvent(id, { ...patch, editedBy: store.state.me });
        api.close();
        toast('Modification enregistrée', { action: 'Annuler', onAction: () => {
          let prev = before;
          if (patch.taken !== undefined && before.taken?.length) { giveBack(patch.taken); prev = { ...before, taken: takeFromFridge(takenMl(before.taken)).taken }; }
          store.update((s) => { const i = s.events.findIndex((x) => x.id === id); if (i >= 0) s.events[i] = prev; });
        } });
      });
    },
  });
}

/* ---------- Historique (jours précédents) ---------- */
export function openHistory(child) {
  let day = startOfDay(Date.now() - 864e5);
  openSheet({
    title: 'Historique', subtitle: child.name,
    onMount(body) {
      const draw = () => {
        const end = day + 864e5;
        const list = eventsOf(store.state, child.id).filter((e) => e.at >= day && e.at < end);
        const today = startOfDay();
        const feeds = list.filter((e) => e.type === 'feed');
        const ml = feeds.reduce((a, e) => a + (e.ml || 0), 0);
        const sleepMs = eventsOf(store.state, child.id).filter((e) => e.type === 'sleep' && e.end > day && e.at < end).reduce((a, e) => a + Math.min(e.end, end) - Math.max(e.at, day), 0);
        body.innerHTML = `
          <div class="day-nav">
            <button class="icon-btn" data-day="-1" aria-label="Jour précédent">${icon('chevronLeft', 20)}</button>
            <b>${esc(day === today ? "Aujourd'hui" : dayLabel(day))}</b>
            <button class="icon-btn" data-day="1" aria-label="Jour suivant" ${day >= today ? 'disabled' : ''}>${icon('chevronRight', 20)}</button>
          </div>
          <p class="small muted mt-8" style="text-align:center">${feeds.length} repas${ml ? ` · ${ml} ml` : ''} · ${list.filter((e) => e.type === 'diaper').length} couches · ${fmtDur(sleepMs).replace('< 1 min', '0 min')} de sommeil</p>
          <div class="card timeline mt-12">${list.length ? list.map(eventRow).join('') : emptyState('clock', 'Rien ce jour-là')}</div>
          <p class="small faint mt-12" style="text-align:center">Touchez un événement pour le modifier ou le supprimer.</p>`;
      };
      body.addEventListener('click', (e) => {
        const nav = e.target.closest('[data-day]');
        if (nav) { const next = startOfDay(day + +nav.dataset.day * 864e5 + 3 * 3600e3); if (next <= startOfDay()) { day = next; draw(); } return; }
        const ev = e.target.closest('[data-act="event"]');
        if (ev) openEvent(ev.dataset.id);
      });
      draw();
    },
  });
}
