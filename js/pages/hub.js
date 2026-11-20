import { store, moduleOn, activeChild, eventsOf } from '../store.js';
import { icon } from '../icons.js';
import { esc, dayLabel, ageLabel, ago, startOfDay } from '../ui.js';
import { enabledModules, modInfo } from '../modules.js';
import { PREMIUM } from '../edition.js';
import { uiOf } from '../premium/ui.js';
import { nextEventLine } from './agenda.js';
import { maisonSummary } from './maison.js';
import { budgetSummary } from './budget.js';
import { santeSummary } from './sante.js';
import { vacancesSummary } from './vacances.js';
import { resolvedTheme } from '../store.js';

/** En-tête de l'espace commun (hub, pages sans enfant) : thème et réglages. */
export function hubHeader(s, { back = false, title = 'AppFamille' } = {}) {
  const dark = resolvedTheme(s) === 'dark';
  return `
  <header class="app-header">
    ${back
      ? `<a class="pill-btn" href="#/hub">${icon('chevronLeft', 16)}Accueil</a>`
      : `<div class="hub-brand"><span class="ob-logo ob-logo-sm">${icon('grid', 20)}</span><b>${esc((PREMIUM && uiOf(s).familyName) || title)}</b></div>`}
    <div class="header-actions">
      ${PREMIUM ? `<a class="icon-btn" href="#/perso" aria-label="Apparence et personnalisation">${icon('palette', 20)}</a>` : ''}
      <button class="icon-btn" data-global="theme" aria-label="${dark ? 'Passer en mode clair' : 'Passer en mode sombre'}">${icon(dark ? 'sun' : 'moon', 20)}</button>
      <button class="pill-btn" data-global="settings">${icon('settings', 16)}Réglages</button>
    </div>
  </header>`;
}

/** Résumé d'une ligne affiché sur la tuile d'un module. */
function summary(s, m) {
  if (m.id === 'baby') {
    const c = activeChild(s);
    if (!c) return 'Ajouter un enfant';
    const last = eventsOf(s, c.id)[0];
    return `${c.name} · ${ageLabel(c.birth)}${last ? ` · ${ago(last.at)}` : ''}`;
  }
  if (m.id === 'agenda') return nextEventLine(s)?.text || 'Rien de prévu';
  if (m.id === 'maison') return maisonSummary(s);
  if (m.id === 'finance') return budgetSummary(s);
  if (m.id === 'medical') return santeSummary(s);
  if (m.id === 'vacation') return vacancesSummary(s);
  return m.desc;
}

export function render(s) {
  const mods = enabledModules(s).map((m) => modInfo(s, m.id));
  return `
    ${hubHeader(s)}
    <section class="hero">
      <p class="eyebrow">${dayLabel()}</p>
      <h1 class="title">Bonjour ${esc(s.me)}</h1>
    </section>
    <div class="hub-grid">
      ${mods.map((m) => `
        <a class="card hub-tile tone-${m.tone}" href="#/${m.route}" style="--tone:var(--${m.tone})">
          <span class="dot-ic hub-ic">${icon(m.icon, 24)}</span>
          <span class="hub-text"><b>${esc(m.label)}</b><small>${esc(summary(s, m))}</small></span>
          ${icon('chevronRight', 16)}
        </a>`).join('')}
    </div>
    <button class="btn btn-ghost btn-block mt-20" data-global="settings">${icon('plus', 18)} Ajouter ou retirer des modules</button>`;
}
