import { store, activeChild } from '../store.js';
import { icon } from '../icons.js';
import { esc, norm, dayKey, ageMonths, dateShort, openSheet, toast, $, $$ } from '../ui.js';
import { appHeader } from '../profiles.js';
import { babyTabs } from './babytabs.js';
import { FOODS, CATEGORIES, STATUS, RECIPES, AGE_BANDS } from '../data/foods.js';

let query = '';
let filter = 'all';
let weekOffset = 0;
let band = null;

const foodState = (s, childId) => s.foods[childId] || {};
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function weekDays() {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

function triesByDay(fs) {
  const map = {};
  for (const [id, v] of Object.entries(fs)) for (const t of v.tries || []) (map[dayKey(t)] ||= new Set()).add(id);
  return map;
}

const bandFor = (m) => (AGE_BANDS.find(([, , a, b]) => m >= a && m < b) || AGE_BANDS[0])[0];

export function render(s) {
  const c = activeChild(s);
  const m = ageMonths(c.birth);
  const fs = foodState(s, c.id);
  const tested = FOODS.filter((f) => fs[f.id]?.tries?.length || fs[f.id]?.status).length;
  const byDay = triesByDay(fs);
  const days = weekDays();
  const todayKey = dayKey();
  band ||= bandFor(m);
  const monthLabel = days[0].toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const filters = [['all', 'Tous'], ['ok', 'Validés'], ['retry', 'À réessayer'], ['allergy', 'Allergènes'], ['new', 'Pas encore goûtés']];
  const recipes = RECIPES.filter((r) => r.band === band);

  return `
    ${appHeader(s)}
    ${babyTabs('food')}
    <section class="hero">
      <p class="eyebrow">Diversification</p>
      <h1 class="title">Le voyage culinaire<br>de ${esc(c.name)}</h1>
      <div class="row mt-16 tone-sage">
        <div class="progress" style="flex:1"><span style="width:${Math.round((tested / FOODS.length) * 100)}%"></span></div>
        <span class="small muted num"><b style="color:var(--text)">${tested}</b> / ${FOODS.length} aliments</span>
      </div>
    </section>

    ${m < 4 ? `<div class="notice tone-slate" style="margin-bottom:16px">${icon('info', 20)}<span>La diversification commence <b>entre 4 et 6 mois révolus</b>. D’ici là, le lait suffit. Parlez-en à votre pédiatre.</span></div>` : ''}

    <div class="search">
      ${icon('search', 20)}
      <input class="input" type="search" placeholder="Rechercher un aliment…" value="${esc(query)}" data-search aria-label="Rechercher un aliment" enterkeyhint="search">
    </div>
    <div class="search-result" data-result></div>

    <section class="section">
      <div class="section-head">
        <h2>${icon('calendar', 20)} Cette semaine</h2>
        <div class="week-nav">
          <button class="icon-btn icon-btn-sm" data-week="-1" aria-label="Semaine précédente">${icon('chevronLeft', 18)}</button>
          <button class="icon-btn icon-btn-sm" data-week="1" aria-label="Semaine suivante" ${weekOffset >= 0 ? 'disabled style="opacity:.35"' : ''}>${icon('chevronRight', 18)}</button>
        </div>
      </div>
      <p class="small faint" style="margin:-6px 0 10px">${weekOffset === 0 ? 'Semaine en cours' : `Semaine du ${dateShort(days[0])}`} · ${monthLabel}</p>
      <div class="week">
        ${days.map((d, i) => {
          const k = dayKey(d);
          const ids = [...(byDay[k] || [])];
          const foods = ids.map((id) => FOODS.find((f) => f.id === id)).filter(Boolean);
          return `<button class="day ${k === todayKey ? 'is-today' : ''}" data-day="${k}" aria-label="${DAYS[i]} ${d.getDate()} : ${foods.length} aliment(s)">
            <span class="day-l">${DAYS[i]}</span><span class="day-n num">${d.getDate()}</span>
            <span class="day-foods">${foods.slice(0, 3).map((f) => `<span>${f.emoji}</span>`).join('')}${foods.length > 3 ? `<span class="day-more">+${foods.length - 3}</span>` : ''}</span>
          </button>`;
        }).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Catalogue d’introduction</h2></div>
      <div class="chips scroll tone-sage">${filters.map(([k, l]) => `<button class="chip ${filter === k ? 'is-on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>
      <div class="mt-16" data-catalog>
        ${CATEGORIES.map(([cat, label]) => `
          <div class="food-cat" data-cat="${cat}">
            <h3>${label}</h3>
            <div class="food-grid">
              ${FOODS.filter((f) => f.cat === cat).map((f) => {
                const st = fs[f.id]?.status;
                const tries = fs[f.id]?.tries?.length || 0;
                const visible = filter === 'all' || (filter === 'new' ? !st && !tries : st === filter);
                return `<button class="food-card ${m < f.min ? 'is-early' : ''}" data-food="${f.id}" data-name="${norm(f.name)}" data-st="${st || ''}" ${visible ? '' : 'hidden'}>
                  ${st ? `<span class="fc-dot tone-${STATUS[st].tone}"></span>` : ''}
                  ${f.allergen ? '<span class="fc-allergen" title="Allergène majeur">A</span>' : ''}
                  <span class="fc-emoji">${f.emoji}</span>
                  <span class="fc-name">${esc(f.name)}</span>
                  <span class="fc-meta">${st ? STATUS[st].label : tries ? `Goûté ${tries}×` : `Dès ${f.min} mois`}</span>
                </button>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </div>
      <p class="small faint mt-12"><b>A</b> = allergène majeur : à introduire en petite quantité, un seul nouvel aliment à la fois, de préférence le matin.</p>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Idées de recettes</h2>
        <span class="badge premium-badge">${icon('crown', 13)} Premium</span>
      </div>
      <div class="chips scroll tone-sage">${AGE_BANDS.map(([k, l]) => `<button class="chip ${band === k ? 'is-on' : ''}" data-band="${k}">${l}</button>`).join('')}</div>
      <div class="carousel mt-12">
        ${recipes.map((r) => {
          const locked = !r.free && !s.premium;
          return `<button class="recipe" data-recipe="${r.id}">
            <div class="recipe-art" style="--c1:${r.c1};--c2:${r.c2}">${r.emoji}${locked ? `<span class="recipe-lock">${icon('lock', 16)}</span>` : ''}</div>
            <div class="recipe-body"><p class="recipe-title">${esc(r.title)}</p><p class="recipe-meta">${r.kind} · ${r.minutes} min</p></div>
          </button>`;
        }).join('')}
      </div>
    </section>`;
}

function applySearch(el) {
  const q = norm(query);
  const s = store.state;
  const c = activeChild(s);
  const m = ageMonths(c.birth);
  $$('.food-card', el).forEach((card) => { card.style.display = !q || card.dataset.name.includes(q) ? '' : 'none'; });
  $$('.food-cat', el).forEach((cat) => { cat.style.display = $$('.food-card', cat).some((x) => x.style.display !== 'none' && !x.hidden) ? '' : 'none'; });
  const box = $('[data-result]', el);
  if (!q) { box.innerHTML = ''; return; }
  const match = FOODS.find((f) => norm(f.name).startsWith(q)) || FOODS.find((f) => norm(f.name).includes(q));
  if (!match) { box.innerHTML = `<div class="notice tone-pearl">${icon('search', 18)}<span>Aucun aliment trouvé pour « ${esc(query)} ».</span></div>`; return; }
  const ok = m >= match.min;
  box.innerHTML = `<div class="notice tone-${ok ? 'sage' : 'yellow'}">${icon(ok ? 'check' : 'clock', 20)}<span><b>${match.emoji} ${esc(match.name)}</b> — ${ok ? `adapté à l’âge de ${esc(c.name)} (dès ${match.min} mois).` : `à proposer à partir de ${match.min} mois.`}${match.note ? ` ${esc(match.note)}` : ''}</span></div>`;
}

export function mount(el) {
  applySearch(el);
  const input = $('[data-search]', el);
  input.addEventListener('input', () => { query = input.value; applySearch(el); });

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const c = activeChild(store.state);
    if (b.dataset.week) { weekOffset = Math.min(0, weekOffset + +b.dataset.week); store.refresh(); }
    else if (b.dataset.filter) { filter = b.dataset.filter; store.refresh(); }
    else if (b.dataset.band) { band = b.dataset.band; store.refresh(); }
    else if (b.dataset.food) openFood(c, b.dataset.food);
    else if (b.dataset.day) openDay(c, b.dataset.day);
    else if (b.dataset.recipe) openRecipe(b.dataset.recipe);
  });
}

function setStatus(childId, foodId, status) {
  store.update((s) => {
    const fs = (s.foods[childId] ||= {});
    const entry = (fs[foodId] ||= { status: null, tries: [] });
    entry.status = entry.status === status ? null : status;
  });
}
function addTry(childId, foodId, ts) {
  store.update((s) => {
    const fs = (s.foods[childId] ||= {});
    const entry = (fs[foodId] ||= { status: null, tries: [] });
    entry.tries.push(ts);
  });
}

function openFood(c, foodId) {
  const f = FOODS.find((x) => x.id === foodId);
  openSheet({
    title: f.name, subtitle: CATEGORIES.find(([k]) => k === f.cat)[1],
    onMount(body, api) {
      const draw = () => {
        const entry = foodState(store.state, c.id)[f.id] || { tries: [] };
        const m = ageMonths(c.birth);
        body.innerHTML = `
          <div class="food-hero">
            <span class="big-emoji">${f.emoji}</span>
            <div class="stack" style="gap:6px">
              <span class="badge tone-${m >= f.min ? 'sage' : 'yellow'}">${m >= f.min ? icon('check', 13) + ' Adapté' : icon('clock', 13) + ` Dès ${f.min} mois`}</span>
              ${f.allergen ? `<span class="badge tone-brick">${icon('alert', 13)} Allergène majeur · ${f.allergen}</span>` : ''}
            </div>
          </div>
          ${f.note ? `<div class="notice tone-${f.id === 'miel' ? 'brick' : 'pearl'}">${icon('info', 18)}<span>${esc(f.note)}</span></div>` : ''}
          <p class="label mt-20">Tolérance</p>
          <div class="status-pick mt-8">
            ${Object.entries(STATUS).map(([k, v]) => `<button class="chip tone-${v.tone} ${entry.status === k ? 'is-on' : ''}" data-status="${k}">${icon(v.icon, 16)} ${v.label}</button>`).join('')}
          </div>
          <div class="tone-sage mt-20"><button class="btn btn-primary btn-block btn-lg" data-try>${icon('plus', 20)} Goûté aujourd’hui</button></div>
          <p class="label mt-24">Historique</p>
          <p class="small muted mt-8">${entry.tries.length ? entry.tries.slice().sort((a, b) => b - a).map((t) => dateShort(t)).join(' · ') : 'Pas encore goûté.'}</p>`;
      };
      body.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.status) { setStatus(c.id, f.id, b.dataset.status); draw(); }
        if (b.hasAttribute('data-try')) { addTry(c.id, f.id, Date.now()); api.close(); toast(`${f.emoji} ${f.name} ajouté à aujourd’hui`); }
      });
      draw();
    },
  });
}

function openDay(c, key) {
  const [y, mo, d] = key.split('-').map(Number);
  const date = new Date(y, mo - 1, d, 12);
  const isToday = key === dayKey();
  const label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  let q = '';
  openSheet({
    title: label.charAt(0).toUpperCase() + label.slice(1), subtitle: `Aliments proposés à ${c.name}`,
    onMount(body) {
      const draw = () => {
        const fs = foodState(store.state, c.id);
        const tried = FOODS.filter((f) => (fs[f.id]?.tries || []).some((t) => dayKey(t) === key));
        const rest = FOODS.filter((f) => !tried.includes(f) && (!q || norm(f.name).includes(norm(q))));
        body.innerHTML = `
          <div class="chips">${tried.length ? tried.map((f) => `<button class="chip is-on tone-sage" data-remove="${f.id}" aria-label="Retirer ${esc(f.name)}">${f.emoji} ${esc(f.name)} ${icon('x', 14)}</button>`).join('') : '<p class="small faint">Aucun aliment ce jour-là.</p>'}</div>
          <div class="search mt-20">${icon('search', 18)}<input class="input" type="search" placeholder="Ajouter un aliment…" value="${esc(q)}" data-q></div>
          <div class="chips mt-12">${rest.map((f) => `<button class="chip" data-add="${f.id}">${f.emoji} ${esc(f.name)}</button>`).join('')}</div>`;
        const input = $('[data-q]', body);
        input.addEventListener('input', () => { q = input.value; const pos = input.selectionStart; draw(); const n = $('[data-q]', body); n.focus(); n.setSelectionRange(pos, pos); });
      };
      body.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.add) { addTry(c.id, b.dataset.add, isToday ? Date.now() : date.getTime()); draw(); }
        if (b.dataset.remove) {
          store.update((s) => { const en = s.foods[c.id]?.[b.dataset.remove]; if (en) en.tries = en.tries.filter((t) => dayKey(t) !== key); });
          draw();
        }
      });
      draw();
    },
  });
}

function openRecipe(id) {
  const r = RECIPES.find((x) => x.id === id);
  if (!r.free && !store.state.premium) return openPremium();
  openSheet({
    title: r.title, subtitle: `${AGE_BANDS.find(([k]) => k === r.band)[1]} · ${r.kind} · ${r.minutes} min`,
    content: `
      <div class="recipe-art" style="--c1:${r.c1};--c2:${r.c2};border-radius:22px;height:140px">${r.emoji}</div>
      <p class="label mt-20">Ingrédients</p>
      <div class="ingredients mt-8">${r.ingredients.map((i) => `<span class="chip">${esc(i)}</span>`).join('')}</div>
      <p class="label mt-24">Préparation</p>
      <ol class="recipe-steps mt-12">${r.steps.map((st) => `<li>${esc(st)}</li>`).join('')}</ol>
      <p class="small faint">Sans sel ni sucre ajoutés. Adaptez la texture au rythme de votre enfant.</p>`,
  });
}

function openPremium() {
  openSheet({
    title: 'AppBébé Premium', subtitle: 'Recettes adaptées à chaque étape',
    content: `
      <div class="stack">
        ${['Plus de 100 recettes classées par âge et texture', 'Menus de la semaine & liste de courses', 'Recettes DME guidées pas à pas'].map((t) => `<div class="row tone-gold"><span class="ac-icon sm">${icon('check', 18)}</span><span>${t}</span></div>`).join('')}
      </div>
      <div class="notice tone-gold mt-20">${icon('sparkle', 18)}<span>Le Premium arrive bientôt. Activez l’aperçu pour découvrir toutes les recettes dès maintenant.</span></div>
      <div class="tone-gold mt-16"><button class="btn btn-primary btn-block btn-lg" data-preview>${icon('crown', 18)} Activer l’aperçu</button></div>`,
    onMount(body, api) {
      body.querySelector('[data-preview]').addEventListener('click', () => { store.update((s) => { s.premium = true; }); api.close(); toast('Aperçu Premium activé'); });
    },
  });
}
