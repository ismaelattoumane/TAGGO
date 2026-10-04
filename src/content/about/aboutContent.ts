import type { ContentDocument } from '../types'

/**
 * ÉTAPE 10 — Page À propos (route `/about`).
 *
 * Les affirmations marketing sont reformulées pour ne pas devenir des faits
 * vérifiés : aucune statistique, aucun chiffre de ventes, aucune promesse de
 * performance n'est annoncé.
 */
export const aboutDocument: ContentDocument = {
  path: '/about',
  eyebrow: 'TAGGO',
  title: 'Le vêtement qui connecte.',
  description:
    'TAGGO, c’est le t-shirt qui parle : un QR code esthétique intégré au design, et derrière lui tout ce que tu veux partager. Découvrez l’histoire et l’équipe TAGGO.',
  lead: 'TAGGO, c’est le t-shirt qui parle. Pas de blabla, un QR code. Pas un gadget, une vitrine. Porte ton lien préféré sur ton dos. Insta, Snap, WhatsApp, ton site, ton projet… Tout est dans le scan.',
  sections: [
    {
      id: 'histoire',
      title: 'L’histoire',
      blocks: [
        {
          kind: 'paragraph',
          text: "On en avait marre des t-shirts vides. Marre des campagnes publicitaires qui coûtent un rein et qu'on zappe en 2 secondes. Marre de tendre son téléphone à quelqu'un en soirée pour lui montrer ton compte. Alors on a créé TAGGO.",
        },
        {
          kind: 'paragraph',
          text: "Un t-shirt. Un QR code esthétique, intégré au design. Et derrière ce QR, tout ce que tu veux. Tu l'achètes, tu le scannes, tu choisis ta destination. Et si demain tu changes d'avis, tu modifies depuis ton dashboard. Le vêtement évolue avec toi.",
        },
      ],
    },
    {
      id: 'convictions',
      title: 'Ce qu’on croit',
      blocks: [
        {
          kind: 'bullets',
          items: [
            'La visibilité, ça s’imprime.',
            'Accessible à tous : particuliers, créateurs, associations et professionnels.',
            'Durable, pas jetable.',
          ],
        },
        {
          kind: 'note',
          text: "TAGGO ne publie aucune promesse chiffrée. Aucun nombre de vues, de scans ou d'audience n'est garanti : ce que ton TAGGO génère dépend de l'usage que tu en fais et des liens que tu choisis.",
        },
      ],
    },
    {
      id: 'equipe',
      title: 'La team',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Deux potes, une idée, zéro prise de tête.',
        },
        {
          kind: 'definition',
          entries: [
            { term: 'Viper', description: 'Le cerveau.' },
            { term: 'Isma', description: 'La machine à coder.' },
          ],
        },
        {
          kind: 'paragraph',
          text: "On gère tout nous-mêmes. Du design au colis, en passant par les tests de scan sous la pluie. Parce qu'un QR qui bug, c'est pas TAGGO.",
        },
      ],
    },
    {
      id: 'contact-equipe',
      title: 'Une question ?',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Écris-nous, on répond.',
        },
      ],
    },
  ],
}