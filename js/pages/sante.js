import { store, moduleOn } from '../store.js';
import { icon } from '../icons.js';
import { esc, uid, startOfDay, dayKey, toLocalInput, fromLocalInput, ageLabel, DAY, toast, seg, emptyState } from '../ui.js';
import { openForm } from '../forms.js';
import { hubHeader } from './hub.js';

/*
 * Module Santé : un carnet par membre de la famille — rendez-vous, vaccins (avec rappel),
 * traitements en cours, notes — et une fiche (allergies, groupe sanguin, médecin).
 * Les rendez-vous peuvent être ajoutés à l'agenda. Indicatif : ne remplace pas un avis médical.
 */

const TYPES = {
  rdv:        { label: 'Rendez-vous', icon: 'stetho', tone: 'slate' },
  vaccin:     { label: 'Vaccin', icon: 'syringe', tone: 'sage' },
  traitement: { label: 'Traitement', icon: 'pill', tone: 'salmon' },
  note:       { label: 'Note', icon: 'note', tone: 'gold' },
};
let tab = 'summary';
let who = 'all';

const memberName = (s, id) => s.members.find((m) => m.id === id)?.name || '—';
const dateFr = (ts, o = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(ts).toLocaleDateString('fr-FR', o);
const hourFr = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const relDays = (ts) => {
  const d = Math.round((startOfDay(ts) - startOfDay()) / DAY);
  return d === 0 ? "aujourd'hui" : d === 1 ? 'demain' : d === -1 ? 'hier' : d > 0 ? `dans ${d} jours` : `il y a ${-d} jours`;
};

/** Éléments à surveiller : rendez-vous à venir, rappels de vaccin (≤ 30 j), traitements en cours. */
export function healthAlerts(s) {
  const now = Date.now(), today = startOfDay();
  const upcoming = s.health.filter((h) => h.type === 'rdv' && h.at >= now - 3600e3).sort((a, b) => a.at - b.at);
  const reminders = s.health.filter((h) => h.type === 'vaccin' && h.next && h.next <= today + 30 * DAY).sort((a, b) => a.next - b.next);
  const active = s.health.filter((h) => h.type === 'traitement' && h.at <= now && (!h.end || h.end >= today));
  return { upcoming, reminders, active };
}

export function santeSummary(s) {
  if (!s.members.length) return 'Carnet de santé de la famille';
  const a = healthAlerts(s);
  if (a.upcoming[0]) return `${a.upcoming[0].title} · ${memberName(s, a.upcoming[0].memberId)} · ${relDays(a.upcoming[0].at)}`;
  if (a.reminders.length) return `${a.reminders.length} rappel${a.reminders.length > 1 ? 's' : ''} de vaccin`;
  if (a.active.length) return `${a.active.length} traitement${a.active.length > 1 ? 's' : ''} en cours`;
  return 'Rien à signaler';
}

/* ---------- Rendu ---------- */
export function render(s) {
  const head = `${hubHeader(s, { back: true })}
    <section class="hero"><p class="eyebrow">Santé</p><h1 class="title">Carnet de santé</h1></section>`;
  if (!s.members.length) return head + setupView(s);
  if (who !== 'all' && !s.members.some((m) => m.id === who)) who = 'all';
  return `${head}
    ${seg('stab', [['summary', 'Résumé'], ['journal', 'Carnet'], ['members', 'Famille']], tab)}
    <div class="mt-16">${tab === 'summary' ? summaryView(s) : tab === 'journal' ? journalView(s) : membersView(s)}</div>
    <p class="small faint mt-24">Ce carnet est un aide-mémoire : il ne remplace pas l'avis d'un professionnel de santé. En cas d'urgence, appelez le 15 ou le 112.</p>`;
}

function setupView(s) {
  const kids = moduleOn(s, 'baby') ? s.children : [];
  return `
    <div class="card">
      <p><b>Qui voulez-vous suivre ?</b></p>
      <p class="small muted mt-8">Ajoutez les membres de la famille. Chacun aura son carnet : rendez-vous, vaccins, traitements.</p>
      <div class="stack mt-16" style="gap:8px">
        ${kids.map((c) => `<button class="btn btn-ghost btn-block" data-act="import-child" data-id="${c.id}">${icon('baby', 18)} Ajouter ${esc(c.name)}</button>`).join('')}
        <button class="btn btn-ghost btn-block" data-act="quick-member" data-name="Maman">${icon('users', 18)} Ajouter Maman</button>
        <button class="btn btn-ghost btn-block" data-act="quick-member" data-name="Papa">${icon('users', 18)} Ajouter Papa</button>
        <button class="btn btn-primary btn-block" data-act="new-member">${icon('plus', 18)} Autre membre</button>
      </div>
    </div>`;
}

function whoBar(s) {
  return `<div class="chips-row">${[['all', 'Tous'], ...s.members.map((m) => [m.id, m.name])].map(([id, n]) => `<button class="pill-btn ${who === id ? 'is-on' : ''}" data-act="who" data-id="${id}">${esc(n)}</button>`).join('')}</div>`;
}

function itemCard(s, h) {
  const t = TYPES[h.type];
  let meta = '';
  if (h.type === 'rdv') meta = `${dateFr(h.at, { weekday: 'short', day: 'numeric', month: 'short' })} à ${hourFr(h.at)}${h.place ? ` · ${esc(h.place)}` : ''}`;
  else if (h.type === 'vaccin') meta = `Fait le ${dateFr(h.at)}${h.next ? ` · rappel ${dateFr(h.next)}` : ''}`;
  else if (h.type === 'traitement') meta = `Depuis le ${dateFr(h.at)}${h.end ? ` jusqu'au ${dateFr(h.end)}` : ''}`;
  else meta = dateFr(h.at);
  return `
    <button class="entry" data-act="edit-item" data-id="${h.id}">
      <span class="dot-ic" style="--tone:var(--${t.tone})">${icon(t.icon, 18)}</span>
      <span class="entry-body"><b>${esc(h.title)}</b><small>${esc(memberName(s, h.memberId))} · ${meta}</small>${h.note ? `<small>${esc(h.note)}</small>` : ''}</span>
    </button>`;
}

function section(title, rows, empty) {
  return `<div class="card list-group mt-12"><p class="cat-title">${title}</p>${rows.length ? rows.join('') : `<p class="small faint" style="padding:6px 0 10px">${empty}</p>`}</div>`;
}

function summaryView(s) {
  const a = healthAlerts(s);
  return `
    <button class="btn btn-primary btn-block" data-act="new-item">${icon('plus', 18)} Ajouter au carnet</button>
    ${section('À venir', a.upcoming.slice(0, 6).map((h) => itemCard(s, h)), 'Aucun rendez-vous prévu.')}
    ${a.reminders.length ? section('Rappels de vaccin', a.reminders.map((h) => itemCard(s, h)), '') : ''}
    ${section('Traitements en cours', a.active.map((h) => itemCard(s, h)), 'Aucun traitement en cours.')}`;
}

function journalView(s) {
  const list = s.health.filter((h) => who === 'all' || h.memberId === who).sort((a, b) => b.at - a.at);
  return `
    ${whoBar(s)}
    <button class="btn btn-primary btn-block mt-12" data-act="new-item">${icon('plus', 18)} Ajouter au carnet</button>
    ${list.length ? `<div class="card list-group mt-12">${list.map((h) => itemCard(s, h)).join('')}</div>` : `<div class="card mt-12">${emptyState('note', 'Carnet vide', 'Ajoutez un rendez-vous, un vaccin, un traitement ou une note.')}</div>`}`;
}

function membersView(s) {
  return `
    ${s.members.map((m) => `
      <article class="card mt-12">
        <div class="row-between"><b style="font-size:1.05rem">${esc(m.name)}</b><button class="icon-btn icon-btn-sm" data-act="edit-member" data-id="${m.id}" aria-label="Modifier ${esc(m.name)}">${icon('edit', 16)}</button></div>
        <p class="small muted">${m.birth ? ageLabel(m.birth) + ' · ' : ''}${m.blood ? `Groupe ${esc(m.blood)}` : 'Groupe sanguin non renseigné'}</p>
        <div class="fiche mt-12">
          <p><span class="faint">Allergies</span><br><b>${esc(m.allergies || 'Aucune connue')}</b></p>
          <p><span class="faint">Médecin traitant</span><br><b>${esc(m.doctor || 'Non renseigné')}</b></p>
          ${m.notes ? `<p><span class="faint">Notes</span><br>${esc(m.notes)}</p>` : ''}
        </div>
      </article>`).join('')}
    <button class="btn btn-ghost btn-block mt-16" data-act="new-member">${icon('plus', 18)} Ajouter un membre</button>`;
}

/* ---------- Formulaires ---------- */
function memberForm(m = null, preset = {}) {
  const v = { ...preset, ...(m || {}) };
  openForm({
    title: m ? `Fiche de ${m.name}` : 'Nouveau membre',
    fields: [
      { name: 'name', label: 'Prénom', value: v.name || '', required: true, maxlength: 30 },
      { name: 'birth', label: 'Date de naissance', type: 'date', value: v.birth || '' },
      { name: 'blood', label: 'Groupe sanguin', type: 'select', value: v.blood || '', options: [['', 'Inconnu'], ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => [g, g])] },
      { name: 'allergies', label: 'Allergies', value: v.allergies || '', placeholder: 'Ex. Pénicilline, arachide' },
      { name: 'doctor', label: 'Médecin traitant', value: v.doctor || '', placeholder: 'Nom et téléphone' },
      { name: 'notes', label: 'Notes', type: 'textarea', value: v.notes || '' },
    ],
    onDelete: m && ((api) => {
      if (!confirm(`Supprimer la fiche de ${m.name} et tout son carnet ?`)) return;
      store.update((x) => { x.members = x.members.filter((y) => y.id !== m.id); x.health = x.health.filter((h) => h.memberId !== m.id); });
      api.close();
    }),
    onSubmit(f, api) {
      const data = { name: f.name, birth: f.birth, blood: f.blood, allergies: f.allergies, doctor: f.doctor, notes: f.notes };
      store.update((x) => { if (m) Object.assign(x.members.find((y) => y.id === m.id) || {}, data); else x.members.push({ id: uid(), ...data }); });
      api.close();
    },
  });
}

function itemForm(h = null) {
  const s = store.state;
  const v = h || { type: 'rdv', memberId: who !== 'all' ? who : s.members[0].id, at: Date.now() };
  openForm({
    title: h ? 'Modifier' : 'Ajouter au carnet',
    fields: [
      { name: 'type', label: 'Type', type: 'select', value: v.type, options: Object.entries(TYPES).map(([k, t]) => [k, t.label]) },
      { name: 'memberId', label: 'Pour', type: 'select', value: v.memberId, options: s.members.map((m) => [m.id, m.name]) },
      { name: 'title', label: 'Titre', value: v.title || '', placeholder: 'Ex. Pédiatre, ROR, Doliprane…', required: true },
      { name: 'at', label: 'Date et heure', type: 'datetime-local', value: toLocalInput(v.at), hint: '(date de début pour un traitement)' },
      { name: 'end', label: 'Fin du traitement', type: 'date', value: v.end ? dayKey(v.end) : '', hint: '(optionnel)' },
      { name: 'next', label: 'Prochain rappel de vaccin', type: 'date', value: v.next ? dayKey(v.next) : '', hint: '(optionnel)' },
      { name: 'place', label: 'Lieu / médecin', value: v.place || '' },
      { name: 'note', label: 'Note', type: 'textarea', value: v.note || '' },
      ...(!h && moduleOn(s, 'agenda') ? [{ name: 'agenda', label: "Ajouter à l'agenda", hint: 'Pour les rendez-vous', type: 'check', value: true }] : []),
    ],
    submit: h ? 'Enregistrer' : 'Ajouter',
    onDelete: h && ((api) => {
      const copy = { ...h };
      store.update((x) => { x.health = x.health.filter((y) => y.id !== h.id); });
      api.close();
      toast('Supprimé', { action: 'Annuler', onAction: () => store.update((x) => { x.health.push(copy); }) });
    }),
    onSubmit(f, api) {
      const at = fromLocalInput(f.at);
      const data = {
        type: f.type, memberId: f.memberId, title: f.title, at, place: f.place, note: f.note,
        end: f.type === 'traitement' && f.end ? new Date(f.end + 'T12:00:00').getTime() : null,
        next: f.type === 'vaccin' && f.next ? new Date(f.next + 'T12:00:00').getTime() : null,
      };
      store.update((x) => {
        if (h) Object.assign(x.health.find((y) => y.id === h.id) || {}, data); else x.health.push({ id: uid(), ...data });
        if (!h && f.agenda && f.type === 'rdv') {
          x.agenda.push({ id: uid(), title: `${f.title} · ${memberName(x, f.memberId)}`, kind: 'rdv', allDay: false, start: at, end: null, place: f.place, note: '', by: x.me });
        }
      });
      api.close();
      if (!h && f.agenda && f.type === 'rdv') toast("Ajouté à l'agenda");
    },
  });
}

/* ---------- Interactions ---------- */
export function mount(el) {
  el.addEventListener('click', (e) => {
    const sg = e.target.closest('[data-seg="stab"]');
    if (sg) { tab = sg.dataset.v; store.refresh(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const S = store.state, id = b.dataset.id;
    switch (b.dataset.act) {
      case 'who': who = id; store.refresh(); break;
      case 'new-member': memberForm(); break;
      case 'quick-member': memberForm(null, { name: b.dataset.name }); break;
      case 'import-child': { const c = S.children.find((x) => x.id === id); memberForm(null, { name: c.name, birth: c.birth }); break; }
      case 'edit-member': memberForm(S.members.find((x) => x.id === id)); break;
      case 'new-item': itemForm(); break;
      case 'edit-item': itemForm(S.health.find((x) => x.id === id)); break;
    }
  });
}
