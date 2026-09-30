import { Link } from 'react-router-dom'

type PublicInfoPageKey = 'terms' | 'privacy' | 'notice' | 'contact'

type PublicInfoPageProps = {
  page: PublicInfoPageKey
}

const PAGE_CONTENT: Record<PublicInfoPageKey, { eyebrow: string; title: string; text: string }> = {
  terms: {
    eyebrow: 'Informations légales',
    title: 'Conditions d’utilisation',
    text: 'Les conditions d’utilisation de TAGGO seront publiées avant l’ouverture de la commercialisation.',
  },
  privacy: {
    eyebrow: 'Informations légales',
    title: 'Politique de confidentialité',
    text: 'La politique de confidentialité détaillée sera publiée avant l’ouverture de la commercialisation.',
  },
  notice: {
    eyebrow: 'Informations légales',
    title: 'Mentions légales',
    text: 'Les mentions légales de TAGGO seront publiées avant la mise en ligne commerciale du service.',
  },
  contact: {
    eyebrow: 'Contact',
    title: 'Nous contacter',
    text: 'Le canal de contact TAGGO sera communiqué lors de l’ouverture du service.',
  },
}

export function PublicInfoPage({ page }: PublicInfoPageProps) {
  const content = PAGE_CONTENT[page]

  return (
    <main className="public-page">
      <section className="public-card public-state-card">
        <p className="public-kicker">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.text}</p>
        <Link to="/" className="primary-button" style={{ textDecoration: 'none' }}>
          Retour à l’accueil
        </Link>
      </section>
    </main>
  )
}
