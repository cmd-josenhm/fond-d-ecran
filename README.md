# 🚗 AutoWall Studio — fond d'écran auto

Une page d'accueil qui présente une voiture **sous 4 dimensions** (côté, face, arrière, dessus), la personnalise **entièrement** et la télécharge en **PNG aux résolutions Windows** (1920×1080, 2560×1440, 3840×2160).

100 % navigateur : la voiture est dessinée en **SVG paramétrique**, assemblée en canvas et exportée en PNG **localement** — aucun serveur, aucun compte, aucun tracker. Fonctionne même hors-ligne (double-clique sur `index.html`).

## Personnalisation

| Option | Choix |
| --- | --- |
| **Carrosserie** | Berline · Coupé · SUV · Break |
| **Couleur** | 10 teintes prénommées + color-picker libre |
| **Jantes** | Sport · Turbo · Classique · Aéro · Off-road |
| **Logo** | Volta (bouclier) · Aura (rond) · Nova (hexagone) · Kairos (pastille) · **Personnalisé** (1-2 lettres de ton choix) + matière du badge (chrome / noir / couleur carrosserie) |
| **Décor** | Aube urbaine · Nuit néon · Désert · Studio · Aurores boréales |
| **Texte** | Légende optionnelle (28 car. max) + répliquée sur la plaque d'immatriculation |
| **Résolution** | Full HD 1920×1080 · QHD 2560×1440 · 4K 3840×2160 |

Bonus : bouton **🎲 Surprise** (config aléatoire), **↺ Réinitialiser**, et **🔗 Partager** — la configuration complète est encodée dans l'URL (`#c=…`), un lien suffit pour retrouver (ou partager) une voiture identique.

## Démarrage

Aucune installation requise pour l'usage :

```bash
# option A : ouvrir directement la page (le site est 100 % statique)
open index.html          # ou double-clic sur le fichier

# option B : petit serveur local (zéro dépendance), port 3000
npm start
# → http://localhost:3000
```

### Tests

```bash
npm install     # installe les devDependencies (sharp, jsdom)
npm test        # 30 tests : moteur SVG, rasterisation PNG réelle (1080p & 4K),
                # DOM complet (chargement, clics, état, URL, export)

npm run samples # génère 4 fond d'écran PNG d'exemple dans /samples
```

| Suite | Vérifie |
| --- | --- |
| `tests/core.test.js` | couleurs, config (normalisation, encodage URL), les 4 carrosseries, 5 jantes, 4 logos, 5 décors déterministes, composition wallpaper (3 résolutions), échappement HTML, **validité XML stricte** de tous les SVG |
| `tests/png.test.js` | rasterisation réelle du wallpaper en **PNG 1920×1080 et 3840×2160** (sharp/libvips) + les 4 vues isolées |
| `tests/browser.test.js` | la vraie page dans jsdom : init, rendu, clics sur tous les contrôles, filtres de texte, synchro URL, export PNG bout en bout, surprise/reset, restauration de config depuis l'URL |

## Structure

```
index.html          page d'accueil (hero 4 vues + studio + FAQ)
css/styles.css      thème sombre, responsive, vanilla CSS
js/car-core.js      moteur de rendu UMD (voiture, jantes, logos, décors,
                    composition wallpaper) — partage navigateur/Node
js/app.js           application : état, rendu live, contrôles, export canvas
server.js           mini serveur statique sans dépendance (npm start)
tests/              suites de tests (node:test)
samples/            PNG d'exemple générés (npm run samples, gitignoré)
```

## Personnaliser l'export

La composition finale vit dans `wallpaperSVG()` (`js/car-core.js`) :
- placement de la voiture : `transform="translate(103 182) scale(1.45)"` ;
- légende : bloc `if (cfg.caption)` ;
- filigrane : `AUTO·WALL STUDIO` + nom du modèle (logo + carrosserie).

Les dimensions de la résolution ne changent que les attributs `width/height` du
`<svg>` (le `viewBox` 16:9 est invariant) → le PNG reste net à n'importe quelle taille.

## Licence

MIT — fait avec ❤ en SVG & JS.
