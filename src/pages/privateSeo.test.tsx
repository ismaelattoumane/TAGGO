import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { CartProvider } from '../context/CartContext'
import { LoginPage } from './LoginPage'
import { RegisterPage } from './RegisterPage'
import { PasswordResetPage } from './PasswordResetPage'
import { PasswordUpdatePage } from './PasswordUpdatePage'
import { NotFoundPage } from './NotFoundPage'

/**
 * Étape 10 — Pages privées : elles doivent rester hors de l'index.
 *
 * `/login`, `/register`, `/forgot-password`, `/reset-password`, `/dashboard/*`,
 * `/cart`, `/checkout/*` et `/404` ne doivent jamais être indexées.
 */

const PRIVATE_PAGES = [
  { path: '/login', element: <LoginPage />, heading: /connexion/i },
  { path: '/register', element: <RegisterPage />, heading: /créez|inscription|créer/i },
  { path: '/forgot-password', element: <PasswordResetPage />, heading: /mot de passe/i },
  { path: '/reset-password', element: <PasswordUpdatePage />, heading: /mot de passe/i },
]

function renderPrivate(path: string, element: React.ReactElement) {
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

function robots(): string | null {
  return document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? null
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('pages privées hors index', () => {
  it.each(PRIVATE_PAGES)('$path est marquée noindex, nofollow', async ({ path, element, heading }) => {
    renderPrivate(path, element)

    await screen.findAllByRole('heading', { level: 1 })
    expect(screen.getAllByRole('heading', { level: 1 })[0].textContent).toMatch(heading)
    expect(robots()).toBe('noindex, nofollow')
    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
  })

  it('la page 404 reste hors index', async () => {
    renderPrivate('/404', <NotFoundPage />)

    await screen.findByRole('heading', { level: 1 })
    expect(robots()).toBe('noindex, nofollow')
  })
})