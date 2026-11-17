import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, uid, eur, startOfDay, dayKey, toast, seg, emptyState } from '../ui.js';
import { openForm } from '../forms.js';
import { hubHeader } from './hub.js';

/*
 * Module Budget : dépenses du mois par catégorie, budget mensuel, charges fixes
 * et « qui doit quoi » entre parents (dépenses communes partagées à 50/50).
 */

export const CATS = [
  ['courses', 'Courses', 'cart', 'sage'], ['logement', 'Logement', 'home', 'slate'], ['transport', 'Transports', 'send', 'gold'],
  ['sante', 'Santé', 'stetho', 'brick'], ['enfants', 'Enfants', 'baby', 'salmon'], ['loisirs', 'Loisirs', 'sparkle', 'peach'],
  ['abos', 'Abonnements', 'clock', 'slate'], ['vacances', 'Vacances', 'plane', 'gold'], ['autre', 'Autre', 'box', 'sage'],
];
const catOf = (k) => CATS.find(([id]) => id === k) || CATS[CATS.length - 1];
const PEOPLE = ['Maman', 'Papa', 'Nounou'];

let tab = 'month';
let month = null; // 1er du mois affiché

const monthStart = (ts) => { const d = new Date(ts); d.setDate(1); return startOfDay(d); };
const nextMonth = (ts, n = 1) => { const d = new Date(ts); d.setMonth(d.getMonth() + n); return monthStart(d); };

export function monthStats(s, m0 = monthStart(Date.now())) {
  const m1 = nextMonth(m0);
  const list = (s.expenses || []).filter((e) => e.at >= m0 && e.at < m1);
  const variable = list.reduce((a, e) => a + e.amount, 0);
  const fixedTotal = (s.fixed || []).reduce((a, f) => a + f.amount, 0);
  const total = variable + fixedTotal;
  const byCat = {};
  for (const e of list) byCat[e.cat] = (byCat[e.cat] || 0) + e.amount;
  for (const f of s.fixed || []) byCat[f.cat] = (byCat[f.cat] || 0) + f.amount;
  const shared = list.filter((e) => e.shared !== false);
  const paidM = shared.filter((e) => e.by === 'Maman').reduce((a, e) => a + e.amount, 0);
  const paidP = shared.filter((e) => e.by === 'Papa').reduce((a, e) => a + e.amount, 0);
  const diff = (paidM - paidP) / 2; // > 0 : Papa doit à Maman
  const budget = s.budget?.monthly || null;
  return { list, variable, fixedTotal, total, byCat, paidM, paidP, diff, budget, left: budget ? budget - total : null };
}

export function budgetSummary(s) {
  const st = monthStats(s);
  if (!st.total) return 'Aucune dépense ce mois-ci';
  return st.budget ? `${eur(st.total)} sur ${eur(st.budget)}` : `${eur(st.total)} dépensés ce mois-ci`;
}

/* ---------- Rendu ---------- */
export function render(s) {
  if (!month) month = monthStart(Date.now());
  return `
    ${hubHeader(s, { back: true })}
    <section class="hero"><p class="eyebrow">Budget</p><h1 class="title">Dépenses de la famille</h1></section>
    <button class="btn btn-primary btn-block btn-lg" data-act="new-expense">${icon('plus', 20)} Ajouter une dépense</button>
    <div class="mt-16">${seg('btab', [['month', 'Mois'], ['list', 'Dépenses'], ['fixed', 'Charges fixes']], tab)}</div>
    <div class="mt-16">${tab === 'month' ? monthView(s) : tab === 'list' ? listView(s) : fixedView(s)}</div>`;
}

function monthNav() {
  const label = new Date(month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return `<div class="row-between">
    <button class="icon-btn icon-btn-sm" data-act="prev" aria-label="Mois précédent">${icon('chevronLeft', 18)}</button>
    <b style="text-transform:capitalize">${esc(label)}</b>
    <button class="icon-btn icon-btn-sm" data-act="next" aria-label="Mois suivant">${icon('chevronRight', 18)}</button></div>`;
}

function monthView(s) {
  const st = monthStats(s, month);
  const over = st.budget && st.total > st.budget;
  const cats = Object.entries(st.byCat).sort((a, b) => b[1] - a[1]);
  const top = cats[0]?.[1] || 1;
  return `
    ${monthNav()}
    <div class="card mt-12">
      <p class="eyebrow">Dépensé ce mois-ci</p>
      <p class="big-amount num ${over ? 'text-brick' : ''}">${eur(st.total)}</p>
      ${st.fixedTotal ? `<p class="small muted">dont ${eur(st.fixedTotal)} de charges fixes</p>` : ''}
      ${st.budget ? `
        <div class="progress mt-12 ${over ? 'is-over' : ''}"><span style="width:${Math.min(100, Math.round((st.total / st.budget) * 100))}%;${over ? 'background:var(--brick)' : ''}"></span></div>
        <p class="small mt-8 ${over ? 'text-brick' : 'muted'}">${over ? `Budget dépassé de ${eur(-st.left)}` : `Il reste ${eur(st.left)} sur ${eur(st.budget)}`}</p>`
        : `<p class="small faint mt-8">Aucun budget défini.</p>`}
      <button class="btn btn-ghost btn-sm mt-12" data-act="set-budget">${icon('settings', 16)} ${st.budget ? 'Modifier' : 'Définir'} le budget mensuel</button>
    </div>
    <div class="card mt-12">
      <p class="cat-title" style="padding-top:0">Par catégorie</p>
      ${cats.length ? cats.map(([k, v]) => { const [, label, ic, tone] = catOf(k); return `
        <div class="bar-row" style="--tone:var(--${tone})"><span><span class="dot-ic" style="width:24px;height:24px;border-radius:8px;vertical-align:middle;margin-right:8px">${icon(ic, 14)}</span>${esc(label)}</span><b class="num">${eur(v)}</b>
        <div class="bar-track"><span style="width:${Math.max(4, Math.round((v / top) * 100))}%"></span></div></div>`; }).join('') : emptyState('wallet', 'Rien ce mois-ci', 'Ajoutez une dépense pour voir la répartition.')}
    </div>
    ${balanceCard(st)}`;
}

function balanceCard(st) {
  if (!st.paidM && !st.paidP) return '';
  const owes = Math.abs(st.diff) < 0.005 ? null : st.diff > 0 ? ['Papa', 'Maman'] : ['Maman', 'Papa'];
  return `
    <div class="card mt-12">
      <p class="cat-title" style="padding-top:0">Qui doit quoi</p>
      <div class="row-between small"><span>Maman a payé</span><b class="num">${eur(st.paidM)}</b></div>
      <div class="row-between small mt-8"><span>Papa a payé</span><b class="num">${eur(st.paidP)}</b></div>
      <div class="notice tone-${owes ? 'gold' : 'sage'} mt-12">${icon(owes ? 'info' : 'check', 18)}<span class="grow" style="flex:1">${owes ? `<b>${owes[0]} doit ${eur(Math.abs(st.diff))} à ${owes[1]}</b> pour équilibrer les dépenses communes.` : '<b>Les comptes sont équilibrés.</b>'}</span></div>
    </div>`;
}

function listView(s) {
  const st = monthStats(s, month);
  const days = {};
  for (const e of [...st.list].sort((a, b) => b.at - a.at)) (days[dayKey(e.at)] ||= []).push(e);
  return `${monthNav()}
    <div class="mt-12">${st.list.length ? Object.entries(days).map(([k, es]) => `
      <div class="card list-group mt-12">
        <p class="cat-title">${esc(new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}<small class="num">${eur(es.reduce((a, e) => a + e.amount, 0))}</small></p>
        ${es.map((e) => { const [, label, ic, tone] = catOf(e.cat); return `
          <button class="entry" data-act="edit-expense" data-id="${e.id}">
            <span class="dot-ic" style="--tone:var(--${tone})">${icon(ic, 18)}</span>
            <span class="entry-body"><b>${esc(e.note || label)}</b><small>${esc(label)} · ${esc(e.by || '')}${e.shared === false ? ' · perso' : ''}</small></span>
            <span class="entry-amt num">${eur(e.amount)}</span>
          </button>`; }).join('')}
      </div>`).join('') : `<div class="card">${emptyState('wallet', 'Aucune dépense', 'Ajoutez votre première dépense avec le bouton ci-dessus.')}</div>`}</div>`;
}

function fixedView(s) {
  const total = (s.fixed || []).reduce((a, f) => a + f.amount, 0);
  return `
    <p class="small muted">Loyer, assurances, crèche, abonnements… Ces montants sont comptés chaque mois automatiquement.</p>
    <div class="card list-group mt-12">${(s.fixed || []).length ? s.fixed.map((f) => { const [, label, ic, tone] = catOf(f.cat); return `
      <button class="entry" data-act="edit-fixed" data-id="${f.id}">
        <span class="dot-ic" style="--tone:var(--${tone})">${icon(ic, 18)}</span>
        <span class="entry-body"><b>${esc(f.name)}</b><small>${esc(label)}</small></span>
        <span class="entry-amt num">${eur(f.amount)}</span></button>`; }).join('') : emptyState('clock', 'Aucune charge fixe')}</div>
    ${total ? `<p class="row-between mt-12"><b>Total par mois</b><b class="num">${eur(total)}</b></p>` : ''}
    <button class="btn btn-ghost btn-block mt-16" data-act="new-fixed">${icon('plus', 18)} Ajouter une charge fixe</button>`;
}

/* ---------- Formulaires ---------- */
const catOptions = CATS.map(([id, l]) => [id, l]);

function expenseForm(e = null) {
  const s = store.state;
  openForm({
    title: e ? 'Modifier la dépense' : 'Nouvelle dépense',
    fields: [
      { name: 'amount', label: 'Montant (€)', type: 'number', value: e?.amount ?? '', placeholder: '0,00', required: true },
      { name: 'note', label: 'Libellé', value: e?.note || '', placeholder: 'Ex. Courses Carrefour' },
      { name: 'cat', label: 'Catégorie', type: 'select', options: catOptions, value: e?.cat || 'courses' },
      { name: 'date', label: 'Date', type: 'date', value: dayKey(e?.at || Date.now()) },
      { name: 'by', label: 'Payé par', type: 'select', options: PEOPLE.map((p) => [p, p]), value: e?.by || s.me },
      { name: 'shared', label: 'Dépense commune', hint: 'Partagée 50/50 entre Maman et Papa', type: 'check', value: e ? e.shared !== false : true },
    ],
    submit: e ? 'Enregistrer' : 'Ajouter',
    onDelete: e && ((api) => {
      const copy = { ...e };
      store.update((x) => { x.expenses = x.expenses.filter((y) => y.id !== e.id); });
      api.close();
      toast('Dépense supprimée', { action: 'Annuler', onAction: () => store.update((x) => { x.expenses.push(copy); }) });
    }),
    onSubmit(v, api) {
      if (v.amount <= 0) { toast('Le montant doit être positif'); return; }
      const at = v.date ? new Date(v.date + 'T12:00:00').getTime() : Date.now();
      const data = { amount: Math.round(v.amount * 100) / 100, note: v.note, cat: v.cat, at, by: v.by, shared: v.shared };
      store.update((x) => { if (e) Object.assign(x.expenses.find((y) => y.id === e.id) || {}, data); else x.expenses.push({ id: uid(), ...data }); });
      if (!e) month = monthStart(at);
      api.close();
    },
  });
}

function fixedForm(f = null) {
  openForm({
    title: f ? 'Modifier la charge' : 'Nouvelle charge fixe',
    fields: [
      { name: 'name', label: 'Nom', value: f?.name || '', placeholder: 'Ex. Loyer, crèche…', required: true },
      { name: 'amount', label: 'Montant par mois (€)', type: 'number', value: f?.amount ?? '', required: true },
      { name: 'cat', label: 'Catégorie', type: 'select', options: catOptions, value: f?.cat || 'logement' },
    ],
    onDelete: f && ((api) => {
      const copy = { ...f };
      store.update((x) => { x.fixed = x.fixed.filter((y) => y.id !== f.id); });
      api.close();
      toast('Charge supprimée', { action: 'Annuler', onAction: () => store.update((x) => { x.fixed.push(copy); }) });
    }),
    onSubmit(v, api) {
      if (v.amount <= 0) { toast('Le montant doit être positif'); return; }
      const data = { name: v.name, amount: v.amount, cat: v.cat };
      store.update((x) => { if (f) Object.assign(x.fixed.find((y) => y.id === f.id) || {}, data); else x.fixed.push({ id: uid(), ...data }); });
      api.close();
    },
  });
}

function budgetForm() {
  openForm({
    title: 'Budget mensuel',
    subtitle: 'Ce que vous souhaitez dépenser au maximum par mois, charges fixes comprises.',
    fields: [{ name: 'monthly', label: 'Montant (€)', type: 'number', value: store.state.budget?.monthly ?? '', placeholder: 'Ex. 2500' }],
    onDelete: store.state.budget?.monthly ? ((api) => { store.update((x) => { x.budget = { monthly: null }; }); api.close(); }) : null,
    deleteLabel: 'Retirer',
    onSubmit(v, api) { store.update((x) => { x.budget = { monthly: v.monthly > 0 ? v.monthly : null }; }); api.close(); },
  });
}

/* ---------- Interactions ---------- */
export function mount(el) {
  el.addEventListener('click', (e) => {
    const sg = e.target.closest('[data-seg="btab"]');
    if (sg) { tab = sg.dataset.v; store.refresh(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const S = store.state, id = b.dataset.id;
    switch (b.dataset.act) {
      case 'new-expense': expenseForm(); break;
      case 'edit-expense': expenseForm(S.expenses.find((x) => x.id === id)); break;
      case 'new-fixed': fixedForm(); break;
      case 'edit-fixed': fixedForm(S.fixed.find((x) => x.id === id)); break;
      case 'set-budget': budgetForm(); break;
      case 'prev': month = nextMonth(month, -1); store.refresh(); break;
      case 'next': month = nextMonth(month, 1); store.refresh(); break;
    }
  });
}
