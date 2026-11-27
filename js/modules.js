import { store, moduleOn } from './store.js';
import { icon } from './icons.js';
import { esc, openSheet } from './ui.js';
import { PREMIUM } from './edition.js';

/*
 * Registre des modules de l'application.
 * Pour en ajouter un : une entrée ici (+ une page dans js/pages/ et sa route dans app.js).
 *  - ready : false → affiché « Bientôt » dans le choix des modules, non activable.
 *  - route : page d'entrée du module (#/route) ; routes : toutes les pages qui lui appartiennent.
 */
export const MODULES = [
  { id: 'baby',      label: 'Bébé',               desc: 'Repas, couches, sommeil, croissance, diversification, espace parents', icon: 'baby',     tone: 'salmon', ready: true,  route: 'home', routes: ['home', 'food', 'parents', 'sleep', 'routine', 'stats', 'plan'] },
  { id: 'agenda',    label: 'Agenda',             desc: 'Rendez-vous, fêtes et départs partagés en famille',                    icon: 'calendar', tone: 'slate',  ready: true,  route: 'agenda', routes: ['agenda'] },
  { id: 'finance',   label: 'Budget',             desc: 'Dépenses, budget du mois, qui doit quoi',                              icon: 'wallet',   tone: 'sage',   ready: true,  route: 'budget', routes: ['budget'] },
  { id: 'medical',   label: 'Santé',              desc: 'Carnet de santé de chacun, vaccins, ordonnances, rendez-vous médicaux', icon: 'stetho',   tone: 'brick',  ready: true,  route: 'sante', routes: ['sante'] },
  { id: 'vacation',  label: 'Vacances',           desc: 'Préparer un voyage : itinéraire, valises, budget',                     icon: 'plane',    tone: 'gold',   ready: true,  route: 'vacances', routes: ['vacances'] },
  { id: 'maison',    label: 'Maison',             desc: 'Courses, tâches ménagères, menus de la semaine',                       icon: 'home',     tone: 'peach',  ready: true,  route: 'maison', routes: ['maison'] },
];

export const moduleById = (id) => MODULES.find((m) => m.id === id);
/** Module avec ses personnalisations (nom, icône, couleur) : édition Premium. */
export function modInfo(s, id) {
  const m = moduleById(id); if (!m) return null;
  const o = PREMIUM ? s.ui?.mods?.[id] : null;
  return o ? { ...m, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v)) } : m;
}
export const enabledModules = (s) => MODULES.filter((m) => m.ready && moduleOn(s, m.id));

/** Module propriétaire d'une page, ou null (hub, pages communes). */
export function moduleOfRoute(route) {
  return MODULES.find((m) => m.routes?.includes(route))?.id || null;
}

/** Page d'ouverture : directement Bébé si c'est le seul module, sinon le hub. */
export function defaultRoute(s) {
  if (PREMIUM) return 'hub';
  const on = enabledModules(s);
  return on.length === 1 ? on[0].route : 'hub';
}

/* ---------- Choix des modules : propre à chaque appareil, avec la config de la famille comme point de départ ---------- */
const ROLES = ['Maman', 'Papa', 'Nounou'];
export function hintOf(s = store.state) {
  try { const h = JSON.parse(s.modulesHint); return h && h.modules ? h : null; } catch { return null; }
}
/** Enregistre mon choix ET le propose à la famille : les autres appareils déjà configurés ne changent pas. */
export function publishModules(modules) {
  store.update((s) => { s.modules = modules; s.modulesHint = JSON.stringify({ by: s.meChosen ? s.me : '', at: Date.now(), modules }); });
}
/** Appareil sans choix : on reprend la dernière configuration de la famille (sinon, écran de choix). */
export function adoptHint() {
  const s = store.state; if (s.modules) return false;
  const h = hintOf(s); if (!h) return false;
  store.update((x) => { x.modules = { ...h.modules }; x.modulesNotice = { by: h.by || '', ids: Object.keys(h.modules).filter((k) => h.modules[k]) }; });
  return true;
}
/** Appareil déjà configuré avant cette version : il publie sa configuration une seule fois. */
export function ensureHint() {
  const s = store.state;
  if (s.modules && !hintOf(s)) store.update((x) => { x.modulesHint = JSON.stringify({ by: x.meChosen ? x.me : '', at: Date.now(), modules: x.modules }); });
}

let noticeOpen = false;
/** Alerte d'arrivée : qui êtes-vous, modules repris, adapter ou garder. Une seule fois par appareil. */
export function openArrivalNotice() {
  const s = store.state, n = s.modulesNotice; if (!n || noticeOpen) return;
  noticeOpen = true;
  store.update((x) => { x.modulesNotice = null; }, { silent: true });
  const names = (n.ids || []).map((id) => modInfo(s, id)?.label).filter(Boolean);
  openSheet({
    title: 'Bienvenue !', subtitle: 'Cet appareil est relié aux données de la famille.',
    onMount(body, api) {
      const draw = () => {
        const me = store.state.me;
        body.innerHTML = `
          <p class="label">Qui êtes-vous ?</p>
          <div class="seg" role="tablist">${ROLES.map((r) => `<button class="${r === me && store.state.meChosen ? 'is-on' : ''}" data-role="${r}">${r}</button>`).join('')}</div>
          <div class="notice tone-sage mt-16">${icon('check', 18)}<span class="grow" style="flex:1"><b>Modules repris${n.by ? ` de ${esc(n.by)}` : ' de la famille'}</b> : ${names.length ? esc(names.join(', ')) : 'aucun'}.</span></div>
          <p class="small muted mt-12">Vous pouvez les adapter à vos besoins : <b>cela ne change rien sur l'écran des autres</b>. Chacun voit les modules qu'il veut, les données restent communes.</p>
          <div class="stack mt-16"><button class="btn btn-primary btn-block" data-adapt>Adapter mes modules</button><button class="btn btn-ghost btn-block" data-keep>Garder ces modules</button></div>`;
      };
      body.addEventListener('click', (e) => {
        const r = e.target.closest('[data-role]');
        if (r) { store.update((x) => { x.me = r.dataset.role; x.meChosen = true; }, { silent: true }); draw(); return; }
        if (e.target.closest('[data-keep]')) { noticeOpen = false; api.close(); }
        else if (e.target.closest('[data-adapt]')) { noticeOpen = false; api.close(); setTimeout(() => document.querySelector('[data-global=settings]')?.click(), 320); }
      });
      draw();
    },
  });
}

/** Liste des modules avec interrupteurs (choix initial et réglages). */
export function modulePickerHtml(s, selected = s.modules || {}) {
  return `
  <div class="module-list" data-modules>
    ${MODULES.map((m0) => { const m = modInfo(s, m0.id); return `
      <label class="module-row tone-${m.tone} ${m.ready ? '' : 'is-soon'}">
        <span class="dot-ic" style="--tone:var(--${m.tone})">${icon(m.icon, 20)}</span>
        <span class="module-text"><b>${esc(m.label)}${m.ready ? '' : ' <span class="badge">Bientôt</span>'}</b><small>${esc(m.desc)}</small></span>
        <span class="switch"><input type="checkbox" data-module="${m.id}" ${selected[m.id] ? 'checked' : ''} ${m.ready ? '' : 'disabled'}><span class="track"></span></span>
      </label>`; }).join('')}
  </div>`;
}

/** Lit les interrupteurs d'un sélecteur de modules. */
export function readPicker(root) {
  const out = {};
  root.querySelectorAll('[data-module]').forEach((i) => { if (i.checked) out[i.dataset.module] = true; });
  return out;
}

/* ---------- Choix des modules au premier démarrage ---------- */
export function renderModuleSetup(s) {
  return `
  <section class="onboarding page" data-setup="1">
    <div class="ob-logo">${icon('grid', 34)}</div>
    <p class="eyebrow">Bienvenue</p>
    <h1 class="title">Que voulez-vous<br>gérer en famille ?</h1>
    <p class="subtitle">Activez ce dont vous avez besoin. Vous pourrez changer d'avis à tout moment dans les réglages.</p>
    <div class="card mt-24 module-card">${modulePickerHtml(s, { baby: true, agenda: true })}
      <button class="btn btn-primary btn-block btn-lg mt-16" data-setup-go>Continuer</button>
    </div>
  </section>`;
}
export function mountModuleSetup(main) {
  const root = main.querySelector('[data-setup]');
  root.querySelector('[data-setup-go]').addEventListener('click', () => {
    const picked = readPicker(root);
    if (!Object.keys(picked).length) { alert('Choisissez au moins un module.'); return; }
    publishModules(picked);
  });
}
