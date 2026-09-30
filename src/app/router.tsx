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
import { PublicInfoPage } from '../pages/PublicInfoPage'
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
      { path: 'legal/terms', element: <PublicInfoPage page="terms" /> },
      { path: 'legal/privacy', element: <PublicInfoPage page="privacy" /> },
      { path: 'legal/notice', element: <PublicInfoPage page="notice" /> },
      { path: 'contact', element: <PublicInfoPage page="contact" /> },
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
