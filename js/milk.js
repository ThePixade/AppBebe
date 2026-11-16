import { store } from './store.js';

/*
 * Lait maternel tiré : un biberon de lait maternel est retiré du stock du frigo
 * (le plus ancien pot d'abord, pour limiter les pertes). Les quantités prélevées sont
 * mémorisées dans le biberon (`taken`) pour pouvoir les remettre si on le modifie ou le supprime.
 */
const sum = (a) => a.reduce((t, x) => t + x.ml, 0);

export const fridgeMl = (s = store.state) => sum(s.stock.filter((x) => x.place === 'fridge'));

/** Retire `ml` du frigo. Retourne { taken: [{id, at, ml}], short } (short = ml manquants). */
export function takeFromFridge(ml) {
  const taken = [];
  let left = ml;
  store.update((s) => {
    const jars = s.stock.filter((x) => x.place === 'fridge').sort((a, b) => a.at - b.at);
    for (const j of jars) {
      if (left <= 0) break;
      const t = Math.min(j.ml, left);
      taken.push({ id: j.id, at: j.at, ml: t });
      j.ml -= t; left -= t;
    }
    s.stock = s.stock.filter((x) => x.ml > 0);
  });
  return { taken, short: Math.max(0, left) };
}

/** Remet dans le frigo ce qui avait été prélevé (recrée le pot s'il a été vidé entre-temps). */
export function giveBack(taken = []) {
  if (!taken.length) return;
  store.update((s) => {
    for (const t of taken) {
      const jar = s.stock.find((x) => x.id === t.id);
      if (jar) jar.ml += t.ml; else s.stock.push({ id: t.id, at: t.at, ml: t.ml, place: 'fridge' });
    }
  });
}

export const takenMl = (taken = []) => sum(taken);
