# TAGGO — Architecture actuelle du MVP

## État du projet

TAGGO est une application React + TypeScript en phase **production-ready demo** (v1.1.0) avec authentification complète (dual-layer: Supabase + localStorage), gestion des QR codes (CRUD complet), et pages publiques accessibles. L'architecture supporte une migration fluide vers un vrai backend Supabase.

## Stack Technique

- **React 19** + TypeScript + Vite (production build 513KB)
- **React Router DOM** pour navigation et routes protégées
- **React Context API** pour gestion d'état d'authentification
- **localStorage** pour persistance démo (remplacé par Supabase en production)
- **Vitest** + Testing Library + jsdom (8/8 tests passing)
- **Supabase** (optionnel - détection automatique, fallback localStorage)

## Structure Réelle du Projet (v1.1.0)

```
src/
  app/
    router.tsx              # 8 routes avec ProtectedRoute
  components/
    ProtectedRoute.tsx      # Guard pour routes authentifiées
    CopyButton.tsx          # Bouton clipboard réutilisable
    Alert.tsx               # Notifications (4 types)
  context/
    AuthContext.tsx         # Dual-layer auth (Supabase + localStorage)
  lib/
    demoAuth.ts             # Authentification locale (fallback)
    demoData.ts             # Gestion CRUD QR codes (localStorage)
    validators.ts           # Email, password, URL, text validators
  pages/
    LoginPage.tsx           # Login + demo quick-buttons
    RegisterPage.tsx        # Signup avec validation
    DashboardPage.tsx       # QR list + filtering + copy
    CreateQrPage.tsx        # Création QR
    QrDetailPage.tsx        # Edit/Delete avec confirmation
    PublicQrPage.tsx        # Public (sans auth)
    SettingsPage.tsx        # Stub
    NotFoundPage.tsx        # Page 404 personnalisée
  types/
    index.ts                # TypeScript types
  main.tsx                  # Entry point
```

## Flux Utilisateur

### Public (sans authentification)

```
1. Visiteur accède /qr/:publicId (ex: /qr/TGG-8K9L2R)
2. App résout l'identifiant public depuis localStorage
3. Récupère les données publiques du QR
4. Affiche: titre, destination, lien d'accès
5. Aucune session/authentification requise
6. Si QR n'existe pas: Alert error + lien retour
```

### Privé (avec authentification)

```
1. Utilisateur accède /login
2. Sélectionne compte démo OU crée compte
3. Authentification (localStorage ou Supabase)
4. Redirection /dashboard (ProtectedRoute)
5. Dashboard affiche:
   - QR codes de l'utilisateur
   - Filtre par statut
   - Liens publics copiables
   - Stats
6. Actions: Créer, Éditer, Supprimer, Copier, Filtrer
7. Déconnexion (bouton sidebar)
```

## Système d'Authentification Dual-Layer

### Architecture

```
AuthContext.tsx:
├── Détecte VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
├── Si présentes → Utilise Supabase Auth
└── Si absentes → Bascule localStorage + comptes pré-créés
```

### Comptes Pré-Créés (Mode Démo)

```
demo@taggo.local / DemoPass123!
test@taggo.local  / TestPass123!
```

## Modèle de Données (localStorage)

### Users

```typescript
interface User {
  id: string              // UUID v4
  email: string           // Unique
  password: string        // Hashed en production
  full_name: string       // Nom complet
  created_at: number      // Timestamp
}
```

### QR Codes

```typescript
interface QrCode {
  id: string              // Identifiant privé (UUID)
  publicId: string        // Public ID (TGG-XXXXXXX)
  title: string           // Titre du QR
  destinationUrl: string  // URL destination
  status: string          // draft | active | inactive | archived
  ownerId?: string        // (Futur Supabase)
  createdAt: number       // Timestamp
  updatedAt: number       // Timestamp
}
```

## Validation & Sécurité (v1.1.0)

### Validations Côté Client

**Emails**
- Format valide: `user@example.com`
- Unicité maintenue localement

**Mots de Passe**
- Min 8 caractères
- Au moins 1 majuscule
- Au moins 1 chiffre
- Au moins 1 caractère spécial

**Contenus QR**
- Pas d'éléments HTML/scripts
- Sanitization: `<` → `&lt;`, etc.

**URLs**
- Format valide http/https
- Protocole requis

### Sécurité Publique

- ❌ ID internes JAMAIS en URLs publiques
- ✅ Public IDs non-énumérables (TGG-XXXXXXX)
- ✅ Routes protégées via ProtectedRoute
- ✅ Unauthorised → redirect /login

### Production (Supabase-ready)

- ✅ RLS policies prêtes (supabase/schema.sql)
- ✅ `owner_id` pour isolement utilisateurs
- ✅ Supports HTTPS + JWT

## Composants Réutilisables (v1.1.0)

### ProtectedRoute
```typescript
// Guard pour routes authentifiées
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>
```

### CopyButton
```typescript
// Copier vers clipboard avec feedback
<CopyButton text={publicLink} />
// Affiche "✓ Copié!" pendant 2s
```

### Alert
```typescript
// Notifications réutilisables
<Alert type="error" message="QR non trouvé" />
<Alert type="success" message="QR créé!" />
```

## Opérations CRUD (Complete)

| Opération | Fonction | Statut |
|-----------|----------|--------|
| Create QR | `createDemoQr()` | ✅ |
| Read List | `getDemoQrs()` | ✅ |
| Get Public | `getDemoQrByPublicId()` | ✅ |
| Update QR | `updateDemoQr()` | ✅ |
| Delete QR | `deleteDemoQr()` | ✅ |

## Performance (v1.1.0)

```
Build Size:     513 KB (minified)
Gzip Size:      149 KB
Modules:        85
Load Time:      ~300ms
Tests:          8/8 ✅
```

## Prochaines Étapes (Post-MVP)

### Phase 2 — Database Integration (À faire)
- [ ] Create Supabase project
- [ ] Deploy schema
- [ ] Replace localStorage with DB queries

### Phase 3 — Advanced Features (À faire)
- [ ] QR code image generation
- [ ] Analytics & tracking
- [ ] Code splitting (lazy loading)
- [ ] Service Worker offline

## Migration vers Supabase

```
1. Create Supabase project
2. Get VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
3. Create .env.local avec credentials
4. Deploy supabase/schema.sql
5. Restart app
6. App automatically uses Supabase
```
