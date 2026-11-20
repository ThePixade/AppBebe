import { icon } from '../icons.js';
import { esc } from '../ui.js';
import { uiOf } from './ui.js';
import { modInfo, enabledModules, moduleOfRoute } from '../modules.js';
import { openPlus } from './actions.js';

/* Barre de navigation du bas (édition Premium) : Accueil, les modules choisis, et le bouton « + » au milieu. */
export function navItems(s, route) {
  const ui = uiOf(s), on = enabledModules(s).map((m) => m.id);
  const mods = ui.nav.filter((id) => on.includes(id)).slice(0, 4).map((id) => modInfo(s, id));
  const items = [{ label: 'Accueil', icon: 'home', href: '#/hub', active: route === 'hub', tone: 'salmon' },
    ...mods.map((m) => ({ label: m.label, icon: m.icon, href: `#/${m.route}`, active: moduleOfRoute(route) === m.id, tone: m.tone }))];
  if (ui.navPlus) items.splice(Math.ceil(items.length / 2), 0, { plus: true });
  return items;
}

export function renderNav(s, route) {
  return navItems(s, route).map((it) => it.plus
    ? `<button class="npb-plus" data-nav-plus aria-label="Ajouter">${icon('plus', 26)}</button>`
    : `<a class="npb ${it.active ? 'is-active' : ''}" href="${it.href}" style="--tone:var(--${it.tone})" ${it.active ? 'aria-current="page"' : ''}>${icon(it.icon, 22)}<span>${esc(it.label)}</span></a>`).join('');
}
export function mountNav(root) { root.addEventListener('click', (e) => { if (e.target.closest('[data-nav-plus]')) openPlus(); }); }
