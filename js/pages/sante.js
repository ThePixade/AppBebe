import { store, moduleOn } from '../store.js';
import { icon } from '../icons.js';
import { esc, uid, eur, fmtNum, startOfDay, dayKey, toLocalInput, fromLocalInput, ageLabel, ago, DAY, toast, emptyState, openSheet } from '../ui.js';
import { openForm } from '../forms.js';
import { hubHeader } from './hub.js';
import { addShopping } from '../supplies.js';
import { calendarFor, VACCINE_NAMES, ageMonths } from '../data/sante-calendrier.js';
import { dosesToday, parseTimes, progress, lastDose, pendingCount } from '../health/doses.js';
import { summaryText } from '../health/summary.js';

/*
 * Module Santé : prises de médicaments du jour, carnet (rendez-vous, vaccins, traitements, symptômes, mesures, notes),
 * suivi des mesures en courbes, pharmacie avec dates de péremption, vaccins et dépistages recommandés (indicatif),
 * fiche à partager, contacts de santé et numéros d'urgence.
 * Indicatif : ne remplace jamais l'avis d'un professionnel de santé.
 */

const TYPES = {
  rdv: { label: 'Rendez-vous', icon: 'stetho', tone: 'slate' }, vaccin: { label: 'Vaccin', icon: 'syringe', tone: 'sage' },
  traitement: { label: 'Traitement', icon: 'pill', tone: 'salmon' }, symptome: { label: 'Symptôme', icon: 'alert', tone: 'peach' },
  mesure: { label: 'Mesure', icon: 'growth', tone: 'gold' }, note: { label: 'Note', icon: 'note', tone: 'slate' },
};
const MEASURES = {
  temp: { label: 'Température', unit: '°C', icon: 'thermo', tone: 'brick', dec: 1 }, weight: { label: 'Poids', unit: 'kg', icon: 'growth', tone: 'sage', dec: 2 },
  height: { label: 'Taille', unit: 'cm', icon: 'growth', tone: 'slate', dec: 1 }, bp: { label: 'Tension', unit: 'mmHg', icon: 'heart', tone: 'salmon', dec: 0 },
  glucose: { label: 'Glycémie', unit: 'g/L', icon: 'drop', tone: 'gold', dec: 2 },
};
const SYMPTOMS = ['Fièvre', 'Toux', 'Rhume', 'Mal de gorge', 'Mal de ventre', 'Vomissements', 'Diarrhée', 'Mal de tête', 'Éruption / boutons', 'Douleur', 'Fatigue', 'Autre'];
const SCHEDULES = [['asneeded', 'Si besoin'], ['1', '1 fois par jour (8 h)'], ['2', '2 fois par jour (8 h, 20 h)'], ['3', '3 fois par jour (8 h, 14 h, 20 h)'], ['4', '4 fois par jour (8 h, 12 h, 16 h, 20 h)'], ['custom', 'Horaires personnalisés']];
const PRESET_TIMES = { 1: ['08:00'], 2: ['08:00', '20:00'], 3: ['08:00', '14:00', '20:00'], 4: ['08:00', '12:00', '16:00', '20:00'] };
const ROLES = ['Médecin traitant', 'Pédiatre', 'Dentiste', 'Gynécologue / sage-femme', 'Ophtalmologue', 'Dermatologue', 'Kinésithérapeute', 'Pharmacie', 'Hôpital / clinique', 'Laboratoire', 'Mutuelle', 'Autre'];
const URGENCES = [['15', 'SAMU : urgence médicale'], ['112', 'Numéro d\'urgence européen'], ['18', 'Pompiers'], ['17', 'Police / gendarmerie'], ['114', 'Urgence par SMS (sourds, malentendants)'], ['3114', 'Prévention du suicide'], ['119', 'Enfance en danger']];
const TABS = [['today', "Aujourd'hui"], ['journal', 'Carnet'], ['track', 'Suivi'], ['pharmacy', 'Pharmacie'], ['family', 'Famille']];

let tab = 'today', who = 'all', tfilter = 'all', mwho = null, mkind = 'temp';

const memberOf = (s, id) => s.members.find((m) => m.id === id);
const mName = (s, id) => memberOf(s, id)?.name || '—';
const dateFr = (ts, o = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(ts).toLocaleDateString('fr-FR', o);
const hourFr = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const monthFr = (ts) => new Date(ts).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
const relDays = (ts) => { const d = Math.round((startOfDay(ts) - startOfDay()) / DAY); return d === 0 ? "aujourd'hui" : d === 1 ? 'demain' : d === -1 ? 'hier' : d > 0 ? `dans ${d} jours` : `il y a ${-d} jours`; };
const mfmt = (k, e) => (k === 'bp' ? `${fmtNum(e.value, 0)}/${fmtNum(e.value2, 0)}` : fmtNum(e.value, MEASURES[k].dec)) + ' ' + MEASURES[k].unit;
const telHref = (p) => 'tel:' + String(p).replace(/[^\d+]/g, '');

/* ------------------------------------------------------------------ données */
/** Carnet + événements du module Bébé (vaccins, médicaments, températures, mesures) pour les membres liés à un enfant. */
function allEntries(s) {
  const out = [...s.health];
  for (const m of s.members) {
    if (!m.childId) continue;
    for (const e of s.events) {
      if (e.childId !== m.childId) continue;
      const base = { id: 'b' + e.id, ro: true, memberId: m.id, at: e.at, from: 'Bébé' };
      if (e.type === 'vaccine') out.push({ ...base, type: 'vaccin', title: e.name, note: e.text });
      else if (e.type === 'temp') out.push({ ...base, type: 'mesure', kind: 'temp', value: e.value, title: `${fmtNum(e.value)} °C` });
      else if (e.type === 'growth') { if (e.weight) out.push({ ...base, id: base.id + 'w', type: 'mesure', kind: 'weight', value: e.weight, title: `${fmtNum(e.weight, 2)} kg` }); if (e.height) out.push({ ...base, id: base.id + 'h', type: 'mesure', kind: 'height', value: e.height, title: `${fmtNum(e.height)} cm` }); }
      else if (e.type === 'med') out.push({ ...base, type: 'note', title: `${e.name}${e.dose ? ` · ${e.dose}` : ''}`, note: 'Médicament noté dans Bébé' });
    }
  }
  return out;
}

const calFor = (s, m) => calendarFor(m, allEntries(s).filter((e) => e.memberId === m.id), Date.now());
const dueCal = (s, m) => calFor(s, m).filter((x) => x.state === 'due' || x.state === 'late');

export function healthAlerts(s) {
  const now = Date.now(), today = startOfDay(), all = allEntries(s);
  const upcoming = s.health.filter((h) => h.type === 'rdv' && h.at >= now - 3600e3).sort((a, b) => a.at - b.at);
  const reminders = s.health.filter((h) => h.type === 'vaccin' && h.next && h.next <= today + 30 * DAY && h.next >= today - 60 * DAY).sort((a, b) => a.next - b.next);
  const fevers = s.members.map((m) => ({ m, e: all.filter((e) => e.memberId === m.id && e.type === 'mesure' && e.kind === 'temp' && e.value >= 38 && now - e.at < DAY).sort((a, b) => b.at - a.at)[0] })).filter((x) => x.e);
  const cal = s.members.map((m) => ({ m, n: dueCal(s, m).length })).filter((x) => x.n);
  const expired = pharmacyAlerts(s);
  return { upcoming, reminders, fevers, cal, expired, pending: pendingCount(s, now) };
}

const expiryEnd = (ts) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59).getTime(); };
export function pharmacyAlerts(s) {
  const now = Date.now();
  return (s.meds || []).filter((x) => x.expiry && expiryEnd(x.expiry) < now + 60 * DAY);
}

export function santeSummary(s) {
  if (!s.members.length) return 'Carnet de santé de la famille';
  const a = healthAlerts(s);
  if (a.pending) return `${a.pending} prise${a.pending > 1 ? 's' : ''} de médicament à faire`;
  if (a.fevers[0]) return `Fièvre : ${a.fevers[0].m.name}`;
  if (a.upcoming[0]) return `${a.upcoming[0].title} · ${mName(s, a.upcoming[0].memberId)} · ${relDays(a.upcoming[0].at)}`;
  const n = a.cal.reduce((t, x) => t + x.n, 0);
  if (n) return `${n} vaccin${n > 1 ? 's' : ''} ou suivi${n > 1 ? 's' : ''} à faire`;
  if (a.expired.length) return `${a.expired.length} médicament${a.expired.length > 1 ? 's' : ''} à vérifier`;
  return 'Rien à signaler';
}

/* ------------------------------------------------------------------- rendu */
export function render(s) {
  const head = `${hubHeader(s, { back: true })}
    <section class="hero"><p class="eyebrow">Santé</p><h1 class="title">Carnet de santé</h1></section>`;
  if (!s.members.length) return head + setupView(s);
  if (who !== 'all' && !memberOf(s, who)) who = 'all';
  if (!mwho || !memberOf(s, mwho)) mwho = s.members[0].id;
  const pend = pendingCount(s, Date.now());
  return `${head}
    <button class="btn btn-primary btn-block btn-lg" data-act="quick">${icon('plus', 20)} Ajouter</button>
    <div class="tabs-row tabs-5 mt-16">${TABS.map(([id, l]) => `<button class="pill-btn ${tab === id ? 'is-on' : ''}" data-act="tab" data-v="${id}">${id === 'today' ? "Aujourd'hui" : l}${id === 'today' && pend ? `<span class="dot-badge">${pend}</span>` : ''}</button>`).join('')}</div>
    <div class="mt-16">${tab === 'today' ? todayView(s) : tab === 'journal' ? journalView(s) : tab === 'track' ? trackView(s) : tab === 'pharmacy' ? pharmacyView(s) : familyView(s)}</div>
    <p class="small faint mt-24">Ce carnet est un aide-mémoire : il ne remplace pas l'avis d'un professionnel de santé. En cas d'urgence, appelez le 15 ou le 112.</p>`;
}

function setupView(s) {
  const kids = moduleOn(s, 'baby') ? s.children : [];
  return `
    <div class="card">
      <p><b>Qui voulez-vous suivre ?</b></p>
      <p class="small muted mt-8">Ajoutez les membres de la famille. Chacun a son carnet : rendez-vous, vaccins, traitements, mesures.</p>
      <div class="stack mt-16" style="gap:8px">
        ${kids.map((c) => `<button class="btn btn-ghost btn-block" data-act="import-child" data-id="${c.id}">${icon('baby', 18)} Ajouter ${esc(c.name)} (lié au module Bébé)</button>`).join('')}
        <button class="btn btn-ghost btn-block" data-act="quick-member" data-name="Maman">${icon('users', 18)} Ajouter Maman</button>
        <button class="btn btn-ghost btn-block" data-act="quick-member" data-name="Papa">${icon('users', 18)} Ajouter Papa</button>
        <button class="btn btn-primary btn-block" data-act="new-member">${icon('plus', 18)} Autre membre</button>
      </div>
    </div>`;
}

const memberChips = (s, cur, act, all = true) => `<div class="chips-row">${[...(all ? [['all', 'Tous']] : []), ...s.members.map((m) => [m.id, m.name])].map(([id, n]) => `<button class="pill-btn ${cur === id ? 'is-on' : ''}" data-act="${act}" data-id="${id}">${esc(n)}</button>`).join('')}</div>`;
const section = (title, rows, empty, extra = '') => `<div class="card list-group mt-12"><p class="cat-title">${title}${extra}</p>${rows.length ? rows.join('') : `<p class="small faint" style="padding:6px 0 10px">${empty}</p>`}</div>`;

/* ----- Aujourd'hui ----- */
function doseRow(s, r) {
  const who = s.members.length > 1 ? ` · ${esc(mName(s, r.memberId))}` : '';
  const dose = r.h.dose ? ` <span class="faint">${esc(r.h.dose)}</span>` : '';
  const pr = progress(r.h), prTxt = pr ? ` · jour ${pr.day}/${pr.total}` : '';
  if (r.asNeeded) {
    const info = r.last ? `Dernière prise ${ago(r.last.at)}${r.nextAt ? (r.ready ? ' · prochaine possible maintenant' : ` · prochaine possible à ${hourFr(r.nextAt)}`) : ''}` : 'Aucune prise notée';
    return `<div class="dose as-needed ${r.ready ? '' : 'is-wait'}"><span class="dose-main"><b>${esc(r.h.title)}${dose}</b><small>Si besoin${who}${prTxt} · ${info}</small></span><button class="btn btn-sm ${r.ready ? 'btn-primary' : 'btn-ghost'}" data-act="dose-adhoc" data-id="${r.h.id}">${icon('check', 16)} Noter une prise</button></div>`;
  }
  const label = { done: `pris à ${hourFr(r.dose?.at || r.ts)}${r.dose?.by ? ` par ${esc(r.dose.by)}` : ''}`, late: 'en retard', due: "c'est l'heure", later: 'plus tard' }[r.status];
  return `<button class="dose is-${r.status}" data-act="dose" data-id="${r.h.id}" data-slot="${r.time}" aria-pressed="${r.status === 'done'}">
    <span class="check-box">${icon('check', 16)}</span><span class="dose-main"><b>${esc(r.time.replace(':', ' h '))} · ${esc(r.h.title)}${dose}</b><small>${label}${who}${prTxt}</small></span></button>`;
}

function todayView(s) {
  const a = healthAlerts(s), rows = dosesToday(s);
  const alerts = [];
  for (const { m, e } of a.fevers) alerts.push(`<button class="entry" data-act="goto-track" data-id="${m.id}" data-k="temp"><span class="dot-ic" style="--tone:var(--brick)">${icon('thermo', 18)}</span><span class="entry-body"><b>Fièvre : ${esc(m.name)}</b><small>${fmtNum(e.value)} °C ${ago(e.at)}${ageMonths(m.birth || '2000-01-01') < 3 && m.birth ? ' · avant 3 mois, avis médical sans attendre' : ''}</small></span></button>`);
  for (const { m, n } of a.cal) alerts.push(`<button class="entry" data-act="open-cal" data-id="${m.id}"><span class="dot-ic" style="--tone:var(--sage)">${icon('syringe', 18)}</span><span class="entry-body"><b>${esc(m.name)} : ${n} vaccin${n > 1 ? 's' : ''} ou suivi${n > 1 ? 's' : ''} à faire</b><small>Voir le calendrier recommandé</small></span></button>`);
  for (const h of a.reminders) alerts.push(vaccinReminder(s, h));
  if (a.expired.length) alerts.push(`<button class="entry" data-act="tab" data-v="pharmacy"><span class="dot-ic" style="--tone:var(--gold)">${icon('pill', 18)}</span><span class="entry-body"><b>${a.expired.length} médicament${a.expired.length > 1 ? 's' : ''} périmé${a.expired.length > 1 ? 's' : ''} ou bientôt</b><small>Vérifiez la pharmacie</small></span></button>`);
  const treat = s.health.filter((h) => h.type === 'traitement' && h.at <= Date.now() && (!h.end || h.end >= startOfDay())).filter((h) => !rows.some((r) => r.h.id === h.id));
  return `
    <div class="card list-group"><p class="cat-title">Prises du jour</p>
      ${rows.length ? rows.map((r) => doseRow(s, r)).join('') : '<p class="small faint" style="padding:6px 0 10px">Aucun traitement en cours. Ajoutez un médicament avec « Ajouter ».</p>'}</div>
    ${alerts.length ? `<div class="card list-group mt-12"><p class="cat-title">À surveiller</p>${alerts.join('')}</div>` : ''}
    ${section('À venir', a.upcoming.slice(0, 5).map((h) => itemRow(s, h)), 'Aucun rendez-vous prévu.')}
    ${treat.length ? section('Autres traitements', treat.map((h) => itemRow(s, h)), '') : ''}`;
}

function vaccinReminder(s, h) {
  return `<button class="entry" data-act="edit-item" data-id="${h.id}"><span class="dot-ic" style="--tone:var(--sage)">${icon('syringe', 18)}</span><span class="entry-body"><b>Rappel : ${esc(h.title)}</b><small>${esc(mName(s, h.memberId))} · ${esc(relDays(h.next))}</small></span></button>`;
}

/* ----- Carnet ----- */
function itemMeta(h) {
  switch (h.type) {
    case 'rdv': return `${dateFr(h.at, { weekday: 'short', day: 'numeric', month: 'short' })} à ${hourFr(h.at)}${h.place ? ` · ${esc(h.place)}` : ''}`;
    case 'vaccin': return `${dateFr(h.at)}${h.next ? ` · rappel ${dateFr(h.next)}` : ''}`;
    case 'traitement': return `${h.dose ? esc(h.dose) + ' · ' : ''}${h.times?.length ? esc(h.times.join(', ')) : 'si besoin'} · depuis le ${dateFr(h.at, { day: 'numeric', month: 'short' })}${h.end ? ` jusqu'au ${dateFr(h.end, { day: 'numeric', month: 'short' })}` : ''}`;
    case 'symptome': return `${dateFr(h.at, { day: 'numeric', month: 'short' })} à ${hourFr(h.at)}`;
    case 'mesure': return `${dateFr(h.at, { day: 'numeric', month: 'short' })} à ${hourFr(h.at)}`;
    default: return dateFr(h.at);
  }
}
function itemRow(s, h) {
  const t = TYPES[h.type] || TYPES.note;
  const title = h.type === 'mesure' && MEASURES[h.kind] ? `${MEASURES[h.kind].label} : ${mfmt(h.kind, h)}` : h.title;
  const tone = h.type === 'mesure' && h.kind === 'temp' && h.value >= 38 ? 'brick' : t.tone;
  return `<button class="entry" data-act="edit-item" data-id="${h.id}">
    <span class="dot-ic" style="--tone:var(--${tone})">${icon(h.type === 'mesure' && MEASURES[h.kind] ? MEASURES[h.kind].icon : t.icon, 18)}</span>
    <span class="entry-body"><b>${esc(title)}${h.from ? ` <span class="badge">${esc(h.from)}</span>` : ''}</b><small>${esc(mName(s, h.memberId))} · ${itemMeta(h)}</small>${h.note ? `<small>${esc(h.note)}</small>` : ''}</span></button>`;
}

function journalView(s) {
  const list = allEntries(s).filter((h) => (who === 'all' || h.memberId === who) && (tfilter === 'all' || h.type === tfilter)).sort((a, b) => b.at - a.at).slice(0, 150);
  return `
    ${memberChips(s, who, 'who')}
    <div class="chips-row mt-8">${[['all', 'Tout'], ...Object.entries(TYPES).map(([k, t]) => [k, t.label])].map(([k, l]) => `<button class="pill-btn ${tfilter === k ? 'is-on' : ''}" data-act="tfilter" data-v="${k}">${esc(l)}</button>`).join('')}</div>
    ${list.length ? `<div class="card list-group mt-12">${list.map((h) => itemRow(s, h)).join('')}</div>` : `<div class="card mt-12">${emptyState('note', 'Carnet vide', 'Ajoutez un rendez-vous, un vaccin, un traitement, un symptôme ou une mesure.')}</div>`}`;
}

/* ----- Suivi des mesures ----- */
function seriesOf(s, memberId, kind) {
  return allEntries(s).filter((e) => e.memberId === memberId && e.type === 'mesure' && e.kind === kind).sort((a, b) => a.at - b.at);
}
function spark(ser, kind) {
  const pts = ser.slice(-20); if (pts.length < 2) return '<p class="small faint">Ajoutez au moins deux mesures pour voir la courbe.</p>';
  const W = 300, H = 80, P = 6, vals = pts.flatMap((p) => (kind === 'bp' ? [p.value, p.value2] : [p.value]));
  const lo = Math.min(...vals), hi = Math.max(...vals), span = Math.max(hi - lo, kind === 'temp' ? 1 : 0.0001);
  const x = (i) => P + (i * (W - 2 * P)) / (pts.length - 1), y = (v) => H - P - ((v - lo) / span) * (H - 2 * P);
  const line = (f, c) => `<polyline fill="none" stroke="var(--${c})" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="${pts.map((p, i) => `${x(i).toFixed(1)},${y(f(p)).toFixed(1)}`).join(' ')}"/>${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(f(p)).toFixed(1)}" r="2.6" style="fill:var(--${c})"/>`).join('')}`;
  const fever = kind === 'temp' && lo <= 38 && hi >= 38 ? `<line x1="0" x2="${W}" y1="${y(38).toFixed(1)}" y2="${y(38).toFixed(1)}" stroke="var(--brick)" stroke-dasharray="4 4" stroke-width="1" opacity=".6"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Courbe ${MEASURES[kind].label}">${fever}${line((p) => p.value, MEASURES[kind].tone)}${kind === 'bp' ? line((p) => p.value2, 'slate') : ''}</svg>`;
}
function trackView(s) {
  const m = memberOf(s, mwho), ser = seriesOf(s, mwho, mkind), last = ser[ser.length - 1], prev = ser[ser.length - 2], M = MEASURES[mkind];
  const delta = last && prev && mkind !== 'bp' ? last.value - prev.value : null;
  const hot = mkind === 'temp' && last && last.value >= 38;
  return `
    ${memberChips(s, mwho, 'mwho', false)}
    <div class="chips-row mt-8">${Object.entries(MEASURES).map(([k, d]) => `<button class="pill-btn ${mkind === k ? 'is-on' : ''}" data-act="mkind" data-v="${k}">${icon(d.icon, 15)}${d.label}</button>`).join('')}</div>
    <div class="card mt-12">
      <p class="eyebrow">${esc(M.label)} · ${esc(m.name)}</p>
      ${last ? `<p class="big-amount num ${hot ? 'text-brick' : ''}">${mfmt(mkind, last)}</p>
        <p class="small muted">${esc(dateFr(last.at, { day: 'numeric', month: 'long' }))} à ${hourFr(last.at)}${delta !== null && Math.abs(delta) > 0.001 ? ` · ${delta > 0 ? '+' : ''}${fmtNum(delta, M.dec)} ${M.unit} par rapport à la précédente` : ''}</p>
        ${hot ? `<div class="notice tone-brick mt-12">${icon('alert', 18)}<span><b>Fièvre.</b> ${m.birth && ageMonths(m.birth) < 3 ? 'Avant 3 mois, consultez un médecin sans attendre.' : 'En cas de doute ou de signe inquiétant, appelez le 15 ou votre médecin.'}</span></div>` : ''}
        <div class="mt-12">${spark(ser, mkind)}</div>` : `<p class="small muted mt-8">Aucune mesure pour l'instant.</p>`}
      <button class="btn btn-primary btn-sm mt-12" data-act="new-mesure">${icon('plus', 16)} Ajouter ${mkind === 'temp' ? 'une température' : 'une mesure'}</button>
    </div>
    ${ser.length ? `<div class="card list-group mt-12"><p class="cat-title">Historique</p>${[...ser].reverse().slice(0, 12).map((e) => `<button class="entry" data-act="edit-item" data-id="${e.id}"><span class="entry-body"><b class="${mkind === 'temp' && e.value >= 38 ? 'text-brick' : ''}">${mfmt(mkind, e)}${e.from ? ` <span class="badge">${esc(e.from)}</span>` : ''}</b><small>${esc(dateFr(e.at, { weekday: 'short', day: 'numeric', month: 'long' }))} à ${hourFr(e.at)}</small></span></button>`).join('')}</div>` : ''}`;
}

/* ----- Pharmacie ----- */
function pharmacyView(s) {
  const meds = [...(s.meds || [])].sort((a, b) => (a.expiry || 9e15) - (b.expiry || 9e15));
  const now = Date.now();
  const row = (x) => {
    const exp = x.expiry ? expiryEnd(x.expiry) : null, expired = exp && exp < now, soon = exp && !expired && exp < now + 60 * DAY;
    return `<div class="entry"><button class="entry-main" data-act="edit-med" data-id="${x.id}"><span class="dot-ic" style="--tone:var(--${expired ? 'brick' : soon ? 'gold' : 'sage'})">${icon('pill', 18)}</span>
      <span class="entry-body"><b>${esc(x.name)}${x.qty ? ` <span class="faint">· ${esc(x.qty)}</span>` : ''}</b><small>${x.expiry ? `${expired ? 'Périmé' : 'Expire'} · ${esc(monthFr(x.expiry))}` : 'Sans date'}${x.note ? ` · ${esc(x.note)}` : ''}</small></span></button>
      ${expired ? '<span class="badge tone-brick">Périmé</span>' : soon ? '<span class="badge tone-gold">Bientôt</span>' : ''}
      <button class="icon-btn icon-btn-sm" data-act="med-buy" data-id="${x.id}" aria-label="Ajouter ${esc(x.name)} aux courses">${icon('cart', 16)}</button></div>`;
  };
  const alerts = pharmacyAlerts(s);
  return `
    <p class="small muted">Votre armoire à pharmacie : repérez ce qui est périmé ou bientôt périmé, et ajoutez ce qui manque aux courses.</p>
    ${alerts.length ? `<div class="notice tone-gold mt-12">${icon('alert', 18)}<span class="grow" style="flex:1"><b>${alerts.length} médicament${alerts.length > 1 ? 's' : ''} à vérifier.</b> Rapportez les médicaments périmés en pharmacie.</span></div>` : ''}
    <div class="card list-group mt-12">${meds.length ? meds.map(row).join('') : emptyState('pill', 'Armoire vide', 'Ajoutez vos médicaments avec leur date de péremption.')}</div>
    <button class="btn btn-primary btn-block mt-16" data-act="new-med">${icon('plus', 18)} Ajouter un médicament</button>`;
}

/* ----- Famille : fiches, contacts, urgences ----- */
function familyView(s) {
  const contacts = s.contacts || [];
  return `
    ${s.members.map((m) => { const n = dueCal(s, m).length; return `
      <article class="card mt-12">
        <div class="row-between"><div><b style="font-size:1.05rem">${esc(m.name)}</b><p class="small muted">${m.birth ? esc(ageLabel(m.birth)) + ' · ' : ''}${m.blood ? `Groupe ${esc(m.blood)}` : 'Groupe sanguin non renseigné'}${m.childId ? ' · lié à Bébé' : ''}</p></div>
          <button class="icon-btn icon-btn-sm" data-act="edit-member" data-id="${m.id}" aria-label="Modifier ${esc(m.name)}">${icon('edit', 16)}</button></div>
        <div class="fiche mt-12">
          <p><span class="faint">Allergies</span><br><b class="${m.allergies ? 'text-brick' : ''}">${esc(m.allergies || 'Aucune connue')}</b></p>
          <p><span class="faint">Médecin traitant</span><br><b>${esc(m.doctor || 'Non renseigné')}</b></p>
          ${m.antecedents ? `<p><span class="faint">Antécédents</span><br>${esc(m.antecedents)}</p>` : ''}
          ${m.mutuelle ? `<p><span class="faint">Mutuelle</span><br>${esc(m.mutuelle)}</p>` : ''}
          ${m.notes ? `<p><span class="faint">Notes</span><br>${esc(m.notes)}</p>` : ''}
        </div>
        <div class="grid-2 mt-8"><button class="btn btn-ghost btn-sm" data-act="open-cal" data-id="${m.id}">${icon('syringe', 16)} Vaccins${n ? ` <span class="dot-badge">${n}</span>` : ''}</button>
          <button class="btn btn-ghost btn-sm" data-act="open-summary" data-id="${m.id}">${icon('share', 16)} Fiche à partager</button></div>
      </article>`; }).join('')}
    <button class="btn btn-ghost btn-block mt-12" data-act="new-member">${icon('plus', 18)} Ajouter un membre</button>
    <div class="card list-group mt-20"><p class="cat-title">Contacts de santé</p>
      ${contacts.length ? contacts.map((c) => `<div class="entry"><button class="entry-main" data-act="edit-contact" data-id="${c.id}"><span class="dot-ic" style="--tone:var(--slate)">${icon('stetho', 18)}</span><span class="entry-body"><b>${esc(c.name)}</b><small>${esc(c.role || '')}${c.phone ? ` · ${esc(c.phone)}` : ''}${c.address ? ` · ${esc(c.address)}` : ''}</small></span></button>
        ${c.phone ? `<a class="icon-btn icon-btn-sm" href="${telHref(c.phone)}" aria-label="Appeler ${esc(c.name)}">${icon('send', 16)}</a>` : ''}</div>`).join('') : '<p class="small faint" style="padding:6px 0 10px">Pédiatre, médecin, dentiste, pharmacie… avec leur numéro en un geste.</p>'}</div>
    <button class="btn btn-ghost btn-block mt-12" data-act="new-contact">${icon('plus', 18)} Ajouter un contact</button>
    <div class="card list-group mt-20"><p class="cat-title">Numéros d'urgence</p>
      ${URGENCES.map(([n, l]) => `<a class="entry" href="tel:${n}"><span class="dot-ic" style="--tone:var(--brick)">${icon('alert', 18)}</span><span class="entry-body"><b>${n}</b><small>${esc(l)}</small></span></a>`).join('')}</div>`;
}

/* ============================================================== Formulaires */
const memberOpts = (s) => s.members.map((m) => [m.id, m.name]);
const defMember = (s) => (who !== 'all' && memberOf(s, who) ? who : tab === 'track' ? mwho : s.members[0].id);

function memberForm(m = null, preset = {}) {
  const v = { ...preset, ...(m || {}) };
  openForm({
    title: m ? `Fiche de ${m.name}` : 'Nouveau membre',
    fields: [
      { name: 'name', label: 'Prénom', value: v.name || '', required: true, maxlength: 30 },
      { name: 'birth', label: 'Date de naissance', type: 'date', value: v.birth || '' },
      { name: 'sex', label: 'Sexe', hint: '(pour les dépistages recommandés)', type: 'select', value: v.sex || '', options: [['', 'Non précisé'], ['F', 'Femme / fille'], ['M', 'Homme / garçon']] },
      { name: 'blood', label: 'Groupe sanguin', type: 'select', value: v.blood || '', options: [['', 'Inconnu'], ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => [g, g])] },
      { name: 'allergies', label: 'Allergies', value: v.allergies || '', placeholder: 'Ex. Pénicilline, arachide' },
      { name: 'antecedents', label: 'Antécédents', type: 'textarea', value: v.antecedents || '', placeholder: 'Maladies, opérations, asthme…' },
      { name: 'doctor', label: 'Médecin traitant', value: v.doctor || '', placeholder: 'Nom et téléphone' },
      { name: 'mutuelle', label: 'Mutuelle', value: v.mutuelle || '', placeholder: 'Nom, numéro d\'adhérent' },
      { name: 'notes', label: 'Notes', type: 'textarea', value: v.notes || '' },
    ],
    onDelete: m && ((api) => {
      if (!confirm(`Supprimer la fiche de ${m.name} et tout son carnet ?`)) return;
      store.update((x) => { x.members = x.members.filter((y) => y.id !== m.id); x.health = x.health.filter((h) => h.memberId !== m.id); x.doses = (x.doses || []).filter((d) => d.memberId !== m.id); });
      api.close();
    }),
    onSubmit(f, api) {
      const data = { name: f.name, birth: f.birth, sex: f.sex, blood: f.blood, allergies: f.allergies, antecedents: f.antecedents, doctor: f.doctor, mutuelle: f.mutuelle, notes: f.notes };
      store.update((x) => { if (m) Object.assign(x.members.find((y) => y.id === m.id) || {}, data); else x.members.push({ id: uid(), ...data, ...(preset.childId ? { childId: preset.childId } : {}) }); });
      api.close();
    },
  });
}

/* --- Ajout rapide --- */
function quickSheet() {
  const items = [['rdv', 'stetho', 'slate', 'Rendez-vous'], ['traitement', 'pill', 'salmon', 'Médicament'], ['temp', 'thermo', 'brick', 'Température'], ['symptome', 'alert', 'peach', 'Symptôme'], ['vaccin', 'syringe', 'sage', 'Vaccin'], ['mesure', 'growth', 'gold', 'Mesure'], ['note', 'note', 'slate', 'Note']];
  openSheet({
    title: 'Ajouter', subtitle: 'Que voulez-vous noter ?',
    content: `<div class="menu-grid">${items.map(([k, ic, tone, l]) => `<button class="menu-item tone-${tone}" data-k="${k}"><span class="ac-icon">${icon(ic, 22)}</span>${l}</button>`).join('')}</div>`,
    onMount(body, api) {
      body.addEventListener('click', (e) => {
        const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
        api.close();
        setTimeout(() => ({ rdv: () => rdvForm(), traitement: () => treatmentForm(), temp: () => mesureForm(null, 'temp'), symptome: () => symptomForm(), vaccin: () => vaccinForm(), mesure: () => mesureForm(null, mkind === 'temp' ? 'weight' : mkind), note: () => noteForm() })[k](), 280);
      });
    },
  });
}

/* --- Rendez-vous --- */
function rdvForm(h = null, preset = {}) {
  const s = store.state, v = h || preset, isNew = !h;
  openForm({
    title: h ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous',
    fields: [
      { name: 'memberId', label: 'Pour', type: 'select', value: v.memberId || defMember(s), options: memberOpts(s) },
      { name: 'title', label: 'Avec qui / pourquoi', value: v.title || '', placeholder: 'Ex. Pédiatre, dentiste, prise de sang…', required: true },
      { name: 'at', label: 'Date et heure', type: 'datetime-local', value: toLocalInput(v.at || Date.now() + DAY) },
      { name: 'place', label: 'Lieu', value: v.place || '' },
      { name: 'note', label: 'Questions à poser, à apporter', type: 'textarea', value: v.note || '', placeholder: 'Carnet de santé, carte vitale, ordonnance…' },
      { name: 'cost', label: 'Coût (€)', type: 'number', value: v.cost ?? '', hint: '(optionnel)' },
      ...(isNew && moduleOn(s, 'agenda') ? [{ name: 'agenda', label: "Ajouter à l'agenda", type: 'check', value: true }] : []),
      ...(isNew && moduleOn(s, 'finance') ? [{ name: 'budget', label: 'Compter dans le Budget', hint: 'Catégorie Santé (si un coût est indiqué)', type: 'check', value: false }] : []),
    ],
    submit: h ? 'Enregistrer' : 'Ajouter',
    extra: h ? [{ label: 'Dupliquer', icon: 'repeat', onClick: (api) => { api.close(); setTimeout(() => rdvForm(null, { ...h, at: Date.now() + 30 * DAY, agendaId: undefined }), 280); } }] : [],
    onDelete: h && ((api) => removeItem(h, api)),
    onSubmit(f, api) {
      const at = fromLocalInput(f.at), data = { type: 'rdv', memberId: f.memberId, title: f.title, at, place: f.place, note: f.note, ...(f.cost > 0 ? { cost: f.cost } : {}) };
      store.update((x) => {
        const who2 = mName(x, f.memberId);
        if (h) {
          const t = x.health.find((y) => y.id === h.id); if (t) { delete t.cost; Object.assign(t, data); }
          const ev = x.agenda.find((e) => e.id === h.agendaId); if (ev) Object.assign(ev, { title: `${f.title} · ${who2}`, start: at, place: f.place });
        } else {
          const e = { id: uid(), ...data };
          if (f.agenda) { e.agendaId = uid(); x.agenda.push({ id: e.agendaId, title: `${f.title} · ${who2}`, kind: 'rdv', allDay: false, start: at, end: null, place: f.place, note: '', by: x.me }); }
          x.health.push(e);
          if (f.budget && f.cost > 0) x.expenses.push({ id: uid(), at: Date.now(), amount: f.cost, cat: 'sante', note: `${f.title} · ${who2}`, by: x.me, shared: true, kind: 'out' });
        }
      });
      api.close();
      if (isNew) toast(f.agenda ? "Ajouté au carnet et à l'agenda" : 'Rendez-vous ajouté');
    },
  });
}

/* --- Vaccin --- */
function vaccinForm(h = null, preset = {}) {
  const s = store.state, v = h || preset;
  openForm({
    title: h ? 'Modifier le vaccin' : 'Nouveau vaccin',
    fields: [
      { name: 'memberId', label: 'Pour', type: 'select', value: v.memberId || defMember(s), options: memberOpts(s) },
      { name: 'title', label: 'Vaccin', value: v.title || '', list: VACCINE_NAMES, placeholder: 'Ex. ROR, Pneumocoque…', required: true, hint: '(choisir dans la liste aide au suivi)' },
      { name: 'at', label: 'Date de la vaccination', type: 'date', value: dayKey(v.at || Date.now()) },
      { name: 'next', label: 'Prochain rappel', type: 'date', value: v.next ? dayKey(v.next) : '', hint: '(optionnel)' },
      { name: 'note', label: 'Lot, réaction…', value: v.note || '' },
    ],
    submit: h ? 'Enregistrer' : 'Ajouter',
    onDelete: h && ((api) => removeItem(h, api)),
    onSubmit(f, api) {
      const data = { type: 'vaccin', memberId: f.memberId, title: f.title, at: new Date(f.at + 'T12:00:00').getTime(), next: f.next ? new Date(f.next + 'T12:00:00').getTime() : null, note: f.note };
      store.update((x) => { if (h) Object.assign(x.health.find((y) => y.id === h.id) || {}, data); else x.health.push({ id: uid(), ...data }); });
      api.close(); if (!h) toast('Vaccin ajouté');
    },
  });
}

/* --- Traitement --- */
function scheduleOf(h) {
  if (!h || !h.times || !h.times.length) return h ? 'asneeded' : '2';
  const k = Object.entries(PRESET_TIMES).find(([, t]) => t.join() === h.times.join());
  return k ? k[0] : 'custom';
}
function treatmentForm(h = null, preset = {}) {
  const s = store.state, v = h || preset;
  const names = [...new Set([...(s.meds || []).map((x) => x.name), ...s.health.filter((x) => x.type === 'traitement').map((x) => x.title)])];
  openForm({
    title: h ? 'Modifier le traitement' : 'Nouveau médicament',
    subtitle: 'Suivez les prises avec une liste à cocher chaque jour.',
    fields: [
      { name: 'memberId', label: 'Pour', type: 'select', value: v.memberId || defMember(s), options: memberOpts(s) },
      { name: 'title', label: 'Médicament', value: v.title || '', list: names, placeholder: 'Ex. Doliprane, antibiotique…', required: true },
      { name: 'dose', label: 'Dose', value: v.dose || '', placeholder: 'Ex. 1 comprimé, 5 ml, 2 gouttes' },
      { name: 'schedule', label: 'Fréquence', type: 'select', value: scheduleOf(h || (preset.times ? preset : null)), options: SCHEDULES },
      { name: 'custom', label: 'Horaires personnalisés', value: h?.times?.length && scheduleOf(h) === 'custom' ? h.times.join(', ') : '', placeholder: 'Ex. 7 h 30, 13 h, 19 h 30' },
      { name: 'minHours', label: 'Délai minimum entre deux prises (h)', type: 'number', value: v.minHours ?? '', hint: '(si besoin, ex. 6)' },
      { name: 'at', label: 'Premier jour', type: 'date', value: dayKey(v.at || Date.now()) },
      { name: 'end', label: 'Dernier jour', type: 'date', value: v.end ? dayKey(v.end) : '', hint: '(optionnel, ex. fin d\'un antibiotique)' },
      { name: 'note', label: 'Remarques', value: v.note || '', placeholder: 'Pendant le repas, ordonnance du Dr…' },
    ],
    submit: h ? 'Enregistrer' : 'Ajouter',
    afterMount(body) {
      const form = body.querySelector('form'), sched = form.elements.schedule;
      const toggle = () => { form.elements.custom.closest('label').style.display = sched.value === 'custom' ? '' : 'none'; form.elements.minHours.closest('label').style.display = sched.value === 'asneeded' ? '' : 'none'; };
      sched.addEventListener('change', toggle); toggle();
    },
    onDelete: h && ((api) => removeItem(h, api)),
    onSubmit(f, api) {
      const times = f.schedule === 'asneeded' ? [] : f.schedule === 'custom' ? parseTimes(f.custom) : PRESET_TIMES[f.schedule];
      if (f.schedule === 'custom' && !times.length) { toast('Indiquez au moins un horaire (ex. 8 h, 20 h)'); return; }
      const data = { type: 'traitement', memberId: f.memberId, title: f.title, dose: f.dose, times, at: new Date(f.at + 'T00:00:00').getTime(), end: f.end ? new Date(f.end + 'T23:59:00').getTime() : null, note: f.note, ...(f.schedule === 'asneeded' && f.minHours > 0 ? { minHours: f.minHours } : {}) };
      store.update((x) => { if (h) { const t = x.health.find((y) => y.id === h.id); if (t) { delete t.minHours; Object.assign(t, data); } } else x.health.push({ id: uid(), ...data }); });
      api.close(); if (!h) toast('Traitement ajouté : retrouvez les prises dans « Aujourd\'hui »');
    },
  });
}

/* --- Mesures et température --- */
function mesureForm(h = null, kind = null) {
  const s = store.state, k0 = h?.kind || kind || 'temp';
  openForm({
    title: h ? 'Modifier la mesure' : k0 === 'temp' ? 'Température' : 'Nouvelle mesure',
    fields: [
      { name: 'memberId', label: 'Pour', type: 'select', value: h?.memberId || defMember(s), options: memberOpts(s) },
      { name: 'kind', label: 'Mesure', type: 'select', value: k0, options: Object.entries(MEASURES).map(([k, d]) => [k, `${d.label} (${d.unit})`]) },
      { name: 'value', label: 'Valeur', type: 'number', value: h?.value ?? '', placeholder: k0 === 'temp' ? '37,2' : '', required: true },
      { name: 'value2', label: 'Valeur du bas (tension)', type: 'number', value: h?.value2 ?? '', placeholder: 'Ex. 80' },
      { name: 'at', label: 'Date et heure', type: 'datetime-local', value: toLocalInput(h?.at || Date.now()), },
    ],
    submit: h ? 'Enregistrer' : 'Ajouter',
    header: '<div class="js-fever"></div>',
    afterMount(body) {
      const form = body.querySelector('form'), F = form.elements;
      const refresh = () => {
        const bp = F.kind.value === 'bp'; F.value2.closest('label').style.display = bp ? '' : 'none';
        const v = parseFloat(String(F.value.value).replace(',', '.')), m = memberOf(store.state, F.memberId.value);
        body.querySelector('.js-fever').innerHTML = F.kind.value === 'temp' && v >= 38 ? `<div class="notice tone-brick mb-16">${icon('alert', 18)}<span><b>Fièvre.</b> ${m?.birth && ageMonths(m.birth) < 3 ? 'Avant 3 mois, consultez un médecin sans attendre.' : 'En cas de doute ou de signe inquiétant, appelez le 15 ou votre médecin.'}</span></div>` : '';
      };
      ['kind', 'value', 'memberId'].forEach((n) => F[n].addEventListener('input', refresh)); refresh();
    },
    onDelete: h && ((api) => removeItem(h, api)),
    onSubmit(f, api) {
      const M = MEASURES[f.kind];
      if (f.kind === 'temp' && !(f.value > 30 && f.value < 45)) { toast('Température invalide'); return; }
      if (f.kind === 'bp' && !(f.value2 > 0)) { toast('Indiquez les deux valeurs de la tension'); return; }
      if (!(f.value > 0)) { toast('Valeur invalide'); return; }
      const data = { type: 'mesure', memberId: f.memberId, kind: f.kind, value: f.value, ...(f.kind === 'bp' ? { value2: f.value2 } : {}), at: fromLocalInput(f.at), title: `${M.label} ${f.kind === 'bp' ? `${f.value}/${f.value2}` : f.value} ${M.unit}` };
      store.update((x) => { if (h) { const t = x.health.find((y) => y.id === h.id); if (t) { delete t.value2; Object.assign(t, data); } } else x.health.push({ id: uid(), ...data }); });
      mwho = f.memberId; mkind = f.kind;
      api.close(); if (!h) toast('Mesure ajoutée');
    },
  });
}

/* --- Symptômes --- */
function symptomForm(h = null) {
  const s = store.state; let picked = new Set(h?.symptoms || []);
  openForm({
    title: h ? 'Modifier le symptôme' : 'Symptôme',
    header: `<p class="label">Qu'observez-vous ?</p><div class="chips mt-8 mb-16 tone-peach js-sym">${SYMPTOMS.map((x) => `<button type="button" class="chip ${picked.has(x) ? 'is-on' : ''}" data-s="${esc(x)}">${esc(x)}</button>`).join('')}</div>`,
    fields: [
      { name: 'memberId', label: 'Pour', type: 'select', value: h?.memberId || defMember(s), options: memberOpts(s) },
      { name: 'temp', label: 'Température (°C)', type: 'number', value: '', placeholder: 'Optionnel', hint: '(ajoutée aux mesures)' },
      { name: 'at', label: 'Quand', type: 'datetime-local', value: toLocalInput(h?.at || Date.now()) },
      { name: 'note', label: 'Détails', type: 'textarea', value: h?.note || '', placeholder: 'Depuis quand, intensité, ce qui a été fait…' },
    ],
    submit: h ? 'Enregistrer' : 'Ajouter',
    afterMount(body) { body.querySelector('.js-sym').addEventListener('click', (e) => { const c = e.target.closest('[data-s]'); if (!c) return; picked.has(c.dataset.s) ? picked.delete(c.dataset.s) : picked.add(c.dataset.s); c.classList.toggle('is-on'); }); },
    onDelete: h && ((api) => removeItem(h, api)),
    onSubmit(f, api) {
      if (!picked.size) { toast('Choisissez au moins un symptôme'); return; }
      const at = fromLocalInput(f.at), list = [...picked], data = { type: 'symptome', memberId: f.memberId, symptoms: list, title: list.join(', '), at, note: f.note };
      store.update((x) => {
        if (h) Object.assign(x.health.find((y) => y.id === h.id) || {}, data); else x.health.push({ id: uid(), ...data });
        if (f.temp > 30 && f.temp < 45) x.health.push({ id: uid(), type: 'mesure', memberId: f.memberId, kind: 'temp', value: f.temp, at, title: `Température ${f.temp} °C` });
      });
      api.close(); if (!h) toast('Symptôme noté');
    },
  });
}

/* --- Note --- */
function noteForm(h = null, preset = {}) {
  const s = store.state, v = h || preset;
  openForm({
    title: h ? 'Modifier la note' : 'Nouvelle note',
    fields: [
      { name: 'memberId', label: 'Pour', type: 'select', value: v.memberId || defMember(s), options: memberOpts(s) },
      { name: 'title', label: 'Titre', value: v.title || '', placeholder: 'Ex. Résultats de la prise de sang', required: true },
      { name: 'at', label: 'Date', type: 'date', value: dayKey(v.at || Date.now()) },
      { name: 'note', label: 'Détails', type: 'textarea', value: v.note || '' },
    ],
    submit: h ? 'Enregistrer' : 'Ajouter',
    onDelete: h && ((api) => removeItem(h, api)),
    onSubmit(f, api) {
      const data = { type: 'note', memberId: f.memberId, title: f.title, at: new Date(f.at + 'T12:00:00').getTime(), note: f.note };
      store.update((x) => { if (h) Object.assign(x.health.find((y) => y.id === h.id) || {}, data); else x.health.push({ id: uid(), ...data }); });
      api.close(); if (!h) toast('Note ajoutée');
    },
  });
}

function removeItem(h, api) {
  const copy = JSON.parse(JSON.stringify(h)), docs = (store.state.doses || []).filter((d) => d.tid === h.id);
  store.update((x) => { x.health = x.health.filter((y) => y.id !== h.id); x.doses = (x.doses || []).filter((d) => d.tid !== h.id); x.agenda = x.agenda.filter((e) => e.id !== h.agendaId); });
  api.close();
  toast('Supprimé', { action: 'Annuler', onAction: () => store.update((x) => { x.health.push(copy); x.doses.push(...docs); }) });
}

function editItem(h) {
  if (!h) return;
  if (h.ro) { toast('Cet élément vient du module Bébé : modifiez-le là-bas'); return; }
  ({ rdv: rdvForm, vaccin: vaccinForm, traitement: treatmentForm, mesure: mesureForm, symptome: symptomForm, note: noteForm })[h.type]?.(h);
}

/* --- Pharmacie et contacts --- */
function medForm(x = null) {
  openForm({
    title: x ? 'Modifier le médicament' : 'Nouveau médicament en stock',
    fields: [
      { name: 'name', label: 'Nom', value: x?.name || '', placeholder: 'Ex. Doliprane 500 mg', required: true },
      { name: 'expiry', label: "Date de péremption", type: 'month', value: x?.expiry ? `${new Date(x.expiry).getFullYear()}-${String(new Date(x.expiry).getMonth() + 1).padStart(2, '0')}` : '', hint: '(mois et année)' },
      { name: 'qty', label: 'Quantité', value: x?.qty || '', placeholder: 'Ex. 1 boîte, 8 comprimés' },
      { name: 'note', label: 'Remarques', value: x?.note || '' },
    ],
    submit: x ? 'Enregistrer' : 'Ajouter',
    onDelete: x && ((api) => { const copy = { ...x }; store.update((s) => { s.meds = s.meds.filter((y) => y.id !== x.id); }); api.close(); toast('Supprimé', { action: 'Annuler', onAction: () => store.update((s) => { s.meds.push(copy); }) }); }),
    onSubmit(f, api) {
      const m = /^(\d{4})-(\d{2})$/.exec(f.expiry || ''), data = { name: f.name, qty: f.qty, note: f.note, expiry: m ? new Date(+m[1], +m[2] - 1, 1).getTime() : null };
      store.update((s) => { s.meds = s.meds || []; if (x) Object.assign(s.meds.find((y) => y.id === x.id) || {}, data); else s.meds.push({ id: uid(), ...data }); });
      api.close();
    },
  });
}

function contactForm(c = null) {
  openForm({
    title: c ? 'Modifier le contact' : 'Nouveau contact de santé',
    fields: [
      { name: 'name', label: 'Nom', value: c?.name || '', placeholder: 'Ex. Dr Martin', required: true },
      { name: 'role', label: 'Rôle', value: c?.role || '', list: ROLES, placeholder: 'Pédiatre, dentiste, pharmacie…' },
      { name: 'phone', label: 'Téléphone', value: c?.phone || '', placeholder: '01 23 45 67 89' },
      { name: 'address', label: 'Adresse', value: c?.address || '' },
      { name: 'note', label: 'Remarques', value: c?.note || '', placeholder: 'Horaires, secrétariat, Doctolib…' },
    ],
    submit: c ? 'Enregistrer' : 'Ajouter',
    onDelete: c && ((api) => { const copy = { ...c }; store.update((s) => { s.contacts = s.contacts.filter((y) => y.id !== c.id); }); api.close(); toast('Supprimé', { action: 'Annuler', onAction: () => store.update((s) => { s.contacts.push(copy); }) }); }),
    onSubmit(f, api) {
      const data = { name: f.name, role: f.role, phone: f.phone, address: f.address, note: f.note };
      store.update((s) => { s.contacts = s.contacts || []; if (c) Object.assign(s.contacts.find((y) => y.id === c.id) || {}, data); else s.contacts.push({ id: uid(), ...data }); });
      api.close();
    },
  });
}

/* --- Calendrier vaccinal et fiche à partager --- */
function calendarSheet(memberId) {
  const s = store.state, m = memberOf(s, memberId); if (!m) return;
  if (!m.birth) { toast('Indiquez la date de naissance pour voir le calendrier'); memberForm(m); return; }
  const items = calFor(s, m), todo = items.filter((x) => x.state === 'due' || x.state === 'late'), soon = items.filter((x) => x.state === 'soon' || x.state === 'info'), done = items.filter((x) => x.state === 'done');
  const row = (x) => `<div class="entry"><span class="dot-ic" style="--tone:var(--${x.state === 'late' ? 'brick' : x.state === 'done' ? 'sage' : x.state === 'due' ? 'salmon' : 'slate'})">${icon(x.kind === 'vaccin' ? 'syringe' : x.kind === 'depistage' ? 'stetho' : 'note', 18)}</span>
    <span class="entry-body"><b>${esc(x.label)}</b><small>${x.state === 'late' ? 'En retard · ' : ''}${esc(x.text || (x.state === 'done' ? 'Fait' : ''))}${x.oblig === false ? ' · recommandé' : ''}</small></span>
    ${x.state === 'info' ? '' : x.state === 'done' ? '' : `<button class="btn btn-sm btn-ghost" data-mark="${x.id}">J'ai fait</button>`}</div>`;
  openSheet({
    title: `Vaccins et suivis · ${m.name}`, subtitle: 'Recommandations indicatives (France)',
    onMount(body, api) {
      body.innerHTML = `
        <div class="notice tone-gold">${icon('info', 18)}<span>D'après le calendrier vaccinal français. Il évolue : <b>vérifiez avec votre médecin</b> et le carnet de santé. Les vaccins saisis dans le carnet (et dans Bébé) sont pris en compte.</span></div>
        <div class="card list-group mt-12"><p class="cat-title">À faire${todo.length ? ` · ${todo.length}` : ''}</p>${todo.length ? todo.map(row).join('') : '<p class="small faint" style="padding:6px 0 10px">Rien à faire pour le moment.</p>'}</div>
        ${soon.length ? `<div class="card list-group mt-12"><p class="cat-title">Bientôt</p>${soon.map(row).join('')}</div>` : ''}
        ${done.length ? `<details class="mt-12"><summary class="small muted">Déjà fait (${done.length})</summary><div class="card list-group mt-8">${done.map(row).join('')}</div></details>` : ''}`;
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mark]'); if (!b) return;
        const x = items.find((y) => y.id === b.dataset.mark); api.close();
        setTimeout(() => (x.kind === 'vaccin' ? vaccinForm(null, { memberId, title: x.short || x.label }) : noteForm(null, { memberId, title: `${x.short || x.label} : fait` })), 280);
      });
    },
  });
}

function summarySheet(memberId) {
  const s = store.state, m = memberOf(s, memberId); if (!m) return;
  const text = summaryText(s, m, allEntries(s));
  openSheet({
    title: `Fiche de ${m.name}`, subtitle: 'À envoyer au médecin, à la nounou ou aux urgences',
    onMount(body) {
      body.innerHTML = `<pre class="receipt-text" style="max-height:44vh">${esc(text)}</pre>
        <div class="grid-2 mt-16"><button class="btn btn-ghost" data-copy>${icon('upload', 16)} Copier</button><button class="btn btn-primary" data-share>${icon('share', 16)} Partager</button></div>`;
      body.querySelector('[data-copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(text); toast('Fiche copiée'); } catch { toast('Copie impossible : sélectionnez le texte'); } });
      body.querySelector('[data-share]').addEventListener('click', async () => { if (navigator.share) { try { await navigator.share({ title: `Fiche santé de ${m.name}`, text }); } catch { /* annulé */ } } else { try { await navigator.clipboard.writeText(text); toast('Fiche copiée (partage non disponible)'); } catch { toast('Partage indisponible'); } } });
    },
  });
}

/* --- Prises --- */
function takeDose(tid, slot) {
  const s = store.state, h = s.health.find((x) => x.id === tid); if (!h) return;
  const day = dayKey(Date.now()), ex = (s.doses || []).find((d) => d.tid === tid && d.day === day && d.slot === slot);
  if (ex) { store.update((x) => { x.doses = x.doses.filter((d) => d.id !== ex.id); }); toast('Prise annulée'); return; }
  const d = { id: uid(), tid, memberId: h.memberId, day, slot, at: Date.now(), by: s.me };
  store.update((x) => { (x.doses ||= []).push(d); });
  toast(`${h.title} noté pour ${mName(s, h.memberId)}`, { action: 'Annuler', onAction: () => store.update((x) => { x.doses = x.doses.filter((y) => y.id !== d.id); }) });
}
function adhocDose(tid) {
  const s = store.state, h = s.health.find((x) => x.id === tid); if (!h) return;
  const last = lastDose(s, tid);
  if (last && h.minHours && Date.now() < last.at + h.minHours * 36e5 && !confirm(`Dernière prise ${ago(last.at)} : délai minimum de ${h.minHours} h. Noter quand même cette prise ?`)) return;
  const d = { id: uid(), tid, memberId: h.memberId, day: dayKey(Date.now()), slot: null, at: Date.now(), by: s.me };
  store.update((x) => { (x.doses ||= []).push(d); });
  toast(`${h.title} noté${h.minHours ? ` · prochaine prise possible à ${hourFr(Date.now() + h.minHours * 36e5)}` : ''}`, { action: 'Annuler', onAction: () => store.update((x) => { x.doses = x.doses.filter((y) => y.id !== d.id); }) });
}

/* ============================================================ Interactions */
export function mount(el) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const S = store.state, id = b.dataset.id;
    switch (b.dataset.act) {
      case 'tab': tab = b.dataset.v; store.refresh(); break;
      case 'quick': quickSheet(); break;
      case 'who': who = id; store.refresh(); break;
      case 'tfilter': tfilter = b.dataset.v; store.refresh(); break;
      case 'mwho': mwho = id; store.refresh(); break;
      case 'mkind': mkind = b.dataset.v; store.refresh(); break;
      case 'goto-track': tab = 'track'; mwho = id; mkind = b.dataset.k || 'temp'; store.refresh(); break;
      case 'new-mesure': mesureForm(null, mkind); break;
      case 'new-member': memberForm(); break;
      case 'quick-member': memberForm(null, { name: b.dataset.name }); break;
      case 'import-child': { const c = S.children.find((x) => x.id === id); memberForm(null, { name: c.name, birth: c.birth, sex: c.sex, childId: c.id }); break; }
      case 'edit-member': memberForm(memberOf(S, id)); break;
      case 'edit-item': editItem(allEntries(S).find((x) => x.id === id)); break;
      case 'dose': takeDose(id, b.dataset.slot); break;
      case 'dose-adhoc': adhocDose(id); break;
      case 'new-med': medForm(); break;
      case 'edit-med': medForm(S.meds.find((x) => x.id === id)); break;
      case 'med-buy': { const x = S.meds.find((y) => y.id === id); if (x) toast(addShopping(x.name) ? `« ${x.name} » ajouté aux courses` : `« ${x.name} » est déjà dans les courses`); break; }
      case 'new-contact': contactForm(); break;
      case 'edit-contact': contactForm(S.contacts.find((x) => x.id === id)); break;
      case 'open-cal': calendarSheet(id); break;
      case 'open-summary': summarySheet(id); break;
    }
  });
}
