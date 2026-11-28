/*
 * Édition de l'application, reconnue au dossier d'où elle est servie :
 *  - …/appfamille/ : version de base ;
 *  - …/apppre/     : démo de la version Premium (personnalisation complète, accueil tableau de bord).
 * Chaque édition a son propre stockage local, sa propre synchro, son propre cache hors-ligne et sa propre icône :
 * on peut installer et utiliser les deux sur le même téléphone, avec les mêmes données du NAS.
 * Pour tester en local sans dossier : ajouter ?edition=pre à l'adresse.
 */
let forced = false;
try { forced = new URLSearchParams(location.search).get('edition') === 'pre'; } catch { /* hors navigateur */ }
const path = typeof location !== 'undefined' ? location.pathname.toLowerCase() : '';

export const PREMIUM = /\/apppre(\/|$)/.test(path) || forced;

export const EDITION = PREMIUM
  ? { id: 'apppre', premium: true, name: 'AppFamille Premium', short: 'AppPre', storageKey: 'apppre:v1', syncKey: 'apppre:sync', cssKey: 'apppre:css' }
  : { id: 'appfamille', premium: false, name: 'AppFamille', short: 'AppFamille', storageKey: 'appfamille:v1', syncKey: 'appfamille:sync', cssKey: null };
