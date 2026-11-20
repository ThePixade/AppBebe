import { ageMonths } from '../data/sante-calendrier.js';

/* Fiche santé en texte (à copier ou partager : nounou, médecin, urgences). Fonction pure. */
const fr = (ts, o = { day: 'numeric', month: 'long', year: 'numeric' }) => new Date(ts).toLocaleDateString('fr-FR', o);
const ageText = (birth, now) => { const m = ageMonths(birth, now); return m < 1 ? 'nouveau-né' : m < 24 ? `${Math.floor(m)} mois` : `${Math.floor(m / 12)} ans`; };
const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

export function summaryText(s, member, entries, now = Date.now()) {
  const mine = entries.filter((e) => e.memberId === member.id);
  const lines = [`FICHE SANTÉ · ${member.name}${member.birth ? ` (${ageText(member.birth, now)}, né${member.sex === 'F' ? 'e' : ''} le ${fr(new Date(member.birth).getTime())})` : ''}`, ''];
  const add = (label, v) => { if (v) lines.push(`${label} : ${v}`); };
  add('Groupe sanguin', member.blood);
  add('Allergies', member.allergies || 'aucune connue');
  add('Antécédents', member.antecedents);
  add('Médecin traitant', member.doctor);
  add('Mutuelle', member.mutuelle);
  add('Remarques', member.notes);

  const treat = mine.filter((e) => e.type === 'traitement' && e.at <= now && (!e.end || e.end >= now - 864e5));
  if (treat.length) { lines.push('', 'TRAITEMENTS EN COURS'); for (const t of treat) lines.push(`- ${t.title}${t.dose ? ` (${t.dose})` : ''}${t.times?.length ? ` · ${t.times.join(', ')}` : ' · si besoin'}${t.minHours ? ` · au moins ${t.minHours} h entre deux prises` : ''}${t.end ? ` · jusqu'au ${fr(t.end, { day: 'numeric', month: 'long' })}` : ''}`); }

  const vac = mine.filter((e) => e.type === 'vaccin').sort((a, b) => b.at - a.at).slice(0, 12);
  if (vac.length) { lines.push('', 'DERNIERS VACCINS'); for (const v of vac) lines.push(`- ${v.title} · ${fr(v.at, { day: 'numeric', month: 'short', year: 'numeric' })}`); }

  const mes = {};
  for (const e of mine.filter((x) => x.type === 'mesure').sort((a, b) => b.at - a.at)) if (!mes[e.kind]) mes[e.kind] = e;
  const L = { temp: ['Température', '°C'], weight: ['Poids', 'kg'], height: ['Taille', 'cm'], bp: ['Tension', 'mmHg'], glucose: ['Glycémie', 'g/L'] };
  const mlines = Object.entries(mes).map(([k, e]) => L[k] ? `- ${L[k][0]} : ${k === 'bp' ? `${fmt(e.value)}/${fmt(e.value2)}` : fmt(e.value)} ${L[k][1]} (${fr(e.at, { day: 'numeric', month: 'short' })})` : null).filter(Boolean);
  if (mlines.length) lines.push('', 'DERNIÈRES MESURES', ...mlines);

  const sym = mine.filter((e) => e.type === 'symptome' && e.at > now - 30 * 864e5).sort((a, b) => b.at - a.at);
  if (sym.length) { lines.push('', 'SYMPTÔMES (30 DERNIERS JOURS)'); for (const e of sym.slice(0, 10)) lines.push(`- ${fr(e.at, { day: 'numeric', month: 'short' })} : ${e.title}${e.note ? ` (${e.note})` : ''}`); }

  const rdv = mine.filter((e) => e.type === 'rdv' && e.at >= now).sort((a, b) => a.at - b.at).slice(0, 4);
  if (rdv.length) { lines.push('', 'PROCHAINS RENDEZ-VOUS'); for (const r of rdv) lines.push(`- ${fr(r.at, { weekday: 'short', day: 'numeric', month: 'long' })} · ${r.title}${r.place ? ` · ${r.place}` : ''}`); }

  lines.push('', `Établi avec AppFamille le ${fr(now)}. Document indicatif, ne remplace pas un avis médical. Urgence : 15 ou 112.`);
  return lines.join('\n');
}
