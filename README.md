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

## Publier avec GitHub Pages

Settings → Pages → Deploy from a branch → `main` / `(root)`. L'app est ensuite installable depuis le navigateur du téléphone (« Ajouter à l'écran d'accueil »).

## Structure

```
index.html            Coquille de l'app et barre d'onglets
css/styles.css        Design system (tokens clair / sombre / nuit) et composants
js/app.js             Routeur, thème, rendu
js/store.js           État persistant (localStorage)
js/ui.js              Utilitaires, bottom sheets, toasts
js/audio.js           Moteur audio génératif (Web Audio)
js/profiles.js        Profils, onboarding, réglages, import / export
js/pages/             Accueil, croissance, diversification, parents, sommeil
js/data/foods.js      Catalogue d'aliments et recettes
sw.js                 Service worker (hors-ligne)
```

## Limites actuelles

- Les données sont locales à chaque téléphone. Pour partager entre parents, utiliser Exporter / Importer dans « Profils & réglages ». Une vraie synchronisation demanderait un backend.
- Le partage de tâche passe par le partage natif du téléphone (SMS, WhatsApp…), pas par une notification push.
- Les repères de croissance et conseils sont indicatifs et ne remplacent pas un avis médical.
