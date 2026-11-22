import { esc } from '../ui.js';

/*
 * Sections du module Bébé : onglets en HAUT de page (comme Santé, Budget, Maison).
 * La barre du bas reste la même partout dans l'application.
 */
export const BABY_TABS = [['home', 'Journée'], ['food', 'Repas'], ['parents', 'Parents'], ['sleep', 'Sommeil']];
export function babyTabs(active) {
  return `<nav class="seg subtabs" aria-label="Sections de Bébé">${BABY_TABS.map(([r, l]) => `<a class="${r === active ? 'is-on' : ''}" href="#/${r}" ${r === active ? 'aria-current="page"' : ''}>${esc(l)}</a>`).join('')}</nav>`;
}
