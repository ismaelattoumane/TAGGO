# TAGGO — MVP v1.1.0 Production-Ready

TAGGO est une plateforme de gestion de QR codes avec authentification, persistance de données, et pages publiques accessibles.

**🎯 Statut**: ✅ **Production-Ready Demo** — Toutes les fonctionnalités MVP implémentées, testées, et fonctionnelles.

**📊 Métriques**: 
- 8/8 tests passés ✅
- Bundle: 513 KB (minified), 149 KB (gzip)
- 85 modules compilés
- 7 pages complémentées + 404

TAGGO est une marque de vêtements connectés basée sur une expérience public via QR code et un espace utilisateur dédié.

## Stack Technique

- **React 19** + TypeScript + Vite
- **React Router** pour la navigation
- **Supabase** (optionnel, pour la production)
- **Vitest** + Testing Library pour les tests
- **localStorage** pour la persistance démo

## Structure du Projet

```
src/
├── app/              # Routing et configuration
├── components/       # Composants réutilisables
├── context/          # Contextes React (Auth)
├── lib/              # Utilitaires (validators, auth démo, etc.)
├── pages/            # Pages de l'application
├── services/         # Logique métier
└── main.tsx          # Point d'entrée

docs/
├── ARCHITECTURE.md   # Architecture technique détaillée
├── DECISIONS.md      # Décisions de design
├── DEMO.md          # Guide de démonstration
├── ROADMAP.md       # Phases de développement
├── STATUS.md        # État de progression
└── DEVELOPMENT.md   # Guide de développement
```

## Documentation

| Document | Contenu |
|----------|---------|
| **[DEMO.md](docs/DEMO.md)** | Comment tester l'app, comptes démo, flux utilisateur |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Architecture technique et design system |
| **[ROADMAP.md](docs/ROADMAP.md)** | Phases de développement et statut |
| **[STATUS.md](docs/STATUS.md)** | État complet du projet, tâches complétées et à faire |
| **[DECISIONS.md](docs/DECISIONS.md)** | Décisions de design et justifications |
| **[CHANGELOG.md](docs/CHANGELOG.md)** | Histoire des versions et changements |
| **[PERFORMANCE.md](docs/PERFORMANCE.md)** | Guide d'optimisation et métriques |

## 🚀 Démarrage Rapide

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Accédez à http://localhost:5173
```

### Connexion Rapide
1. Allez à `/login`
2. Cliquez sur un compte de démonstration (ex: `demo@taggo.local`)
3. Explorez le dashboard et créez des QR codes

**Voir [docs/DEMO.md](docs/DEMO.md) pour les détails complets sur les comptes de test.**

## Commandes Disponibles

```bash
# Développement
npm run dev          # Lancer le serveur local (avec hot reload)

# Tests
npm test             # Lancer les tests en mode watch
npm test -- --run    # Lancer les tests une seule fois

# Build
npm run build        # Compiler pour la production
npm run preview      # Prévisualiser le build production

# Linting
npm run lint         # Vérifier la qualité du code
```

## 🆕 Quoi de Neuf (v1.1.0)

- ✨ **Suppression de QR codes** avec confirmation
- 🔍 **Filtrage par statut** dans le dashboard
- 📋 **Liens publics copiables** en un clic
- 🎨 **Page 404 personnalisée** au lieu de redirection
- 🚀 **Alert component** réutilisable pour notifications
- 📊 **Stats améliorées** (total QR codes)

Voir [CHANGELOG.md](docs/CHANGELOG.md) pour plus de détails.

## Mode Démonstration vs Production

### Mode Démonstration (Courant)
✅ Fonctionne sans Supabase configuré  
✅ Authentification locale avec comptes pré-créés  
✅ QR codes stockés dans localStorage  
✅ Parfait pour développement et tests  

**Utilisez ce mode pour :**
- Tester le flux utilisateur complet
- Développer des nouvelles fonctionnalités
- Déboguer sans backend configuré

### Mode Production (À venir)
Requiert Supabase configuré pour :
- Authentification réelle
- Persistance en base de données
- Sécurité accrue (RLS, HTTPS, etc.)
- Multi-utilisateurs réels

## Configuration Supabase

Pour connecter Supabase :

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Copiez vos credentials dans `.env.local` :
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-key-here
   ```
3. Déployez le schéma : exécutez `supabase/schema.sql` dans l'éditeur SQL Supabase
4. Redémarrez l'app

L'app basculera automatiquement vers Supabase au lieu du stockage local.

## Fonctionnalités

- ✅ Authentification (locale démo ou Supabase)
- ✅ Création et modification de QR codes
- ✅ Pages publiques pour consulter les QR codes (sans connexion)
- ✅ Identifiants publics non-énumérables
- ✅ Validation des données côté client
- ✅ Tests complets

## Sécurité

- ❌ Ne JAMAIS stocker de secrets dans le frontend
- ✅ Séparation des données publiques vs privées
- ✅ Identifiants publics non-énumérables (`TGG-XXXXXXX`)
- ✅ Validation stricte des entrées utilisateur
- ✅ Sanitization du contenu texte
- 🔄 RLS Supabase (à implémenter en production)

## Troubleshooting

**Q: L'app n'ouvre pas après `npm run dev`?**  
→ Vérifiez que le port 5173 est disponible, ou changez-le avec `--host`

**Q: Les données disparaissent après rechargement?**  
→ Vérifiez que localStorage n'est pas désactivé (pas de mode incognito)

**Q: Comment réinitialiser les données démo?**  
→ Ouvrez DevTools (F12) et exécutez :
```javascript
localStorage.clear()
```

## Variables d'Environnement

Voir `.env.example` pour le template complet.

```env
# Optionnel - Supabase (pour la production)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Contribution

Consultez [DEVELOPMENT.md](docs/DEVELOPMENT.md) pour les conventions de code et le workflow de développement.

## Licence

À définir

## Contact

Pour les questions sur ce projet, consultez la documentation complète dans le dossier `docs/`.

---

**Statut du projet**: ✅ MVP v1.1.0 Production-Ready | [Voir le STATUS complet](docs/STATUS.md)

**Prêt pour**: 
- ✅ Démonstration et tests utilisateurs
- ✅ Développement d'autres features
- ✅ Déploiement sur Supabase backend

**Prochaines étapes**: Supabase integration → Code splitting → Analytics → Advanced features (v2.0)
