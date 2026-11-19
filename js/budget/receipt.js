import { guessCategory, normText } from './cats.js';

/*
 * Lecture d'un ticket de caisse à partir du texte reconnu (OCR) : total, date, commerçant, catégorie probable.
 * Fonctions pures. La reconnaissance reste imparfaite : l'écran de vérification laisse toujours tout corriger.
 */

const AMOUNT_RE = /(?<![\d,.])(\d{1,5}(?:[ .]\d{3})*[,.]\d{2})(?!\d|[./-]\d)/g;

export function parseAmount(str) {
  let t = String(str).replace(/\s/g, '');
  const lastC = t.lastIndexOf(','), lastD = t.lastIndexOf('.');
  const dec = Math.max(lastC, lastD);
  if (dec < 0) return null;
  const n = parseFloat(t.slice(0, dec).replace(/[.,]/g, '') + '.' + t.slice(dec + 1));
  return Number.isFinite(n) ? n : null;
}

const amountsIn = (line) => [...line.matchAll(AMOUNT_RE)].map((m) => parseAmount(m[1])).filter((n) => n !== null && n > 0 && n < 100000);

// Mots qui annoncent le montant à payer, du plus fiable au moins fiable.
const TOTAL_KEYS = [
  [/net\s*a\s*payer|total\s*a\s*payer|a\s*payer|montant\s*du|total\s*du/, 100],
  [/total\s*(ttc|eur|euros|carte|cb|r[eè]gl)|total\s*g[eé]n[eé]ral/, 90],
  [/^\W*total\b/, 80],
  [/montant|somme|total/, 60],
  [/\b(cb|carte\s*bancaire|visa|mastercard|cartes?\s*bleue?|paiement)\b/, 50],
];
const NOT_TOTAL = /(sous[\s-]*total|tva|t\.v\.a|rendu|monnaie|esp[eè]ces?|remise|[eé]conomie|fid[eé]lit[eé]|cagnotte|points?\b|dont\b|ht\b)/;

const clean = (t) => t.replace(/[|_~]/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (l) => l.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function findTotal(lines) {
  let best = null; const all = [];
  lines.forEach((raw, i) => {
    const l = norm(raw), nums = amountsIn(raw);
    if (!/tva|rendu|monnaie|esp[eè]ces/.test(l)) all.push(...nums);
    if (!nums.length && !TOTAL_KEYS.some(([re]) => re.test(l))) return;
    for (const [re, score] of TOTAL_KEYS) {
      if (!re.test(l)) continue;
      let amount = nums.length ? nums[nums.length - 1] : null;
      let sc = score;
      if (amount === null && i + 1 < lines.length) { const nx = amountsIn(lines[i + 1]); if (nx.length) { amount = nx[nx.length - 1]; sc -= 8; } }
      if (amount === null) break;
      if (NOT_TOTAL.test(l) && !/total\s*ttc|net\s*a\s*payer|a\s*payer/.test(l)) sc -= 70;
      if (!best || sc > best.sc || (sc === best.sc && i > best.i)) best = { amount, sc, i };
      break;
    }
  });
  const candidates = [...new Set(all.map((n) => Math.round(n * 100) / 100))].sort((a, b) => b - a).slice(0, 8);
  if (best && best.sc > 0) return { total: best.amount, candidates };
  // Repli : le plus gros montant du ticket (souvent le total).
  return { total: candidates.length ? candidates[0] : null, candidates, weak: true };
}

const DATE_RE = /(?<!\d)(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4}|\d{2})(?!\d)/g;

export function findDate(text, now = Date.now()) {
  // l'OCR confond souvent 0 / O et 1 / l dans les chiffres
  const t = text.replace(/(?<=\d)[Oo](?=\d|\W)|(?<=\W)[Oo](?=\d)/g, '0').replace(/(?<=\d)[lI](?=\d)/g, '1');
  for (const m of t.matchAll(DATE_RE)) {
    let [, d, mo, y] = m; d = +d; mo = +mo; y = +y; if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    const ts = new Date(y, mo - 1, d, 12).getTime();
    if (new Date(ts).getDate() !== d) continue; // 31/02
    if (ts > now + 2 * 864e5 || ts < now - 5 * 365 * 864e5) continue;
    return ts;
  }
  return null;
}

const CHAINS = [
  ['Carrefour', /carrefour/], ['E.Leclerc', /leclerc/], ['Auchan', /auchan/], ['Lidl', /\blidl\b/], ['Aldi', /\baldi\b/], ['Intermarché', /intermarch/],
  ['Monoprix', /monoprix/], ['Franprix', /franprix/], ['Casino', /\bcasino\b/], ['Super U', /super u|hyper u|u express/], ['Picard', /picard/], ['Biocoop', /biocoop/],
  ['Grand Frais', /grand frais/], ['Action', /\baction\b/], ['IKEA', /ikea/], ['Leroy Merlin', /leroy merlin/], ['Castorama', /castorama/], ['Decathlon', /decathlon/],
  ['Kiabi', /kiabi/], ['Fnac', /\bfnac\b/], ['Cultura', /cultura/], ['TotalEnergies', /total ?energies|total access/], ['Shell', /\bshell\b/], ['Esso', /\besso\b/],
  ['McDonald\'s', /mc ?donald|mcdo/], ['Boulangerie', /boulangerie/], ['Pharmacie', /pharmacie/], ['Orchestra', /orchestra/], ['Vertbaudet', /vertbaudet/], ['Gifi', /gifi/], ['Darty', /darty/], ['Boulanger', /\bboulanger\b/],
];

export function findMerchant(lines) {
  const head = normText(lines.slice(0, 12).join(' '));
  for (const [name, re] of CHAINS) if (re.test(head)) return name;
  for (const raw of lines.slice(0, 8)) {
    const l = clean(raw), letters = (l.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    if (letters < 4 || letters < l.length * 0.55) continue;                 // trop de chiffres : adresse, téléphone, date
    if (/\b(tel|t[eé]l|siret|siren|rue|avenue|av\.|bd|boulevard|place|code|cedex|www|http|ticket|caisse|date|facture|merci)\b/i.test(l)) continue;
    const t = l.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    return t.slice(0, 40);
  }
  return '';
}

export function parseReceipt(text, now = Date.now(), state = { expenses: [] }) {
  const lines = String(text).split(/\r?\n/).map(clean).filter(Boolean);
  const { total, candidates, weak } = findTotal(lines);
  const merchant = findMerchant(lines);
  const date = findDate(text, now);
  const category = guessCategory(merchant, state) || guessCategory(lines.slice(0, 14).join(' '), state) || guessCategory(lines.join(' '), state);
  return { merchant, date, total, candidates, category, weak: !!weak || total === null, lines };
}
