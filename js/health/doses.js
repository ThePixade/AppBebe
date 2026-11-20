// Fonctions pures (aucune dépendance à l'écran) : testables seules.
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/*
 * Prises de médicaments : horaires d'un traitement, prises du jour, délai avant la prochaine prise.
 * traitement : { id, memberId, type: 'traitement', title, dose?, at (début), end?, times: ['08:00', …] (vide = si besoin), minHours? }
 * prise      : { id, tid, memberId, day: 'AAAA-MM-JJ', slot: 'HH:MM' | null, at, by }
 */
const MIN = 6e4, HOUR = 36e5, DAY = 864e5;

export function parseTimes(str) {
  const set = new Set();
  for (const m of String(str || '').matchAll(/(\d{1,2})\s*[h:]\s*(\d{2})?/gi)) {
    const h = +m[1], mi = m[2] ? +m[2] : 0;
    if (h < 24 && mi < 60) set.add(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`);
  }
  return [...set].sort();
}
export const slotTs = (day0, hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(day0); d.setHours(h, m, 0, 0); return d.getTime(); };

export function isActive(h, now = Date.now()) {
  if (h.type !== 'traitement') return false;
  return h.at <= startOfDay(now) + DAY - 1 && (!h.end || h.end >= startOfDay(now));
}

/** « Jour 3 sur 7 » si une date de fin est connue. */
export function progress(h, now = Date.now()) {
  if (!h.end) return null;
  const total = Math.max(1, Math.round((startOfDay(h.end) - startOfDay(h.at)) / DAY) + 1);
  const day = Math.min(total, Math.max(1, Math.round((startOfDay(now) - startOfDay(h.at)) / DAY) + 1));
  return { day, total };
}

export function lastDose(s, tid) {
  return (s.doses || []).filter((d) => d.tid === tid).sort((a, b) => b.at - a.at)[0] || null;
}

/** Lignes de la liste « Prises du jour ». */
export function dosesToday(s, now = Date.now()) {
  const day = dayKey(now), d0 = startOfDay(now), rows = [];
  for (const h of s.health || []) {
    if (!isActive(h, now)) continue;
    const times = h.times || [];
    if (times.length) {
      for (const t of times) {
        const ts = slotTs(d0, t), dose = (s.doses || []).find((x) => x.tid === h.id && x.day === day && x.slot === t);
        const status = dose ? 'done' : now >= ts + 90 * MIN ? 'late' : now >= ts - 30 * MIN ? 'due' : 'later';
        rows.push({ h, memberId: h.memberId, time: t, ts, status, dose });
      }
    } else {
      const last = lastDose(s, h.id), nextAt = last && h.minHours ? last.at + h.minHours * HOUR : null;
      rows.push({ h, memberId: h.memberId, asNeeded: true, last, nextAt, ready: !nextAt || now >= nextAt, ts: now, status: 'asneeded' });
    }
  }
  return rows.sort((a, b) => (a.asNeeded ? 1 : 0) - (b.asNeeded ? 1 : 0) || a.ts - b.ts);
}

export const pendingCount = (s, now) => dosesToday(s, now).filter((r) => r.status === 'due' || r.status === 'late').length;
