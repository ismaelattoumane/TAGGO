# TAGGO — Changelog

## Version 1.1.0 (2026-08-30)

### 🎉 Nouvelles Fonctionnalités

**Gestion améliorée des QR codes**
- ✅ Suppression de QR codes avec confirmation
- ✅ Filtrage par statut (tous, actifs, brouillon, inactifs, archivés)
- ✅ Affichage des liens publics en copie-facile
- ✅ Bouton "Copier le lien" pour partage rapide

**Améliorations UX**
- ✅ Page 404 personnalisée au lieu de redirection automatique
- ✅ Composant réutilisable Alert pour les messages utilisateur
- ✅ Meilleur feedback sur les erreurs publiques QR
- ✅ Message quand il n'y a pas de QR codes à afficher

**Interface**
- ✅ Lien public visible dans le dashboard
- ✅ Stats améliorées (total QR codes)
- ✅ Meilleure organisation de la page d'édition

### 🔧 Améliorations Techniques

- ✅ Composant `CopyButton.tsx` réutilisable
- ✅ Composant `Alert.tsx` pour notifications
- ✅ Fonction `deleteDemoQr()` ajoutée à demoData
- ✅ Gestion d'erreur améliorée sur page publique
- ✅ 85 modules compilés (5 de plus qu'avant)

### 📊 Statistiques

```
Tests:    8/8 ✅
Build:    Production ✅
Modules:  85 (+3)
Size:     513KB (minified)
Gzip:     149KB
```

### 🐛 Corrections

- ✅ Router maintenant affiche NotFoundPage au lieu de redirection aveugle
- ✅ Messages d'erreur plus clairs sur pages publiques
- ✅ Bouton "Copier" feedback immédiat (2 sec)

---

## Version 1.0.0 (2026-08-30)

### 🚀 MVP Initial

**Authentification**
- ✅ Authentification locale (demo fallback)
- ✅ Authentification Supabase-ready
- ✅ Comptes de démo pré-créés
- ✅ Sessions persistantes

**Gestion des QR Codes**
- ✅ Créer QR codes
- ✅ Éditer QR codes
- ✅ Afficher liste dans dashboard
- ✅ Accéder aux pages publiques
- ✅ Identifiants publics non-énumérables

**Pages**
- ✅ Login / Register
- ✅ Dashboard
- ✅ Create QR
- ✅ Edit QR
- ✅ Public QR Page
- ✅ Settings (stub)

**Infrastructure**
- ✅ React 19 + TypeScript + Vite
- ✅ React Router pour navigation
- ✅ Vitest + Testing Library
- ✅ localStorage pour persistance
- ✅ Production build réussi

**Documentation**
- ✅ QUICKSTART.md
- ✅ DEMO.md
- ✅ STATUS.md
- ✅ ROADMAP.md
- ✅ ARCHITECTURE.md
- ✅ README.md

---

## À Venir

### Version 1.2.0 (Prochaine)
- QR code image generation
- Scan tracking (mock)
- Analytics dashboard
- Export QR data
- Team collaboration

### Version 2.0.0 (Production)
- Supabase real backend
- User subscriptions
- Advanced analytics
- API for 3rd parties
- Mobile app

---

## Notes de Version

**Pour mettre à jour depuis v1.0.0 → v1.1.0:**
```bash
npm install
npm test -- --run
npm run build
```

**Aucun breaking change** — toutes les données existantes compatible
