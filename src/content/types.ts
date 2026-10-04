/**
 * ÉTAPE 10 — Types de contenu éditorial TAGGO.
 *
 * Les pages publiques (À propos, FAQ, documents légaux, livraison) sont
 * rendues à partir de structures de données typées. Tout le texte modifiable
 * vit dans `src/content/` : aucune page ne contient de texte en dur.
 */

export type ContentBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbers'; items: string[] }
  | { kind: 'definition'; entries: { term: string; description: string }[] }
  | { kind: 'note'; text: string }

export type ContentSection = {
  /** Identifiant d'ancrage (utilisé pour le sommaire et les liens profonds). */
  id: string
  title: string
  blocks: ContentBlock[]
}

export type ContentDocument = {
  /** Route canonique associée au document. */
  path: string
  eyebrow: string
  title: string
  /** Meta description SEO. */
  description: string
  lead?: string
  blocks?: ContentBlock[]
  sections: ContentSection[]
}

/** Bloc de rendu simple (utilisé par les pages non-document). */
export type ContentCard = {
  id: string
  title: string
  blocks: ContentBlock[]
}