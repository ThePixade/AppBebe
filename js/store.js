import { uid } from './ui.js';
import { EDITION } from './edition.js';

/**
 * État unique de l'application, persisté en local (localStorage).
 * Aucune donnée ne quitte l'appareil.
 */
const KEY = EDITION.storageKey;
const LEGACY_KEY = 'appbebe:v2'; // version d'origine : lue une seule fois pour reprendre les données, jamais modifiée

const defaults = () => ({
  version: 1,
  ui: null,               // personnalisation de l'affichage (édition Premium), synchronisée entre les appareils
  memo: '',               // mémo de la famille (accueil Premium), partagé
  modules: null,          // modules visibles sur CET appareil : null = pas encore choisi (jamais partagé)
  routines: [],           // routine : [{ id, who: 'baby'|'Maman'|'Papa', time, title }] (partagé)
  routineDone: {},        // routine cochée par jour : { 'AAAA-MM-JJ': { id: qui } } (partagé)
  babyHome: null,         // organisation de la page Bébé (partagée) : { order: [...], hidden: [...] }
  modulesHint: '',        // dernière configuration de modules faite dans la famille (JSON, partagé) : simple point de départ
  modulesNotice: null,    // alerte d'arrivée à afficher une fois sur cet appareil
  meChosen: false,        // le rôle (Maman / Papa / Nounou) a été choisi sur cet appareil          // { baby, agenda, … } : null = choix des modules pas encore fait
  theme: 'auto',          // auto | dark | light
  me: 'Maman',            // qui utilise l'appareil : Maman | Papa | Nounou
  children: [],           // { id, name, birth, sex: 'F'|'M', photo, hue }
  activeChild: null,
  events: [],             // { id, childId, type, at, by, ...données }
  timers: { breast: {}, sleep: {} },
  foods: {},              // { [childId]: { [foodId]: { status, tries: [ts] } } }
  moods: { Maman: {}, Papa: {} },
  checks: {},
  pumps: [],              // { id, at, ml, side }
  stock: [],              // { id, at, ml, place: 'fridge'|'freezer' }
  supplies: [],           // { id, name, auto: 'diaper'|'formula'|null, unit, qty, since, low, yield?, icon, tone }
  lists: [],              // { id, name, kind: 'shop'|'trip'|'custom', created, items: [{ id, text, qty?, cat?, done }] }
  agenda: [],             // { id, title, kind: 'rdv'|'trip'|'family'|'other', allDay, start, end, place, note, by }
  expenses: [],           // { id, at, amount, cat, note, by, shared, tripId? }
  fixed: [],              // charges fixes mensuelles : { id, name, amount, cat }
  budget: { monthly: null, cats: {} },   // plafond mensuel global et par catégorie
  goals: [],              // objectifs d'épargne : { id, name, target, initial, deadline?, hist: [{ id, at, amount, by }] }
  members: [],            // santé : { id, name, birth, sex, blood, allergies, antecedents, doctor, mutuelle, notes, childId? (lien avec un profil Bébé) }
  health: [],             // carnet : { id, memberId, type: 'rdv'|'vaccin'|'traitement'|'symptome'|'mesure'|'note', title, at, … } (voir js/pages/sante.js)
  doses: [],              // prises de médicaments : { id, tid (traitement), memberId, day, slot: 'HH:MM'|null, at, by }
  meds: [],               // pharmacie : { id, name, expiry (1er jour du mois d'expiration), qty, note }
  contacts: [],           // contacts de santé : { id, name, role, phone, address, note }
  trips: [],              // { id, name, dest, start, end, budget, lodging, ref, notes, items[], plan[], spend[], agendaId? }
  homeLists: [],          // module Maison › Listes : { id, name, check (à cocher ?), created, items: [{ id, text, done?, by }] }
  chores: [],             // { id, name, every (jours, 0 = une fois), who: ''|'tour'|prénom, turn, last, lastBy, created }
  menus: {},              // { [AAAA-MM-JJ]: { lunch, dinner } }
  tasks: [],              // { id, text, from, to, at, done }
  bannerSeen: null,       // id de la dernière action retirée de la bannière (sur CET appareil)
  pumpOn: null,           // tire-lait affiché dans Parents › Pour Maman (sur CET appareil) : true | false | null (selon les données)
  breastInput: null,      // saisie des tétées sur CET appareil : 'manual' | 'timer' | null (à demander)
  audio: { sound: 'white', timer: 30, volume: 0.7, fade: true },
  premium: false,
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const d = defaults();
      return { ...d, ...data, timers: { ...d.timers, ...data.timers }, audio: { ...d.audio, ...data.audio }, moods: { ...d.moods, ...data.moods } };
    }
  } catch (e) { console.warn('Lecture des données impossible', e); }
  return migrateLegacy();
}

/**
 * Première ouverture : reprend une COPIE des données déjà présentes sur l'appareil (jamais modifiées) :
 * AppBébé d'origine et, pour l'édition Premium, AppFamille.
 */
function migrateLegacy() {
  const sources = EDITION.design ? ['apppre:v1', 'appfamille:v1', LEGACY_KEY] : EDITION.premium ? ['appfamille:v1', LEGACY_KEY] : [LEGACY_KEY];
  for (const k of sources) {
    try {
      const raw = localStorage.getItem(k); if (!raw) continue;
      const data = JSON.parse(raw), d = defaults();
      const usable = k === LEGACY_KEY ? Array.isArray(data.children) && data.children.length : !!(data && (data.modules || (data.children && data.children.length)));
      if (!usable) continue;
      return { ...d, ...data, version: 1, ui: null, modules: data.modules || { baby: true, agenda: true },
        timers: { ...d.timers, ...data.timers }, audio: { ...d.audio, ...data.audio }, moods: { ...d.moods, ...data.moods } };
    } catch (e) { console.warn('Reprise des données impossible', e); }
  }
  return defaults();
}

let state = load();
const listeners = new Set();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('Sauvegarde impossible', e); }
}
const notify = () => listeners.forEach((l) => l(state));

export const store = {
  get state() { return state; },
  update(mutator, { silent = false } = {}) { mutator(state); persist(); if (!silent) notify(); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  replace(next) { state = { ...defaults(), ...next }; persist(); notify(); },
  reset() { state = defaults(); persist(); notify(); },
  /** Re-rendu sans modification des données (état d'interface). */
  refresh() { notify(); },
};

/* ---------- Sélecteurs & actions ---------- */
export const activeChild = (s = state) => s.children.find((c) => c.id === s.activeChild) || s.children[0] || null;
export const eventsOf = (s, childId) => s.events.filter((e) => e.childId === childId).sort((a, b) => b.at - a.at);
export const lastOf = (s, childId, type) => eventsOf(s, childId).find((e) => e.type === type);

export function addEvent(data) {
  const ev = { id: uid(), by: state.me, at: Date.now(), ...data };
  store.update((s) => { s.events.push(ev); });
  return ev;
}
export function removeEvent(id) {
  const ev = state.events.find((e) => e.id === id);
  store.update((s) => { s.events = s.events.filter((e) => e.id !== id); });
  return ev;
}
export function updateEvent(id, patch) {
  store.update((s) => { const e = s.events.find((x) => x.id === id); if (e) Object.assign(e, patch); });
}
export function restoreEvent(ev) { store.update((s) => { s.events.push(ev); }); }

export function resolvedTheme(s = state) {
  if (s.theme !== 'auto') return s.theme;
  const h = new Date().getHours();
  return h >= 19 || h < 8 ? 'dark' : 'light';
}

/* ---------- Mode d'alimentation (adapte ce qui est proposé) ---------- */
export const FEEDING = { breast: 'Allaitement', formula: 'Biberon', mixed: 'Mixte' };
/** Choix du profil ; à défaut, déduit du journal ; null = inconnu (on propose tout). */
export function feedingOf(s, c) {
  if (!c) return null;
  if (c.feeding) return c.feeding;
  let breast = false, formula = false;
  for (const e of s.events) {
    if (e.childId !== c.id || e.type !== 'feed') continue;
    if (e.kind === 'breast' || e.milk === 'maternel') breast = true; else if (e.kind === 'bottle') formula = true;
  }
  return breast && formula ? 'mixed' : breast ? 'breast' : formula ? 'formula' : null;
}
/** Au moins un enfant reçoit du lait infantile (ou on ne sait pas). */
export const usesFormula = (s) => !s.children.length || s.children.some((c) => feedingOf(s, c) !== 'breast');
export const usesBreast = (s) => !s.children.length || s.children.some((c) => feedingOf(s, c) !== 'formula');

/** Active / désactive l'allaitement (tous les profils). On garde le mode précédent pour le rétablir. */
export function setBreastfeeding(on) {
  store.update((s) => {
    for (const c of s.children) {
      const f = feedingOf(s, c);
      if (on && f === 'formula') { c.feeding = c.feedingPrev || 'mixed'; delete c.feedingPrev; }
      else if (!on && f !== 'formula') { c.feedingPrev = f || 'mixed'; c.feeding = 'formula'; }
    }
  });
}

/** Un module est-il activé ? */
export const moduleOn = (s, id) => !!s.modules?.[id];

/** Le co-parent « naturel » de l'utilisateur courant. */
export const partnerOf = (me) => (me === 'Papa' ? 'Maman' : 'Papa');
