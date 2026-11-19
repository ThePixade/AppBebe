/*
 * Calculs du Budget (fonctions pures : pas d'accès à l'écran ni au stockage).
 *  - expenses : { id, at, amount, cat, note, by, shared, kind: 'out' (défaut) | 'in' | 'settle', from?, to? }
 *  - fixed    : { id, name, amount, cat, kind: 'out' (défaut) | 'in', day?, from?, to? }  (from / to = premier jour d'un mois)
 *  - goals    : { id, name, target, initial, deadline?, hist: [{ id, at, amount, by }] }
 */
export const DAY = 864e5;
export const monthStart = (ts) => { const d = new Date(ts); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addMonths = (ts, n) => { const d = new Date(ts); d.setDate(1); d.setMonth(d.getMonth() + n); return monthStart(d); };
export const daysInMonth = (m0) => { const d = new Date(m0); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
export const kindOf = (e) => e.kind || 'out';
const sum = (a, f = (x) => x.amount) => a.reduce((t, x) => t + f(x), 0);
const round2 = (n) => Math.round(n * 100) / 100;

/** Premier mois où l'app a des données : début des anciennes charges fixes créées sans date de départ. */
export function floorMonth(s, now = Date.now()) {
  const first = (s.expenses || []).reduce((m, e) => Math.min(m, e.at), Infinity);
  return monthStart(Number.isFinite(first) ? first : now);
}
export const fixedActive = (f, m0, floor = 0) => ((f.from ?? floor) <= m0) && (!f.to || f.to >= m0);

export function goalSaved(g) { return round2((g.initial || 0) + sum(g.hist || [])); }

export function monthStats(s, m0 = monthStart(Date.now())) {
  const m1 = addMonths(m0, 1);
  const list = (s.expenses || []).filter((e) => e.at >= m0 && e.at < m1);
  const out = list.filter((e) => kindOf(e) === 'out'), inc = list.filter((e) => kindOf(e) === 'in');
  const floor = floorMonth(s), fixedAll = (s.fixed || []).filter((f) => fixedActive(f, m0, floor));
  const fixedOut = fixedAll.filter((f) => (f.kind || 'out') === 'out'), fixedIn = fixedAll.filter((f) => f.kind === 'in');
  const variable = sum(out), fixedOutTotal = sum(fixedOut), fixedInTotal = sum(fixedIn);
  const spent = variable + fixedOutTotal, income = sum(inc) + fixedInTotal;
  const byCat = {};
  for (const e of out) byCat[e.cat] = (byCat[e.cat] || 0) + e.amount;
  for (const f of fixedOut) byCat[f.cat] = (byCat[f.cat] || 0) + f.amount;
  const shared = out.filter((e) => e.shared !== false);
  const budget = s.budget?.monthly || null;
  const saved = sum((s.goals || []).flatMap((g) => g.hist || []).filter((h) => h.at >= m0 && h.at < m1), (h) => h.amount);
  return {
    m0, list, out, inc, variable, fixedOutTotal, fixedInTotal, spent, income, byCat, saved: round2(saved),
    balance: round2(income - spent), budget, left: budget ? round2(budget - spent) : null,
    paidM: sum(shared.filter((e) => e.by === 'Maman')), paidP: sum(shared.filter((e) => e.by === 'Papa')),
    catBudgets: s.budget?.cats || {},
  };
}

/** Solde courant entre Maman et Papa sur toutes les dépenses communes, règlements déduits. diff > 0 : Papa doit à Maman. */
export function balanceAll(s) {
  const shared = (s.expenses || []).filter((e) => kindOf(e) === 'out' && e.shared !== false);
  const paidM = sum(shared.filter((e) => e.by === 'Maman')), paidP = sum(shared.filter((e) => e.by === 'Papa'));
  let diff = (paidM - paidP) / 2;
  for (const e of s.expenses || []) if (kindOf(e) === 'settle') diff += e.from === 'Maman' ? e.amount : -e.amount;
  return { paidM, paidP, diff: round2(diff) };
}

/** Rythme du mois en cours : reste par jour et projection de fin de mois. null pour un autre mois. */
export function pace(s, m0, now = Date.now()) {
  if (monthStart(now) !== m0) return null;
  const st = monthStats(s, m0), dim = daysInMonth(m0), day = new Date(now).getDate();
  const daysLeft = dim - day + 1;
  const projection = round2(st.fixedOutTotal + (st.variable / Math.max(1, day)) * dim);
  return { dim, day, daysLeft, projection, perDay: st.budget && st.left > 0 ? round2(st.left / daysLeft) : null, dailyAvg: round2(st.variable / Math.max(1, day)) };
}

/** Variation par catégorie par rapport au mois précédent, en pourcentage (null si pas de base). */
export function deltaByCat(s, m0) {
  const cur = monthStats(s, m0).byCat, prev = monthStats(s, addMonths(m0, -1)).byCat, out = {};
  for (const k of Object.keys(cur)) out[k] = prev[k] > 0 ? Math.round(((cur[k] - prev[k]) / prev[k]) * 100) : null;
  return out;
}

export function yearStats(s, year, now = Date.now()) {
  const cur = monthStart(now);
  const months = Array.from({ length: 12 }, (_, i) => {
    const m0 = new Date(year, i, 1).getTime(), st = monthStats(s, m0);
    return { i, m0, spent: st.spent, income: st.income, future: m0 > cur, byCat: st.byCat };
  });
  const past = months.filter((m) => !m.future);
  const byCat = {};
  for (const m of past) for (const [k, v] of Object.entries(m.byCat)) byCat[k] = (byCat[k] || 0) + v;
  const spent = sum(past, (m) => m.spent), income = sum(past, (m) => m.income);
  const active = past.filter((m) => m.spent > 0);
  const hi = active.length ? active.reduce((a, b) => (b.spent > a.spent ? b : a)) : null, lo = active.length ? active.reduce((a, b) => (b.spent < a.spent ? b : a)) : null;
  return { months, spent, income, balance: round2(income - spent), avg: active.length ? round2(spent / active.length) : 0, byCat, hi, lo };
}

/** Dépenses fréquentes (derniers 120 jours) pour l'ajout en un geste. */
export function frequent(s, now = Date.now(), n = 6) {
  const norm = (x) => String(x).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const map = new Map();
  for (const e of s.expenses || []) {
    if (kindOf(e) !== 'out' || !e.note || e.at < now - 120 * DAY) continue;
    const k = norm(e.note), cur = map.get(k);
    if (!cur) map.set(k, { note: e.note, count: 1, last: e });
    else { cur.count++; if (e.at > cur.last.at) cur.last = e; }
  }
  return [...map.values()].filter((x) => x.count >= 2).sort((a, b) => b.count - a.count || b.last.at - a.last.at).slice(0, n).map((x) => ({ note: x.note, amount: x.last.amount, cat: x.last.cat, shared: x.last.shared !== false }));
}

/** Prélèvements fixes restant à venir ce mois-ci (jour renseigné et pas encore passé). */
export function upcomingFixed(s, now = Date.now(), n = 5) {
  const m0 = monthStart(now), day = new Date(now).getDate(), floor = floorMonth(s, now);
  return (s.fixed || []).filter((f) => (f.kind || 'out') === 'out' && fixedActive(f, m0, floor) && f.day && f.day >= day).sort((a, b) => a.day - b.day).slice(0, n);
}
