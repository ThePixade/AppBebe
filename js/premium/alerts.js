import { activeChild, moduleOn } from '../store.js';
import { eur, fmtNum, startOfDay, dayKey, ago, time, DAY } from '../ui.js';
import { sync } from '../sync.js';
import { healthAlerts } from '../pages/sante.js';
import { dosesToday } from '../health/doses.js';
import { monthStats, goalSaved } from '../budget/stats.js';
import { choreState } from '../pages/maison.js';
import { tripState } from '../pages/vacances.js';
import { lowItems, daysLeft } from '../supplies.js';
import { catOfEvent, CATS } from '../pages/agenda.js';

/*
 * Ce qui mérite l'attention maintenant : alertes classées par importance, et activité récente de la famille.
 * Alimente l'accueil tableau de bord (édition Premium).
 */
export const toneOf = (w) => (w >= 80 ? 'brick' : w >= 50 ? 'gold' : 'slate');

export function collectAlerts(s, now = Date.now()) {
  const out = [], add = (a) => out.push({ tone: toneOf(a.weight), ...a });

  if (sync.available && sync.status === 'error') add({ id: 'sync', weight: 95, icon: 'alert', title: 'Synchronisation en pause', sub: 'Les données ne sont pas partagées avec le NAS pour le moment', href: '#/hub' });

  if (moduleOn(s, 'medical') && s.members?.length) {
    const h = healthAlerts(s);
    for (const { m, e } of h.fevers) add({ id: 'fever' + m.id, weight: 100, icon: 'thermo', title: `Fièvre : ${m.name}`, sub: `${fmtNum(e.value)} °C ${ago(e.at)}`, href: '#/sante' });
    const rows = dosesToday(s, now), late = rows.filter((r) => r.status === 'late'), due = rows.filter((r) => r.status === 'due');
    if (late.length) add({ id: 'dlate', weight: 90, icon: 'pill', title: `${late.length} prise${late.length > 1 ? 's' : ''} de médicament en retard`, sub: late.slice(0, 2).map((r) => r.h.title).join(', '), href: '#/sante' });
    if (due.length) add({ id: 'ddue', weight: 62, icon: 'pill', title: `${due.length} prise${due.length > 1 ? 's' : ''} à donner maintenant`, sub: due.slice(0, 2).map((r) => r.h.title).join(', '), href: '#/sante' });
    const nCal = h.cal.reduce((t, x) => t + x.n, 0);
    if (nCal) add({ id: 'cal', weight: 55, icon: 'syringe', title: `${nCal} vaccin${nCal > 1 ? 's' : ''} ou suivi${nCal > 1 ? 's' : ''} à faire`, sub: h.cal.map((x) => x.m.name).join(', '), href: '#/sante' });
    if (h.expired.length) add({ id: 'exp', weight: 40, icon: 'pill', title: `${h.expired.length} médicament${h.expired.length > 1 ? 's' : ''} périmé${h.expired.length > 1 ? 's' : ''} ou bientôt`, sub: 'À vérifier dans la pharmacie', href: '#/sante' });
  }

  if (moduleOn(s, 'agenda')) {
    const today = startOfDay(now);
    for (const e of (s.agenda || []).filter((x) => (x.allDay ? startOfDay(x.end ?? x.start) >= today : (x.end ?? x.start) >= now) && startOfDay(x.start) <= today + DAY).sort((a, b) => a.start - b.start).slice(0, 3)) {
      const isToday = startOfDay(e.start) <= today;
      add({ id: 'ev' + e.id, weight: isToday ? 80 : 50, icon: CATS[catOfEvent(e, s)].icon, title: `${isToday ? "Aujourd'hui" : 'Demain'} · ${e.title}`, sub: `${e.allDay ? 'Toute la journée' : time(e.start)}${e.place ? ` · ${e.place}` : ''}`, href: '#/agenda' });
    }
  }

  if (moduleOn(s, 'finance')) {
    const st = monthStats(s);
    if (st.budget && st.spent > st.budget) add({ id: 'bover', weight: 85, icon: 'wallet', title: 'Budget du mois dépassé', sub: `${eur(st.spent)} dépensés sur ${eur(st.budget)}`, href: '#/budget' });
    else {
      const over = Object.entries(st.catBudgets || {}).filter(([k, lim]) => lim > 0 && (st.byCat[k] || 0) >= lim * 0.8);
      if (over.length) add({ id: 'cbud', weight: over.some(([k, lim]) => (st.byCat[k] || 0) >= lim) ? 70 : 45, icon: 'wallet', title: `${over.length} catégorie${over.length > 1 ? 's' : ''} proche${over.length > 1 ? 's' : ''} du budget`, sub: 'Voir le détail par catégorie', href: '#/budget' });
    }
    const late = (s.goals || []).filter((g) => g.deadline && g.deadline < now && goalSaved(g) < g.target);
    if (late.length) add({ id: 'goal', weight: 35, icon: 'target', title: `${late.length} objectif${late.length > 1 ? 's' : ''} d'épargne en retard`, sub: late.map((g) => g.name).join(', '), href: '#/budget' });
  }

  if (moduleOn(s, 'maison')) {
    const lateChores = (s.chores || []).filter((c) => choreState(c, now).delta < 0);
    if (lateChores.length) add({ id: 'chores', weight: 52, icon: 'home', title: `${lateChores.length} tâche${lateChores.length > 1 ? 's' : ''} ménagère${lateChores.length > 1 ? 's' : ''} en retard`, sub: lateChores.slice(0, 2).map((c) => c.name).join(', '), href: '#/maison' });
  }

  if (moduleOn(s, 'baby') && activeChild(s)) {
    for (const it of lowItems(s).slice(0, 2)) { const d = daysLeft(s, it); add({ id: 'low' + it.id, weight: 65, icon: 'box', title: `Stock bas : ${it.name}`, sub: d !== null ? `Environ ${Math.max(0, Math.round(d))} jour${Math.round(d) > 1 ? 's' : ''} restant${Math.round(d) > 1 ? 's' : ''}` : 'À racheter', href: '#/plan' }); }
  }

  if (moduleOn(s, 'vacation')) {
    for (const t of (s.trips || []).filter((x) => !tripState(x).past).sort((a, b) => a.start - b.start).slice(0, 1)) {
      const days = Math.round((startOfDay(t.start) - startOfDay(now)) / DAY), items = t.items || [], ready = items.filter((i) => i.done).length;
      if (days >= 0 && days <= 14 && items.length && ready < items.length) add({ id: 'trip' + t.id, weight: 58, icon: 'plane', title: `${t.name} dans ${days} jour${days > 1 ? 's' : ''}`, sub: `Valises : ${ready}/${items.length}`, href: '#/vacances' });
    }
  }
  return out.sort((a, b) => b.weight - a.weight);
}

const WHO_TONE = { Maman: 'salmon', Papa: 'slate', Nounou: 'sage' };
export const whoTone = (w) => WHO_TONE[w] || 'pearl';

/** Dernières actions de la famille, tous modules confondus (au plus quelques lignes par source). */
export function collectActivity(s, limit = 8) {
  const rows = [], child = (id) => (s.children || []).find((c) => c.id === id)?.name || '';
  const baby = (s.events || []).slice().sort((a, b) => b.at - a.at).slice(0, 3);
  for (const e of baby) {
    const t = { feed: e.kind === 'bottle' ? `a donné un biberon (${e.ml} ml)` : 'a noté une tétée', diaper: 'a changé une couche', sleep: 'a noté une sieste', growth: 'a pris une mesure', note: 'a ajouté une note', vaccine: `a noté un vaccin (${e.name || ''})`, med: `a donné ${e.name || 'un médicament'}`, temp: `a pris la température (${fmtNum(e.value)} °C)` }[e.type] || 'a ajouté un événement';
    rows.push({ at: e.at, by: e.by, icon: e.type === 'diaper' ? 'diaper' : e.type === 'sleep' ? 'moon' : e.type === 'temp' ? 'thermo' : e.type === 'vaccine' ? 'syringe' : e.type === 'med' ? 'pill' : 'bottle', text: `${t}${child(e.childId) ? ` · ${child(e.childId)}` : ''}`, href: '#/home' });
  }
  for (const e of (s.expenses || []).filter((x) => x.kind !== 'settle').slice().sort((a, b) => b.at - a.at).slice(0, 3)) rows.push({ at: e.at, by: e.by, icon: 'wallet', text: `${e.kind === 'in' ? 'a reçu' : 'a dépensé'} ${eur(e.amount)}${e.note ? ` · ${e.note}` : ''}`, href: '#/budget' });
  for (const d of (s.doses || []).slice().sort((a, b) => b.at - a.at).slice(0, 2)) { const h = (s.health || []).find((x) => x.id === d.tid); rows.push({ at: d.at, by: d.by, icon: 'pill', text: `a donné ${h?.title || 'un médicament'}${(s.members || []).find((m) => m.id === d.memberId) ? ` à ${(s.members || []).find((m) => m.id === d.memberId).name}` : ''}`, href: '#/sante' }); }
  for (const c of (s.chores || []).filter((x) => x.last && x.lastBy).sort((a, b) => b.last - a.last).slice(0, 2)) rows.push({ at: c.last, by: c.lastBy, icon: 'home', text: `a fait : ${c.name}`, href: '#/maison' });
  for (const e of (s.agenda || []).filter((x) => x.created && x.by).sort((a, b) => b.created - a.created).slice(0, 2)) rows.push({ at: e.created, by: e.by, icon: 'calendar', text: `a ajouté à l'agenda : ${e.title}`, href: '#/agenda' });
  return rows.sort((a, b) => b.at - a.at).slice(0, limit);
}
