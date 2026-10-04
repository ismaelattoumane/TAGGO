# TAGGO — Emails transactionnels (étape 10)

> Ce document ne concerne **que** les emails transactionnels TAGGO (commandes,
> livraison). Les emails d'authentification sont envoyés par **Supabase Auth** et
> sont documentés séparément dans [`docs/supabase-auth-emails.md`](./supabase-auth-emails.md).
> Les deux systèmes sont indépendants : aucun code, template ou table en commun.

## Principes

- **Aucun email n'est déclenché depuis le navigateur.** Le rendu, la
  déduplication et l'envoi se font côté serveur (`/api`, jamais `VITE_*`).
- **Aucun email ne part deux fois pour un même événement.** Chaque envoi passe
  par une réservation atomique d'une clé d'idempotence en base.
- **Aucun secret dans les templates.** Les templates ne contiennent que du texte
  et des données déjà échappées.
- **Aucun prestataire n'est installé par défaut.** L'envoi est désactivé tant que
  TAGGO n'a pas validé son provider transactionnel.

## Arborescence

| Fichier | Rôle |
| --- | --- |
| `src/emails/emailTypes.ts` | Types (`EmailType`, `EmailTemplateData`, `EmailProvider`) |
| `src/emails/escape.ts` | Échappement HTML et validation des URL d'email |
| `src/emails/components/layout.ts` | Gabarit commun HTML + texte brut |
| `src/emails/templates/*.ts` | Un template par email |
| `src/emails/index.ts` | `renderEmail()` et clé d'idempotence |
| `src/emails/provider.ts` | Interface provider + provider désactivé + provider mémoire |
| `api/_lib/emailTriggers.ts` | Événement métier → job d'email |
| `api/_lib/emailDispatch.ts` | Envoi idempotent (réservation de clé avant envoi) |
| `api/_lib/emailServer.ts` | Journal `email_events` (service_role) |
| `api/_lib/emailProvider.ts` | Fabrique de provider côté serveur |
| `api/_lib/orderEmailContext.ts` | Lecture serveur des données d'une commande |

## Types d'emails

| Type | Objet | Déclencheur |
| --- | --- | --- |
| `ORDER_CONFIRMED` | Confirmation de commande | Webhook Stripe `checkout.session.completed`, uniquement quand la commande vient de passer à `paid` |
| `ORDER_SHIPPED` | Expédition | Événement d'expédition (à brancher quand le suivi de commande existera) |
| `ORDER_DELIVERED` | Livraison | Événement de livraison (idem) |
| `REVIEW_REQUEST` | Demande d'avis | plusieurs jours après la livraison confirmée (idem) |
| `CART_ABANDONED` | Panier abandonné | Job planifié (idem) |
| `WELCOME` | Bienvenue | Création de compte confirmée (idem) |
| `PASSWORD_RESET` | Réinitialisation de mot de passe | Demande de reset confirmée (idem) |

Uniquement `ORDER_CONFIRMED` est branché à un événement réel à ce jour. Les six
autres templates sont prêts, testés et documentés, mais **ne sont déclenchés par
aucun événement** : le modèle de données ne contient pas encore les états
`shipped` / `delivered`, ni de planificateur de jobs.

> En l'état, Supabase Auth émet lui-même les emails de confirmation de compte et
> de réinitialisation de mot de passe. Les templates TAGGO correspondants
> (`WELCOME`, `PASSWORD_RESET`) ne les remplacent pas tant que ce choix n'est pas
> arbitré ; ils sont prêts pour ce jour-là.

## Données envoyées

Chaque email ne contient que le strict nécessaire :

- prénom ;
- référence et identifiant de commande ;
- lignes de commande (modèle, variante, quantité, montant fourni par le serveur) ;
- total (calculé et formaté côté serveur — jamais recalculé dans un template) ;
- URL du dashboard construite à partir de `APP_URL`.

**Ne sont jamais envoyés** : mot de passe, hash de mot de passe, données de carte
bancaire, clé Stripe, clé de service, jeton d'authentification en clair.

## Idempotence

Clé : `<EMAIL_TYPE>:<référence métier normalisée>`
(ex. `ORDER_CONFIRMED:3f1a2b4c-0000-4000-8000-000000000000`).

1. `begin_email_event` insère la ligne dans `email_events` avec
   `on conflict (dedupe_key) do nothing` et une contrainte `UNIQUE`.
2. `true` = premier traitement → rendu puis envoi.
3. `false` = déjà traité → retour immédiat `duplicate`, **aucun appel réseau**.

Un webhook Stripe rejoué, ou deux exécutions concurrentes du même job, ne
produisent donc qu'un seul email. La table ne stocke pas l'adresse en clair :
seule son empreinte SHA-256 et sa longueur sont conservées.

## Brancher un provider transactionnel

1. Ajouter les variables **serveur** (jamais `VITE_`) :

   ```env
   EMAIL_PROVIDER_NAME=<nom-implementé>
   EMAIL_PROVIDER_API_KEY=<secret>
   ```

2. Implémenter `EmailProvider` dans `api/_lib/emailProvider.ts` :

   ```ts
   export function createEmailProvider(env = readServerEnv()): EmailProvider {
     if (env.emailProviderName !== 'mon-prestataire') {
       return new DisabledEmailProvider()
     }
     return new MonPrestataireProvider({
       apiKey: env.emailProviderApiKey!,
     })
   }
   ```

3. Étendre `ServerEnv` et `readServerEnv()` dans `api/_lib/env.ts` pour exposer la nouvelle variable.

4. Vérifier :
   - `npm test` (le provider mémoire est utilisé par les tests) ;
   - qu'aucune clé n'apparaît dans le bundle navigateur.

Tant que `EMAIL_PROVIDER_NAME` est vide, `DisabledEmailProvider` est utilisé :
aucun message n'est émis et les emails sont journalisés en `skipped`.

## Marketing vs transactionnel

- **Transactionnels** (base légale : exécution du contrat) : `ORDER_CONFIRMED`,
  `ORDER_SHIPPED`, `ORDER_DELIVERED`, `REVIEW_REQUEST`, `CART_ABANDONED`,
  `WELCOME`, `PASSWORD_RESET`. Ils sont liés au service et ne sont pas de la
  prospection.
- **Marketing / prospection** : aucun. TAGGO ne pratique aucune prospection
  commerciale sans consentement distinct. Si une campagne est créée, elle doit
  être gérée hors de ce module, avec consentement révocable, et documentée dans
  la politique de confidentialité.

## Ce qui reste à faire avant commercialisation

- [ ] Choisir et configurer le provider transactionnel.
- [ ] Brancher les événements `ORDER_SHIPPED`, `ORDER_DELIVERED`,
      `REVIEW_REQUEST`, `CART_ABANDONED`, `WELCOME`, `PASSWORD_RESET`.
- [ ] Configurer SPF / DKIM / DMARC du domaine d'envoi.
- [ ] Vérifier que `APP_URL` correspond au domaine de production (les liens des
      emails en dépendent).
- [ ] Décider si TAGGO prend en charge la réinitialisation de mot de passe
      (aujourd'hui gérée par Supabase Auth) pour éviter deux emails concurrents.