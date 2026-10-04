import { BUSINESS, businessValue } from '../../config/business'

export type FaqItem = {
  id: string
  question: string
  /** Réponse composée de paragraphes courts. */
  answer: string[]
}

export type FaqCategory = {
  id: string
  title: string
  items: FaqItem[]
}

/**
 * ÉTAPE 10 — FAQ TAGGO (route `/faq`).
 *
 * Les informations encore inconnues ne sont jamais devinées : elles sont rendues
 * par `businessValue(...)`, qui produit un placeholder visible
 * `[À COMPLÉTER — …]`. Modifier ce fichier suffit à mettre à jour la page.
 */
export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'produit',
    title: 'Produit',
    items: [
      {
        id: 'produit-quest-ce',
        question: "Qu'est-ce qu'un TAGGO ?",
        answer: [
          'Un TAGGO est un vêtement qui porte un QR code unique.',
          "Le QR code s'ouvre avec l'appareil photo d'un smartphone : aucune application à installer n'est nécessaire pour le consulter.",
          "La personne qui scanne arrive sur une page publique que le titulaire peut personnaliser depuis son espace TAGGO.",
        ],
      },
      {
        id: 'produit-matiere',
        question: 'En quelle matière est-il fabriqué ?',
        answer: [
          `Matière : ${businessValue('material')}.`,
          "Cette information sera publiée dès que la composition exacte du textile sera confirmée par TAGGO.",
        ],
      },
      {
        id: 'produit-certification',
        question: 'Le textile est-il certifié ?',
        answer: [
          `Certifications : ${businessValue('certifications')}.`,
          "Aucune certification n'est annoncée tant qu'elle n'a pas été vérifiée et confirmée par TAGGO.",
        ],
      },
      {
        id: 'produit-entretien',
        question: 'Comment entretenir mon TAGGO ?',
        answer: [
          `Conseils d'entretien : ${businessValue('careInstructions')}.`,
          'Un avis de lavage figure sur l’étiquette du vêtement.',
        ],
      },
      {
        id: 'produit-prix',
        question: 'Combien coûte un TAGGO ?',
        answer: [
          "Le prix officiel n'est pas encore publié. Aucun montant n'est estimé ni affiché avant sa publication.",
          'Lorsque le prix sera disponible, il sera indiqué sur la fiche produit et avant la validation de la commande.',
        ],
      },
    ],
  },
  {
    id: 'utilisation',
    title: 'Utilisation & transfert',
    items: [
      {
        id: 'utilisation-scan',
        question: 'Comment scanner mon TAGGO ?',
        answer: [
          "Ouvrez l'appareil photo de votre smartphone et cadrez le QR code.",
          "Selon le téléphone, appuyez sur l'aperçu du lien qui apparaît.",
          "La page publique de votre TAGGO s'ouvre dans le navigateur.",
        ],
      },
      {
        id: 'utilisation-modifier',
        question: 'Puis-je changer la destination de mon QR code ?',
        answer: [
          'Oui. La destination se modifie depuis votre espace TAGGO, dans la section qui lui est dédiée.',
          'Le QR code imprimé reste identique : seule la page vers laquelle il pointe change.',
        ],
      },
      {
        id: 'utilisation-transfert',
        question: 'Puis-je transférer mon TAGGO à quelqu’un ?',
        answer: [
          "Oui. Le dashboard prévoit une fonctionnalité de transfert vers un autre compte TAGGO.",
          "Les conditions exactes du transfert (disponibilité, délai, nombre de transferts) sont indiquées dans le dashboard au moment de l'opération.",
        ],
      },
      {
        id: 'utilisation-perte',
        question: "J'ai perdu mon TAGGO ou il ne scanne plus. Que faire ?",
        answer: [
          "Vérifiez d'abord que le QR code n'est pas abîmé, plié ou masqué par un accessoire.",
          `Si le problème persiste, écrivez à ${BUSINESS.supportEmail} avec votre référence de commande : l'équipe TAGGO examine la situation.`,
        ],
      },
    ],
  },
  {
    id: 'commandes',
    title: 'Commandes & tailles',
    items: [
      {
        id: 'commandes-tailles',
        question: 'Comment choisir ma taille ?',
        answer: [
          `Guide des tailles : ${businessValue('sizeGuide')}.`,
          'Un tableau de mesures détaillé sera publié sur la fiche produit dès qu’il sera validé.',
          'En cas de doute entre deux tailles, contactez TAGGO avant de commander.',
        ],
      },
      {
        id: 'commandes-stock',
        question: 'Le TAGGO est-il réservé dans mon panier ?',
        answer: [
          "Non. Ajouter un article au panier ne réserve pas de stock.",
          "La réservation du TAGGO intervient uniquement après confirmation du paiement par TAGGO.",
          'Si un article devient indisponible avant le paiement, la commande ne peut pas être finalisée et vous en êtes informé.',
        ],
      },
      {
        id: 'commandes-paiement-compte',
        question: 'Dois-je avoir un compte pour commander ?',
        answer: [
          'Oui. Un compte TAGGO est nécessaire pour commander : il est l’espace où sont rattachés vos TAGGO et leur configuration.',
        ],
      },
      {
        id: 'commandes-facture',
        question: 'Comment obtenir ma facture ?',
        answer: [
          `Une facture est disponible depuis votre espace TAGGO. Pour toute demande, écrivez à ${BUSINESS.supportEmail}.`,
        ],
      },
    ],
  },
  {
    id: 'livraison',
    title: 'Livraison & retours',
    items: [
      {
        id: 'livraison-preparation',
        question: 'Quel est le délai de préparation ?',
        answer: [
          `Délai de préparation : ${businessValue('productionDelay')}.`,
          'Ce délai démarre à la confirmation du paiement par TAGGO.',
        ],
      },
      {
        id: 'livraison-france',
        question: 'Quels sont les délais de livraison en France ?',
        answer: [
          `Délai de livraison France : ${businessValue('deliveryDelayFrance')}.`,
          'Ce délai s’ajoute au délai de préparation et peut varier selon le transporteur.',
        ],
      },
      {
        id: 'livraison-europe',
        question: 'TAGGO livre-t-il en Europe ?',
        answer: [
          `Délai de livraison Europe : ${businessValue('deliveryDelayEurope')}.`,
          'La disponibilité des destinations européennes sera précisée dès que TAGGO l’aura confirmée.',
        ],
      },
      {
        id: 'livraison-international',
        question: 'TAGGO livre-t-il à l’international ?',
        answer: [
          `Délai de livraison international : ${businessValue('deliveryDelayInternational')}.`,
          "TAGGO vise en priorité la France au lancement. Les destinations internationales et les frais de douane éventuels seront précisés avant leur ouverture.",
        ],
      },
      {
        id: 'livraison-frais',
        question: 'La livraison est-elle offerte ?',
        answer: [
          `Seuil de livraison offerte : ${businessValue('freeShippingThreshold')}.`,
          'Les frais éventuels sont toujours affichés avant la validation de la commande.',
        ],
      },
      {
        id: 'livraison-suivi',
        question: 'Comment suivre ma commande ?',
        answer: [
          `Transporteur : ${businessValue('deliveryCarrier')}.`,
          "Lorsqu'un numéro de suivi est disponible, il vous est communiqué par email à l'expédition.",
        ],
      },
      {
        id: 'livraison-retours',
        question: 'Puis-je retourner mon TAGGO ?',
        answer: [
          `Politique de retour : ${businessValue('returnPolicy')}.`,
          `Adresse de retour : ${businessValue('returnAddress')}.`,
          `Le détail des conditions de retour et de remboursement figure dans les conditions générales de vente. En cas de produit défectueux ou non conforme, contactez ${BUSINESS.supportEmail}.`,
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    items: [
      {
        id: 'dashboard-acces',
        question: 'Comment accéder à mon dashboard ?',
        answer: [
          "Connectez-vous à votre compte TAGGO depuis l'onglet Connexion.",
          'Le dashboard est votre espace privé : il donne accès à vos TAGGO, à vos pages publiques et à vos paramètres.',
        ],
      },
      {
        id: 'dashboard-fonctionnalites',
        question: 'Que puis-je faire depuis le dashboard ?',
        answer: [
          'Modifier la destination de votre QR code.',
          'Configurer le contenu de votre page publique.',
          'Consulter les fonctionnalités disponibles pour chaque TAGGO.',
          'Transférer un TAGGO selon les règles communiquées dans le dashboard.',
        ],
      },
      {
        id: 'dashboard-perte-acces',
        question: "J'ai perdu l'accès à mon compte. Que faire ?",
        answer: [
          "Utilisez la procédure de réinitialisation de mot de passe depuis la page de connexion.",
          `Un email de réinitialisation vous sera envoyé. Si vous ne le recevez pas, écrivez à ${BUSINESS.supportEmail}.`,
          'TAGGO ne communique jamais votre mot de passe par email.',
        ],
      },
      {
        id: 'dashboard-abonnement',
        question: "L'abonnement TAGGO est-il déjà disponible ?",
        answer: [
          `Prix de l'abonnement : ${businessValue('subscriptionPrice')}.`,
          "Les conditions de l'abonnement ne sont pas encore publiées. Aucun abonnement n'est souscrit ni facturé tant que ses conditions n'ont pas été publiées et acceptées.",
          "L'idée d'une première année gratuite suivie d'un prix annuel n'est pas validée : ni la durée, ni le prix, ni les modalités de renouvellement ne sont arrêtés à ce stade.",
        ],
      },
    ],
  },
  {
    id: 'paiement',
    title: 'Paiement & sécurité',
    items: [
      {
        id: 'paiement-moyens',
        question: 'Quels moyens de paiement sont acceptés ?',
        answer: [
          `Moyens de paiement acceptés : ${businessValue('paymentMethods')}.`,
          `Fournisseur de paiement : ${businessValue('paymentProvider')}.`,
          'La liste définitive des moyens de paiement sera publiée dès sa confirmation.',
        ],
      },
      {
        id: 'paiement-securite',
        question: 'Le paiement est-il sécurisé ?',
        answer: [
          'Le paiement se fait sur une page de paiement hébergée par le prestataire de paiement.',
          'TAGGO ne stocke aucun numéro de carte bancaire.',
          'Le statut « payé » d’une commande est uniquement enregistré par TAGGO après confirmation serveur du paiement : le navigateur seul ne peut pas le déclencher.',
        ],
      },
      {
        id: 'paiement-paiement-seul',
        question: 'Puis-je payer à la livraison ?',
        answer: [
          "Ce mode de paiement n'est pas annoncé à ce jour. Les moyens de paiement acceptés seront précisés dès leur confirmation.",
        ],
      },
      {
        id: 'paiement-panier-securite',
        question: 'Mes données bancaires sont-elles conservées ?',
        answer: [
          'Non. Les données de carte sont traitées directement par le prestataire de paiement sur sa propre page sécurisée.',
          "TAGGO ne reçoit ni numéro de carte, ni cryptogramme visuel.",
        ],
      },
      {
        id: 'paiement-donnees',
        question: 'Que fait TAGGO de mes données personnelles ?',
        answer: [
          'TAGGO ne vend ni ne loue vos données.',
          'Le détail des traitements figure dans la politique de confidentialité.',
          `Pour toute question : ${BUSINESS.supportEmail}.`,
        ],
      },
    ],
  },
]