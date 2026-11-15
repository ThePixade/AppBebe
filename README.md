# AppBébé

Le carnet de bord des jeunes parents : suivi quotidien de bébé, diversification alimentaire, espace parents et sons apaisants.
Application web progressive (PWA) installable sur téléphone, **sans serveur ni compte** : toutes les données restent sur l'appareil.

## Fonctionnalités

**Accueil & Suivi**
- Profils multiples (jumeaux, fratrie) avec photo, prénom et âge
- Tétée avec chronomètre gauche / droite et côté conseillé, biberon avec pavé numérique
- Couches en 2 touches (mouillée, sale, mixte) avec couleur et texture des selles, et alertes (selles décolorées, sang)
- Chronomètre de sommeil, courbes de poids et de taille avec repères OMS
- Bouton « + » central : note, vaccin, médicament, température, sieste passée, mesure
- Fil de la journée et bannière de la dernière action du co-parent ou de la nounou
- Tout est modifiable après coup (heure, quantité, durée…), avec historique jour par jour
- Statistiques sur 7, 14 ou 30 jours : moyennes par jour, graphiques repas / couches / sommeil, rythme sur 24 h
- Stock de couches et de lait infantile décompté automatiquement depuis le journal (en ml pour le lait), prévision en jours restants et alerte « stock bas »
- Profil d'alimentation (allaitement, biberon, mixte) : l'app ne propose que ce qui vous concerne (pas de lait infantile ni de choix du lait si bébé est allaité), et les listes s'adaptent
- Listes partagées : courses, voyage, sac à langer, valise maternité (modèles prêts à l'emploi qui se règlent avec quelques questions : « de quoi faire dormir bébé sur place ? » retire le lit parapluie), avec ajout en un clic depuis le stock ; chaque article indique qui l'a ajouté et qui l'a coché
- Agenda commun (rendez-vous, départs en vacances, fêtes) : vue mensuelle, événements sur plusieurs jours, qui l'a ajouté, prochain événement sur l'accueil

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
- Veilleuse plein écran à lueur chaude réglable

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
js/pages/             Accueil, croissance, diversification, parents, sommeil, statistiques, stock et listes, agenda
js/data/foods.js      Catalogue d'aliments et recettes
sw.js                 Service worker (hors-ligne)
```

## Limites actuelles

- Sans NAS (GitHub Pages), les données restent sur chaque téléphone : utiliser Exporter / Importer pour les transférer.
- L'API du NAS n'a pas de mot de passe : elle est prévue pour le réseau de la maison.
- Le partage de tâche passe par le partage natif du téléphone (SMS, WhatsApp…), pas par une notification push.
- Les repères de croissance et conseils sont indicatifs et ne remplacent pas un avis médical.
