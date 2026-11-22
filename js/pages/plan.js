import { store, activeChild, feedingOf, usesFormula, usesBreast, FEEDING } from '../store.js';
import { icon } from '../icons.js';
import { esc, fmtNum, uid, ageMonths, openSheet, toast, seg, emptyState, $, $$ } from '../ui.js';
import { appHeader } from '../profiles.js';
import { TEMPLATES, KIND_LABEL, buildItems, questionsFor } from '../data/templates.js';
import * as sup from '../supplies.js';

/*
 * Organisation : stock (décompté automatiquement depuis le journal) et listes
 * (courses, voyage, sac à langer…) partagées entre les parents via le NAS.
 */

let tab = 'stock';
let openId = null;
let focusAdd = false;

const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/* ---------- Rendu ---------- */
export function render(s) {
  const list = openId && s.lists.find((l) => l.id === openId);
  if (openId && !list) openId = null;
  if (list) return `${appHeader(s)}${listView(list)}`;
  return `
    ${appHeader(s)}
    <a class="back-link" href="#/home">${icon('chevronLeft', 16)} Bébé</a>
    <section class="hero"><p class="eyebrow">Organisation</p><h1 class="title">Stock &amp; listes</h1></section>
    ${seg('ptab', [['stock', 'Stock'], ['lists', 'Listes']], tab)}
    <div class="mt-16">${tab === 'stock' ? stockView(s) : listsView(s)}</div>`;
}

/* ---------- Stock ---------- */
function stockView(s) {
  const missing = Object.entries(sup.PRESETS).filter(([, p]) => !s.supplies.some((i) => i.auto === p.auto) && (p.auto !== 'formula' || usesFormula(s)));
  const cards = s.supplies.map((it) => supplyCard(s, it)).join('');
  return `
    ${cards || `<div class="card">${emptyState('box', 'Aucun stock suivi', 'Indiquez ce que vous avez en réserve : chaque change et chaque biberon sera décompté tout seul.')}</div>`}
    <div class="stack mt-16">
      ${missing.map(([k, p]) => `<button class="btn btn-ghost btn-block" data-act="new-preset" data-k="${k}">${icon(p.icon, 18)} Suivre ${p.auto === 'diaper' ? 'les couches' : 'le lait infantile'}</button>`).join('')}
      <button class="btn btn-ghost btn-block" data-act="new-custom">${icon('plus', 18)} Autre article (lingettes, coton…)</button>
    </div>
    <p class="small faint mt-16">Le décompte vient du journal : si vous modifiez ou supprimez un change ou un biberon, le stock se corrige tout seul. Le lait maternel n'est pas décompté.${usesFormula(s) ? '' : ' Le lait infantile n\'est pas proposé car bébé est allaité (modifiable dans le profil).'}</p>`;
}

function supplyCard(s, it) {
  const rem = Math.max(0, sup.remaining(s, it));
  const d = sup.daysLeft(s, it), low = sup.isLow(s, it), rate = sup.perDay(s, it);
  const formula = it.auto === 'formula';
  const big = formula ? fmtNum(rem, 1) : Math.round(rem);
  const unit = formula ? (rem >= 2 ? 'boîtes' : 'boîte') : it.unit;
  const lines = [];
  if (formula) lines.push(`≈ ${fmtNum((rem * (it.yield || 5800)) / 1000, 1)} L de lait préparé`);
  if (d !== null) lines.push(`${d < 1 ? 'Moins d\'un jour' : `Environ ${Math.round(d)} jour${Math.round(d) > 1 ? 's' : ''}`} · ${formula ? `${fmtNum(rate * (it.yield || 5800), 0)} ml` : fmtNum(rate, 1)} par jour`);
  else if (it.auto) lines.push('Prévision dès les premiers jours de saisie');
  return `
    <article class="card supply tone-${it.tone || 'sage'} ${low ? 'is-low' : ''}" data-id="${it.id}">
      <header class="row-between">
        <span class="sp-name"><span class="dot-ic">${icon(it.icon || 'box', 18)}</span>${esc(it.name)}</span>
        <button class="icon-btn icon-btn-sm" data-act="edit" aria-label="Modifier ${esc(it.name)}">${icon('edit', 17)}</button>
      </header>
      <div class="sp-main">
        ${it.auto ? '' : `<button class="icon-btn" data-act="dec" aria-label="Retirer un">${icon('minus', 18)}</button>`}
        <div class="sp-val"><span class="sp-v num">${big}</span><span class="sp-u">${esc(unit)}</span></div>
        ${it.auto ? '' : `<button class="icon-btn" data-act="inc" aria-label="Ajouter un">${icon('plus', 18)}</button>`}
      </div>
      ${low ? `<p class="sp-alert">${icon('alert', 15)} ${rem <= 0 ? 'Épuisé' : 'Stock bas'}, pensez à en racheter</p>` : ''}
      ${lines.map((l) => `<p class="small muted">${l}</p>`).join('')}
      <div class="grid-2 mt-16">
        <button class="btn btn-ghost btn-sm" data-act="receive">${icon('plus', 16)} Réception</button>
        <button class="btn btn-ghost btn-sm" data-act="shop">${icon('cart', 16)} Aux courses</button>
      </div>
    </article>`;
}

function itemForm(it, preset) {
  const isNew = !it;
  const base = it || preset || { name: '', unit: 'unités', auto: null, low: 0, icon: 'box', tone: 'sage' };
  const rem = it ? Math.max(0, sup.remaining(store.state, it)) : 0;
  const remShown = Math.round(rem * 100) / 100;
  const formula = base.auto === 'formula';
  openSheet({
    title: isNew ? (preset ? `Suivre : ${base.name}` : 'Nouvel article') : base.name,
    subtitle: base.auto ? 'Décompté automatiquement depuis le journal.' : 'Mis à jour à la main avec − et +.',
    content: `
      <form class="js-form tone-${base.tone || 'sage'}">
        <label class="field"><span>Nom</span><input class="input" name="name" value="${esc(base.name)}" maxlength="40" required placeholder="Ex. Couches taille 3"></label>
        <label class="field"><span>${isNew ? 'En stock maintenant' : 'En stock (corriger)'}${formula ? ' (boîtes)' : base.auto ? ` (${esc(base.unit)})` : ''}</span><input class="input num" name="qty" type="number" inputmode="decimal" min="0" step="${formula ? '0.1' : '1'}" value="${isNew ? '' : remShown}" required></label>
        ${base.auto ? '' : `<label class="field"><span>Unité</span><input class="input" name="unit" value="${esc(base.unit)}" maxlength="16"></label>`}
        <label class="field"><span>Prévenir quand il reste moins de</span><input class="input num" name="low" type="number" inputmode="decimal" min="0" step="${formula ? '0.5' : '1'}" value="${base.low ?? 0}"></label>
        ${formula ? `<label class="field"><span>Lait préparé par boîte (ml)</span><input class="input num" name="yield" type="number" inputmode="numeric" min="500" step="100" value="${base.yield || 5800}"><small class="faint">Une boîte de 800 g donne environ 5 800 ml. Voir l'indication au dos de la boîte.</small></label>` : ''}
        <div class="actions tone-${base.tone === 'peach' ? 'peach' : 'salmon'}">
          ${isNew ? '<button type="button" class="btn btn-ghost" data-close>Annuler</button>' : '<button type="button" class="btn btn-danger" data-del>' + icon('trash', 18) + ' Supprimer</button>'}
          <button class="btn btn-primary" type="submit">${isNew ? 'Ajouter' : 'Enregistrer'}</button>
        </div>
      </form>`,
    onMount(body, api) {
      body.querySelector('[data-close]')?.addEventListener('click', () => api.close());
      body.querySelector('[data-del]')?.addEventListener('click', () => {
        const copy = JSON.parse(JSON.stringify(it));
        store.update((s) => { s.supplies = s.supplies.filter((x) => x.id !== it.id); });
        api.close();
        toast('Article supprimé', { action: 'Annuler', onAction: () => store.update((s) => { s.supplies.push(copy); }) });
      });
      body.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const q = num(f.get('qty')) ?? 0, low = num(f.get('low')) ?? 0, name = String(f.get('name')).trim();
        if (!name) return;
        store.update((s) => {
          if (isNew) {
            s.supplies.push({ id: uid(), name, auto: base.auto, unit: f.get('unit') ? String(f.get('unit')).trim() : base.unit, icon: base.icon, tone: base.tone, qty: q, since: Date.now(), low, ...(formula ? { yield: num(f.get('yield')) || 5800 } : {}) });
          } else {
            const x = s.supplies.find((y) => y.id === it.id);
            if (!x) return;
            const changed = Math.abs(q - remShown) > 0.001;
            Object.assign(x, { name, low, ...(f.get('unit') ? { unit: String(f.get('unit')).trim() } : {}), ...(formula ? { yield: num(f.get('yield')) || 5800 } : {}) });
            if (changed) sup.setRemaining(s, x, q);
          }
        });
        api.close();
      });
    },
  });
}

function receive(it) {
  const formula = it.auto === 'formula';
  const quick = formula ? [1, 2, 4] : it.auto === 'diaper' ? [24, 40, 72] : [1, 5, 10];
  openSheet({
    title: 'Réception',
    subtitle: `Ajouter du stock : ${it.name}`,
    content: `
      <form class="js-form tone-${it.tone || 'sage'}">
        <label class="field"><span>Quantité reçue${formula ? ' (boîtes)' : ''}</span><input class="input num" name="n" type="number" inputmode="decimal" min="1" step="1" required autofocus></label>
        <div class="chips">${quick.map((q) => `<button type="button" class="chip" data-q="${q}">+${q}</button>`).join('')}</div>
        <div class="actions tone-salmon"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" type="submit">Ajouter au stock</button></div>
      </form>`,
    onMount(body, api) {
      const input = body.querySelector('[name=n]');
      body.querySelector('[data-close]').addEventListener('click', () => api.close());
      body.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.q; }));
      body.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const n = num(input.value);
        if (!n || n <= 0) return;
        store.update((s) => { const x = s.supplies.find((y) => y.id === it.id); if (x) x.qty += n; });
        api.close();
        toast(`+${n} ${formula ? 'boîte' + (n > 1 ? 's' : '') : it.unit} ajouté${n > 1 ? 's' : ''}`);
      });
    },
  });
}

/* ---------- Listes ---------- */
function listsView(s) {
  const lists = [...s.lists].sort((a, b) => (a.kind === 'shop' ? -1 : 0) - (b.kind === 'shop' ? -1 : 0) || b.created - a.created);
  return `
    ${lists.length ? lists.map((l) => {
      const done = l.items.filter((i) => i.done).length, n = l.items.length;
      return `
      <button class="card list-card" data-act="open-list" data-id="${l.id}">
        <span class="dot-ic">${icon(l.kind === 'shop' ? 'cart' : l.kind === 'trip' ? 'sun' : 'list', 18)}</span>
        <span class="lc-body"><b>${esc(l.name)}</b><small>${KIND_LABEL[l.kind] || 'Liste'} · ${n ? `${done} / ${n} fait${done > 1 ? 's' : ''}` : 'vide'}</small>
          ${n ? `<span class="progress"><span style="width:${Math.round((done / n) * 100)}%"></span></span>` : ''}</span>
        ${icon('chevronRight', 16)}
      </button>`;
    }).join('') : `<div class="card">${emptyState('list', 'Aucune liste', 'Créez vos courses ou préparez un voyage à partir d\'un modèle.')}</div>`}
    <button class="btn btn-primary btn-block mt-16" data-act="new-list">${icon('plus', 18)} Nouvelle liste</button>`;
}

function newList() {
  const s0 = store.state, child = activeChild(s0);
  const f = feedingOf(s0, child);
  const ctx = { formula: usesFormula(s0), breast: usesBreast(s0), ageMonths: child ? ageMonths(child.birth) : 12 };
  const note = f ? `Adapté au profil de ${child.name} : ${FEEDING[f].toLowerCase()}.` : '';
  openSheet({
    title: 'Nouvelle liste',
    subtitle: 'Partez d\'un modèle ou d\'une liste vide.',
    content: `
      <form class="js-form">
        <label class="field"><span>Nom</span><input class="input" name="name" maxlength="50" placeholder="Ex. Week-end chez mamie" required></label>
        <p class="label">Modèle</p>
        <div class="chips mt-8" data-pick="tpl">
          <button type="button" class="chip is-on" data-v="">Vide</button>
          <button type="button" class="chip" data-v="shop">Courses</button>
          ${TEMPLATES.map((t) => `<button type="button" class="chip" data-v="${t.id}" data-name="${esc(t.name)}">${esc(t.name)}</button>`).join('')}
        </div>
        <div class="js-q"></div>
        <div class="actions tone-salmon"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" type="submit">Créer</button></div>
      </form>`,
    onMount(body, api) {
      let tpl = '', answers = {};
      const name = body.querySelector('[name=name]');
      const qBox = body.querySelector('.js-q');
      let auto = true;
      name.addEventListener('input', () => { auto = false; });
      body.querySelector('[data-close]').addEventListener('click', () => api.close());

      const drawQuestions = () => {
        const t = TEMPLATES.find((x) => x.id === tpl);
        const qs = questionsFor(t, ctx);
        qBox.innerHTML = qs.length ? `
          <div class="questions">
            <p class="label">Pour adapter la liste <small class="faint">(facultatif)</small></p>
            ${note ? `<p class="small faint">${esc(note)}</p>` : ''}
            ${qs.map((q) => `
              <div class="q" data-q="${q.id}">
                <p class="q-ask">${esc(q.ask)}</p>
                <div class="seg" role="group">
                  <button type="button" class="${answers[q.id] === 'yes' ? 'is-on' : ''}" data-a="yes">Oui</button>
                  <button type="button" class="${answers[q.id] === 'no' ? 'is-on' : ''}" data-a="no">Non</button>
                </div>
              </div>`).join('')}
          </div>` : (t && note ? `<p class="small faint mt-12">${esc(note)}</p>` : '');
      };
      qBox.addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]');
        if (!b) return;
        const id = b.closest('[data-q]').dataset.q;
        answers[id] = answers[id] === b.dataset.a ? undefined : b.dataset.a; // un second toucher annule
        b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', answers[id] === x.dataset.a));
      });

      body.querySelectorAll('[data-pick] .chip').forEach((b) => b.addEventListener('click', () => {
        tpl = b.dataset.v; answers = {};
        body.querySelectorAll('[data-pick] .chip').forEach((x) => x.classList.toggle('is-on', x === b));
        if (auto || !name.value) { name.value = tpl === 'shop' ? 'Courses' : b.dataset.name || ''; auto = true; }
        drawQuestions();
      }));
      body.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const nm = name.value.trim();
        if (!nm) return;
        const t = TEMPLATES.find((x) => x.id === tpl);
        const items = t ? buildItems(t, answers, ctx, (text, cat) => ({ id: uid(), text, ...(cat ? { cat } : {}), done: false })) : [];
        const l = { id: uid(), name: nm, kind: tpl === 'shop' ? 'shop' : t ? t.kind : 'custom', created: Date.now(), items };
        store.update((s) => { s.lists.push(l); });
        openId = l.id;
        api.close();
        store.refresh();
      });
    },
  });
}

function listView(l) {
  const done = l.items.filter((i) => i.done).length, n = l.items.length;
  const cats = [...new Set(l.items.map((i) => i.cat || ''))];
  const row = (i) => `
    <div class="li-row ${i.done ? 'is-done' : ''}">
      <button class="check ${i.done ? 'is-done' : ''}" data-act="toggle" data-id="${i.id}" aria-pressed="${!!i.done}">
        <span class="check-box">${icon('check', 16)}</span>
        <span class="check-text">${esc(i.text)}${i.qty ? ` <span class="qty-tag">× ${esc(i.qty)}</span>` : ''}${i.done && i.doneBy ? `<small>Coché par ${esc(i.doneBy)}</small>` : i.by ? `<small>Ajouté par ${esc(i.by)}</small>` : ''}</span>
      </button>
      <button class="icon-btn icon-btn-sm" data-act="edit-item" data-id="${i.id}" aria-label="Modifier ${esc(i.text)}">${icon('edit', 16)}</button>
    </div>`;
  const groups = cats.map((cat) => {
    const its = l.items.filter((i) => (i.cat || '') === cat).sort((a, b) => !!a.done - !!b.done);
    return `<div class="card list-group">${cat ? `<p class="cat-title">${esc(cat)} <small>${its.filter((i) => i.done).length}/${its.length}</small></p>` : ''}${its.map(row).join('')}</div>`;
  }).join('');
  return `
    <button class="back-link" data-act="close-list">${icon('chevronLeft', 16)} Listes</button>
    <section class="hero">
      <p class="eyebrow">${KIND_LABEL[l.kind] || 'Liste'} · ${n ? `${done} / ${n}` : 'vide'}</p>
      <div class="row-between"><h1 class="title">${esc(l.name)}</h1><button class="icon-btn" data-act="list-menu" aria-label="Options de la liste">${icon('settings', 20)}</button></div>
    </section>
    ${n ? `<div class="progress mt-8"><span style="width:${Math.round((done / n) * 100)}%"></span></div>` : ''}
    <form class="add-line mt-16" data-form="add">
      <input class="input" name="text" placeholder="Ajouter un article…" autocomplete="off" enterkeyhint="done" maxlength="80">
      <button class="btn btn-primary" type="submit" aria-label="Ajouter">${icon('plus', 20)}</button>
    </form>
    <div class="mt-16">${n ? groups : `<div class="card">${emptyState('list', 'Liste vide', 'Tapez un article ci-dessus pour commencer.')}</div>`}</div>
    ${done ? `<div class="grid-2 mt-16">
      <button class="btn btn-ghost btn-sm" data-act="uncheck">Tout décocher</button>
      <button class="btn btn-ghost btn-sm" data-act="clear-done">${icon('trash', 16)} Vider les cochés</button></div>` : ''}`;
}

function editItem(l, it) {
  openSheet({
    title: 'Modifier l\'article',
    content: `
      <form class="js-form">
        <label class="field"><span>Article</span><input class="input" name="text" value="${esc(it.text)}" maxlength="80" required></label>
        <label class="field"><span>Quantité (optionnel)</span><input class="input" name="qty" value="${esc(it.qty || '')}" maxlength="12" placeholder="Ex. 2"></label>
        <div class="actions tone-salmon"><button type="button" class="btn btn-danger" data-del>${icon('trash', 18)} Supprimer</button><button class="btn btn-primary" type="submit">Enregistrer</button></div>
      </form>`,
    onMount(body, api) {
      body.querySelector('[data-del]').addEventListener('click', () => {
        const copy = { ...it };
        store.update((s) => { const x = s.lists.find((y) => y.id === l.id); if (x) x.items = x.items.filter((i) => i.id !== it.id); });
        api.close();
        toast('Article supprimé', { action: 'Annuler', onAction: () => store.update((s) => { s.lists.find((y) => y.id === l.id)?.items.push(copy); }) });
      });
      body.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target), text = String(f.get('text')).trim(), qty = String(f.get('qty')).trim();
        if (!text) return;
        store.update((s) => {
          const x = s.lists.find((y) => y.id === l.id)?.items.find((i) => i.id === it.id);
          if (x) { x.text = text; if (qty) x.qty = qty; else delete x.qty; }
        });
        api.close();
      });
    },
  });
}

function listMenu(l) {
  openSheet({
    title: 'Options de la liste',
    content: `
      <form class="js-form">
        <label class="field"><span>Nom</span><input class="input" name="name" value="${esc(l.name)}" maxlength="50" required></label>
        <div class="actions tone-salmon"><button type="button" class="btn btn-danger" data-del>${icon('trash', 18)} Supprimer</button><button class="btn btn-primary" type="submit">Enregistrer</button></div>
      </form>`,
    onMount(body, api) {
      body.querySelector('[data-del]').addEventListener('click', () => {
        const copy = JSON.parse(JSON.stringify(l));
        store.update((s) => { s.lists = s.lists.filter((x) => x.id !== l.id); });
        openId = null;
        api.close();
        toast('Liste supprimée', { action: 'Annuler', onAction: () => store.update((s) => { s.lists.push(copy); }) });
      });
      body.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = String(new FormData(e.target).get('name')).trim();
        if (!name) return;
        store.update((s) => { const x = s.lists.find((y) => y.id === l.id); if (x) x.name = name; });
        api.close();
      });
    },
  });
}

/* ---------- Interactions ---------- */
export function mount(el) {
  if (focusAdd) { focusAdd = false; $('[name=text]', el)?.focus(); }
  const S = () => store.state;
  const listOf = () => S().lists.find((l) => l.id === openId);
  const supply = (id) => S().supplies.find((i) => i.id === id);

  el.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form="add"]');
    if (!f) return;
    e.preventDefault();
    const text = f.elements.text.value.trim();
    if (!text) return;
    focusAdd = true;
    store.update((s) => { s.lists.find((l) => l.id === openId)?.items.push({ id: uid(), text, done: false, by: s.me }); });
  });

  el.addEventListener('click', (e) => {
    const sg = e.target.closest('[data-seg="ptab"]');
    if (sg) { tab = sg.dataset.v; store.refresh(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const card = b.closest('[data-id]');
    const id = b.dataset.id || card?.dataset.id;
    switch (b.dataset.act) {
      case 'new-preset': itemForm(null, sup.PRESETS[b.dataset.k]); break;
      case 'new-custom': itemForm(null, null); break;
      case 'edit': itemForm(supply(id)); break;
      case 'receive': receive(supply(id)); break;
      case 'inc': case 'dec': {
        const d = b.dataset.act === 'inc' ? 1 : -1;
        store.update((s) => { const x = s.supplies.find((y) => y.id === id); if (x) x.qty = Math.max(0, x.qty + d); });
        break;
      }
      case 'shop': {
        const it = supply(id);
        const ok = sup.addShopping(it.name);
        toast(ok ? `« ${it.name} » ajouté à la liste Courses` : `« ${it.name} » est déjà dans les courses`);
        break;
      }
      case 'new-list': newList(); break;
      case 'open-list': openId = id; window.scrollTo(0, 0); store.refresh(); break;
      case 'close-list': openId = null; tab = 'lists'; store.refresh(); break;
      case 'list-menu': listMenu(listOf()); break;
      case 'toggle':
        store.update((s) => { const x = s.lists.find((l) => l.id === openId)?.items.find((i) => i.id === id); if (x) { x.done = !x.done; if (x.done) x.doneBy = s.me; else delete x.doneBy; } });
        break;
      case 'edit-item': editItem(listOf(), listOf().items.find((i) => i.id === id)); break;
      case 'uncheck': store.update((s) => { s.lists.find((l) => l.id === openId)?.items.forEach((i) => { i.done = false; delete i.doneBy; }); }); break;
      case 'clear-done': {
        const l = listOf(), removed = l.items.filter((i) => i.done);
        store.update((s) => { const x = s.lists.find((y) => y.id === openId); if (x) x.items = x.items.filter((i) => !i.done); });
        toast(`${removed.length} article${removed.length > 1 ? 's' : ''} retiré${removed.length > 1 ? 's' : ''}`, { action: 'Annuler', onAction: () => store.update((s) => { s.lists.find((y) => y.id === l.id)?.items.push(...removed); }) });
        break;
      }
    }
  });
}
