import { BUSINESS, businessValue, LEGAL_DOCUMENTS_UPDATED_AT, LEGAL_REVIEW_NOTICE } from '../../config/business'
import type { ContentDocument } from '../types'

/**
 * ÉTAPE 10 — Conditions Générales de Vente (route `/legal/terms`).
 *
 * Le document est structuré article par article afin d'être complété et validé
 * par TAGGO et par un conseil juridique avant commercialisation.
 *
 * Règles de rédaction respectées :
 * - aucun prix, délai, médiateur ou garantie commerciale inventé ;
 * - les garanties légales de conformité et des vices cachés ne sont jamais
 *   remplacées par une garantie commerciale inventée ;
 * - le droit de rétractation est décrit conformément au droit français, sans
 *  _exception improvisée (par exemple une perte automatique du droit après
 *   simple activation d'un QR code) ;
 * - la compétence juridictionnelle est formulée de façon à être opposable aux
 *   clients consommateurs.
 */
export const legalTermsDocument: ContentDocument = {
  path: '/legal/terms',
  eyebrow: 'Vente en ligne',
  title: 'Conditions Générales de Vente — TAGGO',
  description:
    'Conditions générales de vente de TAGGO : produits, prix, commande, paiement, livraison, rétractation, retours, garanties légales et médiation.',
  lead: `Dernière révision : ${LEGAL_DOCUMENTS_UPDATED_AT}. ${LEGAL_REVIEW_NOTICE}`,
  blocks: [
    {
      kind: 'note',
      text: "Ces conditions s'appliquent à toute commande de produits TAGGO passée sur ce site. Toute commande implique l'adhésion sans réserve aux présentes conditions, après lecture de leur résumé avant la validation de la commande.",
    },
  ],
  sections: [
    {
      id: 'article-1-objet',
      title: 'Article 1 — Objet',
      blocks: [
        {
          kind: 'paragraph',
          text: `Les présentes conditions régissent les ventes de vêtements TAGGO commerciallyisés sur le site ${BUSINESS.businessName}. Toute commande implique l'adhésion sans réserve aux présentes conditions, après lecture de leur résumé avant la validation de la commande.`,
        },
        {
          kind: 'paragraph',
          text: "TAGGO peut mettre à jour les présentes conditions à tout moment. La version applicable est celle en vigueur au moment de la validation de la commande. Les modifications ne s'appliquent pas aux commandes déjà validées.",
        },
        {
          kind: 'paragraph',
          text: `Les présentes conditions doivent être approuvées par TAGGO et validées par un conseil juridique avant toute mise en production commerciale. Les champs entre crochets signalent une information non encore confirmée : ${businessValue('legalForm')}.`,
        },
      ],
    },
    {
      id: 'article-2-produits',
      title: 'Article 2 — Produits',
      blocks: [
        {
          kind: 'paragraph',
          text: "Les produits proposés à la vente sont des vêtements TAGGO portant un QR code unique. Les caractéristiques essentielles (modèle, coupe, matières, tailles disponibles, couleurs, entretien) sont indiquées sur la fiche produit.",
        },
        {
          kind: 'definition',
          entries: [
            { term: 'Matière', description: businessValue('material') },
            { term: 'Certifications', description: businessValue('certifications') },
            { term: 'Guide des tailles', description: businessValue('sizeGuide') },
            { term: 'Conseils d’entretien', description: businessValue('careInstructions') },
          ],
        },
        {
          kind: 'paragraph',
          text: "Les photographies et visuels sont présentés à titre indicatif. Un produit peut présenter de légères variations de teinte ou de texture par rapport aux visuels affichés, sans que cela constitue un défaut de conformité.",
        },
        {
          kind: 'paragraph',
          text: "Les produits sont proposés dans la limite des stocks disponibles. L'indisponibilité d'une variante est signalée sur le site et, le cas échéant, par email au client.",
        },
      ],
    },
    {
      id: 'article-3-prix',
      title: 'Article 3 — Prix',
      blocks: [
        {
          kind: 'paragraph',
          text: "Les prix sont indiqués en euros, toutes taxes comprises, hors frais de livraison éventuels indiqués avant la validation de la commande. Le prix applicable est celui affiché au moment de la validation de la commande.",
        },
        {
          kind: 'paragraph',
          text: "TAGGO se réserve le droit de modifier ses prix à tout moment. Une telle modification n'affecte pas les commandes déjà validées. Les frais de livraison éventuels sont indiqués avant la validation de la commande.",
        },
        {
          kind: 'definition',
          entries: [
            { term: 'Seuil de livraison offerte', description: businessValue('freeShippingThreshold') },
          ],
        },
        {
          kind: 'note',
          text: "Aucun prix n'est affiché sur ce site tant que les prix officiels TAGGO ne sont pas publiés. Aucun montant n'est estimé, déduit ou inventé.",
        },
      ],
    },
    {
      id: 'article-4-commande',
      title: 'Article 4 — Commande',
      blocks: [
        {
          kind: 'paragraph',
          text: "La commande est formée par la validation de votre panier suivie de la validation du paiement. La commande est définitive lorsque TAGGO confirme la réception du paiement.",
        },
        {
          kind: 'numbers',
          items: [
            'Vous sélectionnez un produit, une taille et une quantité.',
            'Vous renseignez vos informations de contact et de livraison.',
            'Vous validez le paiement sur la page de paiement sécurisée.',
            'TAGGO accuse réception de la commande par email.',
          ],
        },
        {
          kind: 'paragraph',
          text: "TAGGO se réserve le droit d'annuler toute commande présentant un caractère anormal (quantité anormale, suspicion de fraude, erreur manifeste de prix) et d'en informer le client sans délai.",
        },
        {
          kind: 'paragraph',
          text: "La commande est confirmée à l'adresse email communiquée lors de la commande ou du compte associé. Il appartient au client de vérifier que cette adresse est correcte et fonctionnelle.",
        },
      ],
    },
    {
      id: 'article-5-paiement',
      title: 'Article 5 — Paiement',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Le paiement s’effectue sur une page de paiement sécurisée gérée par le prestataire de paiement. Aucun numéro de carte n’est enregistré par TAGGO.',
        },
        {
          kind: 'definition',
          entries: [
            { term: 'Fournisseur de paiement', description: businessValue('paymentProvider') },
            { term: 'Moyens de paiement acceptés', description: businessValue('paymentMethods') },
          ],
        },
        {
          kind: 'paragraph',
          text: "Le prix est intégralement dû au moment de la commande. La commande n'est prise en charge par TAGGO qu'après confirmation serveur du paiement. Un retour de la page de paiement ne vaut pas confirmation de paiement.",
        },
        {
          kind: 'note',
          text: "TAGGO ne peut accepter un paiement partiel sans accord écrit préalable avec le client.",
        },
      ],
    },
    {
      id: 'article-6-livraison',
      title: 'Article 6 — Livraison',
      blocks: [
        {
          kind: 'paragraph',
          text: "TAGGO propose la livraison en France métropolitaine en priorité. La livraison dans d'autres zones peut être proposée ultérieurement.",
        },
        {
          kind: 'definition',
          entries: [
            { term: 'Délai de préparation', description: businessValue('productionDelay') },
            { term: 'Délai de livraison France', description: businessValue('deliveryDelayFrance') },
            { term: 'Délai de livraison Europe', description: businessValue('deliveryDelayEurope') },
            { term: 'Délai de livraison international', description: businessValue('deliveryDelayInternational') },
            { term: 'Transporteur', description: businessValue('deliveryCarrier') },
            { term: 'Adresse de livraison', description: businessValue('address') },
          ],
        },
        {
          kind: 'paragraph',
          text: "Les frais de livraison sont indiqués avant la validation de la commande. Le suivi de la commande, lorsqu'il est disponible, est communiqué par email à l'expédition.",
        },
        {
          kind: 'paragraph',
          text: "Livraison internationale : lorsqu'une livraison hors Union européenne est proposée, les droits de douane, taxes et frais éventuels liés à ces opérations restent à la charge du destinataire, sauf mention contraire indiquée avant la commande. TAGGO ne peut être tenue responsable d'un retard ou d'une retenue par les services de douane du pays de destination.",
        },
        {
          kind: 'note',
          text: "Les délais affichés ne constituent pas une garantie ferme de livraison : ils sont donnés à titre indicatif. Aucun délai n'est publié tant qu'il n'est pas confirmé par le transporteur retenu.",
        },
      ],
    },
    {
      id: 'article-7-retractation',
      title: 'Article 7 — Droit de rétractation',
      blocks: [
        {
          kind: 'paragraph',
          text: "Conformément aux dispositions du Code de la consommation applicables aux ventes à distance, le client dispose d'un délai de quatorze (14) jours à compter de la réception du produit pour exercer son droit de rétractation, sans motif ni pénalité.",
        },
        {
          kind: 'paragraph',
          text: "Pour exercer ce droit, le client doit notifier sa volonté de rétracter à TAGGO avant l'expiration du délai, par email à l'adresse de contact TAGGO ou via le formulaire de contact, en indiquant son intention de retourner le produit concerné.",
        },
        {
          kind: 'paragraph',
          text: "Le produit doit être retourné dans son état d'origine, non porté, non lavé et avec son emballage et ses étiquettes, dans un délai raisonnable après notification. Les frais de retour sont à la charge du client, sauf si TAGGO a proposé un retour gratuit et que cette information était affichée avant la commande.",
        },
        {
          kind: 'paragraph',
          text: "TAGGO rembourse l'intégralité des sommes effectivement payées, hors frais de livraison standards optionnels et hors frais de retour, dans un délai de quatorze (14) jours suivant la réception du produit ou la preuve de son expédition par le client. Le remboursement utilise le même moyen de paiement que celui utilisé pour la commande.",
        },
        {
          kind: 'paragraph',
          text: "Des cas d'exception au droit de rétractation prévus par la loi peuvent s'appliquer à certaines catégories de produits. Ces exceptions sont strictement limitées à ce que la loi permet et doivent être vérifiées par TAGGO avant commercialisation.",
        },
        {
          kind: 'note',
          text: "TAGGO n'instaure aucune règle selon laquelle l'activation, la connexion, la configuration ou la modification d'un QR code ferait perdre automatiquement au client son droit de rétractation. Une telle exclusion ne pourrait résulter que d'une analyse juridique validée et d'une information préalable claire du client.",
        },
      ],
    },
    {
      id: 'article-8-retours',
      title: 'Article 8 — Retours et remboursements',
      blocks: [
        {
          kind: 'paragraph',
          text: 'La politique de retour applicable aux clients professionnels et aux demandes hors délai légal est la suivante :',
        },
        {
          kind: 'definition',
          entries: [{ term: 'Politique de retour commerciale TAGGO', description: businessValue('returnPolicy') }],
        },
        {
          kind: 'definition',
          entries: [{ term: 'Adresse de retour', description: businessValue('returnAddress') }],
        },
        {
          kind: 'paragraph',
          text: "TAGGO se réserve le droit de demander des informations complémentaires (photos, description du problème) avant de traiter un retour. Un retour non conforme peut être refusé ou partiellement remboursé.",
        },
        {
          kind: 'paragraph',
          text: "En cas de produit défectueux, non conforme à la commande ou endommagé à la réception, le client doit contacter TAGGO dans les meilleurs délais afin que la procédure de retour ou de remplacement puisse être engagée.",
        },
      ],
    },
    {
      id: 'article-9-garanties',
      title: 'Article 9 — Garanties légales',
      blocks: [
        {
          kind: 'paragraph',
          text: "TAGGO reste soumise aux garanties légales applicables à la vente, qui s'appliquent indépendamment de toute garantie commerciale :",
        },
        {
          kind: 'definition',
          entries: [
            {
              term: 'Garantie légale de conformité',
              description:
                "Le produit doit être conforme à la description, aux caractéristiques et aux visuels de la fiche produit, et être exempt de défauts d'aspect et de fabrication. Cette garantie permet au client de demander la réparation ou le remplacement du produit, ou à défaut, la résolution de la vente ou une réduction du prix.",
            },
            {
              term: 'Garantie des vices cachés',
              description:
                "Le client peut également se prévaloir de la garantie contre les vices cachés, qui permet d'obtenir, pour un produit acheté par un consommateur, la résolution de la vente ou une réduction de prix, sous réserve des conditions prévues par la loi.",
            },
            {
              term: 'Garantie commerciale TAGGO',
              description:
                "TAGGO peut offrir une garantie commerciale supplémentaire indépendante. À ce jour, aucune garantie commerciale supplémentaire n'est proposée et aucun engagement de durée de ce type n'est pris.",
            },
          ],
        },
        {
          kind: 'note',
          text: "Les garanties légales ne sont jamais écartées, limitées ou remplacées par une garantie commerciale TAGGO. Aucune garantie commerciale de durée fixe n'est annoncée tant qu'elle n'a pas été décidée et validée par TAGGO.",
        },
        {
          kind: 'paragraph',
          text: `Ces garanties s'exercent par contact avec TAGGO à l'adresse ${BUSINESS.supportEmail}, en décrivant le problème rencontré et en joignant si possible des photographies.`,
        },
      ],
    },
    {
      id: 'article-10-taggo',
      title: 'Article 10 — TAGGO, QR code et dashboard',
      blocks: [
        {
          kind: 'paragraph',
          text: "Chaque TAGGO comporte un QR code unique rattaché à un compte TAGGO. Le QR code permet d'accéder à une page publique dont le contenu est géré par son titulaire depuis son espace personnel (dashboard).",
        },
        {
          kind: 'paragraph',
          text: "Le titulaire du TAGGO peut, dans les limites des fonctionnalités disponibles, modifier la destination de son QR code et transférer son TAGGO à un autre compte selon les règles communiquées dans le dashboard. Les fonctionnalités exactes et leurs conditions d'utilisation sont précisées dans l'espace personnel.",
        },
        {
          kind: 'paragraph',
          text: "TAGGO ne garantit pas un nombre de consultations, de vues ou d'audience. Aucune performance commerciale ou quantitative n'est promise.",
        },
        {
          kind: 'paragraph',
          text: "TAGGO s'efforce d'assurer la disponibilité du service, sans pouvoir garantir une disponibilité ininterrompue. Une interruption liée à une maintenance, une évolution technique ou un cas de force majeure ne peut engager la responsabilité de TAGGO.",
        },
        {
          kind: 'note',
          text: "Les modalités financières d'un éventuel abonnement sont précisées à l'article suivant. Aucun abonnement n'est facturé tant que ses conditions n'ont pas été publiées et acceptées.",
        },
      ],
    },
    {
      id: 'article-11-contenus',
      title: 'Article 11 — Contenus publiés par les utilisateurs',
      blocks: [
        {
          kind: 'paragraph',
          text: "Le titulaire du TAGGO est seul responsable du contenu qu'il publie via sa page publique : textes, images, liens, noms de profil et toute information y étant associée.",
        },
        {
          kind: 'bullets',
          items: [
            'Les contenus publiés doivent être licites et ne pas enfreindre le droit à la vie privée d’autrui.',
            'Aucun contenu diffamatoire, injurieux, haineux, sexuel, violent ou incitant à la discrimination n’est accepté.',
            'Aucun contenu de nature publicitaire commerciale non autorisé, de contrefaçon ou de violation de droit d’auteur n’est accepté.',
            'TAGGO n’exerce aucune modération éditoriale a priori sur les contenus publiés par ses utilisateurs.',
          ],
        },
        {
          kind: 'paragraph',
          text: "En publiant un contenu, le titulaire garantit disposer des droits nécessaires sur celui-ci et indemnise TAGGO en cas de réclamation fondée sur ce contenu.",
        },
      ],
    },
    {
      id: 'article-12-suspension',
      title: 'Article 12 — Suspension et modération',
      blocks: [
        {
          kind: 'paragraph',
          text: "TAGGO peut suspendre ou supprimer une page publique, une destination de QR code ou un compte en cas de violation des présentes conditions, des droits d'autrui ou de la loi, ou de risque pour la sécurité des utilisateurs.",
        },
        {
          kind: 'paragraph',
          text: "La suspension est en principe notifiée et peut être révoquée lorsque la situation est régularisée. Une suspension prononcée pour fraude ou manquement grave peut être définitive.",
        },
        {
          kind: 'paragraph',
          text: "La désactivation d'un compte n'entraîne pas automatiquement le remboursement d'achats déjà réglés et effectivement livrés.",
        },
      ],
    },
    {
      id: 'article-13-responsabilite',
      title: 'Article 13 — Responsabilité',
      blocks: [
        {
          kind: 'paragraph',
          text: "TAGGO ne saurait être tenue responsable des dommages et pertes indirects résultant de l'utilisation du site ou du service, ni de l'indisponibilité temporaire du service.",
        },
        {
          kind: 'paragraph',
          text: "TAGGO ne peut être tenue responsable du contenu publié par les utilisateurs, ni des dommages qui en découlent. La responsabilité de TAGGO ne pourra exceedre le montant effectivement payé par le client pour la commande concernée, dans les limites permises par la loi.",
        },
        {
          kind: 'paragraph',
          text: "TAGGO n'est pas responsable des conséquences de l'utilisation du service par le titulaire pour des activités professionnelles, associatives ou commerciales : la page publique est un outil de communication et non un service de communication professionnelle réglementé.",
        },
      ],
    },
    {
      id: 'article-14-donnees',
      title: 'Article 14 — Données personnelles',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Le traitement des données personnelles est décrit dans la politique de confidentialité de TAGGO, qui fait partie intégrante des présentes conditions.',
        },
        {
          kind: 'paragraph',
          text: `Toute question relative aux données personnelles peut être adressée à ${BUSINESS.supportEmail}.`,
        },
      ],
    },
    {
      id: 'article-15-propriete',
      title: 'Article 15 — Propriété intellectuelle',
      blocks: [
        {
          kind: 'paragraph',
          text: `Les éléments utilisés sur le site et sur les produits TAGGO — nom, logo, identité visuelle, textes, visuels, illustrations, maquettes et code — sont détenus par ${BUSINESS.businessName} ou font l'objet d'une autorisation d'utilisation. Ils ne peuvent être reproduits ou exploités sans autorisation écrite préalable.`,
        },
        {
          kind: 'paragraph',
          text: "Les présentes conditions ne constituent pas une revendication de propriété sur des techniques ou des concepts tiers, et notamment pas sur le principe d'un QR code lisible sur un vêtement.",
        },
      ],
    },
    {
      id: 'article-16-reclamations',
      title: 'Article 16 — Réclamations',
      blocks: [
        {
          kind: 'paragraph',
          text: `Toute réclamation relative à une commande doit être adressée à ${BUSINESS.supportEmail} en indiquant la référence de commande, la date de commande et le motif de la réclamation.`,
        },
        {
          kind: 'paragraph',
          text: "TAGGO accuse réception de la réclamation et informe le client de la suite donnée dans les meilleurs délais. Une réclamation n'a pas pour effet de suspendre le cours du délai légal de rétractation, sauf disposition contraire prévue par la loi.",
        },
      ],
    },
    {
      id: 'article-17-mediation',
      title: 'Article 17 — Médiation de la consommation',
      blocks: [
        {
          kind: 'paragraph',
          text: "Tout consommateur a le droit de recourir gratuitement à un médiateur de la consommation pour tenter de régler de manière amiable un litige l'opposant à TAGGO, après avoir tenté au préalable de résoudre le litige par une réclamation écrite adressée à TAGGO.",
        },
        {
          kind: 'definition',
          entries: [
            { term: 'Médiateur de la consommation', description: businessValue('mediator') },
            { term: 'Site du médiateur', description: businessValue('mediatorWebsite') },
            { term: 'Contact du médiateur', description: businessValue('mediatorContact') },
          ],
        },
        {
          kind: 'note',
          text: "Aucun médiateur n'est désigné à ce jour. TAGGO doit choisir un médiateur réellement inscrit dans la liste officielle et compléter cette section avant toute commercialisation. La désignation d'un médiateur non officiel ou non présent dans la liste publiée serait irrégulière.",
        },
      ],
    },
    {
      id: 'article-18-droit',
      title: 'Article 18 — Droit applicable',
      blocks: [
        {
          kind: 'paragraph',
          text: "Les présentes conditions sont régies par le droit français. Elles s'appliquent aux commandes passées par des consommateurs résidant en France, conformément aux règles de droit européen et français applicables.",
        },
        {
          kind: 'paragraph',
          text: "Lorsque les présentes conditions instituent une clause attributive de compétence, cette clause ne peut être opposée au consommateur dans le cadre d'un litige, conformément aux règles de droit français applicables à la protection des consommateurs.",
        },
        {
          kind: 'paragraph',
          text: "En cas de litige avec un client consommateur, aucune clause attributive de compétence ne peut être opposée à ce dernier. En cas de litige avec un client professionnel ou revendeur, la compétence des tribunaux du ressort de TAGGO peut être prévue, sous réserve de son opposabilité : ",
        },
        {
          kind: 'definition',
          entries: [{ term: 'Tribunal compétent (clients professionnels)', description: businessValue('address') }],
        },
        {
          kind: 'paragraph',
          text: "La langue de rédaction des présentes conditions et des échanges relatifs à la commande est le français.",
        },
        {
          kind: 'note',
          text: "La rédaction exacte de la clause de compétence et l'éventuel tribunal référent doivent être validés par un conseil juridique avant commercialisation. Aucune ville n'est annoncée ici tant que l'adresse du siège social et le ressort compétent ne sont pas connus.",
        },
      ],
    },
  ],
}