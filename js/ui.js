import { icon } from './icons.js';

/* ---------- Utilitaires ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const pad = (n) => String(n).padStart(2, '0');
export const norm = (s) => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
export const fmtNum = (n, d = 1) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d });
export const DAY = 864e5;

export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
export function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${pad(r)}` : `${h} h`;
}
export function ago(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h${m % 60 ? ' ' + pad(m % 60) : ''}`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hier' : `il y a ${d} j`;
}
export const time = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
export const dateShort = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
export const dayLabel = (d = new Date()) => {
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const dayKey = (d = new Date()) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
export const toLocalInput = (ts = Date.now()) => { const d = new Date(ts); return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fromLocalInput = (v) => (v ? new Date(v).getTime() : Date.now());

export function ageMonths(birth, at = Date.now()) {
  const b = new Date(birth), a = new Date(at);
  let m = (a.getFullYear() - b.getFullYear()) * 12 + a.getMonth() - b.getMonth();
  if (a.getDate() < b.getDate()) m--;
  return Math.max(0, m);
}
export const ageMonthsExact = (birth, at = Date.now()) => Math.max(0, (at - new Date(birth).getTime()) / (30.4375 * DAY));
export function ageLabel(birth) {
  const m = ageMonths(birth);
  if (m < 1) { const d = Math.max(0, Math.floor((Date.now() - new Date(birth)) / DAY)); return `${d} jour${d > 1 ? 's' : ''}`; }
  if (m < 24) return `${m} mois`;
  const y = Math.floor(m / 12), r = m % 12;
  return `${y} an${y > 1 ? 's' : ''}${r ? ` ${r} mois` : ''}`;
}

/* ---------- Horloge partagée (1 s) ---------- */
const ticks = new Set();
setInterval(() => ticks.forEach((f) => { try { f(); } catch (e) { console.error(e); } }), 1000);
export function onTick(fn) { ticks.add(fn); fn(); return () => ticks.delete(fn); }

/** Regroupe des abonnements à libérer ensemble (à chaque rendu de page). */
export function createScope() {
  const fns = [];
  return {
    onTick(fn) { fns.push(onTick(fn)); },
    add(fn) { fns.push(fn); },
    dispose() { fns.splice(0).forEach((f) => f()); },
  };
}

/* ---------- Bottom sheet ---------- */
let sheetScope = createScope();
let sheetToken = 0;
let lastFocus = null;

export function openSheet({ title, subtitle = '', content = '', onMount, className = '' }) {
  closeSheet(true);
  const token = ++sheetToken;
  const root = $('#sheet-root');
  lastFocus = document.activeElement;
  root.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <section class="sheet ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-handle" aria-hidden="true"></div>
      <header class="sheet-head">
        <div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
        <button class="icon-btn icon-btn-sm" data-close aria-label="Fermer">${icon('x', 20)}</button>
      </header>
      <div class="sheet-body">${content}</div>
    </section>`;
  root.classList.add('open');
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => requestAnimationFrame(() => token === sheetToken && root.classList.add('visible')));
  $$('[data-close]', root).forEach((b) => b.addEventListener('click', () => closeSheet()));
  const body = $('.sheet-body', root);
  const api = { body, close: () => closeSheet(), onTick: (f) => sheetScope.onTick(f), add: (f) => sheetScope.add(f) };
  onMount?.(body, api);
  setTimeout(() => $('.sheet', root)?.focus?.(), 50);
  return api;
}

export function closeSheet(immediate = false) {
  sheetScope.dispose();
  const root = $('#sheet-root');
  if (!root || !root.classList.contains('open')) return;
  const token = ++sheetToken;
  root.classList.remove('visible');
  document.body.classList.remove('sheet-open');
  const done = () => { if (token !== sheetToken) return; root.classList.remove('open'); root.innerHTML = ''; lastFocus?.focus?.(); };
  immediate ? done() : setTimeout(done, 280);
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

/* ---------- Toast ---------- */
let toastTimer;
export function toast(message, { action, onAction, duration = 3600 } = {}) {
  const root = $('#toast-root');
  clearTimeout(toastTimer);
  root.innerHTML = `<div class="toast" role="status"><span>${esc(message)}</span>${action ? `<button class="toast-action">${esc(action)}</button>` : ''}</div>`;
  const el = root.firstElementChild;
  requestAnimationFrame(() => el.classList.add('visible'));
  el.querySelector('.toast-action')?.addEventListener('click', () => { onAction?.(); hide(); });
  const hide = () => { el.classList.remove('visible'); setTimeout(() => el.remove(), 250); };
  toastTimer = setTimeout(hide, duration);
}

/* ---------- Petits composants ---------- */
export const seg = (name, options, value, cls = '') => `
  <div class="seg ${cls}" role="tablist">${options.map(([v, label]) => `
    <button role="tab" aria-selected="${v === value}" class="${v === value ? 'is-on' : ''}" data-seg="${name}" data-v="${v}">${label}</button>`).join('')}
  </div>`;

export const emptyState = (ic, title, text = '') => `
  <div class="empty"><span class="empty-icon">${icon(ic, 26)}</span><p class="empty-title">${esc(title)}</p>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
