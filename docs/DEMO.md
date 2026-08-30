# TAGGO — Guide de Test et Démonstration

## Vue d'ensemble

TAGGO est maintenant opérationnel en mode **démo autonome** — l'application fonctionne complètement sans dépendre d'une configuration Supabase réelle. Cela vous permet de :

- ✅ Tester tout le flux utilisateur (login, dashboard, créer/modifier QR)
- ✅ Stocker les données localement dans le navigateur
- ✅ Accéder aux pages publiques QR
- ✅ Développer/déboguer sans backend configuré

---

## Comptes de Démonstration

Deux comptes de démonstration sont pré-créés et disponibles immédiatement :

### Compte 1 : Démo Standard
```
Email:    demo@taggo.local
Password: DemoPass123!
```

### Compte 2 : Compte Test
```
Email:    test@taggo.local
Password: TestPass123!
```

### Utilisation

1. Allez à la page de **Connexion** (`/login`)
2. Cliquez sur le bouton du compte démo que vous souhaitez utiliser
3. Vous serez automatiquement connecté et redirigé vers le **Dashboard**

---

## Créer un Nouveau Compte

Vous pouvez aussi créer vos propres comptes de test :

1. Cliquez sur **"Créer un compte"** sur la page de connexion
2. Remplissez le formulaire avec :
   - Un email valide (ex : `test@example.com`)
   - Un mot de passe fort (ex : `MySecurePass123!`)
   - Un nom complet
3. Votre compte sera créé et vous serez automatiquement connecté

---

## Fonctionnalités Disponibles

### Tableau de Bord (`/dashboard`)
- Affichage des QR codes existants
- Compteur de QR codes actifs
- Bouton pour créer un nouveau QR
- Accès rapide à chaque QR pour le modifier
- Bouton de déconnexion

### Créer un QR (`/dashboard/qr/new`)
- Formulaire pour créer un nouveau QR code
- Champs :
  - **Nom du QR** : titre descriptif
  - **Destination publique** : URL valide (ex : `https://example.com`)
  - Auto-génération d'un identifiant public unique (format : `TGG-XXXXXXX`)
- Sauvegarde automatique dans le stockage local

### Modifier un QR (`/dashboard/qr/:qrId`)
- Changer le nom du QR
- Mettre à jour la destination
- Modifier le statut (draft, active, inactive, archived)
- Les modifications sont sauvegardées immédiatement

### Accès Public (`/qr/:publicId`)
- Consultable sans authentification
- Affiche le nom et la destination du QR
- Bouton pour accéder à la destination
- Les identifiants privés (ID interne) ne sont jamais exposés

---

## Stockage des Données

### Authentification
- Sessions utilisateur stockées localement dans `localStorage`
- Pas de persistence à travers les navigation browser history, mais fonctionne dans la même session

### QR Codes
- Tous les QR sont stockés dans `localStorage` sous la clé `taggo-demo-qrs`
- Les données persistent après rechargement de la page
- Chaque QR contient :
  - `id` : identifiant interne unique
  - `publicId` : identifiant public non-énumérable
  - `title` : nom du QR
  - `destinationUrl` : URL de destination
  - `status` : état (draft, active, inactive, archived)
  - `createdAt` : timestamp de création

### Utilisateurs
- Stockage local des comptes utilisateur (avec mot de passes)
- Données séparées des QR codes
- Les comptes de démonstration sont automatiquement créés au premier accès

---

## Flux Complet d'Utilisation

### 1. Premier accès
```
1. Visitez l'app → Redirection vers /login
2. Cliquez sur "Compte démo" → Connexion automatique
3. Vous arrivez sur le Dashboard avec les QR codes existants
```

### 2. Créer un nouveau QR
```
1. Cliquez sur "Créer un QR" → Navigation vers /dashboard/qr/new
2. Remplissez le formulaire (Nom + Destination)
3. Cliquez "Créer le QR" → Redirection vers la page d'édition
4. Votre QR est maintenant visible dans le Dashboard
```

### 3. Modifier ou Supprimer un QR existant
```
1. Dans le Dashboard, cliquez "Ouvrir" sur un QR
2. Modifiez les champs (Nom, Destination, Statut)
3. Cliquez "Enregistrer" → Retour au Dashboard
4. Ou : Cliquez "Supprimer" → Confirmation → QR supprimé
5. Les modifications sont immédiatement sauvegardées
```

### 3b. Copier le lien public d'un QR
```
1. Dans le Dashboard, vous voyez le lien public pour chaque QR
2. Cliquez sur le bouton "Copier le lien"
3. Le lien est copié dans le presse-papiers
4. Vous pouvez le partager directement
```

### 3c. Filtrer par statut
```
1. Dans le Dashboard, trouvez le dropdown "Filtrer par"
2. Sélectionnez une option :
   - "Tous" : Affiche tous les QR codes
   - "Actifs" : Seulement ceux avec statut "active"
   - "Brouillon" : Statut "draft"
   - "Inactifs" : Statut "inactive"
   - "Archivés" : Statut "archived"
3. La liste se met à jour instantanément
```

### 4. Accéder à un QR public
```
1. Visitez directement : /qr/<publicId>
2. (Exemple : /qr/TGG-8K9L2R)
3. Vous voyez les infos publiques du QR
4. Aucune authentification requise
```

### 5. Se déconnecter
```
1. Cliquez sur "Déconnexion" dans la barre latérale
2. Session supprimée, retour à /login
3. Les données (QR codes) restent intactes
```

---

## ✨ Fonctionnalités Nouvelles (v1.1.0)

### Suppression avec Confirmation
- Bouton "Supprimer" visible dans la page d'édition d'un QR
- Affiche un dialog de confirmation avant suppression
- Retour automatique au Dashboard après suppression
- Fonction sécurisée: pas de suppression accidentelle

### Filtrage par Statut
- Dropdown dans le Dashboard pour filtrer les QR codes
- Options: Tous, Actifs, Brouillon, Inactifs, Archivés
- Affiche le nombre total et les stats filtrées

### Liens Publics Copiables
- Chaque QR affiche son lien public (format: `/qr/TGG-XXXXXXX`)
- Bouton "Copier le lien" pour partage rapide
- Feedback visuel quand le lien est copié
- Fonctionne sur tous les navigateurs modernes

### Page 404 Personnalisée
- Erreur "Page non trouvée" au lieu de redirection
- Lien pour retour au Dashboard
- URLs invalides → friendly error message

### Composant Alert Réutilisable
- Messages d'erreur sur pages publiques
- Notifications cohérentes et claires
- Gestion des cas "QR non trouvé" sur pages publiques

---

### Validations en Place

**Emails**
- Format valide requis (ex : `user@example.com`)
- Unicité maintenue localement

**Mots de Passe**
- Minimum 8 caractères
- Au moins 1 majuscule
- Au moins 1 chiffre
- Au moins 1 caractère spécial

**Noms de QR**
- Pas d'éléments HTML ou scripts
- Longueur raisonnable
- Caractères alphanumériques et accents autorisés

**URLs de Destination**
- Format URL valide
- Protocole requis (http/https)
- Longueur limitée pour éviter les abus

### Note Sécurité
⚠️ **Cette version de démonstration ne doit PAS être utilisée en production**. Les mots de passe sont stockés en texte clair dans localStorage. Quand Supabase sera configuré, la sécurité sera gérée par des standards de production (hachage, JWT, HTTPS, etc.).

---

## Migration vers Supabase

Quand vous êtes prêt pour un vrai backend :

1. **Créez un projet Supabase** sur https://supabase.com
2. **Obtenez vos clés** :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Créez un fichier `.env.local`** à la racine du projet :
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
4. **Déployez le schéma** en exécutant le SQL de `supabase/schema.sql` dans l'éditeur SQL Supabase
5. **Redémarrez l'app** (`npm run dev`)
6. L'application basculera automatiquement vers Supabase au lieu du stockage local

---

## Troubleshooting

### Les comptes de démo ne fonctionnent pas
→ Vérifiez que `localStorage` n'est pas désactivé dans votre navigateur

### Les données disparaissent après rechargement
→ Vérifiez que vous n'utilisez pas le mode "navigation privée" (incognito)

### Je veux réinitialiser toutes les données
→ Ouvrez les DevTools du navigateur et exécutez :
```javascript
localStorage.removeItem('taggo-demo-qrs')
localStorage.removeItem('taggo-demo-users')
localStorage.removeItem('taggo-demo-auth')
```

### Les erreurs de validation semblent incorrectes
→ Vérifiez que votre entrée respecte les règles (email format, mot de passe fort, URL valide)

---

## Développement & Débogage

### Variables d'environnement

```env
# Avec Supabase configuré
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Sans configuration, l'app utilise automatiquement localStorage
```

### Logs Utiles

L'application enregistre des messages de débogage quand :
- Auth restore échoue (fallback localStorage activé)
- Sign in/up avec Supabase échoue
- Transactions de données réussissent

Vérifiez la console du navigateur (F12 → Console) pour les détails.

### Tests

Exécutez les tests pour vérifier que tout fonctionne :
```bash
npm test -- --run
```

---

## Prochaines Étapes

Après cette phase démo, les priorités sont :

1. **Connexion Supabase réelle** avec vos clés de projet
2. **Persistance en base de données** pour les QR codes
3. **Authentification réelle** avec sessions JWT
4. **Sécurité accrue** avec RLS (Row-Level Security) Supabase
5. **Analytics & monitoring**

---

**Pour des questions ou des bugs, consultez la [DOCUMENTATION COMPLÈTE](./ARCHITECTURE.md) ou le fichier [STATUS.md](./STATUS.md).**
