# TAGGO MVP

## Description

TAGGO permet à un propriétaire de gérer ses QR codes de vêtements connectés et la destination publique associée à chaque code.

## Stack

- React 19, TypeScript, Vite et React Router
- Supabase Auth et PostgreSQL avec RLS en production
- Vitest et Testing Library
- Mode local de démonstration sans backend configuré

## Installation

```bash
npm install
cp .env.example .env.local
```

## Variables d'environnement

Le mode production nécessite :

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

La clé utilisée est exclusivement la clé publique anon Supabase. Ne jamais exposer une clé service role.

## Développement

```bash
npm run dev
```

Sans variables Supabase, l'application démarre en mode démo local. Ce mode ne doit pas être utilisé pour de vrais comptes : les données sont stockées dans `localStorage`.

## Production

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

Avant le déploiement, exécuter [supabase/schema.sql](supabase/schema.sql) dans le projet Supabase et configurer les deux variables d'environnement.

## Architecture

`src/app` contient le routage, `src/context` la session, `src/features/auth` et `src/features/qr` les repositories, et `src/pages` les écrans MVP. Le repository choisi dépend de la configuration : Supabase en environnement configuré, local uniquement en démo.

## Routes principales

- `/` : redirection vers `/login` ou `/dashboard`
- `/login`, `/register` : authentification
- `/dashboard`, `/dashboard/settings`, `/dashboard/qr/new`, `/dashboard/qr/:qrId` : espace privé
- `/t/:tag` : page QR publique
- `/qr/:publicId` : compatibilité avec les anciens QR
- `*` : page 404

## Fonctionnement QR

Un QR public utilise un identifiant `TGG-XXXXXXX`. Seuls les QR `active`, avec destination HTTPS/HTTP valide et publication activée, sont résolus publiquement. La destination est ouverte dans un nouvel onglet ; les codes inexistants, inactifs ou mal configurés affichent un état propre.

## Sécurité

- Authentification Supabase et sessions persistantes en production
- RLS sur les profils, QR codes et abonnements
- Contrôle propriétaire sur chaque lecture, modification et suppression
- Validation URL limitée aux schémas `http:` et `https:`
- Aucune valeur secrète dans le frontend ou le repository
- Pages privées marquées `noindex`

## Déploiement

Déployer le contenu de `dist` sur un hébergeur statique configuré pour servir `index.html` comme fallback SPA. Les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` doivent être définies au moment du build. Activer HTTPS et les headers de sécurité chez l'hébergeur.

## Limitations connues

- Le mode local est une démonstration uniquement et ne fournit pas une sécurité serveur.
- La génération d'image QR imprimable et la réinitialisation de mot de passe ne font pas partie de ce MVP.
- Le bundle inclut encore Three.js et dépasse le seuil de warning Vite ; cela n'empêche pas le fonctionnement du MVP.
