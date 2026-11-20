import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, toast, dayKey } from '../ui.js';
import { hubHeader } from '../pages/hub.js';
import { uiOf, setUi, applyPreset, resetUi, ACCENTS, BG_LIGHT, BG_DARK, FONTS, GRADIENTS, RADII, DENSITIES, CARD_STYLES, PRESETS, DEFAULT_UI } from './ui.js';
import { MODULES, enabledModules, modInfo } from '../modules.js';
import { actionsFor } from './actions.js';

/* Page « Apparence » (édition Premium) : tout se règle ici, et l'app change en direct. */
const open = new Set(['presets', 'colors']);
const ICONS = ['baby', 'calendar', 'wallet', 'stetho', 'plane', 'home', 'heart', 'leaf', 'sparkle', 'cart', 'list', 'crown', 'sun', 'moon', 'users', 'box', 'music', 'bottle'];
const TONES = ['salmon', 'slate', 'sage', 'gold', 'peach', 'brick'];

const seg = (name, opts, cur) => `<div class="seg" role="tablist">${opts.map(([v, l]) => `<button class="${v === cur ? 'is-on' : ''}" data-set="${name}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
const sec = (id, title, body, sub = '') => `<details class="card perso-sec" data-sec="${id}" ${open.has(id) ? 'open' : ''}><summary><b>${title}</b>${sub ? `<small class="faint">${sub}</small>` : ''}${icon('chevronDown', 16)}</summary><div class="perso-body">${body}</div></details>`;
const sw = (name, v, color, label, cur) => `<button class="swatch-btn ${v === cur ? 'is-on' : ''}" data-set="${name}" data-v="${v}" style="--c:${color}" aria-label="${esc(label)}" title="${esc(label)}"></button>`;
const sw2 = (v, o) => `<button class="swatch-btn" data-pre="${v}" style="--c:${o}"></button>`;

export function render(s) {
  const ui = uiOf(s), mods = enabledModules(s).map((m) => modInfo(s, m.id)), acts = actionsFor(s);
  const presets = `<div class="chips-row">${PRESETS.map((p) => { const a = ACCENTS[p.ui.accent || 'salmon'], bg = p.mode === 'dark' ? BG_DARK[p.ui.bgDark || 'navy'].bg : BG_LIGHT[p.ui.bgLight || 'cream'].bg;
    return `<button class="preset" data-pre="${p.id}"><span class="preset-sw" style="background:${bg};--a:${p.mode === 'dark' ? a.dark : a.light}"><i></i></span>${esc(p.label)}</button>`; }).join('')}</div>`;
  const colors = `
    <p class="label">Mode</p>${seg('theme', [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']], s.theme)}
    <p class="label mt-16">Couleur principale</p><div class="swatches">${Object.entries(ACCENTS).map(([k, v]) => sw('accent', k, v.light, v.label, ui.accent)).join('')}</div>
    <p class="label mt-16">Fond (mode clair)</p><div class="swatches">${Object.entries(BG_LIGHT).map(([k, v]) => sw('bgLight', k, v.bg, v.label, ui.bgLight)).join('')}</div>
    <p class="label mt-16">Fond (mode sombre)</p><div class="swatches">${Object.entries(BG_DARK).map(([k, v]) => sw('bgDark', k, v.bg, v.label, ui.bgDark)).join('')}</div>
    <p class="label mt-16">Ambiance</p><div class="chips">${Object.entries(GRADIENTS).map(([k, l]) => `<button class="chip ${ui.gradient === k ? 'is-on' : ''}" data-set="gradient" data-v="${k}">${l}</button>`).join('')}</div>`;
  const text = `
    <p class="label">Police</p><div class="chips">${Object.entries(FONTS).map(([k, f]) => `<button class="chip ${ui.font === k ? 'is-on' : ''}" data-set="font" data-v="${k}" style="font-family:${esc(f.stack)}">${f.label}</button>`).join('')}</div>
    <p class="label mt-16">Taille du texte <b class="num" data-scale-label>${ui.textScale} %</b></p>
    <input class="range" type="range" min="85" max="130" step="5" value="${ui.textScale}" data-scale aria-label="Taille du texte">
    <p class="small faint mt-8" style="display:flex;justify-content:space-between"><span>Petit</span><span>Grand</span></p>`;
  const layout = `
    <p class="label">Densité</p>${seg('density', Object.entries(DENSITIES).map(([k, d]) => [k, d.label]), ui.density)}
    <p class="label mt-16">Coins</p>${seg('radius', Object.entries(RADII).map(([k, d]) => [k, d.label]), ui.radius)}
    <p class="label mt-16">Cartes</p>${seg('cards', Object.entries(CARD_STYLES), ui.cards)}`;
  const access = `
    <div class="row-between"><span class="grow"><b style="display:block">Contraste élevé</b><span class="small muted">Textes et contours plus marqués</span></span><label class="switch"><input type="checkbox" data-flag="contrast" ${ui.contrast ? 'checked' : ''}><span class="track"></span></label></div>
    <div class="row-between mt-16"><span class="grow"><b style="display:block">Réduire les animations</b><span class="small muted">Pas de transitions ni d'effets</span></span><label class="switch"><input type="checkbox" data-flag="reduceMotion" ${ui.reduceMotion ? 'checked' : ''}><span class="track"></span></label></div>`;
  const family = `
    <label class="field"><span>Nom de la famille</span><input class="input" data-text="familyName" value="${esc(ui.familyName)}" maxlength="30" placeholder="Ex. Les Dupont"></label>
    <label class="field"><span>Pastille (un emoji)</span><input class="input" data-text="familyEmoji" value="${esc(ui.familyEmoji)}" maxlength="4" placeholder="Ex. 🏡"></label>`;
  const modules = mods.map((m) => { const o = (ui.mods || {})[m.id] || {}, inNav = ui.nav.includes(m.id);
    return `<details class="perso-mod" data-mod="${m.id}"><summary><span class="dot-ic" style="--tone:var(--${m.tone})">${icon(m.icon, 18)}</span><b>${esc(m.label)}</b>${icon('chevronDown', 14)}</summary>
      <label class="field mt-12"><span>Nom</span><input class="input" data-modtext="${m.id}" value="${esc(o.label || '')}" maxlength="20" placeholder="${esc(MODULES.find((x) => x.id === m.id).label)}"></label>
      <p class="label">Icône</p><div class="icon-pick">${ICONS.map((n) => `<button class="${(o.icon || MODULES.find((x) => x.id === m.id).icon) === n ? 'is-on' : ''}" data-modset="${m.id}" data-k="icon" data-v="${n}" aria-label="${n}">${icon(n, 18)}</button>`).join('')}</div>
      <p class="label mt-12">Couleur</p><div class="swatches">${TONES.map((t) => `<button class="swatch-btn tone-${t} ${(o.tone || MODULES.find((x) => x.id === m.id).tone) === t ? 'is-on' : ''}" style="--c:var(--${t})" data-modset="${m.id}" data-k="tone" data-v="${t}" aria-label="${t}"></button>`).join('')}</div>
      <div class="row-between mt-12"><span>Dans la barre du bas</span><label class="switch"><input type="checkbox" data-nav="${m.id}" ${inNav ? 'checked' : ''}><span class="track"></span></label></div>
      <button class="btn btn-ghost btn-sm mt-12" data-modreset="${m.id}">Rétablir le nom, l'icône et la couleur</button></details>`; }).join('');
  const navOrder = ui.nav.filter((id) => mods.some((m) => m.id === id));
  const nav = `
    <p class="label">Barre du bas <small class="faint">(jusqu'à 4 modules)</small></p>
    ${navOrder.length ? navOrder.map((id, i) => { const m = mods.find((x) => x.id === id); return `<div class="row-between nav-row"><span class="row" style="gap:10px"><span class="dot-ic" style="--tone:var(--${m.tone})">${icon(m.icon, 16)}</span>${esc(m.label)}</span><span class="row" style="gap:4px"><button class="icon-btn icon-btn-sm" data-navmove="${id}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Monter">${icon('up', 16)}</button><button class="icon-btn icon-btn-sm" data-navmove="${id}" data-d="1" ${i === navOrder.length - 1 ? 'disabled' : ''} aria-label="Descendre">${icon('down', 16)}</button></span></div>`; }).join('') : '<p class="small faint">Aucun module dans la barre : activez-les dans la liste ci-dessus.</p>'}
    <div class="row-between mt-16"><span class="grow"><b style="display:block">Bouton « + » au centre</b><span class="small muted">Ajout rapide en un geste</span></span><label class="switch"><input type="checkbox" data-flag="navPlus" ${ui.navPlus ? 'checked' : ''}><span class="track"></span></label></div>
    <p class="label mt-16">Raccourcis <small class="faint">(accueil et bouton « + », jusqu'à 6)</small></p>
    <div class="chips">${acts.map((a) => `<button class="chip tone-${a.tone} ${ui.shortcuts.includes(a.id) ? 'is-on' : ''}" data-short="${a.id}">${esc(a.label)}</button>`).join('')}</div>`;
  const home = `
    <p class="small muted">Déplacez, redimensionnez et masquez les cases de l'accueil : alertes, prises du jour, rendez-vous, bébé, budget, courses…</p>
    <div class="grid-2 mt-12"><a class="btn btn-primary btn-sm" href="#/hub" data-go-edit>${icon('settings', 16)} Organiser l'accueil</a><button class="btn btn-ghost btn-sm" data-home-reset>Rétablir l'accueil</button></div>`;
  const backup = `
    <p class="small muted">Gardez votre apparence ou partagez-la avec un autre appareil.</p>
    <div class="grid-2 mt-12"><button class="btn btn-ghost btn-sm" data-export-ui>${icon('download', 16)} Exporter</button><label class="btn btn-ghost btn-sm">${icon('upload', 16)} Importer<input type="file" accept="application/json" hidden data-import-ui></label></div>
    <button class="btn btn-danger btn-block btn-sm mt-12" data-reset-ui>Tout réinitialiser (apparence et accueil)</button>`;
  return `
    ${hubHeader(s, { back: true })}
    <section class="hero"><p class="eyebrow">Version Premium · démo</p><h1 class="title">Apparence et<br>personnalisation</h1><p class="subtitle">Tout se règle ici et change en direct, sur tous les écrans.</p></section>
    ${sec('presets', 'Thèmes prêts à l\'emploi', presets, 'un geste')}
    ${sec('colors', 'Couleurs et fond', colors)}
    ${sec('text', 'Texte', text)}
    ${sec('layout', 'Mise en page', layout)}
    ${sec('access', 'Accessibilité', access)}
    ${sec('family', 'Ma famille', family)}
    ${sec('modules', 'Mes modules', modules || '<p class="small faint">Aucun module activé.</p>', 'nom, icône, couleur')}
    ${sec('nav', 'Navigation et raccourcis', nav)}
    ${sec('home', 'Accueil', home)}
    ${sec('backup', 'Sauvegarde de mon apparence', backup)}`;
}

export function mount(el) {
  el.addEventListener('toggle', (e) => { const d = e.target.closest?.('[data-sec]'); if (d) (d.open ? open.add(d.dataset.sec) : open.delete(d.dataset.sec)); }, true);
  const ui = () => uiOf(store.state);
  el.addEventListener('input', (e) => {
    if (e.target.matches('[data-scale]')) { setUi({ textScale: +e.target.value }, { silent: true }); el.querySelector('[data-scale-label]').textContent = `${e.target.value} %`; }
  });
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-flag]')) setUi({ [t.dataset.flag]: t.checked });
    else if (t.matches('[data-text]')) setUi({ [t.dataset.text]: t.value.trim() });
    else if (t.matches('[data-modtext]')) { const id = t.dataset.modtext, mods = { ...ui().mods }; mods[id] = { ...(mods[id] || {}), label: t.value.trim() }; setUi({ mods }); }
    else if (t.matches('[data-nav]')) {
      let nav = ui().nav.filter((x) => x !== t.dataset.nav);
      if (t.checked) { if (nav.length >= 4) { toast('4 modules au maximum dans la barre'); store.refresh(); return; } nav = [...nav, t.dataset.nav]; }
      setUi({ nav });
    } else if (t.matches('[data-import-ui]')) importUi(t.files[0]);
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button, a'); if (!b) return;
    if (b.dataset.set) { const k = b.dataset.set; if (k === 'theme') store.update((s) => { s.theme = b.dataset.v; }); else setUi({ [k]: b.dataset.v }); }
    else if (b.dataset.pre) applyPreset(b.dataset.pre);
    else if (b.dataset.modset) { const id = b.dataset.modset, mods = { ...ui().mods }; mods[id] = { ...(mods[id] || {}), [b.dataset.k]: b.dataset.v }; setUi({ mods }); }
    else if (b.dataset.modreset) { const mods = { ...ui().mods }; delete mods[b.dataset.modreset]; setUi({ mods }); }
    else if (b.dataset.navmove) { const nav = [...ui().nav], i = nav.indexOf(b.dataset.navmove), j = i + +b.dataset.d; if (j < 0 || j >= nav.length) return; [nav[i], nav[j]] = [nav[j], nav[i]]; setUi({ nav }); }
    else if (b.dataset.short) { let sc = [...ui().shortcuts]; sc = sc.includes(b.dataset.short) ? sc.filter((x) => x !== b.dataset.short) : [...sc, b.dataset.short]; if (sc.length > 6) { toast('6 raccourcis au maximum'); return; } setUi({ shortcuts: sc }); }
    else if (b.matches('[data-home-reset]')) { setUi({ widgets: null }); toast('Accueil rétabli'); }
    else if (b.matches('[data-reset-ui]')) { if (confirm("Réinitialiser toute l'apparence et l'accueil ?")) { resetUi(); toast('Apparence réinitialisée'); } }
    else if (b.matches('[data-export-ui]')) exportUi();
  });
}

function exportUi() {
  const s = store.state, data = { app: 'appfamille-apparence', version: 1, theme: s.theme, ui: uiOf(s) };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = `apparence-${dayKey()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Apparence exportée');
}
async function importUi(file) {
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'appfamille-apparence' || typeof d.ui !== 'object') throw new Error('format');
    const clean = {}; for (const k of Object.keys(DEFAULT_UI)) if (k in d.ui) clean[k] = d.ui[k];
    store.update((s) => { s.ui = { ...DEFAULT_UI, ...clean }; if (['auto', 'light', 'dark'].includes(d.theme)) s.theme = d.theme; });
    setUi({}); toast('Apparence importée');
  } catch { toast('Fichier invalide'); }
}
