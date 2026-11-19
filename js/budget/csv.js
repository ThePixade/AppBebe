import { parseAmount } from './receipt.js';

/* Import d'un relevé bancaire (CSV) et export des dépenses (CSV compatible Excel). */

export function parseCSV(text) {
  text = String(text).replace(/^﻿/, '');
  const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const sep = [';', '\t', ','].map((c) => [c, (first.match(new RegExp(c === '\t' ? '\t' : '\\' + c, 'g')) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((c) => c.trim())) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const norm = (s) => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function parseDate(v) {
  const t = String(v).trim();
  let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; const d = new Date(y, +m[2] - 1, +m[1], 12); return d.getDate() === +m[1] ? d.getTime() : null; }
  m = t.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3], 12); return d.getDate() === +m[3] ? d.getTime() : null; }
  return null;
}

const money = (v) => { const t = String(v).replace(/[€\s ]/g, '').replace(/^\+/, ''); if (!t) return null; const neg = /^-|^\(.*\)$/.test(t); const n = parseAmount(/[,.]/.test(t) ? t.replace(/[()-]/g, '') : t.replace(/[()-]/g, '') + ',00'); return n === null ? null : neg ? -n : n; };

/**
 * Détecte les colonnes (date, libellé, montant ou débit / crédit) et renvoie des opérations :
 * { at, label, amount } avec amount < 0 pour une dépense.
 */
export function readBankRows(rows) {
  if (rows.length < 2) return { ops: [], error: 'Fichier vide ou illisible.' };
  let h = rows.findIndex((r) => r.some((c) => /date/.test(norm(c))) && r.some((c) => /(libell|descr|intitul|motif|detail|nom|operation)/.test(norm(c))));
  const hasHeader = h >= 0; if (!hasHeader) h = -1;
  const head = hasHeader ? rows[h].map(norm) : [];
  const idx = (re) => head.findIndex((c) => re.test(c));
  let cDate = idx(/date/), cLabel = idx(/(libell|descr|intitul|motif|detail|nom|operation)/), cAmt = idx(/^(montant|amount|somme)/), cDeb = idx(/debit/), cCre = idx(/credit/);
  const body = rows.slice(h + 1);
  if (!hasHeader) { // pas d'en-tête : on devine d'après le contenu de la 1re ligne
    const r = body[0]; cDate = r.findIndex((c) => parseDate(c) !== null); cAmt = r.map((c, i) => [i, money(c)]).filter(([i, v]) => v !== null && i !== cDate).map(([i]) => i).pop() ?? -1;
    cLabel = r.findIndex((c, i) => i !== cDate && i !== cAmt && /[a-z]/i.test(c));
  }
  if (cDate < 0 || cLabel < 0 || (cAmt < 0 && cDeb < 0 && cCre < 0)) return { ops: [], error: "Colonnes non reconnues : il faut une date, un libellé et un montant." };
  const ops = [];
  for (const r of body) {
    const at = parseDate(r[cDate] ?? ''); if (at === null) continue;
    let amount = null;
    if (cAmt >= 0) amount = money(r[cAmt] ?? '');
    else { const d = money(r[cDeb] ?? ''), c = money(r[cCre] ?? ''); amount = d ? -Math.abs(d) : c ? Math.abs(c) : null; }
    if (amount === null || amount === 0) continue;
    ops.push({ at, label: String(r[cLabel] ?? '').replace(/\s+/g, ' ').trim(), amount });
  }
  return { ops: ops.slice(0, 600), error: ops.length ? null : 'Aucune opération trouvée.' };
}

/** Décode un fichier : UTF-8, ou Windows-1252 si le fichier vient d'une vieille banque. */
export async function readFileText(file) {
  const buf = await file.arrayBuffer();
  const utf = new TextDecoder('utf-8').decode(buf);
  return utf.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf;
}

const q = (v) => { const t = String(v ?? ''); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
export function toCSV(rows) {
  return '﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n');
}
