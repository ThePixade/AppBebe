import { store, resolvedTheme } from './store.js';
import { $, $$, createScope, closeSheet } from './ui.js';
import { renderOnboarding, mountOnboarding, openProfiles, openChildForm } from './profiles.js';
import * as home from './pages/home.js';
import * as food from './pages/food.js';
import * as parents from './pages/parents.js';
import * as sleep from './pages/sleep.js';

const routes = { home, food, parents, sleep };
const scope = createScope();
let currentRoute = null;

function applyTheme() {
  const theme = resolvedTheme(store.state);
  document.documentElement.dataset.theme = theme;
  const night = theme === 'dark' || document.body.dataset.page === 'sleep';
  $('meta[name="theme-color"]').setAttribute('content', document.body.dataset.page === 'sleep' ? '#0E1424' : night ? '#1A2235' : '#F7F5F0');
}

function routeName() {
  const name = location.hash.replace(/^#\/?/, '') || 'home';
  return routes[name] ? name : 'home';
}

function render() {
  const s = store.state;
  const main = $('#main');
  scope.dispose();

  if (!s.children.length) {
    document.body.dataset.page = 'onboarding';
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
  applyTheme();

  const el = document.createElement('div');
  el.className = `page page-${name}`;
  if (same) el.style.animation = 'none';
  el.innerHTML = page.render(s);
  main.replaceChildren(el);
  page.mount?.(el, scope);

  window.scrollTo(0, scrollY);
  currentRoute = name;
  $$('.tab').forEach((t) => {
    const on = t.dataset.tab === name;
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
});

$('#fab').addEventListener('click', () => home.openQuickAdd());

window.addEventListener('hashchange', () => { closeSheet(true); render(); });
store.subscribe(render);
// Le thème « auto » suit l'heure : on vérifie chaque minute.
setInterval(() => { if (store.state.theme === 'auto') applyTheme(); }, 60000);

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
