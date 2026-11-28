import { store } from '../store.js';
import { EDITION } from '../edition.js';

/*
 * Personnalisation de l'affichage (édition Premium).
 * Les réglages vivent dans store.state.ui (synchronisés entre les appareils) et sont traduits en une feuille de style
 * <style id="ui-override"> posée après la feuille principale : toute l'app suit, sans toucher aux pages.
 */

export const ACCENTS = {
  salmon: { label: 'Saumon', light: '#DE7F63', dark: '#EFA690' }, ocean: { label: 'Océan', light: '#3480C4', dark: '#86BDEB' },
  forest: { label: 'Forêt', light: '#3F9468', dark: '#8FCFA8' }, pop: { label: 'Pop', light: '#FF6A3D', dark: '#FF8A65' }, lavender: { label: 'Lavande', light: '#7C64C0', dark: '#B8A6EA' },
  gold: { label: 'Or', light: '#BD861A', dark: '#EBC36E' }, rose: { label: 'Rose', light: '#D2538A', dark: '#F0A0BF' },
  graphite: { label: 'Graphite', light: '#4A5468', dark: '#BDC5D8' },
};
export const BG_LIGHT = {
  cream: { label: 'Crème', bg: '#F7F5F0', elev: '#FFFFFF', surface: '#FFFFFF', surface2: '#EEF3F8', seg: '#EBF0F6' },
  white: { label: 'Blanc', bg: '#FFFFFF', elev: '#FFFFFF', surface: '#F6F7F9', surface2: '#ECEEF2', seg: '#EEF0F4' },
  mist: { label: 'Brume', bg: '#EAF0F7', elev: '#F4F8FC', surface: '#FFFFFF', surface2: '#E1EAF4', seg: '#DDE7F2' },
  sand: { label: 'Sable', bg: '#F2EADD', elev: '#FBF6EE', surface: '#FFFDF9', surface2: '#EBE0CF', seg: '#E8DCC8' },
  pop: { label: 'Pop', bg: '#FFF1D6', elev: '#FFFFFF', surface: '#FFFFFF', surface2: '#FFE3AE', seg: '#FFE3AE' },
  mint: { label: 'Menthe', bg: '#E9F3EE', elev: '#F4FAF7', surface: '#FFFFFF', surface2: '#DCEBE3', seg: '#D5E6DC' },
};
export const BG_DARK = {
  navy: { label: 'Nuit', bg: '#1A2235', elev: '#1F2840', surface: '#232D46', surface2: '#2B3653', seg: '#182033', segOn: '#2F3B5A' },
  black: { label: 'Noir', bg: '#000000', elev: '#0B0B0D', surface: '#121216', surface2: '#1B1B21', seg: '#0A0A0C', segOn: '#26262E' },
  graphite: { label: 'Graphite', bg: '#1C1C1E', elev: '#232326', surface: '#2A2A2E', surface2: '#343439', seg: '#19191B', segOn: '#3B3B41' },
  forest: { label: 'Forêt', bg: '#12201A', elev: '#172A21', surface: '#1C3227', surface2: '#24402F', seg: '#101C16', segOn: '#2C4D3A' },
  ink: { label: 'Encre', bg: '#16120E', elev: '#1E1913', surface: '#221C15', surface2: '#2E261C', seg: '#120F0B', segOn: '#3A3024' },
  plum: { label: 'Prune', bg: '#1F1A2E', elev: '#261F38', surface: '#2D2542', surface2: '#382E52', seg: '#1B1629', segOn: '#43376A' },
};
export const FONTS = {
  default: { label: 'Douce', stack: '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  system: { label: 'Système', stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  rounded: { label: 'Arrondie', stack: 'ui-rounded, "SF Pro Rounded", "Nunito", "Quicksand", "Varela Round", "Segoe UI", system-ui, sans-serif' },
  serif: { label: 'Classique', stack: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif' },
  reading: { label: 'Lecture facile', stack: '"Atkinson Hyperlegible", Verdana, "DejaVu Sans", Tahoma, sans-serif' },
  mono: { label: 'Machine', stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
};
export const GRADIENTS = { none: 'Aucune', glow: 'Halo', aurora: 'Aurore', soft: 'Douceur' };
export const RADII = { sharp: { label: 'Droits', v: [6, 8, 10, 14] }, normal: { label: 'Standard', v: [12, 16, 22, 28] }, round: { label: 'Très ronds', v: [16, 22, 30, 38] } };
export const DENSITIES = { compact: { label: 'Compacte', gutter: 12, pad: 12 }, normal: { label: 'Standard', gutter: 16, pad: 18 }, airy: { label: 'Aérée', gutter: 20, pad: 22 } };
export const CARD_STYLES = { soft: 'Ombrées', outlined: 'Contours', flat: 'Plates' };

export const DEFAULT_UI = {
  // Édition « Design » : palette pop (orange vif sur crème / encre), angles droits (le reste de l'identité est dans css/design.css)
  accent: EDITION.design ? 'pop' : 'salmon', bgLight: EDITION.design ? 'pop' : 'cream', bgDark: EDITION.design ? 'ink' : 'navy', gradient: 'none', font: 'default', textScale: 100,
  density: 'normal', radius: EDITION.design ? 'sharp' : 'normal', cards: 'soft', contrast: false, reduceMotion: false,
  familyName: '', familyEmoji: '',
  widgets: null,                      // [{ id, size: 'S'|'M'|'L', hidden }] : ordre de l'accueil
  nav: null,                          // modules de la barre du bas : null = automatique (3 premiers modules activés)
  navPlus: true,                      // bouton « + » au centre
  mods: {},                           // { [moduleId]: { label, icon, tone } }
  shortcuts: ['exp', 'rdv', 'shop', 'temp'],
};

export const PRESETS = [
  { id: 'classic', label: 'Classique', mode: 'auto', ui: {} },
  { id: 'night', label: 'Nuit douce', mode: 'dark', ui: { bgDark: 'plum', accent: 'lavender', gradient: 'glow', radius: 'round', font: 'rounded', density: 'airy' } },
  { id: 'minimal', label: 'Minimal', mode: 'light', ui: { bgLight: 'white', accent: 'graphite', cards: 'outlined', radius: 'sharp', density: 'compact', font: 'system' } },
  { id: 'ocean', label: 'Océan', mode: 'light', ui: { bgLight: 'mist', accent: 'ocean', gradient: 'glow' } },
  { id: 'warm', label: 'Chaleureux', mode: 'light', ui: { bgLight: 'sand', accent: 'gold', font: 'serif', gradient: 'soft' } },
  { id: 'pastel', label: 'Pastel', mode: 'light', ui: { bgLight: 'mint', accent: 'rose', radius: 'round', gradient: 'aurora', font: 'rounded' } },
  { id: 'contrast', label: 'Contraste élevé', mode: 'light', ui: { bgLight: 'white', contrast: true, textScale: 115, font: 'reading', cards: 'outlined', accent: 'graphite' } },
  { id: 'black', label: 'Noir profond', mode: 'dark', ui: { bgDark: 'black', accent: 'ocean', cards: 'flat' } },
];

export const uiOf = (s = store.state) => ({ ...DEFAULT_UI, ...(s.ui || {}) });

/** Feuille de style correspondant aux réglages (chaîne vide = apparence d'origine). */
export function buildCss(ui) {
  const out = [];
  const acc = ACCENTS[ui.accent] || ACCENTS.salmon, bl = BG_LIGHT[ui.bgLight] || BG_LIGHT.cream, bd = BG_DARK[ui.bgDark] || BG_DARK.navy;
  const light = [`--salmon:${acc.light}`, `--bg:${bl.bg}`, `--bg-elev:${bl.elev}`, `--surface:${bl.surface}`, `--surface-2:${bl.surface2}`, `--seg-track:${bl.seg}`, '--seg-on:#FFFFFF'];
  const dark = [`--salmon:${acc.dark}`, `--bg:${bd.bg}`, `--bg-elev:${bd.elev}`, `--surface:${bd.surface}`, `--surface-2:${bd.surface2}`, `--seg-track:${bd.seg}`, `--seg-on:${bd.segOn || bd.surface2}`];
  if (ui.contrast) {
    light.push('--text:#000000', '--text-2:#1E2433', '--text-3:#3A4258', '--border:rgba(0,0,0,.34)', '--border-strong:rgba(0,0,0,.6)');
    dark.push('--text:#FFFFFF', '--text-2:#EDEEF4', '--text-3:#C8CCDA', '--border:rgba(255,255,255,.34)', '--border-strong:rgba(255,255,255,.6)');
  }
  out.push(`:root[data-theme="light"]{${light.join(';')}}`, `:root[data-theme="dark"]{${dark.join(';')}}`);
  const r = (RADII[ui.radius] || RADII.normal).v, d = DENSITIES[ui.density] || DENSITIES.normal;
  out.push(`:root{--font:${(FONTS[ui.font] || FONTS.default).stack};--r-sm:${r[0]}px;--r-md:${r[1]}px;--r-lg:${r[2]}px;--r-xl:${r[3]}px;--gutter:${d.gutter}px}`);
  out.push(`html{font-size:${Math.round(Math.min(130, Math.max(85, ui.textScale || 100)))}%}body{font-size:1rem}`);
  if (d.pad !== 18) out.push(`.card{padding:${d.pad}px}`);
  if (ui.cards === 'outlined') out.push('.card{box-shadow:none;border:1.5px solid var(--border-strong)}');
  if (ui.cards === 'flat') out.push('.card{box-shadow:none;border-color:transparent}');
  if (ui.gradient && ui.gradient !== 'none') {
    const g = (a) => ({
      glow: `radial-gradient(120% 55% at 50% -8%,color-mix(in srgb,${a} 24%,transparent),transparent 62%)`,
      aurora: `radial-gradient(70% 40% at 0% 0%,color-mix(in srgb,${a} 22%,transparent),transparent 70%),radial-gradient(70% 40% at 100% 18%,color-mix(in srgb,#6C78C2 18%,transparent),transparent 70%)`,
      soft: `linear-gradient(180deg,color-mix(in srgb,${a} 13%,transparent),transparent 42%)`,
    }[ui.gradient]);
    out.push(`:root[data-theme="light"] body{background-image:${g(acc.light)};background-attachment:fixed}`, `:root[data-theme="dark"] body{background-image:${g(acc.dark)};background-attachment:fixed}`);
  }
  if (ui.reduceMotion) out.push('*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}');
  return out.join('\n');
}

/** Pose la feuille de style (et la garde pour le prochain démarrage : pas de flash). */
export function applyUi(s = store.state) {
  if (!EDITION.premium) return;
  const css = buildCss(uiOf(s));
  let el = document.getElementById('ui-override');
  if (!el) { el = document.createElement('style'); el.id = 'ui-override'; document.head.appendChild(el); }
  if (el.textContent !== css) el.textContent = css;
  try { localStorage.setItem(EDITION.cssKey, css); } catch { /* quota */ }
}

/** Modifie les réglages (silent : sans re-rendu, pour les curseurs). */
export function setUi(patch, { silent = false } = {}) {
  store.update((s) => { s.ui = { ...uiOf(s), ...patch }; }, { silent });
  applyUi();
}
export function applyPreset(id) {
  const p = PRESETS.find((x) => x.id === id); if (!p) return;
  store.update((s) => {
    const keep = { widgets: uiOf(s).widgets, nav: uiOf(s).nav, navPlus: uiOf(s).navPlus, mods: uiOf(s).mods, shortcuts: uiOf(s).shortcuts, familyName: uiOf(s).familyName, familyEmoji: uiOf(s).familyEmoji };
    s.ui = { ...DEFAULT_UI, ...keep, ...p.ui };
    s.theme = p.mode;
  });
  applyUi();
}
export function resetUi() { store.update((s) => { s.ui = null; s.theme = 'auto'; }); applyUi(); }
