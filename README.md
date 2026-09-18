# Shorts Blocker

Extension Chrome (Manifest V3) qui limite le temps passé sur YouTube Shorts et Instagram à 15 minutes par jour.

## Ce que ça fait

- Compte le temps actif sur YouTube Shorts (`/shorts/...`) et sur Instagram
- Bloque l'accès après 15 minutes avec un overlay plein écran
- L'overlay propose des alternatives selon l'état émotionnel du moment :
  - **Très fatiguée** → films (Arte, France TV, Netflix), sieste, fermer les yeux
  - **Pensées en boucle** → cohérence cardiaque, débunker avec ChatGPT, appeler une amie
  - **Ennui** → articles CNRS, livre, activité manuelle, promener Vishou, calepin, dessiner...
- Compteur en temps réel dans le popup de l'extension
- Reset automatique à minuit

## Installation

1. Ouvrir Chrome → `chrome://extensions`
2. Activer le **mode développeur** (en haut à droite)
3. Cliquer **Charger l'extension non empaquetée**
4. Sélectionner le dossier `shorts-blocker`

## Fonctionnement technique

- **content.js** : s'injecte sur youtube.com et instagram.com, détecte la navigation SPA via polling d'URL (500ms) + événements `yt-navigate-finish`
- **popup.js** : lit les compteurs dans `chrome.storage.local` et rafraîchit chaque seconde
- `localStorage` est la source de vérité pour le contenu script (chrome.storage n'est pas toujours disponible dans ce contexte)
- Les vidéos sont mise en pause et coupées au son au moment du blocage

## Structure

```
shorts-blocker/
├── manifest.json
├── content.js     # logique de timing + overlay de blocage
├── popup.html     # interface du popup
└── popup.js       # affichage des compteurs
```
