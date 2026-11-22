# AppFamille (version annexe d'AppBébé)

> Cette branche est une évolution d'AppBébé vers une application de famille **modulaire** (Bébé, Agenda, puis Budget, Santé, Vacances…). `main` garde AppBébé d'origine. Voir [ROADMAP.md](ROADMAP.md).

Le carnet de bord des jeunes parents : suivi quotidien de bébé, diversification alimentaire, espace parents et sons apaisants.
Application web progressive (PWA) installable sur téléphone, **sans serveur ni compte** : toutes les données restent sur l'appareil.

## Fonctionnalités

**Accueil & Suivi**
- Profils multiples (jumeaux, fratrie) avec photo, prénom et âge
- Tétée : durée saisie à la main (par défaut) ou chronomètre gauche / droite avec côté conseillé, au choix de chaque appareil ; biberon avec pavé numérique
- Interrupteur « Allaitement » dans Parents › Pour Maman : désactivé, les tétées sont masquées ; le tirage du lait (tire-lait et stock frigo / congélateur) est une option à activer
- Couches en 2 touches (mouillée, sale, mixte) avec couleur et texture des selles, et alertes (selles décolorées, sang)
- Chronomètre de sommeil, courbes de poids et de taille avec repères OMS
- Bouton « + » central : note, vaccin, médicament, température, sieste passée, mesure
- Fil de la journée et bannière de la dernière action du co-parent ou de la nounou
- Tout est modifiable après coup (heure, quantité, durée…), avec historique jour par jour
- Statistiques sur 7, 14 ou 30 jours : moyennes par jour, graphiques repas / couches / sommeil, rythme sur 24 h
- Stock de couches et de lait infantile décompté automatiquement depuis le journal (en ml pour le lait), prévision en jours restants et alerte « stock bas »
- Profil d'alimentation (allaitement, biberon, mixte) : l'app ne propose que ce qui vous concerne (pas de lait infantile ni de choix du lait si bébé est allaité), et les listes s'adaptent
- Un biberon de lait maternel est retiré automatiquement du stock du frigo (pot le plus ancien d'abord) ; modifier ou supprimer le biberon remet le lait dans le stock
- Listes partagées : courses, voyage, sac à langer, valise maternité (modèles prêts à l'emploi qui se règlent avec quelques questions : « de quoi faire dormir bébé sur place ? » retire le lit parapluie), avec ajout en un clic depuis le stock ; chaque article indique qui l'a ajouté et qui l'a coché
- Agenda commun (rendez-vous, départs en vacances, fêtes) : vue mensuelle, événements sur plusieurs jours, qui l'a ajouté, prochain événement sur l'accueil ; **catégories par module** (Santé, Vacances, Bébé, Maison, Budget, Famille), filtre par catégorie et **résumé « Par module »** ; chaque module affiche ses propres rendez-vous de l'agenda

**Diversification**
- Recherche d'aliment avec vérification de l'âge adapté
- Calendrier hebdomadaire des aliments goûtés
- Catalogue de 39 aliments avec tags Validé / À réessayer / Allergène
- Carrousel de recettes par tranche d'âge (modèle Premium)

**Espace parents**
- Onglets Pour Maman / Pour Papa
- Suivi d'humeur quotidien avec alerte douce en cas de jours difficiles répétés
- Check-list post-partum et démarches administratives
- Tire-lait et stock de lait (frigo / congélateur) avec dates limites
- Cohérence cardiaque guidée et partage de tâches avec le co-parent

**Détente & sommeil**
- 13 sons générés en temps réel (bruits blancs, pluie, vagues, battements de cœur, berceuses) : aucun fichier audio, fonctionne en mode avion
- Minuteur intelligent avec baisse progressive du volume
- Mini-lecteur Lecture / Pause visible sur toutes les pages tant qu'un son est lancé
- Veilleuse plein écran à lueur chaude réglable

**Budget** (AppFamille)
- Dépenses et revenus, en 10 secondes : montant, libellé, catégorie devinée automatiquement, qui a payé, dépense commune ou perso
- Scan de ticket de caisse (OCR embarqué, sur le téléphone) : **désactivé pour le moment**, la lecture n'est pas assez fiable (interrupteur `SCAN_ENABLED` dans `js/pages/budget.js`)
- Budget mensuel + **budgets par catégorie** avec alertes à 80 %, reste par jour, projection de fin de mois, évolution par rapport au mois précédent
- Charges et revenus fixes (jour du mois, début et fin), prochains prélèvements
- **Qui doit quoi** entre parents (cumulé) et **règlement des comptes**
- **Objectifs d'épargne** avec historique et rythme mensuel conseillé
- **Bilan de l'année** : graphique mois par mois, mois le plus cher, répartition par catégorie
- Recherche et filtres, dépenses fréquentes en un geste, duplication
- **Import d'un relevé bancaire (CSV)** avec catégories automatiques et détection des doublons ; **export CSV** (mois, année, tout)

**Santé** (AppFamille)
- **Prises du jour** : liste à cocher des médicaments à prendre (horaires, jour 3/7 d'un antibiotique), en retard / c'est l'heure, qui a donné quoi ; médicaments « si besoin » avec délai minimum avant la prochaine prise
- **Carnet** par personne : rendez-vous (lien agenda et budget), vaccins avec rappel, traitements, symptômes, mesures, notes ; fusionne les vaccins, températures, mesures et médicaments notés dans le module Bébé
- **Suivi en courbes** : température (alerte fièvre, avis médical avant 3 mois), poids, taille, tension, glycémie
- **Vaccins et dépistages recommandés** (calendrier français, indicatif) selon l'âge, avec ce qui est déjà fait
- **Pharmacie** : dates de péremption, alertes, ajout aux courses
- **Fiche à partager** (médecin, nounou, urgences) en texte, **contacts de santé** avec appel en un geste, numéros d'urgence

## Discussion de famille (v0.8.0)
Bouton flottant en bas à droite (v0.8.1 : suppression de ses messages, vidage de la discussion, notifications désactivables) : un fil unique partagé par tous les profils, en direct (texte, emojis, photos, partage d'un élément : courses, rendez-vous, tâches, mémo), avec pastille de messages non lus. Les messages sont stockés sur le NAS par `chat.php` (fichier `appfamille-chat.php` + dossier `appfamille-chat-img`, 500 derniers messages). Sans NAS, le bouton n'apparaît pas.

## Modules par appareil et navigation unifiée (v0.7.0)
- **Chaque parent choisit ses modules** : le choix est propre à l'appareil, les données restent partagées. Changer ses modules ne modifie jamais l'écran de l'autre parent.
- **Un nouvel appareil reprend la configuration de la famille** (dernière config publiée, clé partagée `modulesHint`) et affiche une alerte « Bienvenue ! » (Adapter / Garder).
- **Une seule barre du bas** dans toutes les éditions (Accueil, modules, « + » contextuel). Dans Bébé, les sous-pages (Journée, Repas, Parents, Sommeil) sont des onglets en haut.
- Correctif de synchro : une valeur vide d'un nouvel appareil n'écrase plus celle du NAS.

## Édition Premium (démo) : AppPre

La même application, servie depuis un dossier `apppre`, devient la **démo de la version Premium** (reconnue au dossier, aucun réglage) :
- **Accueil tableau de bord** : alertes classées par importance, prises de médicaments du jour (à cocher), prochains rendez-vous, bébé, budget du mois, courses (ajout direct), tâches à faire, menu du jour, prochain voyage, objectifs d'épargne, activité récente de la famille, mémo partagé, raccourcis, modules
- **Cases déplaçables, façon écran d'accueil de téléphone** : on **maintient un bloc appuyé** (ou « Organiser l'accueil »), tous les blocs frétillent, le bloc choisi se soulève et suit le doigt, les autres s'écartent en glissant, il se pose en rebondissant. Pastille rouge = masquer, pastille noire = taille (S demi-largeur, M, L). Flèches du clavier et vibrations légères prises en charge, animations coupées avec « Réduire les animations »
- **Apparence et personnalisation complète** (page `#/perso`) : 8 thèmes prêts à l'emploi, 7 couleurs principales, 5 fonds clairs et 5 fonds sombres, ambiances en dégradé, 6 polices, taille du texte, densité, arrondis, style des cartes, contraste élevé, animations réduites, nom et pastille de la famille, export / import de l'apparence
- **Modules renommables** (nom, icône, couleur) et **barre du bas configurable** (jusqu'à 4 modules, bouton « + » avec raccourcis au choix)
- Données : mêmes données du NAS que AppBébé / AppFamille (liaison automatique du `api.php`), réglages d'affichage propres à chaque appareil
- Stockage, cache hors-ligne, icône et nom d'application séparés : AppFamille et AppPre s'installent côte à côte

## Design

- Mode sombre par défaut la nuit (19 h – 8 h) avec des blancs chauds pour limiter la lumière bleue, mode clair le jour, bascule en un clic
- Couleurs : saumon (repas, alertes douces), vert sauge (croissance, validations), bleu ardoise (sommeil), gris perle (contenus)
- Actions principales dans la moitié basse de l'écran, utilisables d'une seule main

## Lancer en local

Aucune dépendance ni étape de build.

```bash
python -m http.server 5173
```

Puis ouvrir http://localhost:5173.

## Installer sur un NAS (partage entre parents)

Hébergée sur un serveur web avec PHP (ex. NAS QNAP / Synology), l'app synchronise automatiquement les données entre tous les téléphones grâce à `api.php`.

1. Activer le serveur web du NAS (QNAP : Panneau de configuration → Applications → Serveur Web).
2. Copier le dossier de l'app dans le partage `Web` (ex. `Web/appbebe`).
3. Ouvrir `http://IP-DU-NAS/appbebe/` sur chaque téléphone connecté au Wi-Fi de la maison.

Les données partagées sont stockées dans `appbebe-data.php` (créé automatiquement, non lisible depuis le navigateur). Les réglages propres à chaque téléphone (thème, « je suis », sons) restent locaux. Si deux personnes saisissent en même temps, les deux saisies sont conservées.

Si l'app indique « Le NAS ne peut pas écrire dans le dossier », donner les droits en écriture sur le dossier de l'app (l'utilisateur du serveur web QNAP est `httpdusr`).

Pour un accès hors de la maison, préférer un VPN (Tailscale, QVPN) plutôt que d'ouvrir des ports sur la box.

## Installer comme une appli sur Android (Chrome)

Chrome n'installe une vraie appli (icône dans le tiroir, plein écran, hors-ligne) que depuis une adresse sécurisée. Sur le NAS en `http://`, deux solutions :

- **Simple, sur chaque téléphone** : dans Chrome, ouvrir `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, passer le réglage sur « Enabled », saisir `http://IP-DU-NAS` (l'adresse exacte utilisée pour l'app), puis relancer Chrome. Ouvrir ensuite l'app, menu ⋮ → « Installer l'application ».
- **Propre** : mettre le NAS en HTTPS (Tailscale ou certificat Let's Encrypt). L'installation est alors proposée directement.

Sans l'une de ces deux options, « Ajouter à l'écran d'accueil » crée seulement un raccourci.

## Publier avec GitHub Pages

Settings → Pages → Deploy from a branch → `main` / `(root)`. Sans PHP, l'app fonctionne en mode local (pas de partage).

## Structure

```
index.html            Coquille de l'app et barre d'onglets
css/styles.css        Design system (tokens clair / sombre / nuit) et composants
js/app.js             Routeur, thème, rendu
js/store.js           État persistant (localStorage)
js/sync.js            Synchronisation via le NAS (fusion à trois voies)
api.php               API de synchronisation (côté NAS)
js/ui.js              Utilitaires, bottom sheets, toasts
js/audio.js           Moteur audio génératif (Web Audio)
js/profiles.js        Profils, onboarding, réglages, import / export
js/supplies.js        Calcul du stock (consommation tirée du journal)
js/health/            Prises de médicaments, fiche à partager
js/data/sante-calendrier.js  Calendrier vaccinal et dépistages (indicatif)
js/budget/            Calculs du budget, catégories, lecture de tickets (OCR), import / export CSV
js/vendor/tesseract/  Moteur de lecture de tickets embarqué (Tesseract.js, licence Apache 2.0)
js/edition.js         Détection de l'édition (dossier apppre = Premium)
js/premium/           Édition Premium : tableau de bord, apparence, navigation, actions rapides, alertes
js/pages/             Accueil, croissance, diversification, parents, sommeil, statistiques, stock et listes, agenda
js/data/foods.js      Catalogue d'aliments et recettes
sw.js                 Service worker (hors-ligne)
```

## Limites actuelles

- Sans NAS (GitHub Pages), les données restent sur chaque téléphone : utiliser Exporter / Importer pour les transférer.
- L'API du NAS n'a pas de mot de passe : elle est prévue pour le réseau de la maison.
- Le partage de tâche passe par le partage natif du téléphone (SMS, WhatsApp…), pas par une notification push.
- Les repères de croissance et conseils sont indicatifs et ne remplacent pas un avis médical.
