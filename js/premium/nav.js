import { icon } from '../icons.js';
import { esc } from '../ui.js';
import { store, activeChild } from '../store.js';
import { uiOf } from './ui.js';
import { modInfo, enabledModules, moduleOfRoute } from '../modules.js';
import { openPlus } from './actions.js';
import { openQuickAdd } from '../pages/home.js';

/*
 * Barre de navigation du bas : LA MÊME PARTOUT (Accueil, les modules, le bouton « + »), dans toutes les éditions.
 * Les sections d'un module (ex. Journée / Repas / Parents / Sommeil de Bébé) sont des onglets en haut de la page.
 * Le « + » s'adapte à l'endroit : dans Bébé, l'ajout rapide de bébé ; ailleurs, les raccourcis de la famille.
 */

/** Modules de la barre : ceux choisis (Premium) ou, par défaut, les 3 premiers modules activés. */
export function navIdsOf(s) {
  const on = enabledModules(s).map((m) => m.id), ui = uiOf(s);
  const ids = Array.isArray(ui.nav) ? ui.nav.filter((id) => on.includes(id)) : on.slice(0, 3);
  return ids.slice(0, 4);
}

export function navItems(s, route) {
  const ui = uiOf(s), baby = moduleOfRoute(route) === 'baby';
  const items = [{ label: 'Accueil', icon: 'home', href: '#/hub', active: route === 'hub', tone: 'salmon' },
    ...navIdsOf(s).map((id) => modInfo(s, id)).map((m) => ({ label: m.label, icon: m.icon, href: `#/${m.route}`, active: moduleOfRoute(route) === m.id, tone: m.tone }))];
  if (ui.navPlus || baby) items.splice(Math.ceil(items.length / 2), 0, { plus: true });
  return items;
}

export function renderNav(s, route) {
  return navItems(s, route).map((it) => it.plus
    ? `<button class="npb-plus" data-nav-plus aria-label="Ajouter">${icon('plus', 26)}</button>`
    : `<a class="npb ${it.active ? 'is-active' : ''}" href="${it.href}" style="--tone:var(--${it.tone})" ${it.active ? 'aria-current="page"' : ''}>${icon(it.icon, 22)}<span>${esc(it.label)}</span></a>`).join('');
}

export function mountNav(root) {
  root.addEventListener('click', (e) => {
    if (!e.target.closest('[data-nav-plus]')) return;
    const route = location.hash.replace(/^#\/?/, '');
    if (moduleOfRoute(route) === 'baby' && activeChild(store.state)) openQuickAdd(); else openPlus();
  });
}
