import { showTab as maisonTab } from '../pages/maison.js';
import { store, moduleOn, activeChild, eventsOf, lastOf } from '../store.js';
import { icon } from '../icons.js';
import { openSheet, newestFirst, esc, eur, fmtNum, fmtDur, ago, time, dayLabel, dayKey, startOfDay, toast, DAY } from '../ui.js';
import { hubHeader } from '../pages/hub.js';
import { uiOf, setUi } from './ui.js';
import { modInfo, enabledModules } from '../modules.js';
import { catOfEvent, CATS } from '../pages/agenda.js';
import { collectAlerts, collectActivity, whoTone } from './alerts.js';
import { dosesToday, progress, lastDose } from '../health/doses.js';
import { takeDose, adhocDose } from '../pages/sante.js';
import { monthStats, pace, goalSaved } from '../budget/stats.js';
import { catOf } from '../budget/cats.js';
import { choreState, assignee, doneChore } from '../pages/maison.js';
import { tripState, spent as tripSpent } from '../pages/vacances.js';
import { addShopping } from '../supplies.js';
import { ACTIONS, actionsFor } from './actions.js';
import { eventRow } from '../pages/home.js';
import { openEvent } from '../pages/edit.js';

/*
 * Accueil « tableau de bord » (édition Premium) : des widgets qu'on déplace, redimensionne et masque,
 * et qui résument ce qui compte (alertes, prises du jour, rendez-vous, bébé, budget, courses, tâches…).
 * Taille S = demi-largeur, M = pleine largeur, L = pleine largeur avec plus de contenu.
 */
let editing = false;
let flipFrom = null;   // positions des blocs avant un changement : sert à animer le réarrangement
let focusId = null;    // bloc à refocaliser après un réarrangement au clavier
// Contexte d'organisation : l'accueil et la page Bébé partagent le même moteur (glisser, masquer, redimensionner).
// { layout(s) → [{id,size,hidden}], save(lay, silent), sizes(id) → ['S','M'…], reset() }
let ctx = null;
const hourFr = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const empty = (t) => `<p class="small faint" style="padding:4px 0 2px">${t}</p>`;

/* ----------------------------------------------------------------- widgets */
const isUpcoming = (e) => startOfDay(e.end ?? e.start) >= startOfDay() && (e.allDay || (e.end ?? e.start) >= Date.now());
const relDay = (ts) => { const d = Math.round((startOfDay(ts) - startOfDay()) / DAY); return d === 0 ? "Aujourd'hui" : d === 1 ? 'Demain' : d < 0 ? 'En cours' : new Date(ts).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }); };

function wHello(s) {
  const ui = uiOf(s), h = new Date().getHours(), hello = h >= 18 || h < 5 ? 'Bonsoir' : 'Bonjour';
  const parts = [], doses = dosesToday(s).filter((r) => r.status === 'late' || r.status === 'due').length;
  if (moduleOn(s, 'medical') && doses) parts.push(`${doses} prise${doses > 1 ? 's' : ''} à donner`);
  if (moduleOn(s, 'agenda')) { const n = (s.agenda || []).filter((e) => isUpcoming(e) && startOfDay(e.start) <= startOfDay()).length; if (n) parts.push(`${n} rendez-vous aujourd'hui`); }
  if (moduleOn(s, 'maison')) { const n = (s.chores || []).filter((c) => choreState(c).delta <= 0).length; if (n) parts.push(`${n} tâche${n > 1 ? 's' : ''} à faire`); }
  if (moduleOn(s, 'finance')) { const st = monthStats(s); if (st.budget) parts.push(`budget à ${Math.round((st.spent / st.budget) * 100)} %`); }
  return { plain: true, html: `<div class="dw-hello"><div><p class="eyebrow">${esc(dayLabel())}${ui.familyName ? ` · ${esc(ui.familyName)}` : ''}</p><h1 class="title">${hello} ${esc(s.me)}</h1><p class="subtitle">${parts.length ? esc(parts.join(' · ')) : "Rien d'urgent pour l'instant."}</p></div>${ui.familyEmoji ? `<span class="fam-badge" aria-hidden="true">${esc(ui.familyEmoji)}</span>` : ''}</div>` };
}

function wAlerts(s, size) {
  const al = collectAlerts(s), n = size === 'L' ? 8 : 4;
  return { title: 'À surveiller', badge: al.length || '', html: al.length ? `<div class="list-group">${al.slice(0, n).map((a) => `<a class="entry" href="${a.href}"><span class="dot-ic" style="--tone:var(--${a.tone})">${icon(a.icon, 18)}</span><span class="entry-body"><b>${esc(a.title)}</b><small>${esc(a.sub)}</small></span></a>`).join('')}</div>${al.length > n ? `<p class="small faint" style="padding-top:6px">+ ${al.length - n} autre${al.length - n > 1 ? 's' : ''}</p>` : ''}`
    : `<div class="notice tone-sage">${icon('check', 18)}<span>Rien à signaler : tout est à jour.</span></div>` };
}

function wMeds(s, size) {
  if (!moduleOn(s, 'medical') || !(s.members || []).length) return null;
  const rows = dosesToday(s), n = size === 'L' ? 8 : 5, who = (id) => (s.members.find((m) => m.id === id)?.name || '');
  const row = (r) => {
    if (r.asNeeded) return `<div class="dose as-needed ${r.ready ? '' : 'is-wait'}"><span class="dose-main"><b>${esc(r.h.title)}</b><small>Si besoin · ${esc(who(r.memberId))}${r.last ? ` · dernière prise ${ago(r.last.at)}` : ''}${r.nextAt && !r.ready ? ` · prochaine à ${hourFr(r.nextAt)}` : ''}</small></span><button class="btn btn-sm ${r.ready ? 'btn-primary' : 'btn-ghost'}" data-act="dose-adhoc" data-id="${r.h.id}">${icon('check', 14)} Prise</button></div>`;
    const lab = { done: `pris à ${hourFr(r.dose?.at || r.ts)}`, late: 'en retard', due: "c'est l'heure", later: 'plus tard' }[r.status];
    return `<button class="dose is-${r.status}" data-act="dose" data-id="${r.h.id}" data-slot="${r.time}"><span class="check-box">${icon('check', 14)}</span><span class="dose-main"><b>${esc(r.time.replace(':', ' h '))} · ${esc(r.h.title)}</b><small>${lab} · ${esc(who(r.memberId))}</small></span></button>`;
  };
  return { title: 'Prises du jour', more: ['#/sante', 'Santé'], html: rows.length ? `<div class="list-group">${rows.slice(0, n).map(row).join('')}</div>` : empty('Aucun traitement en cours.') };
}

function wAgenda(s, size) {
  if (!moduleOn(s, 'agenda')) return null;
  const evs = (s.agenda || []).filter(isUpcoming).sort((a, b) => a.start - b.start).slice(0, size === 'L' ? 8 : 5);
  return { title: 'Prochains rendez-vous', more: ['#/agenda', 'Agenda'], html: evs.length ? `<div class="list-group">${evs.map((e) => { const c = CATS[catOfEvent(e, s)], d = new Date(Math.max(e.start, startOfDay())); return `<a class="entry" href="#/agenda" data-agenda-cat="${catOfEvent(e, s)}" data-agenda-day="${startOfDay(e.start)}"><span class="date-badge" style="--tone:var(--${c.tone})"><b>${d.getDate()}</b><small>${esc(d.toLocaleDateString('fr-FR', { month: 'short' }))}</small></span><span class="entry-body"><b>${esc(e.title)}</b><small>${esc(relDay(e.start))}${e.allDay ? '' : ` · ${time(e.start)}`} · ${esc(c.label)}${e.place ? ` · ${esc(e.place)}` : ''}</small></span></a>`; }).join('')}</div>` : empty('Rien de prévu pour le moment.') };
}

function wBaby(s, size) {
  const c = activeChild(s); if (!moduleOn(s, 'baby') || !c) return null;
  const t0 = startOfDay(), today = eventsOf(s, c.id).filter((e) => e.at >= t0), feeds = today.filter((e) => e.type === 'feed');
  const sleepMs = today.filter((e) => e.type === 'sleep').reduce((a, e) => a + (e.end - Math.max(e.at, t0)), 0), diapers = today.filter((e) => e.type === 'diaper').length;
  const lf = lastOf(s, c.id, 'feed'), ld = lastOf(s, c.id, 'diaper'), sleeping = s.timers?.sleep?.[c.id];
  return { title: `${esc(c.name)}`, more: ['#/home', 'Bébé'], html: `
    <div class="mini-stats" style="border-top:0;padding-top:0"><button class="mini-hit" data-act="baby-detail" data-k="feed"><span class="faint">Repas</span><b class="num">${feeds.length}</b></button><button class="mini-hit" data-act="baby-detail" data-k="diaper"><span class="faint">Couches</span><b class="num">${diapers}</b></button><div><span class="faint">Sommeil</span><b class="num">${esc(fmtDur(sleepMs).replace('< 1 min', '0 min'))}</b></div></div>
    <button class="hit-line mt-8" data-act="baby-detail" data-k="feed">${sleeping ? `${icon('moon', 13)} Dort depuis ${esc(fmtDur(Date.now() - sleeping))}` : lf ? `Dernier repas ${esc(ago(lf.at))}` : 'Aucun repas noté'}</button>
    <button class="hit-line" data-act="baby-detail" data-k="diaper">${ld ? `Dernière couche ${esc(ago(ld.at))}${ld.kind ? ' · ' + esc({ wet: 'mouillée', dirty: 'sale', mixed: 'mixte' }[ld.kind] || '') : ''}` : 'Aucune couche notée'}</button>
    ${size !== 'S' ? `<div class="grid-3q mt-12"><button class="btn btn-ghost btn-sm" data-act="action" data-a="feed">${icon('bottle', 14)} Repas</button><button class="btn btn-ghost btn-sm" data-act="action" data-a="diaper">${icon('diaper', 14)} Couche</button><button class="btn btn-ghost btn-sm" data-act="action" data-a="sleep">${icon('moon', 14)} Sieste</button></div>` : ''}` };
}

function wBudget(s, size) {
  if (!moduleOn(s, 'finance')) return null;
  const st = monthStats(s), pc = pace(s, st.m0), over = st.budget && st.spent > st.budget;
  const cats = Object.entries(st.byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { title: 'Budget du mois', more: ['#/budget', 'Budget'], html: `
    <p class="big-amount num ${over ? 'text-brick' : ''}" style="font-size:${size === 'S' ? '1.5rem' : '1.9rem'}">${eur(st.spent)}</p>
    ${st.budget ? `<div class="progress mt-8"><span style="width:${Math.min(100, Math.round((st.spent / st.budget) * 100))}%;${over ? 'background:var(--brick)' : ''}"></span></div><p class="small ${over ? 'text-brick' : 'muted'} mt-8">${over ? `Dépassé de ${eur(-st.left)}` : `Reste ${eur(st.left)}`}${pc?.perDay && size !== 'S' ? ` · ${eur(pc.perDay)} par jour` : ''}</p>` : '<p class="small faint mt-8">Aucun budget défini</p>'}
    ${size !== 'S' && cats.length ? `<div class="mt-12">${cats.map(([k, v]) => { const [, l, ic, tone] = catOf(k); return `<div class="bar-row" style="--tone:var(--${tone});margin-top:8px"><span>${esc(l)}</span><b class="num">${eur(v)}</b><div class="bar-track"><span style="width:${Math.max(4, Math.round((v / cats[0][1]) * 100))}%"></span></div></div>`; }).join('')}</div>` : ''}
    ${size !== 'S' && st.income ? `<p class="small muted mt-12">Revenus ${eur(st.income)} · solde <b class="${st.balance < 0 ? 'text-brick' : 'text-sage'}">${st.balance > 0 ? '+' : ''}${eur(st.balance)}</b></p>` : ''}` };
}

function wShop(s, size) {
  if (!moduleOn(s, 'maison')) return null;
  const l = (s.lists || []).find((x) => x.kind === 'shop'), todo = newestFirst(l?.items).filter((i) => !i.done), n = size === 'S' ? 3 : size === 'L' ? 8 : 4;
  return { title: 'Courses', badge: todo.length || '', more: ['#/maison', 'Maison', 'shop'], html: `
    ${todo.length ? `<div class="list-group">${todo.slice(0, n).map((i) => `<button class="check" data-act="shop-toggle" data-id="${i.id}"><span class="check-box">${icon('check', 14)}</span><span class="check-text">${esc(i.text)}${i.qty ? ` <span class="qty-tag">× ${esc(i.qty)}</span>` : ''}</span></button>`).join('')}</div>${todo.length > n ? `<p class="small faint" style="padding-top:4px">+ ${todo.length - n} autre${todo.length - n > 1 ? 's' : ''}</p>` : ''}` : empty('Liste vide : rien à acheter.')}
    ${size !== 'S' ? `<form class="add-line mt-12" data-form="shop"><input class="input" name="text" placeholder="Ajouter un article…" autocomplete="off" maxlength="80"><button class="btn btn-primary" type="submit" aria-label="Ajouter">${icon('plus', 18)}</button></form>` : ''}` };
}

function wChores(s, size) {
  if (!moduleOn(s, 'maison')) return null;
  const list = (s.chores || []).map((c) => ({ c, st: choreState(c) })).sort((a, b) => a.st.delta - b.st.delta).filter((x) => x.st.delta <= 1).slice(0, size === 'L' ? 6 : 4);
  return { title: 'Tâches à faire', more: ['#/maison', 'Maison', 'chores'], html: list.length ? list.map(({ c, st }) => `<div class="chore-row tone-${st.tone}"><span class="entry-body"><b>${esc(c.name)}</b><small><span class="chore-due" style="color:var(--${st.tone === 'brick' ? 'brick' : 'salmon'})">${esc(st.label)}</span>${assignee(c) ? ` · ${esc(assignee(c))}` : ''}</small></span><button class="btn btn-sm btn-primary" data-act="chore" data-id="${c.id}">${icon('check', 14)} Fait</button></div>`).join('') : empty('Rien à faire pour le moment.') };
}

function wMenu(s) {
  if (!moduleOn(s, 'maison')) return null;
  const m = (s.menus || {})[dayKey()] || {};
  return { title: 'Menu du jour', more: ['#/maison', 'Maison', 'menus'], html: `<div class="menu-mini"><p><span class="faint">Midi</span><b>${esc(m.lunch || '—')}</b></p><p><span class="faint">Soir</span><b>${esc(m.dinner || '—')}</b></p></div>` };
}

function wTrip(s, size) {
  if (!moduleOn(s, 'vacation')) return null;
  const t = [...(s.trips || [])].filter((x) => !tripState(x).past).sort((a, b) => a.start - b.start)[0];
  if (!t) return { title: 'Prochain voyage', more: ['#/vacances', 'Vacances'], html: empty('Aucun voyage à venir.') };
  const st = tripState(t), items = t.items || [], ready = items.filter((i) => i.done).length, sp = tripSpent(t);
  return { title: 'Prochain voyage', more: ['#/vacances', 'Vacances'], html: `<div class="row-between"><b>${esc(t.name)}</b><span class="badge tone-${st.tone}">${esc(st.text)}</span></div>
    ${t.dest ? `<p class="small muted">${esc(t.dest)}</p>` : ''}
    ${items.length ? `<div class="progress mt-12"><span style="width:${Math.round((ready / items.length) * 100)}%"></span></div><p class="small muted mt-8">Valises : ${ready}/${items.length}</p>` : ''}
    ${t.budget && size !== 'S' ? `<p class="small muted mt-8">Budget : ${eur(sp)} / ${eur(t.budget)}</p>` : ''}` };
}

function wGoals(s) {
  if (!moduleOn(s, 'finance')) return null;
  const g = (s.goals || []).slice(0, 3);
  return { title: "Objectifs d'épargne", more: ['#/budget', 'Budget'], html: g.length ? g.map((x) => { const sv = goalSaved(x), p = Math.min(100, Math.round((sv / x.target) * 100)); return `<div class="mt-8"><div class="row-between small"><b>${esc(x.name)}</b><span class="num muted">${eur(sv)} / ${eur(x.target)}</span></div><div class="progress mt-8"><span style="width:${p}%"></span></div></div>`; }).join('') : empty("Aucun objectif d'épargne.") };
}

function wActivity(s, size) {
  const rows = collectActivity(s, size === 'L' ? 10 : 6);
  return { title: 'Activité récente', html: rows.length ? `<div class="list-group">${rows.map((r) => `<button class="entry" data-act="activity" data-kind="${r.kind}" data-ref="${esc(r.ref || '')}" data-href="${r.href}"><span class="avatar-mini tone-${whoTone(r.by)}">${esc((r.by || '?')[0])}</span><span class="entry-body"><b style="font-weight:600"><span class="faint" style="font-weight:700">${esc(r.by || '')}</span> ${esc(r.text)}</b><small>${esc(ago(r.at))}</small></span></button>`).join('')}</div>` : empty('Aucune activité pour le moment.') };
}

function wMemo(s) {
  return { title: 'Mémo de la famille', html: `<textarea class="input memo" data-memo rows="4" maxlength="800" placeholder="Un mot pour la famille : code du portail, idées de week-end…">${esc(s.memo || '')}</textarea><p class="small faint mt-8">Partagé avec toute la famille.</p>` };
}

function wShortcuts(s) {
  const all = actionsFor(s), ids = uiOf(s).shortcuts, acts = ids.map((id) => all.find((a) => a.id === id)).filter(Boolean);
  return { title: 'Raccourcis', html: acts.length ? `<div class="short-grid">${acts.map((a) => `<button class="short-btn tone-${a.tone}" data-act="action" data-a="${a.id}"><span class="ac-icon">${icon(a.icon, 20)}</span><span>${esc(a.label)}</span></button>`).join('')}</div>` : empty('Choisissez vos raccourcis dans Personnaliser.') };
}

function wModules(s) {
  const mods = enabledModules(s).map((m) => modInfo(s, m.id));
  return { title: 'Mes modules', html: `<div class="short-grid">${mods.map((m) => `<a class="short-btn tone-${m.tone}" href="#/${m.route}"><span class="ac-icon">${icon(m.icon, 20)}</span><span>${esc(m.label)}</span></a>`).join('')}</div>` };
}

export const WIDGETS = {
  hello: { label: 'Bonjour et résumé', sizes: ['M'], render: wHello }, alerts: { label: 'À surveiller', sizes: ['M', 'L'], render: wAlerts },
  meds: { label: 'Prises du jour', sizes: ['M', 'L'], render: wMeds }, agenda: { label: 'Prochains rendez-vous', sizes: ['M', 'L'], render: wAgenda },
  baby: { label: 'Bébé', sizes: ['S', 'M'], render: wBaby }, budget: { label: 'Budget du mois', sizes: ['S', 'M'], render: wBudget },
  shop: { label: 'Courses', sizes: ['S', 'M', 'L'], render: wShop }, menu: { label: 'Menu du jour', sizes: ['S', 'M'], render: wMenu },
  chores: { label: 'Tâches à faire', sizes: ['M', 'L'], render: wChores }, trip: { label: 'Prochain voyage', sizes: ['S', 'M'], render: wTrip },
  goals: { label: "Objectifs d'épargne", sizes: ['M'], render: wGoals }, activity: { label: 'Activité récente', sizes: ['M', 'L'], render: wActivity },
  memo: { label: 'Mémo de la famille', sizes: ['S', 'M'], render: wMemo }, shortcuts: { label: 'Raccourcis', sizes: ['M'], render: wShortcuts },
  modules: { label: 'Mes modules', sizes: ['M'], render: wModules },
};
const DEFAULT_LAYOUT = [['hello', 'M'], ['alerts', 'M'], ['meds', 'M'], ['agenda', 'M'], ['baby', 'S'], ['budget', 'S'], ['shop', 'S'], ['menu', 'S'], ['chores', 'M'], ['trip', 'M'], ['goals', 'M'], ['activity', 'M'], ['memo', 'M'], ['shortcuts', 'M'], ['modules', 'M']];

/** Disposition de l'accueil : celle de l'utilisateur, complétée des widgets qu'il n'a jamais vus. */
export function layoutOf(s) {
  const defs = DEFAULT_LAYOUT.map(([id, size]) => ({ id, size, hidden: false }));
  let lay = (uiOf(s).widgets || defs).filter((w) => WIDGETS[w.id]).map((w) => ({ ...w }));
  for (const d of defs) if (!lay.some((w) => w.id === d.id)) lay.push({ ...d });
  return lay.map((w) => ({ ...w, size: WIDGETS[w.id].sizes.includes(w.size) ? w.size : WIDGETS[w.id].sizes[0] }));
}
const save = (lay, silent = false) => setUi({ widgets: lay.map(({ id, size, hidden }) => ({ id, size, hidden: !!hidden })) }, { silent });

/* ------------------------------------------------------------------- rendu */
const motionOff = () => !!uiOf(store.state).reduceMotion || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* pas de vibration */ } };

function shell(w, def, r, i) {
  const jig = `--j:${-(i % 6) * 0.05}s`;
  const badges = `<button class="dw-badge dw-hide" data-act="w-hide" data-id="${w.id}" aria-label="Masquer ${esc(def.label)}">${icon('minus', 14)}</button>${def.sizes.length > 1 ? `<button class="dw-badge dw-size" data-act="w-size" data-id="${w.id}" aria-label="Changer la taille de ${esc(def.label)}">${w.size}</button>` : ''}`;
  const attrs = `data-w="${w.id}" data-size="${w.size}" style="${jig}" tabindex="${editing ? 0 : -1}" aria-label="${esc(def.label)}"`;
  if (r.plain) return `<section class="dw dw-plain" ${attrs}>${badges}${r.html}</section>`;
  return `<section class="dw card" ${attrs}>${badges}
    <header class="dw-head"><b>${r.title}</b>${r.badge ? `<span class="dot-badge" style="margin-left:6px">${r.badge}</span>` : ''}${r.more ? `<a class="dw-more" href="${r.more[0]}"${r.more[2] ? ` data-tab="${r.more[2]}"` : ''}>${esc(r.more[1])} ${icon('chevronRight', 13)}</a>` : ''}</header>
    <div class="dw-body">${r.html}</div></section>`;
}

export function render(s) {
  const lay = layoutOf(s), ui = uiOf(s), shown = [], hidden = [];
  for (const w of lay) {
    const def = WIDGETS[w.id], r = def.render(s, w.size);
    if (!r) continue;                       // module désactivé : le widget n'existe pas
    (w.hidden ? hidden : shown).push({ w, def, r });
  }
  return `
    ${hubHeader(s)}
    <div class="org-bar card" role="region" aria-label="Organisation de l'accueil">
      <p><b>Organisez votre accueil</b></p>
      <p class="small muted">Maintenez un bloc appuyé, puis faites-le glisser où vous voulez. Le bouton rouge masque un bloc, la pastille noire en change la taille.</p>
      <div class="grid-2 mt-12"><button class="btn btn-primary btn-sm" data-act="edit-done">${icon('check', 16)} Terminé</button><button class="btn btn-ghost btn-sm" data-act="w-reset">Rétablir par défaut</button></div>
    </div>
    <div class="dash ${editing ? 'is-editing' : ''}">${shown.map(({ w, def, r }, i) => shell(w, def, r, i)).join('')}</div>
    <div class="org-tray card mt-16">${hidden.length ? `<p class="cat-title" style="padding-top:0">Blocs masqués : touchez pour les remettre</p><div class="chips">${hidden.map(({ w, def }) => `<button class="chip" data-act="w-show" data-id="${w.id}">${icon('plus', 13)} ${esc(def.label)}</button>`).join('')}</div>` : '<p class="small faint">Tous les blocs sont affichés.</p>'}</div>
    ${!ui.tipSeen ? `<div class="notice tone-gold mt-16 dash-tip">${icon('sparkle', 18)}<span class="grow" style="flex:1"><b>Démo de la version Premium.</b> Maintenez un bloc appuyé pour le déplacer, ou touchez la palette en haut pour tout personnaliser : couleurs, polices, tailles, navigation.</span><button class="btn btn-sm" data-act="tip-close">OK</button></div>` : ''}`;
}

/* --------------------------------------------------- animations de réarrangement */
const snapAll = (root) => new Map([...root.querySelectorAll(':scope > .dw, :scope > .dw-ghost')].map((n) => [n, n.getBoundingClientRect()]));
/** FLIP : les blocs partent de leur ancienne position et glissent jusqu'à la nouvelle. */
function flip(before, skip) {
  if (motionOff()) return;
  for (const [n, a] of before) {
    if (n === skip || !n.isConnected) continue;
    const b = n.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    n.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }], { duration: 280, easing: 'cubic-bezier(.2,.9,.25,1)' });
  }
}
/** Après un nouveau rendu : même chose, par identifiant de bloc (taille changée = déformation fluide). */
function playFlip(dash) {
  const from = flipFrom; flipFrom = null;
  if (!from || motionOff()) return;
  dash.querySelectorAll(':scope > .dw').forEach((n) => {
    const a = from.get(n.dataset.w), b = n.getBoundingClientRect();
    if (!a) { n.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' }); return; }
    const dx = a.left - b.left, dy = a.top - b.top, sx = a.width / b.width, sy = a.height / b.height;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < .01 && Math.abs(sy - 1) < .01) return;
    n.style.transformOrigin = 'top left';
    n.animate([{ transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }, { transform: 'translate(0,0) scale(1,1)' }], { duration: 340, easing: 'cubic-bezier(.34,1.3,.5,1)' }).onfinish = () => { n.style.transformOrigin = ''; };
  });
}
const snapById = (dash) => new Map([...dash.querySelectorAll(':scope > .dw')].map((n) => [n.dataset.w, n.getBoundingClientRect()]));

/* --------------------------------------------------------- mode organisation */
function setEditing(on) {
  editing = on;
  document.body.classList.toggle('org-mode', on);
  const dash = document.querySelector('.dash');
  if (dash) { dash.classList.toggle('is-editing', on); dash.querySelectorAll(':scope > .dw').forEach((n) => { n.tabIndex = on ? 0 : -1; }); }
  if (on) buzz(8);
}
export const stopEditing = () => { editing = false; document.body.classList.remove('org-mode'); };

/**
 * On appuie sur un bloc : maintenu (ou déplacé à la souris en mode organisation), il se soulève et suit le doigt.
 * Un emplacement en pointillés montre où il se posera ; les autres blocs s'écartent en glissant.
 */
function armPress(e, el, dash) {
  if (e.target.closest('.dw-badge, textarea, input, select')) return;
  const touch = e.pointerType !== 'mouse';
  if (!touch && e.button !== 0) return;
  const start0 = { x: e.clientX, y: e.clientY };
  const hold = editing ? (touch ? 160 : 0) : 480, slop = editing && !touch ? 4 : 10;
  let last = { ...start0 }, timer = 0, gone = false;
  const cleanup = () => { gone = true; clearTimeout(timer); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', cancel); window.removeEventListener('pointercancel', cancel); };
  const cancel = () => cleanup();
  const go = () => { if (gone) return; cleanup(); if (!editing) setEditing(true); beginDrag(el, dash, last); };
  const move = (ev) => { last = { x: ev.clientX, y: ev.clientY }; if (Math.hypot(last.x - start0.x, last.y - start0.y) > slop) { if (editing && !touch) go(); else cancel(); } };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', cancel); window.addEventListener('pointercancel', cancel);
  if (hold) timer = setTimeout(go, hold);
}

function beginDrag(el, dash, from) {
  const reduce = motionOff(), r = el.getBoundingClientRect(), grab = { x: from.x - r.left, y: from.y - r.top };
  const ghost = document.createElement('div'); ghost.className = 'dw-ghost'; ghost.dataset.size = el.dataset.size; ghost.style.height = `${r.height}px`;
  el.after(ghost);
  Object.assign(el.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, zIndex: '60', pointerEvents: 'none', margin: '0', transition: 'none' });
  el.classList.add('is-drag'); document.body.classList.add('dragging'); buzz(14);
  const block = (ev) => { if (ev.cancelable) ev.preventDefault(); };            // pas de défilement pendant le déplacement
  window.addEventListener('touchmove', block, { passive: false });
  let cur = { ...from }, raf = 0, auto = 0;

  const place = () => {
    raf = 0;
    el.style.left = `${cur.x - grab.x}px`; el.style.top = `${cur.y - grab.y}px`;
    const under = document.elementFromPoint(cur.x, cur.y)?.closest('.dw');
    if (!under || under === el || under.parentElement !== dash) return;
    const rt = under.getBoundingClientRect(), side = rt.width < dash.clientWidth * 0.75;
    const frac = side ? (cur.x - rt.left) / rt.width : (cur.y - rt.top) / rt.height;
    const targetAfter = !!(ghost.compareDocumentPosition(under) & Node.DOCUMENT_POSITION_FOLLOWING);
    let ref;
    if (targetAfter && frac > 0.55) ref = under.nextSibling; else if (!targetAfter && frac < 0.45) ref = under; else return;
    const before = snapAll(dash); dash.insertBefore(ghost, ref); flip(before, el); buzz(6);
  };
  const move = (ev) => { cur = { x: ev.clientX, y: ev.clientY }; if (!raf) raf = requestAnimationFrame(place); };
  auto = setInterval(() => { const d = cur.y < 100 ? -16 : cur.y > innerHeight - 110 ? 16 : 0; if (d) { window.scrollBy(0, d); place(); } }, 16);

  const end = () => {
    clearInterval(auto); cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('touchmove', block);
    const g = ghost.getBoundingClientRect(), t = reduce ? 'none' : 'left .34s cubic-bezier(.34,1.56,.64,1), top .34s cubic-bezier(.34,1.56,.64,1), width .3s var(--ease), height .3s var(--ease), transform .34s cubic-bezier(.34,1.56,.64,1), box-shadow .3s';
    el.style.transition = t; el.classList.remove('is-drag'); el.classList.add('is-drop');
    el.style.left = `${g.left}px`; el.style.top = `${g.top}px`; el.style.width = `${g.width}px`; el.style.height = `${g.height}px`;
    const done = () => {
      ['position', 'left', 'top', 'width', 'height', 'zIndex', 'pointerEvents', 'margin', 'transition'].forEach((k) => { el.style[k] = ''; });
      ghost.replaceWith(el); el.classList.remove('is-drop'); document.body.classList.remove('dragging'); buzz(10);
      const order = [...dash.querySelectorAll(':scope > .dw')].map((n) => n.dataset.w), lay = ctx.layout(store.state), byId = Object.fromEntries(lay.map((w) => [w.id, w]));
      ctx.save([...order.map((id) => byId[id]).filter(Boolean), ...lay.filter((w) => !order.includes(w.id))], true);
    };
    setTimeout(done, reduce ? 0 : 350);
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  place();
}

/** Moteur commun : glisser-déposer, clavier, masquer / redimensionner / rétablir. Retourne la fonction de nettoyage. */
function mountOrganizer(el, c) {
  ctx = c;
  const dash = el.querySelector('.dash');
  document.body.classList.toggle('org-mode', editing);
  dash.classList.toggle('is-editing', editing);
  dash.querySelectorAll(':scope > .dw').forEach((n) => n.addEventListener('pointerdown', (e) => armPress(e, n, dash)));
  playFlip(dash);
  if (focusId) { dash.querySelector(`.dw[data-w="${focusId}"]`)?.focus({ preventScroll: true }); focusId = null; }
  // clavier : en mode organisation, les flèches déplacent le bloc ciblé
  dash.addEventListener('keydown', (e) => {
    const n = e.target.closest?.('.dw'); if (!editing || !n || e.target !== n) return;
    const d = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key]; if (!d) return;
    e.preventDefault();
    const lay = ctx.layout(store.state), vis = lay.map((w, k) => k).filter((k) => !lay[k].hidden), i = lay.findIndex((w) => w.id === n.dataset.w), tgt = vis[vis.indexOf(i) + d];
    if (tgt === undefined) return;
    flipFrom = snapById(dash); focusId = n.dataset.w; [lay[i], lay[tgt]] = [lay[tgt], lay[i]]; ctx.save(lay);
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, lay = ctx.layout(store.state), i = lay.findIndex((w) => w.id === id), keep = () => { flipFrom = snapById(dash); };
    switch (b.dataset.act) {
      case 'edit': setEditing(true); break;
      case 'edit-done': setEditing(false); break;
      case 'w-reset': keep(); ctx.reset(); break;
      case 'w-hide': keep(); lay[i].hidden = true; ctx.save(lay); break;
      case 'w-show': keep(); lay[i].hidden = false; ctx.save(lay); break;
      case 'w-size': { keep(); const sz = ctx.sizes(id); lay[i].size = sz[(sz.indexOf(lay[i].size) + 1) % sz.length]; ctx.save(lay); break; }
    }
  });
  try { if (sessionStorage.getItem('dash-edit') && c.canAutoEdit) { sessionStorage.removeItem('dash-edit'); setTimeout(() => setEditing(true), 80); } } catch { /* stockage indisponible */ }
}

/** Page Bébé : mêmes gestes que l'accueil. */
export function mountBaby(el, c) { mountOrganizer(el, c); }
export const startOrganizing = () => setEditing(true);

/** Barre et bac « blocs masqués » affichés en mode organisation (communs à l'accueil et à Bébé). */
export const orgBarHtml = (what) => `<div class="org-bar card" role="region" aria-label="Organisation"><p><b>Organisez ${what}</b></p><p class="small muted">Maintenez un bloc appuyé, puis faites-le glisser où vous voulez. Le bouton rouge masque un bloc, la pastille noire en change la taille.</p><div class="grid-2 mt-12"><button class="btn btn-primary btn-sm" data-act="edit-done">${icon('check', 16)} Terminé</button><button class="btn btn-ghost btn-sm" data-act="w-reset">Rétablir par défaut</button></div></div>`;
export const orgTrayHtml = (hidden) => `<div class="org-tray card mt-16">${hidden.length ? `<p class="cat-title" style="padding-top:0">Blocs masqués : touchez pour les remettre</p><div class="chips">${hidden.map(({ id, label }) => `<button class="chip" data-act="w-show" data-id="${id}">${icon('plus', 13)} ${esc(label)}</button>`).join('')}</div>` : '<p class="small faint">Tous les blocs sont affichés.</p>'}</div>`;
/** Enveloppe d'un bloc déplaçable (page Bébé). */
export function blockShell({ id, label, size, sizes, html, i = 0 }) {
  const badges = `<button class="dw-badge dw-hide" data-act="w-hide" data-id="${id}" aria-label="Masquer ${esc(label)}">${icon('minus', 14)}</button>${sizes.length > 1 ? `<button class="dw-badge dw-size" data-act="w-size" data-id="${id}" aria-label="Changer la taille de ${esc(label)}">${size}</button>` : ''}`;
  return `<section class="dw dw-plain" data-w="${id}" data-size="${size}" style="--j:${-(i % 6) * 0.05}s" tabindex="${editing ? 0 : -1}" aria-label="${esc(label)}">${badges}${html}</section>`;
}

export function mount(el) {
  mountOrganizer(el, { layout: layoutOf, save, sizes: (id) => WIDGETS[id].sizes, reset: () => setUi({ widgets: null }), canAutoEdit: true });
  const dash = el.querySelector('.dash');
  let memoTimer = 0;
  el.addEventListener('input', (e) => {
    if (!e.target.matches('[data-memo]')) return;
    clearTimeout(memoTimer); const v = e.target.value;
    memoTimer = setTimeout(() => store.update((s) => { s.memo = v; }, { silent: true }), 500);
  });
  el.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form="shop"]'); if (!f) return; e.preventDefault();
    const t = f.elements.text.value.trim(); if (!t) return;
    if (!addShopping(t)) toast(`« ${t} » est déjà dans la liste`);
  });
  el.addEventListener('click', (e) => {
    const more = e.target.closest('a.dw-more[data-tab]');
    if (more) maisonTab(more.dataset.tab);
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.act) {
      case 'tip-close': setUi({ tipSeen: true }); break;
      case 'dose': takeDose(id, b.dataset.slot); break;
      case 'dose-adhoc': adhocDose(id); break;
      case 'chore': doneChore(id); break;
      case 'shop-toggle': store.update((s) => { const x = (s.lists.find((l) => l.kind === 'shop')?.items || []).find((it) => it.id === id); if (x) { x.done = true; x.doneBy = s.me; } }); break;
      case 'action': ACTIONS[b.dataset.a]?.run(); break;
      case 'baby-detail': openBabyDetail(b.dataset.k); break;
      case 'activity': openActivity(b.dataset.kind, b.dataset.ref, b.dataset.href); break;
    }
  });
}

/* ---------- Détail « Repas » / « Couches » en popup ---------- */
const KIND_FR = { wet: 'Mouillée', dirty: 'Sale', mixed: 'Mixte' };
export function openBabyDetail(kind) {
  const s = store.state, c = activeChild(s); if (!c) return;
  const feed = kind === 'feed', t0 = startOfDay();
  const all = eventsOf(s, c.id).filter((e) => e.type === kind), today = all.filter((e) => e.at >= t0), last = all[0];
  const ml = today.reduce((a, e) => a + (e.ml || 0), 0);
  const lastTxt = !last ? 'Rien noté pour le moment.' : feed
    ? `${last.kind === 'bottle' ? `Biberon${last.ml ? ` de ${last.ml} ml` : ''}${last.milk === 'maternel' ? ' (lait maternel)' : ''}` : 'Tétée'}`
    : `${KIND_FR[last.kind] || 'Couche'}${last.color ? ` · ${last.color}` : ''}${last.texture ? ` · ${last.texture}` : ''}`;
  openSheet({
    title: feed ? 'Repas' : 'Couches', subtitle: c.name,
    content: `
      <div class="card tone-${feed ? 'salmon' : 'peach'}" style="padding:14px 16px"><p class="label" style="margin:0 0 4px">Dernier${feed ? '' : 'e'}</p>
        <b style="font-size:1.1rem">${esc(lastTxt)}</b>
        ${last ? `<p class="small muted" style="margin:4px 0 0">${esc(ago(last.at))} · ${esc(time(last.at))}${last.by ? ` · par ${esc(last.by)}` : ''}</p>` : ''}</div>
      <div class="mini-stats mt-12"><div><span class="faint">Aujourd’hui</span><b class="num">${today.length}</b></div>${feed ? `<div><span class="faint">Lait</span><b class="num">${ml} ml</b></div>` : `<div><span class="faint">Sales / mixtes</span><b class="num">${today.filter((e) => e.kind !== 'wet').length}</b></div>`}</div>
      <p class="label mt-16">Aujourd’hui</p>
      <div class="card timeline">${today.length ? today.map((e) => eventRow(e)).join('') : '<p class="small faint" style="padding:12px">Rien aujourd’hui.</p>'}</div>
      <div class="grid-2 mt-16"><button class="btn btn-ghost" data-close>Fermer</button><button class="btn btn-primary" data-add>${icon('plus', 18)} ${feed ? 'Ajouter un repas' : 'Ajouter une couche'}</button></div>`,
    onMount(body, api) {
      body.querySelector('[data-close]').addEventListener('click', () => api.close());
      body.querySelector('[data-add]').addEventListener('click', () => { api.close(); ACTIONS[kind]?.run(); });
      body.addEventListener('click', (e) => { const r = e.target.closest('[data-act="event"]'); if (r) { api.close(); setTimeout(() => openEvent(r.dataset.id), 260); } });
    },
  });
}

/* ---------- Détail d'une ligne de « Activité récente » en popup ---------- */
function openActivity(kind, ref, href) {
  const s = store.state, rows = collectActivity(s, 30), r = rows.find((x) => x.kind === kind && String(x.ref) === ref);
  if (kind === 'event') return openEvent(ref);               // événements de bébé : fiche complète (modifier / supprimer)
  if (!r) return;
  const lines = [], add = (k, v) => { if (v) lines.push([k, v]); };
  if (kind === 'expense') { const e = (s.expenses || []).find((x) => x.id === ref); if (e) { add('Montant', eur(e.amount)); add('Catégorie', catOf(e.cat)?.label); add('Note', e.note); add('Date', dayLabel(e.at)); } }
  if (kind === 'dose') { const d = (s.doses || []).find((x) => x.id === ref), h = d && (s.health || []).find((x) => x.id === d.tid); add('Médicament', h?.title); add('Pour', (s.members || []).find((m) => m.id === (d?.memberId || h?.memberId))?.name); add('Heure', d && time(d.at)); }
  if (kind === 'chore') { const c = (s.chores || []).find((x) => x.id === ref); add('Tâche', c?.name); add('Fait le', c?.last && `${dayLabel(c.last)} · ${time(c.last)}`); }
  if (kind === 'agenda') { const e = (s.agenda || []).find((x) => x.id === ref); add('Titre', e?.title); add('Quand', e && `${dayLabel(e.start)}${e.allDay ? '' : ' · ' + time(e.start)}`); add('Lieu', e?.place); add('Note', e?.note); }
  const dest = { expense: 'Voir le budget', dose: 'Voir la santé', chore: 'Voir les tâches', agenda: 'Voir l’agenda' }[kind] || 'Ouvrir';
  openSheet({
    title: r.text.replace(/^a /, '').replace(/^./, (c) => c.toUpperCase()), subtitle: `${r.by || '—'} · ${ago(r.at)} · ${time(r.at)}`,
    content: `<div class="row tone-${whoTone(r.by)}" style="gap:12px"><span class="avatar-mini tone-${whoTone(r.by)}">${esc((r.by || '?')[0])}</span><p class="muted" style="margin:0"><b>${esc(r.by || '')}</b> ${esc(r.text)}</p></div>
      ${lines.length ? `<div class="card list-group mt-12">${lines.map(([k, v]) => `<div class="entry"><span class="entry-body"><small>${esc(k)}</small><b>${esc(v)}</b></span></div>`).join('')}</div>` : ''}
      <div class="grid-2 mt-16"><button class="btn btn-ghost" data-close>Fermer</button><button class="btn btn-primary" data-go>${esc(dest)}</button></div>`,
    onMount(body, api) {
      body.querySelector('[data-close]').addEventListener('click', () => api.close());
      body.querySelector('[data-go]').addEventListener('click', () => { api.close(); location.hash = href || r.href; });
    },
  });
}
