import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from './LandingPage'
import { FAQ_ITEMS } from './landingFaqItems'
import { buildLandingJsonLd, serializeJsonLd } from './landingStructuredData'

/**
 * Landing TAGGO — rendu, contenu essentiel et données structurées.
 *
 * Le hero 3D est décoratif : tout le contenu lisible (titres, résumé pour les
 * lecteurs d'écran, FAQ, JSON-LD) doit être présent dans le DOM sans WebGL.
 */

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

describe('LandingPage', () => {
  it('expose un titre de niveau 1 et le résumé textuel du hero', () => {
    renderLanding()

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading.textContent?.length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /TAGGO en bref/i })).toBeInTheDocument()
  })

  it('affiche les sections empilées de la landing', () => {
    renderLanding()

    for (const id of [
      'concept',
      'how-it-works',
      'customization',
      'dashboard',
      'use-cases',
      'security',
      'product',
      'faq',
      'final-cta',
    ]) {
      expect(document.getElementById(id), `section #${id} manquante`).not.toBeNull()
    }
  })

  it('rend la FAQ complète et la renvoie vers la page dédiée', () => {
    renderLanding()

    const faq = document.getElementById('faq')
    expect(faq).not.toBeNull()

    const triggers = within(faq as HTMLElement).getAllByRole('button')
    expect(triggers).toHaveLength(FAQ_ITEMS.length)
    expect(triggers[0]).toHaveAttribute('aria-expanded', 'false')

    expect(within(faq as HTMLElement).getByRole('link', { name: /toutes les questions/i })).toHaveAttribute(
      'href',
      '/faq',
    )
  })

  it('publie les données structurées Organization, WebSite, WebPage et FAQPage', () => {
    renderLanding()

    const script = document.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()

    const data = JSON.parse(script?.textContent ?? '{}') as {
      '@graph': Array<{ '@type': string }>
    }
    const types = data['@graph'].map((node) => node['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('WebSite')
    expect(types).toContain('WebPage')
    expect(types).toContain('FAQPage')
  })

  it('affiche le wordmark TAGGO dans l’en-tête et le pied de page', () => {
    renderLanding()

    const marks = document.querySelectorAll(
      '.taggo-landing-header__logo-mark, .taggo-landing-footer__logo-mark',
    )
    expect(marks).toHaveLength(2)
    for (const mark of marks) {
      expect(mark.getAttribute('viewBox')).toBe('126 126 846 126')
      expect(mark.querySelectorAll('path').length).toBeGreaterThan(0)
    }
  })

  it('masque l’en-tête tant que la section #concept n’est pas atteinte', () => {
    renderLanding()

    const header = document.querySelector('.taggo-landing-header')
    expect(header).not.toBeNull()
    expect(header).toHaveClass('taggo-landing-header--hidden')
    expect(header).toHaveAttribute('inert')
  })

  it('affiche le contenu sans fondu au scroll', () => {
    renderLanding()

    const reveals = document.querySelectorAll('.taggo-reveal')
    expect(reveals.length).toBeGreaterThan(0)
    for (const reveal of reveals) {
      expect(reveal).not.toHaveClass('taggo-reveal--visible')
    }
  })
})

describe('buildLandingJsonLd', () => {
  it('construit un graphe complet à partir du domaine public', () => {
    const data = buildLandingJsonLd({
      origin: 'https://taggo.space/',
      title: 'TAGGO',
      description: 'TAGGO transforme ton T-shirt en identité numérique.',
      supportEmail: 'support-taggo@protonmail.com',
      faq: [{ question: 'Qu’est-ce qu’un TAGGO ?', answer: ['Un T-shirt connecté.'] }],
    })

    expect(data['@context']).toBe('https://schema.org')
    const graph = data['@graph'] as Array<Record<string, unknown>>
    expect(graph).toHaveLength(4)

    const faq = graph.find((node) => node['@type'] === 'FAQPage') as {
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>
    }
    expect(faq.mainEntity[0].name).toBe('Qu’est-ce qu’un TAGGO ?')
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe('Un T-shirt connecté.')
  })

  it('neutralise les chevrons pour un <script> inline', () => {
    const serialized = serializeJsonLd({ description: '<script>alert(1)</script>' })
    expect(serialized).not.toContain('<script>')
    expect(serialized).toContain('\\u003c')
  })
})
