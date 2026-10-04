# Analytics de scans — TAGGO

Étape 11. Ce document explique ce que TAGGO compte, ce qu’il ne compte pas, et
pourquoi. Il fait partie du code : les tests d’audit (`src/lib/securityAudit.test.ts`)
lisent les mêmes règles que ce document décrit.

## Le principe : PRIVACY > quantité de données

Avant d’ajouter une statistique, la question n’est pas « est-ce utile ? » mais
« est-ce possible sans collecter une information de plus ? ». Si la réponse est
non, la statistique n’est pas implémentée, même si elle est commercialement
intéressante.

TAGGO ne cherche pas à devenir une plateforme d’analytics. Il rend compte d’un
seul chiffre utile : **combien de fois mon TAGGO a été scanné**.

## Ce qui est enregistré

La table `public.taggo_scans` contient **deux colonnes de données** :

| Colonne | Rôle |
| --- | --- |
| `qr_code_id` | Le TAGGO scanné (clé étrangère, `ON DELETE CASCADE`) |
| `scanned_at` | Horodatage posé par la **base** (`now()`), jamais par le client |

Plus une clé primaire technique `id`, qui n’est jamais exposée.

## Ce qui n’est **pas** enregistré

Chacun de ces éléments a été explicitement écarté parce qu’aucune statistique
affichée dans le tableau de bord n’en a besoin :

- adresse IP
- User-Agent, navigateur, système d’exploitation, type d’appareil
- pays, ville, région, fuseau horaire, langue
- adresse de provenance (`Referer`), paramètres UTM, page précédente
- cookie, `localStorage`, `sessionStorage`, `IndexedDB`
- identifiant de visiteur, identifiant de session, empreinte (« fingerprint »)
- coordonnées GPS ou code postal

Aucune de ces valeurs n’est lue, ni conservée, ni hachée. Le hachage ne serait
pas une réponse : un hachage d’IP reste une donnée identifiante sous RGPD.

Conséquence assumée : TAGGO ne sait pas « qui » a scanné, seulement « quand » et
« quel TAGGO ». C’est exactement le niveau de granularité nécessaire au
propriétaire d’un TAGGO.

## Architecture

```
Page publique /t/:tag
  └─ POST /api/analytics/scan?public_id=TGG-XXXXXXX   (public, sans JWT)
       └─ RPC record_taggo_scan(text)                  (service_role)
            └─ INSERT (qr_code_id, scanned_at = now())

Dashboard /dashboard/qr/:qrId
  └─ GET /api/analytics/taggo?qr_id=…&days=7|30|90    (JWT Bearer requis)
       └─ auth.uid() → RPC get_taggo_scan_stats(uuid, uuid, int, text)
            └─ vérifie qr_codes.owner_id = p_owner_id en base
```

### Pourquoi la RPC d’écriture est `service_role` uniquement

Le visiteur public n’a pas de compte : il ne peut donc pas s’authentifier. Mais
il ne doit pas non plus pouvoir écrire librement en base. La fonction
`record_taggo_scan` :

- déduit **elle-même** le TAGGO à partir du code public (le client ne fournit
  pas de `qr_code_id`) ;
- refuse les TAGGO non actifs, non publics ou sans destination ;
- pose `scanned_at` elle-même (le client ne fournit pas d’horodatage).

Le navigateur ne peut donc transmettre que le code public. Ni `owner_id`, ni
`qr_id`, ni compteur, ni timestamp : c’est vérifié par un test qui parcourt la
requête HTTP réellement émise.

### Pourquoi la lecture passe par une vérification en base

`get_taggo_scan_stats` reçoit un `p_owner_id` **déduit du JWT par le serveur**,
puis revérifie en base que `qr_codes.owner_id = p_owner_id`. Un TAGGO appartenant
à quelqu’un d’autre renvoie `not_owner`, sans révéler s’il existe.

La RLS de `public.taggo_scans` offre une seconde barrière : seule la lecture
est autorisée, uniquement pour les scans de ses propres TAGGO
(`qr_codes.owner_id = auth.uid()`). Aucune politique `insert`/`update`/`delete`
n’existe : les scans sont immuables pour le client.

## Anti-abus

Un scan est compté au maximum **une fois toutes les 30 secondes** pour un TAGGO
donné (`public.taggo_scan_settings.min_interval_seconds`, modifiable de 1 à 3600
secondes).

La fenêtre est **purement temporelle et par TAGGO**. Elle ne lit aucune adresse
IP. C’est un choix délibéré : plusieurs personnes partagent une même adresse IP
(famille, bureau, réseau mobile), donc une limite par IP sous-countrait des
visiteurs légitimes — alors qu’une limite par IP supposerait de stocker cette IP.

Effet : 1000 rafraîchissements en une minute comptent environ 2 scans, pas 1000.
Ce qui est le comportement attendu.

## Granularité et périodes

Le tableau de bord propose **7, 30 et 90 jours** — aucune autre période n’est
acceptée, côté API comme en base.

| Période | Granularité | Raison |
| --- | --- | --- |
| 7 jours | par jour | 7 points, lisible |
| 30 jours | par jour | 30 points, lisible |
| 90 jours | par semaine | 13 points ; 90 colonnes seraient illisibles |

« Aujourd’hui » est calculé **en UTC**, comme les buckets, afin que le chiffre
soit reproductible et ne dépende pas du fuseau du navigateur.

## Robustesse : l’analytics ne peut pas casser le parcours public

Sur `/t/:tag`, l’enregistrement du scan est déclenché en parallèle de la
résolution du TAGGO et **n’est jamais attendu**. Un échec réseau, un 500 ou une
base indisponible sont absorbés :

- l’endpoint répond `200` avec `recorded: false` — jamais une erreur ;
- le client ne lève jamais d’exception ;
- aucun message relatif à l’analytics n’apparaît sur la page publique.

Le visiteur voit sa page, toujours. C’est le seul comportement acceptable pour
une page qui est censée mener vers un lien.

Réciproquement, une panne de lecture **n’est jamais transformée en zéros** :
des zéros se lisent comme « aucun scan », ce qui serait faux. Le tableau de bord
affiche un message d’erreur et un bouton « Réessayer ».

## Accessibilité du graphique

Aucune librairie de graphiques n’est ajoutée (le projet n’en a pas, et
`recharts` coûterait environ 100 kB au bundle pour un graphe à barres). Le rendu
est un SVG inline.

L’information ne repose jamais sur la couleur seule :

- chaque barre porte une étiquette de valeur ;
- un tableau complet des valeurs est disponible sous le graphique ;
- un résumé en toutes lettres (« 12 scans au total sur la période, pic de 4… »)
  est exposé aux lecteurs d’écran via `aria-describedby` ;
- si la période ne contient aucun scan, un état explicite est affiché plutôt
  qu’un graphique vide sans explication.

## Aucune dépendance de suivi

`package.json` ne contient aucun SDK d’analytics, de session replay ou de suivi
(Google Analytics, Mixpanel, Segment, Sentry, PostHog, Plausible, Matomo,
Amplitude, Hotjar, FullStory, LogRocket) ni librairie de graphiques. C’est
vérifié par un test qui échouerait le jour où l’une serait ajoutée.

Si un jour TAGGO intègre un tel outil, il devra être déclaré dans la politique
cookies et soumis à consentement préalable.

## Ce que voit le propriétaire

Dans `/dashboard/qr/:qrId` :

- total des scans depuis la création du TAGGO ;
- scans aujourd’hui (UTC) ;
- scans sur 7 et 30 jours ;
- évolution sur 7, 30 ou 90 jours ;
- horodatage des 10 scans récents.

Ces valeurs sont celles de la base. Aucune n’est extrapolée ni estimée. Un TAGGO
jamais scanné affiche « Pas encore de scans », pas une série de zéros.

## Aplicer la migration

```bash
supabase db push
```

La migration `20260931000000_taggo_scans.sql` crée ses deux tables et ses deux
fonctions. Elle n’altère aucune migration validée (étapes 5 à 10) et ne modifie
aucune politique RLS existante.

## Tests

| Fichier | Couvre |
| --- | --- |
| `api/_lib/analyticsServer.test.ts` | validation, périodes, anti-abus, isolation propriétaire, pannes |
| `src/features/analytics/scanClient.test.ts` | absence de donnée d’identité dans la requête, absorption des erreurs |
| `src/features/analytics/TaggoAnalyticsPanel.test.tsx` | états du panneau, accessibilité du graphique |
| `src/pages/PublicQrPage.test.tsx` | scan déclenché une fois, page affichée même si le scan échoue |
| `src/lib/securityAudit.test.ts` | confidentialité : colonnes, RLS, dépendances, absence de collecte |

## Points à valider avant commercialisation

- Durée de conservation des scans (la politique RGPD la laisse ouverte, comme
  les autres durées du projet).
- Confirmation que la mesure d’audience interne, sans cookie et sans donnée
  identifiante, est bien qualifiée d’exemptée de consentement par TAGGO.
- Aucun chiffre de ce document n’est une projection : les statistiques affichées
  ne sont que des scans réellement enregistrés.