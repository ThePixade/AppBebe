/*
 * Édition de l'application, reconnue au dossier d'où elle est servie :
 *  - …/appfamille/ : version de base ;
 *  - …/apppre/     : démo de la version Premium (personnalisation complète, accueil tableau de bord) ;
 *  - …/appdesign/  : mêmes fonctions que Premium, avec une autre identité visuelle (à comparer).
 * Chaque édition a son propre stockage local, sa propre synchro, son propre cache hors-ligne et sa propre icône :
 * on peut installer et utiliser les deux sur le même téléphone, avec les mêmes données du NAS.
 * Pour tester en local sans dossier : ajouter ?edition=pre à l'adresse.
 */
let forced = '';
try { forced = new URLSearchParams(location.search).get('edition') || ''; } catch { /* hors navigateur */ }
const path = typeof location !== 'undefined' ? location.pathname.toLowerCase() : '';

// …/appdesign/ : mêmes fonctions que Premium, avec une autre identité visuelle (design.css) pour comparer deux styles.
export const DESIGN = /\/appdesign(\/|$)/.test(path) || forced === 'design';
export const PREMIUM = DESIGN || /\/apppre(\/|$)/.test(path) || forced === 'pre';

export const EDITION = DESIGN
  ? { id: 'appdesign', premium: true, design: true, name: 'AppFamille Design', short: 'AppDesign', storageKey: 'appdesign:v1', syncKey: 'appdesign:sync', cssKey: 'appdesign:css' }
  : PREMIUM
    ? { id: 'apppre', premium: true, design: false, name: 'AppFamille Premium', short: 'AppPre', storageKey: 'apppre:v1', syncKey: 'apppre:sync', cssKey: 'apppre:css' }
    : { id: 'appfamille', premium: false, design: false, name: 'AppFamille', short: 'AppFamille', storageKey: 'appfamille:v1', syncKey: 'appfamille:sync', cssKey: null };
