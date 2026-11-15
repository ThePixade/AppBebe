import { store } from './store.js';
import { uid, DAY } from './ui.js';

/*
 * Stock : les quantités consommées sont CALCULÉES à partir du journal (changes, biberons)
 * depuis la date de départ du stock. Modifier ou supprimer un événement corrige donc
 * le stock tout seul, sans compteur à resynchroniser.
 *   restant = quantité de départ (qty) − consommation depuis `since`
 */

export const PRESETS = {
  diaper: { auto: 'diaper', name: 'Couches', unit: 'couches', icon: 'diaper', tone: 'peach', low: 24 },
  formula: { auto: 'formula', name: 'Lait infantile', unit: 'boîtes', icon: 'bottle', tone: 'salmon', low: 1, yield: 5800 },
};

const isFormulaBottle = (e) => e.type === 'feed' && e.kind === 'bottle' && e.milk !== 'maternel';
const matches = (it, e) => (it.auto === 'diaper' ? e.type === 'diaper' : it.auto === 'formula' ? isFormulaBottle(e) : false);
const weight = (it, e) => (it.auto === 'formula' ? (e.ml || 0) / (it.yield || 5800) : 1);

export const consumed = (s, it) => s.events.reduce((a, e) => (e.at >= it.since && matches(it, e) ? a + weight(it, e) : a), 0);
export const remaining = (s, it) => it.qty - consumed(s, it);

/** Consommation moyenne par jour sur les 7 derniers jours (0 si inconnue). */
export function perDay(s, it, now = Date.now()) {
  if (!it.auto) return 0;
  const from = now - 7 * DAY;
  const evs = s.events.filter((e) => e.at >= from && e.at <= now && matches(it, e));
  if (!evs.length) return 0;
  const first = Math.min(...evs.map((e) => e.at));
  const span = Math.min(7, Math.max(1, (now - first) / DAY));
  return evs.reduce((a, e) => a + weight(it, e), 0) / span;
}
export function daysLeft(s, it) {
  const r = perDay(s, it);
  return r > 0 ? Math.max(0, remaining(s, it)) / r : null;
}
export const isLow = (s, it) => {
  const d = daysLeft(s, it);
  return remaining(s, it) <= (it.low || 0) || (d !== null && d <= 3);
};
export const lowItems = (s) => s.supplies.filter((it) => isLow(s, it));

/** Fixe le restant à `value` en gardant la consommation déjà décomptée. */
export function setRemaining(s, it, value) { it.qty = value + consumed(s, it); }

/** Ajoute un article à la liste « Courses » (créée au besoin). Retourne false s'il y était déjà. */
export function addShopping(text) {
  let added = true;
  store.update((s) => {
    let l = s.lists.find((x) => x.kind === 'shop');
    if (!l) { l = { id: uid(), name: 'Courses', kind: 'shop', created: Date.now(), items: [] }; s.lists.push(l); }
    const key = text.trim().toLowerCase();
    if (l.items.some((i) => !i.done && i.text.trim().toLowerCase() === key)) { added = false; return; }
    l.items.push({ id: uid(), text: text.trim(), done: false, by: s.me });
  });
  return added;
}

export function homeSummary(s) {
  const low = lowItems(s);
  if (low.length) {
    const it = low[0], d = daysLeft(s, it);
    const n = Math.round(d ?? 0);
    const txt = d === null ? 'stock bas' : d < 1 ? 'presque épuisé' : `environ ${n} jour${n > 1 ? 's' : ''}`;
    return { warn: true, text: `${it.name} : ${txt}${low.length > 1 ? ` · +${low.length - 1}` : ''}` };
  }
  const shop = s.lists.find((l) => l.kind === 'shop');
  const todo = shop ? shop.items.filter((i) => !i.done).length : 0;
  const first = s.supplies.find((i) => i.auto) || s.supplies[0];
  const parts = [];
  if (first) { const d = daysLeft(s, first); parts.push(d !== null ? `${first.name} : ~${Math.round(d)} j` : `${first.name} : ${Math.round(Math.max(0, remaining(s, first)))}`); }
  if (todo) parts.push(`${todo} à acheter`);
  return { warn: false, text: parts.join(' · ') || 'Stock de couches, courses, voyage' };
}
