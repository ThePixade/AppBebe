import { store, moduleOn } from '../store.js';
import { icon } from '../icons.js';
import { esc, uid, eur, startOfDay, dayKey, DAY, toast, seg, emptyState, openSheet } from '../ui.js';
import { openForm } from '../forms.js';
import { hubHeader } from './hub.js';

/*
 * Module Vacances : une fiche par voyage — valises (liste générée selon la durée et le type de séjour),
 * programme jour par jour, budget du voyage (compté aussi dans le module Budget si activé) et infos pratiques.
 */

let openId = null;
let section = 'prep';
const PEOPLE = ['Maman', 'Papa', 'Nounou'];

const tsOf = (day) => new Date(day + 'T12:00:00').getTime();
const fr = (ts, o = { day: 'numeric', month: 'short' }) => new Date(ts).toLocaleDateString('fr-FR', o);
const nights = (t) => Math.max(1, Math.round((startOfDay(t.end) - startOfDay(t.start)) / DAY));
const tripState = (t) => {
  const today = startOfDay(), a = startOfDay(t.start), b = startOfDay(t.end);
  if (today > b) return { past: true, text: 'Terminé', tone: 'slate' };
  if (today >= a) return { text: 'En cours', tone: 'sage' };
  const d = Math.round((a - today) / DAY);
  return { text: d === 1 ? 'Demain' : `Dans ${d} jours`, tone: d <= 7 ? 'salmon' : 'gold' };
};
const spent = (t) => (t.spend || []).reduce((a, x) => a + x.amount, 0);

export function vacancesSummary(s) {
  const next = [...s.trips].filter((t) => !tripState(t).past).sort((a, b) => a.start - b.start)[0];
  return next ? `${next.name} · ${tripState(next).text.toLowerCase()}` : s.trips.length ? 'Aucun voyage à venir' : 'Préparer un voyage';
}

/* ---------- Rendu ---------- */
export function render(s) {
  const t = openId && s.trips.find((x) => x.id === openId);
  if (openId && !t) openId = null;
  return t ? tripView(s, t) : listView(s);
}

function listView(s) {
  const trips = [...s.trips].sort((a, b) => (tripState(a).past - tripState(b).past) || a.start - b.start);
  return `
    ${hubHeader(s, { back: true })}
    <section class="hero"><p class="eyebrow">Vacances</p><h1 class="title">Vos voyages</h1></section>
    <button class="btn btn-primary btn-block btn-lg" data-act="new-trip">${icon('plus', 20)} Nouveau voyage</button>
    <div class="stack mt-16" style="gap:10px">
      ${trips.length ? trips.map((t) => { const st = tripState(t), done = (t.items || []).filter((i) => i.done).length, n = (t.items || []).length; return `
        <article class="card chore tone-${st.tone}" data-id="${t.id}">
          <button class="chore-main" data-act="open-trip" data-id="${t.id}">
            <b>${esc(t.name)}</b>
            <small><span class="chore-due">${st.text}</span> · ${fr(t.start)} – ${fr(t.end)}${t.dest ? ` · ${esc(t.dest)}` : ''}</small>
            ${n ? `<small>Valises : ${done}/${n}</small>` : ''}
          </button>${icon('chevronRight', 16)}
        </article>`; }).join('') : `<div class="card">${emptyState('plane', 'Aucun voyage', 'Créez un voyage pour préparer valises, programme et budget.')}</div>`}
    </div>`;
}

function tripView(s, t) {
  const st = tripState(t);
  return `
    <header class="app-header">
      <button class="pill-btn" data-act="close-trip">${icon('chevronLeft', 16)}Voyages</button>
      <div class="header-actions"><button class="icon-btn" data-act="edit-trip" aria-label="Modifier le voyage">${icon('settings', 20)}</button></div>
    </header>
    <section class="hero">
      <p class="eyebrow">${fr(t.start, { day: 'numeric', month: 'long' })} – ${fr(t.end, { day: 'numeric', month: 'long', year: 'numeric' })} · ${nights(t)} nuit${nights(t) > 1 ? 's' : ''}</p>
      <h1 class="title">${esc(t.name)}</h1>
      <p class="small mt-8"><span class="badge tone-${st.tone}">${st.text}</span>${t.dest ? ` ${esc(t.dest)}` : ''}</p>
    </section>
    ${seg('vtab', [['prep', 'Valises'], ['plan', 'Programme'], ['budget', 'Budget'], ['infos', 'Infos']], section)}
    <div class="mt-16">${section === 'prep' ? prepView(t) : section === 'plan' ? planView(t) : section === 'budget' ? budgetView(s, t) : infosView(t)}</div>`;
}

/* ----- Valises ----- */
function prepView(t) {
  const items = t.items || [];
  const done = items.filter((i) => i.done).length, n = items.length;
  const cats = [...new Set(items.map((i) => i.cat || ''))];
  const row = (i) => `
    <div class="li-row ${i.done ? 'is-done' : ''}">
      <button class="check ${i.done ? 'is-done' : ''}" data-act="toggle" data-id="${i.id}" aria-pressed="${!!i.done}"><span class="check-box">${icon('check', 16)}</span><span class="check-text">${esc(i.text)}</span></button>
      <button class="icon-btn icon-btn-sm" data-act="del-item" data-id="${i.id}" aria-label="Retirer ${esc(i.text)}">${icon('x', 16)}</button>
    </div>`;
  return `
    ${n ? `<div class="progress"><span style="width:${Math.round((done / n) * 100)}%"></span></div><p class="small faint mt-8">${done} / ${n} prêts</p>` : ''}
    <form class="add-line mt-12" data-form="item"><input class="input" name="text" placeholder="Ajouter un élément…" autocomplete="off" maxlength="80"><button class="btn btn-primary" type="submit" aria-label="Ajouter">${icon('plus', 20)}</button></form>
    <button class="btn btn-ghost btn-block mt-12" data-act="generate">${icon('sparkle', 18)} Générer une liste de valises</button>
    ${n ? cats.map((c) => `<div class="card list-group mt-12">${c ? `<p class="cat-title">${esc(c)}</p>` : ''}${items.filter((i) => (i.cat || '') === c).sort((a, b) => !!a.done - !!b.done).map(row).join('')}</div>`).join('') : ''}
    ${done ? `<div class="grid-2 mt-16"><button class="btn btn-ghost btn-sm" data-act="uncheck">Tout décocher</button><button class="btn btn-ghost btn-sm" data-act="clear-done">${icon('trash', 16)} Vider les cochés</button></div>` : ''}`;
}

function generate(t) {
  const s = store.state, hasKids = moduleOn(s, 'baby') && s.children.length > 0;
  openForm({
    title: 'Générer la liste', subtitle: `Adaptée à ${nights(t)} nuit${nights(t) > 1 ? 's' : ''}. Les éléments déjà présents ne sont pas doublés.`,
    fields: [
      { name: 'kids', label: 'Avec bébé / enfants', type: 'check', value: hasKids },
      { name: 'beach', label: 'Plage / piscine', type: 'check', value: false },
      { name: 'cold', label: 'Froid / montagne', type: 'check', value: false },
      { name: 'car', label: 'Voyage en voiture', type: 'check', value: false },
      { name: 'abroad', label: "À l'étranger", type: 'check', value: false },
    ],
    submit: 'Générer',
    onSubmit(o, api) {
      const n = nights(t), days = Math.min(n + 1, 8);
      const L = [
        ['Papiers', ["Pièces d'identité", 'Carte Vitale / carte européenne', 'Billets / réservations', 'Argent / carte bancaire']],
        ['Électronique', ['Chargeurs téléphones', 'Batterie externe']],
        ['Toilette & santé', ['Trousse de toilette', 'Trousse à pharmacie', 'Médicaments habituels']],
        ['Vêtements', [`Hauts × ${days}`, `Sous-vêtements × ${days}`, `Chaussettes × ${days}`, 'Bas / pantalons × ' + Math.max(2, Math.ceil(days / 2)), 'Pyjamas', 'Chaussures confortables', 'Veste légère']],
      ];
      if (o.beach) L.push(['Plage', ['Maillots de bain', 'Crème solaire', 'Lunettes de soleil', 'Chapeaux / casquettes', 'Serviettes de plage']]);
      if (o.cold) L.push(['Grand froid', ['Manteaux', 'Bonnets, gants, écharpes', 'Pulls chauds', 'Chaussettes chaudes']]);
      if (o.car) L.push(['Voiture', ['Permis de conduire / carte grise', 'Gilet et triangle', 'Eau et collations', 'Support téléphone']]);
      if (o.abroad) L.push(['Étranger', ['Passeports (validité vérifiée)', 'Adaptateur de prise', 'Assurance voyage / rapatriement', "Argent en devise locale"]]);
      if (o.kids) L.push(['Bébé / enfants', ['Couches', 'Lingettes', 'Lait / biberons', 'Doudou', 'Poussette / porte-bébé', 'Lit parapluie', 'Thermomètre', 'Médicaments enfant', 'Jouets / livres', 'Vêtements de rechange']]);
      let added = 0;
      store.update((x) => {
        const tr = x.trips.find((y) => y.id === t.id); tr.items = tr.items || [];
        const have = new Set(tr.items.map((i) => i.text.toLowerCase()));
        for (const [cat, txts] of L) for (const text of txts) if (!have.has(text.toLowerCase())) { tr.items.push({ id: uid(), text, cat, done: false }); added++; }
      });
      api.close();
      toast(`${added} élément${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''}`);
    },
  });
}

/* ----- Programme ----- */
function planView(t) {
  const plan = t.plan || [];
  const total = Math.min(Math.round((startOfDay(t.end) - startOfDay(t.start)) / DAY) + 1, 60);
  const days = Array.from({ length: total }, (_, i) => dayKey(startOfDay(t.start) + i * DAY + 3600e3));
  return `
    <button class="btn btn-primary btn-block" data-act="new-plan">${icon('plus', 18)} Ajouter une activité</button>
    ${days.map((d, i) => {
      const its = plan.filter((p) => p.day === d).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      return `<div class="card list-group mt-12"><p class="cat-title">Jour ${i + 1} · ${esc(fr(tsOf(d), { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
        ${its.length ? its.map((p) => `<button class="entry" data-act="edit-plan" data-id="${p.id}"><span class="entry-amt" style="min-width:48px;font-weight:700;color:var(--text-2)">${esc(p.time || '·')}</span><span class="entry-body"><b>${esc(p.text)}</b></span></button>`).join('') : '<p class="small faint" style="padding:6px 0 10px">Rien de prévu</p>'}</div>`;
    }).join('')}`;
}

function planForm(t, p = null) {
  const days = [];
  for (let d = startOfDay(t.start); d <= startOfDay(t.end) && days.length < 60; d += DAY) days.push([dayKey(d + 3600e3), fr(d, { weekday: 'long', day: 'numeric', month: 'long' })]);
  openForm({
    title: p ? "Modifier l'activité" : 'Nouvelle activité',
    fields: [
      { name: 'text', label: 'Activité', value: p?.text || '', placeholder: 'Ex. Visite du château, restaurant…', required: true },
      { name: 'day', label: 'Jour', type: 'select', options: days, value: p?.day || days[0][0] },
      { name: 'time', label: 'Heure', type: 'time', value: p?.time || '' },
    ],
    onDelete: p && ((api) => { store.update((x) => { const tr = x.trips.find((y) => y.id === t.id); tr.plan = tr.plan.filter((y) => y.id !== p.id); }); api.close(); }),
    onSubmit(f, api) {
      store.update((x) => {
        const tr = x.trips.find((y) => y.id === t.id); tr.plan = tr.plan || [];
        if (p) Object.assign(tr.plan.find((y) => y.id === p.id) || {}, f); else tr.plan.push({ id: uid(), ...f });
      });
      api.close();
    },
  });
}

/* ----- Budget ----- */
function budgetView(s, t) {
  const sp = spent(t), b = t.budget || 0, over = b && sp > b;
  const sorted = [...(t.spend || [])].sort((a, c) => c.at - a.at);
  return `
    <div class="card">
      <p class="eyebrow">Dépensé pour ce voyage</p>
      <p class="big-amount num ${over ? 'text-brick' : ''}">${eur(sp)}</p>
      ${b ? `<div class="progress mt-12"><span style="width:${Math.min(100, Math.round((sp / b) * 100))}%;${over ? 'background:var(--brick)' : ''}"></span></div>
        <p class="small mt-8 ${over ? 'text-brick' : 'muted'}">${over ? `Budget dépassé de ${eur(sp - b)}` : `Il reste ${eur(b - sp)} sur ${eur(b)}`}</p>` : '<p class="small faint mt-8">Aucun budget défini (voir « Modifier le voyage »).</p>'}
    </div>
    <button class="btn btn-primary btn-block mt-12" data-act="new-spend">${icon('plus', 18)} Ajouter une dépense</button>
    ${sorted.length ? `<div class="card list-group mt-12">${sorted.map((x) => `<button class="entry" data-act="edit-spend" data-id="${x.id}"><span class="entry-body"><b>${esc(x.text || 'Dépense')}</b><small>${esc(x.by || '')} · ${esc(fr(x.at))}</small></span><span class="entry-amt num">${eur(x.amount)}</span></button>`).join('')}</div>` : ''}`;
}

function spendForm(t, x = null) {
  const s = store.state;
  openForm({
    title: x ? 'Modifier la dépense' : 'Dépense du voyage',
    fields: [
      { name: 'amount', label: 'Montant (€)', type: 'number', value: x?.amount ?? '', required: true },
      { name: 'text', label: 'Libellé', value: x?.text || '', placeholder: 'Ex. Hôtel, restaurant, essence…' },
      { name: 'by', label: 'Payé par', type: 'select', options: PEOPLE.map((p) => [p, p]), value: x?.by || s.me },
      ...(!x && moduleOn(s, 'finance') ? [{ name: 'budget', label: 'Compter dans le Budget', hint: 'Catégorie « Vacances » du mois', type: 'check', value: true }] : []),
    ],
    onDelete: x && ((api) => {
      store.update((y) => { const tr = y.trips.find((z) => z.id === t.id); tr.spend = tr.spend.filter((z) => z.id !== x.id); y.expenses = y.expenses.filter((e) => e.spendId !== x.id); });
      api.close();
    }),
    onSubmit(f, api) {
      if (f.amount <= 0) { toast('Le montant doit être positif'); return; }
      store.update((y) => {
        const tr = y.trips.find((z) => z.id === t.id); tr.spend = tr.spend || [];
        const data = { amount: Math.round(f.amount * 100) / 100, text: f.text, by: f.by };
        if (x) {
          Object.assign(tr.spend.find((z) => z.id === x.id) || {}, data);
          const e = y.expenses.find((z) => z.spendId === x.id); if (e) Object.assign(e, { amount: data.amount, note: `${t.name} · ${f.text || 'dépense'}`, by: f.by });
        } else {
          const id = uid(), at = Date.now();
          tr.spend.push({ id, at, ...data });
          if (f.budget) y.expenses.push({ id: uid(), spendId: id, tripId: t.id, at, amount: data.amount, cat: 'vacances', note: `${t.name} · ${f.text || 'dépense'}`, by: f.by, shared: true });
        }
      });
      api.close();
    },
  });
}

/* ----- Infos ----- */
function infosView(t) {
  const row = (label, v) => `<p class="mt-12"><span class="faint small">${label}</span><br><b>${v ? esc(v) : '<span class="faint" style="font-weight:500">Non renseigné</span>'}</b></p>`;
  return `<div class="card">
    ${row('Destination', t.dest)}${row('Hébergement', t.lodging)}${row('Référence de réservation', t.ref)}${t.notes ? `<p class="mt-12"><span class="faint small">Notes</span><br>${esc(t.notes)}</p>` : ''}
    <button class="btn btn-ghost btn-sm mt-16" data-act="edit-trip">${icon('edit', 16)} Modifier</button></div>`;
}

/* ----- Formulaire voyage ----- */
function tripForm(t = null) {
  const s = store.state, today = dayKey();
  openForm({
    title: t ? 'Modifier le voyage' : 'Nouveau voyage',
    fields: [
      { name: 'name', label: 'Nom du voyage', value: t?.name || '', placeholder: 'Ex. Vacances en Bretagne', required: true },
      { name: 'dest', label: 'Destination', value: t?.dest || '' },
      { name: 'start', label: 'Départ', type: 'date', value: t ? dayKey(t.start) : today, required: true },
      { name: 'end', label: 'Retour', type: 'date', value: t ? dayKey(t.end) : dayKey(Date.now() + 7 * DAY), required: true },
      { name: 'budget', label: 'Budget du voyage (€)', type: 'number', value: t?.budget ?? '', hint: '(optionnel)' },
      { name: 'lodging', label: 'Hébergement', value: t?.lodging || '', placeholder: 'Nom, adresse' },
      { name: 'ref', label: 'Référence de réservation', value: t?.ref || '' },
      { name: 'notes', label: 'Notes', type: 'textarea', value: t?.notes || '' },
      ...(moduleOn(s, 'agenda') ? [{ name: 'agenda', label: "Dans l'agenda", hint: 'Affiche le séjour du départ au retour', type: 'check', value: t ? !!t.agendaId : true }] : []),
    ],
    submit: t ? 'Enregistrer' : 'Créer',
    onDelete: t && ((api) => {
      if (!confirm(`Supprimer le voyage « ${t.name} » ?`)) return;
      store.update((x) => { x.trips = x.trips.filter((y) => y.id !== t.id); x.agenda = x.agenda.filter((e) => e.id !== t.agendaId); });
      openId = null; api.close();
    }),
    onSubmit(f, api) {
      const start = startOfDay(tsOf(f.start)), end = startOfDay(tsOf(f.end));
      if (end < start) { toast('Le retour est avant le départ'); return; }
      const data = { name: f.name, dest: f.dest, start, end, budget: f.budget > 0 ? f.budget : null, lodging: f.lodging, ref: f.ref, notes: f.notes };
      const newId = t ? null : uid();
      if (newId) { openId = newId; section = 'prep'; } // avant la mise à jour : le rendu ouvre directement le voyage
      store.update((x) => {
        const tr = t ? x.trips.find((y) => y.id === t.id) : { id: newId, items: [], plan: [], spend: [] };
        Object.assign(tr, data);
        if (!t) x.trips.push(tr);
        const ev = x.agenda.find((e) => e.id === tr.agendaId);
        if (f.agenda) {
          const evData = { title: tr.name, kind: 'trip', allDay: true, start, end, place: tr.dest || '', note: '' };
          if (ev) Object.assign(ev, evData); else { tr.agendaId = uid(); x.agenda.push({ id: tr.agendaId, by: x.me, ...evData }); }
        } else if (ev) { x.agenda = x.agenda.filter((e) => e.id !== ev.id); delete tr.agendaId; }
      });
      api.close();
    },
  });
}

/* ---------- Interactions ---------- */
let focusAdd = false;
export function mount(el) {
  if (focusAdd) { focusAdd = false; el.querySelector('[name=text]')?.focus(); }
  const trip = () => store.state.trips.find((x) => x.id === openId);
  const upd = (fn) => store.update((s) => { const tr = s.trips.find((x) => x.id === openId); if (tr) fn(tr, s); });

  el.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form="item"]');
    if (!f) return;
    e.preventDefault();
    const text = f.elements.text.value.trim();
    if (!text) return;
    focusAdd = true;
    upd((tr) => { (tr.items ||= []).push({ id: uid(), text, cat: '', done: false }); });
  });

  el.addEventListener('click', (e) => {
    const sg = e.target.closest('[data-seg="vtab"]');
    if (sg) { section = sg.dataset.v; store.refresh(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.act) {
      case 'new-trip': tripForm(); break;
      case 'open-trip': openId = id; section = 'prep'; window.scrollTo(0, 0); store.refresh(); break;
      case 'close-trip': openId = null; store.refresh(); break;
      case 'edit-trip': tripForm(trip()); break;
      case 'toggle': upd((tr) => { const i = tr.items.find((x) => x.id === id); if (i) i.done = !i.done; }); break;
      case 'del-item': upd((tr) => { tr.items = tr.items.filter((x) => x.id !== id); }); break;
      case 'uncheck': upd((tr) => tr.items.forEach((i) => { i.done = false; })); break;
      case 'clear-done': upd((tr) => { tr.items = tr.items.filter((i) => !i.done); }); break;
      case 'generate': generate(trip()); break;
      case 'new-plan': planForm(trip()); break;
      case 'edit-plan': planForm(trip(), trip().plan.find((x) => x.id === id)); break;
      case 'new-spend': spendForm(trip()); break;
      case 'edit-spend': spendForm(trip(), trip().spend.find((x) => x.id === id)); break;
    }
  });
}
