import { useState } from 'react'
import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import './FaqSection.css'

const FAQ_ITEMS = [
  {
    question: "Qu'est-ce qu'un TAGGO ?",
    answer:
      "TAGGO est un T-shirt connecté doté d'un QR code unique. Scanner ce QR code avec un smartphone ouvre une page publique personnalisable : liens sociaux, contact, bio, et bien plus.",
  },
  {
    question: 'Comment fonctionne le QR code ?',
    answer:
      "Chaque TAGGO possède un QR code unique imprimé sur le T-shirt. Lorsqu'une personne le scanne avec l'appareil photo de son smartphone, elle est redirigée vers ton profil public TAGGO. Aucune application n'est nécessaire pour scanner.",
  },
  {
    question: "Dois-je installer une application ?",
    answer:
      "Non. Les personnes qui scannent ton TAGGO n'ont besoin d'aucune application — l'appareil photo du smartphone suffit. Toi, tu gères ton profil depuis ton espace TAGGO dans un navigateur web.",
  },
  {
    question: 'Puis-je modifier mon lien ?',
    answer:
      "Oui. Tu peux modifier la destination de ton QR code à tout moment depuis ton tableau de bord. Le QR code reste le même — seule la page de destination change.",
  },
  {
    question: 'Que se passe-t-il si je change de réseau social ?',
    answer:
      "Rien de compliqué. Tu mets à jour tes liens depuis ton espace TAGGO, et ton profil public reflète les changements instantanément. Le QR code, lui, ne change pas.",
  },
  {
    question: "Puis-je utiliser TAGGO pour une entreprise ou une association ?",
    answer:
      "Absolument. TAGGO s'adresse aussi aux entreprises, associations, créateurs et organisateurs d'événements. Un TAGGO peut servir pour la communication, le recrutement, les campagnes ou tout autre usage professionnel.",
  },
  {
    question: 'Comment fonctionnent les scans ?',
    answer:
      "Chaque fois que quelqu'un scanne ton QR code, il accède à ton profil public. Tu peux consulter le nombre de scans depuis ton tableau de bord.",
  },
  {
    question: "Que se passe-t-il lorsque mon abonnement expire ?",
    answer:
      "À l'expiration de ton abonnement, ton TAGGO et ton profil public peuvent être désactivés. Tu conserves tes données et peux réactiver ton TAGGO à tout moment en renouvelant ton abonnement.",
  },
]

type FaqItemProps = {
  item: (typeof FAQ_ITEMS)[number]
  index: number
  isOpen: boolean
  onToggle: () => void
}

function FaqItem({ item, index, isOpen, onToggle }: FaqItemProps) {
  const id = `faq-item-${index}`
  const panelId = `faq-panel-${index}`

  return (
    <div className={`taggo-faq-item${isOpen ? ' taggo-faq-item--open' : ''}`}>
      <h3 className="taggo-faq-item__question">
        <button
          type="button"
          className="taggo-faq-item__button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="taggo-faq-item__text">{item.question}</span>
          <span className="taggo-faq-item__icon" aria-hidden="true">
            {isOpen ? '−' : '+'}
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={id}
        className="taggo-faq-item__panel"
        hidden={!isOpen}
      >
        <p className="taggo-faq-item__answer">{item.answer}</p>
      </div>
    </div>
  )
}

/**
 * TAGGO FAQ — accessible accordion with honest answers.
 */
export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const handleToggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index))
  }

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
            {FAQ_ITEMS.map((item, i) => (
              <FaqItem
                key={item.question}
                item={item}
                index={i}
                isOpen={openIndex === i}
                onToggle={() => handleToggle(i)}
              />
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
