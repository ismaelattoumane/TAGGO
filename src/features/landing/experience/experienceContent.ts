/**
 * Contenu éditable de l’expérience hero (textes, données d’exemple).
 * Les fenêtres de visibilité sont dans experienceTimeline.ts (LINE_WINDOWS).
 */
export const EXPERIENCE_CONTENT = {
  hero: {
    title: 'Ton T-shirt peut faire plus.',
    subtitle: 'Plus qu’un vêtement, une passerelle vers ton univers.',
    discover: 'Découvrir',
    howItWorks: 'Comment ça marche',
  },
  /** Textes de scène, indexés par `id` de LINE_WINDOWS. */
  lines: {
    discover: 'Découvre TAGGO.',
    scan: 'Un scan suffit.',
    identity: 'Ton identité. Toujours avec toi.',
    destination: 'Change ta destination quand tu veux.',
    control: 'Tu contrôles ton TAGGO.',
    usages: 'Un TAGGO pour chaque usage.',
  } as Record<string, string>,
  cta: {
    title: 'Prêt à créer ton TAGGO ?',
    button: 'Créer mon TAGGO',
    note: 'Ton T-shirt. Ton identité. Ton monde.',
  },
  controls: {
    skip: 'Passer l’animation',
    cue: 'Fais défiler',
  },
  scan: { detected: 'TAGGO détecté' },
  /** Résumé lisible par les lecteurs d’écran et les moteurs (l’animation, elle, est décorative). */
  summary: {
    title: 'TAGGO en bref',
    steps: [
      'Un T-shirt TAGGO porte le logo TAGGO devant et un QR code au dos.',
      'Un scan suffit : quelqu’un scanne le QR code avec son smartphone.',
      'Il accède à ta page TAGGO : tes liens Instagram, Snapchat, WhatsApp et ton contact.',
      'Tu changes ta destination quand tu veux, avec le même T-shirt.',
      'Tu contrôles ton TAGGO depuis un tableau de bord : TAGGO ID, destination, scans et statut.',
      'Un TAGGO pour chaque usage : particuliers, influenceurs, associations et entreprises.',
    ],
  },
  /** Données d’exemple de la maquette de téléphone. */
  panels: {
    profile: {
      badge: 'Ma page',
      handle: '@alex',
      intro: 'Découvre mes liens',
      links: ['Instagram', 'Snapchat', 'WhatsApp', 'Contact'],
    },
    destination: {
      badge: 'Destination',
      title: 'Où mène ton QR ?',
      intro: 'Choisis, change quand tu veux.',
      options: ['Instagram', 'Snapchat', 'WhatsApp', 'Contact'],
    },
    dashboard: {
      badge: 'Tableau de bord',
      title: 'Mon TAGGO',
      intro: 'Exemple de données.',
      rows: [
        ['TAGGO ID', 'TGG-8K9L2R7'],
        ['Destination', 'WhatsApp'],
        ['Scans', '127'],
        ['Statut', 'Actif'],
      ] as Array<[string, string]>,
    },
    usages: {
      badge: 'Usages',
      items: [
        ['Particuliers', 'Partage tes réseaux et tes contacts.'],
        ['Influenceurs', 'Ton TAGGO, c’est ton média.'],
        ['Associations & entreprises', 'Événements, campagnes, recrutement.'],
      ] as Array<[string, string]>,
    },
  },
}
