/*
 * Modèles de listes. Chaque article peut porter :
 *   tag    : repère que les réponses aux questions peuvent masquer
 *   only   : n'apparaît que si une réponse l'ajoute (« show »)
 *   when   : 'formula' (biberons, lait infantile) ou 'breast' (allaitement) : suit le profil de bébé
 *   minAge : âge minimum en mois (ex. petits pots)
 * Les questions posées à la création (yes / no) masquent ou ajoutent des articles directement.
 */
export const TEMPLATES = [
  {
    id: 'trip', name: 'Voyage avec bébé', kind: 'trip',
    groups: {
      'Change & toilette': ['Couches (prévoir large)', 'Lingettes', 'Crème pour le change', 'Tapis à langer nomade', 'Sacs poubelle', 'Savon bébé', 'Serviettes et gants'],
      'Repas': [
        { t: 'Biberons', when: 'formula' }, { t: 'Lait infantile (doses)', when: 'formula' }, { t: 'Thermos eau chaude', when: 'formula' },
        { t: 'Stérilisateur de voyage', when: 'formula', tag: 'steril' }, { t: 'Brosse à biberon', when: 'formula' },
        { t: 'Coussin d\'allaitement', when: 'breast' }, { t: 'Compresses d\'allaitement', when: 'breast' }, { t: 'Tire-lait et accessoires', when: 'breast' },
        'Bavoirs', { t: 'Compotes / petits pots', minAge: 4 }, { t: 'Cuillères', minAge: 4 },
      ],
      'Sommeil': [{ t: 'Lit parapluie', tag: 'bed' }, { t: 'Draps housse', tag: 'bed' }, 'Gigoteuse', 'Doudou', 'Tétine de rechange', 'Veilleuse'],
      'Vêtements': ['Bodies', 'Pyjamas', 'Chaussettes', 'Gilet', 'Bonnet', 'Tenue de rechange (sac à langer)', { t: 'Sac à linge sale', only: 'nowash' }, { t: 'Lessive de voyage', only: 'nowash' }],
      'Soleil': [{ t: 'Crème solaire', only: 'sun' }, { t: 'Chapeau de soleil', only: 'sun' }, { t: 'Lunettes de soleil bébé', only: 'sun' }, { t: 'Maillot / couche de bain', only: 'sun' }, { t: 'Parasol ou tente anti-UV', only: 'sun' }],
      'Santé': ['Carnet de santé', 'Paracétamol bébé', 'Sérum physiologique', 'Mouche-bébé', 'Carte vitale et mutuelle'],
      'Transport': [{ t: 'Siège auto', tag: 'car' }, 'Poussette', 'Porte-bébé', 'Jouets et livres', 'Plaid'],
    },
    questions: [
      { id: 'bed', ask: 'Avez-vous de quoi faire dormir bébé sur place ?', yes: { hide: ['bed'] } },
      { id: 'car', ask: 'Voyagez-vous en voiture ?', no: { hide: ['car'] } },
      { id: 'sun', ask: 'Séjour au soleil ou à la mer ?', yes: { show: ['sun'] } },
      { id: 'steril', ask: 'Pouvez-vous stériliser les biberons sur place ?', askIf: 'formula', yes: { hide: ['steril'] } },
      { id: 'wash', ask: 'Y a-t-il un lave-linge sur place ?', no: { show: ['nowash'] } },
    ],
  },
  {
    id: 'bag', name: 'Sac à langer', kind: 'custom',
    groups: {
      '': ['Couches (3 à 5)', 'Lingettes', 'Tapis à langer', 'Body de rechange', { t: 'Biberon + lait en poudre', when: 'formula' }, { t: 'Foulard ou cape d\'allaitement', when: 'breast' }, 'Tétine', 'Bavoir', 'Mouchoirs', 'Sacs poubelle', 'Doudou',
        { t: 'Tenue complète de rechange', only: 'long' }, { t: 'Biberon ou en-cas en plus', only: 'long' }, { t: 'Crème solaire', only: 'sun' }, { t: 'Chapeau', only: 'sun' }],
    },
    questions: [
      { id: 'long', ask: 'Sortie de plus de 3 heures ?', yes: { show: ['long'] } },
      { id: 'sun', ask: 'Sortie au soleil ?', yes: { show: ['sun'] } },
    ],
  },
  {
    id: 'maternity', name: 'Valise maternité', kind: 'trip',
    groups: {
      'Pour bébé': ['Bodies naissance', 'Pyjamas', 'Gigoteuse', 'Bonnet et chaussons', 'Tenue de sortie', { t: 'Couches taille 1', tag: 'diaper1' }, 'Siège auto', { t: 'Lait 1er âge et biberons', when: 'formula', tag: 'milk1' }],
      'Pour maman': ['Chemises de nuit', 'Slips jetables', 'Serviettes post-partum', { t: 'Coussin d\'allaitement', when: 'breast' }, { t: 'Compresses d\'allaitement', when: 'breast' }, { t: 'Crème pour mamelons', when: 'breast' }, 'Trousse de toilette', 'Tenue de sortie', 'Chargeur de téléphone'],
      'Papiers': ['Carte vitale et mutuelle', 'Carte d\'identité', 'Dossier de maternité'],
    },
    questions: [
      { id: 'diaper1', ask: 'La maternité fournit-elle les couches ?', yes: { hide: ['diaper1'] } },
      { id: 'milk1', ask: 'La maternité fournit-elle le lait 1er âge ?', askIf: 'formula', yes: { hide: ['milk1'] } },
    ],
  },
  {
    id: 'pharmacy', name: 'Pharmacie de bébé', kind: 'custom',
    groups: { '': ['Thermomètre', 'Paracétamol bébé', 'Sérum physiologique', 'Mouche-bébé', 'Compresses stériles', 'Désinfectant sans alcool', 'Crème pour le siège', 'Coupe-ongles bébé'] },
  },
];
export const KIND_LABEL = { shop: 'Courses', trip: 'Voyage', custom: 'Liste' };

/**
 * Construit les articles d'un modèle selon le profil de bébé et les réponses.
 * ctx = { formula: bool (biberons au lait infantile), breast: bool (allaitement), ageMonths }
 */
export function buildItems(tpl, answers, ctx, mk) {
  const hide = new Set(), show = new Set();
  for (const q of tpl.questions || []) {
    const branch = q[answers[q.id]];
    branch?.hide?.forEach((t) => hide.add(t));
    branch?.show?.forEach((t) => show.add(t));
  }
  const out = [];
  for (const [cat, arr] of Object.entries(tpl.groups)) {
    for (const raw of arr) {
      const it = typeof raw === 'string' ? { t: raw } : raw;
      if (it.when === 'formula' && !ctx.formula) continue;
      if (it.when === 'breast' && !ctx.breast) continue;
      if (it.minAge && ctx.ageMonths < it.minAge) continue;
      if (it.tag && hide.has(it.tag)) continue;
      if (it.only && !show.has(it.only)) continue;
      out.push(mk(it.t, cat));
    }
  }
  return out;
}

/** Questions à poser selon le profil (celles sans objet sont écartées). */
export const questionsFor = (tpl, ctx) => (tpl?.questions || []).filter((q) => !q.askIf || (q.askIf === 'formula' ? ctx.formula : ctx.breast));
