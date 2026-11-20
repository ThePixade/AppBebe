import { store, partnerOf } from '../store.js';
import { icon } from '../icons.js';
import { esc, uid, startOfDay, dayKey, openSheet, toast, seg, emptyState, DAY, $ } from '../ui.js';
import { openForm } from '../forms.js';
import { agendaCardHtml } from './agenda.js';
import { hubHeader } from './hub.js';
import { addShopping } from '../supplies.js';

/*
 * Module Maison : courses (liste partagée, la même que « Courses » du module Bébé),
 * tâches ménagères (récurrentes, avec rotation entre parents) et menus de la semaine.
 */

let tab = 'shop';
let openList = null; // id de la liste ouverte (onglet Listes)
let weekOffset = 0;
let focusAdd = false;

const PEOPLE = ['Maman', 'Papa', 'Nounou'];
const EVERY = [[0, 'Une fois'], [1, 'Chaque jour'], [3, 'Tous les 3 jours'], [7, 'Chaque semaine'], [14, 'Toutes les 2 semaines'], [30, 'Chaque mois']];
const CHORE_PRESETS = [['Passer l\'aspirateur', 7], ['Sortir les poubelles', 3], ['Nettoyer la salle de bain', 7], ['Lancer une machine', 3], ['Faire la vaisselle', 1], ['Changer les draps', 14]];
const MEALS = [['lunch', 'Midi'], ['dinner', 'Soir']];

const shopOf = (s) => s.lists.find((l) => l.kind === 'shop');
const everyLabel = (n) => EVERY.find(([v]) => v === n)?.[1] || `Tous les ${n} jours`;

/* ---------- Résumé pour le hub ---------- */
export function maisonSummary(s) {
  const late = (s.chores || []).filter((c) => choreState(c).delta < 0).length;
  const toBuy = (shopOf(s)?.items || []).filter((i) => !i.done).length;
  const parts = [];
  if (late) parts.push(`${late} tâche${late > 1 ? 's' : ''} en retard`);
  if (toBuy) parts.push(`${toBuy} à acheter`);
  return parts.join(' · ') || 'Courses, tâches et menus';
}

/* ---------- Rendu ---------- */
export function render(s) {
  return `
    ${hubHeader(s, { back: true })}
    <section class="hero"><p class="eyebrow">Maison</p><h1 class="title">Courses, tâches &amp; menus</h1></section>
    ${seg('mtab', [['shop', 'Courses'], ['lists', 'Listes'], ['chores', 'Tâches'], ['menus', 'Menus']], tab)}
    <div class="mt-16">${tab === 'shop' ? shopView(s) : tab === 'lists' ? listsView(s) : tab === 'chores' ? choresView(s) : menusView(s)}</div>
    ${agendaCardHtml(s, 'maison', { title: "Dans l'agenda" })}`;
}

/* ----- Courses ----- */
function shopView(s) {
  const l = shopOf(s);
  const items = l?.items || [];
  const done = items.filter((i) => i.done).length, n = items.length;
  const row = (i) => `
    <div class="li-row ${i.done ? 'is-done' : ''}">
      <button class="check ${i.done ? 'is-done' : ''}" data-act="toggle" data-id="${i.id}" aria-pressed="${!!i.done}">
        <span class="check-box">${icon('check', 16)}</span>
        <span class="check-text">${esc(i.text)}${i.qty ? ` <span class="qty-tag">× ${esc(i.qty)}</span>` : ''}${i.done && i.doneBy ? `<small>Coché par ${esc(i.doneBy)}</small>` : i.by ? `<small>Ajouté par ${esc(i.by)}</small>` : ''}</span>
      </button>
      <button class="icon-btn icon-btn-sm" data-act="del-item" data-id="${i.id}" aria-label="Retirer ${esc(i.text)}">${icon('x', 16)}</button>
    </div>`;
  const sorted = [...items].sort((a, b) => !!a.done - !!b.done);
  return `
    ${n ? `<div class="progress"><span style="width:${Math.round((done / n) * 100)}%"></span></div><p class="small faint mt-8">${done} / ${n} dans le panier</p>` : ''}
    <form class="add-line mt-16" data-form="shop">
      <input class="input" name="text" placeholder="Ajouter un article…" autocomplete="off" enterkeyhint="done" maxlength="80">
      <button class="btn btn-primary" type="submit" aria-label="Ajouter">${icon('plus', 20)}</button>
    </form>
    <div class="mt-16">${n ? `<div class="card list-group">${sorted.map(row).join('')}</div>` : `<div class="card">${emptyState('cart', 'Liste vide', 'Tapez un article ci-dessus. Tout le monde voit la liste en direct.')}</div>`}</div>
    ${done ? `<div class="grid-2 mt-16">
      <button class="btn btn-ghost btn-sm" data-act="uncheck">Tout décocher</button>
      <button class="btn btn-ghost btn-sm" data-act="clear-done">${icon('trash', 16)} Vider les cochés</button></div>` : ''}`;
}

/* ----- Listes (à cocher ou non) ----- */
const hlist = (s, id = openList) => (s.homeLists || []).find((l) => l.id === id);

function listsView(s) {
  const l = openList && hlist(s);
  if (openList && !l) openList = null;
  return l ? listDetail(l) : listsOverview(s);
}

function listsOverview(s) {
  const lists = s.homeLists || [];
  const card = (l) => {
    const n = l.items.length, done = l.items.filter((i) => i.done).length;
    return `
    <article class="card chore tone-${l.check ? 'sage' : 'slate'}" data-id="${l.id}">
      <button class="chore-main" data-act="open-hlist" data-id="${l.id}">
        <b>${esc(l.name)}</b>
        <small>${l.check ? `À cocher · ${n ? `${done}/${n}` : 'vide'}` : `Liste simple · ${n} élément${n > 1 ? 's' : ''}`}</small>
      </button>${icon('chevronRight', 16)}
    </article>`;
  };
  return `
    <p class="small muted">Idées de cadeaux, bricolage, films à voir, check-list de départ… Chaque liste peut être « à cocher » (avec cases) ou simple (sans cases).</p>
    <div class="stack mt-12" style="gap:10px">${lists.length ? lists.map(card).join('') : `<div class="card">${emptyState('list', 'Aucune liste', 'Créez votre première liste.')}</div>`}</div>
    <button class="btn btn-primary btn-block mt-16" data-act="new-hlist">${icon('plus', 18)} Nouvelle liste</button>`;
}

function listDetail(l) {
  const n = l.items.length, done = l.items.filter((i) => i.done).length;
  const row = (i) => l.check
    ? `<div class="li-row ${i.done ? 'is-done' : ''}">
        <button class="check ${i.done ? 'is-done' : ''}" data-act="h-toggle" data-id="${i.id}" aria-pressed="${!!i.done}"><span class="check-box">${icon('check', 16)}</span><span class="check-text">${esc(i.text)}${i.done && i.doneBy ? `<small>Coché par ${esc(i.doneBy)}</small>` : i.by ? `<small>Ajouté par ${esc(i.by)}</small>` : ''}</span></button>
        <button class="icon-btn icon-btn-sm" data-act="h-del" data-id="${i.id}" aria-label="Retirer ${esc(i.text)}">${icon('x', 16)}</button></div>`
    : `<div class="li-row"><span class="plain-item"><span class="bullet"></span><span class="check-text">${esc(i.text)}${i.by ? `<small>Ajouté par ${esc(i.by)}</small>` : ''}</span></span>
        <button class="icon-btn icon-btn-sm" data-act="h-del" data-id="${i.id}" aria-label="Retirer ${esc(i.text)}">${icon('x', 16)}</button></div>`;
  const items = l.check ? [...l.items].sort((a, b) => !!a.done - !!b.done) : l.items;
  return `
    <button class="back-link" data-act="close-hlist">${icon('chevronLeft', 16)} Listes</button>
    <div class="row-between mt-8"><div><h2 class="title" style="font-size:1.4rem">${esc(l.name)}</h2><p class="small faint">${l.check ? `À cocher · ${n ? `${done} / ${n}` : 'vide'}` : `Liste simple · ${n} élément${n > 1 ? 's' : ''}`}</p></div>
      <button class="icon-btn" data-act="hlist-menu" aria-label="Options de la liste">${icon('settings', 20)}</button></div>
    ${l.check && n ? `<div class="progress mt-8"><span style="width:${Math.round((done / n) * 100)}%"></span></div>` : ''}
    <form class="add-line mt-16" data-form="hitem"><input class="input" name="text" placeholder="Ajouter un élément…" autocomplete="off" enterkeyhint="done" maxlength="80"><button class="btn btn-primary" type="submit" aria-label="Ajouter">${icon('plus', 20)}</button></form>
    <div class="mt-16">${n ? `<div class="card list-group">${items.map(row).join('')}</div>` : `<div class="card">${emptyState('list', 'Liste vide', 'Tapez un élément ci-dessus.')}</div>`}</div>
    ${l.check && done ? `<div class="grid-2 mt-16"><button class="btn btn-ghost btn-sm" data-act="h-uncheck">Tout décocher</button><button class="btn btn-ghost btn-sm" data-act="h-clear">${icon('trash', 16)} Vider les cochés</button></div>` : ''}`;
}

function hlistForm(l = null) {
  openForm({
    title: l ? 'Options de la liste' : 'Nouvelle liste',
    fields: [
      { name: 'name', label: 'Nom de la liste', value: l?.name || '', placeholder: 'Ex. Idées cadeaux, Bricolage…', required: true, maxlength: 50 },
      { name: 'check', label: 'À cocher', hint: 'Avec des cases à cocher. Désactivé : simple liste, sans cases.', type: 'check', value: l ? l.check : true },
    ],
    submit: l ? 'Enregistrer' : 'Créer',
    onDelete: l && ((api) => {
      const copy = JSON.parse(JSON.stringify(l));
      store.update((s) => { s.homeLists = s.homeLists.filter((x) => x.id !== l.id); });
      openList = null; api.close();
      toast('Liste supprimée', { action: 'Annuler', onAction: () => store.update((s) => { s.homeLists.push(copy); }) });
    }),
    onSubmit(f, api) {
      let newId = null;
      if (!l) { newId = uid(); openList = newId; } // ouvre la nouvelle liste directement
      store.update((s) => {
        s.homeLists = s.homeLists || [];
        if (l) Object.assign(s.homeLists.find((x) => x.id === l.id) || {}, { name: f.name, check: f.check });
        else s.homeLists.push({ id: newId, name: f.name, check: f.check, created: Date.now(), items: [] });
      });
      api.close();
    },
  });
}

/* ----- Tâches ----- */
export function assignee(c) { return c.who === 'tour' ? c.turn : c.who || ''; }

export function choreState(c, now = Date.now()) {
  if (c.every === 0) return { delta: 0, label: 'À faire', tone: 'salmon' };
  const due = startOfDay((c.last ?? c.created) + (c.last ? c.every * DAY : 0));
  const delta = Math.round((due - startOfDay(now)) / DAY);
  if (delta < 0) return { delta, label: `En retard de ${-delta} j`, tone: 'brick' };
  if (delta === 0) return { delta, label: "Aujourd'hui", tone: 'salmon' };
  if (delta === 1) return { delta, label: 'Demain', tone: 'slate' };
  return { delta, label: `Dans ${delta} jours`, tone: 'sage' };
}

function choresView(s) {
  const list = [...(s.chores || [])].map((c) => ({ c, st: choreState(c) })).sort((a, b) => a.st.delta - b.st.delta);
  const row = ({ c, st }) => {
    const who = assignee(c);
    return `
    <article class="card chore tone-${st.tone}" data-id="${c.id}">
      <button class="chore-main" data-act="edit-chore" data-id="${c.id}">
        <b>${esc(c.name)}</b>
        <small><span class="chore-due">${st.label}</span> · ${everyLabel(c.every)}${who ? ` · ${esc(who)}` : ''}${c.lastBy ? ` · fait par ${esc(c.lastBy)} ${c.last ? new Date(c.last).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}` : ''}</small>
      </button>
      <button class="btn btn-sm btn-primary" data-act="done-chore" data-id="${c.id}">${icon('check', 16)} Fait</button>
    </article>`;
  };
  return `
    ${list.length ? `<div class="stack" style="gap:10px">${list.map(row).join('')}</div>` : `<div class="card">${emptyState('home', 'Aucune tâche', 'Ajoutez les tâches de la maison : l\'app vous dit ce qui est à faire et à qui c\'est le tour.')}</div>`}
    <button class="btn btn-ghost btn-block mt-16" data-act="new-chore">${icon('plus', 18)} Ajouter une tâche</button>`;
}

function choreForm(c = null) {
  const v = c || { name: '', every: 7, who: '' };
  openSheet({
    title: c ? 'Modifier la tâche' : 'Nouvelle tâche',
    content: `
      <form class="js-form">
        ${c ? '' : `<div class="chips" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">${CHORE_PRESETS.map(([n, e]) => `<button type="button" class="pill-btn" data-preset="${esc(n)}" data-every="${e}">${esc(n)}</button>`).join('')}</div>`}
        <label class="field"><span>Tâche</span><input class="input" name="name" value="${esc(v.name)}" maxlength="60" placeholder="Ex. Passer l'aspirateur" required></label>
        <label class="field"><span>Fréquence</span><select class="input" name="every">${EVERY.map(([n, l]) => `<option value="${n}" ${n === v.every ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Qui s'en occupe</span><select class="input" name="who">
          <option value="" ${!v.who ? 'selected' : ''}>Tout le monde</option>
          <option value="tour" ${v.who === 'tour' ? 'selected' : ''}>À tour de rôle (Maman / Papa)</option>
          ${PEOPLE.map((p) => `<option ${v.who === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select></label>
        <div class="actions tone-salmon">${c ? `<button type="button" class="btn btn-danger" data-del>${icon('trash', 18)} Supprimer</button>` : '<span></span>'}<button class="btn btn-primary" type="submit">${c ? 'Enregistrer' : 'Ajouter'}</button></div>
      </form>`,
    onMount(body, api) {
      body.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
        body.querySelector('[name=name]').value = b.dataset.preset;
        body.querySelector('[name=every]').value = b.dataset.every;
      }));
      body.querySelector('[data-del]')?.addEventListener('click', () => {
        const copy = { ...c };
        store.update((s) => { s.chores = s.chores.filter((x) => x.id !== c.id); });
        api.close();
        toast('Tâche supprimée', { action: 'Annuler', onAction: () => store.update((s) => { s.chores.push(copy); }) });
      });
      body.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target), name = String(f.get('name')).trim();
        if (!name) return;
        const patch = { name, every: Number(f.get('every')), who: String(f.get('who')) };
        store.update((s) => {
          if (c) { const x = s.chores.find((y) => y.id === c.id); if (x) { Object.assign(x, patch); if (patch.who === 'tour' && !x.turn) x.turn = s.me === 'Papa' ? 'Papa' : 'Maman'; } }
          else s.chores.push({ id: uid(), created: Date.now(), last: null, ...patch, ...(patch.who === 'tour' ? { turn: s.me === 'Papa' ? 'Papa' : 'Maman' } : {}) });
        });
        api.close();
      });
    },
  });
}

export function doneChore(id) {
  const before = store.state.chores.find((c) => c.id === id);
  if (!before) return;
  const copy = { ...before };
  if (before.every === 0) {
    store.update((s) => { s.chores = s.chores.filter((c) => c.id !== id); });
    toast(`« ${copy.name} » terminée`, { action: 'Annuler', onAction: () => store.update((s) => { s.chores.push(copy); }) });
    return;
  }
  store.update((s) => {
    const c = s.chores.find((x) => x.id === id);
    c.last = Date.now(); c.lastBy = s.me;
    if (c.who === 'tour') c.turn = partnerOf(c.turn || s.me);
  });
  toast(`« ${copy.name} » faite`, { action: 'Annuler', onAction: () => store.update((s) => { const i = s.chores.findIndex((x) => x.id === id); if (i >= 0) s.chores[i] = copy; }) });
}

/* ----- Menus ----- */
const mondayOf = (ts) => { const d = new Date(ts); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return startOfDay(d); };
const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return startOfDay(d); };

function menusView(s) {
  const start = addDays(mondayOf(Date.now()), weekOffset * 7);
  const today = dayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const label = `${new Date(start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${new Date(days[6]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  return `
    <div class="row-between">
      <button class="icon-btn icon-btn-sm" data-act="week-prev" aria-label="Semaine précédente">${icon('chevronLeft', 18)}</button>
      <b>${weekOffset === 0 ? 'Cette semaine' : label}</b>
      <button class="icon-btn icon-btn-sm" data-act="week-next" aria-label="Semaine suivante">${icon('chevronRight', 18)}</button>
    </div>
    ${weekOffset !== 0 ? `<p class="small faint" style="text-align:center">${label}</p>` : ''}
    <div class="stack mt-16" style="gap:10px">
      ${days.map((d) => {
        const k = dayKey(d), m = (s.menus || {})[k] || {};
        const name = new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });
        return `
        <article class="card menu-day ${k === today ? 'is-today' : ''}">
          <p class="cat-title" style="padding-top:0">${esc(name)}${k === today ? ' · aujourd\'hui' : ''}</p>
          ${MEALS.map(([key, lbl]) => `
            <button class="menu-meal" data-act="edit-menu" data-day="${k}" data-meal="${key}">
              <span class="menu-lbl">${lbl}</span>
              <span class="menu-txt ${m[key] ? '' : 'is-empty'}">${m[key] ? esc(m[key]) : 'Ajouter un repas'}</span>
            </button>`).join('')}
        </article>`;
      }).join('')}
    </div>`;
}

function menuForm(day, meal) {
  const cur = (store.state.menus || {})[day] || {};
  const date = new Date(day + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  openSheet({
    title: 'Menu', subtitle: date.charAt(0).toUpperCase() + date.slice(1),
    content: `
      <form class="js-form">
        ${MEALS.map(([k, l]) => `<label class="field"><span>${l}</span><input class="input" name="${k}" value="${esc(cur[k] || '')}" maxlength="80" placeholder="${k === 'lunch' ? 'Ex. Pâtes au pesto' : 'Ex. Gratin de courgettes'}" ${k === meal ? 'data-focus' : ''}></label>`).join('')}
        <div class="field"><span>Ingrédients à acheter <small class="faint">(séparés par des virgules)</small></span>
          <div class="add-line"><input class="input" name="ing" placeholder="Ex. pesto, parmesan" autocomplete="off"><button type="button" class="btn btn-ghost" data-add-ing style="width:auto;padding:0 14px">${icon('cart', 18)}</button></div>
        </div>
        <div class="actions tone-salmon"><button type="button" class="btn btn-danger" data-clear>${icon('trash', 18)} Vider</button><button class="btn btn-primary" type="submit">Enregistrer</button></div>
      </form>`,
    onMount(body, api) {
      body.querySelector('[data-focus]')?.focus();
      const ing = body.querySelector('[name=ing]');
      const addIng = () => {
        const parts = ing.value.split(',').map((t) => t.trim()).filter(Boolean);
        if (!parts.length) return;
        const added = parts.filter((t) => addShopping(t)).length;
        ing.value = '';
        toast(added ? `${added} article${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''} aux courses` : 'Déjà dans les courses');
      };
      body.querySelector('[data-add-ing]').addEventListener('click', addIng);
      ing.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addIng(); } });
      body.querySelector('[data-clear]').addEventListener('click', () => {
        store.update((s) => { if (s.menus) delete s.menus[day]; });
        api.close();
      });
      body.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const m = { lunch: String(f.get('lunch')).trim(), dinner: String(f.get('dinner')).trim() };
        if (ing.value.trim()) addIng();
        store.update((s) => {
          s.menus = s.menus || {};
          if (!m.lunch && !m.dinner) delete s.menus[day]; else s.menus[day] = { ...(m.lunch ? { lunch: m.lunch } : {}), ...(m.dinner ? { dinner: m.dinner } : {}) };
        });
        api.close();
      });
    },
  });
}

/* ---------- Interactions ---------- */
export function mount(el) {
  if (focusAdd) { focusAdd = false; $('[name=text]', el)?.focus(); }

  el.addEventListener('submit', (e) => {
    const h = e.target.closest('[data-form="hitem"]');
    if (h) {
      e.preventDefault();
      const text = h.elements.text.value.trim();
      if (!text) return;
      focusAdd = true;
      store.update((s) => { hlist(s)?.items.push({ id: uid(), text, ...(hlist(s)?.check ? { done: false } : {}), by: s.me }); });
      return;
    }
    const f = e.target.closest('[data-form="shop"]');
    if (!f) return;
    e.preventDefault();
    const text = f.elements.text.value.trim();
    if (!text) return;
    focusAdd = true;
    if (!addShopping(text)) { toast(`« ${text} » est déjà dans la liste`); store.refresh(); }
  });

  el.addEventListener('click', (e) => {
    const sg = e.target.closest('[data-seg="mtab"]');
    if (sg) { tab = sg.dataset.v; openList = null; store.refresh(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id || b.closest('[data-id]')?.dataset.id;
    const upd = (fn) => store.update((s) => { const l = shopOf(s); if (l) fn(l, s); });
    switch (b.dataset.act) {
      case 'toggle': upd((l, s) => { const x = l.items.find((i) => i.id === id); if (x) { x.done = !x.done; if (x.done) x.doneBy = s.me; else delete x.doneBy; } }); break;
      case 'del-item': {
        const it = shopOf(store.state)?.items.find((i) => i.id === id);
        upd((l) => { l.items = l.items.filter((i) => i.id !== id); });
        if (it) toast('Article retiré', { action: 'Annuler', onAction: () => upd((l) => { l.items.push(it); }) });
        break;
      }
      case 'uncheck': upd((l) => l.items.forEach((i) => { i.done = false; delete i.doneBy; })); break;
      case 'clear-done': {
        const removed = shopOf(store.state).items.filter((i) => i.done);
        upd((l) => { l.items = l.items.filter((i) => !i.done); });
        toast(`${removed.length} article${removed.length > 1 ? 's' : ''} retiré${removed.length > 1 ? 's' : ''}`, { action: 'Annuler', onAction: () => upd((l) => { l.items.push(...removed); }) });
        break;
      }
      case 'new-hlist': hlistForm(); break;
      case 'open-hlist': openList = id; window.scrollTo(0, 0); store.refresh(); break;
      case 'close-hlist': openList = null; store.refresh(); break;
      case 'hlist-menu': hlistForm(hlist(store.state)); break;
      case 'h-toggle': store.update((s) => { const x = hlist(s)?.items.find((i) => i.id === id); if (x) { x.done = !x.done; if (x.done) x.doneBy = s.me; else delete x.doneBy; } }); break;
      case 'h-del': {
        const it = hlist(store.state)?.items.find((i) => i.id === id), lid = openList;
        store.update((s) => { const l = hlist(s); if (l) l.items = l.items.filter((i) => i.id !== id); });
        if (it) toast('Élément retiré', { action: 'Annuler', onAction: () => store.update((s) => { hlist(s, lid)?.items.push(it); }) });
        break;
      }
      case 'h-uncheck': store.update((s) => hlist(s)?.items.forEach((i) => { i.done = false; delete i.doneBy; })); break;
      case 'h-clear': {
        const lid = openList, removed = hlist(store.state).items.filter((i) => i.done);
        store.update((s) => { const l = hlist(s); if (l) l.items = l.items.filter((i) => !i.done); });
        toast(`${removed.length} élément${removed.length > 1 ? 's' : ''} retiré${removed.length > 1 ? 's' : ''}`, { action: 'Annuler', onAction: () => store.update((s) => { hlist(s, lid)?.items.push(...removed); }) });
        break;
      }
      case 'new-chore': choreForm(); break;
      case 'edit-chore': choreForm(store.state.chores.find((c) => c.id === id)); break;
      case 'done-chore': doneChore(id); break;
      case 'week-prev': weekOffset--; store.refresh(); break;
      case 'week-next': weekOffset++; store.refresh(); break;
      case 'edit-menu': menuForm(b.dataset.day, b.dataset.meal); break;
    }
  });
}
