import { store } from './store.js';

/*
 * Synchronisation entre téléphones via api.php (hébergé sur le NAS).
 * - Détection automatique : sans api.php (GitHub Pages, ordinateur), l'app reste 100 % locale.
 * - Fusion à trois voies (dernier état synchronisé / local / NAS) : les saisies faites
 *   en même temps sur deux téléphones sont toutes conservées.
 * - Les réglages propres à chaque téléphone (thème, « je suis », son…) ne sont pas partagés.
 */

const API = 'api.php';
const META_KEY = 'appfamille:sync';
const SHARED = ['children', 'events', 'timers', 'foods', 'moods', 'checks', 'pumps', 'stock', 'tasks', 'supplies', 'lists', 'agenda', 'modules', 'chores', 'menus'];
const POLL_MS = 10000;

export const sync = { available: false, status: 'off', lastSync: 0, error: null };
const listeners = new Set();
export const onSync = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((f) => f(sync));

let meta = loadMeta();
let busy = false, again = false, applying = false, pushTimer = null;

function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || { rev: 0, base: null }; } catch { return { rev: 0, base: null }; }
}
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* quota */ } }

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const pick = (s) => Object.fromEntries(SHARED.map((k) => [k, s[k]]));
const isIdArray = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => isObj(x) && 'id' in x);
const toMap = (a) => Object.fromEntries((Array.isArray(a) ? a : []).map((x) => [x.id, x]));

/** Fusion à trois voies générique sur du JSON. */
export function merge3(base, local, remote) {
  if (eq(local, remote)) return local;
  if (eq(base, local)) return remote;
  if (eq(base, remote)) return local;

  // Listes d'objets avec id (événements, profils, stock…) : fusion élément par élément.
  if ([base, local, remote].some(isIdArray) && [local, remote].every((a) => a === undefined || Array.isArray(a))) {
    return Object.values(merge3(toMap(base), toMap(local), toMap(remote)));
  }
  // Listes simples (ex. dates d'essai d'un aliment) : ajouts et retraits des deux côtés.
  if (Array.isArray(local) && Array.isArray(remote)) {
    const key = (x) => JSON.stringify(x);
    const B = new Set((Array.isArray(base) ? base : []).map(key));
    const L = new Map(local.map((x) => [key(x), x]));
    const R = new Map(remote.map((x) => [key(x), x]));
    const out = [];
    for (const [k, v] of new Map([...L, ...R])) {
      const inL = L.has(k), inR = R.has(k), inB = B.has(k);
      if ((inL && inR) || (inL && !inB) || (inR && !inB)) out.push(v);
    }
    return out;
  }
  // Objets : clé par clé, en respectant les suppressions.
  if (isObj(local) && isObj(remote)) {
    const b = isObj(base) ? base : {};
    const out = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const inL = k in local, inR = k in remote, inB = k in b;
      if (inL && inR) out[k] = merge3(b[k], local[k], remote[k]);
      else if (inL) { if (!(inB && eq(b[k], local[k]))) out[k] = local[k]; }      // supprimé sur le NAS
      else if (inR) { if (!(inB && eq(b[k], remote[k]))) out[k] = remote[k]; }    // supprimé ici
    }
    return out;
  }
  return local; // conflit sur une valeur simple : ce téléphone l'emporte
}

async function call(method, body, rev) {
  const res = await fetch(API, {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json', 'X-Base-Rev': String(rev) } : {},
    body,
  });
  let json;
  try { json = JSON.parse(await res.text()); } catch { throw Object.assign(new Error('no-api'), { code: 'no-api' }); }
  if (json?.app !== 'appfamille') throw Object.assign(new Error('no-api'), { code: 'no-api' });
  if (json.error) throw Object.assign(new Error(json.error), { code: json.error });
  return { status: res.status, json };
}

function applyLocal(merged) {
  if (eq(merged, pick(store.state))) return;
  applying = true;
  try { store.update((s) => { Object.assign(s, clone(merged)); }); } finally { applying = false; }
}

export async function syncNow() {
  if (!sync.available) return;
  if (busy) { again = true; return; }
  busy = true;
  sync.status = 'syncing'; emit();
  try {
    let { json: remote } = await call('GET');
    for (let attempt = 0; attempt < 4; attempt++) {
      const local = pick(store.state);
      const merged = remote.data ? merge3(meta.base ?? undefined, local, remote.data) : local;
      applyLocal(merged);
      if (eq(merged, remote.data)) { meta = { rev: remote.rev, base: clone(merged) }; break; }
      const { status, json } = await call('POST', JSON.stringify(merged), remote.rev);
      if (status === 200) { meta = { rev: json.rev, base: clone(merged) }; break; }
      if (status === 409) { remote = json; continue; }
      throw new Error(`HTTP ${status}`);
    }
    saveMeta();
    sync.status = 'ok'; sync.error = null; sync.lastSync = Date.now();
  } catch (e) {
    sync.status = 'error';
    sync.error = e.code === 'not_writable' ? 'Le NAS ne peut pas écrire dans le dossier de l’app.' : navigator.onLine ? 'NAS injoignable pour le moment.' : 'Hors connexion.';
  } finally {
    busy = false;
    emit();
    if (again) { again = false; syncNow(); }
  }
}

/** À appeler au démarrage : détecte le NAS et récupère les données partagées. */
export async function initSync() {
  try {
    const probe = call('GET');
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000));
    await Promise.race([probe, timeout]);
    sync.available = true;
  } catch (e) {
    // Pas d'api.php ici (GitHub Pages, ordinateur…) : mode local.
    // Si le dossier n'est pas accessible en écriture, on l'indique quand même.
    if (e.code === 'not_writable') { sync.available = true; }
    else return;
  }
  await syncNow();
  store.subscribe(() => {
    if (applying || eq(pick(store.state), meta.base)) return; // rien de nouveau à envoyer
    clearTimeout(pushTimer);
    pushTimer = setTimeout(syncNow, 700);
  });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  window.addEventListener('online', syncNow);
}
