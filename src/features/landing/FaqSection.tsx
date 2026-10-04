import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import { FaqAccordion } from '../faq/FaqAccordion'
import type { AccordionItem } from '../faq/FaqAccordion'
import './FaqSection.css'

/**
 * FAQ d'accueil : réponses volontairement prudentes, sans promesse chiffrée.
 * Le contenu détaillé et complet vit dans `src/content/faq/faqContent.ts`
 * et est rendu sur la page publique `/faq`.
 */
const FAQ_ITEMS: AccordionItem[] = [
  {
    id: 'quest-ce',
    question: "Qu'est-ce qu'un TAGGO ?",
    answer: [
      "TAGGO est un T-shirt connecté doté d'un QR code unique. Scanner ce QR code avec un smartphone ouvre une page publique personnalisable : liens sociaux, contact, bio, et bien plus.",
    ],
  },
  {
    id: 'scan',
    question: 'Comment fonctionne le QR code ?',
    answer: [
      "Chaque TAGGO possède un QR code unique imprimé sur le T-shirt. Lorsqu'une personne le scanne avec l'appareil photo de son smartphone, elle est redirigée vers ton profil public TAGGO. Aucune application n'est nécessaire pour scanner.",
    ],
  },
  {
    id: 'application',
    question: "Dois-je installer une application ?",
    answer: [
      "Non. Les personnes qui scannent ton TAGGO n'ont besoin d'aucune application — l'appareil photo du smartphone suffit. Toi, tu gères ton profil depuis ton espace TAGGO dans un navigateur web.",
    ],
  },
  {
    id: 'modifier-lien',
    question: 'Puis-je modifier mon lien ?',
    answer: [
      'Oui. Tu peux modifier la destination de ton QR code à tout moment depuis ton tableau de bord. Le QR code reste le même — seule la page de destination change.',
    ],
  },
  {
    id: 'changer-reseau',
    question: 'Que se passe-t-il si je change de réseau social ?',
    answer: [
      'Rien de compliqué. Tu mets à jour tes liens depuis ton espace TAGGO, et ton profil public reflète les changements. Le QR code, lui, ne change pas.',
    ],
  },
  {
    id: 'professionnel',
    question: "Puis-je utiliser TAGGO pour une entreprise ou une association ?",
    answer: [
      'Oui. TAGGO s’adresse aussi aux entreprises, associations, créateurs et organisateurs d’événements. Un TAGGO peut servir pour la communication, le recrutement, les campagnes ou tout autre usage professionnel.',
    ],
  },
  {
    id: 'scans',
    question: 'TAGGO garantit-il un nombre de scans ?',
    answer: [
      "Non. TAGGO ne promet aucun nombre de consultations, de vues ou d'audience : ce que ton TAGGO génère dépend de l'usage que tu en fais et des liens que tu choisis.",
    ],
  },
  {
    id: 'abonnement',
    question: "Que se passe-t-il lorsque mon abonnement expire ?",
    answer: [
      "Les modalités d'abonnement et de renouvellement seront précisées avant l'ouverture de la commercialisation. Aucun engagement commercial n'est proposé ici.",
    ],
  },
]

/**
 * TAGGO FAQ — accordéon accessible partagé avec la page `/faq`.
 */
export function FaqSection() {
  return (
    <section
      id="faq"
      className="taggo-landing-section taggo-landing-section--solid taggo-faq-section"
      aria-labelledby="faq-heading"
    >
      <Container size="md">
        <div className="taggo-faq-header">
          <Reveal>
            <span className="taggo-eyebrow">FAQ</span>
          </Reveal>
          <Reveal delay={100}>
            <h2 id="faq-heading" className="taggo-landing-heading">
              Questions fréquentes
            </h2>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <div className="taggo-faq-list">
            <FaqAccordion items={FAQ_ITEMS} idPrefix="landing-faq" headingLevel={3} />
          </div>
        </Reveal>

        <Reveal delay={300}>
          <p className="taggo-faq-header">
            <a className="taggo-button taggo-button--ghost" href="/faq">
              Voir toutes les questions
            </a>
          </p>
        </Reveal>
      </Container>
    </section>
  )
}