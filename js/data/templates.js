/* Modèles de listes : copiés à la création, on les ajuste ensuite librement. */
export const TEMPLATES = [
  {
    id: 'trip', name: 'Voyage avec bébé', kind: 'trip',
    groups: {
      'Change & toilette': ['Couches (prévoir large)', 'Lingettes', 'Crème pour le change', 'Tapis à langer nomade', 'Sacs poubelle', 'Savon bébé', 'Serviettes et gants'],
      'Repas': ['Biberons', 'Lait infantile (doses)', 'Thermos eau chaude', 'Bavoirs', 'Compotes / petits pots', 'Cuillères', 'Stérilisateur de voyage', 'Brosse à biberon'],
      'Sommeil': ['Lit parapluie', 'Gigoteuse', 'Doudou', 'Tétine de rechange', 'Veilleuse', 'Draps housse'],
      'Vêtements': ['Bodies', 'Pyjamas', 'Chaussettes', 'Gilet', 'Bonnet / chapeau', 'Tenue de rechange (sac à langer)'],
      'Santé': ['Carnet de santé', 'Paracétamol bébé', 'Sérum physiologique', 'Mouche-bébé', 'Crème solaire', 'Carte vitale et mutuelle'],
      'Transport': ['Siège auto', 'Poussette', 'Porte-bébé', 'Jouets et livres', 'Plaid'],
    },
  },
  {
    id: 'bag', name: 'Sac à langer', kind: 'custom',
    groups: { '': ['Couches (3 à 5)', 'Lingettes', 'Tapis à langer', 'Body de rechange', 'Biberon + lait en poudre', 'Tétine', 'Bavoir', 'Mouchoirs', 'Sacs poubelle', 'Doudou'] },
  },
  {
    id: 'maternity', name: 'Valise maternité', kind: 'trip',
    groups: {
      'Pour bébé': ['Bodies naissance', 'Pyjamas', 'Gigoteuse', 'Bonnet et chaussons', 'Tenue de sortie', 'Couches taille 1', 'Siège auto'],
      'Pour maman': ['Chemises de nuit', 'Slips jetables', 'Serviettes post-partum', 'Coussin d\'allaitement', 'Trousse de toilette', 'Tenue de sortie', 'Chargeur de téléphone'],
      'Papiers': ['Carte vitale et mutuelle', 'Carte d\'identité', 'Dossier de maternité'],
    },
  },
  {
    id: 'pharmacy', name: 'Pharmacie de bébé', kind: 'custom',
    groups: { '': ['Thermomètre', 'Paracétamol bébé', 'Sérum physiologique', 'Mouche-bébé', 'Compresses stériles', 'Désinfectant sans alcool', 'Crème pour le siège', 'Coupe-ongles bébé'] },
  },
];
export const KIND_LABEL = { shop: 'Courses', trip: 'Voyage', custom: 'Liste' };
