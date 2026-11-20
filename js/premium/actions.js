import { store, moduleOn } from '../store.js';
import { icon } from '../icons.js';
import { esc, openSheet, toast } from '../ui.js';
import { addShopping } from '../supplies.js';
import { uiOf } from './ui.js';

/*
 * Actions rapides (raccourcis de l'accueil et bouton « + » de la barre du bas).
 * Une action peut ouvrir directement un formulaire dans un module : on laisse un « message en attente »
 * que la page du module lit à son ouverture (takePending).
 */
const KEY = 'pending-action';

export function go(route, action) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ route, action, t: Date.now() })); } catch { /* ignoré */ }
  if (location.hash === `#/${route}`) store.refresh(); else location.hash = `#/${route}`;
}
export function takePending(route) {
  try {
    const raw = sessionStorage.getItem(KEY); if (!raw) return null;
    const p = JSON.parse(raw);
    if (p.route !== route || Date.now() - p.t > 15000) return null;
    sessionStorage.removeItem(KEY); return p.action;
  } catch { return null; }
}

export function openShopSheet() {
  openSheet({
    title: 'Ajouter aux courses', subtitle: 'Tout le monde voit la liste en direct',
    onMount(body, api) {
      let added = [];
      const draw = () => {
        body.innerHTML = `<form class="add-line"><input class="input" name="text" placeholder="Ex. Lait, couches…" autocomplete="off" enterkeyhint="done" maxlength="80"><button class="btn btn-primary" type="submit" aria-label="Ajouter">${icon('plus', 20)}</button></form>
          ${added.length ? `<div class="chips mt-16 tone-sage">${added.map((t) => `<span class="chip is-on">${icon('check', 14)} ${esc(t)}</span>`).join('')}</div>` : '<p class="small faint mt-12">Ajoutez autant d\'articles que vous voulez.</p>'}
          <button class="btn btn-ghost btn-block mt-16" data-close-sheet>Terminé</button>`;
        body.querySelector('[name=text]').focus();
      };
      body.addEventListener('submit', (e) => {
        e.preventDefault();
        const t = e.target.elements.text.value.trim(); if (!t) return;
        if (addShopping(t)) added.push(t); else toast(`« ${t} » est déjà dans la liste`);
        draw();
      });
      body.addEventListener('click', (e) => { if (e.target.closest('[data-close-sheet]')) api.close(); });
      draw();
    },
  });
}

export const ACTIONS = {
  exp:    { label: 'Nouvelle dépense', icon: 'wallet', tone: 'sage', module: 'finance', run: () => go('budget', 'new-expense') },
  rdv:    { label: 'Nouveau rendez-vous', icon: 'calendar', tone: 'slate', module: 'agenda', run: () => go('agenda', 'add') },
  shop:   { label: 'Ajouter aux courses', icon: 'cart', tone: 'peach', module: 'maison', run: openShopSheet },
  temp:   { label: 'Température', icon: 'thermo', tone: 'brick', module: 'medical', run: () => go('sante', 'temp') },
  med:    { label: 'Nouveau médicament', icon: 'pill', tone: 'salmon', module: 'medical', run: () => go('sante', 'traitement') },
  feed:   { label: 'Repas de bébé', icon: 'bottle', tone: 'salmon', module: 'baby', run: () => go('home', 'feed') },
  diaper: { label: 'Couche', icon: 'diaper', tone: 'peach', module: 'baby', run: () => go('home', 'diaper') },
  sleep:  { label: 'Sieste de bébé', icon: 'moon', tone: 'slate', module: 'baby', run: () => go('home', 'sleep') },
  sound:  { label: 'Sons apaisants', icon: 'music', tone: 'slate', module: 'baby', run: () => { location.hash = '#/sleep'; } },
  memo:   { label: 'Mémo de la famille', icon: 'note', tone: 'gold', run: () => { location.hash = '#/hub'; setTimeout(() => document.querySelector('[data-memo]')?.focus(), 400); } },
};
export const actionsFor = (s) => Object.entries(ACTIONS).filter(([, a]) => !a.module || moduleOn(s, a.module)).map(([id, a]) => ({ id, ...a }));

/** Feuille « + » : les raccourcis choisis d'abord, puis toutes les autres actions. */
export function openPlus() {
  const s = store.state, ui = uiOf(s), all = actionsFor(s);
  const first = ui.shortcuts.map((id) => all.find((a) => a.id === id)).filter(Boolean), rest = all.filter((a) => !first.includes(a));
  openSheet({
    title: 'Ajouter', subtitle: 'Vos raccourcis, puis toutes les actions',
    content: `<div class="menu-grid">${[...first, ...rest].map((a) => `<button class="menu-item tone-${a.tone}" data-k="${a.id}"><span class="ac-icon">${icon(a.icon, 22)}</span>${esc(a.label)}</button>`).join('')}</div>`,
    onMount(body, api) {
      body.addEventListener('click', (e) => {
        const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
        api.close(); setTimeout(() => ACTIONS[k].run(), 280);
      });
    },
  });
}
