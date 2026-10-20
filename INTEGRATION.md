# TAGGO — landing exportable (hero 3D + sections empilées)

Package pensé pour votre dépôt (React 19, R3F 9, drei 10, three, Vite, vitest, oxlint). Il **n'ajoute aucune dépendance**.

## 1. Installer

1. Copiez `src/` et `public/` à la racine du dépôt (les chemins sont déjà ceux du dépôt).
   - Remplacés : `src/features/landing/LandingPage.tsx`, `src/features/landing/FaqSection.tsx`.
   - Nouveaux : `experience/`, `intro/`, `StackedSections.*`, `useStackedSections.ts`, `ProductSection.*`, `LandingStructuredData.tsx`, `landingStructuredData.ts`, `landingFaqItems.ts` (la FAQ a été déplacée tel quel hors de `FaqSection.tsx`, pour être réutilisée par les données structurées).
   - Assets : `public/landing/product-front.png`, `product-back.png` (découpés dans la texture du GLB).
2. Remplacez `index.html` et `public/robots.txt` par `patches/index.html` et `patches/robots.txt`
   (titre, description, Open Graph, JSON-LD, canonical `https://taggo.space/`, ligne `Sitemap`). La balise Google Analytics est conservée telle quelle.
3. Sur Vercel : `APP_URL=https://taggo.space` (sinon `/sitemap.xml` répond 404).
4. Lancez : `npm run typecheck && npm run lint && npm test && npm run build`.

Rien n'est supprimé. Les anciens fichiers `landing/story/*`, `Hero.*`, `heroContent.ts` ne sont plus utilisés par la landing,
mais `features/three/ShirtModel.tsx` importe encore `storyTimeline` : ne les retirez qu'avec ce module.

## 2. Architecture

| Fichier | Rôle |
|---|---|
| `experience/experienceTimeline.ts` | **Source unique** : keyframes caméra, côté du T-shirt, fenêtres de texte, scan, overlay. Fonctions pures, testées. |
| `experience/useScrollProgress.ts` | Progression lissée 0→1 + abonnements (aucun rendu si l'écran est immobile). |
| `experience/ExperienceCanvas.tsx` | R3F `frameloop="demand"` : T-shirt, caméra, projection du QR pour le viseur. |
| `experience/overlayDom.ts` | Écritures DOM impératives (pas de `setState` par frame). |
| `experience/StoryExperience.tsx/.css` | Section hero (3 modes : `full`, `still` = reduced motion, `static` = sans WebGL). |
| `experience/experienceContent.ts` | Tous les textes et données d'exemple, modifiables. |
| `useStackedSections.ts` | Sections sticky empilées + **correction des ancres** (`#concept`, etc.). |
| `intro/LogoIntro.tsx` | Écran de chargement avec le logomark animé. |
| `landingStructuredData.ts` | Organization, WebSite, WebPage, FAQPage (pur, testé). |

Réglages courants : textes → `experienceContent.ts` · rythme → `experienceTimeline.ts` · si le GLB change, ajustez `QR_LOCAL` / `QR_HALF_WIDTH`.

## 3. Ce qui a été vérifié (et ce qui ne l'a pas été)

- Contrôle de types avec les options exactes de votre `tsconfig.app.json` (TypeScript 6.0.3) : 0 erreur dans les fichiers livrés.
  Les paquets `react`, `three`, `@react-three/*` y étaient remplacés par des déclarations minimales (pas de `npm install` possible dans mon environnement).
- 15 tests unitaires (timeline + données structurées) : tous passent (exécutés avec un mini-substitut de vitest).
- **Non vérifié** : `npm run build`, `oxlint`, rendu réel dans un navigateur, WebGL sur mobile. À contrôler chez vous.

## 4. À regarder en premier dans le navigateur

1. **Viseur de scan** : il suit le QR projeté à l'écran ; s'il est décalé, c'est `QR_LOCAL` / `QR_HALF_WIDTH`.
2. **En-tête crème au-dessus du hero sombre** : le hero se colle sous l'en-tête existant (`.taggo-landing-header`). Si vous préférez un en-tête sombre sur le hero, c'est une variante CSS de `LandingHeader`.
3. **Fond des sections existantes** : celles dont le fond est transparent reçoivent `--taggo-background` pour pouvoir s'empiler ; vérifiez `FinalCtaSection` et `DashboardPreviewSection`.
4. **Ancres** : le menu d'en-tête et les boutons du hero (`#how-it-works`) passent par le hook ; testez-les sur mobile.

## 4 bis. Hors périmètre, à décider

- Image Open Graph dédiée (1200×630) : l'export utilise `android-chrome-512x512.png`.
- Analytics : `index.html` charge Google Analytics dès l'ouverture ; vérifiez qu'il respecte le consentement cookies.
- Compression du maillage du GLB (Meshopt / Draco) : le gain est surtout là (740 Ko dont 147 Ko de texture).

## 5. Synchronisation du contenu avec la landing validée (ajout)

Les sections existantes ont été alignées sur la maquette publiée :

| Section | Avant (dépôt) | Après |
|---|---|---|
| Personnalisation | « Ton TAGGO, à ton image. » · aperçu profil « Alex » | « Ton QR. Tes règles. » · mention « avec le même T-shirt » · bouton « Découvrir le fonctionnement » · carte « Où mène ton QR ? » |
| Tableau de bord | « Un espace tout compris. » · maquette avec « Premium », « Clicks », `taggo.fr/…`, 2e TAGGO « Brouillon » | « Tout contrôler depuis un seul endroit. » · carte limitée aux données définies : TAGGO ID, destination, scans, statut |
| Concept | schéma en émojis (QR → 👕 → profil) | le vrai QR du T-shirt + « Scan → Profil TAGGO » |
| CTA final | un seul bouton | « Créer mon TAGGO » + « Découvrir TAGGO » |

Nouveau : `PhoneCard.tsx/.css` (carte partagée, mêmes données que le hero via `experienceContent.ts`).
Les classes CSS des anciens aperçus (`taggo-custom-preview*`, `taggo-dash-preview*`, `taggo-concept-visual*`) ne sont plus utilisées : supprimez-les de leurs fichiers `.css` quand vous voulez.
