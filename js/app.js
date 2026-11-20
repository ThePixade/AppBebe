import { store, resolvedTheme, moduleOn } from './store.js';
import { initSync } from './sync.js';
import { $, $$, createScope, closeSheet } from './ui.js';
import { renderOnboarding, mountOnboarding, openProfiles, openChildForm } from './profiles.js';
import { renderModuleSetup, mountModuleSetup, moduleOfRoute, defaultRoute } from './modules.js';
import * as hub from './pages/hub.js';
import * as maison from './pages/maison.js';
import * as budget from './pages/budget.js';
import * as sante from './pages/sante.js';
import * as vacances from './pages/vacances.js';
import * as home from './pages/home.js';
import * as food from './pages/food.js';
import * as parents from './pages/parents.js';
import * as sleep from './pages/sleep.js';
import * as stats from './pages/stats.js';
import * as plan from './pages/plan.js';
import * as agenda from './pages/agenda.js';
import { initMiniPlayer } from './miniplayer.js';
import { PREMIUM } from './edition.js';
import * as dashboard from './premium/dashboard.js';
import * as perso from './premium/customize.js';
import { applyUi } from './premium/ui.js';
import { renderNav, mountNav } from './premium/nav.js';

const routes = { hub, maison, budget, sante, vacances, home, food, parents, sleep, stats, plan, agenda };
// Édition Premium : l'accueil devient le tableau de bord, et la page Apparence existe.
if (PREMIUM) { routes.hub = dashboard; routes.perso = perso; }
const scope = createScope();
let currentRoute = null;

function updateNav(route, on) {
  if (!PREMIUM) return;
  const show = on && document.body.dataset.space === 'general';
  document.body.dataset.nav = show ? 'on' : 'off';
  if (show) $('#nav-pre .nav-pre-inner').innerHTML = renderNav(store.state, route);
}

function applyTheme() {
  if (PREMIUM) applyUi();
  const theme = resolvedTheme(store.state);
  document.documentElement.dataset.theme = theme;
  const night = theme === 'dark' || document.body.dataset.page === 'sleep';
  $('meta[name="theme-color"]').setAttribute('content', document.body.dataset.page === 'sleep' ? '#0E1424' : night ? '#1A2235' : '#F7F5F0');
}

function routeName() {
  const s = store.state;
  const name = location.hash.replace(/^#\/?/, '') || defaultRoute(s);
  if (!routes[name]) return defaultRoute(s);
  const owner = moduleOfRoute(name);
  return owner && !moduleOn(s, owner) ? 'hub' : name;
}

function render() {
  const s = store.state;
  const main = $('#main');
  scope.dispose();

  if (!s.modules) {
    document.body.dataset.page = 'onboarding';
    updateNav('onboarding', false);
    applyTheme();
    main.innerHTML = renderModuleSetup(s);
    mountModuleSetup(main);
    currentRoute = 'onboarding';
    return;
  }
  if (moduleOn(s, 'baby') && !s.children.length) {
    document.body.dataset.page = 'onboarding';
    updateNav('onboarding', false);
    applyTheme();
    main.innerHTML = renderOnboarding(s);
    mountOnboarding(main);
    currentRoute = 'onboarding';
    return;
  }

  const name = routeName();
  const page = routes[name];
  const same = name === currentRoute;
  const scrollY = same ? window.scrollY : 0;

  document.body.dataset.page = name;
  document.body.dataset.space = moduleOfRoute(name) === 'baby' ? 'baby' : 'general';
  applyTheme();

  const el = document.createElement('div');
  el.className = `page page-${name}`;
  if (same) el.style.animation = 'none';
  el.innerHTML = page.render(s);
  main.replaceChildren(el);
  page.mount?.(el, scope);

  window.scrollTo(0, scrollY);
  currentRoute = name;
  updateNav(name, true);
  $$('.tab').forEach((t) => {
    const on = t.dataset.tab === (name === 'stats' || name === 'plan' || name === 'agenda' ? 'home' : name);
    t.classList.toggle('is-active', on);
    on ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current');
  });
}

/* Actions globales (en-tête partagé). */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-global]');
  if (!b) return;
  const act = b.dataset.global;
  if (act === 'theme') {
    const next = resolvedTheme(store.state) === 'dark' ? 'light' : 'dark';
    store.update((s) => { s.theme = next; });
  } else if (act === 'profiles') openProfiles();
  else if (act === 'add-child') openChildForm();
  else if (act === 'settings') openProfiles();
});

initMiniPlayer();
$('#fab').addEventListener('click', () => home.openQuickAdd());

if (PREMIUM) mountNav($('#nav-pre'));
window.addEventListener('hashchange', () => { closeSheet(true); if (PREMIUM) dashboard.stopEditing(); render(); });
store.subscribe(render);
// Le thème « auto » suit l'heure : on vérifie chaque minute.
setInterval(() => { if (store.state.theme === 'auto') applyTheme(); }, 60000);

// Nouveau téléphone : on attend les données du NAS avant d'afficher l'accueil.
if (store.state.modules) { render(); initSync(); }
else initSync().finally(render);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // Mise à jour : quand une nouvelle version prend le relais, on recharge une fois pour l'afficher.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
