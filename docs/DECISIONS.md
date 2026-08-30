# TAGGO — Décisions Techniques (v1.1.0 Production-Ready)

**Statut**: v1.1.0 a implémenté les Décisions 1-4 complètement et ajoute les Décisions 5-11 pour fonctionnalités v1.1.0.

---

### Problème
Le projet est encore au tout début et le MVP doit rester orienté desktop web sans dispersion sur mobile native.

### Décision
On continue avec une architecture React + TypeScript dédiée au web desktop.

### Raison
C’est le bon niveau de complexité pour démontrer le produit TAGGO de bout en bout.

### Alternatives
- React Native
- Next.js full-stack
- multi-app

### Conséquence
Le produit reste exploitable et extensible sans sur-construction.

---

## Décision 2 — mettre Supabase comme source de vérité

### Problème
Le produit a besoin d’authentification, de données utilisateurs et de QR associés.

### Décision
Supabase est la base technique prévue pour l’authentification et le stockage de données.

### Raison
Le projet impose déjà Supabase comme source de vérité et la sécurité est plus solide avec ses policies et RLS.

### Conséquence
Le code est prêt pour l’intégration réelle de l’authentification et du schéma de données.

---

## Décision 3 — séparer public et privé

### Problème
Le QR public ne doit pas exposer les informations privées de l’utilisateur.

### Décision
Les routes publiques ne récupèrent que des données explicitement publiques.

### Raison
Cela évite les fuites et les accès non autorisés.

### Conséquence
Le modèle de données doit être explicitement séparé entre données publiques et données privées.

---

## Décision 4 — documenter les informations manquantes

### Problème
Le Figma global n’est pas entièrement exploitable pour un écran complet à ce stade.

### Décision
On ne remplace pas le design par des hypothèses gratuites : on documente les écarts et on pousse le MVP sur la logique produit et la sécurité.

### Raison
Le mandat demande d’éviter d’inventer des écrans ou des fonctionnalités non présents dans la source de vérité.

### Conséquence
L’implémentation est fonctionnelle, lisible et extensible, sans faux détails visuels.
