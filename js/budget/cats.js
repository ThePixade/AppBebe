/*
 * Catégories du Budget + devinette de catégorie à partir d'un libellé.
 * 1) ce que la famille a déjà saisi (le libellé « Boulangerie » classé 3 fois en Courses → Courses),
 * 2) une liste de commerçants et mots-clés courants.
 */
export const CATS = [
  ['courses', 'Courses', 'cart', 'sage'], ['resto', 'Restaurants', 'fork', 'peach'], ['logement', 'Logement', 'home', 'slate'],
  ['maison', 'Maison & équipement', 'box', 'gold'], ['transport', 'Transports', 'send', 'gold'], ['sante', 'Santé', 'stetho', 'brick'],
  ['enfants', 'Enfants', 'baby', 'salmon'], ['vetements', 'Vêtements', 'tag', 'slate'], ['loisirs', 'Loisirs', 'sparkle', 'peach'],
  ['abos', 'Abonnements', 'clock', 'slate'], ['vacances', 'Vacances', 'plane', 'gold'], ['autre', 'Autre', 'coins', 'sage'],
];
export const INCOME_CATS = [
  ['salaire', 'Salaire', 'wallet', 'sage'], ['alloc', 'Allocations (CAF…)', 'baby', 'salmon'],
  ['remb', 'Remboursements', 'repeat', 'slate'], ['autre_in', 'Autre revenu', 'coins', 'gold'],
];
const ALL = [...CATS, ...INCOME_CATS];
export const catOf = (k) => ALL.find(([id]) => id === k) || CATS[CATS.length - 1];

/** Minuscules, sans accents ni ponctuation : « Café de la Gare » → « cafe de la gare ». */
export const normText = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Ordre important : du plus précis au plus général.
const RULES = [
  ['sante', /\b(pharmacie|parapharmacie|medecin|docteur|dr |dentiste|opticien|optique|laboratoire|kine|osteo|hopital|clinique|ordonnance|doliprane|infirmier|radiologie|ophtalmo|pediatre)\b/],
  ['enfants', /\b(bebe|puericulture|orchestra|vertbaudet|babies|pampers|creche|nounou|assistante maternelle|jouet|king jouet|jouet club|la grande recre|cantine|scolaire|ecole|couches|lait infantile|gallia|modilac|garderie|centre de loisirs)\b/],
  ['transport', /\b(total energies|totalenergies|total access|esso|shell|bp station|station service|station|carburant|gazole|diesel|sp95|sp98|e10|essence|peage|autoroute|sanef|vinci autoroutes|sncf|ratp|navigo|uber|taxi|blablacar|parking|indigo|transilien|ter |velib|trottinette|garage|norauto|feu vert|midas|speedy|controle technique)\b/],
  ['vacances', /\b(hotel|airbnb|booking|camping|gite|air france|easyjet|ryanair|transavia|voyage|location voiture|sejour|abritel|vacances|ibis|formule 1|center parcs)\b/],
  ['resto', /\b(restaurant|brasserie|pizz\w*|burger|mc ?donald\w*|mcdo|kfc|quick|sushi|kebab|traiteur|cafe|bistro|sandwich\w*|paul|brioche doree|starbucks|deliveroo|uber eats|just eat|boulangerie salon|creperie|bar|pub|glacier)\b/],
  ['courses', /\b(carrefour|leclerc|auchan|lidl|aldi|intermarche|monoprix|franprix|casino|super u|hyper u|u express|picard|biocoop|naturalia|grand frais|netto|cora|match|supermarche|hypermarche|boulangerie|boucherie|primeur|marche|epicerie|drive|fromagerie|poissonnerie|spar|vival|proxi|bio c bon|la vie claire)\b/],
  ['vetements', /\b(h&m|h et m|zara|uniqlo|primark|celio|jules|promod|camaieu|kiabi|vetements?|chaussures?|andre|eram|besson|jennyfer|bershka|c&a|pimkie|okaidi|jacadi|tape a l oeil|la halle)\b/],
  ['maison', /\b(ikea|leroy merlin|castorama|brico\w*|mr bricolage|conforama|maisons du monde|action|gifi|darty|boulanger|electromenager|quincaillerie|jardinerie|truffaut|botanic|but |alinea|habitat|lapeyre)\b/],
  ['loisirs', /\b(cinema|ugc|pathe|gaumont|fnac|cultura|decathlon|go sport|intersport|librairie|spectacle|concert|theatre|musee|parc|zoo|bowling|piscine|escape game|jeux|steam|playstation|nintendo|micromania)\b/],
  ['abos', /\b(netflix|spotify|disney|canal\+?|amazon prime|prime video|abonnement|free mobile|orange|sfr|bouygues|forfait|deezer|youtube premium|apple|icloud|google one)\b/],
  ['logement', /\b(loyer|edf|engie|electricite|eau|syndic|assurance|taxe fonciere|charges|gaz|internet|box|veolia|mutuelle|habitation)\b/],
];

/** Mémoire de la famille : libellé normalisé → catégorie la plus fréquente. */
function learned(s) {
  const m = new Map();
  for (const e of s.expenses || []) {
    if ((e.kind && e.kind !== 'out') || !e.note || !e.cat) continue;
    const k = normText(e.note); if (!k) continue;
    const c = m.get(k) || {}; c[e.cat] = (c[e.cat] || 0) + 1; m.set(k, c);
  }
  return m;
}

/** Catégorie probable d'un libellé / d'un ticket ; null si on ne sait pas. */
export function guessCategory(text, s = { expenses: [] }) {
  const t = normText(text); if (!t) return null;
  const mem = learned(s);
  if (mem.has(t)) return Object.entries(mem.get(t)).sort((a, b) => b[1] - a[1])[0][0];
  for (const [k, c] of mem) if (k.length >= 4 && (t.includes(k) || k.includes(t) && t.length >= 4)) return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
  for (const [cat, re] of RULES) if (re.test(t)) return cat;
  return null;
}

export function guessIncomeCategory(text) {
  const t = normText(text);
  if (/\b(salaire|paie|employeur|remuneration)\b/.test(t)) return 'salaire';
  if (/\b(caf|allocation|alloc|pole emploi|france travail|prime|cpam|indemnite)\b/.test(t)) return 'alloc';
  if (/\b(remboursement|rbt|mutuelle|secu)\b/.test(t)) return 'remb';
  return 'autre_in';
}
