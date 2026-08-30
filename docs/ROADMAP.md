# TAGGO — Roadmap mise à jour

## Phase 0 — Cadrage

✅ Audit du dépôt
✅ Analyse du besoin produit
✅ Définition de l’architecture cible
✅ Création de la fondation React + TypeScript

## Phase 1 — Foundation (COMPLETE ✅)

✅ Setup Vite + React 19 + TypeScript
✅ Routes principales (7 pages complètes)
✅ Design system complet et consistent
✅ Pages Login / Register / Dashboard / QR Detail / Public QR / Settings / 404
✅ Validation fonctionnelle complète
✅ Persistance locale via localStorage
✅ Full CRUD pour QR codes (create, read, update, delete)
✅ Filtrage par statut (tous, actifs, brouillon, inactifs, archivés)
✅ Liens publics copiables en un clic
✅ Composants réutilisables (Alert, CopyButton, ProtectedRoute)
✅ Gestion erreurs (404, public QR not found)
✅ Dual auth (Supabase + localStorage fallback)

## Phase 2 — Database (NEXT 🎯)

🔄 Supabase Backend Integration
  - [ ] Create/configure Supabase project
  - [ ] Deploy schema (profiles, qr_codes, public_profiles, subscriptions)
  - [ ] Implement RLS policies
  - [ ] Test database connections

🔄 Data Migration
  - [ ] Replace localStorage with real DB queries
  - [ ] Ensure user ownership validation
  - [ ] Test end-to-end flow

## Phase 3 — Auth (PARTIELLEMENT COMPLETE ✅/🔄)

✅ Local Auth (Fallback)
  - Comptes de démo pré-créés
  - Session persistance
  - Sign-in/up/out flow

🔄 Supabase Auth Integration
  - [ ] Connect real Supabase Auth
  - [ ] Email verification
  - [ ] Password reset flow
  - [ ] Session management
  - [ ] Replace demo accounts with real users

## Phase 4 — QR Management (COMPLETE ✅)

✅ Full CRUD
  - ✅ Création QR (page `/dashboard/qr/new`)
  - ✅ Modification QR (page `/dashboard/qr/:qrId`)
  - ✅ Suppression QR avec confirmation
  - ✅ Résolution publique (page `/qr/:publicId`)
  - ✅ Statuts (actif, inactif, draft, archived)

✅ Public Experience
  - ✅ Page publique fiable
  - ✅ Données publiques uniquement
  - ✅ Identifiants non-énumérables (TGG-XXXXXX)
  - ✅ Gestion erreurs (404, not found)

Next (post-MVP)
  - [ ] Associer propriétaire via Supabase
  - [ ] Destination sécurisée (validation backend)
  - [ ] QR code image generation
  - [ ] Analytics & tracking

## Phase 5 — Public Experience (À FAIRE ⏭️)

À venir (post-MVP)
- [ ] QR code image generation (afficher le QR graphique)
- [ ] Metadata/SEO for public QR pages
- [ ] Social media preview tags (og:image, og:title)
- [ ] Analytics tracking (scan counts)

## Phase 6 — Security Review (À FAIRE ⏭️)

À venir (post-MVP)
- [ ] IDOR audit (vérifier isolement utilisateurs)
- [ ] Server-side validation (constraints backend)
- [ ] Route protection verification
- [ ] Penetration testing

## Phase 7 — Performance & Polish (À FAIRE ⏭️)

À venir (post-MVP)
- [ ] Code splitting (lazy loading pages)
- [ ] Service Worker pour offline support
- [ ] Image optimization & compression
- [ ] Bundle analysis & reduction
- [ ] Loading states et error feedback
- [ ] Mobile responsiveness
