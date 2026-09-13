# TAGGO

## Description

TAGGO est une application de gestion de QR codes publics pour marques et collections. Le MVP permet de créer, éditer et suivre des codes TAGGO, de sécuriser l’accès côté dashboard, et d’afficher une page publique filtrée selon le statut du QR.

## Stack

- React 19 + TypeScript + Vite
- React Router 7 pour la navigation SPA
- Supabase Auth + PostgreSQL avec RLS
- Vitest + Testing Library pour les tests automatisés
- localStorage uniquement en mode démo hors production

## Installation locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Variables d’environnement

Le frontend attend au minimum :

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Aucune clé service role, secret, ou token privé ne doit être exposée dans le frontend. Seule la clé publique anon de Supabase est utilisée côté client.

## Développement

```bash
npm run dev
npm run typecheck
npm run test
npm run lint
npm run build
```

## Mode local démo

Sans variables Supabase configurées, l’application fonctionne en mode local demo. Ce mode ne doit pas être utilisé pour des comptes réels ni pour la production. Les données de test sont stockées dans localStorage et ne remplacent pas l’authentification Supabase.

## Base de données Supabase

Le schéma attendu est décrit dans [supabase/schema.sql](supabase/schema.sql). Il définit :

- les profils
- les QR codes publics
- les profils publics associés
- les abonnements
- les politiques RLS

## Routes principales

- / : redirection vers /login ou /dashboard
- /login et /register : accès public non authentifié
- /dashboard : espace privé
- /dashboard/settings : paramètres
- /dashboard/qr/new : création d’un QR
- /dashboard/qr/:qrId : édition d’un QR
- /t/:tag : page publique d’un QR actif
- /qr/:publicId : redirection de compatibilité vers la route canonique
- /404 : page non trouvée

## Fonctionnement QR

Un QR public utilise le format TGG-XXXXXXX. La route publique n’expose que les enregistrements actifs, publics, avec une destination HTTP ou HTTPS valide. Les QR inactifs, non publiés, ou sans destination valide affichent un état explicite au lieu de rediriger.

## Déploiement Vercel

Le projet est prêt pour un déploiement Vercel en SPA. Une configuration fallback est fournie dans [vercel.json](vercel.json) pour garantir que les routes React Router restent accessibles après rechargement direct.

Variables à définir dans Vercel :

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

## Sécurité

- Authentification gérée par Supabase
- Sessions persistées automatiquement
- validation des destinations limitées à http et https
- accès propriétaire vérifié côté frontend et côté base
- aucune donnée sensible exposée dans le bundle
- RLS conservé et non désactivé

## Limitations du MVP

- le paiement Stripe n’est pas encore implémenté
- la gestion avancée de profil n’est pas encore connectée à Supabase
- l’authentification de changement de mot de passe et la suppression de compte restent à brancher selon le workflow Supabase final
