import { store, moduleOn } from './store.js';
import { icon } from './icons.js';
import { esc } from './ui.js';

/*
 * Registre des modules de l'application.
 * Pour en ajouter un : une entrée ici (+ une page dans js/pages/ et sa route dans app.js).
 *  - ready : false → affiché « Bientôt » dans le choix des modules, non activable.
 *  - route : page d'entrée du module (#/route) ; routes : toutes les pages qui lui appartiennent.
 */
export const MODULES = [
  { id: 'baby',      label: 'Bébé',               desc: 'Repas, couches, sommeil, croissance, diversification, espace parents', icon: 'baby',     tone: 'salmon', ready: true,  route: 'home', routes: ['home', 'food', 'parents', 'sleep', 'stats', 'plan'] },
  { id: 'agenda',    label: 'Agenda',             desc: 'Rendez-vous, fêtes et départs partagés en famille',                    icon: 'calendar', tone: 'slate',  ready: true,  route: 'agenda', routes: ['agenda'] },
  { id: 'finance',   label: 'Budget',             desc: 'Dépenses, budget du mois, qui doit quoi',                              icon: 'wallet',   tone: 'sage',   ready: true,  route: 'budget', routes: ['budget'] },
  { id: 'medical',   label: 'Santé',              desc: 'Carnet de santé de chacun, vaccins, ordonnances, rendez-vous médicaux', icon: 'stetho',   tone: 'brick',  ready: true,  route: 'sante', routes: ['sante'] },
  { id: 'vacation',  label: 'Vacances',           desc: 'Préparer un voyage : itinéraire, valises, budget',                     icon: 'plane',    tone: 'gold',   ready: true,  route: 'vacances', routes: ['vacances'] },
  { id: 'maison',    label: 'Maison',             desc: 'Courses, tâches ménagères, menus de la semaine',                       icon: 'home',     tone: 'peach',  ready: true,  route: 'maison', routes: ['maison'] },
];

export const moduleById = (id) => MODULES.find((m) => m.id === id);
export const enabledModules = (s) => MODULES.filter((m) => m.ready && moduleOn(s, m.id));

/** Module propriétaire d'une page, ou null (hub, pages communes). */
export function moduleOfRoute(route) {
  return MODULES.find((m) => m.routes?.includes(route))?.id || null;
}

/** Page d'ouverture : directement Bébé si c'est le seul module, sinon le hub. */
export function defaultRoute(s) {
  const on = enabledModules(s);
  return on.length === 1 ? on[0].route : 'hub';
}

/** Liste des modules avec interrupteurs (choix initial et réglages). */
export function modulePickerHtml(s, selected = s.modules || {}) {
  return `
  <div class="module-list" data-modules>
    ${MODULES.map((m) => `
      <label class="module-row tone-${m.tone} ${m.ready ? '' : 'is-soon'}">
        <span class="dot-ic" style="--tone:var(--${m.tone})">${icon(m.icon, 20)}</span>
        <span class="module-text"><b>${esc(m.label)}${m.ready ? '' : ' <span class="badge">Bientôt</span>'}</b><small>${esc(m.desc)}</small></span>
        <span class="switch"><input type="checkbox" data-module="${m.id}" ${selected[m.id] ? 'checked' : ''} ${m.ready ? '' : 'disabled'}><span class="track"></span></span>
      </label>`).join('')}
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
    store.update((s) => { s.modules = picked; });
  });
}
