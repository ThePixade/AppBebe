import { store, moduleOn, activeChild, eventsOf, lastOf } from '../store.js';
import { icon } from '../icons.js';
import { esc, eur, fmtNum, fmtDur, ago, time, dayLabel, dayKey, startOfDay, toast, DAY } from '../ui.js';
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

/*
 * Accueil « tableau de bord » (édition Premium) : des widgets qu'on déplace, redimensionne et masque,
 * et qui résument ce qui compte (alertes, prises du jour, rendez-vous, bébé, budget, courses, tâches…).
 * Taille S = demi-largeur, M = pleine largeur, L = pleine largeur avec plus de contenu.
 */
let editing = false;
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
  const lf = lastOf(s, c.id, 'feed'), sleeping = s.timers?.sleep?.[c.id];
  return { title: `${esc(c.name)}`, more: ['#/home', 'Bébé'], html: `
    <div class="mini-stats" style="border-top:0;padding-top:0"><div><span class="faint">Repas</span><b class="num">${feeds.length}</b></div><div><span class="faint">Couches</span><b class="num">${diapers}</b></div><div><span class="faint">Sommeil</span><b class="num">${esc(fmtDur(sleepMs).replace('< 1 min', '0 min'))}</b></div></div>
    <p class="small muted mt-8">${sleeping ? `${icon('moon', 13)} Dort depuis ${esc(fmtDur(Date.now() - sleeping))}` : lf ? `Dernier repas ${esc(ago(lf.at))}` : 'Aucun repas noté'}</p>
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
  const l = (s.lists || []).find((x) => x.kind === 'shop'), todo = (l?.items || []).filter((i) => !i.done), n = size === 'S' ? 3 : size === 'L' ? 8 : 4;
  return { title: 'Courses', badge: todo.length || '', more: ['#/maison', 'Maison'], html: `
    ${todo.length ? `<div class="list-group">${todo.slice(0, n).map((i) => `<button class="check" data-act="shop-toggle" data-id="${i.id}"><span class="check-box">${icon('check', 14)}</span><span class="check-text">${esc(i.text)}${i.qty ? ` <span class="qty-tag">× ${esc(i.qty)}</span>` : ''}</span></button>`).join('')}</div>${todo.length > n ? `<p class="small faint" style="padding-top:4px">+ ${todo.length - n} autre${todo.length - n > 1 ? 's' : ''}</p>` : ''}` : empty('Liste vide : rien à acheter.')}
    ${size !== 'S' ? `<form class="add-line mt-12" data-form="shop"><input class="input" name="text" placeholder="Ajouter un article…" autocomplete="off" maxlength="80"><button class="btn btn-primary" type="submit" aria-label="Ajouter">${icon('plus', 18)}</button></form>` : ''}` };
}

function wChores(s, size) {
  if (!moduleOn(s, 'maison')) return null;
  const list = (s.chores || []).map((c) => ({ c, st: choreState(c) })).sort((a, b) => a.st.delta - b.st.delta).filter((x) => x.st.delta <= 1).slice(0, size === 'L' ? 6 : 4);
  return { title: 'Tâches à faire', more: ['#/maison', 'Maison'], html: list.length ? list.map(({ c, st }) => `<div class="chore-row tone-${st.tone}"><span class="entry-body"><b>${esc(c.name)}</b><small><span class="chore-due" style="color:var(--${st.tone === 'brick' ? 'brick' : 'salmon'})">${esc(st.label)}</span>${assignee(c) ? ` · ${esc(assignee(c))}` : ''}</small></span><button class="btn btn-sm btn-primary" data-act="chore" data-id="${c.id}">${icon('check', 14)} Fait</button></div>`).join('') : empty('Rien à faire pour le moment.') };
}

function wMenu(s) {
  if (!moduleOn(s, 'maison')) return null;
  const m = (s.menus || {})[dayKey()] || {};
  return { title: 'Menu du jour', more: ['#/maison', 'Maison'], html: `<div class="menu-mini"><p><span class="faint">Midi</span><b>${esc(m.lunch || '—')}</b></p><p><span class="faint">Soir</span><b>${esc(m.dinner || '—')}</b></p></div>` };
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
  return { title: 'Activité récente', html: rows.length ? `<div class="list-group">${rows.map((r) => `<a class="entry" href="${r.href}"><span class="avatar-mini tone-${whoTone(r.by)}">${esc((r.by || '?')[0])}</span><span class="entry-body"><b style="font-weight:600"><span class="faint" style="font-weight:700">${esc(r.by || '')}</span> ${esc(r.text)}</b><small>${esc(ago(r.at))}</small></span></a>`).join('')}</div>` : empty('Aucune activité pour le moment.') };
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
function shell(w, def, r) {
  if (r.plain) return `<section class="dw dw-plain" data-w="${w.id}" data-size="${w.size}">${editing ? tools(w, def) : ''}${r.html}</section>`;
  return `<section class="dw card" data-w="${w.id}" data-size="${w.size}">
    ${editing ? tools(w, def) : ''}
    <header class="dw-head"><b>${r.title}</b>${r.badge ? `<span class="dot-badge" style="margin-left:6px">${r.badge}</span>` : ''}${!editing && r.more ? `<a class="dw-more" href="${r.more[0]}">${esc(r.more[1])} ${icon('chevronRight', 13)}</a>` : ''}</header>
    <div class="dw-body">${r.html}</div></section>`;
}
function tools(w, def) {
  return `<div class="dw-tools"><span class="dw-grip" data-grip aria-label="Déplacer ${esc(def.label)}" role="button" tabindex="0">${icon('grip', 18)}</span><b class="dw-name">${esc(def.label)}</b>
    <button data-act="w-up" data-id="${w.id}" aria-label="Monter">${icon('up', 16)}</button><button data-act="w-down" data-id="${w.id}" aria-label="Descendre">${icon('down', 16)}</button>
    ${def.sizes.length > 1 ? `<button data-act="w-size" data-id="${w.id}" aria-label="Changer la taille">${icon('resize', 15)}<small>${w.size}</small></button>` : ''}
    <button data-act="w-hide" data-id="${w.id}" aria-label="Masquer">${icon('eyeoff', 16)}</button></div>`;
}

export function render(s) {
  const lay = layoutOf(s), ui = uiOf(s);
  const shown = [], hidden = [];
  for (const w of lay) {
    const def = WIDGETS[w.id], r = def.render(s, w.size);
    if (!r) continue;                       // module désactivé : le widget n'existe pas
    (w.hidden ? hidden : shown).push({ w, def, r });
  }
  return `
    ${hubHeader(s)}
    ${editing ? `<div class="card edit-bar"><p><b>Personnalisation de l'accueil</b></p><p class="small muted">Glissez une case par sa poignée ${icon('grip', 13)}, changez sa taille, ou masquez-la. Les cases « S » se mettent côte à côte.</p>
      <div class="grid-2 mt-12"><button class="btn btn-primary btn-sm" data-act="edit-done">${icon('check', 16)} Terminé</button><button class="btn btn-ghost btn-sm" data-act="w-reset">Rétablir par défaut</button></div></div>`
      : `<div class="dash-bar"><button class="pill-btn" data-act="edit">${icon('settings', 15)} Organiser l'accueil</button><a class="pill-btn" href="#/perso">${icon('palette', 15)} Apparence</a></div>`}
    <div class="dash ${editing ? 'is-editing' : ''}">${shown.map(({ w, def, r }) => shell(w, def, r)).join('')}</div>
    ${editing && hidden.length ? `<div class="card mt-16"><p class="cat-title" style="padding-top:0">Widgets masqués</p>${hidden.map(({ w, def }) => `<div class="row-between" style="padding:8px 0;border-top:1px solid var(--border)"><span>${esc(def.label)}</span><button class="btn btn-ghost btn-sm" data-act="w-show" data-id="${w.id}">${icon('plus', 14)} Afficher</button></div>`).join('')}</div>` : ''}
    ${!ui.tipSeen && !editing ? `<div class="notice tone-gold mt-16">${icon('sparkle', 18)}<span class="grow" style="flex:1"><b>Démo de la version Premium.</b> Touchez « Organiser l'accueil » pour déplacer les cases, ou « Apparence » pour tout personnaliser : couleurs, polices, tailles, navigation.</span><button class="btn btn-sm" data-act="tip-close">OK</button></div>` : ''}`;
}

/* ------------------------------------------------------------ interactions */
function startDrag(e, el, dash) {
  e.preventDefault();
  const grip = e.currentTarget, sx = window.scrollX, sy = window.scrollY, r0 = el.getBoundingClientRect();
  const startPage = { x: r0.left + sx, y: r0.top + sy }, p0 = { x: e.clientX + sx, y: e.clientY + sy };
  let last = { x: e.clientX, y: e.clientY }, raf = 0, timer = 0;
  el.classList.add('is-drag'); document.body.classList.add('dragging');
  try { grip.setPointerCapture(e.pointerId); } catch { /* ignoré */ }
  const step = () => {
    raf = 0;
    el.style.transform = ''; el.style.pointerEvents = 'none';
    const under = document.elementFromPoint(last.x, last.y)?.closest('.dw');
    el.style.pointerEvents = '';
    if (under && under !== el && under.parentElement === dash) {
      const r = under.getBoundingClientRect(), side = r.width < dash.clientWidth * 0.75;
      const after = side ? last.x > r.left + r.width / 2 : last.y > r.top + r.height / 2;
      dash.insertBefore(el, after ? under.nextSibling : under);
      try { grip.setPointerCapture(e.pointerId); } catch { /* le déplacement dans la page a pu libérer la capture */ }
    }
    const n = el.getBoundingClientRect();
    const dx = startPage.x + (last.x + window.scrollX - p0.x) - (n.left + window.scrollX), dy = startPage.y + (last.y + window.scrollY - p0.y) - (n.top + window.scrollY);
    el.style.transform = `translate(${dx}px,${dy}px)`;
  };
  const move = (ev) => { last = { x: ev.clientX, y: ev.clientY }; if (!raf) raf = requestAnimationFrame(step); };
  timer = setInterval(() => { if (last.y < 90) { window.scrollBy(0, -14); move({ clientX: last.x, clientY: last.y }); } else if (last.y > window.innerHeight - 90) { window.scrollBy(0, 14); move({ clientX: last.x, clientY: last.y }); } }, 16);
  const end = () => {
    clearInterval(timer); cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
    el.classList.remove('is-drag'); document.body.classList.remove('dragging'); el.style.transform = '';
    const order = [...dash.querySelectorAll(':scope > .dw')].map((n) => n.dataset.w).filter((id) => id !== 'hello' || true);
    const lay = layoutOf(store.state), byId = Object.fromEntries(lay.map((w) => [w.id, w]));
    const next = [...order.map((id) => byId[id]).filter(Boolean), ...lay.filter((w) => !order.includes(w.id))];
    save(next, true);
  };
  // sur la fenêtre : déplacer l'élément dans la page fait perdre la capture du pointeur à la poignée
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  step();
}

export function mount(el) {
  const dash = el.querySelector('.dash');
  el.querySelectorAll('[data-grip]').forEach((g) => g.addEventListener('pointerdown', (e) => startDrag(e, g.closest('.dw'), dash)));

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
    const b = e.target.closest('[data-act]'); if (!b) return;
    const S = store.state, id = b.dataset.id, lay = layoutOf(S), i = lay.findIndex((w) => w.id === id);
    const move = (d) => { const vis = lay.map((w, k) => k).filter((k) => !lay[k].hidden), pos = vis.indexOf(i), tgt = vis[pos + d]; if (tgt === undefined) return; [lay[i], lay[tgt]] = [lay[tgt], lay[i]]; save(lay); };
    switch (b.dataset.act) {
      case 'edit': editing = true; store.refresh(); break;
      case 'edit-done': editing = false; store.refresh(); break;
      case 'tip-close': setUi({ tipSeen: true }); break;
      case 'w-reset': setUi({ widgets: null }); break;
      case 'w-hide': lay[i].hidden = true; save(lay); break;
      case 'w-show': lay[i].hidden = false; save(lay); break;
      case 'w-up': move(-1); break;
      case 'w-down': move(1); break;
      case 'w-size': { const sz = WIDGETS[id].sizes; lay[i].size = sz[(sz.indexOf(lay[i].size) + 1) % sz.length]; save(lay); break; }
      case 'dose': takeDose(id, b.dataset.slot); break;
      case 'dose-adhoc': adhocDose(id); break;
      case 'chore': doneChore(id); break;
      case 'shop-toggle': store.update((s) => { const x = (s.lists.find((l) => l.kind === 'shop')?.items || []).find((it) => it.id === id); if (x) { x.done = true; x.doneBy = s.me; } }); break;
      case 'action': ACTIONS[b.dataset.a]?.run(); break;
    }
  });
}
export const stopEditing = () => { editing = false; };
