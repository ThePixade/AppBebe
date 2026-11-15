// Catalogue d'introduction (âges indicatifs, recommandations françaises 2021).
export const CATEGORIES = [
  ['legumes', 'Légumes'],
  ['fruits', 'Fruits'],
  ['feculents', 'Féculents'],
  ['proteines', 'Protéines'],
  ['laitiers', 'Produits laitiers'],
  ['autres', 'Autres & allergènes'],
];

const f = (id, name, emoji, cat, min, extra = {}) => ({ id, name, emoji, cat, min, ...extra });

export const FOODS = [
  f('carotte', 'Carotte', '🥕', 'legumes', 4),
  f('courgette', 'Courgette', '🥒', 'legumes', 4),
  f('haricot', 'Haricot vert', '🌱', 'legumes', 4),
  f('patate', 'Patate douce', '🍠', 'legumes', 4),
  f('potiron', 'Potiron', '🎃', 'legumes', 4),
  f('brocoli', 'Brocoli', '🥦', 'legumes', 6),
  f('epinard', 'Épinard', '🥬', 'legumes', 6),
  f('avocat', 'Avocat', '🥑', 'legumes', 6),
  f('tomate', 'Tomate', '🍅', 'legumes', 6, { note: 'Pelée et épépinée au début.' }),
  f('champignon', 'Champignon', '🍄', 'legumes', 8, { note: 'Bien cuit et mixé.' }),
  f('mais', 'Maïs', '🌽', 'legumes', 8, { note: 'En purée lisse, jamais en grains entiers.' }),

  f('pomme', 'Pomme', '🍎', 'fruits', 4),
  f('poire', 'Poire', '🍐', 'fruits', 4),
  f('banane', 'Banane', '🍌', 'fruits', 4),
  f('peche', 'Pêche', '🍑', 'fruits', 6),
  f('mangue', 'Mangue', '🥭', 'fruits', 6),
  f('fraise', 'Fraise', '🍓', 'fruits', 6),
  f('melon', 'Melon', '🍈', 'fruits', 6),
  f('ananas', 'Ananas', '🍍', 'fruits', 8, { note: 'Bien mûr, en petits morceaux fondants.' }),
  f('kiwi', 'Kiwi', '🥝', 'fruits', 8),
  f('raisin', 'Raisin', '🍇', 'fruits', 8, { note: 'Toujours coupé en quatre dans la longueur.' }),
  f('cerise', 'Cerise', '🍒', 'fruits', 8, { note: 'Dénoyautée et coupée.' }),

  f('pdt', 'Pomme de terre', '🥔', 'feculents', 4),
  f('riz', 'Riz', '🍚', 'feculents', 6),
  f('semoule', 'Semoule', '🌾', 'feculents', 6, { allergen: 'Gluten' }),
  f('pates', 'Pâtes', '🍝', 'feculents', 8, { allergen: 'Gluten' }),
  f('pain', 'Pain', '🍞', 'feculents', 8, { allergen: 'Gluten' }),

  f('poulet', 'Poulet', '🍗', 'proteines', 6),
  f('boeuf', 'Bœuf', '🥩', 'proteines', 6, { note: 'Bien cuit, mixé finement.' }),
  f('poisson', 'Poisson blanc', '🐟', 'proteines', 6, { allergen: 'Poisson' }),
  f('oeuf', 'Œuf', '🥚', 'proteines', 6, { allergen: 'Œuf', note: 'Toujours bien cuit (dur).' }),
  f('lentilles', 'Lentilles', '🥣', 'proteines', 8),

  f('yaourt', 'Yaourt nature', '🥛', 'laitiers', 6, { allergen: 'Lait' }),
  f('beurre', 'Beurre', '🧈', 'laitiers', 6, { allergen: 'Lait' }),
  f('fromage', 'Fromage', '🧀', 'laitiers', 8, { allergen: 'Lait', note: 'Pasteurisé uniquement.' }),

  f('huile', 'Huile de colza', '🥄', 'autres', 4, { note: 'Une cuillère à café dans chaque purée maison.' }),
  f('arachide', 'Arachide', '🥜', 'autres', 6, { allergen: 'Arachide', note: 'En purée lisse diluée ou en poudre. Jamais entière avant 5 ans.' }),
  f('noisette', 'Fruits à coque', '🌰', 'autres', 6, { allergen: 'Fruits à coque', note: 'En poudre ou purée lisse uniquement.' }),
  f('miel', 'Miel', '🍯', 'autres', 12, { note: 'Interdit avant 1 an (risque de botulisme infantile).' }),
];

export const STATUS = {
  ok: { label: 'Validé', tone: 'sage', icon: 'check' },
  retry: { label: 'À réessayer', tone: 'yellow', icon: 'clock' },
  allergy: { label: 'Allergène', tone: 'brick', icon: 'alert' },
};

// Idées de recettes par tranche d'âge (les 3 premières sont offertes, le reste est Premium).
export const AGE_BANDS = [
  ['4-6', '4–6 mois', 4, 6],
  ['6-8', '6–8 mois', 6, 8],
  ['8-12', '8–12 mois', 8, 12],
  ['12+', '12 mois +', 12, 99],
];

const r = (id, band, title, emoji, kind, minutes, c1, c2, ingredients, steps, free = false) => ({ id, band, title, emoji, kind, minutes, c1, c2, ingredients, steps, free });

export const RECIPES = [
  r('carotte-patate', '4-6', 'Purée carotte & patate douce', '🥕', 'Purée', 25, '#F4A259', '#E76F51',
    ['1 carotte', '½ patate douce', '1 c. à café d’huile de colza'],
    ['Épluchez et coupez les légumes en dés.', 'Faites cuire 20 min à la vapeur.', 'Mixez finement en ajoutant un peu d’eau de cuisson.', 'Ajoutez l’huile hors du feu.'], true),
  r('pomme-poire', '4-6', 'Compote pomme-poire', '🍐', 'Compote', 20, '#B5C99A', '#87A96B',
    ['1 pomme', '1 poire', '2 c. à soupe d’eau'],
    ['Épluchez, épépinez et coupez les fruits.', 'Faites cuire à couvert 15 min à feu doux.', 'Mixez jusqu’à texture lisse, sans sucre ajouté.'], true),
  r('veloute-courgette', '4-6', 'Velouté courgette & pomme de terre', '🥒', 'Purée', 25, '#90BE6D', '#43AA8B',
    ['½ courgette', '1 petite pomme de terre', '1 c. à café d’huile'],
    ['Épluchez la pomme de terre, gardez la peau de la courgette.', 'Cuisez 20 min à la vapeur.', 'Mixez avec un peu d’eau de cuisson, ajoutez l’huile.'], true),
  r('brocoli-poulet', '6-8', 'Brocoli, poulet & riz', '🥦', 'Purée', 30, '#99C24D', '#2F9C95',
    ['3 fleurettes de brocoli', '10 g de poulet', '2 c. à soupe de riz cuit'],
    ['Cuisez le brocoli 10 min à la vapeur.', 'Pochez le poulet 12 min dans l’eau frémissante.', 'Mixez le tout avec le riz et un filet d’huile.']),
  r('poisson-pois', '6-8', 'Cabillaud & petits pois', '🐟', 'Purée', 25, '#8ECAE6', '#219EBC',
    ['10 g de cabillaud sans arête', '2 c. à soupe de petits pois', '1 petite pomme de terre'],
    ['Cuisez pomme de terre et petits pois 15 min à la vapeur.', 'Ajoutez le poisson les 8 dernières minutes.', 'Mixez finement en vérifiant l’absence d’arêtes.']),
  r('frites-patate', '6-8', 'Bâtonnets de patate douce rôtie', '🍠', 'DME', 35, '#F6BD60', '#F28482',
    ['1 patate douce', '1 c. à café d’huile d’olive'],
    ['Coupez en bâtonnets de la taille d’un doigt d’adulte.', 'Enrobez d’huile et enfournez 25 min à 200 °C.', 'Vérifiez qu’ils s’écrasent facilement entre deux doigts.']),
  r('pancakes', '8-12', 'Mini-pancakes banane & œuf', '🍌', 'DME', 15, '#FFD166', '#EF8354',
    ['1 banane bien mûre', '1 œuf', '2 c. à soupe de flocons d’avoine'],
    ['Écrasez la banane, ajoutez l’œuf et les flocons.', 'Versez de petites cuillerées dans une poêle huilée.', 'Cuisez 2 min de chaque côté, laissez tiédir.']),
  r('dahl', '8-12', 'Dahl doux de lentilles corail', '🥣', 'Purée', 25, '#F79D65', '#E76F51',
    ['2 c. à soupe de lentilles corail', '½ carotte', '1 c. à soupe de lait de coco'],
    ['Rincez les lentilles.', 'Cuisez avec la carotte en dés 15 min.', 'Ajoutez le lait de coco, écrasez à la fourchette.']),
  r('porridge', '8-12', 'Porridge pomme-cannelle', '🍎', 'Petit-déj', 10, '#E9C46A', '#BC6C25',
    ['3 c. à soupe de flocons d’avoine', '100 ml de lait de suite', '½ pomme râpée', '1 pincée de cannelle'],
    ['Faites chauffer les flocons dans le lait 5 min.', 'Ajoutez la pomme râpée et la cannelle.', 'Laissez épaissir hors du feu.']),
  r('muffins', '12+', 'Muffins courgette & fromage', '🧁', 'DME', 30, '#A7C957', '#6A994E',
    ['1 courgette râpée', '2 œufs', '60 g de farine', '30 g de fromage râpé pasteurisé'],
    ['Mélangez tous les ingrédients.', 'Répartissez dans des moules à mini-muffins.', 'Enfournez 20 min à 180 °C.']),
];
