import { normText } from '../budget/cats.js';

/*
 * Calendrier vaccinal et rappels de suivi (France), À TITRE INDICATIF.
 * Les recommandations évoluent : l'application ne remplace ni le carnet de santé ni l'avis du médecin.
 * Les séries (plusieurs doses) comptent les vaccins saisis ; les rappels regardent leur date par rapport à l'âge.
 */
const MONTH = 30.4375 * 864e5;
export const ageMonths = (birth, at = Date.now()) => (at - new Date(birth).getTime()) / MONTH;
const monthsLabel = (m) => (m < 24 ? `${Math.round(m)} mois` : `${Math.round(m / 12)} ans`);

// kind 'serie' : doses à des âges (en mois) ; kind 'rappel' : rappels à des âges, quel que soit le passé ; until = âge limite (mois)
export const VACCINS = [
  { id: 'hexa', kind: 'serie', short: 'Hexavalent', label: 'Hexavalent (diphtérie, tétanos, coqueluche, polio, Hib, hépatite B)', re: /hexa|hexyon|infanrix|vaxelis/, doses: [2, 4, 11], oblig: true },
  { id: 'pneumo', kind: 'serie', short: 'Pneumocoque', label: 'Pneumocoque', re: /pneumo|prevenar|vaxneuvance|pcv/, doses: [2, 4, 11], oblig: true },
  { id: 'menb', kind: 'serie', short: 'Méningocoque B', label: 'Méningocoque B', re: /mening\w*\s*b\b|bexsero|menb/, doses: [3, 5, 12], oblig: true },
  { id: 'menacwy', kind: 'serie', short: 'Méningocoque ACWY', label: 'Méningocoque ACWY', re: /acwy|nimenrix|menquadfi|mening\w*\s*c\b/, doses: [6, 12], oblig: true },
  { id: 'ror', kind: 'serie', short: 'ROR', label: 'ROR (rougeole, oreillons, rubéole)', re: /\bror\b|rougeole|priorix|mmrvaxpro/, doses: [12, 17], oblig: true },
  { id: 'rota', kind: 'serie', short: 'Rotavirus', label: 'Rotavirus (recommandé)', re: /rota/, doses: [2, 3], until: 3.5, oblig: false },
  { id: 'hpv', kind: 'serie', short: 'HPV', label: 'HPV (papillomavirus), 2 doses', re: /hpv|papillomavirus|gardasil|cervarix/, doses: [132, 138], until: 240, oblig: false },
  { id: 'dtcap6', kind: 'rappel', short: 'Rappel DTCaP', label: 'Rappel diphtérie, tétanos, coqueluche, polio (6 ans)', re: /dtcap|dtp|repevax|boostrix|revaxis|tetravac|infanrix|hexavalent|hexyon/, due: [72], window: 24 },
  { id: 'dtcap11', kind: 'rappel', short: 'Rappel dTcaP', label: 'Rappel diphtérie, tétanos, coqueluche, polio (11-13 ans)', re: /dtcap|dtp|repevax|boostrix|revaxis/, due: [132], window: 24 },
  { id: 'dtcap_adulte', kind: 'rappel', short: 'Rappel dTcaP', label: 'Rappel dTcaP adulte (25, 45, 65 ans, puis tous les 10 ans)', re: /dtcap|dtp|repevax|boostrix|revaxis|tetanos/, due: [300, 540, 780, 900, 1020], window: 240 },
  { id: 'grippe', kind: 'annuel', short: 'Grippe', label: 'Grippe saisonnière (à partir de 65 ans ou si risque)', re: /grippe|vaxigrip|influvac/, from: 780 },
];

// Dépistages et examens : age en ANNÉES, tous les `every` mois ; sex 'F' = seulement si la fiche l'indique
export const DEPISTAGES = [
  { id: 'col', short: 'Col de l\'utérus', label: 'Dépistage du cancer du col de l\'utérus (25-65 ans)', re: /frottis|col de l|depistage col|test hpv/, sex: 'F', from: 25, to: 65, every: 36 },
  { id: 'sein', short: 'Mammographie', label: 'Dépistage du cancer du sein (50-74 ans)', re: /mammo|depistage sein/, sex: 'F', from: 50, to: 74, every: 24 },
  { id: 'colon', short: 'Côlon', label: 'Dépistage du cancer colorectal (50-74 ans)', re: /colo|hemoccult|immunologique|depistage colorectal/, from: 50, to: 74, every: 24 },
];

const DENT_AGES = [3, 6, 9, 12, 15, 18, 21, 24];

/** Ce qui est à faire, à venir ou fait pour un membre. entries = [{ type, title, at }] (carnet + vaccins du module Bébé). */
export function calendarFor(member, entries, now = Date.now()) {
  if (!member?.birth) return [];
  const am = ageMonths(member.birth, now), birthTs = new Date(member.birth).getTime();
  const out = [];
  const vacc = entries.filter((e) => e.type === 'vaccin').map((e) => ({ ...e, t: normText(e.title) })).sort((a, b) => a.at - b.at);
  const push = (o) => out.push({ kind: 'vaccin', ...o });
  // enfant plus grand ou adulte sans aucun vaccin saisi : on invite à reprendre le carnet de santé
  if (am > 36 && !vacc.length) out.push({ id: 'carnet', kind: 'info', short: 'Carnet de vaccination', label: 'Ajoutez les vaccins déjà faits (d\'après le carnet de santé) pour suivre les rappels.', state: 'info' });

  for (const v of VACCINS) {
    const m = vacc.filter((e) => v.re.test(e.t));
    if (v.kind === 'serie') {
      if (v.until && am > v.until && m.length === 0) continue;                 // fenêtre passée : on n'insiste pas
      if (!v.until && am > 216 && m.length === 0) continue;                    // adulte non vacciné : à voir avec le médecin
      v.doses.forEach((d, i) => {
        const dueAt = birthTs + d * MONTH, done = m.length > i;
        if (!done && am > d + 24) return;                                       // trop ancien : on n'insiste plus (à voir avec le médecin)
        if (done) return push({ id: `${v.id}-${i}`, vid: v.id, short: v.short, label: `${v.label} · dose ${i + 1}`, state: 'done', dueAt, doseNo: i + 1, oblig: v.oblig });
        if (v.until && d > v.until) return;
        const late = am > d + 2, due = am >= d - 0.5;
        if (due) push({ id: `${v.id}-${i}`, vid: v.id, short: v.short, label: `${v.label} · dose ${i + 1}`, state: late ? 'late' : 'due', dueAt, doseNo: i + 1, text: `prévue à ${monthsLabel(d)}`, oblig: v.oblig });
        else if (d - am <= 6) push({ id: `${v.id}-${i}`, vid: v.id, short: v.short, label: `${v.label} · dose ${i + 1}`, state: 'soon', dueAt, doseNo: i + 1, text: `à ${monthsLabel(d)}`, oblig: v.oblig });
      });
    } else if (v.kind === 'rappel') {
      const past = v.due.filter((d) => d <= am + 3), target = past[past.length - 1], next = v.due.find((d) => d > am + 3);
      if (target !== undefined) {
        const done = vacc.some((e) => v.re.test(e.t) && (e.at - birthTs) / MONTH >= target - 24);
        if (am <= target + (v.window || 24)) push({ id: `${v.id}-${target}`, vid: v.id, short: v.short, label: v.label, state: done ? 'done' : am > target + 12 ? 'late' : 'due', dueAt: birthTs + target * MONTH, text: `prévu à ${monthsLabel(target)}` });
      }
      if (next !== undefined && next - am <= 18) push({ id: `${v.id}-${next}`, vid: v.id, short: v.short, label: v.label, state: 'soon', dueAt: birthTs + next * MONTH, text: `à ${monthsLabel(next)}` });
    } else if (v.kind === 'annuel' && am >= v.from) {
      const last = [...vacc].reverse().find((e) => v.re.test(e.t));
      const recent = last && now - last.at < 240 * 864e5;
      push({ id: v.id, vid: v.id, short: v.short, label: v.label, state: recent ? 'done' : 'due', dueAt: now, text: 'chaque automne' });
    }
  }

  // examens obligatoires du nourrisson
  const exam = (id, label, a, b, re) => {
    const has = entries.some((e) => re.test(normText(e.title)) && e.at >= birthTs + (a - 3) * MONTH);
    if (has) return out.push({ id, kind: 'examen', short: label, label, state: 'done', dueAt: birthTs + a * MONTH });
    if (am >= a - 0.5 && am <= b + 3) out.push({ id, kind: 'examen', short: label, label, state: am > b ? 'late' : 'due', dueAt: birthTs + a * MONTH, text: `entre ${a} et ${b} mois` });
  };
  exam('ex9', 'Examen médical du 9e mois (certificat de santé)', 8.5, 10, /(9|neuvieme|9e) ?mois|certificat/);
  exam('ex24', 'Examen médical du 24e mois (certificat de santé)', 23, 26, /(24|vingt quatre|24e) ?mois|certificat/);

  // bilans et dépistages
  const years = am / 12, anyEntries = entries.map((e) => ({ ...e, t: normText(e.title) }));
  for (const d of DEPISTAGES) {
    if (d.sex && member.sex !== d.sex) continue;
    if (years < d.from || years > d.to) continue;
    const last = [...anyEntries].reverse().find((e) => d.re.test(e.t));
    const overdue = !last || now - last.at > d.every * MONTH;
    out.push({ id: d.id, kind: 'depistage', short: d.short, label: d.label, state: overdue ? (last ? 'late' : 'due') : 'done', dueAt: last ? last.at + d.every * MONTH : now, text: last ? `dernier : ${new Date(last.at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}` : `tous les ${d.every / 12} ans` });
  }
  const yi = Math.floor(years);
  if (DENT_AGES.includes(yi)) {
    const has = anyEntries.some((e) => /dentiste|bucco|m ?t ?dents|dentaire/.test(e.t) && now - e.at < 540 * 864e5);
    out.push({ id: 'dent', kind: 'examen', short: 'Examen bucco-dentaire', label: `Examen bucco-dentaire gratuit (${yi} ans, « M'T dents »)`, state: has ? 'done' : 'due', dueAt: now });
  }
  return out;
}

export const VACCINE_NAMES = ['Hexavalent (DTCaP-Hib-HepB)', 'Pneumocoque', 'Méningocoque B', 'Méningocoque ACWY', 'ROR', 'Rotavirus', 'HPV', 'Rappel DTCaP', 'Rappel dTcaP', 'Grippe', 'Covid-19', 'Hépatite A', 'Hépatite B', 'Fièvre jaune', 'Autre'];
