# TAGGO — Déploiement

## Cibles retenues

- **Vercel** est la cible principale pour la SPA TAGGO.
- **GitHub Pages** est conservé temporairement comme cible de secours. Son workflow existant n'est pas modifié par cette étape.
- Supabase utilise un projet distinct pour le staging et la production.

## Environnements

### Développement local

Le développement local utilise Vite :

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sans variables Supabase, l'application reste en mode démo local. Ce mode utilise `localStorage` et ne doit pas servir à des comptes réels.

Pour tester Supabase localement ou le staging, renseigner dans `.env.local` :

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Les fichiers `.env.local` et autres fichiers `.env*` contenant des valeurs réelles ne doivent jamais être commités.

### Supabase staging

Le staging doit être un projet Supabase séparé de la production. Il sert à tester les migrations et l'application avant publication.

La migration initiale versionnée se trouve dans `supabase/migrations/`. Elle reprend le schéma actuel sans modification fonctionnelle.

Le déploiement du schéma vers un projet staging doit être réalisé explicitement avec la Supabase CLI ou le mécanisme de migration approuvé par l'équipe. Cette étape ne déploie aucune ressource distante automatiquement.

### Supabase production

La production doit utiliser un projet Supabase distinct du staging. Les données et les clés des deux projets ne doivent pas être mélangées.

Les migrations doivent d'abord être validées en staging, puis appliquées explicitement en production.

## Vercel

### Vercel Preview / staging

Les déploiements Preview Vercel doivent utiliser les variables du projet Supabase staging :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Dans Vercel : **Project Settings → Environment Variables**, sélectionner l'environnement **Preview**.

### Vercel Production

Le déploiement Production Vercel doit utiliser les variables du projet Supabase production. Dans Vercel, sélectionner l'environnement **Production** pour ces variables.

Aucune clé `service_role`, aucun mot de passe, token privé ou secret serveur ne doit être défini avec le préfixe `VITE_`. Les variables `VITE_*` sont intégrées au bundle navigateur.

La configuration SPA actuelle de `vercel.json` redirige les routes vers `index.html`. Elle est compatible avec React Router et `base: '/'` ; elle n'est pas modifiée dans cette étape.

## Build et vérifications

Avant un déploiement :

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
```

La commande de build produit le dossier `dist/` :

```bash
npm run build
```

Vercel peut ensuite utiliser le script `npm run build` et publier `dist/` selon sa configuration de projet.

## Déploiement

1. Valider les changements et les tests en local.
2. Vérifier que les variables Preview pointent vers Supabase staging.
3. Pousser la branche et vérifier le déploiement Preview Vercel.
4. Tester les routes SPA et les fonctionnalités prévues sur Preview.
5. Promouvoir explicitement la version validée vers Vercel Production.
6. Vérifier que les variables Production pointent vers Supabase production.

Aucun déploiement n'est déclenché par ce document.

## Rollback

En cas de problème applicatif :

1. Identifier le déploiement Vercel Production concerné.
2. Revenir au déploiement précédent validé depuis l'historique Vercel.
3. Vérifier les routes publiques et privées.
4. Vérifier la compatibilité avec le schéma Supabase déjà déployé.
5. Corriger la branche et reproduire la validation en Preview avant une nouvelle promotion.

Une migration de base déjà appliquée ne doit pas être annulée par une simple réversion frontend. Toute migration corrective doit être versionnée séparément et testée en staging.

## Secrets et fichiers ignorés

- Seules l'URL Supabase et la clé publique `anon` sont utilisées côté frontend.
- Une clé `service_role` reste exclusivement côté serveur ou dans les secrets d'un environnement backend autorisé.
- Les fichiers `.env*` sont ignorés par Git, à l'exception de `.env.example`.
- Ne jamais placer de secret dans le code source, dans `public/`, dans `VITE_*` ou dans un commit.
- En cas de fuite, révoquer immédiatement la clé concernée et vérifier l'historique Git.
