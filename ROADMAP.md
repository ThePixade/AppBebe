# AppFamille — feuille de route

Version « annexe » d'AppBébé : la branche `main` (AppBébé d'origine) n'est pas modifiée.
Cette version utilise ses propres clés de stockage (`appfamille:*`), son propre cache hors-ligne et son propre fichier de données NAS (`appfamille-data.php`) : les deux apps peuvent coexister sans se marcher dessus.
À la première ouverture, les données d'AppBébé présentes sur l'appareil sont **copiées** (jamais modifiées).

## Mode test : données partagées avec AppBébé (NAS)
Automatique : si un dossier voisin `appbebe` (casse indifférente) contient `appbebe-data.php`, AppFamille lit et écrit ce fichier (même synchro qu'AppBébé).
Pour des données séparées : créer un fichier vide `no-link-appbebe` dans le dossier d'AppFamille (`touch /share/Web/appfamille/no-link-appbebe`), le supprimer pour relier à nouveau.
AppBébé ignore les champs ajoutés par AppFamille (modules, tâches, menus) mais les conserve.

## Démo Premium (AppPre)
Dossier `AppPre` du NAS : accueil tableau de bord à cases déplaçables, personnalisation complète de l'affichage, navigation configurable. Même code que AppFamille, activé par le nom du dossier. Voir le README.

## Principe : des modules à activer
Registre dans `js/modules.js`. Un module = une entrée du registre + une page dans `js/pages/` + une route dans `js/app.js`.
Le choix se fait au premier démarrage et reste modifiable dans Réglages. Les modules « Bientôt » sont visibles mais non activables.

## État
| Module | État |
|---|---|
| Bébé (suivi, repas, sommeil, croissance, parents, stock & listes) | ✅ repris tel quel |
| Agenda commun | ✅ repris tel quel |
| Budget complet (scan de tickets, revenus, budgets par catégorie, épargne, bilan annuel, import / export CSV) | ✅ v0.4 |
| Santé complète (prises du jour, mesures en courbes, calendrier vaccinal, pharmacie, fiche à partager, contacts) | ✅ v0.5 |
| Vacances (valises générées, programme, budget, lien agenda et Budget) | ✅ v0.3 |
| Maison (courses, tâches ménagères, menus de la semaine) | ✅ v0.2 |

## Contenu envisagé des prochains modules
- **Budget** : dépenses par catégorie, budget mensuel, « qui a payé quoi / qui doit combien » entre parents, dépenses récurrentes (abonnements, crèche, assurances), alerte de dépassement.
- **Santé** : un carnet par membre de la famille (pas seulement bébé), vaccins avec rappels, ordonnances et traitements en cours, rendez-vous médicaux (liés à l'agenda), poids/taille pour tous, allergies, numéros utiles. Rappels de prise de médicament.
- **Vacances** : fiche voyage (dates, lieu, hébergement, réservations), liste de valises générée selon la durée et la météo, budget du voyage (liaison avec Budget), documents (billets, passeports) — le tout lié à l'agenda.
- **Maison** : liste de courses partagée (existe déjà dans Stock & listes), tâches ménagères tournantes avec qui-fait-quoi, menus de la semaine → liste de courses automatique.
- **Autres idées** : Documents (carte d'identité, mutuelle, contrats — coffre local), Scolaire / crèche (calendrier, sorties, cantine), Activités des enfants, Cadeaux & anniversaires (idées, budget), Animaux, Contacts utiles (pédiatre, nounou, école).

## Pistes de monétisation (pour une mise en ligne)
1. **Freemium** (le plus naturel) : socle gratuit (Bébé + Agenda), modules avancés et synchro cloud en abonnement « Famille » (ex. 2,99 €/mois ou 24 €/an). Le champ `premium` existe déjà dans l'état.
2. **Synchronisation cloud payante** : aujourd'hui le partage passe par un NAS ; pour le grand public, c'est la fonction qui justifie un abonnement (hébergement + sauvegarde + multi-appareils).
3. **Packs de modules à l'achat** (« Pack Voyage », « Pack Budget ») pour ceux qui refusent l'abonnement.
4. **Export & documents** : export PDF du carnet de santé / bilan annuel du budget, album souvenir de la première année de bébé (livre photo imprimé en partenariat).
5. **Partenariats** (sobres, jamais intrusifs) : mutuelles, assurances, marques de puériculture, programmes de cashback — affichés comme suggestions utiles, pas comme publicité.
6. **Version « pro »** pour assistantes maternelles / crèches : plusieurs familles, transmissions parent ↔ nounou.

À éviter : la publicité ciblée et la revente de données — la promesse « vos données restent chez vous » est le vrai argument de vente face aux grosses applis.
Avant toute mise en ligne publique : RGPD (données de santé = catégorie sensible), comptes et mot de passe (l'API NAS actuelle n'en a pas), chiffrement des données synchronisées, mentions légales / CGU, et rappel que les repères médicaux sont indicatifs.

## Prochaines étapes proposées
1. Choisir le premier module à construire (suggestion : **Budget** ou **Santé**).
2. Ajouter des comptes + chiffrement avant toute ouverture au public.
3. Renommer et refaire l'identité visuelle (icône, logo) pour « AppFamille ».
