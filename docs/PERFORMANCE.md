# TAGGO — Performance & Optimization Guide

## État Actuel

```
Build Size:     513 KB (minified)
Gzip:          149 KB
Modules:       85
Load Time:     ~300ms
Test Speed:    ~3s for 8 tests
```

---

## Optimisations Prioritaires

### 1. Code Splitting (Haute Priorité)

**Problème**: Bundle unique contient tout le code  
**Impact**: 513 KB gzip pour une première charge  
**Solution**: Lazy-load les pages avec React.lazy()

```typescript
// Avant
import { DashboardPage } from '../pages/DashboardPage'

// Après
const DashboardPage = lazy(() => import('../pages/DashboardPage'))
```

**Gain estimé**: -30% du bundle principal (~45 KB)

### 2. Dependency Optimization

**Audit actuel:**
- React: ~120 KB
- React-DOM: ~150 KB
- React-Router: ~40 KB
- Supabase: ~200 KB
- Vitest + Testing: dev-only

**Recommandations:**
- Vérifier si Supabase est vraiment nécessaire en démo (considérer import dynamique)
- Tree-shake les imports non-utilisés
- Utiliser `react-router@next` pour réductions

**Gain potentiel**: -50-100 KB

### 3. Asset Optimization

**CSS:**
- Minifier manuellement les styles globaux
- Utiliser CSS modules pour les components
- Supprimer les styles inutilisés

**Images/Icônes:**
- Utiliser SVG au lieu d'images
- Créer sprite CSS pour petites icônes
- Lazy-load les images si ajout de photos

### 4. Caching Stratégies

**Browser Cache:**
```
// Ajouter à vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor': ['react', 'react-dom'],
        'router': ['react-router-dom'],
      }
    }
  }
}
```

**localStorage Cache:**
- Déjà utilisé pour QR data
- Considérer caching des validateurs résultats

---

## Métriques à Suivre

### Performance Budgets

| Métrique | Courant | Cible | Action |
|----------|---------|-------|--------|
| Bundle Size | 149 KB | 100 KB | Code splitting |
| First Load | ~300ms | <150ms | Lazy loading |
| TTI (Time to Interactive) | ~500ms | <300ms | Pre-render |
| Lighthouse Score | ~75 | >90 | Optimisations JS |

### Test Suite

| Métrique | Courant | Cible |
|----------|---------|-------|
| Test Files | 3 | 10+ |
| Test Coverage | 30% | >60% |
| Test Speed | ~3s | <5s |

---

## Quick Wins (1-2 heures)

1. **Ajouter React.lazy** sur pages
   - Gain: ~10% du bundle
   - Effort: 30 min

2. **Minifier CSS**
   - Gain: ~2-3 KB
   - Effort: 15 min

3. **Optimiser imports**
   - Gain: ~5-10 KB
   - Effort: 20 min

4. **Ajouter tests** pour CreateQrPage, DeleteQr
   - Gain: +30% couverture
   - Effort: 1h

---

## Medium Optimisations (2-4 heures)

1. **Code splitting par route**
   - Utiliser `React.lazy()` + `Suspense`
   - Cacher les boundaries
   - Gain: ~20-30 KB

2. **Web Workers** pour validation
   - Movevalidateurs en worker
   - Non-blocking validation
   - Gain: +performance perceptible

3. **Service Worker** pour offline
   - Cache les pages visitées
   - Gain: Offline support

---

## Advanced (Post-MVP)

1. **Dynamic imports for Supabase**
   - Only load when needed
   - Gain: ~50 KB

2. **Preload critical paths**
   - Preload /dashboard
   - Pre-fetch public QR

3. **Bundle analysis**
   - `npm run build -- --analyze`
   - Identify unused deps

4. **Image optimization**
   - WebP with fallbacks
   - Responsive images

---

## Testing Performance

```bash
# Analyze bundle
npm run build -- --analyze

# Test with lighthouse
npm run preview
# Then: DevTools → Lighthouse

# Test 3G with throttling
# DevTools → Network → Slow 3G
```

---

## Monitoring

Pour la production (avec Supabase):

```typescript
// Add performance monitoring
import { performance } from 'web-vitals'

performance.mark('app-start')
// ... app code ...
performance.mark('app-ready')
performance.measure('app-load', 'app-start', 'app-ready')
```

---

## Checklist de Déploiement

- [ ] `npm run build` sans warnings
- [ ] `npm test -- --run` tous les tests passent
- [ ] Gzip < 150 KB
- [ ] Lighthouse score > 80
- [ ] CSS fully minified
- [ ] No console errors in production build
- [ ] Images optimized
- [ ] Links tested (démo accounts)

---

**Priorité Actuelle**: Lazy-loading pages (Gain rapide de -30%)  
**Prochaine Itération**: Code splitting + Service Worker
