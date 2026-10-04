import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { CartProvider } from '../context/CartContext'
import { BUSINESS } from '../config/business'
import { AboutPage } from './AboutPage'
import { ContactPage } from './ContactPage'
import { FaqPage } from './FaqPage'
import { LegalCookiesPage } from './LegalCookiesPage'
import { LegalNoticePage } from './LegalNoticePage'
import { LegalPrivacyPage } from './LegalPrivacyPage'
import { LegalTermsPage } from './LegalTermsPage'
import { ShippingPage } from './ShippingPage'

/**
 * Étape 10 — Pages publiques : rendu, SEO, accessibilité de base et navigation.
 */

type RouteDefinition = { path: string; element: React.ReactElement; title: string }

const PUBLIC_ROUTES: RouteDefinition[] = [
  { path: '/about', element: <AboutPage />, title: 'Le vêtement qui connecte.' },
  { path: '/faq', element: <FaqPage />, title: 'Questions fréquentes' },
  { path: '/legal/notice', element: <LegalNoticePage />, title: 'Mentions légales' },
  { path: '/legal/terms', element: <LegalTermsPage />, title: 'Conditions Générales de Vente — TAGGO' },
  { path: '/legal/privacy', element: <LegalPrivacyPage />, title: 'Politique de confidentialité' },
  { path: '/legal/cookies', element: <LegalCookiesPage />, title: 'Politique cookies' },
  { path: '/shipping', element: <ShippingPage />, title: 'Livraison et retours' },
  { path: '/contact', element: <ContactPage />, title: 'Nous contacter' },
]

function renderPage(path: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path={path} element={element} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function readMeta(name: string): string | null {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? null
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('pages publiques — rendu et accessibilité de base', () => {
  it.each(PUBLIC_ROUTES)('$path affiche un titre unique et un contenu structuré', async ({ path, element, title }) => {
    renderPage(path, element)

    const heading = await screen.findByRole('heading', { level: 1, name: title })
    expect(heading).toBeInTheDocument()

    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)

    // Hiérarchie : aucun titre ne saute un niveau (h1 -> h2 -> h3).
    const levels = screen
      .getAllByRole('heading')
      .map((node) => Number(node.tagName.slice(1)))
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index] - levels[index - 1]).toBeLessThanOrEqual(1)
    }

    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it.each(PUBLIC_ROUTES)('$path est indexable avec une URL canonique', async ({ path, element }) => {
    renderPage(path, element)

    await screen.findByRole('heading', { level: 1 })

    expect(readMeta('robots')).toBe('index, follow')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${window.location.origin}${path}`,
    )
    expect(document.title).toContain('TAGGO')
    expect(document.title).not.toMatch(/TAGGO — TAGGO$/)
    expect(document.title.length).toBeGreaterThan(10)
  })

  it.each(PUBLIC_ROUTES)('$path publie les métadonnées Open Graph et Twitter', async ({ path, element }) => {
    renderPage(path, element)

    await screen.findByRole('heading', { level: 1 })

    expect(
      document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content,
    ).toBe(document.title)
    expect(
      document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content,
    ).toBe(`${window.location.origin}${path}`)
    expect(
      document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content,
    ).toBe('TAGGO')
    expect(
      document.querySelector<HTMLMetaElement>('meta[property="og:locale"]')?.content,
    ).toBe('fr_FR')
    expect(
      document.querySelector<HTMLMetaElement>('meta[name="twitter:card"]')?.content,
    ).toBe('summary_large_image')
  })

  it.each(PUBLIC_ROUTES)('$path propose un lien d’évitement vers le contenu', async ({ path, element }) => {
    renderPage(path, element)
    await screen.findByRole('heading', { level: 1 })

    const skipLink = screen.getByRole('link', { name: 'Aller au contenu' })
    expect(skipLink).toHaveAttribute('href', '#taggo-content')
    expect(document.querySelector('#taggo-content')).not.toBeNull()
  })
})

describe('footer', () => {
  it('expose tous les liens publics obligatoires', async () => {
    renderPage('/about', <AboutPage />)
    await screen.findByRole('heading', { level: 1 })

    const footer = screen.getByRole('contentinfo')
    for (const [name, href] of [
      ['À propos', '/about'],
      ['FAQ', '/faq'],
      ['Contact', '/contact'],
      ['Mentions légales', '/legal/notice'],
      ['CGV', '/legal/terms'],
      ['Politique de confidentialité', '/legal/privacy'],
      ['Cookies', '/legal/cookies'],
      ['Livraison et retours', '/shipping'],
    ] as const) {
      const links = within(footer).getAllByRole('link', { name })
      expect(links.length).toBeGreaterThan(0)
      expect(links.some((link) => link.getAttribute('href') === href)).toBe(true)
    }
  })

  it('ne liste aucun réseau social tant qu’aucun compte officiel n’est défini', async () => {
    renderPage('/about', <AboutPage />)
    await screen.findByRole('heading', { level: 1 })

    const footer = screen.getByRole('contentinfo')
    expect(footer).not.toHaveTextContent('instagram.com')
    expect(footer).not.toHaveTextContent('tiktok.com')
    expect(footer).not.toHaveTextContent('snapchat.com')
  })
})

describe('Page À propos', () => {
  it('raconte l’histoire et présente l’équipe', async () => {
    renderPage('/about', <AboutPage />)

    expect(await screen.findByRole('heading', { name: 'L’histoire' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'La team' })).toBeInTheDocument()
    expect(screen.getByText(/On en avait marre des t-shirts vides/)).toBeInTheDocument()
    expect(screen.getByText('Viper')).toBeInTheDocument()
    expect(screen.getByText('Isma')).toBeInTheDocument()
  })

  it('ne présente aucune promesse de performance chiffrée', async () => {
    renderPage('/about', <AboutPage />)
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByText(/\d+\s?vues par jour/i)).not.toBeInTheDocument()
    expect(screen.getByText(/ne publie aucune promesse chiffrée/i)).toBeInTheDocument()
  })
})

describe('Page FAQ', () => {
  it('affiche les six catégories et un accordéon accessible', async () => {
    renderPage('/faq', <FaqPage />)

    await screen.findByRole('heading', { level: 1, name: 'Questions fréquentes' })

    for (const category of [
      'Produit',
      'Utilisation & transfert',
      'Commandes & tailles',
      'Livraison & retours',
      'Dashboard',
      'Paiement & sécurité',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: category })).toBeInTheDocument()
    }

    const trigger = screen.getByRole('button', { name: /Qu'est-ce qu'un TAGGO/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    const panelId = trigger.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    const panel = document.getElementById(panelId as string)
    expect(panel).toHaveAttribute('hidden')
    expect(panel).toHaveAttribute('role', 'region')
    expect(panel).toHaveAttribute('aria-labelledby', trigger.id)

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(panelId as string)).not.toHaveAttribute('hidden')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('affiche les placeholders des informations non confirmées', async () => {
    renderPage('/faq', <FaqPage />)
    await screen.findByRole('heading', { level: 1 })

    fireEvent.click(screen.getByRole('button', { name: /En quelle matière/ }))
    expect(screen.getByText(/\[À COMPLÉTER — matière\]/)).toBeInTheDocument()
  })
})

describe('Documents légaux', () => {
  it('expose un placeholder explicite pour chaque donnée inconnue', async () => {
    renderPage('/legal/notice', <LegalNoticePage />)
    await screen.findByRole('heading', { level: 1 })

    expect(screen.getByText('[À COMPLÉTER — SIRET]')).toBeInTheDocument()
    expect(screen.getByText('[À COMPLÉTER — forme juridique]')).toBeInTheDocument()
    expect(screen.getByText(BUSINESS.supportEmail)).toBeInTheDocument()
  })

  it('structure les CGV en 18 articles numérotés', async () => {
    renderPage('/legal/terms', <LegalTermsPage />)
    await screen.findByRole('heading', { level: 1 })

    expect(screen.getByRole('heading', { name: 'Article 7 — Droit de rétractation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Article 9 — Garanties légales' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Article 17 — Médiation de la consommation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Article 18 — Droit applicable' })).toBeInTheDocument()
  })

  it('documente le RGPD et la réclamation CNIL', async () => {
    renderPage('/legal/privacy', <LegalPrivacyPage />)
    await screen.findByRole('heading', { level: 1 })

    expect(screen.getByRole('heading', { name: 'Responsable du traitement' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Réclamation auprès de la CNIL' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vos droits' })).toBeInTheDocument()
  })

  it('documente les catégories de cookies réellement utilisées', async () => {
    renderPage('/legal/cookies', <LegalCookiesPage />)
    await screen.findByRole('heading', { level: 1 })

    expect(
      screen.getByRole('heading', { name: 'Cookies et stockages strictement nécessaires' }),
    ).toBeInTheDocument()
    // Seule la publicité reste inutilisée : le comptage des scans est utilisé
    // en interne, sans cookie ni identifiant.
    expect(screen.getAllByText('Non utilisé par TAGGO à ce jour').length).toBe(1)
  })

  it('documente la mesure d’audience interne et son absence de traçage', async () => {
    renderPage('/legal/cookies', <LegalCookiesPage />)
    await screen.findByRole('heading', { level: 1 })

    const analytics = screen.getByRole('heading', { name: 'Mesure d’audience' })
    const section = analytics.closest('section') ?? analytics.parentElement

    expect(section?.textContent).toMatch(/Utilisé par TAGGO/)
    expect(section?.textContent).toMatch(/sans cookie/i)
    // Aucune promesse de refus : la mesure d'audience interne n'en dépend pas.
    expect(section?.textContent).toMatch(
      /Non \(mesure d’audience interne sans cookie ni identifiant, qui ne permet pas d’identifier une personne\)/,
    )
    expect(screen.queryByText(/Google Analytics|Meta Pixel/i)).not.toBeInTheDocument()
  })
})

describe('Page livraison', () => {
  it('ne publie aucun délai définitif', async () => {
    renderPage('/shipping', <ShippingPage />)
    await screen.findByRole('heading', { level: 1 })

    expect(screen.getByText(/\[À COMPLÉTER — délai de préparation\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[À COMPLÉTER — délai de livraison France\]/)).toBeInTheDocument()
    expect(screen.queryByText(/\d+\s?-\s?\d+\s?jours/)).not.toBeInTheDocument()
  })
})

describe('Page contact', () => {
  it('affiche le canal de contact validé', async () => {
    renderPage('/contact', <ContactPage />)
    await screen.findByRole('heading', { level: 1 })

    expect(screen.getByRole('link', { name: BUSINESS.supportEmail })).toHaveAttribute(
      'href',
      `mailto:${BUSINESS.supportEmail}`,
    )
    expect(screen.getByText('[À COMPLÉTER — téléphone]')).toBeInTheDocument()
  })

  it('annonce les erreurs de saisie de façon accessible', async () => {
    renderPage('/contact', <ContactPage />)
    await screen.findByRole('heading', { level: 1 })

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'pas-un-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Préparer le message' }))

    const alerts = screen.getAllByRole('alert')
    expect(alerts.length).toBeGreaterThan(0)
    expect(screen.getByText('Cette adresse email n’est pas valide.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('prépare un mailto encodé sans envoyer de données à un serveur', async () => {
    renderPage('/contact', <ContactPage />)
    await screen.findByRole('heading', { level: 1 })

    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Alex' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } })
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Bonjour & merci <TAGGO>' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Préparer le message' }))

    const link = await screen.findByRole('link', { name: /Ouvre ta messagerie/ })
    const href = link.getAttribute('href') ?? ''
    expect(href.startsWith(`mailto:${BUSINESS.supportEmail}?`)).toBe(true)
    expect(href).not.toContain('<TAGGO>')
    expect(href).toContain('%26')
  })
})