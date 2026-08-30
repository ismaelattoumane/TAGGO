import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
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

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
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
      { path: 'qr/:publicId', element: <PublicQrPage /> },
      { path: '404', element: <NotFoundPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
