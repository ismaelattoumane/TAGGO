import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from '../App'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { CreateQrPage } from '../pages/CreateQrPage'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PublicQrPage } from '../pages/PublicQrPage'
import { QrDetailPage } from '../pages/QrDetailPage'
import { RegisterPage } from '../pages/RegisterPage'
import { SettingsPage } from '../pages/SettingsPage'
import { TagRedirectPage } from '../pages/TagRedirectPage'
import { ActivateTaggoPage } from '../pages/ActivateTaggoPage'
import { LandingPage } from '../features/landing/LandingPage'
import { AboutPage } from '../pages/AboutPage'
import { ContactPage } from '../pages/ContactPage'
import { FaqPage } from '../pages/FaqPage'
import { LegalCookiesPage } from '../pages/LegalCookiesPage'
import { LegalNoticePage } from '../pages/LegalNoticePage'
import { LegalPrivacyPage } from '../pages/LegalPrivacyPage'
import { LegalTermsPage } from '../pages/LegalTermsPage'
import { ShippingPage } from '../pages/ShippingPage'
import { CartPage } from '../pages/CartPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { CheckoutCancelPage } from '../pages/CheckoutCancelPage'
import { CheckoutSuccessPage } from '../pages/CheckoutSuccessPage'
import { ProductPage } from '../pages/ProductPage'
import { ShopPage } from '../pages/ShopPage'
import { PasswordResetPage } from '../pages/PasswordResetPage'
import { PasswordUpdatePage } from '../pages/PasswordUpdatePage'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <GuestRoute><LoginPage /></GuestRoute> },
      { path: 'register', element: <GuestRoute><RegisterPage /></GuestRoute> },
      { path: 'forgot-password', element: <PasswordResetPage /> },
      { path: 'reset-password', element: <PasswordUpdatePage /> },
      { path: 'legal/terms', element: <LegalTermsPage /> },
      { path: 'legal/privacy', element: <LegalPrivacyPage /> },
      { path: 'legal/notice', element: <LegalNoticePage /> },
      { path: 'legal/cookies', element: <LegalCookiesPage /> },
      { path: 'shipping', element: <ShippingPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'faq', element: <FaqPage /> },
      { path: 'contact', element: <ContactPage /> },
      // Public TAGGO shop (step 8).
      { path: 'shop', element: <ShopPage /> },
      { path: 'shop/:slug', element: <ProductPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      // Retour de Stripe Checkout (étape 9) : lecture seule, aucun effet de bord.
      { path: 'checkout/success', element: <CheckoutSuccessPage /> },
      { path: 'checkout/cancel', element: <CheckoutCancelPage /> },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'dashboard/settings',
        element: (
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'dashboard/qr/new',
        element: (
          <ProtectedRoute>
            <CreateQrPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'dashboard/qr/:qrId',
        element: (
          <ProtectedRoute>
            <QrDetailPage />
          </ProtectedRoute>
        ),
      },
      // Canonical public TAG route.
      { path: 't/:tag', element: <PublicQrPage /> },
      {
        path: 'activate/:tag',
        element: (
          <ProtectedRoute>
            <ActivateTaggoPage />
          </ProtectedRoute>
        ),
      },
      // Legacy compatibility: /qr/:publicId -> /t/:tag redirect.
      { path: 'qr/:publicId', element: <TagRedirectPage /> },
      { path: '404', element: <NotFoundPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
], {
  basename: import.meta.env.BASE_URL
})

export function AppRouter() {
  return <RouterProvider router={router} />
}
