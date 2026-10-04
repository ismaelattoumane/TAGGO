import { BUSINESS, businessValue, LEGAL_DOCUMENTS_UPDATED_AT, LEGAL_REVIEW_NOTICE } from '../../config/business'
import type { ContentDocument } from '../types'

/**
 * ÉTAPE 10 — Politique de confidentialité / RGPD (route `/legal/privacy`).
 *
 * Seuls les traitements RÉELLEMENT mis en œuvre dans ce dépôt sont décrits :
 * Supabase (authentification, base de données), Stripe (paiement via Checkout
 * hébergé), Vercel (hébergement des fichiers statiques et des fonctions
 * serveur). Aucun sous-traitant n'est inventé.
 */
export const legalPrivacyDocument: ContentDocument = {
  path: '/legal/privacy',
  eyebrow: 'Données personnelles',
  title: 'Politique de confidentialité',
  description:
    "Politique de confidentialité et RGPD de TAGGO : données collectées, finalités, bases légales, durées de conservation, destinataires et droits des utilisateurs.",
  lead: `Dernière révision : ${LEGAL_DOCUMENTS_UPDATED_AT}. ${LEGAL_REVIEW_NOTICE}`,
  blocks: [
    {
      kind: 'paragraph',
      text: `TAGGO attache une grande importance à la protection de vos données personnelles. Cette page explique quelles données sont collectées, pourquoi, combien de temps elles sont conservées et comment exercer vos droits. Elle est rédigée pour être complétée et validée avant commercialisation.`,
    },
  ],
  sections: [
    {
      id: 'responsable-traitement',
      title: 'Responsable du traitement',
      blocks: [
        {
          kind: 'paragraph',
          text: `Le responsable du traitement des données est TAGGO. Les informations d'identification de l'éditeur sont disponibles dans les mentions légales. Toute question relative aux données personnelles peut être adressée à ${BUSINESS.supportEmail}.`,
        },
      ],
    },
    {
      id: 'donnees-collectees',
      title: 'Données collectées',
      blocks: [
        { kind: 'paragraph', text: 'TAGGO ne collecte que les données nécessaires à la fourniture du service :' },
        {
          kind: 'bullets',
          items: [
            'Données de compte : adresse email, prénom et nom tels que renseignés lors de l’inscription, identifiant technique de compte.',
            'Données de commande : référence de commande, produits et variantes sélectionnés, quantités, montants et devise, statut de la commande.',
            'Données de livraison : nom, prénom, adresse postale, code postal, ville, pays et, le cas échéant, numéro de téléphone renseignés par vous pour l’expédition.',
            'Données liées au TAGGO : identifiant unique du TAGGO (QR), contenu du profil public, liens ajoutés, dates de publication et de modification.',
            'Données liées au dashboard : historique des modifications effectuées depuis l’espace personnel, informations d’activation et de transfert d’un TAGGO.',
            'Données techniques : adresse IP, type de navigateur et pages consultées, uniquement lorsqu’elles sont nécessaires à la sécurité et au bon fonctionnement du service.',
          ],
        },
        {
          kind: 'note',
          text: "TAGGO ne demande pas de données sensibles (numéro de carte bancaire, données de santé, opinions politiques, convictions religieuses). Les paiements sont réalisés sur une page de paiement hébergée par Stripe : TAGGO ne stocke aucun numéro de carte.",
        },
      ],
    },
    {
      id: 'finalites',
      title: 'Finalités des traitements',
      blocks: [
        {
          kind: 'bullets',
          items: [
            'Créer et gérer votre compte TAGGO et authentifier vos connexions.',
            'Traiter vos commandes : préparation, paiement, expédition, livraison, retours et remboursement.',
            'Fournir et administrer les fonctionnalités associées à votre TAGGO : page publique, liens, QR code, dashboard, transfert.',
            'Envoyer les emails transactionnels liés à votre commande et à votre compte.',
            'Assurer la sécurité du service, prévenir la fraude et détecter les usages anormaux.',
            'Répondre à vos demandes et traiter les réclamations.',
          ],
        },
      ],
    },
    {
      id: 'bases-legales',
      title: 'Bases légales',
      blocks: [
        {
          kind: 'definition',
          entries: [
            {
              term: 'Exécution du contrat',
              description:
                'Traitements indispensables au fonctionnement du service et à la livraison d’une commande : création du compte, traitement de la commande, paiement, livraison, retours etservice après-vente.',
            },
            {
              term: 'Obligation légale',
              description:
                'Obligations comptables, fiscales et sociales applicables à TAGGO.',
            },
            {
              term: 'Intérêt légitime',
              description:
                'Sécurité du service, prévention de la fraude, amélioration technique et compréhension générale de l’utilisation du site.',
            },
            {
              term: 'Consentement',
              description:
                'Toute prospection par email ou tout traçage non strictement nécessaire. Le consentement peut être retiré à tout moment.',
            },
          ],
        },
      ],
    },
    {
      id: 'paiement',
      title: 'Paiement',
      blocks: [
        {
          kind: 'paragraph',
          text: "Le paiement est traité par Stripe. Lorsque vous êtes redirigé vers la page de paiement, Stripe collecte les données nécessaires au traitement de la transaction. TAGGO reçoit uniquement un identifiant de transaction, le montant et le statut du paiement.",
        },
        {
          kind: 'paragraph',
          text: `Le prestataire de paiement effectivement utilisé est : ${businessValue('paymentProvider')}. Les moyens de paiement acceptés sont : ${businessValue('paymentMethods')}.`,
        },
      ],
    },
    {
      id: 'emails-transactionnels',
      title: 'Emails transactionnels',
      blocks: [
        {
          kind: 'paragraph',
          text: "TAGGO peut vous envoyer des emails strictement liés au fonctionnement du service : confirmation de commande, expédition, livraison, demande d'avis, bienvenue et réinitialisation de mot de passe.",
        },
        {
          kind: 'paragraph',
          text: 'Ces emails ne sont pas envoyés depuis votre navigateur : ils sont déclenchés côté serveur après confirmation de l’événement concerné. Aucun mot de passe, aucune donnée bancaire et aucun jeton d’authentification n’y figure.',
        },
        {
          kind: 'paragraph',
          text: 'Ces emails sont envoyés sur l’adresse email associée à votre compte ou à votre commande. Vous pouvez demander leur non-envoi ou leur désabonnement en écrivant à ' + BUSINESS.supportEmail + '.',
        },
      ],
    },
    {
      id: 'newsletter',
      title: 'Newsletter et prospection',
      blocks: [
        {
          kind: 'paragraph',
          text: "TAGGO ne pratique aucune prospection commerciale sans accord préalable. Si une prospection est mise en place, elle reposera sur un consentement recueilli de façon distincte, révocable à tout moment, et elle distinguera clairement les emails marketing des emails transactionnels.",
        },
        {
          kind: 'paragraph',
          text: "Aucun outil de mesure d'audience tiers (Google Analytics, Meta Pixel ou équivalent) n'est installé sur ce site. Si un tel outil est ajouté, il sera déclaré dans la politique cookies et soumis à consentement préalable.",
        },
        {
          kind: 'paragraph',
          text: "TAGGO mesure en revanche, en interne, le nombre de scans de chaque TAGGO afin de vous présenter ces statistiques dans votre tableau de bord. Ce traitement est décrit dans la section « Statistiques de scans » ci-dessous.",
        },
      ],
    },
    {
      id: 'statistiques-scans',
      title: 'Statistiques de scans',
      blocks: [
        {
          kind: 'paragraph',
          text: "Afin de vous montrer combien de fois vos TAGGO ont été scannés, TAGGO enregistre chaque scan. Ces statistiques ne concernent que les TAGGO dont vous êtes propriétaire et ne sont visibles que par vous, dans votre espace.",
        },
        {
          kind: 'definition',
          entries: [
            {
              term: 'Données enregistrées',
              description:
                "Uniquement le TAGGO scanné et la date du scan. Rien d'autre.",
            },
            {
              term: 'Données volontairement NON enregistrées',
              description:
                "Aucune adresse IP, aucun appareil, aucun système d'exploitation, aucun navigateur, aucun pays, aucune ville, aucune adresse de provenance, aucun cookie et aucun identifiant de visiteur.",
            },
            {
              term: 'Finalité',
              description:
                "Afficher le nombre de scans, l'évolution sur 7, 30 ou 90 jours et les scans récents dans votre tableau de bord.",
            },
            {
              term: 'Base légale',
              description:
                "Exécution de mesures d'audience internes qui ne permettent pas d'identifier une personne : aucun consentement n'est requis pour ce type de comptage, et aucun outil tiers n'est utilisé.",
            },
            {
              term: 'Destinataires',
              description:
                "Aucune donnée de scan n'est transmise à un tiers, à un régie publicitaire ou à un outil d'analyse externe.",
            },
{
              term: 'Préférences cookies',
              description:
                'Jusqu’à votre prochain choix ou jusqu’à la suppression des données de navigation.',
            },
            {
              term: 'Statistiques de scans',
              description:
                'Tant que le TAGGO existe dans votre compte. La suppression du TAGGO entraîne la suppression de ses scans.',
            },
          ],
        },
        {
          kind: 'note',
          text: "TAGGO limite volontairement le nombre de données collectées : seules les statistiques réellement utiles au propriétaire d'un TAGGO sont calculées. Aucune fonctionnalité n'a été ajoutée qui aurait nécessité de conserver une information permettant de reconnaître un visiteur.",
        },
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies et stockage local',
      blocks: [
        {
          kind: 'paragraph',
          text: "TAGGO utilise uniquement des cookies et stockages strictement nécessaires au fonctionnement du site : session d'authentification, panier, mémorisation du choix relatif aux cookies et sécurité. Le comptage des scans n'utilise aucun cookie ni aucun stockage local. Le détail figure dans la politique cookies.",
        },
      ],
    },
    {
      id: 'durees-conservation',
      title: 'Durées de conservation',
      blocks: [
        {
          kind: 'note',
          text: "Les durées exactes doivent être validées par TAGGO avant commercialisation. Aucune durée n'est inventée ici.",
        },
        {
          kind: 'definition',
          entries: [
            {
              term: 'Données de compte',
              description:
                'Tant que le compte est actif, puis durée de conservation à confirmer par TAGGO après suppression du compte.',
            },
            {
              term: 'Données de commande',
              description:
                'Durée légale applicable à la comptabilité et aux pièces justificatives, à confirmer par TAGGO.',
            },
            {
              term: 'Données de livraison',
              description:
                'Durée nécessaire au traitement des retours et à la preuve de livraison, à confirmer par TAGGO.',
            },
            {
              term: 'Contenu du profil public',
              description:
                'Tant que le profil est publié ou que le TAGGO est attribué, puis jusqu’à suppression demandée.',
            },
            {
              term: 'Journaux techniques',
              description:
                'Durée limitée nécessaire à la sécurité et au diagnostic, à confirmer par TAGGO.',
            },
            {
              term: 'Préférences cookies',
              description: 'Jusqu’à votre prochain choix ou jusqu’à la suppression des données de navigation.',
            },
          ],
        },
      ],
    },
    {
      id: 'destinataires',
      title: 'Destinataires',
      blocks: [
        {
          kind: 'paragraph',
          text: "Vos données ne sont ni vendues, ni louées, ni cédées à des tiers à des fins publicitaires. Elles sont traitées par TAGGO et par les prestataires strictement nécessaires au service, décrits ci-dessous, agissant sur instruction de TAGGO.",
        },
      ],
    },
    {
      id: 'sous-traitants',
      title: 'Sous-traitants réellement utilisés',
      blocks: [
        {
          kind: 'note',
          text: "Seuls les sous-traitants réellement utilisés dans ce projet sont listés. Tout nouveau sous-traitant devra être ajouté ici avant son activation.",
        },
        {
          kind: 'definition',
          entries: [
            {
              term: 'Supabase',
              description:
                "Hébergement de la base de données, authentification des comptes, envoi des emails d'authentification et stockage des données applicatives.",
            },
            {
              term: 'Stripe',
              description:
                'Paiement par carte bancaire via une page de paiement hébergée. Stripe intervient en qualité de prestataire de paiement et ne transmet pas vos données de carte à TAGGO.',
            },
            {
              term: 'Vercel',
              description:
                'Hébergement des fichiers statiques du site et exécution des fonctions serveur de l’application. Nom, adresse et téléphone de l’hébergeur : à compléter dans les mentions légales.',
            },
          ],
        },
      ],
    },
    {
      id: 'transferts-hors-ue',
      title: 'Transferts hors Union européenne',
      blocks: [
        {
          kind: 'paragraph',
          text: "TAGGO vise en priorité un hébergement et des prestataires situés dans l'Union européenne. Si un transfert de données hors de l'Union européenne devenait nécessaire, il serait documenté ici (pays, données concernées, garantie applicable) avant son activation.",
        },
        {
          kind: 'note',
          text: `Le statut exact des transferts de données hors UE (par exemple pour le prestataire d'hébergement ou le prestataire de paiement) doit être vérifié par TAGGO et son conseil avant commercialisation : ${businessValue('host')}.`,
        },
      ],
    },
    {
      id: 'securite',
      title: 'Sécurité',
      blocks: [
        {
          kind: 'paragraph',
          text: "TAGGO applique des mesures techniques et organisationnelles pour protéger vos données : authentification gérée par un prestataire dédié, autorisations d'accès contrôlées base de données (RLS), validation des données côté serveur, absence de secret dans le code accessible depuis le navigateur et limitation des informations personnelles envoyées par email.",
        },
        {
          kind: 'paragraph',
          text: "TAGGO ne peut garantir une sécurité absolue des transmissions sur Internet. En cas de violation de données susceptible d'engager des risques élevés pour vous, TAGGO vous en informera dans les conditions prévues par la réglementation applicable.",
        },
      ],
    },
    {
      id: 'droits',
      title: 'Vos droits',
      blocks: [
        {
          kind: 'paragraph',
          text: "Sous réserve des conditions prévues par la réglementation applicable, vous disposez des droits suivants :",
        },
        {
          kind: 'bullets',
          items: [
            'Droit d’accès à vos données.',
            'Droit de rectification de vos données inexactes.',
            'Droit à l’effacement (« droit à l’oubli »).',
            'Droit à la limitation du traitement.',
            'Droit d’opposition pour motif légitime, et à tout moment sans motif s’agissant de la prospection.',
            'Droit à la portabilité de vos données.',
            'Droit de retirer votre consentement à tout moment, sans que cela ne remette en cause la licéité du traitement effectué auparavant.',
          ],
        },
      ],
    },
    {
      id: 'exercer-droits',
      title: 'Comment exercer vos droits',
      blocks: [
        {
          kind: 'paragraph',
          text: `Adressez votre demande à ${BUSINESS.supportEmail}, en précisant l'objet de votre demande et l'adresse email du compte concerné. Une pièce d'identité pourra vous être demandée lorsque cela est nécessaire pour vérifier votre identité et éviter toute divulgation à un tiers.`,
        },
        {
          kind: 'paragraph',
          text: "TAGGO répond dans les délais prévus par la réglementation applicable. Vous pouvez également exercer vos droits directement depuis les paramètres de votre compte lorsque ces fonctionnalités sont disponibles.",
        },
      ],
    },
    {
      id: 'cnil',
      title: 'Réclamation auprès de la CNIL',
      blocks: [
        {
          kind: 'paragraph',
          text: "Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de l'autorité de contrôle compétente. En France, il s'agit de la Commission nationale de l'informatique et des libertés (CNIL), dont les coordonnées officielles sont publiées sur son site institutionnel.",
        },
        {
          kind: 'note',
          text: "Les coordonnées complètes et à jour de la CNIL doivent être vérifiées par TAGGO avant commercialisation et insérées ici.",
        },
      ],
    },
    {
      id: 'contact-rgpd',
      title: 'Contact',
      blocks: [
        {
          kind: 'paragraph',
          text: `Toute demande relative aux données personnelles peut être adressée à ${BUSINESS.supportEmail}. Cette adresse est utilisée comme point de contact RGPD tant qu'elle n'a pas été remplacée par une adresse dédiée.`,
        },
      ],
    },
  ],
}