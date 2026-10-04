import { BUSINESS, businessValue, LEGAL_DOCUMENTS_UPDATED_AT, LEGAL_REVIEW_NOTICE } from '../../config/business'
import type { ContentDocument } from '../types'

/**
 * ÉTAPE 10 — Informations de livraison et de retours (route `/shipping`).
 *
 * Aucun délai n'est annoncé comme définitif : tant que le transporteur et les
 * délais ne sont pas confirmés par TAGGO, la page affiche un placeholder
 * `[À COMPLÉTER — …]`.
 */
export const shippingDocument: ContentDocument = {
  path: '/shipping',
  eyebrow: 'Commande',
  title: 'Livraison et retours',
  description:
    'Informations de livraison TAGGO : délai de préparation, transporteur, suivi, frais, livraison internationale, douanes, retours et remboursement.',
  lead: `Dernière révision : ${LEGAL_DOCUMENTS_UPDATED_AT}. ${LEGAL_REVIEW_NOTICE}`,
  blocks: [
    {
      kind: 'note',
      text: "Les délais et frais indiqués sur cette page sont communiqués à titre indicatif et peuvent varier selon la destination et le transporteur. Ils doivent être confirmés par TAGGO avant commercialisation.",
    },
  ],
  sections: [
    {
      id: 'preparation',
      title: 'Délai de préparation',
      blocks: [
        {
          kind: 'paragraph',
          text: "Le délai de préparation s'entame à partir de la confirmation du paiement par TAGGO. Le délai annoncé figure ci-dessous : tant qu'il n'est pas confirmé par TAGGO, il reste un placeholder visible.",
        },
        {
          kind: 'definition',
          entries: [{ term: 'Délai de préparation', description: businessValue('productionDelay') }],
        },
        {
          kind: 'paragraph',
          text: "Un délai de préparation ne constitue pas une date limite de livraison : il s'ajoute au délai de transport.",
        },
      ],
    },
    {
      id: 'transport',
      title: 'Transport et suivi',
      blocks: [
        {
          kind: 'definition',
          entries: [
            { term: 'Transporteur', description: businessValue('deliveryCarrier') },
            { term: 'Délai de livraison France', description: businessValue('deliveryDelayFrance') },
            { term: 'Délai de livraison Europe', description: businessValue('deliveryDelayEurope') },
            { term: 'Délai de livraison international', description: businessValue('deliveryDelayInternational') },
          ],
        },
        {
          kind: 'paragraph',
          text: "Lorsqu'un numéro de suivi est disponible, il vous est communiqué par email à l'expédition. Le suivi est également accessible depuis votre espace TAGGO lorsque la fonctionnalité est disponible.",
        },
      ],
    },
    {
      id: 'frais',
      title: 'Frais de livraison',
      blocks: [
        {
          kind: 'definition',
          entries: [{ term: 'Seuil de livraison offerte', description: businessValue('freeShippingThreshold') }],
        },
        {
          kind: 'paragraph',
          text: "Les frais de livraison éventuels sont affichés avant la validation de la commande. Aucun frais supplémentaire n'est ajouté après la commande.",
        },
      ],
    },
    {
      id: 'international',
      title: 'Livraison internationale et douanes',
      blocks: [
        {
          kind: 'paragraph',
          text: "TAGGO vise en priorité la France métropolitaine. La livraison vers d'autres destinations peut être proposée ultérieurement, selon les pays et les conditions du transporteur.",
        },
        {
          kind: 'paragraph',
          text: "Lorsqu'une livraison hors Union européenne est proposée, les droits de douane, taxes et frais éventuels liés à ces opérations restent à la charge du destinataire, sauf mention contraire affichée avant la commande. TAGGO n'est pas responsable des retards ou des retenues opérés par les services de douane du pays de destination.",
        },
      ],
    },
    {
      id: 'retours',
      title: 'Retours',
      blocks: [
        {
          kind: 'definition',
          entries: [
            { term: 'Politique de retour TAGGO', description: businessValue('returnPolicy') },
            { term: 'Adresse de retour', description: businessValue('returnAddress') },
          ],
        },
        {
          kind: 'paragraph',
          text: "Si votre commande ne vous convient pas, contactez TAGGO avant de retourner le produit afin de connaître la procédure applicable. Les modalités complètes figurent dans les conditions générales de vente.",
        },
      ],
    },
    {
      id: 'remboursement',
      title: 'Remboursement',
      blocks: [
        {
          kind: 'paragraph',
          text: "Le remboursement s'effectue sur le moyen de paiement utilisé lors de la commande, après réception du produit retourné ou pour un produit défectueux, non conforme ou endommagé. Les délais de remboursement indicatifs doivent être confirmés par TAGGO.",
        },
        {
          kind: 'paragraph',
          text: `Pour toute demande, écrivez à ${BUSINESS.supportEmail} en précisant la référence de votre commande.`,
        },
      ],
    },
  ],
}