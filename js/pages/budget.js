import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, uid, eur, dayKey, startOfDay, toast, emptyState, openSheet, DAY } from '../ui.js';
import { openForm, num } from '../forms.js';
import { hubHeader } from './hub.js';
import { CATS, INCOME_CATS, catOf, guessCategory, guessIncomeCategory, normText } from '../budget/cats.js';
import { monthStats, balanceAll, pace, deltaByCat, yearStats, frequent, upcomingFixed, monthStart, addMonths, kindOf, goalSaved } from '../budget/stats.js';
import { parseReceipt } from '../budget/receipt.js';
import { parseCSV, readBankRows, readFileText, toCSV } from '../budget/csv.js';

/*
 * Module Budget : dépenses et revenus, scan de tickets de caisse, budget mensuel et par catégorie,
 * charges et revenus fixes, qui doit quoi entre parents (avec règlement), objectifs d'épargne,
 * bilan annuel, import de relevé bancaire (CSV) et export.
 */

export { CATS };
const PEOPLE = ['Maman', 'Papa', 'Nounou'];
const TABS = [['month', 'Mois'], ['list', 'Dépenses'], ['fixed', 'Fixes'], ['goals', 'Épargne'], ['year', 'Année']];

let tab = 'month';
let month = null;           // premier jour du mois affiché
let year = null;
let filter = { q: '', cat: '', by: '' };
let quickList = [];

const pad = (n) => String(n).padStart(2, '0');
const monthVal = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthTs = (v) => { const m = /^(\d{4})-(\d{2})$/.exec(v || ''); return m ? new Date(+m[1], +m[2] - 1, 1).getTime() : null; };
const frDay = (ts, o = { day: 'numeric', month: 'short' }) => new Date(ts).toLocaleDateString('fr-FR', o);
const catOptions = (kind) => (kind === 'in' ? INCOME_CATS : CATS).map(([id, l]) => [id, l]);

export function budgetSummary(s) {
  const st = monthStats(s);
  if (!st.spent && !st.income) return 'Rien de saisi ce mois-ci';
  return st.budget ? `${eur(st.spent)} sur ${eur(st.budget)}` : `${eur(st.spent)} dépensés ce mois-ci`;
}

/* ====================================================================== Rendu */
export function render(s) {
  if (!month) month = monthStart(Date.now());
  if (!year) year = new Date().getFullYear();
  return `
    ${hubHeader(s, { back: true })}
    <section class="hero"><p class="eyebrow">Budget</p><h1 class="title">Dépenses de la famille</h1></section>
    <button class="btn btn-primary btn-block btn-lg" data-act="new-expense">${icon('plus', 20)} Ajouter une dépense</button>
    <div class="grid-3 mt-12">
      <button class="btn btn-ghost btn-sm" data-act="scan">${icon('camera', 16)} Scanner un ticket</button>
      <button class="btn btn-ghost btn-sm" data-act="new-income">${icon('plus', 16)} Revenu</button>
      <button class="btn btn-ghost btn-sm" data-act="menu" aria-label="Plus d'options">${icon('more', 18)}</button>
    </div>
    <div class="tabs-row mt-16">${TABS.map(([id, l]) => `<button class="pill-btn ${tab === id ? 'is-on' : ''}" data-act="tab" data-v="${id}">${l}</button>`).join('')}</div>
    <div class="mt-16">${tab === 'month' ? monthView(s) : tab === 'list' ? listView(s) : tab === 'fixed' ? fixedView(s) : tab === 'goals' ? goalsView(s) : yearView(s)}</div>`;
}

function monthNav() {
  const label = new Date(month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return `<div class="row-between">
    <button class="icon-btn icon-btn-sm" data-act="prev" aria-label="Mois précédent">${icon('chevronLeft', 18)}</button>
    <b style="text-transform:capitalize">${esc(label)}</b>
    <button class="icon-btn icon-btn-sm" data-act="next" aria-label="Mois suivant">${icon('chevronRight', 18)}</button></div>`;
}

/* ----- Mois ----- */
function monthView(s) {
  const st = monthStats(s, month), pc = pace(s, month), delta = deltaByCat(s, month);
  const over = st.budget && st.spent > st.budget;
  const lim = st.catBudgets;
  const keys = [...new Set([...Object.keys(st.byCat), ...Object.keys(lim).filter((k) => lim[k] > 0)])].sort((a, b) => (st.byCat[b] || 0) - (st.byCat[a] || 0));
  const top = Math.max(1, ...keys.map((k) => st.byCat[k] || 0));
  quickList = pc ? frequent(s) : [];
  const warn = keys.filter((k) => lim[k] > 0 && (st.byCat[k] || 0) >= lim[k] * 0.8);

  return `
    ${monthNav()}
    <div class="card mt-12">
      <p class="eyebrow">Dépensé ce mois-ci</p>
      <p class="big-amount num ${over ? 'text-brick' : ''}">${eur(st.spent)}</p>
      ${st.fixedOutTotal ? `<p class="small muted">dont ${eur(st.fixedOutTotal)} de charges fixes</p>` : ''}
      ${st.budget ? `
        <div class="progress mt-12"><span style="width:${Math.min(100, Math.round((st.spent / st.budget) * 100))}%;${over ? 'background:var(--brick)' : ''}"></span></div>
        <p class="small mt-8 ${over ? 'text-brick' : 'muted'}">${over ? `Budget dépassé de ${eur(-st.left)}` : `Il reste ${eur(st.left)} sur ${eur(st.budget)}`}</p>`
        : `<p class="small faint mt-8">Aucun budget défini.</p>`}
      ${st.income || st.saved ? `
        <div class="mini-stats mt-16">
          <div><span class="faint">Revenus</span><b class="num text-sage">${eur(st.income)}</b></div>
          <div><span class="faint">Solde</span><b class="num ${st.balance < 0 ? 'text-brick' : 'text-sage'}">${st.balance > 0 ? '+' : ''}${eur(st.balance)}</b></div>
          <div><span class="faint">Épargné</span><b class="num">${eur(st.saved)}</b></div>
        </div>` : ''}
      <button class="btn btn-ghost btn-sm mt-12" data-act="set-budget">${icon('settings', 16)} ${st.budget ? 'Modifier' : 'Définir'} le budget mensuel</button>
    </div>
    ${pc && st.variable > 0 ? `
      <div class="grid-2 mt-12">
        <div class="card insight"><p class="eyebrow">${st.budget && pc.perDay ? 'Reste par jour' : 'Moyenne par jour'}</p><p class="num insight-v">${eur(st.budget && pc.perDay ? pc.perDay : pc.dailyAvg)}</p><p class="small muted">${st.budget && pc.perDay ? `pendant ${pc.daysLeft} jour${pc.daysLeft > 1 ? 's' : ''}` : 'dépenses hors charges fixes'}</p></div>
        <div class="card insight"><p class="eyebrow">Projection fin de mois</p><p class="num insight-v ${st.budget && pc.projection > st.budget ? 'text-brick' : ''}">${eur(pc.projection)}</p><p class="small muted">${st.budget ? (pc.projection > st.budget ? `${eur(pc.projection - st.budget)} au-dessus du budget` : 'dans le budget') : 'au rythme actuel'}</p></div>
      </div>` : ''}
    ${warn.length ? `<div class="notice tone-gold mt-12">${icon('alert', 18)}<span class="grow" style="flex:1">${warn.map((k) => { const v = st.byCat[k] || 0, c = catOf(k)[1]; return v >= lim[k] ? `<b>${esc(c)}</b> : budget dépassé` : `<b>${esc(c)}</b> : ${Math.round((v / lim[k]) * 100)} % du budget`; }).join(' · ')}</span></div>` : ''}
    ${quickList.length ? `
      <div class="mt-16"><p class="cat-title" style="padding:0 0 6px">Dépenses fréquentes</p>
      <div class="chips-row">${quickList.map((q, i) => `<button class="pill-btn" data-act="quick" data-i="${i}">${esc(q.note)} <span class="faint">${eur(q.amount)}</span></button>`).join('')}</div></div>` : ''}
    <div class="card mt-12">
      <p class="cat-title" style="padding-top:0">Par catégorie</p>
      ${keys.length ? keys.map((k) => { const v = st.byCat[k] || 0, [, label, ic, tone] = catOf(k), l = lim[k] > 0 ? lim[k] : 0, d = delta[k]; const ratio = l ? Math.min(1, v / l) : v / top; const bad = l && v >= l; return `
        <div class="bar-row" style="--tone:var(${bad ? '--brick' : '--' + tone})"><span><span class="dot-ic" style="width:24px;height:24px;border-radius:8px;vertical-align:middle;margin-right:8px">${icon(ic, 14)}</span>${esc(label)}${d !== null && d !== undefined && Math.abs(d) >= 5 ? ` <small class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '↑' : '↓'} ${Math.abs(d)} %</small>` : ''}</span><b class="num">${eur(v)}${l ? `<small class="faint"> / ${eur(l)}</small>` : ''}</b>
        <div class="bar-track"><span style="width:${Math.max(v ? 4 : 0, Math.round(ratio * 100))}%"></span></div></div>`; }).join('') : emptyState('wallet', 'Rien ce mois-ci', 'Ajoutez une dépense ou scannez un ticket de caisse.')}
      <button class="btn btn-ghost btn-sm mt-16" data-act="cat-budgets">${icon('target', 16)} Budgets par catégorie</button>
    </div>
    ${balanceCard(s)}
    ${upcomingCard(s)}`;
}

function balanceCard(s) {
  const b = balanceAll(s);
  if (!b.paidM && !b.paidP) return '';
  const owes = Math.abs(b.diff) < 0.01 ? null : b.diff > 0 ? ['Papa', 'Maman'] : ['Maman', 'Papa'];
  return `
    <div class="card mt-12">
      <p class="cat-title" style="padding-top:0">Qui doit quoi</p>
      <div class="row-between small"><span>Maman a payé</span><b class="num">${eur(b.paidM)}</b></div>
      <div class="row-between small mt-8"><span>Papa a payé</span><b class="num">${eur(b.paidP)}</b></div>
      <p class="small faint mt-8">Dépenses communes, partagées 50/50, depuis le début. Les règlements sont déduits.</p>
      <div class="notice tone-${owes ? 'gold' : 'sage'} mt-12">${icon(owes ? 'info' : 'check', 18)}<span class="grow" style="flex:1">${owes ? `<b>${owes[0]} doit ${eur(Math.abs(b.diff))} à ${owes[1]}</b> pour équilibrer les dépenses communes.` : '<b>Les comptes sont équilibrés.</b>'}</span></div>
      ${owes ? `<button class="btn btn-sm btn-primary mt-12" data-act="settle">${icon('repeat', 16)} Régler les comptes</button>` : ''}
    </div>`;
}

function upcomingCard(s) {
  const up = upcomingFixed(s);
  if (!up.length || monthStart(Date.now()) !== month) return '';
  return `
    <div class="card mt-12">
      <p class="cat-title" style="padding-top:0">Prochains prélèvements</p>
      ${up.map((f) => `<div class="row-between small mt-8"><span><b>Le ${f.day}</b> · ${esc(f.name)}</span><b class="num">${eur(f.amount)}</b></div>`).join('')}
    </div>`;
}

/* ----- Liste des opérations (recherche et filtres) ----- */
const filtering = () => !!(filter.q || filter.cat || filter.by);

function visibleOps(s) {
  const q = normText(filter.q);
  let list = (s.expenses || []);
  if (!filtering()) { const m1 = addMonths(month, 1); list = list.filter((e) => e.at >= month && e.at < m1); }
  list = list.filter((e) => (!filter.cat || e.cat === filter.cat) && (!filter.by || e.by === filter.by) && (!q || normText(`${e.note || ''} ${catOf(e.cat)[1]}`).includes(q)));
  return list.sort((a, b) => b.at - a.at);
}

function opRow(e) {
  const k = kindOf(e);
  if (k === 'settle') return `
    <button class="entry" data-act="edit-op" data-id="${e.id}"><span class="dot-ic" style="--tone:var(--sage)">${icon('repeat', 18)}</span>
      <span class="entry-body"><b>Règlement</b><small>${esc(e.from)} → ${esc(e.to)}</small></span><span class="entry-amt num">${eur(e.amount)}</span></button>`;
  const [, label, ic, tone] = catOf(e.cat);
  return `
    <button class="entry" data-act="edit-op" data-id="${e.id}">
      <span class="dot-ic" style="--tone:var(--${tone})">${icon(ic, 18)}</span>
      <span class="entry-body"><b>${esc(e.note || label)}</b><small>${esc(label)} · ${esc(e.by || '')}${k === 'out' && e.shared === false ? ' · perso' : ''}</small></span>
      <span class="entry-amt num ${k === 'in' ? 'text-sage' : ''}">${k === 'in' ? '+' : ''}${eur(e.amount)}</span>
    </button>`;
}

function listHtml(s) {
  const ops = visibleOps(s);
  const out = ops.filter((e) => kindOf(e) === 'out').reduce((a, e) => a + e.amount, 0), inc = ops.filter((e) => kindOf(e) === 'in').reduce((a, e) => a + e.amount, 0);
  const days = {};
  for (const e of ops) (days[dayKey(e.at)] ||= []).push(e);
  return `
    ${filtering() ? `<p class="small muted">${ops.length} opération${ops.length > 1 ? 's' : ''} sur toute la période · ${eur(out)} dépensés${inc ? ` · ${eur(inc)} de revenus` : ''}</p>` : ''}
    ${ops.length ? Object.entries(days).map(([k, es]) => `
      <div class="card list-group mt-12">
        <p class="cat-title">${esc(new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}<small class="num">${eur(es.filter((e) => kindOf(e) === 'out').reduce((a, e) => a + e.amount, 0))}</small></p>
        ${es.map(opRow).join('')}
      </div>`).join('') : `<div class="card mt-12">${emptyState('wallet', filtering() ? 'Aucun résultat' : 'Aucune opération', filtering() ? 'Essayez un autre mot ou retirez un filtre.' : 'Ajoutez une dépense ou scannez un ticket.')}</div>`}`;
}

function listView(s) {
  return `
    ${filtering() ? '' : monthNav()}
    <div class="add-line mt-12"><input class="input" data-filter="q" value="${esc(filter.q)}" placeholder="Rechercher (libellé, catégorie)…" autocomplete="off"></div>
    <div class="grid-2 mt-8">
      <select class="input" data-filter="cat" aria-label="Catégorie"><option value="">Catégorie</option>${[...CATS, ...INCOME_CATS].map(([id, l]) => `<option value="${id}" ${filter.cat === id ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <select class="input" data-filter="by" aria-label="Payé par"><option value="">Payeur</option>${PEOPLE.map((p) => `<option ${filter.by === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
    </div>
    <div id="bd-list">${listHtml(s)}</div>`;
}

/* ----- Charges et revenus fixes ----- */
function fixedRow(f) {
  const [, label, ic, tone] = catOf(f.cat);
  return `
    <button class="entry" data-act="edit-fixed" data-id="${f.id}">
      <span class="dot-ic" style="--tone:var(--${tone})">${icon(ic, 18)}</span>
      <span class="entry-body"><b>${esc(f.name)}</b><small>${esc(label)}${f.day ? ` · le ${f.day} du mois` : ''}${f.from ? ` · depuis ${esc(frDay(f.from, { month: 'short', year: 'numeric' }))}` : ''}${f.to ? ` · jusqu'à ${esc(frDay(f.to, { month: 'short', year: 'numeric' }))}` : ''}</small></span>
      <span class="entry-amt num ${f.kind === 'in' ? 'text-sage' : ''}">${eur(f.amount)}</span></button>`;
}
function fixedView(s) {
  const outs = (s.fixed || []).filter((f) => (f.kind || 'out') === 'out'), ins = (s.fixed || []).filter((f) => f.kind === 'in');
  const tot = (a) => a.reduce((t, f) => t + f.amount, 0);
  return `
    <p class="small muted">Loyer, crèche, assurances, abonnements, salaires… comptés automatiquement chaque mois.</p>
    <div class="card list-group mt-12"><p class="cat-title">Charges fixes<small class="num">${eur(tot(outs))} / mois</small></p>
      ${outs.length ? outs.map(fixedRow).join('') : '<p class="small faint" style="padding:6px 0 12px">Aucune charge fixe.</p>'}</div>
    <button class="btn btn-ghost btn-block mt-12" data-act="new-fixed">${icon('plus', 18)} Ajouter une charge fixe</button>
    <div class="card list-group mt-20"><p class="cat-title">Revenus fixes<small class="num">${eur(tot(ins))} / mois</small></p>
      ${ins.length ? ins.map(fixedRow).join('') : '<p class="small faint" style="padding:6px 0 12px">Aucun revenu fixe.</p>'}</div>
    <button class="btn btn-ghost btn-block mt-12" data-act="new-fixed-in">${icon('plus', 18)} Ajouter un revenu fixe</button>`;
}

/* ----- Objectifs d'épargne ----- */
function goalsView(s) {
  const goals = s.goals || [];
  const card = (g) => {
    const saved = goalSaved(g), pct = g.target > 0 ? Math.min(100, Math.round((saved / g.target) * 100)) : 0, left = Math.max(0, g.target - saved);
    let hint = '';
    if (left <= 0) hint = 'Objectif atteint';
    else if (g.deadline) {
      const months = Math.max(1, Math.round((g.deadline - Date.now()) / (30.4 * DAY)));
      hint = g.deadline < Date.now() ? 'Date dépassée' : `${eur(Math.ceil(left / months))} par mois pendant ${months} mois`;
    }
    return `
    <article class="card goal" data-id="${g.id}">
      <button class="goal-main" data-act="open-goal" data-id="${g.id}">
        <span class="row-between"><b>${esc(g.name)}</b><b class="num">${eur(saved)}<small class="faint"> / ${eur(g.target)}</small></b></span>
        <span class="progress mt-8"><span style="width:${pct}%"></span></span>
        <span class="small muted mt-8" style="display:block">${pct} % · ${left > 0 ? `il reste ${eur(left)}` : 'bravo !'}${hint ? ` · ${hint}` : ''}</span>
      </button>
    </article>`;
  };
  return `
    <p class="small muted">Mettez de côté pour un projet : vacances, travaux, fonds d'urgence…</p>
    <div class="stack mt-12" style="gap:10px">${goals.length ? goals.map(card).join('') : `<div class="card">${emptyState('target', "Aucun objectif", "Créez un objectif et ajoutez-y de l'argent mis de côté.")}</div>`}</div>
    <button class="btn btn-primary btn-block mt-16" data-act="new-goal">${icon('plus', 18)} Nouvel objectif</button>`;
}

/* ----- Bilan de l'année ----- */
function yearView(s) {
  const ys = yearStats(s, year), mx = Math.max(1, ...ys.months.map((m) => Math.max(m.spent, m.income)));
  const W = 336, H = 130, bw = 10, gap = (W - 12 * bw * 2) / 12;
  const letters = 'JFMAMJJASOND';
  const bars = ys.months.map((m, i) => {
    const x = i * (bw * 2 + gap) + gap / 2, h1 = Math.round((m.spent / mx) * (H - 22)), h2 = Math.round((m.income / mx) * (H - 22));
    return `<g opacity="${m.future ? 0.35 : 1}"><rect x="${x}" y="${H - 16 - h1}" width="${bw}" height="${Math.max(h1, m.spent ? 2 : 0)}" rx="2.5" style="fill:var(--salmon)"/><rect x="${x + bw + 1}" y="${H - 16 - h2}" width="${bw}" height="${Math.max(h2, m.income ? 2 : 0)}" rx="2.5" style="fill:var(--sage)"/><text x="${x + bw}" y="${H - 3}" text-anchor="middle" font-size="9" style="fill:var(--text-3)">${letters[i]}</text></g>`;
  }).join('');
  const cats = Object.entries(ys.byCat).sort((a, b) => b[1] - a[1]).slice(0, 6), top = cats[0]?.[1] || 1;
  const name = (m) => new Date(m.m0).toLocaleDateString('fr-FR', { month: 'long' });
  return `
    <div class="row-between">
      <button class="icon-btn icon-btn-sm" data-act="year-prev" aria-label="Année précédente">${icon('chevronLeft', 18)}</button><b class="num">${year}</b>
      <button class="icon-btn icon-btn-sm" data-act="year-next" aria-label="Année suivante">${icon('chevronRight', 18)}</button></div>
    <div class="grid-2 mt-12">
      <div class="card insight"><p class="eyebrow">Dépenses</p><p class="num insight-v">${eur(ys.spent)}</p></div>
      <div class="card insight"><p class="eyebrow">Revenus</p><p class="num insight-v text-sage">${eur(ys.income)}</p></div>
      <div class="card insight"><p class="eyebrow">Solde</p><p class="num insight-v ${ys.balance < 0 ? 'text-brick' : 'text-sage'}">${ys.balance > 0 ? '+' : ''}${eur(ys.balance)}</p></div>
      <div class="card insight"><p class="eyebrow">Moyenne / mois</p><p class="num insight-v">${eur(ys.avg)}</p></div>
    </div>
    <div class="card mt-12"><p class="cat-title" style="padding-top:0">Mois par mois</p>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Dépenses et revenus par mois">${bars}</svg>
      <p class="small faint mt-8"><span class="legend" style="--c:var(--salmon)"></span>Dépenses <span class="legend" style="--c:var(--sage);margin-left:12px"></span>Revenus</p>
      ${ys.hi ? `<p class="small muted mt-8">Mois le plus cher : <b>${esc(name(ys.hi))}</b> (${eur(ys.hi.spent)})${ys.lo && ys.lo !== ys.hi ? ` · le plus économe : <b>${esc(name(ys.lo))}</b> (${eur(ys.lo.spent)})` : ''}</p>` : ''}
    </div>
    <div class="card mt-12"><p class="cat-title" style="padding-top:0">Où part l'argent</p>
      ${cats.length ? cats.map(([k, v]) => { const [, label, ic, tone] = catOf(k); return `<div class="bar-row" style="--tone:var(--${tone})"><span><span class="dot-ic" style="width:24px;height:24px;border-radius:8px;vertical-align:middle;margin-right:8px">${icon(ic, 14)}</span>${esc(label)}</span><b class="num">${eur(v)}</b><div class="bar-track"><span style="width:${Math.max(4, Math.round((v / top) * 100))}%"></span></div></div>`; }).join('') : emptyState('chart', 'Pas encore de données', 'Les chiffres de l\'année apparaîtront ici.')}
    </div>`;
}

/* ================================================================ Formulaires */
function expenseForm(e = null, preset = null, extras = {}) {
  const s = store.state, isNew = !e, v = e || preset || {};
  const names = [...new Set((s.expenses || []).filter((x) => kindOf(x) === 'out' && x.note).sort((a, b) => b.at - a.at).map((x) => x.note))].slice(0, 40);
  let catTouched = !!v.cat;
  openForm({
    title: e ? 'Modifier la dépense' : extras.title || 'Nouvelle dépense', subtitle: extras.subtitle || '',
    header: extras.header || '',
    fields: [
      { name: 'amount', label: 'Montant (€)', type: 'number', value: v.amount ?? '', placeholder: '0,00', required: true },
      { name: 'note', label: 'Libellé', value: v.note || '', placeholder: 'Ex. Courses Carrefour', list: names },
      { name: 'cat', label: 'Catégorie', type: 'select', options: catOptions('out'), value: v.cat || 'courses' },
      { name: 'date', label: 'Date', type: 'date', value: dayKey(v.at || Date.now()) },
      { name: 'by', label: 'Payé par', type: 'select', options: PEOPLE.map((p) => [p, p]), value: v.by || s.me },
      { name: 'shared', label: 'Dépense commune', hint: 'Partagée 50/50 entre Maman et Papa', type: 'check', value: v.shared !== false },
    ],
    submit: e ? 'Enregistrer' : 'Ajouter',
    extra: e ? [{ label: 'Dupliquer', icon: 'repeat', onClick: (api, f) => { api.close(); expenseForm(null, { ...e, at: Date.now() }); } }] : [],
    afterMount(body) {
      const form = body.querySelector('form');
      form.elements.cat.addEventListener('change', () => { catTouched = true; });
      form.elements.note.addEventListener('change', () => { if (catTouched) return; const g = guessCategory(form.elements.note.value, store.state); if (g) form.elements.cat.value = g; });
      extras.afterMount?.(body);
      if (preset?.amount && isNew) form.elements.amount.select?.();
    },
    onDelete: e && ((api) => removeOp(e, api)),
    onSubmit(f, api) {
      if (f.amount <= 0) { toast('Le montant doit être positif'); return; }
      const at = f.date ? new Date(f.date + 'T12:00:00').getTime() : Date.now();
      const data = { amount: Math.round(f.amount * 100) / 100, note: f.note, cat: f.cat, at, by: f.by, shared: f.shared, kind: 'out' };
      let id = null;
      store.update((x) => { if (e) Object.assign(x.expenses.find((y) => y.id === e.id) || {}, data); else { id = uid(); x.expenses.push({ id, ...data }); } });
      if (isNew) month = monthStart(at);
      api.close();
      if (isNew) toast(`${eur(data.amount)} ajoutés`, { action: 'Annuler', onAction: () => store.update((x) => { x.expenses = x.expenses.filter((y) => y.id !== id); }) });
    },
  });
}

function incomeForm(e = null) {
  const s = store.state;
  openForm({
    title: e ? 'Modifier le revenu' : 'Nouveau revenu',
    fields: [
      { name: 'amount', label: 'Montant (€)', type: 'number', value: e?.amount ?? '', required: true },
      { name: 'note', label: 'Libellé', value: e?.note || '', placeholder: 'Ex. Salaire, allocations…' },
      { name: 'cat', label: 'Catégorie', type: 'select', options: catOptions('in'), value: e?.cat || 'salaire' },
      { name: 'date', label: 'Date', type: 'date', value: dayKey(e?.at || Date.now()) },
      { name: 'by', label: 'Reçu par', type: 'select', options: PEOPLE.map((p) => [p, p]), value: e?.by || s.me },
    ],
    submit: e ? 'Enregistrer' : 'Ajouter',
    afterMount(body) { const f = body.querySelector('form'); f.elements.note.addEventListener('change', () => { if (!e) f.elements.cat.value = guessIncomeCategory(f.elements.note.value); }); },
    onDelete: e && ((api) => removeOp(e, api)),
    onSubmit(f, api) {
      if (f.amount <= 0) { toast('Le montant doit être positif'); return; }
      const at = f.date ? new Date(f.date + 'T12:00:00').getTime() : Date.now();
      const data = { amount: Math.round(f.amount * 100) / 100, note: f.note, cat: f.cat, at, by: f.by, kind: 'in' };
      store.update((x) => { if (e) Object.assign(x.expenses.find((y) => y.id === e.id) || {}, data); else x.expenses.push({ id: uid(), ...data }); });
      if (!e) month = monthStart(at);
      api.close();
    },
  });
}

function removeOp(e, api) {
  const copy = { ...e };
  store.update((x) => { x.expenses = x.expenses.filter((y) => y.id !== e.id); });
  api.close();
  toast('Supprimé', { action: 'Annuler', onAction: () => store.update((x) => { x.expenses.push(copy); }) });
}

function fixedForm(f = null, kind = 'out') {
  kind = f?.kind || kind;
  openForm({
    title: f ? 'Modifier' : kind === 'in' ? 'Nouveau revenu fixe' : 'Nouvelle charge fixe',
    fields: [
      { name: 'name', label: 'Nom', value: f?.name || '', placeholder: kind === 'in' ? 'Ex. Salaire de Maman' : 'Ex. Loyer, crèche…', required: true },
      { name: 'amount', label: 'Montant par mois (€)', type: 'number', value: f?.amount ?? '', required: true },
      { name: 'cat', label: 'Catégorie', type: 'select', options: catOptions(kind), value: f?.cat || (kind === 'in' ? 'salaire' : 'logement') },
      { name: 'day', label: 'Jour du mois', type: 'number', value: f?.day ?? '', hint: '(optionnel, 1 à 31)' },
      { name: 'from', label: 'À partir de', type: 'month', value: monthVal(f?.from || monthStart(Date.now())) },
      { name: 'to', label: "Jusqu'à", type: 'month', value: f?.to ? monthVal(f.to) : '', hint: '(optionnel, laisser vide si sans fin)' },
    ],
    onDelete: f && ((api) => {
      const copy = { ...f };
      store.update((x) => { x.fixed = x.fixed.filter((y) => y.id !== f.id); });
      api.close();
      toast('Supprimé', { action: 'Annuler', onAction: () => store.update((x) => { x.fixed.push(copy); }) });
    }),
    onSubmit(v, api) {
      if (v.amount <= 0) { toast('Le montant doit être positif'); return; }
      const day = v.day && v.day >= 1 && v.day <= 31 ? Math.round(v.day) : null;
      const data = { name: v.name, amount: v.amount, cat: v.cat, kind, ...(day ? { day } : {}), from: monthTs(v.from) || monthStart(Date.now()), ...(monthTs(v.to) ? { to: monthTs(v.to) } : {}) };
      store.update((x) => {
        if (f) { const t = x.fixed.find((y) => y.id === f.id); if (t) { delete t.day; delete t.to; Object.assign(t, data); } } else x.fixed.push({ id: uid(), ...data });
      });
      api.close();
    },
  });
}

function budgetForm() {
  openForm({
    title: 'Budget mensuel', subtitle: 'Le maximum que vous souhaitez dépenser par mois, charges fixes comprises.',
    fields: [{ name: 'monthly', label: 'Montant (€)', type: 'number', value: store.state.budget?.monthly ?? '', placeholder: 'Ex. 2500' }],
    onDelete: store.state.budget?.monthly ? ((api) => { store.update((x) => { x.budget = { ...(x.budget || {}), monthly: null }; }); api.close(); }) : null, deleteLabel: 'Retirer',
    onSubmit(v, api) { store.update((x) => { x.budget = { ...(x.budget || {}), monthly: v.monthly > 0 ? v.monthly : null }; }); api.close(); },
  });
}

function catBudgetsForm() {
  const cur = store.state.budget?.cats || {};
  openForm({
    title: 'Budgets par catégorie', subtitle: "Un plafond mensuel par catégorie (laisser vide = sans limite). L'app vous prévient à 80 %.",
    fields: CATS.map(([id, l]) => ({ name: 'c_' + id, label: l, type: 'number', value: cur[id] ?? '', placeholder: 'Sans limite' })),
    onSubmit(v, api) {
      const cats = {}; for (const [id] of CATS) if (v['c_' + id] > 0) cats[id] = v['c_' + id];
      store.update((x) => { x.budget = { ...(x.budget || {}), cats }; }); api.close();
    },
  });
}

function settleForm() {
  const b = balanceAll(store.state), debtor = b.diff > 0 ? 'Papa' : 'Maman';
  openForm({
    title: 'Régler les comptes', subtitle: `${debtor} rembourse l'autre parent. Cela équilibre les dépenses communes.`,
    fields: [
      { name: 'amount', label: 'Montant remboursé (€)', type: 'number', value: Math.abs(b.diff).toFixed(2).replace('.', ','), required: true },
      { name: 'from', label: 'Qui rembourse', type: 'select', options: [['Papa', 'Papa'], ['Maman', 'Maman']], value: debtor },
    ],
    submit: 'Enregistrer le règlement',
    onSubmit(f, api) {
      if (f.amount <= 0) { toast('Le montant doit être positif'); return; }
      const to = f.from === 'Papa' ? 'Maman' : 'Papa';
      store.update((x) => { x.expenses.push({ id: uid(), kind: 'settle', at: Date.now(), amount: Math.round(f.amount * 100) / 100, from: f.from, to, by: x.me, cat: 'autre' }); });
      api.close(); toast('Règlement enregistré');
    },
  });
}

function goalForm(g = null) {
  openForm({
    title: g ? "Modifier l'objectif" : 'Nouvel objectif',
    fields: [
      { name: 'name', label: 'Nom', value: g?.name || '', placeholder: 'Ex. Vacances d\'été, fonds d\'urgence…', required: true },
      { name: 'target', label: 'Montant à atteindre (€)', type: 'number', value: g?.target ?? '', required: true },
      ...(g ? [] : [{ name: 'initial', label: 'Déjà de côté (€)', type: 'number', value: '', hint: '(optionnel)' }]),
      { name: 'deadline', label: 'Pour le', type: 'date', value: g?.deadline ? dayKey(g.deadline) : '', hint: '(optionnel)' },
    ],
    submit: g ? 'Enregistrer' : 'Créer',
    onDelete: g && ((api) => {
      if (!confirm(`Supprimer l'objectif « ${g.name} » ?`)) return;
      const copy = JSON.parse(JSON.stringify(g));
      store.update((x) => { x.goals = x.goals.filter((y) => y.id !== g.id); });
      api.close();
      toast('Objectif supprimé', { action: 'Annuler', onAction: () => store.update((x) => { x.goals.push(copy); }) });
    }),
    onSubmit(f, api) {
      if (f.target <= 0) { toast('Le montant à atteindre doit être positif'); return; }
      const deadline = f.deadline ? new Date(f.deadline + 'T12:00:00').getTime() : null;
      store.update((x) => {
        x.goals = x.goals || [];
        if (g) { const t = x.goals.find((y) => y.id === g.id); if (t) { t.name = f.name; t.target = f.target; if (deadline) t.deadline = deadline; else delete t.deadline; } }
        else x.goals.push({ id: uid(), name: f.name, target: f.target, initial: f.initial > 0 ? f.initial : 0, ...(deadline ? { deadline } : {}), hist: [] });
      });
      api.close();
    },
  });
}

function goalSheet(id) {
  const find = () => (store.state.goals || []).find((g) => g.id === id);
  if (!find()) return;
  openSheet({
    title: find().name, subtitle: 'Épargne',
    onMount(body, api) {
      const draw = () => {
        const g = find(); if (!g) { api.close(); return; }
        const saved = goalSaved(g), pct = g.target > 0 ? Math.min(100, Math.round((saved / g.target) * 100)) : 0;
        body.innerHTML = `
          <p class="big-amount num">${eur(saved)}</p>
          <p class="small muted">sur ${eur(g.target)} · ${pct} %${g.deadline ? ` · pour le ${esc(frDay(g.deadline, { day: 'numeric', month: 'long', year: 'numeric' }))}` : ''}</p>
          <div class="progress mt-12"><span style="width:${pct}%"></span></div>
          <form class="add-line mt-16" data-form="contrib"><input class="input" name="amount" inputmode="decimal" placeholder="Montant (€)" autocomplete="off"><button class="btn btn-primary" type="submit" name="add" value="1" aria-label="Mettre de côté">${icon('plus', 20)}</button><button class="btn btn-ghost" type="submit" name="sub" value="1" aria-label="Retirer" style="width:52px;padding:0">${icon('minus', 20)}</button></form>
          <p class="small faint mt-8">+ pour mettre de côté, − pour reprendre de l'argent.</p>
          ${(g.hist || []).length ? `<div class="card list-group mt-16"><p class="cat-title">Historique</p>${[...g.hist].sort((a, b) => b.at - a.at).slice(0, 12).map((h) => `
            <div class="li-row"><span class="plain-item"><span class="check-text">${h.amount > 0 ? '+' : ''}${eur(h.amount)}<small>${esc(frDay(h.at, { day: 'numeric', month: 'long', year: 'numeric' }))} · ${esc(h.by || '')}</small></span></span><button class="icon-btn icon-btn-sm" data-del="${h.id}" aria-label="Supprimer">${icon('x', 16)}</button></div>`).join('')}</div>` : ''}
          <button class="btn btn-ghost btn-block mt-16" data-edit>${icon('edit', 16)} Modifier l'objectif</button>`;
      };
      body.addEventListener('submit', (e) => {
        const f = e.target.closest('[data-form=contrib]'); if (!f) return; e.preventDefault();
        const v = num(f.elements.amount.value); if (!v || v <= 0) { toast('Indiquez un montant'); return; }
        const amount = (e.submitter?.name === 'sub' ? -1 : 1) * Math.round(v * 100) / 100;
        store.update((x) => { const g = x.goals.find((y) => y.id === id); (g.hist ||= []).push({ id: uid(), at: Date.now(), amount, by: x.me }); });
        draw(); toast(amount > 0 ? `${eur(amount)} mis de côté` : `${eur(-amount)} repris`);
      });
      body.addEventListener('click', (e) => {
        const d = e.target.closest('[data-del]');
        if (d) { store.update((x) => { const g = x.goals.find((y) => y.id === id); g.hist = g.hist.filter((h) => h.id !== d.dataset.del); }); draw(); return; }
        if (e.target.closest('[data-edit]')) { const g = find(); api.close(); setTimeout(() => goalForm(g), 300); }
      });
      draw();
    },
  });
}

/* ============================================================ Scan de ticket */
function openScan() {
  openSheet({
    title: 'Scanner un ticket', subtitle: "La lecture se fait sur votre téléphone : la photo n'est envoyée nulle part.",
    onMount(body, api) {
      let closed = false; const origClose = api.close; api.close = () => { closed = true; origClose(); };
      body.innerHTML = `
        <div class="stack">
          <label class="btn btn-primary btn-block btn-lg">${icon('camera', 20)} Prendre une photo<input type="file" accept="image/*" capture="environment" hidden data-scan></label>
          <label class="btn btn-ghost btn-block">${icon('upload', 18)} Choisir une image<input type="file" accept="image/*" hidden data-scan></label>
        </div>
        <ul class="small muted mt-16" style="padding-left:18px;line-height:1.6">
          <li>Posez le ticket à plat, bien éclairé, sans ombre.</li>
          <li>Cadrez tout le ticket, surtout la ligne du <b>total</b>.</li>
          <li>Vous pourrez corriger le montant, la date et la catégorie avant d'enregistrer.</li>
        </ul>`;
      const fail = (msg) => { body.innerHTML = `<div class="notice tone-brick">${icon('alert', 20)}<span class="grow" style="flex:1">${esc(msg)}</span></div><button class="btn btn-primary btn-block mt-16" data-manual>Saisir à la main</button>`; body.querySelector('[data-manual]').addEventListener('click', () => { api.close(); setTimeout(() => expenseForm(), 300); }); };
      body.addEventListener('change', async (e) => {
        const file = e.target.matches('[data-scan]') && e.target.files[0]; if (!file) return;
        const url = URL.createObjectURL(file);
        body.innerHTML = `<img src="${url}" alt="Ticket" class="scan-preview"><p class="small muted mt-12" data-status>Préparation de l'image…</p><div class="progress mt-8"><span data-bar style="width:6%"></span></div><p class="small faint mt-8">Au premier scan, le lecteur se charge (quelques secondes). Ensuite c'est instantané.</p>`;
        const status = body.querySelector('[data-status]'), bar = body.querySelector('[data-bar]');
        try {
          const { readReceipt } = await import('../budget/ocr.js');
          const text = await readReceipt(file, (m) => {
            if (closed) return;
            const map = { preparing: "Préparation de l'image…", 'loading tesseract core': 'Chargement du lecteur…', 'initializing tesseract': 'Chargement du lecteur…', 'loading language traineddata': 'Chargement de la langue…', 'initializing api': 'Chargement du lecteur…', 'recognizing text': 'Lecture du ticket…' };
            if (status) status.textContent = map[m.status] || 'Lecture…';
            if (bar) bar.style.width = `${m.status === 'recognizing text' ? 40 + Math.round(m.progress * 58) : m.status === 'preparing' ? 6 : 25}%`;
          });
          URL.revokeObjectURL(url);
          if (closed) return;
          const r = parseReceipt(text, Date.now(), store.state);
          if (!text.trim()) return fail("Je n'ai rien pu lire sur cette image. Essayez une photo plus nette et mieux éclairée.");
          api.close(); setTimeout(() => reviewReceipt(r, text), 300);
        } catch (err) {
          console.warn('Scan impossible', err);
          if (!closed) fail("La lecture du ticket n'est pas disponible sur cet appareil ou hors connexion la première fois. Vous pouvez saisir la dépense à la main.");
        }
      });
    },
  });
}

function reviewReceipt(r, text) {
  const cands = r.candidates.slice(0, 6);
  const header = `
    <div class="notice tone-${r.weak ? 'gold' : 'sage'}">${icon(r.weak ? 'alert' : 'check', 18)}<span class="grow" style="flex:1"><b>${r.weak ? 'Ticket lu, à vérifier' : 'Ticket lu'}</b>${r.merchant ? ` · ${esc(r.merchant)}` : ''}${r.date ? ` · ${esc(frDay(r.date, { day: 'numeric', month: 'long' }))}` : ''}.${r.weak ? ' Je ne suis pas sûr du total : choisissez-le ci-dessous.' : ' Vérifiez avant d\'enregistrer.'}${r.date ? '' : ' Date non trouvée : aujourd\'hui par défaut.'}</span></div>
    ${cands.length ? `<p class="label mt-16">Montants trouvés <small class="faint">(touchez le bon total)</small></p><div class="chips mt-8">${cands.map((n) => `<button type="button" class="chip ${n === r.total ? 'is-on' : ''}" data-amt="${n}">${eur(n)}</button>`).join('')}</div>` : ''}
    <details class="mt-12 mb-16"><summary class="small faint">Voir le texte lu</summary><pre class="receipt-text">${esc(text.trim())}</pre></details>`;
  expenseForm(null, { amount: r.total ?? '', note: r.merchant, cat: r.category || undefined, at: r.date || Date.now() },
    { title: 'Ticket analysé', subtitle: 'Corrigez si besoin, puis enregistrez.', header,
      afterMount(body) {
        const f = body.querySelector('form');
        body.querySelectorAll('[data-amt]').forEach((b) => b.addEventListener('click', () => {
          f.elements.amount.value = String(b.dataset.amt).replace('.', ',');
          body.querySelectorAll('[data-amt]').forEach((x) => x.classList.toggle('is-on', x === b));
        }));
      } });
}

/* ====================================================== Import / export CSV */
const tidyLabel = (l) => l.replace(/\b(paiement par carte|paiement cb|carte|cb|prlv|prelevement|pr[eé]l[eè]vement|vir|virement|vir sepa|vir inst|achat)\b/gi, ' ').replace(/\bX\d{4}\b/gi, ' ').replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 50);

function openImport() {
  openSheet({
    title: 'Importer un relevé bancaire', subtitle: "Fichier CSV exporté depuis votre banque. Le traitement se fait sur votre téléphone.",
    onMount(body, api) {
      let ops = [], invert = false, shared = true;
      const key = (at, amount, label) => `${dayKey(at)}|${Math.abs(amount).toFixed(2)}|${normText(label)}`;
      const draw = () => {
        const n = ops.filter((o) => o.on).length;
        body.innerHTML = `
          <div class="row-between"><label class="switch"><input type="checkbox" data-invert ${invert ? 'checked' : ''}><span class="track"></span>Inverser les signes</label></div>
          <div class="row-between mt-8"><label class="switch"><input type="checkbox" data-shared ${shared ? 'checked' : ''}><span class="track"></span>Dépenses communes</label></div>
          <p class="small faint mt-8">${ops.length} opérations lues. Les doublons déjà présents sont décochés.</p>
          <div class="card list-group mt-12" style="max-height:46vh;overflow:auto">${ops.map((o, i) => { const amt = invert ? -o.amount : o.amount, out = amt < 0; return `
            <div class="imp-row ${o.dup ? 'is-dup' : ''}">
              <label class="imp-check"><input type="checkbox" data-on="${i}" ${o.on ? 'checked' : ''}></label>
              <span class="imp-main"><b>${esc(o.note || '—')}</b><small>${esc(frDay(o.at, { day: 'numeric', month: 'short' }))}${o.dup ? ' · déjà présent' : ''}</small></span>
              <span class="imp-side"><b class="num ${out ? '' : 'text-sage'}">${out ? '' : '+'}${eur(Math.abs(amt))}</b>
                <select class="input input-sm" data-cat="${i}">${catOptions(out ? 'out' : 'in').map(([id, l]) => `<option value="${id}" ${o.cat === id || (!catOptions(out ? 'out' : 'in').some(([x]) => x === o.cat) && id === (out ? 'autre' : 'autre_in')) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></span>
            </div>`; }).join('')}</div>
          <button class="btn btn-primary btn-block btn-lg mt-16" data-go ${n ? '' : 'disabled'}>Importer ${n} opération${n > 1 ? 's' : ''}</button>`;
      };
      const classify = () => { for (const o of ops) { const out = (invert ? -o.amount : o.amount) < 0; o.cat = out ? (guessCategory(o.note, store.state) || 'autre') : guessIncomeCategory(o.note); } };
      body.innerHTML = `<label class="btn btn-primary btn-block btn-lg">${icon('upload', 20)} Choisir le fichier CSV<input type="file" accept=".csv,text/csv,text/plain" hidden data-file></label>
        <p class="small muted mt-16">Colonnes reconnues : <b>date</b>, <b>libellé</b> et <b>montant</b> (ou débit / crédit). La plupart des banques proposent cet export dans l'historique des opérations.</p>`;
      body.addEventListener('change', async (e) => {
        if (e.target.matches('[data-file]')) {
          const file = e.target.files[0]; if (!file) return;
          try {
            const { ops: raw, error } = readBankRows(parseCSV(await readFileText(file)));
            if (error) { toast(error); return; }
            const have = new Set((store.state.expenses || []).map((x) => key(x.at, x.amount, x.note)));
            ops = raw.map((o) => ({ at: o.at, amount: o.amount, note: tidyLabel(o.label) || o.label, raw: o.label, on: true }));
            for (const o of ops) { o.dup = have.has(key(o.at, o.amount, o.note)); o.on = !o.dup; }
            classify(); draw();
          } catch { toast('Fichier illisible'); }
        } else if (e.target.matches('[data-invert]')) { invert = e.target.checked; classify(); draw(); }
        else if (e.target.matches('[data-shared]')) shared = e.target.checked;
        else if (e.target.matches('[data-on]')) ops[+e.target.dataset.on].on = e.target.checked, draw();
        else if (e.target.matches('[data-cat]')) ops[+e.target.dataset.cat].cat = e.target.value;
      });
      body.addEventListener('click', (e) => {
        if (!e.target.closest('[data-go]')) return;
        const chosen = ops.filter((o) => o.on); let latest = 0;
        store.update((x) => {
          for (const o of chosen) {
            const amt = invert ? -o.amount : o.amount, out = amt < 0;
            x.expenses.push({ id: uid(), at: o.at, amount: Math.abs(amt), note: o.note, cat: o.cat, by: x.me, kind: out ? 'out' : 'in', ...(out ? { shared } : {}) });
            latest = Math.max(latest, o.at);
          }
        });
        if (latest) month = monthStart(latest);
        api.close(); toast(`${chosen.length} opération${chosen.length > 1 ? 's' : ''} importée${chosen.length > 1 ? 's' : ''}`);
      });
    },
  });
}

function exportCSV(scope) {
  const s = store.state, m0 = monthStart(Date.now());
  const inScope = (e) => scope === 'all' || (scope === 'year' ? new Date(e.at).getFullYear() === new Date().getFullYear() : e.at >= m0 && e.at < addMonths(m0, 1));
  const rows = [['Date', 'Libellé', 'Montant', 'Catégorie', 'Type', 'Payé par', 'Commune']];
  for (const e of [...(s.expenses || [])].filter(inScope).sort((a, b) => a.at - b.at)) {
    const k = kindOf(e);
    rows.push([dayKey(e.at), k === 'settle' ? `Règlement ${e.from} → ${e.to}` : e.note || catOf(e.cat)[1], (k === 'out' ? -e.amount : e.amount).toFixed(2).replace('.', ','), k === 'settle' ? '' : catOf(e.cat)[1], k === 'out' ? 'Dépense' : k === 'in' ? 'Revenu' : 'Règlement', e.by || '', k === 'out' ? (e.shared === false ? 'non' : 'oui') : '']);
  }
  if (rows.length === 1) { toast('Rien à exporter sur cette période'); return; }
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `budget-${scope === 'month' ? monthVal(m0) : scope === 'year' ? new Date().getFullYear() : 'complet'}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`${rows.length - 1} opérations exportées`);
}

function menuSheet() {
  openSheet({
    title: 'Plus d\'options', 
    onMount(body, api) {
      const item = (act, ic, t, d) => `<button class="entry" data-m="${act}"><span class="dot-ic" style="--tone:var(--slate)">${icon(ic, 18)}</span><span class="entry-body"><b>${t}</b><small>${d}</small></span></button>`;
      body.innerHTML = `<div class="card list-group">
        ${item('cats', 'target', 'Budgets par catégorie', 'Un plafond mensuel et des alertes à 80 %')}
        ${item('import', 'upload', 'Importer un relevé bancaire', 'Fichier CSV de votre banque, avec catégories automatiques')}
        ${item('exp-month', 'download', 'Exporter ce mois (CSV)', 'Pour Excel, Numbers ou Google Sheets')}
        ${item('exp-year', 'download', 'Exporter cette année (CSV)', 'Toutes les opérations de l\'année')}
        ${item('exp-all', 'download', 'Tout exporter (CSV)', 'Sauvegarde de toutes les opérations')}</div>`;
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const m = b.dataset.m; api.close();
        setTimeout(() => ({ cats: catBudgetsForm, import: openImport, 'exp-month': () => exportCSV('month'), 'exp-year': () => exportCSV('year'), 'exp-all': () => exportCSV('all') })[m](), 300);
      });
    },
  });
}

/* ============================================================ Interactions */
export function mount(el) {
  el.addEventListener('input', (e) => {
    const f = e.target.closest('[data-filter]'); if (!f) return;
    filter[f.dataset.filter] = f.value;
    const box = el.querySelector('#bd-list'); if (box) box.innerHTML = listHtml(store.state);
  });
  el.addEventListener('change', (e) => {
    const f = e.target.closest('select[data-filter]'); if (!f) return;
    filter[f.dataset.filter] = f.value; store.refresh();
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const S = store.state, id = b.dataset.id;
    switch (b.dataset.act) {
      case 'tab': tab = b.dataset.v; store.refresh(); break;
      case 'new-expense': expenseForm(); break;
      case 'new-income': incomeForm(); break;
      case 'scan': openScan(); break;
      case 'menu': menuSheet(); break;
      case 'quick': { const q = quickList[+b.dataset.i]; if (q) expenseForm(null, { amount: q.amount, note: q.note, cat: q.cat, shared: q.shared }); break; }
      case 'edit-op': { const o = S.expenses.find((x) => x.id === id); if (!o) break; if (kindOf(o) === 'in') incomeForm(o); else if (kindOf(o) === 'out') expenseForm(o); else if (confirm(`Supprimer ce règlement de ${eur(o.amount)} ?`)) { store.update((x) => { x.expenses = x.expenses.filter((y) => y.id !== id); }); toast('Règlement supprimé'); } break; }
      case 'new-fixed': fixedForm(null, 'out'); break;
      case 'new-fixed-in': fixedForm(null, 'in'); break;
      case 'edit-fixed': fixedForm(S.fixed.find((x) => x.id === id)); break;
      case 'set-budget': budgetForm(); break;
      case 'cat-budgets': catBudgetsForm(); break;
      case 'settle': settleForm(); break;
      case 'new-goal': goalForm(); break;
      case 'open-goal': goalSheet(id); break;
      case 'prev': month = addMonths(month, -1); store.refresh(); break;
      case 'next': month = addMonths(month, 1); store.refresh(); break;
      case 'year-prev': year--; store.refresh(); break;
      case 'year-next': year++; store.refresh(); break;
    }
  });
}
